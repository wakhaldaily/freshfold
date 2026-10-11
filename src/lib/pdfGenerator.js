import { jsPDF } from 'jspdf';

/**
 * Format money as INR for display on receipt text/PDF.
 * Uses "Rs." for pure ASCII / PDF compatibility so it never shows broken glyphs.
 */
export function formatMoneyPdf(amount) {
  const num = Number(amount || 0);
  return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

export function formatDateTime(isoString) {
  if (!isoString) return new Date().toLocaleString('en-IN');
  const d = new Date(isoString);
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

export function formatDate(isoString) {
  if (!isoString) return '—';
  const d = new Date(isoString.slice(0, 10));
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Generates an authentic 80mm thermal receipt PDF document using jsPDF.
 */
export function generateThermalReceiptPdf({
  order,
  customer,
  settings,
  payments = [],
  cashierName = 'Store Cashier',
}) {
  const store = {
    name: settings?.storeName || 'Fresh Fold',
    tagline: settings?.tagline || 'Premium Fabric Care & Dry Cleaning',
    phone: settings?.phone || '+91 98765 43210',
    address: settings?.address || 'Shop 14, Galleria Market, Sector 28, Gurugram',
    taxNumber: settings?.taxNumber || '07AAAAA0000A1Z5',
    taxLabel: settings?.taxLabel || 'GST',
    taxPercent: Number(settings?.taxPercent ?? 18),
    taxEnabled: settings?.taxEnabled ?? true,
    splitGst: settings?.splitGst ?? true,
    footer: settings?.receiptFooter || 'Thank you for choosing Fresh Fold! Goods not collected within 30 days are not store liability.',
  };

  const items = Array.isArray(order.items) ? order.items : [];
  const isWeight = order.type === 'weight';

  // Calculate dynamic receipt height based on lines
  // Base header: 42mm, Meta: 24mm, Items: 10 + N*7mm, Breakdown: 38mm, Payments: 15mm, Footer: 28mm
  const itemsCount = isWeight ? 1 : Math.max(1, items.length);
  const paymentsCount = Math.max(1, payments.length);
  const calculatedHeight = 44 + 26 + (itemsCount * 7.5) + 42 + (paymentsCount * 5.5) + 30;
  const pageHeight = Math.max(140, Math.ceil(calculatedHeight));
  const pageWidth = 80; // Standard 80mm POS thermal roll width

  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  doc.setFont('courier', 'normal');

  let y = 8;
  const leftX = 5;
  const rightX = 75;
  const centerX = 40;

  const hr = () => {
    doc.setFontSize(8);
    doc.text('- - - - - - - - - - - - - - - - - - - - - - -', centerX, y, { align: 'center' });
    y += 4;
  };

  const dblHr = () => {
    doc.setFontSize(8);
    doc.text('============================================= ', centerX, y, { align: 'center' });
    y += 4;
  };

  // 1. STORE HEADER
  doc.setFont('courier', 'bold');
  doc.setFontSize(13);
  doc.text(store.name.toUpperCase(), centerX, y, { align: 'center' });
  y += 4.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);
  if (store.tagline) {
    doc.text(store.tagline, centerX, y, { align: 'center' });
    y += 3.5;
  }
  if (store.address) {
    const addressLines = doc.splitTextToSize(store.address, 68);
    doc.text(addressLines, centerX, y, { align: 'center' });
    y += addressLines.length * 3.2;
  }
  if (store.phone) {
    doc.text(`Phone: ${store.phone}`, centerX, y, { align: 'center' });
    y += 3.5;
  }
  if (store.taxNumber && store.taxEnabled) {
    doc.text(`${store.taxLabel}IN: ${store.taxNumber}`, centerX, y, { align: 'center' });
    y += 3.5;
  }

  y += 1;
  dblHr();

  // 2. RECEIPT TYPE & ORDER META
  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text(store.taxEnabled ? 'TAX INVOICE / CASH MEMO' : 'RETAIL ORDER RECEIPT', centerX, y, { align: 'center' });
  y += 4.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text(`Order No  : #${order.orderNo || order.id?.slice(0, 8)}`, leftX, y);
  doc.text(`Type: ${order.type === 'weight' ? 'Weight' : 'Pieces'}`, rightX, y, { align: 'right' });
  y += 3.6;

  doc.text(`Date/Time : ${formatDateTime(order.createdAt)}`, leftX, y);
  y += 3.6;

  doc.text(`Promised  : ${formatDate(order.dueDate)}`, leftX, y);
  doc.text(`By: ${cashierName.slice(0, 10)}`, rightX, y, { align: 'right' });
  y += 3.6;

  // Customer Info
  doc.text(`Customer  : ${(customer?.name || 'Walk-in Customer').slice(0, 22)}`, leftX, y);
  y += 3.6;
  doc.text(`Mobile    : ${customer?.mobile || '—'}`, leftX, y);
  y += 3.6;

  if (customer?.gstin || order?.customerGstin) {
    doc.text(`Cust GSTIN: ${customer?.gstin || order?.customerGstin}`, leftX, y);
    y += 3.6;
  }
  const pref = customer?.preference || order?.customerPreference;
  if (pref && pref !== 'NA') {
    doc.text(`Wash Pref : ${pref.slice(0, 22)}`, leftX, y);
    y += 3.6;
  }
  y += 0.4;

  hr();

  // 3. ITEM TABLE HEADER
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.text('ITEM / SERVICE', leftX, y);
  doc.text('QTY', 42, y, { align: 'center' });
  doc.text('RATE', 56, y, { align: 'right' });
  doc.text('AMOUNT', rightX, y, { align: 'right' });
  y += 3.2;
  hr();

  // 4. ITEMS LIST
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);

  if (isWeight) {
    doc.setFont('courier', 'bold');
    doc.text(`Weight Laundry: ${order.service || 'Bulk Wash'}`, leftX, y);
    y += 3.2;
    doc.setFont('courier', 'normal');
    const rate = order.weightKg > 0 ? (order.grossAmount / order.weightKg).toFixed(2) : '—';
    doc.text(`Weight: ${order.weightKg} kg (${order.weightClothesCount ? `${order.weightClothesCount} pcs` : 'Bulk'})`, leftX, y);
    doc.text(`${order.grossAmount.toFixed(2)}`, rightX, y, { align: 'right' });
    y += 3.4;

    if (Array.isArray(order.weightGarments) && order.weightGarments.length > 0) {
      doc.setFontSize(6.8);
      const breakdownText = `Clothes: ${order.weightGarments.map((g) => `${g.name} x${g.quantity}`).join(', ')}`;
      doc.text(breakdownText.slice(0, 48), leftX, y);
      y += 3.2;
      doc.setFontSize(7.5);
    }

    if (Array.isArray(order.weightAddons) && order.weightAddons.length > 0) {
      doc.setFontSize(6.8);
      const addonsText = `Add-ons: ${order.weightAddons.map((a) => `${a.name}(+Rs.${a.price})`).join(', ')}`;
      doc.text(addonsText.slice(0, 48), leftX, y);
      y += 3.2;
      doc.setFontSize(7.5);
    }

    if (order.weightNote) {
      doc.setFontSize(6.8);
      doc.text(`Note: ${order.weightNote.slice(0, 36)}`, leftX, y);
      y += 3.2;
      doc.setFontSize(7.5);
    }
  } else if (items.length > 0) {
    items.forEach((item) => {
      const addonExtra = (item.addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
      const unitWithAddons = Number(item.unitPrice || 0) + addonExtra;
      const lineTotal = Number(item.quantity || 1) * unitWithAddons;

      doc.setFont('courier', 'bold');
      const nameText = `${item.name} (${item.service || order.service || 'Service'})`;
      doc.text(nameText.slice(0, 32), leftX, y);
      y += 3.2;

      doc.setFont('courier', 'normal');
      if (item.barcode) {
        doc.text(`[${item.barcode}]`, leftX, y);
      } else {
        doc.text(item.category ? item.category : 'Standard', leftX, y);
      }
      doc.text(`${item.quantity}`, 42, y, { align: 'center' });
      doc.text(`${unitWithAddons.toFixed(2)}`, 56, y, { align: 'right' });
      doc.text(`${lineTotal.toFixed(2)}`, rightX, y, { align: 'right' });
      y += 3.2;

      // Item Tagging (Brand, Color, Defects)
      const tagsList = [item.brand ? `Brand:${item.brand}` : '', item.color ? `Color:${item.color}` : '', ...(item.defects || [])].filter(Boolean);
      if (tagsList.length > 0) {
        doc.setFontSize(6.8);
        doc.text(`Tags: ${tagsList.join(' · ').slice(0, 48)}`, leftX, y);
        y += 2.8;
        doc.setFontSize(7.5);
      }

      // Item Add-ons
      if (Array.isArray(item.addons) && item.addons.length > 0) {
        doc.setFontSize(6.8);
        doc.text(`Top-ups: ${item.addons.map((a) => `${a.name}(+${a.price})`).join(', ').slice(0, 48)}`, leftX, y);
        y += 2.8;
        doc.setFontSize(7.5);
      }

      y += 1.2;
    });
  } else {
    doc.text('No items specified', leftX, y);
    doc.text(`${order.grossAmount.toFixed(2)}`, rightX, y, { align: 'right' });
    y += 4;
  }

  hr();

  // 5. TOTALS & TAX BREAKDOWN
  const gross = Number(order.grossAmount || 0);
  const discount = Number(order.discountAmount || 0);
  const taxable = gross - discount;
  const tax = Number(order.taxAmount || 0);
  const total = Number(order.totalAmount || (taxable + tax));
  const paid = Number(order.paidAmount || 0);
  const balance = Number(order.balanceAmount ?? (total - paid));

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);

  doc.text('Gross Amount:', 40, y, { align: 'right' });
  doc.text(formatMoneyPdf(gross), rightX, y, { align: 'right' });
  y += 3.6;

  if (discount > 0) {
    const discountLabel = order.discountName ? `Discount (${order.discountName}):` : `Discount (${order.discountPercent}%):`;
    doc.text(discountLabel.slice(0, 24), 40, y, { align: 'right' });
    doc.text(`-${formatMoneyPdf(discount)}`, rightX, y, { align: 'right' });
    y += 3.6;

    doc.text('Taxable Subtotal:', 40, y, { align: 'right' });
    doc.text(formatMoneyPdf(taxable), rightX, y, { align: 'right' });
    y += 3.6;
  }

  if (store.taxEnabled && tax > 0) {
    if (store.splitGst) {
      const halfRate = (store.taxPercent / 2).toFixed(1);
      const halfTax = tax / 2;
      doc.text(`CGST (${halfRate}%):`, 40, y, { align: 'right' });
      doc.text(formatMoneyPdf(halfTax), rightX, y, { align: 'right' });
      y += 3.6;

      doc.text(`SGST (${halfRate}%):`, 40, y, { align: 'right' });
      doc.text(formatMoneyPdf(halfTax), rightX, y, { align: 'right' });
      y += 3.6;
    } else {
      doc.text(`${store.taxLabel} (${store.taxPercent}%):`, 40, y, { align: 'right' });
      doc.text(formatMoneyPdf(tax), rightX, y, { align: 'right' });
      y += 3.6;
    }
  }

  y += 1;
  dblHr();

  // GRAND TOTAL
  doc.setFont('courier', 'bold');
  doc.setFontSize(10);
  doc.text('NET TOTAL:', 40, y, { align: 'right' });
  doc.text(formatMoneyPdf(total), rightX, y, { align: 'right' });
  y += 4.5;

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);
  doc.text('Paid to Date:', 40, y, { align: 'right' });
  doc.text(formatMoneyPdf(paid), rightX, y, { align: 'right' });
  y += 3.6;

  doc.setFont('courier', 'bold');
  doc.setFontSize(9);
  doc.text('BALANCE DUE:', 40, y, { align: 'right' });
  doc.text(formatMoneyPdf(balance), rightX, y, { align: 'right' });
  y += 4.5;

  hr();

  // 6. PAYMENTS RECORD
  if (payments.length > 0) {
    doc.setFont('courier', 'bold');
    doc.setFontSize(7.5);
    doc.text('PAYMENTS COLLECTED', leftX, y);
    y += 3.2;
    doc.setFont('courier', 'normal');
    payments.forEach((p) => {
      const pMethod = (p.method || 'cash').toUpperCase();
      const pDate = formatDateTime(p.createdAt);
      doc.text(`${pDate} [${pMethod}]`, leftX, y);
      doc.text(formatMoneyPdf(p.amount), rightX, y, { align: 'right' });
      y += 3.2;
    });
    hr();
  }

  // 7. FOOTER & BARCODE SIMULATION
  doc.setFont('courier', 'normal');
  doc.setFontSize(7);
  doc.text(`* * * ${order.orderNo || order.id} * * *`, centerX, y, { align: 'center' });
  y += 3.5;

  if (store.footer) {
    const footerLines = doc.splitTextToSize(store.footer, 70);
    doc.text(footerLines, centerX, y, { align: 'center' });
    y += footerLines.length * 3;
  }

  y += 2;
  doc.setFont('courier', 'bold');
  doc.text('WASH WITH CARE - FOLD WITH LOVE', centerX, y, { align: 'center' });

  return doc;
}

