const fs = require("fs");

const DB_PATH = `/tmp/zipra-test-bot-${process.pid}.db`;
try { fs.unlinkSync(DB_PATH); } catch {}
for (const f of [DB_PATH + "-wal", DB_PATH + "-shm"]) {
  try { fs.unlinkSync(f); } catch {}
}

process.env.DB_PATH = DB_PATH;
process.env.DELIVERY_FEE = "30";
process.env.PAYMENT_UPI_ID = "ziprashop@upi";
process.env.WEB_APP_URL = "https://zipra.example.test";
process.env.SESSION_TIMEOUT_MS = "300000";

const assert = require("assert");
const { handleMessage, flattenReply, sessions, cleanupExpiredSessions, welcomeSequence, beginWebDeliveryCapture } = require("../src/bot");
const db = require("../src/db");
const orders = require("../src/orders");

const from = "919001002003";

const id = (k) => ({ kind: "interactive", id: k });
const text = (t) => ({ kind: "text", text: t });
const loc = () => ({
  kind: "location",
  latitude: 13.0827,
  longitude: 80.2707,
  address: "Chennai, Tamil Nadu",
  name: "Home",
});

const clen = (s) => String(s || "").length;

function toArr(r) {
  return Array.isArray(r) ? r : [r];
}

function validateReply(r) {
  assert(r && r.type, "reply has a type");
  const body = r.body || r.text || "";
  assert(clen(body) <= 1024, "message body <=1024 chars: " + clen(body));
  if (r.headerText) assert(clen(r.headerText) <= 60, "header text <=60");
  if (r.footer) assert(clen(r.footer) <= 60, "footer <=60: " + JSON.stringify(r.footer));
  if (r.type === "buttons") {
    assert(
      Array.isArray(r.buttons) && r.buttons.length >= 1 && r.buttons.length <= 3,
      "reply buttons must be 1-3 (Meta cap): " + r.buttons.map((b) => b.title).join(" / ")
    );
    for (const b of r.buttons) {
      assert(clen(b.title) <= 20, "button title <=20: " + JSON.stringify(b.title));
      assert(clen(b.id) <= 256, "button id <=256");
    }
  }
  if (r.type === "cta") {
    assert(Array.isArray(r.buttons) && r.buttons.length === 1, "cta carries exactly one button");
    const b = r.buttons[0];
    assert(clen(b.title) <= 25, "cta display_text <=25: " + JSON.stringify(b.title));
    assert(/^https:\/\//.test(b.url), "cta url must be https: " + b.url);
  }
  if (r.type === "list") {
    assert(Array.isArray(r.sections) && r.sections.length >= 1 && r.sections.length <= 8, "sections 1-8");
    for (const sec of r.sections) {
      assert(clen(sec.title) <= 24, "section title <=24");
      assert(
        Array.isArray(sec.rows) && sec.rows.length >= 1 && sec.rows.length <= 10,
        "list rows must be 1-10 (Meta cap): got " + sec.rows.length
      );
      for (const row of sec.rows) {
        assert(clen(row.title) <= 24, "row title <=24: " + JSON.stringify(row.title));
        assert(clen(row.description || "") <= 72, "row desc <=72");
        assert(clen(row.id) <= 256, "row id <=256");
      }
    }
  }
}

function flattenAny(r) {
  return toArr(r)
    .map((x) => flattenReply(x))
    .filter(Boolean)
    .join("\n");
}

async function step(label, payload, expectInclude) {
  const reply = await handleMessage(from, payload);
  for (const r of toArr(reply)) validateReply(r);
  const shown = flattenAny(reply);
  assert.strictEqual(
    shown.includes(expectInclude),
    true,
    `FAIL [${label}] expected "${expectInclude}" in:\n${shown}`
  );
  console.log(`PASS [${label}]`);
  return reply;
}

async function run() {
  // Greeting → single welcome bubble: branded image header + welcome text + menu buttons
  const m0 = toArr(await step("greeting hi", text("hi"), "Welcome to ZIPRA"));
  assert.strictEqual(m0.length, 1, "greeting sends one combined welcome bubble");
  assert.strictEqual(m0[0].type, "buttons");
  assert(m0[0].headerImage && m0[0].headerImage.includes("zipra-welcome.png"), "branded image in welcome bubble header");
  assert(flattenAny(m0).includes("Shop Groceries"), "greeting menu includes shop entry");

  const m1 = toArr(await step("greeting hello", text("hello"), "Welcome to ZIPRA"));
  assert.strictEqual(m1.length, 1);
  const m2 = toArr(await step("greeting vanakkam", text("vanakkam"), "Welcome to ZIPRA"));
  assert.strictEqual(m2.length, 1);

  // Shop → CTA hand-off to the web app (never the old category menu)
  const cta = await step("shop cta", id("home|shop"), "Click on the below link to start shopping");
  assert.strictEqual(cta.length, 2, "shop sends intro text + cta");
  assert.strictEqual(cta[1].type, "cta");
  assert(cta[1].buttons[0].url.includes("/shop?f="), "CTA deep-links to /shop with signed WhatsApp token");
  const typedShop = await step("typed shop", text("shop"), "Click Here");
  assert.strictEqual(typedShop[1].type, "cta");

  // In-chat legacy browse still works via typed commands
  await step("typed rice shelf", text("Rice"), "Ponni Rice");
  const a = await step("view Ponni card", id("prod|1"), "Ponni Rice");
  assert.strictEqual(a.type, "buttons", "product card is a button message");
  const a2 = await step("add Ponni x1", id("qty|1"), "Added: *Ponni Rice* ×1");
  assert.strictEqual(a2.type, "list", "after add stays in product list");
  const b = await step("view Basmati card", id("prod|2"), "India Gate Basmati Rice");
  assert.strictEqual(b.type, "buttons");
  const b2 = await step("add Basmati x1", id("qty|1"), "Added: *India Gate Basmati");
  assert.strictEqual(b2.type, "list");
  const c = await step("view Ponni again", id("prod|1"), "Ponni Rice");
  await step("add Ponni again", id("qty|1"), "Added: *Ponni Rice* ×1");
  const d = await step("done → cart", id("prod|done"), "Your Cart");
  assert.strictEqual(d.type, "buttons");

  // Change quantity (Ponni 2 → 5)
  await step("change qty menu", id("cart|qty"), "Change Quantity");
  await step("pick Ponni line", id("cq|0"), "current 2");
  await step("set qty 5", id("qty|5"), "Total");
  const e = await step("cart after qty change (direct)", id("cart|qty"), "Change Quantity");
  assert.strictEqual(e.type, "list");

  // Remove an item
  await step("remove item menu", id("cart|edit"), "Remove");
  const f = await step("remove basmati", id("rm|1"), "Your Cart");
  assert(f.type === "buttons");

  // Checkout now collects ADDRESS first, then name (never name-before-address)
  const g = await step("checkout → address first", id("cart|checkout"), "Delivery Address");
  assert.strictEqual(g.type, "text");
  const h = await step("send location", loc(), "Your Name");
  assert.strictEqual(h.type, "text");
  const h2 = await step("send name", text("Priya"), "Payment");
  assert.strictEqual(h2.type, "buttons");

  // Online payment (UPI)
  const j = await step("online payment", id("pay|online"), "UPI");
  assert.strictEqual(j.type, "list");
  assert(flattenReply(j).includes("upi://pay"), "upi link present");
  const k = await step("done continue", id("pay|review"), "Order Summary");
  assert.strictEqual(k.type, "buttons");
  assert(flattenReply(k).includes("maps.google.com"), "review has maps link");

  const m = await step("confirm", id("rev|confirm"), "Order Confirmed");
  assert.strictEqual(m.type, "text");

  const saved = orders.findByWa(from, 5);
  const o = saved[0];
  assert(o.id.startsWith("ZIP"));
  assert.strictEqual(o.paymentMethod, "online");
  assert.strictEqual(o.status, "received");
  assert.strictEqual(o.lat, 13.0827);
  assert(o.items.find((x) => x.item === "Ponni Rice").qty === 5, "qty changed persisted");
  console.log("PASS [legacy order saved with location + qty + online pay]");

  const prod = require("../src/products");
  assert.strictEqual(prod.getProductByKey("Rice.Ponni Rice").stock, 15);
  console.log("PASS [stock reduced]");

  const t = await step("track", id("home|track"), "Order #" + o.id);
  await step("refresh", id("trk|refresh"), "Order #" + o.id);
  await step("my orders", id("home|orders"), o.id);

  // Out of stock product not addable (Aavin Milk = global product id 17)
  await step("dairy shelf", text("dairy"), "Aavin Milk");
  const oos = await step("oos add Aavin", id("prod|17"), "out of stock");
  assert.strictEqual(oos.type, "list");

  // Unknown msg mid-flow → premium fallback (cart preserved, still Welcome menu)
  await step("unknown again", text("g"), "Welcome to ZIPRA");

  // Stress: large cart never exceeds WhatsApp row/button caps (global ids)
  for (const cat of prod.getCategories()) {
    await step("stress cat " + cat, text(cat), cat);
    const shelf = prod.getProductsInCategory(cat).slice(0, 7);
    for (const p of shelf) {
      validateReply(await handleMessage(from, id("prod|" + p.id)));
      validateReply(await handleMessage(from, id("qty|1")));
    }
  }
  await step("stress done", id("prod|done"), "Your Cart");
  await step("stress change qty", id("cart|qty"), "Change Quantity");
  await step("stress back to cart", id("nav|back"), "Your Cart");
  await step("stress remove", id("cart|edit"), "Remove");
  console.log("PASS [stress limits: rows/buttons/titles within Meta caps]");

  // WEB SHOPPING → verified payment → delivery capture flow
  const webOrder = db.insertOrder({
    id: db.nextOrderNo(),
    waId: from,
    name: "",
    address: "",
    lat: null,
    lng: null,
    items: [{ product_id: 1, key: "Rice.Ponni Rice", item: "Ponni Rice", unit: "kg", qty: 2, price: 65, subtotal: 130 }],
    subtotal: 130,
    deliveryFee: 30,
    discount: 0,
    total: 160,
    paymentMethod: "online",
    paymentStatus: "Paid",
    status: "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  });
  const cap = await beginWebDeliveryCapture(from, webOrder.id);
  assert.strictEqual(cap.length, 2, "payment success pushes text + address prompt");
  assert(cap[0].text.includes("Payment Successful"), "payment confirmed to customer");
  assert(cap[0].text.includes(webOrder.id), "payment message references order");

  const wl = await handleMessage(from, loc());
  validateReply(wl);
  assert(flattenReply(wl).includes("Your Name"), "location capture asks for name second");

  const wn = await handleMessage(from, text("Ravi"));
  const wnArr = toArr(wn);
  for (const r of wnArr) validateReply(r);
  assert(wnArr[0].type === "buttons", "name capture ends with order confirmation buttons");
  assert(flattenAny(wn).includes("ZIPRA ORDER CONFIRMED"), "web order confirmation shown");
  assert(flattenAny(wn).includes(webOrder.id), "confirmation references order no");

  const dbOrder = db.getOrderDetail(webOrder.id);
  assert.strictEqual(dbOrder.name, "Ravi", "web flow saves name");
  assert(dbOrder.address.includes("13.0827"), "web flow saves location");
  console.log("PASS [web payment → location → name → confirmed order]");

  // Greeting mid-flow does NOT hijack a text-capture step
  await handleMessage(from, text("Rice"));
  await handleMessage(from, id("prod|1"));
  await handleMessage(from, id("qty|1"));
  await handleMessage(from, id("prod|done"));
  await handleMessage(from, id("cart|checkout"));
  const midq = await step("greeting in mid-flow is address", text("hi"), "Delivery Address");
  assert.strictEqual(midq.type, "text");
  await step("finish mid-flow", text("12 Anna Nagar, Chennai"), "Your Name");
  await step("finish name", text("Divya"), "Payment");

  // Session timeout: cleanup returns the timeout message and deletes the session
  const s1 = sessions[from];
  assert(s1, "session exists");
  s1.updated_at = Date.now() - 400000;
  const due = cleanupExpiredSessions();
  const mine = due.find((d) => d.from === from);
  assert(mine && mine.text.includes("session has timed out"), "timeout message returned by cleanup");
  assert(!sessions[from], "expired session removed");
  assert(/restart.*Hi/i.test(mine.text) || /Hi/i.test(mine.text), "timeout message invites Hi to restart");
  console.log("PASS [session timeout → timeout message + session cleared]");

  // Hi restarts cleanly after timeout
  const rr = await step("restart after timeout", text("hi"), "Welcome to ZIPRA");
  assert.strictEqual(toArr(rr).length, 1);
  console.log("PASS [Hi restarts conversation after timeout]");

  console.log("\n✅ All tests passed!");
  process.exit(0);
}

run().catch((err) => {
  console.error("\n❌ TEST FAILED\n" + err.message);
  process.exit(1);
});