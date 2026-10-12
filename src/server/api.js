/**
 * FreshFold Worker API.
 *
 * Every route except /api/health, /api/auth/{pin,admin,setup,recover,reset} and
 * /api/public-bill requires a bearer session. Admin-only routes additionally need an
 * admin session (admin login, Store Manager PIN, or an elevated staff session).
 *
 * Prices, discounts, tax and wallet deductions are computed here from the catalog;
 * amounts sent by the browser are ignored. Multi-table writes run as single
 * statements (data-modifying CTEs) so they are atomic, and rows are locked with
 * FOR UPDATE where concurrent requests could otherwise double-spend.
 */
import { defaultSettings, initialAddons, initialBrands, initialColors, initialDefects } from '../data.js';
import { getNextOrderNo } from '../lib/orderNumbers.js';
import { mergePackageTemplates, PricingError, priceOrder, roundMoney } from '../lib/orderPricing.js';
import {
  DEMO_ADMIN_EMAIL, DEMO_STAFF_PINS, RATE_LIMITS, assertNotRateLimited, createSession, deleteSessionsFor,
  getSessionUser, isDemoAllowed, publicUser, recordFailedAttempt, sessionToUser, verifyAdminPassword, verifyStaffPin,
} from './auth.js';
import { HttpError, clientIp, json, newId, numbers, randomToken, readJson, safeEqual, text } from './http.js';
import { SCHEMA_STATEMENTS, SCHEMA_VERSION, pickTemplateRules } from './schema.js';

const ORDER_STATUSES = ['Received', 'Processing', 'Ready', 'Delivered', 'Cancelled'];
const PAYMENT_METHODS = ['cash', 'upi', 'card'];
const TEMPLATE_KINDS = ['wallet', 'discount', 'half_price', 'buy_x_get_y', 'special'];
const STAFF_ROLES = ['admin', 'cashier'];
const DEFAULT_QUESTION = 'What city is this store in?';
const MIN_PASSWORD = 6;
const SETTINGS_BLOCKED_KEYS = ['admins', 'staff', '__proto__', 'constructor', 'prototype'];
const PROFILE_FIELDS = [
  'customerCode', 'salutation', 'areaLocation', 'state', 'pinCode', 'preference',
  'commPreference', 'rateList', 'gstin', 'referralCode',
];

// ---------------------------------------------------------------------------
// Schema bootstrap (once per isolate per database)
// ---------------------------------------------------------------------------
const schemaReady = new Map();

export function ensureSchema(sql, key = sql) {
  if (!schemaReady.has(key)) {
    const run = (async () => {
      try {
        const rows = await sql`SELECT config->>'version' AS v FROM store_settings WHERE id = 'schema'`;
        if (Number(rows[0]?.v || 0) >= SCHEMA_VERSION) return;
      } catch {
        // store_settings doesn't exist yet: fall through and create everything.
      }
      await sql.transaction([
        sql`SELECT pg_advisory_xact_lock(424242)`,
        ...SCHEMA_STATEMENTS.map((s) => sql.query(s.text, s.params)),
      ]);
    })();
    schemaReady.set(key, run);
    run.catch(() => schemaReady.delete(key));
  }
  return schemaReady.get(key);
}

// ---------------------------------------------------------------------------
// Shared loaders / mappers
// ---------------------------------------------------------------------------
async function loadSettings(sql) {
  const rows = await sql`SELECT config FROM store_settings WHERE id = 'current'`;
  const config = { ...(rows[0]?.config || {}) };
  for (const key of SETTINGS_BLOCKED_KEYS) delete config[key];
  return { ...defaultSettings, ...config };
}

async function loadCatalog(sql) {
  const rows = await sql`SELECT config FROM store_settings WHERE id = 'catalog'`;
  const config = rows[0]?.config || {};
  return {
    addons: Array.isArray(config.addons) && config.addons.length ? config.addons : [...initialAddons],
    brands: Array.isArray(config.brands) && config.brands.length ? config.brands : [...initialBrands],
    colors: Array.isArray(config.colors) && config.colors.length ? config.colors : [...initialColors],
    defects: Array.isArray(config.defects) && config.defects.length ? config.defects : [...initialDefects],
  };
}

async function loadTemplates(sql, { enabledOnly = true } = {}) {
  const rows = enabledOnly
    ? await sql`SELECT id, name, description, kind, price, wallet_credit AS "walletCredit", discount_percent AS "discountPercent", duration_days AS "durationDays", accent, enabled, rules FROM package_templates WHERE enabled = true ORDER BY price`
    : await sql`SELECT id, name, description, kind, price, wallet_credit AS "walletCredit", discount_percent AS "discountPercent", duration_days AS "durationDays", accent, enabled, rules FROM package_templates ORDER BY price`;
  return mergePackageTemplates(rows.map((r) => numbers(r, ['price', 'walletCredit', 'discountPercent'])));
}

function mapCustomer(row) {
  const { profile, ...rest } = numbers(row, ['walletBalance']);
  return { ...(profile || {}), ...rest };
}

const ORDER_NUMERIC = [
  'weightKg', 'grossAmount', 'discountAmount', 'discountPercent', 'expressPercent', 'expressAmount',
  'taxAmount', 'taxPercent', 'totalAmount', 'paidAmount', 'balanceAmount',
];

function mapOrder(row) {
  const { extra, ...rest } = numbers(row, ORDER_NUMERIC);
  const dueDate = rest.dueDate instanceof Date ? rest.dueDate.toISOString().slice(0, 10) : rest.dueDate;
  return { ...(extra || {}), ...rest, dueDate, expressDelivery: rest.expressAmount > 0 };
}

const ORDER_COLUMNS = `id, order_no AS "orderNo", customer_id AS "customerId", order_type AS type, service, items,
  weight_kg AS "weightKg", weight_note AS "weightNote", gross_amount AS "grossAmount", discount_amount AS "discountAmount",
  discount_percent AS "discountPercent", discount_name AS "discountName", express_percent AS "expressPercent",
  express_amount AS "expressAmount", express_label AS "expressLabel", tax_amount AS "taxAmount", tax_percent AS "taxPercent",
  total_amount AS "totalAmount", paid_amount AS "paidAmount", balance_amount AS "balanceAmount", status,
  to_char(due_date, 'YYYY-MM-DD') AS "dueDate", extra, created_at AS "createdAt"`;

