require("dotenv").config();
const express = require("express");
const { handleMessage, cleanupExpiredSessions } = require("./bot");
const db = require("./db");
const { request } = require("./net");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GRAPH_URL = "https://graph.facebook.com/v26.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const processedMessageIds = new Set();
const MSG_ID_TTL = 1000 * 60 * 60;
const STALE_MSG_MS = parseInt(process.env.STALE_MSG_MS || "180000", 10);

app.get("/", (req, res) => {
  res.send("Zipra grocery bot + admin is running");
});

app.get("/health", (req, res) => {
  let database = "ok";
  try {
    db.db.prepare("SELECT 1 AS ok").get();
  } catch (err) {
    database = "error";
  }
  res.json({
    status: database === "ok" ? "ok" : "error",
    server: "ok",
    database,
    whatsapp: {
      token: WHATSAPP_TOKEN ? "configured" : "missing",
      phoneNumberId: PHONE_NUMBER_ID ? "configured" : "missing",
      businessId: process.env.WHATSAPP_BUSINESS_ID ? "configured" : "missing",
      verifyToken: VERIFY_TOKEN ? "configured" : "missing",
    },
    webhook: { path: "/webhook", method: "POST", verify: "ok" },
    timestamp: new Date().toISOString(),
  });
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  console.log(`[verify] mode=${mode} token=${token} challenge=${challenge} host=${req.headers.host} ip=${req.ip}`);
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified");
    return res.status(200).send(challenge);
  }
  console.warn(`[verify] REJECTED token mismatch (mode=${mode}, token=${token})`);
  return res.sendStatus(403);
});

function buildReplyPayload(to, reply) {
  if (reply.type === "list") {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: reply.body },
        action: { button: reply.button, sections: reply.sections },
      },
    };
  }
  if (reply.type === "buttons") {
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: reply.body },
        action: { buttons: reply.buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
      },
    };
  }
  return {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: reply.text },
  };
}

const OUTGOING_QUEUE = [];
const OUTGOING_MAX_RETRIES = 5;
const OUTGOING_BACKOFF = [30000, 120000, 300000, 600000, 600000];
let outgoingBusy = false;

function queueObject(to, body) {
  const text =
    body && typeof body.text === "string"
      ? body.text
      : body && body.text && body.text.body
        ? body.text.body
        : body && body.interactive
          ? JSON.stringify(body.interactive)
          : JSON.stringify(body);
  return `${to}|${text}`;
}

function enqueueOutgoingSend(to, body) {
  const key = queueObject(to, body);
  if (OUTGOING_QUEUE.some((q) => q.key === key)) return false;
  OUTGOING_QUEUE.push({ key, to, body, attempts: 0 });
  return true;
}

async function sendMessageHandler(to, body) {
  try {
    const res = await request(`${GRAPH_URL}/${PHONE_NUMBER_ID}/messages`, {
      method: "POST",
      contentType: "application/json",
      body: JSON.stringify(body),
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      timeout: 6000,
      retries: 0,
    });
    if (res.status >= 400) {
      console.error("WhatsApp send failed:", res.status, res.text.slice(0, 200));
      return "rejected";
    }
    console.log("[send] OK to", to);
    return "ok";
  } catch (err) {
    console.error("WhatsApp send error:", err ? (err.message || err) : String(err));
    return "network";
  }
}

async function drainOutgoingQueue() {
  if (outgoingBusy) return;
  outgoingBusy = true;
  try {
    const due = OUTGOING_QUEUE.filter((q) => q.attempts === 0 || Date.now() >= q.nextAt);
    for (const q of due) {
      const idx = OUTGOING_QUEUE.indexOf(q);
      if (idx === -1) continue;
      const result = await sendMessageHandler(q.to, q.body);
      if (result === "ok") {
        OUTGOING_QUEUE.splice(idx, 1);
        continue;
      }
      if (result !== "network") {
        console.error("WhatsApp send permanently rejected for", q.to);
        OUTGOING_QUEUE.splice(idx, 1);
        continue;
      }
      q.attempts += 1;
      if (q.attempts >= OUTGOING_MAX_RETRIES) {
        console.error(`WhatsApp send gave up after ${q.attempts} attempts for`, q.to);
        OUTGOING_QUEUE.splice(idx, 1);
      } else {
        q.nextAt = Date.now() + OUTGOING_BACKOFF[Math.min(q.attempts, OUTGOING_BACKOFF.length - 1)];
        console.warn(`WhatsApp send queued for retry (${q.attempts}/${OUTGOING_MAX_RETRIES}) for`, q.to);
      }
    }
  } finally {
    outgoingBusy = false;
  }
}

