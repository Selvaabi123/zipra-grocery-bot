/* Seed real, working product images from Wikimedia Commons into products.image.
   Idempotent: skips products that already have an image and re-verifies existing URLs.
   Usage:  node scripts/seed-images.js            # apply to DB_PATH (default live data/zipra.db)
           DB_PATH=/tmp/x.db node scripts/seed-images.js --dry-run
*/
process.env.DB_PATH = process.env.DB_PATH || "./data/zipra.db";

const https = require("https");
const db = require("../src/db");

const TERMS = {
  "Ponni Rice": "ponni rice",
  "India Gate Basmati Rice": "basmati rice uncooked",
  "Idly Rice": "idli rice",
  "Toor Dal": "toor dal",
  "Moong Dal": "moong dal D",
  "Chana Dal": "chana dal uncooked",
  "Fortune Sunflower Oil": "sunflower oil bottle",
  "Groundnut Oil": "groundnut oil bottle",
  "Tata Salt": "tata salt",
  "Aashirvaad Sugar": "sugar bowl",
  "Parle-G": "parle-g",
  "Oreo": "oreo",
  "Aashirvaad Atta": "aashirvaad atta",
  "Rice Flour": "rice flour",
  "Tata Tea": "tea leaves tin",
  "Bru Coffee": "instant coffee jar",
  "Aavin Milk": "toned milk",
  "Milk Curd": "curd dahi",
  "Fresh Paneer": "paneer cubes",
};

const BAD_TITLE = /field|flower|plant|pods?$|farm|landscap|crop growing/;

const DRY = process.argv.includes("--dry-run");

// Curated, verified (HTTP 200) Wikimedia Commons images for products whose
// open search matched the wrong thing. Keys are exact product names.
const OVERRIDES = {
  "Toor Dal": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/46/Split_pigeon_peas.jpg/960px-Split_pigeon_peas.jpg",
  "Chana Dal": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/Chana_dal.jpg/960px-Chana_dal.jpg",
  "Fortune Sunflower Oil": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/41/Sunflower_oil_bottles_in_Dnipro.jpg/960px-Sunflower_oil_bottles_in_Dnipro.jpg",
  "Tata Salt": "https://upload.wikimedia.org/wikipedia/commons/thumb/7/7b/Sea_salt.jpg/960px-Sea_salt.jpg",
  "Aashirvaad Sugar": "https://upload.wikimedia.org/wikipedia/commons/thumb/4/47/Sugar.jpg/960px-Sugar.jpg",
  "Oreo": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/21/Oreo.jpg/960px-Oreo.jpg",
  "Aashirvaad Atta": "https://upload.wikimedia.org/wikipedia/commons/thumb/d/df/Wheat_flour.jpg/960px-Wheat_flour.jpg",
  "Tata Tea": "https://upload.wikimedia.org/wikipedia/commons/thumb/c/c8/Tea_leaves.jpg/960px-Tea_leaves.jpg",
  "Bru Coffee": "https://upload.wikimedia.org/wikipedia/commons/thumb/2/26/Instant_coffee.jpg/960px-Instant_coffee.jpg",
  "Aavin Milk": "https://upload.wikimedia.org/wikipedia/commons/thumb/3/38/Glass_of_milk.jpg/960px-Glass_of_milk.jpg",
  "Fresh Paneer": "https://upload.wikimedia.org/wikipedia/commons/2/20/Paneer.jpg",
};

function getJson(url, timeout = 15000) {
  return new Promise((resolve, reject) => {
    const req = https.get(url, { headers: { "User-Agent": "ZipraSeedScript/1.0 (grocery demo)" } }, (res) => {
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        res.resume();
        return getJson(new URL(res.headers.location, url).toString(), timeout).then(resolve, reject);
      }
      if (res.statusCode !== 200) {
        res.resume();
        return reject(new Error(`HTTP ${res.statusCode} for ${url}`));
      }
      let data = "";
      res.on("data", (c) => (data += c));
      res.on("end", () => {
        try {
          resolve(JSON.parse(data));
        } catch (e) {
          reject(e);
        }
      });
    });
    req.on("error", reject);
    req.setTimeout(timeout, () => req.destroy(new Error("timeout")));
  });
}

