const orders = require("./orders");
const products = require("./products");
const db = require("./db");
const shoplink = require("./shoplink");

const DEFAULT_DELIVERY_FEE = parseInt(process.env.DELIVERY_FEE || "30", 10);
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || "300000", 10);

const BRAND_FOOTER = "ZIPRA Grocery · Fresh & Fast 🍊";
const WELCOME_BANNER = String(process.env.WELCOME_BANNER_IMAGE || "").trim();
const WEB_APP_URL = String(process.env.WEB_APP_URL || `http://localhost:${process.env.PORT || 3000}`).replace(/\/+$/, "");

function webUrl(path) {
  return WEB_APP_URL + (path || "");
}

function welcomeImageUrl() {
  return WELCOME_BANNER || webUrl("/assets/zipra-welcome.png");
}

const GREETINGS = new Set([
  "hi", "hello", "hey", "hai", "hii", "yo", "vanakkam", "namaste", "namaskar", "start", "welcome", "eppadi", "helo",
]);

function timeoutText() {
  return "⌛ Due to inactivity on the channel, your session has timed out.\n\nJust type *Hi* to restart your conversation 👋";
}

function deliveryFee() {
  return db.deliveryFee();
}

const stores = {};
const savedAddresses = {};

/* ------------------------------------------------------------------ */
/* Small presentation helpers                                          */
/* ------------------------------------------------------------------ */

function textReply(content) {
  return { type: "text", text: content };
}

function listReply(body, sections, button = "Choose ▾", opts) {
  opts = opts || {};
  const r = { type: "list", body, button, sections };
  const footer = opts.footer === undefined ? BRAND_FOOTER : opts.footer;
  if (footer) r.footer = String(footer).slice(0, 60);
  if (opts.headerText) r.headerText = String(opts.headerText).slice(0, 60);
  return r;
}

function buttonReply(body, buttons, opts) {
  opts = opts || {};
  const r = { type: "buttons", body, buttons };
  const footer = opts.footer === undefined ? BRAND_FOOTER : opts.footer;
  if (footer) r.footer = String(footer).slice(0, 60);
  if (opts.headerImage) r.headerImage = opts.headerImage;
  if (opts.headerText) r.headerText = String(opts.headerText).slice(0, 60);
  return r;
}

function fmtMoney(n) {
  return `₹${Number(n || 0).toLocaleString("en-IN")}`;
}

/* A product's *effective* selling price (discount-aware). */
function productPrice(p) {
  return p.effectivePrice && p.effectivePrice > 0 ? p.effectivePrice : p.price;
}

function calcSubtotal(cart) {
  return cart.reduce((sum, c) => sum + c.subtotal, 0);
}

function basketBadge(s) {
  const n = (s.cart || []).length;
  if (!n) return "";
  return ` 🧺 ${n} item${n === 1 ? "" : "s"} · ${fmtMoney(calcSubtotal(s.cart))}`;
}

const CAT_EMOJI = {
  "Rice": "🍚",
  "Flour & Atta": "🌾",
  "Dal & Pulses": "🫘",
  "Cooking Oil": "🌻",
  "Grocery Essentials": "🧂",
  "Beverages": "☕",
  "Dairy": "🥛",
};

function catEmoji(c) {
  return CAT_EMOJI[c] || "🛒";
}

/* ------------------------------------------------------------------ */
/* Welcome / navigation                                               */
/* ------------------------------------------------------------------ */

function mainMenuReply(note) {
  const opts = {};
  if (WELCOME_BANNER) opts.headerImage = WELCOME_BANNER;
  else opts.headerText = "ZIPRA Grocery";
  return buttonReply(
    (note ? note + "\n\n" : "") +
      "🛒 *Welcome to ZIPRA*\n_Fresh Groceries. Faster Deliveries._\n\n" +
      "What would you like to do?",
    [
      { id: "home|shop", title: "🛍 Shop Groceries" },
      { id: "home|track", title: "📦 Track Order" },
      { id: "home|orders", title: "🧾 My Orders" },
    ],
    opts
  );
}

function fallbackReply(s) {
  const note =
    (s.cart && s.cart.length
      ? `🧺 Your basket is safe — ${s.cart.length} item${s.cart.length === 1 ? "" : "s"} (${fmtMoney(calcSubtotal(s.cart))}).\n\n`
      : "") +
    "Sorry, I didn't quite get that 👀\n\n" +
    "🛒 *Welcome to ZIPRA*\nHere's what I can do 👇";
  return buttonReply(note, [
    { id: "home|shop", title: "🛍 Shop Groceries" },
    { id: "home|track", title: "📦 Track Order" },
    { id: "help", title: "❓ Help" },
  ]);
}

/* Single-bubble welcome: branded image header + welcome text + menu buttons */
function welcomeSequence() {
  return buttonReply(
    "👋 *Hi! Welcome to ZIPRA* 🛒\n_Fresh Groceries. Faster Deliveries._\n\nWhat would you like to do?",
    [
      { id: "home|shop", title: "🛍 Shop Groceries" },
      { id: "home|track", title: "📦 Track Order" },
      { id: "home|orders", title: "🧾 My Orders" },
    ],
    { headerImage: welcomeImageUrl() }
  );
}

