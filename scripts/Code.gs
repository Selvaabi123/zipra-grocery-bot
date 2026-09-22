var SECRET = "mysecret123";

function doPost(e) {
  try {
    var data = JSON.parse(e.postData.contents);
    if (data.secret !== SECRET) return json({ ok: false, error: "bad secret" });
    if (data.action === "setup") return setup_(data);
    if (data.action === "syncCatalog") return syncCatalog_(data);
    if (data.action === "updateStatus") return updateStatus_(data);
    return appendOrders_(data);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function findTab_(name) {
  var tabs = SpreadsheetApp.getActiveSpreadsheet().getSheets();
  for (var i = 0; i < tabs.length; i++) {
    if (tabs[i].getName().toLowerCase() === String(name).toLowerCase()) return tabs[i];
  }
  return null;
}

function onlyProducts_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var tabs = ss.getSheets();
  var keep = null;
  for (var i = 0; i < tabs.length; i++) {
    var n = tabs[i].getName();
    if (n.toLowerCase() !== "products") continue;
    if (!keep) { if (n !== "Products") tabs[i].setName("Products"); keep = tabs[i]; }
    else ss.deleteSheet(tabs[i]);
  }
  return keep || ss.insertSheet("Products");
}

function styleHead_(s, r, c, rn, cn) {
  s.getRange(r, c, rn, cn).setFontWeight("bold").setBackground("#1154cc").setFontColor("#ffffff");
}

function ensureOrders_() {
  var sheet = findTab_("Orders") || SpreadsheetApp.getActiveSpreadsheet().insertSheet("Orders");
  if (String(sheet.getRange(1, 1).getValue()) !== "OrderNo") {
    sheet.getRange(1, 1, 1, 10).setValues([
      ["OrderNo", "Date", "Time", "Customer", "Item", "Unit", "Qty", "Price", "Total", "Status"],
    ]);
    styleHead_(sheet, 1, 1, 1, 10);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function appendOrders_(data) {
  var sheet = ensureOrders_();
  if (data.rows && data.rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, data.rows.length, data.rows[0].length).setValues(data.rows);
  }
  return json({ ok: true });
}

function syncCatalog_(data) {
  var sheet = onlyProducts_();
  var rows = (data.catalog || []).map(function (p) {
    return [p.category, p.item, p.unit, p.price, p.stock, p.available ? "yes" : "no"];
  });
  sheet.clear();
  sheet.getRange(1, 1, 1, 6).setValues([["Category", "Item", "Unit", "Price", "Stock", "Available"]]);
  styleHead_(sheet, 1, 1, 1, 6);
  if (rows.length) {
    sheet.getRange(2, 1, rows.length, 6).setValues(rows);
    for (var i = 2; i <= rows.length + 1; i++) {
      sheet.getRange(i, 1, 1, 6).setBackground(i % 2 === 0 ? "#eef1f6" : "#ffffff");
    }
  }
  sheet.setFrozenRows(1);
  return json({ ok: true, message: "Products updated: " + rows.length + " items" });
}

function updateStatus_(data) {
  var sheet = findTab_("Orders");
  if (!sheet) return json({ ok: false, error: "Orders tab missing" });
  var id = String(data.orderNo || ""), st = String(data.status || "");
  var rows = sheet.getDataRange().getValues(), n = 0;
  for (var i = 1; i < rows.length; i++) {
    if (String(rows[i][0]) === id) { rows[i][9] = st; n++; }
  }
  if (n) sheet.getRange(2, 10, rows.length - 1, 1).setValues(rows.slice(1).map(function (r) { return [r[9]]; }));
  return json({ ok: true, updated: n });
}

function setup_(data) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  syncCatalog_(data);
  var ord = ensureOrders_();
  var ov = ord.getDataRange().getValues(), rows = 0, rev = 0;
  for (var i = 1; i < ov.length; i++) {
    if (!String(ov[i][0])) continue;
    rows++;
    var tl = parseFloat(ov[i][8]);
    if (!isNaN(tl)) rev += tl;
  }
  var dash = findTab_("Dashboard") || ss.insertSheet("Dashboard");
  dash.clear();
  dash.getRange("A1").setValue("ZIPRA GROCERY — LIVE DASHBOARD").setFontSize(18).setFontWeight("bold").setFontColor("#ffffff").setBackground("#1154cc");
  dash.getRange("A2:F2").setBackground("#1154cc");
  dash.getRange("A3").setValue("Products Listed").setFontWeight("bold");
  dash.getRange("B3").setValue((data.catalog || []).length);
  dash.getRange("A4").setValue("Order Lines").setFontWeight("bold");
  dash.getRange("B4").setValue(rows);
  dash.getRange("A5").setValue("Revenue (₹)").setFontWeight("bold");
  dash.getRange("B5").setValue(Math.round(rev * 100) / 100);
  dash.getRange("A6").setValue("Last Updated").setFontWeight("bold");
  dash.getRange("B6").setValue(new Date());
  dash.getRange("A3:B6").setBackground("#eef1f6");
  dash.setColumnWidth(1, 160);
  return json({ ok: true, message: "Dashboard + Orders + Products ready (" + rows + " lines, ₹" + Math.round(rev) + ")" });
}

function doGet(e) {
  try {
    var q = (e && e.parameter) || {};
    if (q.secret !== SECRET) return json({ ok: false, error: "bad secret" });
    if (q.status === "1") {
      var ss = SpreadsheetApp.getActiveSpreadsheet();
      return json({ spreadsheet: ss.getName(), id: ss.getId(), tabs: ss.getSheets().map(function (s) { return s.getName(); }) });
    }
    if (q.products === "1") {
      var sheet = findTab_("Products");
      if (!sheet) return json({ catalog: [], notice: "Products tab missing" });
      var data = sheet.getDataRange().getValues();
      var head = data[0];
      var g = function (r, n) {
        var i = head.map(function (h) { return String(h).toLowerCase(); }).indexOf(String(n).toLowerCase());
        return i >= 0 ? r[i] : "";
      };
      var catalog = [];
      for (var i = 1; i < data.length; i++) {
        var stock = parseFloat(g(data[i], "stock"));
        var av = String(g(data[i], "available")).toLowerCase();
        var rec = {
          category: String(g(data[i], "category")),
          item: String(g(data[i], "item") || g(data[i], "name")),
          unit: String(g(data[i], "unit") || "kg"),
          price: parseFloat(g(data[i], "price")) || 0,
          stock: isNaN(stock) ? 0 : stock,
          available: av ? av === "yes" : isNaN(stock) ? true : stock > 0,
        };
        if (rec.item) catalog.push(rec);
      }
      return json({ catalog: catalog });
    }
    if (q.orders === "1") {
      var sheet = findTab_("Orders");
      if (!sheet) return json({ orders: [] });
      var rows = sheet.getDataRange().getValues();
      var head = rows[0];
      var g = function (r, n) {
        var i = head.map(function (h) { return String(h).toLowerCase(); }).indexOf(String(n).toLowerCase());
        return i >= 0 ? r[i] : "";
      };
      var out = [];
      for (var i = 1; i < rows.length; i++) {
        var id = String(g(rows[i], "orderno"));
        if (!id) continue;
        out.push({
          id: id,
          date: String(g(rows[i], "date")),
          time: String(g(rows[i], "time")),
          customer: String(g(rows[i], "customer")),
          item: String(g(rows[i], "item")),
          unit: String(g(rows[i], "unit") || "kg"),
          qty: parseFloat(g(rows[i], "qty")) || 0,
          price: parseFloat(g(rows[i], "price")) || 0,
          total: parseFloat(g(rows[i], "total")) || 0,
          status: String(g(rows[i], "status")) || "received",
        });
      }
      return json({ orders: out });
    }
    return ContentService.createTextOutput("Zipra webhook OK").setMimeType(ContentService.MimeType.TEXT);
  } catch (err) {
    return json({ ok: false, error: String(err) });
  }
}

function json(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}