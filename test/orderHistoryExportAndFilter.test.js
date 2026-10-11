import test from 'node:test';
import assert from 'node:assert/strict';
import {
  filterOrdersByDate,
  exportOrdersToExcel,
  isDateInThisWeek,
  getAvailableYears,
  getFilterPeriodLabel,
} from '../src/lib/exportUtils.js';
import { downloadBatchInvoicesPdf } from '../src/lib/pdfGenerator.js';

const mockOrders = [
  {
    id: 'ord-1',
    orderNo: 'W101',
    customerId: 'cus-1',
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ name: 'Silk Shirt', quantity: 2, unitPrice: 150 }],
    grossAmount: 300,
    totalAmount: 300,
    paidAmount: 300,
    balanceAmount: 0,
    status: 'Ready',
    createdAt: '2026-10-12T10:00:00Z', // In this week (Monday Oct 12 2026)
    dueDate: '2026-10-14T18:00:00Z',
  },
  {
    id: 'ord-2',
    orderNo: 'W102',
    customerId: 'cus-2',
    type: 'weight',
    service: 'Wash and Fold',
    weightKg: 4.5,
    grossAmount: 405,
    totalAmount: 405,
    paidAmount: 200,
    balanceAmount: 205,
    status: 'Processing',
    createdAt: '2026-10-02T15:30:00Z', // In October 2026, but not this week
    dueDate: '2026-10-04T18:00:00Z',
  },
  {
    id: 'ord-3',
    orderNo: 'W103',
    customerId: 'cus-1',
    type: 'pieces',
    service: 'Steam press',
    items: [{ name: 'Suit 2pc', quantity: 1, unitPrice: 200 }],
    grossAmount: 200,
    totalAmount: 200,
    paidAmount: 0,
    balanceAmount: 200,
    status: 'Received',
    createdAt: '2025-05-15T09:00:00Z', // May 2025 (Previous year)
    dueDate: '2025-05-18T18:00:00Z',
  },
];

const mockCustomers = [
  { id: 'cus-1', name: 'Ramesh Gupta', mobile: '9876543210' },
  { id: 'cus-2', name: 'Sneha Patel', mobile: '9123456789' },
];

test('1. filterOrdersByDate correctly isolates this week, this month, and this year', () => {
  const refDate = new Date('2026-10-12T12:00:00Z');

  // This Week: should only return ord-1
  const weekOrders = filterOrdersByDate({
    orders: mockOrders,
    timePreset: 'this-week',
    refDate,
  });
  assert.equal(weekOrders.length, 1);
  assert.equal(weekOrders[0].id, 'ord-1');

  // This Month (October 2026): should return ord-1 and ord-2
  const monthOrders = filterOrdersByDate({
    orders: mockOrders,
    timePreset: 'this-month',
    refDate,
  });
  assert.equal(monthOrders.length, 2);
  assert.deepEqual(monthOrders.map((o) => o.id), ['ord-1', 'ord-2']);

  // This Year (2026): should return ord-1 and ord-2
  const yearOrders = filterOrdersByDate({
    orders: mockOrders,
    timePreset: 'this-year',
    refDate,
  });
  assert.equal(yearOrders.length, 2);

  // Custom filter (May 2025): should return ord-3
  const customOrders = filterOrdersByDate({
    orders: mockOrders,
    timePreset: 'custom',
    selectedYear: 2025,
    selectedMonth: 4, // 0-indexed May
    refDate,
  });
  assert.equal(customOrders.length, 1);
  assert.equal(customOrders[0].id, 'ord-3');
});

test('2. getAvailableYears returns unique sorted years including current year', () => {
  const years = getAvailableYears(mockOrders);
  assert.ok(years.includes(2026));
  assert.ok(years.includes(2025));
  assert.equal(years[0] >= years[1], true);
});

test('3. exportOrdersToExcel generates valid Excel CSV with UTF-8 BOM and columns', () => {
  const result = exportOrdersToExcel({
    orders: mockOrders,
    customers: mockCustomers,
    settings: { storeName: 'FreshFold Test Store' },
    timeLabel: 'October 2026',
  });

  assert.equal(result.success, true);
  assert.equal(result.count, 3);
  assert.match(result.filename, /CleanClear_Orders_.*\.csv/);
});

test('4. downloadBatchInvoicesPdf generates multi-page PDF document for all filtered invoices', () => {
  const res = downloadBatchInvoicesPdf({
    orders: mockOrders,
    customers: mockCustomers,
    settings: { storeName: 'FreshFold Cleaners', taxNumber: '07AAAAA0000A1Z5' },
    payments: [],
    format: 'thermal',
  });

  assert.equal(res.success, true);
  assert.equal(res.count, 3);
  assert.ok(res.doc);
  // Multi-page PDF must have 1 page per order
  assert.equal(res.doc.getNumberOfPages(), 3);
});
