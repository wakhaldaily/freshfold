import React, { useState } from 'react';
import { Plus, Tag, X, Sparkles } from 'lucide-react';
import { useEscapeKey } from '../lib/a11y.js';
import { roundMoney } from '../lib/orderPricing.js';

export default function AddNewItemModal({
  isOpen,
  onClose,
  services = [],
  activeService = 'Dry cleaning',
  categories = ['Men', 'Women', 'Kids', 'Household', 'Other'],
  initialSearch = '',
  onAddItem,
  onToast,
}) {
  useEscapeKey(isOpen, onClose);

  const [name, setName] = useState(initialSearch || '');
  const [category, setCategory] = useState('Men');
  const [service, setService] = useState(activeService || 'Dry cleaning');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [isDimensionBased, setIsDimensionBased] = useState(false);
  const [length, setLength] = useState('');
  const [width, setWidth] = useState('');
  const [panels, setPanels] = useState('');
  const [brand, setBrand] = useState('');
  const [color, setColor] = useState('');
  const [note, setNote] = useState('');

  if (!isOpen) return null;

  const numLen = Number(length) || 0;
  const numWidth = Number(width) || 0;
  const sqFt = isDimensionBased && numLen > 0 && numWidth > 0 ? Math.round(numLen * numWidth * 100) / 100 : 0;
  const rateVal = Number(unitPrice) || 0;
  const computedUnitPrice = isDimensionBased && sqFt > 0 ? roundMoney(sqFt * rateVal) : rateVal;

  const categoryOptions = Array.from(new Set(
    (categories || []).filter((c) => c && c !== 'All').concat(['Other'])
  ));

  const handleSubmit = (e) => {
    e.preventDefault();
    const cleanName = name.trim();
    if (!cleanName) {
      onToast?.('Please enter an item name.');
      return;
    }
    if (unitPrice === '' || isNaN(Number(unitPrice)) || Number(unitPrice) < 0) {
      onToast?.('Please enter a valid price/rate.');
      return;
    }
    const cleanQty = Math.max(1, Math.floor(Number(quantity) || 1));

    const customId = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const newItem = {
      id: customId,
      name: cleanName,
      category: category || 'Other',
      service: service || activeService,
      unitPrice: computedUnitPrice,
      baseUnitPrice: computedUnitPrice,
      customUnitPrice: computedUnitPrice,
      quantity: cleanQty,
      isCustom: true,
      isDimensionBased: Boolean(isDimensionBased),
      length: isDimensionBased && numLen > 0 ? numLen : undefined,
      width: isDimensionBased && numWidth > 0 ? numWidth : undefined,
      breadth: isDimensionBased && numWidth > 0 ? numWidth : undefined,
      sqFt: isDimensionBased && sqFt > 0 ? sqFt : undefined,
      ratePerSqFt: isDimensionBased ? rateVal : undefined,
      panels: panels ? Math.max(0, Math.floor(Number(panels))) : undefined,
      brand: brand.trim(),
      color: color.trim(),
      defects: [],
      addons: [],
      note: note.trim(),
    };

    if (typeof onAddItem === 'function') {
      onAddItem(newItem);
    }
    onToast?.(`Added "${cleanName}" to order.`);
    onClose();
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="add-item-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '520px',
          width: '95vw',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#ffffff',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '16px 20px',
            background: '#ffffff',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '10px',
                background: '#eff6ff',
                color: '#2563eb',
                display: 'grid',
                placeItems: 'center',
              }}
            >
              <Plus size={20} />
            </div>
            <div>
              <h3 id="add-item-modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Add New Item to Order
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Create a custom item not present in the standard price list
              </span>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label="Close">
            <X size={18} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0 }}>
          <div
            style={{
              padding: '20px',
              overflowY: 'auto',
              flex: 1,
              display: 'grid',
              gap: '14px',
            }}
          >
            {/* Item Name */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                Item Name <span style={{ color: '#ef4444' }}>*</span>
              </label>
              <input
                type="text"
                className="input"
                required
                autoFocus
                placeholder="e.g. Silk Cushion Cover, Designer Sherwani, Velvet Drapes"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ fontSize: '14px', minHeight: '38px' }}
              />
            </div>

            {/* Category & Service Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Category
                </label>
                <select
                  className="input"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  style={{ fontSize: '13px', minHeight: '38px', background: '#ffffff' }}
                >
                  {categoryOptions.map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Service
                </label>
                <select
                  className="input"
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                  style={{ fontSize: '13px', minHeight: '38px', background: '#ffffff' }}
                >
                  {(services.length > 0 ? services : [
                    { label: 'Dry cleaning' },
                    { label: 'Steam press' },
                    { label: 'Premium laundry' },
                    { label: 'Wash and Fold' },
                    { label: 'Wash and iron' },
                  ]).map((s) => (
                    <option key={s.label || s.id} value={s.label || s.id}>{s.label || s.id}</option>
                  ))}
                </select>
              </div>
            </div>

            {/* Price & Quantity Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  {isDimensionBased ? 'Rate per Sq.Ft (₹)' : 'Rate / Price (₹)'} <span style={{ color: '#ef4444' }}>*</span>
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span style={{ position: 'absolute', left: '10px', fontSize: '14px', fontWeight: 700, color: '#64748b' }}>₹</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="0.00"
                    value={unitPrice}
                    onChange={(e) => setUnitPrice(e.target.value)}
                    style={{ paddingLeft: '24px', fontSize: '14px', minHeight: '38px', width: '100%' }}
                    className="input"
                  />
                </div>
              </div>

              <div>
                <label style={{ display: 'block', fontSize: '12px', fontWeight: 700, color: '#334155', marginBottom: '5px' }}>
                  Quantity (Pcs)
                </label>
                <input
                  type="number"
                  min="1"
                  max="1000"
                  required
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                  style={{ fontSize: '14px', minHeight: '38px', width: '100%' }}
                  className="input"
                />
              </div>
            </div>

            {/* Dimension-based Checkbox */}
            <div style={{ background: '#f8fafc', padding: '10px 14px', borderRadius: '10px', border: '1px solid #e2e8f0' }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', fontSize: '13px', fontWeight: 600, color: '#0f172a' }}>
                <input
                  type="checkbox"
                  checked={isDimensionBased}
                  onChange={(e) => setIsDimensionBased(e.target.checked)}
                  style={{ width: '16px', height: '16px' }}
                />
                Dimension-based Item (Carpet / Curtains / Rugs by Sq.Ft)
              </label>

              {isDimensionBased && (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginTop: '10px' }}>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                      Length (ft)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      placeholder="e.g. 6"
                      value={length}
                      onChange={(e) => setLength(e.target.value)}
                      className="input"
                      style={{ minHeight: '34px', fontSize: '13px' }}
                    />
                  </div>
                  <div>
                    <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                      Width (ft)
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0.1"
                      placeholder="e.g. 4"
                      value={width}
                      onChange={(e) => setWidth(e.target.value)}
                      className="input"
                      style={{ minHeight: '34px', fontSize: '13px' }}
                    />
                  </div>
                  {sqFt > 0 && (
                    <div style={{ gridColumn: '1/-1', fontSize: '12px', color: '#1d4ed8', fontWeight: 700, background: '#eff6ff', padding: '6px 10px', borderRadius: '6px' }}>
                      Dimensions: {numLen} ft × {numWidth} ft = {sqFt} sq.ft @ ₹{rateVal}/sq.ft = ₹{computedUnitPrice} per piece
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Optional Tagging Details: Panels, Brand, Color */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '10px' }}>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Panels (Optional)
                </label>
                <input
                  type="number"
                  min="0"
                  placeholder="e.g. 9"
                  value={panels}
                  onChange={(e) => setPanels(e.target.value)}
                  className="input"
                  style={{ minHeight: '34px', fontSize: '12.5px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Brand (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Zara"
                  value={brand}
                  onChange={(e) => setBrand(e.target.value)}
                  className="input"
                  style={{ minHeight: '34px', fontSize: '12.5px' }}
                />
              </div>
              <div>
                <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                  Color (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Navy Blue"
                  value={color}
                  onChange={(e) => setColor(e.target.value)}
                  className="input"
                  style={{ minHeight: '34px', fontSize: '12.5px' }}
                />
              </div>
            </div>

            {/* Item Note */}
            <div>
              <label style={{ fontSize: '11px', fontWeight: 600, color: '#475569', display: 'block', marginBottom: '3px' }}>
                Item Note / Instructions (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g. Handle with care, zari border"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                className="input"
                style={{ minHeight: '34px', fontSize: '12.5px' }}
              />
            </div>
          </div>

          {/* Footer Actions */}
          <div
            style={{
              padding: '14px 20px',
              background: '#f8fafc',
              borderTop: '1px solid #e2e8f0',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-end',
              gap: '10px',
            }}
          >
            <button
              type="button"
              className="button button-quiet"
              onClick={onClose}
              style={{ minHeight: '38px', padding: '0 16px' }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="button button-primary"
              style={{
                minHeight: '38px',
                padding: '0 20px',
                fontWeight: 700,
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                background: '#2563eb',
                color: '#ffffff',
              }}
            >
              <Plus size={16} /> Add to Order
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
