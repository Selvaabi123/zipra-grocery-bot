require("dotenv").config();
const express = require("express");
const { handleMessage, cleanupExpiredSessions } = require("./bot");
const orders = require("./orders");
const products = require("./products");
const sheets = require("./sheets");

const app = express();
app.use(express.json());

const SHEET_ONLY = process.env.SHEET_ONLY === "1";

const PORT = process.env.PORT || 3000;
const VERIFY_TOKEN = process.env.VERIFY_TOKEN;
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN;
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID;
const GRAPH_URL = "https://graph.facebook.com/v26.0";
const ADMIN_TOKEN = process.env.ADMIN_TOKEN || "";

const processedMessageIds = new Set();
const MSG_ID_TTL = 1000 * 60 * 60;

app.get("/", (req, res) => {
  res.send("Zipra grocery bot is running 🟢");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];
  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    console.log("Webhook verified ✅");
    return res.status(200).send(challenge);
  }
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
        action: {
          button: reply.button,
          sections: reply.sections,
        },
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
        action: {
          buttons: reply.buttons.map((b) => ({
            type: "reply",
            reply: { id: b.id, title: b.title },
          })),
        },
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

async function sendMessage(to, body) {
  const url = `${GRAPH_URL}/${PHONE_NUMBER_ID}/messages`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${WHATSAPP_TOKEN}`,
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const resp = await res.text();
    console.error("WhatsApp send failed:", res.status, resp);
  } else {
    console.log("[send] OK to", to);
  }
  return res.ok;
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
    "✅ *Order Confirmed!*\n\nYour Zipra order #<ID> has been confirmed.\nWe'll start preparing your groceries shortly.",
  preparing:
    "🧺 *Your Order Is Being Prepared*\n\nOrder #<ID>\nYour groceries are being packed now.",
  out_for_delivery:
    "🛵 *Out for Delivery!*\n\nYour order #<ID> is on the way.",
  delivered:
    "🎉 *Order Delivered!*\n\nOrder #<ID> has been delivered successfully.\nThank you for shopping with Zipra! 🛒",
};

async function notifyStatus(order) {
  if (STATUS_NOTIFICATION[order.status]) {
    const msg = STATUS_NOTIFICATION[order.status].replace(
      "<ID>",
      order.id
    );
    await sendText(order.waId, msg);
  }
}

app.post("/webhook", async (req, res) => {
  const body = req.body;
  if (!body || !body.entry) return res.sendStatus(200);

  products.refreshFromGoogleSheet().catch(() => {});

  const jobs = [];
  for (const entry of body.entry || []) {
    for (const change of entry.changes || []) {
      const msgs = change.value && change.value.messages;
      if (!msgs) continue;
      for (const msg of msgs) {
        const msgId = msg.id;
        if (!msgId || processedMessageIds.has(msgId)) continue;
        processedMessageIds.add(msgId);

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
            (msg.interactive.list_reply && msg.interactive.list_reply.id);
          if (reply) payload = { kind: "interactive", id: reply };
        }
        if (!payload) continue;
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

function normalizeStatus(s) {
  const v = String(s || "").toLowerCase().replace(/[\s_]+/g, "_");
  if (v.includes("out") || v.includes("deliver")) return "out_for_delivery";
  if (v.startsWith("confirmed")) return "confirmed";
  if (v.startsWith("prep")) return "preparing";
  if (v.startsWith("deliver")) return "delivered";
  if (v.startsWith("cancel")) return "cancelled";
  if (v.startsWith("received") || v.startsWith("pending") || v.startsWith("paid")) return "received";
  return v;
}

app.get("/api/orders", adminAuth, async (req, res) => {
  const local = orders.getRecent(200);
  const localById = new Map(local.map((o) => [o.id, o]));
  try {
    const sr = await sheets.readOrders();
    if (!sr.ok) throw new Error("sheet unavailable");
    const groups = new Map();
    for (const r of sr.orders) {
      let g = groups.get(r.id);
      if (!g) {
        g = {
          id: r.id,
          waId: r.customer,
          status: r.status || "received",
          name: "",
          address: "",
          lat: null,
          lng: null,
          items: [],
          subtotal: 0,
          deliveryFee: 0,
          total: 0,
          paymentMethod: "",
          paymentStatus: "",
          createdAt: r.date
            ? new Date(`${r.date}T${r.time || "00:00:00"}Z`)
            : null,
        };
        groups.set(r.id, g);
      }
      if (r.item) {
        g.items.push({
          item: r.item,
          unit: r.unit,
          qty: r.qty,
          price: r.price,
          subtotal: (r.qty || 0) * (r.price || 0),
        });
      }
      if (typeof r.total === "number") g.total += r.total;
      if (r.status) g.status = normalizeStatus(r.status);
    }
    const out = [];
    for (const g of groups.values()) {
      const l = localById.get(g.id);
      if (l) {
        g.name = l.name || g.name;
        g.address = l.address || g.address;
        g.lat = l.lat || g.lat;
        g.lng = l.lng || g.lng;
        g.deliveryFee = l.deliveryFee || 0;
        g.paymentMethod = l.paymentMethod || "";
        g.paymentStatus = l.paymentStatus || "";
        g.createdAt = l.createdAt || g.createdAt;
      }
      g.subtotal = g.items.reduce((s, i) => s + (i.subtotal || 0), 0);
      out.push(g);
    }
    for (const o of local) {
      if (!groups.has(o.id)) out.push(o);
    }
    out.sort(
      (a, b) =>
        (b.createdAt ? new Date(b.createdAt) : new Date(0)) -
        (a.createdAt ? new Date(a.createdAt) : new Date(0))
    );
    return res.json({ orders: out.slice(0, 50), source: "sheet" });
  } catch (err) {
    return res.json({
      orders: local.slice(0, 50),
      source: "local",
      error: err.message,
    });
  }
});

app.post("/api/orders/:id/status", adminAuth, async (req, res) => {
  try {
    const id = req.params.id;
    const status = req.body.status;
    let order = null;
    try {
      order = orders.updateStatus(id, status);
    } catch (e) {
      /* sheet-only order */
    }
    try {
      await sheets.updateOrderStatus(id, status);
    } catch (e) {
      console.error("Sheet status update failed:", e.message);
    }
    let notified = false;
    try {
      const stub = order || (await sheets.getOrderById(id));
      if (stub) {
        await notifyStatus({ id, waId: stub.waId, status });
        notified = true;
      }
    } catch (e) {
      console.error("Notify failed:", e.message);
    }
    res.json({ ok: true, notified });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/orders/:id/payment", adminAuth, (req, res) => {
  try {
    const order = orders.updatePayment(req.params.id, req.body.status);
    res.json({ ok: true, order });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post("/api/products/refresh", adminAuth, async (req, res) => {
  const ok = await products.refreshFromGoogleSheet(true);
  res.json({
    ok,
    message: ok
      ? "Products synced from Google Sheet!"
      : "Sheet sync failed (check SHEET_WEBAPP_URL is deployed with the latest Code.gs).",
  });
});

app.get("/admin", adminAuth, (req, res) => {
  res.send(`<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<title>Zipra Orders - Admin</title>
<style>
body{font-family:-apple-system,Segoe UI,Roboto,sans-serif;background:#f4f5f7;margin:0;padding:24px}
h1{font-size:22px;color:#111}
.card{background:#fff;border:1px solid #e3e5e8;border-radius:12px;padding:16px 18px;margin-bottom:14px}
.order-id{font-weight:700;font-size:16px}
.meta{color:#666;font-size:13px;margin-top:4px}
.status{display:inline-block;padding:3px 10px;border-radius:999px;font-size:12px;margin-left:8px}
.it{font-size:14px;color:#333}
.total{font-weight:700;margin-top:6px}
button{margin:6px 6px 0 0;padding:7px 12px;border:1px solid #ccc;background:#fff;border-radius:8px;cursor:pointer;font-size:13px}
button:hover{background:#f0f0f0}
.paid{color:#0a7d33;font-weight:600}
</style>
</head>
<body>
<h1>📦 Zipra Orders — Admin</h1>
<button onclick="refreshProducts()" style="margin-bottom:14px">🔄 Sync Products from Google Sheet</button>
<button onclick="load()" style="margin-bottom:14px">🔄 Refresh Orders from Sheet</button>
<div id="src" style="color:#888;font-size:12px;margin-bottom:14px"></div>
<div id="list">Loading...</div>
<script>
const COLORS={received:'#f6d365',confirmed:'#4caf50',preparing:'#ff9800',out_for_delivery:'#2196f3',delivered:'#0a7d33',cancelled:'#f44336'};
const LABEL={received:'🟡 Received',confirmed:'✅ Confirmed',preparing:'🟠 Preparing',out_for_delivery:'🛵 Out for Delivery',delivered:'🎉 Delivered',cancelled:'🔴 Cancelled'};
async function load(){const r=await fetch('/api/orders');const d=await r.json();document.getElementById('src').textContent='Source: '+(d.source||'local')+(d.error?' ('+d.error+')':'');render(d.orders);}
function render(orders){
  const el=document.getElementById('list');
  if(!orders.length){el.innerHTML='<div class="card">No orders yet.</div>';return;}
  el.innerHTML=orders.map(o=>{
    const items=o.items.map(i=>'<div class="it">• '+i.item+' × '+i.qty+' — ₹'+i.subtotal+'</div>').join('');
    const next={'received':'confirmed','confirmed':'preparing','preparing':'out_for_delivery','out_for_delivery':'delivered'}[o.status];
    const cancelBtn=o.status!=='delivered'&&o.status!=='cancelled'?
      '<button onclick="setStatus(\\\''+o.id+'\\\',\\\'cancelled\\\')">❌ Cancel</button>':'';
    const nextBtn=next?'<button onclick="setStatus(\\\''+o.id+'\\\',\\\''+next+'\\\')">➡️ '+LABEL[next].replace(/^[^ ]+ /,'')+'</button>':'';
    const payBtn=o.paymentMethod==='online'&&o.paymentStatus!=='Paid'?
      '<button onclick="markPaid(\\\''+o.id+'\\\')">💳 Mark Paid</button>':'';
    const map=(o.lat&&o.lng)?'<div class="it">📍 <a target="_blank" href="https://maps.google.com/maps?q='+o.lat+','+o.lng+'">Open in Maps</a></div>':
      '<div class="it">📍 '+o.address+'</div>';
    return '<div class="card"><div class="order-id">'+o.id+' <span class="status" style="background:'+(COLORS[o.status]||'#eee')+'">'+LABEL[o.status]+'</span></div>'+
      '<div class="meta">'+o.name+' • '+o.waId+' • '+new Date(o.createdAt).toLocaleString()+'</div>'+
      map+items+
      '<div class="total">Subtotal ₹'+o.subtotal+' • Delivery ₹'+o.deliveryFee+' • Total ₹'+o.total+'</div>'+
      '<div class="meta">💳 '+(o.paymentMethod==='online'?'Online':'Cash on Delivery')+' — <span class="'+(o.paymentStatus==='Paid'?'paid':'')+'">'+o.paymentStatus+'</span></div>'+
      '<div>'+nextBtn+cancelBtn+payBtn+'</div></div>';
  }).join('');
}
async function setStatus(id,status){await fetch('/api/orders/'+id+'/status',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status})});load();}
async function markPaid(id){await fetch('/api/orders/'+id+'/payment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({status:'Paid'})});load();}
async function refreshProducts(){const r=await fetch('/api/products/refresh',{method:'POST'});const d=await r.json();alert(d.message);}
setInterval(load,15000);
load();
</script>
</body>
</html>`);
});

if (!SHEET_ONLY) {
  setInterval(cleanupExpiredSessions, 60000);
  setInterval(() => {
    processedMessageIds.clear();
  }, MSG_ID_TTL);
  setInterval(() => {
    products.refreshFromGoogleSheet().catch(() => {});
  }, parseInt(process.env.PRODUCTS_SYNC_TTL || "300000", 10));
}
products.refreshFromGoogleSheet().catch(() => {});

app.use((req, res, next) => {
  res.status(200).send("Zipra webhook endpoint OK");
});

if (require.main === module) {
  app.listen(PORT, () => {
    console.log(`Zipra grocery bot listening on port ${PORT}`);
    console.log(`Webhook: POST /webhook | Admin: /admin`);
  });
}

module.exports = { app };