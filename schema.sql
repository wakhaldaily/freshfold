-- Generated from src/server/schema.js by `npm run db:schema`. Do not edit by hand.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
  profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE UNIQUE INDEX IF NOT EXISTS customers_mobile_unique ON customers (mobile);

CREATE TABLE IF NOT EXISTS package_templates (
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
);

ALTER TABLE package_templates ADD COLUMN IF NOT EXISTS rules JSONB NOT NULL DEFAULT '{}'::jsonb;

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ('wallet-2000', 'Everyday Wallet', 'Add ₹2,000 laundry credit. Use toward any bill. No expiration.', 'wallet', 2000, 2000, 0, NULL, 'violet', true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ('fresh-15', 'Fresh Club · 15% off', 'Save 15% on eligible laundry anytime. Lifetime package.', 'discount', 1800, 0, 15, NULL, 'mint', true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ('half-price', 'Half Price Privilege', 'Flat 50% off eligible garments with no validity expiration.', 'discount', 6000, 0, 50, NULL, 'peach', true, '{}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ('gold-pkg', 'Gold Package', 'Pay Rs.3,000 (incl. GST) for service worth Rs.4,000 (incl. GST)', 'wallet', 3000, 4000, 0, NULL, 'amber', true, '{"applicableService":"all","applicableOrderType":"all","applicableCategory":"all","targetGarments":[],"validity":"2 months validity"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ('diamond-pkg', 'Diamond Package', 'Pay Rs.7,500 (incl. GST) for service worth Rs.10,000 (incl. GST)', 'wallet', 7500, 10000, 0, NULL, 'blue', true, '{"applicableService":"all","applicableOrderType":"all","applicableCategory":"all","targetGarments":[],"validity":"4 months validity"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ('platinum-pkg', 'Platinum Package', 'Pay Rs.15,000 (incl. GST) for service worth Rs.20,500 (incl. GST)', 'wallet', 15000, 20500, 0, NULL, 'violet', true, '{"applicableService":"all","applicableOrderType":"all","applicableCategory":"all","targetGarments":[],"validity":"6 months validity"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ('half-price-pkg', 'Half Price Package', 'Pay Rs.6,000 (incl. GST) for 50% discount Dry Cleaning per piece for over 1 year', 'discount', 6000, 0, 50, NULL, 'mint', true, '{"applicableService":"Dry cleaning","applicableOrderType":"pieces","applicableCategory":"all","targetGarments":[],"validity":"1 year validity"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ('winter-sweater-pkg', 'Winter Dry Cleaning Special', 'Pay for 5 Sweaters, Get the 6th Free! Special winter fabric care.', 'buy_x_get_y', 1500, 0, 0, NULL, 'rose', true, '{"applicableService":"Dry cleaning","applicableOrderType":"pieces","applicableCategory":"all","targetGarments":["m-sweater-full","m-sweater-half","m-sweatshirt","w-sweater-full","w-sweater-half","w-sweatshirt","k-sweater"],"targetKeywords":["sweater","sweatshirt"],"minQty":6,"buyQty":5,"freeQty":1,"validity":"Winter Special"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
VALUES ('double-blanket-pkg', '2 Double Blanket Offer', '2 Double Blanket 20% to 25% Off. Deep clean & sanitization.', 'discount', 800, 0, 25, NULL, 'purple', true, '{"applicableService":"all","applicableOrderType":"pieces","applicableCategory":"Household","targetGarments":["h-blanket-double","h-blanket-cover-double"],"targetKeywords":["blanket double","blanket-double"],"minQty":2,"validity":"Special Season"}'::jsonb)
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS customer_packages (
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
);

ALTER TABLE customer_packages ADD COLUMN IF NOT EXISTS remaining_credit NUMERIC(12,2) NULL;

CREATE INDEX IF NOT EXISTS customer_packages_customer_idx ON customer_packages (customer_id, expires_at);

CREATE TABLE IF NOT EXISTS orders (
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
);

ALTER TABLE orders ADD COLUMN IF NOT EXISTS express_percent NUMERIC(5,2) NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS express_amount NUMERIC(12,2) NOT NULL DEFAULT 0;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS express_label TEXT NOT NULL DEFAULT '';

ALTER TABLE orders ADD COLUMN IF NOT EXISTS extra JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS share_token TEXT NULL;

ALTER TABLE orders ADD COLUMN IF NOT EXISTS created_by TEXT NOT NULL DEFAULT '';

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'orders_amounts_nonnegative') THEN
    ALTER TABLE orders ADD CONSTRAINT orders_amounts_nonnegative
      CHECK (paid_amount >= 0 AND balance_amount >= 0 AND total_amount >= 0) NOT VALID;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders (customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS orders_status_due_idx ON orders (status, due_date);

CREATE UNIQUE INDEX IF NOT EXISTS orders_share_token_idx ON orders (share_token) WHERE share_token IS NOT NULL;

CREATE TABLE IF NOT EXISTS payments (
  id TEXT PRIMARY KEY,
  order_id TEXT NOT NULL REFERENCES orders(id),
  customer_id TEXT NOT NULL REFERENCES customers(id),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS package_sales (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  customer_package_id TEXT NOT NULL REFERENCES customer_packages(id),
  template_id TEXT NOT NULL REFERENCES package_templates(id),
  name TEXT NOT NULL,
  amount NUMERIC(12,2) NOT NULL,
  method TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  customer_package_id TEXT REFERENCES customer_packages(id),
  order_id TEXT REFERENCES orders(id),
  kind TEXT NOT NULL CHECK (kind IN ('credit', 'debit', 'adjustment')),
  amount NUMERIC(12,2) NOT NULL CHECK (amount > 0),
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS wallet_transactions_customer_idx ON wallet_transactions (customer_id, created_at DESC);

CREATE TABLE IF NOT EXISTS store_settings (
  id TEXT PRIMARY KEY DEFAULT 'current',
  config JSONB NOT NULL
);

CREATE TABLE IF NOT EXISTS staff_members (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  role TEXT NOT NULL,
  pin TEXT NOT NULL
);

INSERT INTO staff_members (id, name, role, pin)
VALUES
  ('staff-admin', 'Store Manager', 'admin', crypt('1234', gen_salt('bf', 10))),
  ('staff-cashier1', 'Cashier 1', 'cashier', crypt('0000', gen_salt('bf', 10))),
  ('staff-cashier2', 'Cashier 2', 'cashier', crypt('2222', gen_salt('bf', 10)))
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS admin_users (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  password TEXT NOT NULL,
  security_question TEXT NOT NULL DEFAULT 'What city is this store in?',
  security_answer TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (LOWER(email));

CREATE TABLE IF NOT EXISTS sessions (
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
);

CREATE INDEX IF NOT EXISTS sessions_expires_idx ON sessions (expires_at);

CREATE INDEX IF NOT EXISTS sessions_principal_idx ON sessions (principal_id);

CREATE TABLE IF NOT EXISTS auth_attempts (
  id BIGSERIAL PRIMARY KEY,
  bucket TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS auth_attempts_bucket_idx ON auth_attempts (bucket, created_at);

UPDATE staff_members SET pin = crypt(pin, gen_salt('bf', 10)) WHERE pin !~ '^[$]2[aby][$]';

UPDATE admin_users SET password = crypt(password, gen_salt('bf', 10)) WHERE password !~ '^[$]2[aby][$]';

UPDATE admin_users SET security_answer = crypt(lower(trim(security_answer)), gen_salt('bf', 10))
WHERE security_answer <> '' AND security_answer !~ '^[$]2[aby][$]';

UPDATE store_settings SET config = config - 'admins' WHERE config ? 'admins';

INSERT INTO store_settings (id, config) VALUES ('schema', '{"version":3}'::jsonb)
ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config;