/**
 * Download the generated 80mm PDF to the user's filesystem.
 */
export function downloadThermalReceiptPdf(options) {
  const doc = generateThermalReceiptPdf(options);
  const filename = `Fresh_Fold_Receipt_${options.order.orderNo || options.order.id}.pdf`;
  doc.save(filename);
}

/**
 * Returns PDF as Blob for sharing.
 */
export function getThermalReceiptBlob(options) {
  const doc = generateThermalReceiptPdf(options);
  return doc.output('blob');
}

/**
 * Builds clean plain-text invoice summary suitable for WhatsApp or clipboard.
 */
export function getReceiptShareText({ order, customer, settings, payments = [] }) {
  const storeName = settings?.storeName || 'Fresh Fold';
  const phone = settings?.phone || '';
  const total = Number(order.totalAmount || 0);
  const paid = Number(order.paidAmount || 0);
  const balance = Number(order.balanceAmount ?? (total - paid));

  let text = `🧺 *${storeName.toUpperCase()} - ORDER RECEIPT*\n`;
  text += `--------------------------------\n`;
  text += `📋 *Order No:* #${order.orderNo || order.id}\n`;
  text += `👤 *Customer:* ${customer?.name || 'Valued Customer'}\n`;
  text += `📅 *Date:* ${formatDateTime(order.createdAt)}\n`;
  text += `🚚 *Promised Date:* ${formatDate(order.dueDate)}\n`;
  text += `--------------------------------\n`;

  if (order.type === 'weight') {
    text += `⚖️ *Weight Laundry:* ${order.service}\n`;
    text += `• Weight: ${order.weightKg} kg (${order.weightClothesCount ? `${order.weightClothesCount} pcs` : 'Bulk'})\n`;
    if (Array.isArray(order.weightGarments) && order.weightGarments.length > 0) {
      text += `• Clothes: ${order.weightGarments.map((g) => `${g.name} x${g.quantity}`).join(', ')}\n`;
    }
    if (Array.isArray(order.weightAddons) && order.weightAddons.length > 0) {
      text += `• Top-ups: ${order.weightAddons.map((a) => `${a.name} (+₹${a.price})`).join(', ')}\n`;
    }
    if (order.weightNote) {
      text += `• Note: ${order.weightNote}\n`;
    }
  } else if (Array.isArray(order.items)) {
    text += `*ITEMS:*\n`;
    order.items.forEach((item) => {
      const addonExtra = (item.addons || []).reduce((sum, a) => sum + Number(a.price || 0), 0);
      const lineUnit = Number(item.unitPrice || 0) + addonExtra;
      const lineTot = item.quantity * lineUnit;
      text += `• ${item.quantity}x ${item.name} (${item.service || order.service}) - ₹${lineTot.toFixed(2)}\n`;
      const tags = [item.brand ? `Brand: ${item.brand}` : '', item.color ? `Color: ${item.color}` : '', ...(item.defects || [])].filter(Boolean);
      if (tags.length > 0) {
        text += `   ↳ ${tags.join(' | ')}\n`;
      }
      if (Array.isArray(item.addons) && item.addons.length > 0) {
        text += `   ↳ Add-ons: ${item.addons.map((a) => `${a.name}(+₹${a.price})`).join(', ')}\n`;
      }
    });
  }

  text += `--------------------------------\n`;
  text += `Gross Amount: ₹${order.grossAmount?.toFixed(2) || '0.00'}\n`;
  if (order.discountAmount > 0) {
    text += `Discount (${order.discountName || `${order.discountPercent}%`}): -₹${order.discountAmount.toFixed(2)}\n`;
  }
  if (order.taxAmount > 0) {
    text += `Tax (${settings?.taxLabel || 'GST'} ${settings?.taxPercent || 18}%): ₹${order.taxAmount.toFixed(2)}\n`;
  }
  text += `*NET TOTAL: ₹${total.toFixed(2)}*\n`;
  text += `Amount Paid: ₹${paid.toFixed(2)}\n`;
  text += `*Balance Due: ₹${balance.toFixed(2)}*\n`;
  text += `Status: ${order.status}\n`;
  text += `--------------------------------\n`;
  if (phone) text += `📞 Need help? Call ${phone}\n`;
  text += `Thank you for your business!`;

  return text;
}

