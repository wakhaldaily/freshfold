import test from 'node:test';
import assert from 'node:assert/strict';

import {
  evaluatePackageDiscount,
  findBestPackageDiscount,
  isGarmentEligible,
  normalizePackageRules,
} from '../src/lib/packageDiscountEngine.js';

import { initialPackageCatalog, garmentCatalog } from '../src/data.js';

test('1. Wallet Packages (Gold, Diamond, Platinum) functionality', () => {
  const gold = initialPackageCatalog.find((p) => p.id === 'gold-pkg');
  const diamond = initialPackageCatalog.find((p) => p.id === 'diamond-pkg');
  const platinum = initialPackageCatalog.find((p) => p.id === 'platinum-pkg');

  assert.ok(gold, 'Gold package exists');
  assert.equal(gold.kind, 'wallet');
  assert.equal(gold.price, 3000);
  assert.equal(gold.walletCredit, 4000);

  assert.ok(diamond, 'Diamond package exists');
  assert.equal(diamond.kind, 'wallet');
  assert.equal(diamond.price, 7500);
  assert.equal(diamond.walletCredit, 10000);

  assert.ok(platinum, 'Platinum package exists');
  assert.equal(platinum.kind, 'wallet');
  assert.equal(platinum.price, 15000);
  assert.equal(platinum.walletCredit, 20500);

  // Evaluates as wallet balance at checkout, not a line-item bill discount
  const cartContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 125, quantity: 2 }],
    grossAmount: 250,
  };

  const evalGold = evaluatePackageDiscount(gold, cartContext);
  assert.equal(evalGold.applicable, false);
  assert.equal(evalGold.discountAmount, 0);
  assert.match(evalGold.reason, /wallet/i);
});

test('2. Half Price Package follows description (50% discount Dry Cleaning per piece)', () => {
  const halfPrice = initialPackageCatalog.find((p) => p.id === 'half-price-pkg');
  assert.ok(halfPrice, 'Half Price package exists');

  // Case A: Dry cleaning pieces order -> MUST get 50% discount
  const dryCleanPiecesContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 125, quantity: 2 }, // 250
      { id: 'm-suit-2pc', name: 'Suit 2 Pcs', category: 'Men', unitPrice: 400, quantity: 1 }, // 400
    ],
    grossAmount: 650,
  };
  const evalDryClean = evaluatePackageDiscount(halfPrice, dryCleanPiecesContext);
  assert.equal(evalDryClean.applicable, true, 'Should be applicable to Dry cleaning pieces');
  assert.equal(evalDryClean.discountAmount, 325, 'Should be 50% of 650 = 325');
  assert.equal(evalDryClean.discountPercent, 50);

  // Case B: Steam press pieces order -> MUST NOT get discount (description: "Dry Cleaning per piece")
  const steamPressContext = {
    orderType: 'pieces',
    service: 'Steam press',
    items: [
      { id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 55, quantity: 2 },
    ],
    grossAmount: 110,
  };
  const evalSteamPress = evaluatePackageDiscount(halfPrice, steamPressContext);
  assert.equal(evalSteamPress.applicable, false, 'Must NOT apply to Steam press');
  assert.equal(evalSteamPress.discountAmount, 0);
  assert.match(evalSteamPress.reason, /Dry cleaning/i);

  // Case C: Weight order (Wash and fold) -> MUST NOT get discount (description: "per piece")
  const weightContext = {
    orderType: 'weight',
    service: 'Wash and Fold',
    weightKg: 5,
    grossAmount: 450,
  };
  const evalWeight = evaluatePackageDiscount(halfPrice, weightContext);
  assert.equal(evalWeight.applicable, false, 'Must NOT apply to Weight orders');
  assert.equal(evalWeight.discountAmount, 0);
  assert.match(evalWeight.reason, /piece/i);
});

