import test from 'node:test';
import assert from 'node:assert/strict';
import { generateBillToken, verifyBillToken, buildPublicBillUrl } from '../src/lib/billSecurity.js';
import { getReceiptShareText } from '../src/lib/pdfGenerator.js';

test('1. Bill token generation produces deterministic SHA-256 signatures', async () => {
  const token1 = await generateBillToken('ord-1', 'F1001', '2026-10-11T10:00:00Z', '9876543210');
  const token2 = await generateBillToken('ord-1', 'F1001', '2026-10-11T10:00:00Z', '9876543210');
  assert.equal(token1, token2);
  assert.equal(token1.length, 16);
});

test('2. verifyBillToken accepts valid token and rejects tampered or wrong tokens', async () => {
  const token = await generateBillToken('ord-2', 'F1002', '2026-10-11T11:00:00Z', '9876543210');

  // Valid verification
  const isValid = await verifyBillToken('ord-2', 'F1002', '2026-10-11T11:00:00Z', '9876543210', token);
  assert.equal(isValid, true);

  // Tampered token fails
  const badToken = await verifyBillToken('ord-2', 'F1002', '2026-10-11T11:00:00Z', '9876543210', 'tampered12345678');
  assert.equal(badToken, false);

  // Different customer mobile fails
  const wrongMobile = await verifyBillToken('ord-2', 'F1002', '2026-10-11T11:00:00Z', '9111111111', token);
  assert.equal(wrongMobile, false);

  // Different order ID fails
  const wrongOrder = await verifyBillToken('ord-999', 'F1002', '2026-10-11T11:00:00Z', '9876543210', token);
  assert.equal(wrongOrder, false);
});

test('3. buildPublicBillUrl generates full secure URL with order identifier and signature', async () => {
  const order = { id: 'ord-100', orderNo: 'F20261011A1B2', createdAt: '2026-10-11T12:00:00Z' };
  const customer = { name: 'Sunil Verma', mobile: '+91 98765 43210' };

  const url = await buildPublicBillUrl(order, customer);
  assert.match(url, /\/\?bill=F20261011A1B2/);
  assert.match(url, /&token=[a-f0-9]{16}/);
});

test('4. getReceiptShareText includes the secure digital bill link in WhatsApp text', async () => {
  const order = {
    id: 'ord-200',
    orderNo: 'F200',
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ name: 'Silk Saree', quantity: 1, unitPrice: 450 }],
    grossAmount: 450,
    totalAmount: 450,
    paidAmount: 450,
    balanceAmount: 0,
    status: 'Ready',
    createdAt: '2026-10-11T12:00:00Z',
    dueDate: '2026-10-13T18:00:00Z',
  };
  const customer = { name: 'Anita Roy', mobile: '9876543210' };
  const settings = { storeName: 'Fresh Fold Laundry', phone: '+91 99999 88888' };
  const billUrl = 'https://freshfold.app/?bill=F200&token=abcdef1234567890';

  const shareText = getReceiptShareText({ order, customer, settings, billUrl });

  assert.match(shareText, /FRESH FOLD LAUNDRY/);
  assert.match(shareText, /#F200/);
  assert.match(shareText, /View & Download PDF Bill:/);
  assert.match(shareText, /https:\/\/freshfold\.app\/\?bill=F200&token=abcdef1234567890/);
  assert.match(shareText, /Silk Saree/);
});

test('5. shareReceiptWhatsApp formats universal wa.me link and WhatsApp Web URL properly', async () => {
  const { shareReceiptWhatsApp } = await import('../src/lib/pdfGenerator.js');

  const order = {
    id: 'ord-300',
    orderNo: 'F300',
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ name: 'Suit 2pc', quantity: 1, unitPrice: 400 }],
    grossAmount: 400,
    totalAmount: 400,
    paidAmount: 400,
    balanceAmount: 0,
    status: 'Ready',
    createdAt: '2026-10-11T12:00:00Z',
  };
  const customer = { name: 'Rahul Sharma', mobile: '+91 98765 43210' };
  const settings = { storeName: 'Clean Clear Dry Cleaning', phone: '+91 99999 88888' };

  // 1. Universal wa.me link
  const resUniversal = await shareReceiptWhatsApp({
    order,
    customer,
    settings,
    billUrl: 'https://cleanclear.app/?bill=F300&token=1234567890abcdef',
    useWeb: false,
  });

  assert.match(resUniversal.target, /^https:\/\/wa\.me\/919876543210\?text=/);
  assert.match(decodeURIComponent(resUniversal.target), /CLEAN CLEAR DRY CLEANING/);
  assert.match(decodeURIComponent(resUniversal.target), /https:\/\/cleanclear\.app\/\?bill=F300&token=1234567890abcdef/);

  // 2. Direct WhatsApp Web link
  const resWeb = await shareReceiptWhatsApp({
    order,
    customer,
    settings,
    billUrl: 'https://cleanclear.app/?bill=F300&token=1234567890abcdef',
    useWeb: true,
  });

  assert.match(resWeb.target, /^https:\/\/web\.whatsapp\.com\/send\?phone=919876543210&text=/);
});

test('6. verifyBillToken verifies tokens even if timestamps differ in millisecond precision or timezone offset', async () => {
  // Order generated on client with full ISO string milliseconds
  const clientCreatedAt = '2026-10-11T12:00:00.123Z';
  const token = await generateBillToken('ord-500', 'B6164', clientCreatedAt, '9876543210');

  // DB returns timestamp without milliseconds
  const dbCreatedAt = '2026-10-11T12:00:00Z';
  const isVerifiedWithDbDate = await verifyBillToken('ord-500', 'B6164', dbCreatedAt, '9876543210', token);
  assert.equal(isVerifiedWithDbDate, true);

  // DB returns timestamp in Indian Standard Time (+05:30)
  const tzCreatedAt = '2026-10-11T17:30:00+05:30';
  const isVerifiedWithTz = await verifyBillToken('ord-500', 'B6164', tzCreatedAt, '9876543210', token);
  assert.equal(isVerifiedWithTz, true);

  // Tokens generated without date also verify cleanly
  const emptyDateToken = await generateBillToken('ord-500', 'B6164', '', '9876543210');
  const isVerifiedEmptyDate = await verifyBillToken('ord-500', 'B6164', '', '9876543210', emptyDateToken);
  assert.equal(isVerifiedEmptyDate, true);
});

test('7. verifyBillToken handles uppercase / trimmed tokens cleanly', async () => {
  const token = await generateBillToken('ord-600', 'B6165', '2026-10-11T14:30:00Z', '9876543210');
  const upperPaddedToken = `  ${token.toUpperCase()}  `;

  const isValid = await verifyBillToken('ord-600', 'B6165', '2026-10-11T14:30:00Z', '9876543210', upperPaddedToken);
  assert.equal(isValid, true);
});

