import React, { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { CheckCircle2, Store } from 'lucide-react';

import {
  assignPackage, clearAdminSession, createAdmin, createCustomer, createOrder,
  createPackage, deleteAdmin, deleteCustomer, deletePackage, getAdminSession, isRemoteMode,
  loadLocal, loadStore, recordPayment, saveSettings, saveStaff, setAdminSession,
  updateAdminProfile, updateCustomer, updateOrderStatus, updatePackage,
  saveCustomAddon, saveCustomBrand, saveCustomColor, saveCustomDefect,
  AuthRequiredError, UNAUTHORIZED_EVENT, detectBackend, dropAdminMode, elevateToAdmin, getAuthToken,
  getRecoveryQuestion, loginAdmin, loginStaff, logoutSession, resetPasswordWithAnswer, setupStore,
} from './lib/persistence.js';
import {
  exportOrdersToExcel,
  filterOrdersByDate,
  getAvailableYears,
  getFilterPeriodLabel,
} from './lib/exportUtils.js';

// Modals & Subcomponents
import AdminAuthModal from './components/AdminAuthModal.jsx';
import PackageManageModal from './components/PackageManageModal.jsx';
import PackageSaleModal from './components/PackageSaleModal.jsx';
import OrderDetailModal from './components/OrderDetailModal.jsx';
import PaymentModal from './components/PaymentModal.jsx';
import CustomerModal from './components/CustomerModal.jsx';
import PosRegister from './components/PosRegister.jsx';
import PublicBillView from './components/PublicBillView.jsx';
import AppLoginScreen from './components/AppLoginScreen.jsx';
import { AppSkeleton } from './components/SkeletonLoader.jsx';
import AppSidebar from './components/AppSidebar.jsx';
import AppTopbar from './components/AppTopbar.jsx';
import {
  isDemoAllowed,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
} from './lib/authConfig.js';

// Page views (rendered by the `view` state)
import DashboardView from './views/DashboardView.jsx';
import OrdersView from './views/OrdersView.jsx';
import CustomersView from './views/CustomersView.jsx';
import CustomerDetailView from './views/CustomerDetailView.jsx';
import PackagesView from './views/PackagesView.jsx';

// jsPDF, html2canvas and qrcode are only needed for receipts, pamphlets and PDFs,
// so those screens load on demand instead of in the initial bundle.
const ThermalReceiptModal = lazy(() => import('./components/ThermalReceiptModal.jsx'));
const PamphletModal = lazy(() => import('./components/PamphletModal.jsx'));
const SettingsModal = lazy(() => import('./components/SettingsModal.jsx'));

export default function App() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const billParam = urlParams?.get('bill');
  const tokenParam = urlParams?.get('token');

  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'new-order' | 'customers' | 'customer-detail' | 'orders' | 'packages'
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerDetailTab, setCustomerDetailTab] = useState('overview'); // 'overview' | 'packages' | 'ledger'
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderTimeFilter, setOrderTimeFilter] = useState('all'); // 'all' | 'this-week' | 'this-month' | 'range'
  const [orderStartDate, setOrderStartDate] = useState('');
  const [orderEndDate, setOrderEndDate] = useState('');
  const [orderFilterYear, setOrderFilterYear] = useState('all');
  const [orderFilterMonth, setOrderFilterMonth] = useState('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [adminUser, setAdminUserState] = useState(null);
  // In remote mode the session comes from the server (bootstrap `me`), never from localStorage alone.
  const [authSession, setAuthSession] = useState(null);
  const [backend, setBackend] = useState(null); // { database, demo, setupRequired, storeName, tagline }

  const [modal, setModal] = useState(null);

  // Collapsible sidebar state (persisted)
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    try {
      return localStorage.getItem('freshfold_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const toggleSidebar = () => {
    setSidebarCollapsed((prev) => {
      const next = !prev;
      try {
        localStorage.setItem('freshfold_sidebar_collapsed', String(next));
      } catch {}
      return next;
    });
  };

  const handleNavigate = (newView) => {
    setView(newView);
    setMobileMenuOpen(false);
  };

  // Applies a freshly loaded remote store, including the signed-in identity.
  const applyLoadedStore = (loaded) => {
    setData(loaded);
    if (loaded?.me) {
      setAuthSession(loaded.me);
      setActiveSession(loaded.me);
      setAdminUserState(loaded.me.isAdmin ? (loaded.me.admin || loaded.me) : null);
    }
    setSelectedCustomerId((prev) => prev || loaded?.customers?.[0]?.id || '');
  };

  useEffect(() => {
    if (billParam) return undefined;
    let cancelled = false;
    (async () => {
      const info = await detectBackend();
      if (cancelled) return;
      setBackend(info);

      if (!info.database) {
        // Browser-only demo mode: data and sign-in live in this browser.
        const local = loadLocal();
        setData(local);
        setAuthSession(getActiveSession());
        const savedSession = getActiveSession();
        const savedAdmin = getAdminSession();
        if (savedSession && (savedSession.role === 'admin' || savedSession.type === 'admin')) setAdminUserState(savedSession);
        else if (savedAdmin) setAdminUserState(savedAdmin);
        if (local?.customers?.length > 0) setSelectedCustomerId(local.customers[0].id);
        return;
      }

      if (!getAuthToken()) return;
      try {
        const loaded = await loadStore();
        if (!cancelled) applyLoadedStore(loaded);
      } catch (err) {
        if (cancelled) return;
        clearActiveSession();
        clearAdminSession();
        if (!(err instanceof AuthRequiredError)) showToast(err.message || 'Could not reach the store server.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  // The API signals an expired or revoked session: drop all in-memory data and show sign-in.
  useEffect(() => {
    const onUnauthorized = () => {
      clearActiveSession();
      clearAdminSession();
      setAuthSession(null);
      setAdminUserState(null);
      setModal(null);
      setData(null);
      setToast('Your session has ended. Please sign in again.');
    };
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized);
  }, []);

  useEffect(() => {
    if (!toast) return undefined;
    const timer = setTimeout(() => setToast(''), 3400);
    return () => clearTimeout(timer);
  }, [toast]);

  const showToast = (msg) => setToast(msg);

  // Mutation helper
  const runMutation = async (operation, successMessage) => {
    if (!data || busy) return null;
    setBusy(true);
    try {
      const nextData = await operation(data);
      setData(nextData);
      if (successMessage) showToast(successMessage);
      return nextData;
    } catch (err) {
      showToast(err.message || 'Operation could not be completed.');
      return null;
    } finally {
      setBusy(false);
    }
  };

  // Active Terminal Staff Member
  const currentStaff = useMemo(() => {
    return authSession || data?.staff?.[0] || null;
  }, [authSession, data]);

  // Terminal Lock / Auth Helpers
  const handleLockTerminal = (message = 'Terminal locked. Sign in to continue.') => {
    logoutSession();
    clearActiveSession();
    clearAdminSession();
    setAuthSession(null);
    setAdminUserState(null);
    setModal(null);
    // Remote data stays on the server; don't keep customer records in memory on a locked terminal.
    if (isRemoteMode()) setData(null);
    showToast(message);
  };

  // Called after any successful sign-in (PIN, admin login, setup, password reset).
  const handleAuthenticated = async (user, localData = null) => {
    if (isRemoteMode()) {
      const loaded = await loadStore();
      applyLoadedStore(loaded);
      return;
    }
    if (localData) setData(localData);
    setAuthSession(user);
    setActiveSession(user);
    if (user.role === 'admin' || user.type === 'admin') {
      setAdminUserState(user);
      setAdminSession(user);
    }
  };

  const handleAdminLogin = async (admin) => {
    setAdminUserState(admin);
    setAdminSession(admin);
    // Admin-only data (e.g. the administrator directory) is only sent to admin sessions.
    if (isRemoteMode()) {
      try {
        applyLoadedStore(await loadStore());
      } catch (err) {
        showToast(err.message);
      }
    }
  };

  const handleAdminLogout = async () => {
    const inherentlyAdmin = authSession?.type === 'admin' || (authSession?.staffRole ?? authSession?.role) === 'admin';
    if (inherentlyAdmin) {
      handleLockTerminal('Admin session ended. Terminal locked.');
      return;
    }
    await dropAdminMode();
    setAdminUserState(null);
    clearAdminSession();
    if (isRemoteMode()) {
      try {
        applyLoadedStore(await loadStore());
      } catch {}
    }
    showToast('Logged out of Admin mode. Staff session remains active.');
  };

  const requireAdmin = (callback) => {
    if (adminUser) {
      callback();
    } else {
      setModal({ type: 'admin-auth', onSuccess: callback });
    }
  };

  // Active customer for detail view
  const currentDetailCustomer = useMemo(() => {
    return data?.customers.find((c) => c.id === selectedCustomerId) || data?.customers[0] || null;
  }, [data, selectedCustomerId]);

  const customerOrders = useMemo(() => {
    if (!currentDetailCustomer) return [];
    return data?.orders.filter((o) => o.customerId === currentDetailCustomer.id) || [];
  }, [data, currentDetailCustomer]);

  const customerPackages = useMemo(() => {
    if (!currentDetailCustomer) return [];
    return data?.customerPackages.filter((cp) => cp.customerId === currentDetailCustomer.id) || [];
  }, [data, currentDetailCustomer]);

  const customerWalletTx = useMemo(() => {
    if (!currentDetailCustomer) return [];
    return data?.walletTransactions.filter((tx) => tx.customerId === currentDetailCustomer.id) || [];
  }, [data, currentDetailCustomer]);

  const customerDue = customerOrders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);

  // Store-wide live counter stats for Home Dashboard
  const dashboardStats = useMemo(() => {
    if (!data) return { totalOrders: 0, inProcessing: 0, ready: 0, totalDue: 0 };
    const inProcessing = data.orders.filter((o) => ['Received', 'Processing'].includes(o.status)).length;
    const ready = data.orders.filter((o) => o.status === 'Ready').length;
    const totalDue = data.orders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);
    return {
      totalOrders: data.orders.length,
      inProcessing,
      ready,
      totalDue,
    };
  }, [data]);

  // Global search autocomplete
  const searchResults = useMemo(() => {
    if (!data || globalSearch.trim().length < 2) return [];
    const query = globalSearch.trim().toLowerCase();
    return data.customers.filter(
      (c) => c.name.toLowerCase().includes(query) || c.mobile.includes(query)
    ).slice(0, 6);
  }, [data, globalSearch]);

  // Target orders for detail / payment / receipt modals
  const activeOrder = useMemo(() => {
    if (!modal?.orderId) return null;
    return data?.orders.find((o) => o.id === modal.orderId) || null;
  }, [data, modal?.orderId]);

  const activeOrderCustomer = useMemo(() => {
    if (!activeOrder) return currentDetailCustomer;
    return data?.customers.find((c) => c.id === activeOrder.customerId) || currentDetailCustomer;
  }, [data, activeOrder, currentDetailCustomer]);

  const activeOrderPayments = useMemo(() => {
    if (!activeOrder) return [];
    return data?.payments.filter((p) => p.orderId === activeOrder.id) || [];
  }, [data, activeOrder]);

  // Dynamic available years from order history
  const availableYears = useMemo(() => {
    return getAvailableYears(data?.orders || []);
  }, [data?.orders]);

  // Combined filtered orders (Status + Period + Search query)
  const filteredOrders = useMemo(() => {
    if (!data?.orders) return [];

    let list = data.orders;

    // 1. Status filter
    if (orderStatusFilter !== 'All') {
      list = list.filter((o) => o.status === orderStatusFilter);
    }

    // 2. Date / Period filter
    list = filterOrdersByDate({
      orders: list,
      timePreset: orderTimeFilter,
      selectedYear: orderFilterYear,
      selectedMonth: orderFilterMonth,
      startDate: orderStartDate,
      endDate: orderEndDate,
    });

    // 3. Search query filter
    if (orderSearchQuery.trim()) {
      const q = orderSearchQuery.trim().toLowerCase();
      list = list.filter((o) => {
        const cust = data.customers.find((c) => c.id === o.customerId);
        return (
          o.orderNo?.toLowerCase().includes(q) ||
          cust?.name?.toLowerCase().includes(q) ||
          cust?.mobile?.includes(q)
        );
      });
    }

    return list;
  }, [data?.orders, data?.customers, orderStatusFilter, orderTimeFilter, orderFilterYear, orderFilterMonth, orderStartDate, orderEndDate, orderSearchQuery]);

  const periodLabel = useMemo(() => {
    return getFilterPeriodLabel({
      timePreset: orderTimeFilter,
      selectedYear: orderFilterYear,
      selectedMonth: orderFilterMonth,
      startDate: orderStartDate,
      endDate: orderEndDate,
    });
  }, [orderTimeFilter, orderFilterYear, orderFilterMonth, orderStartDate, orderEndDate]);

  const filteredMetrics = useMemo(() => {
    const totalAmount = filteredOrders.reduce((sum, o) => sum + (Number(o.totalAmount) || 0), 0);
    const totalPaid = filteredOrders.reduce((sum, o) => sum + (Number(o.paidAmount) || 0), 0);
    const totalBalance = filteredOrders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);
    return {
      count: filteredOrders.length,
      totalAmount,
      totalPaid,
      totalBalance,
    };
  }, [filteredOrders]);

  const handleExportExcel = () => {
    if (filteredOrders.length === 0) {
      showToast('No orders found to export.');
      return;
    }
    const res = exportOrdersToExcel({
      orders: filteredOrders,
      customers: data.customers,
      settings: data.settings,
      timeLabel: periodLabel,
    });
    if (res.success) {
      showToast(`Exported ${res.count} orders to Excel successfully.`);
    } else {
      showToast(res.error || 'Failed to export orders.');
    }
  };

  const handleDownloadAllInvoices = () => {
    if (filteredOrders.length === 0) {
      showToast('No orders found to generate invoices.');
      return;
    }
    showToast(`Generating PDF for ${filteredOrders.length} invoices...`);
    setTimeout(async () => {
      try {
        const { downloadBatchInvoicesPdf } = await import('./lib/pdfGenerator.js');
        const res = downloadBatchInvoicesPdf({
          orders: filteredOrders,
          customers: data.customers,
          settings: data.settings,
          payments: data.payments,
          format: data.settings?.invoiceFormat || 'thermal',
          cashierName: currentStaff?.name || 'Store Cashier',
          filename: `CleanClear_All_Invoices_${periodLabel.replace(/[^a-zA-Z0-9_\-]/g, '_')}.pdf`,
        });
        if (res?.success) {
          showToast(`Downloaded all ${res.count} invoices in a single PDF.`);
        }
      } catch (err) {
        console.error('Batch invoices download error:', err);
        showToast('Could not generate batch invoices PDF.');
      }
    }, 50);
  };

  // Public digital bills never load the store or require a session.
  if (billParam) {
    return <PublicBillView billParam={billParam} tokenParam={tokenParam} />;
  }

  if (!backend || (!backend.database && !data)) {
    return <AppSkeleton />;
  }

  const remote = Boolean(backend.database);
  const demoMode = remote ? Boolean(backend.demo) : isDemoAllowed();

  if (!authSession) {
    return (
      <AppLoginScreen
        storeName={data?.settings?.storeName || backend.storeName || 'Clean Clear Dry Cleaning'}
        tagline={data?.settings?.tagline || backend.tagline || 'Counter & Store Management System'}
        showDemoHints={demoMode}
        setupRequired={remote && Boolean(backend.setupRequired)}
        // Remote: anyone may only create the *first* administrator; later admins are added in Settings.
        allowSignup={remote ? Boolean(backend.setupRequired) : true}
        onPinLogin={async (pin) => {
          const user = await loginStaff(pin, data);
          await handleAuthenticated(user);
          return user;
        }}
        onAdminLogin={async (email, password) => {
          const user = await loginAdmin(email, password, data);
          await handleAuthenticated(user);
          return user;
        }}
        onSetup={async (newAdmin, storeName) => {
          const { user, data: next } = await setupStore(newAdmin, storeName, data);
          setBackend((prev) => ({ ...prev, setupRequired: false }));
          await handleAuthenticated(user, next);
          return user;
        }}
        onToast={showToast}
      />
    );
  }

  if (!data) {
    return <AppSkeleton />;
  }

  return (
    <div className="app-shell">
      {/* 1. DARK SIDEBAR NAVIGATION (COLLAPSIBLE) */}
      <AppSidebar
        data={data}
        view={view}
        setModal={setModal}
        requireAdmin={requireAdmin}
        sidebarCollapsed={sidebarCollapsed}
        mobileMenuOpen={mobileMenuOpen}
        toggleSidebar={toggleSidebar}
        setMobileMenuOpen={setMobileMenuOpen}
        handleNavigate={handleNavigate}
        authSession={authSession}
        adminUser={adminUser}
        handleAdminLogout={handleAdminLogout}
        handleLockTerminal={handleLockTerminal}
      />

      {/* Backdrop for mobile drawer */}
      {mobileMenuOpen && (
        <div
          className="sidebar-backdrop"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}

      {/* 2. MAIN FULL-SCREEN SHELL */}
      <div className="main-shell">
        {/* Top Shimmer API In-flight Indicator */}
        {busy && <div className="top-shimmer-progress" />}

        {/* Topbar */}
        <AppTopbar
          data={data}
          view={view}
          setView={setView}
          setModal={setModal}
          sidebarCollapsed={sidebarCollapsed}
          toggleSidebar={toggleSidebar}
          setMobileMenuOpen={setMobileMenuOpen}
          authSession={authSession}
          adminUser={adminUser}
          handleAdminLogout={handleAdminLogout}
          handleLockTerminal={handleLockTerminal}
          currentDetailCustomer={currentDetailCustomer}
          globalSearch={globalSearch}
          setGlobalSearch={setGlobalSearch}
          searchResults={searchResults}
          setSelectedCustomerId={setSelectedCustomerId}
        />

        {/* Page Content Body */}
        <main className="page-content" style={{ flex: 1, width: '100%', maxWidth: '100%' }}>
          {/* ========================================================= */}
          {/* PAGE 1: HOME POS COUNTER DASHBOARD                        */}
          {/* ========================================================= */}
          {view === 'dashboard' && (
            <DashboardView
              data={data}
              setView={setView}
              setModal={setModal}
              setOrderStatusFilter={setOrderStatusFilter}
              dashboardStats={dashboardStats}
            />
          )}

          {/* ========================================================= */}
          {/* PAGE 2: DEDICATED NEW ORDER / POS REGISTER PAGE           */}
          {/* ========================================================= */}
          {view === 'new-order' && (
            <PosRegister
              customers={data.customers}
              customerPackages={data.customerPackages}
              packages={data.packages}
              orders={data.orders}
              initialCustomer={currentDetailCustomer}
              settings={data.settings}
              addons={data.addons}
              brands={data.brands}
              colors={data.colors}
              defects={data.defects}
              onSaveAddon={async (addon) => {
                await runMutation((cur) => saveCustomAddon(addon, cur), `Add-on "${addon.name}" saved.`);
              }}
              onSaveBrand={async (brand) => {
                await runMutation((cur) => saveCustomBrand(brand, cur), `Brand "${brand}" saved.`);
              }}
              onSaveColor={async (color) => {
                await runMutation((cur) => saveCustomColor(color, cur), `Color "${color}" saved.`);
              }}
              onSaveDefect={async (defect) => {
                await runMutation((cur) => saveCustomDefect(defect, cur), `Defect "${defect}" saved.`);
              }}
              onBack={() => setView('dashboard')}
              onOpenNewCustomerModal={() => setModal({ type: 'customer-new' })}
              onCompleteOrder={async (payload) => {
                const next = await runMutation((cur) => createOrder(payload, cur), 'Order placed successfully!');
                if (next && next.orders.length > 0) {
                  // Immediately open the thermal receipt modal for 1-click download/print
                  setModal({ type: 'thermal-receipt', orderId: next.orders[0].id });
                }
              }}
              onToast={showToast}
            />
          )}

          {/* ========================================================= */}
          {/* PAGE 3: DEDICATED ORDER HISTORY / ALL ORDERS PAGE         */}
          {/* ========================================================= */}
          {view === 'orders' && (
            <OrdersView
              data={data}
              setModal={setModal}
              setOrderStatusFilter={setOrderStatusFilter}
              periodLabel={periodLabel}
              handleExportExcel={handleExportExcel}
              handleDownloadAllInvoices={handleDownloadAllInvoices}
              filteredOrders={filteredOrders}
              filteredMetrics={filteredMetrics}
              orderTimeFilter={orderTimeFilter}
              setOrderTimeFilter={setOrderTimeFilter}
              orderStartDate={orderStartDate}
              setOrderStartDate={setOrderStartDate}
              orderEndDate={orderEndDate}
              setOrderEndDate={setOrderEndDate}
              orderSearchQuery={orderSearchQuery}
              setOrderSearchQuery={setOrderSearchQuery}
              orderStatusFilter={orderStatusFilter}
              setOrderFilterYear={setOrderFilterYear}
              setOrderFilterMonth={setOrderFilterMonth}
            />
          )}

          {/* ========================================================= */}
          {/* PAGE 4: DEDICATED CUSTOMER BOOK DIRECTORY                 */}
          {/* ========================================================= */}
          {view === 'customers' && (
            <CustomersView
              data={data}
              setView={setView}
              setModal={setModal}
              customerSearchQuery={customerSearchQuery}
              setCustomerSearchQuery={setCustomerSearchQuery}
              setSelectedCustomerId={setSelectedCustomerId}
            />
          )}

          {/* ========================================================= */}
          {/* PAGE 5: DEDICATED INDIVIDUAL CUSTOMER WORKSPACE PAGE      */}
          {/* ========================================================= */}
          {view === 'customer-detail' && currentDetailCustomer && (
            <CustomerDetailView
              setView={setView}
              setModal={setModal}
              currentDetailCustomer={currentDetailCustomer}
              customerDue={customerDue}
              customerOrders={customerOrders}
              customerPackages={customerPackages}
              customerWalletTx={customerWalletTx}
              customerDetailTab={customerDetailTab}
              setCustomerDetailTab={setCustomerDetailTab}
            />
          )}

          {/* ========================================================= */}
          {/* PAGE 6: PACKAGE PLANS CATALOG PAGE                        */}
          {/* ========================================================= */}
          {view === 'packages' && (
            <PackagesView
              data={data}
              setModal={setModal}
              requireAdmin={requireAdmin}
            />
          )}
        </main>
      </div>

      {/* --- MODAL DIALOGS --- */}

      {/* 1. ADMIN AUTH MODAL (SIGN IN, SIGN UP, FORGOT PASSWORD) */}
      <AdminAuthModal
        isOpen={modal?.type === 'admin-auth'}
        onClose={() => setModal(null)}
        allowSignup={!remote}
        showDemoHint={demoMode}
        onAuthenticate={(email, password) => elevateToAdmin(email, password, data)}
        onRecoverQuestion={(email) => getRecoveryQuestion(email, data)}
        onResetPassword={async (email, answer, newPassword) => {
          const { user, data: next } = await resetPasswordWithAnswer(email, answer, newPassword, data);
          if (remote) await handleAuthenticated(user);
          else if (next) setData(next);
          return user.admin || user;
        }}
        onLoginSuccess={async (admin) => {
          const onSuccess = modal?.onSuccess;
          await handleAdminLogin(admin);
          if (onSuccess) onSuccess();
        }}
        onCreateAdmin={async (newAdmin) => {
          await runMutation((cur) => createAdmin(newAdmin, cur), 'Admin account created.');
        }}
        onToast={showToast}
      />

      {/* 2. STORE & TAX SETTINGS MODAL */}
      {modal?.type === 'settings' && (
        <Suspense fallback={null}>
          <SettingsModal
            isOpen
            onClose={() => setModal(null)}
            settings={data.settings}
            staffList={data.staff}
            adminUser={adminUser || authSession}
            adminsList={data.admins || []}
            onOpenPamphlet={() => setModal({ type: 'pamphlet' })}
            onSaveSettings={async (newSettings) => {
              await runMutation((cur) => saveSettings(newSettings, cur), 'Settings saved.');
            }}
            onSaveStaff={async (newStaff) => {
              await runMutation((cur) => saveStaff(newStaff, cur), 'Staff updated.');
            }}
            onUpdateAdmin={async (adminId, updatedFields) => {
              await runMutation(async (cur) => {
                const next = await updateAdminProfile(adminId, updatedFields, cur);
                const updatedUser = (next.admins || []).find((a) => a.id === adminId) || {
                  id: adminId,
                  name: updatedFields.name,
                  email: updatedFields.email,
                  role: 'admin',
                  type: 'admin',
                };
                setAdminUserState((prev) => (prev ? { ...prev, ...updatedUser } : prev));
                setAuthSession((prev) => (prev?.role === 'admin' || prev?.type === 'admin' ? { ...prev, ...updatedUser } : prev));
                return next;
              }, 'Administrator profile and credentials updated.');
            }}
            onDeleteAdmin={async (adminId) => {
              await runMutation(async (cur) => {
                const next = await deleteAdmin(adminId, cur);
                if (authSession?.id === adminId) {
                  handleLockTerminal();
                }
                return next;
              }, 'Administrator removed from shop.');
            }}
            onCreateAdmin={async (newAdmin) => {
              await runMutation((cur) => createAdmin(newAdmin, cur), 'Administrator registered.');
            }}
            onToast={showToast}
          />
        </Suspense>
      )}

      {/* 3. PACKAGE MANAGEMENT MODAL (CREATE, EDIT, DELETE - NO VALIDITY) */}
      <PackageManageModal
        isOpen={modal?.type === 'manage-packages'}
        onClose={() => setModal(null)}
        packages={data.packages}
        onCreatePackage={async (pkg) => {
          await runMutation((cur) => createPackage(pkg, cur), 'Package template created.');
        }}
        onUpdatePackage={async (id, pkg) => {
          await runMutation((cur) => updatePackage(id, pkg, cur), 'Package template updated.');
        }}
        onDeletePackage={async (id) => {
          await runMutation((cur) => deletePackage(id, cur), 'Package template deleted.');
        }}
        onToast={showToast}
      />

      {/* 4. PACKAGE SALE MODAL */}
      <PackageSaleModal
        isOpen={modal?.type === 'package-sale'}
        onClose={() => setModal(null)}
        customer={currentDetailCustomer}
        packages={data.packages}
        onAssignPackage={async (customerId, templateId, paymentMethod) => {
          await runMutation((cur) => assignPackage(customerId, templateId, paymentMethod, cur), 'Package activated for customer.');
        }}
        onToast={showToast}
      />

      {/* 5. ORDER DETAIL MODAL */}
      <OrderDetailModal
        isOpen={modal?.type === 'order-detail'}
        onClose={() => setModal(null)}
        order={activeOrder}
        customer={activeOrderCustomer}
        payments={activeOrderPayments}
        onUpdateStatus={async (orderId, status) => {
          await runMutation((cur) => updateOrderStatus(orderId, status, cur), `Order marked as ${status}.`);
        }}
        onOpenPayment={() => setModal({ type: 'payment', orderId: activeOrder.id })}
        onOpenReceipt={() => setModal({ type: 'thermal-receipt', orderId: activeOrder.id })}
        onToast={showToast}
      />

      {/* 6. PAYMENT MODAL */}
      <PaymentModal
        isOpen={modal?.type === 'payment'}
        onClose={() => setModal(null)}
        order={activeOrder}
        customer={activeOrderCustomer}
        onRecordPayment={async (orderId, amount, method) => {
          await runMutation((cur) => recordPayment(orderId, amount, method, cur), 'Payment recorded.');
        }}
        onToast={showToast}
      />

      {/* 7. THERMAL RECEIPT MODAL (80mm PDF, WHATSAPP, WEB SHARE, PRINT) */}
      {modal?.type === 'thermal-receipt' && (
        <Suspense fallback={null}>
          <ThermalReceiptModal
            isOpen
            onClose={() => setModal(null)}
            order={activeOrder}
            customer={activeOrderCustomer}
            settings={data.settings}
            payments={activeOrderPayments}
            currentStaff={adminUser || authSession || { name: 'Counter Cashier' }}
            onToast={showToast}
          />
        </Suspense>
      )}

      {/* 8. CUSTOMER CREATE / EDIT / DELETE MODAL */}
      <CustomerModal
        isOpen={modal?.type === 'customer-new' || modal?.type === 'customer-edit'}
        onClose={() => setModal(null)}
        customer={modal?.type === 'customer-edit' ? modal.customer : null}
        allCustomers={data.customers}
        onSave={async (fields, editingId) => {
          await runMutation(
            (cur) => editingId ? updateCustomer(editingId, fields, cur) : createCustomer(fields, cur),
            editingId ? 'Customer details updated.' : 'Customer created.',
          );
        }}
        onDelete={async (customerId) => {
          await runMutation(
            (cur) => deleteCustomer(customerId, cur),
            'Customer record deleted.',
          );
          if (selectedCustomerId === customerId) {
            setSelectedCustomerId('');
            setView('customers');
          }
        }}
        onToast={showToast}
      />

      {/* 9. STORE PAMPHLET & CUSTOMER CONTACT FLYER MODAL */}
      {modal?.type === 'pamphlet' && (
        <Suspense fallback={null}>
          <PamphletModal
            isOpen
            onClose={() => setModal(null)}
            settings={data.settings}
            packages={data.packages}
            services={data.services}
            onToast={showToast}
          />
        </Suspense>
      )}

      {/* 10. FIRST-TIME STORE NAME ONBOARDING (PRODUCTION MANDATORY) */}
      {!demoMode && adminUser && !data.settings?.storeNameCreated && (
        <div
          className="modal-backdrop"
          style={{
            zIndex: 99998,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(6px)',
          }}
        >
          <div
            className="modal-panel"
            style={{
              maxWidth: '460px',
              width: '90%',
              padding: '28px 26px',
              borderRadius: '20px',
              background: '#ffffff',
              boxShadow: '0 25px 60px rgba(0,0,0,0.3)',
            }}
          >
            <div style={{ textAlign: 'center', marginBottom: '20px' }}>
              <div
                style={{
                  width: '52px',
                  height: '52px',
                  borderRadius: '16px',
                  background: 'linear-gradient(135deg, #2563eb, #0284c7)',
                  color: '#fff',
                  display: 'grid',
                  placeItems: 'center',
                  margin: '0 auto 12px',
                  boxShadow: '0 8px 20px rgba(37, 99, 235, 0.3)',
                }}
              >
                <Store size={26} />
              </div>
              <h2 style={{ margin: '0 0 6px', fontSize: '20px', fontWeight: 800, color: '#0f172a' }}>
                Create Your Store Name
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b', lineHeight: 1.5 }}>
                Please set your store or branch business name. This will appear on all printed invoices, customer WhatsApp receipts, and tax reports.
              </p>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                const form = e.target;
                const name = form.storeNameInput.value.trim();
                if (!name) return;
                await runMutation(
                  (cur) =>
                    saveSettings(
                      {
                        ...cur.settings,
                        storeName: name,
                        storeNameCreated: true,
                      },
                      cur
                    ),
                  `Store Name set to "${name}" successfully!`
                );
              }}
            >
              <div style={{ marginBottom: '18px' }}>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '6px' }}>
                  Store / Branch Name <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <input
                  name="storeNameInput"
                  type="text"
                  defaultValue={data.settings?.storeName || 'Clean Clear Dry Cleaning'}
                  placeholder="e.g. Clean Clear Dry Cleaning - Indiranagar"
                  required
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '11px 14px',
                    borderRadius: '10px',
                    border: '1.5px solid #2563eb',
                    fontSize: '14px',
                    fontWeight: 700,
                    outline: 'none',
                    color: '#0f172a',
                    boxShadow: '0 0 0 3px rgba(37, 99, 235, 0.15)',
                  }}
                />
              </div>

              <button
                type="submit"
                style={{
                  width: '100%',
                  padding: '13px',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#0f172a',
                  color: '#fff',
                  fontSize: '13px',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 4px 14px rgba(15, 23, 42, 0.25)',
                }}
              >
                Save Store Name & Enter Register
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast && (
        <div className="toast">
          <CheckCircle2 size={16} />
          <span>{toast}</span>
        </div>
      )}
    </div>
  );
}
