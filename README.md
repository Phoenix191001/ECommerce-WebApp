# Multi-Tenant Ecommerce Platform

A Super Admin panel that creates and manages store instances, and a storefront that serves each
instance from its own subdomain and its own MongoDB database. Built from the SRS
("SRS - Multi-Tenant Ecommerce Platform").

**Stack:** Next.js 16 (App Router) on Vercel · MongoDB Atlas via Mongoose · Tailwind CSS.

## What's built

- **Super Admin** (`/admin`): two-factor sign-in, stores, plans, per-store feature switches with locks, owner setup links, sign in as owner, export/delete, audit log.
- **Store owner panel** (`/manage`): setup wizard, dashboard, products (variants, sale prices, volume and wholesale prices, scheduling, tags, CSV import and bulk edit), orders (editing, refunds with two-person approval, packing slips, fraud flags), returns and exchanges, support tickets, customers (segments, store credit, wholesale), discounts, staff and attendance, profit report, content pages and blog, settings, custom domains, developer API and webhooks.
- **Storefront**: product pages, cart and checkout (cash on delivery, delivery slots, gift wrap, points and credit), accounts (addresses, returns, support, two-factor), wishlist, reviews, Q&A, compare, recently viewed, typo-tolerant search, Urdu with right-to-left layout, dark mode, sitemap, product feed, installable app manifest.
- **POS**: shifts, barcode scanning (per variant), cash sales, refunds with manager PIN, receipts.

The feature guide at `/guide` lists all 122 switches. 98 work today; the rest are marked "Coming soon" and mostly need outside services (payment gateways, SMS, social login, AI, file storage).

## Tests

```bash
npm test                                    # unit tests: feature rules, pricing, search, CSV, URL safety
npm run test:e2e -- <previewUrl> <shareToken>   # full browser walk-through (Playwright)
node tests/e2e/features.cjs <previewUrl> <shareToken>  # extended features walk-through
```

Run the browser tests only against a preview whose `PLATFORM_DB_NAME` points at a throwaway database.

## Run locally

```bash
cp .env.example .env.local   # then fill in MONGODB_URI and AUTH_SECRET
npm install
npm run dev
```

- Platform and admin panel: http://localhost:3000/admin — the first visit asks you to create the Super Admin.
- A store with subdomain `demo`: http://demo.localhost:3000 (or http://localhost:3000/s/demo).

## Routing

`src/proxy.ts` reads the host name. `<sub>.NEXT_PUBLIC_ROOT_DOMAIN` is rewritten to `/s/<sub>`, so each
store only ever sees its own data. While the app runs on a `*.vercel.app` address (which has no
wildcard subdomains), stores are reached at `/s/<subdomain>`. Once a real domain with a wildcard
record (`*.yourplatform.com`) is added in Vercel, set `NEXT_PUBLIC_ROOT_DOMAIN` to it.

## Data layout

- `platform` database: `plans`, `instances` (with toggle states and locks), `auditlogs`, `superadmins`.
- `inst_<instanceId>` database per store: `products` (and later orders, customers, carts…).
