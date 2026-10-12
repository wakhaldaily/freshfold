import React from 'react';
import { Megaphone, Plus, ReceiptText, Shirt, ShoppingBag, Sparkles, UserPlus } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';
import { formatDate } from '../lib/dateFormat.js';
import { onActivateKey } from '../lib/a11y.js';

export default function DashboardView({
  data,
  setView,
  setModal,
  setOrderStatusFilter,
  dashboardStats,
}) {
  // Only orders still at the counter: delivered and cancelled ones live in Order History.
  const activeQueue = data.orders.filter((o) => ['Received', 'Processing', 'Ready'].includes(o.status)).slice(0, 8);

  return (
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
        <div className="metric-card" role="button" tabIndex={0} onClick={() => setView('orders')} onKeyDown={onActivateKey(() => setView('orders'))}>
          <div className="metric-top">
            <span>Total Orders Intake</span>
            <div className="metric-icon lavender">
              <ShoppingBag size={16} />
            </div>
          </div>
          <strong className="metric-value">{dashboardStats.totalOrders}</strong>
          <small>Recorded store laundry orders</small>
        </div>

        <div className="metric-card" role="button" tabIndex={0} onClick={() => { setView('orders'); setOrderStatusFilter('Processing'); }} onKeyDown={onActivateKey(() => { setView('orders'); setOrderStatusFilter('Processing'); })}>
          <div className="metric-top">
            <span>In Processing</span>
            <div className="metric-icon blue">
              <Shirt size={16} />
            </div>
          </div>
          <strong className="metric-value">{dashboardStats.inProcessing}</strong>
          <small>Garments in dry clean / wash</small>
        </div>

        <div className="metric-card" role="button" tabIndex={0} onClick={() => { setView('orders'); setOrderStatusFilter('Ready'); }} onKeyDown={onActivateKey(() => { setView('orders'); setOrderStatusFilter('Ready'); })}>
          <div className="metric-top">
            <span>Ready for Pickup</span>
            <div className="metric-icon mint">
              <Sparkles size={16} />
            </div>
          </div>
          <strong className="metric-value" style={{ color: '#16a34a' }}>{dashboardStats.ready}</strong>
          <small>Awaiting customer collection</small>
        </div>

        <div className="metric-card" role="button" tabIndex={0} onClick={() => setView('orders')} onKeyDown={onActivateKey(() => setView('orders'))}>
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

        {activeQueue.length === 0 && (
          <div className="empty-state">
            <strong>No orders waiting at the counter</strong>
            <span>New orders appear here until they are delivered.</span>
          </div>
        )}

        {/* Desktop View Table (> 768px) */}
        {activeQueue.length > 0 && <div className="desktop-only orders-table-wrap">
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
              {activeQueue.map((o) => {
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
        </div>}

        {/* Mobile View Card List (<= 768px) */}
        {activeQueue.length > 0 && <div className="mobile-only mobile-queue-list">
          {activeQueue.map((o) => {
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
        </div>}
      </div>
    </div>
  );
}
