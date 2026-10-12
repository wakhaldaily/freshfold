import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  Download,
  ExternalLink,
  FileText,
  Globe,
  Image as ImageIcon,
  MessageSquare,
  Printer,
  ReceiptText,
  Send,
  Share2,
  Smartphone,
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
import { formatMoney, getShareableBillUrl } from '../lib/persistence.js';
import CrystalClearBill from './CrystalClearBill.jsx';
import ScaledToFit from './ScaledToFit.jsx';
import { useEscapeKey } from '../lib/a11y.js';

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
  const [format, setFormat] = useState('standard');
  const [copied, setCopied] = useState(false);
  const [copiedImage, setCopiedImage] = useState(false);
  const [capturing, setCapturing] = useState(false);
  const [billUrl, setBillUrl] = useState('');
  const [copiedLink, setCopiedLink] = useState(false);

  // Pre-generate the public digital bill URL when modal opens
  useEffect(() => {
    let active = true;
    if (isOpen && order) {
      getShareableBillUrl(order, customer)
        .then((url) => {
          if (!active) return;
          setBillUrl(url);
        })
        .catch((err) => {
          if (active) onToast?.(err.message || 'Could not create the digital bill link.');
        });
    }
    return () => {
      active = false;
    };
  }, [isOpen, order?.id, order?.orderNo, order?.createdAt, customer?.mobile]);
  useEscapeKey(isOpen && Boolean(order), onClose);

  if (!isOpen || !order) return null;

  const rawItems = Array.isArray(order.items) ? order.items : [];
  const items = rawItems.filter((it) => !it.isSurcharge && it.category !== 'Service Surcharge');
  const gross = Number(order.grossAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const taxable = Math.max(0, gross - discount) + Number(order.expressAmount || 0);
  const tax = Number(order.taxAmount || 0);
  const total = Number(order.totalAmount ?? (taxable + tax));
  const paid = Number(order.paidAmount || 0);
  const balance = Number(order.balanceAmount ?? (total - paid));

  const cashierName = currentStaff?.name || 'Counter Cashier';
  const isWeight = order.type === 'weight';

  const captureReceiptBlob = async () => {
    const el = document.getElementById('print-invoice');
    if (!el) return null;
    try {
      // Loaded on demand; html2canvas is large and only needed for image sharing.
      const { default: html2canvas } = await import('html2canvas');
      const fit = Number(el.closest('[data-fit-scale]')?.dataset.fitScale || 1);
      const canvas = await html2canvas(el, {
        scale: 2 / (fit > 0 ? fit : 1),
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      return new Promise((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png');
      });
    } catch (e) {
      console.warn('Canvas capture error', e);
      return null;
    }
  };

  const handleCopyImage = async () => {
    setCapturing(true);
    try {
      const blob = await captureReceiptBlob();
      if (!blob) throw new Error('Could not capture receipt image');
      if (navigator.clipboard && window.ClipboardItem) {
        await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
        setCopiedImage(true);
        onToast?.('Receipt image copied to clipboard! Paste (Ctrl+V) into WhatsApp.');
        setTimeout(() => setCopiedImage(false), 2400);
      } else {
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `CleanClear_Receipt_${order.orderNo || order.id}.png`;
        a.click();
        URL.revokeObjectURL(url);
        onToast?.('Receipt image downloaded.');
      }
    } catch (err) {
      console.warn('Image copy error', err);
      onToast?.('Could not copy image to clipboard.');
    } finally {
      setCapturing(false);
    }
  };

  const handleDownloadPdf = () => {
    downloadThermalReceiptPdf({
      order,
      customer,
      settings,
      payments,
      cashierName,
      format,
    });
    onToast?.(format === 'standard' ? 'Standard tax invoice PDF downloaded.' : 'Thermal receipt PDF downloaded.');
  };

  const handleWhatsApp = (targetMode = 'auto') => {
    let mode = targetMode;
    if (mode === 'auto') {
      const isMobile = typeof navigator !== 'undefined' && /Android|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent || '');
      mode = isMobile ? 'universal' : (settings?.whatsappDispatchMode || 'app');
    }

    shareReceiptWhatsApp({
      order,
      customer,
      settings,
      payments,
      billUrl,
      mode,
      useApp: mode === 'app',
      useWeb: mode === 'web',
    });

    onToast?.(`WhatsApp opened for ${customer?.name || 'customer'} (+91 ${customer?.mobile || ''})!`);

    // 2. In background, copy receipt image to clipboard for easy pasting (Ctrl+V)
    captureReceiptBlob()
      .then((blob) => {
        if (blob && navigator.clipboard && window.ClipboardItem) {
          navigator.clipboard
            .write([new ClipboardItem({ 'image/png': blob })])
            .then(() => {
              onToast?.('WhatsApp opened & receipt image copied to clipboard (Ctrl+V)!');
            })
            .catch(() => {});
        }
      })
      .catch(() => {});
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
    const text = getReceiptShareText({ order, customer, settings, payments, billUrl });
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
        role="dialog"
        aria-modal="true"
        aria-labelledby="thermal-receipt-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: format === 'standard' ? '880px' : '480px',
          maxWidth: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#fff',
          borderRadius: '16px',
          boxShadow: '0 25px 70px rgba(15, 23, 42, 0.25)',
          overflow: 'hidden',
          transition: 'width 0.2s ease',
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
              <span className="caption-label">
                {format === 'standard' ? 'Standard Tax Invoice · Crystal Clear' : 'Thermal Slip · 80mm Roll'}
              </span>
              <h3 id="thermal-receipt-modal-title" style={{ margin: 0, fontSize: '16px', color: '#0f172a', fontWeight: 800 }}>
                Invoice {order.orderNo?.startsWith('#') ? order.orderNo : `#${order.orderNo}`}
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
          {/* Bill Format Selector Tabs */}
          <div style={{ display: 'flex', background: '#e2e8f0', borderRadius: '8px', padding: '2px', marginRight: 'auto' }}>
            <button
              type="button"
              onClick={() => setFormat('standard')}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: format === 'standard' ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                background: format === 'standard' ? '#ffffff' : 'transparent',
                color: format === 'standard' ? '#0f172a' : '#64748b',
                boxShadow: format === 'standard' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              📋 Standard Invoice (Crystal Clear)
            </button>
            <button
              type="button"
              onClick={() => setFormat('thermal')}
              style={{
                padding: '5px 12px',
                fontSize: '11px',
                fontWeight: format === 'thermal' ? 700 : 500,
                borderRadius: '6px',
                border: 'none',
                background: format === 'thermal' ? '#ffffff' : 'transparent',
                color: format === 'thermal' ? '#0f172a' : '#64748b',
                boxShadow: format === 'thermal' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer',
              }}
            >
              🧾 80mm Slip
            </button>
          </div>
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

          {/* WhatsApp Share Button Group (App / wa.me & Web) */}
          <div
            style={{
              display: 'inline-flex',
              borderRadius: '8px',
              overflow: 'hidden',
              border: '1px solid #86efac',
              boxShadow: '0 1px 2px rgba(0,0,0,0.05)',
            }}
          >
            <button
              type="button"
              onClick={() => handleWhatsApp()}
              style={{
                fontSize: '11px',
                minHeight: '36px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                color: '#15803d',
                background: '#f0fdf4',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title={`Send WhatsApp receipt to +91 ${customer?.mobile || ''}`}
            >
              <MessageSquare size={14} color="#16a34a" /> WhatsApp
            </button>
            <button
              type="button"
              onClick={() => handleWhatsApp('app')}
              style={{
                fontSize: '11px',
                minHeight: '36px',
                padding: '0 12px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                color: '#15803d',
                background: '#f0fdf4',
                border: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Launch native WhatsApp Desktop App (Mac/Windows) or Mobile App directly"
            >
              <Smartphone size={14} color="#16a34a" /> WhatsApp App
            </button>
            <button
              type="button"
              onClick={() => handleWhatsApp('web')}
              style={{
                fontSize: '11px',
                minHeight: '36px',
                padding: '0 10px',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
                color: '#166534',
                background: '#dcfce7',
                borderLeft: '1px solid #86efac',
                borderTop: 'none',
                borderRight: 'none',
                borderBottom: 'none',
                fontWeight: 700,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              title="Open customer's chat in WhatsApp Web browser tab"
            >
              <Globe size={13} color="#166534" /> Web
            </button>
          </div>

          {/* Copy Receipt as Image button */}
          <button
            type="button"
            className="button button-quiet"
            onClick={handleCopyImage}
            disabled={capturing}
            style={{
              fontSize: '11px',
              minHeight: '36px',
              padding: '0 11px',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '5px',
              borderRadius: '8px',
              fontWeight: 600,
            }}
            title="Copy receipt as PNG image to clipboard"
          >
            {copiedImage ? <Check size={14} color="#15803d" /> : <ImageIcon size={13} />}
            {copiedImage ? 'Copied Image' : 'Copy Image'}
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
            aria-label="Print to printer"
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
            aria-label="Copy plain receipt text"
          >
            {copied ? <Check size={14} color="#15803d" /> : <Copy size={14} />}
          </button>
        </div>

        {/* WhatsApp Customer Remote Dispatch Bar */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(90deg, #f0fdf4 0%, #ecfdf5 100%)',
            borderBottom: '1px solid #bbf7d0',
            padding: '11px 18px',
            gap: '12px',
            flexWrap: 'wrap',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '9px',
                background: '#16a34a',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
                boxShadow: '0 2px 6px rgba(22, 163, 74, 0.25)',
              }}
            >
              <MessageSquare size={18} />
            </div>
            <div>
              <div style={{ fontSize: '13px', fontWeight: 800, color: '#14532d', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span>Send Bill to Customer WhatsApp</span>
                <span style={{ fontSize: '10px', background: '#dcfce7', color: '#166534', padding: '1px 7px', borderRadius: '4px', fontWeight: 700 }}>
                  Remote Delivery
                </span>
              </div>
              <div style={{ fontSize: '11px', color: '#15803d', marginTop: '1px' }}>
                Customer: <strong>{customer?.name || 'Customer'}</strong> · Mobile: <strong>+91 {customer?.mobile || 'No mobile number'}</strong>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              type="button"
              onClick={() => handleWhatsApp('app')}
              style={{
                padding: '7px 13px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#16a34a',
                color: '#ffffff',
                border: 'none',
                borderRadius: '7px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                boxShadow: '0 2px 5px rgba(22, 163, 74, 0.25)',
              }}
              title="Open customer's chat directly in WhatsApp Mac/Windows Desktop App or Mobile App"
            >
              <Smartphone size={13} /> WhatsApp App
            </button>

            <button
              type="button"
              onClick={() => handleWhatsApp('web')}
              style={{
                padding: '7px 12px',
                fontSize: '11px',
                fontWeight: 700,
                background: '#ffffff',
                color: '#166534',
                border: '1px solid #86efac',
                borderRadius: '7px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              title="Open customer's chat in WhatsApp Web in browser"
            >
              <Globe size={13} /> WhatsApp Web
            </button>

            <button
              type="button"
              onClick={() => {
                if (billUrl) {
                  navigator.clipboard.writeText(billUrl);
                  setCopiedLink(true);
                  onToast?.('Digital bill link copied!');
                  setTimeout(() => setCopiedLink(false), 2000);
                }
              }}
              style={{
                padding: '7px 11px',
                fontSize: '11px',
                fontWeight: 600,
                background: '#ffffff',
                color: '#475569',
                border: '1px solid #cbd5e1',
                borderRadius: '7px',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '4px',
              }}
              title="Copy verified digital bill link"
            >
              {copiedLink ? <Check size={12} color="#15803d" /> : <Copy size={12} />}
              {copiedLink ? 'Copied' : 'Copy Link'}
            </button>
          </div>
        </div>

        {/* Scrollable Receipt Preview Area */}
        <div
          className="modal-content"
          style={{
            padding: '24px 20px',
            background: '#f1f5f9',
            overflowY: 'auto',
            WebkitOverflowScrolling: 'touch',
            overscrollBehavior: 'contain',
            flex: 1,
            minHeight: 0,
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {format === 'standard' ? (
            <ScaledToFit width={820} className="invoice-fit">
            <div
              id="print-invoice"
              className="invoice-paper crystal-clear-print"
              style={{
                width: '100%',
                maxWidth: '820px',
                background: '#ffffff',
                borderRadius: '6px',
                boxShadow: '0 12px 36px rgba(0, 0, 0, 0.08), 0 2px 6px rgba(0, 0, 0, 0.04)',
                border: '1px solid #e2e8f0',
                overflow: 'hidden',
              }}
            >
              <CrystalClearBill
                order={order}
                customer={customer}
                settings={settings}
                cashierName={cashierName}
                previousDue={0}
              />
            </div>
            </ScaledToFit>
          ) : (
            /* Authentic 80mm Thermal Paper Roll */
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
                <strong>{order.orderNo?.startsWith('#') ? order.orderNo : `#${order.orderNo}`}</strong>
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
                  <span style={{ color: '#64748b' }}>{settings?.taxEnabled ? 'Taxable Subtotal:' : 'Subtotal:'}</span>
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

              <span>{settings?.receiptFooter || 'Thank you for choosing Clean Clear Dry Cleaning!'}</span>
              <small style={{ color: '#64748b' }}>
                Please present this invoice during garment pickup.
              </small>
              <div style={{ marginTop: '4px', letterSpacing: '1px', fontWeight: 700, color: '#0f172a' }}>
                WASH WITH CARE · FOLD WITH LOVE
              </div>
            </div>
          </div>
          )}
        </div>
      </div>
    </div>
  );
}
