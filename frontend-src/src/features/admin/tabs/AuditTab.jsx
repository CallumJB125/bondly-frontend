import { useState, useEffect, useCallback } from 'react';
import { adminAudit } from '../../../lib/api.js';
import './AuditTab.css';

// ── Sub-tab IDs ────────────────────────────────────────────────────────────────
const SUB_TABS = [
  { id: 'overview',    label: 'Overview'    },
  { id: 'parse-stats', label: 'Parse Stats' },
  { id: 'banks',       label: 'Bank Report' },
  { id: 'runs',        label: 'Runs'        },
  { id: 'errors',      label: 'Errors'      },
  { id: 'hallucinations', label: 'Hallucinations' },
  { id: 'calibration', label: 'Calibration' },
  { id: 'drift',       label: 'Drift'       },
  { id: 'synthetic',   label: 'Synthetic'   },
  { id: 'regression',  label: 'Regression'  },
];

// ── Severity badge ─────────────────────────────────────────────────────────────
function SeverityBadge({ severity }) {
  const colors = { critical: '#ef4444', high: '#f97316', medium: '#d97706', low: '#6b7280' };
  const c = colors[severity] || '#6b7280';
  return (
    <span style={{ fontSize: '0.73rem', padding: '2px 8px', borderRadius: 10, background: c + '22', color: c, fontWeight: 600 }}>
      {severity}
    </span>
  );
}

// ── Accuracy cell with colour ──────────────────────────────────────────────────
function AccuracyCell({ value, threshold = 0.80 }) {
  if (value === null || value === undefined) return <span style={{ color: 'var(--text-muted)' }}>—</span>;
  const pct = (value * 100).toFixed(1) + '%';
  const color = value >= 0.90 ? '#16a34a' : value >= threshold ? '#d97706' : '#ef4444';
  return <span style={{ fontWeight: 600, color }}>{pct}</span>;
}

// ── Pass/Fail badge ────────────────────────────────────────────────────────────
function PassBadge({ passed, label }) {
  return (
    <span style={{ fontSize: '0.78rem', padding: '3px 10px', borderRadius: 10,
      background: passed ? '#16a34a22' : '#ef444422',
      color: passed ? '#16a34a' : '#ef4444', fontWeight: 700 }}>
      {label || (passed ? 'PASS' : 'FAIL')}
    </span>
  );
}

// ── Loading spinner ────────────────────────────────────────────────────────────
function Spinner() {
  return <div className="audit-spinner"><div className="audit-spin-ring" /></div>;
}

// ── Empty state ────────────────────────────────────────────────────────────────
function EmptyState({ message = 'No data yet' }) {
  return <div className="audit-empty">{message}</div>;
}