/* Shopping now happens in the ZIPRA web app; WhatsApp hands off via CTA. */
function shopIntroReply() {
  return textReply("🛍 *Shop Groceries*\n\nClick on the below link to start shopping 👇\nPick your items, tap Checkout — then finish payment right here on WhatsApp.");
}

function shopCtaReply(from) {
  const tok = shoplink.sign(from);
  const url = webUrl(`/shop${tok ? "?f=" + tok : ""}`);
  return {
    type: "cta",
    body: "🔗 *Click Here* to open the ZIPRA shop.",
    buttons: [{ id: "cta|shop", title: "🔗 Click Here", url }],
  };
}

function deliveryReviewReply() {
  return buttonReply(
    "Thanks for your Order ✔️\n\nYour experience matters to us!\nHelp us improve by providing your Feedback ✨",
    [
      { id: "feedback", title: "⭐ Give Feedback" },
      { id: "shopagain", title: "🛍 Shop Again" },
      { id: "home|home", title: "🏠 Main Menu" },
    ],
    { headerText: "ZIPRA Grocery" }
  );
}

function helpReply() {
  return listReply(
    "❓ *Help*\n\nQuick start: tap 🛍 *Shop Groceries*, pick a shelf, tap a product to see its photo + price, add a quantity, then Checkout.\n\nYou can also *type* commands like “Dairy”, “basmati”, “cart”, “track”, “offers”.",
    [
      {
        title: "Quick actions",
        rows: [
          { id: "home|shop", title: "🛍 Shop Groceries", description: "Start shopping" },
          { id: "home|track", title: "📦 Track Order", description: "Live status" },
          { id: "home|orders", title: "🧾 My Orders", description: "History" },
          { id: "home|home", title: "🏠 Main Menu", description: "Go home" },
        ],
      },
    ]
  );
}

function offersReply() {
  const active = (typeof db.listPromotions === "function" ? db.listPromotions() : [])
    .filter((p) => p.active && p.code);
  if (!active.length) {
    return textReply("🍊 *Offers & Combos*\n\nNo active offers right now — check back soon!\n\nTap 🛍 Shop Groceries to start.");
  }
  const rows = active.slice(0, 8).map((p, i) => {
    const v = p.type === "percent" ? `${p.value}% off` : `${fmtMoney(p.value)} off`;
    return {
      id: `off|${i}`,
      title: `Use code ${p.code}`,
      description: `${p.title || v}${p.minOrder ? ` · min ${fmtMoney(p.minOrder)}` : ""}`,
    };
  });
  rows.push({ id: "home|shop", title: "🛍 Shop Groceries", description: "Start the haul" });
  rows.push({ id: "home|home", title: "🏠 Main Menu", description: "Go home" });
  return listReply("🍊 *Offers & Combos*\n\nTap a deal, then apply the code at checkout:", [
    { title: "Deals", rows },
  ]);
}

/* ------------------------------------------------------------------ */
/* Category ("shelf") browse                                          */
/* ------------------------------------------------------------------ */

const CAT_GROUPS = [
  { title: "Rice & Grains", cats: ["Rice", "Flour & Atta"] },
  { title: "Dals & Oils", cats: ["Dal & Pulses", "Cooking Oil"] },
  { title: "Essentials", cats: ["Grocery Essentials"] },
  { title: "Beverages & Dairy", cats: ["Beverages", "Dairy"] },
];

function categoryRow(c) {
  const list = products.getProductsInCategory(c);
  const avail = list.filter((p) => p.available);
  const prices = avail.map((p) => productPrice(p)).filter((n) => n > 0).sort((a, b) => a - b);
  const range = prices.length > 1
    ? `${fmtMoney(prices[0])}–${fmtMoney(prices[prices.length - 1])}`
    : prices.length === 1
      ? fmtMoney(prices[0])
      : "";
  const desc = avail.length
    ? `${avail.length} item${avail.length === 1 ? "" : "s"}${range ? ` · ${range}` : ""}`
    : "Browsing";
  return {
    id: `cat|${c}`,
    title: `${catEmoji(c)} ${String(c).slice(0, 21)}`,
    description: desc,
  };
}

function categoryMenuReply(s) {
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

  const nav = [];
  if (s.cart && s.cart.length) {
    nav.push({ id: "cart-view", title: "🧺 View Cart", description: `${fmtMoney(calcSubtotal(s.cart))} · ${s.cart.length} items` });
  }
  nav.push({ id: "home|home", title: "🏠 Main Menu", description: "Start over" });
  sections.push({ title: "Navigate", rows: nav });
  return listReply("🛍 *Shop Groceries*\n\nChoose a category to start your haul 👇", sections);
}

/* ------------------------------------------------------------------ */
/* Product cards (the "shopping" moment)                              */
/* ------------------------------------------------------------------ */

