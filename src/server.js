require("dotenv").config();
const express = require("express");
const path = require("path");
const crypto = require("crypto");
const { handleMessage, cleanupExpiredSessions, beginWebDeliveryCapture, deliveryReviewReply } = require("./bot");
const db = require("./db");
const { request } = require("./net");
const webapp = require("./webapp");
const shoplink = require("./shoplink");

const app = express();
app.use(express.json());

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GRAPH_URL = "https://graph.facebook.com/v26.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";
const WEB_APP_URL = String(process.env.WEB_APP_URL || `http://localhost:${PORT}`).replace(/\/+$/, "");
const PAYMENT_WEBHOOK_SECRET = String(process.env.PAYMENT_WEBHOOK_SECRET || "");
const PAYMENT_SIMULATOR = String(process.env.PAYMENT_SIMULATOR || "");
const PAYMENT_UPI_ID = String(process.env.PAYMENT_UPI_ID || "");
const PAYMENT_LINK = String(process.env.PAYMENT_LINK || "").trim();
const WHATSAPP_PAYMENT = String(process.env.WHATSAPP_PAYMENT || "").trim() === "1";
const PAYMENT_RECEIVER = String(process.env.PAYMENT_RECEIVER || "").replace(/[^\d]/g, "");
const OTP_SECRET = String(process.env.DELIVERY_OTP_SECRET || (PAYMENT_WEBHOOK_SECRET || "zipra-otp-pepper-dev"));

function buildPayLink(orderNo, total) {
  if (!PAYMENT_LINK) return "";
  const sep = PAYMENT_LINK.includes("?") ? "&" : "?";
  return `${PAYMENT_LINK}${sep}amount=${Number(total || 0)}&order=${encodeURIComponent(orderNo)}`;
}

/* Native UPI deep link. Opens the phone's UPI app chooser (Google Pay,
   PhonePe, Paytm, …) with the exact amount + ZIPRA order reference baked in.
   Payment is ONLY ever confirmed server-side via the gateway webhook. */
function buildUpiLink(order) {
  if (!PAYMENT_UPI_ID) return "";
  const amt = Number(order.total || 0).toFixed(2);
  const ref = String(order.id || "").replace(/[^A-Za-z0-9-]/g, "");
  const enc = (s) => encodeURIComponent(s).replace(/%40/g, "@");
  return (
    "upi://pay?pa=" + enc(PAYMENT_UPI_ID) +
    "&pn=" + enc("ZIPRA Grocery") +
    "&am=" + amt +
    "&cu=INR" +
    "&tn=" + enc("ZIPRA Order " + ref) +
    "&tr=" + enc("zipra" + ref)
  );
}

const BUSINESS_PHONE = String(process.env.BUSINESS_PHONE || "").replace(/[^\d]/g, "");
let cachedBusinessPhone = BUSINESS_PHONE || "";
let businessPhoneFetchedAt = 0;
/* WhatsApp number that customers chat with — used to deep-link them back to
   the chat ("wa.me/…") after checkout so they can tap Pay Now. Auto-fetched
   once from Graph API and cached for an hour; override with BUSINESS_PHONE. */
async function getBusinessPhone() {
  if (cachedBusinessPhone) return cachedBusinessPhone;
  if (Date.now() - businessPhoneFetchedAt < 3600000) return "";
  businessPhoneFetchedAt = Date.now();
  try {
    const r = await request(`${GRAPH_URL}/${PHONE_NUMBER_ID}?fields=display_phone_number`, {
      method: "GET",
      headers: { Authorization: `Bearer ${WHATSAPP_TOKEN}` },
      timeout: 6000,
      retries: 1,
    });
    if (r.status === 200 && r.text) {
      const j = JSON.parse(r.text);
      if (j.display_phone_number) cachedBusinessPhone = String(j.display_phone_number).replace(/\D/g, "");
    }
  } catch (e) {
    console.error("getBusinessPhone error:", e.message);
  }
  return cachedBusinessPhone;
}

