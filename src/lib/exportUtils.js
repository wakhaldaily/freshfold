/**
 * Export and date filtering utilities for FreshFold Order History.
 */

export const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
];

/**
 * Returns whether a date string falls in the current calendar week (Monday 00:00 to Sunday 23:59:59).
 */
export function isDateInThisWeek(dateStr, refDate = new Date()) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return false;

  const day = refDate.getDay(); // 0 is Sunday, 1 is Monday...
  const diffToMonday = day === 0 ? -6 : 1 - day;
  const monday = new Date(refDate);
  monday.setDate(refDate.getDate() + diffToMonday);
  monday.setHours(0, 0, 0, 0);

  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);

  return d >= monday && d <= sunday;
}

/**
 * Returns dynamic list of unique years present in orders plus the current year.
 */
export function getAvailableYears(orders = []) {
  const currentYear = new Date().getFullYear();
  const yearSet = new Set([currentYear]);

  orders.forEach((o) => {
    if (o.createdAt) {
      const y = new Date(o.createdAt).getFullYear();
      if (!isNaN(y)) yearSet.add(y);
    }
  });

  return Array.from(yearSet).sort((a, b) => b - a);
}

/**
 * Helper to convert date to YYYY-MM-DD local string
 */
function toLocalDateStr(dateInput) {
  if (!dateInput) return null;
  const d = new Date(dateInput);
  if (isNaN(d.getTime())) return null;
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Filters orders based on date presets (all, this-week, this-month, range/custom dates).
 */
export function filterOrdersByDate({
  orders = [],
  timePreset = 'all',
  selectedYear = 'all',
  selectedMonth = 'all',
  startDate = '',
  endDate = '',
  refDate = new Date(),
}) {
  if (!Array.isArray(orders)) return [];
  if (
    timePreset === 'all' &&
    selectedYear === 'all' &&
    selectedMonth === 'all' &&
    !startDate &&
    !endDate
  ) {
    return orders;
  }

  const nowYear = refDate.getFullYear();
  const nowMonth = refDate.getMonth();

  return orders.filter((order) => {
    const rawDate = order.createdAt || order.dueDate;
    if (!rawDate) return false;
    const d = new Date(rawDate);
    if (isNaN(d.getTime())) return false;

    // Date range filter takes priority when timePreset is 'range' or dates are specified
    if (timePreset === 'range' || (timePreset !== 'this-week' && timePreset !== 'this-month' && timePreset !== 'this-year' && (startDate || endDate))) {
      const orderDateStr = toLocalDateStr(rawDate);
      if (!orderDateStr) return false;
      if (startDate && orderDateStr < startDate) return false;
      if (endDate && orderDateStr > endDate) return false;
      return true;
    }

    if (timePreset === 'this-week') {
      return isDateInThisWeek(rawDate, refDate);
    }

    if (timePreset === 'this-month') {
      return d.getFullYear() === nowYear && d.getMonth() === nowMonth;
    }

    if (timePreset === 'this-year') {
      return d.getFullYear() === nowYear;
    }

    if (timePreset === 'custom') {
      const matchYear = selectedYear === 'all' || d.getFullYear() === Number(selectedYear);
      const matchMonth = selectedMonth === 'all' || d.getMonth() === Number(selectedMonth);
      return matchYear && matchMonth;
    }

    return true;
  });
}

/**
 * Returns a user-friendly label describing the current time filter.
 */
export function getFilterPeriodLabel({
  timePreset = 'all',
  selectedYear = 'all',
  selectedMonth = 'all',
  startDate = '',
  endDate = '',
  refDate = new Date(),
}) {
  if (timePreset === 'range' || (startDate || endDate)) {
    if (startDate && endDate) {
      return startDate === endDate
        ? `Date (${startDate})`
        : `Date Range (${startDate} to ${endDate})`;
    }
    if (startDate) return `From ${startDate}`;
    if (endDate) return `Until ${endDate}`;
  }

  if (timePreset === 'this-week') {
    const day = refDate.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(refDate);
    monday.setDate(refDate.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    const fmt = (d) => `${d.getDate()} ${MONTH_NAMES[d.getMonth()].slice(0, 3)}`;
    return `This Week (${fmt(monday)} - ${fmt(sunday)} ${sunday.getFullYear()})`;
  }

  if (timePreset === 'this-month') {
    return `This Month (${MONTH_NAMES[refDate.getMonth()]} ${refDate.getFullYear()})`;
  }

  if (timePreset === 'this-year') {
    return `This Year (${refDate.getFullYear()})`;
  }

  if (timePreset === 'custom') {
    if (selectedMonth !== 'all' && selectedYear !== 'all') {
      return `${MONTH_NAMES[Number(selectedMonth)]} ${selectedYear}`;
    }
    if (selectedMonth !== 'all') {
      return `Every ${MONTH_NAMES[Number(selectedMonth)]}`;
    }
    if (selectedYear !== 'all') {
      return `Year ${selectedYear}`;
    }
  }

  return 'All Time';
}

/**
 * Escapes values for standard CSV format (RFC 4180).
 */
function escapeCsv(val) {
  if (val === null || val === undefined) return '';
  const str = String(val).replace(/"/g, '""');
  return `"${str}"`;
}

/**
 * Exports filtered orders into an Excel-ready CSV with UTF-8 BOM.
 */
export function exportOrdersToExcel({
  orders = [],
  customers = [],
  settings = {},
  timeLabel = '',
  filename = '',
}) {
  if (!orders || orders.length === 0) {
    return { success: false, error: 'No orders available to export.' };
  }

  const customerMap = new Map();
  (customers || []).forEach((c) => {
    if (c?.id) customerMap.set(c.id, c);
  });

  const headers = [
    'Order No',
    'Intake Date',
    'Intake Time',
    'Promised Due Date',
    'Customer Name',
    'Customer Mobile',
    'Customer Email',
    'Order Type',
    'Service',
    'Items Breakdown',
    'Weight (Kg)',
    'Gross Amount (INR)',
    'Discount Name',
    'Discount Amount (INR)',
    'Early Delivery Surcharge (INR)',
    'Tax Label',
    'Tax Amount (INR)',
    'Total Bill (INR)',
    'Paid Amount (INR)',
    'Balance Due (INR)',
    'Order Status',
    'Payment Status',
  ];

  const rows = orders.map((o) => {
    const cust = customerMap.get(o.customerId) || {};
    const createdAt = o.createdAt ? new Date(o.createdAt) : null;
    const dueDate = o.dueDate ? new Date(o.dueDate) : null;

    const dateStr = createdAt && !isNaN(createdAt) ? createdAt.toLocaleDateString('en-IN') : '—';
    const timeStr = createdAt && !isNaN(createdAt) ? createdAt.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }) : '—';
    const dueStr = dueDate && !isNaN(dueDate) ? dueDate.toLocaleDateString('en-IN') : (o.dueDate || '—');

    let itemsSummary = '';
    if (o.type === 'weight') {
      itemsSummary = `${o.weightKg || 0} kg (${o.weightClothesCount ? `${o.weightClothesCount} pcs` : 'Bulk'})`;
      if (Array.isArray(o.weightGarments) && o.weightGarments.length > 0) {
        itemsSummary += ` [${o.weightGarments.map((g) => `${g.name} x${g.quantity}`).join(', ')}]`;
      }
    } else if (Array.isArray(o.items)) {
      itemsSummary = o.items.map((i) => `${i.quantity || 1}x ${i.name}`).join('; ');
    }

    const total = Number(o.totalAmount || 0);
    const paid = Number(o.paidAmount || 0);
    const balance = Number(o.balanceAmount ?? (total - paid));

    let paymentStatus = 'Unpaid';
    if (balance <= 0) paymentStatus = 'Paid in Full';
    else if (paid > 0) paymentStatus = 'Partially Paid';

    return [
      escapeCsv(o.orderNo || o.id),
      escapeCsv(dateStr),
      escapeCsv(timeStr),
      escapeCsv(dueStr),
      escapeCsv(cust.name || 'Valued Customer'),
      escapeCsv(cust.mobile ? `'${cust.mobile}` : ''), // single quote preserves leading zeros in Excel
      escapeCsv(cust.email || ''),
      escapeCsv(o.type === 'weight' ? 'Weight Laundry' : 'Piece Item Intake'),
      escapeCsv(o.service || 'Laundry'),
      escapeCsv(itemsSummary),
      escapeCsv(o.type === 'weight' ? o.weightKg || 0 : ''),
      escapeCsv(Number(o.grossAmount || 0).toFixed(2)),
      escapeCsv(o.discountName || ''),
      escapeCsv(Number(o.discountAmount || 0).toFixed(2)),
      escapeCsv(Number(o.expressAmount || 0).toFixed(2)),
      escapeCsv(settings?.taxLabel || 'GST'),
      escapeCsv(Number(o.taxAmount || 0).toFixed(2)),
      escapeCsv(total.toFixed(2)),
      escapeCsv(paid.toFixed(2)),
      escapeCsv(balance.toFixed(2)),
      escapeCsv(o.status || 'Received'),
      escapeCsv(paymentStatus),
    ].join(',');
  });

  // Include store header and filter summary at top of CSV
  const storeName = settings?.storeName || 'Clean Clear Dry Cleaning';
  const generatedOn = new Date().toLocaleString('en-IN');
  const summaryHeader = [
    `"${storeName} - Orders Export Report"`,
    `"Filter Period: ${timeLabel || 'All Time'}"`,
    `"Exported On: ${generatedOn}"`,
    `"Total Orders: ${orders.length}"`,
    '', // blank separator line
  ].join('\r\n');

  // \uFEFF is UTF-8 Byte Order Mark, crucial for Excel to recognize Unicode UTF-8
  const csvContent = '\uFEFF' + summaryHeader + '\r\n' + headers.join(',') + '\r\n' + rows.join('\r\n');

  const defaultFilename = `CleanClear_Orders_${(timeLabel || 'Export').replace(/[^a-zA-Z0-9_\-]/g, '_')}_${new Date().toISOString().slice(0, 10)}.csv`;
  const exportFilename = filename || defaultFilename;

  try {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    if (typeof window !== 'undefined') {
      const link = document.createElement('a');
      const url = URL.createObjectURL(blob);
      link.setAttribute('href', url);
      link.setAttribute('download', exportFilename);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    }
    return { success: true, count: orders.length, filename: exportFilename };
  } catch (err) {
    console.error('Export to Excel CSV failed:', err);
    return { success: false, error: err.message };
  }
}
