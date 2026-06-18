// ── Formatting helpers ────────────────────────────────────

// Narrow no-break space (U+202F) — the typographically correct thousands
// separator. Keeps Rand figures tight and tabular without an ugly comma.
const THIN = ' ';

// en-ZA's default group separator can render as a comma (or a regular space
// depending on the host ICU build). We normalise every grouped number to a
// single, consistent narrow no-break space so "R 1 234 567" reads cleanly
// and never collides with the decimal style of "11.25%".
function groupZA(value) {
  return Math.round(value)
    .toLocaleString('en-ZA', { useGrouping: true })
    // strip whatever the locale produced (comma OR space) → normalise to THIN
    .replace(/[\s,  ]/g, THIN);
}

export function fmt(n) {
  if (n == null || isNaN(n)) n = 0;
  return 'R' + THIN + groupZA(n);
}

// Render a low–high rand range as "R 900–R 1 100". Uses an en-dash between the
// two figures. If both bounds are equal, collapses to a single figure.
export function fmtRange(low, high) {
  if (low === high) return fmt(low);
  return fmt(low) + '–' + fmt(high);
}

export function fmtShort(n) {
  if (n == null || isNaN(n)) n = 0;
  if (Math.abs(n) >= 1_000_000_000) return 'R' + THIN + (n / 1_000_000_000).toFixed(1) + 'bn';
  if (Math.abs(n) >= 1_000_000)     return 'R' + THIN + (n / 1_000_000).toFixed(1) + 'M';
  if (Math.abs(n) >= 1_000)         return 'R' + THIN + (n / 1_000).toFixed(0) + 'k';
  return 'R' + THIN + groupZA(n);
}

// Rates always render with a decimal point, never a comma — "11.25%", never
// "11,25". toFixed already uses a dot regardless of locale, so this is safe.
export function fmtPct(n, decimals = 2) {
  if (n == null || isNaN(n)) return '0%';
  return Number(n).toFixed(decimals) + '%';
}

export function fmtDate(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function daysAgo(iso) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`;
}

export function fmtMonthYear(dateStr) {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
}

// Parse a number from a string, returning fallback if invalid
export function parseNum(val, fallback = 0) {
  const n = parseFloat(String(val).replace(/[^\d.-]/g, ''));
  return isNaN(n) ? fallback : n;
}
