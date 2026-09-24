const orders = require("./orders");
const products = require("./products");
const db = require("./db");

const DEFAULT_DELIVERY_FEE = parseInt(process.env.DELIVERY_FEE || "30", 10);
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || "300000", 10);

function deliveryFee() {
  return db.deliveryFee();
}

const stores = {};
const savedAddresses = {};

function namePrompt() {
  return textReply("👤 *Your Details*\n\nPlease type your full name.\nExample: Selva");
}

function addressPrompt(from, retry) {
  const saved = savedAddresses[from];
  return textReply(
    (retry ? "⚠️ We need a delivery address to continue.\n\n" : "") +
      "📍 *Delivery Address*\n\nChoose how to share:\n\n" +
      "1️⃣ Attach a 📍 location in the chat\n" +
      "2️⃣ Type your full address (house, street, area, city)\n" +
      (saved ? `3️⃣ Reply *saved* to reuse: ${saved}` : "3️⃣ Reply *saved* to reuse your last address")
  );
}

function getSession(from) {
  const now = Date.now();
  if (stores[from] && now - (stores[from].updated_at || 0) > SESSION_TIMEOUT_MS) {
    delete stores[from];
  }
  if (!stores[from]) {
    stores[from] = {
      wa_id: from,
      state: "welcome",
      cart: [],
      customer_name: null,
      address: null,
      payment_method: null,
      current_order_id: null,
      updated_at: now,
      last_msg_id: null,
      selected_key: null,
      category: null,
    };
  }
  return stores[from];
}

function touch(s) {
  s.updated_at = Date.now();
}

function resetToWelcome(s) {
  Object.assign(s, {
    state: "welcome",
    cart: [],
    customer_name: null,
    address: null,
    payment_method: null,
    current_order_id: null,
    selected_key: null,
    category: null,
  });
  touch(s);
}

function textReply(content) {
  return { type: "text", text: content };
}

function listReply(body, sections, button = "Options") {
  return { type: "list", body, button, sections };
}

function buttonReply(body, buttons) {
  return { type: "buttons", body, buttons };
}

function mainMenuReply(note) {
  return buttonReply(
    (note ? note + "\n\n" : "") +
      "🛒 *Welcome to ZIPRA*\n_Fresh Groceries. Faster Deliveries._\n\n" +
      "Tap an option to start.\n" +
      "· Type *offers* for deals & combos\n" +
      "· Type *help* for support",
    [
      { id: "home|shop", title: "🛍 Shop Groceries" },
      { id: "home|track", title: "📦 Track Order" },
      { id: "home|orders", title: "🧾 My Orders" },
    ]
  );
}

const CAT_GROUPS = [
  { title: "Rice & Grains", cats: ["Rice", "Flour & Atta"] },
  { title: "Dals & Oils", cats: ["Dal & Pulses", "Cooking Oil"] },
  { title: "Essentials", cats: ["Grocery Essentials"] },
  { title: "Beverages & Dairy", cats: ["Beverages", "Dairy"] },
];

function categoryRow(c) {
  const n = products.getProductsInCategory(c).filter((p) => p.available).length;
  return {
    id: `cat|${c}`,
    title: String(c).slice(0, 24),
    description: n ? `Fresh · ${n} item${n === 1 ? "" : "s"}` : "Browsing",
  };
}

function categoryMenuReply() {
  const cats = products.getCategories();
  const seen = {};
  const sections = [];
  for (const g of CAT_GROUPS) {
    const rows = g.cats
      .filter((c) => cats.includes(c))
      .map((c) => {
        seen[c] = 1;
        return categoryRow(c);
      });
    if (rows.length) sections.push({ title: String(g.title).slice(0, 24), rows });
  }
  const rest = cats.filter((c) => !seen[c]).map(categoryRow);
  if (rest.length) sections.push({ title: "More", rows: rest });
  sections.push({
    title: "Navigate",
    rows: [
      { id: "nav|back", title: "Back", description: "Main menu" },
      { id: "nav|home", title: "Main Menu", description: "Go home" },
    ],
  });
  return listReply("🛍 *Shop Groceries*\n\nChoose a category to start shopping:", sections);
}

function productCard(p) {
  const img = String(p.image || "").trim() ? `\n${String(p.image).trim()}` : "";
  const st = p.available ? "In stock" : "Out of stock";
  return `🛒 *${p.item}*${img}\n${fmtMoney(p.price)} / ${p.unit} · ${st}`;
}

function pName(p) {
  return String(p.item || "").slice(0, 24);
}

function pDesc(p) {
  if (!p.available) return "Out of stock";
  return `${fmtMoney(p.price)}/${p.unit} · In stock`;
}

function basketLine(cart) {
  const n = cart.length;
  if (!n) return "";
  return `\n🧺 Basket: ${n} item${n === 1 ? "" : "s"} · ${fmtMoney(calcSubtotal(cart))}`;
}

