import test from 'node:test';
import assert from 'node:assert/strict';

import { computeTotals, priceOrder } from '../src/lib/orderPricing.js';
import {
  createOrder,
  updateOrder,
  updateOrderStatus,
  deleteOrder,
  assignPackage,
  loadLocal,
  restoreWalletToPackages,
  deductWalletFromPackages,
} from '../src/lib/persistence.js';
import { createApiClient, createTestDatabase } from './helpers/testDatabase.js';

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

async function createCustomer(api, token, fields = {}) {
  const res = await api.post('/api/customers', { name: 'Kavita Krishnan', mobile: '9988776655', ...fields }, { token });
  assert.equal(res.status, 201, JSON.stringify(res.data));
  return res.data.id;
}

test('1. Roundup logic: Math.ceil rounds up total amount to nearest whole rupee', () => {
  // Test case 1: ₹21.25 -> ₹22 (user explicit example)
  const totals21 = computeTotals({
    grossAmount: 21.25,
    taxEnabled: false,
  });
  assert.equal(totals21.totalAmount, 22, '21.25 must count as 22');

  // Test case 2: ₹30.01 -> ₹31 (user explicit example)
  const totals30 = computeTotals({
    grossAmount: 30.01,
    taxEnabled: false,
  });
  assert.equal(totals30.totalAmount, 31, '30.01 must count as 31');

  // Test case 3: ₹30.00 -> ₹30 (exact whole rupee stays unchanged)
  const totalsExact = computeTotals({
    grossAmount: 30.00,
    taxEnabled: false,
  });
  assert.equal(totalsExact.totalAmount, 30, '30.00 must remain 30');

  // Test case 4: With GST (e.g. 100 + 18% = 118, or 105 + 18% = 123.9 -> 124)
  const totalsGst = computeTotals({
    grossAmount: 105,
    taxEnabled: true,
    taxPercent: 18,
  });
  // 105 + 18% tax (18.9) = 123.9 -> rounds up to 124
  assert.equal(totalsGst.totalAmount, 124, '123.9 must round up to 124');

  // Test case 5: priceOrder with carpet sq.ft dimensions
  // Carpet: 4.5 ft x 3.5 ft = 15.75 sq.ft @ ₹25/sq.ft = ₹393.75, +18% GST (70.88) = ₹464.63 -> rounds up to ₹465
  const carpetPriced = priceOrder({
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [{
      id: 'h-carpet-sqft',
      name: 'Carpet (sq.ft)',
      length: 4.5,
      width: 3.5,
      quantity: 1,
    }],
  }, {
    settings: { taxEnabled: true, taxPercent: 18 },
  });
  assert.equal(carpetPriced.totalAmount, 465, 'Carpet total must round up to whole rupee');
});

