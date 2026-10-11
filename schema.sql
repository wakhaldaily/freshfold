CREATE TABLE IF NOT EXISTS customers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  mobile TEXT NOT NULL,
  email TEXT NOT NULL DEFAULT '',
  address TEXT NOT NULL DEFAULT '',
  notes TEXT NOT NULL DEFAULT '',
  wallet_balance NUMERIC(12,2) NOT NULL DEFAULT 0 CHECK (wallet_balance >= 0),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  enabled BOOLEAN NOT NULL DEFAULT true
);

INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent)
VALUES
  ('wallet-2000', 'Everyday Wallet', 'Add ₹2,000 laundry credit. Use toward any bill. No expiration.', 'wallet', 2000, 2000, 0, NULL, 'violet'),
  ('fresh-15', 'Fresh Club · 15% off', 'Save 15% on eligible laundry anytime. Lifetime package.', 'discount', 1800, 0, 15, NULL, 'mint'),
  ('half-price', 'Half Price Privilege', 'Flat 50% off eligible garments with no validity expiration.', 'discount', 6000, 0, 50, NULL, 'peach')
ON CONFLICT (id) DO NOTHING;

CREATE TABLE IF NOT EXISTS customer_packages (
  id TEXT PRIMARY KEY,
  customer_id TEXT NOT NULL REFERENCES customers(id),
  template_id TEXT NOT NULL REFERENCES package_templates(id),
  name TEXT NOT NULL,
  kind TEXT NOT NULL,
  wallet_credit NUMERIC(12,2) NOT NULL DEFAULT 0,
  discount_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  starts_at DATE NOT NULL,
  expires_at DATE NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  payment_method TEXT NOT NULL DEFAULT 'cash',
  status TEXT NOT NULL DEFAULT 'active',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

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
  tax_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  tax_percent NUMERIC(5,2) NOT NULL DEFAULT 0,
  total_amount NUMERIC(12,2) NOT NULL,
  paid_amount NUMERIC(12,2) NOT NULL DEFAULT 0,
  balance_amount NUMERIC(12,2) NOT NULL,
  status TEXT NOT NULL DEFAULT 'Received',
  due_date DATE NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS orders_customer_created_idx ON orders (customer_id, created_at DESC);
CREATE INDEX IF NOT EXISTS orders_status_due_idx ON orders (status, due_date);

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
  ('staff-admin', 'Store Manager', 'admin', '1234'),
  ('staff-cashier1', 'Cashier 1', 'cashier', '0000'),
  ('staff-cashier2', 'Cashier 2', 'cashier', '2222')
ON CONFLICT (id) DO NOTHING;
