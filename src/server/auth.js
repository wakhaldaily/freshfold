/**
 * Server-side authentication: bcrypt (pgcrypto) credential checks, opaque bearer
 * sessions stored as SHA-256 hashes, and per-IP rate limiting of failed attempts.
 */
import { HttpError, randomToken, sha256Hex } from './http.js';

export const DEMO_ADMIN_EMAIL = 'admin@freshfold.test';
export const DEMO_ADMIN_PASSWORD = 'admin123';
export const DEMO_STAFF_PINS = ['1234', '0000', '2222'];

const SESSION_TTL_HOURS = 12;
const ATTEMPT_WINDOW_MINUTES = 15;

export const RATE_LIMITS = {
  login: 10,
  reset: 5,
  bill: 30,
};

export function isDemoAllowed(env = {}) {
  return String(env.ALLOW_DEMO_ACCOUNTS || '').toLowerCase() === 'true';
}

export async function assertNotRateLimited(sql, bucket, limit) {
  const rows = await sql`SELECT count(*)::int AS n FROM auth_attempts
    WHERE bucket = ${bucket} AND created_at > now() - make_interval(mins => ${ATTEMPT_WINDOW_MINUTES})`;
  if (Number(rows[0]?.n || 0) >= limit) {
    throw new HttpError(429, `Too many failed attempts. Wait ${ATTEMPT_WINDOW_MINUTES} minutes and try again.`);
  }
}

export async function recordFailedAttempt(sql, bucket) {
  await sql`INSERT INTO auth_attempts (bucket) VALUES (${bucket})`;
}

/** Creates a session row and returns the raw bearer token (only its hash is stored). */
export async function createSession(sql, principal) {
  const token = randomToken(32);
  const tokenHash = await sha256Hex(token);
  const rows = await sql`INSERT INTO sessions (token_hash, principal_type, principal_id, name, email, role, expires_at)
    VALUES (${tokenHash}, ${principal.type}, ${principal.id}, ${principal.name || ''}, ${principal.email || ''}, ${principal.role},
      now() + make_interval(hours => ${SESSION_TTL_HOURS}))
    RETURNING *`;
  return { token, user: sessionToUser(rows[0]) };
}

export function sessionToUser(row) {
  if (!row) return null;
  const isAdmin = row.role === 'admin' || row.principal_type === 'admin' || Boolean(row.elevated_admin_id);
  let admin = null;
  if (row.principal_type === 'admin') admin = { id: row.principal_id, name: row.name, email: row.email };
  else if (row.elevated_admin_id) {
    admin = { id: row.elevated_admin_id, name: row.elevated_admin_name || '', email: row.elevated_admin_email || '' };
  }
  return {
    id: row.principal_id,
    name: row.name,
    email: row.email || '',
    type: row.principal_type,
    role: isAdmin ? 'admin' : row.role,
    staffRole: row.principal_type === 'staff' ? row.role : null,
    isAdmin,
    admin,
    tokenHash: row.token_hash,
    expiresAt: row.expires_at,
  };
}

/** Public view of the user (no token hash). */
export function publicUser(user) {
  if (!user) return null;
  const { tokenHash, ...rest } = user;
  return rest;
}

export async function getSessionUser(sql, request) {
  const header = request.headers.get('authorization') || '';
  const match = header.match(/^Bearer\s+([a-f0-9]{64})$/i);
  if (!match) return null;
  const tokenHash = await sha256Hex(match[1].toLowerCase());
  const rows = await sql`SELECT * FROM sessions WHERE token_hash = ${tokenHash} AND expires_at > now()`;
  return sessionToUser(rows[0]);
}

/** Verifies admin email + password. Returns the admin row or null. */
export async function verifyAdminPassword(sql, env, email, password) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '');
  if (!cleanEmail || !cleanPassword) return null;

  if (cleanEmail === DEMO_ADMIN_EMAIL) {
    if (!isDemoAllowed(env)) {
      throw new HttpError(403, 'The demo admin account is disabled on this server. Sign in with your store administrator account.');
    }
    if (cleanPassword === DEMO_ADMIN_PASSWORD) {
      await sql`INSERT INTO admin_users (id, name, email, password, security_question, security_answer)
        VALUES ('admin-1', 'Store Administrator', ${DEMO_ADMIN_EMAIL}, crypt(${DEMO_ADMIN_PASSWORD}, gen_salt('bf', 10)),
          'What city is this store in?', crypt('gurugram', gen_salt('bf', 10)))
        ON CONFLICT DO NOTHING`;
    }
  }

  const rows = await sql`SELECT id, name, email FROM admin_users
    WHERE lower(email) = ${cleanEmail} AND password = crypt(${cleanPassword}, password)`;
  return rows[0] || null;
}

/** Verifies a staff PIN. Returns the staff row or null; throws if the PIN is ambiguous. */
export async function verifyStaffPin(sql, env, pin) {
  const cleanPin = String(pin || '').trim();
  if (!/^\d{4,6}$/.test(cleanPin)) throw new HttpError(400, 'Enter your 4 to 6 digit staff PIN.');
  if (!isDemoAllowed(env) && DEMO_STAFF_PINS.includes(cleanPin)) {
    throw new HttpError(403, 'Default PINs (0000, 1234, 2222) are disabled on this server. Ask an administrator to set your PIN.');
  }
  const rows = await sql`SELECT id, name, role FROM staff_members WHERE pin = crypt(${cleanPin}, pin)`;
  if (rows.length > 1) {
    throw new HttpError(409, 'This PIN is shared by more than one staff member. Ask an administrator to give each person a unique PIN.');
  }
  return rows[0] || null;
}

export async function deleteSessionsFor(sql, principalId, exceptTokenHash = '') {
  await sql`DELETE FROM sessions
    WHERE (principal_id = ${principalId} OR elevated_admin_id = ${principalId}) AND token_hash <> ${exceptTokenHash}`;
}
