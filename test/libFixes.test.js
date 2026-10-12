import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluatePackageDiscount,
  findBestPackageDiscount,
  normalizePackageRules,
} from '../src/lib/packageDiscountEngine.js';
import { escapeCsv, exportOrdersToExcel } from '../src/lib/exportUtils.js';
import { formatDate as formatDateDirect } from '../src/lib/dateFormat.js';
import {
  formatDate,
  formatDateTime,
  splitTax,
  allocateDiscount,
  generateThermalReceiptPdf,
  generateStandardInvoicePdf,
} from '../src/lib/pdfGenerator.js';

const piecesCtx = (items, grossAmount) => ({
  orderType: 'pieces',
  service: 'Dry cleaning',
  items,
  grossAmount,
});

const localYmd = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

test('A1. Wallet package named "Blanket Wallet" is never re-inferred as a discount', () => {
  const pkg = { id: 'blanket-wallet', name: 'Blanket Wallet', description: 'blanket sweater wallet', kind: 'wallet', walletCredit: 1000 };
  const normalized = normalizePackageRules(pkg);
  assert.equal(normalized.kind, 'wallet');
  assert.equal(normalized.discountPercent, undefined);
  assert.equal(normalized.targetKeywords, undefined);

  const ev = evaluatePackageDiscount(pkg, piecesCtx([
    { id: 'h-blanket-double', name: 'Blanket Double', unitPrice: 500, quantity: 4 },
  ], 2000));
  assert.equal(ev.applicable, false);
  assert.equal(ev.discountAmount, 0);
  assert.match(ev.reason, /wallet/i);
});

test('A1. Explicit kind is preserved; sweater wins over blanket', () => {
  const explicit = normalizePackageRules({ name: 'Blanket Saver', kind: 'buy_x_get_y', buyQty: 2, freeQty: 1 });
  assert.equal(explicit.kind, 'buy_x_get_y');
  assert.equal(explicit.discountPercent, 25, 'defaults still filled');

  const both = normalizePackageRules({ name: 'Sweater & Blanket Combo' });
  assert.equal(both.kind, 'buy_x_get_y');
  assert.deepEqual(both.targetKeywords, ['sweater', 'sweatshirt']);
  assert.equal(both.discountPercent, undefined, 'blanket defaults not applied');

  const special = normalizePackageRules({ name: 'Blanket Offer', kind: 'special' });
  assert.equal(special.kind, 'discount');
});

test('A2. Zero / negative / NaN quantities contribute nothing', () => {
  const pkg = { id: 'p', name: 'Shirt deal', kind: 'discount', discountPercent: 50, applicableOrderType: 'pieces', targetKeywords: ['shirt'] };
  const ev = evaluatePackageDiscount(pkg, piecesCtx([
    { id: 'm-shirt', name: 'Shirt', unitPrice: 100, quantity: 2 },
    { id: 'm-shirt-2', name: 'Shirt Silk', unitPrice: 300, quantity: 0 },
    { id: 'm-shirt-3', name: 'Shirt Linen', unitPrice: 300, quantity: -3 },
    { id: 'm-shirt-4', name: 'Shirt Cotton', unitPrice: 300, quantity: 'abc' },
    { id: 'm-shirt-5', name: 'Shirt Denim', unitPrice: 100, quantity: 1.9 },
  ], 300));
  assert.equal(ev.applicable, true);
  assert.equal(ev.discountAmount, 150, '50% of (2*100 + 1*100)');
  assert.equal(ev.qualifyingItems.length, 2);

  const onlyNegative = evaluatePackageDiscount(pkg, piecesCtx([
    { id: 'm-shirt', name: 'Shirt', unitPrice: 100, quantity: -5 },
  ], 0));
  assert.equal(onlyNegative.applicable, false);
  assert.equal(onlyNegative.discountAmount, 0);

  const bogo = { id: 'b', name: 'Saree B2G1', kind: 'buy_x_get_y', buyQty: 2, freeQty: 1, applicableOrderType: 'pieces', targetKeywords: ['saree'] };
  const evBogo = evaluatePackageDiscount(bogo, piecesCtx([
    { id: 'w-saree', name: 'Saree', unitPrice: 300, quantity: 3 },
    { id: 'w-saree-2', name: 'Saree Cheap', unitPrice: 10, quantity: -4 },
  ], 900));
  assert.equal(evBogo.freeItemsCount, 1);
  assert.equal(evBogo.discountAmount, 300);
});

