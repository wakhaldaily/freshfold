import React, { useEffect, useMemo, useState } from 'react';
import {
  BadgePercent, Calendar, CalendarDays, Check, CheckCircle2, ChevronLeft, ChevronRight, Clock3, CreditCard,
  Download, Edit, FileSpreadsheet, Files, FileText, Filter, House, KeyRound, LayoutDashboard, Lock, LogOut, Mail,
  Megaphone, Menu, Minus, Package, PackagePlus, PanelLeft, PanelLeftClose, Pencil, Phone, Plus, Printer, ReceiptText,
  Scale, Search, Settings, ShieldCheck, Shirt, ShoppingBag, Smartphone, Sparkles, Store,
  Trash2, UserPlus, UserRound, Users, Wallet, Waves, Wind, X,
} from 'lucide-react';

import {
  assignPackage, clearAdminSession, createAdmin, createCustomer, createOrder,
  createPackage, deleteAdmin, deleteCustomer, deletePackage, formatMoney, getAdminSession, isRemoteMode,
  loadStore, recordPayment, resetAdminPassword, saveSettings, saveStaff, setAdminSession,
  updateAdminProfile, updateCustomer, updateOrderStatus, updatePackage,
  saveCustomAddon, saveCustomBrand, saveCustomColor, saveCustomDefect,
} from './lib/persistence.js';
import { downloadBatchInvoicesPdf, formatDate, formatDateTime } from './lib/pdfGenerator.js';
import {
  exportOrdersToExcel,
  filterOrdersByDate,
  getAvailableYears,
  getFilterPeriodLabel,
  MONTH_NAMES,
} from './lib/exportUtils.js';

// Modals & Subcomponents
import AdminAuthModal from './components/AdminAuthModal.jsx';
import SettingsModal from './components/SettingsModal.jsx';
import PackageManageModal from './components/PackageManageModal.jsx';
import PackageSaleModal from './components/PackageSaleModal.jsx';
import OrderDetailModal from './components/OrderDetailModal.jsx';
import PaymentModal from './components/PaymentModal.jsx';
import ThermalReceiptModal from './components/ThermalReceiptModal.jsx';
import CustomerModal from './components/CustomerModal.jsx';
import PosRegister from './components/PosRegister.jsx';
import PublicBillView from './components/PublicBillView.jsx';
import AppLoginScreen from './components/AppLoginScreen.jsx';
import PamphletModal from './components/PamphletModal.jsx';
import { AppSkeleton, TableSkeleton } from './components/SkeletonLoader.jsx';
import {
  isDemoAllowed,
  getActiveSession,
  setActiveSession,
  clearActiveSession,
} from './lib/authConfig.js';