function productListReply(category, note, cart) {
  cart = cart || [];
  const list = products.getProductsInCategory(category);
  const rows = list.slice(0, 7).map((p, i) => ({
    id: `prod|${i + 1}`,
    title: pName(p),
    description: pDesc(p),
  }));
  rows.push({
    id: "prod|done",
    title: "Cart & Checkout",
    description: cart.length ? `🧺 ${fmtMoney(calcSubtotal(cart))} · Review` : "Finish shopping",
  });
  rows.push({ id: "nav|back", title: "Back", description: "Categories" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "Go home" });
  const body = `🛍 *${category}*\n\n${note || "Tap a product to add it, then press Cart & Checkout when done."}`;
  return listReply(body, [{ title: String(category).slice(0, 24), rows }]);
}

function qtyMenuReply(product) {
  const max = Math.max(1, product.stock);
  const qs = [1, 2, 5].filter((q) => q <= max);
  if (!qs.length) qs.push(1);
  const buttons = qs.map((q) => ({ id: `qty|${q}`, title: `${q} ${product.unit}` }));
  return buttonReply(
    `${productCard(product)}\n\nHow much would you like?\n· Tap a size below, or type a number (e.g. 3)`,
    buttons
  );
}

function changeQtyMenuReply(s) {
  if (!s.cart.length) {
    s.state = "cart";
    return cartMenuReply(s);
  }
  const rows = s.cart.slice(0, 6).map((c, i) => ({
    id: `cq|${i}`,
    title: `${String(c.item || "").slice(0, 18)} × ${c.qty}`,
    description: `${fmtMoney(c.subtotal)} · change qty`,
  }));
  rows.push({ id: "cart|edit", title: "Remove Item", description: "Pick what to remove" });
  rows.push({ id: "cart|clear", title: "Clear Cart", description: "Empty the cart" });
  rows.push({ id: "nav|back", title: "Back", description: "Cart" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "Go home" });
  return listReply("🔢 *Change Quantity*\n\nSelect an item to adjust:", [
    { title: "Items", rows },
  ]);
}

function qtyEditMenuReply(product, currentQty) {
  const max = Math.max(1, product.stock);
  const qs = [1, 2, 5].filter((q) => q <= max && q !== currentQty);
  if (!qs.length) qs.push(currentQty > 1 ? currentQty - 1 : 1);
  const buttons = qs.slice(0, 3).map((q) => ({ id: `qty|${q}`, title: `${q} ${product.unit}` }));
  return buttonReply(
    `${productCard(product)}\n\nSet quantity (current ${currentQty} ${product.unit}):\n✦ Tap a size below, or type a new number`,
    buttons
  );
}

function fmtMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

function calcSubtotal(cart) {
  return cart.reduce((sum, c) => sum + c.subtotal, 0);
}

function cartSummaryText(s) {
  const sub = calcSubtotal(s.cart);
  const del = deliveryFee();
  const lines = [];
  if (!s.cart.length) {
    lines.push("Your cart is empty.");
    lines.push("");
    lines.push(`Subtotal ${fmtMoney(0)}`);
    lines.push(`Delivery ${fmtMoney(del)}`);
    lines.push(`*Total   ${fmtMoney(del)}*`);
  } else {
    s.cart.forEach((c, i) => {
      lines.push(`${i + 1}. ${c.item}`);
      lines.push(`   ${c.qty} ${c.unit} × ${fmtMoney(c.price)} = ${fmtMoney(c.subtotal)}`);
    });
    lines.push("");
    lines.push("─────────────");
    lines.push(`Subtotal ${fmtMoney(sub)}`);
    lines.push(`Delivery ${fmtMoney(del)}`);
    lines.push(`*Total   ${fmtMoney(sub + del)}*`);
  }
  return `🛒 *Your Cart*\n\n${lines.join("\n")}`;
}

function cartMenuReply(s) {
  const buttons = [
    { id: "cart|more", title: "➕ Add More" },
    { id: "cart|checkout", title: "✅ Checkout" },
  ];
  if (s.cart.length) buttons.push({ id: "cart|qty", title: "🔢 Change Qty" });
  else buttons.push({ id: "nav|home", title: "🏠 Main Menu" });
  return buttonReply(cartSummaryText(s), buttons);
}

function removeItemMenuReply(s) {
  const rows = s.cart.slice(0, 7).map((c, i) => ({
    id: `rm|${i}`,
    title: `${String(c.item || "").slice(0, 18)} × ${c.qty}`,
    description: `Remove · ${fmtMoney(c.subtotal)}`,
  }));
  rows.push({ id: "nav|back", title: "Back", description: "Cart" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "Go home" });
  return listReply("✏️ *Edit Cart*\n\nSelect the item to remove:", [
    { title: "Items", rows },
  ]);
}

