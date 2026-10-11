import React, { useState } from 'react';
import { BadgePercent, Edit3, Gift, Infinity, PackagePlus, Plus, Sparkles, Tag, Trash2, Wallet, X } from 'lucide-react';
import { services } from '../data.js';
import CustomSelect from './CustomSelect.jsx';

export default function PackageManageModal({
  isOpen,
  onClose,
  packages,
  onCreatePackage,
  onUpdatePackage,
  onDeletePackage,
  onToast,
}) {
  const [editingId, setEditingId] = useState(null);
  const [isCreating, setIsCreating] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    kind: 'discount',
    price: '',
    walletCredit: '',
    discountPercent: '',
    buyQty: '',
    freeQty: '',
    minQty: '',
    applicableService: 'all',
    applicableOrderType: 'all',
    applicableCategory: 'all',
    targetKeywords: '',
    validity: '',
    accent: 'violet',
  });

  if (!isOpen) return null;

  const resetForm = () => {
    setEditingId(null);
    setIsCreating(false);
    setFormData({
      name: '',
      description: '',
      kind: 'discount',
      price: '',
      walletCredit: '',
      discountPercent: '',
      buyQty: '',
      freeQty: '',
      minQty: '',
      applicableService: 'all',
      applicableOrderType: 'all',
      applicableCategory: 'all',
      targetKeywords: '',
      validity: '',
      accent: 'violet',
    });
  };

  const handleStartCreate = () => {
    resetForm();
    setIsCreating(true);
  };

  const handleStartEdit = (pkg) => {
    setEditingId(pkg.id);
    setIsCreating(true);
    setFormData({
      name: pkg.name || '',
      description: pkg.description || '',
      kind: pkg.kind || 'discount',
      price: pkg.price || '',
      walletCredit: pkg.walletCredit || '',
      discountPercent: pkg.discountPercent || '',
      buyQty: pkg.buyQty || '',
      freeQty: pkg.freeQty || '',
      minQty: pkg.minQty || '',
      applicableService: pkg.applicableService || 'all',
      applicableOrderType: pkg.applicableOrderType || 'all',
      applicableCategory: pkg.applicableCategory || 'all',
      targetKeywords: Array.isArray(pkg.targetKeywords)
        ? pkg.targetKeywords.join(', ')
        : (pkg.targetKeywords || ''),
      validity: pkg.validity || '',
      accent: pkg.accent || 'violet',
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name.trim()) {
      onToast('Please enter a package name.');
      return;
    }
    const priceNum = Number(formData.price || 0);
    if (priceNum <= 0) {
      onToast('Please enter a valid price.');
      return;
    }

    if (formData.kind === 'wallet' && !(Number(formData.walletCredit) > 0)) {
      onToast('Please enter wallet credit amount.');
      return;
    }

    if (formData.kind === 'discount' && !(Number(formData.discountPercent) > 0 && Number(formData.discountPercent) <= 100)) {
      onToast('Please enter a discount percentage between 1 and 100.');
      return;
    }

    if (formData.kind === 'buy_x_get_y' && !(Number(formData.buyQty) > 0 && Number(formData.freeQty) > 0)) {
      onToast('Please specify valid items paid and items free (e.g. buy 5, get 1 free).');
      return;
    }

    const payload = {
      name: formData.name.trim(),
      description: formData.description.trim(),
      kind: formData.kind,
      price: priceNum,
      walletCredit: formData.kind === 'wallet' ? Number(formData.walletCredit) : 0,
      discountPercent: formData.kind === 'discount' ? Number(formData.discountPercent) : 0,
      buyQty: formData.kind === 'buy_x_get_y' ? Number(formData.buyQty) : 0,
      freeQty: formData.kind === 'buy_x_get_y' ? Number(formData.freeQty) : 0,
      minQty: Number(formData.minQty || 0) || (formData.kind === 'buy_x_get_y' ? (Number(formData.buyQty) + Number(formData.freeQty)) : 0),
      applicableService: formData.applicableService,
      applicableOrderType: formData.applicableOrderType,
      applicableCategory: formData.applicableCategory,
      targetKeywords: formData.targetKeywords
        ? formData.targetKeywords.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)
        : [],
      validity: formData.validity.trim() || 'Active Plan',
      accent: formData.accent,
    };

    try {
      if (editingId) {
        await onUpdatePackage(editingId, payload);
        onToast(`Package "${formData.name}" updated.`);
      } else {
        await onCreatePackage(payload);
        onToast(`New package "${formData.name}" created.`);
      }
      resetForm();
    } catch (err) {
      onToast(err.message || 'Failed to save package.');
    }
  };

  const handleDelete = async (pkg) => {
    if (window.confirm(`Are you sure you want to delete package "${pkg.name}"?`)) {
      try {
        await onDeletePackage(pkg.id);
        onToast(`Package "${pkg.name}" deleted.`);
      } catch (err) {
        onToast(err.message || 'Failed to delete package.');
      }
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-panel" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '780px' }}>
        <div className="modal-header">
          <div>
            <span className="caption-label">Package Catalog & Custom Rules</span>
            <h3>Manage Laundry Packages & Offers</h3>
          </div>
          <button className="icon-button" type="button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        <div className="modal-content" style={{ padding: '24px', flex: 1, minHeight: 0, maxHeight: '76vh', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain' }}>
          {/* Header Action */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#666' }}>
              <Infinity size={15} style={{ color: '#2563eb' }} />
              <strong>Flexible Benefit Engine:</strong> Configure wallet credit, item-specific offers, or clothes discounts.
            </div>
            {!isCreating && (
              <button
                type="button"
                className="button button-primary"
                onClick={handleStartCreate}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <Plus size={16} /> Create New Package
              </button>
            )}
          </div>

          {/* Create / Edit Form */}
          {isCreating && (
            <form onSubmit={handleSubmit} style={{ background: '#f8f8fc', border: '1px solid #e2e1f4', borderRadius: '12px', padding: '20px', marginBottom: '24px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                <strong style={{ fontSize: '14px', color: '#443db4' }}>
                  {editingId ? 'Edit Package & Offer Scope' : 'Create New Package / Custom Clothes Offer'}
                </strong>
                <button type="button" className="icon-button" onClick={resetForm} title="Cancel">
                  <X size={16} />
                </button>
              </div>

              <div style={{ display: 'grid', gap: '14px' }}>
                {/* 1. Name and Type */}
                <div style={{ display: 'grid', gridTemplateColumns: '1.4fr 1fr', gap: '12px' }}>
                  <label className="field-group">
                    <span className="field-label">Package Name</span>
                    <input
                      type="text"
                      placeholder="e.g. Winter Dry Cleaning Special / 2 Double Blanket Offer"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </label>

                  <div className="field-group">
                    <span className="field-label">Offer Type</span>
                    <CustomSelect
                      value={formData.kind}
                      onChange={(val) => setFormData({ ...formData, kind: val })}
                      options={[
                        { value: 'discount', label: 'Percentage Discount (%)' },
                        { value: 'buy_x_get_y', label: 'Buy X, Get Y Free Offer' },
                        { value: 'wallet', label: 'Prepaid Wallet Credit' },
                      ]}
                      width="100%"
                    />
                  </div>
                </div>

                {/* 2. Description */}
                <label className="field-group">
                  <span className="field-label">Description / Offer Details</span>
                  <input
                    type="text"
                    placeholder="e.g. Pay for 5 Sweaters, Get 6th Free! / 2 Double Blanket 25% Off"
                    value={formData.description}
                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  />
                </label>

                {/* 3. Pricing & Benefit values */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
                  <label className="field-group">
                    <span className="field-label">Price to Purchase (₹)</span>
                    <input
                      type="number"
                      min="0"
                      step="1"
                      placeholder="e.g. 1500"
                      value={formData.price}
                      onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                      required
                    />
                  </label>

                  {formData.kind === 'wallet' && (
                    <label className="field-group">
                      <span className="field-label">Wallet Laundry Credit (₹)</span>
                      <input
                        type="number"
                        min="0"
                        step="1"
                        placeholder="e.g. 2000"
                        value={formData.walletCredit}
                        onChange={(e) => setFormData({ ...formData, walletCredit: e.target.value })}
                        required
                      />
                    </label>
                  )}

                  {formData.kind === 'discount' && (
                    <>
                      <label className="field-group">
                        <span className="field-label">Discount Percentage (%)</span>
                        <input
                          type="number"
                          min="1"
                          max="100"
                          step="1"
                          placeholder="e.g. 25 or 50"
                          value={formData.discountPercent}
                          onChange={(e) => setFormData({ ...formData, discountPercent: e.target.value })}
                          required
                        />
                      </label>

                      <label className="field-group">
                        <span className="field-label">Min Items Required (Optional)</span>
                        <input
                          type="number"
                          min="0"
                          step="1"
                          placeholder="e.g. 2 (for 2 Double Blankets)"
                          value={formData.minQty}
                          onChange={(e) => setFormData({ ...formData, minQty: e.target.value })}
                        />
                      </label>
                    </>
                  )}

                  {formData.kind === 'buy_x_get_y' && (
                    <>
                      <label className="field-group">
                        <span className="field-label">Pay For (Buy Qty)</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 5"
                          value={formData.buyQty}
                          onChange={(e) => setFormData({ ...formData, buyQty: e.target.value })}
                          required
                        />
                      </label>

                      <label className="field-group">
                        <span className="field-label">Get Free (Free Qty)</span>
                        <input
                          type="number"
                          min="1"
                          step="1"
                          placeholder="e.g. 1"
                          value={formData.freeQty}
                          onChange={(e) => setFormData({ ...formData, freeQty: e.target.value })}
                          required
                        />
                      </label>
                    </>
                  )}

                  <div className="field-group">
                    <span className="field-label">Accent Color</span>
                    <CustomSelect
                      value={formData.accent}
                      onChange={(val) => setFormData({ ...formData, accent: val })}
                      options={[
                        { value: 'violet', label: 'Violet', badge: 'Purple' },
                        { value: 'amber', label: 'Amber Gold', badge: 'Gold' },
                        { value: 'mint', label: 'Mint Green', badge: 'Green' },
                        { value: 'peach', label: 'Peach Orange', badge: 'Orange' },
                        { value: 'blue', label: 'Sky Blue', badge: 'Blue' },
                        { value: 'rose', label: 'Rose Red', badge: 'Red' },
                        { value: 'purple', label: 'Deep Purple', badge: 'Royal' },
                      ]}
                      width="100%"
                    />
                  </div>
                </div>

                {/* 4. CUSTOMIZE FOR CERTAIN CLOTHES & SERVICES */}
                {formData.kind !== 'wallet' && (
                  <div style={{ background: '#fff', border: '1px solid #e0dff2', borderRadius: '10px', padding: '14px', display: 'grid', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', fontWeight: 700, color: '#4338ca' }}>
                      <Tag size={15} /> Customize Target Clothes & Services
                    </div>

                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
                      <div className="field-group">
                        <span className="field-label">Target Service</span>
                        <CustomSelect
                          value={formData.applicableService}
                          onChange={(val) => setFormData({ ...formData, applicableService: val })}
                          options={[
                            { value: 'all', label: 'All Services' },
                            { value: 'Dry cleaning', label: 'Dry cleaning only' },
                            { value: 'Steam press', label: 'Steam press only' },
                            { value: 'Premium laundry', label: 'Premium laundry only' },
                            { value: 'Club Fresh DC', label: 'Club Fresh DC only' },
                            { value: 'Club Fresh SP', label: 'Club Fresh SP only' },
                          ]}
                          width="100%"
                        />
                      </div>

                      <div className="field-group">
                        <span className="field-label">Order Type</span>
                        <CustomSelect
                          value={formData.applicableOrderType}
                          onChange={(val) => setFormData({ ...formData, applicableOrderType: val })}
                          options={[
                            { value: 'all', label: 'All Order Types' },
                            { value: 'pieces', label: 'Per Piece Only (Pieces)' },
                            { value: 'weight', label: 'By Weight Only (Kg)' },
                          ]}
                          width="100%"
                        />
                      </div>

                      <div className="field-group">
                        <span className="field-label">Target Clothes Category</span>
                        <CustomSelect
                          value={formData.applicableCategory}
                          onChange={(val) => setFormData({ ...formData, applicableCategory: val })}
                          options={[
                            { value: 'all', label: 'All Garment Categories' },
                            { value: 'Men', label: 'Men only' },
                            { value: 'Women', label: 'Women only' },
                            { value: 'Kids', label: 'Kids only' },
                            { value: 'Household', label: 'Household only' },
                          ]}
                          width="100%"
                        />
                      </div>
                    </div>

                    <label className="field-group">
                      <span className="field-label">
                        Target Clothes Keywords / Items (Comma separated, e.g. "Sweater, Sweatshirt" or "Blanket Double, Blanket Cover Double" or "Shirt, Kurta")
                      </span>
                      <input
                        type="text"
                        placeholder="Leave blank for all clothes, or enter keywords: sweater, blanket, suit, saree, etc."
                        value={formData.targetKeywords}
                        onChange={(e) => setFormData({ ...formData, targetKeywords: e.target.value })}
                      />
                    </label>
                  </div>
                )}

                {/* 5. Validity text */}
                <label className="field-group">
                  <span className="field-label">Validity Label (e.g. Winter Special, 1 year validity, 2 months validity)</span>
                  <input
                    type="text"
                    placeholder="e.g. Winter Special / 1 year validity / Special Season"
                    value={formData.validity}
                    onChange={(e) => setFormData({ ...formData, validity: e.target.value })}
                  />
                </label>

                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '6px' }}>
                  <button type="button" className="button button-quiet" onClick={resetForm}>
                    Cancel
                  </button>
                  <button type="submit" className="button button-primary">
                    {editingId ? 'Save Changes' : 'Create Package'}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* Existing Packages List */}
          <div style={{ display: 'grid', gap: '12px' }}>
            {packages.map((pkg) => {
              const isWallet = pkg.kind === 'wallet';
              const isBogo = pkg.kind === 'buy_x_get_y';
              return (
                <div
                  key={pkg.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '16px',
                    borderRadius: '12px',
                    border: '1px solid #e5e5ea',
                    background: '#fff',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.02)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
                    <div
                      style={{
                        width: '44px',
                        height: '44px',
                        borderRadius: '10px',
                        display: 'grid',
                        placeItems: 'center',
                        background: isWallet ? '#eff6ff' : (isBogo ? '#fef3c7' : '#dcfce7'),
                        color: isWallet ? '#1d4ed8' : (isBogo ? '#b45309' : '#15803d'),
                        flex: '0 0 auto',
                      }}
                    >
                      {isWallet ? <Wallet size={20} /> : (isBogo ? <Gift size={20} /> : <BadgePercent size={20} />)}
                    </div>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        <strong style={{ fontSize: '14px', color: '#222' }}>{pkg.name}</strong>
                        <span
                          style={{
                            fontSize: '10px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '12px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                          }}
                        >
                          {pkg.validity || 'Active Plan'}
                        </span>
                        {pkg.applicableService && pkg.applicableService !== 'all' && (
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                            {pkg.applicableService}
                          </span>
                        )}
                        {pkg.applicableOrderType && pkg.applicableOrderType !== 'all' && (
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                            {pkg.applicableOrderType}
                          </span>
                        )}
                        {pkg.applicableCategory && pkg.applicableCategory !== 'all' && (
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#f1f5f9', color: '#475569' }}>
                            {pkg.applicableCategory}
                          </span>
                        )}
                        {Array.isArray(pkg.targetKeywords) && pkg.targetKeywords.length > 0 && (
                          <span style={{ fontSize: '10px', fontWeight: 600, padding: '1px 6px', borderRadius: '4px', background: '#eff6ff', color: '#1d4ed8' }}>
                            Target: {pkg.targetKeywords.join(', ')}
                          </span>
                        )}
                      </div>
                      <p style={{ margin: '3px 0 0', fontSize: '12px', color: '#666' }}>{pkg.description}</p>
                      <div style={{ display: 'flex', gap: '14px', marginTop: '6px', fontSize: '11px', color: '#444' }}>
                        <span>Price: <strong>₹{pkg.price}</strong></span>
                        {isWallet && <span>Credit: <strong>₹{pkg.walletCredit}</strong></span>}
                        {isBogo && <span>Offer: <strong>Pay for {pkg.buyQty || 5}, Get {pkg.freeQty || 1} Free</strong></span>}
                        {!isWallet && !isBogo && (
                          <span>Discount: <strong>{pkg.discountPercent}% Off</strong> {pkg.minQty > 0 ? `(Min ${pkg.minQty})` : ''}</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <button
                      type="button"
                      className="button button-quiet"
                      onClick={() => handleStartEdit(pkg)}
                      style={{ padding: '6px 12px', fontSize: '11px', display: 'flex', alignItems: 'center', gap: '4px' }}
                    >
                      <Edit3 size={13} /> Edit
                    </button>
                    <button
                      type="button"
                      className="icon-button"
                      onClick={() => handleDelete(pkg)}
                      style={{ color: '#c8474e' }}
                      title="Delete package"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