test('3. Winter Dry Cleaning Special follows description (Pay for 5 Sweaters, Get 6th Free)', () => {
  const sweaterPkg = initialPackageCatalog.find((p) => p.id === 'winter-sweater-pkg');
  assert.ok(sweaterPkg, 'Winter Sweater package exists');

  // Case A: 5 Sweaters -> Need 6 to get 1 free! Discount should be 0.
  const fiveSweatersContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-sweater-full', name: 'Sweater Full', category: 'Men', unitPrice: 250, quantity: 5 },
    ],
    grossAmount: 1250,
  };
  const eval5 = evaluatePackageDiscount(sweaterPkg, fiveSweatersContext);
  assert.equal(eval5.applicable, false, '5 sweaters is not enough for buy 5 get 1 free');
  assert.equal(eval5.discountAmount, 0);
  assert.match(eval5.reason, /at least 6/i);

  // Case B: 6 Sweaters @ 250 each = 1,500. Exactly 1 sweater MUST BE FREE (discount = 250)
  const sixSweatersContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-sweater-full', name: 'Sweater Full', category: 'Men', unitPrice: 250, quantity: 6 },
    ],
    grossAmount: 1500,
  };
  const eval6 = evaluatePackageDiscount(sweaterPkg, sixSweatersContext);
  assert.equal(eval6.applicable, true, '6 sweaters qualifies for 1 free sweater');
  assert.equal(eval6.discountAmount, 250, '1 sweater (250) should be free');
  assert.equal(eval6.freeItemsCount, 1);
  assert.match(eval6.explanation, /1 free item/i);

  // Case C: 12 Sweaters (e.g. 6 men sweaters @ 250, 6 women sweaters @ 230) -> Exactly 2 sweaters free!
  const twelveSweatersContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-sweater-full', name: 'Sweater Full', category: 'Men', unitPrice: 250, quantity: 6 }, // 1500
      { id: 'w-sweater-full', name: 'Sweater Full', category: 'Women', unitPrice: 230, quantity: 6 }, // 1380
    ],
    grossAmount: 2880,
  };
  const eval12 = evaluatePackageDiscount(sweaterPkg, twelveSweatersContext);
  assert.equal(eval12.applicable, true);
  assert.equal(eval12.freeItemsCount, 2, '2 sweaters should be free for 12 sweaters');
  assert.equal(eval12.discountAmount, 460, 'Lowest priced 2 sweaters (230 x 2 = 460) free');

  // Case D: 6 Shirts (NOT sweaters) -> 0 discount
  const shirtsContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 125, quantity: 6 },
    ],
    grossAmount: 750,
  };
  const evalShirts = evaluatePackageDiscount(sweaterPkg, shirtsContext);
  assert.equal(evalShirts.applicable, false);
  assert.equal(evalShirts.discountAmount, 0);

  // Case E: 6 Sweaters + 2 Shirts -> exactly 1 sweater free, shirts unaffected
  const mixedContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-sweater-full', name: 'Sweater Full', category: 'Men', unitPrice: 250, quantity: 6 }, // 1500
      { id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 125, quantity: 2 }, // 250
    ],
    grossAmount: 1750,
  };
  const evalMixed = evaluatePackageDiscount(sweaterPkg, mixedContext);
  assert.equal(evalMixed.applicable, true);
  assert.equal(evalMixed.discountAmount, 250, 'Only the 6th sweater is free');
  assert.equal(evalMixed.freeItemsCount, 1);
});

test('4. 2 Double Blanket Offer follows description (2 Double Blanket 25% Off)', () => {
  const blanketPkg = initialPackageCatalog.find((p) => p.id === 'double-blanket-pkg');
  assert.ok(blanketPkg, 'Double blanket package exists');

  // Case A: 1 Double Blanket -> Min 2 required, so 0 discount
  const oneBlanketContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'h-blanket-double', name: 'Blanket Double', category: 'Household', unitPrice: 500, quantity: 1 },
    ],
    grossAmount: 500,
  };
  const eval1 = evaluatePackageDiscount(blanketPkg, oneBlanketContext);
  assert.equal(eval1.applicable, false, '1 blanket does not meet minimum 2');
  assert.equal(eval1.discountAmount, 0);
  assert.match(eval1.reason, /at least 2/i);

  // Case B: 2 Double Blankets @ 500 each = 1,000 -> 25% discount = 250
  const twoBlanketsContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'h-blanket-double', name: 'Blanket Double', category: 'Household', unitPrice: 500, quantity: 2 },
    ],
    grossAmount: 1000,
  };
  const eval2 = evaluatePackageDiscount(blanketPkg, twoBlanketsContext);
  assert.equal(eval2.applicable, true);
  assert.equal(eval2.discountAmount, 250, '25% of 1000 = 250');
  assert.equal(eval2.discountPercent, 25);

  // Case C: 2 Double Blankets (1000) + 1 Coat (300) = Gross 1300 -> 25% discount ONLY on the 2 blankets = 250
  const mixedBlanketContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'h-blanket-double', name: 'Blanket Double', category: 'Household', unitPrice: 500, quantity: 2 }, // 1000
      { id: 'm-coat', name: 'Coat', category: 'Men', unitPrice: 300, quantity: 1 }, // 300
    ],
    grossAmount: 1300,
  };
  const evalMixed = evaluatePackageDiscount(blanketPkg, mixedBlanketContext);
  assert.equal(evalMixed.applicable, true);
  assert.equal(evalMixed.discountAmount, 250, 'Discount must only apply to qualifying double blankets');
});

