const db = require("./db");

function getCategories() {
  return db.categories();
}

function getProductsInCategory(category) {
  return db.listProducts({ category });
}

function getAllProducts() {
  return db.listProducts({});
}

function getProductById(id) {
  return db.getProductById(id);
}

function getProductByKey(key) {
  return db.getProductByKey(key);
}

function stockAvailable(key, qty) {
  return db.stockAvailable(key, qty);
}

function reduceStock(key, qty) {
  return db.reduceStock(key, qty);
}

module.exports = {
  getCategories,
  getProductsInCategory,
  getAllProducts,
  getProductById,
  getProductByKey,
  stockAvailable,
  reduceStock,
};