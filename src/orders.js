const db = require("./db");

const STATUS_FLOW = ["received", "confirmed", "preparing", "out_for_delivery", "delivered"];

const STATUS_LABEL = {
  received: "🕐 Received",
  confirmed: "✅ Confirmed",
  preparing: "👨‍🍳 Preparing",
  out_for_delivery: "🛵 Out for Delivery",
  delivered: "🎉 Delivered",
  cancelled: "❌ Cancelled",
};

function nextOrderNo() {
  return db.nextOrderNo();
}

function insert(order) {
  return db.insertOrder(order);
}

function findById(id) {
  const o = db.getOrderDetail(id);
  if (!o) return null;
  return {
    id: o.id,
    waId: o.waId,
    name: o.name,
    address: o.address,
    lat: o.lat,
    lng: o.lng,
    items: o.items,
    subtotal: o.subtotal,
    deliveryFee: o.deliveryFee,
    discount: o.discount,
    total: o.total,
    paymentMethod: o.paymentMethod,
    paymentStatus: o.paymentStatus,
    status: o.status,
    createdAt: o.createdAt,
    updatedAt: o.updatedAt,
  };
}

function activeStatuses() {
  return ["received", "confirmed", "preparing", "out_for_delivery"];
}

function findActiveByWa(waId) {
  return db.findActiveByWa(waId);
}

function findByWa(waId, limit) {
  return db.findByWa(waId, limit);
}

function getRecent(limit) {
  return db.recentOrders(limit);
}

function updateStatus(id, status) {
  const r = db.updateOrderStatus(id, status, "admin");
  return findById(id);
}

function updatePayment(id, paymentStatus) {
  const r = db.updatePayment(id, paymentStatus);
  return findById(id);
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