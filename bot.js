const orders = require("./orders");
const products = require("./products");

const DELIVERY_FEE = parseInt(process.env.DELIVERY_FEE || "30", 10);
const SESSION_TIMEOUT_MS = parseInt(process.env.SESSION_TIMEOUT_MS || "300000", 10);

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

function mainMenuReply() {
  return listReply(
    "👋 Welcome to Zipra!\n\nFresh groceries delivered to your doorstep.\n\nChoose an option:",
    [{ title: "Main Menu", rows: [
      { id: "home|shop", title: "Shop Groceries", description: "🛒 Order fresh groceries" },
      { id: "home|track", title: "Track My Order", description: "📦 Live order status" },
      { id: "home|orders", title: "My Orders", description: "🧾 Past order details" },
      { id: "home|help", title: "Help", description: "❓ How it works" },
    ] }]
  );
}

function categoryMenuReply() {
  const rows = products.getCategories().map((c) => {
    const avail = products.getProductsInCategory(c).filter((p) => p.available).length;
    return { id: `cat|${c}`, title: c, description: `${avail} items available` };
  });
  rows.push({ id: "nav|home", title: "Main Menu", description: "🏠" });
  return listReply("🛒 *Shop by Category*\n\nSelect a category to start shopping:", [
    { title: "Categories", rows },
  ]);
}

function productListReply(category, note) {
  const rows = products.getProductsInCategory(category).map((p, i) => ({
    id: `prod|${i + 1}`,
    title: p.item,
    description: p.available ? `₹${p.price}/${p.unit} • Stock ${p.stock}` : "Out of stock",
  }));
  rows.push({ id: "prod|done", title: "Done - Cart & Checkout", description: "✅ Finish shopping" });
  rows.push({ id: "nav|back", title: "Back", description: "⬅️" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "🏠" });
  const body = `${categoryEmoji(category)} *${category}*\n\n${note || "Tap any product to add it (×1 each). You can select as many items as you like, then tap 'Done - Cart & Checkout' when you're ready.\n(To change quantities, use 'Change Quantity' in the cart)"}\n`;
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
  const typical = [1, 2, 5].filter((q) => q <= max);
  const rows = typical.map((q) => ({
    id: `qty|${q}`,
    title: `${q} ${product.unit}`,
    description: `Total ₹${product.price * q}`,
  }));
  rows.push({ id: "qty|custom", title: "Custom Quantity", description: "Type your own quantity" });
  rows.push({ id: "nav|back", title: "Back", description: "⬅️" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "🏠" });
  return listReply(
    `🛒 *${product.item}*\n\nPrice: *₹${product.price} / ${product.unit}*\nStock: *${product.stock} ${product.unit}*\n\nSelect a quantity:`,
    [{ title: "Quantity", rows }]
  );
}

function changeQtyMenuReply(s) {
  if (!s.cart.length) {
    s.state = "cart";
    return cartMenuReply(s);
  }
  const rows = s.cart.map((c, i) => ({
    id: `cq|${i}`,
    title: `${c.item} × ${c.qty}`,
    description: `Change qty • ₹${c.subtotal}`,
  }));
  rows.push({ id: "nav|back", title: "Back", description: "⬅️" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "🏠" });
  return listReply("🔢 *Change Quantity*\n\nSelect the item whose quantity you want to change:", [
    { title: "Items", rows },
  ]);
}

function qtyEditMenuReply(product, currentQty) {
  const max = Math.max(1, product.stock);
  const typical = [1, 2, 5].filter((q) => q <= max && q !== currentQty);
  const rows = typical.map((q) => ({
    id: `qty|${q}`,
    title: `${q} ${product.unit}`,
    description: `Total ₹${product.price * q}`,
  }));
  rows.push({ id: "qty|custom", title: "Custom Quantity", description: "Type your own quantity" });
  rows.push({ id: "nav|back", title: "Back", description: "⬅️" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "🏠" });
  return listReply(
    `🔢 *${product.item}* (current ${currentQty} ${product.unit})\n\nSelect a new quantity:`,
    [{ title: "Quantity", rows }]
  );
}

function fmtMoney(n) {
  return `₹${n}`;
}