function paymentMenuReply() {
  return buttonReply("💳 *Payment*\n\nCash on Delivery or UPI — your choice:", [
    { id: "pay|cod", title: "💵 Cash on Delivery" },
    { id: "pay|online", title: "📲 UPI / Online" },
    { id: "nav|back", title: "⬅️ Back" },
  ]);
}

function reviewText(s) {
  const sub = calcSubtotal(s.cart);
  const total = sub + deliveryFee();
  const lines = [];
  s.cart.forEach((c, i) => {
    lines.push(`${i + 1}. ${c.item}`);
    lines.push(`   ${c.qty} ${c.unit} × ${fmtMoney(c.price)} = ${fmtMoney(c.subtotal)}`);
  });
  lines.push("");
  lines.push("─────────────");
  lines.push(`Subtotal ${fmtMoney(sub)}`);
  lines.push(`Delivery ${fmtMoney(deliveryFee())}`);
  lines.push(`*Total   ${fmtMoney(total)}*`);
  lines.push("");
  if (s.lat && s.lng) {
    lines.push("📍 Deliver to:");
    lines.push(`https://maps.google.com/maps?q=${s.lat},${s.lng}`);
  } else {
    lines.push(`📍 Deliver to:\n${s.address || "Pending"}`);
  }
  lines.push("");
  lines.push(`💳 Pay: ${s.payment_method === "online" ? "Online (UPI)" : "Cash on Delivery"}`);
  lines.push("");
  lines.push("Press *Confirm Order* to place your order.");
  return `🧾 *Order Summary*\n\n${lines.join("\n")}`;
}

function reviewMenuReply(s) {
  return buttonReply(reviewText(s), [
    { id: "rev|confirm", title: "Confirm Order" },
    { id: "rev|edit", title: "Edit Order" },
    { id: "rev|cancel", title: "Cancel" },
  ]);
}

