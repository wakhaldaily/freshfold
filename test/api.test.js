import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createApiClient, createTestDatabase } from './helpers/testDatabase.js';
import { renderSchemaSql } from '../src/server/schema.js';

const ADMIN = {
  name: 'Priya Owner',
  email: 'owner@cleanclear.example',
  password: 'correct-horse-9',
  securityQuestion: 'What city is this store in?',
  securityAnswer: 'Gurugram',
  storeName: 'Clean Clear Sector 57',
};

async function freshApi(env = {}) {
  const { sql, raw } = await createTestDatabase();
  return { api: createApiClient(sql, env), raw };
}

async function setupStore(api) {
  const res = await api.post('/api/auth/setup', ADMIN);
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.token;
}

async function addStaff(api, adminToken, staff) {
  const res = await api.put('/api/staff', { staff }, { token: adminToken });
  assert.equal(res.status, 200, JSON.stringify(res.data));
}

async function pinLogin(api, pin) {
  const res = await api.post('/api/auth/pin', { pin });
  assert.equal(res.status, 200, JSON.stringify(res.data));
  return res.data.token;
}

async function createCustomer(api, token, fields = {}) {
  const res = await api.post('/api/customers', { name: 'Kavita Krishnan', mobile: '9988776655', ...fields }, { token });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.id;
}

test('health reports setup state and never needs a session', async () => {
  const { api } = await freshApi();
  const res = await api.get('/api/health');
  assert.equal(res.status, 200);
  assert.equal(res.data.database, true);
  assert.equal(res.data.demo, false);
  assert.equal(res.data.setupRequired, true);
});

test('every data route rejects requests without a valid session', async () => {
  const { api } = await freshApi();
  for (const [method, path] of [
    ['get', '/api/bootstrap'], ['get', '/api/admins'], ['post', '/api/orders'], ['post', '/api/customers'],
    ['patch', '/api/settings'], ['put', '/api/staff'], ['post', '/api/admins'], ['del', '/api/admins/admin-1'],
  ]) {
    const res = method === 'get' || method === 'del' ? await api[method](path) : await api[method](path, {});
    assert.equal(res.status, 401, `${method} ${path}`);
  }
  const forged = await api.get('/api/bootstrap', { token: 'a'.repeat(64) });
  assert.equal(forged.status, 401);
});

test('first-run setup creates exactly one administrator', async () => {
  const { api } = await freshApi();
  const token = await setupStore(api);
  assert.match(token, /^[a-f0-9]{64}$/);
  const again = await api.post('/api/auth/setup', { ...ADMIN, email: 'intruder@example.com' });
  assert.equal(again.status, 409);
  const health = await api.get('/api/health');
  assert.equal(health.data.setupRequired, false);
  assert.equal(health.data.storeName, ADMIN.storeName);
});

test('demo credentials are refused unless ALLOW_DEMO_ACCOUNTS=true', async () => {
  const { api } = await freshApi();
  assert.equal((await api.post('/api/auth/pin', { pin: '1234' })).status, 403);
  assert.equal((await api.post('/api/auth/admin', { email: 'admin@freshfold.test', password: 'admin123' })).status, 403);

  const demo = await freshApi({ ALLOW_DEMO_ACCOUNTS: 'true' });
  const pin = await demo.api.post('/api/auth/pin', { pin: '0000' });
  assert.equal(pin.status, 200);
  assert.equal(pin.data.user.name, 'Cashier 1');
  const admin = await demo.api.post('/api/auth/admin', { email: 'admin@freshfold.test', password: 'admin123' });
  assert.equal(admin.status, 200);
  assert.equal(admin.data.user.isAdmin, true);
});