function validMobile(mobile) {
  const digits = String(mobile || '').replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

function pickProfile(body) {
  const profile = {};
  for (const key of PROFILE_FIELDS) {
    if (body[key] !== undefined) profile[key] = text(body[key], 120);
  }
  if (body.discountPercent !== undefined) {
    const pct = Number(body.discountPercent);
    profile.discountPercent = Number.isFinite(pct) ? Math.min(100, Math.max(0, pct)) : 0;
  }
  return profile;
}

function validDate(value) {
  const s = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== s ? null : s;
}

function validPassword(password) {
  const p = String(password || '');
  if (p.trim().length < MIN_PASSWORD) throw new HttpError(400, `Password must be at least ${MIN_PASSWORD} characters.`);
  if (p.length > 200) throw new HttpError(400, 'Password is too long.');
  return p;
}

function validEmail(email) {
  const e = String(email || '').trim().toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) || e.length > 200) throw new HttpError(400, 'Enter a valid email address.');
  return e;
}

function mapAdmin(row) {
  return { id: row.id, name: row.name, email: row.email, securityQuestion: row.securityQuestion, createdAt: row.createdAt };
}

function cleanSettingsPatch(body) {
  const patch = {};
  for (const [key, value] of Object.entries(body)) {
    if (SETTINGS_BLOCKED_KEYS.includes(key)) continue;
    patch[key] = value;
  }
  if (patch.taxPercent !== undefined) {
    const pct = Number(patch.taxPercent);
    if (!Number.isFinite(pct) || pct < 0 || pct > 100) throw new HttpError(400, 'Tax percent must be between 0 and 100.');
    patch.taxPercent = pct;
  }
  if (patch.expressOptions !== undefined) {
    if (!Array.isArray(patch.expressOptions)) throw new HttpError(400, 'expressOptions must be a list.');
    patch.expressOptions = patch.expressOptions.slice(0, 20).map((o) => ({
      id: text(o.id, 40) || newId('express'),
      label: text(o.label, 80),
      percent: Math.min(100, Math.max(0, Number(o.percent) || 0)),
      days: Math.min(60, Math.max(0, Math.floor(Number(o.days) || 0))),
    }));
  }
  return patch;
}

function cleanTemplate(body, { partial = false } = {}) {
  const out = {};
  if (!partial || body.name !== undefined) {
    out.name = text(body.name, 120);
    if (!out.name) throw new HttpError(400, 'Package name is required.');
  }
  if (!partial || body.description !== undefined) out.description = text(body.description, 500);
  if (!partial || body.kind !== undefined) {
    out.kind = String(body.kind || 'discount');
    if (!TEMPLATE_KINDS.includes(out.kind)) throw new HttpError(400, 'Unknown package type.');
  }
  for (const [key, max] of [['price', 10_000_000], ['walletCredit', 10_000_000], ['discountPercent', 100]]) {
    if (!partial || body[key] !== undefined) {
      const n = Number(body[key] || 0);
      if (!Number.isFinite(n) || n < 0 || n > max) throw new HttpError(400, `Invalid ${key}.`);
      out[key] = roundMoney(n);
    }
  }
  if (!partial || body.accent !== undefined) out.accent = text(body.accent || 'violet', 30);

  const rules = pickTemplateRules(body);
  for (const key of ['minQty', 'buyQty', 'freeQty']) {
    if (rules[key] !== undefined) rules[key] = Math.min(1000, Math.max(0, Math.floor(Number(rules[key]) || 0)));
  }
  if (rules.targetGarments !== undefined) {
    rules.targetGarments = (Array.isArray(rules.targetGarments) ? rules.targetGarments : []).map((g) => text(g, 80)).filter(Boolean).slice(0, 200);
  }
  if (rules.targetKeywords !== undefined) {
    const list = Array.isArray(rules.targetKeywords) ? rules.targetKeywords : String(rules.targetKeywords || '').split(',');
    rules.targetKeywords = list.map((k) => text(k, 60).toLowerCase()).filter(Boolean).slice(0, 50);
  }
  for (const key of ['applicableService', 'applicableOrderType', 'applicableCategory', 'validity']) {
    if (rules[key] !== undefined) rules[key] = text(rules[key], 80);
  }
  out.rules = rules;
  return out;
}

function orderExtra(body, priced) {
  const garments = (Array.isArray(body.weightGarments) ? body.weightGarments : []).slice(0, 200).map((g) => ({
    id: text(g.id, 80),
    name: text(g.name, 80),
    category: text(g.category, 40),
    quantity: Math.min(10000, Math.max(0, Math.floor(Number(g.quantity) || 0))),
  }));
  return {
    customerCode: text(body.customerCode, 60),
    customerGstin: text(body.customerGstin, 30),
    customerPreference: text(body.customerPreference, 120),
    customerRateList: text(body.customerRateList, 60),
    commPreference: text(body.commPreference, 60),
    weightClothesCount: Math.min(100000, Math.max(0, Math.floor(Number(body.weightClothesCount) || 0))),
    weightGarments: priced.type === 'weight' ? garments : [],
    weightAddons: priced.weightAddons,
  };
}

// ---------------------------------------------------------------------------
// Route handlers
// ---------------------------------------------------------------------------
async function health({ sql, env }) {
  const [admins, settings] = await Promise.all([
    sql`SELECT count(*)::int AS n FROM admin_users WHERE lower(email) <> ${DEMO_ADMIN_EMAIL}`,
    loadSettings(sql),
  ]);
  return json({
    database: true,
    demo: isDemoAllowed(env),
    setupRequired: Number(admins[0]?.n || 0) === 0,
    storeName: settings.storeName,
    tagline: settings.tagline,
  });
}

async function loginPin({ sql, env, request, ip }) {
  const body = await readJson(request);
  const bucket = `login:${ip}`;
  await assertNotRateLimited(sql, bucket, RATE_LIMITS.login);
  const staff = await verifyStaffPin(sql, env, body.pin);
  if (!staff) {
    await recordFailedAttempt(sql, bucket);
    throw new HttpError(401, 'Incorrect PIN. Please try again.');
  }
  await sql`DELETE FROM sessions WHERE expires_at < now()`;
  const session = await createSession(sql, { type: 'staff', id: staff.id, name: staff.name, role: staff.role === 'admin' ? 'admin' : 'cashier' });
  return json({ token: session.token, user: publicUser(session.user) });
}

async function loginAdmin({ sql, env, request, ip }) {
  const body = await readJson(request);
  const bucket = `login:${ip}`;
  await assertNotRateLimited(sql, bucket, RATE_LIMITS.login);
  const admin = await verifyAdminPassword(sql, env, body.email, body.password);
  if (!admin) {
    await recordFailedAttempt(sql, bucket);
    throw new HttpError(401, 'Invalid admin credentials. Check your email and password.');
  }
  await sql`DELETE FROM sessions WHERE expires_at < now()`;
  const session = await createSession(sql, { type: 'admin', id: admin.id, name: admin.name, email: admin.email, role: 'admin' });
  return json({ token: session.token, user: publicUser(session.user) });
}