function webUrl(pathname) {
  return WEB_APP_URL + (pathname || "");
}

function fmtMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function genOtp() {
  return crypto.randomInt(0, 1000000).toString().padStart(6, "0");
}

function otpHash(orderNo, otp) {
  return crypto.createHmac("sha256", OTP_SECRET).update(`${orderNo}:${otp}`).digest("hex");
}

function otpMatches(orderNo, storedHash, otp) {
  if (!storedHash || !/^\d{6}$/.test(String(otp || "").trim())) return false;
  const given = Buffer.from(otpHash(orderNo, String(otp).trim()));
  const stored = Buffer.from(storedHash);
  return given.length === stored.length && crypto.timingSafeEqual(given, stored);
}

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
        header: reply.headerText
          ? { type: "text", text: String(reply.headerText).slice(0, 60) }
          : undefined,
        body: { text: reply.body },
        footer: reply.footer ? { text: String(reply.footer).slice(0, 60) } : undefined,
        action: { button: reply.button, sections: reply.sections },
      },
    };
  }
  if (reply.type === "buttons") {
    const interactive = {
      type: "button",
      header:
        reply.headerImage
          ? { type: "image", image: { link: reply.headerImage } }
          : reply.headerText
            ? { type: "text", text: String(reply.headerText).slice(0, 60) }
            : undefined,
      body: { text: reply.body },
      footer: reply.footer ? { text: String(reply.footer).slice(0, 60) } : undefined,
      action: { buttons: reply.buttons.map((b) => ({ type: "reply", reply: { id: b.id, title: b.title } })) },
    };
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive,
    };
  }
  if (reply.type === "image") {
    return {
      messaging_product: "whatsapp",
      to,
      type: "image",
      image: { link: reply.imageLink },
      caption: reply.body,
    };
  }
  if (reply.type === "cta") {
    const b = reply.buttons && reply.buttons[0] || { title: "Open", url: "#" };
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "cta_url",
        header: reply.headerText ? { type: "text", text: String(reply.headerText).slice(0, 60) } : undefined,
        body: { text: reply.body },
        footer: reply.footer ? { text: String(reply.footer).slice(0, 60) } : undefined,
        action: {
          name: "cta_url",
          parameters: {
            display_text: String(b.title).slice(0, 25),
            url: String(b.url).slice(0, 2000),
          },
        },
      },
    };
  }
  if (reply.type === "pmt") {
    const paise = Math.round(Number(reply.amount || 0) * 100);
    return {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "pmt_request",
        action: {
          currency: "INR",
          total_amount: { value: paise, offset: 100 },
          receiver: PAYMENT_RECEIVER,
          reference: String(reply.orderNo || "").slice(0, 40),
        },
        body: { text: reply.body },
        footer: reply.footer ? { text: String(reply.footer).slice(0, 60) } : undefined,
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
  const sends =
    Array.isArray(reply)
      ? reply.map((r) => sendMessage(to, buildReplyPayload(to, r)))
      : [sendMessage(to, buildReplyPayload(to, reply))];
  return Promise.allSettled(sends).then((rs) => rs.every((r) => r.status === "fulfilled" && r.value));
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
    "🛍 *ZIPRA Order Update*\n\nOrder #<ID>\n\n🟢 Your order has been confirmed.\n\nWe'll notify you when it starts getting ready. 🧡",
  preparing:
    "🛍 *ZIPRA Order Update*\n\nOrder #<ID>\n\n🟠 Your order is now being prepared.\n\nWe'll notify you when it is out for delivery.",
  delivered:
    "✅ *Order Delivered*\n\nOrder #<ID>\n\nYour ZIPRA order has been delivered successfully.\n\nThank you for shopping with ZIPRA. 🛍️",
  cancelled:
    "❌ *Order Update*\n\nOrder #<ID>\n\nYour order has been cancelled.\n\nIf you need help, contact us on WhatsApp. 🧡",
};

/* Sends the WhatsApp status notification for an order (deduping happens at the
   route level — we only dispatch here for *new* transitions or explicit resend). */
async function notifyStatus(order) {
  if (!order || !order.waId) return false;
  const key = order.status;

  if (key === "out_for_delivery") {
    const otp = genOtp();
    db.setDeliveryOtp(order.id, otpHash(order.id, otp));
    const msg =
      `🛵 Your ZIPRA order is out for delivery!\n\n` +
      `Order #${order.id}\n\n` +
      `Your delivery partner is on the way.\n\n` +
      `🔐 Delivery verification is required.\n\n` +
      `Your 6-digit delivery OTP is:\n\n${otp}\n\n` +
      `Share it only with your delivery partner.`;
    await sendText(order.waId, msg);
    return true;
  }

  if (STATUS_NOTIFICATION[key]) {
    const msg = STATUS_NOTIFICATION[key].replace(/<ID>/g, order.id);
    await sendText(order.waId, msg);
    if (key === "delivered") {
      await sendReply(order.waId, deliveryReviewReply());
    }
    return true;
  }

  return false;
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
  const seenPaymentStatus = new Set();
  /* Handles a native WhatsApp Payments status notification (PG deep-integration
     mode). The order is identified by payment.reference_id (what we put in the
     order details / pay request). The amount we said the customer paid is
     cross-checked against the order total BEFORE we mark it Paid. */
  const handleNativePayment = (st, defaultValueContacts) => {
    const pid = String(st.id || "");
    if (pid && (seenPaymentStatus.has(pid) || db.webhookMsgSeen(pid))) return;
    if (pid) {
      seenPaymentStatus.add(pid);
      db.markWebhookMsg(pid);
    }
    const pay = st.payment || {};
    const ref = String(pay.reference_id || st.reference_id || "").trim();
    const amt = pay.amount ? Number(pay.amount.value) / Number(pay.amount.offset || 100) : null;
    const tp = String(st.type || "").toLowerCase();
    const stt = String(st.status || "").toLowerCase();
    console.log(`[webhook] native payment ${pid || "?"} -> ${stt} ref=${ref} amt=${amt == null ? "?" : fmtMoney(amt)}`);
    jobs.push(
      (async () => {
        try {
          if (ref) {
            const order = db.getOrderDetail(ref);
            if (!order) {
              console.log("[webhook] native payment ref not found:", ref);
              return;
            }
            if (["captured", "completed", "success"].includes(stt)) {
              await verifyPayment(ref, pay.transaction_id || pay.transaction?.id || pid || `wa-pay-${Date.now()}`, tp === "payment" ? "whatsapp" : pay.transaction?.type || "whatsapp", amt);
            } else if (["failed", "error", "declined", "rejected"].includes(stt)) {
              db.updatePayment(ref, "Failed", pay.transaction?.type || "whatsapp", pid || `wa-pay-${Date.now()}`);
              console.log("[webhook] native payment failed, order stays unpaid:", ref);
            } else if (["refunded", "refund"].includes(stt)) {
              db.updatePayment(ref, "Refunded", pay.transaction?.type || "whatsapp", pid || `wa-pay-${Date.now()}`);
            }
            // "pending" status → leave order Pending so the customer can retry
            return;
          }
          // No reference id yet — retro-match by sender + exact amount.
          const sender = String((defaultValueContacts && defaultValueContacts[0] && defaultValueContacts[0].wa_id) || st.sender || "").replace(/[^\d]/g, "");
          if (!sender || amt == null) return;
          const order = findPendingOrderByWaAndAmount(sender, amt);
          if (!order) {
            console.log("[webhook] native payment completed but no matching pending order", sender, amt);
            return;
          }
          const oid = order.id;
          if (["captured", "completed", "success"].includes(stt)) {
            await verifyPayment(oid, pid || `wa-pay-${Date.now()}`, "whatsapp", amt);
          }
        } catch (e) {
          console.error("[webhook] native payment verification error:", e.message);
        }
      })()
    );
  };
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const value = change.value || {};
      const statuses = value.statuses;
      if (Array.isArray(statuses) && statuses.length) {
        for (const st of statuses) {
          const err = st.error && (st.error.message || st.error.code);
          if ((st.type || "").toLowerCase() === "payment") {
            handleNativePayment(st, value.contacts);
            continue;
          }
          console.log(`[webhook] status ${st.id || "?"} -> ${st.status}${err ? " error=" + String(err).slice(0, 80) : ""}`);
        }
      }
      const payments = value.payments;
      if (Array.isArray(payments) && payments.length) {
        // Legacy/"payments" bucket form of the same notification.
        for (const p of payments) handleNativePayment({ id: p.id, status: p.status, payment: p.payment || p, sender: p.sender, type: p.type }, value.contacts);
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
        // Message-level payment confirmation (legacy "WhatsApp Pay" form).
        if (msg.interactive && msg.interactive.type === "payment" && msg.interactive.payment) {
          const p = msg.interactive.payment;
          const stt = String(p.status || "").toLowerCase();
          const amt = p.total_amount ? Number(p.total_amount.value) / Number(p.total_amount.offset || 100) : null;
          handleNativePayment({ id: "paymsg-" + msgId, status: stt, payment: { reference_id: p.reference_id, amount: { value: p.total_amount && p.total_amount.value, offset: p.total_amount && p.total_amount.offset }, transaction_id: p.transaction_id } });
          if (["captured", "completed", "success"].includes(stt)) continue; // don't double-route to the bot
        }
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
  const changed = order.status !== status;
  const updated = db.updateOrderStatus(orderNo, status, "admin");
  let notified = false;
  // Notify only when the status actually changes (no duplicates for the same
  // status). An explicit `notify:true` forces a resend.
  if (changed || notifyOption(req.body)) {
    notified = await notifyStatus({ id: orderNo, waId: order.waId, status });
  }
  res.json({ ok: true, notified, statusChanged: changed, order: updated });
}));