async function sendMessage(to, body) {
  const result = await sendMessageHandler(to, body);
  if (result === "network") {
    enqueueOutgoingSend(to, body);
  }
  return result === "ok";
}

function sendReply(to, reply) {
  return sendMessage(to, buildReplyPayload(to, reply));
}

function sendText(to, text) {
  return sendMessage(to, {
    messaging_product: "whatsapp",
    to,
    type: "text",
    text: { body: text },
  });
}

const STATUS_NOTIFICATION = {
  confirmed:
    "✅ *Order Update*\n\nOrder #<ID>\n\nYour order has been confirmed.\n\n📦 *Status*\nConfirmed\n\nWe'll keep you updated here. 💚",
  preparing:
    "👨‍🍳 *Order Update*\n\nOrder #<ID>\n\nYour order is being prepared.\n\n📦 *Status*\nPreparing\n\nWe'll keep you updated here. 💚",
  out_for_delivery:
    "🛵 *Order Update*\n\nOrder #<ID>\n\nYour order is on the way!\n\n📦 *Status*\nOut for Delivery\n\nPlease keep your phone available for delivery. 💚",
  delivered:
    "🎉 *Order Delivered!*\n\nOrder #<ID>\n\nYour order has been delivered successfully.\n\nThank you for shopping with ZIPRA! 💚",
  cancelled:
    "❌ *Order Update*\n\nOrder #<ID>\n\nYour order has been cancelled.\n\nIf you need help, contact us on WhatsApp. 💚",
};

async function notifyStatus(order) {
  if (STATUS_NOTIFICATION[order.status]) {
    const msg = STATUS_NOTIFICATION[order.status].replace("<ID>", order.id);
    await sendText(order.waId, msg);
  }
}

const RELAY_TUNNEL_URL = process.env.RELAY_TUNNEL_URL || "";

app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (!body || !body.entry) return res.sendStatus(200);

  if (RELAY_TUNNEL_URL) {
    const fwd = JSON.stringify(body);
    try {
      const r = await request(`${RELAY_TUNNEL_URL}/webhook`, {
        method: "POST",
        contentType: "application/json",
        body: fwd,
        timeout: 4000,
        retries: 1,
      });
      if (r.status >= 400) console.error("relay status:", r.status);
    } catch (e) {
      console.error("relay error:", e.message);
    }
    return res.sendStatus(200);
  }

  const jobs = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const statuses = value.statuses;
      if (Array.isArray(statuses) && statuses.length) {
        for (const st of statuses) {
          const err = st.error && (st.error.message || st.error.code);
          console.log(`[webhook] status ${st.id || "?"} -> ${st.status}${err ? " error=" + String(err).slice(0, 80) : ""}`);
        }
      }
      const msgs = value.messages;
      if (!msgs) continue;
      for (const msg of msgs) {
        const msgId = msg.id;
        if (!msgId || processedMessageIds.has(msgId) || db.webhookMsgSeen(msgId)) continue;
        processedMessageIds.add(msgId);
        db.markWebhookMsg(msgId);

        if (STALE_MSG_MS > 0 && msg.timestamp) {
          const ageSec = Math.floor(Date.now() / 1000) - parseInt(msg.timestamp, 10);
          if (ageSec > STALE_MSG_MS / 1000) continue;
        }

        const from = msg.from;
        console.log(`[webhook] msg ${msgId} from ${from} type ${msg.type || (msg.text ? "text" : msg.location ? "location" : msg.interactive ? "interactive" : "other")}`);
        let payload = null;
        if (msg.text) {
          payload = { kind: "text", text: msg.text.body };
        } else if (msg.location) {
          payload = {
            kind: "location",
            latitude: msg.location.latitude,
            longitude: msg.location.longitude,
            address: msg.location.address || "",
            name: msg.location.name || "",
          };
        } else if (msg.interactive) {
          const reply =
            (msg.interactive.button_reply && msg.interactive.button_reply.id) ||
            (msg.interactive.list_reply && msg.interactive.list_reply.id) ||
            (msg.interactive.nfm_reply && msg.interactive.nfm_reply.response_json);
          if (reply) payload = { kind: "interactive", id: reply };
        }
        if (!payload) {
          console.log("[webhook] skipped msg (no parseable content)");
          continue;
        }
        jobs.push(
          (async () => {
            try {
              const botReply = await handleMessage(from, payload);
              if (botReply) await sendReply(from, botReply);
            } catch (err) {
              console.error("Message handling error:", err);
            }
          })()
        );
      }
    }
  }

  res.sendStatus(200);
  await Promise.allSettled(jobs);
});