function cartSummaryText(s) {
  let msg = "🛒 *Your Cart*\n\n";
  if (!s.cart.length) {
    msg += "Your cart is empty 🙂\n\n" + `Subtotal: ${fmtMoney(0)}\nDelivery: ${fmtMoney(DELIVERY_FEE)}\nTotal: ${fmtMoney(DELIVERY_FEE)}`;
    return msg;
  }
  s.cart.forEach((c) => {
    msg += `${c.item} × ${c.qty}\n${fmtMoney(c.subtotal)}\n`;
  });
  const subtotal = calcSubtotal(s.cart);
  msg += `\nSubtotal: ${fmtMoney(subtotal)}\nDelivery: ${fmtMoney(DELIVERY_FEE)}\n*Total: ${fmtMoney(subtotal + DELIVERY_FEE)}*`;
  return msg;
}

function calcSubtotal(cart) {
  return cart.reduce((sum, c) => sum + c.subtotal, 0);
}

function cartMenuReply(s) {
  const rows = [
    { id: "cart|more", title: "Add More", description: "➕ Continue shopping" },
    { id: "cart|checkout", title: "Checkout", description: "✅ Place order" },
  ];
  if (s.cart.length) {
    rows.push({ id: "cart|qty", title: "Change Quantity", description: "🔢 Adjust amounts" });
    rows.push({ id: "cart|edit", title: "Remove Item", description: "🗑️" });
  }
  rows.push({ id: "cart|clear", title: "Cancel Cart", description: "❌ Empty cart" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "🏠" });
  return listReply(cartSummaryText(s), [{ title: "Cart", rows }]);
}

function removeItemMenuReply(s) {
  const rows = s.cart.map((c, i) => ({
    id: `rm|${i}`,
    title: `${c.item} × ${c.qty}`,
    description: `Remove • ${fmtMoney(c.subtotal)}`,
  }));
  rows.push({ id: "nav|back", title: "Back", description: "⬅️" });
  rows.push({ id: "nav|home", title: "Main Menu", description: "🏠" });
  return listReply("✏️ *Edit Cart*\n\nSelect the item you want to remove:", [
    { title: "Items", rows },
  ]);
}

function paymentMenuReply() {
  return buttonReply("💳 *Payment Method*\n\nHow would you like to pay?", [
    { id: "pay|cod", title: "Cash on Delivery" },
    { id: "pay|online", title: "Online Payment" },
    { id: "nav|back", title: "Back" },
  ]);
}

function reviewText(s) {
  const subtotal = calcSubtotal(s.cart);
  const total = subtotal + DELIVERY_FEE;
  let msg = "🧾 *Review Your Order*\n\n";
  s.cart.forEach((c) => {
    msg += `${c.item} × ${c.qty} — ${fmtMoney(c.subtotal)}\n`;
  });
  msg += `\nSubtotal: ${fmtMoney(subtotal)}\nDelivery: ${fmtMoney(DELIVERY_FEE)}\n*Total: ${fmtMoney(total)}*\n\n`;
  msg +=
    s.lat && s.lng
      ? `📍 Delivery (location):\nhttps://maps.google.com/maps?q=${s.lat},${s.lng}\n\n`
      : `📍 Delivery:\n${s.address || "Pending"}\n\n`;
  msg += `💳 Payment:\n${s.payment_method === "online" ? "Online Payment" : "Cash on Delivery"}`;
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
    deliveryFee: DELIVERY_FEE,
    total: subtotal + DELIVERY_FEE,
    paymentMethod: s.payment_method,
    paymentStatus: s.payment_method === "online" ? "Pending" : "Not Paid",
    status: "received",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
}

function statusTimeline(status) {
  const steps = [
    { key: "received", label: "Order Received", cur: "🟡" },
    { key: "confirmed", label: "Order Confirmed", cur: "✅" },
    { key: "preparing", label: "Preparing", cur: "🟠" },
    { key: "out_for_delivery", label: "Out for Delivery", cur: "🛵" },
    { key: "delivered", label: "Delivered", cur: "🎉" },
  ];
  const idx = steps.findIndex((st) => st.key === status);
  const lines = [];
  steps.forEach((st, i) => {
    let icon = "⚪";
    if (status === "cancelled") {
      icon = i === 0 ? "🔴" : "⚪";
    } else if (i === idx) {
      icon = st.cur;
    } else if (idx >= 0 && i < idx) {
      icon = "✅";
    }
    lines.push(`${icon} ${st.label}`);
    if (i < steps.length - 1) lines.push("↓");
  });
  return lines.join("\n");
}

