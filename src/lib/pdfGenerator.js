import { jsPDF } from 'jspdf';
import { buildPublicBillUrl } from './billSecurity.js';
import { formatDate, formatDateTime, parseDateInput } from './dateFormat.js';
import { calculateLineDiscounts, getOrderTotalDiscount } from './orderPricing.js';

export { formatDate, formatDateTime } from './dateFormat.js';

/** Coerces any numeric-ish value (undefined, null, string) to a finite number. */
function num(x) {
  const n = Number(x || 0);
  return Number.isFinite(n) ? n : 0;
}

function round2(x) {
  return Math.round((num(x) + Number.EPSILON) * 100) / 100;
}

/**
 * Splits a tax amount into CGST/SGST halves. Each half is rounded to 2 decimals and
 * the second half absorbs the remainder so that a + b === tax (to 2 decimals).
 */
export function splitTax(tax) {
  const total = round2(tax);
  const first = round2(total / 2);
  const second = round2(total - first);
  return [first, second];
}

/**
 * Allocates a discount across line amounts proportionally, with the rounding
 * remainder placed on the last line so the parts sum exactly to the discount.
 */
export function allocateDiscount(lineAmounts = [], discount = 0) {
  const amounts = lineAmounts.map((a) => Math.max(0, num(a)));
  const totalLines = amounts.reduce((s, a) => s + a, 0);
  const target = round2(Math.min(Math.max(0, num(discount)), totalLines));
  if (amounts.length === 0) return [];
  if (target <= 0 || totalLines <= 0) return amounts.map(() => 0);

  const parts = [];
  let allocated = 0;
  amounts.forEach((amt, idx) => {
    if (idx === amounts.length - 1) {
      parts.push(round2(target - allocated));
    } else {
      const share = round2((amt / totalLines) * target);
      parts.push(share);
      allocated = round2(allocated + share);
    }
  });
  return parts;
}

/**
 * Format money as INR for display on receipt text/PDF.
 * Uses "Rs." for pure ASCII / PDF compatibility so it never shows broken glyphs.
 */
