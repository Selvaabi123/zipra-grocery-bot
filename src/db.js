const fs = require("fs");
const path = require("path");
const { DatabaseSync } = require("node:sqlite");

require("dotenv").config();

const DB_PATH = process.env.DB_PATH || path.join(__dirname, "..", "data", "zipra.db");

if (DB_PATH !== ":memory:") {
  fs.mkdirSync(path.dirname(DB_PATH), { recursive: true });
}

const db = new DatabaseSync(DB_PATH);
db.exec("PRAGMA journal_mode = WAL");
db.exec("PRAGMA foreign_keys = ON");

const SCHEMA = `
CREATE TABLE IF NOT EXISTS admins(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  username TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  name TEXT,
  role TEXT DEFAULT 'admin',
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS categories(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT UNIQUE NOT NULL,
  sort_order INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS products(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  category_id INTEGER NOT NULL REFERENCES categories(id) ON DELETE RESTRICT,
  name TEXT NOT NULL,
  image TEXT DEFAULT '',
  unit TEXT DEFAULT 'kg',
  price REAL NOT NULL DEFAULT 0,
  discount_price REAL,
  gst_rate REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory(
  product_id INTEGER PRIMARY KEY REFERENCES products(id) ON DELETE CASCADE,
  stock REAL NOT NULL DEFAULT 0,
  low_stock_level REAL NOT NULL DEFAULT 5,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS inventory_history(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  change REAL NOT NULL,
  qty_before REAL NOT NULL,
  qty_after REAL NOT NULL,
  reason TEXT,
  ref_type TEXT,
  ref_id TEXT,
  created_by TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_hist_product ON inventory_history(product_id);

CREATE TABLE IF NOT EXISTS customers(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  wa_id TEXT UNIQUE,
  name TEXT,
  email TEXT,
  phone TEXT,
  address TEXT,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS delivery_partners(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  phone TEXT,
  online INTEGER DEFAULT 0,
  total_deliveries INTEGER DEFAULT 0,
  earnings REAL DEFAULT 0,
  created_at TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS orders(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_no TEXT UNIQUE NOT NULL,
  customer_id INTEGER REFERENCES customers(id) ON DELETE SET NULL,
  wa_id TEXT,
  customer_name TEXT,
  delivery_address TEXT,
  lat REAL,
  lng REAL,
  subtotal REAL NOT NULL DEFAULT 0,
  delivery_fee REAL NOT NULL DEFAULT 0,
  discount REAL NOT NULL DEFAULT 0,
  total_amount REAL NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cod',
  payment_status TEXT NOT NULL DEFAULT 'Pending',
  order_status TEXT NOT NULL DEFAULT 'received',
  assigned_delivery_partner_id INTEGER REFERENCES delivery_partners(id) ON DELETE SET NULL,
  created_at TEXT,
  updated_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(order_status);
CREATE INDEX IF NOT EXISTS idx_orders_created ON orders(created_at);
CREATE INDEX IF NOT EXISTS idx_orders_wa ON orders(wa_id);

CREATE TABLE IF NOT EXISTS order_items(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  product_id INTEGER REFERENCES products(id) ON DELETE SET NULL,
  product_name TEXT NOT NULL,
  unit TEXT,
  quantity REAL NOT NULL,
  price REAL NOT NULL,
  total REAL NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_items_order ON order_items(order_id);

CREATE TABLE IF NOT EXISTS payments(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  amount REAL NOT NULL,
  method TEXT,
  status TEXT,
  transaction_id TEXT,
  paid_at TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);

CREATE TABLE IF NOT EXISTS order_status_history(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
  from_status TEXT,
  to_status TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_history_order ON order_status_history(order_id);

CREATE TABLE IF NOT EXISTS promotions(
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  code TEXT UNIQUE NOT NULL,
  title TEXT,
  type TEXT DEFAULT 'percent',
  value REAL NOT NULL,
  min_order REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT
);

CREATE TABLE IF NOT EXISTS app_settings(
  k TEXT PRIMARY KEY,
  v TEXT
);
CREATE TABLE IF NOT EXISTS webhook_msgs(
  msg_id TEXT PRIMARY KEY,
  seen_at TEXT
);
`;

db.exec(SCHEMA);

function now() {
  return new Date().toISOString();
}

function tx(fn) {
  db.exec("BEGIN");
  try {
    const r = fn();
    db.exec("COMMIT");
    return r;
  } catch (e) {
    db.exec("ROLLBACK");
    throw e;
  }
}

function num(v, d) {
  const n = parseFloat(v);
  return isNaN(n) ? (d == null ? 0 : d) : n;
}

/* ---------------- settings ---------------- */

function getSetting(k, def) {
  const r = db.prepare("SELECT v FROM app_settings WHERE k = ?").get(k);
  return r ? r.v : def;
}
function setSetting(k, v) {
  db.prepare(
    "INSERT INTO app_settings(k, v) VALUES(?, ?) ON CONFLICT(k) DO UPDATE SET v = excluded.v"
  ).run(String(k), String(v));
}
function deliveryFee() {
  return num(parseFloat(getSetting("delivery_fee")), num(process.env.DELIVERY_FEE, 30));
}

/* ---------------- customers ---------------- */

function upsertCustomer(waId, name) {
  if (!waId) return null;
  let c = db.prepare("SELECT * FROM customers WHERE wa_id = ?").get(waId);
  if (!c) {
    const t = now();
    const r = db
      .prepare("INSERT INTO customers(wa_id, name, created_at, updated_at) VALUES(?, ?, ?, ?)")
      .run(waId, name || "", t, t);
    c = db.prepare("SELECT * FROM customers WHERE id = ?").get(r.lastInsertRowid);
  } else if (name && c.name !== name) {
    db.prepare("UPDATE customers SET name = ?, updated_at = ? WHERE id = ?").run(
      name,
      now(),
      c.id
    );
    c.name = name;
  }
  return c;
}

