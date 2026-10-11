import { neon } from '@neondatabase/serverless';

const fallbackPackages = [
  { id: 'wallet-2000', name: 'Everyday Wallet', description: 'Add ₹2,000 laundry credit. Use toward any bill. No expiration.', kind: 'wallet', price: 2000, walletCredit: 2000, discountPercent: 0, accent: 'violet' },
  { id: 'fresh-15', name: 'Fresh Club · 15% off', description: 'Save 15% on eligible laundry anytime. Lifetime package.', kind: 'discount', price: 1800, walletCredit: 0, discountPercent: 15, accent: 'mint' },
  { id: 'half-price', name: 'Half Price Privilege', description: 'Flat 50% off eligible garments with no validity expiration.', kind: 'discount', price: 6000, walletCredit: 0, discountPercent: 50, accent: 'peach' },
];

const fallbackSettings = {
  storeName: 'FreshFold Laundry',
  tagline: 'Premium Fabric Care & Dry Cleaning',
  phone: '+91 98765 43210',
  address: 'Shop 14, Galleria Market, Sector 28, Gurugram',
  taxEnabled: true,
  taxLabel: 'GST',
  taxPercent: 18,
  taxNumber: '07AAAAA0000A1Z5',
  splitGst: true,
  receiptFooter: 'Thank you for choosing FreshFold! Goods not collected within 30 days are not store liability.',
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

      const packages = rawPackages.length ? rawPackages : fallbackPackages;
      const settings = rawSettings[0]?.config || fallbackSettings;
      const staff = rawStaff.length ? rawStaff : fallbackStaff;

      return response({ customers, orders, customerPackages, payments, packageSales, walletTransactions, packages, settings, staff });
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
      await sql`INSERT INTO store_settings (id, config) VALUES ('current', ${JSON.stringify(body)}::jsonb)
        ON CONFLICT (id) DO UPDATE SET config = ${JSON.stringify(body)}::jsonb`;
      return response({ success: true });
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

    // --- ORDERS (WITH GST/TAX & BEST DISCOUNT) ---
    if (method === 'POST' && path === '/api/orders') {
      const body = await request.json();
      const orderId = id('ord');
      const orderNo = `F${new Date().toISOString().slice(2, 10).replaceAll('-', '')}${crypto.randomUUID().slice(0, 4).toUpperCase()}`;
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
      const subtotal = Math.max(0, grossAmount - discountAmount);

      // Tax engine
      const taxPercent = Number(body.taxPercent !== undefined ? body.taxPercent : 18);
      const taxAmount = body.taxEnabled !== false ? roundMoney(subtotal * taxPercent / 100) : 0;
      const totalAmount = roundMoney(subtotal + taxAmount);

      await sql`INSERT INTO orders (id, order_no, customer_id, order_type, service, items, weight_kg, weight_note, gross_amount, discount_amount, discount_percent, discount_name, tax_amount, tax_percent, total_amount, paid_amount, balance_amount, status, due_date)
        VALUES (${orderId}, ${orderNo}, ${String(body.customerId)}, ${type}, ${serviceName}, ${JSON.stringify(items)}::jsonb, ${weightKg}, ${String(body.weightNote || '')}, ${grossAmount}, ${discountAmount}, ${discountPercent}, ${discountName}, ${taxAmount}, ${taxPercent}, ${totalAmount}, 0, ${totalAmount}, 'Received', ${String(body.dueDate || new Date().toISOString().slice(0, 10))})`;
      return response({ id: orderId, orderNo }, 201);
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
