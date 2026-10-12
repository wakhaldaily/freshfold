/**
 * packageDiscountEngine.js
 * Rule evaluation engine for laundry package offers and discounts.
 *
 * Supports:
 * 1. Prepaid Wallet packages (bonus balance, applied at payment)
 * 2. Flat / Percentage discounts on eligible services, order types, or specific garment items
 * 3. Quantity threshold rules (e.g., minimum 2 Double Blankets required)
 * 4. Buy X, Get Y Free rules (e.g., Pay for 5 Sweaters, Get 6th Free)
 * 5. Category-specific and item-specific customization
 */

function round(val) {
  return Math.round((Number(val || 0) + Number.EPSILON) * 100) / 100;
}

/**
 * Normalises a raw quantity to a non-negative integer (NaN / missing -> 0).
 */
function toQty(q) {
  const n = Math.floor(Number(q));
  return Number.isFinite(n) ? Math.max(0, n) : 0;
}

function clamp(val, min, max) {
  const n = Number(val);
  if (!Number.isFinite(n)) return min;
  return Math.min(max, Math.max(min, n));
}

/**
 * Parses targetKeywords from either array or comma separated string form.
 */
function parseTargetKeywords(raw) {
  if (Array.isArray(raw)) return raw;
  if (typeof raw === 'string' && raw.trim()) {
    return raw.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }
  return [];
}

function hasKeywords(raw) {
  return parseTargetKeywords(raw).length > 0;
}

function toLocalYmd(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/**
 * Returns true when expiresAt is a valid date strictly before today (local YYYY-MM-DD comparison).
 * null / empty / invalid expiresAt means "no expiry".
 */
function isExpired(expiresAt, refDate = new Date()) {
  if (expiresAt === null || expiresAt === undefined || expiresAt === '') return false;
  let ymd = null;
  const dateOnly = typeof expiresAt === 'string' ? expiresAt.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/) : null;
  if (dateOnly) {
    const [, y, m, day] = dateOnly.map(Number);
    const local = new Date(y, m - 1, day);
    if (local.getFullYear() !== y || local.getMonth() !== m - 1 || local.getDate() !== day) return false;
    ymd = toLocalYmd(local);
  } else {
    const d = expiresAt instanceof Date ? expiresAt : new Date(expiresAt);
    if (Number.isNaN(d.getTime())) return false;
    ymd = toLocalYmd(d);
  }
  return ymd < toLocalYmd(refDate);
}

/**
 * Checks whether a given garment item matches the package's target rules.
 */
export function isGarmentEligible(garment, pkg = {}) {
  if (!garment) return false;

  // Category filter
  if (pkg.applicableCategory && pkg.applicableCategory !== 'all') {
    if (garment.category !== pkg.applicableCategory) return false;
  }

  const targetGarments = Array.isArray(pkg.targetGarments) ? pkg.targetGarments : [];
  let targetKeywords = parseTargetKeywords(pkg.targetKeywords);

  // Built-in inference for well-known packages if not explicitly configured
  if (targetGarments.length === 0 && targetKeywords.length === 0) {
    const pkgId = String(pkg.templateId || pkg.id || '').toLowerCase();
    const pkgName = String(pkg.name || '').toLowerCase();
    const pkgDesc = String(pkg.description || '').toLowerCase();

    if (pkgId.includes('sweater') || pkgName.includes('sweater') || pkgDesc.includes('sweater')) {
      targetKeywords = ['sweater', 'sweatshirt'];
    } else if (pkgId.includes('blanket') || pkgName.includes('blanket') || pkgDesc.includes('blanket')) {
      targetKeywords = ['blanket double', 'blanket-double', 'blanket'];
    }
  }

  // If specific garments or keywords are defined, check for matches
  const hasSpecificTargets = targetGarments.length > 0 || targetKeywords.length > 0;
  if (hasSpecificTargets) {
    const idMatches = targetGarments.includes(garment.id);
    const garmentName = String(garment.name || '').toLowerCase();
    const garmentId = String(garment.id || '').toLowerCase();
    const kwMatches = targetKeywords.some((kw) => {
      const cleanKw = String(kw ?? '').toLowerCase().trim();
      return cleanKw && (garmentName.includes(cleanKw) || garmentId.includes(cleanKw));
    });

    return idMatches || kwMatches;
  }

  return true;
}