function getCustomerByPhone(phone) {
  if (!phone) return null;
  const ph = String(phone).replace(/[^+\d]/g, "");
  return db.prepare("SELECT * FROM customers WHERE phone = ? OR wa_id = ?").get(ph, ph) || null;
}

function upsertCustomerByPhone(name, phone) {
  const ph = String(phone || "")
    .replace(/[^+\d]/g, "")
    .replace(/^\+?91?/, "91");
  let c = ph ? getCustomerByPhone(ph) : null;
  const t = now();
  if (c) {
    if (name && c.name !== name) {
      db.prepare("UPDATE customers SET name = ?, updated_at = ? WHERE id = ?").run(name, t, c.id);
      c.name = name;
    }
    return c;
  }
  const r = db
    .prepare("INSERT INTO customers(name, phone, created_at, updated_at) VALUES(?, ?, ?, ?)")
    .run(name || "", ph || "", t, t);
  return db.prepare("SELECT * FROM customers WHERE id = ?").get(r.lastInsertRowid);
}

/* ---------------- categories ---------------- */

function listCategories() {
  return db
    .prepare("SELECT id, name, sort_order FROM categories ORDER BY sort_order, name")
    .all();
}
function categoryId(name) {
  const n = String(name || "").trim();
  if (!n) return null;
  let c = db.prepare("SELECT id FROM categories WHERE name = ?").get(n);
  if (!c) {
    const next = db.prepare("SELECT COALESCE(MAX(sort_order), 0) + 1 AS n FROM categories").get();
    const r = db
      .prepare("INSERT INTO categories(name, sort_order) VALUES(?, ?)")
      .run(n, next.n);
    c = { id: r.lastInsertRowid };
  }
  return c.id;
}

/* ---------------- products + inventory ---------------- */

