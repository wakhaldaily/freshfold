import {
  createInitialData, defaultSettings, defaultStaff, initialAdmins,
  initialPackageCatalog, initialAddons, initialBrands, initialColors, initialDefects,
} from '../data.js';
import { getNextOrderNo, formatOrderNo } from './orderNumbers.js';
import { computeTotals } from './orderPricing.js';
import { buildPublicBillUrl } from './billSecurity.js';
import { verifyAdminCredentials, verifyStaffPin } from './authConfig.js';

export { getNextOrderNo, formatOrderNo };

const STORAGE_KEY = 'freshfold-pos-v3';
const SESSION_STAFF_KEY = 'freshfold-current-staff';
const SESSION_ADMIN_KEY = 'freshfold-admin-session';
const AUTH_TOKEN_KEY = 'freshfold-auth-token';
export const UNAUTHORIZED_EVENT = 'freshfold:unauthorized';

// `remoteMode` is true when the Worker API reports a configured database.
// In remote mode the server is the source of truth: nothing silently falls back to
// browser storage, and every request carries the signed-in session's bearer token.
let remoteMode = false;
let backendInfo = null;

function number(value) {
  return Number(value || 0);
}

function readStoredData() {
  try {
    if (typeof localStorage === 'undefined') return null;
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  } catch {
    return null;
  }
}

function normalize(data, { remote = false } = {}) {
  const currentOrders = Array.isArray(data.orders) ? data.orders : [];
  const latestOrderNo = currentOrders[0]?.orderNo;
  const initialNextOrderNo = data.settings?.nextOrderNo || (latestOrderNo ? getNextOrderNo(latestOrderNo) : 'B6164');

  let resolvedAdmins;
  if (remote) {
    // Server-provided directory only (never contains credentials).
    resolvedAdmins = Array.isArray(data.admins) ? data.admins : [];
  } else {
    const storedAdmins = readStoredData()?.admins;
    const existingAdmins = Array.isArray(storedAdmins) ? storedAdmins : [];
    const dataAdmins = Array.isArray(data.admins) && data.admins.length > 0
      ? data.admins
      : (Array.isArray(data.settings?.admins) ? data.settings.admins : []);
    if (dataAdmins.length > 0) {
      resolvedAdmins = [...dataAdmins];
      for (const localAdm of existingAdmins) {
        if (localAdm.email && !resolvedAdmins.some((a) => a.email?.toLowerCase() === localAdm.email?.toLowerCase())) {
          resolvedAdmins.push(localAdm);
        }
      }
    } else if (existingAdmins.length > 0) {
      resolvedAdmins = existingAdmins;
    } else {
      resolvedAdmins = [...initialAdmins];
    }
  }

  const { admins: _settingsAdmins, ...settingsWithoutAdmins } = data.settings || {};
  const settings = {
    ...defaultSettings,
    nextOrderNo: initialNextOrderNo,
    ...(remote ? settingsWithoutAdmins : (data.settings || {})),
    expressOptions: Array.isArray(data.settings?.expressOptions) && data.settings.expressOptions.length > 0
      ? data.settings.expressOptions
      : defaultSettings.expressOptions,
  };

  return {
    ...(remote && data.me ? { me: data.me } : {}),
    settings,
    staff: Array.isArray(data.staff) && data.staff.length ? data.staff : (remote ? [] : [...defaultStaff]),
    admins: resolvedAdmins,
    packages: (Array.isArray(data.packages) && data.packages.length > 0 ? data.packages : [...initialPackageCatalog]).map((pkg) => {
      const defaultMatch = initialPackageCatalog.find((d) => d.id === pkg.id);
      return {
        ...(defaultMatch || {}),
        ...pkg,
        targetGarments: Array.isArray(pkg.targetGarments) ? pkg.targetGarments : (defaultMatch?.targetGarments || []),
        targetKeywords: pkg.targetKeywords || defaultMatch?.targetKeywords || [],
      };
    }),
    customers: (data.customers || []).map((row) => ({ ...row, walletBalance: number(row.walletBalance) })),
    orders: currentOrders.map((row) => ({
      ...row,
      items: Array.isArray(row.items) ? row.items : [],
      weightKg: number(row.weightKg),
      grossAmount: number(row.grossAmount),
      discountAmount: number(row.discountAmount),
      discountPercent: number(row.discountPercent),
      expressAmount: number(row.expressAmount),
      taxAmount: number(row.taxAmount),
      taxPercent: number(row.taxPercent ?? (row.taxAmount > 0 ? 18 : 0)),
      totalAmount: number(row.totalAmount),
      paidAmount: number(row.paidAmount),
      balanceAmount: number(row.balanceAmount),
    })),
    customerPackages: (data.customerPackages || []).map((row) => ({
      ...row,
      walletCredit: number(row.walletCredit),
      discountPercent: number(row.discountPercent),
      paidAmount: number(row.paidAmount),
      expiresAt: row.expiresAt || null,
    })),
    payments: (data.payments || []).map((p) => ({ ...p, amount: number(p.amount) })),
    packageSales: (data.packageSales || []).map((s) => ({ ...s, amount: number(s.amount) })),
    walletTransactions: (data.walletTransactions || []).map((t) => ({ ...t, amount: number(t.amount) })),
    addons: Array.isArray(data.addons) && data.addons.length ? data.addons : [...initialAddons],
    brands: Array.isArray(data.brands) && data.brands.length ? data.brands : [...initialBrands],
    colors: Array.isArray(data.colors) && data.colors.length ? data.colors : [...initialColors],
    defects: Array.isArray(data.defects) && data.defects.length ? data.defects : [...initialDefects],
  };
}

