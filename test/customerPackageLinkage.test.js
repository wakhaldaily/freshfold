import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createCustomer,
  updateCustomer,
  createPackage,
  assignPackage,
  createOrder,
  recordPayment,
} from '../src/lib/persistence.js';

import {
  evaluatePackageDiscount,
  findBestPackageDiscount,
} from '../src/lib/packageDiscountEngine.js';

import { createInitialData, initialPackageCatalog } from '../src/data.js';
import { generateThermalReceiptPdf } from '../src/lib/pdfGenerator.js';

test('1. Full Customer Profile creation with all 15+ fields & persistence', async () => {
  let store = createInitialData();

  const customerPayload = {
    customerCode: 'CUST-2001',
    salutation: 'Dr.',
    name: 'Ananya Sharma',
    address: 'Penthouse 12B, Palm Grove Heights',
    areaLocation: 'Golf Course Road, DLF Phase 5',
    state: 'Haryana',
    pinCode: '122002',
    mobile: '9811122334',
    email: 'ananya.sharma@example.com',
    preference: 'Light Starch',
    discountPercent: 12,
    commPreference: 'WhatsApp Only',
    rateList: 'Corporate / B2B',
    gstin: '06AABCS1234F1Z5',
    referralCode: 'REF-SUMMER26',
    notes: 'Fragile silk designer dresses, pack on wooden hangers',
  };

  store = await createCustomer(customerPayload, store);
  const created = store.customers.find((c) => c.mobile === '9811122334');

  assert.ok(created, 'Customer should be successfully saved in data store');
  assert.equal(created.customerCode, 'CUST-2001');
  assert.equal(created.salutation, 'Dr.');
  assert.equal(created.name, 'Ananya Sharma');
  assert.equal(created.address, 'Penthouse 12B, Palm Grove Heights');
  assert.equal(created.areaLocation, 'Golf Course Road, DLF Phase 5');
  assert.equal(created.state, 'Haryana');
  assert.equal(created.pinCode, '122002');
  assert.equal(created.mobile, '9811122334');
  assert.equal(created.email, 'ananya.sharma@example.com');
  assert.equal(created.preference, 'Light Starch');
  assert.equal(created.discountPercent, 12);
  assert.equal(created.commPreference, 'WhatsApp Only');
  assert.equal(created.rateList, 'Corporate / B2B');
  assert.equal(created.gstin, '06AABCS1234F1Z5');
  assert.equal(created.referralCode, 'REF-SUMMER26');
  assert.equal(created.notes, 'Fragile silk designer dresses, pack on wooden hangers');
  assert.equal(created.walletBalance, 0);

  // Test Profile Update
  store = await updateCustomer(created.id, { preference: 'Hanger', discountPercent: 15 }, store);
  const updated = store.customers.find((c) => c.id === created.id);
  assert.equal(updated.preference, 'Hanger');
  assert.equal(updated.discountPercent, 15);
});

test('2. Prepaid Wallet Package linkage to customer profile', async () => {
  let store = createInitialData();

  store = await createCustomer({ name: 'Rajesh Khanna', mobile: '9876543210' }, store);
  const customer = store.customers.find((c) => c.mobile === '9876543210');
  assert.equal(customer.walletBalance, 0);

  // Link Gold Package: Pay ₹3,000 for ₹4,000 credit
  store = await assignPackage(customer.id, 'gold-pkg', 'upi', store);
  let custAfterGold = store.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterGold.walletBalance, 4000, 'Customer wallet must reflect 4000 credit from Gold package');

  // Verify wallet transaction ledger
  const goldTx = store.walletTransactions.find((tx) => tx.customerId === customer.id && tx.kind === 'credit');
  assert.ok(goldTx);
  assert.equal(goldTx.amount, 4000);

  // Link Diamond Package: Pay ₹7,500 for ₹10,000 credit
  store = await assignPackage(customer.id, 'diamond-pkg', 'card', store);
  let custAfterDiamond = store.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterDiamond.walletBalance, 14000, 'Customer wallet must accumulate: 4000 + 10000 = 14000 credit');

  // Verify active packages on customer profile
  const custPackages = store.customerPackages.filter((cp) => cp.customerId === customer.id);
  assert.equal(custPackages.length, 2, 'Customer profile should list 2 linked package subscriptions');
  assert.ok(custPackages.some((cp) => cp.templateId === 'gold-pkg'));
  assert.ok(custPackages.some((cp) => cp.templateId === 'diamond-pkg'));
});

