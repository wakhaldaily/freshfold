import React, { useState } from 'react';
import { Banknote, CreditCard, Smartphone, Wallet, X } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';

export default function PaymentModal({
  isOpen,
  onClose,
  order,
  customer,
  onRecordPayment,
  onToast,
}) {
  const [method, setMethod] = useState('cash');
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(false);

  if (!isOpen || !order) return null;

  const balance = Number(order.balanceAmount || 0);
  const currentAmount = amount === '' ? balance : Number(amount);
  const walletBalance = Number(customer?.walletBalance || 0);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (currentAmount <= 0) {
      onToast('Enter a payment amount greater than zero.');
      return;
    }
    if (currentAmount > balance + 0.01) {
      onToast(`Payment cannot exceed balance due (${formatMoney(balance)}).`);
      return;
    }

    if (method === 'wallet') {
      if (walletBalance < balance) {
        onToast(`Wallet has ${formatMoney(walletBalance)}. Full balance of ${formatMoney(balance)} is required.`);
        return;
      }
      if (Math.abs(currentAmount - balance) > 0.01) {
        onToast('Wallet payment must cover the full balance due.');
        return;
      }
    }

    setLoading(true);
    try {
      await onRecordPayment(order.id, currentAmount, method);
      onToast(`Payment of ${formatMoney(currentAmount)} recorded via ${method.toUpperCase()}.`);
      onClose();
    } catch (err) {
      onToast(err.message || 'Payment could not be recorded.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
        <div className="modal-header">
          <div>
            <span className="caption-label">Order Payment</span>
            <h3>Collect Payment #{order.orderNo}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-content" style={{ padding: '20px', display: 'grid', gap: '16px' }}>
            <div style={{ background: '#f8f8fc', padding: '14px', borderRadius: '10px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <span style={{ fontSize: '11px', color: '#666', display: 'block' }}>Customer: {customer?.name}</span>
                <span style={{ fontSize: '11px', color: '#666' }}>Wallet Balance: <strong>{formatMoney(walletBalance)}</strong></span>
              </div>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '11px', color: '#666', display: 'block' }}>Balance Due</span>
                <strong style={{ fontSize: '18px', color: '#c8474e' }}>{formatMoney(balance)}</strong>
              </div>
            </div>

            {/* Payment Method Selector */}
            <div>
              <span className="field-label" style={{ display: 'block', marginBottom: '8px' }}>Payment Method</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '8px' }}>
                {[
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'upi', label: 'UPI / QR', icon: Smartphone },
                  { id: 'card', label: 'Card', icon: CreditCard },
                  { id: 'wallet', label: 'Wallet', icon: Wallet },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = method === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => {
                        setMethod(m.id);
                        if (m.id === 'wallet') setAmount(String(balance));
                      }}
                      style={{
                        padding: '12px 6px',
                        borderRadius: '8px',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSelected ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                        display: 'grid',
                        justifyItems: 'center',
                        gap: '6px',
                      }}
                    >
                      <Icon size={18} color={isSelected ? '#2563eb' : '#64748b'} />
                      <span style={{ fontSize: '11px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#1d4ed8' : '#334155' }}>
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Amount input */}
            <label className="field-group">
              <span className="field-label">Amount to Collect (₹)</span>
              <input
                type="number"
                step="0.01"
                min="0.01"
                max={balance}
                value={amount === '' ? balance : amount}
                onChange={(e) => setAmount(e.target.value)}
                disabled={method === 'wallet'}
                required
              />
            </label>

            {method === 'wallet' && (
              <div style={{ fontSize: '11px', padding: '10px 12px', borderRadius: '8px', background: walletBalance >= balance ? '#f0fdf4' : '#fef2f2', color: walletBalance >= balance ? '#166534' : '#991b1b', border: '1px solid currentColor' }}>
                {walletBalance >= balance ? (
                  <span>Customer has sufficient wallet funds ({formatMoney(walletBalance)}). Full balance will be deducted.</span>
                ) : (
                  <span>Insufficient wallet balance ({formatMoney(walletBalance)}). Please choose Cash, UPI, or Card.</span>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #eee' }}>
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="button primary"
              disabled={loading || (method === 'wallet' && walletBalance < balance)}
            >
              {loading ? 'Processing...' : `Collect ${formatMoney(currentAmount)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
