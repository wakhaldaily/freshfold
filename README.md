# FreshFold Laundry POS

A local-first laundry counter app for customer records, piece and weight orders, package benefits, wallet payments, and invoices.

## Run locally

```sh
npm install
npm run dev
```

Open the local URL printed by Vite. The browser saves demo records in `localStorage`, so it works without an account or database. Clear this local site's browser storage if you want to reset the demo; there is no in-app reset button yet.

The starting workspace uses sample customers and orders. Create a customer, open their workspace, build an order, review the invoice, and try a wallet payment. Package discounts use the single best active discount; wallet credit must cover the full remaining order balance to pay by wallet.

## Optional Neon database

The app includes a Cloudflare Worker API and PostgreSQL schema. When the API can reach a configured database it uses Neon; without one, the app automatically stays in local browser-storage mode.

1. Create a Neon Postgres database and copy its pooled connection string.
2. Apply the schema from this folder:

   ```sh
   DATABASE_URL='your-neon-connection-string' npm run db:setup
   ```

3. For local full-stack development, run the Worker and Vite side by side (Vite proxies `/api` to `127.0.0.1:8787`; it never talks to the deployed Worker). Use a development database in `.dev.vars`, not production:

   ```sh
   npm run dev:api   # wrangler dev, reads DATABASE_URL from .dev.vars
   npm run dev       # in a second terminal
   ```

4. For Cloudflare deployment, authenticate with Wrangler and set the database secret:

   ```sh
   npx wrangler login
   npx wrangler secret put DATABASE_URL
   npm run deploy
   ```

5. Open the deployed site. If the database has no administrator yet, the sign-in screen offers **first-run setup** to create the store owner account. Only the first administrator can be created this way; later admins and staff PINs are managed in Settings.

`wrangler.jsonc` serves the Vite build as static assets and routes `/api/*` to the Worker. The schema lives in `src/server/schema.js` (`schema.sql` is generated from it with `npm run db:schema`); the Worker applies it automatically when the stored schema version is behind.

## Security model (database mode)

- Every API route except health, sign-in, first-run setup, password recovery and public bills requires a bearer session. Settings, staff, administrators, package templates and customer deletion need an admin session.
- Passwords, PINs and security answers are bcrypt hashes (pgcrypto) and are never returned by the API. Older plaintext values are hashed automatically on the first request after upgrading.
- Failed sign-in, recovery and bill-link attempts are rate limited per IP (15-minute window).
- Prices, discounts, express surcharges, tax and wallet deductions are computed on the server from the catalog. Order, payment and package writes are single atomic statements with row locks.
- Public bill links carry a random per-order token issued by the server and show a masked mobile number.
- Demo logins (PINs 1234/0000/2222, `admin@freshfold.test`) only work when `ALLOW_DEMO_ACCOUNTS` is `"true"` in `wrangler.jsonc`. Keep it `"false"` for real stores.
- Browser-only mode (no API) keeps everything in `localStorage` and is meant for demos only.

## Current scope and next build

- Customer book, search, customer details, notes, outstanding totals, active packages, and order history.
- Piece order builder with garment categories, service pricing, quantities, promised date, discount preview, and cart.
- Weight order builder with service-specific per-kg rates and an optional batch note.
- Order detail, processing status, payment capture, invoice preview, and browser print.
- Package sale with cash, UPI, or card collection; wallet credit and discount plans.
- Neon-backed API plus a local browser-storage mode.

Before using real customer or billing data, configure your applicable tax and invoice details and confirm package eligibility/expiry rules. Tax is deliberately shown as **not configured** and calculates as ₹0 in this prototype. Printer/scanner/scale integration and customer notifications are not connected yet.

## Free-tier deployment target

This project targets Cloudflare Workers static assets + Worker API and Neon Postgres. Both services offer free tiers with usage and resource limits; check the current limits before a store pilot. The database connection string belongs in Worker secrets, never in frontend code or source control.
