const fs = require("fs");

const DB_PATH = `/tmp/zipra-test-bot-${process.pid}.db`;
try { fs.unlinkSync(DB_PATH); } catch {}
for (const f of [DB_PATH + "-wal", DB_PATH + "-shm"]) {
  try { fs.unlinkSync(f); } catch {}
}

process.env.DB_PATH = DB_PATH;
process.env.DELIVERY_FEE = "30";
process.env.PAYMENT_UPI_ID = "ziprashop@upi";

const assert = require("assert");
const { handleMessage, flattenReply } = require("../src/bot");
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

function validateReply(r) {
  assert(r && r.type, "reply has a type");
  const body = r.body || r.text || "";
  assert(clen(body) <= 1024, "message body <=1024 chars: " + clen(body));
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

async function step(label, payload, expectInclude) {
  const reply = await handleMessage(from, payload);
  validateReply(reply);
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
  const m0 = await step("welcome hi", text("hi"), "Welcome to ZIPRA");
  assert.strictEqual(m0.type, "buttons");

  const u1 = await step("unknown → welcome", text("jskd"), "Welcome to ZIPRA");
  assert.strictEqual(u1.type, "buttons");

  // Multi-select: pick several items from same list
  await step("shop", id("home|shop"), "Choose a category");
  await step("cat Rice", id("cat|Rice"), "Ponni Rice");
  const a = await step("quick add Ponni", id("prod|1"), "Added: *Ponni Rice* ×1");
  assert.strictEqual(a.type, "list", "after quick add stays in list");
  const b = await step("quick add Basmati", id("prod|2"), "Added:");
  assert.strictEqual(b.type, "list");
  const c = await step("quick add Ponni again", id("prod|1"), "Added:");
  // done → cart
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
  const k = await step("done continue", id("pay|review"), "Order Summary");
  assert.strictEqual(k.type, "buttons");
  assert(flattenReply(k).includes("maps.google.com"), "review has maps link");

  // Confirm
  const m = await step("confirm", id("rev|confirm"), "Order Confirmed");
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
  const prod = require("../src/products");
  assert.strictEqual(prod.getProductByKey("Rice.Ponni Rice").stock, 15);
  console.log("PASS [stock reduced]");

  // Track live status + refresh
  const t = await step("track", id("home|track"), "Order #" + o.id);
  const t2 = await step("refresh", id("trk|refresh"), "Order #" + o.id);
  assert(t2.type === "list");

  // My orders
  await step("my orders", id("home|orders"), o.id);

  // Out of stock product not addable
  await step("shop", id("home|shop"), "Choose a category");
  await step("dairy", id("cat|Dairy"), "Aavin Milk");
  const oos = await step("oop add Aavin", id("prod|1"), "out of stock");
  assert.strictEqual(oos.type, "list");

  // Unknown msg mid-flow → welcome
  await step("unknown again", text("g"), "Welcome to ZIPRA");

  // Stress: large cart never exceeds WhatsApp row/button caps
  for (const cat of ["Rice", "Dairy", "Beverages"]) {
    await step("stress shop", id("home|shop"), "Choose a category");
    await step("stress cat " + cat, id("cat|" + cat), cat);
    for (let i = 1; i <= 7; i++) {
      validateReply(await handleMessage(from, id("prod|" + i)));
    }
  }
  await step("stress done", id("prod|done"), "Your Cart");
  await step("stress change qty", id("cart|qty"), "Change Quantity");
  await step("stress back to cart", id("nav|back"), "Your Cart");
  await step("stress remove", id("cart|edit"), "Remove");
  console.log("PASS [stress limits: rows/buttons/titles within Meta caps]");

  console.log("\n✅ All tests passed!");
  process.exit(0);
}

run().catch((err) => {
  console.error("\n❌ TEST FAILED\n" + err.message);
  process.exit(1);
});