test('2. Order cancellation reverts deducted wallet credit back to customer & package', async () => {
  const store = loadLocal();
  const customer = store.customers[0];

  // 1. Assign a wallet package with 500 credit
  const customPkgTemplate = {
    id: 'test-wallet-500',
    name: 'Starter Wallet 500',
    kind: 'wallet',
    walletCredit: 500,
    price: 500,
  };
  const storeWithPkg = await assignPackage(customer.id, 'gold-pkg', 'cash', {
    ...store,
    packages: [customPkgTemplate, ...store.packages],
  });

  const updatedCust = storeWithPkg.customers.find((c) => c.id === customer.id);
  const initialWallet = updatedCust.walletBalance;
  assert.ok(initialWallet >= 500, 'Customer must have at least 500 in wallet');

  // 2. Place an order for 2 shirts @ 125 = 250 (no tax)
  const storeWithOrder = await createOrder({
    customerId: customer.id,
    type: 'pieces',
    service: 'Dry cleaning',
    taxEnabled: false,
    items: [{ id: 'm-shirt', name: 'Shirt', service: 'Dry cleaning', unitPrice: 125, quantity: 2 }],
  }, storeWithPkg);

  const placedOrder = storeWithOrder.orders[0];
  assert.equal(placedOrder.totalAmount, 250);
  assert.equal(placedOrder.paidAmount, 250, 'Auto-deducted from wallet');

  const afterOrderCust = storeWithOrder.customers.find((c) => c.id === customer.id);
  assert.equal(afterOrderCust.walletBalance, initialWallet - 250, 'Wallet deducted by 250');

  // Check package remaining credit
  const pkgAfterOrder = storeWithOrder.customerPackages.find((cp) => cp.customerId === customer.id && cp.kind === 'wallet');
  assert.ok(pkgAfterOrder.remainingCredit < pkgAfterOrder.walletCredit);

  // 3. Cancel the order
  const storeAfterCancel = await updateOrderStatus(placedOrder.id, 'Cancelled', storeWithOrder);
  const cancelledOrder = storeAfterCancel.orders.find((o) => o.id === placedOrder.id);
  assert.equal(cancelledOrder.status, 'Cancelled');
  assert.equal(cancelledOrder.balanceAmount, 0);

  // Customer wallet balance must be fully refunded!
  const finalCust = storeAfterCancel.customers.find((c) => c.id === customer.id);
  assert.equal(finalCust.walletBalance, initialWallet, 'Customer wallet must be fully restored upon cancellation');

  // Package remaining credit must be restored and status active!
  const finalPkg = storeAfterCancel.customerPackages.find((cp) => cp.id === pkgAfterOrder.id);
  assert.equal(finalPkg.status, 'active');

  // Wallet refund transaction must be recorded
  const refundTx = storeAfterCancel.walletTransactions.find((wt) => wt.orderId === placedOrder.id && wt.kind === 'credit');
  assert.ok(refundTx, 'Credit refund transaction must exist in walletTransactions');
  assert.equal(refundTx.amount, 250);
});

test('3. Delivered orders cannot be cancelled or edited', async () => {
  const store = loadLocal();
  const customer = store.customers[0];

  const storeWithOrder = await createOrder({
    customerId: customer.id,
    type: 'pieces',
    service: 'Dry cleaning',
    taxEnabled: false,
    items: [{ id: 'm-shirt', name: 'Shirt', service: 'Dry cleaning', unitPrice: 125, quantity: 1 }],
  }, store);

  const order = storeWithOrder.orders[0];
  const deliveredStore = await updateOrderStatus(order.id, 'Delivered', storeWithOrder);

  // Attempting to cancel delivered order must throw
  await assert.rejects(
    async () => updateOrderStatus(order.id, 'Cancelled', deliveredStore),
    /Delivered orders cannot be cancelled/
  );

  // Attempting to edit delivered order must throw
  await assert.rejects(
    async () => updateOrder(order.id, { ...order, service: 'Steam press' }, deliveredStore),
    /Delivered orders cannot be edited/
  );
});

test('4. Order edit adjusts wallet deduction: refunds difference if total decreased, deducts more if increased', async () => {
  const store = loadLocal();
  const customer = store.customers[0];

  // Assign wallet package
  const storeWithPkg = await assignPackage(customer.id, 'platinum-pkg', 'cash', store);
  const custAfterPkg = storeWithPkg.customers.find((c) => c.id === customer.id);
  const startWallet = custAfterPkg.walletBalance;

  // Place initial order for 3 shirts @ 125 = 375 (no tax)
  const storeWithOrder = await createOrder({
    customerId: customer.id,
    type: 'pieces',
    service: 'Dry cleaning',
    taxEnabled: false,
    items: [{ id: 'm-shirt', name: 'Shirt', service: 'Dry cleaning', unitPrice: 125, quantity: 3 }],
  }, storeWithPkg);

  const initialOrder = storeWithOrder.orders[0];
  assert.equal(initialOrder.totalAmount, 375);
  assert.equal(initialOrder.paidAmount, 375);

  const custAfterOrder = storeWithOrder.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterOrder.walletBalance, startWallet - 375);

  // Case A: Edit order to decrease quantity from 3 to 1 (new total: 125, decrease of 250)
  const storeAfterDecrease = await updateOrder(initialOrder.id, {
    ...initialOrder,
    items: [{ id: 'm-shirt', name: 'Shirt', service: 'Dry cleaning', unitPrice: 125, quantity: 1 }],
    grossAmount: 125,
    taxEnabled: false,
  }, storeWithOrder);

  const decreasedOrder = storeAfterDecrease.orders.find((o) => o.id === initialOrder.id);
  assert.equal(decreasedOrder.totalAmount, 125);
  assert.equal(decreasedOrder.paidAmount, 125);
  assert.equal(decreasedOrder.balanceAmount, 0);

  // Wallet balance must have received the 250 refund!
  const custAfterDecrease = storeAfterDecrease.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterDecrease.walletBalance, startWallet - 125, 'Wallet must increase by 250');

  // Case B: Edit order to increase quantity from 1 to 4 (new total: 500, increase of 375)
  const storeAfterIncrease = await updateOrder(initialOrder.id, {
    ...decreasedOrder,
    items: [{ id: 'm-shirt', name: 'Shirt', service: 'Dry cleaning', unitPrice: 125, quantity: 4 }],
    grossAmount: 500,
    taxEnabled: false,
  }, storeAfterDecrease);

  const increasedOrder = storeAfterIncrease.orders.find((o) => o.id === initialOrder.id);
  assert.equal(increasedOrder.totalAmount, 500);
  assert.equal(increasedOrder.paidAmount, 500);
  assert.equal(increasedOrder.balanceAmount, 0);

  const custAfterIncrease = storeAfterIncrease.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterIncrease.walletBalance, startWallet - 500, 'Wallet must deduct additional 375');
});

