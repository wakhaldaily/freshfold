import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  UserPlus,
  UserCheck,
  X,
  Search,
  User,
  Phone,
  Mail,
  MapPin,
  Trash2,
  Save,
  Tag,
  ShieldCheck,
  Building2,
  FileText,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  MessageSquare,
  Package,
  Percent,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import CustomSelect from './CustomSelect.jsx';
import { formatMoney } from '../lib/persistence.js';
import { INDIAN_STATES } from '../data.js';

export { INDIAN_STATES };

const PREFERENCE_OPTIONS = [
  { value: 'NA', label: 'Standard Clean & Fold' },
  { value: 'Folded', label: 'Folded (Travel Pack)' },
  { value: 'Hanger', label: 'Hanger (Steam Pressed)' },
  { value: 'Light Starch', label: 'Light Starch (Crisp Shirts)' },
  { value: 'Heavy Starch', label: 'Heavy Starch (Traditional)' },
  { value: 'Fragrance Free', label: 'Fragrance Free (Sensitive Skin)' },
  { value: 'Fabric Softener', label: 'Fabric Softener Added' },
  { value: 'Delicate Hand Wash', label: 'Delicate Hand Wash' },
  { value: 'Separate Machine Wash', label: 'Separate Machine Wash (Solo Load)' },
];

const COMM_PREFERENCES = [
  { value: 'WhatsApp & SMS', label: 'WhatsApp & SMS (Recommended)' },
  { value: 'WhatsApp Only', label: 'WhatsApp Only' },
  { value: 'SMS Only', label: 'SMS Only' },
  { value: 'Email Only', label: 'Email Only' },
  { value: 'None', label: 'Do Not Send Automated Alerts' },
];

const RATE_LIST_OPTIONS = [
  { value: 'Default', label: 'Default Retail Rates' },
  { value: 'Premium Care', label: 'Premium Care Tier (+15%)' },
  { value: 'Corporate / B2B', label: 'Corporate / B2B Contract' },
  { value: 'Student Discount', label: 'Student / Campus Discount' },
];

const SALUTATIONS = ['Mr.', 'Mrs.', 'Ms.', 'Dr.', 'Prof.', 'M/s.'];

