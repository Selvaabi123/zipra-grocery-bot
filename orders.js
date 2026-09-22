const fs = require("fs");
const path = require("path");

const ORDERS_FILE = process.env.ORDERS_FILE || path.join(__dirname, "orders.json");

const STATUS_FLOW = [
  "received",
  "confirmed",
  "preparing",
  "out_for_delivery",
  "delivered",
];

const STATUS_LABEL = {
  received: "🟡 Order Received",
  confirmed: "✅ Order Confirmed",
  preparing: "🟠 Preparing",
  out_for_delivery: "🛵 Out for Delivery",
  delivered: "🎉 Delivered",
  cancelled: "🔴 Cancelled",
};

function load() {
  try {
    return JSON.parse(fs.readFileSync(ORDERS_FILE, "utf8"));
  } catch {
    return [];
  }
}

function persist(orders) {
  fs.writeFileSync(ORDERS_FILE, JSON.stringify(orders, null, 2));
}

function nextOrderNo() {
  const orders = load();
  const now = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  const date = `${now.getFullYear().toString().slice(2)}${pad(now.getMonth() + 1)}${pad(now.getDate())}`;
  const prefix = `ZIP${date}`;
  let seq = 1;
  const today = orders.filter((o) => o.id.startsWith(prefix));
  if (today.length) {
    const max = Math.max(
      ...today.map((o) => parseInt(o.id.slice(prefix.length), 10) || 0)
    );
    seq = max + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

function insert(order) {
  const orders = load();
  orders.unshift(order);
  persist(orders);
  return order;
}

function findById(id) {
  return load().find((o) => o.id === id) || null;
}

function activeStatuses() {
  return ["received", "confirmed", "preparing", "out_for_delivery"];
}

function findActiveByWa(waId) {
  return (
    load().find(
      (o) => o.waId === waId && activeStatuses().includes(o.status)
    ) || null
  );
}

function findByWa(waId, limit = 8) {
  return load()
    .filter((o) => o.waId === waId)
    .slice(0, limit);
}

function getRecent(limit = 30) {
  return load().slice(0, limit);
}

function updateStatus(id, status) {
  if (!STATUS_LABEL[status]) throw new Error(`Invalid status: ${status}`);
  const orders = load();
  const order = orders.find((o) => o.id === id);
  if (!order) throw new Error(`Order not found: ${id}`);
  order.status = status;
  order.updatedAt = new Date().toISOString();
  persist(orders);
  return order;
}

function updatePayment(id, paymentStatus) {
  const orders = load();
  const order = orders.find((o) => o.id === id);
  if (!order) throw new Error(`Order not found: ${id}`);
  order.paymentStatus = paymentStatus;
  order.updatedAt = new Date().toISOString();
  persist(orders);
  return order;
}

module.exports = {
  STATUS_FLOW,
  STATUS_LABEL,
  nextOrderNo,
  insert,
  findById,
  findActiveByWa,
  findByWa,
  getRecent,
  updateStatus,
  updatePayment,
};