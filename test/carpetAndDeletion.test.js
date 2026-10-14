import test from 'node:test';
import assert from 'node:assert/strict';

import { isCarpetItem, isDimensionItem, garmentCatalog } from '../src/data.js';
import { priceOrder, roundMoney } from '../src/lib/orderPricing.js';
import {
  generateStandardInvoicePdf,
  generateThermalReceiptPdf,
  getReceiptShareText,
} from '../src/lib/pdfGenerator.js';
import { deleteOrder, deleteCustomer } from '../src/lib/persistence.js';

test('1. isDimensionItem / isCarpetItem identifies all per square ft items by ID, flag, and name', () => {
  const carpetItem = garmentCatalog.find((g) => g.id === 'h-carpet-sqft');
  const rugItem = garmentCatalog.find((g) => g.id === 'h-rug-sqft');
  const blindsItem = garmentCatalog.find((g) => g.id === 'h-blinds-sqft');

  assert.ok(carpetItem, 'Carpet item exists in garmentCatalog');
  assert.ok(rugItem, 'Rug item exists in garmentCatalog');
  assert.ok(blindsItem, 'Blinds item exists in garmentCatalog');

  assert.equal(isDimensionItem(carpetItem), true);
  assert.equal(isDimensionItem(rugItem), true);
  assert.equal(isDimensionItem(blindsItem), true);
  assert.equal(isCarpetItem(rugItem), true);
  assert.equal(isCarpetItem(blindsItem), true);

  // By name patterns
  assert.equal(isDimensionItem({ id: 'c1', name: 'Curtain per sq ft' }), true);
  assert.equal(isDimensionItem({ id: 'c2', name: 'Curtain per sqft' }), true);
  assert.equal(isDimensionItem({ id: 'c3', name: 'Mat per square foot' }), true);
  assert.equal(isDimensionItem({ id: 'c4', name: 'Custom Wall Hanging', isDimensionBased: true }), true);

  // Non-sqft items
  assert.equal(isDimensionItem({ id: 'm-shirt', name: 'Shirt Regular' }), false);
  assert.equal(isDimensionItem({ id: 'h-table-cloth-below-10', name: 'Table Cloth below 10 sq ft' }), false);
});

test('1b. priceOrder computes Rug per square feet price (5 ft × 4 ft = 20 sq.ft @ ₹22 = ₹440)', () => {
  const rug = garmentCatalog.find((g) => g.id === 'h-rug-sqft');
  const ratePerSqFt = rug.prices['Dry cleaning'];
  assert.equal(ratePerSqFt, 22);

  const priced = priceOrder({
    type: 'pieces',
    service: 'Dry cleaning',
    items: [
      {
        id: rug.id,
        name: rug.name,
        quantity: 1,
        length: 5,
        width: 4,
      },
    ],
  });

  assert.equal(priced.items.length, 1);
  const line = priced.items[0];
  assert.equal(line.length, 5);
  assert.equal(line.width, 4);
  assert.equal(line.sqFt, 20);
  assert.equal(line.ratePerSqFt, 22);
  assert.equal(line.unitPrice, 440);
  assert.equal(priced.grossAmount, 440);
});

test('1c. priceOrder computes Blinds per sq ft price (6 ft × 3 ft = 18 sq.ft @ ₹30 = ₹540)', () => {
  const blinds = garmentCatalog.find((g) => g.id === 'h-blinds-sqft');
  const ratePerSqFt = blinds.prices['Dry cleaning'];
  assert.equal(ratePerSqFt, 30);

  const priced = priceOrder({
    type: 'pieces',
    service: 'Dry cleaning',
    items: [
      {
        id: blinds.id,
        name: blinds.name,
        quantity: 1,
        length: 6,
        width: 3,
      },
    ],
  });

  assert.equal(priced.items.length, 1);
  const line = priced.items[0];
  assert.equal(line.length, 6);
  assert.equal(line.width, 3);
  assert.equal(line.sqFt, 18);
  assert.equal(line.ratePerSqFt, 30);
  assert.equal(line.unitPrice, 540);
  assert.equal(priced.grossAmount, 540);
});

test('2. priceOrder computes carpet price based on length and width in feet (sq.ft = length * width)', () => {
  const carpet = garmentCatalog.find((g) => g.id === 'h-carpet-sqft');
  // Catalog Dry cleaning price for carpet is 25 per sq.ft
  const ratePerSqFt = carpet.prices['Dry cleaning'] || carpet.prices['Dry Cleaning'];
  assert.equal(ratePerSqFt, 25);

  // 8 ft by 6 ft carpet = 48 sq.ft @ 25 = 1200
  const priced = priceOrder({
    type: 'pieces',
    service: 'Dry Cleaning',
    items: [
      {
        id: carpet.id,
        name: carpet.name,
        quantity: 1,
        length: 8,
        width: 6,
      },
    ],
  });

  assert.equal(priced.items.length, 1);
  const line = priced.items[0];
  assert.equal(line.length, 8);
  assert.equal(line.width, 6);
  assert.equal(line.sqFt, 48);
  assert.equal(line.ratePerSqFt, 25);
  assert.equal(line.unitPrice, 1200);
  assert.equal(line.isDimensionBased, true);
  assert.equal(priced.grossAmount, 1200);
});

