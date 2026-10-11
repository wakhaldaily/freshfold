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
 * Checks whether a given garment item matches the package's target rules.
 */
export function isGarmentEligible(garment, pkg = {}) {
  if (!garment) return false;

  // Category filter
  if (pkg.applicableCategory && pkg.applicableCategory !== 'all') {
    if (garment.category !== pkg.applicableCategory) return false;
  }

  const targetGarments = Array.isArray(pkg.targetGarments) ? pkg.targetGarments : [];
  let targetKeywords = Array.isArray(pkg.targetKeywords) ? pkg.targetKeywords : [];
  if (typeof pkg.targetKeywords === 'string' && pkg.targetKeywords.trim()) {
    targetKeywords = pkg.targetKeywords.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean);
  }

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
      const cleanKw = kw.toLowerCase().trim();
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
  const pkg = { ...rawPkg };
  const pkgId = String(pkg.templateId || pkg.id || '').toLowerCase();
  const pkgName = String(pkg.name || '').toLowerCase();
  const pkgDesc = String(pkg.description || '').toLowerCase();

  // Inference for Winter Sweater Special
  if (pkgId.includes('sweater') || pkgName.includes('sweater') || pkgDesc.includes('sweater')) {
    pkg.kind = 'buy_x_get_y';
    pkg.buyQty = Number(pkg.buyQty || 5);
    pkg.freeQty = Number(pkg.freeQty || 1);
    pkg.minQty = Number(pkg.minQty || 6);
    pkg.applicableService = pkg.applicableService || 'Dry cleaning';
    pkg.applicableOrderType = pkg.applicableOrderType || 'pieces';
    if (!pkg.targetKeywords || !pkg.targetKeywords.length) {
      pkg.targetKeywords = ['sweater', 'sweatshirt'];
    }
  }

  // Inference for 2 Double Blanket Offer
  if (pkgId.includes('blanket') || pkgName.includes('blanket') || pkgDesc.includes('blanket')) {
    pkg.kind = 'discount';
    pkg.discountPercent = Number(pkg.discountPercent || 25);
    pkg.minQty = Number(pkg.minQty || 2);
    pkg.applicableOrderType = pkg.applicableOrderType || 'pieces';
    if (!pkg.targetKeywords || !pkg.targetKeywords.length) {
      pkg.targetKeywords = ['blanket double', 'blanket-double'];
    }
  }

  // Inference for Half Price Package
  if (pkgId.includes('half-price') || pkgName.includes('half price') || pkgDesc.includes('50% discount dry cleaning per piece')) {
    pkg.kind = 'discount';
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
      (Array.isArray(pkg.targetKeywords) && pkg.targetKeywords.length > 0) ||
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

    const pct = Number(pkg.discountPercent || 0);
    if (pct > 0) {
      const discountAmount = round(grossAmount * (pct / 100));
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
  const eligibleItems = items.filter((item) => isGarmentEligible(item, pkg));
  const totalEligibleCount = eligibleItems.reduce((sum, item) => sum + (Number(item.quantity) || 1), 0);
  const eligibleGross = eligibleItems.reduce((sum, item) => {
    const addonExtra = (item.addons || []).reduce((aSum, a) => aSum + Number(a.price || 0), 0);
    return sum + (Number(item.unitPrice || 0) + addonExtra) * (Number(item.quantity) || 1);
  }, 0);

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
    const buyQty = Number(pkg.buyQty || 5);
    const freeQty = Number(pkg.freeQty || 1);
    const bundleSize = buyQty + freeQty; // e.g. 5 + 1 = 6

    const freeSets = Math.floor(totalEligibleCount / bundleSize);
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
      const singlePrice = Number(item.unitPrice || 0) + (item.addons || []).reduce((s, a) => s + Number(a.price || 0), 0);
      const qty = Number(item.quantity || 1);
      for (let i = 0; i < qty; i++) {
        unitPrices.push(singlePrice);
      }
    }
    unitPrices.sort((a, b) => a - b); // Lowest price first for customer benefit convention

    const freePrices = unitPrices.slice(0, totalFreeUnits);
    const discountAmount = round(freePrices.reduce((sum, p) => sum + p, 0));
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

    const pct = Number(pkg.discountPercent || 0);
    const discountAmount = round(eligibleGross * (pct / 100));
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
    .filter((cp) => cp.status === 'active')
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