/**
 * Normalizes package properties so legacy and custom packages adhere to standard fields.
 */
export function normalizePackageRules(rawPkg = {}) {
  const pkg = { ...(rawPkg || {}) };

  // Wallet packages are never re-interpreted from their name/id/description.
  if (pkg.kind === 'wallet') return pkg;

  // Inference may only set the kind when it is missing/empty or the generic 'special'.
  const canInferKind = !pkg.kind || pkg.kind === 'special';
  const pkgId = String(pkg.templateId || pkg.id || '').toLowerCase();
  const pkgName = String(pkg.name || '').toLowerCase();
  const pkgDesc = String(pkg.description || '').toLowerCase();

  // Inference for Winter Sweater Special (wins over blanket when both appear)
  if (pkgId.includes('sweater') || pkgName.includes('sweater') || pkgDesc.includes('sweater')) {
    if (canInferKind) pkg.kind = 'buy_x_get_y';
    pkg.buyQty = Number(pkg.buyQty || 5);
    pkg.freeQty = Number(pkg.freeQty || 1);
    pkg.minQty = Number(pkg.minQty || 6);
    pkg.applicableService = pkg.applicableService || 'Dry cleaning';
    pkg.applicableOrderType = pkg.applicableOrderType || 'pieces';
    if (!hasKeywords(pkg.targetKeywords)) {
      pkg.targetKeywords = ['sweater', 'sweatshirt'];
    }
  } else if (pkgId.includes('blanket') || pkgName.includes('blanket') || pkgDesc.includes('blanket')) {
    // Inference for 2 Double Blanket Offer
    if (canInferKind) pkg.kind = 'discount';
    pkg.discountPercent = Number(pkg.discountPercent || 25);
    pkg.minQty = Number(pkg.minQty || 2);
    pkg.applicableOrderType = pkg.applicableOrderType || 'pieces';
    if (!hasKeywords(pkg.targetKeywords)) {
      pkg.targetKeywords = ['blanket double', 'blanket-double'];
    }
  }

  // Inference for Half Price Package
  if (pkgId.includes('half-price') || pkgName.includes('half price') || pkgDesc.includes('50% discount dry cleaning per piece')) {
    if (canInferKind) pkg.kind = 'discount';
    pkg.discountPercent = Number(pkg.discountPercent || 50);
    pkg.applicableService = pkg.applicableService || 'Dry cleaning';
    pkg.applicableOrderType = pkg.applicableOrderType || 'pieces';
  }

  return pkg;
}

/**
 * Evaluates a single package against current order context.
 */