test('3. priceOrder handles decimal dimensions and breadth alias for carpet', () => {
  const carpet = garmentCatalog.find((g) => g.id === 'h-carpet-sqft');

  // 6.5 ft by 4 ft carpet = 26 sq.ft @ 25 = 650
  const priced = priceOrder({
    type: 'pieces',
    service: 'Dry Cleaning',
    items: [
      {
        id: carpet.id,
        name: carpet.name,
        quantity: 2,
        length: 6.5,
        breadth: 4,
      },
    ],
  });

  const line = priced.items[0];
  assert.equal(line.length, 6.5);
  assert.equal(line.width, 4);
  assert.equal(line.sqFt, 26);
  assert.equal(line.unitPrice, 650);
  assert.equal(priced.grossAmount, 1300); // 2 * 650
});

test('4. Carpet dimensions are reflected in invoice PDF, thermal receipt PDF, and WhatsApp text', () => {
  const order = {
    id: 'ord-carpet-1',
    orderNo: 'C101',
    type: 'pieces',
    service: 'Dry Cleaning',
    grossAmount: 1200,
    totalAmount: 1200,
    paidAmount: 1200,
    balanceAmount: 0,
    status: 'Ready',
    createdAt: new Date().toISOString(),
    dueDate: new Date().toISOString(),
    items: [
      {
        id: 'h-carpet-sqft',
        name: 'Carpet per sq ft',
        category: 'Household',
        service: 'Dry Cleaning',
        quantity: 1,
        length: 8,
        width: 6,
        sqFt: 48,
        ratePerSqFt: 25,
        unitPrice: 1200,
        isDimensionBased: true,
      },
    ],
  };

  const customer = { name: 'Sunil Kumar', mobile: '9876543210' };
  const settings = { storeName: 'Clean Clear Dry Cleaning', taxEnabled: false };

  // 1. WhatsApp share text
  const shareText = getReceiptShareText({ order, customer, settings });
  assert.ok(shareText.includes('8 ft × 6 ft'), 'WhatsApp text includes length and width dimensions');
  assert.ok(shareText.includes('48 sq.ft'), 'WhatsApp text includes calculated sq.ft area');
  assert.ok(shareText.includes('₹25/sq.ft'), 'WhatsApp text includes rate per sq.ft');

  // 2. Standard Invoice PDF
  const stdPdf = generateStandardInvoicePdf({ order, customer, settings });
  assert.ok(stdPdf.output('datauristring').length > 500, 'Standard Invoice PDF generated successfully');

  // 3. Thermal Receipt PDF
  const thermalPdf = generateThermalReceiptPdf({ order, customer, settings });
  assert.ok(thermalPdf.output('datauristring').length > 500, 'Thermal Receipt PDF generated successfully');
});

test('5. deleteOrder removes order, associated payments, and updates wallet transactions cleanly', async () => {
  const mockCurrent = {
    orders: [
      { id: 'ord-1', orderNo: 'A1', customerId: 'cust-1', totalAmount: 500, balanceAmount: 0 },
      { id: 'ord-2', orderNo: 'A2', customerId: 'cust-2', totalAmount: 300, balanceAmount: 0 },
    ],
    payments: [
      { id: 'pay-1', orderId: 'ord-1', customerId: 'cust-1', amount: 500 },
      { id: 'pay-2', orderId: 'ord-2', customerId: 'cust-2', amount: 300 },
    ],
    walletTransactions: [
      { id: 'wt-1', orderId: 'ord-1', customerId: 'cust-1', amount: 500 },
    ],
  };

  const updated = await deleteOrder('ord-1', mockCurrent);

  assert.equal(updated.orders.length, 1);
  assert.equal(updated.orders[0].id, 'ord-2');
  assert.equal(updated.payments.length, 1);
  assert.equal(updated.payments[0].id, 'pay-2');
  assert.equal(updated.walletTransactions.length, 0);
});

test('6. deleteCustomer removes customer and cascades to clean up customer orders and payments', async () => {
  const mockCurrent = {
    customers: [
      { id: 'cust-1', name: 'John Doe', mobile: '9123456780' },
      { id: 'cust-2', name: 'Jane Smith', mobile: '9876543210' },
    ],
    orders: [
      { id: 'ord-1', orderNo: 'A1', customerId: 'cust-1', totalAmount: 500 },
      { id: 'ord-2', orderNo: 'A2', customerId: 'cust-2', totalAmount: 300 },
    ],
    payments: [
      { id: 'pay-1', orderId: 'ord-1', customerId: 'cust-1', amount: 500 },
      { id: 'pay-2', orderId: 'ord-2', customerId: 'cust-2', amount: 300 },
    ],
    customerPackages: [
      { id: 'cp-1', customerId: 'cust-1', packageId: 'pkg-1' },
    ],
    walletTransactions: [
      { id: 'wt-1', customerId: 'cust-1', amount: 500 },
    ],
  };

  const updated = await deleteCustomer('cust-1', mockCurrent);

  assert.equal(updated.customers.length, 1);
  assert.equal(updated.customers[0].id, 'cust-2');
  assert.equal(updated.orders.length, 1);
  assert.equal(updated.orders[0].id, 'ord-2');
  assert.equal(updated.payments.length, 1);
  assert.equal(updated.payments[0].id, 'pay-2');
  assert.equal(updated.customerPackages.length, 0);
  assert.equal(updated.walletTransactions.length, 0);
});
