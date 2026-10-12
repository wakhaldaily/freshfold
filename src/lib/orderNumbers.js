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
