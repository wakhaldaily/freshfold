import React, { useMemo, useState, useEffect } from 'react';
import {
  CalendarDays, Check, ChevronDown, ChevronRight, Clock, Edit3, Filter, Minus, Plus,
  ReceiptText, RotateCcw, Scale, Search, Shirt, Sparkles, Sun, Tag, Trash2, UserPlus,
  Users, Wallet, Waves, Wind, X,
} from 'lucide-react';
import { defaultSettings, garmentCatalog, services, weightServices } from '../data.js';
import { formatMoney, formatOrderNo, getNextOrderNo } from '../lib/persistence.js';
import { findBestPackageDiscount, isGarmentEligible } from '../lib/packageDiscountEngine.js';
import ItemTagModal from './ItemTagModal.jsx';
import CustomSelect from './CustomSelect.jsx';

export default function PosRegister({
  customers = [],
  customerPackages = [],
  packages = [],
  orders = [],
  initialCustomer = null,
  initialOrderType = 'pieces',
  settings = {},
  addons = [],
  brands = [],
  colors = [],
  defects = [],
  onSaveAddon,
  onSaveBrand,
  onSaveColor,
  onSaveDefect,
  onCompleteOrder,
  onOpenNewCustomerModal,
  onBack,
  onToast,
}) {
  const [selectedCustomerId, setSelectedCustomerId] = useState(initialCustomer?.id || customers[0]?.id || '');
  const [orderType, setOrderType] = useState(initialOrderType); // 'pieces' or 'weight'

  // Default next order number based on store settings or latest order in sequence
  const defaultNextOrderNo = useMemo(() => {
    if (settings?.nextOrderNo) return settings.nextOrderNo;
    if (orders && orders.length > 0 && orders[0]?.orderNo) {
      return getNextOrderNo(orders[0].orderNo);
    }
    return 'B6164';
  }, [settings?.nextOrderNo, orders]);

  const [customOrderNo, setCustomOrderNo] = useState(defaultNextOrderNo);
  const [hasManuallyEditedOrderNo, setHasManuallyEditedOrderNo] = useState(false);

  // Synchronize when default sequence advances and user hasn't typed a custom override
  useEffect(() => {
    if (!hasManuallyEditedOrderNo) {
      setCustomOrderNo(defaultNextOrderNo);
    }
  }, [defaultNextOrderNo, hasManuallyEditedOrderNo]);

  // Check if chosen order number already exists in current orders
  const isDuplicateOrderNo = useMemo(() => {
    if (!customOrderNo || !customOrderNo.trim()) return false;
    const target = customOrderNo.trim().toLowerCase();
    return (orders || []).some((o) => (o.orderNo || '').trim().toLowerCase() === target);
  }, [customOrderNo, orders]);

  // Service Selection:
  // For pieces: 'Dry cleaning', 'Steam press', 'Premium laundry', 'Club Fresh DC', 'Club Fresh SP'
  // For weight: 'Wash and Fold', 'Wash and iron', 'DCG by Kilo', 'Drying'
  const [selectedPieceService, setSelectedPieceService] = useState('Dry cleaning');
  const [selectedWeightService, setSelectedWeightService] = useState('Wash and Fold');

  const [selectedCategory, setSelectedCategory] = useState('All');
  const [garmentSearch, setGarmentSearch] = useState('');

  // Cart for Piece mode
  const [cartItems, setCartItems] = useState([]);

  // Tagging modal for a cart item
  const [taggingItemIndex, setTaggingItemIndex] = useState(null);

  // State for Weight mode
  const [weightKg, setWeightKg] = useState('');
  const [weightClothesCount, setWeightClothesCount] = useState('');
  const [weightNote, setWeightNote] = useState('');
  const [weightGarments, setWeightGarments] = useState([]); // itemized clothes in bag: [{ id, name, category, quantity }]
  const [weightAddons, setWeightAddons] = useState([]); // applied add-on services: [{ id, name, price }]
  const [showWeightGarmentList, setShowWeightGarmentList] = useState(false);
  const [weightGarmentSearch, setWeightGarmentSearch] = useState('');
  const [weightGarmentCategory, setWeightGarmentCategory] = useState('All');

  // Addon creator inline in weight mode
  const [showAddonPickerWeight, setShowAddonPickerWeight] = useState(false);
  const [weightAddonSearch, setWeightAddonSearch] = useState('');
  const [newAddonPriceWeight, setNewAddonPriceWeight] = useState('');

  const [dueDate, setDueDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() + 3);
    return d.toISOString().slice(0, 10);
  });
  const [submitting, setSubmitting] = useState(false);
  const [mobilePosTab, setMobilePosTab] = useState('catalog'); // 'catalog' | 'ticket'

  // Active customer
  const currentCustomer = customers.find((c) => c.id === selectedCustomerId) || customers[0] || null;

  // Active customer packages
  const customerActivePackages = useMemo(() => {
    if (!currentCustomer) return [];
    return customerPackages.filter((cp) => cp.customerId === currentCustomer.id && cp.status === 'active');
  }, [customerPackages, currentCustomer]);

  // Current active service label and object
  const activeService = orderType === 'weight' ? selectedWeightService : selectedPieceService;
  const currentWeightServiceObj = weightServices.find((s) => s.label === selectedWeightService) || weightServices[0];

  // Garment categories
  const categories = ['All', 'Men', 'Women', 'Kids', 'Household'];

  // Filtered garments for Piece catalog
  const filteredPieceGarments = garmentCatalog.filter((g) => {
    if (selectedCategory !== 'All' && g.category !== selectedCategory) return false;
    if (garmentSearch.trim() && !g.name.toLowerCase().includes(garmentSearch.trim().toLowerCase())) return false;
    return true;
  });

  // Filtered garments for Weight clothes breakdown
  const filteredWeightGarments = garmentCatalog.filter((g) => {
    if (weightGarmentCategory !== 'All' && g.category !== weightGarmentCategory) return false;
    if (weightGarmentSearch.trim() && !g.name.toLowerCase().includes(weightGarmentSearch.trim().toLowerCase())) return false;
    return true;
  });

  // Add garment to cart in Piece mode
  const handleAddGarmentPiece = (garment) => {
    const unitPrice = garment.prices?.[selectedPieceService];
    if (unitPrice === null || unitPrice === undefined) {
      onToast(`"${garment.name}" is not available for ${selectedPieceService} (marked NA).`);
      return;
    }

    setCartItems((prev) => {
      const existing = prev.find((item) => item.id === garment.id && item.service === selectedPieceService);
      if (existing) {
        return prev.map((item) =>
          item === existing ? { ...item, quantity: item.quantity + 1 } : item
        );
      }
      return [
        ...prev,
        {
          id: garment.id,
          name: garment.name,
          category: garment.category,
          unitPrice,
          quantity: 1,
          service: selectedPieceService,
          brand: '',
          color: '',
          defects: [],
          addons: [],
          note: '',
        },
      ];
    });
  };

  const handleUpdateQty = (idx, delta) => {
    setCartItems((prev) =>
      prev
        .map((item, i) => {
          if (i === idx) {
            const next = item.quantity + delta;
            return next > 0 ? { ...item, quantity: next } : null;
          }
          return item;
        })
        .filter(Boolean)
    );
  };

  const handleRemoveItem = (idx) => {
    setCartItems((prev) => prev.filter((_, i) => i !== idx));
  };

  // Garments breakdown for Weight mode
  const handleAddWeightGarment = (garment) => {
    setWeightGarments((prev) => {
      const existing = prev.find((it) => it.id === garment.id);
      let updated;
      if (existing) {
        updated = prev.map((it) => it.id === garment.id ? { ...it, quantity: it.quantity + 1 } : it);
      } else {
        updated = [...prev, { id: garment.id, name: garment.name, category: garment.category, quantity: 1 }];
      }
      // Auto-update clothes count
      const totalCount = updated.reduce((sum, it) => sum + it.quantity, 0);
      setWeightClothesCount(String(totalCount));
      return updated;
    });
  };

  const handleUpdateWeightGarmentQty = (garmentId, delta) => {
    setWeightGarments((prev) => {
      const updated = prev
        .map((it) => {
          if (it.id === garmentId) {
            const next = it.quantity + delta;
            return next > 0 ? { ...it, quantity: next } : null;
          }
          return it;
        })
        .filter(Boolean);
      const totalCount = updated.reduce((sum, it) => sum + it.quantity, 0);
      setWeightClothesCount(totalCount > 0 ? String(totalCount) : '');
      return updated;
    });
  };

  // Addons for Weight mode
  const handleToggleWeightAddon = (addon) => {
    const exists = weightAddons.some((a) => a.id === addon.id || a.name === addon.name);
    if (exists) {
      setWeightAddons(weightAddons.filter((a) => a.id !== addon.id && a.name !== addon.name));
    } else {
      setWeightAddons([...weightAddons, addon]);
    }
  };

  const handleCreateWeightAddon = async () => {
    const name = weightAddonSearch.trim();
    const price = Number(newAddonPriceWeight || 0);
    if (!name) return;
    const newObj = { id: `addon-${Date.now()}`, name, price };
    if (onSaveAddon) await onSaveAddon(newObj);
    setWeightAddons([...weightAddons, newObj]);
    setWeightAddonSearch('');
    setNewAddonPriceWeight('');
    setShowAddonPickerWeight(false);
  };

  // Calculations
  const grossAmount = useMemo(() => {
    if (orderType === 'weight') {
      const kg = Number(weightKg || 0);
      const weightCost = kg * currentWeightServiceObj.ratePerKg;
      const addonsCost = weightAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);
      return Math.round((weightCost + addonsCost + Number.EPSILON) * 100) / 100;
    }
    // Piece calculation: base price + sum(addons.price) for each item * qty
    return cartItems.reduce((sum, item) => {
      const addonExtra = (item.addons || []).reduce((aSum, a) => aSum + Number(a.price || 0), 0);
      return sum + (item.unitPrice + addonExtra) * item.quantity;
    }, 0);
  }, [orderType, weightKg, currentWeightServiceObj, weightAddons, cartItems]);

  // Evaluate best package discount dynamically
  const cartContext = useMemo(() => ({
    orderType,
    service: activeService,
    items: orderType === 'pieces' ? cartItems : [],
    weightKg: Number(weightKg || 0),
    grossAmount,
  }), [orderType, activeService, cartItems, weightKg, grossAmount]);

  const { bestDiscount, allEvaluations } = useMemo(() => {
    return findBestPackageDiscount(customerActivePackages, cartContext, packages);
  }, [customerActivePackages, cartContext, packages]);

  // Rate list tier discount or customer account discount
  const tierDiscountPercent = useMemo(() => {
    if (!currentCustomer) return 0;
    const tier = currentCustomer.rateList;
    if (tier === 'Student Discount') return 15;
    if (tier === 'Corporate / B2B') return 10;
    return 0;
  }, [currentCustomer]);

  const customerBaseDiscountPercent = useMemo(() => {
    if (!currentCustomer) return 0;
    const explicitPercent = Number(currentCustomer.discountPercent || 0);
    return Math.max(explicitPercent, tierDiscountPercent);
  }, [currentCustomer, tierDiscountPercent]);

  // Compare package discount vs customer tier discount (take whichever benefits the customer most!)
  const { discountPercent, discountAmount, discountName } = useMemo(() => {
    const pkgAmt = bestDiscount ? Number(bestDiscount.discountAmount || 0) : 0;
    const pkgPct = bestDiscount ? Number(bestDiscount.discountPercent || 0) : 0;
    const pkgName = bestDiscount ? bestDiscount.discountName : '';

    const custAmt = customerBaseDiscountPercent > 0
      ? Math.round((grossAmount * (customerBaseDiscountPercent / 100) + Number.EPSILON) * 100) / 100
      : 0;

    if (pkgAmt >= custAmt && pkgAmt > 0) {
      return { discountPercent: pkgPct, discountAmount: pkgAmt, discountName: pkgName };
    }

    if (custAmt > 0) {
      const tierLabel = currentCustomer?.rateList && currentCustomer.rateList !== 'Default'
        ? `${currentCustomer.rateList} Tier`
        : 'Customer Profile';
      return {
        discountPercent: customerBaseDiscountPercent,
        discountAmount: custAmt,
        discountName: `${tierLabel} (${customerBaseDiscountPercent}%)`,
      };
    }

    return { discountPercent: 0, discountAmount: 0, discountName: '' };
  }, [bestDiscount, customerBaseDiscountPercent, grossAmount, currentCustomer]);

  const [selectedExpressId, setSelectedExpressId] = useState('standard');
  const [customExpressPercent, setCustomExpressPercent] = useState('');

  const expressOptions = useMemo(() => {
    if (Array.isArray(settings?.expressOptions) && settings.expressOptions.length > 0) {
      return settings.expressOptions;
    }
    return defaultSettings.expressOptions;
  }, [settings]);

  const activeExpressOption = expressOptions.find((o) => o.id === selectedExpressId) || expressOptions[0] || null;
  const isCustomExpress = selectedExpressId === 'custom';
  const expressPercent = isCustomExpress
    ? Math.max(0, Math.min(100, Number(customExpressPercent) || 0))
    : Number(activeExpressOption?.percent || 0);

  const taxableSubtotalBeforeExpress = Math.max(0, grossAmount - discountAmount);
  const expressAmount = expressPercent > 0
    ? Math.round((taxableSubtotalBeforeExpress * (expressPercent / 100) + Number.EPSILON) * 100) / 100
    : 0;

  const taxableSubtotal = taxableSubtotalBeforeExpress + expressAmount;

  const taxEnabled = settings?.taxEnabled ?? true;
  const taxPercent = taxEnabled ? Number(settings?.taxPercent ?? 18) : 0;
  const taxAmount = taxEnabled ? Math.round((taxableSubtotal * (taxPercent / 100) + Number.EPSILON) * 100) / 100 : 0;
  const grandTotal = Math.round((taxableSubtotal + taxAmount + Number.EPSILON) * 100) / 100;

  const handleSelectExpress = (optId) => {
    setSelectedExpressId(optId);
    const matched = expressOptions.find((o) => o.id === optId);
    if (matched && matched.days !== undefined) {
      const d = new Date();
      d.setDate(d.getDate() + matched.days);
      setDueDate(d.toISOString().slice(0, 10));
    }
  };

  // Submit Order
  const handlePlaceOrder = async (e) => {
    e.preventDefault();
    if (!currentCustomer) {
      onToast('Please select or add a customer first.');
      return;
    }
    if (orderType === 'pieces' && cartItems.length === 0) {
      onToast('Please add at least one garment to the order.');
      return;
    }
    if (orderType === 'weight' && !(Number(weightKg) > 0)) {
      onToast('Please enter a valid weight in kg.');
      return;
    }

    const activeOrderNo = (customOrderNo && customOrderNo.trim()) || defaultNextOrderNo;
    if (isDuplicateOrderNo) {
      onToast(`Order number "${activeOrderNo}" is already in use by an existing order. Please choose a unique order number.`);
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        orderNo: activeOrderNo,
        customerId: currentCustomer.id,
        customerCode: currentCustomer.customerCode || currentCustomer.code || '',
        customerGstin: currentCustomer.gstin || '',
        customerPreference: currentCustomer.preference && currentCustomer.preference !== 'NA' ? currentCustomer.preference : '',
        customerRateList: currentCustomer.rateList || 'Default',
        commPreference: currentCustomer.commPreference || 'WhatsApp & SMS',
        type: orderType,
        service: activeService,
        items: orderType === 'pieces' ? cartItems : [],
        weightKg: orderType === 'weight' ? Number(weightKg) : 0,
        weightClothesCount: orderType === 'weight' ? Number(weightClothesCount || 0) : 0,
        weightGarments: orderType === 'weight' ? weightGarments : [],
        weightAddons: orderType === 'weight' ? weightAddons : [],
        weightNote: orderType === 'weight' ? weightNote : '',
        grossAmount,
        discountAmount,
        discountPercent,
        discountName: discountName,
        expressDelivery: expressAmount > 0,
        expressPercent,
        expressAmount,
        expressLabel: isCustomExpress
          ? `Early Delivery (+${expressPercent}%)`
          : (activeExpressOption?.label ? `${activeExpressOption.label} (+${expressPercent}%)` : `Early Delivery (+${expressPercent}%)`),
        taxEnabled: Boolean(taxEnabled),
        taxAmount,
        taxPercent,
        totalAmount: grandTotal,
        dueDate,
      };
      await onCompleteOrder(payload);

      // Auto-advance sequence for the next order intake! (e.g. #w123 -> #w124)
      const nextSequenceNo = getNextOrderNo(activeOrderNo);
      setCustomOrderNo(nextSequenceNo);
      setHasManuallyEditedOrderNo(false);
    } catch (err) {
      onToast(err.message || 'Failed to place order.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSwitchTab = (tab) => {
    setMobilePosTab(tab);
    setTimeout(() => {
      const mainShell = document.querySelector('.main-shell');
      if (mainShell) {
        mainShell.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
      if (tab === 'ticket') {
        const ticketPanel = document.getElementById('pos-ticket-panel');
        if (ticketPanel) {
          ticketPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }
    }, 40);
  };

  // Ensure main shell scrolls cleanly to top when tab changes
  useEffect(() => {
    const mainShell = document.querySelector('.main-shell');
    if (mainShell) {
      mainShell.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }, [mobilePosTab]);

  return (
    <div className="pos-register-container">
      {/* Mobile-Only Tab Switcher at the VERY TOP */}
      <div className="pos-mobile-nav-tabs">
        <button
          type="button"
          className={mobilePosTab === 'catalog' ? 'active' : ''}
          onClick={() => handleSwitchTab('catalog')}
        >
          <Shirt size={15} /> <span>Clothes & Services</span>
        </button>
        <button
          type="button"
          className={mobilePosTab === 'ticket' ? 'active' : ''}
          onClick={() => handleSwitchTab('ticket')}
        >
          <ReceiptText size={15} /> <span>Ticket & Checkout</span>
          {((orderType === 'pieces' && cartItems.length > 0) || (orderType === 'weight' && Number(weightKg) > 0)) && (
            <span className="pos-tab-badge">
              {orderType === 'pieces' ? cartItems.reduce((s, it) => s + it.quantity, 0) : '1'}
            </span>
          )}
        </button>
      </div>

      {/* Top Header & Customer Selector Bar (Hidden on Mobile Ticket View) */}
      <div className={`pos-register-header-bar ${mobilePosTab === 'ticket' ? 'hidden-mobile' : ''}`}>
        <div className="pos-header-top-row">
          <div className="pos-header-title-group">
            {onBack && (
              <button
                type="button"
                className="button button-quiet pos-back-btn"
                onClick={onBack}
              >
                ← Back
              </button>
            )}
            <div>
              <span className="caption-label pos-desktop-only">Clean Clear Register</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2 className="pos-page-title">
                  {orderType === 'weight' ? 'Order by Weight (Bundle)' : 'New Laundry Intake'}
                </h2>
                <span
                  className="pos-order-badge"
                  style={{
                    color: isDuplicateOrderNo ? '#b91c1c' : '#2563eb',
                    background: isDuplicateOrderNo ? '#fee2e2' : '#eff6ff',
                    borderColor: isDuplicateOrderNo ? '#fca5a5' : '#bfdbfe',
                  }}
                >
                  {formatOrderNo(customOrderNo || defaultNextOrderNo)}
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            className="button button-quiet pos-new-customer-btn"
            onClick={onOpenNewCustomerModal}
          >
            <UserPlus size={14} /> <span>New Customer</span>
          </button>
        </div>

        {/* Customer Selection Control */}
        <div className="pos-header-customer-row">
          <CustomSelect
            value={selectedCustomerId}
            onChange={(val) => setSelectedCustomerId(val)}
            options={customers.map((c) => ({
              value: c.id,
              label: c.name,
              sublabel: `+91 ${c.mobile} · Wallet: ₹${c.walletBalance}`,
              badge: c.walletBalance > 0 ? `₹${c.walletBalance}` : undefined,
            }))}
            icon={Users}
            width="100%"
            searchable={true}
            searchPlaceholder="Search customer by name or phone..."
            placeholder="Select Customer..."
          />
        </div>

        {/* Customer Profile Tiers & Logistics Badge Strip */}
        {currentCustomer && (
          <div className="pos-header-customer-badges">
            <span
              style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                color: '#475569',
                padding: '2px 8px',
                borderRadius: '6px',
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              #{currentCustomer.customerCode || currentCustomer.code || currentCustomer.id.slice(0, 6)}
            </span>

            {currentCustomer.rateList && currentCustomer.rateList !== 'Default' && (
              <span
                style={{
                  background: '#eff6ff',
                  border: '1px solid #bfdbfe',
                  color: '#1d4ed8',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                Tier: {currentCustomer.rateList}
              </span>
            )}

            {Number(currentCustomer.discountPercent) > 0 && (
              <span
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#059669',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                {currentCustomer.discountPercent}% Off Account Discount
              </span>
            )}

            {currentCustomer.preference && currentCustomer.preference !== 'NA' && (
              <span
                style={{
                  background: '#fdf4ff',
                  border: '1px solid #f5d0fe',
                  color: '#9333ea',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 600,
                  flexShrink: 0,
                }}
              >
                Wash: {currentCustomer.preference}
              </span>
            )}

            {currentCustomer.gstin && (
              <span
                style={{
                  background: '#f1f5f9',
                  border: '1px solid #cbd5e1',
                  color: '#334155',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontFamily: 'monospace',
                  flexShrink: 0,
                }}
              >
                GSTIN: {currentCustomer.gstin}
              </span>
            )}

            {currentCustomer.walletBalance > 0 && (
              <span
                style={{
                  background: '#ecfdf5',
                  border: '1px solid #a7f3d0',
                  color: '#047857',
                  padding: '2px 8px',
                  borderRadius: '6px',
                  fontWeight: 700,
                  marginLeft: 'auto',
                  flexShrink: 0,
                }}
              >
                Wallet Balance: ₹{currentCustomer.walletBalance}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Main 2-Column POS Layout: Intake on Left, Live Cart Ticket on Right */}
      <div className="pos-register-layout">
        {/* LEFT COLUMN: Garment Catalog or Weight Entry */}
        <div
          className={`pos-column-catalog ${mobilePosTab === 'ticket' ? 'hidden-mobile' : ''}`}
        >
          {/* STICKY SELECTION CONTROLS ON MOBILE: Mode, Services, Search & Categories */}
          <div className="pos-catalog-sticky-controls">
            {/* Order Type & Service Switcher */}
            <div className="pos-service-bar">
              {/* Row 1: Mode Switcher (Pieces vs Weight) + Active Info */}
              <div className="pos-mode-row">
                <div className="pos-mode-tabs">
                  <button
                    type="button"
                    className={`pos-mode-btn ${orderType === 'pieces' ? 'active' : ''}`}
                    onClick={() => setOrderType('pieces')}
                  >
                    <Shirt size={14} /> Piece by Piece
                  </button>
                  <button
                    type="button"
                    className={`pos-mode-btn ${orderType === 'weight' ? 'active' : ''}`}
                    onClick={() => setOrderType('weight')}
                  >
                    <Scale size={14} /> By Weight (kg)
                  </button>
                </div>

                <span className="pos-active-service-badge">
                  {orderType === 'pieces'
                    ? selectedPieceService
                    : `₹${weightServices.find((w) => w.label === selectedWeightService)?.ratePerKg || 0}/kg`}
                </span>
              </div>

              {/* Row 2: Service Selector Tiers - Sleek Horizontal Strip */}
              {orderType === 'pieces' ? (
                <div className="pos-service-scroll-strip" role="tablist">
                  {services.filter((s) => s.tier !== 'club-fresh').map((s) => {
                    const isSelected = selectedPieceService === s.label;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedPieceService(s.label)}
                        className={`pos-service-pill ${isSelected ? 'active' : ''}`}
                      >
                        {s.label}
                      </button>
                    );
                  })}
                  <div className="pos-service-strip-divider" />
                  {services.filter((s) => s.tier === 'club-fresh').map((s) => {
                    const isSelected = selectedPieceService === s.label;
                    return (
                      <button
                        key={s.id}
                        type="button"
                        onClick={() => setSelectedPieceService(s.label)}
                        className={`pos-service-pill club-fresh ${isSelected ? 'active' : ''}`}
                      >
                        ⭐ {s.label}
                      </button>
                    );
                  })}
                </div>
              ) : (
                <div className="pos-service-scroll-strip" role="tablist">
                  {weightServices.map((ws) => {
                    const isSelected = selectedWeightService === ws.label;
                    return (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => setSelectedWeightService(ws.label)}
                        className={`pos-service-pill ${isSelected ? 'active' : ''}`}
                      >
                        <strong>{ws.label}</strong>
                        <span className="pos-pill-rate">(₹{ws.ratePerKg}/kg)</span>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Piece Mode Search & Category Filter */}
            {orderType === 'pieces' && (
              <div className="pos-filter-search-row">
                {/* Garment Quick Search */}
                <div className="pos-garment-search-box">
                  <Search size={15} color="#64748b" style={{ flexShrink: 0 }} />
                  <input
                    type="text"
                    placeholder="Search clothes (e.g. Shirt, Saree, Coat)..."
                    value={garmentSearch}
                    onChange={(e) => setGarmentSearch(e.target.value)}
                  />
                  {garmentSearch && (
                    <button
                      type="button"
                      onClick={() => setGarmentSearch('')}
                      className="pos-search-clear-btn"
                      aria-label="Clear search"
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>

                {/* Category selector strip */}
                <div className="pos-category-scroll-strip" role="tablist">
                  {categories.map((cat) => (
                    <button
                      key={cat}
                      type="button"
                      onClick={() => setSelectedCategory(cat)}
                      className={`pos-category-pill ${selectedCategory === cat ? 'active' : ''}`}
                    >
                      {cat}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ========================================================= */}
          {/* 1. PIECE MODE VIEW                                       */}
          {/* ========================================================= */}
          {orderType === 'pieces' ? (
            <div className="pos-piece-catalog-wrap">

              {/* Garment Cards Grid */}
              <div className={`pos-garment-grid ${(orderType === 'pieces' && cartItems.length > 0) || (orderType === 'weight' && Number(weightKg) > 0) ? 'has-floating-cart' : ''}`}>
                {filteredPieceGarments.length === 0 && (
                  <div className="pos-empty-catalog">
                    <Shirt size={28} color="#94a3b8" style={{ margin: '0 auto 8px' }} />
                    <p style={{ margin: 0, fontSize: '13px', fontWeight: 600, color: '#475569' }}>
                      No garments found matching "{garmentSearch}"
                    </p>
                    <small style={{ color: '#94a3b8', fontSize: '11px' }}>
                      Try checking another category tab or clearing the search query.
                    </small>
                  </div>
                )}
                {filteredPieceGarments.map((g) => {
                  const servicePrice = g.prices?.[selectedPieceService];
                  const isAvailable = servicePrice !== null && servicePrice !== undefined;
                  const inCartCount = cartItems
                    .filter((it) => it.id === g.id && it.service === selectedPieceService)
                    .reduce((sum, it) => sum + it.quantity, 0);

                  return (
                    <button
                      key={g.id}
                      type="button"
                      disabled={!isAvailable}
                      onClick={() => handleAddGarmentPiece(g)}
                      className={`pos-garment-card ${!isAvailable ? 'disabled' : ''} ${inCartCount > 0 ? 'in-cart' : ''}`}
                      title={!isAvailable ? `Not available for ${selectedPieceService}` : undefined}
                    >
                      {inCartCount > 0 && (
                        <span className="pos-garment-count-badge">
                          {inCartCount}
                        </span>
                      )}
                      <div className="pos-garment-info">
                        <strong className="pos-garment-name">
                          {g.name}
                        </strong>
                        <span className="pos-garment-category">
                          {g.category}
                        </span>
                      </div>
                      <div className="pos-garment-price-row">
                        {isAvailable ? (
                          <div className="pos-garment-price-wrap">
                            <strong className={`pos-garment-price ${selectedPieceService.startsWith('Club Fresh') ? 'club' : ''}`}>
                              ₹{servicePrice}
                            </strong>
                            {selectedPieceService.startsWith('Club Fresh') && (
                              <span className="pos-garment-club-tag">
                                CLUB
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="pos-garment-na">NA</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          ) : (
            /* ========================================================= */
            /* 2. WEIGHT MODE VIEW (Drying, DCG, Wash&Iron, Wash&Fold)  */
            /* ========================================================= */
            <div style={{ display: 'grid', gap: '20px' }}>
              {/* Service Banner */}
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                <div>
                  <span style={{ fontSize: '12px', color: '#1d4ed8', fontWeight: 700 }}>
                    Active Weight Service: {selectedWeightService}
                  </span>
                  <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#64748b' }}>
                    {currentWeightServiceObj.description}
                  </p>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '11px', color: '#64748b', display: 'block' }}>Base Rate</span>
                  <strong style={{ fontSize: '20px', color: '#1e40af' }}>
                    ₹{currentWeightServiceObj.ratePerKg} / kg
                  </strong>
                </div>
              </div>

              {/* 2 Primary Inputs: Weight (kg) & Number of Clothes */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Scale Weight in Kilograms (kg) *
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <Scale size={18} color="#2563eb" />
                    <input
                      type="number"
                      step="0.05"
                      min="0.1"
                      placeholder="e.g. 3.5"
                      value={weightKg}
                      onChange={(e) => setWeightKg(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', fontWeight: 700, width: '100%', color: '#1e293b' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>KG</span>
                  </div>
                </div>

                <div>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '6px' }}>
                    Number of Clothes (Piece Count)
                  </label>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '8px 12px', borderRadius: '8px', border: '1px solid #cbd5e1' }}>
                    <Shirt size={18} color="#2563eb" />
                    <input
                      type="number"
                      min="1"
                      placeholder="e.g. 12"
                      value={weightClothesCount}
                      onChange={(e) => setWeightClothesCount(e.target.value)}
                      style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '16px', fontWeight: 700, width: '100%', color: '#1e293b' }}
                    />
                    <span style={{ fontSize: '13px', fontWeight: 600, color: '#64748b' }}>PCS</span>
                  </div>
                </div>
              </div>

              {/* SECTION: ADD-ON SERVICES FOR WEIGHT BUNDLE */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Sparkles size={15} color="#16a34a" /> Add-on Services (Top-ups for Weight Order)
                    </strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Select top-ups or create new add-ons on the fly to save in DB
                    </span>
                  </div>

                  <button
                    type="button"
                    className="button button-quiet"
                    style={{ minHeight: '30px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setShowAddonPickerWeight(!showAddonPickerWeight)}
                  >
                    <Plus size={13} /> {showAddonPickerWeight ? 'Close Picker' : 'Add Top-up'}
                  </button>
                </div>

                {/* Active Selected Addons */}
                {weightAddons.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '10px' }}>
                    {weightAddons.map((wa) => (
                      <span
                        key={wa.id || wa.name}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#dcfce7',
                          border: '1px solid #86efac',
                          color: '#15803d',
                          padding: '4px 10px',
                          borderRadius: '16px',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {wa.name} (+₹{wa.price})
                        <button
                          type="button"
                          onClick={() => handleToggleWeightAddon(wa)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#dc2626' }}
                        >
                          <X size={13} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No add-on services selected for this weight bundle.
                  </p>
                )}

                {/* Addon Selector & Creator Dropdown */}
                {showAddonPickerWeight && (
                  <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, minWidth: '320px', background: '#fff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}>
                        <Search size={14} color="#94a3b8" />
                        <input
                          type="text"
                          placeholder="Type to search or create custom add-on..."
                          value={weightAddonSearch}
                          onChange={(e) => setWeightAddonSearch(e.target.value)}
                          style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '13px', width: '100%', color: '#1e293b' }}
                        />
                        {weightAddonSearch && (
                          <button
                            type="button"
                            onClick={() => setWeightAddonSearch('')}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                      {weightAddonSearch.trim() && !addons.some((a) => a.name.toLowerCase() === weightAddonSearch.trim().toLowerCase()) && (
                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <input
                            type="number"
                            placeholder="Price (₹)"
                            value={newAddonPriceWeight}
                            onChange={(e) => setNewAddonPriceWeight(e.target.value)}
                            style={{ width: '85px', padding: '6px 8px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                          />
                          <button
                            type="button"
                            className="button button-primary"
                            style={{ minHeight: '30px', fontSize: '11px', padding: '0 10px' }}
                            onClick={handleCreateWeightAddon}
                          >
                            Save & Add
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Addons Pills */}
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '100px', overflowY: 'auto' }}>
                      {addons
                        .filter((a) => a.name.toLowerCase().includes(weightAddonSearch.trim().toLowerCase()))
                        .map((addon) => {
                          const isSelected = weightAddons.some((wa) => wa.id === addon.id || wa.name === addon.name);
                          return (
                            <button
                              key={addon.id}
                              type="button"
                              onClick={() => handleToggleWeightAddon(addon)}
                              style={{
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '11px',
                                cursor: 'pointer',
                                border: isSelected ? '1px solid #16a34a' : '1px solid #e2e8f0',
                                background: isSelected ? '#dcfce7' : '#fff',
                                color: isSelected ? '#15803d' : '#334155',
                                fontWeight: isSelected ? 700 : 500,
                              }}
                            >
                              {isSelected ? '✓ ' : '+ '}{addon.name} (₹{addon.price})
                            </button>
                          );
                        })}
                    </div>
                  </div>
                )}
              </div>

              {/* SECTION: GARMENT DETAILS BREAKDOWN (ALL CLOTHES IN CATALOG) */}
              <div style={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '16px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', flexWrap: 'wrap', gap: '8px' }}>
                  <div>
                    <strong style={{ fontSize: '13px', color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Shirt size={15} color="#2563eb" /> Garment Details (Itemized Clothes in Bag)
                    </strong>
                    <span style={{ fontSize: '11px', color: '#64748b' }}>
                      Optionally record the individual clothes included in this weight bundle
                    </span>
                  </div>

                  <button
                    type="button"
                    className="button button-quiet"
                    style={{ minHeight: '30px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    onClick={() => setShowWeightGarmentList(!showWeightGarmentList)}
                  >
                    {showWeightGarmentList ? 'Hide Clothes Catalog' : 'Show All Clothes Catalog'}
                  </button>
                </div>

                {/* Current Breakdown Chips */}
                {weightGarments.length > 0 ? (
                  <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '12px' }}>
                    {weightGarments.map((wg) => (
                      <span
                        key={wg.id}
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          gap: '6px',
                          background: '#eff6ff',
                          border: '1px solid #bfdbfe',
                          color: '#1d4ed8',
                          padding: '4px 10px',
                          borderRadius: '6px',
                          fontSize: '12px',
                          fontWeight: 700,
                        }}
                      >
                        {wg.name} × {wg.quantity}
                        <button
                          type="button"
                          onClick={() => handleUpdateWeightGarmentQty(wg.id, 1)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#1d4ed8' }}
                          title="Add one more"
                        >
                          <Plus size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleUpdateWeightGarmentQty(wg.id, -1)}
                          style={{ border: 'none', background: 'none', cursor: 'pointer', padding: 0, color: '#dc2626' }}
                          title="Remove one"
                        >
                          <Minus size={12} />
                        </button>
                      </span>
                    ))}
                  </div>
                ) : (
                  <p style={{ margin: '0 0 10px', fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                    No individual clothes added to breakdown yet. Click "Show All Clothes Catalog" below to itemize.
                  </p>
                )}

                {/* Expandable Garment Catalog Picker */}
                {showWeightGarmentList && (
                  <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                      <div style={{ display: 'flex', gap: '5px', flexWrap: 'wrap' }}>
                        {categories.map((cat) => (
                          <button
                            key={cat}
                            type="button"
                            onClick={() => setWeightGarmentCategory(cat)}
                            style={{
                              padding: '4px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              cursor: 'pointer',
                              border: weightGarmentCategory === cat ? '1px solid #2563eb' : '1px solid #e2e8f0',
                              background: weightGarmentCategory === cat ? '#2563eb' : '#fff',
                              color: weightGarmentCategory === cat ? '#fff' : '#475569',
                              fontWeight: 600,
                            }}
                          >
                            {cat}
                          </button>
                        ))}
                      </div>

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fff', padding: '6px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', width: '300px', minWidth: '220px' }}>
                        <Search size={14} color="#94a3b8" />
                        <input
                          type="text"
                          placeholder="Search clothes in bag..."
                          value={weightGarmentSearch}
                          onChange={(e) => setWeightGarmentSearch(e.target.value)}
                          style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', width: '100%', color: '#1e293b' }}
                        />
                        {weightGarmentSearch && (
                          <button
                            type="button"
                            onClick={() => setWeightGarmentSearch('')}
                            style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#94a3b8', padding: 0, display: 'flex' }}
                          >
                            <X size={13} />
                          </button>
                        )}
                      </div>
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', alignContent: 'start', gridAutoRows: 'max-content', gap: '8px', maxHeight: '200px', overflowY: 'auto' }}>
                      {filteredWeightGarments.map((g) => {
                        const inBag = weightGarments.find((it) => it.id === g.id)?.quantity || 0;
                        return (
                          <button
                            key={g.id}
                            type="button"
                            onClick={() => handleAddWeightGarment(g)}
                            style={{
                              padding: '8px 10px',
                              borderRadius: '6px',
                              fontSize: '11px',
                              textAlign: 'left',
                              cursor: 'pointer',
                              border: inBag > 0 ? '1.5px solid #2563eb' : '1px solid #e2e8f0',
                              background: inBag > 0 ? '#eff6ff' : '#fff',
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                            }}
                          >
                            <div>
                              <strong style={{ display: 'block', color: '#1e293b' }}>{g.name}</strong>
                              <small style={{ color: '#64748b' }}>{g.category}</small>
                            </div>
                            <span style={{ fontWeight: 700, color: inBag > 0 ? '#2563eb' : '#94a3b8' }}>
                              {inBag > 0 ? `×${inBag}` : '+'}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>

              {/* Bundle Special Instruction Note */}
              <div>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                  Weight Bundle Note / Bag Identifier
                </label>
                <input
                  type="text"
                  placeholder="e.g. Blue bag #4, whites only, delicate cycle..."
                  value={weightNote}
                  onChange={(e) => setWeightNote(e.target.value)}
                  style={{ width: '100%', padding: '8px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
                />
              </div>
            </div>
          )}
        </div>

        {/* RIGHT COLUMN: LIVE CART TICKET & CHECKOUT */}
        <div
          id="pos-ticket-panel"
          className={`pos-column-ticket ${mobilePosTab === 'catalog' ? 'hidden-mobile' : ''}`}
        >
          {/* Mobile Top Quick Checkout Action Card (Visible at TOP on Mobile Screens) */}
          <div className="pos-mobile-top-checkout-card">
            <div className="pos-mobile-top-checkout-header">
              <div style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
                <span className="pos-mobile-top-checkout-sub">
                  {orderType === 'pieces'
                    ? `${cartItems.reduce((s, it) => s + it.quantity, 0)} Items · ${currentCustomer ? currentCustomer.name : 'Walk-in Customer'}`
                    : `${weightKg || 0} kg Bundle · ${currentCustomer ? currentCustomer.name : 'Walk-in Customer'}`}
                </span>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
                  <span style={{ fontSize: '12px', opacity: 0.8 }}>Total Bill:</span>
                  <strong className="pos-mobile-top-checkout-total">
                    {formatMoney(grandTotal)}
                  </strong>
                </div>
              </div>

              <button
                type="button"
                className="button button-quiet"
                style={{
                  minHeight: '34px',
                  fontSize: '11px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '4px',
                  padding: '4px 10px',
                  borderRadius: '6px',
                  border: '1px solid #cbd5e1',
                  flexShrink: 0,
                }}
                onClick={() => handleSwitchTab('catalog')}
              >
                <Shirt size={13} /> + Add Clothes
              </button>
            </div>

            {currentCustomer?.walletBalance > 0 && (
              <div className="pos-mobile-top-wallet-badge">
                <Wallet size={12} style={{ flexShrink: 0 }} />
                <span>
                  Wallet credit {formatMoney(Math.min(currentCustomer.walletBalance, grandTotal))} will auto-deduct
                </span>
              </div>
            )}

            {/* Quick 1-Tap Place Order Button at TOP on Mobile */}
            <button
              type="button"
              className="button button-primary pos-mobile-top-place-btn"
              disabled={submitting || (orderType === 'pieces' ? cartItems.length === 0 : !(Number(weightKg) > 0))}
              onClick={handlePlaceOrder}
            >
              {currentCustomer?.walletBalance >= grandTotal ? (
                <>
                  <Wallet size={16} style={{ flexShrink: 0 }} />
                  <span>{submitting ? 'Placing Order...' : `Place Order & Pay with Wallet (${formatMoney(grandTotal)})`}</span>
                </>
              ) : currentCustomer?.walletBalance > 0 ? (
                <>
                  <Wallet size={16} style={{ flexShrink: 0 }} />
                  <span>{submitting ? 'Placing Order...' : `Place Order (Auto-deduct ${formatMoney(currentCustomer.walletBalance)})`}</span>
                </>
              ) : (
                <>
                  <ReceiptText size={16} style={{ flexShrink: 0 }} />
                  <span>{submitting ? 'Placing Order...' : `Place Order Now · ${formatMoney(grandTotal)}`}</span>
                </>
              )}
            </button>
          </div>

          {/* Ticket Header */}
          <div style={{ paddingBottom: '12px', borderBottom: '1px solid #f1f5f9', minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px' }}>
              <span className="caption-label">Counter Ticket</span>
              <span style={{ fontSize: '11px', fontWeight: 700, color: '#2563eb', background: '#eff6ff', padding: '2px 8px', borderRadius: '6px', flexShrink: 0 }}>
                {orderType === 'weight' ? `WEIGHT · ${selectedWeightService}` : `PIECES · ${selectedPieceService}`}
              </span>
            </div>
            <h3 style={{ margin: '4px 0 0', fontSize: '16px', color: '#1e293b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {currentCustomer ? currentCustomer.name : 'Walk-in Customer'}
            </h3>
            <small style={{ color: '#64748b' }}>
              📞 +91 {currentCustomer?.mobile || '—'} · Wallet: ₹{currentCustomer?.walletBalance || 0}
            </small>

            {/* Editable Order Number Control */}
            <div
              style={{
                marginTop: '10px',
                background: isDuplicateOrderNo ? '#fff1f2' : hasManuallyEditedOrderNo ? '#eff6ff' : '#f8fafc',
                padding: '8px 10px',
                borderRadius: '8px',
                border: isDuplicateOrderNo ? '1.5px solid #fca5a5' : hasManuallyEditedOrderNo ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                display: 'grid',
                gap: '5px',
                minWidth: 0,
                width: '100%',
                boxSizing: 'border-box',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px', minWidth: 0 }}>
                <label
                  htmlFor="pos-order-no-input"
                  style={{
                    fontSize: '11.5px',
                    fontWeight: 700,
                    color: isDuplicateOrderNo ? '#b91c1c' : '#334155',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    minWidth: 0,
                  }}
                >
                  <ReceiptText size={13} color={isDuplicateOrderNo ? '#ef4444' : '#2563eb'} style={{ flexShrink: 0 }} />
                  <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Order Number</span>
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '5px', flexShrink: 0 }}>
                  {hasManuallyEditedOrderNo && (
                    <button
                      type="button"
                      onClick={() => {
                        setCustomOrderNo(defaultNextOrderNo);
                        setHasManuallyEditedOrderNo(false);
                      }}
                      style={{
                        border: 'none',
                        background: 'transparent',
                        color: '#64748b',
                        fontSize: '10px',
                        cursor: 'pointer',
                        padding: 0,
                        display: 'flex',
                        alignItems: 'center',
                        gap: '2px',
                        textDecoration: 'underline',
                      }}
                      title="Reset to default sequence"
                    >
                      <RotateCcw size={10} /> Reset
                    </button>
                  )}
                  <span
                    style={{
                      fontSize: '10px',
                      fontWeight: 700,
                      color: isDuplicateOrderNo ? '#b91c1c' : hasManuallyEditedOrderNo ? '#1d4ed8' : '#15803d',
                      background: isDuplicateOrderNo ? '#fee2e2' : hasManuallyEditedOrderNo ? '#dbeafe' : '#dcfce7',
                      padding: '1px 6px',
                      borderRadius: '4px',
                      flexShrink: 0,
                    }}
                  >
                    {isDuplicateOrderNo ? 'Duplicate' : hasManuallyEditedOrderNo ? 'Customized' : 'Auto Sequence'}
                  </span>
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '6px',
                  background: '#fff',
                  border: isDuplicateOrderNo ? '1.5px solid #ef4444' : hasManuallyEditedOrderNo ? '1.5px solid #2563eb' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  padding: '5px 8px',
                  width: '100%',
                  boxSizing: 'border-box',
                  minWidth: 0,
                }}
              >
                <input
                  id="pos-order-no-input"
                  type="text"
                  value={customOrderNo}
                  onChange={(e) => {
                    setCustomOrderNo(e.target.value);
                    setHasManuallyEditedOrderNo(true);
                  }}
                  placeholder="e.g. #w123 or B6164"
                  title="Edit order number (subsequent orders will automatically increment from this)"
                  style={{
                    border: 'none',
                    background: 'transparent',
                    outline: 'none',
                    fontSize: '13px',
                    fontWeight: 700,
                    color: '#0f172a',
                    width: '100%',
                    minWidth: 0,
                    fontFamily: 'monospace',
                    letterSpacing: '0.4px',
                  }}
                />
                <Edit3 size={13} color={hasManuallyEditedOrderNo ? '#2563eb' : '#94a3b8'} style={{ flexShrink: 0 }} />
              </div>

              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', minWidth: 0 }}>
                <span
                  style={{
                    fontSize: '10px',
                    color: isDuplicateOrderNo ? '#b91c1c' : '#64748b',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    lineHeight: 1.2,
                  }}
                >
                  {isDuplicateOrderNo
                    ? '⚠️ Order number already exists in records.'
                    : `Next order will be ${getNextOrderNo(customOrderNo || defaultNextOrderNo)}`}
                </span>
              </div>
            </div>
          </div>

          {/* Active Package Discount Banner */}
          {bestDiscount && bestDiscount.discountAmount > 0 ? (
            <div style={{ background: '#ecfdf5', border: '1px solid #a7f3d0', borderRadius: '8px', padding: '10px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#065f46', minWidth: 0 }}>
              <Sparkles size={16} color="#059669" style={{ flexShrink: 0 }} />
              <div style={{ minWidth: 0 }}>
                <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{bestDiscount.discountName} Applied</strong>
                <span style={{ display: 'block', fontSize: '11px', color: '#047857', wordBreak: 'break-word' }}>
                  {bestDiscount.explanation}
                </span>
              </div>
            </div>
          ) : (
            customerActivePackages.length > 0 && allEvaluations.length > 0 && (
              <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: '8px', padding: '8px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '11px', color: '#1e40af', minWidth: 0 }}>
                <Tag size={14} color="#2563eb" style={{ flexShrink: 0 }} />
                <div style={{ minWidth: 0 }}>
                  <strong style={{ display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Package: {allEvaluations[0]?.package?.name}</strong>
                  <span style={{ display: 'block', fontSize: '10px', color: '#1d4ed8', marginTop: '2px', wordBreak: 'break-word' }}>
                    {allEvaluations[0]?.explanation || allEvaluations[0]?.reason}
                  </span>
                </div>
              </div>
            )
          )}

          {/* Items / Bundle Summary List */}
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', gap: '8px' }}>
              <span style={{ fontSize: '12px', fontWeight: 700, color: '#475569', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {orderType === 'pieces' ? `Order Garments (${cartItems.length})` : 'Weight Laundry Bundle'}
              </span>
              {orderType === 'pieces' && cartItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => setCartItems([])}
                  style={{ border: 'none', background: 'none', color: '#ef4444', fontSize: '11px', cursor: 'pointer', padding: 0, flexShrink: 0 }}
                >
                  Clear Cart
                </button>
              )}
            </div>

            {orderType === 'pieces' ? (
              <div style={{ maxHeight: '260px', overflowY: 'auto', overflowX: 'hidden', WebkitOverflowScrolling: 'touch', display: 'grid', gap: '8px', minWidth: 0 }}>
                {cartItems.length === 0 ? (
                  <div style={{ padding: '24px 10px', textAlign: 'center', color: '#94a3b8', fontSize: '12px', border: '1px dashed #e2e8f0', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
                    Select garments from the catalog on the left
                  </div>
                ) : (
                  cartItems.map((item, idx) => {
                    const addonSum = (item.addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
                    const lineUnitPrice = item.unitPrice + addonSum;
                    return (
                      <div
                        key={idx}
                        style={{
                          padding: '10px',
                          background: '#f8fafc',
                          border: '1px solid #e2e8f0',
                          borderRadius: '8px',
                          display: 'grid',
                          gap: '6px',
                          minWidth: 0,
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <strong style={{ fontSize: '13px', display: 'block', color: '#1e293b', wordBreak: 'break-word' }}>{item.name}</strong>
                            <span style={{ fontSize: '11px', color: '#64748b', wordBreak: 'break-word', display: 'block' }}>
                              {item.service} · {formatMoney(lineUnitPrice)} ea
                              {addonSum > 0 && <span style={{ color: '#16a34a' }}> (+₹{addonSum})</span>}
                            </span>
                          </div>

                          <div style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0 }}>
                            <button
                              type="button"
                              className="icon-button"
                              style={{ width: '22px', height: '22px' }}
                              onClick={() => handleUpdateQty(idx, -1)}
                            >
                              <Minus size={12} />
                            </button>
                            <span style={{ fontSize: '12px', fontWeight: 700, minWidth: '18px', textAlign: 'center' }}>
                              {item.quantity}
                            </span>
                            <button
                              type="button"
                              className="icon-button"
                              style={{ width: '22px', height: '22px' }}
                              onClick={() => handleUpdateQty(idx, 1)}
                            >
                              <Plus size={12} />
                            </button>
                            <button
                              type="button"
                              className="icon-button"
                              style={{ width: '22px', height: '22px', color: '#ef4444', marginLeft: '2px' }}
                              onClick={() => handleRemoveItem(idx)}
                            >
                              <Trash2 size={12} />
                            </button>
                          </div>
                        </div>

                        {/* Tag Chips (Brand, Color, Defects, Add-ons) */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', alignItems: 'center' }}>
                          {bestDiscount?.qualifyingItems?.some((qi) => qi.id === item.id) && (
                            <span style={{ fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#166534', padding: '1px 6px', borderRadius: '4px' }}>
                              ✨ Offer Eligible
                            </span>
                          )}
                          {item.brand && (
                            <span style={{ fontSize: '10px', fontWeight: 700, background: '#eff6ff', color: '#1e40af', padding: '1px 6px', borderRadius: '4px' }}>
                              🏷️ {item.brand}
                            </span>
                          )}
                          {item.color && (
                            <span style={{ fontSize: '10px', fontWeight: 700, background: '#e0f2fe', color: '#0369a1', padding: '1px 6px', borderRadius: '4px' }}>
                              🎨 {item.color}
                            </span>
                          )}
                          {(item.defects || []).map((d) => (
                            <span key={d} style={{ fontSize: '10px', fontWeight: 600, background: '#fee2e2', color: '#b91c1c', padding: '1px 6px', borderRadius: '4px' }}>
                              ⚠️ {d}
                            </span>
                          ))}
                          {(item.addons || []).map((a) => (
                            <span key={a.id || a.name} style={{ fontSize: '10px', fontWeight: 700, background: '#dcfce7', color: '#15803d', padding: '1px 6px', borderRadius: '4px' }}>
                              ⭐ {a.name} (+₹{a.price})
                            </span>
                          ))}

                          {/* Quick Tag Button */}
                          <button
                            type="button"
                            onClick={() => setTaggingItemIndex(idx)}
                            style={{
                              border: '1px solid #cbd5e1',
                              background: '#f8fafc',
                              fontSize: '11px',
                              fontWeight: 600,
                              color: '#334155',
                              padding: '4px 10px',
                              borderRadius: '6px',
                              cursor: 'pointer',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '5px',
                              transition: 'all 0.15s ease',
                            }}
                          >
                            <Sparkles size={12} color="#2563eb" />
                            {item.brand || item.color || item.addons?.length || item.defects?.length
                              ? 'Edit Add-ons & Tags'
                              : '+ Add-on Services, Brand, Color & Defects'}
                          </button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            ) : (
              /* Weight Order Bundle Live Summary */
              <div style={{ padding: '12px', background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'grid', gap: '8px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Weight Laundry Service:</span>
                  <strong style={{ fontSize: '12px', color: '#1e293b' }}>{selectedWeightService}</strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Recorded Scale Weight:</span>
                  <strong style={{ fontSize: '13px', color: '#2563eb' }}>
                    {weightKg ? `${weightKg} kg @ ₹${currentWeightServiceObj.ratePerKg}/kg` : '0 kg'}
                  </strong>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontSize: '12px', color: '#64748b' }}>Clothes Count:</span>
                  <strong style={{ fontSize: '12px', color: '#1e293b' }}>
                    {weightClothesCount ? `${weightClothesCount} Clothes` : '—'}
                  </strong>
                </div>

                {weightGarments.length > 0 && (
                  <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                    <small style={{ fontSize: '11px', color: '#64748b', display: 'block', marginBottom: '3px' }}>
                      Clothes Breakdown:
                    </small>
                    <span style={{ fontSize: '11px', color: '#334155', fontWeight: 600 }}>
                      {weightGarments.map((g) => `${g.name} × ${g.quantity}`).join(', ')}
                    </span>
                  </div>
                )}

                {weightAddons.length > 0 && (
                  <div style={{ borderTop: '1px dashed #e2e8f0', paddingTop: '6px' }}>
                    <small style={{ fontSize: '11px', color: '#15803d', display: 'block', marginBottom: '3px' }}>
                      Top-up Services:
                    </small>
                    <span style={{ fontSize: '11px', color: '#166534', fontWeight: 600 }}>
                      {weightAddons.map((a) => `${a.name} (+₹${a.price})`).join(', ')}
                    </span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Promised Due Date & Delivery Turnaround Options */}
          <div style={{ display: 'grid', gap: '10px', minWidth: 0, width: '100%' }}>
            <div style={{ minWidth: 0, width: '100%' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '5px' }}>
                Promised Ready Date
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#f8fafc', padding: '6px 12px', borderRadius: '8px', border: '1px solid #cbd5e1', width: '100%', boxSizing: 'border-box', minWidth: 0 }}>
                <CalendarDays size={16} color="#64748b" style={{ flexShrink: 0 }} />
                <input
                  type="date"
                  value={dueDate}
                  onChange={(e) => setDueDate(e.target.value)}
                  style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '12px', fontWeight: 600, color: '#1e293b', width: '100%', minWidth: 0 }}
                />
              </div>
            </div>

            {/* Early Delivery Turnaround Speed Pills */}
            {settings?.expressDeliveryEnabled !== false && (
              <div style={{ minWidth: 0, width: '100%' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', minWidth: 0, gap: '6px' }}>
                  <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0 }}>
                    <Clock size={14} color="#d97706" style={{ flexShrink: 0 }} />
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Delivery Turnaround</span>
                  </label>
                  {expressPercent > 0 && (
                    <span style={{ fontSize: '10px', color: '#b45309', fontWeight: 700, background: '#fef3c7', padding: '1px 6px', borderRadius: '4px', flexShrink: 0 }}>
                      +{expressPercent}% Early
                    </span>
                  )}
                </div>

                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '6px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                  {expressOptions.map((opt) => {
                    const isSelected = selectedExpressId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectExpress(opt.id)}
                        style={{
                          padding: '6px 8px',
                          borderRadius: '6px',
                          border: isSelected ? '2px solid #d97706' : '1px solid #cbd5e1',
                          background: isSelected ? '#fffbeb' : '#ffffff',
                          color: isSelected ? '#92400e' : '#334155',
                          fontSize: '11px',
                          fontWeight: isSelected ? 700 : 500,
                          textAlign: 'left',
                          cursor: 'pointer',
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '2px',
                          width: '100%',
                          minWidth: 0,
                          boxSizing: 'border-box',
                          overflow: 'hidden',
                          transition: 'all 0.15s ease',
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', minWidth: 0, gap: '4px' }}>
                          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }} title={opt.label}>
                            {opt.label}
                          </span>
                          {isSelected && <Check size={12} color="#d97706" style={{ flexShrink: 0 }} />}
                        </div>
                        <span style={{ fontSize: '10px', color: isSelected ? '#b45309' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, display: 'block' }}>
                          {opt.percent > 0 ? `+${opt.percent}% Surcharge` : 'Standard'}
                        </span>
                      </button>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setSelectedExpressId('custom')}
                    style={{
                      padding: '6px 8px',
                      borderRadius: '6px',
                      border: selectedExpressId === 'custom' ? '2px solid #d97706' : '1px solid #cbd5e1',
                      background: selectedExpressId === 'custom' ? '#fffbeb' : '#ffffff',
                      color: selectedExpressId === 'custom' ? '#92400e' : '#334155',
                      fontSize: '11px',
                      fontWeight: selectedExpressId === 'custom' ? 700 : 500,
                      textAlign: 'left',
                      cursor: 'pointer',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '2px',
                      width: '100%',
                      minWidth: 0,
                      boxSizing: 'border-box',
                      overflow: 'hidden',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', minWidth: 0, gap: '4px' }}>
                      <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, flex: 1 }}>Custom Early %</span>
                      {selectedExpressId === 'custom' && <Check size={12} color="#d97706" style={{ flexShrink: 0 }} />}
                    </div>
                    <span style={{ fontSize: '10px', color: selectedExpressId === 'custom' ? '#b45309' : '#64748b', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, display: 'block' }}>
                      Enter custom %
                    </span>
                  </button>
                </div>

                {selectedExpressId === 'custom' && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: '#fffbeb', border: '1px solid #fde68a', padding: '6px 10px', borderRadius: '6px', marginTop: '6px', width: '100%', minWidth: 0, boxSizing: 'border-box' }}>
                    <span style={{ fontSize: '11px', fontWeight: 600, color: '#92400e', whiteSpace: 'nowrap', flexShrink: 0 }}>Custom Surcharge:</span>
                    <input
                      type="number"
                      min="1"
                      max="100"
                      placeholder="25"
                      value={customExpressPercent}
                      onChange={(e) => setCustomExpressPercent(e.target.value)}
                      style={{ width: '60px', minWidth: 0, padding: '2px 6px', fontSize: '12px', fontWeight: 700, borderRadius: '4px', border: '1px solid #d97706', textAlign: 'center', boxSizing: 'border-box' }}
                    />
                    <span style={{ fontSize: '11px', fontWeight: 700, color: '#92400e', flexShrink: 0 }}>%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Pricing & Tax Summary Breakdown */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '12px', display: 'grid', gap: '6px', minWidth: 0, width: '100%' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', minWidth: 0 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Gross Subtotal:</span>
              <span style={{ flexShrink: 0, fontWeight: 600 }}>{formatMoney(grossAmount)}</span>
            </div>

            {discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#059669', fontWeight: 600, minWidth: 0 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Package Discount ({discountPercent}%):</span>
                <span style={{ flexShrink: 0 }}>-{formatMoney(discountAmount)}</span>
              </div>
            )}

            {expressAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#b45309', fontWeight: 600, minWidth: 0 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  ⚡ {selectedExpressId === 'custom' ? 'Custom Early Delivery' : activeExpressOption?.label} (+{expressPercent}%):
                </span>
                <span style={{ flexShrink: 0 }}>+{formatMoney(expressAmount)}</span>
              </div>
            )}

            {taxEnabled && (
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '12px', color: '#64748b', minWidth: 0 }}>
                <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{settings?.taxLabel || 'GST'} ({taxPercent}%):</span>
                <span style={{ flexShrink: 0, fontWeight: 600 }}>+{formatMoney(taxAmount)}</span>
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', fontSize: '16px', fontWeight: 800, color: '#1e293b', paddingTop: '6px', borderTop: '1px solid #e2e8f0', minWidth: 0 }}>
              <span style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>Total Bill:</span>
              <span style={{ flexShrink: 0, color: '#0f172a' }}>{formatMoney(grandTotal)}</span>
            </div>

            {currentCustomer?.walletBalance > 0 && (
              <div
                style={{
                  background: '#f0fdf4',
                  border: '1px solid #bbf7d0',
                  borderRadius: '8px',
                  padding: '8px 12px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '4px',
                  fontSize: '11px',
                  minWidth: 0,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '8px', color: '#15803d', fontWeight: 700, minWidth: 0 }}>
                  <span style={{ display: 'flex', alignItems: 'center', gap: '4px', minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    <Wallet size={13} style={{ flexShrink: 0 }} /> Package Wallet Credit:
                  </span>
                  <span style={{ flexShrink: 0 }}>{formatMoney(currentCustomer.walletBalance)}</span>
                </div>
                <div style={{ color: '#166534', fontSize: '10.5px', lineHeight: 1.35, wordBreak: 'break-word' }}>
                  {currentCustomer.walletBalance >= grandTotal ? (
                    <span>✓ Bill will be automatically deducted in full from wallet credits upon order placement. (Remaining balance: ₹0.00)</span>
                  ) : (
                    <span>✓ {formatMoney(currentCustomer.walletBalance)} will auto-deduct. Remaining {formatMoney(grandTotal - currentCustomer.walletBalance)} due at delivery.</span>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* 1-Click Checkout Button */}
          <button
            type="button"
            className="button button-primary"
            style={{ width: '100%', maxWidth: '100%', minWidth: 0, minHeight: '46px', fontSize: '13.5px', fontWeight: 700, display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px', padding: '10px 14px', whiteSpace: 'normal', wordBreak: 'break-word', boxSizing: 'border-box' }}
            disabled={submitting || (orderType === 'pieces' ? cartItems.length === 0 : !(Number(weightKg) > 0))}
            onClick={handlePlaceOrder}
          >
            {currentCustomer?.walletBalance >= grandTotal ? (
              <>
                <Wallet size={18} style={{ flexShrink: 0 }} />
                <span>{submitting ? 'Placing Order...' : `Place Order & Pay with Wallet (${formatMoney(grandTotal)})`}</span>
              </>
            ) : currentCustomer?.walletBalance > 0 ? (
              <>
                <Wallet size={18} style={{ flexShrink: 0 }} />
                <span>{submitting ? 'Placing Order...' : `Place Order (Auto-deduct ${formatMoney(currentCustomer.walletBalance)})`}</span>
              </>
            ) : (
              <>
                <ReceiptText size={18} style={{ flexShrink: 0 }} />
                <span>{submitting ? 'Placing Order...' : `Checkout · ${formatMoney(grandTotal)}`}</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Mobile Sticky Quick Order Action Bar */}
      {mobilePosTab === 'catalog' && ((orderType === 'pieces' && cartItems.length > 0) || (orderType === 'weight' && Number(weightKg) > 0)) && (
        <div className="mobile-cart-float-bar">
          <div style={{ display: 'grid', gap: '2px', minWidth: 0 }}>
            <span style={{ fontSize: '11px', color: '#94a3b8' }}>
              {orderType === 'pieces' ? `${cartItems.reduce((s, it) => s + it.quantity, 0)} Garments in Ticket` : `${weightKg} kg Bundle`}
            </span>
            <strong style={{ fontSize: '15px', color: '#ffffff' }}>
              {formatMoney(grandTotal)}
            </strong>
          </div>
          <button
            type="button"
            className="btn-checkout"
            onClick={() => handleSwitchTab('ticket')}
          >
            Review & Place Order →
          </button>
        </div>
      )}

      {/* Item Tagging Modal for Piece Cart Items */}
      {taggingItemIndex !== null && (
        <ItemTagModal
          key={taggingItemIndex}
          isOpen={taggingItemIndex !== null}
          onClose={() => setTaggingItemIndex(null)}
          item={cartItems[taggingItemIndex]}
          brands={brands}
          colors={colors}
          defects={defects}
          addons={addons}
          onSaveBrand={onSaveBrand}
          onSaveColor={onSaveColor}
          onSaveDefect={onSaveDefect}
          onSaveAddon={onSaveAddon}
          onUpdateItem={(updatedItem) => {
            setCartItems((prev) => prev.map((it, i) => (i === taggingItemIndex ? updatedItem : it)));
          }}
          onToast={onToast}
        />
      )}
    </div>
  );
}
