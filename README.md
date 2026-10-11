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

3. For local full-stack preview, build the UI and run the Worker:

   ```sh
   npm run dev:cloud
   ```

4. For Cloudflare deployment, authenticate with Wrangler and set the database secret:

   ```sh
   npx wrangler login
   npx wrangler secret put DATABASE_URL
   npm run deploy
   ```

`wrangler.jsonc` serves the Vite build as static assets and routes `/api/*` to the Worker. The Worker recalculates garment and weight prices, applies the best active package discount, records customer/package/order/payment data, and blocks insufficient wallet payments. The DB setup file seeds the three package templates.

## Current scope and next build

- Customer book, search, customer details, notes, outstanding totals, active packages, and order history.
- Piece order builder with garment categories, service pricing, quantities, promised date, discount preview, and cart.
- Weight order builder with service-specific per-kg rates and an optional batch note.
- Order detail, processing status, payment capture, invoice preview, and browser print.
- Package sale with cash, UPI, or card collection; wallet credit and discount plans.
- Neon-backed API plus a local browser-storage mode.

Before using real customer or billing data, add staff sign-in and role permissions, configure your applicable tax and invoice details, and confirm package eligibility/expiry rules. Tax is deliberately shown as **not configured** and calculates as ₹0 in this prototype. Printer/scanner/scale integration and customer notifications are not connected yet.

## Free-tier deployment target

This project targets Cloudflare Workers static assets + Worker API and Neon Postgres. Both services offer free tiers with usage and resource limits; check the current limits before a store pilot. The database connection string belongs in Worker secrets, never in frontend code or source control.
