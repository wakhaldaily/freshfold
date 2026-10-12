import React from 'react';
import { Search, UserPlus, X } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';
import { onActivateKey } from '../lib/a11y.js';

export default function CustomersView({
  data,
  setView,
  setModal,
  customerSearchQuery,
  setCustomerSearchQuery,
  setSelectedCustomerId,
}) {
  return (
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
                      <strong role="button" tabIndex={0} style={{ fontSize: '13px', color: '#2563eb', cursor: 'pointer' }} onClick={() => { setSelectedCustomerId(c.id); setView('customer-detail'); }} onKeyDown={onActivateKey(() => { setSelectedCustomerId(c.id); setView('customer-detail'); })}>
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
  );
}