test('bootstrap and admin APIs never return passwords, PINs or security answers', async () => {
  const { api, raw } = await freshApi();
  const adminToken = await setupStore(api);
  await addStaff(api, adminToken, [{ id: 'staff-ravi', name: 'Ravi', role: 'cashier', pin: '4821' }]);

  const boot = await api.get('/api/bootstrap', { token: adminToken });
  assert.equal(boot.status, 200);
  const body = JSON.stringify(boot.data);
  assert.ok(!body.includes('$2a$') && !body.includes('$2b$'), 'no bcrypt hashes in bootstrap');
  assert.ok(!/"password"|"pin"|"securityAnswer"/.test(body), 'no credential fields in bootstrap');
  assert.ok(!body.includes(ADMIN.password));
  assert.deepEqual(boot.data.staff.map((s) => Object.keys(s).sort()), [['id', 'name', 'role']]);
  assert.equal(boot.data.admins.length, 1);
  assert.equal(boot.data.settings.admins, undefined);

  const stored = await raw('SELECT password, security_answer FROM admin_users');
  assert.match(stored[0].password, /^\$2[aby]\$/);
  assert.match(stored[0].security_answer, /^\$2[aby]\$/);
  const pins = await raw('SELECT pin FROM staff_members');
  for (const row of pins) assert.match(row.pin, /^\$2[aby]\$/);
});

test('cashiers cannot use admin routes; elevation grants and drop revokes admin', async () => {
  const { api } = await freshApi();
  const adminToken = await setupStore(api);
  await addStaff(api, adminToken, [{ id: 'staff-ravi', name: 'Ravi', role: 'cashier', pin: '4821' }]);
  const cashier = await pinLogin(api, '4821');

  assert.equal((await api.patch('/api/settings', { taxPercent: 0 }, { token: cashier })).status, 403);
  assert.equal((await api.put('/api/staff', { staff: [] }, { token: cashier })).status, 403);
  assert.equal((await api.post('/api/admins', { ...ADMIN, email: 'x@example.com' }, { token: cashier })).status, 403);
  assert.equal((await api.get('/api/admins', { token: cashier })).status, 403);
  const boot = await api.get('/api/bootstrap', { token: cashier });
  assert.deepEqual(boot.data.admins, [], 'cashiers do not see the admin directory');

  const badElevate = await api.post('/api/auth/elevate', { email: ADMIN.email, password: 'wrong-password' }, { token: cashier });
  assert.equal(badElevate.status, 401);
  const elevated = await api.post('/api/auth/elevate', { email: ADMIN.email, password: ADMIN.password }, { token: cashier });
  assert.equal(elevated.status, 200);
  assert.equal(elevated.data.user.isAdmin, true);
  assert.equal((await api.patch('/api/settings', { tagline: 'Fresh' }, { token: cashier })).status, 200);

  await api.post('/api/auth/drop-admin', {}, { token: cashier });
  assert.equal((await api.patch('/api/settings', { tagline: 'Again' }, { token: cashier })).status, 403);
});

test('settings cannot be used to smuggle admin records', async () => {
  const { api } = await freshApi();
  const adminToken = await setupStore(api);
  const res = await api.patch('/api/settings', { admins: [{ email: 'evil@example.com', password: 'x' }], tagline: 'Hi' }, { token: adminToken });
  assert.equal(res.status, 200);
  assert.equal(res.data.settings.admins, undefined);
  assert.equal(res.data.settings.tagline, 'Hi');
  assert.equal((await api.patch('/api/settings', { taxPercent: 250 }, { token: adminToken })).status, 400);
});