function stockLine(p) {
  if (!p.available || p.stock <= 0) return "Out of stock";
  if (p.stock <= p.low_stock_level) return `Only ${Math.floor(p.stock)} left 🔥`;
  return "In stock";
}

function priceLine(p) {
  return `${fmtMoney(productPrice(p))} / ${p.unit}`;
}

function pName(p) {
  return String(p.item || "").slice(0, 24);
}

function pDesc(p) {
  if (!p.available) return "Out of stock";
  return `${priceLine(p)} · ${stockLine(p)}`;
}

function productListReply(category, note, cart) {
  cart = cart || [];
  const list = products.getProductsInCategory(category);
  const rows = list.slice(0, 7).map((p) => {
    const inCart = cart.find((c) => c.key === `${p.category}.${p.item}`);
    const desc =
      p.available
        ? `${priceLine(p)} · ${stockLine(p)}${inCart ? ` · ${inCart.qty} in basket` : ""}`
        : "Out of stock";
    return { id: `prod|${p.id}`, title: pName(p), description: desc };
  });
  rows.push({
    id: "prod|done",
    title: "🧺 Cart & Checkout",
    description: cart.length ? `${fmtMoney(calcSubtotal(cart))} · Review` : "Finish shopping",
  });
  rows.push({ id: "nav|back", title: "⬅️ Shelves", description: "Categories" });
  rows.push({ id: "home|home", title: "🏠 Main Menu", description: "Start over" });
  const body = `🛍 *${category}*\n\n${note || "Tap a product to see it, then add a quantity."}`;
  return listReply(body, [{ title: String(category).slice(0, 24), rows }]);
}

function qtyMenuReply(product, note) {
  const max = Math.max(1, Math.floor(product.stock));
  const qs = [1, 2, 5].filter((q) => q <= max);
  if (!qs.length) qs.push(1);
  const buttons = qs.slice(0, 2).map((q) => ({ id: `qty|${q}`, title: `🛒 Add ${q} ${product.unit}` }));
  buttons.push({ id: "qty|custom", title: "✏️ Custom qty" });
  const opts = {};
  const img = String(product.image || "").trim();
  if (img) opts.headerImage = img;
  const body =
    (note ? note + "\n\n" : "") +
    `*${pName(product)}*\n${priceLine(product)}\n\n` +
    `${stockLine(product)}\n` +
    "How many do you want? 👇";
  return buttonReply(body, buttons, opts);
}

function qtyEditMenuReply(product, currentQty) {
  const max = Math.max(1, Math.floor(product.stock));
  const qs = [1, 2, 5].filter((q) => q <= max && q !== currentQty);
  if (!qs.length) qs.push(currentQty > 1 ? currentQty - 1 : 1);
  const buttons = qs.slice(0, 2).map((q) => ({ id: `qty|${q}`, title: `${q} ${product.unit}` }));
  buttons.push({ id: "qty|custom", title: "✏️ Custom" });
  const opts = {};
  const img = String(product.image || "").trim();
  if (img) opts.headerImage = img;
  return buttonReply(
    `*${pName(product)}*\n${priceLine(product)}\n\nSet quantity (current ${currentQty} ${product.unit}):`,
    buttons,
    opts
  );
}

/* ------------------------------------------------------------------ */
/* Cart / receipt                                                     */
/* ------------------------------------------------------------------ */