export function formatMoneyPdf(amount) {
  const num = Number(amount || 0);
  return `Rs. ${num.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
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
  existingDoc = null,
}) {
  const store = {
    name: settings?.storeName || 'Clean Clear Dry Cleaning',
    tagline: settings?.tagline || 'Premium Fabric Care & Dry Cleaning',
    phone: settings?.phone || '+91 98765 43210',
    address: settings?.address || 'Shop 14, Galleria Market, Sector 28, Gurugram',
    taxNumber: settings?.taxNumber || '',
    taxLabel: settings?.taxLabel || 'GST',
    taxPercent: Number(settings?.taxPercent ?? 18),
    taxEnabled: settings?.taxEnabled ?? true,
    splitGst: settings?.splitGst ?? true,
    footer: settings?.receiptFooter || 'Thank you for choosing Clean Clear Dry Cleaning! Goods not collected within 30 days are not store liability.',
  };

  const items = (Array.isArray(order.items) ? order.items : []).filter((it) => !it.isSurcharge && it.category !== 'Service Surcharge');
  const isWeight = order.type === 'weight';

  // Calculate dynamic receipt height based on lines
  // Base header: 42mm, Meta: 24mm, Items: 10 + N*7mm, Breakdown: 38mm, Payments: 15mm, Footer: 28mm
  const itemsCount = isWeight ? 1 : Math.max(1, items.length);
  const paymentsCount = Math.max(1, payments.length);
  const expressExtraHeight = num(order.expressAmount) > 0 ? 8 : 0;
  const calculatedHeight = 44 + 26 + (itemsCount * 7.5) + 42 + expressExtraHeight + (paymentsCount * 5.5) + 30;
  const pageHeight = Math.max(140, Math.ceil(calculatedHeight));
  const pageWidth = 80; // Standard 80mm POS thermal roll width

  const doc = existingDoc || new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  if (existingDoc) {
    doc.addPage([pageWidth, pageHeight]);
  }

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
  y += 3.6;

  // Customer Info
  doc.text(`Customer  : ${String(customer?.name || 'Walk-in Customer').slice(0, 22)}`, leftX, y);
  y += 3.6;
  doc.text(`Mobile    : ${customer?.mobile || '—'}`, leftX, y);
  y += 3.6;

  if (customer?.gstin || order?.customerGstin) {
    doc.text(`Cust GSTIN: ${customer?.gstin || order?.customerGstin}`, leftX, y);
    y += 3.6;
  }
  const pref = customer?.preference || order?.customerPreference;
  if (pref && pref !== 'NA') {
    doc.text(`Wash Pref : ${String(pref).slice(0, 22)}`, leftX, y);
    y += 3.6;
  }
  y += 0.4;

  hr();

  // 3. ITEM TABLE HEADER
  doc.setFont('courier', 'bold');
  doc.setFontSize(7.5);
  doc.text('ITEM / SERVICE', leftX, y);
  doc.text('QTY', 38, y, { align: 'center' });
  doc.text('RATE', 49, y, { align: 'right' });
  doc.text('DISC', 61, y, { align: 'right' });
  doc.text('AMOUNT', rightX, y, { align: 'right' });
  y += 3.2;
  hr();

  // 4. ITEMS LIST
  doc.setFont('courier', 'normal');
  doc.setFontSize(7.5);

  const totalDiscount = getOrderTotalDiscount(order);
  const lineDiscounts = calculateLineDiscounts(items, totalDiscount);

  if (isWeight) {
    doc.setFont('courier', 'bold');
    doc.text(`Weight Laundry: ${order.service || 'Bulk Wash'}`, leftX, y);
    y += 3.2;
    doc.setFont('courier', 'normal');
    doc.text(`Weight: ${num(order.weightKg)} kg (${order.weightClothesCount ? `${order.weightClothesCount} pcs` : 'Bulk'})`, leftX, y);
    if (totalDiscount > 0) {
      doc.text(totalDiscount.toFixed(2), 61, y, { align: 'right' });
    }
    doc.text(`${Math.max(0, num(order.grossAmount) - totalDiscount).toFixed(2)}`, rightX, y, { align: 'right' });
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
      const addonsText = `Add-ons: ${order.weightAddons.map((a) => (num(a?.price) > 0 ? `${a.name}(+Rs.${num(a.price)})` : a.name)).join(', ')}`;
      doc.text(addonsText.slice(0, 48), leftX, y);
      y += 3.2;
      doc.setFontSize(7.5);
    }

    if (order.weightNote) {
      doc.setFontSize(6.8);
      doc.text(`Note: ${String(order.weightNote).slice(0, 36)}`, leftX, y);
      y += 3.2;
      doc.setFontSize(7.5);
    }
  } else if (items.length > 0) {
    items.forEach((item, idx) => {
      const addonExtra = (Array.isArray(item.addons) ? item.addons : []).reduce((sum, a) => sum + num(a?.price), 0);
      const unitWithAddons = num(item.unitPrice) + addonExtra;
      const qty = num(item.quantity) || 1;
      const lineTotal = qty * unitWithAddons;
      const itemDis = lineDiscounts[idx] || 0;
      const itemTot = Math.max(0, lineTotal - itemDis);

      doc.setFont('courier', 'bold');
      const nameText = `${item.name || 'Item'} (${item.service || order.service || 'Service'})`;
      doc.text(nameText.slice(0, 26), leftX, y);
      y += 3.2;

      if (item.length && (item.width || item.breadth)) {
        doc.setFont('courier', 'normal');
        doc.setFontSize(6.8);
        const w = item.width || item.breadth;
        const sq = item.sqFt || Math.round(item.length * w * 100) / 100;
        const rateStr = item.ratePerSqFt ? ` @ Rs.${item.ratePerSqFt}/sq.ft` : '';
        doc.text(`Size: ${item.length}ft x ${w}ft (${sq} sq.ft${rateStr})`.slice(0, 48), leftX, y);
        y += 2.8;
        doc.setFontSize(7.5);
      }

      doc.setFont('courier', 'normal');
      if (item.barcode) {
        doc.text(`[${item.barcode}]`, leftX, y);
      } else {
        doc.text(item.category ? item.category : 'Standard', leftX, y);
      }
      doc.text(`${qty}`, 38, y, { align: 'center' });
      doc.text(`${unitWithAddons.toFixed(2)}`, 49, y, { align: 'right' });
      if (itemDis > 0) {
        doc.text(`${itemDis.toFixed(2)}`, 61, y, { align: 'right' });
      }
      doc.text(`${itemTot.toFixed(2)}`, rightX, y, { align: 'right' });
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
        doc.text(`Top-ups: ${item.addons.map((a) => (num(a?.price) > 0 ? `${a.name}(+Rs.${num(a.price)})` : a.name)).join(', ').slice(0, 48)}`, leftX, y);
        y += 2.8;
        doc.setFontSize(7.5);
      }

      y += 1.2;
    });
  } else {
    doc.text('No items specified', leftX, y);
    doc.text(`${num(order.grossAmount).toFixed(2)}`, rightX, y, { align: 'right' });
    y += 4;
  }

  hr();

  // 5. TOTALS & TAX BREAKDOWN
  const gross = num(order.grossAmount);
  const expressAmount = num(order.expressAmount);
  const taxable = Math.max(0, gross - totalDiscount) + expressAmount;
  const tax = num(order.taxAmount);
  // Keep a legitimate 0 total; only fall back when totalAmount is missing
  const total = num(order.totalAmount ?? (taxable + tax));
  const paid = num(order.paidAmount);
  const balance = num(order.balanceAmount ?? (total - paid));

  doc.setFont('courier', 'normal');
  doc.setFontSize(8);

  doc.text('Gross Amount:', 40, y, { align: 'right' });
  doc.text(formatMoneyPdf(gross), rightX, y, { align: 'right' });
  y += 3.6;

  if (totalDiscount > 0) {
    const pct = num(order.manualCheckoutDiscountPercent) || num(order.discountPercent);
    let discountLabel = 'Total Discount:';
    if (order.discountName) discountLabel = `Total Disc (${order.discountName}):`;
    else if (pct > 0) discountLabel = `Total Disc (${pct}%):`;
    doc.text(discountLabel.slice(0, 24), 40, y, { align: 'right' });
    doc.text(`-${formatMoneyPdf(totalDiscount)}`, rightX, y, { align: 'right' });
    y += 3.6;
  }

  if (expressAmount > 0) {
    doc.text('Express:', 40, y, { align: 'right' });
    doc.text(formatMoneyPdf(expressAmount), rightX, y, { align: 'right' });
    y += 3.6;
  }

  if (totalDiscount > 0 || expressAmount > 0) {
    doc.text(store.taxEnabled ? 'Taxable Subtotal:' : 'Subtotal:', 40, y, { align: 'right' });
    doc.text(formatMoneyPdf(taxable), rightX, y, { align: 'right' });
    y += 3.6;
  }

  if (store.taxEnabled && tax > 0) {
    if (store.splitGst) {
      const halfRate = (store.taxPercent / 2).toFixed(1);
      const [cgst, sgst] = splitTax(tax);
      doc.text(`CGST (${halfRate}%):`, 40, y, { align: 'right' });
      doc.text(formatMoneyPdf(cgst), rightX, y, { align: 'right' });
      y += 3.6;

      doc.text(`SGST (${halfRate}%):`, 40, y, { align: 'right' });
      doc.text(formatMoneyPdf(sgst), rightX, y, { align: 'right' });
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
  doc.text(`* * * ${order.orderNo || order.id || ''} * * *`, centerX, y, { align: 'center' });
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

const CODE39 = {
  '0': '000110100', '1': '100100001', '2': '001100001', '3': '101100000',
  '4': '000110001', '5': '100110000', '6': '001110000', '7': '000100101',
  '8': '100100100', '9': '001100100', 'A': '100001001', 'B': '001001001',
  'C': '101001000', 'D': '000011001', 'E': '100011000', 'F': '001011000',
  'G': '000001101', 'H': '100001100', 'I': '001001100', 'J': '000011100',
  'K': '100000011', 'L': '001000011', 'M': '101000010', 'N': '000010011',
  'O': '100010010', 'P': '001010010', 'Q': '000000111', 'R': '100000110',
  'S': '001000110', 'T': '000010110', 'U': '110000001', 'V': '011000001',
  'W': '111000000', 'X': '010010001', 'Y': '110010000', 'Z': '011010000',
  '-': '010000101', '.': '110000100', ' ': '011000100', '$': '010101000',
  '/': '010100010', '+': '010001010', '%': '000101010', '*': '010010100',
};

function drawCode39Bars(doc, text, xStart, yStart, barHeight = 6) {
  const clean = ('*' + String(text).toUpperCase().replace(/[^0-9A-Z\-\. \$\/\+\%]/g, '') + '*').split('');
  let curX = xStart;
  clean.forEach((char) => {
    const pattern = CODE39[char] || CODE39['-'];
    for (let i = 0; i < 9; i++) {
      const isBar = i % 2 === 0;
      const isWide = pattern[i] === '1';
      const w = isWide ? 0.6 : 0.25;
      if (isBar) {
        doc.rect(curX, yStart, w, barHeight, 'F');
      }
      curX += w;
    }
    curX += 0.35;
  });
  return curX;
}

/**
 * Generates the Crystal Clear standard landscape tax invoice matching reference image.
 */
export function generateStandardInvoicePdf({
  order,
  customer,
  settings,
  cashierName = 'CC02',
  previousDue = 0,
  existingDoc = null,
}) {
  const storeName = settings?.storeName || 'Crystal Clear Dry Cleaning';
  const storeAddress = settings?.address || 'Near Union Bank, Wazirabad, Gurgaon-122004';
  const taxNumber = settings?.taxNumber || '';
  const taxEnabled = settings?.taxEnabled !== false;
  const expressPercent = Number(settings?.expressDeliveryPercent ?? 25);

  const items = (Array.isArray(order.items) ? order.items : []).filter((it) => !it.isSurcharge && it.category !== 'Service Surcharge');
  const isWeight = order.type === 'weight';
  const orderNo = String(order.orderNo || order.id || '');

  const rowsCount = isWeight ? 1 : Math.max(1, items.length);
  const calculatedHeight = Math.max(148, 120 + rowsCount * 9);
  const pageWidth = 210;
  const pageHeight = calculatedHeight;

  const doc = existingDoc || new jsPDF({
    orientation: 'landscape',
    unit: 'mm',
    format: [pageWidth, pageHeight],
  });

  if (existingDoc) {
    doc.addPage([pageWidth, pageHeight]);
  }

  doc.setFont('helvetica', 'normal');

  // 1. Header
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(storeName, 105, 12, { align: 'center' });

  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8.5);
  doc.text(storeAddress, 105, 16.5, { align: 'center' });

  doc.setLineWidth(0.35);
  doc.line(10, 19, 200, 19);

  let y = 19;
  if (taxEnabled && taxNumber) {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(7.5);
    doc.text(`GST Number: ${taxNumber}`, 105, 23, { align: 'center' });
    doc.line(10, 25, 200, 25);
    y = 26;
  } else {
    y = 21;
  }

  // 2. Order Meta & Customer Info Grid
  const createdDate = formatDate(order.createdAt);
  const dObj = parseDateInput(order.createdAt) || new Date();
  let h = dObj.getHours();
  const m = String(dObj.getMinutes()).padStart(2, '0');
  const s = String(dObj.getSeconds()).padStart(2, '0');
  const ampm = h >= 12 ? 'PM' : 'AM';
  h = h % 12 || 12;
  const timeStr = `H ${h}:${m}:${s} ${ampm}`;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(20);
  if (orderNo) doc.text(orderNo, 10, y + 7.5);

  doc.setFontSize(7.5);
  doc.text(createdDate, 38, y + 4.5);
  doc.text(timeStr, 38, y + 8);

  // Barcode in center
  if (orderNo) {
    drawCode39Bars(doc, orderNo, 85, y + 1.5, 6.5);
    doc.setFontSize(6.5);
    doc.text(`* ${orderNo} *`, 105, y + 10.5, { align: 'center' });
  }

  // Customer on right
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8);
  doc.text(`${customer?.salutation ? `${customer.salutation} ` : ''}${customer?.name || 'Valued Customer'}-`, 145, y + 3.5);
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(7);
  if (customer?.address) {
    doc.text(String(customer.address), 145, y + 7);
  }
  if (customer?.state) {
    doc.setFont('helvetica', 'bold');
    doc.text(`Place of Supply- ${customer.state}`, 145, y + 10.5);
  }

  y += 13;
  doc.line(10, y, 200, y);

  // 3. Financial Balance Strip
  const grossAmount = num(order.grossAmount);
  const totalDiscount = getOrderTotalDiscount(order);
  const discountAmount = totalDiscount;
  const discountPercent = num(order.manualCheckoutDiscountPercent) || num(order.discountPercent);
  const expressAmount = num(order.expressAmount);
  const taxableSubtotal = Math.max(0, grossAmount - discountAmount) + expressAmount;
  const taxAmount = taxEnabled ? num(order.taxAmount) : 0;
  const taxPercent = taxEnabled ? Number(order.taxPercent || 18) : 0;
  const [cgstAmount, sgstAmount] = splitTax(taxAmount);
  // Keep a legitimate 0 total; only fall back when totalAmount is missing
  const totalAmount = num(order.totalAmount ?? (taxableSubtotal + taxAmount));
  const paidAmount = num(order.paidAmount);
  const prevDueVal = num(previousDue);
  const balanceDue = Math.max(0, prevDueVal + (totalAmount - paidAmount));
  const advance = 0.00;
  const roundOff = Math.round((totalAmount - (taxableSubtotal + taxAmount)) * 100) / 100;

  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`INR : ${prevDueVal.toFixed(2)}`, 22, y, { align: 'center' });
  doc.text(`INR : ${totalAmount.toFixed(2)}`, 64, y, { align: 'center' });
  doc.text(`INR : ${advance.toFixed(2)}`, 105, y, { align: 'center' });
  doc.text(`INR : ${paidAmount.toFixed(2)}`, 146, y, { align: 'center' });
  doc.text(`INR : ${balanceDue.toFixed(2)}`, 188, y, { align: 'center' });

  doc.setFontSize(11);
  doc.text('+', 43, y + 1, { align: 'center' });
  doc.text('-', 84, y + 1, { align: 'center' });
  doc.text('-', 125, y + 1, { align: 'center' });
  doc.text('=', 167, y + 1, { align: 'center' });

  doc.setFontSize(6.5);
  doc.text('Previous Due', 22, y + 3.8, { align: 'center' });
  doc.text('Due (this order)', 64, y + 3.8, { align: 'center' });
  doc.text('Advance', 105, y + 3.8, { align: 'center' });
  doc.text('Paid', 146, y + 3.8, { align: 'center' });
  doc.text('Balance Due', 188, y + 3.8, { align: 'center' });

  y += 6;
  doc.line(10, y, 200, y);

  // 4. Counts & Delivery Date
  const totalPcs = isWeight
    ? (Number(order.weightClothesCount) || (order.weightKg ? Math.round(order.weightKg) : 1))
    : items.reduce((sum, it) => sum + (num(it.quantity) || 1), 0);
  const advBal = num(customer?.walletBalance);

  const dueD = parseDateInput(order.dueDate);
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const dueFormatted = dueD
    ? `${formatDate(order.dueDate)} 6:00 PM / ${dayNames[dueD.getDay()]}`
    : '—';

  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text(`Total Pcs : ${totalPcs}     Advance Balance: ${advBal.toFixed(0)}`, 10, y);
  const deliveryText = `Delivery Date : ${dueFormatted}`;
  doc.text(deliveryText, 200, y, { align: 'right' });

  y += 2;
  doc.line(10, y, 200, y);

  // 5. Table Header
  y += 4;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7.5);
  doc.text("Particular's", 10, y);
  doc.text('Service', 65, y);
  doc.text('Qty', 120, y, { align: 'center' });
  doc.text('Rate', 138, y, { align: 'right' });
  doc.text('Amount', 158, y, { align: 'right' });
  doc.text('Discount', 178, y, { align: 'right' });
  doc.text('Total', 200, y, { align: 'right' });

  y += 1.8;
  doc.line(10, y, 200, y);

  // 6. Table Items
  if (isWeight) {
    y += 4;
    doc.setFont('helvetica', 'bold');
    const weightKg = num(order.weightKg);
    const serviceName = order.service || 'Laundry';
    const addonsCost = (Array.isArray(order.weightAddons) ? order.weightAddons : []).reduce((s, a) => s + num(a?.price), 0);
    const weightCost = Math.max(0, grossAmount - addonsCost);
    const weightRate = weightKg > 0 ? (weightCost / weightKg) : 0;
    const weightTot = Math.max(0, weightCost - discountAmount);

    doc.text(`Weight Laundry - ${serviceName}`, 10, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${serviceName} (SAC-99971)`, 65, y);
    doc.text(`${weightKg} kg`, 120, y, { align: 'center' });
    doc.text(Number.isInteger(weightRate) ? weightRate.toFixed(0) : weightRate.toFixed(2), 138, y, { align: 'right' });
    doc.text(weightCost.toFixed(2), 158, y, { align: 'right' });
    if (discountAmount > 0) {
      doc.text(discountAmount.toFixed(2), 178, y, { align: 'right' });
    }
    doc.setFont('helvetica', 'bold');
    doc.text(weightTot.toFixed(2), 200, y, { align: 'right' });

    if (Array.isArray(order.weightAddons) && order.weightAddons.length > 0) {
      order.weightAddons.forEach((a) => {
        y += 3.2;
        const aPrice = num(a?.price);
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.text(String(a.name || 'Add-on').slice(0, 30), 65, y);
        doc.setFont('helvetica', 'normal');
        doc.text(Number.isInteger(aPrice) ? aPrice.toFixed(0) : aPrice.toFixed(2), 138, y, { align: 'right' });
        doc.text(aPrice.toFixed(2), 158, y, { align: 'right' });
        doc.text(aPrice.toFixed(2), 200, y, { align: 'right' });
      });
      doc.setFontSize(7.5);
    }
    y += 4;
  } else {
    const lines = items.map((item) => {
      const qty = num(item.quantity) || 1;
      const baseUnitPrice = num(item.unitPrice) || 0;
      return { item, qty, baseUnitPrice, amount: round2(qty * baseUnitPrice) };
    });
    const lineDiscounts = calculateLineDiscounts(items, discountAmount);

    lines.forEach(({ item, qty, baseUnitPrice, amount: itemAmt }, idx) => {
      y += 4;
      const itemDis = lineDiscounts[idx] || 0;
      const itemTot = Math.max(0, itemAmt - itemDis);

      const categoryPrefix = item.category ? `${item.category} - ` : '';
      const nameUpper = `${categoryPrefix}${String(item.name || 'Item').toUpperCase()}`;

      doc.setFont('helvetica', 'bold');
      doc.text(nameUpper.slice(0, 32), 10, y);

      doc.setFont('helvetica', 'normal');
      doc.text(`${item.service || order.service || 'Service'} (SAC-99971)`.slice(0, 30), 65, y);
      doc.text(String(qty), 120, y, { align: 'center' });
      doc.text(Number.isInteger(baseUnitPrice) ? baseUnitPrice.toFixed(0) : baseUnitPrice.toFixed(2), 138, y, { align: 'right' });
      doc.text(itemAmt.toFixed(2), 158, y, { align: 'right' });
      if (itemDis > 0) {
        doc.text(itemDis.toFixed(2), 178, y, { align: 'right' });
      }

      doc.setFont('helvetica', 'bold');
      doc.text(itemTot.toFixed(2), 200, y, { align: 'right' });

      // Secondary preference line or addons
      if (item.length && (item.width || item.breadth)) {
        y += 3.2;
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(6.5);
        const w = item.width || item.breadth;
        const sq = item.sqFt || Math.round(item.length * w * 100) / 100;
        const rateStr = item.ratePerSqFt ? ` @ Rs.${item.ratePerSqFt}/sq.ft` : '';
        doc.text(`Size: ${item.length}x${w}ft (${sq} sq.ft${rateStr})`.slice(0, 36), 10, y);
        doc.setFontSize(7.5);
      }

      const addons = Array.isArray(item.addons) ? item.addons : [];
      if (addons.length > 0) {
        addons.forEach((a) => {
          y += 3.2;
          const aPrice = num(a?.price);
          const aAmt = round2(qty * aPrice);
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.5);
          doc.text(String(a.name || 'Add-on').slice(0, 30), 65, y);
          doc.setFont('helvetica', 'normal');
          doc.text(Number.isInteger(aPrice) ? aPrice.toFixed(0) : aPrice.toFixed(2), 138, y, { align: 'right' });
          doc.text(aAmt.toFixed(2), 158, y, { align: 'right' });
          doc.text(aAmt.toFixed(2), 200, y, { align: 'right' });
        });
        if (item.note) {
          y += 2.8;
          doc.setFont('helvetica', 'italic');
          doc.setFontSize(6.5);
          doc.text(`Note: ${item.note}`.slice(0, 36), 65, y);
        }
      } else if (item.note || (customer?.preference && customer.preference !== 'NA')) {
        y += 3.2;
        doc.setFont('helvetica', 'italic');
        doc.setFontSize(6.5);
        doc.text(String(item.note || customer.preference).slice(0, 30), 65, y);
        doc.setFont('helvetica', 'normal');
        doc.text('0', 138, y, { align: 'right' });
        doc.text('0.00', 158, y, { align: 'right' });
        doc.text('0.00', 200, y, { align: 'right' });
      }
      doc.setFontSize(7.5);
    });
  }

  y += 2;
  doc.line(10, y, 200, y);

  // 7. Subtotal Row
  y += 3.5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(7);
  let bookedByText = 'Terms and Conditions';
  if (taxEnabled && taxAmount > 0) {
    bookedByText += ` ( CGST: ${cgstAmount.toFixed(2)}, SGST: ${sgstAmount.toFixed(2)} = ${taxAmount.toFixed(2)} )`;
  }
  doc.text(bookedByText, 10, y);

  doc.text('Subtotal', 138, y, { align: 'right' });
  doc.text(grossAmount.toFixed(2), 158, y, { align: 'right' });
  if (discountAmount > 0) {
    doc.text(discountAmount.toFixed(2), 178, y, { align: 'right' });
  }
  doc.text(taxableSubtotal.toFixed(2), 200, y, { align: 'right' });

  y += 2;
  doc.line(10, y, 200, y);

  // 8. Footer (Terms on Left, Taxes/Due on Right)
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(6.5);
  doc.text('All deliveries will be made in 72 Hours of Pick up.', 10, y);
  doc.text('One day delivery is not available before weekly offs & public holidays.', 10, y + 3.2);
  doc.setFont('helvetica', 'bold');
  doc.text(`Urgent delivery of garments will be charged @ ${expressPercent} % Extra.`, 10, y + 7.5);

  // Right column
  if (taxEnabled && taxAmount > 0) {
    doc.text(`CGST (${(taxPercent / 2).toFixed(0)}%)`, 175, y, { align: 'right' });
    doc.text(cgstAmount.toFixed(2), 200, y, { align: 'right' });

    doc.text(`SGST (${(taxPercent / 2).toFixed(0)}%)`, 175, y + 3.2, { align: 'right' });
    doc.text(sgstAmount.toFixed(2), 200, y + 3.2, { align: 'right' });
    y += 6.4;
  }

  if (roundOff !== 0) {
    doc.text('Round Off', 175, y, { align: 'right' });
    doc.text(roundOff.toFixed(2), 200, y, { align: 'right' });
    y += 3.2;
  }

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(8.5);
  doc.text('Due (this order)', 175, y + 2, { align: 'right' });
  doc.text(totalAmount.toFixed(2), 200, y + 2, { align: 'right' });

  return doc;
}

