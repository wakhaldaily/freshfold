import React, { useState, useMemo } from 'react';
import { Package, PackagePlus, Search, Trash2, User, Wallet, X, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';
import { formatDate } from '../lib/dateFormat.js';
import { onActivateKey } from '../lib/a11y.js';

export default function PackagesView({
  data,
  setModal,
  requireAdmin,
  onDeleteCustomerPackage,
  setSelectedCustomerId,
  setView,
}) {
  const [activeTab, setActiveTab] = useState('subscriptions'); // 'subscriptions' or 'plans'
  const [searchQuery, setSearchQuery] = useState('');

  // Map customer packages to include customer data
  const customerMap = useMemo(() => {
    const map = new Map();
    (data.customers || []).forEach((c) => {
      if (c?.id) map.set(c.id, c);
    });
    return map;
  }, [data.customers]);

  const customerPackagesWithDetails = useMemo(() => {
    return (data.customerPackages || []).map((cp) => ({
      ...cp,
      customer: customerMap.get(cp.customerId) || { name: 'Valued Customer', mobile: '' },
    }));
  }, [data.customerPackages, customerMap]);

  const filteredCustomerPackages = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return customerPackagesWithDetails;
    return customerPackagesWithDetails.filter((cp) => {
      const custName = String(cp.customer?.name || '').toLowerCase();
      const mobile = String(cp.customer?.mobile || '');
      const pkgName = String(cp.name || '').toLowerCase();
      return custName.includes(q) || mobile.includes(q) || pkgName.includes(q);
    });
  }, [customerPackagesWithDetails, searchQuery]);

  const handleDeletePackage = (cp) => {
    const remaining = Number(cp.remainingCredit != null ? cp.remainingCredit : cp.walletCredit || 0);
    const remMsg = cp.kind === 'wallet' && remaining > 0
      ? `\n\nRemaining wallet credit of ${formatMoney(remaining)} will be deducted from ${cp.customer?.name || 'customer'}'s wallet balance.`
      : '';
    if (window.confirm(`Are you sure you want to delete the package "${cp.name}" from customer "${cp.customer?.name || 'customer'}"?${remMsg}`)) {
      onDeleteCustomerPackage?.(cp.id);
    }
  };

  const openCustomer = (customerId) => {
    if (customerId && setSelectedCustomerId && setView) {
      setSelectedCustomerId(customerId);
      setView('customer-detail');
    }
  };

  return (
    <div className="responsive-page-card">
      <div className="packages-page-header">
        <div>
          <h2 className="packages-page-title">Packages & Subscriptions</h2>
          <p className="muted-copy" style={{ margin: '4px 0 0' }}>
            Manage customer enrolled packages, subscriptions, and prepaid wallet plans
          </p>
        </div>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
          <button
            type="button"
            className="button button-primary packages-manage-btn"
            onClick={() => requireAdmin(() => setModal({ type: 'manage-packages' }))}
          >
            <PackagePlus size={16} /> Manage Package Templates
          </button>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="tabs-row" style={{ marginTop: '16px', marginBottom: '20px' }}>
        <div className="segmented-tabs">
          <button
            type="button"
            className={activeTab === 'subscriptions' ? 'selected' : ''}
            onClick={() => setActiveTab('subscriptions')}
          >
            <span>Customer Subscriptions</span>
            <span className="tab-count">{data.customerPackages?.length || 0}</span>
          </button>

          <button
            type="button"
            className={activeTab === 'plans' ? 'selected' : ''}
            onClick={() => setActiveTab('plans')}
          >
            <span>Package Plans Catalog</span>
            <span className="tab-count">{data.packages?.length || 0}</span>
          </button>
        </div>

        {activeTab === 'subscriptions' && (
          <div className="customer-directory-search" style={{ minWidth: '260px' }}>
            <Search size={14} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by customer or package..."
              aria-label="Search customer packages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#1e293b' }}
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>
        )}
      </div>

      {/* TAB 1: CUSTOMER ENROLLED PACKAGES (WITH DELETE BUTTON) */}
      {activeTab === 'subscriptions' && (
        <div>
          {filteredCustomerPackages.length === 0 ? (
            <div className="empty-state" style={{ padding: '48px 20px', textAlign: 'center' }}>
              <div style={{ fontSize: '36px', marginBottom: '10px' }}>📦</div>
              <strong style={{ fontSize: '16px', display: 'block', color: '#1e293b', marginBottom: '6px' }}>
                {searchQuery ? 'No customer packages match your search' : 'No customers have subscribed to any package yet'}
              </strong>
              <p className="muted-copy" style={{ maxWidth: '440px', margin: '0 auto 16px' }}>
                {searchQuery
                  ? 'Try searching with a different customer name, mobile number, or package title.'
                  : 'Packages enrolled by customers will appear here, where you can view credit balances and delete packages anytime.'}
              </p>
            </div>
          ) : (
            <div className="orders-table-wrap" style={{ overflowX: 'auto' }}>
              <table className="orders-table">
                <thead>
                  <tr>
                    <th>Customer Name</th>
                    <th>Mobile</th>
                    <th>Package Plan</th>
                    <th>Benefit / Balance</th>
                    <th>Enrolled Date</th>
                    <th>Validity</th>
                    <th>Status</th>
                    <th style={{ textAlign: 'right' }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredCustomerPackages.map((cp) => {
                    const todayStr = new Date().toISOString().slice(0, 10);
                    const isExpired = Boolean(cp.expiresAt && String(cp.expiresAt).slice(0, 10) < todayStr);
                    const remaining = cp.remainingCredit !== undefined && cp.remainingCredit !== null
                      ? Number(cp.remainingCredit)
                      : Number(cp.walletCredit || 0);
                    const isCreditFinished = cp.kind === 'wallet' && (remaining <= 0 || Number(cp.customer?.walletBalance || 0) <= 0);
                    const isDisabled = cp.status === 'disabled' || isExpired || isCreditFinished;

                    let statusLabel = 'Active';
                    let statusBg = '#ecfdf5';
                    let statusColor = '#047857';

                    if (isDisabled) {
                      if (isExpired) {
                        statusLabel = 'Expired';
                        statusBg = '#fee2e2';
                        statusColor = '#b91c1c';
                      } else if (isCreditFinished) {
                        statusLabel = 'Depleted';
                        statusBg = '#fef3c7';
                        statusColor = '#b45309';
                      } else {
                        statusLabel = 'Disabled';
                        statusBg = '#f3f4f6';
                        statusColor = '#6b7280';
                      }
                    }

                    return (
                      <tr key={cp.id}>
                        <td data-label="Customer Name">
                          <button
                            type="button"
                            className="order-number"
                            style={{ textAlign: 'left', fontWeight: 700, color: '#2563eb' }}
                            onClick={() => openCustomer(cp.customerId)}
                          >
                            {cp.customer?.name || 'Customer'}
                          </button>
                        </td>
                        <td data-label="Mobile">
                          {cp.customer?.mobile ? `+91 ${cp.customer.mobile}` : '—'}
                        </td>
                        <td data-label="Package Plan">
                          <strong style={{ color: '#0f172a' }}>{cp.name}</strong>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            {cp.kind === 'wallet' ? 'Prepaid Wallet Credit' : (cp.kind === 'buy_x_get_y' ? 'Buy X Get Y' : 'Discount Plan')}
                          </div>
                        </td>
                        <td data-label="Benefit / Balance">
                          {cp.kind === 'wallet' ? (
                            <div>
                              <span style={{ fontWeight: 600 }}>Credit: {formatMoney(cp.walletCredit)}</span>
                              <div style={{ fontSize: '11px', color: isCreditFinished ? '#b45309' : '#047857', fontWeight: 600 }}>
                                Remaining: {formatMoney(Math.max(0, remaining))}
                              </div>
                            </div>
                          ) : (
                            <strong style={{ color: '#2563eb' }}>
                              {cp.kind === 'buy_x_get_y'
                                ? `Pay ${cp.buyQty || 5}, Get ${cp.freeQty || 1} Free`
                                : `${cp.discountPercent}% Off Orders`}
                            </strong>
                          )}
                        </td>
                        <td data-label="Enrolled Date">
                          {formatDate(cp.startsAt)}
                        </td>
                        <td data-label="Validity">
                          {cp.expiresAt ? formatDate(cp.expiresAt) : 'Lifetime (No Expiry)'}
                        </td>
                        <td data-label="Status">
                          <span
                            style={{
                              fontSize: '11px',
                              fontWeight: 700,
                              padding: '2px 8px',
                              borderRadius: '6px',
                              background: statusBg,
                              color: statusColor,
                              display: 'inline-block',
                            }}
                          >
                            {statusLabel}
                          </span>
                        </td>
                        <td data-label="Actions" style={{ textAlign: 'right' }}>
                          <button
                            type="button"
                            className="button"
                            onClick={() => handleDeletePackage(cp)}
                            style={{
                              minHeight: '28px',
                              padding: '0 10px',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#dc2626',
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                            title={`Delete package "${cp.name}"`}
                          >
                            <Trash2 size={13} /> Delete Package
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 2: PACKAGE PLANS CATALOG TEMPLATES */}
      {activeTab === 'plans' && (
        <div className="packages-catalog-grid">
          {data.packages.map((pkg) => (
            <div key={pkg.id} className="detail-card package-plan-card" style={{ padding: '20px' }}>
              <div className="card-heading">
                <h3>{pkg.name}</h3>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background: pkg.durationDays ? '#fef3c7' : '#eff6ff',
                    color: pkg.durationDays ? '#b45309' : '#1d4ed8',
                  }}
                >
                  {pkg.durationDays ? `${pkg.durationDays} Days Validity` : (pkg.validity || 'Lifetime · No Expiry')}
                </span>
              </div>
              <p className="note-copy" style={{ margin: '8px 0 14px' }}>{pkg.description}</p>
              <div className="package-plan-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid #eee' }}>
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
      )}
    </div>
  );
}