test('5. Server API: PUT /api/orders/:id updates order and cancels with wallet refund', async () => {
  const { api, raw } = await freshApi();
  const token = await setupStore(api);
  const customerId = await createCustomer(api, token);

  // 1. Sell Gold Package (4000 wallet credit)
  assert.equal((await api.post('/api/packages', { customerId, templateId: 'gold-pkg', paymentMethod: 'cash' }, { token })).status, 201);
  const [custInitial] = await raw('SELECT wallet_balance FROM customers WHERE id = $1', [customerId]);
  assert.equal(Number(custInitial.wallet_balance), 4000);

  // 2. Create order: 2 suits @ 400 = 800 + 18% GST (144) = 944
  const createRes = await api.post('/api/orders', {
    customerId,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-suit-2pc', quantity: 2 }],
  }, { token });
  assert.equal(createRes.status, 201);
  assert.equal(createRes.data.totalAmount, 944);
  assert.equal(createRes.data.paidAmount, 944);

  const [custAfterOrder] = await raw('SELECT wallet_balance FROM customers WHERE id = $1', [customerId]);
  assert.equal(Number(custAfterOrder.wallet_balance), 4000 - 944);

  // 3. Edit order via PUT /api/orders/:id to reduce quantity to 1 suit (400 + 18% = 472)
  const orderId = createRes.data.id;
  const updateRes = await api.put(`/api/orders/${orderId}`, {
    customerId,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-suit-2pc', quantity: 1 }],
  }, { token });
  assert.equal(updateRes.status, 200);
  assert.equal(updateRes.data.totalAmount, 472);
  assert.equal(updateRes.data.paidAmount, 472);

  // Difference (944 - 472 = 472) should be refunded back to customer wallet!
  const [custAfterEdit] = await raw('SELECT wallet_balance FROM customers WHERE id = $1', [customerId]);
  assert.equal(Number(custAfterEdit.wallet_balance), 4000 - 472);

  // 4. Cancel order via PATCH /api/orders/:id with { status: 'Cancelled' }
  const cancelRes = await api.patch(`/api/orders/${orderId}`, { status: 'Cancelled' }, { token });
  assert.equal(cancelRes.status, 200);

  // Customer wallet should be completely restored to 4000!
  const [custAfterCancel] = await raw('SELECT wallet_balance FROM customers WHERE id = $1', [customerId]);
  assert.equal(Number(custAfterCancel.wallet_balance), 4000, 'Customer wallet must be completely restored');

  // Verify cancelled order status and balance in DB
  const [orderInDb] = await raw('SELECT status, balance_amount FROM orders WHERE id = $1', [orderId]);
  assert.equal(orderInDb.status, 'Cancelled');
  assert.equal(Number(orderInDb.balance_amount), 0);
});