/* Resend the delivery OTP (out for delivery only). Never returns the OTP to
   the admin — it is only ever sent to the customer on WhatsApp. */
app.post("/api/orders/:id/delivery-otp", adminAuth, wrap(async (req, res) => {
  const order = db.getOrderDetail(req.params.id);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "out_for_delivery") {
    return res.status(400).json({ error: "Order is not out for delivery" });
  }
  const otp = genOtp();
  db.setDeliveryOtp(order.id, otpHash(order.id, otp));
  const msg =
    `🛵 Your ZIPRA order is out for delivery!\n\n` +
    `Order #${order.id}\n\n` +
    `🔐 Delivery verification is required.\n\n` +
    `Your 6-digit delivery OTP is:\n\n${otp}\n\n` +
    `Share it only with your delivery partner.`;
  await sendText(order.waId, msg);
  res.json({ ok: true, sent: true, waId: order.waId });
}));

/* Delivery partner / admin verifies the customer's OTP to complete delivery.
   Server-side only; wrong OTP never reveals the correct one. */
app.post("/api/delivery/verify-otp", adminAuth, wrap(async (req, res) => {
  const b = req.body || {};
  const orderNo = String(b.order_no || "").trim();
  const order = db.getOrderDetail(orderNo);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (order.status !== "out_for_delivery") {
    return res.status(400).json({ ok: false, error: "No active OTP for this order" });
  }
  const stored = db.getDeliveryOtpHash(orderNo);
  if (!stored) {
    return res.status(400).json({ ok: false, error: "No OTP generated for this order" });
  }
  if (!otpMatches(orderNo, stored, b.otp)) {
    return res.status(400).json({ ok: false, error: "❌ Invalid OTP" });
  }
  db.markDeliveryOtpUsed(orderNo);
  const updated = db.updateOrderStatus(orderNo, "delivered", "delivery-otp");
  await notifyStatus({ id: orderNo, waId: order.waId, status: "delivered" });
  res.json({ ok: true, order: updated });
}));

