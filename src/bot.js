const orders = require("./orders");
const products = require("./products");
const db = require("./db");

const DEFAULT_DELIVERY_FEE = parseInt(process.env.DELIVERY_FEE || "30", 10);
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || "300000", 10);

function deliveryFee() {
  return db.deliveryFee();
}

const stores = {};

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
      "🛒 Welcome to ZIPRA\n\nFresh Groceries. Faster Deliveries.\n\nHow can we help you today?\n\n(Type 'help' for assistance)",
    [
      { id: "home|shop", title: "🛍 Place Order" },
      { id: "home|track", title: "📦 Order Status" },
      { id: "home|orders", title: "🧾 My Orders" },
    ]
  );
}

function categoryMenuReply() {
  const rows = products.getCategories().map((c) => {
    const avail = products.getProductsInCategory(c).filter((p) => p.available).length;
    return { id: `cat|${c}`, title: `${categoryEmoji(c)} ${c}`, description: `${avail} product${avail === 1 ? "" : "s"}` };
  });
  rows.push({ id: "nav|back", title: "⬅️ Back", description: "Main Menu" });
  rows.push({ id: "nav|home", title: "🏠 Main Menu", description: "Go home" });
  return listReply("🛍 *Shop Groceries*\n\nChoose a category to start shopping:", [
    { title: "Categories", rows },
  ]);
}

const PRODUCT_EMOJI = {
  "Ponni Rice": "🍚",
  "India Gate Basmati Rice": "🍚",
  "Idly Rice": "🌾",
  "Toor Dal": "🫘",
  "Moong Dal": "🫘",
  "Chana Dal": "🫘",
  "Fortune Sunflower Oil": "🌻",
  "Groundnut Oil": "🥜",
  "Tata Salt": "🧂",
  "Aashirvaad Sugar": "🍬",
  "Parle-G": "🍪",
  "Oreo": "🍪",
  "Aashirvaad Atta": "🌾",
  "Rice Flour": "🌾",
  "Tata Tea": "🍵",
  "Bru Coffee": "☕",
  "Aavin Milk": "🥛",
  "Milk Curd": "🍶",
  "Fresh Paneer": "🧀",
};

function productEmoji(item, category) {
  return PRODUCT_EMOJI[item] || categoryEmoji(category) || "🛒";
}

function productLabel(item, category) {
  const emoji = productEmoji(item, category);
  const base = `${emoji} ${item}`;
  if (base.length <= 24) return base;
  const room = 24 - emoji.length - 1;
  return `${emoji} ${item.slice(0, Math.max(0, room - 1))}…`;
}

async function productListReply(category, note) {
  const rows = products.getProductsInCategory(category).slice(0, 7).map((p, i) => ({
    id: `prod|${i + 1}`,
    title: productLabel(p.item, category),
    description: p.available ? `₹${p.price}/${p.unit} • Available` : "Out of stock",
  }));
  rows.push({ id: "prod|done", title: "Cart & Checkout", description: "✅ Finish shopping" });
  rows.push({ id: "nav|back", title: "⬅️ Back", description: "Categories" });
  rows.push({ id: "nav|home", title: "🏠 Main Menu", description: "Go home" });
  const body = `🛍 *${category}*\n\n${note || "Tap a product to add it, then press Cart & Checkout when done."}`;
  return listReply(body, [{ title: category, rows }]);
}

function categoryEmoji(category) {
  const map = {
    Rice: "🍚",
    "Dal & Pulses": "🫘",
    "Cooking Oil": "🛢️",
    "Grocery Essentials": "🧂",
    "Flour & Atta": "🌾",
    Beverages: "🥤",
    Dairy: "🥛",
  };
  return map[category] || "🛒";
}

function qtyMenuReply(product) {
  const max = Math.max(1, product.stock);
  const qs = [1, 2, 5].filter((q) => q <= max);
  if (!qs.length) qs.push(1);
  const buttons = qs.map((q) => ({ id: `qty|${q}`, title: `${q} ${product.unit}` }));
  return buttonReply(
    `🛒 *${product.item}*\n\n💰 ₹${product.price} / ${product.unit}\n\nHow much would you like?\n(Tap a size, or type any quantity like 3)`,
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
    title: `${(c.item || "").slice(0, 18)} × ${c.qty}`,
    description: `Current qty • ₹${c.subtotal}`,
  }));
  rows.push({ id: "cart|edit", title: "🗑 Remove Item", description: "Pick what to remove" });
  rows.push({ id: "cart|clear", title: "❌ Clear Cart", description: "Empty the cart" });
  rows.push({ id: "nav|back", title: "⬅️ Back", description: "Cart" });
  rows.push({ id: "nav|home", title: "🏠 Main Menu", description: "Go home" });
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
    `🔢 *${product.item}* — current ${currentQty} ${product.unit}\n\n💰 Total = quantity × ₹${product.price}\n\nTap a size, or type any quantity:`,
    buttons
  );
}