function productRow(id) {
  return db
    .prepare(
      "SELECT p.*, c.name AS category, i.stock, i.low_stock_level FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN inventory i ON i.product_id = p.id WHERE p.id = ?"
    )
    .get(id);
}
function toProduct(r) {
  if (!r) return null;
  const stock = num(r.stock, 0);
  const price = num(r.price, 0);
  const discount = num(r.discount_price, 0);
  return {
    id: r.id,
    item: r.name,
    name: r.name,
    category: r.category,
    unit: r.unit || "kg",
    image: r.image || "",
    price,
    discount_price: discount || null,
    effectivePrice: discount && discount < price ? discount : price,
    gst_rate: num(r.gst_rate, 0),
    stock,
    low_stock_level: num(r.low_stock_level, 5),
    available: !!(r.active && stock > 0),
    active: !!r.active,
  };
}
function listProducts(q) {
  const opts = q || {};
  let sql =
    "SELECT p.*, c.name AS category, i.stock, i.low_stock_level FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN inventory i ON i.product_id = p.id";
  const where = [];
  const args = [];
  if (opts.category) {
    where.push("c.name = ?");
    args.push(opts.category);
  }
  if (opts.active !== undefined) {
    where.push("p.active = ?");
    args.push(opts.active ? 1 : 0);
  }
  if (opts.q) {
    where.push("(p.name LIKE ?)");
    args.push("%" + opts.q + "%");
  }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY c.sort_order, p.id";
  return db.prepare(sql).all(...args).map(toProduct);
}
function getProductById(id) {
  return toProduct(productRow(id));
}
function getProductByKey(key) {
  if (!key) return null;
  const ks = String(key);
  const dot = ks.lastIndexOf(".");
  if (dot < 0) return null;
  const cat = ks.slice(0, dot);
  const name = ks.slice(dot + 1);
  const r = db
    .prepare(
      "SELECT p.*, c.name AS category, i.stock, i.low_stock_level FROM products p JOIN categories c ON c.id = p.category_id LEFT JOIN inventory i ON i.product_id = p.id WHERE c.name = ? AND p.name = ?"
    )
    .get(cat, name);
  return toProduct(r);
}
function categories() {
  return listCategories().map((c) => c.name);
}
function productsInCategory(category) {
  return listProducts({ category });
}
function stockQty(productId) {
  const r = db.prepare("SELECT stock FROM inventory WHERE product_id = ?").get(productId);
  return num(r ? r.stock : 0, 0);
}
function stockAvailable(key, qty) {
  const p = typeof key === "object" ? key : getProductByKey(key);
  if (!p) return false;
  return !!p.available && p.stock >= num(qty, 1);
}
function adjustStock(productId, delta, reason, ref, by) {
  const pid = typeof productId === "number" ? productId : null;
  if (!pid) return false;
  const cur = stockQty(pid);
  const next = Math.max(0, cur + num(delta, 0));
  if (next === cur && delta !== 0 && cur === 0 && delta < 0) return false;
  const t = now();
  db.prepare(
    "INSERT INTO inventory(product_id, stock, updated_at) VALUES(?, ?, ?) ON CONFLICT(product_id) DO UPDATE SET stock = excluded.stock, updated_at = excluded.updated_at"
  ).run(pid, next, t);
  db.prepare(
    "INSERT INTO inventory_history(product_id, change, qty_before, qty_after, reason, ref_type, ref_id, created_by, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)"
  ).run(pid, num(delta, 0), cur, next, reason || "", "", ref || "", by || "", t);
  return true;
}
function reduceStock(key, qty) {
  const p = typeof key === "object" ? key : getProductByKey(key);
  if (!p) return false;
  return tx(() => adjustStock(p.id, -qty, "Order placed", "order", p.id));
}
function setStock(productId, add, reason, ref, by) {
  return tx(() => adjustStock(productId, add, reason, ref, by));
}
function createProduct(obj) {
  const name = String(obj.name || obj.item || "").trim();
  if (!name) throw new Error("Product name is required");
  const t = now();
  const cid = categoryId(obj.category);
  if (!cid) throw new Error("Category is required");
  const r = db
    .prepare(
      "INSERT INTO products(category_id, name, image, unit, price, discount_price, gst_rate, active, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
    )
    .run(
      cid,
      name,
      obj.image || "",
      obj.unit || "kg",
      num(obj.price, 0),
      obj.discount_price == null || obj.discount_price === "" ? null : num(obj.discount_price, 0),
      num(obj.gst_rate, 0),
      obj.active === false ? 0 : 1,
      t,
      t
    );
  const pid = r.lastInsertRowid;
  db.prepare(
    "INSERT INTO inventory(product_id, stock, low_stock_level, updated_at) VALUES(?, ?, ?, ?)"
  ).run(pid, num(obj.stock, 0), num(obj.low_stock_level, 5), t);
  if (num(obj.stock, 0) > 0) {
    db.prepare(
      "INSERT INTO inventory_history(product_id, change, qty_before, qty_after, reason, ref_type, ref_id, created_by, created_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ).run(pid, num(obj.stock, 0), 0, num(obj.stock, 0), "Initial stock", "init", "", "", t);
  }
  return getProductById(pid);
}
function updateProduct(id, obj) {
  const cur = productRow(id);
  if (!cur) throw new Error("Product not found");
  const patch = {
    name: obj.name !== undefined ? String(obj.name || "").trim() || cur.name : cur.name,
    category_id:
      obj.category !== undefined ? categoryId(obj.category) : cur.category_id,
    image: obj.image !== undefined ? obj.image : cur.image,
    unit: obj.unit !== undefined ? obj.unit : cur.unit,
    price: obj.price !== undefined ? num(obj.price, 0) : cur.price,
    discount_price:
      obj.discount_price !== undefined
        ? obj.discount_price === "" || obj.discount_price == null
          ? null
          : num(obj.discount_price, 0)
        : cur.discount_price,
    gst_rate: obj.gst_rate !== undefined ? num(obj.gst_rate, 0) : cur.gst_rate,
    active:
      obj.active !== undefined
        ? obj.active === 1 || obj.active === true || obj.active === "1"
          ? 1
          : 0
        : cur.active,
  };
  db.prepare(
    "UPDATE products SET category_id = ?, name = ?, image = ?, unit = ?, price = ?, discount_price = ?, gst_rate = ?, active = ?, updated_at = ? WHERE id = ?"
  ).run(
    patch.category_id,
    patch.name,
    patch.image,
    patch.unit,
    patch.price,
    patch.discount_price,
    patch.gst_rate,
    patch.active,
    now(),
    id
  );
  if (obj.stock !== undefined && obj.stock !== null && obj.stock !== "") {
    const target = num(obj.stock, 0);
    const curS = stockQty(id);
    if (target !== curS) {
      adjustStock(id, target - curS, "Stock set by admin", "admin", "admin");
    }
  }
  if (obj.low_stock_level !== undefined && obj.low_stock_level !== "") {
    db.prepare("UPDATE inventory SET low_stock_level = ? WHERE product_id = ?").run(
      num(obj.low_stock_level, 5),
      id
    );
  }
  return getProductById(id);
}
function deleteProduct(id) {
  const r = db.prepare("DELETE FROM products WHERE id = ?").run(id);
  if (!r.changes) throw new Error("Product not found");
  return true;
}
function toggleProduct(id, active) {
  db.prepare("UPDATE products SET active = ?, updated_at = ? WHERE id = ?").run(
    active ? 1 : 0,
    now(),
    id
  );
  return getProductById(id);
}
function stockHistory(productId, limit) {
  return db
    .prepare("SELECT * FROM inventory_history WHERE product_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
    .all(productId, limit || 50);
}
function recentStockHistory(limit) {
  return db
    .prepare(
      "SELECT h.*, p.name AS product FROM inventory_history h JOIN products p ON p.id = h.product_id ORDER BY h.created_at DESC, h.id DESC LIMIT ?"
    )
    .all(limit || 50);
}
function inventoryList() {
  return listProducts().map((p) => ({
    id: p.id,
    name: p.item,
    unit: p.unit,
    stock: p.stock,
    low_stock_level: p.low_stock_level,
    status: p.stock <= 0 ? "out" : p.stock <= p.low_stock_level ? "low" : "good",
    category: p.category,
    active: p.active,
  }));
}

/* ---------------- orders ---------------- */

function nextOrderNo() {
  const nowD = new Date();
  const pad = (x) => String(x).padStart(2, "0");
  const date = `${nowD.getFullYear().toString().slice(2)}${pad(nowD.getMonth() + 1)}${pad(nowD.getDate())}`;
  const prefix = `ZIP${date}`;
  const r = db
    .prepare("SELECT MAX(order_no) AS mx FROM orders WHERE order_no LIKE ?")
    .get(prefix + "%");
  let seq = 1;
  if (r && r.mx) {
    seq = parseInt(String(r.mx).slice(prefix.length), 10) + 1;
  }
  return `${prefix}${String(seq).padStart(3, "0")}`;
}

function insertOrderItems(orderId, items) {
  const ins = db.prepare(
    "INSERT INTO order_items(order_id, product_id, product_name, unit, quantity, price, total) VALUES(?, ?, ?, ?, ?, ?, ?)"
  );
  for (const it of items || []) {
    ins.run(
      orderId,
      it.product_id != null ? it.product_id : null,
      String(it.item || it.product_name || ""),
      it.unit || "kg",
      num(it.qty, 0),
      num(it.price, 0),
      num(it.subtotal != null ? it.subtotal : num(it.qty, 0) * num(it.price, 0), 0)
    );
  }
}

function insertOrder(order) {
  const items = order.items || [];
  const subtotal = num(order.subtotal, items.reduce((s, it) => s + num(it.subtotal, num(it.qty, 0) * num(it.price, 0)), 0));
  const fee = num(order.deliveryFee, deliveryFee());
  const discount = num(order.discount, 0);
  const total = num(order.total, subtotal + fee - discount);
  const t = now();
  return tx(() => {
    const cust = upsertCustomer(order.waId, order.name);
    const r = db
      .prepare(
        "INSERT INTO orders(order_no, customer_id, wa_id, customer_name, delivery_address, lat, lng, subtotal, delivery_fee, discount, total_amount, payment_method, payment_status, order_status, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
      )
      .run(
        order.id,
        cust ? cust.id : null,
        order.waId || "",
        order.name || "",
        order.address || "",
        order.lat == null ? null : num(order.lat),
        order.lng == null ? null : num(order.lng),
        subtotal,
        fee,
        discount,
        total,
        order.paymentMethod || "cod",
        order.paymentStatus || "Pending",
        order.status || "received",
        order.createdAt || t,
        order.updatedAt || t
      );
    const orderId = r.lastInsertRowid;
    insertOrderItems(orderId, items);
    db.prepare(
      "INSERT INTO order_status_history(order_id, from_status, to_status, created_by, created_at) VALUES(?, ?, ?, ?, ?)"
    ).run(orderId, null, order.status || "received", "system", t);
    if ((order.paymentStatus || "Pending") === "Paid") {
      db.prepare(
        "INSERT INTO payments(order_id, amount, method, status, paid_at, created_at) VALUES(?, ?, ?, ?, ?, ?)"
      ).run(orderId, total, order.paymentMethod || "cod", "Paid", t, t);
    }
    return order;
  });
}

function loadOrders(ids) {
  const out = new Map();
  if (!ids.length) return out;
  const places = ids.map(() => "?").join(",");
  const rows = db
    .prepare(`SELECT * FROM order_items WHERE order_id IN (${places})`)
    .all(...ids);
  for (const r of rows) {
    const key = r.order_id;
    if (!out.has(key)) out.set(key, []);
    out.get(key).push({
      item: r.product_name,
      unit: r.unit,
      qty: r.quantity,
      price: r.price,
      subtotal: r.total,
      productId: r.product_id,
    });
  }
  return out;
}

function orderFields(o) {
  return {
    id: o.order_no,
    customer_id: o.customer_id,
    waId: o.wa_id,
    name: o.customer_name,
    address: o.delivery_address,
    lat: o.lat,
    lng: o.lng,
    subtotal: o.subtotal,
    deliveryFee: o.delivery_fee,
    discount: o.discount,
    total: o.total_amount,
    paymentMethod: o.payment_method,
    paymentStatus: o.payment_status,
    status: o.order_status,
    partnerId: o.assigned_delivery_partner_id,
    partnerName: o.partner_name || null,
    partnerPhone: o.partner_phone || null,
    createdAt: o.created_at,
    updatedAt: o.updated_at,
  };
}

const PARTNER_SELECT = ", dp.name AS partner_name, dp.phone AS partner_phone";

function listOrders(opts) {
  const q = opts || {};
  let sql = "SELECT o.*" + PARTNER_SELECT + " FROM orders o LEFT JOIN delivery_partners dp ON dp.id = o.assigned_delivery_partner_id";
  const where = [];
  const args = [];
  if (q.status && q.status !== "all") {
    where.push("o.order_status = ?");
    args.push(q.status);
  }
  if (q.q) {
    where.push(
      "(o.order_no LIKE ? OR o.customer_name LIKE ? OR o.wa_id LIKE ? OR o.delivery_address LIKE ?)"
    );
    const like = "%" + q.q + "%";
    args.push(like, like, like, like);
  }
  if (q.customer_id) {
    where.push("o.customer_id = ?");
    args.push(q.customer_id);
  }
  if (q.partner_id) {
    where.push("o.assigned_delivery_partner_id = ?");
    args.push(q.partner_id);
  }
  if (where.length) sql += " WHERE " + where.join(" AND ");
  sql += " ORDER BY o.created_at DESC, o.id DESC";
  const limit = Math.min(Math.max(parseInt(q.limit || 200, 10), 1), 500);
  sql += " LIMIT ?";
  args.push(limit);
  const rows = db.prepare(sql).all(...args);
  if (!rows.length) return [];
  const items = loadOrders(rows.map((r) => r.id));
  return rows.map((r) => {
    const o = orderFields(r);
    o.items = items.get(r.id) || [];
    return o;
  });
}

function findOrderNo(orderNo) {
  const r = db
    .prepare(
      "SELECT o.*" + PARTNER_SELECT + " FROM orders o LEFT JOIN delivery_partners dp ON dp.id = o.assigned_delivery_partner_id WHERE o.order_no = ?"
    )
    .get(orderNo);
  return r || null;
}

function getOrderDetail(orderNoOrId) {
  let row = null;
  const key = String(orderNoOrId || "");
  if (/^\d+$/.test(key)) {
    row = db
      .prepare(
        "SELECT o.*" + PARTNER_SELECT + " FROM orders o LEFT JOIN delivery_partners dp ON dp.id = o.assigned_delivery_partner_id WHERE o.id = ? OR o.order_no = ?"
      )
      .get(Number(key), key);
  } else if (key) {
    row = findOrderNo(key);
  }
  if (!row) return null;
  const order = orderFields(row);
  order.items = loadOrders([row.id]).get(row.id) || [];
  order.payments = db
    .prepare("SELECT * FROM payments WHERE order_id = ? ORDER BY id DESC")
    .all(row.id);
  order.history = db
    .prepare("SELECT * FROM order_status_history WHERE order_id = ? ORDER BY id ASC")
    .all(row.id)
    .map((h) => ({
      from: h.from_status,
      to: h.to_status,
      by: h.created_by,
      at: h.created_at,
    }));
  order.customer = row.customer_id
    ? db.prepare("SELECT * FROM customers WHERE id = ?").get(row.customer_id) || null
    : null;
  return order;
}

function updateOrderStatus(orderNo, status, by) {
  const VALID = ["received", "confirmed", "preparing", "out_for_delivery", "delivered", "cancelled"];
  if (!VALID.includes(status)) throw new Error("Invalid status: " + status);
  const row = findOrderNo(orderNo);
  if (!row) throw new Error("Order not found: " + orderNo);
  const order = orderFields(row);
  const oldS = order.status;
  const t = now();
  tx(() => {
    db.prepare(
      "UPDATE orders SET order_status = ?, updated_at = ? WHERE order_no = ?"
    ).run(status, t, orderNo);
    db.prepare(
      "INSERT INTO order_status_history(order_id, from_status, to_status, created_by, created_at) VALUES(?, ?, ?, ?, ?)"
    ).run(row.id, oldS, status, by || "admin", t);
    if (status === "cancelled" && oldS !== "cancelled") {
      const items = loadOrders([row.id]).get(row.id) || [];
      for (const it of items) {
        if (it.productId) {
          adjustStock(it.productId, it.qty, "Order cancelled", "order_cancel", orderNo);
        }
      }
      db.prepare(
        "UPDATE orders SET payment_status = 'Cancelled' WHERE order_no = ?"
      ).run(orderNo);
    }
    if (status === "delivered" && oldS !== "delivered") {
      const hasPay = db
        .prepare("SELECT id FROM payments WHERE order_id = ? AND status = 'Paid'")
        .get(row.id);
      if (!hasPay) {
        db.prepare(
          "INSERT INTO payments(order_id, amount, method, status, paid_at, created_at) VALUES(?, ?, ?, ?, ?, ?)"
        ).run(row.id, order.total, order.paymentMethod || "cod", "Paid", t, t);
      }
      if (order.paymentStatus !== "Paid") {
        db.prepare("UPDATE orders SET payment_status = 'Paid' WHERE order_no = ?").run(orderNo);
      }
      if (order.partnerId) {
        db.prepare(
          "UPDATE delivery_partners SET total_deliveries = total_deliveries + 1, earnings = earnings + ? WHERE id = ?"
        ).run(order.deliveryFee || 0, order.partnerId);
      }
    }
  });
  return { ...order, status, paymentStatus: status === "cancelled" ? "Cancelled" : status === "delivered" && order.paymentStatus !== "Paid" ? "Paid" : order.paymentStatus };
}

function updatePayment(orderNo, paymentStatus, method) {
  const row = findOrderNo(orderNo);
  if (!row) throw new Error("Order not found: " + orderNo);
  const order = orderFields(row);
  const t = now();
  tx(() => {
    db.prepare(
      "UPDATE orders SET payment_status = ?, updated_at = ? WHERE order_no = ?"
    ).run(paymentStatus, t, orderNo);
    if (paymentStatus === "Paid") {
      const hasPay = db
        .prepare("SELECT id FROM payments WHERE order_id = ? AND status = 'Paid'")
        .get(row.id);
      if (!hasPay) {
        db.prepare(
          "INSERT INTO payments(order_id, amount, method, status, paid_at, created_at) VALUES(?, ?, ?, ?, ?, ?)"
        ).run(row.id, order.total, method || order.paymentMethod || "cod", "Paid", t, t);
      }
    }
  });
  return getOrderDetail(orderNo);
}

function assignPartner(orderNo, partnerId) {
  const row = findOrderNo(orderNo);
  if (!row) throw new Error("Order not found: " + orderNo);
  db.prepare(
    "UPDATE orders SET assigned_delivery_partner_id = ?, updated_at = ? WHERE order_no = ?"
  ).run(partnerId || null, now(), orderNo);
  return getOrderDetail(orderNo);
}

function updateOrder(orderNo, obj) {
  const row = findOrderNo(orderNo);
  if (!row) throw new Error("Order not found: " + orderNo);
  const cur = getOrderDetail(orderNo);
  const items = Array.isArray(obj.items) ? obj.items : cur.items;
  const subtotal = items.reduce((s, it) => s + num(it.subtotal != null ? it.subtotal : num(it.qty, 0) * num(it.price, 0), 0), 0);
  const fee = num(obj.deliveryFee != null ? obj.deliveryFee : cur.deliveryFee, deliveryFee());
  const discount = num(obj.discount != null ? obj.discount : cur.discount, 0);
  const total = num(obj.total != null ? obj.total : subtotal + fee - discount, subtotal + fee - discount);
  const t = now();
  tx(() => {
    db.prepare(
      "UPDATE orders SET customer_name = ?, wa_id = ?, delivery_address = ?, lat = ?, lng = ?, subtotal = ?, delivery_fee = ?, discount = ?, total_amount = ?, payment_method = ?, order_status = ?, updated_at = ? WHERE order_no = ?"
    ).run(
      obj.name != null ? obj.name : cur.name,
      obj.waId != null ? obj.waId : cur.waId,
      obj.address != null ? obj.address : cur.address,
      obj.lat != null ? num(obj.lat) : row.lat,
      obj.lng != null ? num(obj.lng) : row.lng,
      subtotal,
      fee,
      discount,
      total,
      obj.paymentMethod != null ? obj.paymentMethod : cur.paymentMethod,
      obj.status != null ? obj.status : cur.status,
      t,
      orderNo
    );
    db.prepare("DELETE FROM order_items WHERE order_id = ?").run(row.id);
    insertOrderItems(row.id, items);
    if (obj.status != null && obj.status !== cur.status) {
      db.prepare(
        "INSERT INTO order_status_history(order_id, from_status, to_status, created_by, created_at) VALUES(?, ?, ?, ?, ?)"
      ).run(row.id, cur.status, obj.status, "admin", t);
    }
  });
  return getOrderDetail(orderNo);
}

function deleteOrder(orderNo) {
  const row = findOrderNo(orderNo);
  if (!row) throw new Error("Order not found: " + orderNo);
  tx(() => {
    const items = loadOrders([row.id]).get(row.id) || [];
    for (const it of items) {
      if (it.productId) {
        adjustStock(it.productId, it.qty, "Order deleted", "order_delete", orderNo);
      }
    }
    db.prepare("DELETE FROM orders WHERE order_no = ?").run(orderNo);
  });
  return true;
}

function recentOrders(limit) {
  return listOrders({ limit });
}

function activeStatuses() {
  return ["received", "confirmed", "preparing", "out_for_delivery"];
}
function findActiveByWa(waId) {
  const rows = listOrders({ limit: 200 });
  return (
    rows.find((o) => o.waId === waId && activeStatuses().includes(o.status)) || null
  );
}
function findByWa(waId, limit) {
  return listOrders({ limit: 500 }).filter((o) => o.waId === waId).slice(0, limit || 8);
}

function ordersStats() {
  const r = db
    .prepare(
      "SELECT COUNT(*) AS total, SUM(CASE WHEN order_status IN ('received','confirmed','preparing','out_for_delivery') THEN 1 ELSE 0 END) AS active, SUM(CASE WHEN order_status = 'delivered' THEN 1 ELSE 0 END) AS delivered, SUM(CASE WHEN order_status = 'cancelled' THEN 1 ELSE 0 END) AS cancelled, SUM(CASE WHEN order_status IN ('delivered','out_for_delivery','preparing','confirmed','received') THEN total_amount ELSE 0 END) AS revenue FROM orders"
    )
    .get();
  return {
    total: r.total || 0,
    active: r.active || 0,
    delivered: r.delivered || 0,
    cancelled: r.cancelled || 0,
    revenue: num(
      db
        .prepare("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE order_status = 'delivered'")
        .get().s,
      0
    ),
  };
}

function statusCounts() {
  const rows = db
    .prepare("SELECT order_status AS s, COUNT(*) AS n FROM orders GROUP BY order_status")
    .all();
  const map = {};
  for (const r of rows) map[r.s] = r.n;
  return map;
}

/* ---------------- delivery partners ---------------- */

function listPartners() {
  return db
    .prepare(
      "SELECT dp.*, (SELECT COUNT(*) FROM orders o WHERE o.assigned_delivery_partner_id = dp.id AND o.order_status NOT IN ('delivered','cancelled')) AS active_orders FROM delivery_partners dp ORDER BY dp.name"
    )
    .all()
    .map((p) => ({
      id: p.id,
      name: p.name,
      phone: p.phone || "",
      online: !!p.online,
      activeOrders: p.active_orders || 0,
      totalDeliveries: p.total_deliveries || 0,
      earnings: num(p.earnings, 0),
      createdAt: p.created_at,
    }));
}
function createPartner(obj) {
  const t = now();
  const r = db
    .prepare("INSERT INTO delivery_partners(name, phone, online, created_at, updated_at) VALUES(?, ?, ?, ?, ?)")
    .run(String(obj.name || "").trim() || "Partner", obj.phone || "", obj.online ? 1 : 0, t, t);
  return listPartners().find((p) => p.id === r.lastInsertRowid);
}
function updatePartner(id, obj) {
  const cur = db.prepare("SELECT * FROM delivery_partners WHERE id = ?").get(id);
  if (!cur) throw new Error("Partner not found");
  db.prepare(
    "UPDATE delivery_partners SET name = ?, phone = ?, online = ?, updated_at = ? WHERE id = ?"
  ).run(
    obj.name != null && String(obj.name).trim() ? String(obj.name).trim() : cur.name,
    obj.phone != null ? obj.phone : cur.phone,
    obj.online !== undefined ? (obj.online ? 1 : 0) : cur.online,
    now(),
    id
  );
  return listPartners().find((p) => p.id === id);
}
function deletePartner(id) {
  const r = db.prepare("DELETE FROM delivery_partners WHERE id = ?").run(id);
  if (!r.changes) throw new Error("Partner not found");
  return true;
}

/* ---------------- customers ---------------- */

function listCustomers() {
  return db
    .prepare(
      "SELECT c.*, COUNT(o.id) AS total_orders, COALESCE(SUM(CASE WHEN o.order_status = 'delivered' THEN o.total_amount ELSE 0 END), 0) AS total_spent, MAX(o.created_at) AS last_order FROM customers c LEFT JOIN orders o ON o.customer_id = c.id GROUP BY c.id ORDER BY last_order DESC NULLS LAST"
    )
    .all()
    .map((c) => ({
      id: c.id,
      name: c.name || "",
      phone: c.phone || c.wa_id || "",
      waId: c.wa_id || "",
      email: c.email || "",
      address: c.address || "",
      totalOrders: c.total_orders || 0,
      totalSpent: num(c.total_spent, 0),
      lastOrder: c.last_order || null,
      status: c.total_orders >= 5 ? "VIP" : c.total_orders >= 2 ? "Regular" : c.total_orders >= 1 ? "New" : "Inactive",
    }));
}
function getCustomerDetail(id) {
  const c = db
    .prepare(
      "SELECT c.*, COUNT(o.id) AS total_orders, COALESCE(SUM(CASE WHEN o.order_status = 'delivered' THEN o.total_amount ELSE 0 END), 0) AS total_spent, MAX(o.created_at) AS last_order FROM customers c LEFT JOIN orders o ON o.customer_id = c.id WHERE c.id = ? GROUP BY c.id"
    )
    .get(id);
  if (!c) return null;
  const orders = listOrders({ customer_id: id });
  return {
    id: c.id,
    name: c.name || "",
    phone: c.phone || c.wa_id || "",
    waId: c.wa_id || "",
    email: c.email || "",
    address: c.address || "",
    totalOrders: c.total_orders || 0,
    totalSpent: num(c.total_spent, 0),
    lastOrder: c.last_order,
    orders,
  };
}

/* ---------------- promotions ---------------- */

function listPromotions() {
  return db.prepare("SELECT * FROM promotions ORDER BY id DESC").all().map((p) => ({
    id: p.id,
    code: p.code,
    title: p.title || "",
    type: p.type,
    value: num(p.value, 0),
    minOrder: num(p.min_order, 0),
    active: !!p.active,
    createdAt: p.created_at,
  }));
}
function createPromotion(obj) {
  const t = now();
  const r = db
    .prepare("INSERT INTO promotions(code, title, type, value, min_order, active, created_at) VALUES(?, ?, ?, ?, ?, ?, ?)")
    .run(
      String(obj.code || "").trim().toUpperCase() || "OFFER",
      obj.title || "",
      obj.type === "fixed" ? "fixed" : "percent",
      num(obj.value, 0),
      num(obj.min_order != null ? obj.min_order : obj.minOrder, 0),
      obj.active === false ? 0 : 1,
      t
    );
  return listPromotions().find((p) => p.id === r.lastInsertRowid);
}
function updatePromotion(id, obj) {
  const cur = db.prepare("SELECT * FROM promotions WHERE id = ?").get(id);
  if (!cur) throw new Error("Promotion not found");
  const patch = {
    code: obj.code != null ? String(obj.code).trim().toUpperCase() || cur.code : cur.code,
    title: obj.title != null ? obj.title : cur.title,
    type: obj.type != null ? (obj.type === "fixed" ? "fixed" : "percent") : cur.type,
    value: obj.value != null ? num(obj.value, 0) : cur.value,
    min_order: obj.minOrder != null ? num(obj.minOrder, 0) : cur.min_order,
    active:
      obj.active !== undefined ? (obj.active ? 1 : 0) : cur.active,
  };
  db.prepare("UPDATE promotions SET code = ?, title = ?, type = ?, value = ?, min_order = ?, active = ? WHERE id = ?").run(
    patch.code, patch.title, patch.type, patch.value, patch.min_order, patch.active, id
  );
  return listPromotions().find((p) => p.id === id);
}
function deletePromotion(id) {
  const r = db.prepare("DELETE FROM promotions WHERE id = ?").run(id);
  if (!r.changes) throw new Error("Promotion not found");
  return true;
}

/* ---------------- reports ---------------- */

function dayBounds(daysBack) {
  const d = new Date();
  const start = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (daysBack || 0), 0, 0, 0);
  const end = new Date(d.getFullYear(), d.getMonth(), d.getDate() - (daysBack || 0), 23, 59, 59);
  return [start.toISOString(), end.toISOString()];
}
function sumIn(since) {
  const r = db
    .prepare("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE order_status = 'delivered' AND created_at >= ?")
    .get(since);
  return num(r.s, 0);
}
function reportsData() {
  const today = dayBounds(0);
  const weekStart = new Date();
  weekStart.setDate(weekStart.getDate() - 6);
  const monthStart = new Date();
  monthStart.setDate(1);
  const tCount = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE created_at >= ? AND created_at <= ?").get(today[0], today[1]).n || 0;
  const tRev = db.prepare("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE order_status = 'delivered' AND created_at >= ? AND created_at <= ?").get(today[0], today[1]).s || 0;
  const week = db.prepare("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE order_status = 'delivered' AND created_at >= ?").get(weekStart.toISOString()).s || 0;
  const month = db.prepare("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE order_status = 'delivered' AND created_at >= ?").get(monthStart.toISOString()).s || 0;
  const delivered = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE order_status = 'delivered'").get().n || 0;
  const cancelled = db.prepare("SELECT COUNT(*) AS n FROM orders WHERE order_status = 'cancelled'").get().n || 0;
  const top = db
    .prepare(
      "SELECT product_name AS name, SUM(quantity) AS qty, SUM(total) AS rev FROM order_items GROUP BY product_name ORDER BY qty DESC LIMIT 8"
    )
    .all();
  const last7 = [];
  for (let i = 6; i >= 0; i--) {
    const b = dayBounds(i);
    const r = db.prepare("SELECT COALESCE(SUM(total_amount), 0) AS s FROM orders WHERE order_status = 'delivered' AND created_at >= ? AND created_at <= ?").get(b[0], b[1]);
    const label = new Date(b[0]);
    last7.push({
      label: label.toLocaleDateString("en-IN", { day: "numeric", month: "short" }),
      revenue: num(r.s, 0),
    });
  }
  const byStatus = db.prepare("SELECT order_status AS s, COUNT(*) AS n FROM orders GROUP BY order_status").all().map((r) => ({ status: r.s, count: r.n || 0 }));
  return {
    todayOrders: tCount,
    todayRevenue: num(tRev, 0),
    weekRevenue: num(week, 0),
    monthRevenue: num(month, 0),
    delivered,
    cancelled,
    topProducts: top.map((t2) => ({ name: t2.name, qty: num(t2.qty, 0), revenue: num(t2.rev, 0) })),
    last7Days: last7,
    byStatus,
  };
}

/* ---------------- seed / migration ---------------- */

function seedProducts() {
  if (db.prepare("SELECT COUNT(*) AS n FROM products").get().n > 0) return;
  let catalog = [];
  let pFile = path.join(__dirname, "products.json");
  try {
    catalog = JSON.parse(fs.readFileSync(pFile, "utf8")).catalog || [];
  } catch {
    /* fall back to empty */
  }
  tx(() => {
    for (const row of catalog) {
      const cid = categoryId(row.category);
      if (!cid) continue;
      const t = now();
      const r = db
        .prepare(
          "INSERT INTO products(category_id, name, image, unit, price, discount_price, gst_rate, active, created_at, updated_at) VALUES(?, ?, '', ?, ?, NULL, 0, ?, ?, ?)"
        )
        .run(cid, String(row.item || "").trim(), row.unit || "kg", num(row.price, 0), row.available === false ? 0 : 1, t, t);
      const stockNow = num(row.stock, 0);
      db.prepare(
        "INSERT INTO inventory(product_id, stock, low_stock_level, updated_at) VALUES(?, ?, 5, ?)"
      ).run(r.lastInsertRowid, Math.max(0, stockNow), t);
      if (stockNow > 0) {
        db.prepare(
          "INSERT INTO inventory_history(product_id, change, qty_before, qty_after, reason, ref_type, ref_id, created_by, created_at) VALUES(?, ?, 0, ?, 'Initial seed', 'init', '', 'system', ?)"
        ).run(r.lastInsertRowid, stockNow, stockNow, t);
      }
    }
  });
}

function seedOrdersFromJson() {
  if (db.prepare("SELECT COUNT(*) AS n FROM orders").get().n > 0) return;
  let arr = [];
  try {
    arr = JSON.parse(fs.readFileSync(path.join(__dirname, "orders.json"), "utf8"));
  } catch {
    return;
  }
  if (!Array.isArray(arr)) return;
  const t = now();
  tx(() => {
    for (const o of arr) {
      const cust = upsertCustomer(o.waId, o.name);
      const r = db
        .prepare(
          "INSERT INTO orders(order_no, customer_id, wa_id, customer_name, delivery_address, lat, lng, subtotal, delivery_fee, discount, total_amount, payment_method, payment_status, order_status, created_at, updated_at) VALUES(?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?, ?, ?)"
        )
        .run(
          o.id,
          cust ? cust.id : null,
          o.waId || "",
          o.name || "",
          o.address || "",
          o.lat == null ? null : num(o.lat),
          o.lng == null ? null : num(o.lng),
          num(o.subtotal, 0),
          num(o.deliveryFee, 0),
          num(o.total, num(o.subtotal, 0) + num(o.deliveryFee, 0)),
          o.paymentMethod || "cod",
          o.paymentStatus || "Pending",
          o.status || "received",
          o.createdAt || t,
          o.updatedAt || t
        );
      const orderId = r.lastInsertRowid;
      for (const it of o.items || []) {
        let pid = null;
        if (it.productId) {
          const p = getProductByKey(it.productId);
          pid = p ? p.id : null;
        }
        db.prepare(
          "INSERT INTO order_items(order_id, product_id, product_name, unit, quantity, price, total) VALUES(?, ?, ?, ?, ?, ?, ?)"
        ).run(orderId, pid, it.item || "", it.unit || "kg", num(it.qty, 1), num(it.price, 0), num(it.subtotal, num(it.qty, 1) * num(it.price, 0)));
      }
      db.prepare(
        "INSERT INTO order_status_history(order_id, from_status, to_status, created_by, created_at) VALUES(?, NULL, ?, 'migration', ?)"
      ).run(orderId, o.status || "received", o.createdAt || t);
    }
  });
}

function init() {
  if (getSetting("seeded_v1", "") === "1") return;
  seedProducts();
  seedOrdersFromJson();
  setSetting("seeded_v1", "1");
}

function webhookMsgSeen(id) {
  return !!db.prepare("SELECT 1 FROM webhook_msgs WHERE msg_id = ?").get(id);
}
function markWebhookMsg(id) {
  db.prepare("INSERT OR IGNORE INTO webhook_msgs(msg_id, seen_at) VALUES(?, ?)").run(String(id), now());
}

init();

module.exports = {
  db,
  tx,
  now,
  num,
  getSetting,
  setSetting,
  deliveryFee,
  webhookMsgSeen,
  markWebhookMsg,
  categories,
  listCategories,
  categoryId,
  listProducts,
  getProductById,
  getProductByKey,
  stockAvailable,
  stockQty,
  adjustStock,
  reduceStock,
  setStock,
  createProduct,
  updateProduct,
  deleteProduct,
  toggleProduct,
  stockHistory,
  recentStockHistory,
  inventoryList,
  nextOrderNo,
  insertOrder,
  listOrders,
  getOrderDetail,
  updateOrderStatus,
  updatePayment,
  assignPartner,
  updateOrder,
  deleteOrder,
  recentOrders,
  findActiveByWa,
  findByWa,
  ordersStats,
  statusCounts,
  listPartners,
  createPartner,
  updatePartner,
  deletePartner,
  listCustomers,
  getCustomerDetail,
  upsertCustomerByPhone,
  listPromotions,
  createPromotion,
  updatePromotion,
  deletePromotion,
  reportsData,
  init,
};