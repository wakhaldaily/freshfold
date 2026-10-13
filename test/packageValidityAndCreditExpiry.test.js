import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCustomer,
  createPackage,
  updatePackage,
  assignPackage,
  createOrder,
  recordPayment,
  isPackageExpired,
  deductWalletFromPackages,
} from '../src/lib/persistence.js';

import { createInitialData } from '../src/data.js';
import { createApiClient, createTestDatabase } from './helpers/testDatabase.js';

const ADMIN = {
  name: 'Store Admin',
  email: 'admin@cleanclear.example',
  password: 'Password123!',
  securityQuestion: 'What city?',
  securityAnswer: 'Gurugram',
  storeName: 'Clean Clear Dry Cleaning',
};

test('1. Optional validity on packages: durationDays sets expiresAt, lifetime has null expiresAt', async () => {
  let store = createInitialData();

  // Create a 30-day validity discount package
  store = await createPackage({
    name: '30-Day Monsoon Promo',
    kind: 'discount',
    price: 500,
    discountPercent: 30,
    durationDays: 30,
    validity: '30 Days Validity',
  }, store);

  const promoPkg = store.packages.find((p) => p.name === '30-Day Monsoon Promo');
  assert.ok(promoPkg);
  assert.equal(promoPkg.durationDays, 30);

  // Create customer and assign package
  store = await createCustomer({ name: 'Rahul Roy', mobile: '9811002233' }, store);
  const cust = store.customers.find((c) => c.mobile === '9811002233');

  store = await assignPackage(cust.id, promoPkg.id, 'cash', store);
  const assigned = store.customerPackages.find((cp) => cp.customerId === cust.id && cp.templateId === promoPkg.id);
  assert.ok(assigned);
  assert.equal(assigned.status, 'active');
  assert.ok(assigned.expiresAt, 'Should have an expiration date');

  // Verify expiry is approximately 30 days ahead
  const startsAt = new Date(assigned.startsAt);
  const expiresAt = new Date(assigned.expiresAt);
  const diffDays = Math.round((expiresAt - startsAt) / (1000 * 60 * 60 * 24));
  assert.equal(diffDays, 30, 'Expiry date should be exactly 30 days after startsAt');

  // Create a Lifetime package (durationDays = null or 0)
  store = await createPackage({
    name: 'Lifetime Privilege Plan',
    kind: 'discount',
    price: 2500,
    discountPercent: 20,
    durationDays: null,
    validity: 'Lifetime Privilege',
  }, store);

  const lifetimePkg = store.packages.find((p) => p.name === 'Lifetime Privilege Plan');
  assert.equal(lifetimePkg.durationDays, null);

  store = await assignPackage(cust.id, lifetimePkg.id, 'upi', store);
  const assignedLifetime = store.customerPackages.find((cp) => cp.customerId === cust.id && cp.templateId === lifetimePkg.id);
  assert.equal(assignedLifetime.expiresAt, null, 'Lifetime package must have null expiresAt');
  assert.equal(assignedLifetime.status, 'active');
});

test('2. Validity expiration: expired package gets disabled automatically and is ignored by POS pricing', async () => {
  let store = createInitialData();
  store = await createCustomer({ name: 'Meera Sen', mobile: '9822334455' }, store);
  const cust = store.customers.find((c) => c.mobile === '9822334455');

  // Assign an active package
  store = await assignPackage(cust.id, 'half-price-pkg', 'cash', store);
  const activePkg = store.customerPackages.find((cp) => cp.customerId === cust.id);

  // Simulate expiry by setting expiresAt to yesterday
  const yesterday = new Date(Date.now() - 86400000).toISOString().slice(0, 10);
  activePkg.expiresAt = yesterday;

  assert.equal(isPackageExpired(yesterday), true, 'isPackageExpired helper must identify past date as expired');
  assert.equal(isPackageExpired(null), false, 'isPackageExpired helper returns false for lifetime (null)');

  // When order is placed, expired package is disabled automatically
  store = await createOrder({
    customerId: cust.id,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 100, quantity: 2 }],
    grossAmount: 200,
    discountAmount: 0,
    discountPercent: 0,
  }, store);

  const custPkgAfterOrder = store.customerPackages.find((cp) => cp.id === activePkg.id);
  assert.equal(custPkgAfterOrder.status, 'disabled', 'Expired package must automatically become disabled');
});

test('3. Credit depletion: wallet package disables when credit reaches 0', async () => {
  let store = createInitialData();
  store.settings.taxEnabled = false;

  store = await createCustomer({ name: 'Amitabh Joshi', mobile: '9833445566' }, store);
  const cust = store.customers.find((c) => c.mobile === '9833445566');

  // Assign Gold Package: ₹4,000 credit
  store = await assignPackage(cust.id, 'gold-pkg', 'cash', store);
  let goldPkg = store.customerPackages.find((cp) => cp.customerId === cust.id && cp.templateId === 'gold-pkg');
  assert.equal(goldPkg.walletCredit, 4000);
  assert.equal(goldPkg.remainingCredit, 4000);
  assert.equal(goldPkg.status, 'active');

  // Order 1: ₹1,500 order -> auto-deducts ₹1,500, remaining ₹2,500
  store = await createOrder({
    customerId: cust.id,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-suit', name: 'Suit 2 Pcs', category: 'Men', unitPrice: 500, quantity: 3 }],
    grossAmount: 1500,
    discountAmount: 0,
    discountPercent: 0,
  }, store);

  goldPkg = store.customerPackages.find((cp) => cp.id === goldPkg.id);
  assert.equal(goldPkg.remainingCredit, 2500, 'Remaining credit should be 2500');
  assert.equal(goldPkg.status, 'active', 'Package should remain active while credit remains');

  // Order 2: ₹2,500 order -> auto-deducts remaining ₹2,500, remaining 0
  store = await createOrder({
    customerId: cust.id,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-suit', name: 'Suit 2 Pcs', category: 'Men', unitPrice: 500, quantity: 5 }],
    grossAmount: 2500,
    discountAmount: 0,
    discountPercent: 0,
  }, store);

  goldPkg = store.customerPackages.find((cp) => cp.id === goldPkg.id);
  assert.equal(goldPkg.remainingCredit, 0, 'Remaining credit should be 0');
  assert.equal(goldPkg.status, 'disabled', 'Package must automatically become disabled when credit is finished');

  const customerAfterOrders = store.customers.find((c) => c.id === cust.id);
  assert.equal(customerAfterOrders.walletBalance, 0);
});

