import React, { useState } from 'react';
import { Check, Plus, Sparkles, Tag, X } from 'lucide-react';
import { formatMoney } from '../lib/persistence.js';
import { isCarpetItem } from '../data.js';
import { roundMoney } from '../lib/orderPricing.js';
import { useEscapeKey } from '../lib/a11y.js';

export default function ItemTagModal({
  isOpen,
  onClose,
  item,
  brands = [],
  colors = [],
  defects = [],
  addons = [],
  onSaveBrand,
  onSaveColor,
  onSaveDefect,
  onSaveAddon,
  onUpdateItem,
  onToast,
}) {
  useEscapeKey(isOpen && Boolean(item), onClose);
  if (!isOpen || !item) return null;

  const isCarpet = isCarpetItem(item);
  const [carpetLength, setCarpetLength] = useState(item.length ? String(item.length) : '');
  const [carpetWidth, setCarpetWidth] = useState((item.width || item.breadth) ? String(item.width || item.breadth) : '');
  const numLength = Number(carpetLength) || 0;
  const numWidth = Number(carpetWidth) || 0;
  const carpetSqFt = (numLength > 0 && numWidth > 0) ? Math.round(numLength * numWidth * 100) / 100 : 0;
  const carpetRatePerSqFt = item.ratePerSqFt || (item.sqFt && item.unitPrice ? roundMoney(item.unitPrice / item.sqFt) : item.unitPrice) || 0;
  const computedCarpetUnitPrice = carpetSqFt > 0 ? roundMoney(carpetSqFt * carpetRatePerSqFt) : item.unitPrice;

  // Local state for editing the item's tags
  const [selectedAddons, setSelectedAddons] = useState(item.addons || []);
  const [addonInput, setAddonInput] = useState('');
  const [newAddonPrice, setNewAddonPrice] = useState('');
  const [isSavingAddon, setIsSavingAddon] = useState(false);

  const [selectedBrand, setSelectedBrand] = useState(item.brand || '');
  const [brandInput, setBrandInput] = useState('');

  const [selectedColor, setSelectedColor] = useState(item.color || '');
  const [colorInput, setColorInput] = useState('');

  const [selectedDefects, setSelectedDefects] = useState(item.defects || []);
  const [defectInput, setDefectInput] = useState('');

  const [itemNote, setItemNote] = useState(item.note || '');

  // Addon filtering & creation
  const filteredAddons = addons.filter((a) =>
    a.name.toLowerCase().includes(addonInput.trim().toLowerCase())
  );
  const canCreateAddon = addonInput.trim() &&
    !addons.some((a) => a.name.toLowerCase() === addonInput.trim().toLowerCase());

  const handleToggleAddon = (addon) => {
    const exists = selectedAddons.some((a) => a.id === addon.id || a.name === addon.name);
    if (exists) {
      setSelectedAddons(selectedAddons.filter((a) => a.id !== addon.id && a.name !== addon.name));
    } else {
      setSelectedAddons([...selectedAddons, addon]);
    }
  };

  const handleCreateAddon = async () => {
    const name = addonInput.trim();
    const price = Number(newAddonPrice || 0);
    if (!name) return;
    setIsSavingAddon(true);
    try {
      const newObj = { id: `addon-${Date.now()}`, name, price };
      if (onSaveAddon) await onSaveAddon(newObj);
      setSelectedAddons([...selectedAddons, newObj]);
      setAddonInput('');
      setNewAddonPrice('');
      if (onToast) onToast(`Add-on "${name}" created and saved.`);
    } finally {
      setIsSavingAddon(false);
    }
  };

  // Brand handling
  const filteredBrands = brands.filter((b) =>
    b.toLowerCase().includes(brandInput.trim().toLowerCase())
  );
  const canCreateBrand = brandInput.trim() &&
    !brands.some((b) => b.toLowerCase() === brandInput.trim().toLowerCase());

  const handleCreateBrand = async () => {
    const name = brandInput.trim();
    if (!name) return;
    if (onSaveBrand) await onSaveBrand(name);
    setSelectedBrand(name);
    setBrandInput('');
    if (onToast) onToast(`Brand "${name}" saved.`);
  };

  // Color handling
  const filteredColors = colors.filter((c) =>
    c.toLowerCase().includes(colorInput.trim().toLowerCase())
  );
  const canCreateColor = colorInput.trim() &&
    !colors.some((c) => c.toLowerCase() === colorInput.trim().toLowerCase());

  const handleCreateColor = async () => {
    const name = colorInput.trim();
    if (!name) return;
    if (onSaveColor) await onSaveColor(name);
    setSelectedColor(name);
    setColorInput('');
    if (onToast) onToast(`Color "${name}" saved.`);
  };

  // Defect handling
  const filteredDefects = defects.filter((d) =>
    d.toLowerCase().includes(defectInput.trim().toLowerCase())
  );
  const canCreateDefect = defectInput.trim() &&
    !defects.some((d) => d.toLowerCase() === defectInput.trim().toLowerCase());

  const handleToggleDefect = (defect) => {
    if (selectedDefects.includes(defect)) {
      setSelectedDefects(selectedDefects.filter((d) => d !== defect));
    } else {
      setSelectedDefects([...selectedDefects, defect]);
    }
  };

  const handleCreateDefect = async () => {
    const name = defectInput.trim();
    if (!name) return;
    if (onSaveDefect) await onSaveDefect(name);
    setSelectedDefects([...selectedDefects, name]);
    setDefectInput('');
    if (onToast) onToast(`Defect tag "${name}" saved.`);
  };

  // Save all back to parent cart item
  const handleSave = () => {
    let finalUnitPrice = item.unitPrice;
    let finalSqFt = item.sqFt;
    let finalLength = item.length;
    let finalWidth = item.width || item.breadth;
    let finalRate = item.ratePerSqFt;

    if (isCarpet && numLength > 0 && numWidth > 0) {
      finalLength = Math.round(numLength * 100) / 100;
      finalWidth = Math.round(numWidth * 100) / 100;
      finalSqFt = carpetSqFt;
      finalRate = carpetRatePerSqFt;
      finalUnitPrice = computedCarpetUnitPrice;
    }

    onUpdateItem({
      ...item,
      unitPrice: finalUnitPrice,
      ratePerSqFt: finalRate,
      length: finalLength,
      width: finalWidth,
      breadth: finalWidth,
      sqFt: finalSqFt,
      isDimensionBased: isCarpet ? true : item.isDimensionBased,
      brand: selectedBrand,
      color: selectedColor,
      defects: selectedDefects,
      addons: selectedAddons,
      note: itemNote,
    });
    onClose();
  };

  // Total add-on extra charge
  const addonExtra = selectedAddons.reduce((sum, a) => sum + Number(a.price || 0), 0);

  return (
    <div
      className="modal-backdrop"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 99999,
        background: 'rgba(15, 23, 42, 0.72)',
        backdropFilter: 'blur(5px)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overflowY: 'auto',
        WebkitOverflowScrolling: 'touch',
        overscrollBehavior: 'contain',
        animation: 'fade-in 0.15s ease',
      }}
      onClick={onClose}
    >
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="item-tag-modal-title"
        style={{
          width: '600px',
          maxWidth: '96vw',
          maxHeight: '92vh',
          minHeight: 0,
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 60px -15px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          zIndex: 100000,
          border: '1px solid #e2e8f0',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div style={{ padding: '16px 20px', borderBottom: '1px solid #e2e8f0', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: '#f8fafc', flexShrink: 0 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Tag size={18} color="#2563eb" />
              <h3 id="item-tag-modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 800, color: '#1e293b' }}>
                Add-ons & Garment Tags
              </h3>
            </div>
            <p style={{ margin: '4px 0 0', fontSize: '12px', color: '#64748b' }}>
              <strong style={{ color: '#1e293b' }}>{item.name}</strong> ({item.service}) · Base: ₹{item.unitPrice}
              {addonExtra > 0 && (
                <span style={{ color: '#16a34a', fontWeight: 700, marginLeft: '6px' }}>
                  + Add-ons (₹{addonExtra}) = ₹{item.unitPrice + addonExtra}
                </span>
              )}
            </p>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: '32px', height: '32px', borderRadius: '50%', background: '#fff', border: '1px solid #e2e8f0' }}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body Content */}
        <div style={{ padding: '20px', overflowY: 'auto', WebkitOverflowScrolling: 'touch', overscrollBehavior: 'contain', display: 'grid', gap: '18px', flex: 1, minHeight: 0, background: '#fff' }}>
          {/* CARPET DIMENSIONS SECTION */}
          {isCarpet && (
            <div style={{ background: '#f0f9ff', border: '1.5px solid #7dd3fc', borderRadius: '12px', padding: '14px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '8px' }}>
                <span style={{ fontSize: '16px' }}>📐</span>
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#0369a1' }}>
                  {item.name} Dimensions (Length × Breadth in Feet)
                </label>
              </div>
              <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#0284c7' }}>
                Rate: <strong>₹{carpetRatePerSqFt}/sq.ft</strong> ({item.service || 'Service'}). Enter dimensions in feet:
              </p>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px', marginBottom: '10px' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                    Length (feet)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder="e.g. 8"
                    value={carpetLength}
                    onChange={(e) => setCarpetLength(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#0f172a', marginBottom: '4px' }}>
                    Breadth / Width (feet)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.1"
                    placeholder="e.g. 6"
                    value={carpetWidth}
                    onChange={(e) => setCarpetWidth(e.target.value)}
                    style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px' }}
                  />
                </div>
              </div>
              {carpetSqFt > 0 ? (
                <div style={{ background: '#e0f2fe', padding: '8px 12px', borderRadius: '8px', fontSize: '12px', color: '#0369a1', fontWeight: 700, display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px' }}>
                  <span>Area: {numLength} ft × {numWidth} ft = <strong>{carpetSqFt} sq.ft</strong></span>
                  <span>Price: {carpetSqFt} × ₹{carpetRatePerSqFt} = <strong>₹{computedCarpetUnitPrice}</strong></span>
                </div>
              ) : (
                <small style={{ color: '#64748b', fontSize: '11px' }}>Enter both length and width in feet to calculate sq.ft area and price.</small>
              )}
            </div>
          )}

          {/* ========================================================= */}
          {/* SECTION 1: TOP-UP ADD-ON SERVICES (AT TOP AS REQUESTED)    */}
          {/* ========================================================= */}
          <div style={{ background: '#f0fdf4', border: '1.5px solid #86efac', borderRadius: '12px', padding: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#16a34a" />
                <label style={{ fontSize: '13px', fontWeight: 800, color: '#15803d' }}>
                  Top-up Add-on Services {selectedAddons.length > 0 && <span>({selectedAddons.length} Selected)</span>}
                </label>
              </div>
              {selectedAddons.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedAddons([])}
                  style={{ border: 'none', background: 'none', fontSize: '11px', color: '#ef4444', fontWeight: 600, cursor: 'pointer', padding: 0 }}
                >
                  Clear Add-ons
                </button>
              )}
            </div>

            <p style={{ margin: '0 0 10px', fontSize: '11px', color: '#166534' }}>
              Select top-up services or type to create a new add-on with extra charge:
            </p>

            {/* Addon search & creation inputs */}
            <div style={{ display: 'flex', gap: '6px', marginBottom: '10px', flexWrap: 'wrap' }}>
              <input
                type="text"
                placeholder="Search or type new add-on name..."
                value={addonInput}
                onChange={(e) => setAddonInput(e.target.value)}
                style={{ flex: 1, minWidth: '320px', height: '40px', padding: '8px 12px', fontSize: '13px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
              />
              {canCreateAddon && (
                <input
                  type="number"
                  placeholder="Price (₹)"
                  value={newAddonPrice}
                  onChange={(e) => setNewAddonPrice(e.target.value)}
                  style={{ width: '90px', padding: '8px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                />
              )}
              {canCreateAddon && (
                <button
                  type="button"
                  className="button button-primary"
                  style={{ minHeight: '34px', fontSize: '11px', padding: '0 12px', display: 'flex', alignItems: 'center', gap: '4px', background: '#16a34a', borderColor: '#16a34a' }}
                  onClick={handleCreateAddon}
                  disabled={isSavingAddon}
                >
                  <Plus size={13} /> {isSavingAddon ? 'Saving...' : 'Save & Add'}
                </button>
              )}
            </div>

            {/* Addon Pill Tags */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px', maxHeight: '110px', overflowY: 'auto' }}>
              {filteredAddons.map((addon) => {
                const isSelected = selectedAddons.some((a) => a.id === addon.id || a.name.toLowerCase() === addon.name.toLowerCase());
                return (
                  <button
                    key={addon.id || addon.name}
                    type="button"
                    onClick={() => handleToggleAddon(addon)}
                    style={{
                      padding: '6px 12px',
                      borderRadius: '8px',
                      fontSize: '11px',
                      cursor: 'pointer',
                      border: isSelected ? '1.5px solid #16a34a' : '1px solid #cbd5e1',
                      background: isSelected ? '#16a34a' : '#ffffff',
                      color: isSelected ? '#ffffff' : '#1e293b',
                      fontWeight: isSelected ? 700 : 500,
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                      boxShadow: isSelected ? '0 1px 3px rgba(22, 163, 74, 0.25)' : 'none',
                      transition: 'all 0.15s ease',
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}{addon.name}
                    <span style={{ fontSize: '10px', opacity: isSelected ? 0.9 : 0.75 }}>
                      (+₹{addon.price})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 2: BRAND & COLOR                                  */}
          {/* ========================================================= */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            {/* BRAND */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Brand {selectedBrand && <span style={{ color: '#2563eb' }}>({selectedBrand})</span>}
                </label>
                {selectedBrand && (
                  <button
                    type="button"
                    onClick={() => setSelectedBrand('')}
                    style={{ border: 'none', background: 'none', fontSize: '10px', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Type brand..."
                  value={brandInput}
                  onChange={(e) => setBrandInput(e.target.value)}
                  style={{ flex: 1, padding: '6px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                />
                {canCreateBrand && (
                  <button
                    type="button"
                    className="button button-primary"
                    style={{ minHeight: '30px', fontSize: '10px', padding: '0 8px' }}
                    onClick={handleCreateBrand}
                  >
                    + Save
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '72px', overflowY: 'auto' }}>
                {filteredBrands.slice(0, 16).map((b) => (
                  <button
                    key={b}
                    type="button"
                    onClick={() => { setSelectedBrand(b); setBrandInput(''); }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '6px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      border: selectedBrand === b ? '1px solid #2563eb' : '1px solid #e2e8f0',
                      background: selectedBrand === b ? '#eff6ff' : '#fff',
                      color: selectedBrand === b ? '#1d4ed8' : '#475569',
                      fontWeight: selectedBrand === b ? 700 : 500,
                    }}
                  >
                    {b}
                  </button>
                ))}
              </div>
            </div>

            {/* COLOR */}
            <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', padding: '12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
                <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155' }}>
                  Color {selectedColor && <span style={{ color: '#0284c7' }}>({selectedColor})</span>}
                </label>
                {selectedColor && (
                  <button
                    type="button"
                    onClick={() => setSelectedColor('')}
                    style={{ border: 'none', background: 'none', fontSize: '10px', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                  >
                    Clear
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
                <input
                  type="text"
                  placeholder="Type color..."
                  value={colorInput}
                  onChange={(e) => setColorInput(e.target.value)}
                  style={{ flex: 1, padding: '6px 8px', fontSize: '11px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
                />
                {canCreateColor && (
                  <button
                    type="button"
                    className="button button-primary"
                    style={{ minHeight: '30px', fontSize: '10px', padding: '0 8px' }}
                    onClick={handleCreateColor}
                  >
                    + Save
                  </button>
                )}
              </div>

              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', maxHeight: '72px', overflowY: 'auto' }}>
                {filteredColors.slice(0, 16).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => { setSelectedColor(c); setColorInput(''); }}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      border: selectedColor === c ? '1px solid #0284c7' : '1px solid #e2e8f0',
                      background: selectedColor === c ? '#e0f2fe' : '#fff',
                      color: selectedColor === c ? '#0369a1' : '#475569',
                      fontWeight: selectedColor === c ? 700 : 500,
                    }}
                  >
                    {c}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 3: DEFECTS & PRE-EXISTING DAMAGE                  */}
          {/* ========================================================= */}
          <div style={{ background: '#fff5f5', border: '1px solid #fecaca', borderRadius: '10px', padding: '12px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px' }}>
              <label style={{ fontSize: '12px', fontWeight: 700, color: '#991b1b' }}>
                Defects / Pre-existing Condition {selectedDefects.length > 0 && <span>({selectedDefects.length})</span>}
              </label>
              {selectedDefects.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedDefects([])}
                  style={{ border: 'none', background: 'none', fontSize: '10px', color: '#ef4444', cursor: 'pointer', padding: 0 }}
                >
                  Clear Defects
                </button>
              )}
            </div>

            <div style={{ display: 'flex', gap: '5px', marginBottom: '8px' }}>
              <input
                type="text"
                placeholder="Search or type new defect tag..."
                value={defectInput}
                onChange={(e) => setDefectInput(e.target.value)}
                style={{ flex: 1, minWidth: '280px', height: '36px', padding: '8px 12px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1', background: '#fff' }}
              />
              {canCreateDefect && (
                <button
                  type="button"
                  className="button button-primary"
                  style={{ minHeight: '30px', fontSize: '10px', padding: '0 8px', background: '#dc2626', borderColor: '#dc2626' }}
                  onClick={handleCreateDefect}
                >
                  + Save Tag
                </button>
              )}
            </div>

            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px', maxHeight: '80px', overflowY: 'auto' }}>
              {filteredDefects.map((d) => {
                const isSelected = selectedDefects.includes(d);
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleToggleDefect(d)}
                    style={{
                      padding: '3px 8px',
                      borderRadius: '12px',
                      fontSize: '10px',
                      cursor: 'pointer',
                      border: isSelected ? '1px solid #ef4444' : '1px solid #e2e8f0',
                      background: isSelected ? '#fee2e2' : '#ffffff',
                      color: isSelected ? '#b91c1c' : '#475569',
                      fontWeight: isSelected ? 700 : 500,
                    }}
                  >
                    {isSelected ? '✓ ' : '+ '}{d}
                  </button>
                );
              })}
            </div>
          </div>

          {/* ========================================================= */}
          {/* SECTION 4: ITEM NOTE                                      */}
          {/* ========================================================= */}
          <div>
            <label style={{ fontSize: '12px', fontWeight: 700, color: '#334155', display: 'block', marginBottom: '4px' }}>
              Special Instruction Note
            </label>
            <input
              type="text"
              placeholder="e.g. Extra care with buttons, collar stiff..."
              value={itemNote}
              onChange={(e) => setItemNote(e.target.value)}
              style={{ width: '100%', padding: '7px 10px', fontSize: '12px', borderRadius: '6px', border: '1px solid #cbd5e1' }}
            />
          </div>
        </div>

        {/* Modal Footer */}
        <div style={{ padding: '14px 20px', background: '#f8fafc', borderTop: '1px solid #e2e8f0', display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button
            type="button"
            className="button button-quiet"
            onClick={onClose}
            style={{ minHeight: '36px', fontSize: '12px' }}
          >
            Cancel
          </button>
          <button
            type="button"
            className="button button-primary"
            onClick={handleSave}
            style={{ minHeight: '36px', fontSize: '12px', display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <Check size={14} /> Apply Tags & Done
          </button>
        </div>
      </div>
    </div>
  );
}