/**
 * Download the generated standard landscape PDF invoice.
 */
export function downloadStandardInvoicePdf(options) {
  const doc = generateStandardInvoicePdf(options);
  const filename = `${options.settings?.storeName ? options.settings.storeName.replace(/\s+/g, '_') : 'Crystal_Clear'}_Invoice_${options.order.orderNo || options.order.id}.pdf`;
  doc.save(filename);
}

/**
 * Download the generated 80mm PDF to the user's filesystem.
 */
export function downloadThermalReceiptPdf(options) {
  if (options.format === 'thermal') {
    const doc = generateThermalReceiptPdf(options);
    const filename = `Receipt_${options.order.orderNo || options.order.id}.pdf`;
    doc.save(filename);
  } else {
    downloadStandardInvoicePdf(options);
  }
}

/**
 * Download a combined multi-page PDF containing all invoices in the list.
 */
export function downloadBatchInvoicesPdf({
  orders = [],
  customers = [],
  settings = {},
  payments = [],
  format = 'thermal',
  cashierName = 'Store Cashier',
  filename = '',
}) {
  if (!orders || orders.length === 0) {
    return { success: false, error: 'No orders available to generate invoices.' };
  }

  const customerMap = new Map();
  (customers || []).forEach((c) => {
    if (c?.id) customerMap.set(c.id, c);
  });

  const paymentMap = new Map();
  (payments || []).forEach((p) => {
    if (!p?.orderId) return;
    if (!paymentMap.has(p.orderId)) paymentMap.set(p.orderId, []);
    paymentMap.get(p.orderId).push(p);
  });

  let doc = null;
  orders.forEach((order) => {
    const cust = customerMap.get(order.customerId) || { name: 'Customer' };
    const orderPayments = paymentMap.get(order.id) || [];
    const opts = {
      order,
      customer: cust,
      settings,
      payments: orderPayments,
      cashierName,
      existingDoc: doc,
    };
    if (format === 'thermal') {
      doc = generateThermalReceiptPdf(opts);
    } else {
      doc = generateStandardInvoicePdf(opts);
    }
  });

  const defaultFilename = `CleanClear_All_Invoices_${orders.length}_Orders_${new Date().toISOString().slice(0, 10)}.pdf`;
  const exportFilename = filename || defaultFilename;
  if (typeof window !== 'undefined') {
    doc.save(exportFilename);
  }

  return { success: true, count: orders.length, filename: exportFilename, doc };
}

