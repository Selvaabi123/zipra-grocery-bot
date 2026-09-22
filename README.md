# Zipra - WhatsApp Grocery Ordering Bot

Complete interactive WhatsApp shopping experience (rules-based FSM, no AI needed).

## Features
- 🛒 Welcome menu (interactive list): Shop / Track / My Orders / Help
- 🛍️ Shop by category (7 categories, interactive lists)
- ⚡ **Multi-select quick-add**: tap many products in one list (×1 each), then `Done - Cart & Checkout`
- 📦 Cart → **Change Quantity** (set any qty within stock) / Remove Item / Add More / Checkout
- 📍 Checkout: name → **delivery location** (WhatsApp 📍 share OR typed address) → payment
- 🧾 Online payment shows `upi://pay` link (+ optional `PAYMENT_LINK`), COD option too
- 📦 Order review shows Google Maps link when customer shared a location
- 📊 Products **live-synced from Google Sheet** (auto every 5 min + admin "Sync Products" button)
- 📦 Live order tracking (timeline) + 🔄 refresh status
- 🛠️ Admin panel: orders, status advance, Mark Paid, maps link, product sync

## Files
| File | Use |
|------|-----|
| `server.js` | Express + webhook + admin API + notifications + sheet sync timer |
| `bot.js` | Interactive FSM (all states) |
| `products.js` / `products.json` | Product catalog + stock (with `refreshFromGoogleSheet`) |
| `orders.js` | Order database (JSON store `orders.json`) |
| `sheets.js` | Mirror orders to Google Sheet (optional) |
| `scripts/test-bot.js` | Automated full-flow tests (`npm test`) |
| `scripts/simulate.js` | Terminal simulator (`npm run simulate`) |
| `scripts/Code.gs` | Google Apps Script web app for Google Sheet (orders + products) |

## Setup

### WhatsApp API (free)
1. `business.facebook.com` → WhatsApp Business Account (number: your store no.)
2. `developers.facebook.com` → app → WhatsApp → Cloud API
3. Copy to `.env`:
   - `WHATSAPP_TOKEN`
   - `PHONE_NUMBER_ID`
   - `WHATSAPP_BUSINESS_ID`
4. Set webhook callback URL (Meta → WhatsApp → Configuration → Webhook):
   - Callback URL: `https://<your-server>/webhook`
   - Verify token: `my_verify_token_123`

### Google Sheet (products + order mirror)
1. `sheets.new` → rename first tab **Products** with headers `Category | Item | Unit | Price | Stock | Available`
2. Extensions → Apps Script → paste **the full `scripts/Code.gs`** (replace whatever is there) → save
3. Deploy → New deployment → **Web app** (Execute as *Me*, Who has access *Anyone*) → deploy
4. Put the new URL in `.env` → `SHEET_WEBAPP_URL` (keep `SHEET_SECRET` in sync with `scripts/Code.gs` top)
5. Restart server → `/admin` → *"🔄 Sync Products from Google Sheet"* → products update (auto-refreshes every 5 min too)
   - Table style: `Category` (exact name, e.g. `Rice`), `Item`, `Unit` (e.g. `kg`), `Price` (number), `Stock` (number), `Available` (`yes`/`no`)

### Run
```bash
cp .env.example .env   # fill values
npm install
npm test               # automated tests
npm run simulate       # try it in the terminal
npm start              # run server (webhook)
```

### Admin panel (live server)
Open `http://localhost:3000/admin` (or `https://<your-server>/admin`)
- See new orders + status
- Advance status → customer gets automatic WhatsApp notification
- Mark online payments as Paid

## Order statuses
`received 🟡 → confirmed ✅ → preparing 🟠 → out_for_delivery 🛵 → delivered 🎉`
`cancelled 🔴` (anytime before delivered)

## Online payment
Optional: set `PAYMENT_UPI_ID` (and optionally `PAYMENT_LINK`) in `.env`. Bot sends `upi://pay` + pay link with amount & order no. Payment status starts `Pending`; admin marks `Paid` after actual verification (never auto-marked).

## Delivery location
During checkout the customer can share a WhatsApp 📍 (location message) — no typing needed. The order stores lat/lng and the admin panel + customer receipt show a Google Maps link.

## Stock
`products.json` → `stock` per product. Order confirm revalidates stock, reduces stock, prevents negative stock.