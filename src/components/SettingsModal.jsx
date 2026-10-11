import React, { useState, useEffect } from 'react';
import {
  BadgePercent,
  Building2,
  Calculator,
  Check,
  CheckCircle2,
  Clock,
  Coins,
  Copy,
  Edit2,
  FileText,
  HelpCircle,
  Info,
  KeyRound,
  Lock,
  MapPin,
  Percent,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  ShieldCheck,
  Sparkles,
  Store,
  Tag,
  Trash2,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { defaultSettings } from '../data.js';
import CustomSelect from './CustomSelect.jsx';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  staffList = [],
  onSaveSettings,
  onSaveStaff,
  onToast,
}) {
  const [activeTab, setActiveTab] = useState('store');
  const [formData, setFormData] = useState({ ...settings });
  const [staff, setStaff] = useState([...staffList]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('cashier');
  const [newStaffPin, setNewStaffPin] = useState('0000');
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingStaffPin, setEditingStaffPin] = useState('');
  const [testAmount, setTestAmount] = useState(1000);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...settings });
      setStaff([...staffList]);
    }
  }, [isOpen, settings, staffList]);

  // Handle escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleChange = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(formData);
      if (onSaveStaff) {
        await onSaveStaff(staff);
      }
      onToast('Store & tax settings saved successfully.');
      onClose();
    } catch (err) {
      onToast(err.message || 'Failed to save settings.');
    } finally {
      setSaving(false);
    }
  };

  const handleResetDefaults = () => {
    if (window.confirm('Reset store and tax settings to standard recommended defaults?')) {
      setFormData({ ...defaultSettings });
      onToast('Settings reset to default.');
    }
  };

  const handleAddStaff = () => {
    if (!newStaffName.trim()) {
      onToast('Please enter a staff operator name.');
      return;
    }
    const cleanPin = String(newStaffPin || '0000').trim().slice(0, 6) || '0000';
    const newMember = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole,
      pin: cleanPin,
    };
    setStaff([...staff, newMember]);
    setNewStaffName('');
    setNewStaffPin('0000');
    onToast(`Added staff operator: ${newMember.name}`);
  };

  const handleDeleteStaff = (id) => {
    if (staff.length <= 1) {
      onToast('You must have at least one counter operator.');
      return;
    }
    const target = staff.find((s) => s.id === id);
    if (window.confirm(`Are you sure you want to remove operator "${target?.name}"?`)) {
      setStaff(staff.filter((s) => s.id !== id));
      onToast('Staff member removed.');
    }
  };

  const handleUpdateStaffPin = (id, newPin) => {
    setStaff(staff.map((s) => (s.id === id ? { ...s, pin: newPin } : s)));
    setEditingStaffId(null);
    onToast('Operator PIN updated.');
  };

  // Calculations for live tax simulator
  const taxRate = Number(formData.taxPercent) || 0;
  const isTaxActive = Boolean(formData.taxEnabled);
  const totalTaxSim = isTaxActive ? (testAmount * taxRate) / 100 : 0;
  const splitTaxSim = totalTaxSim / 2;
  const grandTotalSim = testAmount + totalTaxSim;

  const gstPresets = [
    { label: '0% Exempt', rate: 0, desc: 'Medical / Basic' },
    { label: '5% Essential', rate: 5, desc: 'Linen / Uniforms' },
    { label: '12% Apparel', rate: 12, desc: 'Garments < ₹1,000' },
    { label: '18% Standard Laundry', rate: 18, desc: 'Dry Cleaning & Laundry' },
    { label: '28% Luxury', rate: 28, desc: 'High-end Care' },
  ];

  const quickAmounts = [200, 500, 1000, 2500, 5000];

  const receiptFooterTemplates = [
    'Free Home pick and delivery. GST extra. Goods not collected within 30 days are not store liability.',
    'Express 24h fabric care. Please verify garment count at delivery. No cash refunds.',
    'Care for the clothes you love. Free pickup & delivery across all zones. Support: 70057 28774.',
  ];

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel settings-modal-panel"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-modal-header">
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <div
              style={{
                width: '42px',
                height: '42px',
                borderRadius: '11px',
                background: 'rgba(113, 102, 220, 0.16)',
                color: '#8b80f9',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 8px rgba(113, 102, 220, 0.2)',
                flexShrink: 0,
              }}
            >
              <Store size={22} />
            </div>
            <div>
              <span
                style={{
                  display: 'block',
                  fontSize: '10px',
                  fontWeight: 700,
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  color: 'var(--settings-text-muted)',
                }}
              >
                Counter Administration
              </span>
              <h3
                style={{
                  margin: 0,
                  fontSize: '18px',
                  fontWeight: 800,
                  color: 'var(--settings-text-primary)',
                  letterSpacing: '-0.3px',
                }}
              >
                Store & Tax Settings
              </h3>
            </div>
          </div>
          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ borderRadius: '8px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="settings-nav-bar">
          <button
            type="button"
            className={`settings-tab-pill ${activeTab === 'store' ? 'active' : ''}`}
            onClick={() => setActiveTab('store')}
          >
            <Building2 size={16} /> Store & Receipt Profile
          </button>
          <button
            type="button"
            className={`settings-tab-pill ${activeTab === 'tax' ? 'active' : ''}`}
            onClick={() => setActiveTab('tax')}
          >
            <BadgePercent size={16} /> Tax & GST Compliance
            <span className="settings-tab-badge">
              {formData.taxEnabled ? `${formData.taxPercent}% ${formData.taxLabel || 'GST'}` : 'Exempt'}
            </span>
          </button>
          <button
            type="button"
            className={`settings-tab-pill ${activeTab === 'staff' ? 'active' : ''}`}
            onClick={() => setActiveTab('staff')}
          >
            <Users size={16} /> Staff & Counter Operators
            <span className="settings-tab-badge">
              {staff.length}
            </span>
          </button>
        </div>

        {/* Form Body */}
        <form
          onSubmit={handleSave}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}
        >
          <div className="settings-modal-content">
            {/* ========================================================= */}
            {/* TAB 1: STORE & RECEIPT PROFILE                            */}
            {/* ========================================================= */}
            {activeTab === 'store' && (
              <div className="settings-split-layout">
                {/* Left: Form Fields */}
                <div style={{ display: 'grid', gap: '16px' }}>
                  <div className="settings-card">
                    <div className="settings-card-header">
                      <div className="settings-card-title">
                        <Store size={16} /> Store Identity & Branding
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                        Appears on customer tickets
                      </span>
                    </div>

                    <label className="field-group">
                      <span className="field-label">Store / Brand Name</span>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={formData.storeName}
                          onChange={(e) => handleChange('storeName', e.target.value)}
                          placeholder="e.g. Fresh Fold"
                          required
                          style={{ paddingLeft: '34px' }}
                        />
                        <Store
                          size={15}
                          style={{
                            position: 'absolute',
                            left: '11px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--settings-placeholder)',
                          }}
                        />
                      </div>
                    </label>

                    <label className="field-group">
                      <span className="field-label">Tagline / Business Subtitle</span>
                      <div style={{ position: 'relative' }}>
                        <input
                          type="text"
                          value={formData.tagline}
                          onChange={(e) => handleChange('tagline', e.target.value)}
                          placeholder="e.g. Premium Fabric Care & Dry Cleaning"
                          style={{ paddingLeft: '34px' }}
                        />
                        <Sparkles
                          size={15}
                          style={{
                            position: 'absolute',
                            left: '11px',
                            top: '50%',
                            transform: 'translateY(-50%)',
                            color: 'var(--settings-placeholder)',
                          }}
                        />
                      </div>
                    </label>

                    <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 0.8fr', gap: '12px' }}>
                      <label className="field-group">
                        <span className="field-label">Contact Phone</span>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={formData.phone}
                            onChange={(e) => handleChange('phone', e.target.value)}
                            placeholder="e.g. +91 70057 28774"
                            style={{ paddingLeft: '34px' }}
                          />
                          <Phone
                            size={15}
                            style={{
                              position: 'absolute',
                              left: '11px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: 'var(--settings-placeholder)',
                            }}
                          />
                        </div>
                      </label>

                      <div className="field-group">
                        <span className="field-label">Currency Symbol</span>
                        <CustomSelect
                          value={formData.currency}
                          onChange={(val) => handleChange('currency', val)}
                          options={[
                            { value: '₹', label: '₹ (INR - Indian Rupee)' },
                            { value: '$', label: '$ (USD - US Dollar)' },
                            { value: '€', label: '€ (EUR - Euro)' },
                            { value: '£', label: '£ (GBP - British Pound)' },
                            { value: 'AED', label: 'AED (UAE Dirham)' },
                          ]}
                          icon={Coins}
                          width="100%"
                        />
                      </div>
                    </div>

                    <label className="field-group">
                      <span className="field-label">Physical Address / Store Website</span>
                      <div style={{ position: 'relative' }}>
                        <textarea
                          rows={2}
                          value={formData.address}
                          onChange={(e) => handleChange('address', e.target.value)}
                          placeholder="Shop 14, Galleria Market, Sector 28, Gurugram"
                          style={{ paddingLeft: '34px' }}
                        />
                        <MapPin
                          size={15}
                          style={{
                            position: 'absolute',
                            left: '11px',
                            top: '12px',
                            color: 'var(--settings-placeholder)',
                          }}
                        />
                      </div>
                    </label>
                  </div>

                  {/* Receipt Footer Terms Card */}
                  <div className="settings-card">
                    <div className="settings-card-header">
                      <div className="settings-card-title">
                        <FileText size={16} /> Receipt Footer Terms & Disclaimers
                      </div>
                    </div>
                    <label className="field-group">
                      <span className="field-label">Thermal & PDF Receipt Footer Note</span>
                      <textarea
                        rows={3}
                        value={formData.receiptFooter}
                        onChange={(e) => handleChange('receiptFooter', e.target.value)}
                        placeholder="Free Home pick and delivery. GST extra. Goods not collected within 30 days are not store liability."
                      />
                    </label>

                    {/* Quick Preset Templates */}
                    <div>
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 700,
                          color: 'var(--settings-text-muted)',
                          display: 'block',
                          marginBottom: '6px',
                        }}
                      >
                        Quick Policy Templates:
                      </span>
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {receiptFooterTemplates.map((template, idx) => (
                          <button
                            key={idx}
                            type="button"
                            onClick={() => handleChange('receiptFooter', template)}
                            className={`settings-policy-btn ${formData.receiptFooter === template ? 'selected' : ''}`}
                          >
                            <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {template}
                            </span>
                            <span
                              style={{
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#8b80f9',
                                flexShrink: 0,
                                marginLeft: '8px',
                              }}
                            >
                              Use
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Right: Realistic Thermal Paper Preview */}
                <div className="settings-receipt-stage">
                  <div className="settings-receipt-stage-header">
                    <span className="settings-receipt-stage-title">
                      <Receipt size={14} /> LIVE THERMAL TICKET PREVIEW
                    </span>
                    <span
                      style={{
                        fontSize: '10px',
                        fontWeight: 700,
                        color: '#15803d',
                        background: '#dcfce7',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        letterSpacing: '0.4px',
                      }}
                    >
                      80MM THERMAL
                    </span>
                  </div>

                  <div className="settings-receipt-paper">
                    <div style={{ textAlign: 'center', fontWeight: 800, fontSize: '14px', letterSpacing: '0.5px' }}>
                      {formData.storeName || 'Fresh Fold'}
                    </div>
                    {formData.tagline && (
                      <div style={{ textAlign: 'center', fontSize: '10px', color: '#52525b', marginTop: '2px' }}>
                        {formData.tagline}
                      </div>
                    )}
                    {formData.address && (
                      <div style={{ textAlign: 'center', fontSize: '10px', color: '#71717a', marginTop: '3px' }}>
                        {formData.address}
                      </div>
                    )}
                    {formData.phone && (
                      <div style={{ textAlign: 'center', fontSize: '10px', color: '#71717a' }}>
                        Ph: {formData.phone}
                      </div>
                    )}
                    {formData.taxEnabled && formData.taxNumber && (
                      <div style={{ textAlign: 'center', fontSize: '10px', fontWeight: 700, marginTop: '2px', color: '#18181b' }}>
                        GSTIN: {formData.taxNumber}
                      </div>
                    )}

                    <div className="dotted-line" />

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', fontWeight: 700 }}>
                      <span>ORDER #B6195</span>
                      <span>11-OCT-2026</span>
                    </div>
                    <div style={{ fontSize: '10px', color: '#71717a' }}>Aditi Sharma (+91 98***)</div>

                    <div className="dotted-line" />

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span>Shirt (Dry Clean) × 2</span>
                      <span>{formData.currency || '₹'}250.00</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span>Suit 2 Pcs × 1</span>
                      <span>{formData.currency || '₹'}400.00</span>
                    </div>

                    <div className="dotted-line" />

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px' }}>
                      <span>Subtotal</span>
                      <span>{formData.currency || '₹'}650.00</span>
                    </div>

                    {formData.taxEnabled && (
                      formData.splitGst ? (
                        <>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#52525b' }}>
                            <span>CGST ({(formData.taxPercent / 2).toFixed(1)}%)</span>
                            <span>{formData.currency || '₹'}{(650 * (formData.taxPercent / 200)).toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#52525b' }}>
                            <span>SGST ({(formData.taxPercent / 2).toFixed(1)}%)</span>
                            <span>{formData.currency || '₹'}{(650 * (formData.taxPercent / 200)).toFixed(2)}</span>
                          </div>
                        </>
                      ) : (
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '10px', color: '#52525b' }}>
                          <span>{formData.taxLabel || 'GST'} ({formData.taxPercent}%)</span>
                          <span>{formData.currency || '₹'}{(650 * (formData.taxPercent / 100)).toFixed(2)}</span>
                        </div>
                      )
                    )}

                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '13px', fontWeight: 800, marginTop: '5px', paddingTop: '4px', borderTop: '1px solid #18181b' }}>
                      <span>TOTAL BILL</span>
                      <span>
                        {formData.currency || '₹'}
                        {(
                          650 +
                          (formData.taxEnabled ? 650 * (formData.taxPercent / 100) : 0)
                        ).toFixed(2)}
                      </span>
                    </div>

                    <div className="dotted-line" />

                    {formData.receiptFooter && (
                      <div
                        style={{
                          fontSize: '9px',
                          textAlign: 'center',
                          color: '#52525b',
                          fontStyle: 'italic',
                          lineHeight: 1.3,
                        }}
                      >
                        {formData.receiptFooter}
                      </div>
                    )}
                    <div style={{ textAlign: 'center', fontSize: '9px', marginTop: '6px', fontWeight: 700 }}>
                      *** THANK YOU FOR VISITING ***
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 2: TAX & GST COMPLIANCE                               */}
            {/* ========================================================= */}
            {activeTab === 'tax' && (
              <div style={{ display: 'grid', gap: '18px' }}>
                {/* Master Switch Card */}
                <div
                  style={{
                    background: formData.taxEnabled ? 'var(--settings-active-highlight-bg)' : 'var(--settings-card-bg)',
                    border: `1.5px solid ${formData.taxEnabled ? '#2563eb' : 'var(--settings-card-border)'}`,
                    borderRadius: '12px',
                    padding: '18px 22px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    boxShadow: formData.taxEnabled ? '0 2px 8px rgba(37, 99, 235, 0.08)' : 'none',
                    transition: 'all 0.2s ease',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                    <div
                      style={{
                        width: '46px',
                        height: '46px',
                        borderRadius: '10px',
                        background: formData.taxEnabled ? '#2563eb' : 'var(--settings-card-subtle-bg)',
                        color: formData.taxEnabled ? '#ffffff' : 'var(--settings-text-muted)',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all 0.2s ease',
                        flexShrink: 0,
                      }}
                    >
                      <BadgePercent size={24} />
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                        <span style={{ fontSize: '15px', fontWeight: 700, color: 'var(--settings-text-primary)' }}>
                          Enable GST / Sales Tax on Orders
                        </span>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '3px 10px',
                            borderRadius: '12px',
                            background: formData.taxEnabled ? '#dcfce7' : 'var(--settings-card-subtle-bg)',
                            color: formData.taxEnabled ? '#15803d' : 'var(--settings-text-muted)',
                          }}
                        >
                          {formData.taxEnabled ? 'TAX ACTIVE' : 'EXEMPT / DISABLED'}
                        </span>
                      </div>
                      <span style={{ fontSize: '12px', color: 'var(--settings-text-muted)', display: 'block', marginTop: '3px' }}>
                        Calculates GST automatically on piece intake and weight laundry tickets, thermal prints, and WhatsApp receipts.
                      </span>
                    </div>
                  </div>

                  {/* Modern Toggle Switch */}
                  <label className="settings-toggle-switch">
                    <input
                      type="checkbox"
                      checked={formData.taxEnabled}
                      onChange={(e) => handleChange('taxEnabled', e.target.checked)}
                    />
                    <span className="settings-toggle-slider" />
                  </label>
                </div>

                {formData.taxEnabled && (
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {/* Rate & Presets Card */}
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <div className="settings-card-title">
                          <Percent size={16} /> Tax Scheme & Standard Rate
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                          Sets default bill percentage
                        </span>
                      </div>

                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                        <label className="field-group">
                          <span className="field-label">Tax Scheme Label</span>
                          <input
                            type="text"
                            value={formData.taxLabel}
                            onChange={(e) => handleChange('taxLabel', e.target.value)}
                            placeholder="GST"
                            required
                          />
                        </label>

                        <label className="field-group">
                          <span className="field-label">Standard Tax Rate (%)</span>
                          <div style={{ position: 'relative' }}>
                            <input
                              type="number"
                              step="0.1"
                              min="0"
                              max="100"
                              value={formData.taxPercent}
                              onChange={(e) => handleChange('taxPercent', Number(e.target.value))}
                              placeholder="18"
                              required
                              style={{ fontWeight: 700, color: '#8b80f9', paddingRight: '32px' }}
                            />
                            <span
                              style={{
                                position: 'absolute',
                                right: '12px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontWeight: 700,
                                color: 'var(--settings-text-muted)',
                              }}
                            >
                              %
                            </span>
                          </div>
                        </label>
                      </div>

                      {/* Quick GST Slabs */}
                      <div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            color: 'var(--settings-text-secondary)',
                            display: 'block',
                            marginBottom: '8px',
                          }}
                        >
                          Standard GST Slabs (Click to Apply):
                        </span>
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: '8px' }}>
                          {gstPresets.map((preset) => (
                            <button
                              key={preset.rate}
                              type="button"
                              className={`preset-chip-btn ${formData.taxPercent === preset.rate ? 'active' : ''}`}
                              onClick={() => handleChange('taxPercent', preset.rate)}
                              style={{ padding: '8px 10px', textAlign: 'left' }}
                            >
                              <strong style={{ display: 'block', fontSize: '12px' }}>{preset.label}</strong>
                              <small style={{ fontSize: '10px', opacity: 0.85 }}>{preset.desc}</small>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>

                    {/* GSTIN & Dual Split */}
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <div className="settings-card-title">
                          <ShieldCheck size={16} /> Tax Registration & Invoice Splitting
                        </div>
                      </div>

                      <label className="field-group">
                        <span className="field-label">Store Tax Identification / GSTIN (15 Digits)</span>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={formData.taxNumber}
                            onChange={(e) => handleChange('taxNumber', e.target.value.toUpperCase())}
                            placeholder="e.g. 07AAAAA0000A1Z5"
                            style={{ textTransform: 'uppercase', letterSpacing: '1px', fontWeight: 600 }}
                          />
                          {formData.taxNumber && formData.taxNumber.length === 15 && (
                            <span
                              style={{
                                position: 'absolute',
                                right: '10px',
                                top: '50%',
                                transform: 'translateY(-50%)',
                                fontSize: '10px',
                                fontWeight: 700,
                                color: '#16a34a',
                                background: '#dcfce7',
                                padding: '2px 8px',
                                borderRadius: '4px',
                                display: 'flex',
                                alignItems: 'center',
                                gap: '3px',
                              }}
                            >
                              <Check size={11} /> Valid Format
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                          Structure: 2-digit State Code + 10-char PAN + 1 Entity number + 'Z' + 1 Check digit
                        </span>
                      </label>

                      {/* Split GST Toggle */}
                      <div
                        style={{
                          background: 'var(--settings-card-subtle-bg)',
                          border: '1px solid var(--settings-card-border)',
                          borderRadius: '10px',
                          padding: '14px 16px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          gap: '12px',
                        }}
                      >
                        <div>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--settings-text-primary)', display: 'block' }}>
                            Split Tax into equal CGST (50%) & SGST (50%)
                          </span>
                          <small style={{ color: 'var(--settings-text-muted)', display: 'block', marginTop: '2px' }}>
                            Mandatory standard for intra-state sales in India. Shows two separate tax lines on bills and thermal prints.
                          </small>
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                          {formData.splitGst && (
                            <span
                              style={{
                                fontSize: '11px',
                                fontWeight: 700,
                                color: '#8b80f9',
                                background: 'rgba(113, 102, 220, 0.16)',
                                padding: '3px 8px',
                                borderRadius: '6px',
                                whiteSpace: 'nowrap',
                              }}
                            >
                              {(formData.taxPercent / 2).toFixed(1)}% CGST + {(formData.taxPercent / 2).toFixed(1)}% SGST
                            </span>
                          )}
                          <label className="settings-toggle-switch">
                            <input
                              type="checkbox"
                              checked={formData.splitGst}
                              onChange={(e) => handleChange('splitGst', e.target.checked)}
                            />
                            <span className="settings-toggle-slider" />
                          </label>
                        </div>
                      </div>
                    </div>

                    {/* Interactive Live Calculation Simulator */}
                    <div className="settings-card" style={{ padding: '18px 20px' }}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'space-between',
                          marginBottom: '14px',
                          flexWrap: 'wrap',
                          gap: '10px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <Calculator size={18} color="#8b80f9" />
                          <div>
                            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--settings-text-primary)', display: 'block' }}>
                              Interactive Tax Calculation Simulator
                            </span>
                            <small style={{ color: 'var(--settings-text-muted)' }}>
                              Test how bill amounts and taxes will look to customers
                            </small>
                          </div>
                        </div>

                        {/* Quick Amount Chips */}
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                          <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>Test Amount:</span>
                          {quickAmounts.map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setTestAmount(amt)}
                              style={{
                                padding: '3px 9px',
                                fontSize: '11px',
                                fontWeight: testAmount === amt ? 700 : 500,
                                borderRadius: '6px',
                                border: testAmount === amt ? '1.5px solid #2563eb' : '1px solid var(--settings-card-border)',
                                background: testAmount === amt ? 'rgba(37, 99, 235, 0.12)' : 'var(--settings-card-bg)',
                                color: testAmount === amt ? '#2563eb' : 'var(--settings-text-secondary)',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                              }}
                            >
                              ₹{amt}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div
                        style={{
                          display: 'grid',
                          gridTemplateColumns: 'repeat(4, 1fr)',
                          gap: '12px',
                          background: 'var(--settings-card-subtle-bg)',
                          padding: '14px',
                          borderRadius: '10px',
                          textAlign: 'center',
                          border: '1px solid var(--settings-card-border)',
                        }}
                      >
                        <div style={{ padding: '6px' }}>
                          <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--settings-text-muted)', textTransform: 'uppercase' }}>
                            Subtotal Amount
                          </span>
                          <div style={{ fontSize: '16px', fontWeight: 700, color: 'var(--settings-text-primary)', marginTop: '3px' }}>
                            {formData.currency}
                            {testAmount.toFixed(2)}
                          </div>
                        </div>

                        {formData.splitGst ? (
                          <>
                            <div style={{ padding: '6px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--settings-text-muted)', textTransform: 'uppercase' }}>
                                CGST ({(taxRate / 2).toFixed(1)}%)
                              </span>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#8b80f9', marginTop: '3px' }}>
                                {formData.currency}
                                {splitTaxSim.toFixed(2)}
                              </div>
                            </div>
                            <div style={{ padding: '6px' }}>
                              <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--settings-text-muted)', textTransform: 'uppercase' }}>
                                SGST ({(taxRate / 2).toFixed(1)}%)
                              </span>
                              <div style={{ fontSize: '16px', fontWeight: 700, color: '#8b80f9', marginTop: '3px' }}>
                                {formData.currency}
                                {splitTaxSim.toFixed(2)}
                              </div>
                            </div>
                          </>
                        ) : (
                          <div style={{ padding: '6px', gridColumn: 'span 2' }}>
                            <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--settings-text-muted)', textTransform: 'uppercase' }}>
                              {formData.taxLabel || 'Tax'} ({taxRate}%)
                            </span>
                            <div style={{ fontSize: '16px', fontWeight: 700, color: '#8b80f9', marginTop: '3px' }}>
                              {formData.currency}
                              {totalTaxSim.toFixed(2)}
                            </div>
                          </div>
                        )}

                        <div
                          style={{
                            padding: '6px',
                            background: 'rgba(113, 102, 220, 0.2)',
                            borderRadius: '8px',
                            border: '1px solid rgba(113, 102, 220, 0.35)',
                          }}
                        >
                          <span style={{ fontSize: '10px', fontWeight: 700, color: '#c4beff', textTransform: 'uppercase' }}>
                            Final Bill Amount
                          </span>
                          <div style={{ fontSize: '17px', fontWeight: 800, color: '#ffffff', marginTop: '3px' }}>
                            {formData.currency}
                            {grandTotalSim.toFixed(2)}
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 3: STAFF & COUNTER OPERATORS                          */}
            {/* ========================================================= */}
            {activeTab === 'staff' && (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div>
                      <div className="settings-card-title">
                        <Users size={16} /> Active Counter Operators & Staff
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                        Staff members authorized to operate the checkout counter, manage orders, and print receipts
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    {staff.map((s) => (
                      <div key={s.id} className="settings-operator-card">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                          <div
                            style={{
                              width: '40px',
                              height: '40px',
                              borderRadius: '10px',
                              background: s.role === 'admin' ? 'rgba(113, 102, 220, 0.2)' : 'rgba(14, 165, 233, 0.2)',
                              color: s.role === 'admin' ? '#8b80f9' : '#38bdf8',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              fontWeight: 800,
                              fontSize: '15px',
                              flexShrink: 0,
                            }}
                          >
                            {s.name.charAt(0).toUpperCase()}
                          </div>
                          <div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                              <strong style={{ fontSize: '14px', color: 'var(--settings-text-primary)' }}>{s.name}</strong>
                              <span
                                style={{
                                  fontSize: '10px',
                                  padding: '2px 8px',
                                  background: s.role === 'admin' ? 'rgba(113, 102, 220, 0.16)' : 'rgba(14, 165, 233, 0.16)',
                                  color: s.role === 'admin' ? '#a59cf8' : '#38bdf8',
                                  borderRadius: '6px',
                                  textTransform: 'uppercase',
                                  fontWeight: 700,
                                }}
                              >
                                {s.role === 'admin' ? 'Store Manager' : 'Cashier'}
                              </span>
                            </div>

                            {/* PIN Display & Inline Editing */}
                            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                              {editingStaffId === s.id ? (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <input
                                    type="text"
                                    maxLength={6}
                                    placeholder="4-digit PIN"
                                    value={editingStaffPin}
                                    onChange={(e) => setEditingStaffPin(e.target.value.replace(/\D/g, ''))}
                                    style={{
                                      width: '90px',
                                      padding: '3px 8px',
                                      fontSize: '11px',
                                      borderRadius: '6px',
                                      border: '1px solid #2563eb',
                                    }}
                                    autoFocus
                                  />
                                  <button
                                    type="button"
                                    onClick={() => handleUpdateStaffPin(s.id, editingStaffPin)}
                                    className="button-primary"
                                    style={{
                                      padding: '3px 10px',
                                      fontSize: '11px',
                                      minHeight: '28px',
                                      borderRadius: '6px',
                                    }}
                                  >
                                    Save PIN
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setEditingStaffId(null)}
                                    className="text-button"
                                    style={{
                                      padding: '2px 6px',
                                      fontSize: '11px',
                                      color: 'var(--settings-text-muted)',
                                    }}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              ) : (
                                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                  <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)', display: 'flex', alignItems: 'center', gap: '3px' }}>
                                    <KeyRound size={12} color="#8b80f9" /> PIN: <strong>{s.pin ? '••••' : '0000'}</strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingStaffId(s.id);
                                      setEditingStaffPin(s.pin || '');
                                    }}
                                    style={{
                                      border: 'none',
                                      background: 'none',
                                      color: '#8b80f9',
                                      fontSize: '11px',
                                      fontWeight: 700,
                                      cursor: 'pointer',
                                      padding: 0,
                                    }}
                                  >
                                    Change PIN
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </div>

                        {staff.length > 1 && (
                          <button
                            type="button"
                            className="icon-button"
                            onClick={() => handleDeleteStaff(s.id)}
                            style={{ color: '#ef4444', padding: '6px' }}
                            title="Remove staff operator"
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    ))}
                  </div>
                </div>

                {/* Register New Operator Card */}
                <div
                  style={{
                    padding: '18px 22px',
                    border: '1.5px dashed var(--settings-dashed-border)',
                    borderRadius: '12px',
                    background: 'var(--settings-card-subtle-bg)',
                    display: 'grid',
                    gap: '12px',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--settings-text-primary)', display: 'block' }}>
                      Register New Counter Operator
                    </span>
                    <small style={{ color: 'var(--settings-text-muted)' }}>
                      Assign operator name, role, and a secure 4-digit counter login PIN
                    </small>
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1.5fr 1fr 1fr auto', gap: '10px', alignItems: 'center' }}>
                    <input
                      type="text"
                      placeholder="Operator Full Name"
                      value={newStaffName}
                      onChange={(e) => setNewStaffName(e.target.value)}
                    />

                    <CustomSelect
                      value={newStaffRole}
                      onChange={(val) => setNewStaffRole(val)}
                      options={[
                        { value: 'cashier', label: 'Counter Cashier', badge: 'Cashier' },
                        { value: 'admin', label: 'Store Manager', badge: 'Manager' },
                      ]}
                      width="160px"
                    />

                    <input
                      type="text"
                      maxLength={6}
                      placeholder="4-digit PIN (e.g. 1234)"
                      value={newStaffPin}
                      onChange={(e) => setNewStaffPin(e.target.value.replace(/\D/g, ''))}
                      style={{ textAlign: 'center', fontWeight: 600 }}
                    />

                    <button
                      type="button"
                      className="button-primary"
                      onClick={handleAddStaff}
                      style={{ display: 'flex', alignItems: 'center', gap: '6px', minHeight: '38px', padding: '0 16px', borderRadius: '8px' }}
                    >
                      <Plus size={15} /> Add Operator
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Modal Footer */}
          <div className="settings-modal-footer">
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--settings-text-muted)' }}>
              <CheckCircle2 size={16} color="#16a34a" />
              <span>Settings automatically apply to all checkout registers, tickets, and bills</span>
            </div>

            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <button
                type="button"
                className="settings-footer-btn"
                onClick={handleResetDefaults}
                title="Reset to recommended defaults"
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={13} /> Reset Defaults
              </button>
              <button
                type="button"
                className="settings-footer-btn"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="settings-footer-save-btn"
                disabled={saving}
              >
                <Save size={16} /> {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