/**
 * Returns PDF as Blob for sharing.
 */
export function getThermalReceiptBlob(options) {
  const doc = options.format === 'thermal'
    ? generateThermalReceiptPdf(options)
    : generateStandardInvoicePdf(options);
  return doc.output('blob');
}

/**
 * Builds clean plain-text invoice summary suitable for WhatsApp or clipboard.
 */
export function getReceiptShareText({ order, customer, settings, payments = [], billUrl }) {
  const storeName = settings?.storeName || 'Clean Clear Dry Cleaning';
  const phone = settings?.phone || '';
  const total = num(order.totalAmount);
  const paid = num(order.paidAmount);
  const balance = num(order.balanceAmount ?? (total - paid));

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
      text += `• Top-ups: ${order.weightAddons.map((a) => (num(a?.price) > 0 ? `${a.name} (+₹${num(a.price)})` : a.name)).join(', ')}\n`;
    }
    if (order.weightNote) {
      text += `• Note: ${order.weightNote}\n`;
    }
  } else if (Array.isArray(order.items)) {
    text += `*ITEMS:*\n`;
    const shareItems = order.items.filter((item) => !item.isSurcharge && item.category !== 'Service Surcharge');
    const shareTotalDiscount = getOrderTotalDiscount(order);
    const lineDiscounts = calculateLineDiscounts(shareItems, shareTotalDiscount);
    shareItems.forEach((item, idx) => {
      const addonExtra = (Array.isArray(item.addons) ? item.addons : []).reduce((sum, a) => sum + num(a?.price), 0);
      const lineUnit = num(item.unitPrice) + addonExtra;
      const qty = num(item.quantity) || 1;
      const lineTot = qty * lineUnit;
      const itemDis = lineDiscounts[idx] || 0;
      text += `• ${qty}x ${item.name || 'Item'} (${item.service || order.service}) - ₹${Math.max(0, lineTot - itemDis).toFixed(2)}${itemDis > 0 ? ` (disc: -₹${itemDis.toFixed(2)})` : ''}\n`;
      if (item.length && (item.width || item.breadth)) {
        const w = item.width || item.breadth;
        const sq = item.sqFt || Math.round(item.length * w * 100) / 100;
        const rateStr = item.ratePerSqFt ? ` @ ₹${item.ratePerSqFt}/sq.ft` : '';
        text += `   ↳ Size: ${item.length} ft × ${w} ft (${sq} sq.ft${rateStr})\n`;
      }
      const tags = [item.brand ? `Brand: ${item.brand}` : '', item.color ? `Color: ${item.color}` : '', ...(item.defects || [])].filter(Boolean);
      if (tags.length > 0) {
        text += `   ↳ ${tags.join(' | ')}\n`;
      }
      if (Array.isArray(item.addons) && item.addons.length > 0) {
        text += `   ↳ Add-ons: ${item.addons.map((a) => (num(a?.price) > 0 ? `${a.name} (+₹${num(a.price)})` : a.name)).join(', ')}\n`;
      }
    });
  }

  text += `--------------------------------\n`;
  text += `Gross Amount: ₹${num(order.grossAmount).toFixed(2)}\n`;
  const totalDiscount = getOrderTotalDiscount(order);
  if (totalDiscount > 0) {
    const discountLabel = order.discountName
      || (order.manualCheckoutDiscountPercent ? `${order.manualCheckoutDiscountPercent}%` : '')
      || (num(order.discountPercent) ? `${num(order.discountPercent)}%` : '');
    text += `Discount${discountLabel ? ` (${discountLabel})` : ''}: -₹${totalDiscount.toFixed(2)}\n`;
  }
  if (num(order.expressAmount) > 0) {
    text += `Turnaround (${order.expressLabel || `${order.expressPercent}%`}): +₹${num(order.expressAmount).toFixed(2)}\n`;
  }
  if (settings?.taxEnabled !== false && num(order.taxAmount) > 0) {
    text += `Tax (${settings?.taxLabel || 'GST'} ${settings?.taxPercent || 18}%): ₹${num(order.taxAmount).toFixed(2)}\n`;
  }
  const shareTaxable = Math.max(0, num(order.grossAmount) - totalDiscount) + num(order.expressAmount);
  const shareRoundOff = Math.round((total - (shareTaxable + (settings?.taxEnabled !== false ? num(order.taxAmount) : 0))) * 100) / 100;
  if (shareRoundOff !== 0) {
    text += `Round Off: ${shareRoundOff > 0 ? '+' : ''}₹${shareRoundOff.toFixed(2)}\n`;
  }
  text += `*NET TOTAL: ₹${total.toFixed(2)}*\n`;
  text += `Amount Paid: ₹${paid.toFixed(2)}\n`;
  text += `*Balance Due: ₹${balance.toFixed(2)}*\n`;
  text += `Status: ${order.status}\n`;
  text += `--------------------------------\n`;
  if (billUrl) {
    text += `📥 *View & Download PDF Bill:*\n${billUrl}\n`;
    text += `--------------------------------\n`;
  }
  if (phone) text += `📞 Need help? Call ${phone}\n`;
  text += `Thank you for your business!`;

  return text;
}

