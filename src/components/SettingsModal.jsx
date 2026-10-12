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
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Globe,
  HelpCircle,
  Info,
  KeyRound,
  Lock,
  Mail,
  MapPin,
  Megaphone,
  MessageSquare,
  Percent,
  Phone,
  Plus,
  Receipt,
  RotateCcw,
  Save,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Tag,
  Trash2,
  User,
  UserCheck,
  Users,
  X,
} from 'lucide-react';
import { defaultSettings } from '../data.js';
import CustomSelect from './CustomSelect.jsx';
import { onActivateKey } from '../lib/a11y.js';

export default function SettingsModal({
  isOpen,
  onClose,
  settings,
  staffList = [],
  adminUser = null,
  adminsList = [],
  onOpenPamphlet,
  onSaveSettings,
  onSaveStaff,
  onUpdateAdmin,
  onDeleteAdmin,
  onCreateAdmin,
  onToast,
}) {
  const [activeTab, setActiveTab] = useState('store');
  const [formData, setFormData] = useState({ ...settings });
  const [staff, setStaff] = useState([...staffList]);
  const [admins, setAdmins] = useState([...adminsList]);
  const [newStaffName, setNewStaffName] = useState('');
  const [newStaffRole, setNewStaffRole] = useState('cashier');
  const [newStaffPin, setNewStaffPin] = useState('');
  const [editingStaffId, setEditingStaffId] = useState(null);
  const [editingStaffPin, setEditingStaffPin] = useState('');
  const [testAmount, setTestAmount] = useState(1000);
  const [saving, setSaving] = useState(false);

  // New Admin Registration State
  const [showAddAdmin, setShowAddAdmin] = useState(false);
  const [newAdminName, setNewAdminName] = useState('');
  const [newAdminEmail, setNewAdminEmail] = useState('');
  const [newAdminPassword, setNewAdminPassword] = useState('');
  const [newAdminQuestion, setNewAdminQuestion] = useState('What city is this store in?');
  const [newAdminAnswer, setNewAdminAnswer] = useState('');
  const [isAddingAdmin, setIsAddingAdmin] = useState(false);

  // Admin Profile & Security State
  const primaryAdmin = (admins && admins.length > 0)
    ? (admins.find((a) => a.id === adminUser?.id) || admins[0])
    : {
        id: adminUser?.admin?.id || adminUser?.id || '',
        name: adminUser?.name || 'Store Administrator',
        email: adminUser?.email || '',
        securityQuestion: 'What city is this store in?',
      };

  const [adminName, setAdminName] = useState(primaryAdmin?.name || '');
  const [adminEmail, setAdminEmail] = useState(primaryAdmin?.email || '');
  // Password and security answer are write-only: blank means "keep the current value".
  const [adminPassword, setAdminPassword] = useState('');
  const [adminSecurityQuestion, setAdminSecurityQuestion] = useState(primaryAdmin?.securityQuestion || 'What city is this store in?');
  const [adminSecurityAnswer, setAdminSecurityAnswer] = useState('');
  const [showAdminPassword, setShowAdminPassword] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setFormData({ ...settings });
      setStaff([...staffList]);
      const currentAdmins = (adminsList && adminsList.length > 0) ? adminsList : [];
      setAdmins([...currentAdmins]);
      const currentAdm = currentAdmins.length > 0
        ? (currentAdmins.find((a) => a.id === adminUser?.id) || currentAdmins[0])
        : {
            id: adminUser?.admin?.id || adminUser?.id || '',
            name: adminUser?.name || 'Store Administrator',
            email: adminUser?.email || '',
            securityQuestion: 'What city is this store in?',
          };
      setAdminName(currentAdm.name || '');
      setAdminEmail(currentAdm.email || '');
      setAdminPassword('');
      setAdminSecurityQuestion(currentAdm.securityQuestion || 'What city is this store in?');
      setAdminSecurityAnswer('');
    }
  }, [isOpen, settings, staffList, adminsList, adminUser]);

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

  const handleSaveAdminDirect = async () => {
    if (!adminName.trim()) {
      onToast?.('Please enter an administrator name.');
      return;
    }
    if (!adminEmail.trim()) {
      onToast?.('Please enter an administrator email.');
      return;
    }
    const cleanPass = adminPassword.trim();
    if (cleanPass && cleanPass.length < 6) {
      onToast?.('Password must be at least 6 characters.');
      return;
    }
    try {
      if (onUpdateAdmin) {
        const updatePayload = {
          name: adminName.trim(),
          email: adminEmail.trim().toLowerCase(),
          securityQuestion: adminSecurityQuestion,
          ...(adminSecurityAnswer.trim() ? { securityAnswer: adminSecurityAnswer.trim() } : {}),
          ...(cleanPass ? { password: cleanPass } : {}),
        };
        await onUpdateAdmin(primaryAdmin.id, updatePayload);
        setAdminPassword('');
        setAdminSecurityAnswer('');
      }
      onToast?.('Administrator profile & password updated successfully.');
    } catch (err) {
      onToast?.(err.message || 'Failed to update administrator details.');
    }
  };

  const handleSave = async (e) => {
    if (e) e.preventDefault();
    setSaving(true);
    try {
      await onSaveSettings(formData);
      if (onSaveStaff) {
        await onSaveStaff(staff);
      }
      if (onUpdateAdmin && (adminName.trim() || adminEmail.trim())) {
        const cleanPass = adminPassword.trim();
        if (cleanPass && cleanPass.length < 6) throw new Error('Password must be at least 6 characters.');
        const adminPayload = {
          name: adminName.trim() || primaryAdmin.name,
          email: adminEmail.trim().toLowerCase(),
          securityQuestion: adminSecurityQuestion,
          ...(adminSecurityAnswer.trim() ? { securityAnswer: adminSecurityAnswer.trim() } : {}),
          ...(cleanPass ? { password: cleanPass } : {}),
        };
        if (primaryAdmin?.id) await onUpdateAdmin(primaryAdmin.id, adminPayload);
      }
      onToast?.('Store, tax, and administrator settings saved successfully.');
      onClose();
    } catch (err) {
      onToast?.(err.message || 'Failed to save settings.');
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
    const cleanPin = String(newStaffPin || '').trim();
    if (!/^\d{4,6}$/.test(cleanPin)) {
      onToast('Set a 4 to 6 digit PIN for the new operator.');
      return;
    }
    const newMember = {
      id: `staff-${Date.now()}`,
      name: newStaffName.trim(),
      role: newStaffRole,
      pin: cleanPin,
    };
    setStaff([...staff, newMember]);
    setNewStaffName('');
    setNewStaffPin('');
    onToast(`Added staff operator: ${newMember.name}`);
  };

  const handleDeleteStaff = (id) => {
    if (staff.length <= 1) {
      onToast?.('You must have at least one counter operator.');
      return;
    }
    const target = staff.find((s) => s.id === id);
    if (window.confirm(`Are you sure you want to remove counter operator "${target?.name}"?`)) {
      const updated = staff.filter((s) => s.id !== id);
      setStaff(updated);
      if (onSaveStaff) {
        onSaveStaff(updated);
      }
      onToast?.(`Removed counter operator: ${target?.name}`);
    }
  };

  const handleDeleteAdmin = async (id, name) => {
    if (admins.length <= 1) {
      onToast?.('Cannot remove the last administrator. The shop must have at least one active administrator.');
      return;
    }
    const isCurrent = (adminUser?.id && id === adminUser.id) || (adminUser?.email && admins.find((a) => a.id === id)?.email?.toLowerCase() === adminUser.email?.toLowerCase());
    const confirmMsg = isCurrent
      ? `WARNING: You are about to remove your own administrator account "${name}". You will be logged out immediately. Do you want to proceed?`
      : `Are you sure you want to remove administrator "${name}" from this shop? They will no longer have access to this store.`;

    if (window.confirm(confirmMsg)) {
      try {
        if (onDeleteAdmin) {
          await onDeleteAdmin(id);
        }
        const updated = admins.filter((a) => a.id !== id);
        setAdmins(updated);
        onToast?.(`Administrator "${name}" removed from shop.`);
        if (primaryAdmin?.id === id && updated.length > 0) {
          const nextPrimary = updated[0];
          setAdminName(nextPrimary.name || '');
          setAdminEmail(nextPrimary.email || '');
          setAdminPassword('');
          setAdminSecurityQuestion(nextPrimary.securityQuestion || 'What city is this store in?');
          setAdminSecurityAnswer('');
        }
      } catch (err) {
        onToast?.(err.message || 'Failed to remove administrator.');
      }
    }
  };

  const handleRegisterNewAdmin = async (e) => {
    if (e) e.preventDefault();
    if (!newAdminName.trim()) {
      onToast?.('Please enter an administrator name.');
      return;
    }
    if (!newAdminEmail.trim()) {
      onToast?.('Please enter an administrator email.');
      return;
    }
    if (!newAdminPassword.trim() || newAdminPassword.trim().length < 6) {
      onToast?.('Password must be at least 6 characters.');
      return;
    }
    if (!newAdminAnswer.trim()) {
      onToast?.('Please provide an answer for the recovery question.');
      return;
    }
    setIsAddingAdmin(true);
    try {
      const newAdm = {
        id: `admin-${Date.now()}`,
        name: newAdminName.trim(),
        email: newAdminEmail.trim().toLowerCase(),
        password: newAdminPassword.trim(),
        securityQuestion: newAdminQuestion,
        securityAnswer: newAdminAnswer.trim().toLowerCase(),
      };
      if (onCreateAdmin) {
        await onCreateAdmin(newAdm);
      }
      const { password: _pw, securityAnswer: _ans, ...newAdmIdentity } = newAdm;
      setAdmins((prev) => [...prev, newAdmIdentity]);
      setNewAdminName('');
      setNewAdminEmail('');
      setNewAdminPassword('');
      setNewAdminAnswer('');
      setShowAddAdmin(false);
      onToast?.(`Administrator "${newAdm.name}" registered successfully!`);
    } catch (err) {
      onToast?.(err.message || 'Could not register administrator.');
    } finally {
      setIsAddingAdmin(false);
    }
  };

  const handleUpdateStaffPin = (id, newPin) => {
    if (!/^\d{4,6}$/.test(String(newPin || ''))) {
      onToast('PIN must be 4 to 6 digits.');
      return;
    }
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
    <div className="modal-backdrop settings-modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel settings-modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="settings-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="settings-modal-header">
          <div className="settings-header-title-group">
            <div className="settings-header-icon-box">
              <Store size={22} />
            </div>
            <div>
              <span className="settings-header-eyebrow">
                Store Administration
              </span>
              <h3 id="settings-modal-title" className="settings-header-title">
                Store & Personnel Settings
              </h3>
            </div>
          </div>

          <div className="settings-header-actions-group">
            <div
              className="settings-header-badges"
              title="Total people registered to operate or manage this store"
            >
              <Users size={13} />
              <span>{admins.length + staff.length} Registered</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ color: '#7c3aed' }}>{admins.length} Admins</span>
              <span style={{ opacity: 0.4 }}>•</span>
              <span style={{ color: '#0284c7' }}>{staff.length} Staff</span>
            </div>

            <button
              className="icon-button settings-header-close-btn"
              type="button"
              onClick={onClose}
              aria-label="Close"
              style={{ borderRadius: '8px' }}
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Form Body encompassing Sidebar Nav + Content + Footer */}
        <form
          onSubmit={handleSave}
          style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, overflow: 'hidden' }}
        >
          <div className="settings-body-layout">
            {/* Left Vertical Side Menu (Desktop) / Horizontal Nav Strip (Mobile) */}
            <aside className="settings-sidebar-nav">
              <div className="settings-sidebar-sections-wrapper">
                {/* Section 1: Store Configuration */}
                <div className="settings-sidebar-section">
                  <div className="settings-sidebar-heading">Store Configuration</div>
                  <button
                    type="button"
                    className={`settings-sidebar-btn ${activeTab === 'store' ? 'active' : ''}`}
                    onClick={() => setActiveTab('store')}
                  >
                    <div className="settings-sidebar-item-left">
                      <div className="settings-sidebar-icon">
                        <Building2 size={15} />
                      </div>
                      <span className="settings-sidebar-title">Store Profile</span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`settings-sidebar-btn ${activeTab === 'tax' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tax')}
                  >
                    <div className="settings-sidebar-item-left">
                      <div className="settings-sidebar-icon">
                        <BadgePercent size={15} />
                      </div>
                      <span className="settings-sidebar-title">Tax & GST</span>
                    </div>
                    <span className="settings-sidebar-badge">
                      {formData.taxEnabled ? `${formData.taxPercent}%` : 'Exempt'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`settings-sidebar-btn ${activeTab === 'delivery' ? 'active' : ''}`}
                    onClick={() => setActiveTab('delivery')}
                  >
                    <div className="settings-sidebar-item-left">
                      <div className="settings-sidebar-icon">
                        <Clock size={15} />
                      </div>
                      <span className="settings-sidebar-title">Early Delivery</span>
                    </div>
                    <span className="settings-sidebar-badge">
                      {formData.expressDeliveryEnabled !== false ? `${formData.expressDeliveryPercent !== undefined ? formData.expressDeliveryPercent : 25}%` : 'Off'}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`settings-sidebar-btn ${activeTab === 'whatsapp' ? 'active' : ''}`}
                    onClick={() => setActiveTab('whatsapp')}
                  >
                    <div className="settings-sidebar-item-left">
                      <div className="settings-sidebar-icon">
                        <MessageSquare size={15} />
                      </div>
                      <span className="settings-sidebar-title">WhatsApp</span>
                    </div>
                    <span className="settings-sidebar-badge">
                      {formData.whatsappDispatchMode === 'web' ? 'Web' : 'App'}
                    </span>
                  </button>
                </div>

                {/* Section 2: Personnel & Access */}
                <div className="settings-sidebar-section">
                  <div className="settings-sidebar-heading">Personnel & Security</div>
                  <button
                    type="button"
                    className={`settings-sidebar-btn ${activeTab === 'admin' ? 'active' : ''}`}
                    onClick={() => setActiveTab('admin')}
                  >
                    <div className="settings-sidebar-item-left">
                      <div className="settings-sidebar-icon">
                        <ShieldCheck size={15} />
                      </div>
                      <span className="settings-sidebar-title">Shop Admins</span>
                    </div>
                    <span className="settings-sidebar-badge">
                      {admins.length}
                    </span>
                  </button>

                  <button
                    type="button"
                    className={`settings-sidebar-btn ${activeTab === 'staff' ? 'active' : ''}`}
                    onClick={() => setActiveTab('staff')}
                  >
                    <div className="settings-sidebar-item-left">
                      <div className="settings-sidebar-icon">
                        <Users size={15} />
                      </div>
                      <span className="settings-sidebar-title">Counter Operators</span>
                    </div>
                    <span className="settings-sidebar-badge">
                      {staff.length}
                    </span>
                  </button>
                </div>
              </div>

              {/* Sidebar Footer User Widget */}
              <div className="settings-sidebar-footer-widget">
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <div style={{ width: '26px', height: '26px', borderRadius: '50%', background: 'linear-gradient(135deg, #2563eb, #38bdf8)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', fontWeight: 700, flexShrink: 0 }}>
                    {(adminUser?.name || 'A').charAt(0).toUpperCase()}
                  </div>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--settings-text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {adminUser?.name || 'Store Administrator'}
                    </div>
                    <div style={{ fontSize: '10px', color: 'var(--settings-text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                      {adminUser?.email || 'Active Session'}
                    </div>
                  </div>
                </div>
              </div>
            </aside>

            {/* Right Content Workspace */}
            <main className="settings-modal-content">
              {/* Dynamic Tab Header Banner */}
              <div className="settings-tab-header">
                <div>
                  <div style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: '#3b82f6', marginBottom: '3px' }}>
                    {activeTab === 'admin' || activeTab === 'staff' ? 'Personnel & Security' : 'Store Configuration'}
                  </div>
                  <h2 style={{ margin: 0, fontSize: '18px', fontWeight: 800, color: 'var(--settings-text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                    {activeTab === 'store' && <><Building2 size={20} color="#3b82f6" /> Store Profile & Branding</>}
                    {activeTab === 'tax' && <><BadgePercent size={20} color="#3b82f6" /> Tax & GST Compliance</>}
                    {activeTab === 'delivery' && <><Clock size={20} color="#3b82f6" /> Early Delivery Surcharge</>}
                    {activeTab === 'whatsapp' && <><MessageSquare size={20} color="#3b82f6" /> WhatsApp Dispatch</>}
                    {activeTab === 'admin' && <><ShieldCheck size={20} color="#3b82f6" /> Shop Admins & Personnel</>}
                    {activeTab === 'staff' && <><Users size={20} color="#3b82f6" /> Counter Operators & Staff</>}
                  </h2>
                  <p style={{ margin: '4px 0 0', fontSize: '12px', color: 'var(--settings-text-muted)' }}>
                    {activeTab === 'store' && 'Configure store contact information, receipt header/footer notes, winter campaign pamphlet, and ticket printer branding.'}
                    {activeTab === 'tax' && 'Set tax identification numbers (GSTIN/VAT), calculation rates, SAC/HSN codes, and invoice compliance.'}
                    {activeTab === 'delivery' && 'Configure expedited processing rush fees, express percentages, and turn-around time commitments.'}
                    {activeTab === 'whatsapp' && 'Manage customer order updates, ready-for-pickup notifications, and web vs desktop app dispatch modes.'}
                    {activeTab === 'admin' && 'Manage store administrators, credentials, login emails, passwords, and sensitive operations access.'}
                    {activeTab === 'staff' && 'Manage counter staff profiles, employee IDs, shift assignments, and intake operator roles.'}
                  </p>
                </div>
              </div>
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
                          placeholder="e.g. Clean Clear Dry Cleaning"
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

                    <div className="settings-grid-2-phone-code">
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
                      {formData.storeName || 'Clean Clear Dry Cleaning'}
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

                  {/* Customer Outreach & Pamphlet Action Card */}
                  <div
                    style={{
                      background: 'var(--settings-card-subtle-bg)',
                      border: '1px solid var(--settings-card-border)',
                      borderRadius: '10px',
                      padding: '12px 14px',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      gap: '12px',
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: '12px', display: 'block', color: 'var(--settings-text-primary)' }}>
                        Customer Marketing Pamphlet & Contact Flyer
                      </strong>
                      <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                        Generate, print, or share a professional dry cleaning flyer with your store admin contact and WhatsApp QR code.
                      </span>
                    </div>
                    <button
                      type="button"
                      className="button button-secondary"
                      onClick={() => {
                        onClose();
                        onOpenPamphlet?.();
                      }}
                      style={{ fontSize: '11.5px', whiteSpace: 'nowrap', display: 'flex', alignItems: 'center', gap: '5px' }}
                    >
                      <Megaphone size={14} color="#2563eb" /> Generate Pamphlet
                    </button>
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

                      <div className="settings-form-grid-2">
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
                        className="settings-tax-simulation-grid"
                        style={{
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
                                    <KeyRound size={12} color="#8b80f9" /> PIN: <strong>••••</strong>
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingStaffId(s.id);
                                      setEditingStaffPin('');
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

                        {staff.length > 1 ? (
                          <button
                            type="button"
                            className="settings-remove-btn"
                            onClick={() => handleDeleteStaff(s.id)}
                            title="Remove staff operator"
                          >
                            <Trash2 size={13} /> Remove
                          </button>
                        ) : (
                          <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)', fontStyle: 'italic', padding: '4px 8px' }}>
                            Primary Staff
                          </span>
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

                  <div className="settings-new-staff-form-grid">
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
                      width="100%"
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

            {/* ========================================================= */}
            {/* TAB 4: EARLY / EXPRESS DELIVERY SURCHARGE                 */}
            {/* ========================================================= */}
            {activeTab === 'delivery' && (
              <div style={{ display: 'grid', gap: '16px' }}>
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div>
                      <div className="settings-card-title">
                        <Clock size={16} /> Early Delivery Surcharge Configuration
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                        Charge an additional percentage (e.g. 25%) when customers request urgent or fast turnaround
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '14px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.expressDeliveryEnabled !== false}
                        onChange={(e) => handleChange('expressDeliveryEnabled', e.target.checked)}
                        style={{ width: '18px', height: '18px', cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--settings-text)' }}>
                        Enable Early Delivery / Express Surcharges at Checkout
                      </span>
                    </label>

                    <div className="settings-delivery-surcharge-grid">
                      <div>
                        <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                          Standard Express Surcharge (%)
                        </label>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginTop: '4px' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            step="1"
                            value={formData.expressDeliveryPercent !== undefined ? formData.expressDeliveryPercent : 25}
                            onChange={(e) => handleChange('expressDeliveryPercent', Math.max(0, Math.min(100, Number(e.target.value) || 0)))}
                            style={{ width: '100px', fontWeight: 700, fontSize: '14px', textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '14px', fontWeight: 700, color: '#475569' }}>%</span>
                        </div>
                        <small style={{ color: '#64748b', fontSize: '11px', display: 'block', marginTop: '6px' }}>
                          Default early delivery percentage applied during intake (customizable anytime)
                        </small>
                      </div>

                      <div>
                        <label className="field-label" style={{ fontSize: '12px', fontWeight: 600, color: '#334155' }}>
                          Calculation Preview on ₹1,000 Order
                        </label>
                        <div style={{ background: '#ffffff', padding: '10px 14px', borderRadius: '8px', border: '1px solid #cbd5e1', fontSize: '11.5px', display: 'grid', gap: '3px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                            <span>Order Subtotal:</span>
                            <span>₹1,000.00</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#d97706', fontWeight: 700 }}>
                            <span>Early Delivery (+{formData.expressDeliveryPercent !== undefined ? formData.expressDeliveryPercent : 25}%):</span>
                            <span>+₹{(1000 * ((formData.expressDeliveryPercent !== undefined ? formData.expressDeliveryPercent : 25) / 100)).toFixed(2)}</span>
                          </div>
                          <div style={{ display: 'flex', justifyContent: 'space-between', color: '#0f172a', fontWeight: 800, borderTop: '1px dashed #cbd5e1', paddingTop: '3px' }}>
                            <span>Total Before Tax:</span>
                            <span>₹{(1000 + 1000 * ((formData.expressDeliveryPercent !== undefined ? formData.expressDeliveryPercent : 25) / 100)).toFixed(2)}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Delivery Turnaround Options List */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div>
                      <div className="settings-card-title">
                        <Sparkles size={16} /> Delivery Surcharge Tiers
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                        Predefined turnaround options shown to the cashier during order placement
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    {(formData.expressOptions || defaultSettings.expressOptions).map((opt, idx) => (
                      <div
                        key={opt.id || idx}
                        className="settings-express-opt-row"
                        style={{
                          background: 'var(--settings-card-subtle-bg)',
                          padding: '10px 14px',
                          borderRadius: '8px',
                          border: '1px solid var(--settings-card-border)',
                        }}
                      >
                        <input
                          type="text"
                          value={opt.label}
                          placeholder="Option Label (e.g. 24H Rush)"
                          onChange={(e) => {
                            const next = [...(formData.expressOptions || defaultSettings.expressOptions)];
                            next[idx] = { ...next[idx], label: e.target.value };
                            handleChange('expressOptions', next);
                          }}
                          style={{ fontSize: '12px', fontWeight: 600 }}
                        />
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="0"
                            max="100"
                            value={opt.percent}
                            placeholder="%"
                            onChange={(e) => {
                              const next = [...(formData.expressOptions || defaultSettings.expressOptions)];
                              next[idx] = { ...next[idx], percent: Number(e.target.value) || 0 };
                              handleChange('expressOptions', next);
                            }}
                            style={{ width: '65px', fontSize: '12px', textAlign: 'center', fontWeight: 700 }}
                          />
                          <span style={{ fontSize: '11px', color: '#64748b' }}>% fee</span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                          <input
                            type="number"
                            min="0"
                            max="14"
                            value={opt.days !== undefined ? opt.days : 1}
                            placeholder="Days"
                            onChange={(e) => {
                              const next = [...(formData.expressOptions || defaultSettings.expressOptions)];
                              next[idx] = { ...next[idx], days: Number(e.target.value) || 0 };
                              handleChange('expressOptions', next);
                            }}
                            style={{ width: '50px', fontSize: '12px', textAlign: 'center' }}
                          />
                          <span style={{ fontSize: '11px', color: '#64748b' }}>days</span>
                        </div>
                        <button
                          type="button"
                          className="icon-button"
                          disabled={(formData.expressOptions || defaultSettings.expressOptions).length <= 1}
                          onClick={() => {
                            const next = (formData.expressOptions || defaultSettings.expressOptions).filter((_, i) => i !== idx);
                            handleChange('expressOptions', next);
                          }}
                          title="Remove option"
                          aria-label="Remove option"
                        >
                          <Trash2 size={14} color="#ef4444" />
                        </button>
                      </div>
                    ))}

                    <button
                      type="button"
                      className="button button-quiet"
                      style={{ width: 'fit-content', display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', marginTop: '4px' }}
                      onClick={() => {
                        const currentOpts = formData.expressOptions || defaultSettings.expressOptions;
                        const newOpt = {
                          id: `opt-${Date.now()}`,
                          label: 'Super Express Service',
                          percent: 30,
                          days: 1,
                        };
                        handleChange('expressOptions', [...currentOpts, newOpt]);
                      }}
                    >
                      <Plus size={14} /> Add Delivery Surcharge Option
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 5: WHATSAPP DISPATCH & AUTOMATION                     */}
            {/* ========================================================= */}
            {activeTab === 'whatsapp' && (
              <div className="settings-section-animate">
                {/* 1. Dispatch Mode Selection */}
                <div className="settings-card" style={{ marginBottom: '18px' }}>
                  <div className="settings-card-header">
                    <div>
                      <div className="settings-card-title">
                        <MessageSquare size={16} /> WhatsApp Dispatch Method
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                        Choose how the counter triggers WhatsApp messages to customers when bills are shared
                      </span>
                    </div>
                  </div>

                  <div className="settings-whatsapp-mode-grid">
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleChange('whatsappDispatchMode', 'app')}
                      onKeyDown={onActivateKey(() => handleChange('whatsappDispatchMode', 'app'))}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        border: formData.whatsappDispatchMode !== 'web' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                        background: formData.whatsappDispatchMode !== 'web' ? '#f0fdf4' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#166534', fontSize: '13px' }}>
                          <Smartphone size={16} /> WhatsApp Desktop / Mobile App
                        </div>
                        {formData.whatsappDispatchMode !== 'web' && (
                          <span style={{ fontSize: '10px', background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            RECOMMENDED
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.45 }}>
                        Launches the installed WhatsApp Desktop App (Mac or Windows) or Mobile App directly via <code>whatsapp://</code> protocol. Does not require browser tab login.
                      </p>
                    </div>

                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => handleChange('whatsappDispatchMode', 'web')}
                      onKeyDown={onActivateKey(() => handleChange('whatsappDispatchMode', 'web'))}
                      style={{
                        padding: '14px',
                        borderRadius: '10px',
                        border: formData.whatsappDispatchMode === 'web' ? '2px solid #16a34a' : '1px solid #e2e8f0',
                        background: formData.whatsappDispatchMode === 'web' ? '#f0fdf4' : '#ffffff',
                        cursor: 'pointer',
                        transition: 'all 0.15s ease',
                      }}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 700, color: '#0f172a', fontSize: '13px' }}>
                          <Globe size={16} /> WhatsApp Web in Browser
                        </div>
                        {formData.whatsappDispatchMode === 'web' && (
                          <span style={{ fontSize: '10px', background: '#16a34a', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 700 }}>
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p style={{ margin: 0, fontSize: '11px', color: '#475569', lineHeight: 1.45 }}>
                        Opens a WhatsApp Web browser tab (<code>web.whatsapp.com</code>). Ideal if counter staff already has WhatsApp Web linked on this browser.
                      </p>
                    </div>
                  </div>
                </div>

                {/* 2. How to Connect Store WhatsApp (Device Link Instructions) */}
                <div className="settings-card" style={{ marginBottom: '18px' }}>
                  <div className="settings-card-header">
                    <div>
                      <div className="settings-card-title">
                        <Smartphone size={16} /> How to Link Store WhatsApp (One-Time Setup)
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                        Follow these steps to link your store counter phone so messages send in 1 click
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '10px' }}>
                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#0284c7', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>
                        1
                      </div>
                      <div style={{ fontSize: '12px', color: '#334155' }}>
                        <strong>Option A: Install WhatsApp Mac / PC App (Fastest)</strong>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          If you download the official WhatsApp app on this computer, clicking "WhatsApp App" on any receipt opens the desktop app directly with the customer chat ready.
                        </div>
                        <a
                          href="https://www.whatsapp.com/download"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#0284c7', fontWeight: 700, marginTop: '6px', textDecoration: 'none' }}
                        >
                          <ExternalLink size={12} /> Download WhatsApp Desktop App
                        </a>
                      </div>
                    </div>

                    <div style={{ background: '#f8fafc', padding: '12px 16px', borderRadius: '8px', border: '1px solid #e2e8f0', display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                      <div style={{ width: '24px', height: '24px', borderRadius: '50%', background: '#16a34a', color: '#fff', display: 'grid', placeItems: 'center', fontSize: '11px', fontWeight: 800, flexShrink: 0 }}>
                        2
                      </div>
                      <div style={{ fontSize: '12px', color: '#334155' }}>
                        <strong>Option B: Link WhatsApp Web (In This Browser)</strong>
                        <div style={{ fontSize: '11px', color: '#64748b', marginTop: '2px' }}>
                          On your phone's WhatsApp: tap <strong>Settings &gt; Linked Devices &gt; Link a Device</strong>. Then open WhatsApp Web in this browser, check <strong>"Stay logged in"</strong>, and scan once.
                        </div>
                        <a
                          href="https://web.whatsapp.com"
                          target="_blank"
                          rel="noopener noreferrer"
                          style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '11px', color: '#16a34a', fontWeight: 700, marginTop: '6px', textDecoration: 'none' }}
                        >
                          <ExternalLink size={12} /> Open WhatsApp Web to Link Once
                        </a>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 3. Automated Cloud API (Optional Meta Integration) */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div>
                      <div className="settings-card-title">
                        <Sparkles size={16} /> Fully Automated Cloud Dispatch (Meta API - Optional)
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                        Allows silent background sending without needing any WhatsApp window open
                      </span>
                    </div>
                  </div>

                  <div style={{ display: 'grid', gap: '12px' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: 'pointer' }}>
                      <input
                        type="checkbox"
                        checked={formData.whatsappCloudApiEnabled || false}
                        onChange={(e) => handleChange('whatsappCloudApiEnabled', e.target.checked)}
                        style={{ width: '16px', height: '16px' }}
                      />
                      <span style={{ fontSize: '12px', fontWeight: 700, color: 'var(--settings-text-primary)' }}>
                        Enable Meta WhatsApp Business Cloud API for Automated Background Sending
                      </span>
                    </label>

                    {formData.whatsappCloudApiEnabled && (
                      <div style={{ display: 'grid', gap: '10px', padding: '12px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                            Meta Phone Number ID
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. 104829104829104"
                            value={formData.whatsappPhoneNumberId || ''}
                            onChange={(e) => handleChange('whatsappPhoneNumberId', e.target.value)}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                        <div>
                          <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#475569', marginBottom: '4px' }}>
                            Permanent Access Token
                          </label>
                          <input
                            type="password"
                            placeholder="EAAG..."
                            value={formData.whatsappAccessToken || ''}
                            onChange={(e) => handleChange('whatsappAccessToken', e.target.value)}
                            style={{ width: '100%', fontSize: '12px' }}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ========================================================= */}
            {/* TAB 6: ADMIN PROFILE & PASSWORD SECURITY                  */}
            {/* ========================================================= */}
            {activeTab === 'admin' && (
              <div style={{ display: 'grid', gap: '16px' }}>
                {/* 1. Store Personnel Summary Metrics Bar */}
                <div className="settings-metrics-row">
                  <div className="settings-metric-card">
                    <div className="settings-metric-icon-wrap" style={{ background: 'rgba(37, 99, 235, 0.1)', color: '#2563eb' }}>
                      <Users size={20} />
                    </div>
                    <div>
                      <div className="settings-metric-val">{admins.length + staff.length}</div>
                      <div className="settings-metric-lbl">Total Registered</div>
                    </div>
                  </div>

                  <div className="settings-metric-card">
                    <div className="settings-metric-icon-wrap" style={{ background: 'rgba(124, 58, 237, 0.1)', color: '#7c3aed' }}>
                      <ShieldCheck size={20} />
                    </div>
                    <div>
                      <div className="settings-metric-val">{admins.length}</div>
                      <div className="settings-metric-lbl">Administrators</div>
                    </div>
                  </div>

                  <div className="settings-metric-card">
                    <div className="settings-metric-icon-wrap" style={{ background: 'rgba(2, 132, 199, 0.1)', color: '#0284c7' }}>
                      <UserCheck size={20} />
                    </div>
                    <div>
                      <div className="settings-metric-val">{staff.length}</div>
                      <div className="settings-metric-lbl">Counter Staff</div>
                    </div>
                  </div>

                  <div className="settings-metric-card">
                    <div className="settings-metric-icon-wrap" style={{ background: 'rgba(22, 163, 74, 0.1)', color: '#16a34a' }}>
                      <User size={20} />
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      <div className="settings-metric-val" style={{ fontSize: '14px', whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden' }}>
                        {adminUser?.name || adminName || 'Admin'}
                      </div>
                      <div className="settings-metric-lbl">Active Session</div>
                    </div>
                  </div>
                </div>

                {/* 2. Registered Store Administrators Directory Card */}
                <div className="settings-card">
                  <div className="settings-card-header">
                    <div>
                      <div className="settings-card-title">
                        <ShieldCheck size={16} /> Registered Store Administrators ({admins.length})
                      </div>
                      <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                        All administrators authorized to configure store policies, tax rates, and manage personnel
                      </span>
                    </div>

                    <button
                      type="button"
                      className="button button-quiet"
                      style={{
                        display: 'inline-flex',
                        alignItems: 'center',
                        gap: '6px',
                        fontSize: '12px',
                        fontWeight: 600,
                        padding: '6px 12px',
                        borderRadius: '7px',
                        background: showAddAdmin ? '#e2e8f0' : 'rgba(37, 99, 235, 0.08)',
                        color: showAddAdmin ? '#334155' : '#2563eb',
                        border: '1px solid rgba(37, 99, 235, 0.2)',
                      }}
                      onClick={() => setShowAddAdmin((v) => !v)}
                    >
                      <Plus size={14} /> {showAddAdmin ? 'Cancel' : 'Register New Admin'}
                    </button>
                  </div>

                  {/* Inline Add Admin Form */}
                  {showAddAdmin && (
                    <form
                      onSubmit={handleRegisterNewAdmin}
                      style={{
                        padding: '16px',
                        borderRadius: '10px',
                        background: 'var(--settings-card-subtle-bg, #f8fafc)',
                        border: '1.5px dashed var(--settings-dashed-border, #cbd5e1)',
                        marginBottom: '16px',
                        display: 'grid',
                        gap: '12px',
                      }}
                    >
                      <div>
                        <strong style={{ fontSize: '13px', color: 'var(--settings-text-primary)', display: 'block' }}>
                          Register Additional Store Administrator
                        </strong>
                        <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                          The new administrator can sign in to this store from any browser or device.
                        </span>
                      </div>

                      <div className="settings-admin-fields-grid">
                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--settings-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Full Name
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. Rahul Sharma"
                            value={newAdminName}
                            onChange={(e) => setNewAdminName(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--settings-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Login Email
                          </label>
                          <input
                            type="email"
                            placeholder="admin2@store.com"
                            value={newAdminEmail}
                            onChange={(e) => setNewAdminEmail(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--settings-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Password (min 6 chars)
                          </label>
                          <input
                            type="password"
                            placeholder="••••••••"
                            value={newAdminPassword}
                            onChange={(e) => setNewAdminPassword(e.target.value)}
                            required
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--settings-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Recovery Question
                          </label>
                          <CustomSelect
                            value={newAdminQuestion}
                            onChange={(val) => setNewAdminQuestion(val)}
                            options={[
                              { value: 'What city is this store in?', label: 'What city is this store in?' },
                              { value: 'What is your primary phone last 4 digits?', label: 'What is your primary phone last 4 digits?' },
                              { value: 'What was your first pet name?', label: 'What was your first pet name?' },
                            ]}
                          />
                        </div>

                        <div>
                          <label style={{ fontSize: '11px', fontWeight: 600, color: 'var(--settings-text-secondary)', display: 'block', marginBottom: '4px' }}>
                            Recovery Answer
                          </label>
                          <input
                            type="text"
                            placeholder="e.g. gurugram"
                            value={newAdminAnswer}
                            onChange={(e) => setNewAdminAnswer(e.target.value)}
                            required
                          />
                        </div>
                      </div>

                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '4px' }}>
                        <button
                          type="button"
                          className="text-button"
                          onClick={() => setShowAddAdmin(false)}
                          style={{ padding: '6px 12px', fontSize: '12px' }}
                        >
                          Cancel
                        </button>
                        <button
                          type="submit"
                          className="button-primary"
                          disabled={isAddingAdmin}
                          style={{ padding: '6px 16px', fontSize: '12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                        >
                          <Check size={14} /> {isAddingAdmin ? 'Registering...' : 'Register Administrator'}
                        </button>
                      </div>
                    </form>
                  )}

                  {/* Administrators List */}
                  <div style={{ display: 'grid', gap: '10px' }}>
                    {(admins.length > 0 ? admins : [{ id: 'default', name: adminName, email: adminEmail }]).map((adm) => {
                      const isCurrent =
                        (adminUser?.id && adm.id === adminUser.id) ||
                        (adminUser?.email && adm.email?.toLowerCase() === adminUser.email?.toLowerCase()) ||
                        (!adminUser && adm.id === primaryAdmin?.id);

                      return (
                        <div key={adm.id || adm.email} className="settings-operator-card">
                          <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flexWrap: 'wrap' }}>
                            <div
                              style={{
                                width: '40px',
                                height: '40px',
                                borderRadius: '10px',
                                background: 'rgba(124, 58, 237, 0.16)',
                                color: '#7c3aed',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                fontWeight: 800,
                                fontSize: '15px',
                                flexShrink: 0,
                              }}
                            >
                              {(adm.name || adm.email || 'A').charAt(0).toUpperCase()}
                            </div>

                            <div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <strong style={{ fontSize: '14px', color: 'var(--settings-text-primary)' }}>
                                  {adm.name || 'Store Administrator'}
                                </strong>
                                <span
                                  style={{
                                    fontSize: '10px',
                                    padding: '2px 8px',
                                    background: 'rgba(124, 58, 237, 0.12)',
                                    color: '#7c3aed',
                                    borderRadius: '6px',
                                    textTransform: 'uppercase',
                                    fontWeight: 700,
                                  }}
                                >
                                  Administrator
                                </span>
                                {isCurrent && (
                                  <span
                                    style={{
                                      fontSize: '10px',
                                      padding: '2px 8px',
                                      background: '#dcfce7',
                                      color: '#15803d',
                                      borderRadius: '6px',
                                      fontWeight: 700,
                                      display: 'inline-flex',
                                      alignItems: 'center',
                                      gap: '3px',
                                    }}
                                  >
                                    <CheckCircle2 size={11} /> Active Session (You)
                                  </span>
                                )}
                              </div>

                              <div style={{ fontSize: '12px', color: 'var(--settings-text-muted)', marginTop: '2px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                  <Mail size={12} /> {adm.email}
                                </span>
                                {adm.securityQuestion && (
                                  <span style={{ fontSize: '11px', opacity: 0.8 }}>
                                    • Recovery set
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>

                          <div>
                            {admins.length <= 1 ? (
                              <span
                                style={{
                                  fontSize: '11px',
                                  color: 'var(--settings-text-muted)',
                                  background: 'var(--settings-tag-bg, #f1f5f9)',
                                  padding: '4px 10px',
                                  borderRadius: '6px',
                                  fontWeight: 600,
                                  display: 'inline-block',
                                }}
                                title="At least one administrator is required to manage the store"
                              >
                                Protected (Sole Admin)
                              </span>
                            ) : (
                              <button
                                type="button"
                                className="settings-remove-btn"
                                onClick={() => handleDeleteAdmin(adm.id, adm.name || adm.email)}
                                title={isCurrent ? 'Remove your own administrator account' : 'Remove administrator from store'}
                              >
                                <Trash2 size={13} /> Remove
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* 3. Split Layout: Edit Active Admin & Credentials Preview */}
                <div className="settings-split-layout">
                  {/* Left Column: Form Fields */}
                  <div style={{ display: 'grid', gap: '16px' }}>
                    {/* Card: Active Admin Profile Details */}
                    <div className="settings-card">
                      <div className="settings-card-header">
                        <div className="settings-card-title">
                          <User size={16} /> Edit Administrator Profile & Identity
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)' }}>
                          Active store manager
                        </span>
                      </div>

                      <label className="field-group">
                        <span className="field-label">Administrator Full Name</span>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={adminName}
                            onChange={(e) => setAdminName(e.target.value)}
                            placeholder="e.g. Store Administrator"
                            required
                            style={{ paddingLeft: '34px' }}
                          />
                          <User
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
                        <span className="field-label">Administrator Login Email</span>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="email"
                            value={adminEmail}
                            onChange={(e) => setAdminEmail(e.target.value)}
                            placeholder="admin@yourstore.com"
                            required
                            style={{ paddingLeft: '34px' }}
                          />
                          <Mail
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
                        <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)', marginTop: '4px', display: 'block' }}>
                          Used to sign in to the terminal after logout or lock.
                        </span>
                      </label>

                      <div className="field-group" style={{ marginTop: '8px' }}>
                        <span className="field-label">Change Password</span>
                        <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                          <input
                            type={showAdminPassword ? 'text' : 'password'}
                            value={adminPassword}
                            onChange={(e) => setAdminPassword(e.target.value)}
                            placeholder="Enter new password (min 6 characters)"
                            style={{ width: '100%', paddingLeft: '34px', paddingRight: '36px' }}
                          />
                          <Lock
                            size={15}
                            style={{
                              position: 'absolute',
                              left: '11px',
                              top: '50%',
                              transform: 'translateY(-50%)',
                              color: 'var(--settings-placeholder)',
                            }}
                          />
                          <button
                            type="button"
                            onClick={() => setShowAdminPassword((v) => !v)}
                            style={{
                              position: 'absolute',
                              right: '10px',
                              background: 'none',
                              border: 'none',
                              cursor: 'pointer',
                              padding: 0,
                              color: 'var(--settings-placeholder)',
                              display: 'flex',
                              alignItems: 'center',
                            }}
                            title={showAdminPassword ? 'Hide password' : 'Show password'}
                            aria-label={showAdminPassword ? 'Hide password' : 'Show password'}
                          >
                            {showAdminPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                          </button>
                        </div>
                        <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)', marginTop: '4px', display: 'block' }}>
                          Leave untouched to keep current password. Minimum 6 characters.
                        </span>
                      </div>

                      <div className="field-group" style={{ marginTop: '8px' }}>
                        <span className="field-label">Security Recovery Question</span>
                        <CustomSelect
                          value={adminSecurityQuestion}
                          onChange={(val) => setAdminSecurityQuestion(val)}
                          options={[
                            { value: 'What city is this store in?', label: 'What city is this store in?' },
                            { value: 'What is your primary phone last 4 digits?', label: 'What is your primary phone last 4 digits?' },
                            { value: 'What was your first pet name?', label: 'What was your first pet name?' },
                          ]}
                        />
                      </div>

                      <label className="field-group">
                        <span className="field-label">Security Recovery Answer</span>
                        <div style={{ position: 'relative' }}>
                          <input
                            type="text"
                            value={adminSecurityAnswer}
                            onChange={(e) => setAdminSecurityAnswer(e.target.value)}
                            placeholder="Leave blank to keep the current answer"
                            style={{ paddingLeft: '34px' }}
                          />
                          <KeyRound
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
                        <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)', marginTop: '4px', display: 'block' }}>
                          Answer used for password recovery if you ever forget your password.
                        </span>
                      </label>

                      <div style={{ marginTop: '12px', display: 'flex', justifyContent: 'flex-end' }}>
                        <button
                          type="button"
                          className="settings-footer-save-btn"
                          onClick={handleSaveAdminDirect}
                          style={{ padding: '8px 16px', fontSize: '12px' }}
                        >
                          <Check size={14} /> Update Admin Profile & Password
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Right Column: Live Credential Status & Preview Card */}
                  <div style={{ display: 'grid', gap: '16px', alignContent: 'start' }}>
                    <div className="settings-card" style={{ background: 'var(--settings-card-alt-bg, #f8fafc)' }}>
                      <div className="settings-card-header">
                        <div className="settings-card-title">
                          <ShieldCheck size={16} color="#16a34a" /> Active Login Credentials
                        </div>
                        <span style={{ fontSize: '10px', padding: '2px 8px', borderRadius: '999px', background: '#dcfce7', color: '#15803d', fontWeight: 700 }}>
                          LIVE
                        </span>
                      </div>

                      <div style={{ fontSize: '13px', display: 'grid', gap: '10px', padding: '6px 0' }}>
                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)', display: 'block' }}>Current Admin Name</span>
                          <strong style={{ fontSize: '14px', color: 'var(--settings-text-primary)' }}>{adminName || 'Store Administrator'}</strong>
                        </div>

                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)', display: 'block' }}>Login Email</span>
                          <strong style={{ fontSize: '14px', color: 'var(--settings-text-primary)' }}>{adminEmail || 'admin@freshfold.test'}</strong>
                        </div>

                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)', display: 'block' }}>Password Status</span>
                          <span style={{ fontSize: '12px', color: '#16a34a', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                            <CheckCircle2 size={13} /> {adminPassword ? `${adminPassword.length} characters configured` : 'Active'}
                          </span>
                        </div>

                        <div>
                          <span style={{ fontSize: '11px', color: 'var(--settings-text-muted)', display: 'block' }}>Recovery Question</span>
                          <span style={{ fontSize: '12px', color: 'var(--settings-text-primary)' }}>{adminSecurityQuestion}</span>
                        </div>
                      </div>

                      <div style={{ marginTop: '12px', padding: '10px 12px', borderRadius: '8px', background: 'rgba(37, 99, 235, 0.08)', border: '1px solid rgba(37, 99, 235, 0.2)', fontSize: '11px', color: '#1d4ed8', lineHeight: 1.5 }}>
                        💡 When you update your email and password here, you can immediately lock the terminal or log out and log back in using your new credentials.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            </main>
          </div>

          {/* Modal Footer */}
          <div className="settings-modal-footer">
            <div className="settings-footer-note">
              <CheckCircle2 size={15} color="#16a34a" />
              <span>Settings automatically apply to all checkout registers, tickets, and bills</span>
            </div>

            <div className="settings-footer-actions">
              <button
                type="button"
                className="settings-footer-btn settings-footer-reset-btn"
                onClick={handleResetDefaults}
                title="Reset to recommended defaults"
              >
                <RotateCcw size={13} />
                <span className="settings-btn-text">Reset Defaults</span>
                <span className="settings-btn-short-text">Reset</span>
              </button>
              <button
                type="button"
                className="settings-footer-btn settings-footer-cancel-btn"
                onClick={onClose}
              >
                Cancel
              </button>
              <button
                type="submit"
                className="settings-footer-save-btn"
                disabled={saving}
              >
                <Save size={15} />
                <span>{saving ? 'Saving...' : 'Save Settings'}</span>
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