test('staff PINs must be unique, 4-6 digits and not demo PINs', async () => {
  const { api } = await freshApi();
  const adminToken = await setupStore(api);
  assert.equal((await api.put('/api/staff', { staff: [{ name: 'A', role: 'cashier', pin: '0000' }] }, { token: adminToken })).status, 400);
  assert.equal((await api.put('/api/staff', { staff: [{ name: 'A', role: 'cashier', pin: '12' }] }, { token: adminToken })).status, 400);
  assert.equal((await api.put('/api/staff', {
    staff: [{ id: 'a', name: 'A', role: 'cashier', pin: '5555' }, { id: 'b', name: 'B', role: 'cashier', pin: '5555' }],
  }, { token: adminToken })).status, 400);

  await addStaff(api, adminToken, [{ id: 'a', name: 'A', role: 'cashier', pin: '5555' }]);
  // Keeping A's PIN (no pin sent) while giving B the same PIN must fail.
  const clash = await api.put('/api/staff', { staff: [{ id: 'a', name: 'A', role: 'cashier' }, { id: 'b', name: 'B', role: 'cashier', pin: '5555' }] }, { token: adminToken });
  assert.equal(clash.status, 400);
  // Renaming without a PIN keeps the existing PIN.
  await addStaff(api, adminToken, [{ id: 'a', name: 'Anita', role: 'cashier' }]);
  const login = await api.post('/api/auth/pin', { pin: '5555' });
  assert.equal(login.data.user.name, 'Anita');
});

test('removing a staff member ends their sessions', async () => {
  const { api } = await freshApi();
  const adminToken = await setupStore(api);
  await addStaff(api, adminToken, [{ id: 'a', name: 'A', role: 'cashier', pin: '5555' }]);
  const cashier = await pinLogin(api, '5555');
  await addStaff(api, adminToken, [{ id: 'b', name: 'B', role: 'cashier', pin: '6666' }]);
  assert.equal((await api.get('/api/bootstrap', { token: cashier })).status, 401);
});

test('failed logins are rate limited per IP', async () => {
  const { api } = await freshApi();
  await setupStore(api);
  for (let i = 0; i < 10; i += 1) {
    const res = await api.post('/api/auth/pin', { pin: '9999' }, { ip: '203.0.113.9' });
    assert.equal(res.status, 401);
  }
  const blocked = await api.post('/api/auth/pin', { pin: '9999' }, { ip: '203.0.113.9' });
  assert.equal(blocked.status, 429);
  const otherIp = await api.post('/api/auth/pin', { pin: '9999' }, { ip: '203.0.113.10' });
  assert.equal(otherIp.status, 401);
});

test('password recovery checks the security answer on the server', async () => {
  const { api } = await freshApi();
  await setupStore(api);
  const question = await api.post('/api/auth/recover', { email: ADMIN.email });
  assert.equal(question.data.securityQuestion, ADMIN.securityQuestion);
  const unknown = await api.post('/api/auth/recover', { email: 'nobody@example.com' });
  assert.equal(unknown.status, 200, 'unknown emails look the same');

  const wrong = await api.post('/api/auth/reset', { email: ADMIN.email, securityAnswer: 'delhi', newPassword: 'new-password-1' });
  assert.equal(wrong.status, 401);
  const right = await api.post('/api/auth/reset', { email: ADMIN.email, securityAnswer: '  GURUGRAM ', newPassword: 'new-password-1' });
  assert.equal(right.status, 200);
  assert.equal((await api.post('/api/auth/admin', { email: ADMIN.email, password: ADMIN.password })).status, 401);
  assert.equal((await api.post('/api/auth/admin', { email: ADMIN.email, password: 'new-password-1' })).status, 200);
});

test('order prices, discounts and tax come from the catalog, not the client', async () => {
  const { api } = await freshApi();
  const token = await setupStore(api);
  const customerId = await createCustomer(api, token);

  const res = await api.post('/api/orders', {
    customerId,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-shirt', name: 'Shirt', service: 'Dry cleaning', unitPrice: 1, quantity: 2 }],
    grossAmount: 2,
    discountAmount: 9999,
    discountPercent: 100,
    taxEnabled: false,
    taxPercent: 0,
    totalAmount: 0,
  }, { token });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  assert.equal(res.data.totalAmount, 295, '2 x 125 + 18% GST');

  const boot = await api.get('/api/bootstrap', { token });
  const order = boot.data.orders[0];
  assert.equal(order.grossAmount, 250);
  assert.equal(order.discountAmount, 0);
  assert.equal(order.taxAmount, 45);
  assert.equal(order.items[0].unitPrice, 125);
  assert.equal(order.items[0].garmentId, 'm-shirt');
  assert.equal(order.balanceAmount, 295);

  const unknown = await api.post('/api/orders', { customerId, type: 'pieces', items: [{ id: 'gold-bar', quantity: 1 }] }, { token });
  assert.equal(unknown.status, 400);
  const negative = await api.post('/api/orders', { customerId, type: 'pieces', items: [{ id: 'm-shirt', quantity: -5 }] }, { token });
  assert.equal(negative.status, 400);
});

