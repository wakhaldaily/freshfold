import React from 'react';
import { CalendarDays, FileSpreadsheet, Files, ReceiptText, Search, Trash2, X } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';
import { OrderAccordionList } from '../components/MobileLists.jsx';
import { formatDate } from '../lib/dateFormat.js';

export default function OrdersView({
  data,
  setModal,
  setOrderStatusFilter,
  periodLabel,
  handleExportExcel,
  handleDownloadAllInvoices,
  filteredOrders,
  filteredMetrics,
  orderTimeFilter,
  setOrderTimeFilter,
  orderStartDate,
  setOrderStartDate,
  orderEndDate,
  setOrderEndDate,
  orderSearchQuery,
  setOrderSearchQuery,
  orderStatusFilter,
  setOrderFilterYear,
  setOrderFilterMonth,
  onDeleteOrder,
}) {
  return (
    <div className="responsive-page-card">
      
      {/* Header Title & Batch Export / Invoices Actions */}
      <div className="orders-page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '20px', flexWrap: 'wrap', gap: '16px' }}>
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
        <div className="orders-page-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
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
      <div className="orders-filter-panel" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '12px', padding: '16px', marginBottom: '16px' }}>
        {/* Row 1: Period Presets (This Week, This Month, All Time) & Date Range Picker */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px', marginBottom: '14px' }}>
          
          {/* Quick Time Presets */}
          <div className="orders-period-presets" style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: '#64748b', letterSpacing: '0.5px', marginRight: '4px' }}>
              Filter:
            </span>
            {[
              { id: 'all', label: 'All Time' },
              { id: 'this-week', label: 'This Week' },
              { id: 'this-month', label: 'This Month' },
            ].map((p) => {
              const isActive =
                (p.id === 'all' && orderTimeFilter === 'all' && !orderStartDate && !orderEndDate) ||
                (p.id === orderTimeFilter && !orderStartDate && !orderEndDate);
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setOrderTimeFilter(p.id);
                    setOrderStartDate('');
                    setOrderEndDate('');
                  }}
                  style={{
                    fontSize: '12px',
                    padding: '6px 14px',
                    borderRadius: '7px',
                    border: isActive ? '1px solid #2563eb' : '1px solid #cbd5e1',
                    background: isActive ? '#2563eb' : '#fff',
                    color: isActive ? '#fff' : '#334155',
                    fontWeight: isActive ? 700 : 500,
                    cursor: 'pointer',
                    boxShadow: isActive ? '0 1px 3px rgba(37,99,235,0.2)' : 'none',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Date Range Picker */}
          <div
            className="orders-date-range"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: (orderStartDate || orderEndDate || orderTimeFilter === 'range') ? '#eff6ff' : '#fff',
              border: (orderStartDate || orderEndDate || orderTimeFilter === 'range') ? '1.5px solid #3b82f6' : '1px solid #cbd5e1',
              borderRadius: '8px',
              padding: '5px 12px',
              flexWrap: 'wrap',
              boxShadow: '0 1px 2px rgba(0,0,0,0.03)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '5px', color: (orderStartDate || orderEndDate || orderTimeFilter === 'range') ? '#1d4ed8' : '#64748b' }}>
              <CalendarDays size={15} />
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                Date Range:
              </span>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>From</span>
              <input
                type="date"
                value={orderStartDate}
                onChange={(e) => {
                  setOrderStartDate(e.target.value);
                  setOrderTimeFilter('range');
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  background: '#fff',
                  color: '#0f172a',
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                }}
                title="Filter from date (inclusive)"
              />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
              <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600 }}>To</span>
              <input
                type="date"
                value={orderEndDate}
                onChange={(e) => {
                  setOrderEndDate(e.target.value);
                  setOrderTimeFilter('range');
                }}
                style={{
                  padding: '4px 8px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  fontSize: '12px',
                  background: '#fff',
                  color: '#0f172a',
                  fontWeight: 500,
                  outline: 'none',
                  cursor: 'pointer',
                }}
                title="Filter until date (inclusive)"
              />
            </div>

            {(orderStartDate || orderEndDate) && (
              <button
                type="button"
                onClick={() => {
                  setOrderStartDate('');
                  setOrderEndDate('');
                  setOrderTimeFilter('all');
                }}
                title="Clear date range filter"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '3px',
                  fontSize: '11px',
                  padding: '4px 8px',
                  borderRadius: '5px',
                  border: 'none',
                  background: '#fee2e2',
                  color: '#b91c1c',
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                <X size={12} /> Clear
              </button>
            )}
          </div>
        </div>

        {/* Row 2: Search Query & Status Tabs */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
          {/* Search box */}
          <div className="orders-search-box" style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '8px 14px', borderRadius: '8px', border: '1.5px solid #cbd5e1', width: '380px', minWidth: '260px', boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}>
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search order no. or customer mobile"
              aria-label="Search order number or customer mobile"
              value={orderSearchQuery}
              onChange={(e) => setOrderSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#1e293b' }}
            />
            {orderSearchQuery && (
              <button
                type="button"
                onClick={() => setOrderSearchQuery('')}
                aria-label="Clear search"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Status buttons */}
          <div className="orders-status-tabs" role="group" aria-label="Filter by status" style={{ display: 'flex', gap: '5px' }}>
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
      <div className="orders-summary-strip" style={{ display: 'flex', gap: '16px', background: '#f1f5f9', padding: '10px 16px', borderRadius: '8px', marginBottom: '16px', fontSize: '12px', alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ color: '#475569' }}>
          Filtered Orders: <strong style={{ color: '#0f172a' }}>{filteredMetrics.count}</strong>
        </span>
        <span className="summary-sep" aria-hidden="true" style={{ color: '#94a3b8' }}>•</span>
        <span style={{ color: '#475569' }}>
          Total Billed: <strong style={{ color: '#0f172a' }}>{formatMoney(filteredMetrics.totalAmount)}</strong>
        </span>
        <span className="summary-sep" aria-hidden="true" style={{ color: '#94a3b8' }}>•</span>
        <span style={{ color: '#475569' }}>
          Paid Collected: <strong style={{ color: '#16a34a' }}>{formatMoney(filteredMetrics.totalPaid)}</strong>
        </span>
        <span className="summary-sep" aria-hidden="true" style={{ color: '#94a3b8' }}>•</span>
        <span style={{ color: '#475569' }}>
          Balance Due: <strong style={{ color: filteredMetrics.totalBalance > 0 ? '#d97706' : '#16a34a' }}>{formatMoney(filteredMetrics.totalBalance)}</strong>
        </span>
      </div>

      {/* Natural scrolling table */}
      <div className={`orders-table-wrap ${filteredOrders.length > 0 ? 'desktop-only' : ''}`} style={{ maxHeight: 'calc(100vh - 280px)', overflowY: 'auto' }}>
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
                    <td data-label="Order No">
                      <button
                        type="button"
                        className="order-number"
                        onClick={() => setModal({ type: 'order-detail', orderId: o.id })}
                      >
                        {o.orderNo?.startsWith('#') ? o.orderNo : `#${o.orderNo}`}
                      </button>
                    </td>
                    <td data-label="Customer Name">
                      <strong>{cust?.name || 'Customer'}</strong>
                      <small>+91 {cust?.mobile}</small>
                    </td>
                    <td data-label="Service & Type">{o.service} ({o.type === 'weight' ? 'Weight' : 'Pieces'})</td>
                    <td data-label="Intake Date">{formatDate(o.createdAt)}</td>
                    <td data-label="Promised Due">{formatDate(o.dueDate)}</td>
                    <td data-label="Total Bill"><strong>{formatMoney(o.totalAmount)}</strong></td>
                    <td data-label="Balance Due" className={o.balanceAmount > 0 ? 'balance-due' : 'balance-clear'}>
                      {formatMoney(o.balanceAmount)}
                    </td>
                    <td data-label="Current Status">
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
                        {onDeleteOrder && (
                          <button
                            type="button"
                            className="icon-button"
                            style={{ width: '32px', height: '32px', color: '#dc2626' }}
                            onClick={() => {
                              const orderLabel = o.orderNo?.startsWith('#') ? o.orderNo : `#${o.orderNo}`;
                              if (window.confirm(`Are you sure you want to delete order ${orderLabel} from history? This action cannot be undone.`)) {
                                onDeleteOrder(o.id);
                              }
                            }}
                            title={`Delete order ${o.orderNo}`}
                          >
                            <Trash2 size={15} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>

      {/* Phones: compact expandable rows instead of the wide table */}
      {filteredOrders.length > 0 && (
        <div className="mobile-only">
          <OrderAccordionList orders={filteredOrders} customers={data.customers} setModal={setModal} onDeleteOrder={onDeleteOrder} />
        </div>
      )}
    </div>
  );
}
