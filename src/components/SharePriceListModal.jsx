import React, { useEffect, useState } from 'react';
import {
  Check,
  Copy,
  ExternalLink,
  MessageSquare,
  QrCode,
  Share2,
  Smartphone,
  Sparkles,
  User,
  X,
} from 'lucide-react';
import QRCode from 'qrcode';
import { useEscapeKey } from '../lib/a11y.js';
import { getShareablePriceListUrl, getSharePriceListWhatsAppText } from '../lib/persistence.js';

export default function SharePriceListModal({
  isOpen,
  onClose,
  customer = null,
  settings = {},
  onToast,
}) {
  useEscapeKey(isOpen, onClose);

  const [copied, setCopied] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [activeTab, setActiveTab] = useState('whatsapp'); // 'whatsapp' | 'qrcode'

  const shareUrl = getShareablePriceListUrl(customer);
  const shareText = getSharePriceListWhatsAppText(settings, customer);

  const customerMobile = customer?.mobile ? String(customer.mobile).replace(/\D/g, '') : '';

  // Generate QR Code on mount / url change
  useEffect(() => {
    if (!isOpen) return;
    let active = true;

    QRCode.toDataURL(shareUrl, {
      width: 260,
      margin: 1.5,
      color: {
        dark: '#0f172a',
        light: '#ffffff',
      },
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => {
        console.error('Failed to generate price list QR code', err);
      });

    return () => {
      active = false;
    };
  }, [isOpen, shareUrl]);

  if (!isOpen) return null;

  const handleCopyLink = async () => {
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(shareUrl);
      } else {
        const temp = document.createElement('input');
        temp.value = shareUrl;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setCopied(true);
      onToast?.('Price list link copied to clipboard!');
      setTimeout(() => setCopied(false), 2200);
    } catch {
      onToast?.('Failed to copy link.');
    }
  };

  const handleSendCustomerWhatsApp = (mode = 'universal') => {
    if (!customerMobile) {
      onToast?.('No customer mobile number available.');
      return;
    }
    const targetUrl = mode === 'web'
      ? `https://web.whatsapp.com/send?phone=91${customerMobile}&text=${encodeURIComponent(shareText)}`
      : `https://wa.me/91${customerMobile}?text=${encodeURIComponent(shareText)}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  const handleGeneralWhatsApp = () => {
    const targetUrl = `https://wa.me/?text=${encodeURIComponent(shareText)}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      className="modal-backdrop"
      style={{
        zIndex: 99990,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(15, 23, 42, 0.7)',
        backdropFilter: 'blur(5px)',
      }}
      onClick={onClose}
    >
      <div
        className="modal-panel"
        style={{
          maxWidth: '520px',
          width: '92%',
          background: '#ffffff',
          borderRadius: '20px',
          boxShadow: '0 25px 60px rgba(0,0,0,0.25)',
          overflow: 'hidden',
          display: 'flex',
          flexDirection: 'column',
          maxHeight: '90vh',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div
          style={{
            padding: '18px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#0284c7',
                color: '#ffffff',
                display: 'grid',
                placeItems: 'center',
                boxShadow: '0 4px 10px rgba(2, 132, 199, 0.3)',
              }}
            >
              <Share2 size={18} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                Share Store Price List
              </h2>
              <span style={{ fontSize: '12px', color: '#64748b' }}>
                Instant mobile link with garment picker & WhatsApp order
              </span>
            </div>
          </div>

          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close modal"
            style={{ width: '32px', height: '32px', borderRadius: '8px' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Modal Content */}
        <div style={{ padding: '20px 22px', overflowY: 'auto', flex: 1 }}>

          {/* Customer Badge (if customer is selected) */}
          {customer ? (
            <div
              style={{
                background: '#f0fdf4',
                border: '1.5px solid #bbf7d0',
                borderRadius: '12px',
                padding: '12px 14px',
                marginBottom: '16px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '12px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div
                  style={{
                    width: '34px',
                    height: '34px',
                    borderRadius: '50%',
                    background: '#16a34a',
                    color: '#ffffff',
                    display: 'grid',
                    placeItems: 'center',
                    fontWeight: 800,
                    fontSize: '12px',
                  }}
                >
                  {customer.name?.slice(0, 2).toUpperCase() || <User size={16} />}
                </div>
                <div>
                  <strong style={{ fontSize: '14px', color: '#166534', display: 'block' }}>
                    {customer.name}
                  </strong>
                  <span style={{ fontSize: '11px', color: '#15803d' }}>
                    +91 {customer.mobile}
                  </span>
                </div>
              </div>

              <span style={{ fontSize: '11px', background: '#dcfce7', color: '#15803d', padding: '3px 8px', borderRadius: '6px', fontWeight: 700 }}>
                Personalized Link
              </span>
            </div>
          ) : (
            <div
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '10px 14px',
                marginBottom: '16px',
                fontSize: '12px',
                color: '#64748b',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
              }}
            >
              <Sparkles size={15} color="#0284c7" />
              <span>Generic Price List Link (can be shared with any walk-in customer or group)</span>
            </div>
          )}

          {/* Tabs: WhatsApp Action / Counter QR Code */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '10px',
              marginBottom: '16px',
            }}
          >
            <button
              type="button"
              onClick={() => setActiveTab('whatsapp')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'whatsapp' ? '#ffffff' : 'transparent',
                color: activeTab === 'whatsapp' ? '#0f172a' : '#64748b',
                fontSize: '12px',
                fontWeight: activeTab === 'whatsapp' ? 800 : 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'whatsapp' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <MessageSquare size={14} color="#16a34a" /> WhatsApp & Link
            </button>

            <button
              type="button"
              onClick={() => setActiveTab('qrcode')}
              style={{
                flex: 1,
                padding: '8px 10px',
                borderRadius: '8px',
                border: 'none',
                background: activeTab === 'qrcode' ? '#ffffff' : 'transparent',
                color: activeTab === 'qrcode' ? '#0f172a' : '#64748b',
                fontSize: '12px',
                fontWeight: activeTab === 'qrcode' ? 800 : 600,
                cursor: 'pointer',
                boxShadow: activeTab === 'qrcode' ? '0 1px 4px rgba(0,0,0,0.06)' : 'none',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '6px',
              }}
            >
              <QrCode size={14} color="#0284c7" /> Counter QR Code
            </button>
          </div>

          {activeTab === 'whatsapp' && (
            <div style={{ display: 'grid', gap: '14px' }}>

              {/* Direct WhatsApp to Customer (Primary Action if customer mobile available) */}
              {customerMobile && (
                <div style={{ display: 'grid', gap: '6px' }}>
                  <button
                    type="button"
                    onClick={() => handleSendCustomerWhatsApp('universal')}
                    style={{
                      width: '100%',
                      padding: '13px 16px',
                      borderRadius: '12px',
                      border: 'none',
                      background: 'linear-gradient(135deg, #16a34a 0%, #15803d 100%)',
                      color: '#ffffff',
                      fontSize: '14px',
                      fontWeight: 800,
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      cursor: 'pointer',
                      boxShadow: '0 4px 14px rgba(22, 163, 74, 0.35)',
                    }}
                  >
                    <MessageSquare size={17} />
                    <span>Send to {customer.name} on WhatsApp (+91 {customer.mobile})</span>
                  </button>

                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    <button
                      type="button"
                      onClick={() => handleSendCustomerWhatsApp('web')}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#64748b',
                        fontSize: '11px',
                        cursor: 'pointer',
                        textDecoration: 'underline',
                      }}
                    >
                      Open in WhatsApp Web instead
                    </button>
                  </div>
                </div>
              )}

              {/* Link Input with 1-Click Copy */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '6px' }}>
                  Shareable Price List Link
                </label>
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    border: '1.5px solid #cbd5e1',
                    borderRadius: '10px',
                    background: '#f8fafc',
                    padding: '4px 6px 4px 12px',
                    gap: '8px',
                  }}
                >
                  <input
                    type="text"
                    readOnly
                    value={shareUrl}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      outline: 'none',
                      fontSize: '12px',
                      color: '#0f172a',
                      fontWeight: 600,
                      width: '100%',
                    }}
                  />
                  <button
                    type="button"
                    onClick={handleCopyLink}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      border: 'none',
                      background: copied ? '#16a34a' : '#0f172a',
                      color: '#ffffff',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                      flexShrink: 0,
                      transition: 'background 0.15s ease',
                    }}
                  >
                    {copied ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copied ? 'Copied!' : 'Copy'}</span>
                  </button>
                </div>
              </div>

              {/* General WhatsApp forward / share to any contact */}
              <button
                type="button"
                onClick={handleGeneralWhatsApp}
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: '#ffffff',
                  color: '#334155',
                  fontSize: '12px',
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: 'pointer',
                }}
              >
                <Share2 size={14} color="#0284c7" />
                <span>Share via WhatsApp to Another Person or Group</span>
              </button>

              {/* Message Preview Box */}
              <div>
                <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#64748b', marginBottom: '6px' }}>
                  WhatsApp Message Preview
                </label>
                <div
                  style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '10px 12px',
                    fontSize: '11px',
                    color: '#334155',
                    lineHeight: 1.5,
                    whiteSpace: 'pre-wrap',
                    maxHeight: '120px',
                    overflowY: 'auto',
                  }}
                >
                  {shareText}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'qrcode' && (
            <div style={{ textAlign: 'center', padding: '10px 0' }}>
              <div
                style={{
                  width: '230px',
                  height: '230px',
                  margin: '0 auto 14px',
                  padding: '10px',
                  background: '#ffffff',
                  borderRadius: '16px',
                  border: '1.5px solid #e2e8f0',
                  boxShadow: '0 8px 20px rgba(0,0,0,0.06)',
                  display: 'grid',
                  placeItems: 'center',
                }}
              >
                {qrDataUrl ? (
                  <img
                    src={qrDataUrl}
                    alt="Scan Price List QR Code"
                    style={{ width: '100%', height: '100%', display: 'block', borderRadius: '8px' }}
                  />
                ) : (
                  <span style={{ fontSize: '12px', color: '#94a3b8' }}>Generating QR Code...</span>
                )}
              </div>

              <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block', marginBottom: '4px' }}>
                Counter Scannable QR Code
              </strong>
              <p style={{ margin: 0, fontSize: '12px', color: '#64748b', maxWidth: '360px', marginInline: 'auto' }}>
                Customers can open their phone camera and point at this code to open the price list & garment bag immediately!
              </p>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div
          style={{
            padding: '14px 22px',
            borderTop: '1px solid #e2e8f0',
            background: '#f8fafc',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
          }}
        >
          <a
            href={shareUrl}
            target="_blank"
            rel="noopener noreferrer"
            style={{
              fontSize: '12px',
              color: '#0284c7',
              textDecoration: 'none',
              fontWeight: 700,
              display: 'inline-flex',
              alignItems: 'center',
              gap: '4px',
            }}
          >
            Preview Mobile Page <ExternalLink size={12} />
          </a>

          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
            style={{ minHeight: '34px', padding: '0 16px', fontSize: '12px' }}
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
