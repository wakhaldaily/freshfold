import React from 'react';
import { Mail, MapPin, Megaphone, Package, PackagePlus, Pencil, Phone, Plus, ReceiptText, Share2, Tag, Wallet } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';
import { formatDate, formatDateTime } from '../lib/dateFormat.js';
import { OrderAccordionList } from '../components/MobileLists.jsx';

export default function CustomerDetailView({
  setView,
  setModal,
  currentDetailCustomer,
  customerDue,
  customerOrders,
  customerPackages,
  customerWalletTx,
  customerDetailTab,
  setCustomerDetailTab,
}) {
  return (
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
              CUSTOMER ACCOUNT {currentDetailCustomer.customerCode && <span className="customer-id">· #{currentDetailCustomer.customerCode}</span>}
            </div>
            <h1>{currentDetailCustomer.name}</h1>
            <div className="customer-contact">
              <span><Phone size={13} aria-hidden="true" /> +91 {currentDetailCustomer.mobile}</span>
              {currentDetailCustomer.email && <span><Mail size={13} aria-hidden="true" /> {currentDetailCustomer.email}</span>}
              {currentDetailCustomer.address && (
                <span><MapPin size={13} aria-hidden="true" /> {currentDetailCustomer.address}{currentDetailCustomer.areaLocation ? `, ${currentDetailCustomer.areaLocation}` : ''}{currentDetailCustomer.state ? ` (${currentDetailCustomer.state})` : ''}</span>
              )}
              {currentDetailCustomer.preference && currentDetailCustomer.preference !== 'NA' && (
                <span style={{ background: '#eff6ff', color: '#1d4ed8', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  <Tag size={12} aria-hidden="true" /> {currentDetailCustomer.preference}
                </span>
              )}
              {currentDetailCustomer.commPreference && (
                <span style={{ background: '#f1f5f9', color: '#334155', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                  <Megaphone size={12} aria-hidden="true" /> {currentDetailCustomer.commPreference}
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
            className="button button-quiet"
            onClick={() => setModal({ type: 'share-price-list', customer: currentDetailCustomer })}
            style={{ color: '#0284c7', borderColor: '#bae6fd', background: '#f0f9ff' }}
            title="Share price list & garment order link with customer"
          >
            <Share2 size={14} /> Share Price List
          </button>
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
          <strong className="metric-value">{customerPackages.length} {customerPackages.length === 1 ? 'Plan' : 'Plans'}</strong>
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
      {customerDetailTab === 'overview' && customerOrders.length > 0 && (
        <div className="mobile-only">
          <OrderAccordionList orders={customerOrders} customers={[currentDetailCustomer]} setModal={setModal} showCustomer={false} />
        </div>
      )}
      {customerDetailTab === 'overview' && (
        <div className={`orders-table-wrap ${customerOrders.length > 0 ? 'desktop-only' : ''}`}>
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
                    <td data-label="Order No">
                      <button
                        type="button"
                        className="order-number"
                        onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                      >
                        {o.orderNo?.startsWith('#') ? o.orderNo : `#${o.orderNo}`}
                      </button>
                    </td>
                    <td data-label="Service & Type">{o.service} ({o.type === 'weight' ? 'Weight' : 'Pieces'})</td>
                    <td data-label="Intake Date">{formatDate(o.createdAt)}</td>
                    <td data-label="Promised Ready">{formatDate(o.dueDate)}</td>
                    <td data-label="Total Bill"><strong>{formatMoney(o.totalAmount)}</strong></td>
                    <td data-label="Balance Due" className={o.balanceAmount > 0 ? 'balance-due' : 'balance-clear'}>
                      {formatMoney(o.balanceAmount)}
                    </td>
                    <td data-label="Status">
                      <span className={`status-pill status-${o.status.toLowerCase()}`}>
                        <i />
                        {o.status}
                      </span>
                    </td>
                    <td data-label="Actions" style={{ textAlign: 'right' }}>
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
            customerPackages.map((cp) => {
              const todayStr = new Date().toISOString().slice(0, 10);
              const isExpired = Boolean(cp.expiresAt && String(cp.expiresAt).slice(0, 10) < todayStr);
              const remaining = cp.remainingCredit !== undefined && cp.remainingCredit !== null
                ? Number(cp.remainingCredit)
                : Number(cp.walletCredit || 0);
              const isCreditFinished = cp.kind === 'wallet' && (remaining <= 0 || (currentDetailCustomer && Number(currentDetailCustomer.walletBalance || 0) <= 0));
              const isDisabled = cp.status === 'disabled' || isExpired || isCreditFinished;

              let badgeText = 'Active · Lifetime (No Expiry)';
              let badgeBg = '#eff6ff';
              let badgeColor = '#1d4ed8';

              if (isDisabled) {
                if (isExpired) {
                  badgeText = `Disabled · Expired on ${formatDate(cp.expiresAt)}`;
                  badgeBg = '#fee2e2';
                  badgeColor = '#b91c1c';
                } else if (isCreditFinished) {
                  badgeText = 'Disabled · Credit Finished';
                  badgeBg = '#fef3c7';
                  badgeColor = '#b45309';
                } else {
                  badgeText = 'Disabled';
                  badgeBg = '#f3f4f6';
                  badgeColor = '#6b7280';
                }
              } else if (cp.expiresAt) {
                badgeText = `Active · Valid till ${formatDate(cp.expiresAt)}`;
                badgeBg = '#ecfdf5';
                badgeColor = '#047857';
              }

              return (
                <div
                  key={cp.id}
                  className="detail-card"
                  style={{
                    opacity: isDisabled ? 0.78 : 1,
                    borderColor: isDisabled ? '#e2e8f0' : undefined,
                    background: isDisabled ? '#fafafa' : '#fff',
                  }}
                >
                  <div className="card-heading">
                    <div>
                      <h3 style={{ textDecoration: isDisabled ? 'line-through' : 'none', color: isDisabled ? '#64748b' : undefined }}>{cp.name}</h3>
                      <p>Enrolled: {formatDate(cp.startsAt)}</p>
                    </div>
                    <span style={{ fontSize: '10px', fontWeight: 700, padding: '2px 8px', borderRadius: '6px', background: badgeBg, color: badgeColor }}>
                      {badgeText}
                    </span>
                  </div>
                  <div style={{ marginTop: '12px', fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    {cp.kind === 'wallet' ? (
                      <div>
                        <span>Prepaid Credit: {formatMoney(cp.walletCredit)}</span>
                        <div style={{ marginTop: '4px', fontSize: '12px', fontWeight: 600, color: isCreditFinished ? '#b45309' : '#047857' }}>
                          Remaining: {formatMoney(Math.max(0, remaining))}
                        </div>
                      </div>
                    ) : (cp.kind === 'buy_x_get_y'
                      ? `Pay for ${cp.buyQty || 5}, Get ${cp.freeQty || 1} Free`
                      : `${cp.discountPercent}% Off Eligible Orders`)}
                  </div>
                </div>
              );
            })
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
  );
}