/* ------------------------- web shopping (public) ------------------------- */

app.use("/assets", express.static(path.join(__dirname, "assets"), { maxAge: "1h" }));

app.get("/shop", (req, res) => {
  res.type("html").send(webapp.shopPage(WEB_APP_URL));
});

app.get("/pay/:orderNo", wrap(async (req, res) => {
  const order = db.getOrderDetail(req.params.orderNo);
  if (!order) return res.status(404).send(webapp.notFoundPage());
  res.type("html").send(webapp.payPage(WEB_APP_URL, order, {
    paymentLink: buildPayLink(order.id, order.total),
    upiId: PAYMENT_UPI_ID,
    upiLink: buildUpiLink(order),
    simulator: PAYMENT_SIMULATOR === "1",
    waPhone: await getBusinessPhone(),
    store: db.getSetting("store_name", "ZIPRA Grocery"),
  }));
}));

app.get("/review", (req, res) => {
  res.type("html").send(webapp.reviewPage(WEB_APP_URL, req.query.order || ""));
});

app.get("/api/store/catalog", wrap(async (req, res) => {
  const categories = db.categories().map((name) => {
    const products = db.listProducts({ category: name, active: true }).map((p) => ({
      id: p.id,
      item: p.item,
      unit: p.unit,
      price: p.price,
      effectivePrice: p.effectivePrice,
      image: p.image,
      stock: p.stock,
      lowStockLevel: p.low_stock_level,
      available: p.available,
    }));
    return { name, products };
  });
  res.json({
    categories,
    waPhone: await getBusinessPhone(),
    deliveryFee: db.deliveryFee(),
    store: db.getSetting("store_name", "ZIPRA Grocery"),
  });
}));

