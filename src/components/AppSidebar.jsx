import React from 'react';
import { ChevronLeft, ChevronRight, Clock3, KeyRound, LayoutDashboard, Lock, Megaphone, Package, Settings, ShieldCheck, Shirt, ShoppingBag, Sparkles, UserRound, Users, X } from 'lucide-react';
import { onActivateKey } from '../lib/a11y.js';

export default function AppSidebar({
  data,
  view,
  setModal,
  requireAdmin,
  sidebarCollapsed,
  mobileMenuOpen,
  toggleSidebar,
  setMobileMenuOpen,
  handleNavigate,
  authSession,
  adminUser,
  handleAdminLogout,
  handleLockTerminal,
}) {
  return (
    <aside className={`sidebar ${sidebarCollapsed ? 'collapsed' : ''} ${mobileMenuOpen ? 'sidebar-open' : ''}`}>
      {/* Brand Lockup */}
      <div className="brand-lockup">
        <div
          className="brand-mark"
          onClick={sidebarCollapsed ? toggleSidebar : undefined}
          {...(sidebarCollapsed ? { role: 'button', tabIndex: 0, 'aria-label': 'Expand Sidebar', onKeyDown: onActivateKey(toggleSidebar) } : {})}
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
            role="button"
            tabIndex={0}
            onKeyDown={onActivateKey(handleAdminLogout)}
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
            role="button"
            tabIndex={0}
            onKeyDown={onActivateKey(() => setModal({ type: 'admin-auth' }))}
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
          onClick={() => handleLockTerminal()}
          data-tooltip="Lock POS Terminal"
          title="Lock POS Terminal Screen"
        >
          <Lock size={14} />
          <span className="sidebar-lock-text">Lock Terminal</span>
        </button>
      </div>
    </aside>
  );
}
