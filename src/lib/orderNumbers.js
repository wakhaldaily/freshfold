/**
 * Calculates the next auto-incremented order number based on the latest order number.
 * Supports arbitrary prefixes (e.g. "#w123" -> "#w124", "B6163" -> "B6164", "ORD-009" -> "ORD-010").
 */
export function getNextOrderNo(currentOrderNo) {
  if (!currentOrderNo || typeof currentOrderNo !== 'string') return 'B6164';
  const trimmed = currentOrderNo.trim();
  if (!trimmed) return 'B6164';

  const match = trimmed.match(/^(.*?)(\d+)$/);
  if (match) {
    const prefix = match[1];
    const numStr = match[2];
    const nextNum = parseInt(numStr, 10) + 1;
    const nextNumStr = String(nextNum).padStart(numStr.length, '0');
    return `${prefix}${nextNumStr}`;
  }

  return `${trimmed}1`;
}

/**
 * Formats order number consistently for display (e.g. ensures single '#' prefix without doubling).
 */
export function formatOrderNo(orderNo) {
  if (!orderNo) return '';
  const str = String(orderNo).trim();
  return str.startsWith('#') ? str : `#${str}`;
}

export function getServiceCode(serviceName = '') {
  const s = String(serviceName || '').trim().toLowerCase();
  if (s.includes('dry clean')) return 'DC';
  if (s.includes('premium laundry')) return 'PL';
  if (s.includes('steam iron') || s.includes('steam press')) return 'SI';
  if (s.includes('wash and iron') || s.includes('wash & iron')) return 'WI';
  if (s.includes('wash and fold') || s.includes('wash & fold')) return 'WF';
  if (s.includes('shoe')) return 'SC';
  if (s.includes('bag')) return 'BC';
  if (s.includes('carpet')) return 'CC';
  if (s.includes('curtain')) return 'DC';
  const words = s.split(/\s+/).filter(Boolean);
  if (words.length >= 2) {
    return (words[0][0] + words[1][0]).toUpperCase();
  }
  return (s.slice(0, 3) || 'DC').toUpperCase();
}

export function getCustomerTagId(customer = {}) {
  if (customer?.customerCode) return String(customer.customerCode).toUpperCase();
  if (customer?.code) return String(customer.code).toUpperCase();
  if (customer?.id) {
    const clean = String(customer.id).replace(/^cust-/, '');
    if (clean.length <= 6) return `C${clean.toUpperCase()}`;
    return `CC${clean.slice(0, 2).toUpperCase()}`;
  }
  return 'CC01';
}
