# Multi-Tenant Ecommerce Platform

A Super Admin panel that creates and manages store instances, and a storefront that serves each
instance from its own subdomain and its own MongoDB database. Built from the SRS
("SRS - Multi-Tenant Ecommerce Platform").

**Stack:** Next.js 16 (App Router) on Vercel · MongoDB Atlas via Mongoose · Tailwind CSS.

## What's in this first version

| Area | Status |
|---|---|
| Feature toggle catalog F-01 to F-122 with prerequisites (`src/lib/features.ts`) | ✅ |
| Super Admin first-run setup and sign-in (bcrypt passwords, signed session cookie) | ✅ |
| Create instances with subdomain validation and plan (FR-A-01, FR-U-03) | ✅ |
| Toggle features per instance; block when a prerequisite is off, one-click fix (FR-A-02/03, UX-03) | ✅ |
| Lock toggles so the Store Owner can't change them (AC-02) | ✅ |
| Plan templates "Starter" and "Pro" (FR-A-04) | ✅ |
| Suspend and resume with maintenance page (FR-A-05) | ✅ |
| Audit log of every admin change (FR-A-07, AC-07) | ✅ |
| Database per instance, `inst_<instanceId>` (SRS 7.2, NFR-01) | ✅ |
| Host-name routing: `<sub>.<root domain>` → store (FR-U-02) | ✅ |
| Storefront product grid and search (F-01, F-05) | ✅ basic |
| Super Admin two-factor login (FR-A-08) | ⏳ next |
| Store Owner panel, staff roles, cart, checkout, payments, POS | ⏳ next |
| Custom domains through the Vercel Domains API (F-89, FR-U-04…07) | ⏳ next |

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
