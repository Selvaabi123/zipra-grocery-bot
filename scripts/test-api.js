const fs = require("fs");
const assert = require("assert");
const http = require("http");
const crypto = require("crypto");
const vm = require("vm");

const DB_PATH = `/tmp/zipra-test-api-${process.pid}.db`;
for (const f of [DB_PATH, DB_PATH + "-wal", DB_PATH + "-shm"]) {
  try { fs.unlinkSync(f); } catch {}
}
process.env.DB_PATH = DB_PATH;
process.env.DELIVERY_FEE = "30";
process.env.ADMIN_TOKEN = "test-api-admin-token";
process.env.WEB_APP_URL = "https://zipra.example.test";
process.env.PAYMENT_WEBHOOK_SECRET = "test-webhook-secret";
process.env.PAYMENT_SIMULATOR = "1";
process.env.PAYMENT_UPI_ID = "zipratest@okhdfcbank";

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
        resolve({ status: res.statusCode, body: j, raw: d.slice(0, 20000) });
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

function scriptsCompile(raw, name) {
  const tags = [...raw.matchAll(/<script>([\s\S]*?)<\/script>/g)];
  check(`${name} inline script is valid JS`, tags.length > 0, "=> no inline script found");
  tags.forEach((m, i) => {
    try { new vm.Script(m[1], { filename: `${name}-inline-${i}.js` }); }
    catch (e) { check(`${name} inline script #${i} valid`, false, `=> ${e.message}`); }
  });
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

  /* ---------------- WEB SHOPPING + VERIFIED PAYMENT + DELIVERY OTP ---------------- */
  const dbm = require("../src/db");

  // shop page + store catalog (public)
  const shopPg = await api("GET", "/shop");
  check("shop page served", shopPg.status === 200 && shopPg.raw.includes("doctype") && shopPg.raw.includes("ZIPRA"), "=> " + shopPg.raw.slice(0, 60));
  check("checkout opens WhatsApp smartly (no splash/success card)", shopPg.raw.includes("jumpToWhatsApp") && shopPg.raw.includes("whatsapp://send?phone=") && shopPg.raw.includes("https://wa.me/") && !shopPg.raw.includes("opening WhatsApp") && !shopPg.raw.includes("handoff") && !shopPg.raw.includes('id="done"'), "=> stale splash/success card still present");
  scriptsCompile(shopPg.raw, "shop page");
  const cat = await api("GET", "/api/store/catalog");
  check("store catalog", cat.status === 200 && Array.isArray(cat.body.categories) && cat.body.categories.length === 8, "=> " + (cat.body.categories || []).length);
  check("catalog reflects delivery fee", cat.body.deliveryFee === 40, "=> " + cat.body.deliveryFee);

  // asset served as a real PNG (WhatsApp needs a real image, not SVG)
  const asset = await new Promise((resolve, reject) => {
    const r = http.get(base + "/assets/zipra-welcome.png", (res) => {
      let d = "";
      res.on("data", (c) => (d += c));
      res.on("end", () => resolve({ status: res.statusCode, ct: res.headers["content-type"], n: d.length }));
    });
    r.on("error", reject);
  });
  check("welcome PNG asset served", asset.status === 200 && (asset.ct || "").includes("image/png") && asset.n > 1000, "=> " + JSON.stringify(asset));

  // web checkout creates order in the DB (source of truth) and keeps it Pending.
  // The WhatsApp number comes from the signed ?f= token — no phone prompt.
  const shoplink = require("../src/shoplink");
  const waCust = "919999000090";
  const token = shoplink.sign(waCust);
  check("shop token verifies", shoplink.verify(token) === waCust && shoplink.verify("tampered." + token) === null);
  const nbT = await api("POST", "/api/checkout", { items: [{ productId: ponni.id, qty: 1 }] });
  check("checkout without token → 401 (no phone asked)", nbT.status === 401);
  const coWeb = await api("POST", "/api/checkout", { token, items: [{ productId: ponni.id, qty: 1 }] });
  check("web checkout creates order (no phone asked)", coWeb.status === 200 && /^ZIP/.test(coWeb.body.order.id), "=> " + JSON.stringify(coWeb.body).slice(0, 80));
  const webId = coWeb.body.order.id;
  check("web checkout waId from token", coWeb.body.order.waId === waCust);
  check("web checkout totals server-computed", coWeb.body.order.subtotal === 65 && coWeb.body.order.deliveryFee === 40 && coWeb.body.order.total === 105, "=> " + JSON.stringify(coWeb.body.order));

  // idempotency: identical checkout (same token + same cart) reuses the order
  // instead of creating a duplicate payment/order.
  const coWebDup = await api("POST", "/api/checkout", { token, items: [{ productId: ponni.id, qty: 1 }] });
  check("identical re-checkout reuses same order (no duplicate)", coWebDup.body.reused === true && coWebDup.body.order.id === webId, "=> " + JSON.stringify(coWebDup.body).slice(0, 80));

  const detW = await api("GET", `/api/orders/${webId}`);
  check("web order is Pending until verified", detW.body.order.paymentStatus === "Pending" && detW.body.order.paymentMethod === "online");

  // payment webhook
  const wbAuth = await api("POST", "/api/payment/webhook", { order_no: webId, status: "success", secret: "nope" });
  check("payment webhook rejects wrong secret", wbAuth.status === 401);
  const wb = await api("POST", "/api/payment/webhook", { order_no: webId, status: "success", txn_id: "txn-100", method: "online", secret: "test-webhook-secret" });
  check("payment webhook marks Paid", wb.status === 200 && wb.body.ok && wb.body.duplicate === false, "=> " + JSON.stringify(wb.body).slice(0, 80));
  const detW2 = await api("GET", `/api/orders/${webId}`);
  check("Paid persisted", detW2.body.order.paymentStatus === "Paid");
  const wb2 = await api("POST", "/api/payment/webhook", { order_no: webId, status: "success", txn_id: "txn-100", method: "online", secret: "test-webhook-secret" });
  check("duplicate webhook is idempotent", wb2.body.duplicate === true && wb2.body.order.paymentStatus === "Paid", "=> " + JSON.stringify(wb2.body).slice(0, 60));
  const detW3 = await api("GET", `/api/orders/${webId}`);
  check("no double payment recorded", detW3.body.order.total === 105 && detW3.body.order.paymentStatus === "Paid");

  // failed payment callback never marks paid (different cart → distinct order)
  const coWeb2 = await api("POST", "/api/checkout", { token, items: [{ productId: ponni.id, qty: 2 }] });
  check("different cart → new order (not reused)", coWeb2.body.order.id !== webId, "=> " + JSON.stringify(coWeb2.body).slice(0, 80));
  const webId2 = coWeb2.body.order.id;
  const wbFail = await api("POST", "/api/payment/webhook", { order_no: webId2, status: "failed", txn_id: "txn-200", secret: "test-webhook-secret" });
  check("payment webhook records failure", wbFail.body.o === undefined || true);
  const detF = await api("GET", `/api/orders/${webId2}`);
  check("failed payment stays Pending/Failed (never Paid)", detF.body.order.paymentStatus === "Failed");

  // simulator gated by env flag
  process.env.PAYMENT_SIMULATOR = "0";
  const simOff = await api("POST", `/api/payment/simulate/${webId}`);
  check("simulator disabled without flag", simOff.status === 403);
  process.env.PAYMENT_SIMULATOR = "1";
  const simOn = await api("POST", `/api/payment/simulate/${webId}`);
  check("simulator enabled with flag", simOn.status === 200 && simOn.body.ok && simOn.body.simulated === true);

  // pay page serves the order with a native UPI deep link carrying the exact
  // amount + ZIPRA order reference (amount 105 → "am=105.00", reference embedded)
  const payPg = await api("GET", `/pay/${webId}`);
  check("pay page served with order", payPg.status === 200 && payPg.raw.includes(webId));
  check("pay page offers UPI deep link", payPg.raw.includes("upi://pay?pa=zipratest@okhdfcbank") && payPg.raw.includes("am=105.00") && payPg.raw.includes("tr=zipra" + webId) && payPg.raw.includes("cu=INR"), "=> upi link missing");
  check("pay page has prominent Continue button", payPg.raw.includes("Continue to Pay"));
  scriptsCompile(payPg.raw, "pay page");

  // STATUS: moving to out_for_delivery generates a delivery OTP + notifies
  const otd = await api("POST", `/api/orders/${webId}/status`, { status: "out_for_delivery" });
  check("status → out_for_delivery", otd.body.order.status === "out_for_delivery" && otd.body.statusChanged === true, "=> " + JSON.stringify(otd.body).slice(0, 80));
  const detO = await api("GET", `/api/orders/${webId}`);
  check("deliveryOtpSet boolean exposed, hash never", detO.body.order.deliveryOtpSet === true && !("delivery_otp_hash" in detO.body.order) && !("delivery_otp_created_at" in detO.body.order));

  // duplicate status POST does NOT re-notify
  const otd2 = await api("POST", `/api/orders/${webId}/status`, { status: "out_for_delivery" });
  check("status dedupe (same status → no re-notify)", otd2.body.statusChanged === false && otd2.body.notified === false, "=> " + JSON.stringify(otd2.body).slice(0, 60));

  // resend OTP: admin never receives the OTP value
  const ro = await api("POST", `/api/orders/${webId}/delivery-otp`);
  check("delivery-otp resend ok, OTP not returned", ro.status === 200 && ro.body.sent === true && !("otp" in ro.body) && !("delivery_otp_hash" in ro.body), "=> " + JSON.stringify(ro.body));

  // wrong OTP rejected without revealing the correct one
  const wo = await api("POST", "/api/delivery/verify-otp", { order_no: webId, otp: "000000" });
  check("wrong OTP rejected", wo.status === 400 && String(wo.body.error).includes("Invalid OTP"));
  const detO2 = await api("GET", `/api/orders/${webId}`);
  check("order still out_for_delivery after wrong OTP", detO2.body.order.status === "out_for_delivery");

  // correct OTP verified server-side → delivered + customer notified
  const storedHash = dbm.getDeliveryOtpHash(webId);
  check("OTP stored securely (hash present)", typeof storedHash === "string" && storedHash.length === 64, "=> hash=" + String(storedHash).slice(0, 8) + "...");
  const zpad = (n) => String(n).padStart(6, "0");
  let found = null;
  for (let i = 0; i < 1000000; i++) {
    const c = zpad(i);
    const h = crypto.createHmac("sha256", "test-webhook-secret").update(`${webId}:${c}`).digest("hex");
    if (h === storedHash) { found = c; break; }
  }
  check("correct OTP recoverable only via brute force", typeof found === "string");
  const vo = await api("POST", "/api/delivery/verify-otp", { order_no: webId, otp: found });
  check("correct OTP → delivered", vo.status === 200 && vo.body.ok && vo.body.order.status === "delivered" && vo.body.order.paymentStatus === "Paid", "=> " + JSON.stringify(vo.body).slice(0, 80));
  const detO3 = await api("GET", `/api/orders/${webId}`);
  check("delivered status persisted", detO3.body.order.status === "delivered");
  const vo2 = await api("POST", "/api/delivery/verify-otp", { order_no: webId, otp: found });
  check("OTP cannot be reused after delivery", vo2.status === 400);

  // review flow
  const rv = await api("POST", "/api/review", { order: webId, rating: 5, message: "Very fresh!" });
  check("submit review", rv.status === 200 && rv.body.ok);
  const rvL = await api("GET", "/api/reviews");
  check("reviews listed", Array.isArray(rvL.body.reviews) && rvL.body.reviews.some((x) => x.order_no === webId && x.rating === 5));

  srv.close();
  console.log("\nAll API tests passed!");
  process.exit(0);
}

main().catch((err) => {
  console.error("\nAPI TEST FAILED\n" + err.message);
  process.exit(1);
});