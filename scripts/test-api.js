const fs = require("fs");
const assert = require("assert");
const http = require("http");

const DB_PATH = `/tmp/zipra-test-api-${process.pid}.db`;
for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) {
  try { fs.unlinkSync(f); } catch {}
}
process.env.DB_PATH = DB_PATH;
process.env.DELIVERY_FEE = "30";
process.env.ADMIN_TOKEN = "test-api-admin-token";

const { app } = require("../src/server");

let port = 0;
let base = "";
const seen = new Set();

function api(method, path, body) {
  const url = base + path;
  const opts = { method, headers: {} };
  let payload;
  opts.headers["Authorization"] = `Bearer ${process.env.ADMIN_TOKEN}`;
  if (body !== undefined) {
    payload = JSON.stringify(body);
    opts.headers["Content-Type"] = "application/json";
  }
  return new Promise((resolve, reject) => {
    const req = http.request(url, opts, (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => {
        let j = null;
        try { j = JSON.parse(d); } catch {}
        resolve({ status: res.statusCode, body: j, raw: d.slice(0, 200) });
      });
    });
    req.on("error", reject);
    if (payload) req.write(payload);
    req.end();
  });
}

function check(name, cond, extra) {
  assert(cond, `${name} ${extra || ""}`);
  console.log(`PASS [${name}]`);
}

