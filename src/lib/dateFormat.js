/**
 * Shared date formatting helpers for receipts / invoices (en-IN locale).
 */

const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Parses a date input into a Date.
 * - 'YYYY-MM-DD' (date-only) strings are constructed in LOCAL time so the calendar day never shifts.
 * - Full ISO timestamps / Date objects / epoch numbers use the native Date constructor.
 * Returns null when the input is empty or invalid.
 */
export function parseDateInput(input) {
  if (input === null || input === undefined || input === '') return null;
  if (input instanceof Date) return Number.isNaN(input.getTime()) ? null : input;

  if (typeof input === 'string') {
    const trimmed = input.trim();
    if (!trimmed) return null;
    const m = trimmed.match(DATE_ONLY_RE);
    if (m) {
      const y = Number(m[1]);
      const mo = Number(m[2]);
      const d = Number(m[3]);
      const local = new Date(y, mo - 1, d);
      // Reject overflowed dates such as 2026-02-31
      if (local.getFullYear() !== y || local.getMonth() !== mo - 1 || local.getDate() !== d) return null;
      return local;
    }
    const parsed = new Date(trimmed);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(input);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

/**
 * Formats a date + time. Empty input prints the current time (receipt printed "now");
 * invalid input returns '—'.
 */
export function formatDateTime(isoString) {
  if (!isoString) return new Date().toLocaleString('en-IN');
  const d = parseDateInput(isoString);
  if (!d) return '—';
  return d.toLocaleString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Formats a calendar date (e.g. "12 Oct 2026"). Returns '—' for empty/invalid input.
 */
export function formatDate(isoString) {
  const d = parseDateInput(isoString);
  if (!d) return '—';
  return d.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  }).replace(/\bSept\b/g, 'Sep');
}

const WEEKDAYS_SHORT = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MONTHS_SHORT = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Formats a garment tag date matching physical tag printers (e.g. "31 Oct 26 Sat").
 */
export function formatTagDate(isoString) {
  const d = parseDateInput(isoString);
  if (!d) return '—';
  const day = String(d.getDate()).padStart(2, '0');
  const month = MONTHS_SHORT[d.getMonth()];
  const yy = String(d.getFullYear()).slice(-2);
  const weekday = WEEKDAYS_SHORT[d.getDay()];
  return `${day} ${month} ${yy} ${weekday}`;
}
