import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle2,
  Clock,
  Download,
  FileText,
  Phone,
  Printer,
  Receipt,
  Sparkles,
} from 'lucide-react';
import { verifyBillToken } from '../lib/billSecurity.js';
import { downloadThermalReceiptPdf, formatDate, formatDateTime } from '../lib/pdfGenerator.js';
import { formatMoney, loadStore, loadLocal } from '../lib/persistence.js';
import CrystalClearBill from './CrystalClearBill.jsx';
import { BillSkeleton } from './SkeletonLoader.jsx';

export default function PublicBillView({ billParam, tokenParam, localData }) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [billData, setBillData] = useState(null);

  useEffect(() => {
    let isMounted = true;

    async function fetchBill() {
      setLoading(true);
      setError('');

      // 1. First attempt to check localData or load from local/bootstrap store
      let store = localData;
      if (!store || !Array.isArray(store.orders) || store.orders.length === 0) {
        try {
          store = await loadStore();
        } catch {
          try {
            store = loadLocal();
          } catch {}
        }
      }

      if (store && Array.isArray(store.orders)) {
        const cleanParam = String(billParam || '').trim().toLowerCase();
        const order = store.orders.find(
          (o) => String(o.orderNo || '').trim().toLowerCase() === cleanParam ||
                 String(o.id || '').trim().toLowerCase() === cleanParam
        );
        if (order) {
          const customer = (store.customers || []).find((c) => c.id === order.customerId);
          const isValid = await verifyBillToken(
            order.id,
            order.orderNo,
            order.createdAt,
            customer?.mobile,
            tokenParam
          );

          if (isValid) {
            const payments = (store.payments || []).filter((p) => p.orderId === order.id);
            if (isMounted) {
              setBillData({
                order,
                customer: customer || { name: 'Valued Customer', mobile: '' },
                settings: store.settings,
                payments,
              });
              setLoading(false);
            }
            return;
          }
        }
      }

      // 2. Fetch from backend API /api/public-bill/:billParam?token=:token
      try {
        const res = await fetch(`/api/public-bill/${encodeURIComponent(billParam)}?token=${encodeURIComponent(tokenParam)}`);
        const contentType = res.headers.get('content-type') || '';
        if (contentType.includes('application/json')) {
          const data = await res.json();
          if (!res.ok) {
            throw new Error(data.error || 'Invoice could not be found or verified.');
          }

          if (isMounted) {
            setBillData(data);
            setLoading(false);
          }
          return;
        } else {
          throw new Error('Digital invoice could not be verified on the server.');
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Unable to load invoice. Link may be invalid or expired.');
          setLoading(false);
        }
      }
    }

    if (billParam) {
      fetchBill();
    } else {
      setError('No invoice identifier provided.');
      setLoading(false);
    }

    return () => {
      isMounted = false;
    };
  }, [billParam, tokenParam, localData]);

  if (loading) {
    return <BillSkeleton />;
  }

  if (error || !billData) {
    return (
      <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#f8fafc', padding: '24px' }}>
        <div style={{ maxWidth: '420px', background: '#fff', padding: '32px 24px', borderRadius: '16px', border: '1px solid #fee2e2', textAlign: 'center', boxShadow: '0 10px 25px rgba(0,0,0,0.05)' }}>
          <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: '#fef2f2', color: '#dc2626', display: 'grid', placeItems: 'center', margin: '0 auto 16px' }}>
            <AlertCircle size={24} />
          </div>
          <h3 style={{ margin: '0 0 8px', color: '#991b1b', fontWeight: 800 }}>Invoice Verification Notice</h3>
          <p style={{ color: '#64748b', fontSize: '14px', lineHeight: 1.5, margin: '0 0 20px' }}>
            {error || 'This digital bill link could not be validated. For security, please make sure you used the exact link sent to your WhatsApp.'}
          </p>
          <a
            href="/"
            style={{
              display: 'inline-block',
              padding: '10px 18px',
              background: '#0f172a',
              color: '#fff',
              borderRadius: '8px',
              textDecoration: 'none',
              fontSize: '13px',
              fontWeight: 600,
            }}
          >
            Go to Clean Clear Dry Cleaning Home
          </a>
        </div>
      </div>
    );
  }

  const { order, customer, settings, payments = [] } = billData;
  const storeName = settings?.storeName || 'Clean Clear Dry Cleaning';
  const total = Number(order.totalAmount || 0);
  const paid = Number(order.paidAmount || 0);
  const balance = Number(order.balanceAmount ?? (total - paid));
  const isPaid = balance <= 0;

  const handleDownloadPdf = () => {
    downloadThermalReceiptPdf({
      order,
      customer,
      settings,
      payments,
      cashierName: 'Store Service Desk',
    });
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f1f5f9', padding: '20px 12px 60px', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '860px', margin: '0 auto' }}>

        {/* Top Actions Floating Bar */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: '#0284c7', color: '#fff', display: 'grid', placeItems: 'center', fontWeight: 800 }}>
              🧺
            </div>
            <strong style={{ fontSize: '15px', color: '#0f172a' }}>{storeName}</strong>
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              type="button"
              onClick={handleDownloadPdf}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 14px',
                background: '#0284c7',
                color: '#fff',
                border: 'none',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 2px 6px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Download size={14} /> Download PDF
            </button>
            <button
              type="button"
              onClick={handlePrint}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '8px 12px',
                background: '#fff',
                color: '#334155',
                border: '1px solid #cbd5e1',
                borderRadius: '8px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <Printer size={14} /> Print
            </button>
          </div>
        </div>

        {/* Invoice Card */}
        <div
          style={{
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)',
            border: '1px solid #e2e8f0',
            overflow: 'hidden',
          }}
        >
          {/* Card Header & Status Banner */}
          <div style={{ padding: '24px 20px 20px', background: isPaid ? 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)' : 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)', borderBottom: '1px solid #f1f5f9' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '14px' }}>
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.8px', color: '#64748b' }}>
                  Official Digital Invoice
                </span>
                <h1 style={{ margin: '2px 0 0', fontSize: '22px', fontWeight: 800, color: '#0f172a' }}>
                  #{order.orderNo || order.id}
                </h1>
              </div>

              <div style={{ textAlign: 'right' }}>
                <span
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    padding: '4px 10px',
                    borderRadius: '999px',
                    fontSize: '12px',
                    fontWeight: 700,
                    background: isPaid ? '#dcfce7' : '#fef3c7',
                    color: isPaid ? '#15803d' : '#b45309',
                  }}
                >
                  {isPaid ? <CheckCircle2 size={13} /> : <Clock size={13} />}
                  {isPaid ? 'PAID IN FULL' : `DUE: ${formatMoney(balance)}`}
                </span>
                <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px' }}>
                  Status: <strong style={{ color: '#0f172a' }}>{order.status || 'Received'}</strong>
                </div>
              </div>
            </div>

            {/* Store & Customer meta */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', background: '#f8fafc', padding: '12px 14px', borderRadius: '10px', fontSize: '12px' }}>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px' }}>Customer:</div>
                <strong style={{ color: '#0f172a' }}>{customer?.name || 'Valued Customer'}</strong>
                {customer?.mobile && <div style={{ color: '#64748b', fontSize: '11px' }}>+91 {customer.mobile}</div>}
              </div>
              <div>
                <div style={{ color: '#64748b', fontSize: '11px' }}>Dates:</div>
                <div style={{ color: '#0f172a' }}>Booked: {formatDate(order.createdAt)}</div>
                <div style={{ color: '#0284c7', fontWeight: 600 }}>Due: {formatDate(order.dueDate)}</div>
              </div>
            </div>
          </div>

          {/* Items & Services Section */}
          <div style={{ padding: '20px' }}>
            <h4 style={{ margin: '0 0 12px', fontSize: '13px', fontWeight: 700, color: '#475569', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              Service Particulars
            </h4>

            {order.type === 'weight' ? (
              <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '10px', border: '1px solid #e2e8f0', marginBottom: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '6px' }}>
                  <strong style={{ color: '#0f172a' }}>{order.service} (By Weight)</strong>
                  <span style={{ fontWeight: 700, color: '#0f172a' }}>{formatMoney(order.grossAmount)}</span>
                </div>
                <div style={{ fontSize: '12px', color: '#64748b' }}>
                  Weight: <strong>{order.weightKg} kg</strong> {order.weightClothesCount ? `(${order.weightClothesCount} pcs)` : ''}
                </div>
                {Array.isArray(order.weightGarments) && order.weightGarments.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#475569', marginTop: '6px' }}>
                    Clothes: {order.weightGarments.map((g) => `${g.name} x${g.quantity}`).join(', ')}
                  </div>
                )}
                {Array.isArray(order.weightAddons) && order.weightAddons.length > 0 && (
                  <div style={{ fontSize: '11px', color: '#0284c7', marginTop: '4px' }}>
                    Top-ups: {order.weightAddons.map((a) => `${a.name} (+${formatMoney(a.price)})`).join(', ')}
                  </div>
                )}
                {order.weightNote && (
                  <div style={{ fontSize: '11px', color: '#64748b', marginTop: '4px', fontStyle: 'italic' }}>
                    Note: {order.weightNote}
                  </div>
                )}
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '10px', marginBottom: '16px' }}>
                {(order.items || []).filter((it) => !it.isSurcharge && it.category !== 'Service Surcharge').map((item, idx) => {
                  const addonExtra = (item.addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
                  const lineTotal = item.quantity * (Number(item.unitPrice || 0) + addonExtra);
                  const tags = [item.brand ? `Brand: ${item.brand}` : '', item.color ? `Color: ${item.color}` : '', ...(item.defects || [])].filter(Boolean);

                  return (
                    <div
                      key={item.id || idx}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'flex-start',
                        paddingBottom: '10px',
                        borderBottom: idx < (order.items.length - 1) ? '1px dashed #e2e8f0' : 'none',
                        fontSize: '13px',
                      }}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: '#0f172a' }}>
                          {item.quantity}x {item.name}
                        </div>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          Service: {item.service || order.service}
                        </div>
                        {tags.length > 0 && (
                          <div style={{ fontSize: '10px', color: '#475569', marginTop: '2px' }}>
                            {tags.join(' • ')}
                          </div>
                        )}
                        {Array.isArray(item.addons) && item.addons.length > 0 && (
                          <div style={{ fontSize: '10px', color: '#0284c7', marginTop: '2px' }}>
                            Add-ons: {item.addons.map((a) => `${a.name} (+${formatMoney(a.price)})`).join(', ')}
                          </div>
                        )}
                      </div>

                      <strong style={{ color: '#0f172a' }}>{formatMoney(lineTotal)}</strong>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Price Breakdown */}
            <div style={{ background: '#f8fafc', padding: '14px', borderRadius: '12px', border: '1px solid #e2e8f0' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                <span>Gross Amount</span>
                <span>{formatMoney(order.grossAmount)}</span>
              </div>

              {order.discountAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#16a34a', marginBottom: '6px' }}>
                  <span>Discount ({order.discountName || `${order.discountPercent}%`})</span>
                  <span>-{formatMoney(order.discountAmount)}</span>
                </div>
              )}

              {order.taxAmount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                  <span>Tax ({settings?.taxLabel || 'GST'} {settings?.taxPercent || 18}%)</span>
                  <span>+{formatMoney(order.taxAmount)}</span>
                </div>
              )}

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '16px', fontWeight: 800, color: '#0f172a', paddingTop: '10px', borderTop: '1px solid #cbd5e1', marginTop: '6px' }}>
                <span>Grand Total</span>
                <span>{formatMoney(total)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#15803d', paddingTop: '6px', fontWeight: 600 }}>
                <span>Paid to Date</span>
                <span>{formatMoney(paid)}</span>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '14px', color: isPaid ? '#15803d' : '#b45309', paddingTop: '6px', fontWeight: 800, borderTop: '1px dashed #cbd5e1', marginTop: '6px' }}>
                <span>Balance Due</span>
                <span>{formatMoney(balance)}</span>
              </div>
            </div>

            {/* Store Information & Help Footer */}
            <div style={{ marginTop: '20px', textAlign: 'center', fontSize: '12px', color: '#64748b' }}>
              <div style={{ fontWeight: 600, color: '#334155' }}>{storeName}</div>
              {settings?.address && <div>{settings.address}</div>}
              {settings?.taxNumber && <div>GSTIN: {settings.taxNumber}</div>}
              {settings?.phone && (
                <div style={{ marginTop: '8px' }}>
                  <a
                    href={`tel:${settings.phone}`}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '5px',
                      color: '#0284c7',
                      textDecoration: 'none',
                      fontWeight: 600,
                    }}
                  >
                    <Phone size={13} /> Call Store: {settings.phone}
                  </a>
                </div>
              )}
              {settings?.receiptFooter && (
                <p style={{ fontSize: '11px', color: '#94a3b8', marginTop: '12px', lineHeight: 1.4 }}>
                  {settings.receiptFooter}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Bottom Floating PDF Download CTA */}
        <div style={{ marginTop: '20px', textAlign: 'center' }}>
          <button
            type="button"
            onClick={handleDownloadPdf}
            style={{
              width: '100%',
              padding: '14px 20px',
              background: '#0f172a',
              color: '#ffffff',
              border: 'none',
              borderRadius: '12px',
              fontSize: '14px',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '8px',
              cursor: 'pointer',
              boxShadow: '0 4px 12px rgba(15, 23, 42, 0.15)',
            }}
          >
            <Download size={16} /> Download Official PDF Receipt
          </button>
        </div>

      </div>
    </div>
  );
}
