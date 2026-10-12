import { neon } from '@neondatabase/serverless';

const fallbackPackages = [
  { id: 'wallet-2000', name: 'Everyday Wallet', description: 'Add ₹2,000 laundry credit. Use toward any bill. No expiration.', kind: 'wallet', price: 2000, walletCredit: 2000, discountPercent: 0, accent: 'violet' },
  { id: 'fresh-15', name: 'Fresh Club · 15% off', description: 'Save 15% on eligible laundry anytime. Lifetime package.', kind: 'discount', price: 1800, walletCredit: 0, discountPercent: 15, accent: 'mint' },
  { id: 'half-price', name: 'Half Price Privilege', description: 'Flat 50% off eligible garments with no validity expiration.', kind: 'discount', price: 6000, walletCredit: 0, discountPercent: 50, accent: 'peach' },
];

const fallbackSettings = {
  storeName: 'Clean Clear Dry Cleaning',
  tagline: 'Premium Fabric Care & Dry Cleaning',
  phone: '+91 98765 43210',
  address: 'Shop 14, Galleria Market, Sector 28, Gurugram',
  taxEnabled: true,
  taxLabel: 'GST',
  taxPercent: 18,
  taxNumber: '07AAAAA0000A1Z5',
  splitGst: true,
  receiptFooter: 'Thank you for choosing Clean Clear Dry Cleaning! Goods not collected within 30 days are not store liability.',
  currency: '₹',
};

const fallbackStaff = [
  { id: 'staff-admin', name: 'Store Manager', role: 'admin', pin: '1234' },
  { id: 'staff-cashier1', name: 'Cashier 1', role: 'cashier', pin: '0000' },
  { id: 'staff-cashier2', name: 'Cashier 2', role: 'cashier', pin: '2222' },
];

const garmentPrices = { shirt: 110, trousers: 150, 'suit-2pc': 400, jacket: 350, kurta: 175, saree: 450, dress: 250, blouse: 100, coat: 550, 'school-uniform': 140, 'kids-dress': 170, 'blanket-single': 350, 'blanket-double': 500, curtains: 300 };
const serviceFactors = { 'Dry cleaning': 1, 'Premium laundry': 0.82, 'Steam press': 0.55, 'Club Fresh DC': 0.7, 'Club Fresh SP': 0.4 };
const kgRates = {
  'Dry cleaning': 260, 'Premium laundry': 190, 'Steam press': 125, 'Club Fresh DC': 200, 'Club Fresh SP': 95,
  'Wash and Fold': 90, 'Wash and iron': 140, 'DCG by Kilo': 250, 'Drying': 60,
};

const response = (body, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json; charset=utf-8' } });
const id = (prefix) => `${prefix}-${crypto.randomUUID()}`;
const roundMoney = (value) => Math.round((Number(value) + Number.EPSILON) * 100) / 100;

function getNextOrderNo(currentOrderNo) {
  if (!currentOrderNo || typeof currentOrderNo !== 'string') return 'B6164';
  const trimmed = currentOrderNo.trim();
  if (!trimmed) return 'B6164';

  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const numStr = match[2];
    const nextNum = parseInt(numStr, 10) + 1;
    const nextNumStr = String(nextNum).padStart(numStr.length, '0');
    return `${prefix}${nextNumStr}`;
  }

  return `${trimmed}1`;
}

async function ensureAdminTable(sql) {
  try {
    await sql`CREATE TABLE IF NOT EXISTS admin_users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      password TEXT NOT NULL,
      security_question TEXT NOT NULL DEFAULT 'What city is this store in?',
      security_answer TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )`;
    await sql`CREATE UNIQUE INDEX IF NOT EXISTS admin_users_email_idx ON admin_users (LOWER(email))`.catch(() => {});

    const countRows = await sql`SELECT count(*) AS total FROM admin_users`.catch(() => []);
    if (Number(countRows[0]?.total || 0) === 0) {
      await sql`INSERT INTO admin_users (id, name, email, password, security_question, security_answer)
        VALUES ('admin-1', 'Store Administrator', 'admin@freshfold.test', 'admin123', 'What city is this store in?', 'gurugram')
        ON CONFLICT (id) DO NOTHING`.catch(() => {});
      await syncAdminsToStoreSettings(sql);
    }
  } catch {}
}