export function loadLocal() {
  try {
    const parsed = readStoredData();
    if (parsed) {
      if (!Array.isArray(parsed.packages) || parsed.packages.length < 6) {
        parsed.packages = [...initialPackageCatalog];
      }
      return normalize(parsed);
    }
  } catch (error) {
    console.warn('Could not read saved demo data.', error);
  }
  const initial = createInitialData();
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(initial));
  }
  return initial;
}

function saveLocal(data) {
  const normalized = normalize(data);
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(normalized));
  }
  return normalized;
}

// --- AUTH TOKEN (remote mode) ---
export function getAuthToken() {
  try {
    return typeof localStorage !== 'undefined' ? localStorage.getItem(AUTH_TOKEN_KEY) || '' : '';
  } catch {
    return '';
  }
}

function setAuthToken(token) {
  try {
    if (typeof localStorage !== 'undefined') {
      if (token) localStorage.setItem(AUTH_TOKEN_KEY, token);
      else localStorage.removeItem(AUTH_TOKEN_KEY);
    }
  } catch {}
}

export function clearAuthToken() {
  setAuthToken('');
}

export class AuthRequiredError extends Error {
  constructor(message = 'Your session has ended. Sign in again.') {
    super(message);
    this.name = 'AuthRequiredError';
  }
}

async function api(path, options = {}) {
  const url = (typeof window === 'undefined' && path.startsWith('/'))
    ? `http://localhost${path}`
    : path;
  const token = getAuthToken();
  const response = await fetch(url, {
    ...options,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    },
  });
  const result = await response.json().catch(() => ({}));
  if (response.status === 401 && token) {
    clearAuthToken();
    if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent(UNAUTHORIZED_EVENT));
    throw new AuthRequiredError(result.error);
  }
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

const post = (path, body) => api(path, { method: 'POST', body: JSON.stringify(body || {}) });

/**
 * Detects whether the Worker API with a database is reachable.
 * Returns `{ database, demo, setupRequired, storeName, tagline }`.
 */
export async function detectBackend() {
  try {
    const response = await fetch(typeof window === 'undefined' ? 'http://localhost/api/health' : '/api/health', {
      headers: { accept: 'application/json' },
    });
    const type = response.headers.get('content-type') || '';
    if (response.ok && type.includes('application/json')) {
      const info = await response.json();
      if (info?.database) {
        remoteMode = true;
        backendInfo = info;
        return info;
      }
    }
  } catch {
    // No API (static hosting or `vite` without `wrangler dev`): use browser storage.
  }
  remoteMode = false;
  backendInfo = { database: false };
  return backendInfo;
}

export function getBackendInfo() {
  return backendInfo;
}

/** Loads the full store. Remote mode requires a signed-in session. */
export async function loadStore() {
  if (!backendInfo) await detectBackend();
  if (!remoteMode) return loadLocal();
  const data = await api('/api/bootstrap');
  return normalize(data, { remote: true });
}

export function isRemoteMode() {
  return remoteMode;
}

export function setRemoteMode(mode) {
  remoteMode = Boolean(mode);
  backendInfo = { database: remoteMode };
}

async function finishRemoteMutation(path, method, body) {
  await api(path, { method, body: body ? JSON.stringify(body) : undefined });
  return loadStore();
}

