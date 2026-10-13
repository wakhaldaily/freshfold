import test from 'node:test';
import assert from 'node:assert/strict';
import { createApiClient, createTestDatabase } from './helpers/testDatabase.js';
import { getShareablePriceListUrl, getSharePriceListWhatsAppText, normalizeWhatsAppNumber } from '../src/lib/persistence.js';
import { garmentCatalog, services, weightServices } from '../src/data.js';

const ADMIN = {
  name: 'Store Manager',
  email: 'manager@clean.example',
  password: 'clean-password-123',
  securityQuestion: 'What city is this store in?',
  securityAnswer: 'Gurugram',
  storeName: 'Clean Clear Dry Cleaning',
};

test('1. GET /api/public-prices returns catalog without requiring an auth session', async () => {
  const { sql } = await createTestDatabase();
  const api = createApiClient(sql);

  // Setup the store first
  const setupRes = await api.post('/api/auth/setup', ADMIN);
  assert.equal(setupRes.status, 201);

  // Call public-prices with NO bearer token
  const res = await api.get('/api/public-prices');
  assert.equal(res.status, 200);

  const data = res.data;
  assert.ok(data.settings, 'Should include settings');
  assert.equal(data.settings.storeName, 'Clean Clear Dry Cleaning');
  assert.ok(Array.isArray(data.garmentCatalog), 'Should include garment catalog');
  assert.ok(data.garmentCatalog.length > 50, 'Catalog should have comprehensive garments');
  assert.ok(Array.isArray(data.services), 'Should include piece services');
  assert.ok(Array.isArray(data.weightServices), 'Should include weight services');
  assert.ok(Array.isArray(data.addons), 'Should include care add-ons');
  assert.ok(Array.isArray(data.packages), 'Should include packages');
});

test('2. GET /api/public-prices sanitizes settings and never leaks passwords or PINs', async () => {
  const { sql } = await createTestDatabase();
  const api = createApiClient(sql);

  await api.post('/api/auth/setup', ADMIN);

  const res = await api.get('/api/public-prices');
  assert.equal(res.status, 200);

  const { settings } = res.data;
  assert.equal(settings.password, undefined);
  assert.equal(settings.pin, undefined);
  assert.equal(settings.securityAnswer, undefined);
  assert.equal(settings.admins, undefined);
  assert.equal(settings.staff, undefined);
});

test('3. getShareablePriceListUrl generates clean URLs with name & mobile (no customer ID)', () => {
  // Generic URL
  const genericUrl = getShareablePriceListUrl(null);
  assert.match(genericUrl, /\/\?prices=1$/);

  // Personalized Customer URL
  const customer = {
    id: 'cus-123',
    customerCode: '101',
    name: 'Aditi Sharma',
    mobile: '9000000001',
  };
  const personalizedUrl = getShareablePriceListUrl(customer);
  assert.match(personalizedUrl, /prices=1/);
  assert.equal(personalizedUrl.includes('cid='), false, 'Should not contain customer id cid');
  assert.match(personalizedUrl, /name=Aditi\+Sharma/);
  assert.match(personalizedUrl, /phone=9000000001/);
});

test('4. getSharePriceListWhatsAppText formats greeting, store name, and clean link without customer ID', () => {
  const settings = { storeName: 'Clean Clear Dry Cleaning' };
  const customer = { name: 'Rahul Mehta', customerCode: '202', mobile: '9000000002' };

  const message = getSharePriceListWhatsAppText(settings, customer);
  assert.match(message, /Hello Rahul Mehta!/);
  assert.match(message, /Clean Clear Dry Cleaning/);
  assert.match(message, /\/\?prices=1/);
  assert.equal(message.includes('cid='), false, 'Should not contain customer id cid');
});

test('5. Garment catalog covers all required categories: Men, Women, Kids, Household', () => {
  const categories = new Set(garmentCatalog.map((g) => g.category));
  assert.ok(categories.has('Men'), 'Should contain Men category');
  assert.ok(categories.has('Women'), 'Should contain Women category');
  assert.ok(categories.has('Kids'), 'Should contain Kids category');
  assert.ok(categories.has('Household'), 'Should contain Household category');

  // Verify weight services exist
  const weightLabels = weightServices.map((ws) => ws.label);
  assert.ok(weightLabels.includes('Wash and Fold'));
  assert.ok(weightLabels.includes('Wash and iron'));
});

test('6. normalizeWhatsAppNumber formats Indian 10-digit, 11-digit (with 0), and prefixed numbers cleanly', () => {
  assert.equal(normalizeWhatsAppNumber('9876543210'), '919876543210');
  assert.equal(normalizeWhatsAppNumber('+91 98765 43210'), '919876543210');
  assert.equal(normalizeWhatsAppNumber('919876543210'), '919876543210');
  assert.equal(normalizeWhatsAppNumber('09876543210'), '919876543210');
  assert.equal(normalizeWhatsAppNumber('70057 28774'), '917005728774');
  assert.equal(normalizeWhatsAppNumber(''), '917005728774');
});

test('7. Settings updated in admin (address and admin mobile) reflect directly in public-prices endpoint', async () => {
  const { sql } = await createTestDatabase();
  const api = createApiClient(sql);

  // Setup the store
  await api.post('/api/auth/setup', ADMIN);

  // Login as admin
  const loginRes = await api.post('/api/auth/admin', {
    email: ADMIN.email,
    password: ADMIN.password,
  });
  assert.equal(loginRes.status, 200);
  const token = loginRes.data.token;

  // Update address and admin mobile in settings
  const patchRes = await api.patch('/api/settings', {
    address: 'Shop 101, Mega Mall, MG Road, Gurugram, Haryana - 122002',
    phone: '+91 99887 76655',
    adminMobile: '+91 99887 76655',
  }, { token });
  assert.equal(patchRes.status, 200);

  // Fetch public prices without token
  const publicRes = await api.get('/api/public-prices');
  assert.equal(publicRes.status, 200);
  const { settings } = publicRes.data;

  assert.equal(settings.address, 'Shop 101, Mega Mall, MG Road, Gurugram, Haryana - 122002');
  assert.equal(settings.phone, '+91 99887 76655');
  assert.equal(settings.adminMobile, '+91 99887 76655');
  assert.equal(normalizeWhatsAppNumber(settings.phone), '919988776655');
});