async function main() {
  const srv = await new Promise((res) => {
    const s = app.listen(0, () => res(s));
  });
  port = srv.address().port;
  base = `http://127.0.0.1:${port}`;

  // seed sanity
  const r0 = await api("GET", "/api/orders");
  check("orders seeded from orders.json", Array.isArray(r0.body.orders) && r0.body.orders.length >= 6, "=> " + r0.body.orders.length);
  check("stats present", r0.body.stats && r0.body.stats.total >= 6);
  check("statusCounts present", typeof r0.body.statusCounts === "object");

  // products
  const pr = await api("GET", "/api/products");
  check("products list", Array.isArray(pr.body.products) && pr.body.products.length === 19, "=> " + pr.body.products.length);
  check("categories list", pr.body.categories.includes("Rice") && pr.body.categories.length === 7);
  const ponni = pr.body.products.find((p) => p.item === "Ponni Rice");
  const ponniStockBefore = ponni.stock;

  const created = await api("POST", "/api/products", {
    name: "API Test Product", category: "Test Category", unit: "kg", price: 99, stock: 5, gst_rate: 5,
  });
  check("create product", created.status === 200 && created.body.product && created.body.product.id, "=> " + JSON.stringify(created.body).slice(0, 80));
  const tpId = created.body.product.id;
  const tog = await api("POST", `/api/products/${tpId}/toggle`, { active: false });
  check("toggle product off", tog.body.product.active === false);
  const upd = await api("PUT", `/api/products/${tpId}`, { price: 110, low_stock_level: 3 });
  check("update product", upd.body.product.price === 110 && upd.body.product.low_stock_level === 3);

  // inventory adjust
  const adj = await api("POST", "/api/inventory/adjust", { productId: tpId, delta: -2, reason: "damage" });
  const tpRow = adj.body.inventory.find((i) => i.id === tpId);
  check("inventory adjust", tpRow.stock === 3);
  const hist = await api("GET", "/api/inventory/history");
  check("inventory history recorded", Array.isArray(hist.body.history) && hist.body.history.some((h) => h.product_id === tpId));

  // create order
  const co = await api("POST", "/api/orders", {
    name: "API Buyer", phone: "919999000001", address: "88 Test Street, Coimbatore",
    items: [{ key: "Rice.Ponni Rice", qty: 1 }], paymentMethod: "cod",
  });
  check("create order", co.status === 200 && /^ZIP/.test(co.body.order.id), "=> " + (co.body.order && co.body.order.id));
  const orderId = co.body.order.id;
  check("order item subtotal", co.body.order.items[0].subtotal === 65, "=> " + JSON.stringify(co.body.order.items[0]));

  // stock reduced
  const pr2 = await api("GET", "/api/products");
  const ponni2 = pr2.body.products.find((p) => p.item === "Ponni Rice");
  check("create order reduces stock", ponni2.stock === ponniStockBefore - 1);

  // detail
  const det = await api("GET", `/api/orders/${orderId}`);
  check("order detail", det.body.order.id === orderId && det.body.order.items.length === 1 && Array.isArray(det.body.order.history));

  // update
  const put = await api("PUT", `/api/orders/${orderId}`, { name: "API Buyer v2", address: "99 New Street" });
  check("update order", put.body.order.name === "API Buyer v2" && put.body.order.address === "99 New Street");

  // assign partner
  const pk = await api("POST", "/api/delivery-partners", { name: "Ravi", phone: "919876543210" });
  check("create partner", pk.status === 200 && pk.body.partner.id);
  const pId = pk.body.partner.id;
  const asg = await api("POST", `/api/orders/${orderId}/assign`, { partnerId: pId });
  check("assign partner", asg.body.order.partnerName === "Ravi");
  const pkUp = await api("PUT", `/api/delivery-partners/${pId}`, { online: true });
  check("partner toggle online", pkUp.body.partner.online === true);
  const pkl = await api("GET", "/api/delivery-partners");
  check("partner activeOrders counts", pkl.body.partners.find((p) => p.id === pId).activeOrders === 1);

  // status: advance + deliver, earnings credit
  const st1 = await api("POST", `/api/orders/${orderId}/status`, { status: "confirmed" });
  check("status confirmed", st1.body.order.status === "confirmed");
  const st2 = await api("POST", `/api/orders/${orderId}/status`, { status: "delivered" });
  check("status delivered + paid", st2.body.order.status === "delivered" && st2.body.order.paymentStatus === "Paid");
  const pkl2 = await api("GET", "/api/delivery-partners");
  const ravi = pkl2.body.partners.find((p) => p.id === pId);
  check("partner earnings credited", ravi.totalDeliveries === 1 && ravi.earnings === 30, "=> " + JSON.stringify(ravi));

  // cancel restores stock
  const co2 = await api("POST", "/api/orders", {
    name: "Cancel Test", phone: "919999000002", items: [{ key: "Rice.Ponni Rice", qty: 2 }], paymentMethod: "cod",
  });
  const cancelId = co2.body.order.id;
  const pr3 = await api("GET", "/api/products");
  const beforeCancel = pr3.body.products.find((p) => p.item === "Ponni Rice").stock;
  const cn = await api("POST", `/api/orders/${cancelId}/status`, { status: "cancelled" });
  check("cancel order", cn.body.order.status === "cancelled" && cn.body.order.paymentStatus === "Cancelled");
  const pr4 = await api("GET", "/api/products");
  const afterCancel = pr4.body.products.find((p) => p.item === "Ponni Rice").stock;
  check("cancel restores stock", afterCancel === beforeCancel + 2);

  // notify fails without waId
  const co3 = await api("POST", "/api/orders", {
    name: "No Phone", items: [{ key: "Rice.Ponni Rice", qty: 1 }], paymentMethod: "cod",
  });
  const nf = await api("POST", `/api/orders/${co3.body.order.id}/notify`, { message: "hi" });
  check("notify guards missing phone", nf.status === 400);

  // delete order restores stock
  const pr5 = await api("GET", "/api/products");
  const beforeDel = pr5.body.products.find((p) => p.item === "Ponni Rice").stock;
  const del = await api("DELETE", `/api/orders/${co3.body.order.id}`);
  check("delete order", del.body.ok === true);
  const pr6 = await api("GET", "/api/products");
  const afterDel = pr6.body.products.find((p) => p.item === "Ponni Rice").stock;
  check("delete restores stock", afterDel === beforeDel + 1);

  // customers
  const cu = await api("GET", "/api/customers");
  check("customers list", Array.isArray(cu.body.customers) && cu.body.customers.some((c) => c.phone.includes("999000001")));
  const buyer = cu.body.customers.find((c) => c.phone.includes("999000001"));
  const cuDet = await api("GET", `/api/customers/${buyer.id}`);
  check("customer detail with orders", cuDet.body.customer.orders.length >= 1 && cuDet.body.customer.totalOrders >= 1);

  // reports
  const rp = await api("GET", "/api/reports");
  check("reports shape", rp.body.reports && rp.body.reports.last7Days.length === 7 && Array.isArray(rp.body.reports.topProducts));

  // promotions
  const pm = await api("POST", "/api/promotions", { code: "ZIP10", title: "10% off", type: "percent", value: 10 });
  check("create promotion", pm.status === 200 && pm.body.promotion.code === "ZIP10");
  const pmUp = await api("PUT", `/api/promotions/${pm.body.promotion.id}`, { value: 15 });
  check("update promotion", pmUp.body.promotion.value === 15);
  const pmDel = await api("DELETE", `/api/promotions/${pm.body.promotion.id}`);
  check("delete promotion", pmDel.body.ok === true);

  // settings
  const st = await api("GET", "/api/settings");
  check("settings read", st.body.settings && st.body.settings.delivery_fee !== undefined);
  await api("PUT", "/api/settings", { delivery_fee: 40 });
  const db = require("../src/db");
  check("settings affect delivery fee", db.deliveryFee() === 40);

  // 404 handling
  const nf2 = await api("GET", "/api/orders/NOPE390000");
  check("unknown order 404", nf2.status === 404);

  srv.close();
  console.log("\nAll API tests passed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nAPI TEST FAILED\n" + err.message);
  process.exit(1);
});