/**
 * Open WhatsApp with prefilled message including secure digital bill link.
 * Designed to bypass browser popup blockers via immediate user-gesture handling and fallbacks.
 */
export async function shareReceiptWhatsApp(options = {}) {
  const customerMobile = String(options.customer?.mobile || options.order?.customerMobile || '').replace(/\D/g, '');
  const cleanPhone = customerMobile.length >= 10 ? `91${customerMobile.slice(-10)}` : '';

  // 1. If billUrl is not provided, open a window placeholder immediately to retain user gesture
  let popup = null;
  if (!options.billUrl && typeof window !== 'undefined') {
    try {
      popup = window.open('about:blank', '_blank', 'noopener,noreferrer');
    } catch {}
  }

  let billUrl = options.billUrl;
  if (!billUrl && options.order) {
    try {
      billUrl = await buildPublicBillUrl(options.order, options.customer);
    } catch {}
  }

  const text = getReceiptShareText({ ...options, billUrl });
  const encoded = encodeURIComponent(text);

  // Support direct native app (whatsapp://), WhatsApp Web, or universal link
  let target = '';
  if (options.mode === 'app' || options.useApp) {
    target = cleanPhone
      ? `whatsapp://send?phone=${cleanPhone}&text=${encoded}`
      : `whatsapp://send?text=${encoded}`;
  } else if (options.mode === 'web' || options.useWeb) {
    target = cleanPhone
      ? `https://web.whatsapp.com/send?phone=${cleanPhone}&text=${encoded}`
      : `https://web.whatsapp.com/send?text=${encoded}`;
  } else {
    target = cleanPhone
      ? `https://wa.me/${cleanPhone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;
  }

  if (typeof window !== 'undefined') {
    if (popup && !popup.closed) {
      popup.location.href = target;
    } else {
      let win = null;
      try {
        win = window.open(target, '_blank', 'noopener,noreferrer');
      } catch {}

      // Fallback if window.open was blocked by strict browser popup blockers
      if (!win || win.closed || typeof win.closed === 'undefined') {
        try {
          const link = document.createElement('a');
          link.href = target;
          link.target = '_blank';
          link.rel = 'noopener noreferrer';
          document.body.appendChild(link);
          link.click();
          setTimeout(() => {
            if (document.body.contains(link)) document.body.removeChild(link);
          }, 100);
        } catch {
          window.location.href = target;
        }
      }
    }
  }

  return { billUrl, target };
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
        title: `Clean Clear Dry Cleaning Receipt #${options.order.orderNo}`,
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
        title: `Clean Clear Dry Cleaning Receipt #${options.order.orderNo}`,
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