// --- SIGN IN / SIGN OUT ---
/** Signs in with a staff PIN. Returns the session user. */
export async function loginStaff(pin, current) {
  if (remoteMode) {
    const { token, user } = await post('/api/auth/pin', { pin });
    setAuthToken(token);
    return user;
  }
  const res = verifyStaffPin(pin, current?.staff || []);
  if (!res.success) throw new Error(res.error);
  return res.user;
}

/** Signs in with an administrator email and password. Returns the session user. */
export async function loginAdmin(email, password, current) {
  if (remoteMode) {
    const { token, user } = await post('/api/auth/admin', { email, password });
    setAuthToken(token);
    return user;
  }
  const res = verifyAdminCredentials(email, password, current?.admins || []);
  if (!res.success) throw new Error(res.error);
  return res.user;
}

/**
 * First-run setup (remote: only allowed while the store has no administrator).
 * Returns `{ user, data }`; `data` is only set in local mode.
 */
export async function setupStore(adminData, storeName, current) {
  if (remoteMode) {
    const { token, user } = await post('/api/auth/setup', { ...adminData, storeName });
    setAuthToken(token);
    return { user, data: null };
  }
  let next = await createAdmin(adminData, current);
  if (storeName) {
    next = await saveSettings({ ...next.settings, storeName, storeNameCreated: true }, next);
  }
  const admin = next.admins.find((a) => a.email === adminData.email) || adminData;
  return {
    user: { id: admin.id, name: admin.name, email: admin.email, role: 'admin', type: 'admin', isAdmin: true, authenticatedAt: new Date().toISOString() },
    data: next,
  };
}

/** Unlocks admin mode for the current session. Returns the admin identity. */
export async function elevateToAdmin(email, password, current) {
  if (remoteMode) {
    const { user } = await post('/api/auth/elevate', { email, password });
    return user.admin || user;
  }
  const res = verifyAdminCredentials(email, password, current?.admins || []);
  if (!res.success) throw new Error(res.error);
  return res.user;
}

export async function dropAdminMode() {
  if (remoteMode) {
    try {
      await post('/api/auth/drop-admin');
    } catch {}
  }
}

export async function logoutSession() {
  const token = getAuthToken();
  // Forget the token locally first so a locked terminal can't reuse it, then revoke it server-side.
  clearAuthToken();
  if (remoteMode && token) {
    try {
      await fetch(typeof window === 'undefined' ? 'http://localhost/api/auth/logout' : '/api/auth/logout', {
        method: 'POST',
        headers: { 'content-type': 'application/json', authorization: `Bearer ${token}` },
        body: '{}',
      });
    } catch {}
  }
}

export async function getRecoveryQuestion(email, current) {
  if (remoteMode) {
    const { securityQuestion } = await post('/api/auth/recover', { email });
    return securityQuestion;
  }
  const clean = String(email || '').trim().toLowerCase();
  const match = (current?.admins || []).find((a) => a.email?.toLowerCase() === clean);
  if (!match) throw new Error('No admin account found with that email.');
  return match.securityQuestion || 'What city is this store in?';
}

/**
 * Resets an admin password using the security answer.
 * Remote: verified by the server, which also signs the admin in.
 * Returns `{ user, data }`; `data` is only set in local mode.
 */
export async function resetPasswordWithAnswer(email, securityAnswer, newPassword, current) {
  if (remoteMode) {
    const { token, user } = await post('/api/auth/reset', { email, securityAnswer, newPassword });
    setAuthToken(token);
    return { user, data: null };
  }
  const clean = String(email || '').trim().toLowerCase();
  const match = (current?.admins || []).find((a) => a.email?.toLowerCase() === clean);
  if (!match || String(securityAnswer || '').trim().toLowerCase() !== String(match.securityAnswer || '').toLowerCase()) {
    throw new Error('The email or security answer is incorrect.');
  }
  if (String(newPassword || '').trim().length < 6) throw new Error('New password must be at least 6 characters.');
  const data = await resetAdminPassword(match.id, newPassword, current);
  return {
    user: { id: match.id, name: match.name, email: match.email, role: 'admin', type: 'admin', isAdmin: true, authenticatedAt: new Date().toISOString() },
    data,
  };
}

// --- STAFF & SESSION AUTH ---
export function getCurrentStaff(allStaff = defaultStaff) {
  try {
    const saved = localStorage.getItem(SESSION_STAFF_KEY);
    if (saved) {
      const parsed = JSON.parse(saved);
      const matched = allStaff.find((s) => s.id === parsed.id);
      if (matched) return matched;
    }
  } catch {}
  return allStaff[0] || defaultStaff[0];
}