async function syncAdminsToStoreSettings(sql) {
  try {
    const admins = await sql`SELECT id, name, email, password, security_question AS "securityQuestion", security_answer AS "securityAnswer" FROM admin_users ORDER BY created_at ASC`;
    const existing = await sql`SELECT config FROM store_settings WHERE id = 'current' LIMIT 1`.catch(() => []);
    const merged = { ...(existing[0]?.config || {}), admins };
    await sql`INSERT INTO store_settings (id, config) VALUES ('current', ${JSON.stringify(merged)}::jsonb)
      ON CONFLICT (id) DO UPDATE SET config = ${JSON.stringify(merged)}::jsonb`;
  } catch {}
}

async function handleApi(request, env) {
  const url = new URL(request.url);
  const method = request.method;
  const path = url.pathname;
  if (path === '/api/health') return response({ database: Boolean(env.DATABASE_URL) });
  if (!env.DATABASE_URL) return response({ error: 'Neon is not configured. The app is using local browser storage.' }, 503);
  const sql = neon(env.DATABASE_URL);

  try {
    if (method === 'GET' && path === '/api/bootstrap') {
      const [customers, orders, customerPackages, payments, packageSales, walletTransactions, rawPackages, rawSettings, rawStaff] = await Promise.all([
        sql`SELECT id, name, mobile, email, address, notes, wallet_balance AS "walletBalance", created_at AS "createdAt" FROM customers ORDER BY created_at DESC`,
        sql`SELECT id, order_no AS "orderNo", customer_id AS "customerId", order_type AS type, service, items, weight_kg AS "weightKg", weight_note AS "weightNote", gross_amount AS "grossAmount", discount_amount AS "discountAmount", discount_percent AS "discountPercent", discount_name AS "discountName", tax_amount AS "taxAmount", tax_percent AS "taxPercent", total_amount AS "totalAmount", paid_amount AS "paidAmount", balance_amount AS "balanceAmount", status, due_date AS "dueDate", created_at AS "createdAt" FROM orders ORDER BY created_at DESC`,
        sql`SELECT id, customer_id AS "customerId", template_id AS "templateId", name, kind, wallet_credit AS "walletCredit", discount_percent AS "discountPercent", starts_at AS "startsAt", expires_at AS "expiresAt", paid_amount AS "paidAmount", status FROM customer_packages ORDER BY created_at DESC`,
        sql`SELECT id, order_id AS "orderId", customer_id AS "customerId", amount, method, created_at AS "createdAt" FROM payments ORDER BY created_at DESC`,
        sql`SELECT id, customer_id AS "customerId", customer_package_id AS "packageId", template_id AS "templateId", name, amount, method, created_at AS "createdAt" FROM package_sales ORDER BY created_at DESC`,
        sql`SELECT id, customer_id AS "customerId", customer_package_id AS "packageId", order_id AS "orderId", kind, amount, description, created_at AS "createdAt" FROM wallet_transactions ORDER BY created_at DESC`,
        sql`SELECT id, name, description, kind, price, wallet_credit AS "walletCredit", discount_percent AS "discountPercent", accent FROM package_templates WHERE enabled = true`.catch(() => fallbackPackages),
        sql`SELECT config FROM store_settings WHERE id = 'current' LIMIT 1`.catch(() => []),
        sql`SELECT id, name, role, pin FROM staff_members`.catch(() => fallbackStaff),
      ]);

      let rawAdmins = [];
      try {
        rawAdmins = await sql`SELECT id, name, email, password, security_question AS "securityQuestion", security_answer AS "securityAnswer", created_at AS "createdAt" FROM admin_users ORDER BY created_at ASC`;
      } catch {
        await ensureAdminTable(sql);
        rawAdmins = await sql`SELECT id, name, email, password, security_question AS "securityQuestion", security_answer AS "securityAnswer", created_at AS "createdAt" FROM admin_users ORDER BY created_at ASC`.catch(() => []);
      }

      // If admin_users table is empty, check store_settings config as backup
      if ((!rawAdmins || rawAdmins.length === 0) && Array.isArray(rawSettings[0]?.config?.admins) && rawSettings[0].config.admins.length > 0) {
        rawAdmins = rawSettings[0].config.admins;
        for (const adm of rawAdmins) {
          await sql`INSERT INTO admin_users (id, name, email, password, security_question, security_answer)
            VALUES (${adm.id || id('admin')}, ${adm.name || 'Store Administrator'}, ${String(adm.email || '').toLowerCase()}, ${adm.password || ''}, ${adm.securityQuestion || 'What city is this store in?'}, ${adm.securityAnswer || ''})
            ON CONFLICT (id) DO NOTHING`.catch(() => {});
        }
      }

      const packages = rawPackages.length ? rawPackages : fallbackPackages;
      const settings = {
        ...fallbackSettings,
        ...(rawSettings[0]?.config || {}),
      };
      const staff = rawStaff.length ? rawStaff : fallbackStaff;
      const admins = Array.isArray(rawAdmins) ? rawAdmins : [];

      return response({ customers, orders, customerPackages, payments, packageSales, walletTransactions, packages, settings, staff, admins });
    }

    // --- CUSTOMERS ---
    if (method === 'POST' && path === '/api/customers') {
      const body = await request.json();
      const name = String(body.name || '').trim();
      const mobile = String(body.mobile || '').trim();
      if (!name || mobile.replace(/\D/g, '').length < 10) return response({ error: 'Enter a customer name and valid mobile number.' }, 400);
      const customerId = id('cus');
      await sql`INSERT INTO customers (id, name, mobile, email, address, notes) VALUES (${customerId}, ${name}, ${mobile}, ${String(body.email || '')}, ${String(body.address || '')}, ${String(body.notes || '')})`;
      return response({ id: customerId }, 201);
    }

    const customerMatch = path.match(/^\/api\/customers\/([^/]+)$/);
    if (method === 'PATCH' && customerMatch) {
      const customerId = decodeURIComponent(customerMatch[1]);
      const body = await request.json();
      const rows = await sql`UPDATE customers SET name = COALESCE(${body.name ?? null}, name), mobile = COALESCE(${body.mobile ?? null}, mobile), email = COALESCE(${body.email ?? null}, email), address = COALESCE(${body.address ?? null}, address), notes = COALESCE(${body.notes ?? null}, notes) WHERE id = ${customerId} RETURNING id`;
      return rows.length ? response({ id: customerId }) : response({ error: 'Customer not found.' }, 404);
    }

    if (method === 'DELETE' && customerMatch) {
      const customerId = decodeURIComponent(customerMatch[1]);
      await sql`DELETE FROM customers WHERE id = ${customerId}`;
      return response({ id: customerId, success: true });
    }

    // --- PACKAGE TEMPLATES CRUD (CREATE, EDIT, DELETE - NO VALIDITY) ---
    if (method === 'POST' && path === '/api/package-templates') {
      const body = await request.json();
      const pkgId = body.id || id('pkg');
      await sql`INSERT INTO package_templates (id, name, description, kind, price, wallet_credit, discount_percent, duration_days, accent, enabled)
        VALUES (${pkgId}, ${String(body.name || '').trim()}, ${String(body.description || '')}, ${String(body.kind || 'discount')}, ${Number(body.price || 0)}, ${Number(body.walletCredit || 0)}, ${Number(body.discountPercent || 0)}, NULL, ${String(body.accent || 'violet')}, true)`;
      return response({ id: pkgId }, 201);
    }

    const pkgTemplateMatch = path.match(/^\/api\/package-templates\/([^/]+)$/);
    if (method === 'PATCH' && pkgTemplateMatch) {
      const pkgId = decodeURIComponent(pkgTemplateMatch[1]);
      const body = await request.json();
      const rows = await sql`UPDATE package_templates SET
        name = COALESCE(${body.name ?? null}, name),
        description = COALESCE(${body.description ?? null}, description),
        kind = COALESCE(${body.kind ?? null}, kind),
        price = COALESCE(${body.price !== undefined ? Number(body.price) : null}, price),
        wallet_credit = COALESCE(${body.walletCredit !== undefined ? Number(body.walletCredit) : null}, wallet_credit),
        discount_percent = COALESCE(${body.discountPercent !== undefined ? Number(body.discountPercent) : null}, discount_percent),
        accent = COALESCE(${body.accent ?? null}, accent)
        WHERE id = ${pkgId} RETURNING id`;
      return rows.length ? response({ id: pkgId }) : response({ error: 'Package not found.' }, 404);
    }

    if (method === 'DELETE' && pkgTemplateMatch) {
      const pkgId = decodeURIComponent(pkgTemplateMatch[1]);
      await sql`UPDATE package_templates SET enabled = false WHERE id = ${pkgId}`;
      return response({ id: pkgId, success: true });
    }

    // --- STORE SETTINGS & STAFF ---
    if (method === 'PATCH' && path === '/api/settings') {
      const body = await request.json();
      const existingRows = await sql`SELECT config FROM store_settings WHERE id = 'current' LIMIT 1`.catch(() => []);
      const merged = { ...fallbackSettings, ...(existingRows[0]?.config || {}), ...body };
      await sql`INSERT INTO store_settings (id, config) VALUES ('current', ${JSON.stringify(merged)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET config = ${JSON.stringify(merged)}::jsonb`;
      return response({ success: true, settings: merged });
    }

    if (method === 'PUT' && path === '/api/staff') {
      const body = await request.json();
      const staffList = Array.isArray(body.staff) ? body.staff : [];
      await sql`DELETE FROM staff_members`;
      for (const s of staffList) {
        await sql`INSERT INTO staff_members (id, name, role, pin) VALUES (${s.id || id('staff')}, ${s.name}, ${s.role}, ${s.pin})`;
      }
      return response({ success: true });
    }

    // --- ADMINISTRATORS CRUD & PASSWORD RESET ---
    if (method === 'GET' && path === '/api/admins') {
      await ensureAdminTable(sql);
      const rows = await sql`SELECT id, name, email, password, security_question AS "securityQuestion", security_answer AS "securityAnswer", created_at AS "createdAt" FROM admin_users ORDER BY created_at ASC`.catch(() => []);
      return response({ admins: rows });
    }

    if (method === 'POST' && path === '/api/admins') {
      const body = await request.json();
      const name = String(body.name || '').trim();
      const email = String(body.email || '').trim().toLowerCase();
      const password = String(body.password || '').trim();
      const securityQuestion = String(body.securityQuestion || 'What city is this store in?').trim();
      const securityAnswer = String(body.securityAnswer || '').trim().toLowerCase();

      if (!name || !email || !password) {
        return response({ error: 'Name, email, and password are required.' }, 400);
      }
      await ensureAdminTable(sql);
      const adminId = body.id || id('admin');
      await sql`INSERT INTO admin_users (id, name, email, password, security_question, security_answer)
        VALUES (${adminId}, ${name}, ${email}, ${password}, ${securityQuestion}, ${securityAnswer})
        ON CONFLICT (id) DO UPDATE SET
          name = EXCLUDED.name,
          email = EXCLUDED.email,
          password = EXCLUDED.password,
          security_question = EXCLUDED.security_question,
          security_answer = EXCLUDED.security_answer`;

      await syncAdminsToStoreSettings(sql);
      return response({ id: adminId, success: true, admin: { id: adminId, name, email, password, securityQuestion, securityAnswer } }, 201);
    }

    const adminMatch = path.match(/^\/api\/admins\/([^/]+)$/);
    if (method === 'PATCH' && adminMatch) {
      const adminId = decodeURIComponent(adminMatch[1]);
      const body = await request.json();
      await ensureAdminTable(sql);

      const nameVal = body.name ? String(body.name).trim() : null;
      const emailVal = body.email ? String(body.email).trim().toLowerCase() : null;
      const passVal = body.password ? String(body.password).trim() : null;
      const quesVal = body.securityQuestion ? String(body.securityQuestion).trim() : null;
      const ansVal = body.securityAnswer ? String(body.securityAnswer).trim().toLowerCase() : null;

      const rows = await sql`
        UPDATE admin_users SET
          name = COALESCE(${nameVal}, name),
          email = COALESCE(${emailVal}, email),
          password = COALESCE(${passVal}, password),
          security_question = COALESCE(${quesVal}, security_question),
          security_answer = COALESCE(${ansVal}, security_answer)
        WHERE id = ${adminId}
        RETURNING id, name, email, password, security_question AS "securityQuestion", security_answer AS "securityAnswer"
      `;

      if (rows.length) {
        await syncAdminsToStoreSettings(sql);
        return response({ id: adminId, success: true, admin: rows[0] });
      }
      return response({ error: 'Administrator not found.' }, 404);
    }

    if (method === 'DELETE' && adminMatch) {
      const adminId = decodeURIComponent(adminMatch[1]);
      await ensureAdminTable(sql);

      const adminCountRows = await sql`SELECT count(*) AS total FROM admin_users`;
      const totalAdmins = Number(adminCountRows[0]?.total || 0);
      if (totalAdmins <= 1) {
        return response({ error: 'Cannot remove the last administrator. The shop must have at least one active administrator.' }, 400);
      }

      await sql`DELETE FROM admin_users WHERE id = ${adminId}`;
      await syncAdminsToStoreSettings(sql);
      return response({ id: adminId, success: true });
    }

    if (method === 'POST' && path === '/api/admins/reset-password') {
      const body = await request.json();
      const adminId = String(body.adminId || '').trim();
      const newPassword = String(body.newPassword || '').trim();
      if (!adminId || !newPassword) {
        return response({ error: 'Admin ID and new password are required.' }, 400);
      }
      await ensureAdminTable(sql);
      const rows = await sql`UPDATE admin_users SET password = ${newPassword} WHERE id = ${adminId} RETURNING id`;
      if (rows.length) {
        await syncAdminsToStoreSettings(sql);
        return response({ success: true });
      }
      return response({ error: 'Administrator not found.' }, 404);
    }

    // --- ORDERS (WITH GST/TAX & BEST DISCOUNT) ---
    if (method === 'POST' && path === '/api/orders') {
      const body = await request.json();
      const orderId = id('ord');
      let orderNo = body.orderNo ? String(body.orderNo).trim() : '';
      if (!orderNo) {
        const lastOrderRows = await sql`SELECT order_no AS "orderNo" FROM orders ORDER BY created_at DESC LIMIT 1`;
        if (lastOrderRows.length > 0 && lastOrderRows[0].orderNo) {
          orderNo = getNextOrderNo(lastOrderRows[0].orderNo);
        } else {
          orderNo = `B6164`;
        }
      }
      const type = body.type === 'weight' ? 'weight' : 'pieces';
      const serviceName = String(body.service || 'Dry cleaning');
      let items = [];
      let grossAmount = 0;
      let weightKg = 0;
      if (type === 'weight') {
        weightKg = Number(body.weightKg);
        if (!(weightKg > 0) || !kgRates[serviceName]) return response({ error: 'Enter a valid weight and service.' }, 400);
        grossAmount = roundMoney(weightKg * kgRates[serviceName]);
      } else {
        if (!Array.isArray(body.items) || !body.items.length) return response({ error: 'Choose at least one garment.' }, 400);
        const factor = serviceFactors[serviceName] || 1;
        items = body.items.map((item, index) => {
          const quantity = Math.max(1, Math.min(100, Number(item.quantity) || 1));
          let unitPrice = 0;
          if (item.unitPrice !== undefined && item.unitPrice !== null && !isNaN(Number(item.unitPrice))) {
            unitPrice = roundMoney(Number(item.unitPrice));
          } else {
            const basePrice = garmentPrices[item.id] || 100;
            unitPrice = roundMoney(basePrice * (factor || 1));
          }
          grossAmount += unitPrice * quantity;
          return { id: id('line'), name: item.name || 'Garment', category: item.category || 'General', service: serviceName, unitPrice, quantity, note: String(item.note || ''), barcode: `${orderNo}-${index + 1}`, status: 'Received' };
        });
        grossAmount = roundMoney(grossAmount);
      }

      // Check active package discount (No validity constraint / lifetime check)
      let discountAmount = 0;
      let discountPercent = 0;
      let discountName = body.discountName || '';
      if (body.discountAmount !== undefined) {
        discountAmount = roundMoney(Number(body.discountAmount || 0));
        discountPercent = roundMoney(Number(body.discountPercent || 0));
      } else {
        const discountRows = await sql`SELECT discount_percent AS percent, name FROM customer_packages WHERE customer_id = ${String(body.customerId)} AND status = 'active' AND (expires_at IS NULL OR expires_at >= CURRENT_DATE) AND discount_percent > 0`;
        const bestDiscount = discountRows.sort((a, b) => Number(b.percent) - Number(a.percent))[0];
        discountPercent = Number(bestDiscount?.percent || 0);
        discountAmount = roundMoney(grossAmount * discountPercent / 100);
        discountName = bestDiscount?.name || '';
      }
      const subtotalBeforeExpress = Math.max(0, grossAmount - discountAmount);
      const expressPercent = Number(body.expressPercent || 0);
      const expressAmount = expressPercent > 0
        ? roundMoney(subtotalBeforeExpress * (expressPercent / 100))
        : roundMoney(Number(body.expressAmount || 0));
      const expressLabel = body.expressLabel || (expressPercent > 0 ? `Early Delivery (+${expressPercent}%)` : '');
      const subtotal = subtotalBeforeExpress + expressAmount;

      if (expressAmount > 0 && Array.isArray(items)) {
        items.push({
          id: id('surcharge'),
          name: expressLabel || 'Early Delivery Surcharge',
          category: 'Service Surcharge',
          service: serviceName,
          unitPrice: expressAmount,
          quantity: 1,
          isSurcharge: true,
          status: 'Applied',
        });
      }

      // Tax engine (strictly respects store settings and payload flag)
      const settingsRows = await sql`SELECT config FROM store_settings WHERE id = 'current' LIMIT 1`.catch(() => []);
      const currentSettings = { ...fallbackSettings, ...(settingsRows[0]?.config || {}) };
      const isTaxEnabled = body.taxEnabled !== undefined
        ? Boolean(body.taxEnabled)
        : (currentSettings.taxEnabled !== false);
      const taxPercent = isTaxEnabled
        ? Number(body.taxPercent !== undefined ? body.taxPercent : (currentSettings.taxPercent ?? 18))
        : 0;
      const taxAmount = isTaxEnabled ? roundMoney(subtotal * taxPercent / 100) : 0;
      const totalAmount = roundMoney(subtotal + taxAmount);

      // Check customer wallet balance for auto-deducting credits
      const customerRows = await sql`SELECT wallet_balance AS "walletBalance" FROM customers WHERE id = ${String(body.customerId)}`;
      const walletBalance = Number(customerRows[0]?.walletBalance || 0);
      const autoDeduct = Math.min(walletBalance, totalAmount);
      const paidAmount = autoDeduct;
      const balanceAmount = roundMoney(Math.max(0, totalAmount - autoDeduct));

      await sql`INSERT INTO orders (id, order_no, customer_id, order_type, service, items, weight_kg, weight_note, gross_amount, discount_amount, discount_percent, discount_name, tax_amount, tax_percent, total_amount, paid_amount, balance_amount, status, due_date)
        VALUES (${orderId}, ${orderNo}, ${String(body.customerId)}, ${type}, ${serviceName}, ${JSON.stringify(items)}::jsonb, ${weightKg}, ${String(body.weightNote || '')}, ${grossAmount}, ${discountAmount}, ${discountPercent}, ${discountName}, ${taxAmount}, ${taxPercent}, ${totalAmount}, ${paidAmount}, ${balanceAmount}, 'Received', ${String(body.dueDate || new Date().toISOString().slice(0, 10))})`;

      if (autoDeduct > 0) {
        const payId = id('pay');
        const wtId = id('wt');
        await Promise.all([
          sql`UPDATE customers SET wallet_balance = GREATEST(0, wallet_balance - ${autoDeduct}) WHERE id = ${String(body.customerId)}`,
          sql`INSERT INTO payments (id, order_id, customer_id, amount, method) VALUES (${payId}, ${orderId}, ${String(body.customerId)}, ${autoDeduct}, 'wallet')`,
          sql`INSERT INTO wallet_transactions (id, customer_id, order_id, kind, amount, description) VALUES (${wtId}, ${String(body.customerId)}, ${orderId}, 'debit', ${autoDeduct}, ${'Payment for ' + orderNo})`,
        ]);
      }

      return response({ id: orderId, orderNo, autoDeduct, paidAmount, balanceAmount }, 201);
    }

    // --- PACKAGE SALE (LIFETIME / NO EXPIRY) ---
    if (method === 'POST' && path === '/api/packages') {
      const body = await request.json();
      const templateRows = await sql`SELECT id, name, kind, price, wallet_credit AS "walletCredit", discount_percent AS "discountPercent" FROM package_templates WHERE id = ${body.templateId}`;
      const template = templateRows[0] || fallbackPackages.find((p) => p.id === body.templateId);
      if (!template) return response({ error: 'Package is unavailable.' }, 400);
      const customerPackageId = id('cp');
      const saleId = id('sale');
      const transactionId = id('wt');

      const assigned = await sql`WITH new_package AS (
        INSERT INTO customer_packages (id, customer_id, template_id, name, kind, wallet_credit, discount_percent, starts_at, expires_at, paid_amount, payment_method, status)
        VALUES (${customerPackageId}, ${String(body.customerId)}, ${body.templateId}, ${template.name}, ${template.kind}, ${template.walletCredit}, ${template.discountPercent}, CURRENT_DATE, NULL, ${template.price}, ${String(body.paymentMethod || 'cash')}, 'active')
        RETURNING *
      ), wallet_update AS (
        UPDATE customers c SET wallet_balance = c.wallet_balance + ${template.walletCredit}
        FROM new_package p WHERE c.id = p.customer_id RETURNING c.id
      ), sale AS (
        INSERT INTO package_sales (id, customer_id, customer_package_id, template_id, name, amount, method)
        SELECT ${saleId}, p.customer_id, p.id, p.template_id, p.name, p.paid_amount, p.payment_method FROM new_package p
        RETURNING id
      ), ledger AS (
        INSERT INTO wallet_transactions (id, customer_id, customer_package_id, kind, amount, description)
        SELECT ${transactionId}, p.customer_id, p.id, 'credit', p.wallet_credit, p.name || ' purchased' FROM new_package p WHERE p.wallet_credit > 0
        RETURNING id
      ) SELECT id FROM new_package`;
      return assigned.length ? response({ id: customerPackageId }, 201) : response({ error: 'Customer could not be found.' }, 404);
    }

    // --- PAYMENTS ---
    const paymentMatch = path.match(/^\/api\/orders\/([^/]+)\/payments$/);
    if (method === 'POST' && paymentMatch) {
      const orderId = decodeURIComponent(paymentMatch[1]);
      const body = await request.json();
      const amount = roundMoney(Number(body.amount));
      const methodName = String(body.method || 'cash');
      if (!(amount > 0) || !['wallet', 'cash', 'upi', 'card'].includes(methodName)) return response({ error: 'Enter a valid amount and payment method.' }, 400);
      const paymentId = id('pay');
      const transactionId = id('wt');
      let result;
      if (methodName === 'wallet') {
        result = await sql`WITH wallet_debit AS (
          UPDATE customers c SET wallet_balance = c.wallet_balance - ${amount}
          FROM orders o WHERE o.id = ${orderId} AND o.customer_id = c.id AND o.balance_amount = ${amount} AND c.wallet_balance >= ${amount}
          RETURNING c.id AS customer_id
        ), new_payment AS (
          INSERT INTO payments (id, order_id, customer_id, amount, method)
          SELECT ${paymentId}, ${orderId}, customer_id, ${amount}, 'wallet' FROM wallet_debit RETURNING id, customer_id, amount
        ), wallet_ledger AS (
          INSERT INTO wallet_transactions (id, customer_id, order_id, kind, amount, description)
          SELECT ${transactionId}, customer_id, ${orderId}, 'debit', amount, 'Payment for order' FROM new_payment RETURNING id
        ), order_update AS (
          UPDATE orders SET paid_amount = paid_amount + ${amount}, balance_amount = GREATEST(0, balance_amount - ${amount}) WHERE id = ${orderId} AND EXISTS (SELECT 1 FROM new_payment) RETURNING id
        ) SELECT (SELECT count(*) FROM new_payment) AS paid`;
      } else {
        result = await sql`WITH new_payment AS (
          INSERT INTO payments (id, order_id, customer_id, amount, method)
          SELECT ${paymentId}, o.id, o.customer_id, ${amount}, ${methodName} FROM orders o WHERE o.id = ${orderId} AND o.balance_amount >= ${amount}
          RETURNING id
        ), order_update AS (
          UPDATE orders SET paid_amount = paid_amount + ${amount}, balance_amount = GREATEST(0, balance_amount - ${amount}) WHERE id = ${orderId} AND EXISTS (SELECT 1 FROM new_payment) RETURNING id
        ) SELECT (SELECT count(*) FROM new_payment) AS paid`;
      }
      if (!Number(result[0]?.paid)) return response({ error: methodName === 'wallet' ? 'Wallet does not cover the full payment or the order balance changed.' : 'Payment exceeds the balance due or the order was not found.' }, 409);
      return response({ id: paymentId });
    }

    const orderMatch = path.match(/^\/api\/orders\/([^/]+)$/);
    if (method === 'PATCH' && orderMatch) {
      const orderId = decodeURIComponent(orderMatch[1]);
      const body = await request.json();
      if (!['Received', 'Processing', 'Ready', 'Delivered', 'Cancelled'].includes(body.status)) return response({ error: 'Invalid order status.' }, 400);
      const rows = await sql`UPDATE orders SET status = ${body.status}, items = CASE WHEN order_type = 'pieces' THEN COALESCE((SELECT jsonb_agg(jsonb_set(line, '{status}', to_jsonb(${body.status}::text))) FROM jsonb_array_elements(items) AS lines(line)), items) ELSE items END WHERE id = ${orderId} RETURNING id`;
      return rows.length ? response({ id: orderId }) : response({ error: 'Order not found.' }, 404);
    }

    // --- PUBLIC BILL VIEW (SECURE TOKEN VERIFIED) ---
    const publicBillMatch = path.match(/^\/api\/public-bill\/([^/]+)$/);
    if (method === 'GET' && publicBillMatch) {
      const rawIdentifier = decodeURIComponent(publicBillMatch[1]).trim();
      const token = String(url.searchParams.get('token') || '').trim().toLowerCase();

      const orderRows = await sql`SELECT id, order_no AS "orderNo", customer_id AS "customerId", order_type AS type, service, items, weight_kg AS "weightKg", weight_note AS "weightNote", gross_amount AS "grossAmount", discount_amount AS "discountAmount", discount_percent AS "discountPercent", discount_name AS "discountName", tax_amount AS "taxAmount", tax_percent AS "taxPercent", total_amount AS "totalAmount", paid_amount AS "paidAmount", balance_amount AS "balanceAmount", status, due_date AS "dueDate", created_at AS "createdAt" FROM orders WHERE id = ${rawIdentifier} OR LOWER(order_no) = LOWER(${rawIdentifier}) LIMIT 1`;
      if (!orderRows.length) return response({ error: 'Order not found.' }, 404);
      const ord = orderRows[0];

      const customerRows = await sql`SELECT id, name, mobile FROM customers WHERE id = ${ord.customerId} LIMIT 1`;
      const cust = customerRows[0] || { name: 'Valued Customer', mobile: '' };

      const cleanMobile = String(cust.mobile || '').replace(/\D/g, '').slice(-10);
      const candidateSeeds = [
        `${ord.id}:${ord.orderNo}:${ord.createdAt || ''}:${cleanMobile}:freshfold-secure-bill-v1`,
      ];
      if (ord.createdAt) {
        try {
          const iso = new Date(ord.createdAt).toISOString();
          candidateSeeds.push(`${ord.id}:${ord.orderNo}:${iso}:${cleanMobile}:freshfold-secure-bill-v1`);
          candidateSeeds.push(`${ord.id}:${ord.orderNo}:${iso.slice(0, 19)}:${cleanMobile}:freshfold-secure-bill-v1`);
          candidateSeeds.push(`${ord.id}:${ord.orderNo}:${iso.slice(0, 10)}:${cleanMobile}:freshfold-secure-bill-v1`);
        } catch {}
      }
      candidateSeeds.push(`${ord.id}:${ord.orderNo}::${cleanMobile}:freshfold-secure-bill-v1`);

      let tokenMatches = false;
      for (const seed of candidateSeeds) {
        const msgUint8 = new TextEncoder().encode(seed);
        const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('').slice(0, 16);
        if (hashHex.toLowerCase() === token) {
          tokenMatches = true;
          break;
        }
      }

      if (!tokenMatches) {
        return response({ error: 'Invalid or expired bill token.' }, 403);
      }

      const [settingsRows, paymentRows] = await Promise.all([
        sql`SELECT config FROM store_settings WHERE id = 'current' LIMIT 1`.catch(() => []),
        sql`SELECT id, amount, method, created_at AS "createdAt" FROM payments WHERE order_id = ${ord.id} ORDER BY created_at ASC`.catch(() => []),
      ]);
      const settings = settingsRows[0]?.config || fallbackSettings;

      return response({
        order: ord,
        customer: { name: cust.name, mobile: cust.mobile },
        settings,
        payments: paymentRows,
      });
    }

    return response({ error: 'Not found.' }, 404);
  } catch (error) {
    if (error.code === '23505') return response({ error: 'That mobile number already belongs to a customer.' }, 409);
    console.error('API request failed', error);
    return response({ error: 'The request could not be completed. Check database setup and try again.' }, 500);
  }
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname.startsWith('/api/')) return handleApi(request, env);
    return env.ASSETS.fetch(request);
  },
};