app.get("/api/store/order/:orderNo", wrap(async (req, res) => {
  const order = db.getOrderDetail(req.params.orderNo);
  if (!order) return res.status(404).json({ error: "Order not found" });
  const intent = (order.payments || []).find((p) => ["Pending", "Paid"].includes(p.status));
  res.json({
    order: {
      id: order.id,
      waId: order.waId,
      items: order.items,
      subtotal: order.subtotal,
      deliveryFee: order.deliveryFee,
      total: order.total,
      paymentStatus: order.paymentStatus,
      paymentId: intent ? `PAY-${intent.id}` : null,
      status: order.status,
      createdAt: order.createdAt,
    },
  });
}));

/* Cart/checkout hand-off. The customer's WhatsApp number comes from the
   signed ?f= token embedded in their Shop link — no need to ask them for a
   phone number. The order is created in the DB (source of truth), then
   WhatsApp pushes the Pay Now card to that same chat. Re-checking out the
   identical cart within the idempotency window reuses the existing order so
   we never create duplicate orders or double-push payment. */
const CHECKOUT_CACHE = new Map(); // `${waId}:${sig}` -> { orderNo, at }
function itemsSig(items) {
  return items
    .slice()
    .sort((a, b) => Number(a.productId) - Number(b.productId) || Number(a.qty) - Number(b.qty))
    .map((i) => `${i.productId}x${i.qty}`)
    .join("|");
}
const CHECKOUT_WINDOW_MS = 30 * 60 * 1000;
app.post("/api/checkout", wrap(async (req, res) => {
  const b = req.body || {};
  const tokenWaId = b.token ? shoplink.verify(String(b.token)) : null;
  const phone = String(b.phone || tokenWaId || "").replace(/[^\d]/g, "");
  if (!/^\d{10,13}$/.test(phone)) {
    return res.status(401).json({ error: "Please open the shop from your WhatsApp chat (the checkout link is tied to your WhatsApp)." });
  }
  const items = Array.isArray(b.items) ? b.items : [];
  if (!items.length) throw new Error("Cart is empty");
  const resolved = [];
  for (const it of items) {
    const pid = Number(it.productId);
    const qty = Math.round(Number(it.qty));
    if (!(pid >= 1)) throw new Error("Invalid product in cart");
    if (!(qty >= 1)) throw new Error("Invalid quantity in cart");
    const p = db.getProductById(pid);
    if (!p) throw new Error("Unknown product in cart");
    if (!p.available || p.stock < qty) throw new Error(`${p.item} is out of stock / insufficient stock`);
    const price = p.effectivePrice && p.effectivePrice > 0 ? p.effectivePrice : p.price;
    resolved.push({ product_id: p.id, key: `${p.category}.${p.item}`, item: p.item, unit: p.unit, qty, price, subtotal: price * qty });
  }
  const subtotal = resolved.reduce((sum, i) => sum + i.subtotal, 0);
  const fee = db.deliveryFee();
  const total = subtotal + fee;
  const sig = itemsSig(items);
  const cacheKey = `${phone}:${sig}`;
  const cached = CHECKOUT_CACHE.get(cacheKey);
  if (cached && Date.now() - cached.at < CHECKOUT_WINDOW_MS) {
    const dupOrder = db.getOrderDetail(cached.orderNo);
    if (dupOrder && dupOrder.paymentStatus !== "Paid" && dupOrder.status !== "cancelled") {
      // Same cart, same user, still unpaid — reuse instead of duplicating.
      const dupObj = { ...dupOrder, items: dupOrder.items, subtotal: dupOrder.subtotal, deliveryFee: dupOrder.deliveryFee, total: dupOrder.total };
      db.addPaymentIntent(dupOrder.id, "online");
      await sendReply(phone, payCardPayload(dupObj));
      return res.json({ ok: true, reused: true, order: { id: dupOrder.id, total: dupOrder.total, subtotal: dupOrder.subtotal, deliveryFee: dupOrder.deliveryFee, waId: phone } });
    }
    CHECKOUT_CACHE.delete(cacheKey);
  }
  const orderNo = db.nextOrderNo();
  const t = new Date().toISOString();
  for (const i of resolved) db.reduceStock(i.key, i.qty);
  db.insertOrder({
    id: orderNo,
    waId: phone,
    name: "",
    address: "",
    lat: null,
    lng: null,
    items: resolved,
    subtotal,
    deliveryFee: fee,
    discount: 0,
    total,
    paymentMethod: "online",
    paymentStatus: "Pending",
    status: "received",
    createdAt: t,
    updatedAt: t,
  });
  const orderObj = {
    id: orderNo,
    waId: phone,
    name: "",
    address: "",
    lat: null,
    lng: null,
    items: resolved,
    subtotal,
    deliveryFee: fee,
    discount: 0,
    total,
    paymentMethod: "online",
    paymentStatus: "Pending",
    status: "received",
    createdAt: t,
    updatedAt: t,
  };
  CHECKOUT_CACHE.set(cacheKey, { orderNo, at: Date.now() });
  // One unique payment intent per order — recorded before any pay card is sent.
  db.addPaymentIntent(orderNo, "online");
  // Push Pay Now straight to the customer's WhatsApp (native payment card if
  // WhatsApp Payments is enabled, otherwise paylink / pay page via CTA).
  const payCard = payCardPayload(orderObj);
  const payOk = await sendReply(phone, payCard);
  if (!payOk && payCard.type === "pmt") {
    console.log("[checkout] WhatsApp pay card rejected — falling back to paylink CTA for", phone);
    await sendReply(phone, {
      type: "cta",
      headerText: "🧾 ZIPRA Order",
      body: payCard.body,
      buttons: [{ id: "cta|pay", title: "💳 Pay Now", url: buildPayLink(orderObj.id, orderObj.total) || webUrl(`/pay/${orderObj.id}`) }],
    });
  }
  res.json({ ok: true, order: { id: orderNo, total, subtotal, deliveryFee: fee, waId: phone } });
}));

