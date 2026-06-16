import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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
  const urgency = isExpiringSoon(a.expiresAt) ? 10 : 0;
  return (a.qualityScore + urgency) * a.requestedAmount / 1_000_000;
}

function ltvStyle(ltv) {
  if (ltv <= 80) return { bg: '#dcfce7', color: '#166534' };
  if (ltv <= 100) return { bg: '#fef3c7', color: '#92400e' };
  return { bg: '#fee2e2', color: '#991b1b' };
}

// --- Component ---

export default function BankApplications() {
  const [apps, setApps]         = useState(null);
  const [err, setErr]           = useState(null);
  const [type, setType]         = useState('');
  const [minScore, setMin]      = useState('');
  const [region, setRegion]     = useState('');
  const [sort, setSort]         = useState('newest');
  const [riskTier, setRiskTier] = useState('');
  const [maxLtv, setMaxLtv]     = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [sector, setSector]       = useState('');
  const [filtersOpen, setFiltersOpen] = useState(false);

  function refresh() {
    setApps(null);
    bankApi.applications({ type, minScore, region, sort, riskTier, maxLtv, minAmount, maxAmount, sector })
      .then(d => setApps(d.applications))
      .catch(e => setErr(e.message));
  }
  useEffect(refresh, [type, minScore, region, sort, riskTier, maxLtv, minAmount, maxAmount, sector]);

  const sorted = useMemo(() => {
    if (!apps) return [];
    return [...apps].sort((a, b) => expectedValue(b) - expectedValue(a));
  }, [apps]);

  const activeFilterCount = [type, minScore, region, riskTier, maxLtv, minAmount, maxAmount, sector].filter(Boolean).length;

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
            <input value={region} onChange={e => setRegion(e.target.value)} placeholder="e.g. Gauteng" />
          </label>
          <label>Sort
            <select value={sort} onChange={e => setSort(e.target.value)}>
              <option value="newest">Newest</option>
              <option value="score">Highest quality</option>
              <option value="amount">Largest amount</option>
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
          const expiring = isExpiringSoon(a.expiresAt);
          const expLabel = a.expiresAt
            ? (timeUntil(a.expiresAt) === 'closed' ? 'Closed' : `Expires ${timeUntil(a.expiresAt)}`)
            : null;

          const hasFlags = a.fraudFlag || expiring || a.verifiedIncome || a.coApplicant;

          return (
            <Link
              key={a.ref}
              to={`/bank/applications/${a.ref}`}
              className="bank-card"
              style={{ textDecoration: 'none', display: 'block', padding: '16px 20px' }}
            >
              {/* Top row: recommendation badge + grade chip + ref + type */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10, flexWrap: 'wrap' }}>
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
                <span className={'type-tag ' + a.type} style={{ fontSize: '0.72rem' }}>
                  {a.type === 'swap' ? 'Switch' : 'New bond'}
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
                      : timeUntil(a.expiresAt) === 'closed' ? '#991b1b'
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