function fmtMoney(n) {
  return `₹${n}`;
}

function cartSummaryText(s) {
  let msg = "🛒 *Your Cart*\n\n";
  if (!s.cart.length) {
    msg += "Your cart is empty.\n\n" + `Subtotal: ${fmtMoney(0)}\nDelivery: ${fmtMoney(deliveryFee())}\nTotal: ${fmtMoney(deliveryFee())}`;
    return msg;
  }
  s.cart.forEach((c) => {
    msg += `${c.item} × ${c.qty} ${c.unit} = ${fmtMoney(c.subtotal)}\n`;
  });
  const subtotal = calcSubtotal(s.cart);
  msg += `\n────────────\nSubtotal: ${fmtMoney(subtotal)}\nDelivery: ${fmtMoney(deliveryFee())}\n*Total: ${fmtMoney(subtotal + deliveryFee())}*`;
  return msg;
}

function calcSubtotal(cart) {
  return cart.reduce((sum, c) => sum + c.subtotal, 0);
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
    title: `${(c.item || "").slice(0, 18)} × ${c.qty}`,
    description: `Remove • ${fmtMoney(c.subtotal)}`,
  }));
  rows.push({ id: "nav|back", title: "⬅️ Back", description: "Cart" });
  rows.push({ id: "nav|home", title: "🏠 Main Menu", description: "Go home" });
  return listReply("✏️ *Edit Cart*\n\nSelect the item you want to remove:", [
    { title: "Items", rows },
  ]);
}

function paymentMenuReply() {
  return buttonReply("💳 *Payment Method*\n\nHow would you like to pay?", [
    { id: "pay|cod", title: "Cash on Delivery" },
    { id: "pay|online", title: "💰 Online Payment" },
    { id: "nav|back", title: "⬅️ Back" },
  ]);
}