function buildOrder(s, from) {
  const subtotal = calcSubtotal(s.cart);
  return {
    id: orders.nextOrderNo(),
    waId: from,
    name: s.customer_name,
    address: s.address,
    lat: s.lat || null,
    lng: s.lng || null,
    items: s.cart.map((c) => ({
      productId: c.key,
      item: c.item,
      unit: c.unit,
      qty: c.qty,
      price: c.price,
      subtotal: c.subtotal,
    })),
    subtotal,
    deliveryFee: deliveryFee(),
    total: subtotal + deliveryFee(),
    paymentMethod: s.payment_method,
    paymentStatus: s.payment_method === "online" ? "Pending" : "Not Paid",
    status: "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

const TIMELINE_STEPS = [
  { key: "received", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

function statusBar(status) {
  if (status === "cancelled") return "✕ ∅ ∅ ∅ ∅";
  const idx = TIMELINE_STEPS.findIndex((st) => st.key === status);
  if (idx < 0) return "● ○ ○ ○ ○";
  return "●".repeat(idx + 1) + "○".repeat(TIMELINE_STEPS.length - idx - 1);
}

function statusTimeline(status) {
  const idx = TIMELINE_STEPS.findIndex((st) => st.key === status);
  const lines = [];
  TIMELINE_STEPS.forEach((st, i) => {
    let mark;
    if (status === "cancelled") mark = i === 0 ? "✕" : "○";
    else if (i === idx) mark = "▶";
    else if (idx >= 0 && i < idx) mark = "✓";
    else mark = "○";
    lines.push(`${i + 1}. ${mark} ${st.label}`);
  });
  return lines.join("\n");
}

const STATUS_HINT = {
  received: "🕐 Your order is waiting for confirmation.",
  confirmed: "✅ Your order has been confirmed.",
  preparing: "👨‍🍳 Your order is being prepared.",
  out_for_delivery: "🛵 Your order is on the way!",
  delivered: "🎉 Your order has been delivered.",
  cancelled: "❌ This order was cancelled.",
};

function fmtPlaced(order) {
  const d = order.createdAt ? new Date(order.createdAt) : null;
  if (!d || isNaN(d.getTime())) return "—";
  const date = d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
  const time = d.toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
  return `${date}, ${time}`;
}

function safeDeliveryLabel(order) {
  const raw = String(order.address || "").trim();
  const cleaned = raw.replace(/^📍\s*/, "").trim();
  if (!cleaned) return "Delivery location received";
  if (/^-?\d+(\.\d+)?,\s*-?\d+(\.\d+)?(\s•.*)?$/.test(cleaned)) return "Delivery location received";
  return cleaned;
}

function itemsBlock(order) {
  return order.items
    .map((c) => `${c.item}\n${c.qty} ${c.unit} × ${fmtMoney(c.price)} = ${fmtMoney(c.subtotal)}`)
    .join("\n\n");
}

function summaryBlock(order) {
  const money = (n) => fmtMoney(n).padStart(6);
  return (
    `Subtotal ${money(order.subtotal)}\n` +
    `Delivery ${money(order.deliveryFee)}\n` +
    `────────────\n` +
    `*Total* ${money(order.total)}`
  );
}

function paymentLabel(order) {
  return order.paymentMethod === "online" ? "Online Payment" : "Cash on Delivery";
}

function trackBody(order) {
  const items = (order.items || []).map((c) => `${c.item} × ${c.qty} ${c.unit}`).join("\n");
  const hint = STATUS_HINT[order.status] || "";
  return (
    `📦 *Order Status*\nOrder #${order.id}\nPlaced: ${fmtPlaced(order)}\n\n` +
    (items ? `🛍 ${items}\n\n` : "") +
    `Subtotal ${fmtMoney(order.subtotal)} · Delivery ${fmtMoney(order.deliveryFee)}\n*Total ${fmtMoney(order.total)}*\n💳 ${paymentLabel(order)}\n\n` +
    `${statusBar(order.status)}\n${statusTimeline(order.status)}\n\n` +
    (hint ? `“${hint}”` : "")
  );
}

function trackReply(s, from) {
  const order = orders.findActiveByWa(from);
  if (!order) {
    return listReply("📦 *Order Status*\n\nYou don't have an active order right now.\nPlace a new order to get started!", [
      { title: "Track", rows: [
        { id: "home|shop", title: "Shop Groceries", description: "Start shopping" },
        { id: "nav|home", title: "Main Menu", description: "Go home" },
      ] },
    ]);
  }
  s.current_order_id = order.id;
  return listReply(trackBody(order), [
    { title: "Track", rows: [
      { id: "trk|refresh", title: "Refresh Status", description: "Get latest" },
      { id: "nav|back", title: "Back", description: "Main Menu" },
      { id: "nav|home", title: "Main Menu", description: "Go home" },
    ] },
  ]);
}

function myOrdersReply(s, from) {
  const recent = orders.findByWa(from, 8);
  if (!recent.length) {
    return listReply("🧾 *My Orders*\n\nYou haven't placed any orders yet.", [
      { title: "Orders", rows: [
        { id: "home|shop", title: "Shop Groceries", description: "Start shopping" },
        { id: "nav|home", title: "Main Menu", description: "Go home" },
      ] },
    ]);
  }
  const rows = recent.map((o, i) => ({
    id: `ord|${i}`,
    title: o.id,
    description: `${fmtMoney(o.total)} · ${orders.STATUS_LABEL[o.status]}`,
  }));
  rows.push({ id: "nav|back", title: "Back", description: "Main Menu" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "Go home" });
  return listReply("🧾 *My Orders*\n\nSelect an order to see its details:", [
    { title: "Recent Orders", rows },
  ]);
}

function orderDetailReply(order) {
  const body =
    `🧾 *Order #${order.id}*\n\n` +
    `Placed: ${fmtPlaced(order)}\n\n` +
    `${itemsBlock(order)}\n\n` +
    `${summaryBlock(order)}\n\n` +
    `💳 ${paymentLabel(order)} · 📍 ${safeDeliveryLabel(order)}\n\n` +
    `${statusBar(order.status)}\n${statusTimeline(order.status)}`;
  return listReply(body, [
    { title: "Order", rows: [
      { id: "detail|refresh", title: "Refresh Status", description: "Get latest" },
      { id: "nav|home", title: "Main Menu", description: "Go home" },
    ] },
  ]);
}

function offersReply() {
  const active = (typeof db.listPromotions === "function" ? db.listPromotions() : [])
    .filter((p) => p.active && p.code);
  if (!active.length) {
    return textReply("🍊 *Offers & Combos*\n\nNo active offers right now — check back soon.\n\nType *menu* or tap Main Menu anytime.");
  }
  const lines = active.map((p, i) => {
    const v = p.type === "percent" ? `${p.value}% off` : `${fmtMoney(p.value)} off`;
    return `${i + 1}. *${p.code}* · ${p.title || v}\n   ${v}${p.minOrder ? ` · min order ${fmtMoney(p.minOrder)}` : ""}`;
  });
  return textReply(`🍊 *Offers & Combos*\n\n${lines.join("\n\n")}\n\nUse the code at checkout.\n\nType *menu* anytime.`);
}

function helpReply() {
  return textReply(
    "❓ *Help*\n\n" +
      "🛍 *Shop Groceries* — Tap Shop Groceries, pick a category, tap products to add, then Cart & Checkout.\n" +
      "📦 *Track Order* — See live status: Order Placed → Confirmed → Preparing → Out for Delivery → Delivered.\n" +
      "💳 *Payment* — Cash on Delivery or UPI (online).\n" +
      "🧾 *My Orders* — See your past orders any time.\n\n" +
      "Type *menu* to return to the Main Menu, or *offers* for today's deals."
  );
}

function goBack(s, from) {
  switch (s.state) {
    case "product": {
      s.state = "category";
      return categoryMenuReply();
    }
    case "qty": {
      s.state = "product";
      return productListReply(s.category || "", null, s.cart);
    }
    case "qty_change": {
      s.state = "cart";
      return cartMenuReply(s);
    }
    case "custom_qty_change": {
      s.state = "qty_change";
      return changeQtyMenuReply(s);
    }
    case "custom_qty": {
      const p = s.selected_key ? products.getProductByKey(s.selected_key) : null;
      if (p) {
        s.state = "qty";
        return qtyMenuReply(p);
      }
      s.state = "category";
      return categoryMenuReply();
    }
    case "remove_item": {
      s.state = "cart";
      return cartMenuReply(s);
    }
    case "address": {
      s.state = "name";
      return namePrompt();
    }
    case "payment": {
      s.state = "address";
      return addressPrompt(from);
    }
    case "payment_confirm": {
      s.state = "payment";
      return paymentMenuReply();
    }
    case "review": {
      s.state = "payment";
      return paymentMenuReply();
    }
    default: {
      resetToWelcome(s);
      return mainMenuReply();
    }
  }
}

function quickAdd(s, product) {
  const key = `${product.category}.${product.item}`;
  const existing = s.cart.find((c) => c.key === key);
  if (existing) {
    existing.qty += 1;
    existing.subtotal = existing.price * existing.qty;
  } else {
    s.cart.push({
      key,
      item: product.item,
      unit: product.unit,
      qty: 1,
      price: product.price,
      subtotal: product.price,
    });
  }
  touch(s);
}

function applyQtyChange(s, q, price) {
  const line = s.cart[s.qty_edit_idx];
  if (!line) return;
  line.qty = q;
  line.subtotal = price * q;
  if (line.qty <= 0) s.cart.splice(s.qty_edit_idx, 1);
  touch(s);
}

async function handleMessage(from, payload, _saveOrder) {
  const input = (payload && payload.text) || "";
  let replyId = "";
  if (payload && payload.kind === "interactive") {
    replyId = payload.id || "";
    if (replyId.startsWith("home|")) replyId = replyId.slice(5);
    if (replyId.startsWith("nav|")) replyId = replyId.slice(4);
    if (replyId.startsWith("cat|")) replyId = `cat-${replyId.slice(4)}`;
    if (replyId.startsWith("prod|")) replyId = `prod-${replyId.slice(5)}`;
    if (replyId.startsWith("qty|")) replyId = `qty-${replyId.slice(4)}`;
    if (replyId.startsWith("cart|")) replyId = `cart-${replyId.slice(5)}`;
    if (replyId.startsWith("rm|")) replyId = `rm-${replyId.slice(3)}`;
    if (replyId.startsWith("cq|")) replyId = `cq-${replyId.slice(3)}`;
    if (replyId.startsWith("pay|")) replyId = `pay-${replyId.slice(4)}`;
    if (replyId.startsWith("rev|")) replyId = `rev-${replyId.slice(4)}`;
    if (replyId.startsWith("trk|")) replyId = `trk-${replyId.slice(4)}`;
    if (replyId.startsWith("ord|")) replyId = `ord-${replyId.slice(4)}`;
    if (replyId.startsWith("detail|")) replyId = `detail-${replyId.slice(7)}`;
  }
  const selected = replyId; // normalized choice for this turn ("" if typed textual)
  const s = getSession(from);
  touch(s);

  const typed = String(input).trim().toLowerCase();
  const navHome = selected === "home";
  const navBack = selected === "back";

  if (typed === "help" || selected === "help") {
    resetToWelcome(s);
    return helpReply();
  }

  if (typed === "menu") {
    resetToWelcome(s);
    return mainMenuReply();
  }

  if (navHome) {
    resetToWelcome(s);
    return mainMenuReply();
  }

  if (navBack) {
    return goBack(s, from);
  }

  if (selected === "shop") {
    s.state = "category";
    s.category = null;
    return categoryMenuReply();
  }
  if (selected === "track") {
    s.state = "track";
    return trackReply(s, from);
  }
  if (selected === "orders") {
    s.state = "my_orders";
    return myOrdersReply(s, from);
  }

  const textStates = ["custom_qty", "name", "address"];
  if (typed === "offers" && !textStates.includes(s.state)) {
    resetToWelcome(s);
    return offersReply();
  }
  if (selected === "" && typed && !textStates.includes(s.state)) {
    resetToWelcome(s);
    return mainMenuReply(
      "Sorry, I didn't understand that.\nPlease choose one of the options below:"
    );
  }

  switch (s.state) {
    case "welcome": {
      resetToWelcome(s);
      return mainMenuReply();
    }

    case "category": {
      if (selected && selected.startsWith("cat-")) {
        const category = selected.slice(4);
        if (products.getProductsInCategory(category).length) {
          s.state = "product";
          s.category = category;
          return productListReply(category);
        }
      }
      return categoryMenuReply();
    }

    case "product": {
      if (selected === "prod-done") {
        s.state = "cart";
        return cartMenuReply(s);
      }
      if (selected && selected.startsWith("prod-")) {
        const idx = parseInt(selected.slice(5), 10);
        const list = products.getProductsInCategory(s.category);
        const product = list[idx - 1];
        if (!product) return productListReply(s.category, null, s.cart);
        if (!product.available || product.stock <= 0) {
          return productListReply(
            s.category,
            `Sorry, *${product.item}* is out of stock.\nPlease tap another product.`,
            s.cart
          );
        }
        const added = quickAdd(s, product);
        const imgLine = String(product.image || "").trim() ? `\n🖼 ${String(product.image).trim()}` : "";
        return productListReply(
          s.category,
          `✅ Added: *${product.item}* ×1 (${fmtMoney(product.price)})${imgLine}\nCart subtotal: ${fmtMoney(calcSubtotal(s.cart))}\n\nTap another product or press "Cart & Checkout" when you are done.`,
          s.cart
        );
      }
      return productListReply(s.category, null, s.cart);
    }

    case "qty": {
      const product = products.getProductByKey(s.selected_key);
      if (!product) {
        resetToWelcome(s);
        return mainMenuReply();
      }
      if (selected === "qty-custom") {
        s.state = "custom_qty";
        return textReply(`✍️ *Custom Quantity*\n\nType the quantity you need — maximum available: ${product.stock} ${product.unit}.`);
      }
      if (selected && selected.startsWith("qty-")) {
        const q = parseInt(selected.slice(4), 10);
        if (q > 0 && q <= product.stock) {
          return addToCart(s, product, q);
        }
        return textReply(
          `Sorry, only *${product.stock}* available.\nPlease choose a smaller quantity.`
        );
      }
      if (!selected && /^\d+$/.test(typed)) {
        const q = parseInt(typed, 10);
        if (q > 0 && q <= product.stock) return addToCart(s, product, q);
        return textReply(`Sorry, only ${product.stock} available. Please type a smaller quantity.`);
      }
      return qtyMenuReply(product);
    }

    case "custom_qty": {
      const product = products.getProductByKey(s.selected_key);
      if (!product) {
        resetToWelcome(s);
        return mainMenuReply();
      }
      const q = parseInt(typed, 10);
      if (isNaN(q) || q <= 0) {
        return textReply(`✍️ Please type a number (example: 3). Maximum available: ${product.stock}.`);
      }
      if (q > product.stock) {
        return textReply(
          `Sorry, only *${product.stock}* in stock. Please type ${product.stock} or less.`
        );
      }
      return addToCart(s, product, q);
    }

    case "qty_change": {
      if (selected && selected.startsWith("cq-")) {
        const idx = parseInt(selected.slice(3), 10);
        const line = s.cart[idx];
        if (!line) {
          s.state = "cart";
          return cartMenuReply(s);
        }
        s.qty_edit_idx = idx;
        const product = products.getProductByKey(line.key);
        if (product) return qtyEditMenuReply(product, line.qty);
      }
      const idx0 = s.qty_edit_idx >= 0 ? s.qty_edit_idx : 0;
      const line = s.cart[idx0];
      const product = line && products.getProductByKey(line.key);
      if (selected === "cart-edit") {
        s.state = "remove_item";
        return removeItemMenuReply(s);
      }
      if (selected === "cart-clear") {
        s.cart = [];
        s.state = "cart";
        return cartMenuReply(s);
      }
      if (!product) {
        s.state = "cart";
        return cartMenuReply(s);
      }
      if (selected === "qty-custom") {
        s.state = "custom_qty_change";
        return textReply(`✍️ *Custom Quantity*\n\nType the new quantity — maximum available: ${product.stock} ${product.unit}.`);
      }
      if (selected && selected.startsWith("qty-")) {
        const q = parseInt(selected.slice(4), 10);
        if (q > 0 && q <= product.stock) {
          applyQtyChange(s, q, product.price);
          s.state = "cart";
          return cartMenuReply(s);
        }
        return textReply(`Sorry, only ${product.stock} available.`);
      }
      if (!selected && /^\d+$/.test(typed)) {
        const q = parseInt(typed, 10);
        if (q > 0 && q <= product.stock) {
          applyQtyChange(s, q, product.price);
          s.state = "cart";
          return cartMenuReply(s);
        }
        return textReply(`Sorry, only ${product.stock} available.`);
      }
      return qtyEditMenuReply(product, line.qty);
    }

    case "custom_qty_change": {
      const line = s.cart[s.qty_edit_idx];
      const product = line && products.getProductByKey(line.key);
      if (!product) {
        s.state = "cart";
        return cartMenuReply(s);
      }
      const q = parseInt(typed, 10);
      if (isNaN(q) || q <= 0 || q > product.stock) {
        return textReply(`✍️ Please type a valid number (1-${product.stock}):`);
      }
      applyQtyChange(s, q, product.price);
      s.state = "cart";
      return cartMenuReply(s);
    }

    case "cart": {
      if (selected === "cart-more") {
        s.state = "category";
        return categoryMenuReply();
      }
      if (selected === "cart-qty") {
        s.state = "qty_change";
        s.qty_edit_idx = -1;
        return changeQtyMenuReply(s);
      }
      if (selected === "cart-checkout") {
        if (!s.cart.length) return cartMenuReply(s);
        s.state = "name";
        return namePrompt();
      }
      if (selected === "cart-edit") {
        s.state = "remove_item";
        return removeItemMenuReply(s);
      }
      if (selected === "cart-clear") {
        s.cart = [];
        s.state = "welcome";
        return textReply("Your cart has been cleared. Continue from the Main Menu when you are ready.");
      }
      return cartMenuReply(s);
    }

    case "remove_item": {
      if (selected && selected.startsWith("rm-")) {
        const idx = parseInt(selected.slice(3), 10);
        if (!isNaN(idx) && idx >= 0 && idx < s.cart.length) {
          s.cart.splice(idx, 1);
        }
      }
      s.state = "cart";
      return cartMenuReply(s);
    }

    case "name": {
      const name = String(input).trim();
      if (name.length < 2) {
        return textReply("👤 Please type your full name.\nExample: Selva");
      }
      s.customer_name = name;
      s.state = "address";
      return addressPrompt(from);
    }

    case "address": {
      if (payload && payload.kind === "location") {
        const lat = payload.latitude;
        const lng = payload.longitude;
        const label = [payload.address, payload.name].filter(Boolean).join(", ");
        s.address = `📍 ${lat},${lng}${label ? " • " + label : ""}`;
        s.lat = lat;
        s.lng = lng;
        s.state = "payment";
        return paymentMenuReply();
      }
      const address = String(input).trim();
      if (address.toLowerCase() === "saved") {
        const saved = savedAddresses[from];
        if (saved) {
          s.address = saved;
          s.lat = null;
          s.lng = null;
          s.state = "payment";
          return paymentMenuReply();
        }
        return addressPrompt(from, true);
      }
      if (address.length < 5) {
        return addressPrompt(from, true);
      }
      s.address = address;
      savedAddresses[from] = address;
      s.state = "payment";
      return paymentMenuReply();
    }

    case "payment": {
      if (selected === "pay-cod") {
        s.payment_method = "cod";
        s.state = "review";
        return reviewMenuReply(s);
      }
      if (selected === "pay-online") {
        s.payment_method = "online";
        s.state = "payment_confirm";
        return onlinePaymentReply(s);
      }
      return paymentMenuReply();
    }

    case "payment_confirm": {
      if (selected === "pay-review") {
        s.state = "review";
        return reviewMenuReply(s);
      }
      if (selected === "pay-back") {
        s.payment_method = null;
        s.state = "payment";
        return paymentMenuReply();
      }
      return onlinePaymentReply(s);
    }

    case "review": {
      if (selected === "rev-confirm") {
        return confirmOrder(s, from);
      }
      if (selected === "rev-edit") {
        s.state = "name";
        return namePrompt();
      }
      if (selected === "rev-cancel") {
        s.cart = [];
        s.state = "welcome";
        return textReply("Order cancelled. Continue from the Main Menu when you are ready.");
      }
      return reviewMenuReply(s);
    }

    case "track": {
      if (selected === "trk-refresh") {
        return trackReply(s, from);
      }
      return trackReply(s, from);
    }

    case "my_orders": {
      if (selected && selected.startsWith("ord-")) {
        const idx = parseInt(selected.slice(4), 10);
        const order = orders.findByWa(from, 8)[idx];
        if (order) {
          s.current_order_id = order.id;
          s.state = "order_detail";
          return orderDetailReply(order);
        }
      }
      return myOrdersReply(s, from);
    }

    case "order_detail": {
      if (selected === "detail-refresh") {
        const order = s.current_order_id
          ? orders.findById(s.current_order_id)
          : orders.findActiveByWa(from);
        if (order) return orderDetailReply(order);
      }
      s.state = "welcome";
      return mainMenuReply();
    }

    default: {
      resetToWelcome(s);
      return mainMenuReply();
    }
  }
}

function addToCart(s, product, q) {
  const subtotal = product.price * q;
  const existing = s.cart.find((c) => c.key === `${product.category}.${product.item}`);
  if (existing) {
    existing.qty += q;
    existing.subtotal = existing.price * existing.qty;
  } else {
    s.cart.push({
      key: `${product.category}.${product.item}`,
      item: product.item,
      unit: product.unit,
      qty: q,
      price: product.price,
      subtotal,
    });
  }
  s.state = "cart";
  return cartMenuReply(s);
}

function onlinePaymentReply(s) {
  const total = calcSubtotal(s.cart) + deliveryFee();
  let msg = `💳 *Online Payment*\n\nOrder Amount: ${fmtMoney(total)}\n\n`;
  const upi = process.env.PAYMENT_UPI_ID;
  const link = process.env.PAYMENT_LINK;
  if (link) {
    msg += `📲 Pay link:\n${link}?amount=${total}&order=${orders.nextOrderNo()}\n\n`;
  }
  if (upi) {
    const tn = encodeURIComponent(`Zipra Order ${orders.nextOrderNo()}`);
    const am = encodeURIComponent(total);
    msg += `💸 UPI pay:\nupi://pay?pa=${encodeURIComponent(upi)}&pn=Zipra&am=${am}&tn=${tn}\n\n`;
    msg += `(Opens in GPay / PhonePe / any UPI app)\n\n`;
  }
  msg += "Please complete the payment now, then tap 'Done - Continue'. We will verify the payment before confirming your order - our team checks and confirms it. Thank you! 🙏";
  return listReply(msg, [
    { title: "Payment", rows: [
      { id: "pay|review", title: "Done - Continue", description: "✅ Go to review" },
      { id: "pay|back", title: "Use Cash on Delivery", description: "⬅️ Switch" },
    ] },
  ]);
}

async function confirmOrder(s, from) {
  if (!s.cart.length) {
    resetToWelcome(s);
    return mainMenuReply();
  }

  for (const c of s.cart) {
    if (!products.stockAvailable(c.key, c.qty)) {
      const bad = products.getProductByKey(c.key);
      const name = bad ? bad.item : c.item;
      s.state = "cart";
      return listReply(
        `❌ Sorry, we don't have enough *${name}* in stock for the requested quantity (${c.qty}).\nPlease edit the cart and try again.`,
        [{ title: "Cart", rows: [
          { id: "cart|edit", title: "Edit Cart", description: "✏️" },
          { id: "cart|checkout", title: "Checkout", description: "✅" },
          { id: "nav|home", title: "Main Menu", description: "🏠" },
        ] }]
      );
    }
  }

  for (const c of s.cart) {
    products.reduceStock(c.key, c.qty);
  }

  const order = buildOrder(s, from);
  orders.insert(order);
  s.current_order_id = order.id;
  s.cart = [];
  s.state = "welcome";
  touch(s);

  const deliveryLine = order.lat && order.lng
    ? `https://maps.google.com/maps?q=${order.lat},${order.lng}`
    : String(order.address || "Shared during checkout").replace(/^📍 /, "");
  const msg =
    `✅ *Order Confirmed*\n\n` +
    `🧾 Order #${order.id} · ${fmtPlaced(order)}\n\n` +
    `🛒 *Items*\n` +
    order.items.map((c, i) => `${i + 1}. ${c.item} × ${c.qty} ${c.unit} = ${fmtMoney(c.subtotal)}`).join("\n") +
    `\n\n` +
    `Subtotal ${fmtMoney(order.subtotal)} · Delivery ${fmtMoney(order.deliveryFee)}\n` +
    `*Total ${fmtMoney(order.total)}*\n` +
    `💳 ${order.paymentMethod === "online" ? "Online (UPI)" : "Cash on Delivery"}\n\n` +
    `📍 Deliver to:\n${deliveryLine}\n\n` +
    `${statusBar(order.status)} ${orders.STATUS_LABEL[order.status] || "Order Received"}\n\n` +
    `Track it anytime with 📦 Track Order. We'll keep you updated here — thank you for choosing ZIPRA 🧡`;

  return textReply(msg);
}

function flattenReply(reply) {
  if (reply.type === "text") return reply.text;
  if (reply.type === "buttons") {
    return reply.body + "\n" + reply.buttons.map((b, i) => `${i + 1}. ${b.title}`).join("\n");
  }
  if (reply.type === "list") {
    let out = reply.body + "\n";
    reply.sections.forEach((sec) => {
      sec.rows.forEach((r, i) => {
        out += `${i + 1}. ${r.title}${r.description ? " (" + r.description + ")" : ""}\n`;
      });
    });
    return out;
  }
  return "";
}

function cleanupExpiredSessions() {
  const now = Date.now();
  for (const from of Object.keys(stores)) {
    if (now - (stores[from].updated_at || 0) > SESSION_TIMEOUT_MS) {
      delete stores[from];
    }
  }
}

module.exports = { handleMessage, flattenReply, sessions: stores, cleanupExpiredSessions };