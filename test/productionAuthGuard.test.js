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

  it('8. updateAdminProfile persists modified admin name, email, and password successfully', async () => {
    const { updateAdminProfile } = await import('../src/lib/persistence.js');
    const storageMap = new Map();
    global.localStorage = {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };

    try {
      const initialStore = {
        admins: [
          {
            id: 'admin-1',
            name: 'Original Admin',
            email: 'original@freshfold.test',
            password: 'oldPassword123',
            securityQuestion: 'What city is this store in?',
            securityAnswer: 'delhi',
          },
        ],
        settings: {},
      };

      const updatedStore = await updateAdminProfile(
        'admin-1',
        {
          name: 'Nanda Store Manager',
          email: 'nanda@myfreshfold.com',
          password: 'NewSecretPassword2026!',
          securityQuestion: 'What city is this store in?',
          securityAnswer: 'bengaluru',
        },
        initialStore
      );

      const targetAdmin = updatedStore.admins.find((a) => a.id === 'admin-1');
      assert.strictEqual(targetAdmin.name, 'Nanda Store Manager');
      assert.strictEqual(targetAdmin.email, 'nanda@myfreshfold.com');
      assert.strictEqual(targetAdmin.password, 'NewSecretPassword2026!');
      assert.strictEqual(targetAdmin.securityAnswer, 'bengaluru');

      // Old credentials fail
      const oldLogin = verifyAdminCredentials('original@freshfold.test', 'oldPassword123', updatedStore.admins);
      assert.strictEqual(oldLogin.success, false);

      // New credentials log in seamlessly
      const newLogin = verifyAdminCredentials('nanda@myfreshfold.com', 'NewSecretPassword2026!', updatedStore.admins);
      assert.strictEqual(newLogin.success, true);
      assert.strictEqual(newLogin.user.name, 'Nanda Store Manager');
      assert.strictEqual(newLogin.user.email, 'nanda@myfreshfold.com');
    } finally {
      delete global.localStorage;
    }
  });

  it('9. Login credentials work after logout with new password and email', async () => {
    const adminList = [
      {
        id: 'admin-101',
        name: 'Bijita Laundry Pro',
        email: 'bijita@cleanclear.in',
        password: 'SecureLaundryPass1!',
      },
    ];

    // Attempt login with valid credentials
    const loginAttempt = verifyAdminCredentials('bijita@cleanclear.in', 'SecureLaundryPass1!', adminList);
    assert.strictEqual(loginAttempt.success, true);
    assert.strictEqual(loginAttempt.user.email, 'bijita@cleanclear.in');

    // Case-insensitive email and leading/trailing whitespace handling
    const whitespaceAttempt = verifyAdminCredentials('  BIJITA@CleanClear.in  ', 'SecureLaundryPass1!  ', adminList);
    assert.strictEqual(whitespaceAttempt.success, true);
  });

  it('10. Multi-device & cross-browser sync: Empty localStorage device resolves remote admins for production login', async () => {
    const { loadStore, isRemoteMode } = await import('../src/lib/persistence.js');
    
    // Simulate a brand-new device or browser (Device B) with completely empty localStorage
    const storageMapB = new Map();
    global.localStorage = {
      getItem: (key) => storageMapB.get(key) || null,
      setItem: (key, val) => storageMapB.set(key, String(val)),
      removeItem: (key) => storageMapB.delete(key),
      clear: () => storageMapB.clear(),
    };

    // Mock fetch for /api/bootstrap returning database-backed admins created on Device A
    const originalFetch = global.fetch;
    global.fetch = async (url) => {
      if (String(url).includes('/api/bootstrap')) {
        return {
          ok: true,
          json: async () => ({
            customers: [],
            orders: [],
            customerPackages: [],
            payments: [],
            packageSales: [],
            walletTransactions: [],
            packages: [],
            settings: { storeName: 'Clean Clear Galleria' },
            staff: [{ id: 'staff-1', name: 'Cashier 1', role: 'cashier', pin: '5555' }],
            admins: [
              {
                id: 'admin-device-a',
                name: 'Device A Admin',
                email: 'owner@galleriafreshfold.com',
                password: 'MySecretPassword2026!',
                securityQuestion: 'What city is this store in?',
                securityAnswer: 'gurugram',
              },
            ],
          }),
        };
      }
      return { ok: true, json: async () => ({}) };
    };

    const prevEnv = process.env.VITE_ALLOW_DEMO_ACCOUNTS;
    const prevProd = process.env.NODE_ENV;
    process.env.VITE_ALLOW_DEMO_ACCOUNTS = 'false';
    process.env.NODE_ENV = 'production';

    try {
      // Device B loads store from remote database
      const storeData = await loadStore();
      assert.strictEqual(isRemoteMode(), true);
      assert.ok(Array.isArray(storeData.admins));
      assert.strictEqual(storeData.admins.length, 1);
      assert.strictEqual(storeData.admins[0].email, 'owner@galleriafreshfold.com');

      // Admin on Device B signs in in production mode with credentials created on Device A
      const loginAttempt = verifyAdminCredentials(
        'owner@galleriafreshfold.com',
        'MySecretPassword2026!',
        storeData.admins
      );
      assert.strictEqual(loginAttempt.success, true);
      assert.strictEqual(loginAttempt.user.name, 'Device A Admin');
      assert.strictEqual(loginAttempt.user.email, 'owner@galleriafreshfold.com');
    } finally {
      process.env.VITE_ALLOW_DEMO_ACCOUNTS = prevEnv;
      process.env.NODE_ENV = prevProd;
      global.fetch = originalFetch;
      const { setRemoteMode } = await import('../src/lib/persistence.js');
      setRemoteMode(false);
      delete global.localStorage;
    }
  });

  it('11. Password preservation: Updating name/email without password preserves original password', async () => {
    const { updateAdminProfile, saveSettings } = await import('../src/lib/persistence.js');
    const storageMap = new Map();
    global.localStorage = {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };

    try {
      const initialStore = {
        admins: [
          {
            id: 'admin-99',
            name: 'Original Name',
            email: 'admin99@freshfold.com',
            password: 'KeepThisPasswordStrong123!',
            securityQuestion: 'What city?',
            securityAnswer: 'delhi',
          },
        ],
        settings: { storeName: 'Clean Clear' },
      };

      // 1. Update name only, omitting password (or passing empty password)
      const updatedStore = await updateAdminProfile(
        'admin-99',
        {
          name: 'Renamed Admin',
          email: 'admin99@freshfold.com',
          password: '', // Empty password field must NOT wipe out existing password
        },
        initialStore
      );

      const targetAdmin = updatedStore.admins.find((a) => a.id === 'admin-99');
      assert.strictEqual(targetAdmin.name, 'Renamed Admin');
      // Password remains intact!
      assert.strictEqual(targetAdmin.password, 'KeepThisPasswordStrong123!');

      // 2. Saving general store settings preserves admins array and does not erase it
      const savedSettingsStore = await saveSettings(
        { storeName: 'Clean Clear Dry Cleaning - Sector 28', taxPercent: 18 },
        updatedStore
      );
      assert.ok(Array.isArray(savedSettingsStore.settings.admins));
      assert.strictEqual(savedSettingsStore.settings.admins[0].password, 'KeepThisPasswordStrong123!');

      // User can still sign in with original password
      const loginAttempt = verifyAdminCredentials(
        'admin99@freshfold.com',
        'KeepThisPasswordStrong123!',
        savedSettingsStore.settings.admins
      );
      assert.strictEqual(loginAttempt.success, true);
    } finally {
      delete global.localStorage;
    }
  });

  it('12. createAdmin persists admin and allows immediate & subsequent login', async () => {
    const { createAdmin } = await import('../src/lib/persistence.js');
    const storageMap = new Map();
    global.localStorage = {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };

    try {
      const curStore = {
        admins: [],
        settings: {},
      };

      const newAdminData = {
        name: 'New Franchise Owner',
        email: 'franchise@cleanclear.in',
        password: 'FranchiseSecurePass99!',
        securityQuestion: 'What city is this store in?',
        securityAnswer: 'mumbai',
      };

      const nextStore = await createAdmin(newAdminData, curStore);
      assert.ok(Array.isArray(nextStore.admins));
      assert.strictEqual(nextStore.admins.length, 1);
      assert.strictEqual(nextStore.admins[0].email, 'franchise@cleanclear.in');

      // Verify credentials validate successfully
      const loginRes = verifyAdminCredentials(
        'franchise@cleanclear.in',
        'FranchiseSecurePass99!',
        nextStore.admins
      );
      assert.strictEqual(loginRes.success, true);
      assert.strictEqual(loginRes.user.name, 'New Franchise Owner');
    } finally {
      delete global.localStorage;
    }
  });

  it('13. deleteAdmin successfully removes target administrator when multiple admins exist', async () => {
    const { deleteAdmin } = await import('../src/lib/persistence.js');
    const storageMap = new Map();
    global.localStorage = {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };

    try {
      const storeWithTwoAdmins = {
        admins: [
          {
            id: 'admin-owner',
            name: 'Store Owner',
            email: 'owner@cleanclear.in',
            password: 'OwnerPassword2026!',
          },
          {
            id: 'admin-temp',
            name: 'Temporary Admin',
            email: 'temp@cleanclear.in',
            password: 'TempPassword2026!',
          },
        ],
        settings: {},
      };

      // Admin A deletes Admin B
      const updatedStore = await deleteAdmin('admin-temp', storeWithTwoAdmins);
      assert.strictEqual(updatedStore.admins.length, 1);
      assert.strictEqual(updatedStore.admins[0].id, 'admin-owner');
      assert.strictEqual(updatedStore.admins.find((a) => a.id === 'admin-temp'), undefined);

      // Verify removed admin can no longer log in
      const failedLogin = verifyAdminCredentials('temp@cleanclear.in', 'TempPassword2026!', updatedStore.admins);
      assert.strictEqual(failedLogin.success, false);

      // Verify remaining owner can still log in
      const ownerLogin = verifyAdminCredentials('owner@cleanclear.in', 'OwnerPassword2026!', updatedStore.admins);
      assert.strictEqual(ownerLogin.success, true);
    } finally {
      delete global.localStorage;
    }
  });

  it('14. deleteAdmin throws error and enforces safety guard when attempting to delete the sole remaining administrator', async () => {
    const { deleteAdmin } = await import('../src/lib/persistence.js');
    const storageMap = new Map();
    global.localStorage = {
      getItem: (key) => storageMap.get(key) || null,
      setItem: (key, val) => storageMap.set(key, String(val)),
      removeItem: (key) => storageMap.delete(key),
      clear: () => storageMap.clear(),
    };

    try {
      const storeWithOneAdmin = {
        admins: [
          {
            id: 'admin-sole',
            name: 'Sole Store Administrator',
            email: 'sole@cleanclear.in',
            password: 'SolePassword2026!',
          },
        ],
        settings: {},
      };

      // Attempting to delete the only admin must throw an error
      await assert.rejects(
        async () => {
          await deleteAdmin('admin-sole', storeWithOneAdmin);
        },
        {
          name: 'Error',
          message: /cannot remove the last administrator/i,
        }
      );
    } finally {
      delete global.localStorage;
    }
  });
});