async function setupStore({ sql, request }) {
  const body = await readJson(request);
  const name = text(body.name, 120);
  if (!name) throw new HttpError(400, 'Enter the administrator name.');
  const email = validEmail(body.email);
  if (email === DEMO_ADMIN_EMAIL) throw new HttpError(400, 'Choose a real email address for the store administrator.');
  const password = validPassword(body.password);
  const question = text(body.securityQuestion || DEFAULT_QUESTION, 200);
  const answer = text(body.securityAnswer, 200).toLowerCase();
  if (!answer) throw new HttpError(400, 'Answer the security question so you can recover your password.');
  const adminId = newId('admin');

  // The advisory lock serialises concurrent setup attempts so only one can win.
  const [, inserted] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(424243)`,
    sql`INSERT INTO admin_users (id, name, email, password, security_question, security_answer)
      SELECT ${adminId}, ${name}, ${email}, crypt(${password}, gen_salt('bf', 10)), ${question}, crypt(${answer}, gen_salt('bf', 10))
      WHERE NOT EXISTS (SELECT 1 FROM admin_users WHERE lower(email) <> ${DEMO_ADMIN_EMAIL})
      RETURNING id`,
  ]);
  if (!inserted.length) throw new HttpError(409, 'This store is already set up. Sign in with an administrator account.');

  const storeName = text(body.storeName, 120);
  if (storeName) {
    const patch = JSON.stringify({ storeName, storeNameCreated: true });
    await sql`INSERT INTO store_settings (id, config) VALUES ('current', ${patch}::jsonb)
      ON CONFLICT (id) DO UPDATE SET config = store_settings.config || EXCLUDED.config`;
  }
  const session = await createSession(sql, { type: 'admin', id: adminId, name, email, role: 'admin' });
  return json({ token: session.token, user: publicUser(session.user) }, 201);
}

async function recoverQuestion({ sql, request }) {
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const rows = email
    ? await sql`SELECT security_question AS q FROM admin_users WHERE lower(email) = ${email} AND security_answer <> ''`
    : [];
  // Same response shape for unknown emails so the endpoint can't be used to list accounts.
  return json({ securityQuestion: rows[0]?.q || DEFAULT_QUESTION });
}

async function resetWithAnswer({ sql, env, request, ip }) {
  const body = await readJson(request);
  const bucket = `reset:${ip}`;
  await assertNotRateLimited(sql, bucket, RATE_LIMITS.reset);
  const email = String(body.email || '').trim().toLowerCase();
  if (email === DEMO_ADMIN_EMAIL && !isDemoAllowed(env)) {
    throw new HttpError(403, 'The demo admin account is disabled on this server.');
  }
  const password = validPassword(body.newPassword);
  const answer = text(body.securityAnswer, 200).toLowerCase();
  const rows = answer
    ? await sql`UPDATE admin_users SET password = crypt(${password}, gen_salt('bf', 10))
        WHERE lower(email) = ${email} AND security_answer <> '' AND security_answer = crypt(${answer}, security_answer)
        RETURNING id, name, email`
    : [];
  if (!rows.length) {
    await recordFailedAttempt(sql, bucket);
    throw new HttpError(401, 'The email or security answer is incorrect.');
  }
  const admin = rows[0];
  await deleteSessionsFor(sql, admin.id);
  const session = await createSession(sql, { type: 'admin', id: admin.id, name: admin.name, email: admin.email, role: 'admin' });
  return json({ token: session.token, user: publicUser(session.user) });
}

async function me({ user }) {
  return json({ user: publicUser(user) });
}

async function logout({ sql, user }) {
  await sql`DELETE FROM sessions WHERE token_hash = ${user.tokenHash}`;
  return json({ success: true });
}

async function elevate({ sql, env, request, ip, user }) {
  const body = await readJson(request);
  const bucket = `login:${ip}`;
  await assertNotRateLimited(sql, bucket, RATE_LIMITS.login);
  const admin = await verifyAdminPassword(sql, env, body.email, body.password);
  if (!admin) {
    await recordFailedAttempt(sql, bucket);
    throw new HttpError(401, 'Invalid admin credentials. Check your email and password.');
  }
  const rows = await sql`UPDATE sessions SET elevated_admin_id = ${admin.id}, elevated_admin_name = ${admin.name}, elevated_admin_email = ${admin.email}
    WHERE token_hash = ${user.tokenHash} RETURNING *`;
  return json({ user: publicUser(sessionToUser(rows[0])) });
}

async function dropAdmin({ sql, user }) {
  const rows = await sql`UPDATE sessions SET elevated_admin_id = NULL, elevated_admin_name = NULL, elevated_admin_email = NULL
    WHERE token_hash = ${user.tokenHash} RETURNING *`;
  return json({ user: publicUser(sessionToUser(rows[0])) });
}

async function bootstrap({ sql, user }) {
  const [customers, orders, customerPackages, payments, packageSales, walletTransactions, packages, settings, catalog, staff, admins] = await Promise.all([
    sql`SELECT id, name, mobile, email, address, notes, wallet_balance AS "walletBalance", profile, created_at AS "createdAt" FROM customers ORDER BY created_at DESC`,
    sql.query(`SELECT ${ORDER_COLUMNS} FROM orders ORDER BY created_at DESC`, []),
    sql`SELECT id, customer_id AS "customerId", template_id AS "templateId", name, kind, wallet_credit AS "walletCredit", discount_percent AS "discountPercent", to_char(starts_at, 'YYYY-MM-DD') AS "startsAt", to_char(expires_at, 'YYYY-MM-DD') AS "expiresAt", paid_amount AS "paidAmount", payment_method AS "paymentMethod", status, created_at AS "createdAt" FROM customer_packages ORDER BY created_at DESC`,
    sql`SELECT id, order_id AS "orderId", customer_id AS "customerId", amount, method, created_at AS "createdAt" FROM payments ORDER BY created_at DESC`,
    sql`SELECT id, customer_id AS "customerId", customer_package_id AS "packageId", template_id AS "templateId", name, amount, method, created_at AS "createdAt" FROM package_sales ORDER BY created_at DESC`,
    sql`SELECT id, customer_id AS "customerId", customer_package_id AS "packageId", order_id AS "orderId", kind, amount, description, created_at AS "createdAt" FROM wallet_transactions ORDER BY created_at DESC`,
    loadTemplates(sql),
    loadSettings(sql),
    loadCatalog(sql),
    sql`SELECT id, name, role FROM staff_members ORDER BY name`,
    user.isAdmin
      ? sql`SELECT id, name, email, security_question AS "securityQuestion", created_at AS "createdAt" FROM admin_users ORDER BY created_at`
      : Promise.resolve([]),
  ]);

  return json({
    me: publicUser(user),
    customers: customers.map(mapCustomer),
    orders: orders.map(mapOrder),
    customerPackages: customerPackages.map((r) => numbers(r, ['walletCredit', 'discountPercent', 'paidAmount'])),
    payments: payments.map((r) => numbers(r, ['amount'])),
    packageSales: packageSales.map((r) => numbers(r, ['amount'])),
    walletTransactions: walletTransactions.map((r) => numbers(r, ['amount'])),
    packages,
    settings,
    staff,
    admins: admins.map(mapAdmin),
    ...catalog,
  });
}

// --- Customers ---
async function createCustomer({ sql, request }) {
  const body = await readJson(request);
  const name = text(body.name, 120);
  const mobile = text(body.mobile, 20);
  if (!name || !validMobile(mobile)) throw new HttpError(400, 'Enter a customer name and a valid mobile number.');
  const id = newId('cus');
  try {
    await sql`INSERT INTO customers (id, name, mobile, email, address, notes, profile)
      VALUES (${id}, ${name}, ${mobile}, ${text(body.email, 200)}, ${text(body.address, 300)}, ${text(body.notes, 1000)}, ${JSON.stringify(pickProfile(body))}::jsonb)`;
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'That mobile number already belongs to a customer.');
    throw error;
  }
  return json({ id }, 201);
}

async function updateCustomer({ sql, request, params }) {
  const body = await readJson(request);
  const name = body.name !== undefined ? text(body.name, 120) : null;
  if (name === '') throw new HttpError(400, 'Customer name cannot be empty.');
  const mobile = body.mobile !== undefined ? text(body.mobile, 20) : null;
  if (mobile !== null && !validMobile(mobile)) throw new HttpError(400, 'Enter a valid mobile number.');
  let rows;
  try {
    rows = await sql`UPDATE customers SET
      name = COALESCE(${name}, name),
      mobile = COALESCE(${mobile}, mobile),
      email = COALESCE(${body.email !== undefined ? text(body.email, 200) : null}, email),
      address = COALESCE(${body.address !== undefined ? text(body.address, 300) : null}, address),
      notes = COALESCE(${body.notes !== undefined ? text(body.notes, 1000) : null}, notes),
      profile = profile || ${JSON.stringify(pickProfile(body))}::jsonb
      WHERE id = ${params.id} RETURNING id`;
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'That mobile number already belongs to a customer.');
    throw error;
  }
  if (!rows.length) throw new HttpError(404, 'Customer not found.');
  return json({ id: params.id });
}

async function deleteCustomer({ sql, params }) {
  let rows;
  try {
    rows = await sql`DELETE FROM customers WHERE id = ${params.id} RETURNING id`;
  } catch (error) {
    if (error.code === '23503') {
      throw new HttpError(409, "This customer has orders, packages or payments on record, so they can't be deleted.");
    }
    throw error;
  }
  if (!rows.length) throw new HttpError(404, 'Customer not found.');
  return json({ id: params.id, success: true });
}

// --- Orders ---
async function insertPricedOrder(sql, { orderId, orderNo, customerId, priced, body, extra, dueDate, userId, nextOrderNo }) {
  const payId = newId('pay');
  const wtId = newId('wt');
  const items = priced.items.map((item, index) => ({
    ...item,
    garmentId: item.id,
    id: newId('line'),
    barcode: `${orderNo}-${index + 1}`,
    status: 'Received',
  }));
  const expressLabel = priced.expressPercent > 0 ? (text(body.expressLabel, 120) || priced.expressLabel) : '';

  return sql`WITH cust AS (
      SELECT id, wallet_balance FROM customers WHERE id = ${customerId} FOR UPDATE
    ), deduct AS (
      SELECT LEAST(wallet_balance, ${priced.totalAmount}::numeric) AS amount FROM cust
    ), new_order AS (
      INSERT INTO orders (id, order_no, customer_id, order_type, service, items, weight_kg, weight_note,
        gross_amount, discount_amount, discount_percent, discount_name, express_percent, express_amount, express_label,
        tax_amount, tax_percent, total_amount, paid_amount, balance_amount, status, due_date, extra, created_by)
      SELECT ${orderId}, ${orderNo}, cust.id, ${priced.type}, ${priced.service}, ${JSON.stringify(items)}::jsonb,
        ${priced.weightKg}, ${text(body.weightNote, 500)}, ${priced.grossAmount}, ${priced.discountAmount},
        ${priced.discountPercent}, ${text(priced.discountName, 160)}, ${priced.expressPercent}, ${priced.expressAmount},
        ${expressLabel}, ${priced.taxAmount}, ${priced.taxPercent}, ${priced.totalAmount}, deduct.amount,
        ${priced.totalAmount}::numeric - deduct.amount, 'Received', ${dueDate}::date, ${JSON.stringify(extra)}::jsonb, ${userId}
      FROM cust, deduct
      RETURNING id, order_no, paid_amount, balance_amount, total_amount
    ), wallet AS (
      UPDATE customers c SET wallet_balance = c.wallet_balance - o.paid_amount
      FROM new_order o WHERE c.id = ${customerId} AND o.paid_amount > 0
      RETURNING c.id
    ), pay AS (
      INSERT INTO payments (id, order_id, customer_id, amount, method)
      SELECT ${payId}, o.id, ${customerId}, o.paid_amount, 'wallet' FROM new_order o WHERE o.paid_amount > 0
      RETURNING id
    ), ledger AS (
      INSERT INTO wallet_transactions (id, customer_id, order_id, kind, amount, description)
      SELECT ${wtId}, ${customerId}, o.id, 'debit', o.paid_amount, ${`Payment for ${orderNo}`} FROM new_order o WHERE o.paid_amount > 0
      RETURNING id
    ), next_no AS (
      UPDATE store_settings SET config = jsonb_set(config, '{nextOrderNo}', to_jsonb(${nextOrderNo}::text))
      WHERE id = 'current' AND EXISTS (SELECT 1 FROM new_order)
      RETURNING id
    )
    SELECT id, order_no AS "orderNo", paid_amount AS "paidAmount", balance_amount AS "balanceAmount", total_amount AS "totalAmount" FROM new_order`;
}

async function createOrderRoute({ sql, request, user }) {
  const body = await readJson(request);
  const customerId = text(body.customerId, 80);
  if (!customerId) throw new HttpError(400, 'Choose a customer for this order.');

  const [customerRows, customerPackages, packageTemplates, settings, catalog, latest] = await Promise.all([
    sql`SELECT id, name, mobile, profile FROM customers WHERE id = ${customerId}`,
    sql`SELECT id, customer_id AS "customerId", template_id AS "templateId", name, kind, wallet_credit AS "walletCredit", discount_percent AS "discountPercent", to_char(expires_at, 'YYYY-MM-DD') AS "expiresAt", status FROM customer_packages WHERE customer_id = ${customerId} AND status = 'active'`,
    loadTemplates(sql, { enabledOnly: false }),
    loadSettings(sql),
    loadCatalog(sql),
    sql`SELECT order_no AS "orderNo" FROM orders ORDER BY created_at DESC LIMIT 1`,
  ]);
  if (!customerRows.length) throw new HttpError(404, 'Customer could not be found.');
  const customer = mapCustomer(customerRows[0]);

  const priced = priceOrder(body, {
    customer,
    customerPackages: customerPackages.map((r) => numbers(r, ['walletCredit', 'discountPercent'])),
    packageTemplates,
    settings,
    addonCatalog: catalog.addons,
  });

  const today = new Date().toISOString().slice(0, 10);
  const dueDate = body.dueDate ? validDate(body.dueDate) : today;
  if (!dueDate) throw new HttpError(400, 'Enter a valid promised date.');

  const requested = text(body.orderNo, 40);
  const auto = !requested || body.autoOrderNo === true;
  let orderNo = requested || settings.nextOrderNo || getNextOrderNo(latest[0]?.orderNo);
  const extra = orderExtra(body, priced);
  const orderId = newId('ord');

  for (let attempt = 0; attempt < 5; attempt += 1) {
    try {
      const rows = await insertPricedOrder(sql, {
        orderId, orderNo, customerId, priced, body, extra, dueDate, userId: user.id, nextOrderNo: getNextOrderNo(orderNo),
      });
      if (!rows.length) throw new HttpError(404, 'Customer could not be found.');
      const created = numbers(rows[0], ['paidAmount', 'balanceAmount', 'totalAmount']);
      return json({ ...created, autoDeduct: created.paidAmount }, 201);
    } catch (error) {
      const duplicateNo = error.code === '23505' && String(error.constraint || error.detail || error.message).includes('order_no');
      if (!duplicateNo) throw error;
      if (!auto) throw new HttpError(409, `Order number "${orderNo}" is already in use. Choose another number.`);
      orderNo = getNextOrderNo(orderNo);
    }
  }
  throw new HttpError(409, 'Could not allocate an order number. Try again.');
}

async function updateOrderStatus({ sql, request, params }) {
  const body = await readJson(request);
  if (!ORDER_STATUSES.includes(body.status)) throw new HttpError(400, 'Invalid order status.');
  const rows = await sql`UPDATE orders SET status = ${body.status},
    items = CASE WHEN order_type = 'pieces'
      THEN COALESCE((SELECT jsonb_agg(jsonb_set(line, '{status}', to_jsonb(${body.status}::text))) FROM jsonb_array_elements(items) AS lines(line)), items)
      ELSE items END
    WHERE id = ${params.id} RETURNING id`;
  if (!rows.length) throw new HttpError(404, 'Order not found.');
  return json({ id: params.id });
}

async function recordPayment({ sql, request, params }) {
  const body = await readJson(request);
  const amount = roundMoney(body.amount);
  const method = String(body.method || 'cash');
  if (!(amount > 0) || ![...PAYMENT_METHODS, 'wallet'].includes(method)) {
    throw new HttpError(400, 'Enter a valid amount and payment method.');
  }
  const paymentId = newId('pay');
  const transactionId = newId('wt');
  let rows;
  if (method === 'wallet') {
    rows = await sql`WITH o AS (
        SELECT id, customer_id, order_no, balance_amount FROM orders WHERE id = ${params.id} FOR UPDATE
      ), c AS (
        SELECT cu.id, cu.wallet_balance FROM customers cu JOIN o ON cu.id = o.customer_id FOR UPDATE OF cu
      ), ok AS (
        SELECT o.id AS order_id, o.order_no, c.id AS customer_id FROM o, c
        WHERE o.balance_amount = ${amount}::numeric AND c.wallet_balance >= ${amount}::numeric
      ), debit AS (
        UPDATE customers SET wallet_balance = wallet_balance - ${amount}::numeric WHERE id = (SELECT customer_id FROM ok) RETURNING id
      ), pay AS (
        INSERT INTO payments (id, order_id, customer_id, amount, method)
        SELECT ${paymentId}, order_id, customer_id, ${amount}, 'wallet' FROM ok RETURNING id
      ), ledger AS (
        INSERT INTO wallet_transactions (id, customer_id, order_id, kind, amount, description)
        SELECT ${transactionId}, customer_id, order_id, 'debit', ${amount}, 'Payment for ' || order_no FROM ok RETURNING id
      ), upd AS (
        UPDATE orders SET paid_amount = paid_amount + ${amount}::numeric, balance_amount = balance_amount - ${amount}::numeric
        WHERE id = (SELECT order_id FROM ok) RETURNING id
      )
      SELECT (SELECT count(*) FROM o)::int AS found, (SELECT count(*) FROM ok)::int AS paid`;
  } else {
    rows = await sql`WITH o AS (
        SELECT id, customer_id, balance_amount FROM orders WHERE id = ${params.id} FOR UPDATE
      ), ok AS (
        SELECT id, customer_id FROM o WHERE balance_amount >= ${amount}::numeric
      ), pay AS (
        INSERT INTO payments (id, order_id, customer_id, amount, method)
        SELECT ${paymentId}, id, customer_id, ${amount}, ${method} FROM ok RETURNING id
      ), upd AS (
        UPDATE orders SET paid_amount = paid_amount + ${amount}::numeric, balance_amount = balance_amount - ${amount}::numeric
        WHERE id = (SELECT id FROM ok) RETURNING id
      )
      SELECT (SELECT count(*) FROM o)::int AS found, (SELECT count(*) FROM ok)::int AS paid`;
  }
  if (!rows[0]?.found) throw new HttpError(404, 'Order not found.');
  if (!rows[0]?.paid) {
    throw new HttpError(409, method === 'wallet'
      ? 'Wallet credit must cover the full balance due. Use another method for a partial payment.'
      : 'Payment is more than the balance due.');
  }
  return json({ id: paymentId }, 201);
}

async function shareLink({ sql, params }) {
  const rows = await sql`UPDATE orders SET share_token = COALESCE(share_token, ${randomToken(16)})
    WHERE id = ${params.id} RETURNING order_no AS "orderNo", share_token AS token`;
  if (!rows.length) throw new HttpError(404, 'Order not found.');
  return json(rows[0]);
}

// --- Packages ---
async function sellPackage({ sql, request }) {
  const body = await readJson(request);
  const method = String(body.paymentMethod || 'cash');
  if (!PAYMENT_METHODS.includes(method)) throw new HttpError(400, 'Choose cash, UPI or card for the package payment.');
  const customerPackageId = newId('cp');
  const rows = await sql`WITH t AS (
      SELECT id, name, kind, price, wallet_credit, discount_percent, duration_days FROM package_templates
      WHERE id = ${text(body.templateId, 80)} AND enabled = true
    ), c AS (
      SELECT id FROM customers WHERE id = ${text(body.customerId, 80)} FOR UPDATE
    ), new_package AS (
      INSERT INTO customer_packages (id, customer_id, template_id, name, kind, wallet_credit, discount_percent, starts_at, expires_at, paid_amount, payment_method, status)
      SELECT ${customerPackageId}, c.id, t.id, t.name, t.kind, t.wallet_credit, t.discount_percent, CURRENT_DATE,
        CASE WHEN t.duration_days IS NULL THEN NULL ELSE CURRENT_DATE + t.duration_days END, t.price, ${method}, 'active'
      FROM t, c
      RETURNING *
    ), wallet_update AS (
      UPDATE customers cu SET wallet_balance = cu.wallet_balance + p.wallet_credit
      FROM new_package p WHERE cu.id = p.customer_id RETURNING cu.id
    ), sale AS (
      INSERT INTO package_sales (id, customer_id, customer_package_id, template_id, name, amount, method)
      SELECT ${newId('sale')}, p.customer_id, p.id, p.template_id, p.name, p.paid_amount, p.payment_method FROM new_package p
      RETURNING id
    ), ledger AS (
      INSERT INTO wallet_transactions (id, customer_id, customer_package_id, kind, amount, description)
      SELECT ${newId('wt')}, p.customer_id, p.id, 'credit', p.wallet_credit, p.name || ' purchased' FROM new_package p WHERE p.wallet_credit > 0
      RETURNING id
    )
    SELECT (SELECT count(*) FROM t)::int AS template_found, (SELECT count(*) FROM c)::int AS customer_found, (SELECT count(*) FROM new_package)::int AS created`;
  if (!rows[0]?.template_found) throw new HttpError(400, 'This package is not available.');
  if (!rows[0]?.customer_found) throw new HttpError(404, 'Customer could not be found.');
  return json({ id: customerPackageId }, 201);
}

async function createTemplate({ sql, request }) {
  const t = cleanTemplate(await readJson(request));
  const id = newId('pkg');
  await sql`INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled, rules)
    VALUES (${id}, ${t.name}, ${t.description}, ${t.kind}, ${t.price}, ${t.walletCredit}, ${t.discountPercent}, NULL, ${t.accent}, true, ${JSON.stringify(t.rules)}::jsonb)`;
  return json({ id }, 201);
}

async function updateTemplate({ sql, request, params }) {
  const t = cleanTemplate(await readJson(request), { partial: true });
  const rows = await sql`UPDATE package_templates SET
    name = COALESCE(${t.name ?? null}, name),
    description = COALESCE(${t.description ?? null}, description),
    kind = COALESCE(${t.kind ?? null}, kind),
    price = COALESCE(${t.price ?? null}, price),
    wallet_credit = COALESCE(${t.walletCredit ?? null}, wallet_credit),
    discount_percent = COALESCE(${t.discountPercent ?? null}, discount_percent),
    accent = COALESCE(${t.accent ?? null}, accent),
    rules = rules || ${JSON.stringify(t.rules)}::jsonb
    WHERE id = ${params.id} RETURNING id`;
  if (!rows.length) throw new HttpError(404, 'Package not found.');
  return json({ id: params.id });
}

async function deleteTemplate({ sql, params }) {
  const rows = await sql`UPDATE package_templates SET enabled = false WHERE id = ${params.id} RETURNING id`;
  if (!rows.length) throw new HttpError(404, 'Package not found.');
  return json({ id: params.id, success: true });
}

// --- Settings & catalog ---
async function updateSettings({ sql, request }) {
  const patch = cleanSettingsPatch(await readJson(request));
  await sql`INSERT INTO store_settings (id, config) VALUES ('current', ${JSON.stringify(patch)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET config = (store_settings.config - 'admins') || EXCLUDED.config`;
  return json({ success: true, settings: await loadSettings(sql) });
}

async function addCatalogEntry({ sql, request }) {
  const body = await readJson(request);
  const kind = String(body.kind || '');
  const name = text(body.name, 80);
  if (!name) throw new HttpError(400, 'Enter a name.');
  const catalog = await loadCatalog(sql);
  if (kind === 'addon') {
    const price = roundMoney(body.price);
    if (!(price >= 0) || price > 100000) throw new HttpError(400, 'Enter a valid add-on price.');
    const existing = catalog.addons.find((a) => String(a.name).toLowerCase() === name.toLowerCase());
    catalog.addons = existing
      ? catalog.addons.map((a) => (a === existing ? { ...a, price } : a))
      : [...catalog.addons, { id: newId('addon'), name, price }];
  } else if (['brand', 'color', 'defect'].includes(kind)) {
    const key = `${kind}s`;
    if (!catalog[key].some((v) => String(v).toLowerCase() === name.toLowerCase())) catalog[key] = [...catalog[key], name];
  } else {
    throw new HttpError(400, 'Unknown catalog type.');
  }
  await sql`INSERT INTO store_settings (id, config) VALUES ('catalog', ${JSON.stringify(catalog)}::jsonb)
    ON CONFLICT (id) DO UPDATE SET config = EXCLUDED.config`;
  return json(catalog);
}

// --- Staff ---
async function replaceStaff({ sql, env, request }) {
  const body = await readJson(request);
  const list = Array.isArray(body.staff) ? body.staff : null;
  if (!list) throw new HttpError(400, 'Send the staff list.');
  if (list.length > 100) throw new HttpError(400, 'Too many staff members.');

  const seenIds = new Set();
  const seenPins = new Set();
  const members = list.map((s) => {
    const id = text(s.id, 64) || newId('staff');
    if (!/^[\w-]+$/.test(id) || seenIds.has(id)) throw new HttpError(400, 'Each staff member needs a unique id.');
    seenIds.add(id);
    const name = text(s.name, 80);
    if (!name) throw new HttpError(400, 'Each staff member needs a name.');
    const role = STAFF_ROLES.includes(s.role) ? s.role : 'cashier';
    const pin = s.pin === undefined || s.pin === null || s.pin === '' ? null : String(s.pin).trim();
    if (pin !== null) {
      if (!/^\d{4,6}$/.test(pin)) throw new HttpError(400, `PIN for ${name} must be 4 to 6 digits.`);
      if (!isDemoAllowed(env) && DEMO_STAFF_PINS.includes(pin)) {
        throw new HttpError(400, `PIN for ${name} is a default demo PIN. Choose a different one.`);
      }
      if (seenPins.has(pin)) throw new HttpError(400, 'Each staff member needs a different PIN.');
      seenPins.add(pin);
    }
    return { id, name, role, pin };
  });

  const existing = await sql`SELECT id FROM staff_members`;
  const existingIds = new Set(existing.map((r) => r.id));
  for (const m of members) {
    if (m.pin === null && !existingIds.has(m.id)) throw new HttpError(400, `Set a PIN for ${m.name}.`);
  }
  // A new PIN must not match the PIN of anyone who keeps their current one.
  const keptIds = members.filter((m) => m.pin === null).map((m) => m.id);
  for (const m of members.filter((x) => x.pin !== null)) {
    const clash = await sql`SELECT id FROM staff_members
      WHERE pin = crypt(${m.pin}, pin) AND id IN (SELECT jsonb_array_elements_text(${JSON.stringify(keptIds)}::jsonb))`;
    if (clash.length) throw new HttpError(400, `PIN for ${m.name} is already used by another staff member.`);
  }

  const ids = JSON.stringify(members.map((m) => m.id));
  await sql.transaction([
    sql`DELETE FROM sessions WHERE principal_type = 'staff' AND principal_id NOT IN (SELECT jsonb_array_elements_text(${ids}::jsonb))`,
    sql`DELETE FROM staff_members WHERE id NOT IN (SELECT jsonb_array_elements_text(${ids}::jsonb))`,
    ...members.map((m) => (m.pin === null
      ? sql`UPDATE staff_members SET name = ${m.name}, role = ${m.role} WHERE id = ${m.id}`
      : sql`INSERT INTO staff_members (id, name, role, pin) VALUES (${m.id}, ${m.name}, ${m.role}, crypt(${m.pin}, gen_salt('bf', 10)))
          ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, role = EXCLUDED.role, pin = EXCLUDED.pin`)),
    // Role changes take effect immediately for active sessions.
    ...members.map((m) => sql`UPDATE sessions SET role = ${m.role}, name = ${m.name} WHERE principal_type = 'staff' AND principal_id = ${m.id}`),
  ]);
  return json({ success: true });
}

// --- Administrators ---
async function listAdmins({ sql }) {
  const rows = await sql`SELECT id, name, email, security_question AS "securityQuestion", created_at AS "createdAt" FROM admin_users ORDER BY created_at`;
  return json({ admins: rows.map(mapAdmin) });
}

async function createAdminRoute({ sql, request }) {
  const body = await readJson(request);
  const name = text(body.name, 120);
  if (!name) throw new HttpError(400, 'Enter the administrator name.');
  const email = validEmail(body.email);
  const password = validPassword(body.password);
  const question = text(body.securityQuestion || DEFAULT_QUESTION, 200);
  const answer = text(body.securityAnswer, 200).toLowerCase();
  if (!answer) throw new HttpError(400, 'Provide an answer for the recovery question.');
  const id = newId('admin');
  try {
    await sql`INSERT INTO admin_users (id, name, email, password, security_question, security_answer)
      VALUES (${id}, ${name}, ${email}, crypt(${password}, gen_salt('bf', 10)), ${question}, crypt(${answer}, gen_salt('bf', 10)))`;
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'An administrator with this email already exists.');
    throw error;
  }
  return json({ id, admin: { id, name, email, securityQuestion: question } }, 201);
}

async function updateAdminRoute({ sql, request, params, user }) {
  const body = await readJson(request);
  const name = body.name !== undefined && body.name !== '' ? text(body.name, 120) : null;
  const email = body.email !== undefined && body.email !== '' ? validEmail(body.email) : null;
  const password = body.password ? validPassword(body.password) : null;
  const question = body.securityQuestion ? text(body.securityQuestion, 200) : null;
  const answer = body.securityAnswer ? text(body.securityAnswer, 200).toLowerCase() : null;
  let rows;
  try {
    rows = await sql`UPDATE admin_users SET
      name = COALESCE(${name}, name),
      email = COALESCE(${email}, email),
      password = CASE WHEN ${password}::text IS NULL THEN password ELSE crypt(${password}::text, gen_salt('bf', 10)) END,
      security_question = COALESCE(${question}, security_question),
      security_answer = CASE WHEN ${answer}::text IS NULL THEN security_answer ELSE crypt(${answer}::text, gen_salt('bf', 10)) END
      WHERE id = ${params.id}
      RETURNING id, name, email, security_question AS "securityQuestion", created_at AS "createdAt"`;
  } catch (error) {
    if (error.code === '23505') throw new HttpError(409, 'An administrator with this email already exists.');
    throw error;
  }
  if (!rows.length) throw new HttpError(404, 'Administrator not found.');
  const admin = rows[0];
  if (password) await deleteSessionsFor(sql, admin.id, user.tokenHash);
  await sql`UPDATE sessions SET name = ${admin.name}, email = ${admin.email} WHERE principal_type = 'admin' AND principal_id = ${admin.id}`;
  await sql`UPDATE sessions SET elevated_admin_name = ${admin.name}, elevated_admin_email = ${admin.email} WHERE elevated_admin_id = ${admin.id}`;
  return json({ id: admin.id, success: true, admin: mapAdmin(admin) });
}

async function deleteAdminRoute({ sql, params }) {
  const [, deleted] = await sql.transaction([
    sql`SELECT pg_advisory_xact_lock(424244)`,
    sql`DELETE FROM admin_users WHERE id = ${params.id} AND (SELECT count(*) FROM admin_users) > 1 RETURNING id`,
  ]);
  if (!deleted.length) {
    const exists = await sql`SELECT 1 FROM admin_users WHERE id = ${params.id}`;
    if (!exists.length) throw new HttpError(404, 'Administrator not found.');
    throw new HttpError(400, 'Cannot remove the last administrator. The shop must have at least one administrator.');
  }
  await deleteSessionsFor(sql, params.id);
  return json({ id: params.id, success: true });
}

// --- Public bill (no session; unguessable per-order token) ---
async function publicBill({ sql, url, params, ip }) {
  const token = String(url.searchParams.get('token') || '').trim().toLowerCase();
  const bucket = `bill:${ip}`;
  await assertNotRateLimited(sql, bucket, RATE_LIMITS.bill);
  const rows = token
    ? await sql.query(`SELECT ${ORDER_COLUMNS}, share_token FROM orders
        WHERE (id = $1 OR lower(order_no) = lower($1)) AND share_token IS NOT NULL LIMIT 1`, [params.id])
    : [];
  if (!rows.length || !safeEqual(rows[0].share_token, token)) {
    await recordFailedAttempt(sql, bucket);
    throw new HttpError(403, 'This invoice link is invalid or has expired.');
  }
  const { share_token: _ignored, ...orderRow } = rows[0];
  const order = mapOrder(orderRow);
  const [customerRows, settings, payments] = await Promise.all([
    sql`SELECT name, mobile FROM customers WHERE id = ${order.customerId}`,
    loadSettings(sql),
    sql`SELECT id, amount, method, created_at AS "createdAt" FROM payments WHERE order_id = ${order.id} ORDER BY created_at`,
  ]);
  const customer = customerRows[0] || { name: 'Valued Customer', mobile: '' };
  const mobile = String(customer.mobile || '');
  const publicSettings = {};
  for (const key of ['storeName', 'tagline', 'phone', 'address', 'taxEnabled', 'taxLabel', 'taxPercent', 'taxNumber', 'splitGst', 'receiptFooter', 'currency']) {
    publicSettings[key] = settings[key];
  }
  return json({
    order,
    customer: { name: customer.name, mobile: mobile.length > 4 ? `${'•'.repeat(mobile.length - 4)}${mobile.slice(-4)}` : mobile },
    settings: publicSettings,
    payments: payments.map((p) => numbers(p, ['amount'])),
  });
}

// ---------------------------------------------------------------------------
// Router
// ---------------------------------------------------------------------------
const routes = [
  ['GET', '/api/health', health, 'public'],
  ['POST', '/api/auth/pin', loginPin, 'public'],
  ['POST', '/api/auth/admin', loginAdmin, 'public'],
  ['POST', '/api/auth/setup', setupStore, 'public'],
  ['POST', '/api/auth/recover', recoverQuestion, 'public'],
  ['POST', '/api/auth/reset', resetWithAnswer, 'public'],
  ['GET', '/api/public-bill/:id', publicBill, 'public'],

  ['GET', '/api/auth/me', me, 'user'],
  ['POST', '/api/auth/logout', logout, 'user'],
  ['POST', '/api/auth/elevate', elevate, 'user'],
  ['POST', '/api/auth/drop-admin', dropAdmin, 'user'],
  ['GET', '/api/bootstrap', bootstrap, 'user'],
  ['POST', '/api/customers', createCustomer, 'user'],
  ['PATCH', '/api/customers/:id', updateCustomer, 'user'],
  ['POST', '/api/orders', createOrderRoute, 'user'],
  ['PATCH', '/api/orders/:id', updateOrderStatus, 'user'],
  ['POST', '/api/orders/:id/payments', recordPayment, 'user'],
  ['POST', '/api/orders/:id/share-link', shareLink, 'user'],
  ['POST', '/api/packages', sellPackage, 'user'],
  ['POST', '/api/catalog', addCatalogEntry, 'user'],

  ['DELETE', '/api/customers/:id', deleteCustomer, 'admin'],
  ['PATCH', '/api/settings', updateSettings, 'admin'],
  ['PUT', '/api/staff', replaceStaff, 'admin'],
  ['POST', '/api/package-templates', createTemplate, 'admin'],
  ['PATCH', '/api/package-templates/:id', updateTemplate, 'admin'],
  ['DELETE', '/api/package-templates/:id', deleteTemplate, 'admin'],
  ['GET', '/api/admins', listAdmins, 'admin'],
  ['POST', '/api/admins', createAdminRoute, 'admin'],
  ['PATCH', '/api/admins/:id', updateAdminRoute, 'admin'],
  ['DELETE', '/api/admins/:id', deleteAdminRoute, 'admin'],
].map(([method, pattern, handler, access]) => ({
  method,
  handler,
  access,
  regex: new RegExp(`^${pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)')}$`),
}));