export default function App() {
  const urlParams = typeof window !== 'undefined' ? new URLSearchParams(window.location.search) : null;
  const billParam = urlParams?.get('bill');
  const tokenParam = urlParams?.get('token');

  const [data, setData] = useState(null);
  const [view, setView] = useState('dashboard'); // 'dashboard' | 'new-order' | 'customers' | 'customer-detail' | 'orders' | 'packages'
  const [selectedCustomerId, setSelectedCustomerId] = useState('');
  const [customerDetailTab, setCustomerDetailTab] = useState('overview'); // 'overview' | 'packages' | 'ledger'
  const [orderStatusFilter, setOrderStatusFilter] = useState('All');
  const [orderTimeFilter, setOrderTimeFilter] = useState('all'); // 'all' | 'this-week' | 'this-month' | 'this-year' | 'custom'
  const [orderFilterYear, setOrderFilterYear] = useState('all');
  const [orderFilterMonth, setOrderFilterMonth] = useState('all');
  const [orderSearchQuery, setOrderSearchQuery] = useState('');
  const [customerSearchQuery, setCustomerSearchQuery] = useState('');
  const [globalSearch, setGlobalSearch] = useState('');
  const [toast, setToast] = useState('');
  const [busy, setBusy] = useState(false);
  const [adminUser, setAdminUserState] = useState(null);
  const [authSession, setAuthSession] = useState(() => getActiveSession());

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

  useEffect(() => {
    loadStore()
      .then((loaded) => {
        setData(loaded);
        const savedAdmin = getAdminSession();
        if (savedAdmin) {
          setAdminUserState(savedAdmin);
        }
        const savedSession = getActiveSession();
        if (savedSession && (savedSession.role === 'admin' || savedSession.type === 'admin')) {
          setAdminUserState(savedSession);
        }
        if (loaded?.customers?.length > 0) {
          setSelectedCustomerId(loaded.customers[0].id);
        }
      })
      .catch((err) => {
        console.error('Store load error, falling back to local storage:', err);
        try {
          const local = loadLocal();
          setData(local);
        } catch {}
      });
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
  const handleLockTerminal = () => {
    clearActiveSession();
    clearAdminSession();
    setAuthSession(null);
    setAdminUserState(null);
    showToast('Terminal locked. Sign in to continue.');
  };

  const handleAdminLogin = (admin) => {
    setAdminUserState(admin);
    setAdminSession(admin);
  };

  const handleAdminLogout = () => {
    setAdminUserState(null);
    clearAdminSession();
    if (authSession?.role === 'admin' || authSession?.type === 'admin') {
      clearActiveSession();
      setAuthSession(null);
      showToast('Admin session ended. Terminal locked.');
    } else {
      showToast('Logged out of Admin mode. Staff session remains active.');
    }
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
  }, [data?.orders, data?.customers, orderStatusFilter, orderTimeFilter, orderFilterYear, orderFilterMonth, orderSearchQuery]);

  const periodLabel = useMemo(() => {
    return getFilterPeriodLabel({
      timePreset: orderTimeFilter,
      selectedYear: orderFilterYear,
      selectedMonth: orderFilterMonth,
    });
  }, [orderTimeFilter, orderFilterYear, orderFilterMonth]);

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
    setTimeout(() => {
      try {
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

  if (billParam) {
    if (!data) return <AppSkeleton />;
    return <PublicBillView billParam={billParam} tokenParam={tokenParam} localData={data} />;
  }

  if (!data) {
    return <AppSkeleton />;
  }

  if (!authSession) {
    return (
      <AppLoginScreen
        storeName={data.settings?.storeName || 'Clean Clear Dry Cleaning'}
        tagline={data.settings?.tagline || 'Counter & Store Management System'}
        staff={data.staff || []}
        admins={data.admins || []}
        onLoginSuccess={(user) => {
          setAuthSession(user);
          setActiveSession(user);
          if (user.role === 'admin' || user.type === 'admin') {
            setAdminUserState(user);
            setAdminSession(user);
          }
        }}
        onCreateAdmin={async (newAdmin, customStoreName) => {
          await runMutation(async (cur) => {
            let next = await createAdmin(newAdmin, cur);
            if (customStoreName && customStoreName.trim()) {
              next = await saveSettings({
                ...next.settings,
                storeName: customStoreName.trim(),
                storeNameCreated: true,
              }, next);
            }
            return next;
          }, `Store "${customStoreName || 'Clean Clear Dry Cleaning'}" and administrator registered.`);
        }}
        onToast={showToast}
      />
    );
  }

  return (
    <div className="app-shell">
      {/* 1. DARK SIDEBAR NAVIGATION (COLLAPSIBLE) */}
      <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
        {/* Brand Lockup */}
        <div className="brand-lockup">
          <div
            className="brand-mark"
            onClick={sidebarCollapsed ? toggleSidebar : undefined}
            style={{ cursor: sidebarCollapsed ? 'pointer' : 'default' }}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Clean Clear Dry Cleaning'}
          >
            <Sparkles size={18} />
          </div>
          <div>
            <strong>Clean Clear</strong>
            <span>DRY CLEANING</span>
          </div>
          <button
            type="button"
            className="sidebar-collapse-btn"
            onClick={toggleSidebar}
            title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            aria-label={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
          >
            {sidebarCollapsed ? <ChevronRight size={15} /> : <ChevronLeft size={15} />}
          </button>
          <button
            type="button"
            className="icon-button nav-close"
            onClick={() => setMobileMenuOpen(false)}
            aria-label="Close Navigation"
            style={{ marginLeft: 'auto', background: 'transparent', border: 'none', color: '#cbd5e1' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Store Switcher */}
        <div className="store-switcher" title={data.settings?.storeName || 'Clean Clear Dry Cleaning'}>
          <span className="store-dot" />
          <div>
            <span>STORE LOCATION</span>
            <strong>{data.settings?.storeName || 'Clean Clear Dry Cleaning'}</strong>
          </div>
        </div>

        {/* Primary Navigation */}
        <div className="nav-caption">MAIN MENU</div>
        <nav className="primary-nav">
          <button
            type="button"
            className={`nav-item ${view === 'dashboard' ? 'active' : ''}`}
            onClick={() => handleNavigate('dashboard')}
            data-tooltip="Dashboard"
          >
            <LayoutDashboard size={18} />
            <span>Dashboard</span>
          </button>

          <button
            type="button"
            className={`nav-item ${view === 'new-order' ? 'active' : ''}`}
            onClick={() => handleNavigate('new-order')}
            data-tooltip="New Order"
          >
            <Shirt size={18} />
            <span>New Order</span>
          </button>

          <button
            type="button"
            className={`nav-item ${view === 'orders' ? 'active' : ''}`}
            onClick={() => handleNavigate('orders')}
            data-tooltip={`Order History (${data.orders.length})`}
          >
            <ShoppingBag size={18} />
            <span>Order History</span>
            <span className="nav-count">{data.orders.length}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${view === 'customers' || view === 'customer-detail' ? 'active' : ''}`}
            onClick={() => handleNavigate('customers')}
            data-tooltip={`Customer Book (${data.customers.length})`}
          >
            <Users size={18} />
            <span>Customer Book</span>
            <span className="nav-count">{data.customers.length}</span>
          </button>

          <button
            type="button"
            className={`nav-item ${view === 'packages' ? 'active' : ''}`}
            onClick={() => handleNavigate('packages')}
            data-tooltip={`Package Plans (${data.packages.length})`}
          >
            <Package size={18} />
            <span>Package Plans</span>
            <span className="nav-count">{data.packages.length}</span>
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() => {
              setMobileMenuOpen(false);
              setModal({ type: 'pamphlet' });
            }}
            data-tooltip="Store Pamphlet & Customer Flyer"
          >
            <Megaphone size={18} />
            <span>Store Pamphlet</span>
          </button>

          <button
            type="button"
            className="nav-item"
            onClick={() => {
              setMobileMenuOpen(false);
              requireAdmin(() => setModal({ type: 'settings' }));
            }}
            data-tooltip="Store & Tax Settings"
          >
            <Settings size={18} />
            <span>Store & Tax Settings</span>
          </button>
        </nav>

        {/* Sidebar Bottom Status */}
        <div className="sidebar-bottom">
          <div
            className="shift-card"
            data-tooltip={`Shift: ${authSession?.name || 'Counter Staff'}`}
            title={`Logged in: ${authSession?.name || 'Staff'} (${authSession?.role || 'cashier'})`}
          >
            <div className="shift-icon">
              <Clock3 size={16} />
            </div>
            <div>
              <span>COUNTER SHIFT</span>
              <strong>{authSession ? `${authSession.name} (${authSession.role})` : 'Active · Counter'}</strong>
            </div>
            <span className="live-dot" />
          </div>

          {/* Admin Status / Login Chip */}
          {adminUser ? (
            <div
              className="staff-chip"
              style={{ cursor: 'pointer' }}
              onClick={handleAdminLogout}
              data-tooltip="Admin Active (Click to Logout)"
              title="Click to Log Out of Admin Mode"
            >
              <div className="staff-avatar" style={{ background: '#2563eb', color: '#fff' }}>
                {(adminUser?.name || 'Admin')[0]?.toUpperCase()}
              </div>
              <div>
                <strong>{adminUser?.name || 'Administrator'}</strong>
                <span style={{ color: '#53cc9b' }}>Admin Active (Log Out)</span>
              </div>
              <ShieldCheck size={16} color="#53cc9b" />
            </div>
          ) : (
            <div
              className="staff-chip"
              style={{ cursor: 'pointer' }}
              onClick={() => setModal({ type: 'admin-auth' })}
              data-tooltip="Counter Staff (Click for Admin)"
              title="Click to sign in as Administrator"
            >
              <div className="staff-avatar">
                <UserRound size={16} />
              </div>
              <div>
                <strong>Counter Staff</strong>
                <span>Click for Admin Login</span>
              </div>
              <KeyRound size={15} color="#9696ad" />
            </div>
          )}

          {/* Lock Terminal Quick Button */}
          <button
            type="button"
            className="button button-quiet sidebar-lock-btn"
            onClick={handleLockTerminal}
            data-tooltip="Lock POS Terminal"
            title="Lock POS Terminal Screen"
          >
            <Lock size={14} />
            <span className="sidebar-lock-text">Lock Terminal</span>
          </button>
        </div>
      </aside>

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
        <header className="topbar">
          <div className="topbar-left" style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            {/* Mobile Hamburger Menu Button */}
            <button
              type="button"
              className="icon-button menu-toggle"
              onClick={() => setMobileMenuOpen(true)}
              style={{ width: '34px', height: '34px', borderRadius: '8px' }}
              title="Open Navigation Menu"
              aria-label="Open Navigation Menu"
            >
              <Menu size={18} />
            </button>

            {/* Desktop Sidebar Collapse Button */}
            <button
              type="button"
              className="icon-button desktop-only"
              onClick={toggleSidebar}
              style={{ width: '32px', height: '32px', borderRadius: '6px' }}
              title={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
              aria-label={sidebarCollapsed ? 'Expand Sidebar' : 'Collapse Sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft size={16} /> : <PanelLeftClose size={16} />}
            </button>
            <div className="breadcrumb desktop-only">
              <span>Clean Clear Dry Cleaning</span>
              <ChevronRight size={14} />
              <strong>
                {view === 'dashboard' && 'Counter Dashboard'}
                {view === 'new-order' && 'Add New Laundry Order'}
                {view === 'orders' && 'Order History'}
                {view === 'customers' && 'Customer Book'}
                {view === 'customer-detail' && (currentDetailCustomer?.name || 'Customer Workspace')}
                {view === 'packages' && 'Lifetime Packages'}
              </strong>
            </div>
          </div>

          <div className="topbar-actions">
            {/* Global Search Bar */}
            <div className="customer-search-wrap">
              <Search size={16} />
              <input
                type="search"
                placeholder="Search by customer name, mobile phone number, or ID..."
                value={globalSearch}
                onChange={(e) => setGlobalSearch(e.target.value)}
              />
              {globalSearch ? (
                <button
                  type="button"
                  onClick={() => setGlobalSearch('')}
                  style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
                  aria-label="Clear search"
                >
                  <X size={14} />
                </button>
              ) : (
                <kbd>⌘K</kbd>
              )}
              {searchResults.length > 0 && (
                <div className="search-results">
                  {searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomerId(c.id);
                        setView('customer-detail');
                        setGlobalSearch('');
                      }}
                    >
                      <div className="customer-avatar" style={{ width: '28px', height: '28px', fontSize: '11px' }}>
                        {c.name.slice(0, 2).toUpperCase()}
                      </div>
                      <div>
                        <strong>{c.name}</strong>
                        <small>+91 {c.mobile} · Wallet: {formatMoney(c.walletBalance)}</small>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className={`sync-state desktop-only ${isRemoteMode() ? 'sync-online' : ''}`}>
              <span className="sync-dot" />
              <span>{isRemoteMode() ? 'Neon DB Active' : 'Local Storage Ready'}</span>
            </div>

            {adminUser ? (
              <button
                type="button"
                className="button button-quiet desktop-only"
                style={{ minHeight: '36px', fontSize: '11px' }}
                onClick={handleAdminLogout}
              >
                Admin: {adminUser?.name || 'Administrator'} (Log Out)
              </button>
            ) : (
              <button
                type="button"
                className="button button-quiet desktop-only"
                style={{ minHeight: '36px', fontSize: '11px' }}
                onClick={() => setModal({ type: 'admin-auth' })}
              >
                <Lock size={13} /> Admin Login
              </button>
            )}

            <button
              type="button"
              className="button button-quiet desktop-only"
              style={{ minHeight: '36px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '5px' }}
              onClick={handleLockTerminal}
              title={`Active: ${authSession?.name || 'Staff'}. Click to lock POS terminal.`}
            >
              <LogOut size={13} /> Lock Terminal
            </button>
          </div>
        </header>

        {/* Page Content Body */}
        <main className="page-content" style={{ flex: 1, width: '100%', maxWidth: '100%' }}>
          {/* ========================================================= */}
          {/* PAGE 1: HOME POS COUNTER DASHBOARD                        */}
          {/* ========================================================= */}
          {view === 'dashboard' && (
            <div className="dashboard-layout">
              {/* Executive Welcome & Action Banner */}
              <div className="dashboard-welcome-banner">
                <div>
                  <span className="caption-label">Counter Home</span>
                  <h1>
                    Welcome to {data.settings?.storeName || 'Clean Clear Dry Cleaning'}
                  </h1>
                  <p>
                    Frictionless laundry intake, piece and weight orders, and instant thermal receipts.
                  </p>
                </div>

                <div className="dashboard-welcome-actions">
                  <button
                    type="button"
                    className="button button-primary"
                    style={{ minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setView('new-order')}
                  >
                    <Plus size={16} /> New Order (Register)
                  </button>

                  <button
                    type="button"
                    className="button button-secondary"
                    style={{ minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setModal({ type: 'pamphlet' })}
                    title="Generate printable store pamphlet & flyer for customer outreach"
                  >
                    <Megaphone size={15} color="#2563eb" /> Store Pamphlet
                  </button>

                  <button
                    type="button"
                    className="button button-quiet"
                    style={{ minHeight: '44px', fontSize: '13px', display: 'flex', alignItems: 'center', gap: '6px' }}
                    onClick={() => setModal({ type: 'customer-new' })}
                  >
                    <UserPlus size={15} /> Add Customer
                  </button>
                </div>
              </div>

              {/* 4 Counter Summary Metrics */}
              <div className="metric-grid dashboard-metrics-grid">
                <div className="metric-card" onClick={() => setView('orders')}>
                  <div className="metric-top">
                    <span>Total Orders Intake</span>
                    <div className="metric-icon lavender">
                      <ShoppingBag size={16} />
                    </div>
                  </div>
                  <strong className="metric-value">{dashboardStats.totalOrders}</strong>
                  <small>Recorded store laundry orders</small>
                </div>

                <div className="metric-card" onClick={() => { setView('orders'); setOrderStatusFilter('Processing'); }}>
                  <div className="metric-top">
                    <span>In Processing</span>
                    <div className="metric-icon blue">
                      <Shirt size={16} />
                    </div>
                  </div>
                  <strong className="metric-value">{dashboardStats.inProcessing}</strong>
                  <small>Garments in dry clean / wash</small>
                </div>

                <div className="metric-card" onClick={() => { setView('orders'); setOrderStatusFilter('Ready'); }}>
                  <div className="metric-top">
                    <span>Ready for Pickup</span>
                    <div className="metric-icon mint">
                      <Sparkles size={16} />
                    </div>
                  </div>
                  <strong className="metric-value" style={{ color: '#16a34a' }}>{dashboardStats.ready}</strong>
                  <small>Awaiting customer collection</small>
                </div>

                <div className="metric-card" onClick={() => setView('orders')}>
                  <div className="metric-top">
                    <span>Outstanding Due</span>
                    <div className="metric-icon peach">
                      <ReceiptText size={16} />
                    </div>
                  </div>
                  <strong className="metric-value" style={{ color: dashboardStats.totalDue > 0 ? '#c8474e' : '#16a34a' }}>
                    {formatMoney(dashboardStats.totalDue)}
                  </strong>
                  <small>Pending bill collections</small>
                </div>
              </div>

              {/* Active Counter Queue Section */}
              <div className="dashboard-queue-card">
                <div className="dashboard-queue-header">
                  <div>
                    <h3 style={{ margin: 0, fontSize: '16px', color: '#1e293b' }}>Active Counter Queue</h3>
                    <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#64748b' }}>Recent orders currently in progress or ready for pickup</p>
                  </div>

                  <button
                    type="button"
                    className="text-button"
                    onClick={() => setView('orders')}
                  >
                    View All Orders & Order History →
                  </button>
                </div>

                {/* Desktop View Table (> 768px) */}
                <div className="desktop-only orders-table-wrap">
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Order #</th>
                        <th>Customer</th>
                        <th>Service</th>
                        <th>Promised Ready</th>
                        <th>Total Bill</th>
                        <th>Balance Due</th>
                        <th>Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.orders.slice(0, 6).map((o) => {
                        const cust = data.customers.find((c) => c.id === o.customerId);
                        return (
                          <tr key={o.id}>
                            <td>
                              <button
                                type="button"
                                className="order-number"
                                onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                              >
                                {o.orderNo?.startsWith('#') ? o.orderNo : `#${o.orderNo}`}
                              </button>
                            </td>
                            <td>
                              <strong>{cust?.name || 'Customer'}</strong>
                              <small>+91 {cust?.mobile}</small>
                            </td>
                            <td>{o.service} ({o.type})</td>
                            <td>{formatDate(o.dueDate)}</td>
                            <td><strong>{formatMoney(o.totalAmount)}</strong></td>
                            <td className={o.balanceAmount > 0 ? 'balance-due' : 'balance-clear'}>
                              {formatMoney(o.balanceAmount)}
                            </td>
                            <td>
                              <span className={`status-pill status-${o.status.toLowerCase()}`}>
                                <i />
                                {o.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="button button-quiet"
                                  style={{ minHeight: '30px', padding: '0 8px', fontSize: '10px' }}
                                  onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                                >
                                  Manage
                                </button>
                                <button
                                  type="button"
                                  className="icon-button"
                                  style={{ width: '30px', height: '30px' }}
                                  onClick={() => setModal({ type: 'thermal-receipt', orderId: o.id })}
                                  title="Thermal Receipt PDF"
                                >
                                  <ReceiptText size={14} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Mobile View Card List (<= 768px) */}
                <div className="mobile-only mobile-queue-list">
                  {data.orders.slice(0, 6).map((o) => {
                    const cust = data.customers.find((c) => c.id === o.customerId);
                    return (
                      <div key={o.id} className="mobile-queue-item">
                        <div className="mobile-queue-item-top">
                          <button
                            type="button"
                            className="order-number"
                            style={{ fontSize: '13px', fontWeight: 700 }}
                            onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                          >
                            {o.orderNo?.startsWith('#') ? o.orderNo : `#${o.orderNo}`}
                          </button>
                          <span className={`status-pill status-${o.status.toLowerCase()}`}>
                            <i />
                            {o.status}
                          </span>
                        </div>

                        <div className="mobile-queue-item-customer">
                          <strong>{cust?.name || 'Customer'}</strong>
                          <small>+91 {cust?.mobile}</small>
                        </div>

                        <div className="mobile-queue-item-details">
                          <div className="mobile-queue-detail-row">
                            <span className="mobile-queue-detail-label">Service</span>
                            <span className="mobile-queue-detail-val">{o.service}</span>
                          </div>
                          <div className="mobile-queue-detail-row">
                            <span className="mobile-queue-detail-label">Promised</span>
                            <span className="mobile-queue-detail-val">{formatDate(o.dueDate)}</span>
                          </div>
                          <div className="mobile-queue-detail-row">
                            <span className="mobile-queue-detail-label">Total Bill</span>
                            <span className="mobile-queue-detail-val">{formatMoney(o.totalAmount)}</span>
                          </div>
                          <div className="mobile-queue-detail-row">
                            <span className="mobile-queue-detail-label">Balance Due</span>
                            <span className={`mobile-queue-detail-val ${o.balanceAmount > 0 ? 'balance-due' : 'balance-clear'}`} style={{ color: o.balanceAmount > 0 ? '#dc2626' : '#16a34a' }}>
                              {formatMoney(o.balanceAmount)}
                            </span>
                          </div>
                        </div>

                        <div className="mobile-queue-item-actions">
                          <button
                            type="button"
                            className="button button-quiet"
                            style={{ minHeight: '34px', padding: '0 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                          >
                            Manage Order
                          </button>
                          <button
                            type="button"
                            className="button button-secondary"
                            style={{ minHeight: '34px', padding: '0 10px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                            onClick={() => setModal({ type: 'thermal-receipt', orderId: o.id })}
                            title="Thermal Receipt PDF"
                          >
                            <ReceiptText size={13} /> Receipt
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
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
            <div className="responsive-page-card">
              
              {/* Header Title & Batch Export / Invoices Actions */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
                <div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                    <h2 style={{ margin: 0, fontSize: '22px', color: '#1e293b' }}>
                      Order History ({data.orders.length})
                    </h2>
                    <span style={{ fontSize: '12px', background: '#eff6ff', color: '#1d4ed8', border: '1px solid #bfdbfe', padding: '3px 10px', borderRadius: '12px', fontWeight: 600 }}>
                      {periodLabel}
                    </span>
                  </div>
                  <p className="muted-copy" style={{ margin: '4px 0 0' }}>
                    Filter by week, month, or year. Export Excel reports or download all customer invoices at once.
                  </p>
                </div>

                {/* Batch Actions: Export to Excel & Get All Invoices */}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  {/* Export to Excel */}
                  <button
                    type="button"
                    className="button"
                    onClick={handleExportExcel}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      background: '#107c41',
                      color: '#ffffff',
                      border: 'none',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '12px',
                      cursor: 'pointer',
                      boxShadow: '0 2px 6px rgba(16, 124, 65, 0.25)',
                    }}
                    title="Export filtered orders into an Excel-compatible report"
                  >
                    <FileSpreadsheet size={15} /> Export to Excel ({filteredOrders.length})
                  </button>

                  {/* Get All Invoices at Once (PDF) */}
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={handleDownloadAllInvoices}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '7px',
                      padding: '8px 16px',
                      borderRadius: '8px',
                      fontWeight: 700,
                      fontSize: '12px',
                      boxShadow: '0 2px 8px rgba(15, 23, 42, 0.2)',
                    }}
                    title="Download all filtered invoices together in a single multi-page PDF"
                  >
                    <Files size={15} /> Get All Invoices ({filteredOrders.length})
                  </button>
                </div>
              </div>

              {/* Comprehensive Filter Controls Card */}
              <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
                {/* Row 1: Period Presets & Specific Month/Year Selectors */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
                  
                  {/* Quick Time Presets */}
                  <div style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', marginRight: '4px' }}>
                      Time Filter:
                    </span>
                    {[
                      { id: 'all', label: 'All Time' },
                      { id: 'this-week', label: 'This Week' },
                      { id: 'this-month', label: 'This Month' },
                      { id: 'this-year', label: 'This Year' },
                      { id: 'custom', label: 'Specific Month/Year' },
                    ].map((p) => (
                      <button
                        key={p.id}
                        type="button"
                        onClick={() => {
                          setOrderTimeFilter(p.id);
                          if (p.id === 'this-month') {
                            setOrderFilterYear(new Date().getFullYear());
                            setOrderFilterMonth(new Date().getMonth());
                          } else if (p.id === 'this-year') {
                            setOrderFilterYear(new Date().getFullYear());
                            setOrderFilterMonth('all');
                          } else if (p.id === 'all') {
                            setOrderFilterYear('all');
                            setOrderFilterMonth('all');
                          }
                        }}
                        style={{
                          fontSize: '11px',
                          padding: '6px 12px',
                          borderRadius: '6px',
                          border: orderTimeFilter === p.id ? '1px solid #2563eb' : '1px solid #cbd5e1',
                          background: orderTimeFilter === p.id ? '#2563eb' : '#fff',
                          color: orderTimeFilter === p.id ? '#fff' : '#334155',
                          fontWeight: orderTimeFilter === p.id ? 700 : 500,
                          cursor: 'pointer',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>

                  {/* Specific Month & Year Selectors */}
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    <Calendar size={14} color="#64748b" />
                    
                    {/* Month Picker */}
                    <select
                      value={orderFilterMonth}
                      onChange={(e) => {
                        const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setOrderFilterMonth(val);
                        setOrderTimeFilter('custom');
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        background: '#fff',
                        color: '#0f172a',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Filter by specific Month"
                    >
                      <option value="all">All Months</option>
                      {MONTH_NAMES.map((name, idx) => (
                        <option key={idx} value={idx}>{name}</option>
                      ))}
                    </select>

                    {/* Year Picker */}
                    <select
                      value={orderFilterYear}
                      onChange={(e) => {
                        const val = e.target.value === 'all' ? 'all' : Number(e.target.value);
                        setOrderFilterYear(val);
                        setOrderTimeFilter('custom');
                      }}
                      style={{
                        padding: '6px 10px',
                        borderRadius: '6px',
                        border: '1px solid #cbd5e1',
                        fontSize: '12px',
                        background: '#fff',
                        color: '#0f172a',
                        fontWeight: 600,
                        cursor: 'pointer',
                      }}
                      title="Filter by specific Year"
                    >
                      <option value="all">All Years</option>
                      {availableYears.map((y) => (
                        <option key={y} value={y}>{y}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Row 2: Search Query & Status Tabs */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
                  {/* Search box */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', width: '380px', minWidth: '260px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
                    <Search size={15} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Search Order # (e.g. B6163) or Customer Mobile..."
                      value={orderSearchQuery}
                      onChange={(e) => setOrderSearchQuery(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#1e293b' }}
                    />
                    {orderSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setOrderSearchQuery('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  {/* Status buttons */}
                  <div style={{ display: 'flex', gap: '5px' }}>
                    {['All', 'Received', 'Processing', 'Ready', 'Delivered', 'Cancelled'].map((st) => (
                      <button
                        key={st}
                        type="button"
                        className={`tab-button ${orderStatusFilter === st ? 'active' : ''}`}
                        onClick={() => setOrderStatusFilter(st)}
                        style={{ fontSize: '11px', padding: '6px 12px' }}
                      >
                        {st}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Filtered Financial Metrics Summary Strip */}
              <div style={{ display: 'flex', gap: '16px', background: '#f1f5f9', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
                <span style={{ color: '#475569' }}>
                  Filtered Orders: <strong style={{ color: '#0f172a' }}>{filteredMetrics.count}</strong>
                </span>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span style={{ color: '#475569' }}>
                  Total Billed: <strong style={{ color: '#0f172a' }}>{formatMoney(filteredMetrics.totalAmount)}</strong>
                </span>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span style={{ color: '#475569' }}>
                  Paid Collected: <strong style={{ color: '#16a34a' }}>{formatMoney(filteredMetrics.totalPaid)}</strong>
                </span>
                <span style={{ color: '#94a3b8' }}>•</span>
                <span style={{ color: '#475569' }}>
                  Balance Due: <strong style={{ color: filteredMetrics.totalBalance > 0 ? '#d97706' : '#16a34a' }}>{formatMoney(filteredMetrics.totalBalance)}</strong>
                </span>
              </div>

              {/* Natural scrolling table */}
              <div className="orders-table-wrap" style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
                {filteredOrders.length === 0 ? (
                  <div style={{ textAlign: 'center', padding: '48px 20px', background: '#fafafa', borderRadius: '8px' }}>
                    <div style={{ fontSize: '32px', marginBottom: '10px' }}>🔍</div>
                    <h3 style={{ margin: '0 0 6px', color: '#1e293b', fontSize: '16px' }}>No orders found for this period</h3>
                    <p style={{ color: '#64748b', fontSize: '13px', margin: '0 0 16px' }}>
                      No orders match your filter criteria ({periodLabel}, Status: {orderStatusFilter}). Try choosing "All Time" or picking a different month/year.
                    </p>
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={() => {
                        setOrderTimeFilter('all');
                        setOrderFilterYear('all');
                        setOrderFilterMonth('all');
                        setOrderStatusFilter('All');
                        setOrderSearchQuery('');
                      }}
                      style={{ fontSize: '12px' }}
                    >
                      Reset All Filters
                    </button>
                  </div>
                ) : (
                  <table className="orders-table">
                    <thead>
                      <tr>
                        <th>Order No</th>
                        <th>Customer Name</th>
                        <th>Service & Type</th>
                        <th>Intake Date</th>
                        <th>Promised Due</th>
                        <th>Total Bill</th>
                        <th>Balance Due</th>
                        <th>Current Status</th>
                        <th style={{ textAlign: 'right' }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredOrders.map((o) => {
                        const cust = data.customers.find((c) => c.id === o.customerId);
                        return (
                          <tr key={o.id}>
                            <td>
                              <button
                                type="button"
                                className="order-number"
                                onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                              >
                                {o.orderNo?.startsWith('#') ? o.orderNo : `#${o.orderNo}`}
                              </button>
                            </td>
                            <td>
                              <strong>{cust?.name || 'Customer'}</strong>
                              <small>+91 {cust?.mobile}</small>
                            </td>
                            <td>{o.service} ({o.type === 'weight' ? 'Weight' : 'Pieces'})</td>
                            <td>{formatDate(o.createdAt)}</td>
                            <td>{formatDate(o.dueDate)}</td>
                            <td><strong>{formatMoney(o.totalAmount)}</strong></td>
                            <td className={o.balanceAmount > 0 ? 'balance-due' : 'balance-clear'}>
                              {formatMoney(o.balanceAmount)}
                            </td>
                            <td>
                              <span className={`status-pill status-${o.status.toLowerCase()}`}>
                                <i />
                                {o.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="button button-quiet"
                                  style={{ minHeight: '32px', padding: '0 8px', fontSize: '10px' }}
                                  onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                                >
                                  Manage
                                </button>
                                <button
                                  type="button"
                                  className="icon-button"
                                  style={{ width: '32px', height: '32px' }}
                                  onClick={() => setModal({ type: 'thermal-receipt', orderId: o.id })}
                                  title="Thermal Receipt PDF"
                                >
                                  <ReceiptText size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                )}
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PAGE 4: DEDICATED CUSTOMER BOOK DIRECTORY                 */}
          {/* ========================================================= */}
          {view === 'customers' && (
            <div className="responsive-page-card">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
                <div>
                  <h2 style={{ margin: 0, fontSize: '22px', color: '#1e293b' }}>Customer Directory ({data.customers.length})</h2>
                  <p className="muted-copy" style={{ margin: '4px 0 0' }}>All registered laundry accounts and contact records</p>
                </div>

                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '640px', justifyContent: 'flex-end' }}>
                  <div className="customer-directory-search">
                    <Search size={15} color="#94a3b8" />
                    <input
                      type="text"
                      placeholder="Search customers by full name, phone number, or notes..."
                      value={customerSearchQuery}
                      onChange={(e) => setCustomerSearchQuery(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#1e293b' }}
                    />
                    {customerSearchQuery && (
                      <button
                        type="button"
                        onClick={() => setCustomerSearchQuery('')}
                        style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>

                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setModal({ type: 'customer-new' })}
                  >
                    <UserPlus size={15} /> Add New Customer
                  </button>
                </div>
              </div>

              {/* Customer Directory Table */}
              <div className="orders-table-wrap" style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
                <table className="orders-table">
                  <thead>
                    <tr>
                      <th>Customer Name</th>
                      <th>Mobile Number</th>
                      <th>Address</th>
                      <th>Wallet Balance</th>
                      <th>Outstanding Balance</th>
                      <th>Orders Count</th>
                      <th style={{ textAlign: 'right' }}>Workspace</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.customers
                      .filter((c) => {
                        if (!customerSearchQuery.trim()) return true;
                        const q = customerSearchQuery.trim().toLowerCase();
                        return c.name.toLowerCase().includes(q) || c.mobile.includes(q);
                      })
                      .map((c) => {
                        const custOrders = data.orders.filter((o) => o.customerId === c.id);
                        const due = custOrders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);
                        return (
                          <tr key={c.id}>
                            <td>
                              <strong style={{ fontSize: '13px', color: '#2563eb', cursor: 'pointer' }} onClick={() => { setSelectedCustomerId(c.id); setView('customer-detail'); }}>
                                {c.name}
                              </strong>
                              {c.notes && <small style={{ display: 'block', color: '#64748b' }}>Note: {c.notes}</small>}
                            </td>
                            <td>+91 {c.mobile}</td>
                            <td>{c.address || '—'}</td>
                            <td><strong>{formatMoney(c.walletBalance)}</strong></td>
                            <td className={due > 0 ? 'balance-due' : 'balance-clear'}>
                              {formatMoney(due)}
                            </td>
                            <td>{custOrders.length} orders</td>
                            <td style={{ textAlign: 'right' }}>
                              <button
                                type="button"
                                className="button button-quiet"
                                style={{ minHeight: '30px', padding: '0 10px', fontSize: '11px' }}
                                onClick={() => {
                                  setSelectedCustomerId(c.id);
                                  setView('customer-detail');
                                }}
                              >
                                Open Profile →
                              </button>
                            </td>
                          </tr>
                        );
                      })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* ========================================================= */}
          {/* PAGE 5: DEDICATED INDIVIDUAL CUSTOMER WORKSPACE PAGE      */}
          {/* ========================================================= */}
          {view === 'customer-detail' && currentDetailCustomer && (
            <div style={{ display: 'grid', gap: '22px' }}>
              {/* Back button row */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                <button
                  type="button"
                  className="button button-quiet"
                  style={{ minHeight: '36px', padding: '0 12px', fontSize: '11px' }}
                  onClick={() => setView('customers')}
                >
                  ← Back to Customer Directory
                </button>
              </div>

              {/* Customer Title Row */}
              <div className="customer-title-row">
                <div className="customer-identity">
                  <div className="customer-avatar large-avatar">
                    {currentDetailCustomer.name.slice(0, 2).toUpperCase()}
                  </div>
                  <div>
                    <div className="eyebrow">
                      CUSTOMER ACCOUNT <span className="customer-id">· #{currentDetailCustomer.customerCode || currentDetailCustomer.id.slice(0, 8)}</span>
                    </div>
                    <h1>{currentDetailCustomer.name}</h1>
                    <div className="customer-contact">
                      <span>📞 +91 {currentDetailCustomer.mobile}</span>
                      {currentDetailCustomer.email && <span>✉️ {currentDetailCustomer.email}</span>}
                      {currentDetailCustomer.address && (
                        <span>📍 {currentDetailCustomer.address}{currentDetailCustomer.areaLocation ? `, ${currentDetailCustomer.areaLocation}` : ''}{currentDetailCustomer.state ? ` (${currentDetailCustomer.state})` : ''}</span>
                      )}
                      {currentDetailCustomer.preference && currentDetailCustomer.preference !== 'NA' && (
                        <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          🏷️ {currentDetailCustomer.preference}
                        </span>
                      )}
                      {currentDetailCustomer.commPreference && (
                        <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          📢 {currentDetailCustomer.commPreference}
                        </span>
                      )}
                      {currentDetailCustomer.gstin && (
                        <span style={{ background: '#ecfdf5', color: '#059669', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          GSTIN: {currentDetailCustomer.gstin}
                        </span>
                      )}
                      {Number(currentDetailCustomer.discountPercent) > 0 && (
                        <span style={{ background: '#fef3c7', color: '#b45309', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                          Special Discount: {currentDetailCustomer.discountPercent}%
                        </span>
                      )}
                    </div>
                  </div>
                </div>

                <div className="identity-actions" style={{ gap: '10px' }}>
                  <button
                    type="button"
                    className="button button-primary"
                    onClick={() => setView('new-order')}
                  >
                    <Plus size={15} /> Place Order for Customer
                  </button>
                  <button
                    type="button"
                    className="button button-quiet"
                    onClick={() => setModal({ type: 'customer-edit', customer: currentDetailCustomer })}
                  >
                    <Pencil size={14} /> Edit Info
                  </button>
                </div>
              </div>

              {/* 3 Metrics Cards */}
              <div className="metric-grid">
                <div className="metric-card">
                  <div className="metric-top">
                    <span>Prepaid Wallet Balance</span>
                    <div className="metric-icon mint">
                      <Wallet size={16} />
                    </div>
                  </div>
                  <strong className="metric-value">{formatMoney(currentDetailCustomer.walletBalance)}</strong>
                  <small>Available credit for laundry checkout</small>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Outstanding Due Balance</span>
                    <div className="metric-icon peach">
                      <ReceiptText size={16} />
                    </div>
                  </div>
                  <strong className="metric-value" style={{ color: customerDue > 0 ? '#c8474e' : '#16a34a' }}>
                    {formatMoney(customerDue)}
                  </strong>
                  <small>{customerOrders.filter((o) => o.balanceAmount > 0).length} pending payments</small>
                </div>

                <div className="metric-card">
                  <div className="metric-top">
                    <span>Lifetime Benefits</span>
                    <div className="metric-icon lavender">
                      <Package size={16} />
                    </div>
                  </div>
                  <strong className="metric-value">{customerPackages.length} Plans</strong>
                  <small>No validity expiration (Lifetime)</small>
                </div>
              </div>

              {/* Segmented Tabs: Order History / Lifetime Packages / Wallet Ledger */}
              <div className="tabs-row">
                <div className="segmented-tabs">
                  <button
                    type="button"
                    className={customerDetailTab === 'overview' ? 'selected' : ''}
                    onClick={() => setCustomerDetailTab('overview')}
                  >
                    <span>Order History</span>
                    <span className="tab-count">{customerOrders.length}</span>
                  </button>

                  <button
                    type="button"
                    className={customerDetailTab === 'packages' ? 'selected' : ''}
                    onClick={() => setCustomerDetailTab('packages')}
                  >
                    <span>Lifetime Packages</span>
                    <span className="tab-count">{customerPackages.length}</span>
                  </button>

                  <button
                    type="button"
                    className={customerDetailTab === 'ledger' ? 'selected' : ''}
                    onClick={() => setCustomerDetailTab('ledger')}
                  >
                    <span>Wallet Ledger</span>
                    <span className="tab-count">{customerWalletTx.length}</span>
                  </button>
                </div>

                <button
                  type="button"
                  className="button button-quiet"
                  style={{ minHeight: '34px', fontSize: '11px' }}
                  onClick={() => setModal({ type: 'package-sale' })}
                >
                  <PackagePlus size={14} /> Sell Package Plan
                </button>
              </div>

              {/* TAB 1: ORDER HISTORY */}
              {customerDetailTab === 'overview' && (
                <div className="orders-table-wrap">
                  {customerOrders.length === 0 ? (
                    <div className="empty-state">
                      <strong>No orders placed by this customer yet.</strong>
                      <p className="muted-copy">Click "Place Order for Customer" above to start billing.</p>
                    </div>
                  ) : (
                    <table className="orders-table">
                      <thead>
                        <tr>
                          <th>Order No</th>
                          <th>Service & Type</th>
                          <th>Intake Date</th>
                          <th>Promised Ready</th>
                          <th>Total Bill</th>
                          <th>Balance Due</th>
                          <th>Status</th>
                          <th style={{ textAlign: 'right' }}>Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        {customerOrders.map((o) => (
                          <tr key={o.id}>
                            <td>
                              <button
                                type="button"
                                className="order-number"
                                onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                              >
                                {o.orderNo?.startsWith('#') ? o.orderNo : `#${o.orderNo}`}
                              </button>
                            </td>
                            <td>{o.service} ({o.type === 'weight' ? 'Weight' : 'Pieces'})</td>
                            <td>{formatDate(o.createdAt)}</td>
                            <td>{formatDate(o.dueDate)}</td>
                            <td><strong>{formatMoney(o.totalAmount)}</strong></td>
                            <td className={o.balanceAmount > 0 ? 'balance-due' : 'balance-clear'}>
                              {formatMoney(o.balanceAmount)}
                            </td>
                            <td>
                              <span className={`status-pill status-${o.status.toLowerCase()}`}>
                                <i />
                                {o.status}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              <div style={{ display: 'inline-flex', gap: '6px' }}>
                                <button
                                  type="button"
                                  className="button button-quiet"
                                  style={{ minHeight: '30px', padding: '0 8px', fontSize: '10px' }}
                                  onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                                >
                                  Manage
                                </button>
                                <button
                                  type="button"
                                  className="icon-button"
                                  style={{ width: '30px', height: '30px' }}
                                  onClick={() => setModal({ type: 'thermal-receipt', orderId: o.id })}
                                  title="Thermal Receipt PDF"
                                >
                                  <ReceiptText size={15} />
                                </button>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </div>
              )}

              {/* TAB 2: PACKAGES */}
              {customerDetailTab === 'packages' && (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '14px' }}>
                  {customerPackages.length === 0 ? (
                    <div className="empty-state" style={{ gridColumn: '1/-1' }}>
                      <strong>No packages enrolled.</strong>
                      <p className="muted-copy">Enroll in an Everyday Wallet or discount plan.</p>
                    </div>
                  ) : (
                    customerPackages.map((cp) => (
                      <div key={cp.id} className="detail-card">
                        <div className="card-heading">
                          <div>
                            <h3>{cp.name}</h3>
                            <p>Enrolled: {formatDate(cp.startsAt)}</p>
                          </div>
                          <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8' }}>
                            Lifetime · No Expiry
                          </span>
                        </div>
                        <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                          {cp.kind === 'wallet'
                            ? `Prepaid Credit: ${formatMoney(cp.walletCredit)}`
                            : (cp.kind === 'buy_x_get_y'
                              ? `Pay for ${cp.buyQty || 5}, Get ${cp.freeQty || 1} Free`
                              : `${cp.discountPercent}% Off Eligible Orders`)}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {/* TAB 3: WALLET LEDGER */}
              {customerDetailTab === 'ledger' && (
                <div style={{ background: '#fff', border: '1px solid #e8e8e6', borderRadius: '10px', overflow: 'hidden' }}>
                  {customerWalletTx.length === 0 ? (
                    <div className="empty-state">
                      <strong>No transactions recorded in wallet ledger.</strong>
                    </div>
                  ) : (
                    <div style={{ display: 'grid' }}>
                      {customerWalletTx.map((tx) => (
                        <div
                          key={tx.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 18px',
                            borderBottom: '1px solid #f0f0ef',
                            fontSize: '12px',
                          }}
                        >
                          <div>
                            <strong>{tx.description}</strong>
                            <small style={{ display: 'block', color: '#888' }}>{formatDateTime(tx.createdAt)}</small>
                          </div>
                          <strong style={{ fontSize: '14px', color: tx.kind === 'credit' ? '#28845f' : '#c8474e' }}>
                            {tx.kind === 'credit' ? `+${formatMoney(tx.amount)}` : `-${formatMoney(tx.amount)}`}
                          </strong>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* PAGE 6: PACKAGE PLANS CATALOG PAGE                        */}
          {/* ========================================================= */}
          {view === 'packages' && (
            <div className="responsive-page-card">
              <div className="packages-page-header">
                <div>
                  <h2 className="packages-page-title">Laundry Benefit Packages ({data.packages.length})</h2>
                  <p className="muted-copy" style={{ margin: '4px 0 0' }}>All packages are lifetime plans with no expiration date</p>
                </div>

                <button
                  type="button"
                  className="button button-primary packages-manage-btn"
                  onClick={() => requireAdmin(() => setModal({ type: 'manage-packages' }))}
                >
                  <PackagePlus size={16} /> Manage Packages (Create/Edit/Delete)
                </button>
              </div>

              <div className="packages-catalog-grid">
                {data.packages.map((pkg) => (
                  <div key={pkg.id} className="detail-card" style={{ padding: '20px' }}>
                    <div className="card-heading">
                      <h3>{pkg.name}</h3>
                      <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: '#eff6ff', color: '#1d4ed8' }}>
                        {pkg.validity || 'Active Benefit'}
                      </span>
                    </div>
                    <p className="note-copy" style={{ margin: '8px 0 14px' }}>{pkg.description}</p>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #eee' }}>
                      <strong style={{ fontSize: '16px', color: '#0f172a' }}>{formatMoney(pkg.price)}</strong>
                      <span style={{ fontSize: '12px', color: '#2563eb', fontWeight: 700 }}>
                        {pkg.kind === 'wallet'
                          ? `+${formatMoney(pkg.walletCredit)} credit`
                          : (pkg.kind === 'buy_x_get_y'
                            ? `Pay for ${pkg.buyQty || 5}, Get ${pkg.freeQty || 1} Free`
                            : `${pkg.discountPercent}% Off`)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </main>
      </div>

      {/* --- MODAL DIALOGS --- */}

      {/* 1. ADMIN AUTH MODAL (SIGN IN, SIGN UP, FORGOT PASSWORD) */}
      <AdminAuthModal
        isOpen={modal?.type === 'admin-auth'}
        onClose={() => setModal(null)}
        admins={data.admins}
        onLoginSuccess={(admin) => {
          handleAdminLogin(admin);
          if (modal?.onSuccess) modal.onSuccess();
        }}
        onCreateAdmin={async (newAdmin) => {
          await runMutation((cur) => createAdmin(newAdmin, cur), 'Admin account created.');
        }}
        onResetPassword={async (adminId, newPassword) => {
          await runMutation((cur) => resetAdminPassword(adminId, newPassword, cur), 'Password reset successful.');
        }}
        onToast={showToast}
      />

      {/* 2. STORE & TAX SETTINGS MODAL */}
      <SettingsModal
        isOpen={modal?.type === 'settings'}
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
      <ThermalReceiptModal
        isOpen={modal?.type === 'thermal-receipt'}
        onClose={() => setModal(null)}
        order={activeOrder}
        customer={activeOrderCustomer}
        settings={data.settings}
        payments={activeOrderPayments}
        currentStaff={adminUser || { name: 'Counter Cashier' }}
        onToast={showToast}
      />

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
      <PamphletModal
        isOpen={modal?.type === 'pamphlet'}
        onClose={() => setModal(null)}
        settings={data.settings}
        packages={data.packages}
        services={data.services}
        onToast={showToast}
      />

      {/* 10. FIRST-TIME STORE NAME ONBOARDING (PRODUCTION MANDATORY) */}
      {!isDemoAllowed() && !data.settings?.storeNameCreated && (
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