test('4. RecordPayment via wallet credit deducts remaining credit and disables package upon depletion', async () => {
  let store = createInitialData();
  store.settings.taxEnabled = false;

  store = await createCustomer({ name: 'Deepa Roy', mobile: '9844556677' }, store);
  const cust = store.customers.find((c) => c.mobile === '9844556677');

  // Customer places order first (no wallet yet, so unpaid)
  store = await createOrder({
    customerId: cust.id,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'w-saree', name: 'Silk Saree', category: 'Women', unitPrice: 1000, quantity: 4 }],
    grossAmount: 4000,
    discountAmount: 0,
    discountPercent: 0,
  }, store);

  const order = store.orders[0];
  assert.equal(order.balanceAmount, 4000);

  // Now customer buys Gold Package (₹4,000 credit)
  store = await assignPackage(cust.id, 'gold-pkg', 'upi', store);
  let goldPkg = store.customerPackages.find((cp) => cp.customerId === cust.id && cp.templateId === 'gold-pkg');
  assert.equal(goldPkg.status, 'active');
  assert.equal(goldPkg.remainingCredit, 4000);

  // Pay order using wallet credit
  store = await recordPayment(order.id, 4000, 'wallet', store);

  goldPkg = store.customerPackages.find((cp) => cp.id === goldPkg.id);
  assert.equal(goldPkg.remainingCredit, 0, 'Remaining credit depleted to 0');
  assert.equal(goldPkg.status, 'disabled', 'Package status becomes disabled upon full payment deduction');
});

test('5. Server API: duration_days, expiry disabling, and wallet credit depletion in database', async () => {
  const { sql } = await createTestDatabase();
  const api = createApiClient(sql);

  // 1. Setup store
  const setupRes = await api.post('/api/auth/setup', ADMIN);
  assert.equal(setupRes.status, 201);
  const token = setupRes.data.token;

  // 2. Create a template with 15 days validity
  const templateRes = await api.post('/api/package-templates', {
    name: '15-Day Express Club',
    description: '15 days validity dry clean pass',
    kind: 'discount',
    price: 999,
    discountPercent: 20,
    durationDays: 15,
    accent: 'blue',
  }, { token });
  assert.equal(templateRes.status, 201);
  const templateId = templateRes.data.id;

  // 3. Create customer
  const custRes = await api.post('/api/customers', {
    name: 'Vikram Malhotra',
    mobile: '9855667788',
  }, { token });
  assert.equal(custRes.status, 201);
  const customerId = custRes.data.id;

  // 4. Sell the package
  const sellRes = await api.post('/api/packages', {
    customerId,
    templateId,
    paymentMethod: 'upi',
  }, { token });
  assert.equal(sellRes.status, 201);
  const pkgId = sellRes.data.id;

  // Check bootstrap
  let boot = await api.get('/api/bootstrap', { token });
  let assignedPkg = boot.data.customerPackages.find((p) => p.id === pkgId);
  assert.ok(assignedPkg);
  assert.equal(assignedPkg.status, 'active');
  assert.ok(assignedPkg.expiresAt);

  // Verify expiry is in the future
  const todayStr = new Date().toISOString().slice(0, 10);
  assert.ok(assignedPkg.expiresAt > todayStr);

  // 5. Sell a wallet package (e.g. Gold Wallet: ₹4,000 credit)
  const sellWalletRes = await api.post('/api/packages', {
    customerId,
    templateId: 'gold-pkg',
    paymentMethod: 'cash',
  }, { token });
  assert.equal(sellWalletRes.status, 201);
  const walletPkgId = sellWalletRes.data.id;

  boot = await api.get('/api/bootstrap', { token });
  let walletPkg = boot.data.customerPackages.find((p) => p.id === walletPkgId);
  assert.equal(walletPkg.walletCredit, 4000);
  assert.equal(walletPkg.remainingCredit, 4000);
  assert.equal(walletPkg.status, 'active');

  // 6. Create order with auto-deduction of 4000
  const orderRes = await api.post('/api/orders', {
    customerId,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-shirt', quantity: 40 }],
  }, { token });
  assert.equal(orderRes.status, 201);
  assert.equal(orderRes.data.autoDeduct, 4000);

  // Check bootstrap after order
  boot = await api.get('/api/bootstrap', { token });
  walletPkg = boot.data.customerPackages.find((p) => p.id === walletPkgId);
  assert.equal(walletPkg.remainingCredit, 0);
  assert.equal(walletPkg.status, 'disabled', 'Wallet package must be disabled when credit finishes');

  // 7. Manually age the 15-day package in database to yesterday and verify it disables
  await sql`UPDATE customer_packages SET expires_at = CURRENT_DATE - 1 WHERE id = ${pkgId}`;

  boot = await api.get('/api/bootstrap', { token });
  assignedPkg = boot.data.customerPackages.find((p) => p.id === pkgId);
  assert.equal(assignedPkg.status, 'disabled', 'Expired package in DB must report status disabled');
});
