/**
 * Shared order pricing used by the POS register (live preview), local browser mode,
 * and the Cloudflare Worker (authoritative server-side pricing).
 *
 * All money math is done in integer paise and converted back to rupees at the edges,
 * so totals never drift because of floating point rounding.
 */
import {
  defaultSettings,
  garmentCatalog,
  initialAddons,
  initialPackageCatalog,
  isCarpetItem,
  services,
  weightServices,
} from '../data.js';
import { findBestPackageDiscount } from './packageDiscountEngine.js';
import { formatDate } from './dateFormat.js';

export const MAX_ITEM_QUANTITY = 500;
export const MAX_WEIGHT_KG = 1000;

export class PricingError extends Error {
  constructor(message) {
    super(message);
    this.name = 'PricingError';
  }
}

/** Converts rupees to integer paise (half-up, safe for values like 1.005). */
export function toPaise(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return 0;
  return Math.round(Number(`${n}e2`)) || 0;
}

export function fromPaise(paise) {
  return Math.round(paise) / 100;
}

export function roundMoney(value) {
  return fromPaise(toPaise(value));
}

/**
 * Formats a numeric string or number into Indian numbering format (e.g. 1,000, 10,000, 1,00,000.50).
 * Preserves trailing decimal dots while typing (e.g., "1,000." -> "1,000.").
 */
export function formatIndianCurrencyString(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/,/g, '').trim();
  if (str === '') return '';

  const hasMinus = str.startsWith('-');
  const unsigned = hasMinus ? str.slice(1) : str;

  const parts = unsigned.split('.');
  const integerPart = parts[0];
  const decimalPart = parts.length > 1 ? '.' + parts[1].slice(0, 2) : '';

  const digits = integerPart.replace(/\D/g, '');
  if (!digits && !decimalPart) return '';

  let formattedInteger = '';
  if (digits) {
    if (digits.length <= 3) {
      formattedInteger = digits;
    } else {
      const lastThree = digits.slice(-3);
      const remaining = digits.slice(0, -3);
      const groupedRemaining = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ',');
      formattedInteger = groupedRemaining + ',' + lastThree;
    }
  } else if (decimalPart) {
    formattedInteger = '0';
  }

  return (hasMinus ? '-' : '') + formattedInteger + decimalPart;
}

