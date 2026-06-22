import { useState, useEffect, useCallback } from 'react';
import {
  getIntelligencePortfolio,
  getIntelligenceAccounts,
  getIntelligenceAccount,
  getIntelligenceAlerts,
  resolveIntelligenceAlert,
} from '../../lib/api.js';
import './Intelligence.css';

// ── Helpers ───────────────────────────────────────────────
function fmtRand(n) {
  if (n == null) return '—';
  return 'R ' + Math.round(n).toLocaleString('en-ZA');
}

function fmtScore(n) {
  if (n == null) return '—';
  return Number(n).toFixed(2);
}

function fmtDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-ZA', { day: '2-digit', month: 'short', year: 'numeric' });
}

function fmtPct(n) {
  if (n == null) return '—';
  return Number(n).toFixed(2);
}

function tierClass(tier) {
  const t = (tier || '').toLowerCase();
  if (t === 'green')    return 'green';
  if (t === 'amber')    return 'amber';
  if (t === 'red')      return 'red';
  if (t === 'critical') return 'critical';
  return 'amber';
}

function tierDot(tier) {
  const map = { green: '#238636', amber: '#d29922', red: '#da3633', critical: '#8957e5' };
  return map[tierClass(tier)] || '#7d8590';
}

function TierBadge({ tier }) {
  const tc = tierClass(tier);
  const icons = { green: '●', amber: '●', red: '●', critical: '●' };
  return (
    <span className={`intel__tier intel__tier--${tc}`}>
      <span className="intel__tier-dot" style={{ background: tierDot(tier) }} />
      {(tier || '—').charAt(0).toUpperCase() + (tier || '—').slice(1).toLowerCase()}
    </span>
  );
}

function TrendCell({ trend }) {
  if (!trend || trend === 'stable') return <span className="intel__trend intel__trend--flat">— stable</span>;
  if (trend === 'improving') return <span className="intel__trend intel__trend--down">▼ improving</span>;
  if (trend === 'worsening') return <span className="intel__trend intel__trend--up">▲ worsening</span>;
  return <span className="intel__trend intel__trend--flat">{trend}</span>;
}

// Map raw SHAP feature names to plain English
const SHAP_LABELS = {
  buffer_ratio:          'Low cash buffer relative to income',
  failed_debit_count:    'Multiple failed debit orders detected',
  income_monthly:        'Below-average monthly income for this cohort',
  income_volatility:     'Volatile or irregular income pattern',
  debt_service_ratio:    'High debt servicing relative to income',
  spending_ratio:        'Excessive spending relative to income',
  credit_utilisation:    'High credit card utilisation',
  debit_failures_recent: 'Recent surge in failed debits',
  employment_sector:     'Higher-risk employment sector',
  geographic_risk:       'Located in elevated-distress geographic zone',
};

function shapLabel(key) {
  return SHAP_LABELS[key] || key.replace(/_/g, ' ');
}

