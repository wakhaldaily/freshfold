/**
 * Single source of truth for the database schema.
 *
 * - `scripts/setup-db.mjs` runs these statements against a fresh or existing database.
 * - The Worker runs them once per isolate when the stored schema version is behind,
 *   so a deployed database upgrades itself (plaintext credentials get hashed, new
 *   columns appear) without a manual migration step.
 * - `schema.sql` is generated from this file (`npm run db:schema`) for reference.
 *
 * Every statement is idempotent.
 */
import { initialPackageCatalog } from '../data.js';

export const SCHEMA_VERSION = 3;

const BCRYPT_PATTERN = '^[$]2[aby][$]';

const legacyTemplates = [
  { id: 'wallet-2000', name: 'Everyday Wallet', description: 'Add ₹2,000 laundry credit. Use toward any bill. No expiration.', kind: 'wallet', price: 2000, walletCredit: 2000, discountPercent: 0, accent: 'violet' },
  { id: 'fresh-15', name: 'Fresh Club · 15% off', description: 'Save 15% on eligible laundry anytime. Lifetime package.', kind: 'discount', price: 1800, walletCredit: 0, discountPercent: 15, accent: 'mint' },
  { id: 'half-price', name: 'Half Price Privilege', description: 'Flat 50% off eligible garments with no validity expiration.', kind: 'discount', price: 6000, walletCredit: 0, discountPercent: 50, accent: 'peach' },
];

const RULE_KEYS = [
  'applicableService', 'applicableOrderType', 'applicableCategory', 'targetGarments',
  'targetKeywords', 'minQty', 'buyQty', 'freeQty', 'validity', 'durationDays',
];

export function pickTemplateRules(pkg = {}) {
  const rules = {};
  for (const key of RULE_KEYS) {
    if (pkg[key] !== undefined) rules[key] = pkg[key];
  }
  return rules;
}

function templateSeed(pkg) {
  return {
    text: `INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, $8, true, $9::jsonb)
ON CONFLICT (id) DO NOTHING`,
    params: [
      pkg.id, pkg.name, pkg.description, pkg.kind, pkg.price, pkg.walletCredit || 0,
      pkg.discountPercent || 0, pkg.accent || 'violet', JSON.stringify(pickTemplateRules(pkg)),
    ],
  };
}

const ddl = (text) => ({ text: text.trim(), params: [] });

/** Ordered list of `{ text, params }` statements. */
export const SCHEMA_STATEMENTS = [
  ddl(`CREATE EXTENSION IF NOT EXISTS pgcrypto`),

  // --- Customers ---
  ddl(`CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`),
  ddl(`ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb`),
  ddl(`CREATE UNIQUE INDEX IF NOT EXISTS customers_mobile_unique ON customers (mobile)`),

  // --- Package templates ---
  ddl(`CREATE TABLE IF NOT EXISTS package_templates (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  kind TEXT NOT NULL CHECK (kind IN ('wallet', 'discount', 'half_price', 'buy_x_get_y', 'special')),
  price NUMERIC(12,2) NOT NULL CHECK (price >= 0),
  wallet_credit NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (wallet_credit >= 0),
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0 CHECK (discount_percent BETWEEN 0 AND 100),
  duration_days INTEGER NULL,
  accent TEXT NOT NULL DEFAULT 'violet',
  enabled BOOLEAN NOT NULL DEFAULT true,
  rules JSONB NOT NULL DEFAULT '{}'::jsonb
)`),
  ddl(`ALTER TABLE package_templates ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{}'::jsonb`),
  ...legacyTemplates.map(templateSeed),
  ...initialPackageCatalog.map(templateSeed),

  // --- Customer packages ---
  ddl(`CREATE TABLE IF NOT EXISTS customer_packages (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  template_id TEXT NOT NULL REFERENCES package_templates(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  wallet_credit NUMERIC(12,2) NOT NULL DEFAULT 0,
  remaining_credit NUMERIC(12,2) NULL,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  starts_at DATE NOT NULL,
  expires_at DATE NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`),
  ddl(`ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS remaining_credit NUMERIC(12,2) NULL`),
  ddl(`CREATE INDEX IF NOT EXISTS customer_packages_customer_idx ON customer_packages (customer_id, expires_at)`),

  // --- Orders ---
  ddl(`CREATE TABLE IF NOT EXISTS orders (
  id TEXT PRIMARY KEY,
  order_no TEXT NOT NULL UNIQUE,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  order_type TEXT NOT NULL CHECK (order_type IN ('pieces', 'weight')),
  service TEXT NOT NULL,
  items JSONB NOT NULL DEFAULT '[]'::jsonb,
  weight_kg NUMERIC(8,3) NOT NULL DEFAULT 0,
  weight_note TEXT NOT NULL DEFAULT '',
  gross_amount NUMERIC(12,2) NOT NULL,
  discount_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  discount_name TEXT NOT NULL DEFAULT '',
  express_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  express_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  express_label TEXT NOT NULL DEFAULT '',
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Received',
  due_date DATE NOT NULL,
  extra JSONB NOT NULL DEFAULT '{}'::jsonb,
  share_token TEXT NULL,
  created_by TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`),
  ddl(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS express_percent NUMERIC(5,2) NOT NULL DEFAULT 0`),
  ddl(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS express_amount NUMERIC(12,2) NOT NULL DEFAULT 0`),
  ddl(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS express_label TEXT NOT NULL DEFAULT ''`),
  ddl(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb`),
  ddl(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS share_token TEXT NULL`),
  ddl(`ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT ''`),
  ddl(`DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_amounts_nonnegative') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_amounts_nonnegative
      CHECK (paid_amount >= 0 AND balance_amount >= 0 AND total_amount >= 0) NOT VALID;
  END IF;
END $$`),
  ddl(`CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders (customer_id, created_at DESC)`),
  ddl(`CREATE INDEX IF NOT EXISTS orders_status_due_idx ON orders (status, due_date)`),
  ddl(`CREATE UNIQUE INDEX IF NOT EXISTS orders_share_token_idx ON orders (share_token) WHERE share_token IS NOT NULL`),

  // --- Payments & ledgers ---
  ddl(`CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`),
  ddl(`CREATE TABLE IF NOT EXISTS package_sales (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  customer_package_id TEXT NOT NULL REFERENCES customer_packages(id),
  template_id TEXT NOT NULL REFERENCES package_templates(id),
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`),
  ddl(`CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  customer_package_id TEXT REFERENCES customer_packages(id),
  order_id TEXT REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'debit', 'adjustment')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`),
  ddl(`CREATE INDEX IF NOT EXISTS wallet_transactions_customer_idx ON wallet_transactions (customer_id, created_at DESC)`),

  // --- Settings (id 'current' = store config, 'catalog' = add-ons/tags, 'schema' = version) ---
  ddl(`CREATE TABLE IF NOT EXISTS store_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  config JSONB NOT NULL
)`),

  // --- Staff (PINs are bcrypt hashes) ---
  ddl(`CREATE TABLE IF NOT EXISTS staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pin TEXT NOT NULL
)`),
  ddl(`INSERT INTO staff_members (id, name, role, pin)