function buildOrderSummaryText(order) {
  const items = Array.isArray(order.items) ? order.items : [];
  const cap = 12;
  const rows = items.map((i) => `• ${i.item} × ${i.qty} ${i.unit} — ${fmtMoney(i.subtotal)}`);
  const shown = rows.slice(0, cap);
  if (items.length > cap) shown.push(`…and ${items.length - cap} more item${items.length - cap === 1 ? "" : "s"}`);
  return (
    `🛒 *Your Order · ${items.reduce((s, i) => s + i.qty, 0)} item${items.reduce((s, i) => s + i.qty, 0) === 1 ? "" : "s"}*\n\n` +
    shown.join("\n") +
    `\n\nSubtotal: ${fmtMoney(order.subtotal)}\nDelivery: ${fmtMoney(order.deliveryFee)}` +
    (order.discount ? `\nDiscount: -${fmtMoney(order.discount)}` : "") +
    `\n*Total: ${fmtMoney(order.total)}*`
  );
}

function payCardPayload(order) {
  const body =
    `🧾 *Order #${order.id}* is ready for payment.\n\n` +
    buildOrderSummaryText(order) +
    `\n\nPay securely with *Google Pay, PhonePe, Paytm* or any UPI app.` +
    `\nTap *💳 Pay Now* below to continue.`;
  if (WHATSAPP_PAYMENT && PAYMENT_RECEIVER && /^\d{10,15}$/.test(PAYMENT_RECEIVER)) {
    return {
      type: "pmt",
      body,
      footer: "ZIPRA Grocery · Secure WhatsApp payment",
      amount: order.total,
      orderNo: order.id,
    };
  }
  return {
    type: "cta",
    headerText: "🧾 ZIPRA Order",
    body,
    buttons: [{ id: "cta|pay", title: "💳 Pay Now", url: buildPayLink(order.id, order.total) || webUrl(`/pay/${order.id}`) }],
  };
}

