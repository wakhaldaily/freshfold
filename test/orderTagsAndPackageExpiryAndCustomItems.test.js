import test from 'node:test';
import assert from 'node:assert/strict';
import { formatDate, formatTagDate } from '../src/lib/dateFormat.js';
import { priceOrder, resolveOrderPackageInfo } from '../src/lib/orderPricing.js';
import { getCustomerTagId, getServiceCode } from '../src/lib/orderNumbers.js';
import { createOrder, updateOrder, assignPackage } from '../src/lib/persistence.js';

test('1. Package Expiry Date Formatting (DD MMM YYYY)', () => {
  // Test exact date formatting: Day, Month (3 letters), Year (4 digits)
  assert.equal(formatDate('2027-01-26'), '26 Jan 2027');
  assert.equal(formatDate('2026-09-17'), '17 Sep 2026');
  assert.equal(formatDate('2026-10-31'), '31 Oct 2026');

  // Verify resolveOrderPackageInfo formats expiry correctly
  const pkgWithExpiry = {
    id: 'cp-1',
    customerId: 'cust-1',
    name: 'Half Price Package. (2022)',
    kind: 'discount',
    expiresAt: '2027-01-26',
    status: 'active',
  };
  const pkgLifetime = {
    id: 'cp-2',
    customerId: 'cust-1',
    name: 'Fresh Club Lifetime',
    kind: 'discount',
    expiresAt: null,
    status: 'active',
  };

  const infoExpiry = resolveOrderPackageInfo({ customerId: 'cust-1', discountName: 'Half Price Package. (2022)' }, { id: 'cust-1' }, [pkgWithExpiry]);
  assert.equal(infoExpiry.name, 'Half Price Package. (2022)');
  assert.equal(infoExpiry.validTill, '26 Jan 2027');
  assert.equal(infoExpiry.consumed, '0.00');
  assert.equal(infoExpiry.balance, '0');

  const infoLifetime = resolveOrderPackageInfo({ customerId: 'cust-1', discountName: 'Fresh Club Lifetime' }, { id: 'cust-1' }, [pkgLifetime]);
  assert.equal(infoLifetime.validTill, null); // Lifetime packages do not show validity
});

test('2. Custom Item Not in Catalog Pricing & Functionality', () => {
  // A brand new item not in garmentCatalog
  const customItem = {
    id: 'custom-12345',
    name: 'Silk Cushion Cover Heavy Zari',
    category: 'Household',
    service: 'Dry cleaning',
    unitPrice: 250,
    quantity: 2,
    isCustom: true,
    brand: 'CustomBrand',
    color: 'Maroon',
    panels: 4,
  };

  const priced = priceOrder({
    type: 'pieces',
    service: 'Dry cleaning',
    items: [customItem],
  });

  assert.equal(priced.items.length, 1);
  assert.equal(priced.items[0].name, 'Silk Cushion Cover Heavy Zari');
  assert.equal(priced.items[0].category, 'Household');
  assert.equal(priced.items[0].unitPrice, 250);
  assert.equal(priced.items[0].quantity, 2);
  assert.equal(priced.items[0].brand, 'CustomBrand');
  assert.equal(priced.items[0].color, 'Maroon');
  assert.equal(priced.items[0].panels, 4);
  assert.equal(priced.grossAmount, 500); // 250 * 2 = 500

  // Dimension-based custom item (e.g. Custom Carpet / Curtains: 5 ft x 4 ft @ ₹30/sq.ft)
  const dimensionCustomItem = {
    id: 'custom-carpet-1',
    name: 'Custom Persian Runner',
    category: 'Household',
    service: 'Dry cleaning',
    unitPrice: 30, // rate per sq.ft
    isDimensionBased: true,
    length: 5,
    width: 4,
    quantity: 1,
    isCustom: true,
  };

  const pricedDim = priceOrder({
    type: 'pieces',
    service: 'Dry cleaning',
    items: [dimensionCustomItem],
  });

  assert.equal(pricedDim.items[0].sqFt, 20); // 5 * 4 = 20 sq.ft
  assert.equal(pricedDim.items[0].unitPrice, 600); // 20 * 30 = 600
  assert.equal(pricedDim.grossAmount, 600);
});

test('3. Garment Tag Format & Helpers (Image 2 Match)', () => {
  // Test Tag Delivery Date format: "31 Oct 26 Sat"
  assert.equal(formatTagDate('2026-10-31'), '31 Oct 26 Sat');
  assert.equal(formatTagDate('2026-09-17'), '17 Sep 26 Thu');

  // Test Customer ID formatting
  assert.equal(getCustomerTagId({ customerCode: 'CC01' }), 'CC01');
  assert.equal(getCustomerTagId({ code: 'VIP-07' }), 'VIP-07');
  assert.equal(getCustomerTagId({ id: 'cust-meenakshi' }), 'CCME');

  // Test Service Code derivation
  assert.equal(getServiceCode('Dry cleaning'), 'DC');
  assert.equal(getServiceCode('Premium laundry'), 'PL');
  assert.equal(getServiceCode('Steam press'), 'SI');
  assert.equal(getServiceCode('Wash and Fold'), 'WF');
  assert.equal(getServiceCode('Curtains with Lining'), 'DC');
});

