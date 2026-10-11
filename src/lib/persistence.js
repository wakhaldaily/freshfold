import {
  createInitialData, defaultSettings, defaultStaff, initialAdmins,
  initialPackageCatalog, initialAddons, initialBrands, initialColors, initialDefects,
} from '../data.js';

const STORAGE_KEY = 'freshfold-pos-v3';
const SESSION_STAFF_KEY = 'freshfold-current-staff';
const SESSION_ADMIN_KEY = 'freshfold-admin-session';
let remoteMode = false;

function number(value) {
  return Number(value || 0);
}

/**
 * Calculates the next auto-incremented order number based on the latest order number.
 * Supports arbitrary prefixes (e.g. "#w123" -> "#w124", "w123" -> "w124", "B6163" -> "B6164", "ORD-009" -> "ORD-010").
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

function normalize(data) {
  const currentOrders = Array.isArray(data.orders) ? data.orders : [];
  const latestOrderNo = currentOrders[0]?.orderNo;
  const initialNextOrderNo = data.settings?.nextOrderNo || (latestOrderNo ? getNextOrderNo(latestOrderNo) : 'B6164');

  // Preserve stored admins if incoming payload from API bootstrap does not include an admins table
  let existingAdmins = [];
  try {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('freshfold-pos-v3');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed.admins) && parsed.admins.length > 0) {
          existingAdmins = parsed.admins;
        }
      }
    }
  } catch {}

  const resolvedAdmins = Array.isArray(data.admins) && data.admins.length > 0
    ? data.admins
    : (data.settings?.admins && Array.isArray(data.settings.admins) && data.settings.admins.length > 0)
      ? data.settings.admins
      : (existingAdmins.length > 0 ? existingAdmins : [...initialAdmins]);

  return {
    settings: {
      ...defaultSettings,
      nextOrderNo: initialNextOrderNo,
      ...(data.settings || {}),
      expressOptions: Array.isArray(data.settings?.expressOptions) && data.settings.expressOptions.length > 0
        ? data.settings.expressOptions
        : defaultSettings.expressOptions,
    },
    staff: Array.isArray(data.staff) && data.staff.length ? data.staff : [...defaultStaff],
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
    orders: (data.orders || []).map((row) => ({
      ...row,
      items: Array.isArray(row.items) ? row.items : [],
      weightKg: number(row.weightKg),
      grossAmount: number(row.grossAmount),
      discountAmount: number(row.discountAmount),
      discountPercent: number(row.discountPercent),
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
      expiresAt: row.expiresAt || null, // No validity constraint
    })),
    payments: data.payments || [],
    packageSales: data.packageSales || [],
    walletTransactions: data.walletTransactions || [],
    addons: Array.isArray(data.addons) && data.addons.length ? data.addons : [...initialAddons],
    brands: Array.isArray(data.brands) && data.brands.length ? data.brands : [...initialBrands],
    colors: Array.isArray(data.colors) && data.colors.length ? data.colors : [...initialColors],
    defects: Array.isArray(data.defects) && data.defects.length ? data.defects : [...initialDefects],
  };
}

export function loadLocal() {
  try {
    if (typeof localStorage !== 'undefined') {
      const value = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('freshfold-pos-v3');
      if (value) {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed.packages) || parsed.packages.length < 6) {
          parsed.packages = [...initialPackageCatalog];
        }
        return normalize(parsed);
      }
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

async function api(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: { 'content-type': 'application/json', ...(options.headers || {}) },
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
  return result;
}

export async function loadStore() {
  try {
    const data = await api('/api/bootstrap');
    if (!Array.isArray(data.customers) || !Array.isArray(data.orders)) {
      throw new Error('No database API response.');
    }
    remoteMode = true;
    const normalized = normalize(data);
    saveLocal(normalized);
    return normalized;
  } catch {
    remoteMode = false;
    return loadLocal();
  }
}

export function isRemoteMode() {
  return remoteMode;
}

async function finishRemoteMutation(path, method, body) {
  await api(path, { method, body: body ? JSON.stringify(body) : undefined });
  return loadStore();
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
    return finishRemoteMutation('/api/staff', 'PUT', { staff: newStaffList });
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
    localStorage.setItem(SESSION_ADMIN_KEY, JSON.stringify(admin));
  } catch {}
}

export function clearAdminSession() {
  try {
    localStorage.removeItem(SESSION_ADMIN_KEY);
  } catch {}
}

export async function createAdmin(adminData, current) {
  const newAdmin = {
    ...adminData,
    id: adminData.id || `admin-${crypto.randomUUID()}`,
  };
  return saveLocal({
    ...current,
    admins: [...(current.admins || initialAdmins), newAdmin],
  });
}

export async function resetAdminPassword(adminId, newPassword, current) {
  return saveLocal({
    ...current,
    admins: (current.admins || initialAdmins).map((a) =>
      a.id === adminId ? { ...a, password: newPassword } : a
    ),
  });
}

/**
 * Updates an administrator's profile (name, email, password, recovery question/answer).
 * Persists immediately to local storage and updates active session if needed.
 */
