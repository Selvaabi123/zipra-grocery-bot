const fs = require("fs");
const path = require("path");
const { getJson } = require("./net");

const PRODUCTS_FILE = process.env.PRODUCTS_FILE || path.join(__dirname, "products.json");
const SHEET_WEBAPP_URL = process.env.SHEET_WEBAPP_URL || "";
const SHEET_SECRET = process.env.SHEET_SECRET || "";
const SYNC_TTL_MS = parseInt(process.env.PRODUCTS_SYNC_TTL || "300000", 10);
const SHEET_ONLY = process.env.SHEET_ONLY === "1";

let data = SHEET_ONLY
  ? { catalog: [] }
  : JSON.parse(fs.readFileSync(PRODUCTS_FILE, "utf8"));
let lastSync = 0;

function persist() {
  if (SHEET_ONLY) return;
  fs.writeFileSync(PRODUCTS_FILE, JSON.stringify(data, null, 2));
}

function mapSheetRow(r) {
  const num = (v, fallback) => {
    const n = parseFloat(v);
    return isNaN(n) ? fallback : n;
  };
  return {
    category: String(r.category || r.Category || "").trim(),
    item: String(r.item || r.Item || r.name || r.Name || "").trim(),
    unit: String(r.unit || r.Unit || "kg").trim(),
    price: num(r.price || r.Price, 0),
    stock: num(r.stock || r.Stock, 0),
    available: r.available !== undefined
      ? r.available === true || String(r.available).toLowerCase() === "yes" || String(r.available).toLowerCase() === "true"
      : num(r.stock || r.Stock, 0) > 0,
  };
}

async function refreshFromGoogleSheet(force = false) {
  if (!SHEET_WEBAPP_URL) return false;
  if (!force && Date.now() - lastSync < SYNC_TTL_MS) return false;
  try {
    const sep = SHEET_WEBAPP_URL.includes("?") ? "&" : "?";
    const url = `${SHEET_WEBAPP_URL}${sep}products=1&secret=${encodeURIComponent(SHEET_SECRET)}`;
    const json = await getJson(url);
    if (json && Array.isArray(json.catalog) && json.catalog.length) {
      const mapped = json.catalog.map(mapSheetRow).filter((r) => r.item);
      if (mapped.length) {
        data.catalog = mapped;
        persist();
        lastSync = Date.now();
        return true;
      }
    }
    return false;
  } catch (err) {
    console.error("Products sheet sync failed:", err.message);
    return false;
  }
}

function getCategories() {
  const seen = [];
  for (const p of data.catalog) {
    if (!seen.includes(p.category)) seen.push(p.category);
  }
  return seen;
}

function getProductsInCategory(category) {
  return data.catalog.filter(
    (p) => p.category.toLowerCase() === String(category).toLowerCase()
  );
}

function getAllProducts() {
  return data.catalog;
}

function getProductById(id) {
  const cat = getCategories();
  const [catIdx, itemIdx] = String(id).split(".").map(Number);
  const catName = cat[(catIdx || 1) - 1];
  const items = getProductsInCategory(catName);
  const product = items[(itemIdx || 1) - 1];
  return product || null;
}

function getProductByKey(key) {
  const idx = data.catalog.findIndex(
    (p) => `${p.category}.${p.item}` === key
  );
  return idx >= 0 ? data.catalog[idx] : null;
}

function stockAvailable(key, qty) {
  const p = getProductByKey(key);
  return !!(p && p.available && p.stock >= qty);
}

function reduceStock(key, qty) {
  const p = getProductByKey(key);
  if (!p || !p.available || p.stock < qty) return false;
  p.stock -= qty;
  if (p.stock <= 0) p.available = false;
  persist();
  return true;
}

module.exports = {
  refreshFromGoogleSheet,
  getCategories,
  getProductsInCategory,
  getAllProducts,
  getProductById,
  getProductByKey,
  stockAvailable,
  reduceStock,
};