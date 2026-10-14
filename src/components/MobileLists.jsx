import React from 'react';
import { ChevronDown, Phone, ReceiptText, Share2, UserRound } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';
import { formatDate } from '../lib/dateFormat.js';

/**
 * Compact, expandable lists for phones. Each row shows the essentials in one line;
 * tapping it reveals the details and actions. Built on <details>/<summary> so it is
 * keyboard and screen-reader accessible without extra state.
 */

const orderNoLabel = (o) => (o.orderNo?.startsWith('#') ? o.orderNo : `#${o.orderNo}`);

export function OrderAccordionList({ orders, customers, setModal, onDeleteOrder, showCustomer = true, emptyText = 'No orders to show.' }) {
  if (!orders.length) return <p className="m-list-empty">{emptyText}</p>;
  const byId = new Map(customers.map((c) => [c.id, c]));
  return (
    <ul className="m-list" aria-label="Orders">
      {orders.map((o) => {
        const cust = byId.get(o.customerId);
        const due = Number(o.balanceAmount) > 0;
        return (
          <li key={o.id}>
            <details className="m-row">
              <summary>
                <span className="m-row-main">
                  <span className="m-row-title">
                    <strong className="m-row-ref">{orderNoLabel(o)}</strong>
                    {showCustomer && <span className="m-row-name">{cust?.name || 'Customer'}</span>}
                  </span>
                  <span className="m-row-sub">
                    {o.service} · Due {formatDate(o.dueDate)}
                  </span>
                </span>
                <span className="m-row-side">
                  <span className={`status-pill status-${String(o.status).toLowerCase()}`}><i />{o.status}</span>
                  <span className={due ? 'm-row-amount balance-due' : 'm-row-amount'}>
                    {due ? `${formatMoney(o.balanceAmount)} due` : formatMoney(o.totalAmount)}
                  </span>
                </span>
                <ChevronDown size={16} className="m-row-chevron" aria-hidden="true" />
              </summary>
              <div className="m-row-body">
                <dl>
                  {showCustomer && cust?.mobile && (<><dt>Mobile</dt><dd>+91 {cust.mobile}</dd></>)}
                  <dt>Type</dt><dd>{o.type === 'weight' ? `Weight · ${o.weightKg} kg` : 'Pieces'}</dd>
                  <dt>Intake</dt><dd>{formatDate(o.createdAt)}</dd>
                  <dt>Promised</dt><dd>{formatDate(o.dueDate)}</dd>
                  <dt>Total bill</dt><dd><strong>{formatMoney(o.totalAmount)}</strong></dd>
                  <dt>Balance due</dt><dd className={due ? 'balance-due' : 'balance-clear'}>{formatMoney(o.balanceAmount)}</dd>
                </dl>
                <div className="m-row-actions">
                  <button type="button" className="button button-quiet" onClick={() => setModal({ type: 'order-detail', orderId: o.id })}>
                    Manage
                  </button>
                  <button type="button" className="button button-quiet" onClick={() => setModal({ type: 'thermal-receipt', orderId: o.id })}>
                    <ReceiptText size={14} /> Receipt
                  </button>
                  {onDeleteOrder && (
                    <button
                      type="button"
                      className="button button-quiet"
                      style={{ color: '#dc2626' }}
                      onClick={() => {
                        const orderLabel = o.orderNo?.startsWith('#') ? o.orderNo : `#${o.orderNo}`;
                        if (window.confirm(`Are you sure you want to delete order ${orderLabel} from history?`)) {
                          onDeleteOrder(o.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}

export function CustomerAccordionList({ customers, orders, onOpenProfile, onSharePriceList, onDeleteCustomer, emptyText = 'No customers to show.' }) {
  if (!customers.length) return <p className="m-list-empty">{emptyText}</p>;
  return (
    <ul className="m-list" aria-label="Customers">
      {customers.map((c) => {
        const custOrders = orders.filter((o) => o.customerId === c.id);
        const dueAmount = custOrders.reduce((sum, o) => sum + (Number(o.balanceAmount) || 0), 0);
        return (
          <li key={c.id}>
            <details className="m-row">
              <summary>
                <span className="m-row-main">
                  <span className="m-row-title">
                    <strong className="m-row-ref m-row-ref-name">{c.name}</strong>
                  </span>
                  <span className="m-row-sub">+91 {c.mobile} · {custOrders.length} {custOrders.length === 1 ? 'order' : 'orders'}</span>
                </span>
                <span className="m-row-side">
                  {dueAmount > 0
                    ? <span className="m-row-amount balance-due">{formatMoney(dueAmount)} due</span>
                    : <span className="m-row-amount balance-clear">Paid up</span>}
                  {Number(c.walletBalance) > 0 && <span className="m-row-hint">Wallet {formatMoney(c.walletBalance)}</span>}
                </span>
                <ChevronDown size={16} className="m-row-chevron" aria-hidden="true" />
              </summary>
              <div className="m-row-body">
                <dl>
                  <dt>Address</dt><dd>{c.address || '—'}</dd>
                  <dt>Wallet</dt><dd><strong>{formatMoney(c.walletBalance)}</strong></dd>
                  <dt>Outstanding</dt><dd className={dueAmount > 0 ? 'balance-due' : 'balance-clear'}>{formatMoney(dueAmount)}</dd>
                  {c.notes && (<><dt>Note</dt><dd>{c.notes}</dd></>)}
                </dl>
                <div className="m-row-actions">
                  <a className="button button-quiet" href={`tel:+91${String(c.mobile).replace(/\D/g, '').slice(-10)}`}>
                    <Phone size={14} /> Call
                  </a>
                  {onSharePriceList && (
                    <button type="button" className="button button-quiet" onClick={() => onSharePriceList(c)}>
                      <Share2 size={14} /> Share Price List
                    </button>
                  )}
                  <button type="button" className="button button-primary" onClick={() => onOpenProfile(c.id)}>
                    <UserRound size={14} /> Open Profile
                  </button>
                  {onDeleteCustomer && (
                    <button
                      type="button"
                      className="button button-quiet"
                      style={{ color: '#dc2626' }}
                      onClick={() => {
                        if (window.confirm(`Are you sure you want to delete customer "${c.name}"? All their orders and history will also be removed.`)) {
                          onDeleteCustomer(c.id);
                        }
                      }}
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            </details>
          </li>
        );
      })}
    </ul>
  );
}