test('4. Credit Balance Deduction, Consumed & Remaining in Bills and Profile', async () => {
  const initialData = {
    settings: { taxEnabled: false, taxPercent: 0 },
    customers: [
      {
        id: 'cust-credit-test',
        name: 'Meenakshi Tyagi',
        customerCode: 'CC01',
        mobile: '9876543210',
        walletBalance: 0,
      },
    ],
    customerPackages: [],
    orders: [],
    payments: [],
    walletTransactions: [],
    packages: [
      {
        id: 'wallet-gold',
        name: 'Gold Wallet Package',
        kind: 'wallet',
        price: 2000,
        walletCredit: 2000,
        durationDays: 365,
      },
    ],
  };

  // 1. Assign wallet package with ₹2,000 credit
  const afterAssign = await assignPackage('cust-credit-test', 'wallet-gold', 'cash', initialData);
  const custAfterPkg = afterAssign.customers.find((c) => c.id === 'cust-credit-test');
  assert.equal(custAfterPkg.walletBalance, 2000);

  const pkgAfterEnroll = afterAssign.customerPackages[0];
  assert.equal(pkgAfterEnroll.walletCredit, 2000);
  assert.equal(pkgAfterEnroll.remainingCredit, 2000);

  // 2. Customer places Order 1 for ₹600
  const order1Input = {
    customerId: 'cust-credit-test',
    orderNo: 'R1741 H',
    type: 'pieces',
    service: 'Dry cleaning',
    items: [
      {
        id: 'custom-suit',
        name: 'Designer Suit',
        category: 'Women',
        service: 'Dry cleaning',
        unitPrice: 600,
        quantity: 1,
        isCustom: true,
      },
    ],
    dueDate: '2026-10-31',
  };

  const afterOrder1 = await createOrder(order1Input, afterAssign);
  const placedOrder1 = afterOrder1.orders[0];
  assert.equal(placedOrder1.totalAmount, 600);
  assert.equal(placedOrder1.paidAmount, 600); // Fully paid via wallet credits
  assert.equal(placedOrder1.balanceAmount, 0);

  // Verify wallet deduction from customer
  const custAfterOrder1 = afterOrder1.customers.find((c) => c.id === 'cust-credit-test');
  assert.equal(custAfterOrder1.walletBalance, 1400);

  // Verify package credits updated
  const pkgAfterOrder1 = afterOrder1.customerPackages.find((cp) => cp.customerId === 'cust-credit-test');
  assert.equal(pkgAfterOrder1.remainingCredit, 1400);

  // Verify package with durationDays (e.g. 90 days validity from startsAt)
  const pkgWithDuration = {
    id: 'pkg-dur-1',
    customerId: 'cust-1',
    name: 'Quarterly Package',
    startsAt: '2026-01-01',
    durationDays: 90,
  };
  const infoDuration = resolveOrderPackageInfo({ customerId: 'cust-1' }, { id: 'cust-1' }, [pkgWithDuration]);
  assert.equal(infoDuration.name, 'Quarterly Package');
  assert.equal(infoDuration.validTill, '01 Apr 2026');

  // Verify bill packageInfo: Consumed (this order) = 600.00, Balance = 1400
  const billInfo1 = resolveOrderPackageInfo(placedOrder1, custAfterOrder1, afterOrder1.customerPackages);
  assert.equal(billInfo1.consumed, '600.00');
  assert.equal(billInfo1.balance, '1400');
  assert.match(billInfo1.validTill, /^\d{2} [A-Za-z]{3} \d{4}$/); // Shows exact date DD MMM YYYY

  // 3. Edit Order 1: Increase quantity from 1 to 2 (total becomes ₹1,200)
  const order1EditInput = {
    ...placedOrder1,
    grossAmount: 1200,
    items: [
      {
        id: 'custom-suit',
        name: 'Designer Suit',
        category: 'Women',
        service: 'Dry cleaning',
        unitPrice: 600,
        quantity: 2,
        isCustom: true,
      },
    ],
  };

  const afterEdit = await updateOrder(placedOrder1.id, order1EditInput, afterOrder1);
  const updatedOrder1 = afterEdit.orders.find((o) => o.id === placedOrder1.id);
  assert.equal(updatedOrder1.totalAmount, 1200);
  assert.equal(updatedOrder1.paidAmount, 1200);

  const custAfterEdit = afterEdit.customers.find((c) => c.id === 'cust-credit-test');
  assert.equal(custAfterEdit.walletBalance, 800); // 2000 - 1200 = 800

  const pkgAfterEdit = afterEdit.customerPackages.find((cp) => cp.customerId === 'cust-credit-test');
  assert.equal(pkgAfterEdit.remainingCredit, 800);

  // Verify updated bill shows consumed ₹1200.00 and remaining balance 800
  const billInfoEdited = resolveOrderPackageInfo(updatedOrder1, custAfterEdit, afterEdit.customerPackages);
  assert.equal(billInfoEdited.consumed, '1200.00');
  assert.equal(billInfoEdited.balance, '800');
});
