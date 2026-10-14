import test from 'node:test';
import assert from 'node:assert/strict';

import { getOrderTotalDiscount, calculateLineDiscounts } from '../src/lib/orderPricing.js';
import {
  generateStandardInvoicePdf,
  generateThermalReceiptPdf,
  getReceiptShareText,
} from '../src/lib/pdfGenerator.js';

test('1. getOrderTotalDiscount sums package discount and checkout discount', () => {
  // Case A: Package discount only
  assert.equal(getOrderTotalDiscount({ discountAmount: 50 }), 50);

  // Case B: Checkout discount amount only
  assert.equal(getOrderTotalDiscount({ manualCheckoutDiscountAmount: 75 }), 75);

  // Case C: Checkout discount percent only
  assert.equal(getOrderTotalDiscount({ grossAmount: 500, manualCheckoutDiscountPercent: 20 }), 100);

  // Case D: Package discount AND checkout discount combined
  assert.equal(getOrderTotalDiscount({
    grossAmount: 1000,
    discountAmount: 150,
    manualCheckoutDiscountAmount: 100,
  }), 250);

  // Case E: Zero discount
  assert.equal(getOrderTotalDiscount({ grossAmount: 400 }), 0);
  assert.equal(getOrderTotalDiscount({}), 0);
});

test('2. calculateLineDiscounts allocates proportionally and gives 0 when no discount', () => {
  const items = [
    { name: 'Shirt', quantity: 2, unitPrice: 100 }, // 200
    { name: 'Suit', quantity: 1, unitPrice: 300 },  // 300
  ];

  // No discount -> both items get 0 (empty column space in UI)
  const noDiscounts = calculateLineDiscounts(items, 0);
  assert.deepEqual(noDiscounts, [0, 0]);

  // Total discount 100 on 500 gross (20%):
  // Item 1 (200/500 * 100) = 40
  // Item 2 (300/500 * 100) = 60
  const discounts = calculateLineDiscounts(items, 100);
  assert.equal(discounts[0], 40);
  assert.equal(discounts[1], 60);
  assert.equal(discounts[0] + discounts[1], 100);
});

test('3. generateStandardInvoicePdf includes Discount column and omits Booked By / cashier name', () => {
  const order = {
    id: 'ord-std-1',
    orderNo: 'A101',
    type: 'pieces',
    service: 'Dry cleaning',
    grossAmount: 500,
    discountAmount: 50,
    manualCheckoutDiscountAmount: 50,
    totalAmount: 400,
    paidAmount: 400,
    balanceAmount: 0,
    items: [
      { name: 'Shirt', quantity: 2, unitPrice: 100 },
      { name: 'Suit', quantity: 1, unitPrice: 300 },
    ],
    createdAt: '2026-10-14T10:00:00Z',
    dueDate: '2026-10-16T18:00:00Z',
  };

  const doc = generateStandardInvoicePdf({
    order,
    customer: { name: 'Amit Sharma', mobile: '9999988888' },
    settings: { storeName: 'Clean Clear', taxEnabled: false },
    cashierName: 'Admin Rajesh',
  });

  const pdfOutput = doc.output();
  // Check that the Discount column header is present in the PDF output
  assert.match(pdfOutput, /Discount/);
  // Store admin / cashier name 'Admin Rajesh' or 'Booked By' must NOT appear in the PDF
  assert.doesNotMatch(pdfOutput, /Admin Rajesh/);
  assert.doesNotMatch(pdfOutput, /Booked By/i);
});

test('4. generateThermalReceiptPdf includes DISC column and omits By: cashier name', () => {
  const order = {
    id: 'ord-therm-1',
    orderNo: 'T202',
    type: 'pieces',
    service: 'Dry cleaning',
    grossAmount: 400,
    manualCheckoutDiscountAmount: 40,
    totalAmount: 360,
    paidAmount: 360,
    balanceAmount: 0,
    items: [
      { name: 'Pant', quantity: 2, unitPrice: 200 },
    ],
    createdAt: '2026-10-14T10:00:00Z',
    dueDate: '2026-10-16T18:00:00Z',
  };

  const doc = generateThermalReceiptPdf({
    order,
    customer: { name: 'Priya Verma', mobile: '9888877777' },
    settings: { storeName: 'Clean Clear', taxEnabled: false },
    cashierName: 'Cashier Suresh',
  });

  const pdfOutput = doc.output();
  // Header includes DISC
  assert.match(pdfOutput, /DISC/);
  // Cashier name 'Cashier Suresh' or 'By:' must NOT appear in the PDF
  assert.doesNotMatch(pdfOutput, /Cashier Suresh/);
  assert.doesNotMatch(pdfOutput, /By:\s*Cashier/i);
});

test('5. getReceiptShareText omits cashier/booked by and shows total discount', () => {
  const order = {
    id: 'ord-share-1',
    orderNo: 'S303',
    type: 'pieces',
    service: 'Dry cleaning',
    grossAmount: 600,
    discountAmount: 60,
    manualCheckoutDiscountAmount: 60,
    totalAmount: 480,
    paidAmount: 480,
    balanceAmount: 0,
    items: [
      { name: 'Jacket', quantity: 1, unitPrice: 600 },
    ],
    createdAt: '2026-10-14T10:00:00Z',
    dueDate: '2026-10-16T18:00:00Z',
  };

  const shareText = getReceiptShareText({
    order,
    customer: { name: 'Anil Gupta', mobile: '9777766666' },
    settings: { storeName: 'Clean Clear', taxEnabled: false },
  });

  // Total discount of 120 (60 package + 60 checkout) is shown
  assert.match(shareText, /Discount.*: -₹120\.00/);
  // Item line shows net and item discount
  assert.match(shareText, /Jacket/);
  assert.match(shareText, /disc: -₹120\.00/);
  // Cashier or Booked By must NOT appear
  assert.doesNotMatch(shareText, /Cashier/i);
  assert.doesNotMatch(shareText, /Booked By/i);
});