function matchRoute(method, path) {
  let pathMatched = false;
  for (const route of routes) {
    const m = path.match(route.regex);
    if (!m) continue;
    pathMatched = true;
    if (route.method !== method) continue;
    const params = {};
    for (const [k, v] of Object.entries(m.groups || {})) params[k] = decodeURIComponent(v);
    return { route, params };
  }
  return { route: null, pathMatched };
}

function errorResponse(error) {
  if (error instanceof HttpError) return json({ error: error.message }, error.status);
  if (error instanceof PricingError) return json({ error: error.message }, 400);
  if (error?.code === '23505') return json({ error: 'That record already exists.' }, 409);
  if (error?.code === '23503') return json({ error: 'Related records prevent this change.' }, 409);
  if (error?.code === '23514') return json({ error: 'That change would make a balance negative.' }, 409);
  if (['22P02', '22007', '22008', '22003'].includes(error?.code)) return json({ error: 'Some values in the request are invalid.' }, 400);
  console.error('API request failed', error);
  return json({ error: 'The request could not be completed. Try again.' }, 500);
}

/**
 * Handles an /api/* request.
 * `deps.sql` lets tests inject a database client; production uses Neon over HTTP.
 */
export async function handleApi(request, env = {}, deps = {}) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const method = request.method.toUpperCase();

  let sql = deps.sql;
  if (!sql) {
    if (!env.DATABASE_URL) {
      if (path === '/api/health') return json({ database: false });
      return json({ error: 'The database is not configured on this server.' }, 503);
    }
    const { neon } = await import('@neondatabase/serverless');
    sql = neon(env.DATABASE_URL);
  }

  try {
    const { route, params, pathMatched } = matchRoute(method, path);
    if (!route) return json({ error: pathMatched ? 'Method not allowed.' : 'Not found.' }, pathMatched ? 405 : 404);

    await ensureSchema(sql, env.DATABASE_URL || sql);

    let user = null;
    if (route.access !== 'public') {
      user = await getSessionUser(sql, request);
      if (!user) return json({ error: 'Your session has ended. Sign in again.' }, 401);
      if (route.access === 'admin' && !user.isAdmin) return json({ error: 'Administrator access is required.' }, 403);
    }

    return await route.handler({ request, env, sql, url, params, user, ip: clientIp(request) });
  } catch (error) {
    return errorResponse(error);
  }
}