function receiptBlock(s, includeAddress) {
  const sub = calcSubtotal(s.cart);
  const del = deliveryFee();
  const lines = [];
  if (!s.cart.length) {
    lines.push("Your cart is empty.");
    lines.push("");
    lines.push("Subtotal " + fmtMoney(0));
    lines.push("Delivery " + fmtMoney(del));
    lines.push("*Total   " + fmtMoney(del) + "*");
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
  if (includeAddress) {
    lines.push("");
    lines.push(
      s.lat && s.lng
        ? `📍 https://maps.google.com/maps?q=${s.lat},${s.lng}`
        : `📍 ${s.address || "Pending"}`
    );
  }
  return lines.join("\n");
}

function cartSummaryText(s) {
  return `🛒 *Your Cart*\n\n${receiptBlock(s)}`;
}

function cartMenuReply(s) {
  let buttons;
  if (s.cart && s.cart.length) {
    buttons = [
      { id: "cart|more", title: "🛒 Add More" },
      { id: "cart|checkout", title: "✅ Checkout" },
      { id: "cart|edit", title: "✏️ Edit" },
    ];
  } else {
    buttons = [
      { id: "cart|more", title: "🛒 Start Shopping" },
      { id: "home|home", title: "🏠 Main Menu" },
    ];
  }
  return buttonReply(cartSummaryText(s), buttons, { headerText: "🧺 Your Cart" });
}

function changeQtyMenuReply(s) {
  if (!s.cart.length) {
    s.state = "cart";
    return cartMenuReply(s);
  }
  const rows = s.cart.slice(0, 6).map((c, i) => ({
    id: `cq|${i}`,
    title: `${String(c.item || "").slice(0, 17)} · ${c.qty}`,
    description: `${fmtMoney(c.subtotal)} · change`,
  }));
  rows.push({ id: "cart|edit", title: "🗑 Remove Item", description: "Pick what to remove" });
  rows.push({ id: "cart|clear", title: "🧹 Clear Cart", description: "Empty the basket" });
  rows.push({ id: "nav|back", title: "⬅️ Back", description: "Cart" });
  return listReply("🔢 *Change Quantity*\n\nSelect an item to adjust:", [
    { title: "In your basket", rows },
  ]);
}

function removeItemMenuReply(s) {
  const rows = s.cart.slice(0, 7).map((c, i) => ({
    id: `rm|${i}`,
    title: `${String(c.item || "").slice(0, 18)} · ${c.qty}`,
    description: `Remove · ${fmtMoney(c.subtotal)}`,
  }));
  rows.push({ id: "nav|back", title: "⬅️ Back", description: "Cart" });
  return listReply("✏️ *Edit Cart*\n\nSelect the item to remove:", [
    { title: "Items", rows },
  ]);
}

/* ------------------------------------------------------------------ */
/* Checkout                                                           */
/* ------------------------------------------------------------------ */

function namePrompt() {
  return textReply("👤 *Your Name*\n\nType your full name for the bill & delivery.\n_Example: Selva_");
}

function addressPrompt(from, retry) {
  const saved = savedAddresses[from];
  return textReply(
    (retry ? "⚠️ We need a delivery address to continue.\n\n" : "") +
      "📍 *Delivery Address*\n\n" +
      "1️⃣ Attach a 📍 location in the chat\n" +
      "2️⃣ Type your full address (house, street, area, city)\n" +
      (saved ? `3️⃣ Reply *saved* to reuse: ${saved}` : "3️⃣ Reply *saved* to reuse your last address")
  );
}

function paymentMenuReply() {
  return buttonReply("💳 *Payment*\n\nHow do you want to pay?", [
    { id: "pay|cod", title: "💵 Cash on Delivery" },
    { id: "pay|online", title: "📲 UPI / Online" },
    { id: "nav|back", title: "⬅️ Address" },
  ]);
}

function onlinePaymentReply(s) {
  const total = calcSubtotal(s.cart) + deliveryFee();
  let msg = `💳 *UPI / Online Payment*\n\nOrder Amount: ${fmtMoney(total)}\n\n`;
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
  msg += "Pay now, then tap *Done - Continue*. We'll verify before confirming your order.";
  return listReply(msg, [
    {
      title: "Payment",
      rows: [
        { id: "pay|review", title: "✅ Done - Continue", description: "Go to review" },
        { id: "pay|back", title: "💵 Switch to Cash", description: "On delivery" },
      ],
    },
  ]);
}

function reviewMenuReply(s) {
  const lines = [];
  lines.push(`📍 Deliver to:\n${s.lat && s.lng ? `https://maps.google.com/maps?q=${s.lat},${s.lng}` : s.address || "Pending"}`);
  lines.push("");
  lines.push(`💳 Pay: ${s.payment_method === "online" ? "Online (UPI)" : "Cash on Delivery"}`);
  lines.push("");
  lines.push("Press *Confirm Order* to place your order.");
  return buttonReply(`🧾 *Order Summary*\n\n${receiptBlock(s)}\n\n${lines.join("\n")}`, [
    { id: "rev|confirm", title: "✅ Confirm Order" },
    { id: "rev|edit", title: "✏️ Edit Order" },
    { id: "rev|cancel", title: "❌ Cancel" },
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

/* ------------------------------------------------------------------ */
/* Tracking                                                           */
/* ------------------------------------------------------------------ */

const TIMELINE_STEPS = [
  { key: "received", label: "Order Placed" },
  { key: "confirmed", label: "Confirmed" },
  { key: "preparing", label: "Preparing" },
  { key: "out_for_delivery", label: "Out for Delivery" },
  { key: "delivered", label: "Delivered" },
];

function statusBar(status) {
  if (status === "cancelled") return "✕ — — — —";
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
  received: "We're confirming your order.",
  confirmed: "Getting ready in-store.",
  preparing: "Being packed fresh.",
  out_for_delivery: "On the way to you!",
  delivered: "Enjoy!",
  cancelled: "This order was cancelled.",
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
    `📦 *Order #${order.id}*\nPlaced: ${fmtPlaced(order)}\n\n` +
    (items ? `🛍 ${items}\n\n` : "") +
    `Subtotal ${fmtMoney(order.subtotal)} · Delivery ${fmtMoney(order.deliveryFee)}\n*Total ${fmtMoney(order.total)}*\n💳 ${paymentLabel(order)}\n🏍 ETA ~30–45 min\n\n` +
    `*Progress*\n${statusBar(order.status)}\n${statusTimeline(order.status)}\n\n` +
    `_Next step:_ ${hint}`
  );
}

function trackReply(s, from) {
  const order = orders.findActiveByWa(from);
  if (!order) {
    return listReply("📦 *Order Status*\n\nYou don't have an active order right now.\nPlace a new order to get started!", [
      { title: "Track", rows: [
        { id: "home|shop", title: "🛍 Shop Groceries", description: "Start shopping" },
        { id: "home|home", title: "🏠 Main Menu", description: "Go home" },
      ] },
    ]);
  }
  s.current_order_id = order.id;
  return listReply(trackBody(order), [
    { title: "Track", rows: [
      { id: "trk|refresh", title: "🔄 Refresh Status", description: "Get latest" },
      { id: "home|home", title: "🏠 Main Menu", description: "Go home" },
    ] },
  ]);
}

function myOrdersReply(s, from) {
  const recent = orders.findByWa(from, 8);
  if (!recent.length) {
    return listReply("🧾 *My Orders*\n\nYou haven't placed any orders yet.", [
      { title: "Orders", rows: [
        { id: "home|shop", title: "🛍 Shop Groceries", description: "Start shopping" },
        { id: "home|home", title: "🏠 Main Menu", description: "Go home" },
      ] },
    ]);
  }
  const rows = recent.map((o, i) => ({
    id: `ord|${i}`,
    title: o.id,
    description: `${fmtMoney(o.total)} · ${orders.STATUS_LABEL[o.status]}`,
  }));
  rows.push({ id: "home|home", title: "🏠 Main Menu", description: "Go home" });
  return listReply("🧾 *My Orders*\n\nSelect an order:", [
    { title: "Recent Orders", rows },
  ]);
}

function orderDetailReply(order) {
  const body =
    `🧾 *Order #${order.id}*\n\n` +
    `Placed: ${fmtPlaced(order)}\n\n` +
    `${itemsBlock(order)}\n\n` +
    `${summaryBlock(order)}\n\n` +
    `💳 ${paymentLabel(order)}\n📍 ${safeDeliveryLabel(order)}\n\n` +
    `*Progress*\n${statusBar(order.status)}\n${statusTimeline(order.status)}\n\n` +
    `_Next step:_ ${STATUS_HINT[order.status] || ""}`;
  return listReply(body, [
    { title: "Order", rows: [
      { id: "detail|refresh", title: "🔄 Refresh Status", description: "Get latest" },
      { id: "home|home", title: "🏠 Main Menu", description: "Go home" },
    ] },
  ]);
}

/* ------------------------------------------------------------------ */
/* Session management                                                 */
/* ------------------------------------------------------------------ */

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
      pending_order: null,
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
    pending_order: null,
    selected_key: null,
    category: null,
  });
  touch(s);
}

function goBack(s, from) {
  switch (s.state) {
    case "product": {
      s.state = "category";
      return categoryMenuReply(s);
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
      return categoryMenuReply(s);
    }
    case "remove_item": {
      s.state = "cart";
      return cartMenuReply(s);
    }
    case "address": {
      s.state = "cart";
      return cartMenuReply(s);
    }
    case "name": {
      s.state = "address";
      return addressPrompt(from);
    }
    case "payment": {
      s.state = "name";
      return namePrompt();
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

/* ------------------------------------------------------------------ */
/* Text command router (typed words)                                  */
/* ------------------------------------------------------------------ */

const ACTION_KEYWORDS = {
  "menu": "home", "home": "home", "main": "home", "welcome": "home", "start": "home",
  "hi": "home", "hello": "home", "hey": "home", "hai": "home", "vanakkam": "home", "namaste": "home", "hii": "home", "yo": "home",
  "shop": "shop", "shopping": "shop", "grocery": "shop", "groceries": "shop", "store": "shop", "browse": "shop",
  "track": "track", "tracking": "track", "status": "track", "where": "track",
  "orders": "orders", "history": "orders",
  "cart": "cart", "basket": "cart", "bag": "cart",
  "checkout": "checkout", "place order": "checkout",
  "help": "help", "support": "help",
  "offers": "offers", "offer": "offers", "deals": "offers", "combos": "offers", "promo": "offers",
};

const CATEGORY_ALIASES = {
  "dal": "Dal & Pulses", "dals": "Dal & Pulses", "dal & pulses": "Dal & Pulses",
  "oil": "Cooking Oil", "oils": "Cooking Oil",
  "essential": "Grocery Essentials", "essentials": "Grocery Essentials", "staples": "Grocery Essentials",
  "flour": "Flour & Atta", "atta": "Flour & Atta", "aata": "Flour & Atta",
  "dairy": "Dairy", "beverage": "Beverages", "beverages": "Beverages",
  "rice": "Rice", "grains": "Rice", "grain": "Rice",
};

/* Returns a directive {kind, value} or null. */
function routeText(typed, s) {
  const text = String(typed || "").trim().toLowerCase();
  if (!text) return null;

  const direct = ACTION_KEYWORDS[text];
  if (direct) return { kind: direct };

  /* exact product match */
  const exactProduct = products.getAllProducts().find((p) => p.item.toLowerCase() === text);
  if (exactProduct) return { kind: "product", product: exactProduct };

  /* exact category match */
  const cats = products.getCategories();
  const exactCat = cats.find((c) => c.toLowerCase() === text);
  if (exactCat) return { kind: "category", value: exactCat };

  /* alias */
  if (CATEGORY_ALIASES[text]) {
    const cat = CATEGORY_ALIASES[text];
    if (cats.includes(cat)) return { kind: "category", value: cat };
  }

  /* fuzzy, only for real words (>=3 chars) and not too generic */
  if (text.length >= 3) {
    const fuzzyProduct = products
      .getAllProducts()
      .find((p) => p.item.toLowerCase().includes(text));
    if (fuzzyProduct) return { kind: "product", product: fuzzyProduct };
    const fuzzyCat = cats.find((c) => c.toLowerCase().includes(text));
    if (fuzzyCat) return { kind: "category", value: fuzzyCat };
  }

  return null;
}

/* ------------------------------------------------------------------ */
/* Main message handler                                               */
/* ------------------------------------------------------------------ */

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
  const selected = replyId;
  const s = getSession(from);
  touch(s);

  const typed = String(input).trim().toLowerCase();
  const navHome = selected === "home";
  const navBack = selected === "back";

  if (typed === "help" || selected === "help") {
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

  /* Post-delivery review actions */
  if (selected === "feedback") {
    return [shopIntroReply(), { type: "cta", body: "✨ *Feedback*\n\nTell us how we did — 60 seconds, big help!\n\n_Your rating keeps your groceries & deliveries great._", buttons: [{ id: "cta|review", title: "⭐ Give Feedback", url: webUrl("/review") }] }];
  }
  if (selected === "shopagain") {
    return [shopIntroReply(), shopCtaReply(from)];
  }

  if (selected === "shop") {
    return [shopIntroReply(), shopCtaReply(from)];
  }
  if (selected === "track") {
    s.state = "track";
    return trackReply(s, from);
  }
  if (selected === "orders") {
    s.state = "my_orders";
    return myOrdersReply(s, from);
  }
  if (selected === "cart-view") {
    s.state = "cart";
    return cartMenuReply(s);
  }

  const textStates = ["custom_qty", "custom_qty_change", "name", "address", "web_name", "web_location"];
  const isNumeric = /^\d+$/.test(typed);

  /* Typed text (not a widget tap, not pure numbers, not a free-text field) → try routing */
  if (selected === "" && typed && !textStates.includes(s.state) && !isNumeric) {
    if (GREETINGS.has(typed)) {
      resetToWelcome(s);
      return welcomeSequence();
    }
    const dir = routeText(typed, s);
    if (dir) {
      switch (dir.kind) {
        case "home":
          resetToWelcome(s);
          return mainMenuReply();
        case "help":
          return helpReply();
        case "offers":
          return offersReply();
        case "shop":
          return [shopIntroReply(), shopCtaReply(from)];
        case "track":
          s.state = "track";
          return trackReply(s, from);
        case "orders":
          s.state = "my_orders";
          return myOrdersReply(s, from);
        case "cart":
          s.state = "cart";
          return cartMenuReply(s);
        case "checkout":
          if (s.cart && s.cart.length) {
            s.state = "address";
            return addressPrompt(from);
          }
          s.state = "cart";
          return cartMenuReply(s);
        case "category": {
          s.state = "product";
          s.category = dir.value;
          return productListReply(dir.value, null, s.cart);
        }
        case "product": {
          const p = dir.product;
          if (p.available && p.stock > 0) {
            s.selected_key = `${p.category}.${p.item}`;
            s.state = "qty";
            return qtyMenuReply(p);
          }
          s.state = "product";
          s.category = p.category;
          const note = `Sorry, *${p.item}* is out of stock.\nPlease try another product.`;
          return productListReply(p.category, note, s.cart);
        }
      }
    }
    return fallbackReply(s);
  }

  if (typed === "offers" && !textStates.includes(s.state)) {
    return offersReply();
  }

  switch (s.state) {
    case "welcome": {
      resetToWelcome(s);
      return mainMenuReply();
    }

    case "category": {
      if (selected === "cart-view") {
        s.state = "cart";
        return cartMenuReply(s);
      }
      if (selected && selected.startsWith("cat-")) {
        const category = selected.slice(4);
        if (products.getProductsInCategory(category).length) {
          s.state = "product";
          s.category = category;
          return productListReply(category);
        }
      }
      return categoryMenuReply(s);
    }

    case "product": {
      if (selected === "prod-done") {
        s.state = "cart";
        return cartMenuReply(s);
      }
      if (selected === "cart-view") {
        s.state = "cart";
        return cartMenuReply(s);
      }
      if (selected && selected.startsWith("prod-")) {
        const id = parseInt(selected.slice(5), 10);
        const product = !isNaN(id) ? products.getProductById(id) : null;
        if (!product || product.category !== s.category) {
          // A product outside the current shelf (or a stale tap) → treat sensibly
          if (product) {
            s.category = product.category;
            s.selected_key = `${product.category}.${product.item}`;
            s.state = "qty";
            return qtyMenuReply(product);
          }
          return productListReply(s.category, null, s.cart);
        }
        if (!product.available || product.stock <= 0) {
          return productListReply(
            s.category,
            `Sorry, *${product.item}* is out of stock.\nPlease tap another product.`,
            s.cart
          );
        }
        s.selected_key = `${product.category}.${product.item}`;
        s.state = "qty";
        return qtyMenuReply(product);
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
        return textReply(`✍️ *Custom Quantity*\n\nType the quantity you need — maximum available: ${Math.floor(product.stock)} ${product.unit}.`);
      }
      if (selected && selected.startsWith("qty-")) {
        const q = parseInt(selected.slice(4), 10);
        if (q > 0 && q <= product.stock) {
          return addToCart(s, product, q);
        }
        return textReply(`Sorry, only *${Math.floor(product.stock)}* available.\nPlease choose a smaller quantity.`);
      }
      if (!selected && isNumeric) {
        const q = parseInt(typed, 10);
        if (q > 0 && q <= product.stock) return addToCart(s, product, q);
        return textReply(`Sorry, only ${Math.floor(product.stock)} available. Please type a smaller quantity.`);
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
        return textReply(`✍️ Please type a number (example: 3). Maximum available: ${Math.floor(product.stock)}.`);
      }
      if (q > product.stock) {
        return textReply(`Sorry, only *${Math.floor(product.stock)}* in stock. Please type ${Math.floor(product.stock)} or less.`);
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
        return textReply(`✍️ *Custom Quantity*\n\nType the new quantity — maximum available: ${Math.floor(product.stock)} ${product.unit}.`);
      }
      if (selected && selected.startsWith("qty-")) {
        const q = parseInt(selected.slice(4), 10);
        if (q > 0 && q <= product.stock) {
          applyQtyChange(s, q, productPrice(product));
          s.state = "cart";
          return cartMenuReply(s);
        }
        return textReply(`Sorry, only ${Math.floor(product.stock)} available.`);
      }
      if (!selected && isNumeric) {
        const q = parseInt(typed, 10);
        if (q > 0 && q <= product.stock) {
          applyQtyChange(s, q, productPrice(product));
          s.state = "cart";
          return cartMenuReply(s);
        }
        return textReply(`Sorry, only ${Math.floor(product.stock)} available.`);
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
        return textReply(`✍️ Please type a valid number (1-${Math.floor(product.stock)}):`);
      }
      applyQtyChange(s, q, productPrice(product));
      s.state = "cart";
      return cartMenuReply(s);
    }

    case "cart": {
      if (selected === "cart-more") {
        s.state = "category";
        return categoryMenuReply(s);
      }
      if (selected === "cart-qty") {
        s.state = "qty_change";
        s.qty_edit_idx = -1;
        return changeQtyMenuReply(s);
      }
      if (selected === "cart-checkout") {
        if (!s.cart.length) return cartMenuReply(s);
        s.state = "address";
        return addressPrompt(from);
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
      s.state = "payment";
      return paymentMenuReply();
    }

    case "address": {
      if (payload && payload.kind === "location") {
        const lat = payload.latitude;
        const lng = payload.longitude;
        const label = [payload.address, payload.name].filter(Boolean).join(", ");
        s.address = `📍 ${lat},${lng}${label ? " • " + label : ""}`;
        s.lat = lat;
        s.lng = lng;
        s.state = "name";
        return namePrompt();
      }
      const address = String(input).trim();
      if (address.toLowerCase() === "saved") {
        const saved = savedAddresses[from];
        if (saved) {
          s.address = saved;
          s.lat = null;
          s.lng = null;
          s.state = "name";
          return namePrompt();
        }
        return addressPrompt(from, true);
      }
      if (address.length < 5) {
        return addressPrompt(from, true);
      }
      s.address = address;
      savedAddresses[from] = address;
      s.state = "name";
      return namePrompt();
    }

    case "web_location": {
      const orderNo = s.pending_order;
      const order = orderNo ? orders.findById(orderNo) : null;
      if (!order || order.paymentStatus !== "Paid") {
        resetToWelcome(s);
        return mainMenuReply();
      }
      if (payload && payload.kind === "location") {
        const lat = payload.latitude;
        const lng = payload.longitude;
        const label = [payload.address, payload.name].filter(Boolean).join(", ");
        db.updateOrder(orderNo, {
          address: `📍 ${lat},${lng}${label ? " • " + label : ""}`,
          lat,
          lng,
        });
        s.state = "web_name";
        return namePrompt();
      }
      const address = String(input).trim();
      if (address.toLowerCase() === "saved") {
        const saved = savedAddresses[from];
        if (saved) {
          db.updateOrder(orderNo, { address: saved, lat: null, lng: null });
          s.state = "web_name";
          return namePrompt();
        }
        return addressPrompt(from, true);
      }
      if (address.length < 5) {
        return addressPrompt(from, true);
      }
      db.updateOrder(orderNo, { address, lat: null, lng: null });
      savedAddresses[from] = address;
      s.state = "web_name";
      return namePrompt();
    }

    case "web_name": {
      const orderNo = s.pending_order;
      const order = orderNo ? orders.findById(orderNo) : null;
      if (!order || order.paymentStatus !== "Paid") {
        resetToWelcome(s);
        return mainMenuReply();
      }
      const name = String(input).trim();
      if (name.length < 2) {
        return textReply("👤 Please type your full name.\nExample: Selva");
      }
      db.updateOrder(orderNo, { name });
      try {
        db.upsertCustomer(from, name);
      } catch (e) {
        /* keep order-confirm unaffected */
      }
      s.customer_name = name;
      s.state = "welcome";
      s.pending_order = null;
      return webConfirmReply(s, from, orders.findById(orderNo));
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
  const price = productPrice(product);
  const subtotal = price * q;
  const key = `${product.category}.${product.item}`;
  const existing = s.cart.find((c) => c.key === key);
  if (existing) {
    existing.qty += q;
    existing.subtotal = existing.price * existing.qty;
  } else {
    s.cart.push({
      key,
      item: product.item,
      unit: product.unit,
      qty: q,
      price,
      subtotal,
    });
  }
  s.state = "product";
  return productListReply(
    product.category,
    `✅ Added: *${product.item}* ×${q} (${fmtMoney(price)})\nCart subtotal: ${fmtMoney(calcSubtotal(s.cart))}\n\nTap another product or press "Cart & Checkout" when you are done.`,
    s.cart
  );
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
          { id: "cart|edit", title: "✏️ Edit Cart", description: "Fix quantities" },
          { id: "cart|checkout", title: "✅ Checkout", description: "Retry" },
          { id: "home|home", title: "🏠 Main Menu", description: "Go home" },
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
    `Track it anytime with 📦 *Track Order* — or type “track”. Thank you for choosing ZIPRA 🧡`;

  return textReply(msg);
}

/* ------------------------------------------------------------------ */
/* Web order flow: payment verified in the app → delivery capture     */
/* ------------------------------------------------------------------ */

function webConfirmReply(s, from, order) {
  const items = (order.items || [])
    .map((c) => `${c.item} × ${c.qty} ${c.unit} — ${fmtMoney(c.subtotal)}`)
    .join("\n");
  const deliveryLine =
    order.lat && order.lng
      ? `https://maps.google.com/maps?q=${order.lat},${order.lng}`
      : String(order.address || "Shared during checkout").replace(/^📍 /, "");
  const body =
    `🛍 *ZIPRA ORDER CONFIRMED*\n\n` +
    `Order #${order.id}\n\n` +
    (order.name ? `👤 *Customer:*\n${order.name}\n\n` : "") +
    `🛒 *Items:*\n${items}\n\n` +
    `Subtotal: ${fmtMoney(order.subtotal)}\n` +
    `Delivery: ${fmtMoney(order.deliveryFee)}\n` +
    `*Total: ${fmtMoney(order.total)}*\n\n` +
    `📍 *Delivery:*\n${deliveryLine}\n\n` +
    `💳 *Payment:*\nPaid Online ✅\n\n` +
    `🟢 *Status:* Order Confirmed\n\n` +
    `Your order has been received successfully.\nWe'll keep you updated here. 🧡`;
  return buttonReply(body, [
    { id: "home|track", title: "📦 Track Order" },
    { id: "home|home", title: "🏠 Main Menu" },
  ]);
}

/* Called by the server once the payment webhook confirms success. */
function beginWebDeliveryCapture(from, orderNo) {
  const order = orders.findById(orderNo);
  const s = getSession(from);
  touch(s);
  if (!order || order.paymentStatus !== "Paid") {
    resetToWelcome(s);
    return [];
  }
  s.pending_order = orderNo;
  s.cart = [];
  s.state = "web_location";
  return [
    textReply(
      `✅ *Payment Successful*\n\nPayment of *${fmtMoney(order.total)}* for Order #${order.id} confirmed.\n\nNow let's set up your delivery 🛵`
    ),
    addressPrompt(from),
  ];
}

function flattenReply(reply) {
  if (reply.type === "text") return reply.text;
  if (reply.type === "image") return reply.body || "";
  if (reply.type === "cta") {
    return (reply.body || "") + " " + (reply.buttons || []).map((b) => b.title + " " + b.url).join(" ");
  }
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
  const due = [];
  for (const from of Object.keys(stores)) {
    if (now - (stores[from].updated_at || 0) > SESSION_TIMEOUT_MS) {
      due.push({ from, text: timeoutText() });
      delete stores[from];
    }
  }
  return due;
}

module.exports = {
  handleMessage,
  flattenReply,
  sessions: stores,
  cleanupExpiredSessions,
  welcomeSequence,
  welcomeImageUrl,
  deliveryReviewReply,
  beginWebDeliveryCapture,
  webUrl,
  WEB_APP_URL,
};