export function evaluatePackageDiscount(rawPkg, context = {}) {
  const pkg = normalizePackageRules(rawPkg);
  const {
    orderType = 'pieces',
    service = 'Dry cleaning',
    items = [],
    weightKg = 0,
    grossAmount = 0,
  } = context;

  // 1. Wallet Packages: do not apply line-item discount; provides laundry wallet balance
  if (pkg.kind === 'wallet') {
    return {
      applicable: false,
      reason: `Prepaid wallet package with ₹${pkg.walletCredit || 0} credit. Can be used for payment at checkout.`,
      discountAmount: 0,
      discountPercent: 0,
      discountName: pkg.name,
      qualifyingItems: [],
      explanation: 'Wallet credit applies toward bill payment at checkout.',
      freeItemsCount: 0,
    };
  }

  // 2. Order type check ('pieces' | 'weight' | 'all')
  const applicableOrderType = pkg.applicableOrderType || 'all';
  if (applicableOrderType !== 'all' && applicableOrderType !== orderType) {
    return {
      applicable: false,
      reason: `Only applies to ${applicableOrderType === 'pieces' ? 'piece-by-piece' : 'weight bundle'} orders.`,
      discountAmount: 0,
      discountPercent: 0,
      discountName: pkg.name,
      qualifyingItems: [],
      explanation: `Requires ${applicableOrderType} order type.`,
      freeItemsCount: 0,
    };
  }

  // 3. Service check
  const applicableService = pkg.applicableService || 'all';
  if (applicableService !== 'all' && applicableService.toLowerCase() !== service.toLowerCase()) {
    return {
      applicable: false,
      reason: `Only applies to "${applicableService}" (current order is "${service}").`,
      discountAmount: 0,
      discountPercent: 0,
      discountName: pkg.name,
      qualifyingItems: [],
      explanation: `Requires "${applicableService}" service.`,
      freeItemsCount: 0,
    };
  }

  // 4. Weight Order evaluation
  if (orderType === 'weight') {
    // If it's a weight order, only general discounts without specific garment restrictions apply
    const hasGarmentRestrictions = (Array.isArray(pkg.targetGarments) && pkg.targetGarments.length > 0) ||
      hasKeywords(pkg.targetKeywords) ||
      (pkg.applicableCategory && pkg.applicableCategory !== 'all');

    if (hasGarmentRestrictions) {
      return {
        applicable: false,
        reason: 'This offer is customized for specific garment types and only applies to per-piece orders.',
        discountAmount: 0,
        discountPercent: 0,
        discountName: pkg.name,
        qualifyingItems: [],
        explanation: 'Applies to specific clothes in piece orders.',
        freeItemsCount: 0,
      };
    }

    const pct = clamp(pkg.discountPercent || 0, 0, 100);
    if (pct > 0) {
      const weightGross = Math.max(0, Number(grossAmount) || 0);
      const discountAmount = clamp(round(weightGross * (pct / 100)), 0, weightGross);
      return {
        applicable: true,
        discountAmount,
        discountPercent: pct,
        discountName: pkg.name,
        qualifyingItems: [],
        explanation: `${pct}% discount on ${service} (${weightKg} kg)`,
        freeItemsCount: 0,
      };
    }

    return {
      applicable: false,
      reason: 'No applicable discount for weight order.',
      discountAmount: 0,
      discountPercent: 0,
      discountName: pkg.name,
      qualifyingItems: [],
      explanation: '',
      freeItemsCount: 0,
    };
  }

  // 5. Piece Order evaluation
  // Items with zero / negative / invalid quantity contribute nothing.
  const eligibleItems = (Array.isArray(items) ? items : [])
    .filter((item) => item && toQty(item.quantity) > 0 && isGarmentEligible(item, pkg));
  const unitPriceOf = (item) => Number(item.unitPrice || 0)
    + (Array.isArray(item.addons) ? item.addons : []).reduce((aSum, a) => aSum + Number(a?.price || 0), 0);
  const totalEligibleCount = eligibleItems.reduce((sum, item) => sum + toQty(item.quantity), 0);
  const eligibleGross = Math.max(0, eligibleItems.reduce(
    (sum, item) => sum + unitPriceOf(item) * toQty(item.quantity),
    0,
  ));

  // Check minimum quantity condition
  const minQty = Number(pkg.minQty || 0);
  if (minQty > 0 && totalEligibleCount < minQty) {
    return {
      applicable: false,
      reason: `Requires at least ${minQty} qualifying item(s) (cart currently has ${totalEligibleCount}).`,
      discountAmount: 0,
      discountPercent: 0,
      discountName: pkg.name,
      qualifyingItems: eligibleItems,
      explanation: `Add ${minQty - totalEligibleCount} more qualifying item(s) to unlock this offer.`,
      freeItemsCount: 0,
    };
  }

  // Case A: Buy X, Get Y Free (e.g. Pay for 5 Sweaters, Get 6th Free)
  if (pkg.kind === 'buy_x_get_y' || (pkg.kind === 'special' && (pkg.buyQty || 0) > 0)) {
    const buyQty = toQty(pkg.buyQty || 5);
    const freeQty = toQty(pkg.freeQty || 1);
    const bundleSize = buyQty + freeQty; // e.g. 5 + 1 = 6

    const freeSets = bundleSize > 0 ? Math.floor(totalEligibleCount / bundleSize) : 0;
    const totalFreeUnits = freeSets * freeQty;

    if (totalFreeUnits <= 0) {
      return {
        applicable: false,
        reason: `Requires at least ${bundleSize} qualifying items (cart has ${totalEligibleCount}).`,
        discountAmount: 0,
        discountPercent: 0,
        discountName: pkg.name,
        qualifyingItems: eligibleItems,
        explanation: `Add ${bundleSize - totalEligibleCount} more to get 1 free!`,
        freeItemsCount: 0,
      };
    }

    // Expand all qualifying units to determine the value of the free items (lowest-priced qualifying items)
    const unitPrices = [];
    for (const item of eligibleItems) {
      const singlePrice = unitPriceOf(item);
      const qty = toQty(item.quantity);
      for (let i = 0; i < qty; i++) {
        unitPrices.push(singlePrice);
      }
    }
    unitPrices.sort((a, b) => a - b); // Lowest price first for customer benefit convention

    const freePrices = unitPrices.slice(0, totalFreeUnits);
    const discountAmount = clamp(round(freePrices.reduce((sum, p) => sum + p, 0)), 0, eligibleGross);
    const effectivePercent = grossAmount > 0 ? round((discountAmount / grossAmount) * 100) : 0;

    return {
      applicable: true,
      discountAmount,
      discountPercent: effectivePercent,
      discountName: pkg.name,
      qualifyingItems: eligibleItems,
      explanation: `${totalFreeUnits} free item(s) applied (-₹${discountAmount})! Pay for ${totalEligibleCount - totalFreeUnits}, get ${totalFreeUnits} free.`,
      freeItemsCount: totalFreeUnits,
    };
  }

  // Case B: Percentage Discount Plan
  if (pkg.kind === 'discount' || Number(pkg.discountPercent || 0) > 0) {
    if (totalEligibleCount === 0) {
      return {
        applicable: false,
        reason: 'No qualifying garments in cart for this package.',
        discountAmount: 0,
        discountPercent: 0,
        discountName: pkg.name,
        qualifyingItems: [],
        explanation: 'Package applies to specific garments or categories.',
        freeItemsCount: 0,
      };
    }

    const pct = clamp(pkg.discountPercent || 0, 0, 100);
    const discountAmount = clamp(round(eligibleGross * (pct / 100)), 0, eligibleGross);
    const effectivePercent = grossAmount > 0 ? round((discountAmount / grossAmount) * 100) : pct;

    return {
      applicable: true,
      discountAmount,
      discountPercent: effectivePercent,
      discountName: pkg.name,
      qualifyingItems: eligibleItems,
      explanation: `${pct}% off qualifying item(s) (-₹${discountAmount}).`,
      freeItemsCount: 0,
    };
  }

  return {
    applicable: false,
    reason: 'Package does not provide a discount for this order.',
    discountAmount: 0,
    discountPercent: 0,
    discountName: pkg.name,
    qualifyingItems: [],
    explanation: '',
    freeItemsCount: 0,
  };
}

/**
 * Finds the best package discount among all active packages owned by a customer.
 */
export function findBestPackageDiscount(customerPackages = [], context = {}, packageTemplates = []) {
  if (!Array.isArray(customerPackages) || customerPackages.length === 0) {
    return { bestDiscount: null, allEvaluations: [] };
  }

  const allEvaluations = customerPackages
    .filter((cp) => cp && cp.status === 'active' && !isExpired(cp.expiresAt))
    .map((cp) => {
      // Look up master template definition to ensure full rule set is present
      const template = packageTemplates.find((t) => t.id === cp.templateId || t.id === cp.id) || {};
      const mergedPkg = { ...template, ...cp };
      const evaluation = evaluatePackageDiscount(mergedPkg, context);
      return {
        package: mergedPkg,
        ...evaluation,
      };
    });

  // Pick the package providing the highest monetary discount
  const applicable = allEvaluations.filter((ev) => ev.applicable && ev.discountAmount > 0);
  applicable.sort((a, b) => b.discountAmount - a.discountAmount);

  return {
    bestDiscount: applicable[0] || null,
    allEvaluations,
  };
}
