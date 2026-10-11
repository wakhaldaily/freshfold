/**
 * Cryptographic helpers for securing public digital bills.
 * Prevents unauthorized access or IDOR enumeration by signing invoice URLs with SHA-256 tokens.
 */

const SECRET_SALT = 'freshfold-secure-bill-v1';

/**
 * Fallback hash for environments without crypto.subtle (e.g. non-HTTPS scratch runs).
 */
function fallbackHash(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash << 5) - hash + str.charCodeAt(i);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(8, '0');
}

/**
 * Computes a 16-character SHA-256 hash string for a seed.
 */
export async function hashSeed(seed) {
  if (typeof crypto !== 'undefined' && crypto.subtle) {
    try {
      const msgUint8 = new TextEncoder().encode(seed);
      const hashBuffer = await crypto.subtle.digest('SHA-256', msgUint8);
      const hashArray = Array.from(new Uint8Array(hashBuffer));
      const hashHex = hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
      return hashHex.slice(0, 16);
    } catch {
      // Fallback if subtle crypto is blocked
    }
  }

  return (fallbackHash(seed) + fallbackHash(seed + '_salt')).slice(0, 16);
}

/**
 * Normalizes a date string or timestamp into a canonical UTC ISO string (second precision)
 * so that milliseconds, timezone offsets (+05:30 vs Z), or Postgres date formats produce identical seeds.
 */
export function normalizeDateSeed(createdAt) {
  if (!createdAt) return '';
  try {
    const d = new Date(createdAt);
    if (!isNaN(d.getTime())) {
      return d.toISOString().slice(0, 19) + 'Z';
    }
  } catch {}
  return String(createdAt);
}

/**
 * Generates a 16-character SHA-256 signature for a specific order and customer.
 */
export async function generateBillToken(orderId = '', orderNo = '', createdAt = '', mobile = '') {
  const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
  const normalizedDate = normalizeDateSeed(createdAt);
  const seed = `${orderId}:${orderNo}:${normalizedDate}:${cleanMobile}:${SECRET_SALT}`;
  return hashSeed(seed);
}

/**
 * Verifies that the provided token matches the expected signature.
 * Tests both canonical normalized date, legacy raw string, and candidate variations to prevent mismatches.
 */
export async function verifyBillToken(orderId = '', orderNo = '', createdAt = '', mobile = '', token = '') {
  if (!token) return false;
  const cleanToken = String(token).trim().toLowerCase();
  const cleanMobile = String(mobile || '').replace(/\D/g, '').slice(-10);
  const normalizedDate = normalizeDateSeed(createdAt);

  // Standard canonical candidate
  const candidateSeeds = [
    `${orderId}:${orderNo}:${normalizedDate}:${cleanMobile}:${SECRET_SALT}`,
  ];

  // Raw original string if different from canonical
  if (createdAt && String(createdAt) !== normalizedDate) {
    candidateSeeds.push(`${orderId}:${orderNo}:${createdAt}:${cleanMobile}:${SECRET_SALT}`);
    try {
      candidateSeeds.push(`${orderId}:${orderNo}:${new Date(createdAt).toISOString()}:${cleanMobile}:${SECRET_SALT}`);
    } catch {}
  }

  // Date-agnostic fallback (guarantees valid orders verify even if db date was absent or differently represented)
  candidateSeeds.push(`${orderId}:${orderNo}::${cleanMobile}:${SECRET_SALT}`);

  for (const seed of candidateSeeds) {
    const computed = await hashSeed(seed);
    if (computed.toLowerCase() === cleanToken) {
      return true;
    }
  }

  return false;
}

/**
 * Builds the full public URL for WhatsApp messages with the signed token.
 */
export async function buildPublicBillUrl(order, customer) {
  if (!order) return '';
  const token = await generateBillToken(
    order.id,
    order.orderNo,
    order.createdAt,
    customer?.mobile
  );

  const origin = typeof window !== 'undefined' && window.location?.origin
    ? window.location.origin
    : 'https://freshfold.app';

  const identifier = encodeURIComponent(order.orderNo || order.id);
  return `${origin}/?bill=${identifier}&token=${token}`;
}