function adminAuth(req, res, next) {
  if (ADMIN_TOKEN && req.headers.authorization !== `Bearer ${ADMIN_TOKEN}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

function wrap(fn) {
  return async (req, res) => {
    try {
      await fn(req, res);
    } catch (err) {
      res.status(400).json({ error: err.message || "Request failed" });
    }
  };
}

/* ------------------------- utility ------------------------- */

function notifyOption(body) {
  return body && (body.notify === true || body.notify === "true" || body.notify === 1);
}

/* ------------------------- orders ------------------------- */

app.get("/api/orders", adminAuth, wrap(async (req, res) => {
  const orders = db.listOrders({
    status: req.query.status || "all",
    q: req.query.q || "",
    limit: req.query.limit || 200,
  });
  res.json({ orders, stats: db.ordersStats(), statusCounts: db.statusCounts() });
}));

app.get("/api/orders/:id", adminAuth, wrap(async (req, res) => {
  const order = db.getOrderDetail(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
}));

function resolveItem(it) {
  let product = null;
  if (it.productId) product = db.getProductById(it.productId);
  else if (it.key) product = db.getProductByKey(it.key);
  const qty = db.num(it.qty, 1);
  const unit = it.unit || (product ? product.unit : "kg");
  const price = db.num(it.price, 0) || (product ? product.effectivePrice || product.price : 0);
  return {
    product_id: product ? product.id : null,
    key: product ? `${product.category}.${product.item}` : null,
    item: it.item || it.name || (product ? product.item : ""),
    unit,
    qty,
    price,
    total: qty * price,
    subtotal: qty * price,
  };
}

app.post("/api/orders", adminAuth, wrap(async (req, res) => {
  const b = req.body || {};
  if (!Array.isArray(b.items) || !b.items.length) throw new Error("Order must have at least one item");
  const items = b.items.map(resolveItem);
  if (items.some((i) => !i.item)) throw new Error("Each item needs a product name");
  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const deliveryFee = db.num(b.deliveryFee != null ? b.deliveryFee : db.deliveryFee(), db.deliveryFee());
  const discount = db.num(b.discount, 0);
  const total = db.num(b.total, subtotal + deliveryFee - discount);
  const phone = String(b.phone || b.waId || "").trim();
  const orderNo = db.nextOrderNo();
  const order = {
    id: orderNo,
    waId: phone,
    name: String(b.name || "").trim(),
    address: String(b.address || "").trim(),
    lat: b.lat != null ? db.num(b.lat) : null,
    lng: b.lng != null ? db.num(b.lng) : null,
    items,
    subtotal,
    deliveryFee,
    discount,
    total,
    paymentMethod: b.paymentMethod || "cod",
    paymentStatus: b.paymentStatus || (b.paymentMethod === "online" ? "Pending" : "Not Paid"),
    status: b.status || "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  for (const i of items) {
    if (i.product_id) db.reduceStock(i.key, i.qty);
    else return res.status(400).json({ error: `Unknown product: ${i.item}` });
  }
  db.insertOrder(order);
  res.json({ ok: true, order: db.getOrderDetail(orderNo) });
}));

app.put("/api/orders/:id", adminAuth, wrap(async (req, res) => {
  const orderNo = req.params.id;
  const before = db.getOrderDetail(orderNo);
  if (!before) return res.status(404).json({ error: "Order not found" });
  const b = req.body || {};
  if (Array.isArray(b.items)) {
    const newItems = b.items.map(resolveItem);
    const newItemsWithKey = newItems.map((n) => ({ id: n.product_id, qty: n.qty }));
    const oldItemsWithKey = (before.items || []).map((o) => ({ id: o.productId, qty: o.qty }));
    const allIds = new Set([
      ...newItemsWithKey.filter((x) => x.id).map((x) => x.id),
      ...oldItemsWithKey.filter((x) => x.id).map((x) => x.id),
    ]);
    for (const pid of allIds) {
      const oldQ = (oldItemsWithKey.find((x) => x.id === pid) || {}).qty || 0;
      const newQ = (newItemsWithKey.find((x) => x.id === pid) || {}).qty || 0;
      const delta = oldQ - newQ;
      if (delta) db.adjustStock(pid, delta, "Order edited", "order_edit", orderNo);
    }
  }
  const updated = db.updateOrder(orderNo, {
    name: b.name,
    waId: b.phone || b.waId,
    address: b.address,
    lat: b.lat,
    lng: b.lng,
    items: Array.isArray(b.items) ? b.items.map(resolveItem) : undefined,
    deliveryFee: b.deliveryFee,
    discount: b.discount,
    total: b.total,
    paymentMethod: b.paymentMethod,
    status: undefined,
  });
  res.json({ ok: true, order: updated });
}));

app.delete("/api/orders/:id", adminAuth, wrap(async (req, res) => {
  const order = db.getOrderDetail(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  db.deleteOrder(req.params.id);
  res.json({ ok: true });
}));

app.post("/api/orders/:id/status", adminAuth, wrap(async (req, res) => {
  const orderNo = req.params.id;
  const status = String(req.body && req.body.status || "").toLowerCase();
  const order = db.getOrderDetail(orderNo);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const updated = db.updateOrderStatus(orderNo, status, "admin");
  let notified = false;
  if (notifyOption(req.body)) {
    notified = await notifyStatus({ id: orderNo, waId: order.waId, status });
  }
  res.json({ ok: true, notified, order: updated });
}));

app.post("/api/orders/:id/payment", adminAuth, wrap(async (req, res) => {
  const orderNo = req.params.id;
  const status = String(req.body && req.body.status || "Paid");
  const method = req.body.method || null;
  const order = db.updatePayment(orderNo, status, method);
  res.json({ ok: true, order });
}));

app.post("/api/orders/:id/assign", adminAuth, wrap(async (req, res) => {
  const order = db.assignPartner(req.params.id, req.body && req.body.partnerId);
  res.json({ ok: true, order });
}));

app.post("/api/orders/:id/notify", adminAuth, wrap(async (req, res) => {
  const order = db.getOrderDetail(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (!order.waId) return res.status(400).json({ error: "No WhatsApp number on this order" });
  const message = String((req.body && req.body.message) || "").trim();
  const defaultMsg =
    `🧾 Order #${order.id} — ${order.status}\n\n` +
    `Placed: ${order.createdAt}\nTotal: ₹${order.total}\n` +
    (order.partnerName ? `Assigned to: ${order.partnerName}\n` : "") +
    `\nThank you for choosing ZIPRA 💚`;
  const sent = await sendText(order.waId, message || defaultMsg);
  res.json({ ok: true, sent });
}));