test('3. Rate List Tier linkages & automatic order pricing', async () => {
  let store = createInitialData();

  // Helper function mimicking PosRegister's tier resolution logic
  function calculatePosOrderDiscount(customer, cartContext, packages = store.packages, activeCustomerPackages = []) {
    const { bestDiscount } = findBestPackageDiscount(activeCustomerPackages, cartContext, packages);

    const tierDiscountPercent = (() => {
      if (!customer) return 0;
      if (customer.rateList === 'Student Discount') return 15;
      if (customer.rateList === 'Corporate / B2B') return 10;
      return 0;
    })();

    const explicitPercent = Number(customer?.discountPercent || 0);
    const customerBaseDiscountPercent = Math.max(explicitPercent, tierDiscountPercent);

    const pkgAmt = bestDiscount ? Number(bestDiscount.discountAmount || 0) : 0;
    const pkgPct = bestDiscount ? Number(bestDiscount.discountPercent || 0) : 0;
    const pkgName = bestDiscount ? bestDiscount.discountName : '';

    const grossAmount = cartContext.grossAmount;
    const custAmt = customerBaseDiscountPercent > 0
      ? Math.round((grossAmount * (customerBaseDiscountPercent / 100) + Number.EPSILON) * 100) / 100
      : 0;

    if (pkgAmt >= custAmt && pkgAmt > 0) {
      return { discountPercent: pkgPct, discountAmount: pkgAmt, discountName: pkgName };
    }

    if (custAmt > 0) {
      const tierLabel = customer?.rateList && customer.rateList !== 'Default'
        ? `${customer.rateList} Tier`
        : 'Customer Profile';
      return {
        discountPercent: customerBaseDiscountPercent,
        discountAmount: custAmt,
        discountName: `${tierLabel} (${customerBaseDiscountPercent}%)`,
      };
    }

    return { discountPercent: 0, discountAmount: 0, discountName: '' };
  }

  // Case A: Corporate / B2B customer (10% Tier Discount)
  const corporateCust = {
    id: 'cus-corp-1',
    name: 'Tech Corp India',
    rateList: 'Corporate / B2B',
    discountPercent: 0,
  };
  const cartA = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-suit', name: 'Suit', category: 'Men', unitPrice: 400, quantity: 2 }],
    grossAmount: 800,
  };
  const evalCorp = calculatePosOrderDiscount(corporateCust, cartA);
  assert.equal(evalCorp.discountPercent, 10);
  assert.equal(evalCorp.discountAmount, 80, '10% of 800 = 80');
  assert.match(evalCorp.discountName, /Corporate \/ B2B Tier/);

  // Case B: Student Discount customer (15% Tier Discount)
  const studentCust = {
    id: 'cus-stud-1',
    name: 'Rahul Verma (Student)',
    rateList: 'Student Discount',
    discountPercent: 0,
  };
  const evalStudent = calculatePosOrderDiscount(studentCust, cartA);
  assert.equal(evalStudent.discountPercent, 15);
  assert.equal(evalStudent.discountAmount, 120, '15% of 800 = 120');
  assert.match(evalStudent.discountName, /Student Discount Tier/);

  // Case C: Explicit Account Discount overrides standard tier if higher
  const vipCust = {
    id: 'cus-vip-1',
    name: 'VIP Guest',
    rateList: 'Corporate / B2B', // 10%
    discountPercent: 20, // 20% explicit override
  };
  const evalVip = calculatePosOrderDiscount(vipCust, cartA);
  assert.equal(evalVip.discountPercent, 20);
  assert.equal(evalVip.discountAmount, 160, '20% of 800 = 160');
});

