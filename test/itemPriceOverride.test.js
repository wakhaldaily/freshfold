import test from 'node:test';
import assert from 'node:assert/strict';

import { formatIndianCurrencyString, priceOrder } from '../src/lib/orderPricing.js';

test('1. formatIndianCurrencyString formats numbers with Indian rupee thousand and lakh grouping', () => {
  // Small numbers
  assert.equal(formatIndianCurrencyString(0), '0');
  assert.equal(formatIndianCurrencyString(5), '5');
  assert.equal(formatIndianCurrencyString(50), '50');
  assert.equal(formatIndianCurrencyString(500), '500');

  // Thousand (first 3 digits grouped)
  assert.equal(formatIndianCurrencyString(1000), '1,000');
  assert.equal(formatIndianCurrencyString('1000'), '1,000');
  assert.equal(formatIndianCurrencyString(9999), '9,999');

  // Ten thousand
  assert.equal(formatIndianCurrencyString(10000), '10,000');
  assert.equal(formatIndianCurrencyString(54321), '54,321');

  // One Lakh (grouping of 2 digits after last 3)
  assert.equal(formatIndianCurrencyString(100000), '1,00,000');
  assert.equal(formatIndianCurrencyString('125000'), '1,25,000');

  // Ten Lakh
  assert.equal(formatIndianCurrencyString(1000000), '10,00,000');

  // One Crore
  assert.equal(formatIndianCurrencyString(10000000), '1,00,00,000');

  // Decimal numbers with up to 2 decimal places
  assert.equal(formatIndianCurrencyString(250.75), '250.75');
  assert.equal(formatIndianCurrencyString('1000.5'), '1,000.5');
  assert.equal(formatIndianCurrencyString('1000.50'), '1,000.50');
  assert.equal(formatIndianCurrencyString('1000.509'), '1,000.50'); // limits to 2 decimal places

  // Typing state: preserves trailing dot while user is typing
  assert.equal(formatIndianCurrencyString('1000.'), '1,000.');
  assert.equal(formatIndianCurrencyString('50.'), '50.');

  // Empty, null, undefined
  assert.equal(formatIndianCurrencyString(''), '');
  assert.equal(formatIndianCurrencyString(null), '');
  assert.equal(formatIndianCurrencyString(undefined), '');
});

test('2. priceOrder uses catalog price by default when no customUnitPrice is provided', () => {
  // Dry cleaning for Coat (catalog rate ₹300)
  const defaultPriced = priceOrder({
    type: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-coat', name: 'Coat', quantity: 1, service: 'Dry cleaning' },
    ],
  });

  assert.equal(defaultPriced.items[0].unitPrice, 300);
  assert.equal(defaultPriced.items[0].customUnitPrice, undefined);
  assert.equal(defaultPriced.grossAmount, 300);
});

test('3. priceOrder respects customUnitPrice override and updates checkout totals immediately', () => {
  // Cashier enters custom rate ₹350 for Coat (normally ₹300)
  const overridden = priceOrder({
    type: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-coat', name: 'Coat', quantity: 2, service: 'Dry cleaning', customUnitPrice: 350 },
    ],
  });

  // Unit price must be 350, and gross must be 2 * 350 = 700
  assert.equal(overridden.items[0].unitPrice, 350);
  assert.equal(overridden.items[0].customUnitPrice, 350);
  assert.equal(overridden.grossAmount, 700);
});

test('4. priceOrder supports decimal custom prices up to 2 decimal places', () => {
  const decimalPriced = priceOrder({
    type: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-coat', name: 'Coat', quantity: 1, service: 'Dry cleaning', customUnitPrice: 249.50 },
    ],
  });

  assert.equal(decimalPriced.items[0].unitPrice, 249.5);
  assert.equal(decimalPriced.grossAmount, 249.5);
});

test('5. priceOrder respects customWeightRate for weight laundry bundle', () => {
  // Default Wash and Fold rate is ₹90/kg, 5kg = ₹450
  const defaultWeight = priceOrder({
    type: 'weight',
    service: 'Wash and Fold',
    weightKg: 5,
  });
  assert.equal(defaultWeight.grossAmount, 450);

  // Overwritten to ₹110/kg, 5kg = ₹550
  const overriddenWeight = priceOrder({
    type: 'weight',
    service: 'Wash and Fold',
    weightKg: 5,
    customWeightRate: 110,
  });
  assert.equal(overriddenWeight.grossAmount, 550);
});
