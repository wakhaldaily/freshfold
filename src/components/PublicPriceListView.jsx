import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowRight,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Copy,
  Info,
  MapPin,
  MessageSquare,
  Minus,
  Package,
  Phone,
  Plus,
  Search,
  Send,
  Share2,
  Shirt,
  ShoppingBag,
  Sparkles,
  Store,
  Tag,
  Trash2,
  Waves,
  Wind,
  X,
} from 'lucide-react';
import {
  defaultSettings,
  garmentCatalog as initialGarmentCatalog,
  initialAddons,
  initialPackageCatalog,
  services as initialServices,
  weightServices as initialWeightServices,
} from '../data.js';
import { formatMoney, loadLocal, normalizeWhatsAppNumber } from '../lib/persistence.js';
import { BillSkeleton } from './SkeletonLoader.jsx';

const CATEGORIES = [
  { id: 'all', label: 'All Items', emoji: '✨' },
  { id: 'Men', label: 'Men', emoji: '👔' },
  { id: 'Women', label: 'Women', emoji: '👗' },
  { id: 'Kids', label: 'Kids', emoji: '🧒' },
  { id: 'Household', label: 'Household', emoji: '🏠' },
  { id: 'club-fresh', label: 'Club Fresh', emoji: '👑' },
  { id: 'weight', label: 'By Weight', emoji: '⚖️' },
  { id: 'addons', label: 'Add-ons', emoji: '🧼' },
  { id: 'packages', label: 'Packages', emoji: '🎁' },
];

