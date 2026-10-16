import React from 'react';
import { Search, Share2, Trash2, UserPlus, X } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';
import { onActivateKey } from '../lib/a11y.js';
import { CustomerAccordionList } from '../components/MobileLists.jsx';

export default function CustomersView({
  data,
  setView,
  setModal,
  customerSearchQuery,
  setCustomerSearchQuery,
  setSelectedCustomerId,
  onDeleteCustomer,
}) {
  const q = customerSearchQuery.trim().toLowerCase();
  const visibleCustomers = q
    ? data.customers.filter((c) => c.name.toLowerCase().includes(q) || c.mobile.includes(q) || String(c.notes || '').toLowerCase().includes(q))
    : data.customers;
  const openProfile = (id) => {
    setSelectedCustomerId(id);
    setView('customer-detail');
  };

  return (
    <div className="responsive-page-card">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h2 style={{ margin: 0, fontSize: '22px', color: '#1e293b' }}>Customer Directory ({data.customers.length})</h2>
          <p className="muted-copy" style={{ margin: '4px 0 0' }}>All registered laundry accounts and contact records</p>
        </div>

        <div className="customers-page-actions" style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', width: '100%', maxWidth: '640px', justifyContent: 'flex-end' }}>
          <div className="customer-directory-search">
            <Search size={15} color="#94a3b8" />
            <input
              type="text"
              placeholder="Search by name, mobile or notes"
              aria-label="Search customers by name, mobile or notes"
              value={customerSearchQuery}
              onChange={(e) => setCustomerSearchQuery(e.target.value)}
              style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#1e293b' }}
            />
            {customerSearchQuery && (
              <button
                type="button"
                onClick={() => setCustomerSearchQuery('')}
                aria-label="Clear search"
                style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: '2px', display: 'flex' }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          <button
            type="button"
            className="button button-quiet"
            onClick={() => setModal({ type: 'share-price-list' })}
            style={{ color: '#0284c7', borderColor: '#bae6fd' }}
            title="Share store price list link"
          >
            <Share2 size={14} /> Share Price List
          </button>

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
      <div className="orders-table-wrap desktop-only" style={{ maxHeight: 'calc(100vh - 240px)', overflowY: 'auto' }}>
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
            {visibleCustomers.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '48px 20px', color: '#64748b' }}>
                  <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
                  <strong style={{ display: 'block', fontSize: '15px', color: '#1e293b', marginBottom: '4px' }}>
                    {q ? 'No customers match your search.' : 'No customer records found'}
                  </strong>
                  <span style={{ fontSize: '12px' }}>
                    {q ? 'Try clearing your search query.' : 'Click "Add New Customer" above to register your first customer.'}
                  </span>
                </td>
              </tr>
            ) : (
              visibleCustomers.map((c) => {
                const custOrders = data.orders.filter((o) => o.customerId === c.id);
                const custPkgs = (data.customerPackages || []).filter((cp) => cp.customerId === c.id && cp.status !== 'disabled');
                const due = custOrders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);
                return (
                  <tr key={c.id}>
                    <td data-label="Customer Name">
                      <strong role="button" tabIndex={0} style={{ fontSize: '13px', color: '#2563eb', cursor: 'pointer' }} onClick={() => { setSelectedCustomerId(c.id); setView('customer-detail'); }} onKeyDown={onActivateKey(() => { setSelectedCustomerId(c.id); setView('customer-detail'); })}>
                        {c.name}
                      </strong>
                      {c.notes && <small style={{ display: 'block', color: '#64748b' }}>Note: {c.notes}</small>}
                      {custPkgs.length > 0 && (
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '3px' }}>
                          {custPkgs.map((cp) => (
                            <span
                              key={cp.id}
                              style={{
                                fontSize: '10px',
                                background: '#ede9fe',
                                color: '#5b21b6',
                                padding: '1px 6px',
                                borderRadius: '4px',
                                fontWeight: 600,
                              }}
                            >
                              📦 {cp.name}
                            </span>
                          ))}
                        </div>
                      )}
                    </td>
                    <td data-label="Mobile Number">+91 {c.mobile}</td>
                    <td data-label="Address">{c.address || '—'}</td>
                    <td data-label="Wallet Balance"><strong>{formatMoney(c.walletBalance)}</strong></td>
                    <td data-label="Outstanding Balance" className={due > 0 ? 'balance-due' : 'balance-clear'}>
                      {formatMoney(due)}
                    </td>
                    <td data-label="Orders Count">{custOrders.length} {custOrders.length === 1 ? 'order' : 'orders'}</td>
                    <td data-label="Workspace" style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <button
                          type="button"
                          className="button button-quiet"
                          style={{ minHeight: '30px', padding: '0 8px', fontSize: '11px', color: '#0284c7' }}
                          onClick={() => setModal({ type: 'share-price-list', customer: c })}
                          title={`Share price list with ${c.name}`}
                        >
                          <Share2 size={13} />
                        </button>
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
                        {onDeleteCustomer && (
                          <button
                            type="button"
                            className="icon-button"
                            style={{ width: '30px', height: '30px', color: '#dc2626' }}
                            onClick={() => {
                              if (window.confirm(`Are you sure you want to delete customer "${c.name}"? All their orders and history will also be removed.`)) {
                                onDeleteCustomer(c.id);
                              }
                            }}
                            title={`Delete customer ${c.name}`}
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }))}
          </tbody>
        </table>
      </div>

      {/* Phones: compact expandable rows instead of the wide table */}
      <div className="mobile-only">
        <CustomerAccordionList
          customers={visibleCustomers}
          orders={data.orders}
          onOpenProfile={openProfile}
          onSharePriceList={(c) => setModal({ type: 'share-price-list', customer: c })}
          onDeleteCustomer={onDeleteCustomer}
          emptyText={q ? 'No customers match your search.' : 'No customers yet.'}
        />
      </div>
    </div>
  );
}
