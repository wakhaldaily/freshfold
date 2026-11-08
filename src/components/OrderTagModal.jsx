import React, { useState } from 'react';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  Printer,
  Smartphone,
  Tag,
  X,
  Check,
  Send,
} from 'lucide-react';
import { formatTagDate } from '../lib/dateFormat.js';
import { getCustomerTagId, getServiceCode } from '../lib/orderNumbers.js';
import { useEscapeKey } from '../lib/a11y.js';

export { getCustomerTagId, getServiceCode };

export default function OrderTagModal({
  isOpen,
  onClose,
  order,
  customer,
  settings,
  onToast,
}) {
  useEscapeKey(isOpen && Boolean(order), onClose);

  // Flatten order items into individual garment pieces
  const items = Array.isArray(order?.items)
    ? order.items.filter((it) => !it.isSurcharge && it.category !== 'Service Surcharge')
    : [];

  const pieceList = [];
  if (order?.type === 'weight') {
    const totalWeightCount = Number(order.weightClothesCount || 1);
    for (let i = 1; i <= totalWeightCount; i += 1) {
      pieceList.push({
        index: i,
        name: `Weight Laundry (${order.service || 'Wash & Fold'})`,
        service: order.service,
        panels: order.panels || '',
      });
    }
  } else {
    let globalIndex = 1;
    items.forEach((item) => {
      const qty = Math.max(1, Number(item.quantity || 1));
      for (let q = 1; q <= qty; q += 1) {
        pieceList.push({
          index: globalIndex,
          name: item.name,
          category: item.category,
          service: item.service || order?.service,
          panels: item.panels || (item.name?.toLowerCase().includes('curtain') ? '9' : (order?.panels || '')),
          brand: item.brand,
          color: item.color,
          note: item.note,
        });
        globalIndex += 1;
      }
    });
  }

  const totalPieces = Math.max(1, pieceList.length);
  const [currentPieceIndex, setCurrentPieceIndex] = useState(0);
  const [pieceOverrides, setPieceOverrides] = useState({});
  const [ownerPhone, setOwnerPhone] = useState(() => {
    return settings?.adminMobile || settings?.phone || '';
  });
  const [printMode, setPrintMode] = useState('all'); // 'all' or 'single'

  const getPiecePanel = (idx) => {
    if (pieceOverrides[idx]?.panel !== undefined) return pieceOverrides[idx].panel;
    const p = pieceList[idx]?.panels;
    return p !== undefined && p !== null ? String(p) : '';
  };

  const getPieceServiceCode = (idx) => {
    if (pieceOverrides[idx]?.serviceCode !== undefined) return pieceOverrides[idx].serviceCode;
    return getServiceCode(pieceList[idx]?.service || order?.service || 'Dry Cleaning');
  };

  if (!isOpen || !order) return null;

  const currentPiece = pieceList[currentPieceIndex] || {
    index: 1,
    name: 'Garment',
    service: order?.service,
  };

  const panelInput = getPiecePanel(currentPieceIndex);
  const serviceCodeInput = getPieceServiceCode(currentPieceIndex);

  const handlePanelChange = (val) => {
    setPieceOverrides((prev) => ({
      ...prev,
      [currentPieceIndex]: { ...prev[currentPieceIndex], panel: val },
    }));
  };

  const handleServiceCodeChange = (val) => {
    setPieceOverrides((prev) => ({
      ...prev,
      [currentPieceIndex]: { ...prev[currentPieceIndex], serviceCode: val.toUpperCase() },
    }));
  };

  const customerId = getCustomerTagId(customer);
  const orderNo = order?.orderNo || order?.id || 'R1741 H';
  const customerName = customer?.name || 'Valued Customer';
  const tagCounter = `${currentPiece.index}/${totalPieces}`;
  const deliveryDateStr = formatTagDate(order?.dueDate);
  const panelStr = panelInput.trim() ? `${panelInput.trim()} panel` : '';
  const pcsAndPanelStr = `${totalPieces} pcs${panelStr ? ` ${panelStr}` : ''}`;

  const handlePrint = (mode = 'all') => {
    setPrintMode(mode);
    setTimeout(() => {
      window.print();
    }, 50);
  };

  const buildTagWhatsAppText = (pieceIdx = currentPieceIndex) => {
    const piece = pieceList[pieceIdx] || currentPiece;
    const counter = `${piece.index}/${totalPieces}`;
    const p = getPiecePanel(pieceIdx).trim();
    const pStr = p ? `${p} panel` : '';
    const pcsP = `${totalPieces} pcs${pStr ? ` ${pStr}` : ''}`;
    const sCode = getPieceServiceCode(pieceIdx);

    let msg = `🏷️ *GARMENT TAG - ${settings?.storeName || 'FRESHFOLD'}*\n`;
    msg += `────────────────────────\n`;
    msg += `*${customerId}*\n`;
    msg += `*${orderNo}*\n`;
    msg += `${customerName}\n`;
    msg += `*${counter}*\n`;
    msg += `${sCode}\n`;
    msg += `${pcsP}\n`;
    msg += `*${deliveryDateStr}*\n`;
    msg += `────────────────────────\n`;
    if (piece.name) msg += `Item: ${piece.name}\n`;
    if (piece.color || piece.brand) msg += `Details: ${[piece.color, piece.brand].filter(Boolean).join(' | ')}\n`;
    return msg;
  };

  const buildAllTagsWhatsAppText = () => {
    let msg = `🏷️ *GARMENT TAGS (${totalPieces} PCS) - ${settings?.storeName || 'FRESHFOLD'}*\n`;
    msg += `────────────────────────\n`;
    msg += `*Customer:* ${customerId} · ${customerName}\n`;
    msg += `*Order:* ${orderNo}\n`;
    msg += `*Delivery:* ${deliveryDateStr}\n`;
    msg += `────────────────────────\n\n`;

    pieceList.forEach((piece, idx) => {
      const counter = `${piece.index}/${totalPieces}`;
      const p = getPiecePanel(idx).trim();
      const pStr = p ? ` (${p} panel)` : '';
      const code = getPieceServiceCode(idx);
      msg += `🏷️ *Tag ${counter}* [${code}]\n`;
      msg += `• Item: ${piece.name}${pStr}\n`;
      if (piece.color || piece.brand) {
        msg += `• Details: ${[piece.color, piece.brand].filter(Boolean).join(' | ')}\n`;
      }
      msg += `\n`;
    });
    return msg;
  };

  const handleSendOwnerWhatsApp = (all = false) => {
    const cleanNumber = String(ownerPhone || '').replace(/\D/g, '');
    const text = all ? buildAllTagsWhatsAppText() : buildTagWhatsAppText();
    const encoded = encodeURIComponent(text);
    const targetUrl = cleanNumber
      ? `https://wa.me/${cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    onToast?.(`Opening WhatsApp to send ${all ? 'all tags' : 'garment tag'} to owner.`);
  };

  const handleSendCustomerWhatsApp = (all = false) => {
    const cleanNumber = String(customer?.mobile || '').replace(/\D/g, '');
    const text = all ? buildAllTagsWhatsAppText() : buildTagWhatsAppText();
    const encoded = encodeURIComponent(text);
    const targetUrl = cleanNumber
      ? `https://wa.me/${cleanNumber.length === 10 ? `91${cleanNumber}` : cleanNumber}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
    window.open(targetUrl, '_blank', 'noopener,noreferrer');
    onToast?.(`Opening WhatsApp for ${customerName}.`);
  };

  return (
    <div className="modal-backdrop" onClick={onClose} style={{ zIndex: 1100 }}>
      <div
        className="modal-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="order-tag-modal-title"
        onClick={(e) => e.stopPropagation()}
        style={{
          maxWidth: '560px',
          width: '95vw',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          borderRadius: '16px',
          overflow: 'hidden',
          background: '#f8fafc',
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
              <Tag size={20} />
            </div>
            <div>
              <h3 id="order-tag-modal-title" style={{ margin: 0, fontSize: '16px', fontWeight: 700, color: '#0f172a' }}>
                Print Garment Tags
              </h3>
              <span style={{ fontSize: '11px', color: '#64748b' }}>
                Order #{orderNo} · {totalPieces} {totalPieces === 1 ? 'Piece' : 'Pieces'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="icon-button"
            onClick={onClose}
            aria-label="Close"
            style={{ borderRadius: '8px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Scrollable Content */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '18px',
          }}
        >
          {/* Piece Navigation Selector */}
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: '#ffffff',
              padding: '8px 12px',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
            }}
          >
            <button
              type="button"
              className="button button-quiet"
              disabled={currentPieceIndex === 0}
              onClick={() => setCurrentPieceIndex((p) => Math.max(0, p - 1))}
              style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
            >
              <ChevronLeft size={16} /> Prev
            </button>
            <div style={{ textAlign: 'center' }}>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                Tag {currentPieceIndex + 1} of {totalPieces}
              </strong>
              <div style={{ fontSize: '11px', color: '#64748b', maxWidth: '180px', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {currentPiece.name}
              </div>
            </div>
            <button
              type="button"
              className="button button-quiet"
              disabled={currentPieceIndex >= totalPieces - 1}
              onClick={() => setCurrentPieceIndex((p) => Math.min(totalPieces - 1, p + 1))}
              style={{ minHeight: '32px', padding: '0 10px', fontSize: '12px' }}
            >
              Next <ChevronRight size={16} />
            </button>
          </div>

          {/* PHYSICAL TAG PREVIEW (Exact match to reference image) */}
          <div
            style={{
              width: '260px',
              background: '#ffffff',
              border: '2px solid #000000',
              borderRadius: '4px',
              boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              textAlign: 'center',
              position: 'relative',
              userSelect: 'none',
              transform: 'rotate(-1deg)',
              transition: 'transform 0.15s ease',
            }}
          >
            {/* Plastic Fastener Pin Graphic Representation */}
            <div
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                width: '18px',
                height: '24px',
                pointerEvents: 'none',
                opacity: 0.18,
                border: '2.5px solid #000',
                borderRadius: '3px',
              }}
              title="Plastic fastener pin position"
            />

            {/* Line 1: Customer ID */}
            <div
              style={{
                fontSize: '18px',
                fontWeight: 800,
                color: '#000000',
                letterSpacing: '0.5px',
                lineHeight: 1.2,
              }}
            >
              {customerId}
            </div>

            {/* Line 2: Order Number in BOLD */}
            <div
              style={{
                fontSize: '24px',
                fontWeight: 900,
                color: '#000000',
                lineHeight: 1.25,
                margin: '2px 0',
                letterSpacing: '0.5px',
              }}
            >
              {orderNo}
            </div>

            {/* Line 3: Customer Name */}
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#000000',
                lineHeight: 1.2,
                maxWidth: '220px',
                overflowWrap: 'break-word',
              }}
            >
              {customerName}
            </div>

            {/* Line 4: Piece index / total (e.g. 22/22) */}
            <div
              style={{
                fontSize: '17px',
                fontWeight: 900,
                color: '#000000',
                lineHeight: 1.3,
                marginTop: '4px',
              }}
            >
              {tagCounter}
            </div>

            {/* Line 5: Service code (e.g. DC) */}
            <div
              style={{
                fontSize: '18px',
                fontWeight: 900,
                color: '#000000',
                lineHeight: 1.2,
                marginTop: '2px',
                letterSpacing: '1px',
              }}
            >
              {serviceCodeInput || 'DC'}
            </div>

            {/* Line 6: pcs & panel (e.g. 9 pcs 9 panel) */}
            <div
              style={{
                fontSize: '15px',
                fontWeight: 700,
                color: '#000000',
                lineHeight: 1.2,
                marginTop: '4px',
              }}
            >
              {pcsAndPanelStr}
            </div>

            {/* Line 7: Delivery date (e.g. 31 Oct 26 Sat) */}
            <div
              style={{
                fontSize: '16px',
                fontWeight: 800,
                color: '#000000',
                lineHeight: 1.3,
                marginTop: '4px',
              }}
            >
              {deliveryDateStr}
            </div>
          </div>

          {/* Quick Customization Options (Panels & Service Code) */}
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '12px 14px',
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gap: '10px',
            }}
          >
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                Panel Count (Optional)
              </label>
              <input
                type="text"
                className="input"
                value={panelInput}
                onChange={(e) => handlePanelChange(e.target.value)}
                placeholder="e.g. 9"
                style={{ minHeight: '34px', fontSize: '13px' }}
              />
            </div>
            <div>
              <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
                Service Code
              </label>
              <input
                type="text"
                className="input"
                value={serviceCodeInput}
                onChange={(e) => handleServiceCodeChange(e.target.value)}
                placeholder="DC"
                style={{ minHeight: '34px', fontSize: '13px', fontWeight: 700 }}
              />
            </div>
          </div>

          {/* WhatsApp Owner Recipient Setting */}
          <div
            style={{
              width: '100%',
              maxWidth: '380px',
              background: '#ffffff',
              borderRadius: '10px',
              border: '1px solid #e2e8f0',
              padding: '12px 14px',
            }}
          >
            <label style={{ fontSize: '11px', fontWeight: 700, color: '#475569', display: 'block', marginBottom: '4px' }}>
              Owner WhatsApp Number
            </label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <input
                type="tel"
                className="input"
                value={ownerPhone}
                onChange={(e) => setOwnerPhone(e.target.value)}
                placeholder="Owner Mobile No (e.g. 9876543210)"
                style={{ minHeight: '34px', fontSize: '13px', flex: '1 1 180px' }}
              />
              <button
                type="button"
                onClick={() => handleSendOwnerWhatsApp(false)}
                style={{
                  minHeight: '34px',
                  padding: '0 10px',
                  fontSize: '11px',
                  fontWeight: 700,
                  borderRadius: '8px',
                  border: '1px solid #86efac',
                  background: '#f0fdf4',
                  color: '#15803d',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
                title="Send currently selected tag to owner"
              >
                <Smartphone size={13} color="#16a34a" /> Tag #{currentPieceIndex + 1}
              </button>
              {totalPieces > 1 && (
                <button
                  type="button"
                  onClick={() => handleSendOwnerWhatsApp(true)}
                  style={{
                    minHeight: '34px',
                    padding: '0 10px',
                    fontSize: '11px',
                    fontWeight: 700,
                    borderRadius: '8px',
                    border: '1px solid #86efac',
                    background: '#dcfce7',
                    color: '#166534',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    cursor: 'pointer',
                    whiteSpace: 'nowrap',
                  }}
                  title="Send summary of all tags to owner"
                >
                  <Send size={13} color="#15803d" /> All {totalPieces} Tags
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '14px 20px',
            background: '#ffffff',
            borderTop: '1px solid #e2e8f0',
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '8px',
          }}
        >
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            <button
              type="button"
              className="button button-quiet"
              onClick={() => handleSendCustomerWhatsApp(false)}
              style={{ fontSize: '12px', minHeight: '36px', color: '#16a34a' }}
              title="Send currently selected tag to customer"
            >
              <MessageSquare size={14} /> Send Tag to Customer
            </button>
            {totalPieces > 1 && (
              <button
                type="button"
                className="button button-quiet"
                onClick={() => handleSendCustomerWhatsApp(true)}
                style={{ fontSize: '12px', minHeight: '36px', color: '#15803d', fontWeight: 700 }}
                title="Send all tags summary to customer"
              >
                <Send size={14} /> All Tags
              </button>
            )}
          </div>

          <div style={{ display: 'flex', gap: '8px', marginLeft: 'auto' }}>
            <button
              type="button"
              className="button button-secondary"
              onClick={() => handlePrint('single')}
              style={{ fontSize: '12px', minHeight: '36px', fontWeight: 600 }}
              title="Print just this single tag"
            >
              <Printer size={14} /> Print This Tag
            </button>

            <button
              type="button"
              className="button button-primary"
              onClick={() => handlePrint('all')}
              style={{
                fontSize: '12px',
                minHeight: '36px',
                fontWeight: 700,
                background: '#0f172a',
                color: '#ffffff',
              }}
              title="Print all tags for each garment piece on label/tag printer"
            >
              <Printer size={14} /> Print All {totalPieces} Tags
            </button>
          </div>
        </div>
      </div>

      {/* PRINT STYLESHEET & HIDDEN PRINT DOM */}
      <style>{`
        @page {
          size: 50mm 50mm;
          margin: 0;
        }
        @media print {
          body * {
            visibility: hidden !important;
          }
          #freshfold-tag-print-area, #freshfold-tag-print-area * {
            visibility: visible !important;
          }
          #freshfold-tag-print-area {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
            display: block !important;
          }
          .tag-print-label {
            page-break-after: always !important;
            break-after: page !important;
            width: 50mm !important;
            max-width: 50mm !important;
            min-height: 45mm !important;
            margin: 0 auto !important;
            padding: 4mm 3mm !important;
            box-sizing: border-box !important;
            font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif !important;
            color: #000000 !important;
            background: #ffffff !important;
            display: flex !important;
            flex-direction: column !important;
            justify-content: center !important;
            align-items: center !important;
            text-align: center !important;
          }
        }
      `}</style>

      {/* Actual elements to be printed by the tag printer */}
      <div id="freshfold-tag-print-area" style={{ display: 'none' }}>
        {(printMode === 'single' ? [pieceList[currentPieceIndex] || currentPiece] : pieceList).map((piece) => {
          const actualIdx = (piece.index || 1) - 1;
          const counter = `${piece.index}/${totalPieces}`;
          const p = getPiecePanel(actualIdx).trim();
          const pStr = p ? `${p} panel` : '';
          const pcsP = `${totalPieces} pcs${pStr ? ` ${pStr}` : ''}`;
          const sCode = getPieceServiceCode(actualIdx) || 'DC';

          return (
            <div key={actualIdx} className="tag-print-label">
              <div style={{ fontSize: '13pt', fontWeight: 800, lineHeight: 1.15 }}>
                {customerId}
              </div>
              <div style={{ fontSize: '18pt', fontWeight: 900, lineHeight: 1.2, margin: '2pt 0' }}>
                {orderNo}
              </div>
              <div style={{ fontSize: '11pt', fontWeight: 700, lineHeight: 1.2 }}>
                {customerName}
              </div>
              <div style={{ fontSize: '13pt', fontWeight: 900, lineHeight: 1.25, marginTop: '3pt' }}>
                {counter}
              </div>
              <div style={{ fontSize: '14pt', fontWeight: 900, lineHeight: 1.2, letterSpacing: '1pt', marginTop: '1pt' }}>
                {sCode}
              </div>
              <div style={{ fontSize: '11pt', fontWeight: 700, lineHeight: 1.2, marginTop: '3pt' }}>
                {pcsP}
              </div>
              <div style={{ fontSize: '12pt', fontWeight: 800, lineHeight: 1.25, marginTop: '3pt' }}>
                {deliveryDateStr}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
