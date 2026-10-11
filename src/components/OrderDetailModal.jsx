import React from 'react';
import {
  ArrowRight,
  CalendarDays,
  CheckCircle2,
  Clock,
  Clock3,
  CreditCard,
  FileText,
  MapPin,
  Package,
  Phone,
  ReceiptText,
  Scale,
  Shirt,
  Sparkles,
  Tag,
  Truck,
  User,
  Waves,
  X,
} from 'lucide-react';
import { formatDate, formatDateTime } from '../lib/pdfGenerator.js';
import { formatMoney } from '../lib/persistence.js';

const STATUS_STEPS = [
  { key: 'Received', label: '1. Received', icon: Package, desc: 'Intake recorded' },
  { key: 'Processing', label: '2. Processing', icon: Waves, desc: 'Wash & fabric care' },
  { key: 'Ready', label: '3. Ready', icon: Sparkles, desc: 'Packaged for pickup' },
  { key: 'Delivered', label: '4. Delivered', icon: Truck, desc: 'Handed to customer' },
];

export default function OrderDetailModal({
  isOpen,
  onClose,
  order,
  customer,
  payments = [],
  onUpdateStatus,
  onOpenPayment,
  onOpenReceipt,
  onToast,
}) {
  if (!isOpen || !order) return null;

  const isWeight = order.type === 'weight';
  const gross = Number(order.grossAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const total = Number(order.totalAmount || gross);
  const paid = Number(order.paidAmount || 0);
  const balance = Number(order.balanceAmount ?? (total - paid));

  const currentStepIndex = STATUS_STEPS.findIndex((s) => s.key === order.status);

  const handleStatusChange = async (nextStatus) => {
    try {
      await onUpdateStatus(order.id, nextStatus);
      onToast?.(`Order marked as ${nextStatus}.`);
    } catch (err) {
      onToast?.(err.message || 'Status could not be updated.');
    }
  };

  const handleAdvanceStatus = () => {
    if (currentStepIndex >= 0 && currentStepIndex < STATUS_STEPS.length - 1) {
      handleStatusChange(STATUS_STEPS[currentStepIndex + 1].key);
    }
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div
        className="modal-panel"
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '740px',
          maxWidth: '96vw',
          maxHeight: '94vh',
          display: 'flex',
          flexDirection: 'column',
          background: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 25px 70px rgba(15, 23, 42, 0.22)',
          overflow: 'hidden',
        }}
      >
        {/* Header */}
        <div
          className="modal-header"
          style={{
            padding: '16px 22px',
            borderBottom: '1px solid #e2e8f0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: '#ffffff',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '38px',
                height: '38px',
                borderRadius: '8px',
                background: '#eff6ff',
                color: '#1d4ed8',
                display: 'grid',
                placeItems: 'center',
                flexShrink: 0,
              }}
            >
              {isWeight ? <Scale size={19} /> : <Shirt size={19} />}
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span className="caption-label">Order Details</span>
                <span
                  style={{
                    fontSize: '10px',
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: '6px',
                    background:
                      order.status === 'Delivered'
                        ? '#f1f5f9'
                        : order.status === 'Ready'
                        ? '#ecfdf5'
                        : order.status === 'Processing'
                        ? '#eff6ff'
                        : '#fffbeb',
                    color:
                      order.status === 'Delivered'
                        ? '#475569'
                        : order.status === 'Ready'
                        ? '#059669'
                        : order.status === 'Processing'
                        ? '#2563eb'
                        : '#d97706',
                  }}
                >
                  {order.status.toUpperCase()}
                </span>
              </div>
              <h3 style={{ margin: 0, fontSize: '17px', color: '#0f172a', fontWeight: 800 }}>
                #{order.orderNo} · {customer?.name || 'Customer'}
              </h3>
            </div>
          </div>

          <button
            className="icon-button"
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{ width: '36px', height: '36px' }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Modal Scrollable Body */}
        <div
          className="modal-content"
          style={{
            padding: '22px',
            overflowY: 'auto',
            flex: 1,
            display: 'grid',
            gap: '18px',
            background: '#f8fafc',
          }}
        >
          {/* 1. Status Pipeline Stepper */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 18px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '14px',
              }}
            >
              <div>
                <span style={{ fontSize: '11px', fontWeight: 700, color: '#64748b', letterSpacing: '0.05em' }}>
                  ORDER STATUS PIPELINE
                </span>
                <span style={{ fontSize: '11px', color: '#94a3b8', marginLeft: '6px' }}>
                  (Click any stage to update)
                </span>
              </div>

              {currentStepIndex < STATUS_STEPS.length - 1 && (
                <button
                  type="button"
                  className="button button-quiet"
                  onClick={handleAdvanceStatus}
                  style={{
                    minHeight: '32px',
                    padding: '0 12px',
                    fontSize: '11px',
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '5px',
                    color: '#1d4ed8',
                    borderColor: '#bfdbfe',
                    background: '#eff6ff',
                    fontWeight: 700,
                  }}
                >
                  Advance to {STATUS_STEPS[currentStepIndex + 1].key} <ArrowRight size={13} />
                </button>
              )}
            </div>

            {/* Stepper Steps Grid */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(4, 1fr)',
                gap: '8px',
              }}
            >
              {STATUS_STEPS.map((step, idx) => {
                const StepIcon = step.icon;
                const isCurrent = order.status === step.key;
                const isPassed = currentStepIndex >= idx;

                return (
                  <button
                    key={step.key}
                    type="button"
                    onClick={() => handleStatusChange(step.key)}
                    style={{
                      padding: '12px 10px',
                      borderRadius: '8px',
                      border: isCurrent
                        ? '1.5px solid #2563eb'
                        : isPassed
                        ? '1px solid #bfdbfe'
                        : '1px solid #e2e8f0',
                      background: isCurrent
                        ? '#2563eb'
                        : isPassed
                        ? '#eff6ff'
                        : '#ffffff',
                      color: isCurrent ? '#ffffff' : isPassed ? '#1d4ed8' : '#64748b',
                      cursor: 'pointer',
                      textAlign: 'left',
                      transition: 'all 0.15s ease',
                      display: 'grid',
                      gap: '4px',
                      boxShadow: isCurrent ? '0 2px 6px rgba(37, 99, 235, 0.2)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                      <StepIcon size={16} color={isCurrent ? '#ffffff' : isPassed ? '#2563eb' : '#94a3b8'} />
                      {isPassed && !isCurrent && (
                        <CheckCircle2 size={13} color="#2563eb" />
                      )}
                    </div>
                    <strong style={{ fontSize: '11.5px', fontWeight: 700 }}>
                      {step.label}
                    </strong>
                    <span
                      style={{
                        fontSize: '9.5px',
                        color: isCurrent ? '#eff6ff' : isPassed ? '#1e40af' : '#94a3b8',
                      }}
                    >
                      {step.desc}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 2. Key Highlights Strip (Customer, Schedule, Balance) */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: '12px',
            }}
          >
            {/* Customer info card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'grid',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '10px', fontWeight: 700 }}>
                <User size={13} /> CUSTOMER
              </div>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>{customer?.name || 'Walk-in'}</strong>
              <div style={{ fontSize: '11px', color: '#475569', display: 'flex', alignItems: 'center', gap: '4px' }}>
                <Phone size={11} /> +91 {customer?.mobile || '—'}
              </div>
              {customer?.address && (
                <div style={{ fontSize: '10px', color: '#64748b', display: 'flex', alignItems: 'center', gap: '4px' }}>
                  <MapPin size={11} /> {customer.address}
                </div>
              )}
            </div>

            {/* Schedule card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'grid',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '10px', fontWeight: 700 }}>
                <CalendarDays size={13} /> PROMISED READY
              </div>
              <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                {formatDate(order.dueDate)}
              </strong>
              <div style={{ fontSize: '11px', color: '#64748b' }}>
                Intake: {formatDateTime(order.createdAt)}
              </div>
            </div>

            {/* Service & Payment Overview card */}
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '12px 14px',
                display: 'grid',
                gap: '4px',
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#64748b', fontSize: '10px', fontWeight: 700 }}>
                <CreditCard size={13} /> BILL & BALANCE
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '11px', color: '#64748b' }}>Total Bill:</span>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>{formatMoney(order.totalAmount)}</strong>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
                <span style={{ fontSize: '11px', color: balance > 0 ? '#dc2626' : '#15803d', fontWeight: 700 }}>
                  {balance > 0 ? 'Balance Due:' : 'Status:'}
                </span>
                <strong style={{ fontSize: '12px', color: balance > 0 ? '#dc2626' : '#15803d' }}>
                  {balance > 0 ? formatMoney(balance) : 'Paid in Full ✓'}
                </strong>
              </div>
            </div>
          </div>

          {/* 3. Garments Breakdown Section */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 18px',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '12px',
              }}
            >
              <div>
                <strong style={{ fontSize: '13px', color: '#0f172a' }}>Garment Breakdown</strong>
                <span style={{ fontSize: '11px', color: '#64748b', marginLeft: '6px' }}>
                  ({isWeight ? `Weight Laundry: ${order.service}` : `${order.items?.length || 0} Line Items`})
                </span>
              </div>
            </div>

            <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
              {isWeight ? (
                <div style={{ padding: '14px 16px', background: '#ffffff', display: 'grid', gap: '8px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                        {order.service} ({order.weightKg} kg)
                      </strong>
                      {order.weightClothesCount && (
                        <span
                          style={{
                            marginLeft: '8px',
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '6px',
                            background: '#eff6ff',
                            color: '#1d4ed8',
                          }}
                        >
                          {order.weightClothesCount} Clothes in Bag
                        </span>
                      )}
                    </div>
                    <strong style={{ fontSize: '13px', color: '#0f172a' }}>
                      {formatMoney(order.grossAmount)}
                    </strong>
                  </div>

                  {Array.isArray(order.weightGarments) && order.weightGarments.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#334155', background: '#f8fafc', padding: '8px 10px', borderRadius: '6px' }}>
                      <strong style={{ color: '#0f172a' }}>Clothes Breakdown: </strong>
                      {order.weightGarments.map((g) => `${g.name} × ${g.quantity}`).join(', ')}
                    </div>
                  )}

                  {Array.isArray(order.weightAddons) && order.weightAddons.length > 0 && (
                    <div style={{ fontSize: '11px', color: '#15803d', background: '#f0fdf4', padding: '8px 10px', borderRadius: '6px' }}>
                      <strong>Top-up Services: </strong>
                      {order.weightAddons.map((a) => `${a.name} (+₹${a.price})`).join(', ')}
                    </div>
                  )}

                  {order.weightNote && (
                    <div style={{ fontSize: '11px', color: '#64748b', fontStyle: 'italic' }}>
                      Special Note: {order.weightNote}
                    </div>
                  )}
                </div>
              ) : (
                (order.items || []).map((item, idx) => {
                  const addonExtra = (item.addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
                  const effectiveUnitPrice = Number(item.unitPrice || 0) + addonExtra;
                  const lineTotal = item.quantity * effectiveUnitPrice;
                  const tags = [
                    item.brand ? `Brand: ${item.brand}` : '',
                    item.color ? `Color: ${item.color}` : '',
                    ...(item.defects || []),
                  ].filter(Boolean);

                  return (
                    <div
                      key={idx}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '11px 14px',
                        background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                        borderBottom: idx === order.items.length - 1 ? 'none' : '1px solid #f1f5f9',
                      }}
                    >
                      <div style={{ flex: 1, minWidth: 0, marginRight: '12px' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>{item.name}</strong>
                          <span
                            style={{
                              fontSize: '9.5px',
                              fontWeight: 700,
                              padding: '1px 6px',
                              borderRadius: '4px',
                              background: '#eff6ff',
                              color: '#1d4ed8',
                            }}
                          >
                            {item.service || order.service}
                          </span>
                          <span style={{ fontSize: '10px', color: '#94a3b8' }}>
                            [{item.barcode || `${order.orderNo}-${idx + 1}`}]
                          </span>
                        </div>

                        {tags.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {tags.map((t, ti) => (
                              <span
                                key={ti}
                                style={{
                                  fontSize: '9.5px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: '#f3e8ff',
                                  color: '#7e22ce',
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}

                        {Array.isArray(item.addons) && item.addons.length > 0 && (
                          <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '4px' }}>
                            {item.addons.map((a, ai) => (
                              <span
                                key={ai}
                                style={{
                                  fontSize: '9.5px',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  background: '#dcfce7',
                                  color: '#15803d',
                                }}
                              >
                                ⭐ {a.name} (+₹{a.price})
                              </span>
                            ))}
                          </div>
                        )}

                        {item.note && (
                          <small style={{ display: 'block', color: '#64748b', marginTop: '2px', fontStyle: 'italic' }}>
                            Note: {item.note}
                          </small>
                        )}
                      </div>

                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontSize: '11px', color: '#64748b' }}>
                          {item.quantity} × {formatMoney(effectiveUnitPrice)}
                        </div>
                        <strong style={{ fontSize: '12.5px', color: '#0f172a' }}>
                          {formatMoney(lineTotal)}
                        </strong>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* 4. Financial Summary Card */}
          <div
            style={{
              background: '#ffffff',
              border: '1px solid #e2e8f0',
              borderRadius: '12px',
              padding: '16px 18px',
              display: 'grid',
              gap: '6px',
              fontSize: '12px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
              <span>Gross Amount:</span>
              <span>{formatMoney(order.grossAmount)}</span>
            </div>

            {order.discountAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
                <span>Discount ({order.discountName || `${order.discountPercent}%`}):</span>
                <span>-{formatMoney(order.discountAmount)}</span>
              </div>
            )}

            {order.taxAmount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', color: '#64748b' }}>
                <span>Tax / GST:</span>
                <span>{formatMoney(order.taxAmount)}</span>
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                paddingTop: '8px',
                marginTop: '2px',
                borderTop: '1px solid #e2e8f0',
                fontWeight: 800,
                fontSize: '13.5px',
                color: '#0f172a',
              }}
            >
              <span>Total Bill:</span>
              <span>{formatMoney(order.totalAmount)}</span>
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', color: '#16a34a' }}>
              <span>Paid Amount:</span>
              <span>{formatMoney(order.paidAmount)}</span>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                fontWeight: 800,
                fontSize: '14px',
                color: balance > 0 ? '#dc2626' : '#16a34a',
                paddingTop: '4px',
              }}
            >
              <span>Balance Due:</span>
              <span>{balance > 0 ? formatMoney(balance) : '₹0.00 (Settled)'}</span>
            </div>
          </div>

          {/* 5. Payment Transactions Log (if any) */}
          {payments.length > 0 && (
            <div
              style={{
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '12px',
                padding: '14px 18px',
              }}
            >
              <span
                style={{
                  fontSize: '11px',
                  fontWeight: 700,
                  color: '#64748b',
                  display: 'block',
                  marginBottom: '8px',
                  letterSpacing: '0.04em',
                }}
              >
                PAYMENT TRANSACTION HISTORY
              </span>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden' }}>
                {payments.map((p, idx) => (
                  <div
                    key={idx}
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      padding: '9px 12px',
                      background: idx % 2 === 0 ? '#ffffff' : '#f8fafc',
                      borderBottom: idx === payments.length - 1 ? 'none' : '1px solid #f1f5f9',
                      fontSize: '11.5px',
                    }}
                  >
                    <div>
                      <span style={{ fontWeight: 600, color: '#0f172a' }}>
                        Method: {p.method.toUpperCase()}
                      </span>
                      <small style={{ color: '#64748b', marginLeft: '8px' }}>
                        {formatDateTime(p.createdAt)}
                      </small>
                    </div>
                    <strong style={{ color: '#15803d' }}>{formatMoney(p.amount)}</strong>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer Actions */}
        <div
          className="modal-footer"
          style={{
            padding: '14px 22px',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            borderTop: '1px solid #e2e8f0',
            background: '#ffffff',
          }}
        >
          <button
            type="button"
            className="button button-quiet"
            onClick={onOpenReceipt}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '12px',
              fontWeight: 700,
            }}
          >
            <ReceiptText size={16} /> Bill & 80mm Receipt
          </button>

          <div style={{ display: 'flex', gap: '8px' }}>
            {balance > 0 && (
              <button
                type="button"
                className="button button-primary"
                onClick={onOpenPayment}
                style={{
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '6px',
                  fontSize: '12px',
                  fontWeight: 700,
                }}
              >
                <CreditCard size={15} /> Collect Payment ({formatMoney(balance)})
              </button>
            )}

            <button
              type="button"
              className="button button-quiet"
              onClick={onClose}
              style={{ fontSize: '12px' }}
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
