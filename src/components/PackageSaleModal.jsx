import React, { useState } from 'react';
import { BadgePercent, Banknote, CreditCard, Infinity, Smartphone, Wallet, X } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';
import { onActivateKey, useEscapeKey } from '../lib/a11y.js';

export default function PackageSaleModal({
  isOpen,
  onClose,
  customer,
  packages,
  onAssignPackage,
  onToast,
}) {
  const [selectedTemplateId, setSelectedTemplateId] = useState(packages[0]?.id || '');
  const [paymentMethod, setPaymentMethod] = useState('upi');
  const [loading, setLoading] = useState(false);
  useEscapeKey(isOpen && Boolean(customer), onClose);

  if (!isOpen || !customer) return null;

  const selectedTemplate = packages.find((p) => p.id === selectedTemplateId) || packages[0];

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!selectedTemplate) {
      onToast('Please select a package.');
      return;
    }

    setLoading(true);
    try {
      await onAssignPackage(customer.id, selectedTemplate.id, paymentMethod);
      onToast(`Package "${selectedTemplate.name}" assigned to ${customer.name}.`);
      onClose();
    } catch (err) {
      onToast(err.message || 'Failed to sell package.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="package-sale-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{ maxWidth: '520px' }}
      >
        <div className="modal-header">
          <div>
            <span className="caption-label">Package Enrollment</span>
            <h3 id="package-sale-modal-title">Sell Package to {customer.name}</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}>
          <div className="modal-content" style={{ padding: '20px', display: 'grid', gap: '16px', flex: 1, minHeight: 0, overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
            <span className="field-label">Select Package Plan</span>
            <div style={{ display: 'grid', gap: '10px' }}>
              {packages.map((pkg) => {
                const isSelected = selectedTemplate?.id === pkg.id;
                const isWallet = pkg.kind === 'wallet';
                const isBogo = pkg.kind === 'buy_x_get_y';
                return (
                  <div
                    key={pkg.id}
                    role="button"
                    tabIndex={0}
                    onClick={() => setSelectedTemplateId(pkg.id)}
                    onKeyDown={onActivateKey(() => setSelectedTemplateId(pkg.id))}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      padding: '14px',
                      borderRadius: '8px',
                      border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                      background: isSelected ? '#eff6ff' : '#fff',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <div
                        style={{
                          width: '38px',
                          height: '38px',
                          borderRadius: '8px',
                          display: 'grid',
                          placeItems: 'center',
                          background: isWallet ? '#eff6ff' : (isBogo ? '#fef3c7' : '#dcfce7'),
                          color: isWallet ? '#1d4ed8' : (isBogo ? '#b45309' : '#15803d'),
                        }}
                      >
                        {isWallet ? <Wallet size={18} /> : <BadgePercent size={18} />}
                      </div>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <strong style={{ fontSize: '13px' }}>{pkg.name}</strong>
                          <span
                            style={{
                              fontSize: '9px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '6px',
                              background: pkg.durationDays ? '#fef3c7' : '#eff6ff',
                              color: pkg.durationDays ? '#b45309' : '#1d4ed8',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '2px',
                            }}
                          >
                            {pkg.durationDays ? `${pkg.durationDays} Days Validity` : (pkg.validity || 'Lifetime · No Expiry')}
                          </span>
                        </div>
                        <small style={{ color: '#666', fontSize: '11px' }}>{pkg.description}</small>
                      </div>
                    </div>
                    <div style={{ textAlign: 'right' }}>
                      <strong style={{ fontSize: '14px', color: '#222' }}>{formatMoney(pkg.price)}</strong>
                      <span style={{ display: 'block', fontSize: '10px', color: '#666' }}>
                        {isWallet ? `+${formatMoney(pkg.walletCredit)} credit` : (isBogo ? `Pay ${pkg.buyQty || 5}, Get ${pkg.freeQty || 1} Free` : `${pkg.discountPercent}% off`)}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Payment Method */}
            <div>
              <span className="field-label" style={{ display: 'block', marginBottom: '8px' }}>Payment Collected Via</span>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                {[
                  { id: 'upi', label: 'UPI / QR', icon: Smartphone },
                  { id: 'cash', label: 'Cash', icon: Banknote },
                  { id: 'card', label: 'Card', icon: CreditCard },
                ].map((m) => {
                  const Icon = m.icon;
                  const isSelected = paymentMethod === m.id;
                  return (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id)}
                      style={{
                        padding: '10px',
                        borderRadius: '8px',
                        border: isSelected ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                        background: isSelected ? '#eff6ff' : '#fff',
                        cursor: 'pointer',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        gap: '6px',
                      }}
                    >
                      <Icon size={16} color={isSelected ? '#2563eb' : '#64748b'} />
                      <span style={{ fontSize: '11px', fontWeight: isSelected ? 700 : 500, color: isSelected ? '#1d4ed8' : '#334155' }}>
                        {m.label}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>

          <div className="modal-footer" style={{ padding: '16px 20px', display: 'flex', justifyContent: 'flex-end', gap: '10px', borderTop: '1px solid #eee' }}>
            <button type="button" className="button secondary" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="button primary" disabled={loading || !selectedTemplate}>
              {loading ? 'Activating...' : `Collect ${formatMoney(selectedTemplate?.price || 0)} & Activate`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
