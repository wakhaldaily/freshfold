import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCustomer,
  assignPackage,
  deleteCustomerPackage,
} from '../src/lib/persistence.js';

import { resolveOrderPackageInfo } from '../src/lib/orderPricing.js';
import { generateStandardInvoicePdf } from '../src/lib/pdfGenerator.js';
import { createInitialData } from '../src/data.js';

test('resolveOrderPackageInfo returns exact 4 columns when customer has package', () => {
  const order = {
    customerId: 'cust-1',
    discountName: 'Half Price Package. (2022)',
    totalAmount: 1500,
    paidAmount: 1500,
  };
  const customer = {
    id: 'cust-1',
    name: 'Mrs. Suman Rao',
    walletBalance: 0,
  };
  const customerPackages = [
    {
      id: 'cp-1',
      customerId: 'cust-1',
      name: 'Half Price Package. (2022)',
      kind: 'discount',
      discountPercent: 50,
      expiresAt: '2027-01-26',
      status: 'active',
    },
  ];

  const info = resolveOrderPackageInfo(order, customer, customerPackages);
  assert.ok(info, 'Package info should be resolved');
  assert.equal(info.name, 'Half Price Package. (2022)');
  assert.equal(info.consumed, '0.00');
  assert.equal(info.balance, '0');
  assert.equal(info.validTill, '26 Jan 2027');
});

test('resolveOrderPackageInfo handles wallet package credit consumption & balance', () => {
  const order = {
    customerId: 'cust-2',
    totalAmount: 450,
    paidAmount: 450,
  };
  const customer = {
    id: 'cust-2',
    name: 'Rahul Verma',
    walletBalance: 1550,
  };
  const customerPackages = [
    {
      id: 'cp-wallet-1',
      customerId: 'cust-2',
      name: 'Gold Wallet 2000',
      kind: 'wallet',
      walletCredit: 2000,
      remainingCredit: 1550,
      expiresAt: null,
      status: 'active',
    },
  ];

  const info = resolveOrderPackageInfo(order, customer, customerPackages);
  assert.ok(info, 'Package info should be resolved for wallet');
  assert.equal(info.name, 'Gold Wallet 2000');
  assert.equal(info.consumed, '450.00');
  assert.equal(info.balance, '1550');
  assert.equal(info.validTill, 'Lifetime');
});

test('resolveOrderPackageInfo returns null when customer has no package', () => {
  const order = {
    customerId: 'cust-none',
    totalAmount: 300,
    paidAmount: 0,
  };
  const customer = {
    id: 'cust-none',
    name: 'No Package Customer',
  };

  const info = resolveOrderPackageInfo(order, customer, []);
  assert.equal(info, null, 'Should return null if customer has no package');
});

test('deleteCustomerPackage removes package and deducts unused wallet balance', async () => {
  let store = createInitialData();
  const customerPayload = {
    name: 'Karan Mehra',
    mobile: '9876543210',
    walletBalance: 0,
  };
  store = await createCustomer(customerPayload, store);
  const customer = store.customers.find((c) => c.mobile === '9876543210');

  // Assign a wallet package
  store = await assignPackage(customer.id, 'gold-pkg', 'cash', store);
  const enrolledPkg = store.customerPackages.find((cp) => cp.customerId === customer.id);
  assert.ok(enrolledPkg, 'Package enrolled');
  const custAfterEnroll = store.customers.find((c) => c.id === customer.id);
  assert.ok(custAfterEnroll.walletBalance > 0, 'Wallet balance credited');
  const prevBalance = custAfterEnroll.walletBalance;

  // Delete the package
  store = await deleteCustomerPackage(enrolledPkg.id, store);
  const deletedPkg = store.customerPackages.find((cp) => cp.id === enrolledPkg.id);
  assert.equal(deletedPkg, undefined, 'Package should no longer be in customerPackages');

  // Verify wallet balance is deducted
  const custAfterDelete = store.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterDelete.walletBalance, 0, 'Wallet balance should have remaining credit deducted');

  // Verify debit transaction logged
  const debitTx = store.walletTransactions.find((tx) => tx.customerId === customer.id && tx.kind === 'debit');
  assert.ok(debitTx, 'Debit transaction should be logged');
  assert.equal(debitTx.amount, prevBalance);
});

test('deleteCustomerPackage deletes discount package cleanly without wallet balance alteration', async () => {
  let store = createInitialData();
  const customerPayload = {
    name: 'Priya Sharma',
    mobile: '9123456789',
    walletBalance: 250,
  };
  store = await createCustomer(customerPayload, store);
  const customer = store.customers.find((c) => c.mobile === '9123456789');

  // Assign half-price discount package
  store = await assignPackage(customer.id, 'half-price-pkg', 'cash', store);
  const enrolledPkg = store.customerPackages.find((cp) => cp.customerId === customer.id);
  assert.ok(enrolledPkg, 'Discount package enrolled');

  // Delete package
  store = await deleteCustomerPackage(enrolledPkg.id, store);
  const deletedPkg = store.customerPackages.find((cp) => cp.id === enrolledPkg.id);
  assert.equal(deletedPkg, undefined, 'Package removed');

  const custAfterDelete = store.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterDelete.walletBalance, 0, 'Wallet balance remained 0 for discount package');
});

test('generateStandardInvoicePdf includes package info when activePackageInfo present', () => {
  const order = {
    id: 'ord-123',
    orderNo: 'W1295-3',
    customerId: 'cust-1',
    grossAmount: 1000,
    discountAmount: 500,
    discountName: 'Half Price Package. (2022)',
    totalAmount: 500,
    paidAmount: 500,
    dueDate: '2026-01-28',
    createdAt: '2026-01-20',
    items: [{ id: '1', name: 'Shirt', quantity: 2, unitPrice: 500 }],
  };
  const customer = {
    id: 'cust-1',
    name: 'Mrs. Suman Rao',
  };
  const customerPackages = [
    {
      id: 'cp-1',
      customerId: 'cust-1',
      name: 'Half Price Package. (2022)',
      kind: 'discount',
      expiresAt: '2027-01-26',
      status: 'active',
    },
  ];

  const doc = generateStandardInvoicePdf({
    order,
    customer,
    settings: { storeName: 'Crystal Clear Dry Cleaning' },
    customerPackages,
  });

  assert.ok(doc, 'PDF doc generated successfully');
  const pdfString = doc.output();
  assert.ok(pdfString.includes('Half Price Package'), 'PDF output should contain package name');
});