function trackReply(s, from) {
  const order = orders.findActiveByWa(from);
  if (!order) {
    return listReply("📦 *Track My Order*\n\nNo active order right now. Place a new one from the shop!", [
      { title: "Track", rows: [
        { id: "home|shop", title: "Shop Groceries", description: "🛒" },
        { id: "nav|home", title: "Main Menu", description: "🏠" },
      ] },
    ]);
  }
  s.current_order_id = order.id;
  return listReply(
    `📦 *Order #${order.id}*\n\n${orders.STATUS_LABEL[order.status]}\n\nOrder Total: ${fmtMoney(order.total)}\n\nProgress:\n${statusTimeline(order.status)}`,
    [{ title: "Track", rows: [
      { id: "trk|refresh", title: "Refresh Status", description: "🔄" },
      { id: "nav|home", title: "Main Menu", description: "🏠" },
    ] }]
  );
}

function myOrdersReply(s, from) {
  const recent = orders.findByWa(from, 8);
  if (!recent.length) {
    return listReply("🧾 *My Orders*\n\nYou haven't placed any orders yet.", [
      { title: "Orders", rows: [
        { id: "home|shop", title: "Shop Groceries", description: "🛒" },
        { id: "nav|home", title: "Main Menu", description: "🏠" },
      ] },
    ]);
  }
  const rows = recent.map((o, i) => ({
    id: `ord|${i}`,
    title: o.id,
    description: `${fmtMoney(o.total)} • ${orders.STATUS_LABEL[o.status]}`,
  }));
  rows.push({ id: "nav|home", title: "Main Menu", description: "🏠" });
  return listReply("🧾 *My Orders*\n\nSelect an order to see its details:", [
    { title: "Recent Orders", rows },
  ]);
}

function orderDetailReply(order) {
  let msg = `🧾 *Order #${order.id}*\n\n`;
  order.items.forEach((c) => {
    msg += `${c.item} × ${c.qty} — ${fmtMoney(c.subtotal)}\n`;
  });
  msg += `\nSubtotal: ${fmtMoney(order.subtotal)}\nDelivery: ${fmtMoney(order.deliveryFee)}\n*Total: ${fmtMoney(order.total)}*\n\n`;
  msg += `📍 ${order.address}\n`;
  msg += `💳 ${order.paymentMethod === "online" ? "Online Payment" : "Cash on Delivery"}\n`;
  msg += `Status: ${orders.STATUS_LABEL[order.status]}\n`;
  msg += `\nTimeline:\n${statusTimeline(order.status)}`;
  return listReply(msg, [
    { title: "Order", rows: [
      { id: "detail|refresh", title: "Refresh Status", description: "🔄" },
      { id: "nav|home", title: "Main Menu", description: "🏠" },
    ] },
  ]);
}