test('express surcharge is stored and totals reconcile', async () => {
  const { api } = await freshApi();
  const token = await setupStore(api);
  const customerId = await createCustomer(api, token);
  const res = await api.post('/api/orders', {
    customerId, type: 'pieces', service: 'Dry cleaning', expressPercent: 25, expressLabel: 'Express (+25%)',
    items: [{ id: 'm-suit-2pc', quantity: 1, addons: [{ id: 'addon-stain', name: 'Stain Removal', price: 0 }] }],
  }, { token });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  const order = (await api.get('/api/bootstrap', { token })).data.orders[0];
  assert.equal(order.grossAmount, 450, 'suit 400 + stain removal 50 from catalog');
  assert.equal(order.expressAmount, 112.5);
  assert.equal(order.expressLabel, 'Express (+25%)');
  const reconciled = Math.round((order.grossAmount - order.discountAmount + order.expressAmount + order.taxAmount) * 100);
  assert.equal(reconciled, Math.round(order.totalAmount * 100));
});

test('package discounts and wallet auto-deduction are applied atomically on the server', async () => {
  const { api, raw } = await freshApi();
  const token = await setupStore(api);
  const customerId = await createCustomer(api, token);

  assert.equal((await api.post('/api/packages', { customerId, templateId: 'half-price-pkg', paymentMethod: 'cash' }, { token })).status, 201);
  assert.equal((await api.post('/api/packages', { customerId, templateId: 'gold-pkg', paymentMethod: 'upi' }, { token })).status, 201);

  const res = await api.post('/api/orders', {
    customerId, type: 'pieces', service: 'Dry cleaning',
    items: [{ id: 'm-shirt', quantity: 4 }],
  }, { token });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  // 4 x 125 = 500, half price -> 250, +18% = 295, paid from the 4000 wallet
  assert.equal(res.data.totalAmount, 295);
  assert.equal(res.data.paidAmount, 295);
  assert.equal(res.data.balanceAmount, 0);

  const [cust] = await raw('SELECT wallet_balance FROM customers WHERE id = $1', [customerId]);
  assert.equal(Number(cust.wallet_balance), 3705);
  const ledger = await raw("SELECT amount FROM wallet_transactions WHERE customer_id = $1 AND kind = 'debit'", [customerId]);
  assert.deepEqual(ledger.map((r) => Number(r.amount)), [295]);
  const payments = await raw("SELECT amount FROM payments WHERE method = 'wallet'");
  assert.deepEqual(payments.map((r) => Number(r.amount)), [295]);
});

test('payments cannot exceed the balance and wallet must cover it in full', async () => {
  const { api } = await freshApi();
  const token = await setupStore(api);
  const customerId = await createCustomer(api, token);
  const order = await api.post('/api/orders', { customerId, type: 'weight', service: 'Wash and Fold', weightKg: 2 }, { token });
  assert.equal(order.status, 201, JSON.stringify(order.data));
  const { id, totalAmount } = order.data;
  assert.equal(totalAmount, 212.4, '2kg x 90 + 18%');

  assert.equal((await api.post(`/api/orders/${id}/payments`, { amount: 500, method: 'cash' }, { token })).status, 409);
  assert.equal((await api.post(`/api/orders/${id}/payments`, { amount: -5, method: 'cash' }, { token })).status, 400);
  assert.equal((await api.post(`/api/orders/${id}/payments`, { amount: totalAmount, method: 'wallet' }, { token })).status, 409);
  assert.equal((await api.post(`/api/orders/${id}/payments`, { amount: 100, method: 'upi' }, { token })).status, 201);
  assert.equal((await api.post(`/api/orders/${id}/payments`, { amount: 112.41, method: 'cash' }, { token })).status, 409);
  assert.equal((await api.post(`/api/orders/${id}/payments`, { amount: 112.4, method: 'cash' }, { token })).status, 201);
  const saved = (await api.get('/api/bootstrap', { token })).data.orders[0];
  assert.equal(saved.balanceAmount, 0);
  assert.equal(saved.paidAmount, 212.4);
});