// ── KPI Card ───────────────────────────────────────────────────────────────────
function KPICard({ label, value, sub, accent }) {
  return (
    <div className="audit-kpi-card" style={{ borderLeft: `4px solid ${accent || 'var(--forest)'}` }}>
      <div className="audit-kpi-sub">{label}</div>
      <div className="audit-kpi-value">{value ?? '—'}</div>
      {sub && <div className="audit-kpi-sub" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Overview sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function OverviewPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminAudit.overview()
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (err)     return <div className="audit-error">{err}</div>;
  if (!data)   return <EmptyState />;

  const { totalRuns, avgCatAccuracy, failureRate, hallucinationRate,
    avgDurationMs, calibrationScore, accuracyTrend, thresholds } = data;

  return (
    <div>
      <div className="audit-kpi-grid">
        <KPICard label="Total Runs (30d)" value={totalRuns.toLocaleString()} accent="var(--forest)" />
        <KPICard label="Avg Category Accuracy"
          value={avgCatAccuracy !== null ? (avgCatAccuracy * 100).toFixed(1) + '%' : '—'}
          sub={accuracyTrend !== null ? (accuracyTrend >= 0 ? `+${accuracyTrend}%` : `${accuracyTrend}%`) + ' vs prior 7d' : null}
          accent={avgCatAccuracy !== null && avgCatAccuracy >= 0.90 ? '#16a34a' : '#d97706'} />
        <KPICard label="Hallucination Rate"
          value={hallucinationRate + '%'}
          sub="per 100 runs"
          accent={hallucinationRate > 2 ? '#ef4444' : '#16a34a'} />
        <KPICard label="Failure Rate"
          value={failureRate + '%'}
          sub="parser failures"
          accent={failureRate > 5 ? '#ef4444' : '#d97706'} />
      </div>

      {accuracyTrend !== null && (
        <div className="audit-trend-banner" style={{ background: accuracyTrend >= 0 ? '#16a34a11' : '#ef444411', borderColor: accuracyTrend >= 0 ? '#16a34a' : '#ef4444' }}>
          <strong>Accuracy trend:</strong> {accuracyTrend >= 0 ? '+' : ''}{accuracyTrend}% vs prior week.
          {accuracyTrend < -2 && ' Consider reviewing recent model changes.'}
          {accuracyTrend >= 0 && ' Model performance is stable or improving.'}
        </div>
      )}

      {thresholds && (
        <div style={{ marginTop: 24 }}>
          <h4 className="audit-section-title">Quality Thresholds</h4>
          <div className="cust-table-wrap">
            <table className="audit-table">
              <thead>
                <tr>
                  {['Metric', 'Minimum', 'Current', 'Status'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {[
                  { label: 'Category Accuracy',    key: 'cat_accuracy_min',           curr: avgCatAccuracy },
                  { label: 'Confidence Calibration', key: 'confidence_calibration_min', curr: calibrationScore },
                  { label: 'Hallucination Rate',   key: 'hallucination_rate_max',      curr: hallucinationRate / 100, invert: true },
                ].map(row => {
                  const min = thresholds[row.key];
                  const ok = row.curr === null ? null : row.invert ? row.curr <= min : row.curr >= min;
                  return (
                    <tr key={row.key}>
                      <td>{row.label}</td>
                      <td>{row.invert ? '<' : '≥'} {(min * 100).toFixed(0)}%</td>
                      <td><AccuracyCell value={row.curr} threshold={row.invert ? 1 - min : min} /></td>
                      <td>{ok === null ? '—' : <PassBadge passed={ok} />}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Bank Report sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function BankReportPanel() {
  const [rows, setRows] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');

  useEffect(() => {
    adminAudit.bankReport()
      .then(setRows)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (err)     return <div className="audit-error">{err}</div>;
  if (!rows || rows.length === 0) return <EmptyState message="No benchmark data for the last 30 days" />;

  return (
    <div className="cust-table-wrap">
      <table className="audit-table">
        <thead>
          <tr>
            {['Bank', 'Runs', 'Precision', 'Recall', 'Cat Accuracy', 'Amt Accuracy', 'Hallucination', 'Last Run'].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.bank}>
              <td style={{ fontWeight: 600 }}>{r.bank}</td>
              <td>{r.runCount}</td>
              <td><AccuracyCell value={r.avgPrecision} threshold={0.90} /></td>
              <td><AccuracyCell value={r.avgRecall} threshold={0.90} /></td>
              <td><AccuracyCell value={r.avgCatAccuracy} threshold={0.80} /></td>
              <td><AccuracyCell value={r.avgAmountAccuracy} threshold={0.99} /></td>
              <td>
                <span style={{ color: r.avgHallucination > 0.02 ? '#ef4444' : '#16a34a', fontWeight: 600 }}>
                  {r.avgHallucination !== null ? (r.avgHallucination * 100).toFixed(2) + '%' : '—'}
                </span>
              </td>
              <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                {r.lastRun ? new Date(r.lastRun).toLocaleDateString('en-ZA') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Runs sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function RunsPanel() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');
  const [expanded, setExpanded] = useState(null);
  const [detail, setDetail]   = useState({});
  const [offset, setOffset]   = useState(0);
  const PAGE = 50;

  const load = useCallback((off) => {
    setLoading(true);
    adminAudit.runs(PAGE, off)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(0); }, [load]);

  function toggleExpand(id) {
    if (expanded === id) { setExpanded(null); return; }
    setExpanded(id);
    if (!detail[id]) {
      adminAudit.runDetail(id)
        .then(d => setDetail(prev => ({ ...prev, [id]: d })))
        .catch(() => {});
    }
  }

  if (loading && !data) return <Spinner />;
  if (err) return <div className="audit-error">{err}</div>;
  if (!data || data.runs.length === 0) return <EmptyState message="No runs recorded yet. Upload a bank statement to create the first audit run." />;

  const { runs, total } = data;

  return (
    <div>
      <div style={{ marginBottom: 12, color: 'var(--text-muted)', fontSize: '0.85rem' }}>
        {total.toLocaleString()} total runs — showing {offset + 1}–{Math.min(offset + PAGE, total)}
      </div>
      <div className="cust-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              {['File', 'Bank', 'Format', 'Txns', 'Cat Acc', 'Income', 'Duration', 'Status', 'Date'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {runs.map(r => (
              <>
                <tr key={r.id} className={`audit-run-row ${expanded === r.id ? 'expanded' : ''}`}
                    onClick={() => toggleExpand(r.id)} style={{ cursor: 'pointer' }}>
                  <td>
                    <div style={{ fontWeight: 500, maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {r.file_name || '(unnamed)'}
                    </div>
                  </td>
                  <td>{r.bank || '—'}</td>
                  <td>{r.format || '—'}</td>
                  <td>{r.txn_count ?? '—'}</td>
                  <td><AccuracyCell value={r.cat_accuracy} threshold={0.80} /></td>
                  <td>
                    {r.income_detected
                      ? <span style={{ color: '#16a34a', fontWeight: 600 }}>R {Math.round(r.income_amount || 0).toLocaleString('en-ZA')}</span>
                      : <span style={{ color: 'var(--text-muted)' }}>Not detected</span>}
                  </td>
                  <td style={{ color: 'var(--text-muted)' }}>{r.duration_ms ? r.duration_ms + 'ms' : '—'}</td>
                  <td>
                    <span style={{ fontSize: '0.76rem', padding: '2px 8px', borderRadius: 10,
                      background: r.status === 'complete' ? '#16a34a22' : '#ef444422',
                      color: r.status === 'complete' ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                      {r.status || 'unknown'}
                    </span>
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {r.created_at ? new Date(r.created_at).toLocaleDateString('en-ZA') : '—'}
                  </td>
                </tr>
                {expanded === r.id && (
                  <tr key={r.id + '_detail'}>
                    <td colSpan={9} className="audit-run-detail">
                      {!detail[r.id] ? <Spinner /> : (
                        <RunDetail data={detail[r.id]} />
                      )}
                    </td>
                  </tr>
                )}
              </>
            ))}
          </tbody>
        </table>
      </div>
      <div className="audit-pagination">
        <button className="cust-filter-chip" disabled={offset === 0} onClick={() => { const o = Math.max(0, offset - PAGE); setOffset(o); load(o); }}>
          Previous
        </button>
        <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
          Page {Math.floor(offset / PAGE) + 1} of {Math.ceil(total / PAGE)}
        </span>
        <button className="cust-filter-chip" disabled={offset + PAGE >= total} onClick={() => { const o = offset + PAGE; setOffset(o); load(o); }}>
          Next
        </button>
      </div>
    </div>
  );
}

function RunDetail({ data }) {
  const { run, benchmark, hallucinationEvents, confidenceMetrics } = data;
  if (!run) return <EmptyState message="Run not found" />;
  return (
    <div className="audit-run-detail-inner">
      <div className="audit-detail-row">
        <span className="audit-detail-label">Run ID</span>
        <span className="audit-detail-val" style={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>{run.id}</span>
      </div>
      <div className="audit-detail-row">
        <span className="audit-detail-label">Model</span>
        <span className="audit-detail-val">{run.model || '—'}</span>
      </div>
      {benchmark && (
        <>
          <div className="audit-detail-row">
            <span className="audit-detail-label">Precision / Recall / F1</span>
            <span className="audit-detail-val">
              {benchmark.txn_precision ? (benchmark.txn_precision * 100).toFixed(1) + '%' : '—'} /
              {benchmark.txn_recall    ? (benchmark.txn_recall    * 100).toFixed(1) + '%' : '—'} /
              {benchmark.txn_f1       ? (benchmark.txn_f1        * 100).toFixed(1) + '%' : '—'}
            </span>
          </div>
          <div className="audit-detail-row">
            <span className="audit-detail-label">Missing / Extra txns</span>
            <span className="audit-detail-val">{benchmark.missing_txns ?? '—'} missing, {benchmark.extra_txns ?? '—'} extra</span>
          </div>
        </>
      )}
      {hallucinationEvents?.length > 0 && (
        <div style={{ marginTop: 12 }}>
          <strong style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>Hallucination events ({hallucinationEvents.length})</strong>
          {hallucinationEvents.map((ev, i) => (
            <div key={i} className="audit-hal-event">
              <SeverityBadge severity={ev.severity} />
              <span style={{ marginLeft: 8, fontSize: '0.82rem' }}>{ev.type}: {ev.description}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Classification Errors sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function ErrorsPanel({ showToast }) {
  const [rows, setRows]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]     = useState('');
  const [bank, setBank]   = useState('');

  const load = useCallback(() => {
    setLoading(true);
    adminAudit.errors(bank ? { bank } : {})
      .then(setRows)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [bank]);

  useEffect(() => { load(); }, [load]);

  async function review(id, action) {
    try {
      await adminAudit.reviewError(id, action);
      setRows(prev => prev.map(r => r.id === id ? { ...r, reviewer_action: action } : r));
      showToast && showToast('Reviewed: ' + action, 'success');
    } catch (e) {
      showToast && showToast('Failed: ' + e.message, 'error');
    }
  }

  if (loading && !rows) return <Spinner />;
  if (err)  return <div className="audit-error">{err}</div>;
  if (!rows || rows.length === 0) return <EmptyState message="No classification errors recorded" />;

  return (
    <div>
      <div className="cust-toolbar" style={{ marginBottom: 16 }}>
        <select className="adm-select" value={bank} onChange={e => setBank(e.target.value)}>
          <option value="">All banks</option>
          {['FNB','CAPITEC','ABSA','NEDBANK','STANDARD_BANK','INVESTEC'].map(b => (
            <option key={b} value={b}>{b}</option>
          ))}
        </select>
      </div>
      <div className="cust-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              {['Description', 'Amount', 'Predicted Cat', 'Ground Truth Cat', 'Confidence', 'Action'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.id}>
                <td style={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {r.description || '—'}
                </td>
                <td>R {r.amount ? Number(r.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 }) : '—'}</td>
                <td><span className="audit-cat-badge">{r.predicted_cat || '—'}</span></td>
                <td><span className="audit-cat-badge audit-cat-badge--truth">{r.ground_truth_cat || '—'}</span></td>
                <td>{r.confidence ? (r.confidence * 100).toFixed(0) + '%' : '—'}</td>
                <td>
                  {r.reviewer_action ? (
                    <span className="audit-reviewed">{r.reviewer_action}</span>
                  ) : (
                    <div style={{ display: 'flex', gap: 6 }}>
                      <button className="audit-action-btn audit-action-btn--approve" onClick={() => review(r.id, 'approved')}>Approve</button>
                      <button className="audit-action-btn audit-action-btn--flag"    onClick={() => review(r.id, 'flagged')}>Flag</button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Hallucinations sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function HallucinationsPanel() {
  const [rows, setRows]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]     = useState('');

  useEffect(() => {
    adminAudit.hallucinations()
      .then(setRows)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const TYPE_LABEL = {
    invented_txn:       'Invented Transaction',
    invented_merchant:  'Invented Merchant',
    amount_changed:     'Amount Changed',
    round_income_suspicion: 'Round Income Suspicion',
  };

  if (loading) return <Spinner />;
  if (err)     return <div className="audit-error">{err}</div>;
  if (!rows || rows.length === 0) return <EmptyState message="No hallucination events detected — excellent!" />;

  return (
    <div className="cust-table-wrap">
      <table className="audit-table">
        <thead>
          <tr>
            {['Type', 'Severity', 'Description', 'Predicted', 'Actual', 'Bank', 'Date'].map(h => (
              <th key={h}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map(r => (
            <tr key={r.id}>
              <td>
                <span className="audit-type-badge">{TYPE_LABEL[r.type] || r.type}</span>
              </td>
              <td><SeverityBadge severity={r.severity} /></td>
              <td style={{ maxWidth: 220, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.83rem' }}>
                {r.description || '—'}
              </td>
              <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.83rem', color: '#ef4444' }}>
                {r.predicted || '—'}
              </td>
              <td style={{ maxWidth: 160, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.83rem', color: '#16a34a' }}>
                {r.actual || '—'}
              </td>
              <td>{r.bank || '—'}</td>
              <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                {r.created_at ? new Date(r.created_at).toLocaleDateString('en-ZA') : '—'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Calibration sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function CalibrationPanel() {
  const [rows, setRows]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]     = useState('');

  useEffect(() => {
    adminAudit.calibration()
      .then(setRows)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (err)     return <div className="audit-error">{err}</div>;
  if (!rows || rows.length === 0) return <EmptyState message="No confidence calibration data yet" />;

  return (
    <div>
      <p style={{ color: 'var(--text-muted)', marginBottom: 16, fontSize: '0.88rem' }}>
        A well-calibrated model's confidence closely matches actual accuracy. Rows highlighted in amber are overconfident (accuracy significantly below stated confidence).
      </p>
      <div className="cust-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              {['Confidence Bucket', 'Samples', 'Correct', 'Accuracy', 'Midpoint', 'Calibrated?'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(r => (
              <tr key={r.bucket} style={{ background: r.overconfident ? '#d9780611' : 'transparent' }}>
                <td style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.bucket}</td>
                <td>{r.count}</td>
                <td>{r.correct}</td>
                <td><AccuracyCell value={r.accuracy} threshold={r.midpoint - 0.1} /></td>
                <td style={{ color: 'var(--text-muted)' }}>{(r.midpoint * 100).toFixed(0)}%</td>
                <td>
                  {r.count === 0 ? '—' : <PassBadge passed={!r.overconfident} label={r.overconfident ? 'Overconfident' : 'OK'} />}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Drift sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function DriftPanel() {
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]     = useState('');
  const [days, setDays]   = useState(90);

  useEffect(() => {
    setLoading(true);
    adminAudit.drift(days)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <Spinner />;
  if (err)     return <div className="audit-error">{err}</div>;
  if (!data)   return <EmptyState />;

  const { series, driftDetected } = data;

  return (
    <div>
      <div className="cust-toolbar" style={{ marginBottom: 16 }}>
        {[30, 60, 90].map(d => (
          <button key={d} className={`cust-filter-chip ${days === d ? 'active' : ''}`} onClick={() => setDays(d)}>
            {d} days
          </button>
        ))}
      </div>

      {driftDetected && (
        <div className="audit-drift-warning">
          <strong>Accuracy drift detected.</strong> Category accuracy has been declining over the last 14 data points. Consider reviewing prompt changes or model updates.
        </div>
      )}

      {series.length === 0 ? (
        <EmptyState message="No benchmark data in this period" />
      ) : (
        <div className="cust-table-wrap">
          <table className="audit-table">
            <thead>
              <tr>
                {['Date', 'Avg Cat Accuracy', 'Benchmark Runs'].map(h => (
                  <th key={h}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...series].reverse().map((row, i) => (
                <tr key={row.day}>
                  <td>{new Date(row.day).toLocaleDateString('en-ZA')}</td>
                  <td><AccuracyCell value={row.avgAcc} threshold={0.80} /></td>
                  <td>{row.runs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Synthetic Statement Generator sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function SyntheticPanel() {
  const [form, setForm] = useState({
    bank: 'FNB', months: 3, incomeType: 'salaried',
    hasDebts: true, hasInvestments: false, addNoise: false,
  });
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]   = useState('');

  function update(k, v) { setForm(f => ({ ...f, [k]: v })); }

  async function generate() {
    setLoading(true); setErr(''); setResult(null);
    try {
      const r = await adminAudit.generateSynthetic(form);
      setResult(r);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <div className="audit-synth-form">
        <div className="audit-form-row">
          <label className="audit-form-label">Bank</label>
          <select className="adm-select" value={form.bank} onChange={e => update('bank', e.target.value)}>
            {['FNB','CAPITEC','ABSA','NEDBANK','STANDARD_BANK','INVESTEC'].map(b => (
              <option key={b} value={b}>{b}</option>
            ))}
          </select>
        </div>
        <div className="audit-form-row">
          <label className="audit-form-label">Months</label>
          <input type="range" min="1" max="6" value={form.months} onChange={e => update('months', parseInt(e.target.value))} />
          <span style={{ marginLeft: 8, color: 'var(--text-muted)' }}>{form.months}</span>
        </div>
        <div className="audit-form-row">
          <label className="audit-form-label">Income Type</label>
          <div style={{ display: 'flex', gap: 16 }}>
            {['salaried','freelance'].map(t => (
              <label key={t} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input type="radio" name="incomeType" value={t} checked={form.incomeType === t} onChange={() => update('incomeType', t)} />
                {t.charAt(0).toUpperCase() + t.slice(1)}
              </label>
            ))}
          </div>
        </div>
        <div className="audit-form-row" style={{ gap: 24 }}>
          {[
            { k: 'hasDebts',       l: 'Include debts (bond + car)' },
            { k: 'hasInvestments', l: 'Include investments' },
            { k: 'addNoise',       l: 'Add noise (POS refs, low confidence)' },
          ].map(({ k, l }) => (
            <label key={k} style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', fontSize: '0.88rem' }}>
              <input type="checkbox" checked={form[k]} onChange={e => update(k, e.target.checked)} />
              {l}
            </label>
          ))}
        </div>
        <button className="btn btn-primary" style={{ marginTop: 8 }} onClick={generate} disabled={loading}>
          {loading ? 'Generating…' : 'Generate Statement'}
        </button>
      </div>

      {err && <div className="audit-error">{err}</div>}

      {result && (
        <div style={{ marginTop: 24 }}>
          <div className="audit-kpi-grid" style={{ marginBottom: 16 }}>
            <KPICard label="Total Transactions" value={result.totalTransactions} accent="var(--forest)" />
            <KPICard label="Est. Monthly Income" value={'R ' + Math.round(result.metadata.estimatedMonthlyIncome).toLocaleString('en-ZA')} accent="#16a34a" />
            <KPICard label="Period" value={result.months + ' months'} accent="#2563eb" />
            <KPICard label="Bank" value={result.bank} accent="#8b5cf6" />
          </div>
          <div className="cust-table-wrap" style={{ maxHeight: 400, overflowY: 'auto' }}>
            <table className="audit-table">
              <thead>
                <tr>{['Date', 'Description', 'Amount', 'Direction', 'Category', 'Confidence'].map(h => <th key={h}>{h}</th>)}</tr>
              </thead>
              <tbody>
                {result.transactions.map(t => (
                  <tr key={t.id}>
                    <td style={{ fontSize: '0.82rem' }}>{t.date}</td>
                    <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: '0.83rem' }}>{t.description}</td>
                    <td style={{ color: t.direction === 'credit' ? '#16a34a' : 'var(--text)', fontWeight: 600 }}>
                      {t.direction === 'credit' ? '+' : '-'}R {Number(t.amount).toLocaleString('en-ZA', { minimumFractionDigits: 2 })}
                    </td>
                    <td>{t.direction}</td>
                    <td><span className="audit-cat-badge">{t.category}</span></td>
                    <td>{t.confidence ? (t.confidence * 100).toFixed(0) + '%' : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Regression sub-tab
// ══════════════════════════════════════════════════════════════════════════════
function RegressionPanel({ showToast }) {
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [err, setErr]   = useState('');

  async function run() {
    setLoading(true); setErr(''); setResult(null);
    try {
      const r = await adminAudit.runRegression();
      setResult(r);
      if (r.passed) {
        showToast && showToast('Regression suite passed', 'success');
      } else {
        showToast && showToast('Regression suite FAILED — review metrics', 'error');
      }
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  }

  const METRIC_LABEL = {
    cat_accuracy:    'Category Accuracy',
    txn_precision:   'Transaction Precision',
    income_accuracy: 'Income Accuracy',
    amount_accuracy: 'Amount Accuracy',
  };

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', marginBottom: 12 }}>
          Run the regression suite to compare current week's performance against last week. A metric fails if it drops more than 2pp or falls below its minimum threshold.
        </p>
        <button className="btn btn-primary" onClick={run} disabled={loading}>
          {loading ? 'Running…' : 'Run Regression Suite'}
        </button>
      </div>

      {err && <div className="audit-error">{err}</div>}

      {result && (
        <div>
          <div className={`audit-regression-banner ${result.passed ? 'pass' : 'fail'}`}>
            <strong>{result.passed ? 'All checks passed' : 'Regression failures detected'}</strong>
            <span style={{ marginLeft: 12, fontSize: '0.84rem', opacity: 0.8 }}>
              Ran at {new Date(result.ranAt).toLocaleString('en-ZA')}
            </span>
          </div>
          <div className="cust-table-wrap" style={{ marginTop: 16 }}>
            <table className="audit-table">
              <thead>
                <tr>
                  {['Metric', 'Current', 'Previous', 'Delta', 'Minimum', 'Status', 'Reason'].map(h => (
                    <th key={h}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {result.results.map(r => (
                  <tr key={r.metric}>
                    <td style={{ fontWeight: 600 }}>{METRIC_LABEL[r.metric] || r.metric}</td>
                    <td><AccuracyCell value={r.current} threshold={r.minimum} /></td>
                    <td><AccuracyCell value={r.previous} threshold={r.minimum} /></td>
                    <td style={{ color: r.delta === null ? 'var(--text-muted)' : r.delta >= 0 ? '#16a34a' : '#ef4444', fontWeight: 600 }}>
                      {r.delta !== null ? (r.delta >= 0 ? '+' : '') + (r.delta * 100).toFixed(1) + '%' : '—'}
                    </td>
                    <td style={{ color: 'var(--text-muted)' }}>{(r.minimum * 100).toFixed(0)}%</td>
                    <td><PassBadge passed={r.current === null ? true : r.passed} /></td>
                    <td style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>{r.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Parse Stats sub-tab — per-bank success/failure rates from audit_runs
// ══════════════════════════════════════════════════════════════════════════════
function ParseStatsPanel() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState('');
  const [days, setDays] = useState(30);

  useEffect(() => {
    setLoading(true);
    adminAudit.parseStats(days)
      .then(setData)
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, [days]);

  if (loading) return <Spinner />;
  if (err)     return <div className="audit-error">{err}</div>;
  if (!data?.stats?.length) return <EmptyState message={`No parse attempts logged in the last ${days} days`} />;

  const { stats } = data;
  const totalAttempts = stats.reduce((s, r) => s + r.total, 0);
  const totalFails    = stats.reduce((s, r) => s + r.failures, 0);

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 20 }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.88rem', margin: 0 }}>
          Success/failure rates per bank and format, sourced from every parse attempt logged in <code>audit_runs</code>.
          Rows with high failure rates indicate which banks need attention.
        </p>
        <select
          value={days}
          onChange={e => setDays(Number(e.target.value))}
          style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text)', cursor: 'pointer' }}
        >
          <option value={7}>Last 7 days</option>
          <option value={30}>Last 30 days</option>
          <option value={90}>Last 90 days</option>
        </select>
      </div>

      <div className="audit-kpi-grid" style={{ marginBottom: 20 }}>
        <KPICard label="Total parse attempts" value={totalAttempts.toLocaleString()} accent="var(--forest)" />
        <KPICard label="Total failures" value={totalFails.toLocaleString()} accent={totalFails > 0 ? '#ef4444' : '#16a34a'} />
        <KPICard
          label="Overall success rate"
          value={totalAttempts > 0 ? ((1 - totalFails / totalAttempts) * 100).toFixed(1) + '%' : '—'}
          accent={totalFails / totalAttempts > 0.1 ? '#ef4444' : '#16a34a'}
        />
      </div>

      <div className="cust-table-wrap">
        <table className="audit-table">
          <thead>
            <tr>
              {['Bank', 'Format', 'Attempts', 'Successes', 'Failures', 'Success Rate', 'Avg Txns', 'Income Detected', 'Last Seen'].map(h => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {stats.map((r, i) => {
              const rate = r.successRate;
              const rateColor = rate === null ? 'var(--text-muted)' : rate >= 90 ? '#16a34a' : rate >= 70 ? '#d97706' : '#ef4444';
              return (
                <tr key={i}>
                  <td style={{ fontWeight: 600 }}>{r.bank}</td>
                  <td><span className="audit-cat-badge">{r.format}</span></td>
                  <td>{r.total}</td>
                  <td style={{ color: '#16a34a' }}>{r.successes}</td>
                  <td style={{ color: r.failures > 0 ? '#ef4444' : 'var(--text-muted)', fontWeight: r.failures > 0 ? 700 : 400 }}>{r.failures}</td>
                  <td style={{ fontWeight: 700, color: rateColor }}>{rate !== null ? rate + '%' : '—'}</td>
                  <td style={{ color: 'var(--text-muted)' }}>{r.avgTxnCount !== null ? r.avgTxnCount : '—'}</td>
                  <td>
                    {r.incomeDetectionRate !== null
                      ? <AccuracyCell value={r.incomeDetectionRate} threshold={0.70} />
                      : <span style={{ color: 'var(--text-muted)' }}>—</span>}
                  </td>
                  <td style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>
                    {r.lastSeen ? new Date(r.lastSeen).toLocaleDateString('en-ZA') : '—'}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
// Main AuditTab component
// ══════════════════════════════════════════════════════════════════════════════
export default function AuditTab({ showToast }) {
  const [sub, setSub] = useState('overview');

  return (
    <div className="audit-root">
      {/* Sub-tab strip */}
      <div className="audit-subtab-strip">
        {SUB_TABS.map(t => (
          <button
            key={t.id}
            className={`audit-subtab-btn ${sub === t.id ? 'active' : ''}`}
            onClick={() => setSub(t.id)}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Panel */}
      <div className="audit-panel">
        {sub === 'overview'       && <OverviewPanel />}
        {sub === 'parse-stats'    && <ParseStatsPanel />}
        {sub === 'banks'          && <BankReportPanel />}
        {sub === 'runs'           && <RunsPanel />}
        {sub === 'errors'         && <ErrorsPanel showToast={showToast} />}
        {sub === 'hallucinations' && <HallucinationsPanel />}
        {sub === 'calibration'    && <CalibrationPanel />}
        {sub === 'drift'          && <DriftPanel />}
        {sub === 'synthetic'      && <SyntheticPanel />}
        {sub === 'regression'     && <RegressionPanel showToast={showToast} />}
      </div>
    </div>
  );
}