function helpReply() {
  return textReply(
    "❓ *Help*\n\n" +
      "🛍️ Shop Groceries: Pick a category and add products to your cart.\n" +
      "📦 Track My Order: Live status (Received → Confirmed → Preparing → Out for Delivery → Delivered).\n" +
      "💳 Payment: Choose Cash on Delivery or Online Payment.\n" +
      "🛵 Delivery: Same-day delivery in your area.\n\n" +
      "Stuck in a multi-step order? Type 'menu' or go back to the Main Menu and select Shop Groceries."
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
    return mainMenuReply();
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
            `Sorry, *${product.item}* is out of stock 😕\nPlease tap another item.`
          );
        }
        const added = quickAdd(s, product);
        return productListReply(
          s.category,
          `✅ Added: *${product.item}* ×1 (${fmtMoney(product.price)})\nYour cart now has ${s.cart.length} item(s) - subtotal ${fmtMoney(calcSubtotal(s.cart))}.\nTap another item, or press Done when you're ready.`
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
        return textReply(`✍️ Custom quantity:\n\nType the quantity you want (max ${product.stock}).`);
      }
      if (selected && selected.startsWith("qty-")) {
        const q = parseInt(selected.slice(4), 10);
        if (q > 0 && q <= product.stock) {
          return addToCart(s, product, q);
        }
        return textReply(
          `Sorry, only *${product.stock}* available in stock 😕\nPlease select a smaller quantity.`
        );
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
        return textReply(`✍️ Type a number (example: 3). Maximum available: ${product.stock}.`);
      }
      if (q > product.stock) {
        return textReply(
          `Sorry, only *${product.stock}* in stock. Instead of ${q}, please type ${product.stock}.`
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
      const line = s.cart[s.qty_edit_idx];
      const product = line && products.getProductByKey(line.key);
      if (!product) {
        s.state = "cart";
        return cartMenuReply(s);
      }
      if (selected === "qty-custom") {
        s.state = "custom_qty_change";
        return textReply(`✍️ Type the new quantity (max ${product.stock}):`);
      }
      if (selected && selected.startsWith("qty-")) {
        const q = parseInt(selected.slice(4), 10);
        if (q > 0 && q <= product.stock) {
          applyQtyChange(s, q, product.price);
          return cartMenuReply(s);
        }
        return textReply(`Sorry, only ${product.stock} in stock 💔`);
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
        return textReply(`Type a valid number (1-${product.stock}):`);
      }
      applyQtyChange(s, q, product.price);
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
        return textReply("👤 *Your Details*\n\nWhat's your name? Please type it below.");
      }
      if (selected === "cart-edit") {
        s.state = "remove_item";
        return removeItemMenuReply(s);
      }
      if (selected === "cart-clear") {
        s.cart = [];
        s.state = "welcome";
        return textReply("Cart cleared ❌. For a new order, select Shop Groceries from the Main Menu.");
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
        return textReply("👤 Please type your name (example: Mohan).");
      }
      s.customer_name = name;
      s.state = "address";
      return textReply("📍 *Delivery Address*\n\nYou can give your delivery address two ways:\n\n📎 Option 1: Share a WhatsApp 📍 location\n\\- Tap the attachment icon (📎) → Location → Send 👌 (no typing needed - we deliver exactly there)\n\n✏️ Option 2: Type your full address\n\\- Example: 12, Gandhi Street, KK Nagar, Chennai");
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
        return textReply(
          "📍 *Delivery Location*\n\nTwo ways to share your delivery address:\n\n🔴 Option 1: Send a WhatsApp 📍 location\n\\- Tap the attachment icon (📎) → Location → Send\n\\- No typing needed, and it's the most accurate.\n\n🔴 Option 2: Type your full address\n\\- House number, street, area, city (example: 12, Gandhi Street, KK Nagar, Chennai)\n\nMost convenient: share your location from inside your home so we deliver right to your door."
        );
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
        return textReply("Order cancelled ❌. Select Shop Groceries from the Main Menu to start again.");
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
  const total = calcSubtotal(s.cart) + DELIVERY_FEE;
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

  try {
    const sheets = require("./sheets");
    await sheets.saveOrder(order);
  } catch (err) {
    console.error("Sheet mirror failed:", err.message);
  }

  const deliveryLine = order.lat && order.lng
    ? `📍 Delivery (location):\nhttps://maps.google.com/maps?q=${order.lat},${order.lng}`
    : `📍 ${order.address}`;
  const msg =
    `🎉 *Order Placed!*\n\n🧾 *Order #${order.id}*\n` +
    order.items.map((c) => `${c.item} × ${c.qty} — ${fmtMoney(c.subtotal)}`).join("\n") +
    `\n\nSubtotal: ${fmtMoney(order.subtotal)}\nDelivery: ${fmtMoney(order.deliveryFee)}\n*Total: ${fmtMoney(order.total)}*\n\n` +
    `${deliveryLine}\n💳 ${order.paymentMethod === "online" ? "Online Payment" : "Cash on Delivery"}\n\n` +
    `*Status:* ${orders.STATUS_LABEL[order.status]}\n\n` +
    `Progress:\n${statusTimeline(order.status)}\n\n` +
    `You'll receive order updates automatically here on WhatsApp. Thank you! 🙏`;

  s.cart = [];
  s.state = "welcome";
  touch(s);
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