test('order numbers: manual duplicates are rejected, automatic numbers advance', async () => {
  const { api } = await freshApi();
  const token = await setupStore(api);
  const customerId = await createCustomer(api, token);
  const base = { customerId, type: 'weight', service: 'Drying', weightKg: 1 };
  assert.equal((await api.post('/api/orders', { ...base, orderNo: 'W100' }, { token })).status, 201);
  const dup = await api.post('/api/orders', { ...base, orderNo: 'W100' }, { token });
  assert.equal(dup.status, 409);
  const auto = await api.post('/api/orders', { ...base, orderNo: 'W100', autoOrderNo: true }, { token });
  assert.equal(auto.status, 201);
  assert.equal(auto.data.orderNo, 'W101');
});

test('public bill links use an unguessable per-order token and hide private data', async () => {
  const { api } = await freshApi();
  const token = await setupStore(api);
  const customerId = await createCustomer(api, token);
  const order = await api.post('/api/orders', { customerId, type: 'weight', service: 'Drying', weightKg: 1, orderNo: 'B7001' }, { token });

  assert.equal((await api.get('/api/public-bill/B7001?token=0123456789abcdef')).status, 403, 'no token issued yet');
  const link = await api.post(`/api/orders/${order.data.id}/share-link`, {}, { token });
  assert.equal(link.status, 200);
  assert.match(link.data.token, /^[a-f0-9]{32}$/);
  const again = await api.post(`/api/orders/${order.data.id}/share-link`, {}, { token });
  assert.equal(again.data.token, link.data.token, 'link is stable');

  const bill = await api.get(`/api/public-bill/B7001?token=${link.data.token}`);
  assert.equal(bill.status, 200);
  assert.equal(bill.data.order.orderNo, 'B7001');
  assert.equal(bill.data.customer.mobile.slice(-4), '6655');
  assert.ok(!bill.data.customer.mobile.includes('99887'));
  const body = JSON.stringify(bill.data);
  assert.ok(!/admins|password|share_token|"pin"/.test(body));
  assert.equal((await api.get(`/api/public-bill/B7001?token=${'f'.repeat(32)}`)).status, 403);
});

test('customers with history cannot be deleted, and only admins can delete', async () => {
  const { api } = await freshApi();
  const adminToken = await setupStore(api);
  await addStaff(api, adminToken, [{ id: 'a', name: 'A', role: 'cashier', pin: '5555' }]);
  const cashier = await pinLogin(api, '5555');
  const customerId = await createCustomer(api, cashier);
  assert.equal((await api.del(`/api/customers/${customerId}`, { token: cashier })).status, 403);
  const ord = await api.post('/api/orders', { customerId, type: 'weight', service: 'Drying', weightKg: 1 }, { token: cashier });
  assert.equal((await api.del(`/api/customers/${customerId}`, { token: adminToken })).status, 409);
  // Delete order directly via DELETE /api/orders/:id
  assert.equal((await api.del(`/api/orders/${ord.data.id}`, { token: cashier })).status, 200);
  // Re-create order, then test cascade customer delete
  await api.post('/api/orders', { customerId, type: 'weight', service: 'Drying', weightKg: 1 }, { token: cashier });
  assert.equal((await api.del(`/api/customers/${customerId}?cascade=true`, { token: adminToken })).status, 200);
  const other = await createCustomer(api, cashier, { mobile: '9000011111' });
  assert.equal((await api.del(`/api/customers/${other}`, { token: adminToken })).status, 200);
});

