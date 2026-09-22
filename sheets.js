require("dotenv").config();

const { getJson, postJson } = require("./net");

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
  const j = await postJson(WEBAPP_URL, { secret: SECRET, rows: values });
  if (!j || !j.ok) throw new Error("Sheet webapp rejected order");
  return { mirrored: true };
}

async function readOrders() {
  if (!WEBAPP_URL) return { ok: false, orders: [] };
  const sep = WEBAPP_URL.includes("?") ? "&" : "?";
  const j = await getJson(
    `${WEBAPP_URL}${sep}orders=1&secret=${encodeURIComponent(SECRET)}`
  );
  if (!j || !Array.isArray(j.orders)) return { ok: false, orders: [] };
  return { ok: true, orders: j.orders };
}

async function updateOrderStatus(orderNo, status) {
  if (!WEBAPP_URL) return false;
  try {
    const j = await postJson(WEBAPP_URL, {
      secret: SECRET,
      action: "updateStatus",
      orderNo,
      status,
    });
    return !!(j && j.ok);
  } catch {
    return false;
  }
}

async function getOrderById(orderNo) {
  const r = await readOrders();
  if (!r.ok) return null;
  const row = r.orders.find((o) => o.id === orderNo);
  return row ? { waId: row.customer, status: row.status } : null;
}

module.exports = { saveOrder, readOrders, updateOrderStatus, getOrderById };