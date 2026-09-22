const fs = require("fs");
const path = require("path");

const ORDERS_FILE = "/tmp/zipra-test-orders.json";
const PRODUCTS_FILE = "/tmp/zipra-test-products.json";

fs.copyFileSync(path.join(__dirname, "..", "products.json"), PRODUCTS_FILE);
try { fs.unlinkSync(ORDERS_FILE); } catch {}

process.env.ORDERS_FILE = ORDERS_FILE;
process.env.PRODUCTS_FILE = PRODUCTS_FILE;
process.env.DELIVERY_FEE = "30";
process.env.PAYMENT_UPI_ID = "ziprashop@upi";
process.env.SHEET_WEBAPP_URL = "";

const assert = require("assert");
const { handleMessage, flattenReply } = require("../bot");
const orders = require("../orders");

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

async function step(label, payload, expectInclude) {
  const reply = await handleMessage(from, payload);
  const shown = flattenReply(reply);
  assert.strictEqual(
    shown.includes(expectInclude),
    true,
    `FAIL [${label}] expected "${expectInclude}" in:\n${shown}`
  );
  console.log(`PASS [${label}]`);
  return reply;
}

async function run() {
  // Welcome
  const m0 = await step("welcome hi", text("hi"), "Welcome to Zipra");
  assert.strictEqual(m0.type, "list");

  const u1 = await step("unknown → welcome", text("jskd"), "Welcome to Zipra");
  assert.strictEqual(u1.type, "list");

  // Multi-select: pick several items from same list
  await step("shop", id("home|shop"), "Shop by Category");
  await step("cat Rice", id("cat|Rice"), "Ponni Rice");
  const a = await step("quick add Ponni", id("prod|1"), "Added: *Ponni Rice* ×1");
  assert.strictEqual(a.type, "list", "after quick add stays in list");
  const b = await step("quick add Basmati", id("prod|2"), "Added:");
  assert.strictEqual(b.type, "list");
  const c = await step("quick add Ponni again", id("prod|1"), "Added:");
  // done → cart
  const d = await step("done → cart", id("prod|done"), "Your Cart");
  assert.strictEqual(d.type, "list");

  // Change quantity (Ponni 2 → 5)
  await step("change qty menu", id("cart|qty"), "Change Quantity");
  await step("pick Ponni line", id("cq|0"), "current 2");
  await step("set qty 5", id("qty|5"), "Total");
  const e = await step("cart after qty change", id("nav|back"), "Ponni Rice × 5");
  assert.strictEqual(e.type, "list");

  // Remove an item
  await step("remove item menu", id("cart|edit"), "Remove");
  const f = await step("remove basmati", id("rm|1"), "Your Cart");
  assert(f.type === "list");

  // Checkout with LOCATION (no typing)
  const g = await step("checkout", id("cart|checkout"), "name");
  assert.strictEqual(g.type, "text");
  const h = await step("name", text("Priya"), "Delivery");
  assert(h.type === "text");
  const i = await step("send location", loc(), "Payment");
  assert.strictEqual(i.type, "buttons");

  // Online payment (UPI)
  const j = await step("online payment", id("pay|online"), "UPI");
  assert.strictEqual(j.type, "list");
  assert(flattenReply(j).includes("upi://pay"), "upi link present");
  const k = await step("done continue", id("pay|review"), "Review Your Order");
  assert.strictEqual(k.type, "buttons");
  assert(flattenReply(k).includes("maps.google.com"), "review has maps link");

  // Confirm
  const m = await step("confirm", id("rev|confirm"), "Order Placed");
  assert.strictEqual(m.type, "text");

  const saved = orders.findByWa(from, 5);
  const o = saved[0];
  assert(o.id.startsWith("ZIP"));
  assert.strictEqual(o.paymentMethod, "online");
  assert.strictEqual(o.status, "received");
  assert.strictEqual(o.lat, 13.0827);
  assert(o.items.find((x) => x.item === "Ponni Rice").qty === 5, "qty changed persisted");
  console.log("PASS [order saved with location + qty + online pay]");

  // Stock reduced correctly: Ponni 20→15, Basmati removed (no), Tata? not bought
  const prod = require("../products");
  assert.strictEqual(prod.getProductByKey("Rice.Ponni Rice").stock, 15);
  console.log("PASS [stock reduced]");

  // Track live status + refresh
  const t = await step("track", id("home|track"), "Order #" + o.id);
  const t2 = await step("refresh", id("trk|refresh"), "Order #" + o.id);
  assert(t2.type === "list");

  // My orders
  await step("my orders", id("home|orders"), o.id);

  // Out of stock product not addable
  await step("shop", id("home|shop"), "Shop by Category");
  await step("dairy", id("cat|Dairy"), "Aavin Milk");
  const oos = await step("oop add Aavin", id("prod|1"), "out of stock");
  assert.strictEqual(oos.type, "list");

  // Unknown msg mid-flow → welcome
  await step("unknown again", text("g"), "Welcome to Zipra");

  console.log("\n✅ All tests passed!");
  process.exit(0);
}

run().catch((err) => {
  console.error("\n❌ TEST FAILED\n" + err.message);
  process.exit(1);
});