test('5. Adding new customized package for certain clothes / category / offer works seamlessly', () => {
  // Test A: Package customized for "Kids" category (Flat 35% off on Kids clothes)
  const kidsPkg = {
    id: 'custom-kids-pkg',
    name: 'Kids Festival Special',
    description: '35% off on all Kids wear per piece',
    kind: 'discount',
    price: 999,
    discountPercent: 35,
    applicableService: 'all',
    applicableOrderType: 'pieces',
    applicableCategory: 'Kids',
    targetGarments: [],
  };

  const kidsContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'k-jacket', name: 'Jacket', category: 'Kids', unitPrice: 150, quantity: 2 }, // 300 (Kids)
      { id: 'm-pant', name: 'Pant', category: 'Men', unitPrice: 170, quantity: 1 }, // 170 (Men)
    ],
    grossAmount: 470,
  };

  const evalKids = evaluatePackageDiscount(kidsPkg, kidsContext);
  assert.equal(evalKids.applicable, true);
  assert.equal(evalKids.discountAmount, 105, '35% of 300 kids clothes = 105');

  // Test B: Package customized for specific clothes: "Suit Master Plan: 40% off Suits"
  const suitPkg = {
    id: 'custom-suit-pkg',
    name: 'Executive Suit Club',
    description: '40% off on all 2-pc and 3-pc suits',
    kind: 'discount',
    price: 2500,
    discountPercent: 40,
    applicableService: 'Dry cleaning',
    applicableOrderType: 'pieces',
    targetGarments: ['m-suit-2pc', 'm-suit-3pc', 'w-suit-2pc', 'w-suit-3pc'],
  };

  const suitContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-suit-2pc', name: 'Suit 2 Pcs', category: 'Men', unitPrice: 400, quantity: 1 }, // 400
      { id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 125, quantity: 2 }, // 250
    ],
    grossAmount: 650,
  };

  const evalSuit = evaluatePackageDiscount(suitPkg, suitContext);
  assert.equal(evalSuit.applicable, true);
  assert.equal(evalSuit.discountAmount, 160, '40% of 400 suit = 160');

  // Test C: Custom "Buy 2 Get 1 Free on Silk Sarees"
  const sareePkg = {
    id: 'custom-saree-b2g1',
    name: 'Silk Saree Bonanza',
    description: 'Buy 2 Silk Sarees, Get the 3rd Free',
    kind: 'buy_x_get_y',
    price: 1200,
    buyQty: 2,
    freeQty: 1,
    minQty: 3,
    applicableOrderType: 'pieces',
    targetGarments: ['w-saree-silk', 'w-saree-normal', 'w-saree-embroidered'],
  };

  const sareeContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'w-saree-silk', name: 'Saree Silk', category: 'Women', unitPrice: 310, quantity: 3 },
    ],
    grossAmount: 930,
  };

  const evalSaree = evaluatePackageDiscount(sareePkg, sareeContext);
  assert.equal(evalSaree.applicable, true);
  assert.equal(evalSaree.discountAmount, 310, '1 saree (310) free');
  assert.equal(evalSaree.freeItemsCount, 1);
});

test('6. findBestPackageDiscount selects highest saving package for customer', () => {
  const customerPackages = [
    {
      id: 'cp-1',
      templateId: 'half-price-pkg',
      name: 'Half Price Package',
      status: 'active',
      kind: 'discount',
      discountPercent: 50,
      applicableService: 'Dry cleaning',
      applicableOrderType: 'pieces',
    },
    {
      id: 'cp-2',
      templateId: 'winter-sweater-pkg',
      name: 'Winter Dry Cleaning Special',
      status: 'active',
      kind: 'buy_x_get_y',
      buyQty: 5,
      freeQty: 1,
      minQty: 6,
      applicableService: 'Dry cleaning',
      applicableOrderType: 'pieces',
      targetKeywords: ['sweater'],
    },
  ];

  // Cart with 6 sweaters @ 250 = 1500
  // Half price package gives 50% = 750 savings
  // Sweater package gives 1 free = 250 savings
  // Engine should select Half Price package as bestDiscount
  const context = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [
      { id: 'm-sweater-full', name: 'Sweater Full', category: 'Men', unitPrice: 250, quantity: 6 },
    ],
    grossAmount: 1500,
  };

  const { bestDiscount, allEvaluations } = findBestPackageDiscount(customerPackages, context, initialPackageCatalog);
  assert.ok(bestDiscount, 'Best discount found');
  assert.equal(bestDiscount.package.id, 'cp-1');
  assert.equal(bestDiscount.discountAmount, 750);
  assert.equal(allEvaluations.length, 2);
});

