import test from 'node:test';
import assert from 'node:assert/strict';

import { computeTotals, priceOrder } from '../src/lib/orderPricing.js';
import { createOrder } from '../src/lib/persistence.js';
import { getReceiptShareText } from '../src/lib/pdfGenerator.js';

test('1. computeTotals limits checkout discount up to 100% and clamps negative values', () => {
  // Base case: gross 1000, no tax
  const normal10 = computeTotals({
    grossAmount: 1000,
    taxEnabled: false,
    manualCheckoutDiscountPercent: 10,
  });
  assert.equal(normal10.grossAmount, 1000);
  assert.equal(normal10.manualCheckoutDiscountPercent, 10);
  assert.equal(normal10.manualCheckoutDiscountAmount, 100);
  assert.equal(normal10.totalAmount, 900);

  // 100% discount reduces bill to exactly 0
  const full100 = computeTotals({
    grossAmount: 1000,
    taxEnabled: false,
    manualCheckoutDiscountPercent: 100,
  });
  assert.equal(full100.manualCheckoutDiscountPercent, 100);
  assert.equal(full100.manualCheckoutDiscountAmount, 1000);
  assert.equal(full100.totalAmount, 0);

  // >100% (e.g. 150%) is strictly clamped to 100%
  const over100 = computeTotals({
    grossAmount: 1000,
    taxEnabled: false,
    manualCheckoutDiscountPercent: 150,
  });
  assert.equal(over100.manualCheckoutDiscountPercent, 100, 'Percent must clamp to 100');
  assert.equal(over100.manualCheckoutDiscountAmount, 1000);
  assert.equal(over100.totalAmount, 0);

  // Negative percent (e.g. -20%) is strictly clamped to 0%
  const negative = computeTotals({
    grossAmount: 1000,
    taxEnabled: false,
    manualCheckoutDiscountPercent: -20,
  });
  assert.equal(negative.manualCheckoutDiscountPercent, 0, 'Negative percent must clamp to 0');
  assert.equal(negative.manualCheckoutDiscountAmount, 0);
  assert.equal(negative.totalAmount, 1000);
});

test('2. priceOrder computes manual checkout discount from input correctly', () => {
  const result = priceOrder({
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-shirt', name: 'Shirt', service: 'Dry cleaning', unitPrice: 125, quantity: 4 }], // 500
    manualCheckoutDiscountPercent: 20,
  }, {
    settings: { taxEnabled: false },
  });

  assert.equal(result.grossAmount, 500);
  assert.equal(result.manualCheckoutDiscountPercent, 20);
  assert.equal(result.manualCheckoutDiscountAmount, 100);
  assert.equal(result.totalAmount, 400);
});

test('3. createOrder in local mode preserves checkout discount and calculates correct balance', async () => {
  const storeState = {
    settings: { taxEnabled: false, nextOrderNo: 'B7001' },
    customers: [{ id: 'cus-1', name: 'Ravi Kumar', mobile: '9876543210', walletBalance: 0 }],
    orders: [],
  };

  const saved = await createOrder({
    orderNo: 'B7001',
    customerId: 'cus-1',
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-pant', name: 'Pant', unitPrice: 170, quantity: 2 }],
    grossAmount: 340,
    taxEnabled: false,
    manualCheckoutDiscountPercent: 50,
    manualCheckoutDiscountAmount: 170,
  }, storeState);

  const newOrder = saved.orders[0];
  assert.equal(newOrder.orderNo, 'B7001');
  assert.equal(newOrder.grossAmount, 340);
  assert.equal(newOrder.manualCheckoutDiscountPercent, 50);
  assert.equal(newOrder.manualCheckoutDiscountAmount, 170);
  assert.equal(newOrder.totalAmount, 170);
  assert.equal(newOrder.balanceAmount, 170);
});

test('4. Receipt and WhatsApp text do not contain checkout discount label', () => {
  const order = {
    id: 'ord-disc',
    orderNo: 'B7002',
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ name: 'Suit 2 Pcs', quantity: 1, unitPrice: 400 }],
    grossAmount: 400,
    discountAmount: 0,
    discountPercent: 0,
    manualCheckoutDiscountPercent: 25,
    manualCheckoutDiscountAmount: 100,
    totalAmount: 300,
    paidAmount: 300,
    balanceAmount: 0,
    status: 'Ready',
    createdAt: '2026-10-14T01:00:00Z',
  };

  const customer = { name: 'Pooja Singh', mobile: '9876543210' };
  const settings = { storeName: 'Clean Clear Dry Cleaning', taxEnabled: false };
  const billUrl = 'https://freshfold.app/?bill=B7002&token=abcdef1234567890';

  const shareText = getReceiptShareText({ order, customer, settings, billUrl });

  // Net total reflects discounted price (300)
  assert.match(shareText, /NET TOTAL: ₹300\.00/);
  // Checkout discount label is completely hidden from customer receipt text
  assert.doesNotMatch(shareText, /Checkout Discount/i);
  assert.doesNotMatch(shareText, /Discount \(25%\)/i);
});

test('5. Fractions are rounded to whole numbers: no fraction numbers in discount', () => {
  const result = computeTotals({
    grossAmount: 1000,
    taxEnabled: false,
    manualCheckoutDiscountPercent: 12.7,
  });

  assert.equal(result.manualCheckoutDiscountPercent, 13, '12.7 rounds to integer 13');
  assert.equal(result.manualCheckoutDiscountAmount, 130);
  assert.equal(result.totalAmount, 870);

  const resultHalf = computeTotals({
    grossAmount: 1000,
    taxEnabled: false,
    manualCheckoutDiscountPercent: 20.2,
  });

  assert.equal(resultHalf.manualCheckoutDiscountPercent, 20, '20.2 rounds to integer 20');
  assert.equal(resultHalf.manualCheckoutDiscountAmount, 200);
  assert.equal(resultHalf.totalAmount, 800);
});

test('6. Leading 0 is ignored and replaced when another number is entered', () => {
  // Simulating string "05" entering computeTotals as "05" or 5
  const result = computeTotals({
    grossAmount: 1000,
    taxEnabled: false,
    manualCheckoutDiscountPercent: '05',
  });

  assert.equal(result.manualCheckoutDiscountPercent, 5, '"05" becomes 5%');
  assert.equal(result.manualCheckoutDiscountAmount, 50);
  assert.equal(result.totalAmount, 950);
});