app.get("/api/orders/:id/invoice", adminAuth, wrap(async (req, res) => {
  const order = db.getOrderDetail(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  res.json({ order });
}));

/* ------------------------- products ------------------------- */

app.get("/api/products", adminAuth, wrap(async (req, res) => {
  res.json({
    products: db.listProducts({ q: req.query.q || "", category: req.query.category || "" }),
    categories: db.categories(),
  });
}));

app.get("/api/products/categories", adminAuth, wrap(async (req, res) => {
  res.json({ categories: db.categories() });
}));

app.post("/api/products", adminAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const product = db.createProduct(b);
  res.json({ ok: true, product });
}));

app.put("/api/products/:id", adminAuth, wrap(async (req, res) => {
  const product = db.updateProduct(Number(req.params.id), req.body || {});
  res.json({ ok: true, product });
}));

app.delete("/api/products/:id", adminAuth, wrap(async (req, res) => {
  db.deleteProduct(Number(req.params.id));
  res.json({ ok: true });
}));

app.post("/api/products/:id/toggle", adminAuth, wrap(async (req, res) => {
  const active = !!(req.body && req.body.active);
  const product = db.toggleProduct(Number(req.params.id), active);
  res.json({ ok: true, product });
}));

app.get("/api/products/:id/stock-history", adminAuth, wrap(async (req, res) => {
  res.json({ history: db.stockHistory(Number(req.params.id), 50) });
}));

/* ------------------------- inventory ------------------------- */

app.get("/api/inventory", adminAuth, wrap(async (req, res) => {
  res.json({ inventory: db.inventoryList() });
}));

app.post("/api/inventory/adjust", adminAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const productId = Number(b.productId);
  const delta = db.num(b.delta, 0);
  if (!productId) throw new Error("productId required");
  if (!delta) throw new Error("delta must be non-zero");
  db.setStock(productId, delta, b.reason || "Manual adjustment", "inventory", (req.body && req.body.by) || "admin");
  res.json({ ok: true, inventory: db.inventoryList() });
}));

app.get("/api/inventory/history", adminAuth, wrap(async (req, res) => {
  res.json({ history: db.recentStockHistory(100) });
}));