// Keep only the 10-digit local number; tolerates pasted "+91 98765 43210" or "098765 43210".
function normalizeMobile(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (digits.length > 10 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length > 10 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.slice(0, 10);
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

export default function CustomerModal({
  isOpen,
  onClose,
  customer = null, // null for new, object for edit
  allCustomers = [],
  customerPackages = [],
  onDeleteCustomerPackage,
  onSave,
  onDelete,
  onToast,
}) {
  const [activeCustomer, setActiveCustomer] = useState(customer);
  const [searchQuery, setSearchQuery] = useState('');
  const [showSearchResults, setShowSearchResults] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const searchContainerRef = useRef(null);

  const enrolledPackages = useMemo(() => {
    if (!activeCustomer?.id) return [];
    return (customerPackages || []).filter((cp) => cp.customerId === activeCustomer.id);
  }, [customerPackages, activeCustomer]);

  const getInitialForm = (target) => ({
    customerCode: target?.customerCode || target?.code || `CUST-${1000 + (allCustomers?.length || 0) + 1}`,
    salutation: target?.salutation || 'Mr.',
    name: target?.name || '',
    address: target?.address || '',
    areaLocation: target?.areaLocation || target?.locality || '',
    state: target?.state || 'Haryana',
    pinCode: target?.pinCode || target?.pincode || '',
    mobile: normalizeMobile(target?.mobile),
    email: target?.email || '',
    preference: target?.preference || 'NA',
    discountPercent:
      target?.discountPercent !== undefined && target?.discountPercent !== null
        ? String(target.discountPercent)
        : '',
    commPreference: target?.commPreference || 'WhatsApp & SMS',
    rateList: target?.rateList || 'Default',
    gstin: target?.gstin || target?.customerGstin || '',
    referralCode: target?.referralCode || '',
    notes: target?.notes || '',
  });

  const [formData, setFormData] = useState(() => getInitialForm(customer));

  // Functional update so rapid edits never overwrite each other with stale state.
  const updateField = (key, value) => setFormData((prev) => ({ ...prev, [key]: value }));



  // Sync when prop customer changes
  useEffect(() => {
    setActiveCustomer(customer);
    setFormData(getInitialForm(customer));
    setConfirmDelete(false);
    setSearchQuery('');
    setShowSearchResults(false);
  }, [customer, isOpen]);

  // Handle outside click for search dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target)) {
        setShowSearchResults(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === 'Escape' && isOpen) {
        if (confirmDelete) {
          setConfirmDelete(false);
        } else {
          onClose();
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, confirmDelete, onClose]);

  // Filtered search results
  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    const q = searchQuery.trim().toLowerCase();
    return (allCustomers || []).filter(
      (c) =>
        c.name?.toLowerCase().includes(q) ||
        c.mobile?.includes(q) ||
        c.customerCode?.toLowerCase().includes(q) ||
        c.email?.toLowerCase().includes(q)
    );
  }, [searchQuery, allCustomers]);

  if (!isOpen) return null;

  const handleSelectCustomer = (c) => {
    setActiveCustomer(c);
    setFormData(getInitialForm(c));
    setSearchQuery('');
    setShowSearchResults(false);
    setConfirmDelete(false);
    onToast?.(`Loaded profile for ${c.name}`);
  };

  const handleResetToNew = () => {
    setActiveCustomer(null);
    setFormData(getInitialForm(null));
    setSearchQuery('');
    setShowSearchResults(false);
    setConfirmDelete(false);
    onToast?.('Switched to new customer registration form');
  };

  const handleSubmit = async (e) => {
    e?.preventDefault?.();
    const cleanMobile = normalizeMobile(formData.mobile);
    const email = formData.email.trim();
    const pinCode = formData.pinCode.trim();
    const gstin = formData.gstin.trim().toUpperCase();
    const discount = formData.discountPercent === '' ? 0 : Number(formData.discountPercent);

    if (!formData.name.trim()) {
      onToast?.('Customer name is required.');
      return;
    }
    if (cleanMobile.length !== 10) {
      onToast?.('Enter a valid 10-digit mobile number.');
      return;
    }
    if (email && !EMAIL_PATTERN.test(email)) {
      onToast?.('Enter a valid email address or leave it blank.');
      return;
    }
    if (pinCode && !/^\d{6}$/.test(pinCode)) {
      onToast?.('Pin code must be 6 digits.');
      return;
    }
    if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
      onToast?.('Discount must be between 0 and 100%.');
      return;
    }
    if (gstin && !GSTIN_PATTERN.test(gstin)) {
      onToast?.('GSTIN must be 15 characters, e.g. 06AAAAA0000A1Z5.');
      return;
    }

    setIsSubmitting(true);
    try {
      const payload = {
        customerCode: formData.customerCode.trim(),
        salutation: formData.salutation,
        name: formData.name.trim(),
        address: formData.address.trim(),
        areaLocation: formData.areaLocation.trim(),
        state: formData.state,
        pinCode,
        mobile: cleanMobile,
        email,
        preference: formData.preference,
        discountPercent: discount,
        commPreference: formData.commPreference,
        rateList: formData.rateList,
        gstin,
        referralCode: formData.referralCode.trim(),
        notes: formData.notes.trim(),
      };

      const result = await onSave(payload, activeCustomer?.id);
      if (result !== false && result !== null) {
        onClose();
      }
    } catch (err) {
      onToast?.(err.message || 'Failed to save customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!activeCustomer?.id || !onDelete) return;
    setIsSubmitting(true);
    try {
      await onDelete(activeCustomer.id);
      onClose();
    } catch (err) {
      onToast?.(err.message || 'Failed to delete customer.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div
      className="modal-backdrop customer-modal-backdrop"
      onClick={onClose}
    >
      <div
        className="modal-panel customer-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="customer-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* TOP HEADER */}
        <div className="customer-modal-header">
          <div className="customer-modal-header-left" style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0 }}>
            <div
              className="customer-modal-header-avatar"
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#2563eb',
                border: '1px solid #dbeafe',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {activeCustomer ? <UserCheck size={20} /> : <UserPlus size={20} />}
            </div>
            <div style={{ minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <h2
                  id="customer-modal-title"
                  className="customer-modal-title"
                  style={{
                    margin: 0,
                    fontSize: '16px',
                    fontWeight: 700,
                    color: '#0f172a',
                    letterSpacing: '-0.02em',
                  }}
                >
                  {activeCustomer ? 'Customer Account Profile' : 'New Customer Registration'}
                </h2>
                {activeCustomer ? (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      background: '#f1f5f9',
                      color: '#475569',
                      border: '1px solid #e2e8f0',
                      padding: '2px 8px',
                      borderRadius: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    #{activeCustomer.customerCode || activeCustomer.id?.slice(0, 6)}
                  </span>
                ) : (
                  <span
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      background: '#ecfdf5',
                      color: '#059669',
                      border: '1px solid #a7f3d0',
                      padding: '2px 8px',
                      borderRadius: '6px',
                    }}
                  >
                    New Intake
                  </span>
                )}
              </div>
              <p className="customer-modal-subtitle" style={{ margin: '2px 0 0', fontSize: '12px', color: '#64748b' }}>
                {activeCustomer
                  ? `Editing account details and preferences for ${activeCustomer.name}`
                  : 'Fast POS customer intake for billing, pickup & delivery details'}
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexShrink: 0 }}>
            {activeCustomer && (
              <button
                type="button"
                className="desktop-only"
                onClick={handleResetToNew}
                style={{
                  background: '#f8fafc',
                  border: '1px solid #e2e8f0',
                  color: '#2563eb',
                  fontSize: '12px',
                  fontWeight: 600,
                  padding: '6px 12px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '5px',
                  transition: 'all 0.15s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eff6ff';
                  e.currentTarget.style.borderColor = '#bfdbfe';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#f8fafc';
                  e.currentTarget.style.borderColor = '#e2e8f0';
                }}
                title="Create a fresh customer registration"
              >
                <UserPlus size={14} /> + New Customer
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              aria-label="Close modal"
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                border: '1px solid #cbd5e1',
                background: '#f8fafc',
                color: '#334155',
                display: 'grid',
                placeItems: 'center',
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
                e.currentTarget.style.color = '#0f172a';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc';
                e.currentTarget.style.color = '#334155';
              }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* MODAL BODY */}
        <div className="customer-modal-body">
          {/* TOP SEARCH SPOTLIGHT BAR */}
          <div ref={searchContainerRef} style={{ position: 'relative' }}>
            <div
              className="customer-input-group"
              style={{
                display: 'flex',
                alignItems: 'center',
                background: '#ffffff',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                padding: '0 14px',
                height: '42px',
                gap: '10px',
                boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)',
                transition: 'border-color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <Search size={16} color="#64748b" style={{ flexShrink: 0 }} />
              <input
                type="text"
                aria-label="Search existing customers"
                autoComplete="off"
                placeholder="Search existing customer by Name, Mobile (+91), or Customer ID..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setShowSearchResults(true);
                }}
                onFocus={() => setShowSearchResults(true)}
                style={{
                  background: 'transparent',
                  border: 'none',
                  outline: 'none',
                  color: '#0f172a',
                  fontSize: '13px',
                  width: '100%',
                }}
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: '#94a3b8',
                    cursor: 'pointer',
                    padding: 0,
                    display: 'grid',
                    placeItems: 'center',
                  }}
                  title="Clear search"
                  aria-label="Clear search"
                >
                  <X size={15} />
                </button>
              )}
            </div>

            {/* LIVE AUTOCOMPLETE DROPDOWN */}
            {showSearchResults && searchQuery.trim() && (
              <div
                style={{
                  position: 'absolute',
                  top: 'calc(100% + 6px)',
                  left: 0,
                  right: 0,
                  background: '#ffffff',
                  border: '1px solid #e2e8f0',
                  borderRadius: '10px',
                  zIndex: 30,
                  maxHeight: '220px',
                  overflowY: 'auto',
                  boxShadow: '0 12px 30px -8px rgba(15, 23, 42, 0.18)',
                }}
              >
                {searchResults.length === 0 ? (
                  <div
                    style={{
                      padding: '14px 16px',
                      fontSize: '13px',
                      color: '#64748b',
                      textAlign: 'center',
                    }}
                  >
                    No matching customer found for "<strong>{searchQuery}</strong>".
                  </div>
                ) : (
                  searchResults.map((c) => (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => handleSelectCustomer(c)}
                      style={{
                        width: '100%',
                        textAlign: 'left',
                        padding: '10px 14px',
                        background: 'transparent',
                        border: 'none',
                        borderBottom: '1px solid #f1f5f9',
                        color: '#0f172a',
                        cursor: 'pointer',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        fontSize: '13px',
                        transition: 'background 0.12s ease',
                      }}
                      onMouseEnter={(e) => (e.currentTarget.style.background = '#f8fafc')}
                      onMouseLeave={(e) => (e.currentTarget.style.background = 'transparent')}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <div
                          style={{
                            width: '32px',
                            height: '32px',
                            borderRadius: '50%',
                            background: '#eff6ff',
                            color: '#2563eb',
                            display: 'grid',
                            placeItems: 'center',
                            fontSize: '12px',
                            fontWeight: 700,
                          }}
                        >
                          {c.name ? c.name.charAt(0).toUpperCase() : 'C'}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, color: '#0f172a' }}>{c.name}</div>
                          <div style={{ fontSize: '11px', color: '#64748b' }}>
                            +91 {c.mobile} {c.areaLocation ? `• ${c.areaLocation}` : ''}
                          </div>
                        </div>
                      </div>
                      <div style={{ textAlign: 'right' }}>
                        <span
                          style={{
                            background: '#eff6ff',
                            color: '#2563eb',
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                          }}
                        >
                          {c.customerCode || 'Load Profile'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            )}
          </div>

          {/* FORM */}
          <form id="customer-form" onSubmit={handleSubmit} noValidate style={{ display: 'grid', gap: '16px' }}>
            {/* SECTION 1: IDENTITY & CONTACT */}
            <div className="customer-form-section">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <User size={16} color="#2563eb" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    Identity & Primary Contact
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#64748b',
                    background: '#f8fafc',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #f1f5f9',
                  }}
                >
                  Required for Billing
                </span>
              </div>

              {/* ROW 1: CUSTOMER CODE + SALUTATION & NAME */}
              <div className="customer-form-row-code-name">
                {/* CUSTOMER CODE */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-code"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Customer Code
                  </label>
                  <input
                    id="cust-code"
                    type="text"
                    autoComplete="off"
                    value={formData.customerCode}
                    onChange={(e) => updateField('customerCode', e.target.value.toUpperCase())}
                    placeholder="e.g. CUST-1001"
                    style={{
                      height: '40px',
                      background: '#f8fafc',
                      border: '1px solid #cbd5e1',
                      color: '#0f172a',
                      fontWeight: 700,
                      padding: '0 12px',
                      borderRadius: '8px',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* SALUTATION & NAME */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-name"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Full Name <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div className="customer-name-inputs-wrap">
                    <CustomSelect
                      value={formData.salutation}
                      onChange={(val) => updateField('salutation', val)}
                      options={SALUTATIONS}
                      width="95px"
                      minWidth="95px"
                      ariaLabel="Salutation"
                      className="customer-salutation-select"
                      menuStyle={{ minWidth: '120px' }}
                    />

                    <input
                      id="cust-name"
                      type="text"
                      autoComplete="name"
                      autoCapitalize="words"
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.name}
                      onChange={(e) => updateField('name', e.target.value)}
                      required
                      style={{
                        flex: 1,
                        minWidth: 0,
                        height: '40px',
                        background: '#ffffff',
                        border: '1px solid #cbd5e1',
                        borderRadius: '8px',
                        padding: '0 12px',
                        color: '#0f172a',
                        fontSize: '13px',
                        fontWeight: 600,
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>

              {/* ROW 2: MOBILE (+91) & EMAIL */}
              <div className="customer-form-row-2col">
                {/* MOBILE */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-mobile"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Mobile Phone <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <div
                    className="customer-input-group"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      height: '40px',
                    }}
                  >
                    <div
                      style={{
                        padding: '0 10px',
                        background: '#f1f5f9',
                        color: '#334155',
                        fontSize: '12px',
                        fontWeight: 700,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        borderRight: '1px solid #cbd5e1',
                        flexShrink: 0,
                      }}
                    >
                      <span>🇮🇳 +91</span>
                    </div>
                    <input
                      id="cust-mobile"
                      type="tel"
                      inputMode="numeric"
                      autoComplete="tel-national"
                      placeholder="98765 43210"
                      value={formData.mobile}
                      onChange={(e) => updateField('mobile', normalizeMobile(e.target.value))}
                      required
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        border: 'none',
                        color: '#0f172a',
                        fontSize: '13px',
                        fontWeight: 600,
                        padding: '0 12px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>

                {/* EMAIL */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-email"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Email Address
                  </label>
                  <div
                    className="customer-input-group"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      height: '40px',
                    }}
                  >
                    <div
                      style={{
                        padding: '0 10px',
                        background: '#f8fafc',
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        borderRight: '1px solid #cbd5e1',
                        color: '#64748b',
                        flexShrink: 0,
                      }}
                    >
                      <Mail size={15} />
                    </div>
                    <input
                      id="cust-email"
                      type="email"
                      inputMode="email"
                      autoComplete="email"
                      autoCapitalize="off"
                      spellCheck={false}
                      placeholder="customer@example.com"
                      value={formData.email}
                      onChange={(e) => updateField('email', e.target.value.trim())}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        border: 'none',
                        color: '#0f172a',
                        fontSize: '13px',
                        padding: '0 12px',
                        outline: 'none',
                      }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* SECTION 2: DELIVERY ADDRESS & LOCATION */}
            <div className="customer-form-section">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <MapPin size={16} color="#2563eb" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    Delivery & Service Address
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#64748b',
                    background: '#f8fafc',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #f1f5f9',
                  }}
                >
                  Pickup / Delivery Logistics
                </span>
              </div>

              {/* ADDRESS & AREA */}
              <div className="customer-form-row-address">
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-address"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    Street Address / Flat No. <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 'normal', textTransform: 'none' }}>(Optional)</span>
                  </label>
                  <input
                    id="cust-address"
                    type="text"
                    autoComplete="street-address"
                    placeholder="e.g. Flat 402, Tower B, Palm Grove"
                    value={formData.address}
                    onChange={(e) => updateField('address', e.target.value)}
                    style={{
                      height: '40px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0 12px',
                      color: '#0f172a',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-area"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Area / Locality
                  </label>
                  <input
                    id="cust-area"
                    type="text"
                    autoComplete="address-level3"
                    placeholder="e.g. Sector 14 / DLF Phase 2"
                    value={formData.areaLocation}
                    onChange={(e) => updateField('areaLocation', e.target.value)}
                    style={{
                      height: '40px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0 12px',
                      color: '#0f172a',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {/* STATE & PIN CODE */}
              <div className="customer-form-row-2col">
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-state"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    State
                  </label>
                  <CustomSelect
                    id="cust-state"
                    value={formData.state}
                    onChange={(val) => updateField('state', val)}
                    options={INDIAN_STATES}
                    placeholder="Select state"
                    searchable={true}
                    searchPlaceholder="Search Indian state..."
                    width="100%"
                    minWidth="0"
                  />
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-pincode"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Pin Code
                  </label>
                  <input
                    id="cust-pincode"
                    type="text"
                    inputMode="numeric"
                    autoComplete="postal-code"
                    placeholder="e.g. 122001"
                    value={formData.pinCode}
                    onChange={(e) => updateField('pinCode', e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6}
                    style={{
                      height: '40px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0 12px',
                      color: '#0f172a',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>
            </div>

            {/* SECTION 3: LAUNDRY PREFERENCES, RATE LIST & TAX */}
            <div className="customer-form-section">
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #f1f5f9',
                  paddingBottom: '10px',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Tag size={16} color="#2563eb" />
                  <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>
                    Preferences & Commercial Terms
                  </span>
                </div>
                <span
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#64748b',
                    background: '#f8fafc',
                    padding: '2px 8px',
                    borderRadius: '4px',
                    border: '1px solid #f1f5f9',
                  }}
                >
                  Custom Tiers & Billing
                </span>
              </div>

              {/* PREFERENCE & DISCOUNT % */}
              <div className="customer-form-row-pref">
                {/* PREFERENCE */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-preference"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Wash & Packaging Preference
                  </label>
                  <CustomSelect
                    id="cust-preference"
                    value={formData.preference}
                    onChange={(val) => updateField('preference', val)}
                    options={PREFERENCE_OPTIONS}
                    width="100%"
                    minWidth="0"
                  />
                </div>

                {/* DISCOUNT % */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-discount"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Default Discount
                  </label>
                  <div
                    className="customer-input-group"
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      overflow: 'hidden',
                      height: '40px',
                    }}
                  >
                    <input
                      id="cust-discount"
                      type="text"
                      inputMode="decimal"
                      autoComplete="off"
                      placeholder="0"
                      value={formData.discountPercent}
                      onChange={(e) => {
                        // Digits with at most one decimal point, capped at 100.
                        let next = e.target.value.replace(/[^\d.]/g, '');
                        const dot = next.indexOf('.');
                        if (dot !== -1) next = next.slice(0, dot + 1) + next.slice(dot + 1).replace(/\./g, '').slice(0, 2);
                        if (next !== '' && next !== '.' && Number(next) > 100) next = '100';
                        updateField('discountPercent', next);
                      }}
                      style={{
                        flex: 1,
                        minWidth: 0,
                        background: 'transparent',
                        border: 'none',
                        color: '#0f172a',
                        fontSize: '13px',
                        fontWeight: 700,
                        padding: '0 12px',
                        outline: 'none',
                      }}
                    />
                    <div
                      style={{
                        padding: '0 12px',
                        background: '#f1f5f9',
                        color: '#475569',
                        fontSize: '12px',
                        fontWeight: 700,
                        height: '100%',
                        display: 'flex',
                        alignItems: 'center',
                        borderLeft: '1px solid #cbd5e1',
                        flexShrink: 0,
                      }}
                    >
                      % OFF
                    </div>
                  </div>
                </div>
              </div>

              {/* COMM PREFERENCE & RATE LIST */}
              <div className="customer-form-row-2col">
                {/* COMM PREFERENCE */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-comm"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Communication Channel
                  </label>
                  <CustomSelect
                    id="cust-comm"
                    value={formData.commPreference}
                    onChange={(val) => updateField('commPreference', val)}
                    options={COMM_PREFERENCES}
                    width="100%"
                    minWidth="0"
                  />
                </div>

                {/* RATE LIST */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-ratelist"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Rate List Tier
                  </label>
                  <CustomSelect
                    id="cust-ratelist"
                    value={formData.rateList}
                    onChange={(val) => updateField('rateList', val)}
                    options={RATE_LIST_OPTIONS}
                    width="100%"
                    minWidth="0"
                    dropUp
                  />
                </div>
              </div>

              {/* GSTIN & REFERRAL CODE */}
              <div className="customer-form-row-2col">
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-gstin"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Customer GSTIN (B2B Tax Invoice)
                  </label>
                  <input
                    id="cust-gstin"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    spellCheck={false}
                    placeholder="e.g. 06AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => updateField('gstin', e.target.value.toUpperCase().replace(/[^0-9A-Z]/g, ''))}
                    maxLength={15}
                    style={{
                      height: '40px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0 12px',
                      color: '#0f172a',
                      fontSize: '13px',
                      fontFamily: 'monospace',
                      letterSpacing: '0.04em',
                      outline: 'none',
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
                    htmlFor="cust-referral"
                    style={{
                      fontSize: '11px',
                      fontWeight: 700,
                      color: '#475569',
                      textTransform: 'uppercase',
                      letterSpacing: '0.03em',
                    }}
                  >
                    Referral Code / Promo Tag
                  </label>
                  <input
                    id="cust-referral"
                    type="text"
                    autoComplete="off"
                    autoCapitalize="characters"
                    placeholder="e.g. REF-SUMMER26"
                    value={formData.referralCode}
                    onChange={(e) => updateField('referralCode', e.target.value.toUpperCase())}
                    style={{
                      height: '40px',
                      background: '#ffffff',
                      border: '1px solid #cbd5e1',
                      borderRadius: '8px',
                      padding: '0 12px',
                      color: '#0f172a',
                      fontSize: '13px',
                      outline: 'none',
                    }}
                  />
                </div>
              </div>

              {enrolledPackages.length > 0 && (
                <div style={{ marginTop: '20px', borderTop: '1.5px solid #e2e8f0', paddingTop: '16px' }}>
                  <h4 style={{ margin: '0 0 10px', fontSize: '13px', fontWeight: 700, color: '#1e293b', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Package size={15} color="#7c3aed" /> Active Subscribed Packages ({enrolledPackages.length})
                  </h4>
                  <div style={{ display: 'grid', gap: '8px' }}>
                    {enrolledPackages.map((cp) => {
                      const remaining = cp.remainingCredit != null ? Number(cp.remainingCredit) : Number(cp.walletCredit || 0);
                      return (
                        <div
                          key={cp.id}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '10px 12px',
                            background: '#faf5ff',
                            border: '1px solid #e9d5ff',
                            borderRadius: '8px',
                            fontSize: '12px',
                          }}
                        >
                          <div>
                            <strong style={{ color: '#581c87', fontSize: '13px' }}>{cp.name}</strong>
                            <div style={{ fontSize: '11px', color: '#6b21a8', marginTop: '2px' }}>
                              {cp.kind === 'wallet' ? `Prepaid Credit: ${formatMoney(cp.walletCredit)} (Remaining: ${formatMoney(Math.max(0, remaining))})` : `${cp.discountPercent}% Discount Plan`}
                            </div>
                          </div>
                          <button
                            type="button"
                            style={{
                              minHeight: '28px',
                              padding: '0 10px',
                              fontSize: '11px',
                              fontWeight: 700,
                              color: '#dc2626',
                              background: '#fef2f2',
                              border: '1px solid #fecaca',
                              borderRadius: '6px',
                              display: 'inline-flex',
                              alignItems: 'center',
                              gap: '4px',
                              cursor: 'pointer',
                            }}
                            onClick={() => {
                              const remMsg = cp.kind === 'wallet' && remaining > 0 ? `\n\nRemaining wallet credit of ${formatMoney(remaining)} will be deducted from customer wallet balance.` : '';
                              if (window.confirm(`Are you sure you want to delete package "${cp.name}" from ${activeCustomer?.name || 'customer'}?${remMsg}`)) {
                                onDeleteCustomerPackage?.(cp.id);
                              }
                            }}
                          >
                            <Trash2 size={12} /> Delete Package
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>

        {/* MODAL FOOTER */}
        <div className="customer-modal-footer">
          <div>
            {activeCustomer ? (
              confirmDelete ? (
                <div
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    background: '#fef2f2',
                    border: '1px solid #fecaca',
                    padding: '4px 10px',
                    borderRadius: '8px',
                  }}
                >
                  <AlertCircle size={15} color="#dc2626" />
                  <span style={{ fontSize: '12px', fontWeight: 600, color: '#b91c1c' }}>
                    Permanently delete this customer record?
                  </span>
                  <button
                    type="button"
                    onClick={handleDelete}
                    disabled={isSubmitting}
                    style={{
                      background: '#dc2626',
                      color: '#ffffff',
                      border: 'none',
                      padding: '5px 12px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 700,
                      cursor: 'pointer',
                    }}
                  >
                    Yes, Delete
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDelete(false)}
                    style={{
                      background: '#ffffff',
                      color: '#475569',
                      border: '1px solid #cbd5e1',
                      padding: '5px 10px',
                      borderRadius: '6px',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmDelete(true)}
                  style={{
                    background: '#ffffff',
                    border: '1px solid #fecaca',
                    color: '#dc2626',
                    padding: '8px 14px',
                    borderRadius: '8px',
                    fontSize: '12px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    transition: 'all 0.15s ease',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = '#fef2f2';
                    e.currentTarget.style.borderColor = '#f87171';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = '#ffffff';
                    e.currentTarget.style.borderColor = '#fecaca';
                  }}
                >
                  <Trash2 size={14} /> Delete Customer
                </button>
              )
            ) : (
              <span style={{ fontSize: '12px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ color: '#dc2626', fontWeight: 700 }}>*</span> Required fields marked with red asterisk
              </span>
            )}
          </div>

          <div className="customer-modal-footer-actions">
            <button
              type="button"
              onClick={onClose}
              style={{
                background: '#f8fafc',
                color: '#475569',
                border: '1px solid #cbd5e1',
                padding: '9px 18px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#f1f5f9';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = '#f8fafc';
              }}
            >
              Cancel
            </button>

            <button
              type="submit"
              form="customer-form"
              onClick={handleSubmit}
              disabled={isSubmitting}
              style={{
                background: '#2563eb',
                color: '#ffffff',
                border: 'none',
                padding: '9px 24px',
                borderRadius: '8px',
                fontSize: '13px',
                fontWeight: 700,
                cursor: isSubmitting ? 'not-allowed' : 'pointer',
                boxShadow: '0 2px 8px rgba(37, 99, 235, 0.3)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                transition: 'all 0.15s ease',
              }}
              onMouseEnter={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = '#1d4ed8';
              }}
              onMouseLeave={(e) => {
                if (!isSubmitting) e.currentTarget.style.background = '#2563eb';
              }}
            >
              <Save size={15} />
              {isSubmitting ? 'Saving...' : activeCustomer ? 'Update Customer' : 'Save Customer'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