test('customer profile fields round-trip and duplicate mobiles are rejected', async () => {
  const { api } = await freshApi();
  const token = await setupStore(api);
  const id = await createCustomer(api, token, { rateList: 'Corporate / B2B', gstin: '06AAACH1234F1Z9', discountPercent: 500 });
  const dup = await api.post('/api/customers', { name: 'Someone', mobile: '9988776655' }, { token });
  assert.equal(dup.status, 409);
  await api.patch(`/api/customers/${id}`, { preference: 'Hanger' }, { token });
  const customer = (await api.get('/api/bootstrap', { token })).data.customers.find((c) => c.id === id);
  assert.equal(customer.rateList, 'Corporate / B2B');
  assert.equal(customer.gstin, '06AAACH1234F1Z9');
  assert.equal(customer.preference, 'Hanger');
  assert.equal(customer.discountPercent, 100, 'discount is clamped');
});

test('admin management: last admin is protected and passwords are re-hashed', async () => {
  const { api } = await freshApi();
  const token = await setupStore(api);
  const boot = await api.get('/api/bootstrap', { token });
  const ownerId = boot.data.admins[0].id;
  assert.equal((await api.del(`/api/admins/${ownerId}`, { token })).status, 400);

  const created = await api.post('/api/admins', { name: 'Second', email: 'second@example.com', password: 'second-pass', securityAnswer: 'x' }, { token });
  assert.equal(created.status, 201);
  assert.equal(created.data.admin.password, undefined);
  const dupEmail = await api.post('/api/admins', { name: 'Again', email: 'SECOND@example.com', password: 'second-pass', securityAnswer: 'x' }, { token });
  assert.equal(dupEmail.status, 409);

  const patched = await api.patch(`/api/admins/${created.data.id}`, { password: 'changed-pass' }, { token });
  assert.equal(patched.status, 200);
  assert.equal((await api.post('/api/auth/admin', { email: 'second@example.com', password: 'changed-pass' })).status, 200);
  assert.equal((await api.del(`/api/admins/${created.data.id}`, { token })).status, 200);
});

test('POST /api/maintenance/clear-data wipes customer, order, staff and admin records and enables first-run setup', async () => {
  const { api } = await freshApi();
  const token = await setupStore(api);

  // Create a customer
  await createCustomer(api, token, { name: 'Customer To Clear', mobile: '9123456780' });
  const beforeBootstrap = await api.get('/api/bootstrap', { token });
  assert.equal(beforeBootstrap.status, 200);
  assert.equal(beforeBootstrap.data.customers.length, 1);

  // Non-admins cannot invoke maintenance clear
  await addStaff(api, token, [{ id: 'staff-cleaner', name: 'Cleaner Staff', pin: '8899', role: 'cashier' }]);
  const cashierToken = await pinLogin(api, '8899');
  const forbiddenRes = await api.post('/api/maintenance/clear-data', {}, { token: cashierToken });
  assert.equal(forbiddenRes.status, 403);

  // Admin executes clear
  const clearRes = await api.post('/api/maintenance/clear-data', {}, { token });
  assert.equal(clearRes.status, 200);
  assert.equal(clearRes.data.cleared, true);
  assert.equal(clearRes.data.setupRequired, true);

  // Health endpoint indicates setupRequired: true
  const healthRes = await api.get('/api/health');
  assert.equal(healthRes.data.setupRequired, true);

  // First-run setup can now be completed by the store owner
  const newSetupRes = await api.post('/api/auth/setup', {
    name: 'Real Store Owner',
    email: 'realowner@example.com',
    password: 'RealOwnerPassword123!',
    securityQuestion: 'What city is this store in?',
    securityAnswer: 'Bengaluru',
    storeName: 'Clean Clear Flagship',
  });
  assert.equal(newSetupRes.status, 201);
  const newAdminToken = newSetupRes.data.token;

  // Check state after setup
  const afterBootstrap = await api.get('/api/bootstrap', { token: newAdminToken });
  assert.equal(afterBootstrap.status, 200);
  assert.equal(afterBootstrap.data.customers.length, 0);
  assert.equal(afterBootstrap.data.orders.length, 0);
  assert.equal(afterBootstrap.data.payments.length, 0);
  assert.equal(afterBootstrap.data.customerPackages.length, 0);
  assert.equal(afterBootstrap.data.staff.length, 0);
  assert.equal(afterBootstrap.data.admins.length, 1);
  assert.equal(afterBootstrap.data.admins[0].email, 'realowner@example.com');
  assert.equal(afterBootstrap.data.settings.nextOrderNo, 'B0001');
});