test('4. Customer Profile Tier vs Package Discount intelligent comparison', async () => {
  let store = createInitialData();

  // Create a customer with 10% Corporate Tier
  store = await createCustomer({
    name: 'Apollo Clinics B2B',
    mobile: '9899001122',
    rateList: 'Corporate / B2B', // 10%
    discountPercent: 0,
  }, store);
  const customer = store.customers.find((c) => c.mobile === '9899001122');

  // Assign Half Price Dry Cleaning package (50% off Dry Cleaning)
  store = await assignPackage(customer.id, 'half-price-pkg', 'cash', store);
  const activePackages = store.customerPackages.filter((cp) => cp.customerId === customer.id);

  function resolveDiscount(cartContext) {
    const { bestDiscount } = findBestPackageDiscount(activePackages, cartContext, store.packages);
    const tierDiscountPercent = customer.rateList === 'Corporate / B2B' ? 10 : 0;
    const custAmt = Math.round((cartContext.grossAmount * (tierDiscountPercent / 100) + Number.EPSILON) * 100) / 100;
    const pkgAmt = bestDiscount ? Number(bestDiscount.discountAmount || 0) : 0;

    if (pkgAmt >= custAmt && pkgAmt > 0) {
      return { ...bestDiscount, source: 'package' };
    }
    return {
      discountPercent: tierDiscountPercent,
      discountAmount: custAmt,
      discountName: 'Corporate / B2B Tier',
      source: 'tier',
    };
  }

  // Order 1: Dry Cleaning (₹500 gross) -> Half Price package applies 50% (₹250), which beats 10% tier (₹50)
  const cartDryClean = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 125, quantity: 4 }],
    grossAmount: 500,
  };
  const resDryClean = resolveDiscount(cartDryClean);
  assert.equal(resDryClean.source, 'package', 'Should award Package 50% discount because it gives higher saving');
  assert.equal(resDryClean.discountAmount, 250);
  assert.equal(resDryClean.discountPercent, 50);

  // Order 2: Steam Press (₹200 gross) -> Half Price package is NOT valid for Steam press
  // System must automatically fall back to the customer's 10% Corporate Tier!
  const cartSteamPress = {
    orderType: 'pieces',
    service: 'Steam press',
    items: [{ id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 50, quantity: 4 }],
    grossAmount: 200,
  };
  const resSteamPress = resolveDiscount(cartSteamPress);
  assert.equal(resSteamPress.source, 'tier', 'Should fall back to customer Corporate Tier');
  assert.equal(resSteamPress.discountAmount, 20, '10% of 200 = 20');
  assert.equal(resSteamPress.discountPercent, 10);
});

test('5. Laundry Preferences & Workshop Ticket Linkage', async () => {
  let store = createInitialData();

  store = await createCustomer({
    name: 'Suresh Raina',
    mobile: '9845012345',
    preference: 'Hanger (Steam Pressed)',
  }, store);
  const customer = store.customers.find((c) => c.mobile === '9845012345');

  // Place order with customer preference linked
  store = await createOrder({
    customerId: customer.id,
    customerPreference: customer.preference,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-suit', name: 'Suit 2 Pcs', category: 'Men', unitPrice: 400, quantity: 1 }],
    grossAmount: 400,
    discountAmount: 0,
    discountPercent: 0,
    discountName: '',
  }, store);

  const order = store.orders[0];
  assert.ok(order);
  assert.equal(order.customerPreference, 'Hanger (Steam Pressed)', 'Order must preserve customer wash preference');

  // Verify PDF generation includes customer wash preference
  const pdfDoc = generateThermalReceiptPdf({
    order,
    customer,
    settings: store.settings,
    cashierName: 'Counter Cashier',
  });
  assert.ok(pdfDoc, 'PDF receipt generated successfully');
  // Confirm the generated output is a valid PDF
  const pdfBlob = pdfDoc.output('blob');
  assert.ok(pdfBlob.size > 1000, 'Generated receipt PDF should contain structured byte data');
});

test('6. B2B GSTIN Linkage for Tax Invoicing', async () => {
  let store = createInitialData();

  store = await createCustomer({
    name: 'Grand Hyatt Hotel Gurugram',
    mobile: '9812345678',
    gstin: '06AAACH1234F1Z9',
    rateList: 'Corporate / B2B',
  }, store);
  const customer = store.customers.find((c) => c.mobile === '9812345678');

  store = await createOrder({
    customerId: customer.id,
    customerGstin: customer.gstin,
    customerRateList: customer.rateList,
    type: 'weight',
    service: 'Wash and Fold',
    weightKg: 20,
    grossAmount: 1800,
    discountAmount: 180, // 10% corporate
    discountPercent: 10,
    discountName: 'Corporate / B2B (10%)',
  }, store);

  const order = store.orders[0];
  assert.equal(order.customerGstin, '06AAACH1234F1Z9', 'Order must attach customer GSTIN for B2B tax invoice');
  assert.equal(order.customerRateList, 'Corporate / B2B');

  // Generate Thermal Receipt with B2B Tax invoice details
  const pdfDoc = generateThermalReceiptPdf({
    order,
    customer,
    settings: store.settings,
    cashierName: 'Commercial Desk',
  });
  assert.ok(pdfDoc);
});

