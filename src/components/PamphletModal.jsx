import React, { useState, useEffect, useRef } from 'react';
import {
  X, Printer, Download, Share2, Copy, Check, Phone, MessageSquare,
  MapPin, Clock, Sparkles, Shirt, Wind, Waves, CheckCircle2,
  QrCode, FileText, ArrowRight, Eye, RefreshCw, Star, Tag, Palette,
  Snowflake, Gift, Flame, Percent
} from 'lucide-react';
import QRCode from 'qrcode';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

export default function PamphletModal({
  isOpen,
  onClose,
  settings = {},
  packages = [],
  services = [],
  onToast,
}) {
  const [storeName, setStoreName] = useState(settings?.storeName || 'Clean Clear Dry Cleaning');
  const [tagline, setTagline] = useState(settings?.tagline || 'Premium Fabric Care, German Steam Press & Doorstep Laundry');
  const [phone, setPhone] = useState(settings?.phone || '70057 28774');
  const [address, setAddress] = useState(settings?.address || 'Shop 12, Ground Floor, Galleria Market');
  const [promoHeadline, setPromoHeadline] = useState('✨ FLAT 20% OFF ON YOUR FIRST ORDER · FREE HOME PICKUP');
  const [promoSubtext, setPromoSubtext] = useState('Call or WhatsApp our admin team to schedule an instant doorstep pickup!');
  const [timing, setTiming] = useState('Mon - Sun: 8:00 AM - 9:00 PM');
  
  // Seasonal Winter Offer States
  const [showWinterOffers, setShowWinterOffers] = useState(true);
  const [winterHeadline, setWinterHeadline] = useState('❄️ SPECIAL WINTER WARMTH OFFERS — LIMITED TIME!');
  const [winterSubtext, setWinterSubtext] = useState('Keep your sweaters, heavy blankets & home curtains pristine with exclusive winter savings!');

  const [format, setFormat] = useState('a4'); // 'a4', 'a5', 'digital'
  const [theme, setTheme] = useState('blue'); // 'blue', 'emerald', 'violet', 'amber', 'mono'
  const [showQr, setShowQr] = useState(true);
  const [showPrices, setShowPrices] = useState(true);
  const [showPackages, setShowPackages] = useState(true);
  const [showHowItWorks, setShowHowItWorks] = useState(true);

  const [qrDataUrl, setQrDataUrl] = useState('');
  const [copied, setCopied] = useState(false);
  const [isExporting, setIsExporting] = useState(false);

  const pamphletRef = useRef(null);

  // Sync with store settings when opened
  useEffect(() => {
    if (isOpen) {
      if (settings?.storeName) setStoreName(settings.storeName);
      if (settings?.tagline) setTagline(settings.tagline);
      if (settings?.phone) setPhone(settings.phone);
      if (settings?.address) setAddress(settings.address);
    }
  }, [isOpen, settings]);

  // Clean phone number for WhatsApp and Tel links
  const cleanPhone = (phone || '').replace(/\D/g, '');
  const waUrl = `https://wa.me/91${cleanPhone}?text=${encodeURIComponent(`Hello ${storeName}! I would like to schedule a dry cleaning / washing pickup.`)}`;

  // Generate QR code for WhatsApp direct contact
  useEffect(() => {
    if (!isOpen) return;
    let active = true;
    QRCode.toDataURL(waUrl, {
      width: 240,
      margin: 1,
      color: {
        dark: theme === 'mono' ? '#000000' : '#0f172a',
        light: '#ffffff',
      },
      errorCorrectionLevel: 'M',
    })
      .then((url) => {
        if (active) setQrDataUrl(url);
      })
      .catch((err) => console.warn('QR generation error:', err));

    return () => {
      active = false;
    };
  }, [isOpen, waUrl, theme]);

  if (!isOpen) return null;

  // Theme palettes
  const THEMES = {
    blue: {
      primary: '#1e40af',
      primaryDark: '#1e3a8a',
      accent: '#3b82f6',
      badgeBg: '#eff6ff',
      badgeText: '#1d4ed8',
      heroBg: 'linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%)',
      cardBorder: '#bfdbfe',
      lightBg: '#f8fafc',
      highlight: '#dbeafe',
      tagColor: '#2563eb',
    },
    emerald: {
      primary: '#065f46',
      primaryDark: '#064e3b',
      accent: '#10b981',
      badgeBg: '#ecfdf5',
      badgeText: '#047857',
      heroBg: 'linear-gradient(135deg, #064e3b 0%, #059669 100%)',
      cardBorder: '#a7f3d0',
      lightBg: '#f0fdf4',
      highlight: '#d1fae5',
      tagColor: '#059669',
    },
    violet: {
      primary: '#5b21b6',
      primaryDark: '#4c1d95',
      accent: '#8b5cf6',
      badgeBg: '#f5f3ff',
      badgeText: '#6d28d9',
      heroBg: 'linear-gradient(135deg, #4c1d95 0%, #7c3aed 100%)',
      cardBorder: '#ddd6fe',
      lightBg: '#faf5ff',
      highlight: '#ede9fe',
      tagColor: '#7c3aed',
    },
    amber: {
      primary: '#92400e',
      primaryDark: '#78350f',
      accent: '#f59e0b',
      badgeBg: '#fef3c7',
      badgeText: '#b45309',
      heroBg: 'linear-gradient(135deg, #78350f 0%, #d97706 100%)',
      cardBorder: '#fde68a',
      lightBg: '#fffbeb',
      highlight: '#fef3c7',
      tagColor: '#d97706',
    },
    mono: {
      primary: '#09090b',
      primaryDark: '#000000',
      accent: '#27272a',
      badgeBg: '#f4f4f5',
      badgeText: '#18181b',
      heroBg: 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
      cardBorder: '#e4e4e7',
      lightBg: '#fafafa',
      highlight: '#f4f4f5',
      tagColor: '#09090b',
    },
  };

  const activeTheme = THEMES[theme] || THEMES.blue;

  // Print Handler
  const handlePrint = () => {
    document.body.classList.add('printing-pamphlet');
    window.print();
    const cleanup = () => {
      document.body.classList.remove('printing-pamphlet');
      window.removeEventListener('afterprint', cleanup);
    };
    window.addEventListener('afterprint', cleanup);
    setTimeout(() => {
      document.body.classList.remove('printing-pamphlet');
    }, 2000);
  };

  // Download Image Handler (PNG)
  const handleDownloadPng = async () => {
    if (!pamphletRef.current) return;
    setIsExporting(true);
    onToast?.('Generating high-resolution pamphlet image...');
    try {
      const canvas = await html2canvas(pamphletRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const dataUrl = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `${storeName.replace(/\s+/g, '_')}_Pamphlet.png`;
      link.href = dataUrl;
      link.click();
      onToast?.('Pamphlet image downloaded successfully!');
    } catch (err) {
      console.error('Pamphlet image export error:', err);
      onToast?.('Could not export pamphlet image.');
    } finally {
      setIsExporting(false);
    }
  };

  // Download PDF Handler
  const handleDownloadPdf = async () => {
    if (!pamphletRef.current) return;
    setIsExporting(true);
    onToast?.('Generating printable PDF brochure...');
    try {
      const canvas = await html2canvas(pamphletRef.current, {
        scale: 2.5,
        useCORS: true,
        backgroundColor: '#ffffff',
        logging: false,
      });
      const imgData = canvas.toDataURL('image/png');
      const isA5 = format === 'a5';
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: isA5 ? 'a5' : 'a4',
      });

      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, Math.min(pageHeight, imgHeight));
      pdf.save(`${storeName.replace(/\s+/g, '_')}_Brochure.pdf`);
      onToast?.('Printable PDF brochure downloaded!');
    } catch (err) {
      console.error('Pamphlet PDF export error:', err);
      onToast?.('Could not export pamphlet PDF.');
    } finally {
      setIsExporting(false);
    }
  };

  // Marketing Text generator for WhatsApp
  const marketingText = `🧺 *${storeName}* 🧺\n${tagline}\n\n` +
    (showWinterOffers
      ? `❄️ *EXCLUSIVE WINTER OFFERS (LIMITED TIME):*\n` +
        `• 🧥 *5 Sweaters:* Pay for 5 Sweaters, Get 1 Sweater FREE!\n` +
        `• 🛏️ *2 Combo Blankets:* 20% to 25% OFF on Heavy Blankets & Quilts!\n` +
        `• 🪟 *Curtains:* Flat 25% OFF on Curtain Dry Cleaning & Steam Pressing!\n\n`
      : '') +
    `📞 *Call Admin for Free Pickup:* +91 ${phone}\n` +
    `💬 *WhatsApp Booking:* ${waUrl}\n` +
    `📍 *Store Location:* ${address}\n` +
    `⏰ *Timings:* ${timing}\n\n` +
    `✨ *OUR SERVICES:*\n` +
    `• 🧥 *Dry Cleaning:* Suits, Sarees, Silks, Jackets, Woolens & Designer Wear\n` +
    `• 💨 *German Steam Press:* Wrinkle-free precision pressing & anti-shine finish\n` +
    `• 🧺 *Wash & Fold / Wash & Iron:* Everyday clothes & sheets by kilo (from ₹90/kg)\n` +
    `• 🛏️ *Heavy Household:* Blankets, Quilts, Dohar, Curtains & Sofa Covers\n` +
    `• ⚡ *Express Turnaround:* 24-48 Hours delivery available for urgent orders\n\n` +
    `🎁 *Welcome Deal:* ${promoHeadline}\n\n` +
    `👉 Save our number and message us on WhatsApp anytime for easy doorstep laundry pickups!`;

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(marketingText)}`;
    window.open(url, '_blank');
  };

  const handleCopyText = async () => {
    try {
      await navigator.clipboard.writeText(marketingText);
      setCopied(true);
      onToast?.('Marketing text copied to clipboard!');
      setTimeout(() => setCopied(false), 2500);
    } catch {
      onToast?.('Failed to copy to clipboard.');
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1200 }}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '1240px',
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          padding: 0,
          overflow: 'hidden',
          borderRadius: '16px',
        }}
      >
        {/* MODAL HEADER */}
        <div
          style={{
            padding: '16px 24px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            background: '#ffffff',
            flexShrink: 0,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: activeTheme.badgeBg,
                color: activeTheme.primary,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <FileText size={22} />
            </div>
            <div>
              <span className="caption-label">Marketing & Customer Outreach</span>
              <h2 style={{ margin: 0, fontSize: '18px', color: '#0f172a', fontWeight: 800 }}>
                Store Pamphlet & Customer Contact Flyer
              </h2>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              type="button"
              className="button button-quiet"
              onClick={handleCopyText}
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
              title="Copy WhatsApp promo text"
            >
              {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              <span>{copied ? 'Copied' : 'Copy Text'}</span>
            </button>

            <button
              type="button"
              className="button button-quiet"
              onClick={handleShareWhatsApp}
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', color: '#15803d' }}
              title="Share broadcast message on WhatsApp"
            >
              <MessageSquare size={14} />
              <span>WhatsApp Share</span>
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={handleDownloadPng}
              disabled={isExporting}
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <Download size={14} />
              <span>PNG Image</span>
            </button>

            <button
              type="button"
              className="button button-secondary"
              onClick={handleDownloadPdf}
              disabled={isExporting}
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <FileText size={14} />
              <span>PDF Flyer</span>
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={handlePrint}
              style={{ fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px', background: activeTheme.primary }}
            >
              <Printer size={14} />
              <span>Print Pamphlet</span>
            </button>

            <button
              type="button"
              className="icon-button"
              onClick={onClose}
              aria-label="Close"
              style={{ marginLeft: '4px' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY (TWO COLUMNS: CUSTOMIZE CONTROLS + LIVE FLYER PREVIEW) */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '360px minmax(0, 1fr)',
            flex: 1,
            overflow: 'hidden',
            background: '#f8fafc',
          }}
          className="pamphlet-layout-grid"
        >
          {/* LEFT: ADMIN CUSTOMIZATION DRAWER */}
          <div
            style={{
              padding: '20px',
              borderRight: '1px solid #e2e8f0',
              overflowY: 'auto',
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              background: '#ffffff',
            }}
            className="pamphlet-controls"
          >
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Pamphlet Appearance
              </span>
              <div style={{ marginTop: '8px', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: '6px' }}>
                {[
                  { id: 'blue', label: 'Royal Blue', color: '#2563eb' },
                  { id: 'emerald', label: 'Emerald Mint', color: '#059669' },
                  { id: 'violet', label: 'Luxury Orchid', color: '#7c3aed' },
                  { id: 'amber', label: 'Warm Amber', color: '#d97706' },
                  { id: 'mono', label: 'B&W Print', color: '#18181b' },
                ].map((th) => (
                  <button
                    key={th.id}
                    type="button"
                    onClick={() => setTheme(th.id)}
                    style={{
                      padding: '8px 4px',
                      borderRadius: '8px',
                      border: theme === th.id ? `2px solid ${th.color}` : '1px solid #e2e8f0',
                      background: theme === th.id ? '#f8fafc' : '#ffffff',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      gap: '4px',
                      cursor: 'pointer',
                    }}
                    title={th.label}
                  >
                    <span style={{ width: '18px', height: '18px', borderRadius: '50%', background: th.color }} />
                    <span style={{ fontSize: '9px', fontWeight: 600, color: '#475569', textAlign: 'center', lineHeight: 1.1 }}>
                      {th.label.split(' ')[0]}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Flyer Format / Layout */}
            <div>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Flyer Format
              </span>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '6px', marginTop: '6px' }}>
                {[
                  { id: 'a4', label: 'A4 Full Poster' },
                  { id: 'a5', label: 'A5 Handout' },
                  { id: 'digital', label: 'Digital Card' },
                ].map((f) => (
                  <button
                    key={f.id}
                    type="button"
                    onClick={() => setFormat(f.id)}
                    style={{
                      padding: '6px 4px',
                      borderRadius: '6px',
                      fontSize: '11px',
                      fontWeight: format === f.id ? 700 : 500,
                      border: format === f.id ? `1.5px solid ${activeTheme.primary}` : '1px solid #cbd5e1',
                      background: format === f.id ? activeTheme.badgeBg : '#fff',
                      color: format === f.id ? activeTheme.primary : '#334155',
                      cursor: 'pointer',
                    }}
                  >
                    {f.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Store & Contact Info Inputs */}
            <div style={{ display: 'grid', gap: '10px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Store & Admin Contact Details
              </span>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Store / Brand Name
                </label>
                <input
                  type="text"
                  value={storeName}
                  onChange={(e) => setStoreName(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Tagline / Hook
                </label>
                <input
                  type="text"
                  value={tagline}
                  onChange={(e) => setTagline(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    Admin Phone / Helpline
                  </label>
                  <input
                    type="text"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    placeholder="70057 28774"
                    style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                    Working Hours
                  </label>
                  <input
                    type="text"
                    value={timing}
                    onChange={(e) => setTiming(e.target.value)}
                    style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Store Location Address
                </label>
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>

              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Special Promo Offer Banner
                </label>
                <input
                  type="text"
                  value={promoHeadline}
                  onChange={(e) => setPromoHeadline(e.target.value)}
                  style={{ width: '100%', padding: '6px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
                />
              </div>
            </div>

            {/* Content Toggles */}
            <div style={{ display: 'grid', gap: '8px', borderTop: '1px solid #f1f5f9', paddingTop: '12px' }}>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                Visible Sections
              </span>

              {[
                { label: '❄️ Winter Special Offers Showcase', checked: showWinterOffers, set: setShowWinterOffers },
                { label: 'Direct WhatsApp Contact QR Code', checked: showQr, set: setShowQr },
                { label: 'Services & Price Guide Menu', checked: showPrices, set: setShowPrices },
                { label: 'Wallet Bonus & Membership Plans', checked: showPackages, set: setShowPackages },
                { label: '3-Step Easy Doorstep Process', checked: showHowItWorks, set: setShowHowItWorks },
              ].map((item, idx) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#334155', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={(e) => item.set(e.target.checked)}
                    style={{ accentColor: activeTheme.primary }}
                  />
                  <span>{item.label}</span>
                </label>
              ))}
            </div>

            {/* Winter Offer Customizer */}
            {showWinterOffers && (
              <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Snowflake size={14} color="#0284c7" />
                  <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Winter Campaign Settings
                  </span>
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                    Winter Campaign Title
                  </label>
                  <input
                    type="text"
                    value={winterHeadline}
                    onChange={(e) => setWinterHeadline(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', fontWeight: 600 }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: '10.5px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '2px' }}>
                    Campaign Tagline
                  </label>
                  <input
                    type="text"
                    value={winterSubtext}
                    onChange={(e) => setWinterSubtext(e.target.value)}
                    style={{ width: '100%', padding: '5px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                  />
                </div>

                <div style={{ background: '#f0f9ff', padding: '8px 10px', borderRadius: '6px', border: '1px solid #bae6fd', fontSize: '10.5px', color: '#0369a1', lineHeight: 1.4 }}>
                  ✨ <strong>3 Active Deals Highlighted:</strong><br />
                  1. 🧥 5 Sweaters + 1 Free<br />
                  2. 🛏️ 2 Combo Blankets (20% to 25% Off)<br />
                  3. 🪟 Curtains Deep Clean (Flat 25% Off)
                </div>
              </div>
            )}
          </div>

          {/* RIGHT: LIVE INTERACTIVE PAMPHLET PREVIEW */}
          <div
            style={{
              padding: '24px',
              overflowY: 'auto',
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'flex-start',
              background: '#e2e8f0',
            }}
          >
            {/* THE PRINTABLE / EXPORTABLE PAMPHLET CARD */}
            <div
              id="print-pamphlet"
              ref={pamphletRef}
              style={{
                width: format === 'a5' ? '480px' : format === 'digital' ? '540px' : '720px',
                minHeight: format === 'digital' ? '680px' : '960px',
                background: '#ffffff',
                boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
                borderRadius: '12px',
                overflow: 'hidden',
                display: 'flex',
                flexDirection: 'column',
                boxSizing: 'border-box',
                border: '1px solid #cbd5e1',
                fontFamily: 'system-ui, -apple-system, sans-serif',
              }}
            >
              {/* TOP BRAND HERO HEADER */}
              <div
                style={{
                  background: activeTheme.heroBg,
                  color: '#ffffff',
                  padding: format === 'a5' ? '18px 20px' : '26px 32px',
                  position: 'relative',
                  overflow: 'hidden',
                }}
              >
                {/* Decorative background watermark */}
                <div
                  style={{
                    position: 'absolute',
                    right: '-20px',
                    top: '-20px',
                    opacity: 0.08,
                    pointerEvents: 'none',
                  }}
                >
                  <Sparkles size={200} color="#ffffff" />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', position: 'relative', zIndex: 1 }}>
                  <div>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', background: 'rgba(255, 255, 255, 0.2)', padding: '3px 10px', borderRadius: '20px', fontSize: '11px', fontWeight: 700, letterSpacing: '0.8px', textTransform: 'uppercase', marginBottom: '8px' }}>
                      <Sparkles size={13} /> Premium Laundry & Fabric Care
                    </div>
                    <h1 style={{ margin: 0, fontSize: format === 'a5' ? '24px' : '32px', fontWeight: 900, letterSpacing: '-0.5px', lineHeight: 1.15 }}>
                      {storeName}
                    </h1>
                    <p style={{ margin: '6px 0 0', fontSize: format === 'a5' ? '12px' : '14px', opacity: 0.9, maxWidth: '440px', lineHeight: 1.35 }}>
                      {tagline}
                    </p>
                  </div>

                  {/* Quality Seal */}
                  <div
                    style={{
                      background: 'rgba(255, 255, 255, 0.15)',
                      border: '1.5px solid rgba(255, 255, 255, 0.35)',
                      borderRadius: '12px',
                      padding: '8px 12px',
                      textAlign: 'center',
                      backdropFilter: 'blur(4px)',
                      flexShrink: 0,
                    }}
                  >
                    <div style={{ fontSize: '10px', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.8px' }}>
                      100% Guaranteed
                    </div>
                    <div style={{ fontSize: '13px', fontWeight: 900, marginTop: '2px' }}>
                      Hygiene & Care
                    </div>
                    <div style={{ fontSize: '9px', opacity: 0.85, marginTop: '2px' }}>
                      German Steam Tech
                    </div>
                  </div>
                </div>

                {/* Service Highlights Strip */}
                <div
                  style={{
                    display: 'flex',
                    flexWrap: 'wrap',
                    gap: '10px',
                    marginTop: '16px',
                    paddingTop: '14px',
                    borderTop: '1px solid rgba(255, 255, 255, 0.2)',
                    fontSize: '11.5px',
                    fontWeight: 600,
                  }}
                >
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={14} color="#86efac" /> Free Home Pickup & Delivery
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={14} color="#86efac" /> 24H-48H Express Turnaround
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={14} color="#86efac" /> Eco-Friendly Solvents
                  </span>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                    <CheckCircle2 size={14} color="#86efac" /> Clean Folded or Hanger Packed
                  </span>
                </div>
              </div>

              {/* SPECIAL PROMO OFFER STRIP */}
              {promoHeadline && (
                <div
                  style={{
                    background: '#fef3c7',
                    borderBottom: '1px solid #fde68a',
                    padding: '10px 20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '8px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <Tag size={16} color="#b45309" style={{ flexShrink: 0 }} />
                    <span style={{ fontSize: format === 'a5' ? '11px' : '12.5px', fontWeight: 800, color: '#92400e' }}>
                      {promoHeadline}
                    </span>
                  </div>
                  <span style={{ fontSize: '11px', fontWeight: 700, color: '#b45309', background: '#ffffff', padding: '2px 8px', borderRadius: '4px', border: '1px solid #fde68a' }}>
                    Limited Time Offer
                  </span>
                </div>
              )}

              {/* MAIN CONTENT BODY */}
              <div style={{ padding: format === 'a5' ? '16px' : '22px 28px', display: 'flex', flexDirection: 'column', gap: '18px', flex: 1 }}>
                
                {/* 1. BIG DIRECT CONTACT & ADMIN HELPLINE BOX (The Centerpiece of User's Request) */}
                <div
                  style={{
                    background: activeTheme.lightBg,
                    border: `2px solid ${activeTheme.cardBorder}`,
                    borderRadius: '12px',
                    padding: format === 'a5' ? '14px' : '18px 20px',
                    display: 'grid',
                    gridTemplateColumns: showQr ? '1fr auto' : '1fr',
                    gap: '16px',
                    alignItems: 'center',
                  }}
                >
                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div>
                      <span style={{ fontSize: '11px', fontWeight: 800, color: activeTheme.primary, textTransform: 'uppercase', letterSpacing: '0.6px' }}>
                        Direct Store Helpline & Order Intake
                      </span>
                      <h3 style={{ margin: '2px 0 0', fontSize: format === 'a5' ? '16px' : '20px', fontWeight: 900, color: '#0f172a' }}>
                        Need Dry Cleaning or Washing? Contact Us Directly!
                      </h3>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#475569', lineHeight: 1.35 }}>
                        {promoSubtext}
                      </p>
                    </div>

                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', alignItems: 'center' }}>
                      {/* Big Call Button Badge */}
                      <a
                        href={`tel:${cleanPhone}`}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: activeTheme.primary,
                          color: '#ffffff',
                          padding: '8px 16px',
                          borderRadius: '8px',
                          fontWeight: 800,
                          fontSize: format === 'a5' ? '13px' : '15px',
                          textDecoration: 'none',
                          boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
                        }}
                      >
                        <Phone size={16} />
                        <span>Call Hotline: +91 {phone}</span>
                      </a>

                      {/* WhatsApp Button Badge */}
                      <a
                        href={waUrl}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '8px',
                          background: '#16a34a',
                          color: '#ffffff',
                          padding: '8px 14px',
                          borderRadius: '8px',
                          fontWeight: 700,
                          fontSize: format === 'a5' ? '12px' : '13.5px',
                          textDecoration: 'none',
                        }}
                      >
                        <MessageSquare size={16} />
                        <span>WhatsApp: +91 {phone}</span>
                      </a>
                    </div>

                    {/* Address & Timings Row */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '14px', fontSize: '11px', color: '#64748b', borderTop: `1px solid ${activeTheme.cardBorder}`, paddingTop: '8px' }}>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <MapPin size={13} color={activeTheme.primary} />
                        <strong>Address:</strong> {address}
                      </span>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <Clock size={13} color={activeTheme.primary} />
                        <strong>Hours:</strong> {timing}
                      </span>
                    </div>
                  </div>

                  {/* QR Code Container */}
                  {showQr && qrDataUrl && (
                    <div
                      style={{
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '10px',
                        padding: '10px',
                        textAlign: 'center',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '115px',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                      }}
                    >
                      <img
                        src={qrDataUrl}
                        alt="WhatsApp Contact QR Code"
                        style={{ width: format === 'a5' ? '85px' : '100px', height: format === 'a5' ? '85px' : '100px', display: 'block' }}
                      />
                      <span style={{ fontSize: '9.5px', fontWeight: 800, color: '#0f172a', marginTop: '4px', display: 'block' }}>
                        SCAN TO CHAT
                      </span>
                      <span style={{ fontSize: '8.5px', color: '#64748b' }}>
                        Instant WhatsApp
                      </span>
                    </div>
                  )}
                </div>

                {/* ❄️ EXCLUSIVE WINTER SPECIAL OFFERS (FEATURED SEASONAL PROMOTION) */}
                {showWinterOffers && (
                  <div
                    style={{
                      background: 'linear-gradient(135deg, #f0f9ff 0%, #e0f2fe 50%, #fef3c7 100%)',
                      border: '2px dashed #0284c7',
                      borderRadius: '12px',
                      padding: format === 'a5' ? '12px 14px' : '16px 20px',
                      boxShadow: '0 4px 12px rgba(2, 132, 199, 0.08)',
                      position: 'relative',
                      overflow: 'hidden',
                    }}
                  >
                    {/* Decorative Snowflake Watermark */}
                    <div
                      style={{
                        position: 'absolute',
                        right: '-15px',
                        bottom: '-20px',
                        opacity: 0.12,
                        pointerEvents: 'none',
                      }}
                    >
                      <Snowflake size={120} color="#0284c7" />
                    </div>

                    {/* Section Header with Festive Seasonal Ribbons */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        flexWrap: 'wrap',
                        gap: '6px',
                        marginBottom: '12px',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            background: '#0284c7',
                            color: '#ffffff',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            boxShadow: '0 2px 6px rgba(2, 132, 199, 0.35)',
                          }}
                        >
                          <Snowflake size={16} />
                        </div>
                        <div>
                          <h4
                            style={{
                              margin: 0,
                              fontSize: format === 'a5' ? '13px' : '15px',
                              fontWeight: 900,
                              color: '#0369a1',
                              letterSpacing: '-0.2px',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            <span>{winterHeadline}</span>
                          </h4>
                          <p style={{ margin: '1px 0 0', fontSize: '10.5px', color: '#0284c7', fontWeight: 600 }}>
                            {winterSubtext}
                          </p>
                        </div>
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 800,
                            textTransform: 'uppercase',
                            letterSpacing: '0.6px',
                            background: '#dc2626',
                            color: '#ffffff',
                            padding: '3px 9px',
                            borderRadius: '999px',
                            boxShadow: '0 2px 4px rgba(220, 38, 38, 0.25)',
                            display: 'inline-flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Flame size={11} /> Seasonal Specials
                        </span>
                      </div>
                    </div>

                    {/* The 3 Highlighted Winter Deals Grid */}
                    <div
                      style={{
                        display: 'grid',
                        gridTemplateColumns: 'repeat(3, 1fr)',
                        gap: format === 'a5' ? '8px' : '12px',
                      }}
                    >
                      {/* DEAL 1: 5 SWEATERS + 1 FREE */}
                      <div
                        style={{
                          background: '#ffffff',
                          borderRadius: '10px',
                          border: '1.5px solid #bae6fd',
                          padding: format === 'a5' ? '10px 8px' : '12px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: '0',
                            right: '0',
                            background: 'linear-gradient(135deg, #e11d48, #be123c)',
                            color: '#fff',
                            fontSize: '9px',
                            fontWeight: 900,
                            padding: '2px 8px',
                            borderBottomLeftRadius: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                          }}
                        >
                          BUY 5 GET 1 FREE
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '18px' }}>🧥</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#0369a1', textTransform: 'uppercase' }}>
                              Sweaters & Woolens
                            </span>
                          </div>

                          <div style={{ fontSize: format === 'a5' ? '13px' : '15px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                            5 Sweaters = 1 FREE!
                          </div>

                          <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#475569', lineHeight: 1.35 }}>
                            Pay for 5 Sweaters, get the 6th Sweater dry cleaned <strong>FREE</strong>. Woolmark-safe conditioning & lint de-pilling.
                          </p>
                        </div>

                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9.5px', color: '#64748b' }}>All Cardigans & Pullovers</span>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#e11d48', background: '#ffe4e6', padding: '1px 6px', borderRadius: '4px' }}>
                            100% Free
                          </span>
                        </div>
                      </div>

                      {/* DEAL 2: 2 COMBO BLANKETS 20% TO 25% OFF */}
                      <div
                        style={{
                          background: '#ffffff',
                          borderRadius: '10px',
                          border: '1.5px solid #fde68a',
                          padding: format === 'a5' ? '10px 8px' : '12px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: '0',
                            right: '0',
                            background: 'linear-gradient(135deg, #d97706, #b45309)',
                            color: '#fff',
                            fontSize: '9px',
                            fontWeight: 900,
                            padding: '2px 8px',
                            borderBottomLeftRadius: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                          }}
                        >
                          20% - 25% OFF
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '18px' }}>🛏️</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#b45309', textTransform: 'uppercase' }}>
                              Heavy Quilts & Blankets
                            </span>
                          </div>

                          <div style={{ fontSize: format === 'a5' ? '13px' : '15px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                            2 Combo Blankets Offer
                          </div>

                          <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#475569', lineHeight: 1.35 }}>
                            Get <strong>20% to 25% OFF</strong> on cleaning any 2 double blankets, mink blankets, quilts or heavy rajais.
                          </p>
                        </div>

                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9.5px', color: '#64748b' }}>Deep Anti-bacterial Wash</span>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#b45309', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                            Combo Deal
                          </span>
                        </div>
                      </div>

                      {/* DEAL 3: CURTAIN 25% OFF */}
                      <div
                        style={{
                          background: '#ffffff',
                          borderRadius: '10px',
                          border: '1.5px solid #a7f3d0',
                          padding: format === 'a5' ? '10px 8px' : '12px 12px',
                          display: 'flex',
                          flexDirection: 'column',
                          justifyContent: 'space-between',
                          boxShadow: '0 2px 6px rgba(0, 0, 0, 0.04)',
                          position: 'relative',
                          overflow: 'hidden',
                        }}
                      >
                        <div
                          style={{
                            position: 'absolute',
                            top: '0',
                            right: '0',
                            background: 'linear-gradient(135deg, #059669, #047857)',
                            color: '#fff',
                            fontSize: '9px',
                            fontWeight: 900,
                            padding: '2px 8px',
                            borderBottomLeftRadius: '8px',
                            textTransform: 'uppercase',
                            letterSpacing: '0.4px',
                          }}
                        >
                          FLAT 25% OFF
                        </div>

                        <div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '6px' }}>
                            <span style={{ fontSize: '18px' }}>🪟</span>
                            <span style={{ fontSize: '11px', fontWeight: 800, color: '#047857', textTransform: 'uppercase' }}>
                              Home Drapes & Decor
                            </span>
                          </div>

                          <div style={{ fontSize: format === 'a5' ? '13px' : '15px', fontWeight: 900, color: '#0f172a', lineHeight: 1.2 }}>
                            Curtains Deep Clean 25%
                          </div>

                          <p style={{ margin: '6px 0 0', fontSize: '10px', color: '#475569', lineHeight: 1.35 }}>
                            Enjoy <strong>Flat 25% OFF</strong> on all window curtains & heavy draperies. Dust extraction & steam press finish.
                          </p>
                        </div>

                        <div style={{ marginTop: '10px', paddingTop: '8px', borderTop: '1px dashed #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9.5px', color: '#64748b' }}>German Steam Pressing</span>
                          <span style={{ fontSize: '10px', fontWeight: 800, color: '#047857', background: '#d1fae5', padding: '1px 6px', borderRadius: '4px' }}>
                            Flat 25% Off
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Bottom Claim Instructions */}
                    <div
                      style={{
                        marginTop: '10px',
                        padding: '6px 10px',
                        borderRadius: '6px',
                        background: 'rgba(255, 255, 255, 0.8)',
                        border: '1px solid #bae6fd',
                        fontSize: '10.5px',
                        color: '#0369a1',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        flexWrap: 'wrap',
                        gap: '4px',
                      }}
                    >
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                        <strong>💡 How to Claim:</strong> Mention <em>"WINTER OFFER"</em> during doorstep pickup or WhatsApp booking.
                      </span>
                      <span style={{ fontWeight: 700, color: '#e11d48' }}>
                        Valid This Winter Season · Free Pickup & Drop
                      </span>
                    </div>
                  </div>
                )}

                {/* 2. SERVICES & MENU HIGHLIGHTS */}
                {showPrices && (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                      <h4 style={{ margin: 0, fontSize: '13.5px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                        📋 Services & Rate Highlights
                      </h4>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>
                        Competitive Neighborhood Rates
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '10px' }}>
                      {/* Service 1: Dry Cleaning */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '12.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Sparkles size={14} color={activeTheme.primary} /> Premium Dry Cleaning
                          </strong>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: activeTheme.primary, background: activeTheme.badgeBg, padding: '1px 6px', borderRadius: '4px' }}>
                            from ₹110
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '10.5px', color: '#64748b', lineHeight: 1.35 }}>
                          Suits (₹400), Sarees (₹125-₹450), Shirts, Jackets, Silks, Lehengas & Coats with delicate stain lifting.
                        </p>
                      </div>

                      {/* Service 2: Steam Press */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '12.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Wind size={14} color="#0284c7" /> German Steam Press
                          </strong>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#0284c7', background: '#e0f2fe', padding: '1px 6px', borderRadius: '4px' }}>
                            from ₹50
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '10.5px', color: '#64748b', lineHeight: 1.35 }}>
                          Razor-sharp crease, zero fabric shine, precision temperature control for all delicate fabrics.
                        </p>
                      </div>

                      {/* Service 3: Wash & Fold / Iron by Kilo */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '12.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Shirt size={14} color="#059669" /> Wash & Fold / Iron by Kilo
                          </strong>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#059669', background: '#dcfce7', padding: '1px 6px', borderRadius: '4px' }}>
                            from ₹90/kg
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '10.5px', color: '#64748b', lineHeight: 1.35 }}>
                          Everyday shirts, trousers, t-shirts, sheets & towels weighed on certified digital scale and fresh-packed.
                        </p>
                      </div>

                      {/* Service 4: Heavy Household */}
                      <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px 12px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <strong style={{ fontSize: '12.5px', color: '#0f172a', display: 'flex', alignItems: 'center', gap: '5px' }}>
                            <Waves size={14} color="#d97706" /> Blankets, Quilts & Curtains
                          </strong>
                          <span style={{ fontSize: '11px', fontWeight: 800, color: '#d97706', background: '#fef3c7', padding: '1px 6px', borderRadius: '4px' }}>
                            from ₹350
                          </span>
                        </div>
                        <p style={{ margin: '4px 0 0', fontSize: '10.5px', color: '#64748b', lineHeight: 1.35 }}>
                          Heavy winter blankets, quilts, rajai, thick curtains & sofa covers deep sanitized and refreshed.
                        </p>
                      </div>
                    </div>
                  </div>
                )}

                {/* 3. PREPAID WALLET BONUS & SPECIAL PACKAGES */}
                {showPackages && (
                  <div
                    style={{
                      background: '#fffbeb',
                      border: '1.5px dashed #fde68a',
                      borderRadius: '10px',
                      padding: '12px 16px',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                      <strong style={{ fontSize: '12.5px', color: '#92400e', display: 'flex', alignItems: 'center', gap: '5px' }}>
                        ⭐ Prepaid Laundry Wallet Packages — Save Big!
                      </strong>
                      <span style={{ fontSize: '10.5px', color: '#b45309', fontWeight: 700 }}>
                        Lifetime Balance · No Expiry
                      </span>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '8px' }}>
                      <div style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#b45309' }}>Gold Package</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#0f172a' }}>Pay ₹3,000</div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a' }}>Get ₹4,000 Credit (+33%)</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#2563eb' }}>Diamond Package</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#0f172a' }}>Pay ₹7,500</div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#16a34a' }}>Get ₹10,000 Credit (+33%)</div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #fde68a', borderRadius: '6px', padding: '8px', textAlign: 'center' }}>
                        <div style={{ fontSize: '11px', fontWeight: 800, color: '#7c3aed' }}>Half Price Privilege</div>
                        <div style={{ fontSize: '12.5px', fontWeight: 900, color: '#0f172a' }}>Flat 50% Off</div>
                        <div style={{ fontSize: '10px', fontWeight: 700, color: '#7c3aed' }}>On Dry Cleaning per piece</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* 4. 3-STEP DOORSTEP PROCESS */}
                {showHowItWorks && (
                  <div>
                    <h4 style={{ margin: '0 0 8px', fontSize: '13px', fontWeight: 800, color: '#1e293b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      🚀 How Our Doorstep Service Works
                    </h4>
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '10px' }}>
                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: activeTheme.primary, color: '#fff', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          1
                        </span>
                        <div>
                          <strong style={{ fontSize: '11.5px', color: '#0f172a', display: 'block' }}>Call or WhatsApp</strong>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>Share your location and pickup time with our admin.</span>
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: activeTheme.primary, color: '#fff', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          2
                        </span>
                        <div>
                          <strong style={{ fontSize: '11.5px', color: '#0f172a', display: 'block' }}>We Collect & Tag</strong>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>Rider counts & generates secure barcode receipt.</span>
                        </div>
                      </div>

                      <div style={{ background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', padding: '10px', display: 'flex', gap: '8px', alignItems: 'flex-start' }}>
                        <span style={{ width: '22px', height: '22px', borderRadius: '50%', background: activeTheme.primary, color: '#fff', fontSize: '11px', fontWeight: 900, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          3
                        </span>
                        <div>
                          <strong style={{ fontSize: '11.5px', color: '#0f172a', display: 'block' }}>Delivered Fresh</strong>
                          <span style={{ fontSize: '10px', color: '#64748b' }}>Crisp, hanger-packed clothes returned to your door!</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* FOOTER STRIP */}
              <div
                style={{
                  background: '#0f172a',
                  color: '#ffffff',
                  padding: '12px 24px',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  flexWrap: 'wrap',
                  gap: '8px',
                  fontSize: '11px',
                }}
              >
                <div>
                  <strong>{storeName}</strong> · For urgent delivery or corporate bulk inquiries, call our admin hotline directly: <strong>+91 {phone}</strong>
                </div>
                {settings?.taxNumber && settings?.taxEnabled !== false && (
                  <div style={{ opacity: 0.8, fontSize: '10px' }}>
                    GSTIN: {settings.taxNumber}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