test('rejects non-JSON bodies and unknown routes cleanly', async () => {
  const { sql } = await createTestDatabase();
  const { handleApi } = await import('../src/server/api.js');
  const res = await handleApi(new Request('http://localhost/api/auth/pin', { method: 'POST', body: 'pin=1234', headers: { 'content-type': 'text/plain' } }), {}, { sql });
  assert.equal(res.status, 415);
  const missing = await handleApi(new Request('http://localhost/api/nope'), {}, { sql });
  assert.equal(missing.status, 404);
  const wrongMethod = await handleApi(new Request('http://localhost/api/bootstrap', { method: 'DELETE' }), {}, { sql });
  assert.equal(wrongMethod.status, 405);
});

test('upgrades a database created by the previous version and hashes plaintext credentials', async () => {
  const { sql, raw, db } = await createTestDatabase();
  const legacySchema = readFileSync(new URL('./fixtures/legacy-schema-v1.sql', import.meta.url), 'utf8');
  await db.exec(legacySchema);
  await db.exec(`INSERT INTO admin_users (id, name, email, password, security_answer) VALUES ('admin-9', 'Old Owner', 'old@example.com', 'plain-pass-1', 'delhi')`);
  await db.exec(`INSERT INTO store_settings (id, config) VALUES ('current', '{"storeName":"Legacy","admins":[{"password":"plain-pass-1"}]}')`);

  const api = createApiClient(sql);
  const login = await api.post('/api/auth/admin', { email: 'old@example.com', password: 'plain-pass-1' });
  assert.equal(login.status, 200, JSON.stringify(login.data));

  const [admin] = await raw("SELECT password, security_answer FROM admin_users WHERE id = 'admin-9'");
  assert.match(admin.password, /^\$2[aby]\$/);
  assert.match(admin.security_answer, /^\$2[aby]\$/);
  const [settings] = await raw("SELECT config FROM store_settings WHERE id = 'current'");
  assert.equal(settings.config.admins, undefined);
  assert.equal(settings.config.storeName, 'Legacy');
  const staff = await raw('SELECT pin FROM staff_members');
  for (const row of staff) assert.match(row.pin, /^\$2[aby]\$/);
  const reset = await api.post('/api/auth/reset', { email: 'old@example.com', securityAnswer: 'Delhi', newPassword: 'new-pass-22' });
  assert.equal(reset.status, 200);
});

test('schema.sql is up to date with src/server/schema.js and runs as plain SQL', async () => {
  const file = readFileSync(new URL('../schema.sql', import.meta.url), 'utf8');
  assert.equal(file, renderSchemaSql(), 'run `npm run db:schema` after editing src/server/schema.js');
  const { db, raw } = await createTestDatabase();
  await db.exec(file);
  await db.exec(file); // idempotent
  const tables = await raw("SELECT count(*)::int AS n FROM information_schema.tables WHERE table_schema = 'public'");
  assert.ok(tables[0].n >= 12);
});
