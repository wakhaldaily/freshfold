import React from 'react';
import { ChevronRight, Lock, LogOut, Menu, PanelLeft, PanelLeftClose, Search, X } from 'lucide-react';
import { formatMoney, isRemoteMode } from '../lib/persistence.js';

export default function AppTopbar({
  data,
  view,
  setView,
  setModal,
  sidebarCollapsed,
  toggleSidebar,
  setMobileMenuOpen,
  authSession,
  adminUser,
  handleAdminLogout,
  handleLockTerminal,
  currentDetailCustomer,
  globalSearch,
  setGlobalSearch,
  searchResults,
  setSelectedCustomerId,
}) {
  return (
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
          <span>{data?.settings?.storeName || 'Clean Clear Dry Cleaning'}</span>
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
            placeholder="Search customers"
            aria-label="Search customers by name or mobile"
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
          <span>{isRemoteMode() ? 'Online · Synced' : 'Offline demo mode'}</span>
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
          onClick={() => handleLockTerminal()}
          title={`Active: ${authSession?.name || 'Staff'}. Click to lock POS terminal.`}
        >
          <LogOut size={13} /> Lock Terminal
        </button>
      </div>
    </header>
  );
}