/* Payment provider → server callback. This is the ONLY way a payment becomes
   "Paid": status comes from the provider, never from a button click. */
function findPendingOrderByWaAndAmount(waId, amount) {
  const rows = db.listOrders({ limit: 200 });
  const target = Math.round(Number(amount) * 100);
  return (
    rows.find(
      (o) =>
        o.waId === waId &&
        (o.paymentStatus || "Pending") === "Pending" &&
        Math.round(Number(o.total) * 100) === target &&
        !["delivered", "cancelled"].includes(o.status)
    ) || null
  );
}
function paymentCardReply(orderNo, total) {
  const order = db.getOrderDetail(orderNo) || {
    id: orderNo,
    items: [],
    subtotal: total || 0,
    deliveryFee: 0,
    discount: 0,
    total: total || 0,
  };
  return payCardPayload(order);
}

async function verifyPayment(orderNo, txnId, method, amount) {
  const order = db.getOrderDetail(orderNo);
  if (!order) throw new Error("Order not found");
  if (order.paymentStatus === "Paid") return { ok: true, duplicate: true, order };
  // A cancelled order can never be flipped to Paid by a late/false callback.
  if (order.status === "cancelled") return { ok: false, duplicate: false, cancelled: true, order };
  // Amount reconciliation: if the provider tells us what was paid, it MUST equal
  // the order total. A mismatch is never recorded as paid.
  if (amount != null) {
    const paid = Math.round(Number(amount) * 100);
    const expected = Math.round(Number(order.total) * 100);
    if (paid !== expected) return { ok: false, duplicate: false, amountMismatch: { paid: Number(amount), expected: order.total }, order };
  }
  db.updatePayment(orderNo, "Paid", method || "online", txnId);
  const after = db.getOrderDetail(orderNo);
  if (after.waId) {
    const msgs = beginWebDeliveryCapture(after.waId, orderNo);
    for (const m of msgs) await sendReply(after.waId, m);
  }
  return { ok: true, duplicate: false, order: after };
}

