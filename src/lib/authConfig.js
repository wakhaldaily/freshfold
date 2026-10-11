/**
 * Environment-aware Authentication Configuration for FreshFold.
 * 
 * Rules:
 * - Production (main branch / PROD): Demo accounts are STRICTLY BLOCKED.
 *   Only real registered staff PINs and database admin accounts are permitted.
 * - Testing (testing branch / DEV): Demo accounts are permitted for fast QA and verification.
 */

const SESSION_AUTH_KEY = 'freshfold_active_session_v1';

export const DEMO_ADMIN_EMAILS = ['admin@freshfold.test'];
export const DEMO_STAFF_PINS = ['1234', '0000', '2222'];

/**
 * Checks whether demo accounts are allowed in the current environment.
 * Default is FALSE in production builds unless VITE_ALLOW_DEMO_ACCOUNTS === 'true'.
 */
export function isDemoAllowed() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    // Explicit override takes highest precedence
    if (import.meta.env.VITE_ALLOW_DEMO_ACCOUNTS === 'true') return true;
    if (import.meta.env.VITE_ALLOW_DEMO_ACCOUNTS === 'false') return false;

    // In production build mode (e.g. deployed to Cloudflare from main), disable demo accounts by default
    if (import.meta.env.PROD) {
      return false;
    }
  }

  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_ALLOW_DEMO_ACCOUNTS === 'true') return true;
    if (process.env.VITE_ALLOW_DEMO_ACCOUNTS === 'false') return false;
    if (process.env.NODE_ENV === 'production') return false;
  }

  // Development / test runner default
  return true;
}

/**
 * Returns current environment name ('production' or 'testing').
 */
export function getAppEnvironment() {
  if (typeof import.meta !== 'undefined' && import.meta.env) {
    if (import.meta.env.VITE_APP_ENV) return import.meta.env.VITE_APP_ENV;
    if (import.meta.env.PROD) return 'production';
  }
  if (typeof process !== 'undefined' && process.env) {
    if (process.env.VITE_APP_ENV) return process.env.VITE_APP_ENV;
    if (process.env.NODE_ENV === 'production') return 'production';
  }
  return 'testing';
}

/**
 * Checks whether a given identifier or password is a demo credential.
 */
export function isDemoCredential(identifier, credential) {
  const cleanId = String(identifier || '').trim().toLowerCase();
  const cleanCred = String(credential || '').trim();

  if (DEMO_ADMIN_EMAILS.includes(cleanId) || cleanCred === 'admin123') {
    return true;
  }

  if (DEMO_STAFF_PINS.includes(cleanCred)) {
    return true;
  }

  return false;
}

/**
 * Authenticates a staff member by PIN.
 */
export function verifyStaffPin(pin, staffList = []) {
  const cleanPin = String(pin || '').trim();
  if (!cleanPin) {
    return { success: false, error: 'Please enter your 4-digit staff PIN.' };
  }

  // If in production mode, block default demo PINs unless overridden in real DB
  if (!isDemoAllowed() && DEMO_STAFF_PINS.includes(cleanPin)) {
    // Check if this PIN was created as a real production staff member
    const isCustomRealStaff = staffList.some(
      (s) => String(s.pin) === cleanPin && !s.id.startsWith('staff-')
    );
    if (!isCustomRealStaff) {
      return {
        success: false,
        error: 'Demo PINs (0000, 1234, 2222) are disabled in production. Please use your store staff PIN.',
      };
    }
  }

  const matched = (staffList || []).find((s) => String(s.pin) === cleanPin);
  if (!matched) {
    return { success: false, error: 'Incorrect PIN. Please try again.' };
  }

  return {
    success: true,
    user: {
      id: matched.id,
      name: matched.name,
      role: matched.role || 'cashier',
      type: 'staff',
      authenticatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Authenticates an administrator by Email and Password.
 */
export function verifyAdminCredentials(email, password, adminList = []) {
  const cleanEmail = String(email || '').trim().toLowerCase();
  const cleanPassword = String(password || '');

  if (!cleanEmail || !cleanPassword) {
    return { success: false, error: 'Please enter your admin email and password.' };
  }

  // If in production mode, strictly reject default demo admin account
  if (!isDemoAllowed() && (cleanEmail === 'admin@freshfold.test' || cleanPassword === 'admin123')) {
    return {
      success: false,
      error: 'Demo admin account (admin@freshfold.test) is disabled in production. Please use your registered administrator credentials.',
    };
  }

  const matched = (adminList || []).find(
    (a) => (a.email?.toLowerCase() === cleanEmail || a.name?.toLowerCase() === cleanEmail) && a.password === cleanPassword
  );

  if (!matched) {
    return { success: false, error: 'Invalid admin credentials. Please check your email or password.' };
  }

  return {
    success: true,
    user: {
      id: matched.id,
      name: matched.name,
      email: matched.email,
      role: 'admin',
      type: 'admin',
      authenticatedAt: new Date().toISOString(),
    },
  };
}

/**
 * Session storage helpers for maintaining active login.
 */
export function getActiveSession() {
  if (typeof localStorage === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_AUTH_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.id) return null;

    // In production mode, invalidate any stored session that belonged to a demo account
    if (!isDemoAllowed()) {
      if (
        session.email === 'admin@freshfold.test' ||
        DEMO_ADMIN_EMAILS.includes(session.email) ||
        (session.id && (session.id === 'staff-admin' || session.id === 'staff-cashier1' || session.id === 'staff-cashier2'))
      ) {
        localStorage.removeItem(SESSION_AUTH_KEY);
        return null;
      }
    }

    return session;
  } catch {
    return null;
  }
}

export function setActiveSession(user) {
  if (typeof localStorage === 'undefined' || !user) return;
  try {
    localStorage.setItem(SESSION_AUTH_KEY, JSON.stringify(user));
  } catch {}
}

export function clearActiveSession() {
  if (typeof localStorage === 'undefined') return;
  try {
    localStorage.removeItem(SESSION_AUTH_KEY);
    localStorage.removeItem('freshfold-admin-session');
  } catch {}
}
