import { describe, it } from 'node:test';
import assert from 'node:assert';
import {
  isDemoAllowed,
  verifyStaffPin,
  verifyAdminCredentials,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
  DEMO_ADMIN_EMAILS,
  DEMO_STAFF_PINS,
} from '../src/lib/authConfig.js';

describe('Production & Testing Environment Authentication Guard', () => {
  const mockStaffList = [
    { id: 'staff-admin', name: 'Store Owner', role: 'manager', pin: '1234' },
    { id: 'staff-cashier1', name: 'Cashier 1', role: 'cashier', pin: '0000' },
    { id: 'staff-cashier2', name: 'Cashier 2', role: 'cashier', pin: '2222' },
    { id: 'real-emp-101', name: 'Vikram Real Staff', role: 'cashier', pin: '7890' },
    { id: 'real-emp-102', name: 'Priya Senior Staff', role: 'manager', pin: '4567' },
  ];

  const mockAdminList = [
    {
      id: 'admin-default',
      name: 'Fresh Fold Demo Admin',
      email: 'admin@freshfold.test',
      password: 'admin123',
    },
    {
      id: 'admin-prod-001',
      name: 'Rajesh Store Owner',
      email: 'rajesh@myfreshfold.com',
      password: 'SecureProdPassword99!',
    },
  ];

  it('1. In testing mode (default in dev/test), demo accounts and PINs are permitted', () => {
    // Demo staff PINs
    const resStaff1 = verifyStaffPin('1234', mockStaffList);
    assert.strictEqual(resStaff1.success, true);
    assert.strictEqual(resStaff1.user.name, 'Store Owner');

    const resStaff2 = verifyStaffPin('0000', mockStaffList);
    assert.strictEqual(resStaff2.success, true);

    const resStaff3 = verifyStaffPin('2222', mockStaffList);
    assert.strictEqual(resStaff3.success, true);

    // Demo admin login
    const resAdmin = verifyAdminCredentials('admin@freshfold.test', 'admin123', mockAdminList);
    assert.strictEqual(resAdmin.success, true);
    assert.strictEqual(resAdmin.user.email, 'admin@freshfold.test');
  });

  it('2. In simulated production mode, demo admin account is strictly rejected', () => {
    // Simulate production environment
    const prevEnv = process.env.VITE_ALLOW_DEMO_ACCOUNTS;
    const prevProd = process.env.NODE_ENV;
    process.env.VITE_ALLOW_DEMO_ACCOUNTS = 'false';
    process.env.NODE_ENV = 'production';

    try {
      assert.strictEqual(isDemoAllowed(), false);

      // Attempt login with demo admin email
      const demoAttempt1 = verifyAdminCredentials('admin@freshfold.test', 'admin123', mockAdminList);
      assert.strictEqual(demoAttempt1.success, false);
      assert.match(demoAttempt1.error, /disabled in production/i);

      // Attempt login with demo admin password even if email was typed differently
      const demoAttempt2 = verifyAdminCredentials('random@email.com', 'admin123', mockAdminList);
      assert.strictEqual(demoAttempt2.success, false);
      assert.match(demoAttempt2.error, /disabled in production/i);

      // Genuine production admin account logs in seamlessly
      const prodAdmin = verifyAdminCredentials('rajesh@myfreshfold.com', 'SecureProdPassword99!', mockAdminList);
      assert.strictEqual(prodAdmin.success, true);
      assert.strictEqual(prodAdmin.user.name, 'Rajesh Store Owner');
      assert.strictEqual(prodAdmin.user.role, 'admin');
    } finally {
      process.env.VITE_ALLOW_DEMO_ACCOUNTS = prevEnv;
      process.env.NODE_ENV = prevProd;
    }
  });

  it('3. In simulated production mode, demo staff PINs (0000, 1234, 2222) are strictly blocked', () => {
    const prevEnv = process.env.VITE_ALLOW_DEMO_ACCOUNTS;
    process.env.VITE_ALLOW_DEMO_ACCOUNTS = 'false';

    try {
      assert.strictEqual(isDemoAllowed(), false);

      // Default demo PINs
      for (const pin of DEMO_STAFF_PINS) {
        const demoStaffAttempt = verifyStaffPin(pin, mockStaffList);
        assert.strictEqual(demoStaffAttempt.success, false);
        assert.match(demoStaffAttempt.error, /disabled in production/i);
      }

      // Genuine real employee PINs work immediately
      const realStaff1 = verifyStaffPin('7890', mockStaffList);
      assert.strictEqual(realStaff1.success, true);
      assert.strictEqual(realStaff1.user.name, 'Vikram Real Staff');

      const realStaff2 = verifyStaffPin('4567', mockStaffList);
      assert.strictEqual(realStaff2.success, true);
      assert.strictEqual(realStaff2.user.name, 'Priya Senior Staff');
    } finally {
      process.env.VITE_ALLOW_DEMO_ACCOUNTS = prevEnv;
    }
  });

  it('4. Stale demo session is automatically purged when checked in production environment', () => {
    // Setup a mock localStorage
    const storageMap = new Map();
    global.localStorage = {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };

    try {
      // 1. In testing mode, store a demo session
      process.env.VITE_ALLOW_DEMO_ACCOUNTS = 'true';
      const demoUser = {
        id: 'staff-admin',
        name: 'Store Owner',
        email: 'admin@freshfold.test',
        role: 'manager',
      };
      setActiveSession(demoUser);
      assert.deepStrictEqual(getActiveSession().id, 'staff-admin');

      // 2. Switch to production mode
      process.env.VITE_ALLOW_DEMO_ACCOUNTS = 'false';
      // getActiveSession should detect demo account in prod, purge it, and return null
      const sessionInProd = getActiveSession();
      assert.strictEqual(sessionInProd, null);

      // Real user session survives in production
      const realUser = {
        id: 'real-emp-101',
        name: 'Vikram Real Staff',
        email: 'vikram@store.com',
        role: 'cashier',
      };
      setActiveSession(realUser);
      assert.strictEqual(getActiveSession().id, 'real-emp-101');
    } finally {
      delete global.localStorage;
      delete process.env.VITE_ALLOW_DEMO_ACCOUNTS;
    }
  });

  it('5. Empty or incorrect credentials produce clean user-facing error messages', () => {
    const emptyPin = verifyStaffPin('', mockStaffList);
    assert.strictEqual(emptyPin.success, false);
    assert.match(emptyPin.error, /enter your 4-digit staff PIN/i);

    const wrongPin = verifyStaffPin('9999', mockStaffList);
    assert.strictEqual(wrongPin.success, false);
    assert.match(wrongPin.error, /incorrect PIN/i);

    const emptyAdmin = verifyAdminCredentials('', '', mockAdminList);
    assert.strictEqual(emptyAdmin.success, false);
    assert.match(emptyAdmin.error, /enter your admin email and password/i);

    const wrongAdmin = verifyAdminCredentials('nobody@store.com', 'wrongPass', mockAdminList);
    assert.strictEqual(wrongAdmin.success, false);
    assert.match(wrongAdmin.error, /invalid admin credentials/i);
  });

  it('6. All 36 Indian States and Union Territories are available for customer creation', async () => {
    const { INDIAN_STATES } = await import('../src/data.js');
    assert.strictEqual(INDIAN_STATES.length, 36);

    // Verify key states from all corners of India
    const expectedRegions = [
      'Delhi',
      'Maharashtra',
      'Karnataka',
      'Tamil Nadu',
      'Uttar Pradesh',
      'Gujarat',
      'West Bengal',
      'Kerala',
      'Punjab',
      'Rajasthan',
      'Assam',
      'Arunachal Pradesh',
      'Goa',
      'Sikkim',
      'Manipur',
      'Meghalaya',
      'Mizoram',
      'Nagaland',
      'Tripura',
      'Ladakh',
      'Jammu & Kashmir',
      'Andaman and Nicobar Islands',
      'Chandigarh',
      'Puducherry',
      'Lakshadweep',
      'Dadra and Nagar Haveli and Daman and Diu',
    ];

    for (const region of expectedRegions) {
      assert.ok(INDIAN_STATES.includes(region), `Missing Indian state/UT: ${region}`);
    }
  });

  it('7. App default store name is Clean Clear Dry Cleaning and supports first-time creation', async () => {
    const { defaultSettings } = await import('../src/data.js');
    assert.strictEqual(defaultSettings.storeName, 'Clean Clear Dry Cleaning');
    assert.strictEqual(defaultSettings.storeNameCreated, false);
  });
});