test('A3. discountPercent > 100 is clamped (pieces and weight)', () => {
  const pieces = evaluatePackageDiscount(
    { id: 'x', name: 'Mega', kind: 'discount', discountPercent: 250 },
    piecesCtx([{ id: 'm-shirt', name: 'Shirt', unitPrice: 100, quantity: 2 }], 200),
  );
  assert.equal(pieces.discountAmount, 200);
  assert.ok(pieces.discountAmount <= 200);

  const weight = evaluatePackageDiscount(
    { id: 'y', name: 'Mega Weight', kind: 'discount', discountPercent: 150 },
    { orderType: 'weight', service: 'Wash and Fold', weightKg: 5, grossAmount: 450 },
  );
  assert.equal(weight.applicable, true);
  assert.equal(weight.discountAmount, 450);
  assert.equal(weight.discountPercent, 100);

  const negative = evaluatePackageDiscount(
    { id: 'z', name: 'Neg', kind: 'discount', discountPercent: -20 },
    piecesCtx([{ id: 'm-shirt', name: 'Shirt', unitPrice: 100, quantity: 2 }], 200),
  );
  assert.ok(negative.discountAmount >= 0);
});

test('A4. String targetKeywords block weight orders', () => {
  const ev = evaluatePackageDiscount(
    { id: 'k', name: 'Curtain Care', kind: 'discount', discountPercent: 20, targetKeywords: 'curtain, drape' },
    { orderType: 'weight', service: 'Wash and Fold', weightKg: 5, grossAmount: 450 },
  );
  assert.equal(ev.applicable, false);
  assert.equal(ev.discountAmount, 0);
  assert.match(ev.reason, /per-piece/i);
});

test('A5. findBestPackageDiscount skips expired packages', () => {
  const today = new Date();
  const yesterday = new Date(today.getFullYear(), today.getMonth(), today.getDate() - 1);
  const base = { status: 'active', kind: 'discount', discountPercent: 50, applicableService: 'Dry cleaning', applicableOrderType: 'pieces' };
  const ctx = piecesCtx([{ id: 'm-shirt', name: 'Shirt', unitPrice: 100, quantity: 2 }], 200);

  const { bestDiscount, allEvaluations } = findBestPackageDiscount([
    { ...base, id: 'expired', name: 'Expired', expiresAt: localYmd(yesterday) },
    { ...base, id: 'expired-iso', name: 'Expired ISO', expiresAt: '2000-01-01T10:00:00Z' },
    { ...base, id: 'today', name: 'Ends Today', discountPercent: 10, expiresAt: localYmd(today) },
    { ...base, id: 'never', name: 'No Expiry', discountPercent: 20, expiresAt: null },
    { ...base, id: 'empty', name: 'Empty Expiry', discountPercent: 5, expiresAt: '' },
  ], ctx, []);

  const ids = allEvaluations.map((e) => e.package.id);
  assert.deepEqual(ids, ['today', 'never', 'empty']);
  assert.equal(bestDiscount.package.id, 'never');
  assert.equal(bestDiscount.discountAmount, 40);
});

test('B. escapeCsv neutralises formula injection but keeps numeric strings', () => {
  assert.equal(escapeCsv('=HYPERLINK("http://evil","x")'), `"'=HYPERLINK(""http://evil"",""x"")"`);
  assert.equal(escapeCsv('+cmd'), `"'+cmd"`);
  assert.equal(escapeCsv('-cmd'), `"'-cmd"`);
  assert.equal(escapeCsv('@SUM(A1)'), `"'@SUM(A1)"`);
  assert.equal(escapeCsv('\tfoo'), `"'\tfoo"`);
  assert.equal(escapeCsv('\rfoo'), `"'\rfoo"`);
  assert.equal(escapeCsv('-12.50'), '"-12.50"');
  assert.equal(escapeCsv((-12.5).toFixed(2)), '"-12.50"');
  assert.equal(escapeCsv('+91'), '"+91"');
  assert.equal(escapeCsv('9876543210'), '"9876543210"');
  assert.equal(escapeCsv('Shirt'), '"Shirt"');
  assert.equal(escapeCsv(null), '');
  assert.equal(escapeCsv(undefined), '');
  assert.equal(escapeCsv(0), '"0"');

  // Export with malicious values still succeeds (headers routed through escapeCsv)
  const res = exportOrdersToExcel({
    orders: [{ id: 'o1', orderNo: '=HYPERLINK("x")', customerId: 'c1', type: 'pieces', items: [], totalAmount: 10 }],
    customers: [{ id: 'c1', name: '@evil', mobile: '9876543210' }],
    settings: { storeName: '=Store' },
    timeLabel: '-All',
  });
  assert.equal(res.success, true);
});

