import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { RefreshCw, Home, Search, Download } from 'lucide-react';
import { bankApi, bankFmtR, timeUntil } from './bankApi.js';

// --- Decision helpers ---

function getRecommendation(a) {
  if (a.riskTier === 'critical' || a.qualityScore < 30) return 'Decline';
  if (a.riskTier === 'red') return 'Refer';
  if (a.riskTier === 'amber' || (a.riskTier === 'green' && a.qualityScore < 70)) return 'Hold';
  if (a.riskTier === 'green' && a.qualityScore >= 70) return 'Bid';
  return 'Hold';
}

const REC_STYLE = {
  Bid:     { bg: '#16a34a', color: '#fff' },
  Hold:    { bg: '#d97706', color: '#fff' },
  Refer:   { bg: '#7c3aed', color: '#fff' },
  Decline: { bg: '#dc2626', color: '#fff' },
};

function getGrade(score) {
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

const GRADE_STYLE = {
  A: { bg: '#dcfce7', color: '#166534' },
  B: { bg: '#d1fae5', color: '#065f46' },
  C: { bg: '#fef3c7', color: '#92400e' },
  D: { bg: '#fee2e2', color: '#991b1b' },
  E: { bg: '#3b0764', color: '#fff' },
};

function getHeadlineReason(a) {
  if (a.fraudFlag) return 'Fraud signal flagged';
  if (a.riskTier === 'critical') return 'Critical risk profile';
  if (a.riskTier === 'red') return 'Elevated risk — refer to credit committee';
  if ((a.dtiBand && a.dtiBand.toLowerCase().includes('high')) || a.dtiExact > 40) return 'High debt-to-income ratio';
  if (a.verifiedIncome && a.qualityScore >= 80) return 'Strong verified affordability';
  if (a.qualityScore >= 80) return 'Strong affordability profile';
  if (a.coApplicant) return 'Co-applicant strengthens profile';
  return 'Review full detail';
}

function isExpiringSoon(expiresAt) {
  if (!expiresAt) return false;
  return (new Date(expiresAt) - Date.now()) < 48 * 3600 * 1000;
}

function expectedValue(a) {
  const urgency = isExpiringSoon(a.bidDeadline || a.expiresAt) ? 10 : 0;
  return (a.qualityScore + urgency) * a.requestedAmount / 1_000_000;
}

function ltvStyle(ltv) {
  if (ltv <= 80) return { bg: '#dcfce7', color: '#166534' };
  if (ltv <= 100) return { bg: '#fef3c7', color: '#92400e' };
  return { bg: '#fee2e2', color: '#991b1b' };
}

const TYPE_TAG = {
  swap:        { label: 'Switch',   bg: '#ede9fe', color: '#5b21b6', Icon: RefreshCw },
  origination: { label: 'New bond', bg: '#dbeafe', color: '#1e40af', Icon: Home },
};
function typeMeta(type) {
  return type === 'swap' ? TYPE_TAG.swap : TYPE_TAG.origination;
}

// CSV export (#21) — client-side generation + download of the filtered list.
function csvCell(v) {
  if (v == null) return '';
  const s = String(v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function exportCsv(rows) {
  const cols = ['ref', 'type', 'amount', 'region', 'qualityScore', 'riskTier', 'recommendation', 'bidDeadline', 'submittedAt'];
  const lines = [cols.join(',')];
  rows.forEach(a => {
    lines.push([
      csvCell(a.ref),
      csvCell(a.type === 'swap' ? 'Switch' : 'New bond'),
      csvCell(a.requestedAmount),
      csvCell(a.region),
      csvCell(a.qualityScore),
      csvCell(a.riskTier),
      csvCell(getRecommendation(a)),
      csvCell(a.bidDeadline || a.expiresAt || ''),
      csvCell(a.submittedAt || ''),
    ].join(','));
  });
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `bondly-deal-queue-${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}

// Date-range filter (#20) — preset windows over submittedAt.
function withinDateRange(submittedAt, preset) {
  if (!preset) return true;
  if (!submittedAt) return false;
  const days = preset === '7' ? 7 : preset === '30' ? 30 : preset === '90' ? 90 : 0;
  if (!days) return true;
  return (Date.now() - new Date(submittedAt).getTime()) <= days * 86400000;
}

// --- Component ---

export default function BankApplications() {
  const [apps, setApps]         = useState(null);
  const [err, setErr]           = useState(null);
  const [type, setType]         = useState('');
  const [minScore, setMin]      = useState('');
  const [region, setRegion]     = useState('');
  const [sort, setSort]         = useState('value');
  const [riskTier, setRiskTier] = useState('');
  const [maxLtv, setMaxLtv]     = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sector, setSector]       = useState('');
  const [dateRange, setDateRange] = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [search, setSearch]       = useState('');
  const [selected, setSelected]   = useState(() => new Set());
  const [toast, setToast]         = useState(null);
  // Locally-applied bulk decisions (mirrors the per-app detail flow, which is
  // also client-side only — there is no decline/refer backend endpoint).
  const [decisions, setDecisions] = useState(() => ({})); // { [ref]: 'declined' | 'referred' }

  function refresh() {
    setApps(null);
    bankApi.applications({ type, minScore, region, sort, riskTier, maxLtv, minAmount, maxAmount, sector })
      .then(d => setApps(d.applications))
      .catch(e => setErr(e.message));
  }
  useEffect(refresh, [type, minScore, region, sort, riskTier, maxLtv, minAmount, maxAmount, sector]);

  const sorted = useMemo(() => {
    if (!apps) return [];
    const q = search.trim().toLowerCase();
    return [...apps]
      .filter(a => withinDateRange(a.submittedAt, dateRange))
      .filter(a => {
        if (!q) return true;
        const ref    = (a.ref || '').toLowerCase();
        const reg    = (a.region || '').toLowerCase();
        const amount = String(a.requestedAmount ?? '');
        return ref.includes(q) || reg.includes(q) || amount.includes(q);
      })
      .sort((a, b) => {
        if (sort === 'newest') return new Date(b.submittedAt) - new Date(a.submittedAt);
        if (sort === 'score')  return (b.qualityScore || 0) - (a.qualityScore || 0);
        if (sort === 'amount') return (b.requestedAmount || 0) - (a.requestedAmount || 0);
        return expectedValue(b) - expectedValue(a); // 'value' (default) = expected value
      });
  }, [apps, search, dateRange, sort]);

  const activeFilterCount = [type, minScore, region, riskTier, maxLtv, minAmount, maxAmount, sector, dateRange].filter(Boolean).length;

  // Region dropdown options (#16) — distinct regions present in the loaded
  // applications, replacing the brittle free-text box (typing 'GP' vs 'Gauteng'
  // vs lowercase used to fail). Keep the current selection visible even if the
  // backend-filtered list no longer contains it.
  const regionOptions = useMemo(() => {
    const set = new Set();
    (apps || []).forEach(a => { if (a.region) set.add(a.region); });
    if (region) set.add(region);
    return [...set].sort((a, b) => a.localeCompare(b));
  }, [apps, region]);

  // Keep the selection valid as the filtered list changes.
  const visibleRefs = useMemo(() => new Set(sorted.map(a => a.ref)), [sorted]);
  const selectedVisible = useMemo(
    () => [...selected].filter(ref => visibleRefs.has(ref)),
    [selected, visibleRefs],
  );
  const allSelected = sorted.length > 0 && selectedVisible.length === sorted.length;

  function showToast(text, kind) {
    setToast({ text, kind });
    setTimeout(() => setToast(t => (t && t.text === text ? null : t)), 5000);
  }

  function toggleRow(ref, e) {
    if (e) { e.preventDefault(); e.stopPropagation(); }
    setSelected(prev => {
      const next = new Set(prev);
      if (next.has(ref)) next.delete(ref); else next.add(ref);
      return next;
    });
  }

  function toggleSelectAll() {
    setSelected(prev => {
      if (allSelected) {
        const next = new Set(prev);
        visibleRefs.forEach(ref => next.delete(ref));
        return next;
      }
      return new Set([...prev, ...visibleRefs]);
    });
  }

  function applyBulk(kind) {
    const refs = selectedVisible;
    if (refs.length === 0) return;
    if (kind === 'declined' && !window.confirm(`Decline ${refs.length} application${refs.length === 1 ? '' : 's'}? This can't be undone.`)) return;
    setDecisions(prev => {
      const next = { ...prev };
      refs.forEach(ref => { next[ref] = kind; });
      return next;
    });
    setSelected(new Set());
    const verb = kind === 'declined' ? 'Declined' : 'Referred to credit';
    showToast(`${verb} ${refs.length} application${refs.length === 1 ? '' : 's'}.`, kind === 'declined' ? 'decline' : 'refer');
  }

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 4 }}>
        <h2 style={{ margin: 0 }}>Deal review queue</h2>
        {apps && (
          <span style={{ fontSize: '0.82rem', color: '#6b7280', fontWeight: 500 }}>
            {sorted.length} open {sorted.length === 1 ? 'deal' : 'deals'}
          </span>
        )}
      </div>
      <p className="lede" style={{ marginBottom: 16 }}>
        Sorted by{' '}
        <span title="Expected value = quality score × loan amount ÷ 1M, boosted +10 for deals expiring within 48 hours. Higher = more valuable and likely to close." style={{ borderBottom: '1px dashed #9ca3af', cursor: 'help' }}>expected value ⓘ</span>.
        {' '}Every application is anonymised — customer name revealed on bid acceptance.
      </p>

      {/* Search bar (#19) + Export (#21) */}
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
        <div style={{ position: 'relative', flex: 1, minWidth: 240 }}>
          <Search size={16} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: '#9ca3af', pointerEvents: 'none' }} />
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search by reference, amount, or region…"
            style={{
              width: '100%', boxSizing: 'border-box',
              padding: '9px 12px 9px 36px', borderRadius: 8,
              border: '1.5px solid #d1d5db', fontSize: '0.86rem',
              background: '#fff', color: '#0b1e2d',
            }}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              aria-label="Clear search"
              style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', border: 'none', background: 'transparent', color: '#9ca3af', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, padding: 4 }}
            >×</button>
          )}
        </div>
        <button
          onClick={() => exportCsv(sorted)}
          disabled={sorted.length === 0}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            padding: '9px 16px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 700,
            background: sorted.length === 0 ? '#f3f4f6' : '#fff',
            color: sorted.length === 0 ? '#9ca3af' : '#1e3a5f',
            border: '1.5px solid ' + (sorted.length === 0 ? '#e5e7eb' : '#1e3a5f'),
            cursor: sorted.length === 0 ? 'not-allowed' : 'pointer',
          }}
        >
          <Download size={15} /> Export CSV
        </button>
      </div>

      {/* Recommendation chip legend (#17) */}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14, fontSize: '0.72rem', color: '#6b7280' }}>
        <span style={{ fontWeight: 600 }}>Bondly recommendation:</span>
        {Object.entries(REC_STYLE).map(([label, s]) => (
          <span key={label} style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}>
            <span style={{ width: 9, height: 9, borderRadius: 2, background: s.bg, display: 'inline-block' }} />
            {label}
          </span>
        ))}
        <span style={{ color: '#9ca3af' }}>· derived from risk tier × quality score</span>
      </div>

      {/* Filter toggle */}
      <div style={{ marginBottom: 12 }}>
        <button
          onClick={() => setFiltersOpen(v => !v)}
          style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            padding: '5px 14px', borderRadius: 99, fontSize: '0.8rem', fontWeight: 600,
            background: filtersOpen ? '#1e3a5f' : '#f3f4f6',
            color: filtersOpen ? '#fff' : '#374151',
            border: '1.5px solid ' + (filtersOpen ? '#1e3a5f' : '#d1d5db'),
            cursor: 'pointer',
          }}
        >
          <span>Filter</span>
          {activeFilterCount > 0 && (
            <span style={{
              background: '#2563eb', color: '#fff',
              borderRadius: 99, padding: '0 6px', fontSize: '0.72rem', fontWeight: 800,
            }}>{activeFilterCount}</span>
          )}
          <span style={{ fontSize: '0.7rem' }}>{filtersOpen ? '▲' : '▼'}</span>
        </button>
      </div>

      {filtersOpen && (
        <div className="bank-toolbar" style={{ marginBottom: 10 }}>
          <label>Type
            <select value={type} onChange={e => setType(e.target.value)}>
              <option value="">All</option>
              <option value="origination">New bond</option>
              <option value="swap">Switch</option>
            </select>
          </label>
          <label>Min quality
            <select value={minScore} onChange={e => setMin(e.target.value)}>
              <option value="">All</option>
              <option value="60">60+</option>
              <option value="75">75+</option>
              <option value="85">85+</option>
            </select>
          </label>
          <label>Region
            <select value={region} onChange={e => setRegion(e.target.value)}>
              <option value="">All regions</option>
              {regionOptions.map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </label>
          <label>Sort
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="value">Expected value</option>
              <option value="newest">Newest</option>
              <option value="score">Highest quality</option>
              <option value="amount">Largest amount</option>
            </select>
          </label>
          <label>Submitted
            <select value={dateRange} onChange={e => setDateRange(e.target.value)}>
              <option value="">All time</option>
              <option value="7">Last 7 days</option>
              <option value="30">Last 30 days</option>
              <option value="90">Last 90 days</option>
            </select>
          </label>
          <label>Max LTV
            <select value={maxLtv} onChange={e => setMaxLtv(e.target.value)}>
              <option value="">Any</option>
              <option value="70">≤70%</option>
              <option value="80">≤80%</option>
              <option value="90">≤90%</option>
              <option value="100">≤100%</option>
            </select>
          </label>
          <label>Min amount
            <select value={minAmount} onChange={e => setMinAmount(e.target.value)}>
              <option value="">Any</option>
              <option value="500000">R500k+</option>
              <option value="1000000">R1m+</option>
              <option value="2000000">R2m+</option>
              <option value="5000000">R5m+</option>
            </select>
          </label>
          <label>Max amount
            <select value={maxAmount} onChange={e => setMaxAmount(e.target.value)}>
              <option value="">Any</option>
              <option value="1000000">≤R1m</option>
              <option value="2000000">≤R2m</option>
              <option value="5000000">≤R5m</option>
              <option value="10000000">≤R10m</option>
            </select>
          </label>
          <label>Sector
            <select value={sector} onChange={e => setSector(e.target.value)}>
              <option value="">All sectors</option>
              <option value="government">Government</option>
              <option value="healthcare">Healthcare</option>
              <option value="professional">Professional services</option>
              <option value="mining">Mining</option>
              <option value="retail">Retail</option>
              <option value="informal">Informal / Domestic</option>
            </select>
          </label>
        </div>
      )}

      {/* Risk tier quick-filter */}
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', margin: '0 0 18px' }}>
        {[
          { label: 'All tiers', value: '',         bg: '#f3f4f6', color: '#374151',  border: '#9ca3af'  },
          { label: 'Green',     value: 'green',    bg: '#dcfce7', color: '#166534',  border: '#166534'  },
          { label: 'Amber',     value: 'amber',    bg: '#fef3c7', color: '#92400e',  border: '#92400e'  },
          { label: 'Red',       value: 'red',      bg: '#fee2e2', color: '#991b1b',  border: '#991b1b'  },
          { label: 'Critical',  value: 'critical', bg: '#3b0764', color: '#fff',     border: '#3b0764'  },
        ].map(chip => (
          <button
            key={chip.value}
            onClick={() => setRiskTier(riskTier === chip.value ? '' : chip.value)}
            style={{
              background: chip.bg, color: chip.color,
              border: riskTier === chip.value ? `2px solid ${chip.border}` : '2px solid transparent',
              borderRadius: 99, padding: '3px 12px', fontSize: '0.78rem', fontWeight: 700,
              cursor: 'pointer',
            }}
          >{chip.label}</button>
        ))}
      </div>

      {/* Select-all + bulk action bar (#10) */}
      {apps && sorted.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', marginBottom: 12 }}>
          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: '0.8rem', fontWeight: 600, color: '#374151', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={allSelected}
              ref={el => { if (el) el.indeterminate = selectedVisible.length > 0 && !allSelected; }}
              onChange={toggleSelectAll}
              style={{ width: 16, height: 16, cursor: 'pointer' }}
            />
            {selectedVisible.length > 0 ? `${selectedVisible.length} selected` : 'Select all'}
          </label>
          {selectedVisible.length > 0 && (
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <button
                onClick={() => applyBulk('referred')}
                style={{ padding: '5px 14px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 700, background: '#ede9fe', color: '#5b21b6', border: '1.5px solid #ddd6fe', cursor: 'pointer' }}
              >Refer {selectedVisible.length} to credit</button>
              <button
                onClick={() => applyBulk('declined')}
                style={{ padding: '5px 14px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 700, background: '#fee2e2', color: '#991b1b', border: '1.5px solid #fecaca', cursor: 'pointer' }}
              >Decline {selectedVisible.length}</button>
              <button
                onClick={() => setSelected(new Set())}
                style={{ padding: '5px 12px', borderRadius: 7, fontSize: '0.8rem', fontWeight: 600, background: 'transparent', color: '#6b7280', border: '1.5px solid #e5e7eb', cursor: 'pointer' }}
              >Clear</button>
            </div>
          )}
        </div>
      )}

      {toast && (
        <div style={{
          marginBottom: 12, padding: '10px 14px', borderRadius: 8, fontSize: '0.82rem', fontWeight: 600,
          background: toast.kind === 'decline' ? '#fee2e2' : '#ede9fe',
          color: toast.kind === 'decline' ? '#991b1b' : '#5b21b6',
          border: `1px solid ${toast.kind === 'decline' ? '#fecaca' : '#ddd6fe'}`,
        }}>
          {toast.text}
        </div>
      )}

      {err && <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>}
      {!apps && !err && <div className="bank-section">Loading…</div>}
      {apps && sorted.length === 0 && (
        <div className="bank-section" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📬</div>
          <div style={{ fontWeight: 700, color: '#0b1e2d', marginBottom: 6 }}>
            {apps.length === 0 ? 'No deals in the queue yet' : 'No applications match the current filters'}
          </div>
          <p style={{ color: '#6b7280', fontSize: '0.83rem', maxWidth: 380, margin: '0 auto 16px' }}>
            {apps.length === 0
              ? 'New mortgage applications from across the market will appear here as they arrive. Set up Auto-bid rules so you never miss a deal that matches your criteria.'
              : 'Try clearing the filters or selecting a different risk tier.'}
          </p>
          {apps.length === 0 && (
            <a href="/bank/auto-bid" style={{ display: 'inline-block', padding: '8px 18px', background: '#0b1e2d', color: '#fff', borderRadius: 7, fontSize: '0.83rem', fontWeight: 700, textDecoration: 'none' }}>
              Set up Auto-bid →
            </a>
          )}
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {sorted.map(a => {
          const rec      = getRecommendation(a);
          const grade    = getGrade(a.qualityScore);
          const recStyle = REC_STYLE[rec];
          const grStyle  = GRADE_STYLE[grade];
          const reason   = getHeadlineReason(a);
          const ltv      = a.propertyContext?.ltv;
          const lStyle   = ltv != null ? ltvStyle(ltv) : null;
          const deadline = a.bidDeadline || a.expiresAt;
          const expiring = isExpiringSoon(deadline);
          const expLabel = deadline
            ? (timeUntil(deadline) === 'closed' ? 'Closed' : `Closes ${timeUntil(deadline)}`)
            : null;

          const hasFlags = a.fraudFlag || expiring || a.verifiedIncome || a.coApplicant;
          const tMeta    = typeMeta(a.type);
          const TIcon    = tMeta.Icon;
          const isSel    = selected.has(a.ref);
          const decision = decisions[a.ref];

          return (
            <Link
              key={a.ref}
              to={`/bank/applications/${a.ref}`}
              className="bank-card"
              style={{
                textDecoration: 'none', display: 'block', padding: '16px 20px',
                ...(isSel ? { outline: '2px solid #1e3a5f', outlineOffset: -1 } : {}),
                ...(decision ? { opacity: 0.62 } : {}),
              }}
            >
              {/* Top row: select + recommendation badge + grade chip + ref + type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
                {/* Row select (#10) */}
                <input
                  type="checkbox"
                  checked={isSel}
                  onClick={e => toggleRow(a.ref, e)}
                  onChange={() => {}}
                  aria-label={`Select ${a.ref}`}
                  style={{ width: 16, height: 16, cursor: 'pointer' }}
                />

                {decision && (
                  <span style={{
                    background: decision === 'declined' ? '#fee2e2' : '#ede9fe',
                    color: decision === 'declined' ? '#991b1b' : '#5b21b6',
                    borderRadius: 99, padding: '3px 10px', fontSize: '0.72rem', fontWeight: 800,
                    textTransform: 'uppercase', letterSpacing: '0.04em',
                  }}>
                    {decision === 'declined' ? 'Declined' : 'Referred'}
                  </span>
                )}

                {/* Recommendation — dominant element */}
                <span style={{
                  background: recStyle.bg, color: recStyle.color,
                  borderRadius: 99, padding: '5px 18px',
                  fontSize: '0.95rem', fontWeight: 800, letterSpacing: '0.03em',
                  textTransform: 'uppercase',
                }}>
                  {rec}
                </span>

                {/* Grade chip */}
                <span style={{
                  background: grStyle.bg, color: grStyle.color,
                  borderRadius: 99, padding: '3px 10px',
                  fontSize: '0.78rem', fontWeight: 800,
                  fontFamily: 'monospace', letterSpacing: '0.06em',
                  border: `1.5px solid ${grStyle.color}22`,
                }}>
                  {grade} · {a.qualityScore}
                </span>

                <span style={{ flex: 1 }} />

                {/* Ref + type */}
                <span style={{ fontSize: '0.75rem', color: '#9ca3af', fontFamily: 'monospace' }}>{a.ref}</span>
                <span style={{
                  display: 'inline-flex', alignItems: 'center', gap: 5,
                  background: tMeta.bg, color: tMeta.color,
                  borderRadius: 99, padding: '3px 10px',
                  fontSize: '0.72rem', fontWeight: 700,
                }}>
                  <TIcon size={12} strokeWidth={2.5} />
                  {tMeta.label}
                </span>
              </div>

              {/* Headline reason */}
              <div style={{
                fontSize: '0.9rem', fontWeight: 600, color: '#1e293b',
                marginBottom: 12, lineHeight: 1.3,
              }}>
                {reason}
              </div>

              {/* Key figures row */}
              <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap', alignItems: 'center', marginBottom: hasFlags ? 10 : 0 }}>
                {/* Loan amount */}
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Loan</div>
                  <div style={{ fontSize: '1.05rem', fontWeight: 700, color: '#0b1e2d', display: 'flex', alignItems: 'center', gap: 6 }}>
                    {bankFmtR(a.requestedAmount)}
                    {lStyle && (
                      <span style={{
                        fontSize: '0.68rem', fontWeight: 700, padding: '2px 7px', borderRadius: 99,
                        background: lStyle.bg, color: lStyle.color,
                      }}>
                        LTV {ltv}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 32, background: '#e5e7eb' }} />

                {/* Bids */}
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Bids</div>
                  <div style={{
                    fontSize: '0.9rem', fontWeight: 700,
                    color: a.activeBidCount > 0 ? '#0b1e2d' : '#15803d',
                  }}>
                    {a.activeBidCount > 0
                      ? `${a.activeBidCount} bid${a.activeBidCount === 1 ? '' : 's'}`
                      : 'No bids yet'}
                  </div>
                </div>

                {/* Divider */}
                <div style={{ width: 1, height: 32, background: '#e5e7eb' }} />

                {/* Deadline */}
                <div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Deadline</div>
                  <div style={{
                    fontSize: '0.85rem', fontWeight: 700,
                    color: !expLabel ? '#9ca3af'
                      : timeUntil(deadline) === 'closed' ? '#991b1b'
                      : expiring ? '#c8a84b' : '#6b7280',
                  }}>
                    {expLabel || '—'}
                  </div>
                </div>

                {a.region && (
                  <>
                    <div style={{ width: 1, height: 32, background: '#e5e7eb' }} />
                    <div>
                      <div style={{ fontSize: '0.68rem', color: '#9ca3af', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Region</div>
                      <div style={{ fontSize: '0.85rem', fontWeight: 600, color: '#374151' }}>{a.region}</div>
                    </div>
                  </>
                )}
              </div>

              {/* Flags row */}
              {hasFlags && (
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
                  {a.fraudFlag && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#991b1b', background: '#fee2e2', borderRadius: 99, padding: '2px 9px' }}>
                      ⚠ fraud flagged
                    </span>
                  )}
                  {expiring && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#92400e', background: '#fef3c7', borderRadius: 99, padding: '2px 9px' }}>
                      ⏰ expires soon
                    </span>
                  )}
                  {a.verifiedIncome && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#166534', background: '#dcfce7', borderRadius: 99, padding: '2px 9px' }}>
                      ✓ verified income
                    </span>
                  )}
                  {a.coApplicant && (
                    <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#1e40af', background: '#dbeafe', borderRadius: 99, padding: '2px 9px' }}>
                      + co-applicant
                    </span>
                  )}
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </>
  );
}