test('7. End-to-end package assignment and order creation flow', async () => {
  const {
    createCustomer,
    createPackage,
    assignPackage,
    createOrder,
    recordPayment,
  } = await import('../src/lib/persistence.js');
  const { createInitialData } = await import('../src/data.js');

  let store = createInitialData();

  // A. Create customer
  store = await createCustomer({ name: 'Vikram Singh', mobile: '9888877771' }, store);
  const customer = store.customers.find((c) => c.mobile === '9888877771');
  assert.ok(customer);
  assert.equal(customer.walletBalance, 0);

  // B. Sell Gold Package (₹3,000 for ₹4,000 credit)
  store = await assignPackage(customer.id, 'gold-pkg', 'upi', store);
  const updatedCust = store.customers.find((c) => c.id === customer.id);
  assert.equal(updatedCust.walletBalance, 4000, 'Customer should receive 4000 wallet credit');

  // C. Place order and pay via wallet
  store = await createOrder({
    customerId: customer.id,
    type: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 125, quantity: 2 }],
    grossAmount: 250,
    discountAmount: 0,
    discountPercent: 0,
    discountName: '',
  }, store);

  const placedOrder = store.orders[0];
  assert.ok(placedOrder);
  // Auto-deducted immediately upon order placement from customer's Gold Package wallet credit!
  assert.equal(placedOrder.balanceAmount, 0, 'Balance cleared automatically from wallet');
  assert.equal(placedOrder.paidAmount, placedOrder.totalAmount, 'Paid amount matches total amount');

  const custAfterPay = store.customers.find((c) => c.id === customer.id);
  assert.equal(custAfterPay.walletBalance, 4000 - placedOrder.totalAmount, 'Wallet balance immediately debited');
  assert.ok(store.payments.some((p) => p.orderId === placedOrder.id && p.method === 'wallet'));
  assert.ok(store.walletTransactions.some((wt) => wt.orderId === placedOrder.id && wt.kind === 'debit'));
});

test('8. End-to-end custom package creation, assignment, and order verification', async () => {
  const {
    createCustomer,
    createPackage,
    assignPackage,
    createOrder,
  } = await import('../src/lib/persistence.js');
  const { createInitialData } = await import('../src/data.js');

  let store = createInitialData();

  // Create a custom package: "3 Shirts Dry Cleaning Special: Flat 30% off on Shirts"
  store = await createPackage({
    name: '3 Shirts Dry Cleaning Special',
    description: '30% off on Shirts for dry cleaning',
    kind: 'discount',
    price: 500,
    discountPercent: 30,
    applicableService: 'Dry cleaning',
    applicableOrderType: 'pieces',
    targetKeywords: ['shirt'],
    minQty: 3,
  }, store);

  const customPkg = store.packages.find((p) => p.name === '3 Shirts Dry Cleaning Special');
  assert.ok(customPkg, 'Custom package created');
  assert.equal(customPkg.discountPercent, 30);
  assert.equal(customPkg.minQty, 3);

  // Assign to customer
  const customerId = store.customers[0].id;
  store = await assignPackage(customerId, customPkg.id, 'cash', store);

  const assigned = store.customerPackages.find((cp) => cp.templateId === customPkg.id && cp.customerId === customerId);
  assert.ok(assigned, 'Custom package assigned to customer');
  assert.equal(assigned.minQty, 3);
  assert.deepEqual(assigned.targetKeywords, ['shirt']);

  // Cart with 3 shirts (125 x 3 = 375) in Dry cleaning
  const cartContext = {
    orderType: 'pieces',
    service: 'Dry cleaning',
    items: [{ id: 'm-shirt', name: 'Shirt', category: 'Men', unitPrice: 125, quantity: 3 }],
    grossAmount: 375,
  };

  const { bestDiscount } = findBestPackageDiscount([assigned], cartContext, store.packages);
  assert.ok(bestDiscount, 'Should match customer package');
  assert.equal(bestDiscount.discountAmount, 112.5, '30% of 375 = 112.5');

  // Place order with the evaluated discount
  store = await createOrder({
    customerId,
    type: 'pieces',
    service: 'Dry cleaning',
    items: cartContext.items,
    grossAmount: 375,
    discountAmount: bestDiscount.discountAmount,
    discountPercent: bestDiscount.discountPercent,
    discountName: bestDiscount.discountName,
  }, store);

  const newOrder = store.orders[0];
  assert.equal(newOrder.discountAmount, 112.5);
  assert.equal(newOrder.discountName, '3 Shirts Dry Cleaning Special');
});