test('C1. formatDate keeps the calendar day for date-only strings (default TZ)', () => {
  assert.match(formatDate('2026-10-12'), /^12\b/);
  assert.match(formatDate('2026-10-12'), /Oct/);
  assert.match(formatDate('2026-10-12'), /2026/);
  assert.equal(formatDateDirect('2026-10-12'), formatDate('2026-10-12'));

  const iso = '2026-10-12T15:30:00';
  const expected = new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
  assert.equal(formatDate(iso), expected);

  assert.equal(formatDate(''), '—');
  assert.equal(formatDate(null), '—');
  assert.equal(formatDate('not-a-date'), '—');
  assert.equal(formatDate('2026-02-31'), '—');
  assert.equal(formatDateTime('garbage'), '—');
  assert.equal(typeof formatDateTime('2026-10-12T10:00:00Z'), 'string');
});

test('C4. splitTax halves always sum to the tax', () => {
  for (const tax of [0, 0.01, 0.03, 1, 10.01, 33.33, 99.99, 180, 1234.57]) {
    const [a, b] = splitTax(tax);
    const rounded = Math.round(tax * 100) / 100;
    assert.equal(Math.round((a + b) * 100), Math.round(rounded * 100), `tax ${tax}`);
    assert.equal(a, Math.round(a * 100) / 100);
    assert.equal(b, Math.round(b * 100) / 100);
  }
  assert.deepEqual(splitTax(180), [90, 90]);
  const [c, s] = splitTax(0.01);
  assert.equal(Math.round((c + s) * 100), 1);
});

test('C6. allocateDiscount spreads discount proportionally and sums exactly', () => {
  const parts = allocateDiscount([100, 200, 300], 100);
  assert.equal(parts.length, 3);
  assert.equal(Math.round(parts.reduce((s, p) => s + p, 0) * 100), 10000);
  assert.equal(parts[0], 16.67);
  assert.equal(parts[1], 33.33);
  assert.equal(parts[2], 50);

  const odd = allocateDiscount([33.33, 33.33, 33.34], 10.01);
  assert.equal(Math.round(odd.reduce((s, p) => s + p, 0) * 100), 1001);
  assert.deepEqual(allocateDiscount([100, 200], 0), [0, 0]);
  assert.deepEqual(allocateDiscount([], 50), []);
});

test('C2/C3. PDF generators tolerate missing / string amounts and express charges', () => {
  const order = {
    id: 'ord-x',
    type: 'pieces',
    items: [
      { unitPrice: '100', quantity: '2', addons: [{ name: 'Starch', price: '10' }] },
      { name: 'Coat', unitPrice: 300 },
    ],
    grossAmount: '520',
    discountAmount: '20',
    expressAmount: 125,
    taxAmount: undefined,
    totalAmount: 0,
  };
  const thermal = generateThermalReceiptPdf({ order, customer: {}, settings: {} });
  assert.ok(thermal.output('blob').size > 500);

  const standard = generateStandardInvoicePdf({ order, customer: {}, settings: {} });
  assert.ok(standard.output('blob').size > 500);

  const weight = generateThermalReceiptPdf({ order: { type: 'weight' }, customer: null, settings: null });
  assert.ok(weight);
  const weightStd = generateStandardInvoicePdf({ order: { type: 'weight' }, customer: null, settings: null });
  assert.ok(weightStd);
});