test('7. Full End-to-End Lifecycle Linkage: Intake -> Package -> POS Order -> Wallet Pay -> Receipt', async () => {
  let store = createInitialData();

  // Step 1: Customer Intake
  store = await createCustomer({
    customerCode: 'CUST-8888',
    salutation: 'Ms.',
    name: 'Kavita Krishnan',
    mobile: '9988776655',
    email: 'kavita@domain.com',
    address: 'B-404, Cyber City Residences',
    preference: 'Folded (Travel Pack)',
    rateList: 'Default',
    gstin: '07AABCK5544R1Z2',
  }, store);
  const customer = store.customers.find((c) => c.mobile === '9988776655');
  assert.ok(customer);
  assert.equal(customer.walletBalance, 0);

  // Step 2: Customer buys Platinum Wallet Package (₹15,000 for ₹20,500 credit)
  store = await assignPackage(customer.id, 'platinum-pkg', 'upi', store);
  const updatedCust = store.customers.find((c) => c.id === customer.id);
  assert.equal(updatedCust.walletBalance, 20500, 'Customer wallet credited with 20,500');

  // Step 3: Customer places a major dry cleaning and laundry order
  const gross = 1250;
  store = await createOrder({
    customerId: customer.id,
    customerCode: customer.customerCode,
    customerPreference: customer.preference,
    customerGstin: customer.gstin,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-suit', name: 'Suit 2 Pcs', category: 'Men', unitPrice: 400, quantity: 2 },
      { id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 125, quantity: 2 },
      { id: 'w-saree', name: 'Silk Saree', category: 'Women', unitPrice: 200, quantity: 1 },
    ],
    grossAmount: gross,
    discountAmount: 0,
    discountPercent: 0,
    discountName: '',
  }, store);

  const placedOrder = store.orders[0];
  assert.ok(placedOrder);
  assert.equal(placedOrder.grossAmount, 1250);
  assert.equal(placedOrder.customerGstin, '07AABCK5544R1Z2');
  assert.equal(placedOrder.customerPreference, 'Folded (Travel Pack)');
  // Money is now automatically deducted from customer's wallet credits upon order placement!
  assert.equal(placedOrder.balanceAmount, 0, 'Order balance is automatically cleared from wallet credits upon placement');
  assert.equal(placedOrder.paidAmount, placedOrder.totalAmount, 'Order paidAmount matches total amount automatically');

  // Verify wallet balance deduction happened immediately upon placement
  const finalCust = store.customers.find((c) => c.id === customer.id);
  assert.equal(finalCust.walletBalance, 20500 - placedOrder.totalAmount, 'Customer wallet balance immediately deducted');
  assert.ok(store.payments.some((p) => p.orderId === placedOrder.id && p.method === 'wallet'), 'Wallet payment record created');
  assert.ok(store.walletTransactions.some((wt) => wt.orderId === placedOrder.id && wt.kind === 'debit'), 'Wallet debit ledger created');

  // Step 5: Thermal receipt verification
  const receiptPdf = generateThermalReceiptPdf({
    order: placedOrder,
    customer: finalCust,
    settings: store.settings,
    payments: store.payments.filter((p) => p.orderId === placedOrder.id),
    cashierName: 'Main Register',
  });
  assert.ok(receiptPdf);
  const pdfBlob = receiptPdf.output('blob');
  assert.ok(pdfBlob.size > 1000);
});

test('8. Automatic Wallet Credit Deduction (Full & Partial) upon Order Intake', async () => {
  let store = createInitialData();

  // Create customer
  store = await createCustomer({
    name: 'Rohan Verma',
    mobile: '9876500011',
  }, store);
  const customer = store.customers.find((c) => c.mobile === '9876500011');
  assert.ok(customer);

  // Subscribe to Gold Package (adds ₹4,000 credits)
  store = await assignPackage(customer.id, 'gold-pkg', 'cash', store);
  const custAfterPkg = store.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterPkg.walletBalance, 4000, 'Customer has 4,000 wallet credits');

  // Order 1: Order total ₹500 (Gross 500, Tax 0 for simplicity)
  store.settings.taxEnabled = false;
  store = await createOrder({
    customerId: customer.id,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 250, quantity: 2 }],
    grossAmount: 500,
    discountAmount: 0,
    discountPercent: 0,
  }, store);

  const order1 = store.orders[0];
  assert.equal(order1.totalAmount, 500);
  assert.equal(order1.paidAmount, 500, 'Paid in full via auto-deducted wallet');
  assert.equal(order1.balanceAmount, 0, 'No balance remaining');

  const custAfterOrder1 = store.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterOrder1.walletBalance, 3500, 'Remaining wallet balance is 3,500');

  // Order 2: Order total ₹4,000 (More than remaining ₹3,500 credit -> partial auto-deduction)
  store = await createOrder({
    customerId: customer.id,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-coat', name: 'Coat', category: 'Men', unitPrice: 1000, quantity: 4 }],
    grossAmount: 4000,
    discountAmount: 0,
    discountPercent: 0,
  }, store);

  const order2 = store.orders[0];
  assert.equal(order2.totalAmount, 4000);
  assert.equal(order2.paidAmount, 3500, 'Partial auto-deduction of remaining 3,500 credits');
  assert.equal(order2.balanceAmount, 500, 'Remaining 500 balance due');

  const custAfterOrder2 = store.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterOrder2.walletBalance, 0, 'Wallet balance reduced to 0');
});
