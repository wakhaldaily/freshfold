import React from 'react';
import { PackagePlus } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';

export default function PackagesView({
  data,
  setModal,
  requireAdmin,
}) {
  return (
    <div className="responsive-page-card">
      <div className="packages-page-header">
        <div>
          <h2 className="packages-page-title">Laundry Benefit Packages ({data.packages.length})</h2>
          <p className="muted-copy" style={{ margin: '4px 0 0' }}>Manage prepaid wallet credits, item-specific offers, and customizable validity plans</p>
        </div>

        <button
          type="button"
          className="button button-primary packages-manage-btn"
          onClick={() => requireAdmin(() => setModal({ type: 'manage-packages' }))}
        >
          <PackagePlus size={16} /> Manage Packages (Create/Edit/Delete)
        </button>
      </div>

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
    </div>
  );
}
