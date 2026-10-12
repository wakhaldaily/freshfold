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
  Percent,
  Sliders,
  ChevronDown,
} from 'lucide-react';
import CustomSelect from './CustomSelect.jsx';
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

export default function CustomerModal({
  isOpen,
  onClose,
  customer = null, // null for new, object for edit
  allCustomers = [],
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

  const getInitialForm = (target) => ({
    customerCode: target?.customerCode || target?.code || `CUST-${1000 + (allCustomers?.length || 0) + 1}`,
    salutation: target?.salutation || 'Mr.',
    name: target?.name || '',
    address: target?.address || '',
    areaLocation: target?.areaLocation || target?.locality || '',
    state: target?.state || 'Haryana',
    pinCode: target?.pinCode || target?.pincode || '',
    mobile: target?.mobile || '',
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
    e.preventDefault();
    const cleanMobile = formData.mobile.replace(/\D/g, '');

    if (!formData.name.trim()) {
      onToast?.('Customer name is required.');
      return;
    }
    if (cleanMobile.length < 10) {
      onToast?.('Enter a valid 10-digit mobile number.');
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
        pinCode: formData.pinCode.trim(),
        mobile: cleanMobile,
        email: formData.email.trim(),
        preference: formData.preference,
        discountPercent: formData.discountPercent ? Number(formData.discountPercent) : 0,
        commPreference: formData.commPreference,
        rateList: formData.rateList,
        gstin: formData.gstin.trim(),
        referralCode: formData.referralCode.trim(),
        notes: formData.notes.trim(),
      };

      await onSave(payload, activeCustomer?.id);
      onClose();
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
          <form id="customer-form" onSubmit={handleSubmit} style={{ display: 'grid', gap: '16px' }}>
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
                    type="text"
                    value={formData.customerCode}
                    onChange={(e) => setFormData({ ...formData, customerCode: e.target.value })}
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
                      onChange={(val) => setFormData({ ...formData, salutation: val })}
                      options={SALUTATIONS}
                      width="95px"
                    />

                    <input
                      type="text"
                      placeholder="e.g. Ramesh Kumar"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
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
                      type="tel"
                      placeholder="98765 43210"
                      value={formData.mobile}
                      onChange={(e) => setFormData({ ...formData, mobile: e.target.value })}
                      required
                      style={{
                        flex: 1,
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
                      type="email"
                      placeholder="customer@example.com"
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      style={{
                        flex: 1,
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
                    Street Address / Flat No. <span style={{ color: '#dc2626' }}>*</span>
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Flat 402, Tower B, Palm Grove"
                    value={formData.address}
                    onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                    required
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
                    type="text"
                    placeholder="e.g. Sector 14 / DLF Phase 2"
                    value={formData.areaLocation}
                    onChange={(e) => setFormData({ ...formData, areaLocation: e.target.value })}
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
                    value={formData.state}
                    onChange={(val) => setFormData({ ...formData, state: val })}
                    options={INDIAN_STATES}
                    searchable={true}
                    searchPlaceholder="Search Indian state..."
                    width="100%"
                  />
                </div>

                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
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
                    type="text"
                    placeholder="e.g. 122001"
                    value={formData.pinCode}
                    onChange={(e) => setFormData({ ...formData, pinCode: e.target.value })}
                    maxLength={10}
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
                    value={formData.preference}
                    onChange={(val) => setFormData({ ...formData, preference: val })}
                    options={PREFERENCE_OPTIONS}
                    width="100%"
                  />
                </div>

                {/* DISCOUNT % */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
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
                      type="number"
                      min="0"
                      max="100"
                      placeholder="0"
                      value={formData.discountPercent}
                      onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                      style={{
                        flex: 1,
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
                    value={formData.commPreference}
                    onChange={(val) => setFormData({ ...formData, commPreference: val })}
                    options={COMM_PREFERENCES}
                    width="100%"
                  />
                </div>

                {/* RATE LIST */}
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
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
                    value={formData.rateList}
                    onChange={(val) => setFormData({ ...formData, rateList: val })}
                    options={RATE_LIST_OPTIONS}
                    width="100%"
                  />
                </div>
              </div>

              {/* GSTIN & REFERRAL CODE */}
              <div className="customer-form-row-2col">
                <div style={{ display: 'grid', gap: '6px' }}>
                  <label
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
                    type="text"
                    placeholder="e.g. 06AAAAA0000A1Z5"
                    value={formData.gstin}
                    onChange={(e) => setFormData({ ...formData, gstin: e.target.value.toUpperCase() })}
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
                    type="text"
                    placeholder="e.g. REF-SUMMER26"
                    value={formData.referralCode}
                    onChange={(e) => setFormData({ ...formData, referralCode: e.target.value })}
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
