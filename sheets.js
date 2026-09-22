require("dotenv").config();

const WEBAPP_URL = process.env.SHEET_WEBAPP_URL;
const SECRET = process.env.SHEET_SECRET || "change-me";

function fmtDate() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function fmtTime() {
  const d = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  return `${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

async function saveOrder(order) {
  if (!WEBAPP_URL) return { mirrored: false };
  const values = order.items.map((c) => [
    order.id,
    fmtDate(),
    fmtTime(),
    order.waId,
    c.item,
    c.unit,
    c.qty,
    c.price,
    c.subtotal,
    "Pending",
  ]);
  const res = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({ secret: SECRET, rows: values }),
  });
  if (!res.ok) throw new Error(`Sheet webapp error ${res.status}`);
  return { mirrored: true };
}

async function readOrders() {
  if (!WEBAPP_URL) return { ok: false, orders: [] };
  const sep = WEBAPP_URL.includes("?") ? "&" : "?";
  const res = await fetch(
    `${WEBAPP_URL}${sep}orders=1&secret=${encodeURIComponent(SECRET)}`
  );
  if (!res.ok) throw new Error(`Sheet webapp error ${res.status}`);
  const j = await res.json();
  if (!j || !Array.isArray(j.orders)) return { ok: false, orders: [] };
  return { ok: true, orders: j.orders };
}

async function updateOrderStatus(orderNo, status) {
  if (!WEBAPP_URL) return false;
  const res = await fetch(WEBAPP_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: JSON.stringify({
      secret: SECRET,
      action: "updateStatus",
      orderNo,
      status,
    }),
  });
  if (!res.ok) return false;
  const j = await res.json().catch(() => ({}));
  return !!(j && j.ok);
}

async function getOrderById(orderNo) {
  const r = await readOrders();
  if (!r.ok) return null;
  const row = r.orders.find((o) => o.id === orderNo);
  return row ? { waId: row.customer, status: row.status } : null;
}

module.exports = { saveOrder, readOrders, updateOrderStatus, getOrderById };