function reviewText(s) {
  const subtotal = calcSubtotal(s.cart);
  const total = subtotal + deliveryFee();
  let msg = "📦 *Order Summary*\n\n";
  s.cart.forEach((c) => {
    msg += `${c.item} × ${c.qty} ${c.unit} = ${fmtMoney(c.subtotal)}\n`;
  });
  msg += `\nSubtotal: ${fmtMoney(subtotal)}\nDelivery: ${fmtMoney(deliveryFee())}\n*Total: ${fmtMoney(total)}*\n\n`;
  msg +=
    s.lat && s.lng
      ? `📍 Delivery (location):\nhttps://maps.google.com/maps?q=${s.lat},${s.lng}\n\n`
      : `📍 Delivery:\n${s.address || "Pending"}\n\n`;
  msg += `💳 Payment:\n${s.payment_method === "online" ? "Online Payment" : "Cash on Delivery"}\n\nPress Confirm to place your order.`;
  return msg;
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

function statusTimeline(status) {
  const steps = [
    { key: "received", label: "Received", cur: "🕐" },
    { key: "confirmed", label: "Confirmed", cur: "✅" },
    { key: "preparing", label: "Preparing", cur: "👨‍🍳" },
    { key: "out_for_delivery", label: "Out for Delivery", cur: "🛵" },
    { key: "delivered", label: "Delivered", cur: "🎉" },
  ];
  const idx = steps.findIndex((st) => st.key === status);
  const lines = [];
  steps.forEach((st, i) => {
    let icon = "○";
    if (status === "cancelled") {
      icon = i === 0 ? "✖" : "○";
    } else if (i === idx) {
      icon = st.cur;
    } else if (idx >= 0 && i < idx) {
      icon = "✅";
    }
    lines.push(`${icon} ${st.label}`);
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

function trackReply(s, from) {
  const order = orders.findActiveByWa(from);
  if (!order) {
    return listReply("📦 *Order Status*\n\nYou don't have an active order right now.\nPlace a new order to get started!", [
      { title: "Track", rows: [
        { id: "home|shop", title: "🛍 Place Order", description: "Start shopping" },
        { id: "nav|home", title: "🏠 Main Menu", description: "Go home" },
      ] },
    ]);
  }
  s.current_order_id = order.id;
  const body =
    `📦 *Order Status*\n\n` +
    `Order #${order.id}\n` +
    `Placed: ${fmtPlaced(order)}\n\n` +
    `🛍 *Order*\n${itemsBlock(order)}\n\n` +
    `💰 *Summary*\n${summaryBlock(order)}\n\n` +
    `💳 *Payment*\n${paymentLabel(order)}\n\n` +
    `📍 *Delivery Address*\n${safeDeliveryLabel(order)}\n\n` +
    `📦 *Order Progress*\n${statusTimeline(order.status)}\n\n` +
    `*Current Status*\n${STATUS_HINT[order.status] || ""}`;
  return listReply(body, [
    { title: "Track", rows: [
      { id: "trk|refresh", title: "🔄 Refresh Status", description: "Get latest" },
      { id: "nav|back", title: "⬅️ Back", description: "Main Menu" },
      { id: "nav|home", title: "🏠 Main Menu", description: "Go home" },
    ] },
  ]);
}

function myOrdersReply(s, from) {
  const recent = orders.findByWa(from, 8);
  if (!recent.length) {
    return listReply("🧾 *My Orders*\n\nYou haven't placed any orders yet.", [
      { title: "Orders", rows: [
        { id: "home|shop", title: "🛍 Place Order", description: "Start shopping" },
        { id: "nav|home", title: "🏠 Main Menu", description: "Go home" },
      ] },
    ]);
  }
  const rows = recent.map((o, i) => ({
    id: `ord|${i}`,
    title: o.id,
    description: `${fmtMoney(o.total)} • ${orders.STATUS_LABEL[o.status]}`,
  }));
  rows.push({ id: "nav|back", title: "⬅️ Back", description: "Main Menu" });
  rows.push({ id: "nav|home", title: "🏠 Main Menu", description: "Go home" });
  return listReply("🧾 *My Orders*\n\nSelect an order to see its details:", [
    { title: "Recent Orders", rows },
  ]);
}

function orderDetailReply(order) {
  const body =
    `🧾 *Order #${order.id}*\n\n` +
    `Placed: ${fmtPlaced(order)}\n\n` +
    `🛍 *Order*\n${itemsBlock(order)}\n\n` +
    `💰 *Summary*\n${summaryBlock(order)}\n\n` +
    `💳 *Payment*\n${paymentLabel(order)}\n\n` +
    `📍 *Delivery Address*\n${safeDeliveryLabel(order)}\n\n` +
    `📦 *Order Progress*\n${statusTimeline(order.status)}`;
  return listReply(body, [
    { title: "Order", rows: [
      { id: "detail|refresh", title: "🔄 Refresh Status", description: "Get latest" },
      { id: "nav|home", title: "🏠 Main Menu", description: "Go home" },
    ] },
  ]);
}

function helpReply() {
  return textReply(
    "❓ *Help*\n\n" +
      "🛍 Place Order: Choose a category, add products, then checkout.\n" +
      "📦 Order Status: Track your order (Received → Confirmed → Preparing → Out for Delivery → Delivered).\n" +
      "💳 Payment: Cash on Delivery or Online (UPI) payment.\n" +
      "🛵 Delivery: Fresh groceries delivered to your doorstep.\n\n" +
      "Type \"menu\" at any time to return to the Main Menu."
  );
}

function goBack(s) {
  switch (s.state) {
    case "product": {
      s.state = "category";
      return categoryMenuReply();
    }
    case "qty": {
      s.state = "product";
      return productListReply(s.category || "");
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
      return textReply("👤 *Your Details*\n\nWhat's your name? Please type it below.");
    }
    case "payment": {
      s.state = "address";
      return textReply("📍 *Delivery Address*\n\nPlease share a WhatsApp 📍 location or type your full address (house no, street, area, city).");
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
    return goBack(s);
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
        if (!product) return productListReply(s.category);
        if (!product.available || product.stock <= 0) {
          return productListReply(
            s.category,
            `Sorry, *${product.item}* is out of stock.\nPlease tap another product.`
          );
        }
        const added = quickAdd(s, product);
        return productListReply(
          s.category,
          `✅ Added: *${product.item}* ×1 (${fmtMoney(product.price)})\nCart subtotal: ${fmtMoney(calcSubtotal(s.cart))}\n\nTap another product or press "Cart & Checkout" when you are done.`
        );
      }
      return productListReply(s.category);
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
        return textReply("📦 *Checkout*\n\nPlease enter your name.");
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
        return textReply("📦 Please type your full name (example: Selva).");
      }
      s.customer_name = name;
      s.state = "address";
      return textReply("📍 *Delivery Address*\n\nPlease share your delivery location:\n\n📎 Option 1: Send a WhatsApp 📍 location\n✏️ Option 2: Type your full address (house no, street, area, city)");
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
      if (address.length < 5) {
        return textReply("📍 *Delivery Address*\n\nPlease share your delivery location:\n\n📎 Option 1: Send a WhatsApp 📍 location\n✏️ Option 2: Type your full address (house no, street, area, city)");
      }
      s.address = address;
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
        return textReply("👤 *Edit Order*\n\nType your name below (or type 'menu' for the Main Menu):");
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
    `✅ *Order Confirmed!*\n\n🧾 Order #${order.id}\n\n` +
    `🛍 *Items*\n` +
    order.items.map((c) => `${c.item} × ${c.qty} ${c.unit}`).join("\n") +
    `\n\n💰 *Total*\n₹${order.total}\n\n` +
    `📍 *Delivery*\n${deliveryLine}\n\n` +
    `💳 *Payment*\n${order.paymentMethod === "online" ? "Online Payment" : "Cash on Delivery"}\n\n` +
    `We'll keep you updated here.\nThank you for choosing ZIPRA 🧡`;

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