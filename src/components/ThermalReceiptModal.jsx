import React, { useState } from 'react';
import {
  Check,
  Copy,
  Download,
  FileText,
  MessageSquare,
  Printer,
  ReceiptText,
  Share2,
  Sparkles,
  X,
} from 'lucide-react';
import {
  downloadThermalReceiptPdf,
  formatDate,
  formatDateTime,
  getReceiptShareText,
  shareReceiptViaWebShare,
  shareReceiptWhatsApp,
} from '../lib/pdfGenerator.js';
import { formatMoney } from '../lib/persistence.js';

export default function ThermalReceiptModal({
  isOpen,
  onClose,
  order,
  customer,
  settings,
  payments = [],
  currentStaff,
  onToast,
}) {
  const [copied, setCopied] = useState(false);

  if (!isOpen || !order) return null;

  const isWeight = order.type === 'weight';
  const items = Array.isArray(order.items) ? order.items : [];
  const gross = Number(order.grossAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const taxable = gross - discount;
  const tax = Number(order.taxAmount || 0);
  const total = Number(order.totalAmount || (taxable + tax));
  const paid = Number(order.paidAmount || 0);
  const balance = Number(order.balanceAmount ?? (total - paid));

  const cashierName = currentStaff?.name || 'Counter Cashier';

  const handleDownloadPdf = () => {
    downloadThermalReceiptPdf({
      order,
      customer,
      settings,
      payments,
      cashierName,
    });
    onToast?.('Thermal receipt PDF downloaded.');
  };

  const handleWhatsApp = () => {
    shareReceiptWhatsApp({
      order,
      customer,
      settings,
      payments,
    });
  };

  const handleWebShare = async () => {
    const res = await shareReceiptViaWebShare({
      order,
      customer,
      settings,
      payments,
      cashierName,
    });
    if (res.success) {
      onToast?.(res.method === 'file' ? 'Receipt PDF shared.' : 'Receipt shared.');
    } else if (res.method === 'clipboard') {
      onToast?.('Receipt text copied to clipboard.');
    }
  };

  const handleCopy = async () => {
    const text = getReceiptShareText({ order, customer, settings, payments });
    await navigator.clipboard.writeText(text);
    setCopied(true);
    onToast?.('Receipt text copied to clipboard.');
    setTimeout(() => setCopied(false), 2000);
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel invoice-modal"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '480px',
          maxWidth: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 25px 70px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
        }}
      >
        {/* Modal Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 20px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#1d4ed8',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              <ReceiptText size={18} />
            </div>
            <div>
              <span className="caption-label">Thermal Bill · 80mm Roll</span>
              <h3 style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>
                Invoice #{order.orderNo}
              </h3>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: '34px', height: '34px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Action Toolbar */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            padding: '12px 18px',
            background: '#f8fafc',
            borderBottom: '1px solid #e2e8f0',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          {/* Download PDF button */}
          <button
            type="button"
            className="button button-primary"
            onClick={handleDownloadPdf}
            style={{
              fontSize: '11px',
              minHeight: '36px',
              padding: '0 14px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              borderRadius: '8px',
              fontWeight: 700,
            }}
          >
            <Download size={14} /> Download PDF
          </button>

          {/* WhatsApp Share button */}
          <button
            type="button"
            onClick={handleWhatsApp}
            style={{
              fontSize: '11px',
              minHeight: '36px',
              padding: '0 13px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              color: '#15803d',
              borderColor: '#86efac',
              background: '#f0fdf4',
              border: '1px solid #86efac',
              borderRadius: '8px',
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            <MessageSquare size={14} color="#16a34a" /> WhatsApp
          </button>

          {/* Web Share button */}
          <button
            type="button"
            className="button button-quiet"
            onClick={handleWebShare}
            style={{
              fontSize: '11px',
              minHeight: '36px',
              padding: '0 11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: '8px',
            }}
            title="Share via device"
          >
            <Share2 size={13} /> Share
          </button>

          {/* Print button */}
          <button
            type="button"
            className="button button-quiet"
            onClick={handlePrint}
            style={{
              fontSize: '11px',
              minHeight: '36px',
              padding: '0 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: '8px',
            }}
            title="Print to printer"
          >
            <Printer size={14} />
          </button>

          {/* Copy Text button */}
          <button
            type="button"
            className="button button-quiet"
            onClick={handleCopy}
            style={{
              fontSize: '11px',
              minHeight: '36px',
              padding: '0 10px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: '8px',
            }}
            title="Copy plain receipt text"
          >
            {copied ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
          </button>
        </div>

        {/* Scrollable Receipt Preview Area */}
        <div
          className="modal-content"
          style={{
            padding: '24px 20px',
            background: '#f1f5f9',
            overflowY: 'auto',
            flex: 1,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {/* Authentic 80mm Thermal Paper Roll */}
          <div
            id="print-invoice"
            className="invoice-paper"
            style={{
              width: '100%',
              maxWidth: '350px',
              background: '#ffffff',
              borderRadius: '4px',
              padding: '22px 18px',
              boxShadow: '0 12px 36px rgba(0, 0, 0, 0.09), 0 2px 6px rgba(0, 0, 0, 0.04)',
              borderTop: '5px dashed #cbd5e1',
              borderBottom: '5px dashed #cbd5e1',
              borderLeft: '1px solid #e2e8f0',
              borderRight: '1px solid #e2e8f0',
              fontFamily: "'SF Mono', 'Roboto Mono', 'JetBrains Mono', Consolas, 'Courier New', monospace",
              color: '#0f172a',
              fontSize: '11px',
              lineHeight: 1.45,
            }}
          >
            {/* Store Branding Header */}
            <div
              style={{
                textAlign: 'center',
                paddingBottom: '14px',
                borderBottom: '1px dashed #94a3b8',
                display: 'grid',
                gap: '3px',
              }}
            >
              <strong
                style={{
                  fontFamily: 'Manrope, sans-serif',
                  fontSize: '18px',
                  fontWeight: 800,
                  letterSpacing: '0.5px',
                  color: '#0f172a',
                }}
              >
                {settings?.storeName || 'FRESH FOLD'}
              </strong>
              <span style={{ fontSize: '10px', fontWeight: 700, color: '#475569', letterSpacing: '0.8px' }}>
                {settings?.tagline || 'PREMIUM FABRIC CARE'}
              </span>
              <small style={{ color: '#64748b', fontSize: '9px' }}>
                {settings?.address || 'Shop 14, Galleria Market, Gurugram'}
              </small>
              <small style={{ color: '#64748b', fontSize: '9px' }}>
                Phone: {settings?.phone || '+91 98765 43210'}
              </small>
              {settings?.taxEnabled && settings?.taxNumber && (
                <small style={{ color: '#475569', fontSize: '9px', fontWeight: 600 }}>
                  {settings?.taxLabel || 'GST'}IN: {settings?.taxNumber}
                </small>
              )}
              <div style={{ marginTop: '5px' }}>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '2px 8px',
                    border: '1px solid #0f172a',
                    fontSize: '9px',
                    fontWeight: 700,
                    letterSpacing: '0.8px',
                    textTransform: 'uppercase',
                  }}
                >
                  {settings?.taxEnabled ? 'TAX INVOICE / CASH MEMO' : 'ORDER RECEIPT'}
                </span>
              </div>
            </div>

            {/* Receipt Metadata */}
            <div
              style={{
                padding: '10px 0',
                borderBottom: '1px dashed #94a3b8',
                display: 'grid',
                gap: '3px',
                fontSize: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>ORDER NO:</span>
                <strong>#{order.orderNo}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>DATE/TIME:</span>
                <strong>{formatDateTime(order.createdAt)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>PROMISED:</span>
                <strong style={{ color: '#0f172a' }}>{formatDate(order.dueDate)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>CASHIER:</span>
                <strong>{cashierName}</strong>
              </div>
            </div>

            {/* Customer Information */}
            <div
              style={{
                padding: '10px 0',
                borderBottom: '1px dashed #94a3b8',
                display: 'grid',
                gap: '2px',
                fontSize: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>CUSTOMER:</span>
                <strong style={{ fontSize: '11px' }}>{customer?.name || 'Walk-in Customer'}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>MOBILE:</span>
                <span>+91 {customer?.mobile || '—'}</span>
              </div>
              {customer?.address && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>ADDRESS:</span>
                  <span style={{ maxWidth: '180px', textAlign: 'right', overflowWrap: 'anywhere' }}>
                    {customer.address}
                  </span>
                </div>
              )}
              {(customer?.gstin || order?.customerGstin) && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>CUST GSTIN:</span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 600 }}>{customer?.gstin || order?.customerGstin}</span>
                </div>
              )}
              {(customer?.preference || order?.customerPreference) && (customer?.preference !== 'NA' || order?.customerPreference !== 'NA') && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>WASH PREF:</span>
                  <strong style={{ color: '#0f172a' }}>{customer?.preference || order?.customerPreference}</strong>
                </div>
              )}
              {((customer?.rateList && customer.rateList !== 'Default') || (order?.customerRateList && order.customerRateList !== 'Default')) && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>TIER:</span>
                  <span>{customer?.rateList || order?.customerRateList}</span>
                </div>
              )}
            </div>

            {/* Items Table */}
            <div style={{ padding: '10px 0', borderBottom: '1px dashed #94a3b8' }}>
              {/* Header */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) 30px 48px 56px',
                  gap: '4px',
                  paddingBottom: '5px',
                  borderBottom: '1px solid #0f172a',
                  fontSize: '9px',
                  fontWeight: 700,
                  color: '#0f172a',
                }}
              >
                <span>ITEM / SERVICE</span>
                <span style={{ textAlign: 'center' }}>QTY</span>
                <span style={{ textAlign: 'right' }}>RATE</span>
                <span style={{ textAlign: 'right' }}>AMT</span>
              </div>

              {/* Rows */}
              {isWeight ? (
                <div
                  style={{
                    paddingTop: '8px',
                    display: 'grid',
                    gridTemplateColumns: 'minmax(0, 1fr) 34px 44px 56px',
                    gap: '4px',
                    fontSize: '10px',
                  }}
                >
                  <div>
                    <strong style={{ display: 'block' }}>Weight Laundry: {order.service}</strong>
                    <div style={{ fontSize: '9px', color: '#475569', marginTop: '2px', lineHeight: 1.3 }}>
                      {order.weightClothesCount ? `${order.weightClothesCount} Clothes` : ''}
                      {order.weightGarments?.length
                        ? ` · ${order.weightGarments.map((g) => `${g.name} x${g.quantity}`).join(', ')}`
                        : ''}
                      {order.weightAddons?.length
                        ? ` · Addons: ${order.weightAddons.map((a) => a.name).join(', ')}`
                        : ''}
                      {order.weightNote ? ` · Note: ${order.weightNote}` : ''}
                    </div>
                  </div>
                  <span style={{ textAlign: 'center' }}>{order.weightKg}kg</span>
                  <span style={{ textAlign: 'right' }}>
                    ₹{order.weightKg > 0 ? (gross / order.weightKg).toFixed(0) : 0}
                  </span>
                  <strong style={{ textAlign: 'right' }}>{formatMoney(gross)}</strong>
                </div>
              ) : (
                items.map((item, idx) => {
                  const addonExtra = (item.addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
                  const unitWithAddons = Number(item.unitPrice || 0) + addonExtra;
                  const lineTotal = item.quantity * unitWithAddons;
                  const tagList = [
                    item.brand ? `Brand: ${item.brand}` : '',
                    item.color ? `Color: ${item.color}` : '',
                    ...(item.defects || []),
                  ].filter(Boolean);

                  return (
                    <div
                      key={idx}
                      style={{
                        paddingTop: '8px',
                        display: 'grid',
                        gridTemplateColumns: 'minmax(0, 1fr) 30px 48px 56px',
                        gap: '4px',
                        fontSize: '10px',
                        alignItems: 'start',
                      }}
                    >
                      <div>
                        <strong style={{ display: 'block' }}>{item.name}</strong>
                        <div style={{ fontSize: '8.5px', color: '#475569', marginTop: '1px', lineHeight: 1.3 }}>
                          <span>[{item.service || order.service}]</span>
                          {tagList.length > 0 && <span> · {tagList.join(' · ')}</span>}
                          {item.addons?.length > 0 && (
                            <span style={{ color: '#15803d', display: 'block' }}>
                              + {item.addons.map((a) => `${a.name} (₹${a.price})`).join(', ')}
                            </span>
                          )}
                        </div>
                      </div>
                      <span style={{ textAlign: 'center' }}>{item.quantity}</span>
                      <span style={{ textAlign: 'right' }}>₹{unitWithAddons.toFixed(0)}</span>
                      <strong style={{ textAlign: 'right' }}>₹{lineTotal.toFixed(2)}</strong>
                    </div>
                  );
                })
              )}
            </div>

            {/* Totals & Calculations */}
            <div
              style={{
                padding: '10px 0',
                borderBottom: '1px dashed #94a3b8',
                display: 'grid',
                gap: '5px',
                fontSize: '10px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: '#64748b' }}>Gross Amount:</span>
                <strong>{formatMoney(gross)}</strong>
              </div>

              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                  <span>Discount ({order.discountName || `${order.discountPercent}%`}):</span>
                  <strong>-{formatMoney(discount)}</strong>
                </div>
              )}

              {discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#64748b' }}>Taxable Subtotal:</span>
                  <strong>{formatMoney(taxable)}</strong>
                </div>
              )}

              {settings?.taxEnabled && tax > 0 && (
                settings?.splitGst ? (
                  <>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>CGST ({(settings.taxPercent / 2).toFixed(1)}%):</span>
                      <strong>{formatMoney(tax / 2)}</strong>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: '#64748b' }}>SGST ({(settings.taxPercent / 2).toFixed(1)}%):</span>
                      <strong>{formatMoney(tax / 2)}</strong>
                    </div>
                  </>
                ) : (
                  <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                    <span style={{ color: '#64748b' }}>{settings?.taxLabel || 'Tax'} ({settings?.taxPercent}%):</span>
                    <strong>{formatMoney(tax)}</strong>
                  </div>
                )
              )}

              {/* Net Total Box */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '6px 0',
                  marginTop: '4px',
                  borderTop: '1px solid #0f172a',
                  borderBottom: '1px solid #0f172a',
                  fontWeight: 800,
                  fontSize: '12px',
                }}
              >
                <span>NET TOTAL</span>
                <strong style={{ fontSize: '13px' }}>{formatMoney(total)}</strong>
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', paddingTop: '3px' }}>
                <span style={{ color: '#64748b' }}>Paid Amount:</span>
                <strong>{formatMoney(paid)}</strong>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontWeight: 700,
                  color: balance <= 0 ? '#16a34a' : '#dc2626',
                  fontSize: '11px',
                }}
              >
                <span>BALANCE DUE:</span>
                <strong>{balance <= 0 ? '₹0.00 (PAID)' : formatMoney(balance)}</strong>
              </div>
            </div>

            {/* Payments List */}
            {payments.length > 0 && (
              <div style={{ padding: '8px 0', borderBottom: '1px dashed #94a3b8', fontSize: '9px' }}>
                <span style={{ fontWeight: 700, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  PAYMENT TRANSACTIONS:
                </span>
                {payments.map((p, i) => (
                  <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginTop: '2px' }}>
                    <span style={{ color: '#64748b' }}>
                      {formatDateTime(p.createdAt)} · {p.method.toUpperCase()}
                    </span>
                    <strong>{formatMoney(p.amount)}</strong>
                  </div>
                ))}
              </div>
            )}

            {/* Terms & Footer */}
            <div
              style={{
                textAlign: 'center',
                paddingTop: '12px',
                display: 'grid',
                gap: '4px',
                fontSize: '9px',
                color: '#475569',
              }}
            >
              <strong style={{ fontSize: '10px', color: '#0f172a' }}>
                * * * {order.orderNo} * * *
              </strong>
              <span>{settings?.receiptFooter || 'Thank you for choosing Fresh Fold!'}</span>
              <small style={{ color: '#64748b' }}>
                Please present this invoice during garment pickup.
              </small>
              <div style={{ marginTop: '4px', letterSpacing: '1px', fontWeight: 700, color: '#0f172a' }}>
                WASH WITH CARE · FOLD WITH LOVE
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