function headOk(url, timeout = 15000) {
  return new Promise((resolve) => {
    let settled = false;
    const finish = (ok) => {
      if (settled) return;
      settled = true;
      resolve(ok);
    };
    const attempt = (ua, retriesLeft, delayMs) => {
      const req = https.get(url, {
        headers: {
          "User-Agent": ua,
          Accept: "image/avif,image/webp,image/jpeg,image/png,*/*",
          "Accept-Encoding": "gzip, deflate, br",
        },
      }, (res) => {
        res.resume();
        if (res.statusCode === 429 && retriesLeft > 0) {
          setTimeout(() => attempt("ZipraSeedScript/1.0 (retry)", retriesLeft - 1, delayMs * 2), delayMs);
          return;
        }
        finish(res.statusCode === 200);
        res.destroy();
      });
      req.on("error", () => finish(false));
      req.setTimeout(timeout, () => {
        req.destroy(new Error("timeout"));
        finish(false);
      });
    };
    attempt("ZipraSeedScript/1.0 (grocery demo)", 4, 3000);
  });
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function resolveImage(term) {
  const api = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrsearch=${encodeURIComponent(term)}&gsrnamespace=6&gsrlimit=6&prop=imageinfo&iiprop=url|size&iiurlwidth=512&format=json`;
  const json = await getJson(api);
  const pages = json && json.query && json.query.pages ? Object.values(json.query.pages) : [];
  const cands = pages
    .filter((p) => /\.(jpg|jpeg|png|webp)(\?|$)/i.test(p.title))
    .filter((p) => !BAD_TITLE.test(p.title))
    .map((p) => ({
      title: p.title,
      url: p.imageinfo && p.imageinfo[0] ? p.imageinfo[0].thumburl || p.imageinfo[0].url : null,
    }))
    .filter((c) => c.url)
    .map((c) => ({
      ...c,
      url: c.url
        .replace("https://thumb.wikimedia.org", "https://upload.wikimedia.org")
        .split("?")[0],
    }));
  for (const c of cands) {
    if (await headOk(c.url)) return { url: c.url, title: c.title };
    await sleep(700);
  }
  return null;
}

(async () => {
  const products = db.listProducts({});
  const report = [];
  for (const p of products) {
    const existing = String(p.image || "").trim();
    if (existing) {
      const ok = await headOk(existing);
      report.push(`${p.item.padEnd(26)} → verified ${ok ? "OK" : "BROKEN LINK"} (existing)`);
      continue;
    }
    const override = OVERRIDES[p.item];
    if (override) {
      const ok = await headOk(override);
      if (DRY) {
        report.push(`${p.item.padEnd(26)} → would override → ${override} (${ok ? "verified" : "BROKEN!"})`);
      } else if (ok) {
        db.updateProduct(p.id, { image: override });
        report.push(`${p.item.padEnd(26)} → ${override} (curated) ✓`);
      } else {
        report.push(`${p.item.padEnd(26)} → override URL BROKEN (skipped)`);
      }
      continue;
    }
    const term = TERMS[p.item];
    if (!term) {
      report.push(`${p.item.padEnd(26)} → NO TERM (skipped)`);
      continue;
    }
    let url = null;
    try {
      url = await resolveImage(term);
    } catch (e) {
      url = null;
    }
    await sleep(400);
    if (!url) {
      report.push(`${p.item.padEnd(26)} → no usable image found`);
      continue;
    }
    if (DRY) {
      report.push(`${p.item.padEnd(26)} → would set ${url.url} (${url.title.replace("File:", "")})`);
      continue;
    }
    db.updateProduct(p.id, { image: url.url });
    report.push(`${p.item.padEnd(26)} → ${url.url} ✓`);
  }
  console.log(report.join("\n"));
  const withImg = db.listProducts({}).filter((p) => String(p.image || "").trim());
  console.log(`\n${withImg.length}/${db.listProducts({}).length} products now have images${DRY ? " (dry run)" : ""}`);
})();