/**
 * Open WhatsApp with prefilled message.
 */
export function shareReceiptWhatsApp(options) {
  const customerMobile = String(options.customer?.mobile || '').replace(/\D/g, '');
  const text = getReceiptShareText(options);
  const encoded = encodeURIComponent(text);
  const target = customerMobile.length >= 10
    ? `https://api.whatsapp.com/send?phone=91${customerMobile.slice(-10)}&text=${encoded}`
    : `https://api.whatsapp.com/send?text=${encoded}`;
  window.open(target, '_blank');
}

/**
 * Web Share API (share PDF file if supported, or text fallback).
 */
export async function shareReceiptViaWebShare(options) {
  const filename = `Fresh_Fold_Receipt_${options.order.orderNo || options.order.id}.pdf`;
  const text = getReceiptShareText(options);
  const blob = getThermalReceiptBlob(options);
  const file = new File([blob], filename, { type: 'application/pdf' });

  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({
        title: `Fresh Fold Receipt #${options.order.orderNo}`,
        text: `Here is your receipt for order #${options.order.orderNo}`,
        files: [file],
      });
      return { success: true, method: 'file' };
    } catch (e) {
      if (e.name === 'AbortError') return { success: false, aborted: true };
    }
  }

  if (navigator.share) {
    try {
      await navigator.share({
        title: `FreshFold Receipt #${options.order.orderNo}`,
        text,
      });
      return { success: true, method: 'text' };
    } catch (e) {
      if (e.name === 'AbortError') return { success: false, aborted: true };
    }
  }

  // Fallback: copy text to clipboard
  if (navigator.clipboard) {
    await navigator.clipboard.writeText(text);
    return { success: true, method: 'clipboard' };
  }

  return { success: false };
}