function clamp(value, min, max) {
  const n = Number(value);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

const garmentById = new Map(garmentCatalog.map((g) => [g.id, g]));

/** Per-kg rates for every service that can be billed by weight. */
export const kgRates = Object.fromEntries([
  ...services.map((s) => [s.label, s.ratePerKg]),
  ...weightServices.map((s) => [s.label, s.ratePerKg]),
]);

export const pieceServiceLabels = services.map((s) => s.label);

/** Rate-list tier discount configured on the customer profile. */
export function getTierDiscountPercent(customer) {
  const tier = customer?.rateList;
  if (tier === 'Student Discount') return 15;
  if (tier === 'Corporate / B2B') return 10;
  return 0;
}

/** Larger of the explicit customer discount and their rate-list tier discount (0-100). */
export function getCustomerBaseDiscountPercent(customer) {
  if (!customer) return 0;
  const explicit = clamp(customer.discountPercent || 0, 0, 100);
  return Math.max(explicit, getTierDiscountPercent(customer));
}

/**
 * Picks the discount that benefits the customer most: the best package discount
 * or the customer's base (tier/profile) discount. Ties go to the package.
 */
export function pickOrderDiscount({ bestDiscount, grossAmount, customer }) {
  const grossPaise = toPaise(grossAmount);
  const pkgPaise = bestDiscount ? Math.min(grossPaise, Math.max(0, toPaise(bestDiscount.discountAmount))) : 0;
  const basePercent = getCustomerBaseDiscountPercent(customer);
  const custPaise = basePercent > 0 ? Math.round((grossPaise * basePercent) / 100) : 0;

  if (pkgPaise >= custPaise && pkgPaise > 0) {
    return {
      discountAmount: fromPaise(pkgPaise),
      discountPercent: clamp(bestDiscount.discountPercent || 0, 0, 100),
      discountName: bestDiscount.discountName || '',
    };
  }

  if (custPaise > 0) {
    const tierLabel = customer?.rateList && customer.rateList !== 'Default'
      ? `${customer.rateList} Tier`
      : 'Customer Profile';
    return {
      discountAmount: fromPaise(custPaise),
      discountPercent: basePercent,
      discountName: `${tierLabel} (${basePercent}%)`,
    };
  }

  return { discountAmount: 0, discountPercent: 0, discountName: '' };
}

/**
 * Applies discount -> express surcharge -> tax, in that order.
 * Discount is clamped to [0, gross]; percentages are clamped to [0, 100].
 */
export function computeTotals({
  grossAmount = 0,
  discountAmount = 0,
  expressPercent = 0,
  expressAmount = 0,
  taxEnabled = true,
  taxPercent = 0,
  manualCheckoutDiscountPercent = 0,
  manualCheckoutDiscountAmount = 0,
}) {
  const gross = Math.max(0, toPaise(grossAmount));
  const discount = Math.min(gross, Math.max(0, toPaise(discountAmount)));
  const subtotalBeforeExpress = gross - discount;

  const exPercent = clamp(expressPercent || 0, 0, 100);
  const express = exPercent > 0
    ? Math.round((subtotalBeforeExpress * exPercent) / 100)
    : Math.max(0, toPaise(expressAmount));

  const taxableSubtotal = subtotalBeforeExpress + express;
  const effectiveTaxPercent = taxEnabled ? clamp(taxPercent || 0, 0, 100) : 0;
  const tax = Math.round((taxableSubtotal * effectiveTaxPercent) / 100);

  let totalPaise = taxableSubtotal + tax;
  const manualPct = Math.round(clamp(manualCheckoutDiscountPercent || 0, 0, 100));
  let manualAmtPaise = 0;
  if (manualPct > 0) {
    manualAmtPaise = Math.round((totalPaise * manualPct) / 100);
  } else {
    manualAmtPaise = Math.max(0, toPaise(manualCheckoutDiscountAmount));
  }
  if (manualAmtPaise > totalPaise) manualAmtPaise = totalPaise;
  totalPaise = Math.max(0, totalPaise - manualAmtPaise);

  // Ceil / Roundup overall total amount to the nearest whole rupee (e.g. 21.25 -> 22, 30.01 -> 31)
  if (totalPaise > 0) {
    const roundedRupees = Math.ceil(totalPaise / 100);
    totalPaise = roundedRupees * 100;
  }

  return {
    grossAmount: fromPaise(gross),
    discountAmount: fromPaise(discount),
    subtotalBeforeExpress: fromPaise(subtotalBeforeExpress),
    expressPercent: exPercent,
    expressAmount: fromPaise(express),
    taxableSubtotal: fromPaise(taxableSubtotal),
    taxEnabled: Boolean(taxEnabled),
    taxPercent: effectiveTaxPercent,
    taxAmount: fromPaise(tax),
    manualCheckoutDiscountPercent: manualPct,
    manualCheckoutDiscountAmount: fromPaise(manualAmtPaise),
    totalAmount: fromPaise(totalPaise),
  };
}

/** Merges stored package templates with the built-in catalog defaults and stored rules. */
export function mergePackageTemplates(templates = []) {
  const list = Array.isArray(templates) && templates.length ? templates : initialPackageCatalog;
  return list.map((pkg) => {
    const defaults = initialPackageCatalog.find((d) => d.id === pkg.id) || {};
    const rules = pkg.rules && typeof pkg.rules === 'object' ? pkg.rules : {};
    return { ...defaults, ...pkg, ...rules };
  });
}

/** Resolves an add-on against the catalog by id, then by name (case-insensitive). */
export function resolveAddon(addon, addonCatalog = initialAddons) {
  if (!addon) return null;
  const catalog = Array.isArray(addonCatalog) && addonCatalog.length ? addonCatalog : initialAddons;
  const byId = addon.id ? catalog.find((a) => a.id === addon.id) : null;
  const name = String(addon.name || '').trim().toLowerCase();
  const match = byId || (name ? catalog.find((a) => String(a.name || '').trim().toLowerCase() === name) : null);
  if (!match) return null;
  const price = Number(match.price);
  if (!Number.isFinite(price) || price < 0) return null;
  return { id: match.id, name: match.name, price: roundMoney(price) };
}

function cleanText(value, max = 200) {
  return String(value ?? '').trim().slice(0, max);
}

function cleanTextList(list, maxItems = 20) {
  return (Array.isArray(list) ? list : []).map((v) => cleanText(v, 80)).filter(Boolean).slice(0, maxItems);
}

function priceAddons(addons, addonCatalog) {
  return (Array.isArray(addons) ? addons : []).slice(0, 20).map((addon) => {
    const resolved = resolveAddon(addon, addonCatalog);
    if (!resolved) throw new PricingError(`Add-on "${cleanText(addon?.name || addon?.id, 60)}" is not in the store catalog.`);
    return resolved;
  });
}

/**
 * Prices an order entirely from the catalog. Client-supplied prices, discounts and
 * tax figures are ignored. Throws PricingError for anything that can't be priced.
 */
export function priceOrder(input = {}, context = {}) {
  const {
    customer = null,
    customerPackages = [],
    packageTemplates = [],
    settings = {},
    addonCatalog = initialAddons,
  } = context;
  const storeSettings = { ...defaultSettings, ...(settings || {}) };
  const orderType = input.type === 'weight' ? 'weight' : 'pieces';

  let items = [];
  let weightKg = 0;
  let weightAddons = [];
  let grossPaise = 0;
  let service = cleanText(input.service || (orderType === 'weight' ? 'Wash and Fold' : 'Dry cleaning'), 60);

  if (orderType === 'weight') {
    weightKg = Number(input.weightKg);
    if (!(weightKg > 0) || weightKg > MAX_WEIGHT_KG) throw new PricingError('Enter a valid weight in kg.');
    const rate = kgRates[service];
    if (!rate) throw new PricingError(`"${service}" can't be billed by weight.`);
    weightKg = Math.round(weightKg * 1000) / 1000;
    const expressPercent = clamp(input.expressPercent || 0, 0, 100);
    const effectiveRate = expressPercent > 0 ? roundMoney(rate * (1 + expressPercent / 100)) : rate;
    const rawCustomRate = input.customWeightRate ?? input.weightRateOverride;
    const customRate = rawCustomRate !== undefined && rawCustomRate !== null && rawCustomRate !== ''
      ? Number(rawCustomRate)
      : null;
    const finalRate = (customRate !== null && Number.isFinite(customRate) && customRate >= 0)
      ? roundMoney(customRate)
      : effectiveRate;
    weightAddons = priceAddons(input.weightAddons, addonCatalog);
    grossPaise = Math.round(weightKg * finalRate * 100) + weightAddons.reduce((sum, a) => sum + toPaise(a.price), 0);
  } else {
    if (!Array.isArray(input.items) || input.items.length === 0) throw new PricingError('Choose at least one garment.');
    if (input.items.length > 200) throw new PricingError('Too many lines in one order.');
    const expressPercent = clamp(input.expressPercent || 0, 0, 100);
    items = input.items.map((raw) => {
      const garment = garmentById.get(raw?.id);
      if (!garment) throw new PricingError(`Unknown garment "${cleanText(raw?.name || raw?.id, 60)}".`);
      const lineService = cleanText(raw.service || service, 60);
      let unitPrice = garment.prices?.[lineService];
      if (unitPrice === null || unitPrice === undefined) {
        const altKey = Object.keys(garment.prices || {}).find((k) => k.toLowerCase() === lineService.toLowerCase());
        if (altKey) unitPrice = garment.prices[altKey];
      }
      if (unitPrice === null || unitPrice === undefined) {
        throw new PricingError(`"${garment.name}" isn't offered for ${lineService}.`);
      }
      const isDimensionBased = isCarpetItem(garment);
      const rawLength = Number(raw.length);
      const rawWidth = Number(raw.width ?? raw.breadth);
      const length = isDimensionBased && Number.isFinite(rawLength) && rawLength > 0 ? Math.round(rawLength * 100) / 100 : null;
      const width = isDimensionBased && Number.isFinite(rawWidth) && rawWidth > 0 ? Math.round(rawWidth * 100) / 100 : null;
      let effectiveUnitPrice = unitPrice;
      let sqFt = null;
      if (isDimensionBased && length && width) {
        sqFt = Math.round((length * width) * 100) / 100;
        effectiveUnitPrice = roundMoney(sqFt * unitPrice);
      }
      const baseUnitPrice = effectiveUnitPrice;
      if (expressPercent > 0) {
        effectiveUnitPrice = roundMoney(effectiveUnitPrice * (1 + expressPercent / 100));
      }
      const rawCustomPrice = raw.customUnitPrice ?? raw.unitPriceOverride;
      const customUnitPrice = rawCustomPrice !== undefined && rawCustomPrice !== null && rawCustomPrice !== ''
        ? Number(rawCustomPrice)
        : null;
      if (customUnitPrice !== null && Number.isFinite(customUnitPrice) && customUnitPrice >= 0) {
        effectiveUnitPrice = roundMoney(customUnitPrice);
      }
      const quantity = Math.floor(Number(raw.quantity));
      if (!(quantity >= 1) || quantity > MAX_ITEM_QUANTITY) {
        throw new PricingError(`Enter a quantity between 1 and ${MAX_ITEM_QUANTITY} for ${garment.name}.`);
      }
      const addons = priceAddons(raw.addons, addonCatalog);
      const addonPaise = addons.reduce((sum, a) => sum + toPaise(a.price), 0);
      grossPaise += (toPaise(effectiveUnitPrice) + addonPaise) * quantity;
      return {
        id: garment.id,
        name: garment.name,
        category: garment.category,
        service: lineService,
        baseUnitPrice: roundMoney(baseUnitPrice),
        unitPrice: roundMoney(effectiveUnitPrice),
        customUnitPrice: (customUnitPrice !== null && Number.isFinite(customUnitPrice) && customUnitPrice >= 0)
          ? roundMoney(customUnitPrice)
          : undefined,
        ratePerSqFt: isDimensionBased ? (expressPercent > 0 ? roundMoney(unitPrice * (1 + expressPercent / 100)) : roundMoney(unitPrice)) : undefined,
        length: length || undefined,
        width: width || undefined,
        breadth: width || undefined,
        sqFt: sqFt || undefined,
        isDimensionBased: isDimensionBased || undefined,
        quantity,
        addons,
        brand: cleanText(raw.brand, 80),
        color: cleanText(raw.color, 80),
        defects: cleanTextList(raw.defects),
        note: cleanText(raw.note, 300),
      };
    });
  }

  const grossAmount = fromPaise(grossPaise);
  const activePackages = (customerPackages || []).filter((cp) => cp.customerId === customer?.id && cp.status === 'active');
  const { bestDiscount, allEvaluations } = findBestPackageDiscount(
    activePackages,
    { orderType, service, items, weightKg, grossAmount },
    mergePackageTemplates(packageTemplates),
  );
  const discount = pickOrderDiscount({ bestDiscount, grossAmount, customer });
  const expressPercent = clamp(input.expressPercent || 0, 0, 100);

  const totals = computeTotals({
    grossAmount,
    discountAmount: discount.discountAmount,
    expressPercent: 0, // delivery turnaround % increases rate of each item, not added to sum total
    expressAmount: 0,
    taxEnabled: storeSettings.taxEnabled ?? true,
    taxPercent: storeSettings.taxPercent ?? 18,
    manualCheckoutDiscountPercent: input.manualCheckoutDiscountPercent,
    manualCheckoutDiscountAmount: input.manualCheckoutDiscountAmount,
  });

  return {
    type: orderType,
    service,
    items,
    weightKg,
    weightAddons,
    discountPercent: discount.discountPercent,
    discountName: discount.discountName,
    expressLabel: expressPercent > 0 ? (input.expressLabel || `Early Delivery (+${expressPercent}%)`) : '',
    evaluations: allEvaluations,
    ...totals,
    expressPercent,
    expressAmount: 0,
  };
}

/** Total discount on an order, combining package discount and manual checkout discount. */
export function getOrderTotalDiscount(order) {
  if (!order) return 0;
  const packageDiscount = Number(order.discountAmount || 0);
  const checkoutDiscount = Number(
    order.manualCheckoutDiscountAmount ??
    (order.manualCheckoutDiscountPercent ? (Number(order.grossAmount || 0) * Number(order.manualCheckoutDiscountPercent)) / 100 : 0)
  );
  return roundMoney(packageDiscount + checkoutDiscount);
}

/**
 * Allocates total discount across order items proportionally to their line amounts.
 * Returns an array of discount amounts matching each item in items.
 */
export function calculateLineDiscounts(items = [], totalDiscount = 0) {
  const list = Array.isArray(items) ? items : [];
  const lineAmounts = list.map((it) => (Number(it.quantity) || 1)
    * ((Number(it.unitPrice) || 0) + (Array.isArray(it.addons) ? it.addons : []).reduce((sum, a) => sum + Number(a?.price || 0), 0)));
  const lineSum = lineAmounts.reduce((a, b) => a + b, 0);
  const allocatable = Math.min(Math.max(0, Number(totalDiscount) || 0), lineSum);
  if (lineAmounts.length === 0 || allocatable <= 0 || lineSum <= 0) {
    return lineAmounts.map(() => 0);
  }
  let allocated = 0;
  return lineAmounts.map((amt, i) => {
    if (i === lineAmounts.length - 1) {
      return roundMoney(allocatable - allocated);
    }
    const share = roundMoney((amt / lineSum) * allocatable);
    allocated = roundMoney(allocated + share);
    return share;
  });
}

/**
 * Resolves package details for bill generation when a customer has a package.
 * Returns { name, consumed, balance, validTill } or null if no package exists.
 */
export function resolveOrderPackageInfo(order, customer, customerPackages = []) {
  if (order?.packageInfo && order.packageInfo.name) {
    const p = order.packageInfo;
    return {
      name: String(p.name || ''),
      consumed: String(p.consumed ?? '0.00'),
      balance: String(p.balance ?? '0'),
      validTill: String(p.validTill || (p.expiresAt ? formatDate(p.expiresAt) : 'Lifetime')),
    };
  }

  // Look for matching customer packages
  const activePkgs = (Array.isArray(customerPackages) ? customerPackages : []).filter(
    (cp) => cp && cp.customerId === (order?.customerId || customer?.id) && cp.status !== 'disabled'
  );

  let matchedPkg = null;
  if (order?.discountName) {
    matchedPkg = activePkgs.find(
      (cp) => cp.name === order.discountName || String(order.discountName).includes(cp.name)
    );
  }
  if (!matchedPkg && Number(order?.paidAmount || 0) > 0) {
    matchedPkg = activePkgs.find((cp) => cp.kind === 'wallet');
  }
  if (!matchedPkg && activePkgs.length > 0) {
    matchedPkg = activePkgs[0];
  }

  if (!matchedPkg) {
    // If order has a package discountName that is not a profile/tier rate
    if (order?.discountName && !order.discountName.includes('Tier') && !order.discountName.includes('Customer Profile')) {
      return {
        name: order.discountName,
        consumed: '0.00',
        balance: '0',
        validTill: 'Lifetime',
      };
    }
    return null;
  }

  // Consumed credit for this order:
  // For wallet package, it consumes credit from the wallet package
  const isWallet = matchedPkg.kind === 'wallet';
  let consumedStr = '0.00';
  if (isWallet) {
    const consumedVal = Math.min(Number(order?.paidAmount || 0), Number(matchedPkg.walletCredit || 0));
    consumedStr = consumedVal > 0 ? consumedVal.toFixed(2) : '0.00';
  }

  // Remaining balance
  let balanceStr = '0';
  if (isWallet) {
    const rem = matchedPkg.remainingCredit != null ? Number(matchedPkg.remainingCredit) : Number(customer?.walletBalance || 0);
    balanceStr = Number.isInteger(rem) ? rem.toString() : rem.toFixed(2);
  } else if (Number(customer?.walletBalance || 0) > 0) {
    const rem = Number(customer.walletBalance);
    balanceStr = Number.isInteger(rem) ? rem.toString() : rem.toFixed(2);
  }

  // Expiration date
  let validTillStr = 'Lifetime';
  if (matchedPkg.expiresAt) {
    validTillStr = formatDate(matchedPkg.expiresAt);
  }

  return {
    name: matchedPkg.name,
    consumed: consumedStr,
    balance: balanceStr,
    validTill: validTillStr,
  };
}