export default function PublicPriceListView() {
  const [loading, setLoading] = useState(true);
  const [storeData, setStoreData] = useState(null);

  // Search & Filter
  const [searchQuery, setSearchQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState('all');
  const [activeServiceTab, setActiveServiceTab] = useState('all'); // 'all' | 'Dry cleaning' | 'Steam press' | 'Premium laundry'

  // Selected Garments & Items Cart / Bag:
  // key: `${garment.id}:${service}` -> { garment, service, quantity, price }
  const [cart, setCart] = useState({});

  // Bag Drawer Visibility
  const [isBagOpen, setIsBagOpen] = useState(false);

  // Customer Contact for Order Request (Name & Mobile)
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [pickupAddress, setPickupAddress] = useState('');

  // UI Feedback
  const [copiedLink, setCopiedLink] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Extract query params for pre-filling customer info (name and phone/mobile)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const nameParam = params.get('name') || params.get('c') || '';
    const phoneParam = params.get('phone') || params.get('mobile') || params.get('m') || '';
    if (nameParam) setCustomerName(nameParam);
    if (phoneParam) setCustomerPhone(phoneParam);
  }, []);

  // Enable smooth mobile and desktop page scrolling
  useEffect(() => {
    if (typeof document === 'undefined') return undefined;
    document.body.classList.add('has-public-page');
    const root = document.getElementById('root');
    const prevRootOverflow = root?.style?.overflow || '';
    const prevRootHeight = root?.style?.height || '';
    if (root) {
      root.style.overflow = 'visible';
      root.style.height = 'auto';
      root.style.minHeight = '100vh';
    }
    return () => {
      document.body.classList.remove('has-public-page');
      if (root) {
        root.style.overflow = prevRootOverflow;
        root.style.height = prevRootHeight;
        root.style.minHeight = '';
      }
    };
  }, []);

  // Fetch live store rates or fallback to local
  useEffect(() => {
    let mounted = true;

    async function loadData() {
      setLoading(true);
      try {
        const res = await fetch('/api/public-prices');
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const json = await res.json();
          if (mounted) {
            setStoreData(json);
            setLoading(false);
            return;
          }
        }
      } catch (err) {
        // Fall back gracefully
      }

      // Offline / Local / Demo fallback
      try {
        const local = loadLocal();
        if (mounted) {
          setStoreData({
            settings: local?.settings || defaultSettings,
            garmentCatalog: initialGarmentCatalog,
            services: initialServices,
            weightServices: initialWeightServices,
            addons: initialAddons,
            packages: local?.packages || initialPackageCatalog,
          });
          setLoading(false);
        }
      } catch (err) {
        if (mounted) {
          setStoreData({
            settings: defaultSettings,
            garmentCatalog: initialGarmentCatalog,
            services: initialServices,
            weightServices: initialWeightServices,
            addons: initialAddons,
            packages: initialPackageCatalog,
          });
          setLoading(false);
        }
      }
    }

    loadData();
    return () => {
      mounted = false;
    };
  }, []);

  const showToast = (msg) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const settings = storeData?.settings || defaultSettings;
  const garments = storeData?.garmentCatalog || initialGarmentCatalog;
  const weightItems = storeData?.weightServices || initialWeightServices;
  const addons = storeData?.addons || initialAddons;
  const packages = storeData?.packages || initialPackageCatalog;

  const storePhoneRaw = settings?.adminMobile || settings?.adminPhone || settings?.whatsappPhone || settings?.phone || '70057 28774';
  const adminReceiverNumber = normalizeWhatsAppNumber(storePhoneRaw);

  // Cart Management
  const updateGarmentQty = (garment, serviceLabel, delta) => {
    const key = `${garment.id}:${serviceLabel}`;
    const price = garment.prices?.[serviceLabel] || 0;
    setCart((prev) => {
      const current = prev[key]?.quantity || 0;
      const nextQty = Math.max(0, current + delta);
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return {
        ...prev,
        [key]: {
          key,
          type: 'piece',
          garment,
          name: garment.name,
          category: garment.category,
          service: serviceLabel,
          price,
          quantity: nextQty,
        },
      };
    });
  };

  const updateWeightQty = (weightService, delta) => {
    const key = `weight:${weightService.id}`;
    setCart((prev) => {
      const current = prev[key]?.quantity || 0;
      const nextQty = Math.max(0, current + delta);
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return {
        ...prev,
        [key]: {
          key,
          type: 'weight',
          weightService,
          name: weightService.label,
          category: 'Weight',
          service: `${weightService.label} (per kg)`,
          price: weightService.ratePerKg,
          quantity: nextQty, // in kg
        },
      };
    });
  };

  const updateAddonQty = (addon, delta) => {
    const key = `addon:${addon.id}`;
    setCart((prev) => {
      const current = prev[key]?.quantity || 0;
      const nextQty = Math.max(0, current + delta);
      if (nextQty === 0) {
        const copy = { ...prev };
        delete copy[key];
        return copy;
      }
      return {
        ...prev,
        [key]: {
          key,
          type: 'addon',
          addon,
          name: addon.name,
          category: 'Add-on',
          service: 'Care Treatment',
          price: addon.price,
          quantity: nextQty,
        },
      };
    });
  };

  const cartList = Object.values(cart);
  const totalItemsCount = cartList.reduce((sum, item) => sum + item.quantity, 0);
  const totalEstimatedAmount = cartList.reduce((sum, item) => sum + (item.price * item.quantity), 0);

  // Filtered Garment Items
  const filteredGarments = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return garments.filter((g) => {
      if (activeCategory === 'club-fresh') {
        const hasClubPrice = g.prices?.['Club Fresh DC'] != null || g.prices?.['Club Fresh SP'] != null;
        if (!hasClubPrice) return false;
      } else if (activeCategory !== 'all' && activeCategory !== 'weight' && activeCategory !== 'addons' && activeCategory !== 'packages') {
        if (g.category !== activeCategory) return false;
      }
      if (activeServiceTab !== 'all') {
        if (g.prices?.[activeServiceTab] == null) return false;
      }
      if (q) {
        const matchesName = g.name.toLowerCase().includes(q);
        const matchesCategory = g.category.toLowerCase().includes(q);
        return matchesName || matchesCategory;
      }
      return true;
    });
  }, [garments, activeCategory, activeServiceTab, searchQuery]);

  // Clean Share Link (Current URL without customer-specific params for generic sharing)
  const getGenericShareUrl = () => {
    if (typeof window === 'undefined') return '';
    return `${window.location.origin}/?prices=1`;
  };

  const handleCopyLink = async () => {
    const url = getGenericShareUrl();
    try {
      if (navigator?.clipboard?.writeText) {
        await navigator.clipboard.writeText(url);
      } else {
        const temp = document.createElement('input');
        temp.value = url;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
      }
      setCopiedLink(true);
      showToast('Price list link copied to clipboard!');
      setTimeout(() => setCopiedLink(false), 2500);
    } catch {
      showToast('Could not copy link automatically.');
    }
  };

  const handleShareWhatsAppGeneral = () => {
    const url = getGenericShareUrl();
    const text = `Check out the price list for *${settings.storeName || 'Clean Clear Dry Cleaning'}*!\n\nTap here to view all rates for dry cleaning, steam press, per-kg laundry and special packages:\n🔗 ${url}\n\nYou can also select your clothes and schedule a doorstep pickup directly!`;
    const waUrl = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  // WhatsApp Order Submission to Store (Delivered directly to Admin Mobile / WhatsApp)
  const handleSendOrderWhatsApp = () => {
    if (cartList.length === 0) {
      showToast('Please select at least 1 item to send a pickup request.');
      return;
    }

    if (!customerName.trim()) {
      showToast('Please enter your Customer Name before sending.');
      return;
    }

    if (!customerPhone.trim()) {
      showToast('Please enter your Mobile Number before sending.');
      return;
    }

    const cleanMobile = customerPhone.trim().replace(/^(\+91|91|0)/, '');

    const lines = [
      `🧺 *NEW LAUNDRY / PICKUP REQUEST*`,
      `*${settings.storeName || 'Clean Clear Dry Cleaning'}*`,
      `──────────────────────────`,
      `👤 *Customer*: ${customerName.trim()}`,
      `📞 *Mobile*: +91 ${cleanMobile}`,
    ];

    if (pickupAddress.trim()) {
      lines.push(`📍 *Address / Instructions*: ${pickupAddress.trim()}`);
    }

    lines.push(`──────────────────────────`);
    lines.push(`📋 *SELECTED ITEMS*:`);

    cartList.forEach((item, idx) => {
      const unit = item.type === 'weight' ? 'kg' : 'pc(s)';
      const itemSubtotal = item.price * item.quantity;
      lines.push(`${idx + 1}. *${item.name}* (${item.service})`);
      lines.push(`   Qty: ${item.quantity} ${unit} × ₹${item.price} = *₹${itemSubtotal}*`);
    });

    lines.push(`──────────────────────────`);
    lines.push(`🔢 *Total Items*: ${totalItemsCount}`);
    lines.push(`💰 *Estimated Total*: *₹${totalEstimatedAmount}*`);
    if (settings?.taxEnabled) {
      lines.push(`ℹ️ *(GST ${settings.taxPercent || 18}% applicable)*`);
    }
    lines.push(`──────────────────────────`);
    lines.push(`Please confirm the pickup schedule. Thank you!`);

    const message = lines.join('\n');
    const waUrl = `https://wa.me/${adminReceiverNumber}?text=${encodeURIComponent(message)}`;
    window.open(waUrl, '_blank', 'noopener,noreferrer');
  };

  if (loading) {
    return <BillSkeleton />;
  }

  return (
    <div
      className="public-page-viewport"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        WebkitOverflowScrolling: 'touch',
        touchAction: 'pan-y',
        background: '#f8fafc',
        fontFamily: 'Inter, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        color: '#0f172a',
        paddingBottom: '120px',
      }}
    >
      {/* Top Header Card */}
      <header
        style={{
          background: 'linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
          color: '#ffffff',
          padding: '24px 16px 20px',
          boxShadow: '0 4px 20px rgba(15, 23, 42, 0.15)',
          position: 'relative',
        }}
      >
        <div style={{ maxWidth: '680px', margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '12px',
                  background: 'linear-gradient(135deg, #0284c7, #38bdf8)',
                  display: 'grid',
                  placeItems: 'center',
                  boxShadow: '0 4px 12px rgba(2, 132, 199, 0.4)',
                }}
              >
                <Sparkles size={22} color="#ffffff" />
              </div>
              <div>
                <h1 style={{ margin: 0, fontSize: '19px', fontWeight: 800, letterSpacing: '-0.02em', lineHeight: 1.2 }}>
                  {settings.storeName || 'Clean Clear Dry Cleaning'}
                </h1>
                <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', fontWeight: 600 }}>
                  {settings.tagline || 'Premium Fabric Care & Dry Cleaning'}
                </p>
              </div>
            </div>

            {/* Direct Phone Call Button */}
            {storePhoneRaw && (
              <a
                href={`tel:+${adminReceiverNumber}`}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: 'rgba(255, 255, 255, 0.12)',
                  color: '#ffffff',
                  padding: '8px 12px',
                  borderRadius: '10px',
                  textDecoration: 'none',
                  fontSize: '12px',
                  fontWeight: 700,
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  flexShrink: 0,
                }}
                title={`Call store helpline at +${adminReceiverNumber}`}
              >
                <Phone size={14} color="#38bdf8" /> Call
              </a>
            )}
          </div>

          {/* Welcome Banner / Pre-filled customer greeting */}
          {customerName && (
            <div
              style={{
                background: 'rgba(56, 189, 248, 0.12)',
                border: '1px solid rgba(56, 189, 248, 0.3)',
                borderRadius: '10px',
                padding: '8px 12px',
                marginBottom: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                fontSize: '12px',
                color: '#e0f2fe',
              }}
            >
              <Sparkles size={14} color="#38bdf8" />
              <span>
                Welcome, <strong>{customerName}</strong>! Select garments below to estimate or request doorstep pickup.
              </span>
            </div>
          )}

          {/* Store Address & Delivery Perks */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', fontSize: '12px', color: '#cbd5e1' }}>
            {settings?.address && (
              <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
                <MapPin size={13} color="#38bdf8" /> {settings.address}
              </div>
            )}
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '5px' }}>
              <Clock size={13} color="#38bdf8" /> Free Doorstep Pickup & Delivery
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main style={{ maxWidth: '680px', margin: '0 auto', padding: '16px 14px' }}>

        {/* Live Search Bar */}
        <div style={{ position: 'relative', marginBottom: '14px' }}>
          <Search
            size={16}
            color="#64748b"
            style={{ position: 'absolute', left: '14px', top: '50%', transform: 'translateY(-50%)' }}
          />
          <input
            type="text"
            placeholder="Search clothes (e.g. Shirt, Saree, Blanket, Jacket...)"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '12px 38px 12px 38px',
              borderRadius: '12px',
              border: '1.5px solid #e2e8f0',
              background: '#ffffff',
              fontSize: '13px',
              outline: 'none',
              boxShadow: '0 2px 8px rgba(0,0,0,0.03)',
              color: '#0f172a',
              fontWeight: 500,
            }}
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              style={{
                position: 'absolute',
                right: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                background: 'transparent',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                padding: '4px',
                display: 'flex',
              }}
              aria-label="Clear search"
            >
              <X size={15} />
            </button>
          )}
        </div>

        {/* Horizontal Category Navigation Pills */}
        <nav
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            WebkitOverflowScrolling: 'touch',
            touchAction: 'pan-x',
            paddingBottom: '8px',
            marginBottom: '16px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
          }}
        >
          {CATEGORIES.map((cat) => {
            const active = activeCategory === cat.id;
            return (
              <button
                key={cat.id}
                type="button"
                onClick={() => {
                  setActiveCategory(cat.id);
                  setSearchQuery('');
                }}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  padding: '8px 14px',
                  borderRadius: '24px',
                  border: active ? '1.5px solid #0284c7' : '1px solid #e2e8f0',
                  background: active ? '#0284c7' : '#ffffff',
                  color: active ? '#ffffff' : '#334155',
                  fontSize: '12px',
                  fontWeight: active ? 700 : 600,
                  whiteSpace: 'nowrap',
                  cursor: 'pointer',
                  boxShadow: active ? '0 3px 10px rgba(2, 132, 199, 0.25)' : '0 1px 3px rgba(0,0,0,0.02)',
                  transition: 'all 0.15s ease',
                  flexShrink: 0,
                }}
              >
                <span>{cat.emoji}</span>
                <span>{cat.label}</span>
              </button>
            );
          })}
        </nav>

        {/* Optional Service Filter Tabs (For Garments View) */}
        {/* Service Filter Tabs (For Garments View) */}
        {activeCategory !== 'weight' && activeCategory !== 'addons' && activeCategory !== 'packages' && (
          <div
            style={{
              display: 'flex',
              gap: '6px',
              background: '#f1f5f9',
              padding: '4px',
              borderRadius: '12px',
              marginBottom: '14px',
              overflowX: 'auto',
              WebkitOverflowScrolling: 'touch',
              touchAction: 'pan-x',
              scrollbarWidth: 'none',
              msOverflowStyle: 'none',
            }}
          >
            {[
              { id: 'all', label: 'All Rates' },
              { id: 'Dry cleaning', label: 'Dry Cleaning' },
              { id: 'Steam press', label: 'Steam Press' },
              { id: 'Premium laundry', label: 'Laundry' },
              { id: 'Club Fresh DC', label: '👑 Club Fresh DC' },
              { id: 'Club Fresh SP', label: '👑 Club Fresh SP' },
            ].map((tab) => {
              const active = activeServiceTab === tab.id;
              const isClub = tab.id.startsWith('Club Fresh');
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveServiceTab(tab.id)}
                  style={{
                    flexShrink: 0,
                    padding: '8px 12px',
                    borderRadius: '8px',
                    border: 'none',
                    background: active
                      ? (isClub ? '#b45309' : '#0284c7')
                      : (isClub ? '#fef3c7' : 'transparent'),
                    color: active
                      ? '#ffffff'
                      : (isClub ? '#92400e' : '#64748b'),
                    fontSize: '11px',
                    fontWeight: active ? 800 : 700,
                    cursor: 'pointer',
                    boxShadow: active ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                    whiteSpace: 'nowrap',
                    transition: 'all 0.15s ease',
                  }}
                >
                  {tab.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Club Fresh Privilege Rates Explainer Banner */}
        {(activeCategory === 'club-fresh' || activeServiceTab.startsWith('Club Fresh')) && (
          <div
            style={{
              background: 'linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)',
              border: '1.5px solid #fde68a',
              borderRadius: '14px',
              padding: '12px 14px',
              marginBottom: '14px',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '10px',
              boxShadow: '0 2px 8px rgba(217, 119, 6, 0.08)',
            }}
          >
            <div style={{ fontSize: '20px' }}>👑</div>
            <div style={{ flex: 1 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                <strong style={{ fontSize: '13px', color: '#92400e' }}>
                  Club Fresh Privilege Member Rates
                </strong>
                <span style={{ fontSize: '10px', background: '#f59e0b', color: '#fff', padding: '1px 6px', borderRadius: '4px', fontWeight: 800 }}>
                  UP TO 40% OFF
                </span>
              </div>
              <p style={{ margin: '3px 0 0', fontSize: '11px', color: '#b45309', lineHeight: 1.4 }}>
                Special privileged pricing for Dry Cleaning (Club Fresh DC) and Steam Pressing (Club Fresh SP). Contact our store counter team or message us on WhatsApp to unlock Club Fresh member savings!
              </p>
            </div>
          </div>
        )}

        {/* SECTION 1: GARMENTS LIST (Men, Women, Kids, Household, or All) */}
        {activeCategory !== 'weight' && activeCategory !== 'addons' && activeCategory !== 'packages' && (
          <div>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                {activeCategory === 'all'
                  ? 'All Garments'
                  : activeCategory === 'club-fresh'
                    ? '👑 Club Fresh Garments'
                    : `${activeCategory} Collection`} ({filteredGarments.length})
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Tap + to add to bag</span>
            </div>

            {filteredGarments.length === 0 ? (
              <div style={{ background: '#ffffff', padding: '32px 16px', borderRadius: '16px', textAlign: 'center', border: '1px dashed #cbd5e1' }}>
                <p style={{ margin: 0, color: '#64748b', fontSize: '13px' }}>No garments match "{searchQuery}".</p>
                <button
                  type="button"
                  onClick={() => { setSearchQuery(''); setActiveCategory('all'); setActiveServiceTab('all'); }}
                  style={{ marginTop: '10px', background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                >
                  View all garments
                </button>
              </div>
            ) : (
              <div style={{ display: 'grid', gap: '8px' }}>
                {filteredGarments.map((g) => {
                  const dcPrice = g.prices?.['Dry cleaning'];
                  const spPrice = g.prices?.['Steam press'];
                  const plPrice = g.prices?.['Premium laundry'];
                  const cfdcPrice = g.prices?.['Club Fresh DC'];
                  const cfspPrice = g.prices?.['Club Fresh SP'];

                  // Which service to add by default or per tab
                  const targetService = activeServiceTab !== 'all'
                    ? activeServiceTab
                    : (activeCategory === 'club-fresh' ? 'Club Fresh DC' : 'Dry cleaning');
                  const activePrice = g.prices?.[targetService] || dcPrice || spPrice || plPrice;
                  const itemKey = `${g.id}:${targetService}`;
                  const currentQty = cart[itemKey]?.quantity || 0;
                  const isClubActive = targetService.startsWith('Club Fresh');

                  return (
                    <div
                      key={g.id}
                      style={{
                        background: '#ffffff',
                        borderRadius: '12px',
                        padding: '12px 14px',
                        border: currentQty > 0
                          ? (isClubActive ? '1.5px solid #d97706' : '1.5px solid #0284c7')
                          : (isClubActive ? '1px solid #fde68a' : '1px solid #f1f5f9'),
                        boxShadow: currentQty > 0
                          ? '0 4px 12px rgba(2, 132, 199, 0.08)'
                          : '0 1px 3px rgba(0,0,0,0.02)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        gap: '12px',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '2px' }}>
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#0f172a' }}>{g.name}</span>
                          <span
                            style={{
                              fontSize: '10px',
                              background: '#f1f5f9',
                              color: '#64748b',
                              padding: '1px 6px',
                              borderRadius: '4px',
                              fontWeight: 600,
                            }}
                          >
                            {g.category}
                          </span>
                        </div>

                        {/* Price tags depending on activeServiceTab */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', marginTop: '4px', alignItems: 'center' }}>
                          {activeServiceTab === 'all' ? (
                            <>
                              {dcPrice != null && (
                                <span style={{ fontSize: '11px', background: '#e0f2fe', color: '#0369a1', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  Dry Clean: ₹{dcPrice}
                                </span>
                              )}
                              {spPrice != null && (
                                <span style={{ fontSize: '11px', background: '#f1f5f9', color: '#475569', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                  Steam Press: ₹{spPrice}
                                </span>
                              )}
                              {plPrice != null && (
                                <span style={{ fontSize: '11px', background: '#f0fdf4', color: '#15803d', padding: '2px 6px', borderRadius: '4px', fontWeight: 600 }}>
                                  Laundry: ₹{plPrice}
                                </span>
                              )}
                              {cfdcPrice != null && (
                                <span style={{ fontSize: '11px', background: '#fef3c7', color: '#b45309', border: '1px solid #fde68a', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  👑 Club DC: ₹{cfdcPrice}
                                </span>
                              )}
                              {cfspPrice != null && (
                                <span style={{ fontSize: '11px', background: '#fef9c3', color: '#854d0e', border: '1px solid #fef08a', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                  👑 Club SP: ₹{cfspPrice}
                                </span>
                              )}
                            </>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                              <span style={{ fontSize: '13px', fontWeight: 800, color: isClubActive ? '#b45309' : '#0284c7' }}>
                                ₹{activePrice}
                              </span>
                              <span style={{ fontSize: '10px', background: isClubActive ? '#fef3c7' : '#f1f5f9', color: isClubActive ? '#b45309' : '#64748b', padding: '1px 6px', borderRadius: '4px', fontWeight: 700 }}>
                                {targetService}
                              </span>
                              {isClubActive && dcPrice != null && activePrice < dcPrice && (
                                <span style={{ fontSize: '10px', color: '#16a34a', fontWeight: 700 }}>
                                  Save ₹{dcPrice - activePrice} vs standard!
                                </span>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Quantity Stepper */}
                      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                        {currentQty > 0 && (
                          <button
                            type="button"
                            onClick={() => updateGarmentQty(g, targetService, -1)}
                            style={{
                              width: '28px',
                              height: '28px',
                              borderRadius: '8px',
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              color: '#334155',
                              display: 'grid',
                              placeItems: 'center',
                              cursor: 'pointer',
                              fontWeight: 800,
                            }}
                            aria-label={`Decrease ${g.name}`}
                          >
                            <Minus size={13} />
                          </button>
                        )}

                        {currentQty > 0 && (
                          <span style={{ fontSize: '13px', fontWeight: 800, minWidth: '18px', textAlign: 'center', color: isClubActive ? '#b45309' : '#0284c7' }}>
                            {currentQty}
                          </span>
                        )}

                        <button
                          type="button"
                          onClick={() => updateGarmentQty(g, targetService, 1)}
                          style={{
                            width: '30px',
                            height: '30px',
                            borderRadius: '8px',
                            border: 'none',
                            background: isClubActive ? '#b45309' : '#0284c7',
                            color: '#ffffff',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                            fontWeight: 800,
                            boxShadow: isClubActive ? '0 2px 6px rgba(180, 83, 9, 0.3)' : '0 2px 6px rgba(2, 132, 199, 0.3)',
                          }}
                          aria-label={`Add ${g.name}`}
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* SECTION 2: WEIGHT SERVICES (Wash & Fold, Wash & Iron, DCG by Kilo, Drying) */}
        {(activeCategory === 'weight' || activeCategory === 'all') && (
          <div style={{ marginTop: activeCategory === 'all' ? '28px' : '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                ⚖️ Laundry by Weight (Per Kilogram)
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Billed per kg</span>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              {weightItems.map((ws) => {
                const currentQty = cart[`weight:${ws.id}`]?.quantity || 0;
                return (
                  <div
                    key={ws.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '12px 14px',
                      border: currentQty > 0 ? '1.5px solid #059669' : '1px solid #f1f5f9',
                      boxShadow: currentQty > 0 ? '0 4px 12px rgba(5, 150, 105, 0.08)' : '0 1px 3px rgba(0,0,0,0.02)',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '14px', color: '#0f172a', display: 'block' }}>{ws.label}</strong>
                      <span style={{ fontSize: '11px', color: '#64748b' }}>{ws.description || 'Professional kilo laundry care'}</span>
                      <div style={{ marginTop: '4px' }}>
                        <span style={{ fontSize: '13px', fontWeight: 800, color: '#059669' }}>
                          ₹{ws.ratePerKg} <small style={{ fontSize: '11px', fontWeight: 500 }}>/ kg</small>
                        </span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {currentQty > 0 && (
                        <button
                          type="button"
                          onClick={() => updateWeightQty(ws, -1)}
                          style={{
                            width: '28px',
                            height: '28px',
                            borderRadius: '8px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            color: '#334155',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Minus size={13} />
                        </button>
                      )}
                      {currentQty > 0 && (
                        <span style={{ fontSize: '13px', fontWeight: 800, minWidth: '22px', textAlign: 'center', color: '#059669' }}>
                          {currentQty}kg
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => updateWeightQty(ws, 1)}
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius: '8px',
                          border: 'none',
                          background: '#059669',
                          color: '#ffffff',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(5, 150, 105, 0.3)',
                        }}
                      >
                        <Plus size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 3: ADD-ONS (Stain Removal, Starch, Softener, Antiseptic) */}
        {(activeCategory === 'addons' || activeCategory === 'all') && (
          <div style={{ marginTop: activeCategory === 'all' ? '28px' : '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🧼 Fabric Care & Treatment Add-ons
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Optional extra care</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '8px' }}>
              {addons.map((add) => {
                const currentQty = cart[`addon:${add.id}`]?.quantity || 0;
                return (
                  <div
                    key={add.id}
                    style={{
                      background: '#ffffff',
                      borderRadius: '12px',
                      padding: '10px 12px',
                      border: currentQty > 0 ? '1.5px solid #7c3aed' : '1px solid #f1f5f9',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      gap: '8px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{add.name}</strong>
                      <span style={{ fontSize: '12px', fontWeight: 700, color: '#7c3aed' }}>+₹{add.price}</span>
                    </div>

                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexShrink: 0 }}>
                      {currentQty > 0 && (
                        <button
                          type="button"
                          onClick={() => updateAddonQty(add, -1)}
                          style={{
                            width: '26px',
                            height: '26px',
                            borderRadius: '6px',
                            border: '1px solid #cbd5e1',
                            background: '#f8fafc',
                            color: '#334155',
                            display: 'grid',
                            placeItems: 'center',
                            cursor: 'pointer',
                          }}
                        >
                          <Minus size={12} />
                        </button>
                      )}
                      {currentQty > 0 && (
                        <span style={{ fontSize: '12px', fontWeight: 800, minWidth: '16px', textAlign: 'center', color: '#7c3aed' }}>
                          {currentQty}
                        </span>
                      )}
                      <button
                        type="button"
                        onClick={() => updateAddonQty(add, 1)}
                        style={{
                          width: '28px',
                          height: '28px',
                          borderRadius: '6px',
                          border: 'none',
                          background: '#7c3aed',
                          color: '#ffffff',
                          display: 'grid',
                          placeItems: 'center',
                          cursor: 'pointer',
                          boxShadow: '0 2px 6px rgba(124, 58, 237, 0.25)',
                        }}
                      >
                        <Plus size={13} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION 4: PACKAGES & DISCOUNTS */}
        {(activeCategory === 'packages' || activeCategory === 'all') && (
          <div style={{ marginTop: activeCategory === 'all' ? '28px' : '0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                🎁 Money-Saving Packages & Offers
              </span>
              <span style={{ fontSize: '11px', color: '#94a3b8' }}>Lifetime savings</span>
            </div>

            <div style={{ display: 'grid', gap: '10px' }}>
              {packages.map((pkg) => (
                <div
                  key={pkg.id}
                  style={{
                    background: 'linear-gradient(135deg, #ffffff 0%, #f8fafc 100%)',
                    borderRadius: '14px',
                    padding: '14px 16px',
                    border: '1px solid #e2e8f0',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.03)',
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                    <div>
                      <strong style={{ fontSize: '15px', color: '#0f172a' }}>{pkg.name}</strong>
                      <p style={{ margin: '3px 0 6px', fontSize: '12px', color: '#64748b', lineHeight: 1.4 }}>
                        {pkg.description}
                      </p>
                      {pkg.validity && (
                        <span style={{ fontSize: '10px', background: '#e0f2fe', color: '#0369a1', padding: '2px 8px', borderRadius: '4px', fontWeight: 700 }}>
                          ⏱️ {pkg.validity}
                        </span>
                      )}
                    </div>
                    <div style={{ textAlign: 'right', flexShrink: 0 }}>
                      <span style={{ fontSize: '16px', fontWeight: 800, color: '#0284c7' }}>
                        ₹{pkg.price}
                      </span>
                      {pkg.walletCredit > pkg.price && (
                        <div style={{ fontSize: '11px', color: '#16a34a', fontWeight: 700 }}>
                          Get ₹{pkg.walletCredit} credit!
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Store Location, Address & Service Policy */}
        <div style={{ marginTop: '24px', padding: '16px 18px', borderRadius: '14px', background: '#ffffff', border: '1px solid #e2e8f0', boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
            <div style={{ width: '32px', height: '32px', borderRadius: '8px', background: 'rgba(2, 132, 199, 0.1)', display: 'grid', placeItems: 'center', color: '#0284c7' }}>
              <Store size={16} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 800, color: '#0f172a' }}>
                {settings.storeName || 'Clean Clear Dry Cleaning'}
              </h3>
              {settings.tagline && (
                <p style={{ margin: '2px 0 0', fontSize: '11px', color: '#64748b' }}>{settings.tagline}</p>
              )}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '8px', fontSize: '12px', color: '#475569', marginTop: '10px' }}>
            {settings.address && (
              <div style={{ display: 'flex', alignItems: 'flex-start', gap: '8px' }}>
                <MapPin size={15} color="#0284c7" style={{ flexShrink: 0, marginTop: '2px' }} />
                <span>{settings.address}</span>
              </div>
            )}
            {storePhoneRaw && (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Phone size={15} color="#0284c7" style={{ flexShrink: 0 }} />
                <span>Store Helpline / WhatsApp: +{adminReceiverNumber}</span>
              </div>
            )}
          </div>

          {settings.receiptFooter && (
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px dashed #e2e8f0', fontSize: '11px', color: '#64748b', lineHeight: 1.45 }}>
              {settings.receiptFooter}
            </div>
          )}
        </div>
      </main>

      {/* FIXED BOTTOM FLOATING BAR */}
      <footer
        style={{
          position: 'fixed',
          bottom: 0,
          left: 0,
          right: 0,
          background: '#ffffff',
          borderTop: '1px solid #e2e8f0',
          padding: '10px 14px',
          boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.08)',
          zIndex: 900,
        }}
      >
        <div style={{ maxWidth: '680px', margin: '0 auto', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>

          {/* Quick Sharing Buttons */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {/* WhatsApp Share to another person */}
            <button
              type="button"
              onClick={handleShareWhatsAppGeneral}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid #86efac',
                background: '#f0fdf4',
                color: '#15803d',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Forward price list to a friend via WhatsApp"
            >
              <Share2 size={14} color="#16a34a" /> Forward
            </button>

            {/* Copy Link */}
            <button
              type="button"
              onClick={handleCopyLink}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                padding: '9px 12px',
                borderRadius: '10px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
              }}
              title="Copy price list link"
            >
              {copiedLink ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
              {copiedLink ? 'Copied!' : 'Copy'}
            </button>
          </div>

          {/* Laundry Bag / Order Trigger Button */}
          <button
            type="button"
            onClick={() => setIsBagOpen(true)}
            style={{
              flex: 1,
              display: 'inline-flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '12px',
              border: 'none',
              background: totalItemsCount > 0 ? '#16a34a' : '#0f172a',
              color: '#ffffff',
              fontSize: '13px',
              fontWeight: 800,
              cursor: 'pointer',
              boxShadow: totalItemsCount > 0 ? '0 4px 14px rgba(22, 163, 74, 0.35)' : '0 2px 8px rgba(15, 23, 42, 0.2)',
              transition: 'all 0.15s ease',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <ShoppingBag size={16} />
              <span>{totalItemsCount > 0 ? `${totalItemsCount} item(s)` : 'My Bag'}</span>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span>{totalItemsCount > 0 ? `₹${totalEstimatedAmount}` : 'Choose Items'}</span>
              <ChevronUp size={16} />
            </div>
          </button>
        </div>
      </footer>

      {/* LAUNDRY BAG / ORDER REQUEST MODAL DRAWER */}
      {isBagOpen && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.7)',
            backdropFilter: 'blur(4px)',
            zIndex: 99999,
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'center',
          }}
          onClick={() => setIsBagOpen(false)}
        >
          <div
            style={{
              background: '#ffffff',
              width: '100%',
              maxWidth: '680px',
              maxHeight: '90vh',
              borderTopLeftRadius: '24px',
              borderTopRightRadius: '24px',
              boxShadow: '0 -10px 40px rgba(0,0,0,0.2)',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Drawer Header */}
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid #e2e8f0',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 800, color: '#0f172a' }}>
                  🧺 My Laundry Bag & Pickup Request
                </h3>
                <span style={{ fontSize: '12px', color: '#64748b' }}>
                  {totalItemsCount} item(s) selected · Est: ₹{totalEstimatedAmount}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setIsBagOpen(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: 'none',
                  background: '#f1f5f9',
                  color: '#64748b',
                  display: 'grid',
                  placeItems: 'center',
                  cursor: 'pointer',
                }}
              >
                <X size={16} />
              </button>
            </div>

            {/* Drawer Body */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', flex: 1 }}>

              {/* Customer Identification Inputs */}
              <div
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  borderRadius: '14px',
                  padding: '14px',
                  marginBottom: '16px',
                }}
              >
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#0284c7', textTransform: 'uppercase', letterSpacing: '0.05em', display: 'block', marginBottom: '8px' }}>
                  Your Contact Details
                </span>

                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Customer Name <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Aditi Sharma"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        color: '#0f172a',
                        fontWeight: 600,
                      }}
                    />
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                      Mobile Number <span style={{ color: '#ef4444' }}>*</span>
                    </label>
                    <input
                      type="tel"
                      placeholder="e.g. 98765 43210"
                      value={customerPhone}
                      onChange={(e) => setCustomerPhone(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '9px 12px',
                        borderRadius: '8px',
                        border: '1px solid #cbd5e1',
                        fontSize: '13px',
                        outline: 'none',
                        color: '#0f172a',
                        fontWeight: 600,
                      }}
                    />
                  </div>
                </div>

                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 600, color: '#475569', marginBottom: '4px' }}>
                    Pickup Address / Notes (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Tower 3, Flat 502 · Pickup today at 5 PM"
                    value={pickupAddress}
                    onChange={(e) => setPickupAddress(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '9px 12px',
                      borderRadius: '8px',
                      border: '1px solid #cbd5e1',
                      fontSize: '13px',
                      outline: 'none',
                      color: '#0f172a',
                    }}
                  />
                </div>
              </div>

              {/* Selected Items List */}
              <div style={{ marginBottom: '16px' }}>
                <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '8px' }}>
                  Chosen Items ({cartList.length})
                </span>

                {cartList.length === 0 ? (
                  <div style={{ padding: '24px 12px', textAlign: 'center', background: '#f8fafc', borderRadius: '12px', border: '1px dashed #cbd5e1' }}>
                    <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>Your laundry bag is empty.</p>
                    <button
                      type="button"
                      onClick={() => setIsBagOpen(false)}
                      style={{ marginTop: '8px', background: 'none', border: 'none', color: '#0284c7', fontSize: '12px', fontWeight: 700, cursor: 'pointer' }}
                    >
                      ← Browse price list & add items
                    </button>
                  </div>
                ) : (
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {cartList.map((item) => (
                      <div
                        key={item.key}
                        style={{
                          background: '#ffffff',
                          border: '1px solid #e2e8f0',
                          borderRadius: '10px',
                          padding: '10px 12px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '10px',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '13px', color: '#0f172a', display: 'block' }}>{item.name}</strong>
                          <span style={{ fontSize: '11px', color: '#64748b' }}>
                            {item.service} · ₹{item.price} each
                          </span>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '13px', fontWeight: 800, color: '#0f172a' }}>
                            ₹{item.price * item.quantity}
                          </span>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.type === 'piece') updateGarmentQty(item.garment, item.service, -1);
                                else if (item.type === 'weight') updateWeightQty(item.weightService, -1);
                                else if (item.type === 'addon') updateAddonQty(item.addon, -1);
                              }}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                border: '1px solid #cbd5e1',
                                background: '#f8fafc',
                                color: '#334155',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Minus size={12} />
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '16px', textAlign: 'center' }}>
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              onClick={() => {
                                if (item.type === 'piece') updateGarmentQty(item.garment, item.service, 1);
                                else if (item.type === 'weight') updateWeightQty(item.weightService, 1);
                                else if (item.type === 'addon') updateAddonQty(item.addon, 1);
                              }}
                              style={{
                                width: '24px',
                                height: '24px',
                                borderRadius: '6px',
                                border: 'none',
                                background: '#0284c7',
                                color: '#ffffff',
                                display: 'grid',
                                placeItems: 'center',
                                cursor: 'pointer',
                              }}
                            >
                              <Plus size={12} />
                            </button>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Price Calculation Summary */}
              {cartList.length > 0 && (
                <div style={{ background: '#f8fafc', borderRadius: '12px', padding: '12px 14px', marginBottom: '16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#64748b', marginBottom: '6px' }}>
                    <span>Estimated Subtotal</span>
                    <span>₹{totalEstimatedAmount}</span>
                  </div>
                  {settings?.taxEnabled && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', color: '#94a3b8', marginBottom: '6px' }}>
                      <span>Taxes & GST ({settings.taxPercent || 18}%)</span>
                      <span>Estimated upon billing</span>
                    </div>
                  )}
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '15px', fontWeight: 800, color: '#0f172a', paddingTop: '6px', borderTop: '1px solid #e2e8f0' }}>
                    <span>Estimated Total</span>
                    <span style={{ color: '#16a34a' }}>₹{totalEstimatedAmount}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Footer Actions */}
            <div style={{ padding: '14px 20px', borderTop: '1px solid #e2e8f0', background: '#ffffff' }}>
              <button
                type="button"
                onClick={handleSendOrderWhatsApp}
                disabled={cartList.length === 0}
                style={{
                  width: '100%',
                  padding: '14px',
                  borderRadius: '12px',
                  border: 'none',
                  background: cartList.length > 0 ? '#16a34a' : '#cbd5e1',
                  color: '#ffffff',
                  fontSize: '14px',
                  fontWeight: 800,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  cursor: cartList.length > 0 ? 'pointer' : 'not-allowed',
                  boxShadow: cartList.length > 0 ? '0 4px 14px rgba(22, 163, 74, 0.35)' : 'none',
                }}
              >
                <MessageSquare size={18} />
                <span>Send Order & Pickup Request via WhatsApp</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            bottom: '80px',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#0f172a',
            color: '#ffffff',
            padding: '10px 18px',
            borderRadius: '24px',
            fontSize: '12px',
            fontWeight: 700,
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            boxShadow: '0 10px 25px rgba(0,0,0,0.2)',
            zIndex: 999999,
          }}
        >
          <CheckCircle2 size={16} color="#4ade80" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