export async function updateAdminProfile(adminId, updates, current) {
  const currentAdmins = Array.isArray(current?.admins) && current.admins.length > 0
    ? current.admins
    : [...initialAdmins];

  const cleanName = updates.name ? String(updates.name).trim() : undefined;
  const cleanEmail = updates.email ? String(updates.email).trim().toLowerCase() : undefined;
  const cleanPassword = updates.password ? String(updates.password).trim() : undefined;
  const cleanAnswer = updates.securityAnswer ? String(updates.securityAnswer).trim().toLowerCase() : undefined;

  let found = false;
  const nextAdmins = currentAdmins.map((admin) => {
    if (admin.id === adminId || (!adminId && currentAdmins.length === 1)) {
      found = true;
      return {
        ...admin,
        ...(cleanName ? { name: cleanName } : {}),
        ...(cleanEmail ? { email: cleanEmail } : {}),
        ...(cleanPassword ? { password: cleanPassword } : {}),
        ...(updates.securityQuestion ? { securityQuestion: updates.securityQuestion } : {}),
        ...(cleanAnswer ? { securityAnswer: cleanAnswer } : {}),
      };
    }
    return admin;
  });

  if (!found && (cleanName || cleanEmail)) {
    nextAdmins.push({
      id: adminId || `admin-${Date.now()}`,
      name: cleanName || 'Store Administrator',
      email: cleanEmail || 'admin@freshfold.test',
      password: cleanPassword || 'admin123',
      securityQuestion: updates.securityQuestion || 'What city is this store in?',
      securityAnswer: cleanAnswer || 'gurugram',
    });
  }

  // Update localStorage session if currently logged in
  try {
    if (typeof localStorage !== 'undefined') {
      const activeRaw = localStorage.getItem('freshfold_active_session_v1');
      if (activeRaw) {
        const active = JSON.parse(activeRaw);
        if (active.id === adminId || active.role === 'admin' || active.type === 'admin') {
          const updatedActive = {
            ...active,
            ...(cleanName ? { name: cleanName } : {}),
            ...(cleanEmail ? { email: cleanEmail } : {}),
          };
          localStorage.setItem('freshfold_active_session_v1', JSON.stringify(updatedActive));
        }
      }

      const adminRaw = localStorage.getItem(SESSION_ADMIN_KEY);
      if (adminRaw) {
        const adminSession = JSON.parse(adminRaw);
        if (adminSession.id === adminId || currentAdmins.length === 1) {
          const updatedAdminSession = {
            ...adminSession,
            ...(cleanName ? { name: cleanName } : {}),
            ...(cleanEmail ? { email: cleanEmail } : {}),
          };
          localStorage.setItem(SESSION_ADMIN_KEY, JSON.stringify(updatedAdminSession));
        }
      }
    }
  } catch {}

  // If remoteMode, sync admins into store settings
  if (remoteMode) {
    try {
      await api('/api/settings', {
        method: 'PATCH',
        body: JSON.stringify({ admins: nextAdmins }),
      });
    } catch {}
  }

  return saveLocal({
    ...current,
    admins: nextAdmins,
    settings: {
      ...(current.settings || {}),
      admins: nextAdmins,
    },
  });
}

// --- SETTINGS (TAX & STORE) ---
export async function saveSettings(newSettings, current) {
  if (remoteMode) {
    return finishRemoteMutation('/api/settings', 'PATCH', newSettings);
  }
  return saveLocal({ ...current, settings: { ...current.settings, ...newSettings } });
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
    id: `line-${crypto.randomUUID()}-${index}`,
    barcode: `${orderNo}-${index + 1}`,
    status: 'Received',
  }));

  const gross = Number(order.grossAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const subtotalBeforeExpress = Math.max(0, gross - discount);

  const expressPercent = Number(order.expressPercent || 0);
  const expressAmount = expressPercent > 0
    ? Math.round((subtotalBeforeExpress * (expressPercent / 100) + Number.EPSILON) * 100) / 100
    : Number(order.expressAmount || 0);
  const expressLabel = order.expressLabel || (expressPercent > 0 ? `Early Delivery (+${expressPercent}%)` : '');

  const subtotal = subtotalBeforeExpress + expressAmount;
  const settings = current.settings || defaultSettings;
  const isTaxEnabled = order.taxEnabled !== undefined ? Boolean(order.taxEnabled) : Boolean(settings.taxEnabled);
  const taxPercent = isTaxEnabled ? Number(settings.taxPercent || 0) : 0;
  const taxAmount = isTaxEnabled ? Math.round((subtotal * (taxPercent / 100) + Number.EPSILON) * 100) / 100 : 0;
  const totalAmount = Math.round((subtotal + taxAmount + Number.EPSILON) * 100) / 100;

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
export async function saveCustomAddon(newAddon, current) {
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
  const existingList = current.brands || [];
  if (existingList.some((b) => b.toLowerCase() === trimmed.toLowerCase())) return current;
  return saveLocal({ ...current, brands: [...existingList, trimmed] });
}

export async function saveCustomColor(colorName, current) {
  const trimmed = String(colorName || '').trim();
  if (!trimmed) return current;
  const existingList = current.colors || [];
  if (existingList.some((c) => c.toLowerCase() === trimmed.toLowerCase())) return current;
  return saveLocal({ ...current, colors: [...existingList, trimmed] });
}

export async function saveCustomDefect(defectName, current) {
  const trimmed = String(defectName || '').trim();
  if (!trimmed) return current;
  const existingList = current.defects || [];
  if (existingList.some((d) => d.toLowerCase() === trimmed.toLowerCase())) return current;
  return saveLocal({ ...current, defects: [...existingList, trimmed] });
}