/* ------------------------- customers ------------------------- */

app.get("/api/customers", adminAuth, wrap(async (req, res) => {
  res.json({ customers: db.listCustomers() });
}));

app.get("/api/customers/:id", adminAuth, wrap(async (req, res) => {
  const customer = db.getCustomerDetail(Number(req.params.id));
  if (!customer) return res.status(404).json({ error: "Customer not found" });
  res.json({ customer });
}));

/* ------------------------- delivery partners ------------------------- */

app.get("/api/delivery-partners", adminAuth, wrap(async (req, res) => {
  res.json({ partners: db.listPartners() });
}));

app.post("/api/delivery-partners", adminAuth, wrap(async (req, res) => {
  const partner = db.createPartner(req.body || {});
  res.json({ ok: true, partner });
}));

app.put("/api/delivery-partners/:id", adminAuth, wrap(async (req, res) => {
  const partner = db.updatePartner(Number(req.params.id), req.body || {});
  res.json({ ok: true, partner });
}));

app.delete("/api/delivery-partners/:id", adminAuth, wrap(async (req, res) => {
  db.deletePartner(Number(req.params.id));
  res.json({ ok: true });
}));

/* ------------------------- promotions ------------------------- */

app.get("/api/promotions", adminAuth, wrap(async (req, res) => {
  res.json({ promotions: db.listPromotions() });
}));
app.post("/api/promotions", adminAuth, wrap(async (req, res) => {
  res.json({ ok: true, promotion: db.createPromotion(req.body || {}) });
}));
app.put("/api/promotions/:id", adminAuth, wrap(async (req, res) => {
  res.json({ ok: true, promotion: db.updatePromotion(Number(req.params.id), req.body || {}) });
}));
app.delete("/api/promotions/:id", adminAuth, wrap(async (req, res) => {
  db.deletePromotion(Number(req.params.id));
  res.json({ ok: true });
}));

/* ------------------------- reports & settings ------------------------- */

app.get("/api/reports", adminAuth, wrap(async (req, res) => {
  res.json({ reports: db.reportsData() });
}));

app.get("/api/stats", adminAuth, wrap(async (req, res) => {
  res.json({ stats: db.ordersStats(), statusCounts: db.statusCounts() });
}));

app.get("/api/settings", adminAuth, wrap(async (req, res) => {
  res.json({
    settings: {
      delivery_fee: db.getSetting("delivery_fee", db.deliveryFee()),
      store_name: db.getSetting("store_name", "ZIPRA Grocery"),
      phone: db.getSetting("store_phone", ""),
      address: db.getSetting("store_address", ""),
    },
  });
}));

app.put("/api/settings", adminAuth, wrap(async (req, res) => {
  const b = req.body || {};
  if (b.delivery_fee !== undefined) db.setSetting("delivery_fee", db.num(b.delivery_fee, 0));
  if (b.store_name !== undefined) db.setSetting("store_name", String(b.store_name));
  if (b.phone !== undefined) db.setSetting("store_phone", String(b.phone));
  if (b.address !== undefined) db.setSetting("store_address", String(b.address));
  res.json({ ok: true });
}));

/* ------------------------- admin page ------------------------- */

const ADMIN_HTML = require("./admin");

app.get("/admin", (req, res) => {
  res.send(ADMIN_HTML);
});

if (require.main === module) {
  setInterval(cleanupExpiredSessions, 60000);
  setInterval(drainOutgoingQueue, 30000);
  setInterval(() => {
    processedMessageIds.clear();
  }, MSG_ID_TTL);
}

app.use((req, res, next) => {
  res.status(200).send("Zipra endpoint OK");
});

if (require.main === module) {
  const server = app.listen(PORT, () => {
    console.log(`Zipra grocery bot listening on port ${PORT}`);
    console.log(`Webhook: POST /webhook | Admin: /admin | Health: /health`);
  });

  const gracefulShutdown = (signal) => {
    console.log(`[shutdown] ${signal} received, closing HTTP server`);
    server.close(() => {
      console.log("[shutdown] HTTP server closed");
      try {
        db.db.close();
      } catch (err) {
        console.error("[shutdown] database close error:", err.message);
      }
      console.log("[shutdown] bye");
      process.exit(0);
    });
    setTimeout(() => {
      console.log("[shutdown] forced exit after 5s");
      process.exit(0);
    }, 5000).unref();
  };
  process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
  process.on("SIGINT", () => gracefulShutdown("SIGINT"));
}

module.exports = { app };