app.post("/api/payment/webhook", wrap(async (req, res) => {
  if (!PAYMENT_WEBHOOK_SECRET) {
    return res.status(503).json({ error: "Payment webhook not configured (PAYMENT_WEBHOOK_SECRET)" });
  }
  const b = req.body || {};
  // Signature checks (accept any ONE of these):
  //   1. x-zipra-signature = HMAC-SHA256(JSON.stringify(body), PAYMENT_WEBHOOK_SECRET)   ← preferred
  //   2. x-webhook-secret = PAYMENT_WEBHOOK_SECRET (plain shared-secret header)
  //   3. body.secret = PAYMENT_WEBHOOK_SECRET (legacy)
  const hmacExpected = crypto.createHmac("sha256", PAYMENT_WEBHOOK_SECRET).update(JSON.stringify(b)).digest("hex");
  const hmacOk = typeof req.headers["x-zipra-signature"] === "string" && req.headers["x-zipra-signature"].toLowerCase() === hmacExpected;
  const secret = req.headers["x-webhook-secret"] || b.secret || "";
  if (!hmacOk && secret !== PAYMENT_WEBHOOK_SECRET) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  const orderNo = String(b.order_no || b.orderId || "").trim();
  const status = String(b.status || "success").toLowerCase();
  const txnId = String(b.txn_id || b.transaction_id || "").trim() || `txn-${Date.now()}`;
  const amount = b.amount != null ? Number(b.amount) : null;
  if (!orderNo) throw new Error("order_no required");
  const order = db.getOrderDetail(orderNo);
  if (!order) return res.status(404).json({ error: "Order not found" });
  if (status === "success" || status === "paid" || status === "captured") {
    const r = await verifyPayment(orderNo, txnId, b.method, amount);
    return res.json({ ok: true, ...r });
  }
  // failed / pending / refunded → record, never mark paid, never advance capture
  if (status === "failed" || status === "rejected" || status === "refunded") {
    db.updatePayment(orderNo, status === "refunded" ? "Refunded" : "Failed", b.method || "online", txnId);
    return res.json({ ok: true, status, order: db.getOrderDetail(orderNo) });
  }
  return res.json({ ok: true, status, order: db.getOrderDetail(orderNo) });
}));

/* Dev/demo-only surrogate for a real gateway callback. Disabled unless
   PAYMENT_SIMULATOR=1 is set. */
app.post("/api/payment/simulate/:orderNo", wrap(async (req, res) => {
  if (String(process.env.PAYMENT_SIMULATOR || "") !== "1") {
    return res.status(403).json({ error: "Payment simulator is disabled (set PAYMENT_SIMULATOR=1 to enable)" });
  }
  const r = await verifyPayment(req.params.orderNo, `sim-${Date.now()}`, "online");
  res.json({ simulated: true, ...r });
}));

app.post("/api/review", wrap(async (req, res) => {
  const b = req.body || {};
  const rating = Math.max(1, Math.min(5, Number(b.rating) || 5));
  db.addReview(String(b.order || "").trim(), rating, String(b.message || "").trim());
  res.json({ ok: true });
}));

app.get("/api/reviews", adminAuth, wrap(async (req, res) => {
  res.json({ reviews: db.listReviews(50) });
}));

app.post("/api/orders/:id/payment", adminAuth, wrap(async (req, res) => {
  const orderNo = req.params.id;
  const status = String(req.body && req.body.status || "Paid");
  const method = req.body.method || null;
  // Paid/marked from the dashboard must follow the SAME path as a verified
  // payment: mark order Paid AND kick off web delivery capture so the
  // customer's WhatsApp continues (payment success → location → name → save).
  if (["paid", "success", "captured"].includes(String(status).toLowerCase())) {
    const r = await verifyPayment(orderNo, `admin-${Date.now()}`, method);
    return res.json({ ok: true, ...r });
  }
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
    `\nThank you for choosing ZIPRA 🧡`;
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
  setInterval(async () => {
    const due = cleanupExpiredSessions();
    for (const d of due) await sendText(d.from, d.text);
  }, 60000);
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