VALUES
  ('staff-admin', 'Store Manager', 'admin', crypt('1234', gen_salt('bf', 10))),
  ('staff-cashier1', 'Cashier 1', 'cashier', crypt('0000', gen_salt('bf', 10))),
  ('staff-cashier2', 'Cashier 2', 'cashier', crypt('2222', gen_salt('bf', 10)))
ON CONFLICT (id) DO NOTHING`),

  // --- Administrators (password and security answer are bcrypt hashes) ---
  ddl(`CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  security_question TEXT NOT NULL DEFAULT 'What city is this store in?',
  security_answer TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`),
  ddl(`CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (LOWER(email))`),

  // --- Sessions (only a SHA-256 of the bearer token is stored) ---
  ddl(`CREATE TABLE IF NOT EXISTS sessions (
  token_hash TEXT PRIMARY KEY,
  principal_type TEXT NOT NULL CHECK (principal_type IN ('staff', 'admin')),
  principal_id TEXT NOT NULL,
  name TEXT NOT NULL DEFAULT '',
  email TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL,
  elevated_admin_id TEXT NULL,
  elevated_admin_name TEXT NULL,
  elevated_admin_email TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL
)`),
  ddl(`CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at)`),
  ddl(`CREATE INDEX IF NOT EXISTS sessions_principal_idx ON sessions (principal_id)`),

  // --- Failed auth attempts for rate limiting ---
  ddl(`CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
)`),
  ddl(`CREATE INDEX IF NOT EXISTS auth_attempts_bucket_idx ON auth_attempts (bucket, created_at)`),

  // --- Data migrations: hash any plaintext credentials left by older versions ---
  ddl(`UPDATE staff_members SET pin = crypt(pin, gen_salt('bf', 10)) WHERE pin !~ '${BCRYPT_PATTERN}'`),
  ddl(`UPDATE admin_users SET password = crypt(password, gen_salt('bf', 10)) WHERE password !~ '${BCRYPT_PATTERN}'`),
  ddl(`UPDATE admin_users SET security_answer = crypt(lower(trim(security_answer)), gen_salt('bf', 10))
WHERE security_answer <> '' AND security_answer !~ '${BCRYPT_PATTERN}'`),
  // Older versions mirrored admin credentials into the public settings blob.
  ddl(`UPDATE store_settings SET config = config - 'admins' WHERE config ? 'admins'`),

  {
    text: `INSERT INTO store_settings (id, config) VALUES ('schema', $1::jsonb)
ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config`,
    params: [JSON.stringify({ version: SCHEMA_VERSION })],
  },
];

function literal(value) {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'number') return String(value);
  return `'${String(value).replace(/'/g, "''")}'`;
}

/** Renders the statements as a plain SQL file (parameters inlined as literals). */
export function renderSchemaSql() {
  const header = '-- Generated from src/server/schema.js by `npm run db:schema`. Do not edit by hand.\n';
  const body = SCHEMA_STATEMENTS.map(({ text, params }) =>
    text.replace(/\$(\d+)/g, (_, i) => literal(params[Number(i) - 1]))).join(';\n\n');
  return `${header}\n${body};\n`;
}