export function setCurrentStaff(staffMember) {
  try {
    localStorage.setItem(SESSION_STAFF_KEY, JSON.stringify(staffMember));
  } catch {}
}

export async function saveStaff(newStaffList, current) {
  if (remoteMode) {
    // Only send a PIN when it was set or changed; the server keeps existing PIN hashes.
    const staff = newStaffList.map(({ id, name, role, pin }) => ({ id, name, role, ...(pin ? { pin: String(pin) } : {}) }));
    return finishRemoteMutation('/api/staff', 'PUT', { staff });
  }
  return saveLocal({ ...current, staff: newStaffList });
}

// --- ADMIN SESSION & MANAGEMENT ---
export function getAdminSession() {
  try {
    const saved = localStorage.getItem(SESSION_ADMIN_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return null;
}

export function setAdminSession(admin) {
  try {
    // Never persist credentials, even in local mode.
    const { password, securityAnswer, ...safe } = admin || {};
    localStorage.setItem(SESSION_ADMIN_KEY, JSON.stringify(safe));
  } catch {}
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(SESSION_ADMIN_KEY);
  } catch {}
}

export async function createAdmin(adminData, current) {
  if (remoteMode) {
    const { id, ...fields } = adminData;
    return finishRemoteMutation('/api/admins', 'POST', fields);
  }

  const newAdmin = {
    ...adminData,
    id: adminData.id || `admin-${crypto.randomUUID()}`,
  };
  const nextAdmins = [
    ...(current?.admins || []).filter(
      (a) => a.id !== newAdmin.id && a.email?.toLowerCase() !== newAdmin.email?.toLowerCase()
    ),
    newAdmin,
  ];
  return saveLocal({
    ...current,
    admins: nextAdmins,
    settings: {
      ...(current?.settings || {}),
      admins: nextAdmins,
    },
  });
}

export async function resetAdminPassword(adminId, newPassword, current) {
  const cleanPassword = String(newPassword || '').trim();
  if (remoteMode) {
    return finishRemoteMutation(`/api/admins/${encodeURIComponent(adminId)}`, 'PATCH', { password: cleanPassword });
  }
  const nextAdmins = (current?.admins || initialAdmins).map((a) =>
    a.id === adminId ? { ...a, password: cleanPassword } : a
  );
  return saveLocal({
    ...current,
    admins: nextAdmins,
    settings: {
      ...(current?.settings || {}),
      admins: nextAdmins,
    },
  });
}

export async function deleteAdmin(adminId, current) {
  if (remoteMode) {
    return finishRemoteMutation(`/api/admins/${encodeURIComponent(adminId)}`, 'DELETE');
  }
  const currentAdmins = Array.isArray(current?.admins) && current.admins.length > 0
    ? current.admins
    : [...initialAdmins];
  if (currentAdmins.length <= 1) {
    throw new Error('Cannot remove the last administrator. The shop must have at least one active administrator.');
  }
  const nextAdmins = currentAdmins.filter((a) => a.id !== adminId);
  return saveLocal({
    ...current,
    admins: nextAdmins,
    settings: {
      ...(current?.settings || {}),
      admins: nextAdmins,
    },
  });
}

/**
 * Updates an administrator's profile (name, email, password, recovery question/answer).
 * Blank password / answer fields keep the current values.
 */
export async function updateAdminProfile(adminId, updates, current) {
  const cleanName = updates.name ? String(updates.name).trim() : undefined;
  const cleanEmail = updates.email ? String(updates.email).trim().toLowerCase() : undefined;
  const cleanPassword = updates.password && String(updates.password).trim() ? String(updates.password).trim() : undefined;
  const cleanAnswer = updates.securityAnswer && String(updates.securityAnswer).trim() ? String(updates.securityAnswer).trim().toLowerCase() : undefined;

  const patchPayload = {
    ...(cleanName ? { name: cleanName } : {}),
    ...(cleanEmail ? { email: cleanEmail } : {}),
    ...(cleanPassword ? { password: cleanPassword } : {}),
    ...(updates.securityQuestion ? { securityQuestion: updates.securityQuestion } : {}),
    ...(cleanAnswer ? { securityAnswer: cleanAnswer } : {}),
  };

  // Keep the cached display identity in sync (never stores credentials).
  try {
    if (typeof localStorage !== 'undefined') {
      for (const key of ['freshfold_active_session_v1', SESSION_ADMIN_KEY]) {
        const raw = localStorage.getItem(key);
        if (!raw) continue;
        const session = JSON.parse(raw);
        if (session.id === adminId || session.admin?.id === adminId) {
          localStorage.setItem(key, JSON.stringify({
            ...session,
            ...(cleanName ? { name: cleanName } : {}),
            ...(cleanEmail ? { email: cleanEmail } : {}),
          }));
        }
      }
    }
  } catch {}

  if (remoteMode) {
    return finishRemoteMutation(`/api/admins/${encodeURIComponent(adminId)}`, 'PATCH', patchPayload);
  }

  const currentAdmins = Array.isArray(current?.admins) && current.admins.length > 0
    ? current.admins
    : [...initialAdmins];
  let found = false;
  const nextAdmins = currentAdmins.map((admin) => {
    if (admin.id === adminId || (!adminId && currentAdmins.length === 1)) {
      found = true;
      return { ...admin, ...patchPayload };
    }
    return admin;
  });
  if (!found) throw new Error('Administrator not found.');

  return saveLocal({
    ...current,
    admins: nextAdmins,
    settings: {
      ...(current?.settings || {}),
      admins: nextAdmins,
    },
  });
}

// --- SETTINGS (TAX & STORE) ---
export async function saveSettings(newSettings, current) {
  if (remoteMode) {
    const { admins, ...settings } = newSettings || {};
    return finishRemoteMutation('/api/settings', 'PATCH', settings);
  }
  const mergedSettings = {
    ...(current?.settings || {}),
    ...newSettings,
    admins: (current?.admins && current.admins.length > 0)
      ? current.admins
      : (newSettings?.admins || current?.settings?.admins),
  };
  return saveLocal({ ...current, settings: mergedSettings });
}

// --- DIGITAL BILL LINKS ---
/**
 * Returns a shareable public bill URL. Remote: the server issues an unguessable
 * per-order token. Local demo mode: a browser-only hash link.
 */
export async function getShareableBillUrl(order, customer) {
  if (!order) return '';
  if (remoteMode) {
    const { orderNo, token } = await post(`/api/orders/${encodeURIComponent(order.id)}/share-link`);
    const origin = typeof window !== 'undefined' && window.location?.origin ? window.location.origin : '';
    return `${origin}/?bill=${encodeURIComponent(orderNo || order.orderNo)}&token=${token}`;
  }
  return buildPublicBillUrl(order, customer);
}

// --- CUSTOMERS ---
export async function createCustomer(data, current) {
  if (remoteMode) return finishRemoteMutation('/api/customers', 'POST', data);
  const customer = {
    ...data,
    id: `cus-${crypto.randomUUID()}`,
    walletBalance: 0,
    createdAt: new Date().toISOString(),
  };
  return saveLocal({ ...current, customers: [customer, ...current.customers] });
}

export async function updateCustomer(id, fields, current) {
  if (remoteMode) return finishRemoteMutation(`/api/customers/${encodeURIComponent(id)}`, 'PATCH', fields);
  return saveLocal({
    ...current,
    customers: current.customers.map((customer) => customer.id === id ? { ...customer, ...fields } : customer),
  });
}

export async function deleteCustomer(id, current) {
  if (remoteMode) return finishRemoteMutation(`/api/customers/${encodeURIComponent(id)}`, 'DELETE');
  return saveLocal({
    ...current,
    customers: (current.customers || []).filter((customer) => customer.id !== id),
  });
}

// --- PACKAGE TEMPLATES CRUD (CREATE, EDIT, DELETE - NO VALIDITY) ---
export async function createPackage(pkgData, current) {
  const newPkg = {
    id: pkgData.id || `pkg-${crypto.randomUUID().slice(0, 8)}`,
    name: pkgData.name.trim(),
    description: pkgData.description?.trim() || '',
    kind: pkgData.kind || 'discount',
    price: Number(pkgData.price || 0),
    walletCredit: pkgData.kind === 'wallet' ? Number(pkgData.walletCredit || 0) : 0,
    discountPercent: pkgData.kind === 'discount' ? Number(pkgData.discountPercent || 0) : 0,
    applicableService: pkgData.applicableService || 'all',
    applicableOrderType: pkgData.applicableOrderType || 'all',
    applicableCategory: pkgData.applicableCategory || 'all',
    targetGarments: Array.isArray(pkgData.targetGarments) ? pkgData.targetGarments : [],
    targetKeywords: Array.isArray(pkgData.targetKeywords)
      ? pkgData.targetKeywords
      : (typeof pkgData.targetKeywords === 'string'
        ? pkgData.targetKeywords.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
        : []),
    minQty: Number(pkgData.minQty || 0),
    buyQty: Number(pkgData.buyQty || 0),
    freeQty: Number(pkgData.freeQty || 0),
    validity: pkgData.validity?.trim() || 'Active Plan',
    accent: pkgData.accent || 'violet',
  };

  if (remoteMode) {
    return finishRemoteMutation('/api/package-templates', 'POST', newPkg);
  }
  return saveLocal({
    ...current,
    packages: [newPkg, ...(current.packages || [])],
  });
}

export async function updatePackage(id, pkgData, current) {
  if (remoteMode) {
    return finishRemoteMutation(`/api/package-templates/${encodeURIComponent(id)}`, 'PATCH', pkgData);
  }
  return saveLocal({
    ...current,
    packages: (current.packages || []).map((pkg) => (pkg.id === id ? { ...pkg, ...pkgData } : pkg)),
  });
}

export async function deletePackage(id, current) {
  if (remoteMode) {
    return finishRemoteMutation(`/api/package-templates/${encodeURIComponent(id)}`, 'DELETE');
  }
  return saveLocal({
    ...current,
    packages: (current.packages || []).filter((pkg) => pkg.id !== id),
  });
}

// --- PACKAGE ASSIGNMENT (NO EXPIRATION) ---
export async function assignPackage(customerId, templateId, paymentMethod, current) {
  if (remoteMode) return finishRemoteMutation('/api/packages', 'POST', { customerId, templateId, paymentMethod });
  const template = (current.packages || initialPackageCatalog).find((item) => item.id === templateId);
  if (!template) throw new Error('This package is not available.');
  const now = new Date();
  const assigned = {
    id: `cp-${crypto.randomUUID()}`,
    customerId,
    templateId,
    name: template.name,
    kind: template.kind,
    walletCredit: Number(template.walletCredit || 0),
    discountPercent: Number(template.discountPercent || 0),
    applicableService: template.applicableService || 'all',
    applicableOrderType: template.applicableOrderType || 'all',
    applicableCategory: template.applicableCategory || 'all',
    targetGarments: template.targetGarments || [],
    targetKeywords: template.targetKeywords || [],
    minQty: Number(template.minQty || 0),
    buyQty: Number(template.buyQty || 0),
    freeQty: Number(template.freeQty || 0),
    validity: template.validity || 'Active Plan',
    startsAt: now.toISOString().slice(0, 10),
    expiresAt: null, // Lifetime validity - NO expiration
    paidAmount: Number(template.price || 0),
    status: 'active',
  };
  const customers = current.customers.map((customer) => customer.id === customerId
    ? { ...customer, walletBalance: customer.walletBalance + (template.walletCredit || 0) }
    : customer);
  const transaction = template.walletCredit > 0 ? {
    id: `wt-${crypto.randomUUID()}`,
    customerId,
    packageId: assigned.id,
    kind: 'credit',
    amount: template.walletCredit,
    description: `${template.name} purchased`,
    createdAt: now.toISOString(),
  } : null;
  const sale = {
    id: `sale-${crypto.randomUUID()}`,
    customerId,
    packageId: assigned.id,
    templateId,
    name: template.name,
    amount: template.price,
    method: paymentMethod,
    createdAt: now.toISOString(),
  };
  return saveLocal({
    ...current,
    customers,
    customerPackages: [assigned, ...current.customerPackages],
    packageSales: [sale, ...current.packageSales],
    walletTransactions: transaction ? [transaction, ...current.walletTransactions] : current.walletTransactions,
  });
}

// --- ORDERS (WITH TAX & DISCOUNT ENGINE & EDITABLE AUTO-INCREMENTING ORDER NUMBERS) ---
export async function createOrder(order, current) {
  if (remoteMode) return finishRemoteMutation('/api/orders', 'POST', order);
  
  // Use custom order number if provided, otherwise compute from settings or latest order in sequence
  let orderNo = order.orderNo ? String(order.orderNo).trim() : '';
  if (!orderNo) {
    if (current.settings?.nextOrderNo) {
      orderNo = current.settings.nextOrderNo;
    } else if (current.orders && current.orders.length > 0 && current.orders[0]?.orderNo) {
      orderNo = getNextOrderNo(current.orders[0].orderNo);
    } else {
      const lastNumber = current.orders.reduce((max, item) => Math.max(max, Number(item.orderNo?.replace(/\D/g, '') || 0)), 6163);
      orderNo = `B${lastNumber + 1}`;
    }
  }

  // Pre-calculate next order number for subsequent orders (e.g. #w123 -> #w124)
  const computedNextOrderNo = getNextOrderNo(orderNo);
  const updatedSettings = {
    ...(current.settings || {}),
    lastOrderNo: orderNo,
    nextOrderNo: computedNextOrderNo,
  };

  const id = `ord-${crypto.randomUUID()}`;
  const itemLines = (order.items || []).map((item, index) => ({
    ...item,
    garmentId: item.garmentId || item.id,
    id: `line-${crypto.randomUUID()}-${index}`,
    barcode: `${orderNo}-${index + 1}`,
    status: 'Received',
  }));

  // Browser-only demo mode trusts the POS figures; the Worker re-prices everything server-side.
  const settings = current.settings || defaultSettings;
  const isTaxEnabled = order.taxEnabled !== undefined ? Boolean(order.taxEnabled) : Boolean(settings.taxEnabled);
  const {
    grossAmount: gross,
    discountAmount: discount,
    expressPercent,
    expressAmount,
    taxPercent,
    taxAmount,
    totalAmount,
  } = computeTotals({
    grossAmount: order.grossAmount,
    discountAmount: order.discountAmount,
    expressPercent: order.expressPercent,
    expressAmount: order.expressAmount,
    taxEnabled: isTaxEnabled,
    taxPercent: settings.taxPercent || 0,
  });
  const expressLabel = order.expressLabel || (expressPercent > 0 ? `Early Delivery (+${expressPercent}%)` : '');

  // Auto-deduct from customer's package wallet credits if available
  const customer = (current.customers || []).find((c) => c.id === order.customerId);
  const walletBal = Number(customer?.walletBalance || 0);
  const autoDeduct = Math.min(walletBal, totalAmount);
  const paidAmount = autoDeduct;
  const balanceAmount = Math.max(0, totalAmount - autoDeduct);
  const createdAt = new Date().toISOString();

  const newOrder = {
    ...order,
    id,
    orderNo,
    items: itemLines,
    grossAmount: gross,
    discountAmount: discount,
    discountPercent: Number(order.discountPercent || 0),
    discountName: order.discountName || '',
    expressDelivery: expressAmount > 0,
    expressPercent,
    expressAmount,
    expressLabel,
    taxAmount,
    taxPercent,
    totalAmount,
    paidAmount,
    balanceAmount,
    status: 'Received',
    createdAt,
  };

  let customers = current.customers;
  let payments = current.payments || [];
  let walletTransactions = current.walletTransactions || [];

  if (autoDeduct > 0) {
    customers = current.customers.map((c) =>
      c.id === order.customerId
        ? { ...c, walletBalance: Math.max(0, c.walletBalance - autoDeduct) }
        : c
    );
    const payment = {
      id: `pay-${crypto.randomUUID()}`,
      orderId: id,
      customerId: order.customerId,
      amount: autoDeduct,
      method: 'wallet',
      createdAt,
    };
    payments = [payment, ...payments];

    const transaction = {
      id: `wt-${crypto.randomUUID()}`,
      customerId: order.customerId,
      packageId: null,
      orderId: id,
      kind: 'debit',
      amount: autoDeduct,
      description: `Payment for ${orderNo}`,
      createdAt,
    };
    walletTransactions = [transaction, ...walletTransactions];
  }

  return saveLocal({
    ...current,
    orders: [newOrder, ...current.orders],
    settings: updatedSettings,
    customers,
    payments,
    walletTransactions,
  });
}

// --- PAYMENTS ---
export async function recordPayment(orderId, amount, method, current) {
  if (remoteMode) return finishRemoteMutation(`/api/orders/${encodeURIComponent(orderId)}/payments`, 'POST', { amount, method });
  const order = current.orders.find((item) => item.id === orderId);
  if (!order) throw new Error('Order could not be found.');
  if (amount <= 0 || amount > order.balanceAmount + 0.001) throw new Error('Enter a payment up to the balance due.');
  const customer = current.customers.find((item) => item.id === order.customerId);
  if (method === 'wallet' && customer.walletBalance + 0.001 < order.balanceAmount) {
    throw new Error(`Wallet has ${formatMoney(customer.walletBalance)}; ${formatMoney(order.balanceAmount)} is needed to pay this order in full.`);
  }
  if (method === 'wallet' && Math.abs(amount - order.balanceAmount) > 0.001) {
    throw new Error('Wallet must cover the full balance due. Use another payment method for a partial payment.');
  }
  const payment = {
    id: `pay-${crypto.randomUUID()}`,
    orderId,
    customerId: order.customerId,
    amount,
    method,
    createdAt: new Date().toISOString(),
  };
  const orders = current.orders.map((item) => item.id === orderId ? {
    ...item,
    paidAmount: item.paidAmount + amount,
    balanceAmount: Math.max(0, item.balanceAmount - amount),
  } : item);
  let customers = current.customers;
  let walletTransactions = current.walletTransactions;
  if (method === 'wallet') {
    customers = current.customers.map((item) => item.id === customer.id
      ? { ...item, walletBalance: Math.max(0, item.walletBalance - amount) }
      : item);
    walletTransactions = [{
      id: `wt-${crypto.randomUUID()}`,
      customerId: customer.id,
      packageId: null,
      orderId,
      kind: 'debit',
      amount,
      description: `Payment for ${order.orderNo}`,
      createdAt: payment.createdAt,
    }, ...walletTransactions];
  }
  return saveLocal({ ...current, orders, customers, payments: [payment, ...current.payments], walletTransactions });
}

export async function updateOrderStatus(orderId, status, current) {
  if (remoteMode) return finishRemoteMutation(`/api/orders/${encodeURIComponent(orderId)}`, 'PATCH', { status });
  return saveLocal({
    ...current,
    orders: current.orders.map((order) => order.id === orderId
      ? { ...order, status, items: order.items.map((item) => ({ ...item, status })) }
      : order),
  });
}

export function formatMoney(amount) {
  return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(Number(amount || 0));
}

// --- ADDONS & TAGS PERSISTENCE (CREATE ON THE FLY) ---
// In remote mode these are stored in the server catalog so prices are enforced
// server-side and tags are shared across terminals.
async function saveRemoteCatalogEntry(kind, name, price, current) {
  const catalog = await post('/api/catalog', { kind, name, ...(price !== undefined ? { price } : {}) });
  return { ...current, addons: catalog.addons, brands: catalog.brands, colors: catalog.colors, defects: catalog.defects };
}

export async function saveCustomAddon(newAddon, current) {
  if (remoteMode) {
    if (!String(newAddon?.name || '').trim()) return current;
    return saveRemoteCatalogEntry('addon', newAddon.name, Number(newAddon.price || 0), current);
  }
  const existingList = current.addons || [];
  const trimmedName = String(newAddon.name || '').trim();
  if (!trimmedName) return current;
  const existing = existingList.find((a) => a.name.toLowerCase() === trimmedName.toLowerCase());
  let nextAddons;
  if (existing) {
    nextAddons = existingList.map((a) => a.id === existing.id ? { ...a, price: Number(newAddon.price || a.price) } : a);
  } else {
    const created = {
      id: `addon-${crypto.randomUUID()}`,
      name: trimmedName,
      price: Number(newAddon.price || 0),
    };
    nextAddons = [...existingList, created];
  }
  return saveLocal({ ...current, addons: nextAddons });
}

export async function saveCustomBrand(brandName, current) {
  const trimmed = String(brandName || '').trim();
  if (!trimmed) return current;
  if (remoteMode) return saveRemoteCatalogEntry('brand', trimmed, undefined, current);
  const existingList = current.brands || [];
  if (existingList.some((b) => b.toLowerCase() === trimmed.toLowerCase())) return current;
  return saveLocal({ ...current, brands: [...existingList, trimmed] });
}

export async function saveCustomColor(colorName, current) {
  const trimmed = String(colorName || '').trim();
  if (!trimmed) return current;
  if (remoteMode) return saveRemoteCatalogEntry('color', trimmed, undefined, current);
  const existingList = current.colors || [];
  if (existingList.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return current;
  return saveLocal({ ...current, colors: [...existingList, trimmed] });
}

export async function saveCustomDefect(defectName, current) {
  const trimmed = String(defectName || '').trim();
  if (!trimmed) return current;
  if (remoteMode) return saveRemoteCatalogEntry('defect', trimmed, undefined, current);
  const existingList = current.defects || [];
  if (existingList.some((d) => d.toLowerCase() === trimmed.toLowerCase())) return current;
  return saveLocal({ ...current, defects: [...existingList, trimmed] });
}