// ── Score timeline (CSS-only bar chart) ───────────────────
function ScoreTimeline({ snapshots }) {
  if (!snapshots || snapshots.length === 0) {
    return <div className="intel__empty" style={{ padding: '20px 0' }}>No snapshot history available.</div>;
  }

  const scores  = snapshots.map(s => s.risk_score ?? 0);
  const maxScore = Math.max(...scores, 1);
  const minScore = Math.min(...scores, 0);
  const range = maxScore - minScore || 1;

  // Show last 12 snapshots
  const visible = snapshots.slice(-12);

  return (
    <div className="intel__timeline-chart" style={{ position: 'relative', height: 80, display: 'flex', alignItems: 'flex-end', gap: 4, padding: '0 0 24px' }}>
      {visible.map((snap, i) => {
        const pct = ((snap.risk_score ?? 0) - minScore) / range;
        const h = Math.max(4, Math.round(pct * 56));
        const tc = tierClass(snap.risk_tier);
        const colors = { green: '#238636', amber: '#d29922', red: '#da3633', critical: '#8957e5' };
        const color = colors[tc] || '#7d8590';
        const isLast = i === visible.length - 1;

        return (
          <div
            key={snap.snapshot_date + i}
            title={`${fmtDate(snap.snapshot_date)}: score ${fmtScore(snap.risk_score)} (${snap.risk_tier})`}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              height: '100%',
              justifyContent: 'flex-end',
              position: 'relative',
              minWidth: 0,
            }}
          >
            <div
              style={{
                width: '100%',
                height: h,
                background: color,
                opacity: isLast ? 1 : 0.55,
                borderRadius: '3px 3px 0 0',
                transition: 'opacity 0.15s',
              }}
            />
            {(i === 0 || i === Math.floor(visible.length / 2) || isLast) && (
              <span style={{
                position: 'absolute',
                bottom: -20,
                fontSize: '0.52rem',
                color: '#484f58',
                whiteSpace: 'nowrap',
                transform: 'translateX(-50%)',
                left: '50%',
              }}>
                {fmtDate(snap.snapshot_date)}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Account drill-down panel ──────────────────────────────
function DrillDown({ userId, onClose }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    getIntelligenceAccount(userId)
      .then(d => { setData(d); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, [userId]);

  const snapshots = data?.snapshots || [];
  const alerts    = data?.alerts    || [];
  const latest    = snapshots[snapshots.length - 1] || {};
  const shapReasons = latest.shap_reasons || [];

  return (
    <tr>
      <td colSpan={8} style={{ padding: 0 }}>
        <div className="intel__drill">
          <div className="intel__drill-header">
            <span className="intel__drill-title">Account detail — {userId}</span>
            <button className="intel__drill-close" onClick={onClose} aria-label="Close drill-down">✕</button>
          </div>

          {loading && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#7d8590', fontSize: '0.82rem' }}>
              <div className="intel__spinner" style={{ width: 20, height: 20 }} /> Loading…
            </div>
          )}

          {error && (
            <div style={{ color: '#da3633', fontSize: '0.8rem' }}>Failed to load: {error}</div>
          )}

          {!loading && !error && data && (
            <div className="intel__drill-cols">
              {/* Left: score timeline */}
              <div>
                <div className="intel__chart-label">Risk score — last {Math.min(snapshots.length, 12)} snapshots</div>
                <ScoreTimeline snapshots={snapshots} />

                {alerts.length > 0 && (
                  <div style={{ marginTop: 20 }}>
                    <div className="intel__chart-label">Alerts on this account</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
                      {alerts.slice(0, 4).map((a, i) => (
                        <div key={a.id || i} style={{
                          background: '#0d1117',
                          border: '1px solid #21262d',
                          borderRadius: 6,
                          padding: '8px 12px',
                          fontSize: '0.75rem',
                        }}>
                          <div style={{ display: 'flex', gap: 8, alignItems: 'center', marginBottom: 3 }}>
                            <TierBadge tier={a.previous_tier} />
                            <span style={{ color: '#7d8590' }}>→</span>
                            <TierBadge tier={a.new_tier} />
                            <span style={{ color: '#7d8590', fontSize: '0.68rem', marginLeft: 'auto' }}>{fmtDate(a.alert_date)}</span>
                          </div>
                          {a.resolved && <span style={{ fontSize: '0.65rem', color: '#238636', fontWeight: 700 }}>RESOLVED</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Right: SHAP reasons — FI-F7: suppressed from synthetic/pilot model */}
              <div>
                <div className="intel__chart-label">Risk drivers (SHAP)</div>
                {/* FI-F7: Do not surface adverse-action SHAP reasons from synthetic pilot model.
                    When a production-certified model is available, remove this suppression block. */}
                <div style={{
                  background: '#161b22',
                  border: '1px solid #30363d',
                  borderRadius: 6,
                  padding: '10px 14px',
                  fontSize: '0.76rem',
                  color: '#7d8590',
                  lineHeight: 1.5,
                }}>
                  <strong style={{ color: '#d29922' }}>Simulation-trained pilot</strong>
                  {' — '}SHAP feature attributions are not shown because this model was trained on synthetic data.
                  Adverse-action reasons must not be derived from a non-production model.
                  {shapReasons.length > 0 && (
                    <span style={{ display: 'block', marginTop: 4, color: '#484f58' }}>
                      ({shapReasons.length} SHAP factor{shapReasons.length !== 1 ? 's' : ''} available — suppressed pending production model certification)
                    </span>
                  )}
                </div>

                {/* Latest snapshot stats */}
                {snapshots.length > 0 && (
                  <div style={{ marginTop: 16, display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                    {[
                      ['Score',        fmtScore(latest.risk_score)],
                      ['Buffer ratio', fmtPct(latest.buffer_ratio) + '%'],
                      ['Income',       fmtRand(latest.income_monthly)],
                      ['Failed debits', latest.failed_debit_count ?? '—'],
                    ].map(([label, val]) => (
                      <div key={label} style={{
                        background: '#0d1117',
                        border: '1px solid #21262d',
                        borderRadius: 6,
                        padding: '10px 12px',
                      }}>
                        <div style={{ fontSize: '0.62rem', color: '#7d8590', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 3 }}>{label}</div>
                        <div style={{ fontFamily: "'IBM Plex Mono', monospace", fontSize: '1rem', fontWeight: 700, color: '#e6edf3' }}>{val}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ── Portfolio Tab ─────────────────────────────────────────
function PortfolioTab() {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(null);

  useEffect(() => {
    getIntelligencePortfolio()
      .then(d  => { setData(d);          setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  if (loading) return (
    <div className="intel__loader">
      <div className="intel__spinner" />
      <span style={{ color: '#7d8590', fontSize: '0.82rem' }}>Loading portfolio…</span>
    </div>
  );

  if (error) return (
    <div className="intel__error">
      <span style={{ fontSize: '1.5rem' }}>⚠</span>
      <span>Failed to load portfolio: {error}</span>
    </div>
  );

  if (!data) return null;

  const total    = data.total    || 0;
  const green    = data.green    || 0;
  const amber    = data.amber    || 0;
  const red      = data.red      || 0;
  const critical = data.critical || 0;
  const safe = total > 0 ? total : 1;

  const greenPct    = Math.round(green    / safe * 100);
  const amberPct    = Math.round(amber    / safe * 100);
  const redPct      = Math.round(red      / safe * 100);
  const criticalPct = Math.round(critical / safe * 100);

  return (
    <>
      {/* Stat cards */}
      <div className="intel__stat-grid">
        <div className="intel__stat">
          <span className="intel__stat-label">Total monitored</span>
          <span className="intel__stat-value">{total.toLocaleString('en-ZA')}</span>
          <span className="intel__stat-sub">{data.alerts_unresolved ?? 0} unresolved alerts</span>
        </div>
        <div className="intel__stat">
          <span className="intel__stat-label">Green — low risk</span>
          <span className="intel__stat-value intel__stat-value--green">{green.toLocaleString('en-ZA')}</span>
          <span className="intel__stat-sub">{greenPct}% of portfolio</span>
        </div>
        <div className="intel__stat">
          <span className="intel__stat-label">Amber — watch</span>
          <span className="intel__stat-value intel__stat-value--amber">{amber.toLocaleString('en-ZA')}</span>
          <span className="intel__stat-sub">{amberPct}% of portfolio</span>
        </div>
        <div className="intel__stat">
          <span className="intel__stat-label">Red + critical</span>
          <span className="intel__stat-value intel__stat-value--red">{(red + critical).toLocaleString('en-ZA')}</span>
          <span className="intel__stat-sub">{redPct + criticalPct}% of portfolio</span>
        </div>
      </div>

      {/* Tier distribution bar */}
      <div className="intel__dist-section">
        <div className="intel__dist-title">Portfolio tier distribution</div>
        <div className="intel__dist-bar">
          <div className="intel__dist-seg" style={{ width: greenPct + '%',    background: '#238636' }} />
          <div className="intel__dist-seg" style={{ width: amberPct + '%',    background: '#d29922' }} />
          <div className="intel__dist-seg" style={{ width: redPct + '%',      background: '#da3633' }} />
          <div className="intel__dist-seg" style={{ width: criticalPct + '%', background: '#8957e5' }} />
        </div>
        <div className="intel__dist-legend">
          {[
            { label: 'Green',    color: '#238636', pct: greenPct,    count: green    },
            { label: 'Amber',    color: '#d29922', pct: amberPct,    count: amber    },
            { label: 'Red',      color: '#da3633', pct: redPct,      count: red      },
            { label: 'Critical', color: '#8957e5', pct: criticalPct, count: critical },
          ].map(({ label, color, pct, count }) => (
            <div key={label} className="intel__dist-legend-item">
              <div className="intel__dist-dot" style={{ background: color }} />
              <span>{label}</span>
              <span style={{ color: '#e6edf3', fontWeight: 700, marginLeft: 2 }}>{count.toLocaleString('en-ZA')}</span>
              <span style={{ color: '#484f58' }}>({pct}%)</span>
            </div>
          ))}
        </div>
      </div>

      {data.latest_snapshot_date && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
          <div className="intel__live-dot" />
          <span style={{ fontSize: '0.72rem', color: '#7d8590' }}>
            Last snapshot: <span style={{ color: '#e6edf3' }}>{fmtDate(data.latest_snapshot_date)}</span>
          </span>
        </div>
      )}
    </>
  );
}

// ── Accounts Tab ──────────────────────────────────────────
const TIER_FILTERS = [
  { label: 'All',      value: '',         cls: '' },
  { label: 'Green',    value: 'green',    cls: 'green' },
  { label: 'Amber',    value: 'amber',    cls: 'amber' },
  { label: 'Red',      value: 'red',      cls: 'red' },
  { label: 'Critical', value: 'critical', cls: 'critical' },
];

function AccountsTab() {
  const [tier, setTier]           = useState('');
  const [page, setPage]           = useState(1);
  const [data, setData]           = useState(null);
  const [loading, setLoading]     = useState(true);
  const [error, setError]         = useState(null);
  const [expanded, setExpanded]   = useState(null);
  const LIMIT = 25;

  const load = useCallback((t, p) => {
    setLoading(true);
    setError(null);
    const params = { page: p, limit: LIMIT, ...(t ? { tier: t } : {}) };
    getIntelligenceAccounts(params)
      .then(d  => { setData(d);          setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }, []);

  useEffect(() => { load(tier, page); }, [tier, page, load]);

  function handleTierFilter(t) {
    setTier(t);
    setPage(1);
    setExpanded(null);
  }

  function handleRowClick(userId) {
    setExpanded(prev => prev === userId ? null : userId);
  }

  const accounts = data?.accounts || [];
  const totalRows = data?.total || 0;
  const totalPages = Math.max(1, Math.ceil(totalRows / LIMIT));

  return (
    <>
      {/* Filter row */}
      <div className="intel__filter-row">
        {TIER_FILTERS.map(f => (
          <button
            key={f.value}
            className={[
              'intel__filter-btn',
              f.cls ? `intel__filter-btn--${f.cls}` : '',
              tier === f.value ? 'intel__filter-btn--active' : '',
            ].filter(Boolean).join(' ')}
            onClick={() => handleTierFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
        <span style={{ marginLeft: 'auto', fontSize: '0.72rem', color: '#7d8590', alignSelf: 'center' }}>
          {totalRows.toLocaleString('en-ZA')} accounts
        </span>
      </div>

      {loading && (
        <div className="intel__loader" style={{ minHeight: 160 }}>
          <div className="intel__spinner" style={{ width: 28, height: 28 }} />
        </div>
      )}

      {error && (
        <div className="intel__error">
          <span>Failed to load accounts: {error}</span>
        </div>
      )}

      {!loading && !error && (
        <>
          <div className="intel__table-wrap">
            <table className="intel__table">
              <thead>
                <tr>
                  <th>User ID</th>
                  <th>Tier</th>
                  <th>Score</th>
                  <th>Monthly Income</th>
                  <th>Buffer Ratio</th>
                  <th>Failed Debits</th>
                  <th>Trend</th>
                  <th>Last Updated</th>
                </tr>
              </thead>
              <tbody>
                {accounts.length === 0 && (
                  <tr>
                    <td colSpan={8} style={{ textAlign: 'center', padding: '32px', color: '#7d8590' }}>
                      No accounts found for this filter.
                    </td>
                  </tr>
                )}
                {accounts.map((acc) => {
                  const isOpen = expanded === acc.user_id;
                  return [
                    <tr
                      key={acc.user_id}
                      onClick={() => handleRowClick(acc.user_id)}
                      className={isOpen ? 'intel__row--selected' : ''}
                      style={{ cursor: 'pointer' }}
                    >
                      <td><span className="intel__user-id">{acc.user_id}</span></td>
                      <td style={{ textAlign: 'right' }}><TierBadge tier={acc.risk_tier} /></td>
                      <td style={{ textAlign: 'right' }}><span className="intel__mono">{fmtScore(acc.risk_score)}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="intel__mono">{fmtRand(acc.income_monthly)}</span></td>
                      <td style={{ textAlign: 'right' }}><span className="intel__mono">{fmtPct(acc.buffer_ratio)}%</span></td>
                      <td style={{ textAlign: 'right' }}>
                        <span className="intel__mono" style={{ color: (acc.failed_debit_count || 0) > 2 ? '#da3633' : '#e6edf3' }}>
                          {acc.failed_debit_count ?? 0}
                        </span>
                      </td>
                      <td style={{ textAlign: 'right' }}><TrendCell trend={acc.trend} /></td>
                      <td style={{ textAlign: 'right', color: '#7d8590', fontSize: '0.72rem' }}>{fmtDate(acc.snapshot_date)}</td>
                    </tr>,
                    isOpen && (
                      <DrillDown
                        key={`drill-${acc.user_id}`}
                        userId={acc.user_id}
                        onClose={() => setExpanded(null)}
                      />
                    ),
                  ];
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          <div className="intel__pagination">
            <span>Page {page} of {totalPages}</span>
            <div className="intel__page-btns">
              <button
                className="intel__page-btn"
                disabled={page <= 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
              >
                ← Prev
              </button>
              <button
                className="intel__page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
              >
                Next →
              </button>
            </div>
          </div>
        </>
      )}
    </>
  );
}

// ── Alerts Tab ────────────────────────────────────────────
function AlertsTab() {
  const [alerts, setAlerts]     = useState([]);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);
  const [resolving, setResolving] = useState({});
  const [showResolved, setShowResolved] = useState(false);

  function load(resolved) {
    setLoading(true);
    getIntelligenceAlerts(resolved)
      .then(d  => { setAlerts(d?.alerts || d || []); setLoading(false); })
      .catch(e => { setError(e.message); setLoading(false); });
  }

  useEffect(() => { load(showResolved); }, [showResolved]);

  async function markResolved(alertId) {
    setResolving(r => ({ ...r, [alertId]: true }));
    try {
      // Optimistic update — mark locally immediately
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, resolved: true } : a
      ));
      // FI-F8: persist to backend so it survives reload
      await resolveIntelligenceAlert(alertId);
    } catch (e) {
      // Roll back optimistic update on failure
      setAlerts(prev => prev.map(a =>
        a.id === alertId ? { ...a, resolved: false } : a
      ));
    } finally {
      setResolving(r => { const n = { ...r }; delete n[alertId]; return n; });
    }
  }

  const visible = showResolved ? alerts : alerts.filter(a => !a.resolved);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16, gap: 12, flexWrap: 'wrap' }}>
        <div style={{ fontSize: '0.72rem', color: '#7d8590' }}>
          {visible.length} alert{visible.length !== 1 ? 's' : ''} {showResolved ? '(including resolved)' : '(unresolved)'}
        </div>
        <button
          className="intel__filter-btn"
          style={{ fontSize: '0.72rem' }}
          onClick={() => setShowResolved(s => !s)}
        >
          {showResolved ? 'Hide resolved' : 'Show resolved'}
        </button>
      </div>

      {loading && (
        <div className="intel__loader" style={{ minHeight: 160 }}>
          <div className="intel__spinner" style={{ width: 28, height: 28 }} />
        </div>
      )}

      {error && (
        <div className="intel__error"><span>Failed to load alerts: {error}</span></div>
      )}

      {!loading && !error && (
        <div className="intel__alerts-list">
          {visible.length === 0 && (
            <div className="intel__empty">No alerts. Portfolio looks clean.</div>
          )}

          {visible.map((alert, i) => (
            <div
              key={alert.id || i}
              className={['intel__alert-card', alert.resolved ? 'intel__alert-card--resolved' : ''].filter(Boolean).join(' ')}
            >
              <div className="intel__alert-meta">
                <div className="intel__alert-user">{alert.user_id}</div>
                <div className="intel__alert-date">{fmtDate(alert.alert_date)}</div>
                <div className="intel__alert-tier-change">
                  <TierBadge tier={alert.previous_tier} />
                  <span className="intel__alert-arrow">→</span>
                  <TierBadge tier={alert.new_tier} />
                </div>
                {alert.trigger_reasons && alert.trigger_reasons.length > 0 && (
                  <div className="intel__alert-reasons">
                    {alert.trigger_reasons.slice(0, 4).map((r, j) => (
                      <span key={j} className="intel__reason-pill">
                        {shapLabel(typeof r === 'string' ? r : (r.feature || r.key || `Factor ${j + 1}`))}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {!alert.resolved && (
                <button
                  className="intel__resolve-btn"
                  disabled={!!resolving[alert.id]}
                  onClick={() => markResolved(alert.id)}
                >
                  {resolving[alert.id] ? 'Resolving…' : 'Mark resolved'}
                </button>
              )}

              {alert.resolved && (
                <span style={{ fontSize: '0.7rem', color: '#238636', fontWeight: 700, alignSelf: 'center', whiteSpace: 'nowrap' }}>
                  ✓ Resolved
                </span>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}

// ── Root component ────────────────────────────────────────
const TABS = [
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'accounts',  label: 'Accounts'  },
  { id: 'alerts',    label: 'Alerts'    },
];

// FI-F7 / G2: Provenance banner — shown at the top of the terminal to make
// clear this is a simulation-trained pilot model, not a production-certified system.
function ProvenanceBanner({ provenance }) {
  if (!provenance) return null;
  return (
    <div style={{
      background: '#161b22',
      border: '1px solid #d29922',
      borderRadius: 8,
      padding: '10px 16px',
      marginBottom: 16,
      display: 'flex',
      alignItems: 'flex-start',
      gap: 10,
    }}>
      <span style={{ color: '#d29922', fontSize: '1rem', flexShrink: 0 }}>⚠</span>
      <div style={{ fontSize: '0.78rem', color: '#c9d1d9', lineHeight: 1.5 }}>
        <strong style={{ color: '#d29922' }}>Simulation-trained pilot</strong>
        {' — '}model trained on synthetic/demo data.
        {provenance.auc != null && <> AUC: <strong>{provenance.auc}</strong>.</>}
        {provenance.calibration != null && <> Calibration: <strong>{provenance.calibration}</strong>.</>}
        {' '}Risk scores are <strong>relative indicators only</strong>. Do not use for adverse-action decisions without a certified production model.
      </div>
    </div>
  );
}

export default function Intelligence() {
  const [tab, setTab] = useState('portfolio');
  const [provenance, setProvenance] = useState(null);

  // FI-F7: load provenance metadata from portfolio endpoint on mount
  useEffect(() => {
    getIntelligencePortfolio()
      .then(d => { if (d?.modelProvenance) setProvenance(d.modelProvenance); })
      .catch(() => {});
  }, []);

  return (
    <div className="intel">
      {/* Header */}
      <div className="intel__header">
        <div className="intel__header-top">
          <div>
            <span className="intel__badge">Risk Intelligence Terminal</span>
            <h2 className="intel__title">Portfolio Risk Monitor</h2>
            {/* G2: relabel from "real-time" / "live" to "simulation-trained pilot" */}
            <p className="intel__subtitle">Simulation-trained pilot — portfolio risk monitoring for your Bondly customer portfolio</p>
          </div>
          <div className="intel__last-updated">
            {/* G2: replace "Live feed" dot with "Simulation-trained pilot" label */}
            <span style={{ fontSize: '0.72rem', color: '#d29922', fontWeight: 600 }}>Simulation-trained pilot</span>
          </div>
        </div>

        {/* Tab bar */}
        <div className="intel__tabs" role="tablist">
          {TABS.map(t => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              className={['intel__tab', tab === t.id ? 'intel__tab--active' : ''].filter(Boolean).join(' ')}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Body */}
      <div className="intel__body" role="tabpanel">
        {/* FI-F7: provenance banner always visible */}
        <ProvenanceBanner provenance={provenance} />
        {tab === 'portfolio' && <PortfolioTab />}
        {tab === 'accounts'  && <AccountsTab  />}
        {tab === 'alerts'    && <AlertsTab    />}
      </div>
    </div>
  );
}
