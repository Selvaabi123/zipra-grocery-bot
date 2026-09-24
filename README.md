# Zipra - WhatsApp Grocery Ordering Bot

Complete interactive WhatsApp shopping experience (rules-based FSM, no AI needed) with a production admin dashboard backed by **SQLite**.

## Features
- 🛒 Welcome menu (interactive list): Shop / Track / My Orders / Help
- 🛍️ Shop by category (7 categories, interactive lists)
- ⚡ **Multi-select quick-add**: tap many products in one list (×1 each), then `Done - Cart & Checkout`
- 📦 Cart → **Change Quantity** (set any qty within stock) / Remove Item / Add More / Checkout
- 📍 Checkout: name → **delivery location** (WhatsApp 📍 share OR typed address) → payment
- 🧾 Online payment shows `upi://pay` link (+ optional `PAYMENT_LINK`), COD option too
- 📦 Order review shows Google Maps link when customer shared a location
- 📦 Live order tracking (timeline) + 🔄 refresh status
- 🛠️ Admin dashboard: Orders, Products, Inventory, Customers, Delivery Partners, Reports, Promotions, Settings — all served by the backend REST API from SQLite

## Stack
- **Node.js + Express** server (`server.js`) — WhatsApp webhook + REST API + serves `/admin`
- **SQLite** database (`data/zipra.db`, via built-in `node:sqlite`) — single source of truth
- **Tailscale Funnel** — exposes the webhook publicly (`https://zipra-bot.tail18cb0d.ts.net/webhook`)

No external database, no Google Sheets, no third-party sync — products and orders live in SQLite and survive server restarts.

## Files
| File | Use |
|------|-----|
| `src/server.js` | Express + webhook + admin REST API + notifications |
| `src/db.js` | SQLite schema, seeds, queries, reports, settings |
| `src/bot.js` | Interactive FSM (all states) |
| `src/products.js` / `src/products.json` | Product catalog + stock (DB-backed / seed) |
| `src/orders.js` | Orders (DB-backed) |
| `src/admin.js` | Admin dashboard (SPA, talks to `/api/*`) |
| `src/net.js` | HTTP client (WhatsApp Graph API sends) |
| `scripts/test-bot.js` / `scripts/test-api.js` | Automated tests (`npm test`) |
| `scripts/simulate.js` | Terminal simulator (`npm run simulate`) |
| `scripts/backup-db.sh` | Hourly SQLite safe backup (WAL snapshot) |
| `api/index.js` | Vercel serverless entry (webhook relay) |
| `netlify/functions/index.js` | Netlify serverless entry |

```
grocery-bot/
├── src/               # application code (server, db, bot, admin)
├── api/               # Vercel serverless entry
├── netlify/           # Netlify serverless entry
├── netlify.toml       # Netlify config
├── vercel.json        # Vercel config
├── scripts/           # tests + tools
├── data/              # SQLite database (gitignored, runtime only)
├── .env.example       # env template (copy to .env)
└── package.json
```

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

### Run
```bash
cp .env.example .env   # fill values
npm install
npm test               # automated tests
npm run simulate       # try it in the terminal
npm start              # run server (webhook)
```

Database is created and seeded automatically at `data/zipra.db` on first start.

### Admin panel (live server)
Open `http://localhost:3000/admin` (or `https://<your-server>/admin`)
- See new orders + status
- Advance status → customer gets automatic WhatsApp notification
- Mark online payments as Paid
- Manage products, stock, customers, delivery partners, promotions, settings

## Order statuses
`received 🟡 → confirmed ✅ → preparing 🟠 → out_for_delivery 🛵 → delivered 🎉`
`cancelled 🔴` (anytime before delivered)

## Online payment
Optional: set `PAYMENT_UPI_ID` (and optionally `PAYMENT_LINK`) in `.env`. Bot sends `upi://pay` + pay link with amount & order no. Payment status starts `Pending`; admin marks `Paid` after actual verification (never auto-marked).

## Delivery location
During checkout the customer can share a WhatsApp 📍 (location message) — no typing needed. The order stores lat/lng and the admin panel + customer receipt show a Google Maps link.

## Stock
Stock lives per product in SQLite. Order confirm revalidates stock, reduces stock, prevents negative stock; cancelling/deleting an order restores stock.
