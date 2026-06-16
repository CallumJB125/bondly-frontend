import { useState, useEffect, useCallback } from 'react';
import { adminAnalytics } from '../../lib/api.js';
import './AnalyticsTab.css';

const SUBTABS = [
  { id: 'overview',     label: 'Overview'     },
  { id: 'sessions',     label: 'Sessions'     },
  { id: 'friction',     label: 'Friction'     },
  { id: 'funnels',      label: 'Funnels'      },
  { id: 'segments',     label: 'Segments'     },
  { id: 'heatmap',      label: 'Heatmap'      },
  { id: 'experiments',  label: 'Experiments'  },
  { id: 'retention',    label: 'Retention'    },
  { id: 'performance',  label: 'Performance'  },
  { id: 'insights',     label: 'AI Insights'  },
];

const SEGMENT_COLORS = {
  engaged:         '#22c55e',
  converting:      '#3b82f6',
  struggling:      '#f59e0b',
  trust_resistant: '#dc2626',
  goal_driven:     '#10b981',
  dormant:         '#6b7280',
  churned:         '#ef4444',
  new:             '#a855f7',
};

const FRICTION_COLORS = {
  rage_click:   '#ef4444',
  dead_click:   '#f97316',
  stall:        '#f59e0b',
  form_abandon: '#6366f1',
};

function Spinner() {
  return <div className="at-spinner" />;
}

function KpiCard({ label, value, sub, color }) {
  return (
    <div className="at-kpi">
      <div className="at-kpi-label">{label}</div>
      <div className="at-kpi-value" style={color ? { color } : {}}>{value}</div>
      {sub && <div className="at-kpi-sub">{sub}</div>}
    </div>
  );
}

function BarRow({ label, count, max, color, pct }) {
  const w = max > 0 ? Math.max((count / max) * 100, count > 0 ? 4 : 0) : 0;
  return (
    <div className="at-bar-row">
      <div className="at-bar-label">{label}</div>
      <div className="at-bar-track">
        <div className="at-bar-fill" style={{ width: `${w}%`, background: color || 'var(--mint)' }} />
      </div>
      <div className="at-bar-n">{count}</div>
      {pct !== undefined && <div className="at-bar-pct">{pct}%</div>}
    </div>
  );
}

// ── Overview ──────────────────────────────────────────────────────────────────
function OverviewPanel({ days }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminAnalytics.overview(days).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <Spinner />;
  if (!data) return <p className="at-empty">No data yet — analytics events will appear here once users start browsing.</p>;

  const segEntries = Object.entries(data.segments || {}).sort((a, b) => b[1] - a[1]);
  const maxSeg = Math.max(...segEntries.map(([, n]) => n), 1);

  return (
    <div>
      <div className="at-kpi-grid">
        <KpiCard label="DAU"            value={data.dau}                 sub="Active users today" />
        <KpiCard label="WAU"            value={data.wau}                 sub="Last 7 days" />
        <KpiCard label="MAU"            value={data.mau}                 sub={`Last ${days} days`} />
        <KpiCard label="Avg Session"    value={`${Math.round((data.avgSessionDurationS||0)/60)}m`} sub="Avg duration" />
        <KpiCard label="Total Sessions" value={data.totalSessions}       sub={`Last ${days} days`} />
        <KpiCard label="Friction Rate"  value={`${data.frictionRate}%`}  sub={data.frictionRate > 40 ? 'High — investigate friction' : data.frictionRate > 20 ? 'Watch — some friction' : 'Healthy (< 20%)'} color={data.frictionRate > 40 ? '#ef4444' : data.frictionRate > 20 ? '#f59e0b' : '#22c55e'} />
        <KpiCard label="New Users"      value={data.newUsers7d}          sub="Last 7 days" />
      </div>

      <div className="at-two-col">
        <div className="at-card">
          <div className="at-card-head">Funnel Conversion Rates</div>
          {(data.funnelSummary || []).length === 0
            ? <p className="at-empty-sm">No funnel data yet</p>
            : (data.funnelSummary || []).map(f => (
              <BarRow key={f.funnelId} label={`${f.name} — ${f.rate}%`} count={f.rate} max={100}
                color={f.rate > 50 ? '#22c55e' : f.rate > 20 ? '#6366f1' : '#ef4444'} pct={undefined} />
            ))
          }
        </div>

        <div className="at-card">
          <div className="at-card-head">User Segments</div>
          {segEntries.length === 0
            ? <p className="at-empty-sm">No segments computed yet</p>
            : segEntries.map(([seg, n]) => (
              <BarRow key={seg} label={seg} count={n} max={maxSeg} color={SEGMENT_COLORS[seg]} />
            ))
          }
        </div>
      </div>

      {data.topFriction && (
        <div className="at-card" style={{ marginTop: 16 }}>
          <div className="at-card-head">Top Friction Signal</div>
          <p className="at-friction-pill" style={{ background: FRICTION_COLORS[data.topFriction.type] || '#f59e0b' }}>
            {data.topFriction.type} on {data.topFriction.page || 'unknown'} — {data.topFriction.cnt} times
          </p>
        </div>
      )}
    </div>
  );
}

// ── Sessions ──────────────────────────────────────────────────────────────────
function SessionsPanel({ days }) {
  const [sessions, setSessions] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);
  const [replay, setReplay] = useState(null);
  const [replayLoading, setReplayLoading] = useState(false);
  const [filter, setFilter] = useState({ minFrictionScore: '', hasRageClick: false });

  const load = useCallback(() => {
    setLoading(true);
    const params = { days, page, limit: 30 };
    if (filter.minFrictionScore !== '') params.minFrictionScore = parseInt(filter.minFrictionScore);
    if (filter.hasRageClick) params.hasRageClick = true;
    adminAnalytics.sessions(params)
      .then(d => { setSessions(d.sessions || []); setTotal(d.total || 0); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [days, page, filter]);

  useEffect(() => { load(); }, [load]);

  function openReplay(sess) {
    setSelected(sess);
    setReplay(null);
    setReplayLoading(true);
    adminAnalytics.replay(sess.id)
      .then(setReplay)
      .catch(() => setReplay(null))
      .finally(() => setReplayLoading(false));
  }

  if (selected) {
    return (
      <div>
        <button className="at-back-btn" onClick={() => setSelected(null)}>← Back to sessions</button>
        <div className="at-card" style={{ marginTop: 12 }}>
          <div className="at-card-head">Session {selected.id}</div>
          <div className="at-session-meta">
            <span>{selected.device_type}</span>
            <span>{selected.browser} / {selected.os}</span>
            <span>Friction: <b style={{ color: selected.friction_score > 20 ? '#ef4444' : 'inherit' }}>{selected.friction_score}</b></span>
            <span>{selected.page_count} pages</span>
            <span>{selected.entry_page}</span>
          </div>
          {replayLoading && <Spinner />}
          {replay && (
            <div>
              <div className="at-replay-viewport">
                {(replay.frames || []).map((f, i) => (
                  <div key={i} className="at-replay-dot"
                    style={{
                      left: `${((f.x || 0) / (f.vw || 1)) * 100}%`,
                      top:  `${((f.y || 0) / (f.vh || 1)) * 100}%`,
                      background: f.type === 'rage_click' ? '#ef4444' : f.type === 'click' ? '#3b82f6' : '#6b7280',
                    }}
                    title={`${f.type} @ ${f.page}`}
                  />
                ))}
                {(replay.frames || []).filter(f => f.type === 'scroll_depth').map((f, i) => (
                  <div key={'s'+i} className="at-replay-scroll-line"
                    style={{ top: `${f.scroll_pct || 0}%` }}
                    title={`Scroll ${f.scroll_pct}%`}
                  />
                ))}
              </div>
              <div className="at-replay-legend">
                <span style={{ color: '#3b82f6' }}>● Click</span>
                <span style={{ color: '#ef4444' }}>● Rage click</span>
                <span style={{ color: '#6b7280' }}>● Scroll depth</span>
              </div>
              <div className="at-event-list">
                {(replay.events || []).map((ev, i) => (
                  <div key={i} className="at-event-row">
                    <span className="at-event-type">{ev.type}</span>
                    <span className="at-event-page">{ev.page || '—'}</span>
                    <span className="at-event-ts">{new Date(ev.ts).toLocaleTimeString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <div className="at-filter-row">
        <input className="at-input" placeholder="Min friction score" type="number" min={0} max={100}
          value={filter.minFrictionScore}
          onChange={e => setFilter(f => ({ ...f, minFrictionScore: e.target.value }))} />
        <label className="at-checkbox-label">
          <input type="checkbox" checked={filter.hasRageClick}
            onChange={e => setFilter(f => ({ ...f, hasRageClick: e.target.checked }))} />
          Rage clicks only
        </label>
        <button className="at-btn-sm" onClick={() => { setPage(1); load(); }}>Filter</button>
      </div>
      {loading ? <Spinner /> : (
        <>
          <div className="at-table-wrap">
            <table className="at-table">
              <thead>
                <tr>
                  <th>Session</th><th>Device</th><th>Browser</th>
                  <th>Entry</th><th>Pages</th><th>Friction</th><th>Rage</th><th>Abandons</th><th></th>
                </tr>
              </thead>
              <tbody>
                {sessions.length === 0 && (
                  <tr><td colSpan={9} className="at-empty-cell">No sessions found</td></tr>
                )}
                {sessions.map(s => (
                  <tr key={s.id}>
                    <td className="at-mono">{s.id.slice(0, 12)}…</td>
                    <td>{s.device_type}</td>
                    <td>{s.browser}</td>
                    <td className="at-mono">{s.entry_page}</td>
                    <td>{s.page_count}</td>
                    <td style={{ color: s.friction_score > 20 ? '#ef4444' : 'inherit', fontWeight: s.friction_score > 20 ? 700 : 400 }}>
                      {s.friction_score}
                    </td>
                    <td>{s.rage_clicks || 0}</td>
                    <td>{s.form_abandons || 0}</td>
                    <td><button className="at-link-btn" onClick={() => openReplay(s)}>Replay</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="at-pagination">
            <button disabled={page <= 1} onClick={() => setPage(p => p - 1)} className="at-btn-sm">Prev</button>
            <span>Page {page} · {total} sessions</span>
            <button disabled={sessions.length < 30} onClick={() => setPage(p => p + 1)} className="at-btn-sm">Next</button>
          </div>
        </>
      )}
    </div>
  );
}

// ── Friction ──────────────────────────────────────────────────────────────────
function FrictionPanel({ days }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    adminAnalytics.friction({ days, type: typeFilter || undefined })
      .then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [days, typeFilter]);

  const incidents = data?.incidents || [];
  const maxCnt = Math.max(...incidents.map(r => parseInt(r.cnt)), 1);

  return (
    <div>
      <div className="at-filter-row">
        {['', 'rage_click', 'dead_click', 'stall', 'form_abandon'].map(t => (
          <button key={t} className={`at-btn-sm ${typeFilter === t ? 'at-btn-active' : ''}`}
            onClick={() => setTypeFilter(t)}>
            {t || 'All'}
          </button>
        ))}
      </div>
      {loading ? <Spinner /> : (
        incidents.length === 0
          ? <p className="at-empty">No friction incidents found for this period.</p>
          : <div className="at-card">
              {incidents.map((r, i) => (
                <BarRow key={i}
                  label={<><span className="at-friction-badge" style={{ background: FRICTION_COLORS[r.type] || '#888' }}>{r.type}</span> {r.page || 'unknown'}</>}
                  count={parseInt(r.cnt)} max={maxCnt}
                  color={FRICTION_COLORS[r.type] || '#888'}
                />
              ))}
            </div>
      )}
    </div>
  );
}

// ── Funnels ───────────────────────────────────────────────────────────────────
function FunnelsPanel({ days }) {
  const [funnels, setFunnels] = useState([]);
  const [selected, setSelected] = useState(null);
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    setLoading(true);
    adminAnalytics.funnels(days).then(d => setFunnels(Array.isArray(d) ? d : [])).catch(() => setFunnels([])).finally(() => setLoading(false));
  }, [days]);

  function openFunnel(f) {
    setSelected(f);
    setDetail(null);
    setDetailLoading(true);
    adminAnalytics.funnel(f.id, days).then(setDetail).catch(() => setDetail(null)).finally(() => setDetailLoading(false));
  }

  if (selected) {
    return (
      <div>
        <button className="at-back-btn" onClick={() => setSelected(null)}>← Back to funnels</button>
        <div className="at-card" style={{ marginTop: 12 }}>
          <div className="at-card-head">{selected.name}</div>
          {detailLoading && <Spinner />}
          {detail && (
            <div className="at-funnel-steps">
              {(detail.steps || []).map((step, i) => {
                const prev = detail.steps[i - 1];
                return (
                  <div key={step.key} className="at-funnel-step">
                    <div className="at-funnel-step-label">{step.label}</div>
                    <div className="at-funnel-bar-wrap">
                      <div className="at-funnel-bar" style={{ width: `${step.pct}%`, background: `hsl(${140 - step.dropPct * 1.4}, 70%, 50%)` }} />
                    </div>
                    <div className="at-funnel-step-stats">
                      <span>{step.count} users</span>
                      <span>{step.pct}% of entry</span>
                      {i > 0 && <span className="at-drop" style={{ color: step.dropPct > 30 ? '#ef4444' : '#f59e0b' }}>-{step.dropPct}% drop</span>}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      {loading ? <Spinner /> : (
        funnels.length === 0
          ? <p className="at-empty">No funnel data yet.</p>
          : <div className="at-funnel-grid">
              {funnels.map(f => (
                <div key={f.id} className="at-funnel-card" onClick={() => openFunnel(f)}>
                  <div className="at-funnel-card-name">{f.name}</div>
                  <div className="at-funnel-card-meta">{f.entry_sessions || 0} sessions entered</div>
                  <div className="at-funnel-card-arrow">→</div>
                </div>
              ))}
            </div>
      )}
    </div>
  );
}

// ── Segments ──────────────────────────────────────────────────────────────────
function SegmentsPanel() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAnalytics.segments().then(setSegments).catch(() => setSegments([])).finally(() => setLoading(false));
  }, []);

  const total = segments.reduce((s, r) => s + r.count, 0);

  return loading ? <Spinner /> : (
    <div>
      <div className="at-segment-grid">
        {segments.length === 0 && (
          <div className="at-empty">
            <p>No segments computed yet.</p>
            <p style={{ fontSize: '0.8125rem', marginTop: 6, color: 'var(--text-secondary)' }}>
              Segments run nightly. Buckets: <strong>engaged</strong> · <strong>converting</strong> · <strong>struggling</strong> · <strong>dormant</strong> · <strong>churned</strong>.
              Once computed, each user is placed in a bucket based on their session frequency, recency, and friction score.
            </p>
          </div>
        )}
        {segments.map(s => (
          <div key={s.segment} className="at-seg-card" style={{ borderLeft: `4px solid ${SEGMENT_COLORS[s.segment] || '#888'}` }}>
            <div className="at-seg-name" style={{ color: SEGMENT_COLORS[s.segment] }}>{s.segment}</div>
            <div className="at-seg-count">{s.count}</div>
            <div className="at-seg-pct">{total > 0 ? Math.round((s.count / total) * 100) : 0}%</div>
            <div className="at-seg-score">Avg score: {s.avgScore}</div>
          </div>
        ))}
      </div>
      <p className="at-note">Segments are recomputed nightly using the last 90 days of session data.</p>
    </div>
  );
}

// ── Experiments ───────────────────────────────────────────────────────────────
function ExperimentsPanel() {
  const [experiments, setExperiments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState({ id: '', name: '', description: '', variants: '' });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  function load() {
    adminAnalytics.experiments().then(setExperiments).catch(() => setExperiments([])).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function patch(id, status) {
    await adminAnalytics.patchExperiment(id, status).catch(() => {});
    load();
  }

  async function create(e) {
    e.preventDefault();
    setErr('');
    let variants;
    try {
      variants = JSON.parse(form.variants);
      if (!Array.isArray(variants)) throw new Error();
    } catch {
      setErr('Variants must be valid JSON array, e.g. [{"key":"control","weight":50},{"key":"variant_a","weight":50}]');
      return;
    }
    setSaving(true);
    try {
      await adminAnalytics.createExperiment({ ...form, variants });
      setCreating(false);
      setForm({ id: '', name: '', description: '', variants: '' });
      load();
    } catch (ex) {
      setErr(ex.message || 'Failed to create');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div>
      {!creating && (
        <button className="at-btn" onClick={() => setCreating(true)} style={{ marginBottom: 16 }}>
          + New Experiment
        </button>
      )}
      {creating && (
        <form className="at-create-form" onSubmit={create}>
          <input className="at-input" placeholder="ID (e.g. upload_cta_v2)" value={form.id}
            onChange={e => setForm(f => ({ ...f, id: e.target.value }))} required />
          <input className="at-input" placeholder="Name" value={form.name}
            onChange={e => setForm(f => ({ ...f, name: e.target.value }))} required />
          <input className="at-input" placeholder="Description (optional)" value={form.description}
            onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
          <textarea className="at-textarea" rows={3}
            placeholder='[{"key":"control","weight":50},{"key":"variant_a","weight":50}]'
            value={form.variants}
            onChange={e => setForm(f => ({ ...f, variants: e.target.value }))} required />
          {err && <p className="at-err">{err}</p>}
          <div className="at-form-actions">
            <button type="submit" className="at-btn" disabled={saving}>{saving ? 'Saving…' : 'Create'}</button>
            <button type="button" className="at-btn-ghost" onClick={() => setCreating(false)}>Cancel</button>
          </div>
        </form>
      )}
      {loading ? <Spinner /> : (
        experiments.length === 0 && !creating
          ? <p className="at-empty">No experiments yet.</p>
          : experiments.map(exp => (
            <div key={exp.id} className="at-exp-card">
              <div className="at-exp-header">
                <div>
                  <div className="at-exp-name">{exp.name}</div>
                  <div className="at-exp-id">{exp.id}</div>
                </div>
                <div className="at-exp-status-wrap">
                  <span className={`at-exp-status at-exp-status--${exp.status}`}>{exp.status}</span>
                  {exp.status === 'active' && (
                    <button className="at-btn-sm" onClick={() => patch(exp.id, 'paused')}>Pause</button>
                  )}
                  {exp.status === 'paused' && (
                    <button className="at-btn-sm" onClick={() => patch(exp.id, 'active')}>Resume</button>
                  )}
                </div>
              </div>
              {exp.description && <p className="at-exp-desc">{exp.description}</p>}
              <div className="at-variant-grid">
                {(exp.variantStats || []).map(v => (
                  <div key={v.variant} className="at-variant-card">
                    <div className="at-variant-key">{v.variant}</div>
                    <div className="at-variant-stat">{v.assigned} assigned</div>
                    <div className="at-variant-stat">{v.converted} converted</div>
                    <div className="at-variant-rate" style={{ color: v.conversionRate > 5 ? '#22c55e' : 'var(--text-secondary)' }}>
                      {v.conversionRate}% CVR
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))
      )}
    </div>
  );
}

// ── Retention ─────────────────────────────────────────────────────────────────
function RetentionPanel() {
  const [cohorts, setCohorts] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    adminAnalytics.retention(8).then(setCohorts).catch(() => setCohorts([])).finally(() => setLoading(false));
  }, []);

  if (loading) return <Spinner />;
  if (cohorts.length === 0) return <p className="at-empty">No retention data yet — requires at least 2 weeks of user sessions.</p>;

  const maxWeeks = Math.max(...cohorts.map(c => c.retention.length), 0);

  return (
    <div className="at-card">
      <div className="at-card-head">Weekly Cohort Retention</div>
      <div className="at-retention-table-wrap">
        <table className="at-retention-table">
          <thead>
            <tr>
              <th>Cohort</th>
              <th>Size</th>
              {Array.from({ length: maxWeeks }, (_, i) => <th key={i}>W{i + 1}</th>)}
            </tr>
          </thead>
          <tbody>
            {cohorts.map(c => (
              <tr key={String(c.cohortWeek)}>
                <td>{String(c.cohortWeek).slice(0, 10)}</td>
                <td>{c.size}</td>
                {c.retention.map((pct, i) => (
                  <td key={i} style={{
                    background: pct > 0 ? `rgba(34,197,94,${pct / 100})` : 'transparent',
                    color: pct > 50 ? '#fff' : 'inherit',
                    fontWeight: pct > 0 ? 600 : 400,
                  }}>
                    {pct > 0 ? `${pct}%` : '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="at-note">Each cell shows the % of the cohort that returned in that week.</p>
    </div>
  );
}

// ── Performance ───────────────────────────────────────────────────────────────
function PerformancePanel({ days }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminAnalytics.performance(days).then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, [days]);

  if (loading) return <Spinner />;
  if (!data) return <p className="at-empty">No performance data yet.</p>;

  const endpoints = data.endpoints || [];
  const maxMs = Math.max(...endpoints.map(e => parseFloat(e.avg_ms || 0)), 1);

  return (
    <div>
      {data.highLatencyFrictionRate !== null && (
        <div className="at-kpi-grid" style={{ marginBottom: 16 }}>
          <KpiCard label="High-latency session friction" value={`${data.highLatencyFrictionRate}%`}
            color={data.highLatencyFrictionRate > 30 ? '#ef4444' : '#f59e0b'}
            sub="Sessions with slow API calls" />
          <KpiCard label="Normal session friction" value={`${data.normalFrictionRate}%`}
            color="#22c55e" sub="Sessions without slow API calls" />
        </div>
      )}
      <div className="at-card">
        <div className="at-card-head">Slowest Endpoints (p95)</div>
        {endpoints.length === 0
          ? <p className="at-empty-sm">No API performance data yet.</p>
          : endpoints.map((e, i) => (
            <div key={i} className="at-perf-row">
              <div className="at-perf-endpoint">{e.endpoint}</div>
              <div className="at-perf-bars">
                <div className="at-bar-track">
                  <div className="at-bar-fill" style={{ width: `${(parseFloat(e.avg_ms) / maxMs) * 100}%`, background: parseFloat(e.avg_ms) > 1000 ? '#ef4444' : '#f59e0b' }} />
                </div>
              </div>
              <div className="at-perf-stats">
                <span>{Math.round(e.avg_ms)}ms avg</span>
                <span>{Math.round(e.p95)}ms p95</span>
                <span>{e.calls} calls</span>
              </div>
            </div>
          ))
        }
      </div>
    </div>
  );
}

const INSIGHT_CATEGORY_COLORS = {
  friction:        '#ef4444',
  conversion:      '#3b82f6',
  trust:           '#f97316',
  feature_adoption:'#8b5cf6',
  performance:     '#f59e0b',
  retention:       '#22c55e',
  summary:         '#0ea5e9',
  general:         '#6b7280',
};
const INSIGHT_SEV_COLORS = { high: '#ef4444', medium: '#f59e0b', low: '#22c55e' };

// ── AI Insights ───────────────────────────────────────────────────────────────
function InsightsPanel() {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading]   = useState(true);
  const [generating, setGenerating] = useState(false);

  function load() {
    setLoading(true);
    adminAnalytics.insights().then(setInsights).catch(() => setInsights([])).finally(() => setLoading(false));
  }
  useEffect(load, []);

  async function generate() {
    setGenerating(true);
    await adminAnalytics.generateInsights(7).catch(() => {});
    load();
    setGenerating(false);
  }

  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          AI-generated product insights from behavioural data
        </span>
        <button className="at-btn" onClick={generate} disabled={generating}>
          {generating ? 'Generating…' : '✦ Generate Insights'}
        </button>
      </div>
      {loading ? <Spinner /> : (
        insights.length === 0
          ? <p className="at-empty">No insights yet. Click "Generate Insights" to analyse current data.</p>
          : <div style={{ display: 'grid', gap: 12 }}>
              {insights.map((ins, i) => (
                <div key={i} className="at-insight-card" style={{ borderLeft: `3px solid ${INSIGHT_CATEGORY_COLORS[ins.type] || '#6b7280'}` }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                    <span style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: INSIGHT_CATEGORY_COLORS[ins.type] || '#6b7280', background: 'var(--bg-input)', padding: '2px 8px', borderRadius: 4 }}>
                      {ins.type}
                    </span>
                    {ins.severity && (
                      <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: INSIGHT_SEV_COLORS[ins.severity] || '#6b7280' }}>
                        {ins.severity?.toUpperCase()}
                      </span>
                    )}
                    <span style={{ marginLeft: 'auto', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                      {new Date(ins.generated_at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                    </span>
                  </div>
                  {ins.title && <div style={{ fontWeight: 700, marginBottom: 4, fontSize: '0.9375rem' }}>{ins.title}</div>}
                  <p style={{ margin: '0 0 8px', fontSize: '0.875rem', lineHeight: 1.55 }}>{ins.content}</p>
                  {ins.recommendation && (
                    <div style={{ background: 'var(--bg-input)', borderRadius: 6, padding: '8px 12px', fontSize: '0.8125rem', color: 'var(--text-primary)', borderLeft: '3px solid var(--mint)' }}>
                      <strong>Action:</strong> {ins.recommendation}
                    </div>
                  )}
                  {ins.linked_page && (
                    <div style={{ marginTop: 6, fontSize: '0.75rem' }}>
                      Page: <code style={{ color: 'var(--mint)' }}>{ins.linked_page}</code>
                    </div>
                  )}
                </div>
              ))}
            </div>
      )}
    </div>
  );
}

// ── Heatmap ───────────────────────────────────────────────────────────────────
function HeatmapPanel({ days }) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [selPage, setSelPage] = useState('');

  useEffect(() => {
    setLoading(true);
    adminAnalytics.heatmap(selPage || null, days)
      .then(d => { setData(d); if (!selPage && d?.pages?.[0]?.page) setSelPage(d.pages[0].page); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [selPage, days]);

  if (loading) return <Spinner />;
  if (!data) return <p className="at-empty">No heatmap data yet.</p>;

  const cells    = data.cells || [];
  const pages    = data.pages || [];
  const maxHits  = Math.max(1, ...cells.map(c => parseInt(c.hits)));
  const cellMap  = {};
  for (const c of cells) {
    const key = `${Math.round(c.gx)}_${Math.round(c.gy)}`;
    if (!cellMap[key] || parseInt(c.hits) > parseInt(cellMap[key].hits)) cellMap[key] = c;
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Page:</span>
        <select className="at-days-select" value={selPage} onChange={e => setSelPage(e.target.value)}>
          <option value="">All pages</option>
          {pages.map(p => <option key={p.page} value={p.page}>{p.page} ({p.clicks} clicks)</option>)}
        </select>
      </div>
      {cells.length === 0
        ? <p className="at-empty">No click data for this page yet.</p>
        : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(20, 1fr)', gap: 2, aspectRatio: '16/9', maxWidth: 800, border: '1px solid var(--border-color)', borderRadius: 8, overflow: 'hidden', background: 'var(--bg-card)' }}>
            {Array.from({ length: 20 }, (_, gy) =>
              Array.from({ length: 20 }, (_, gx) => {
                const c = cellMap[`${gx}_${gy}`];
                const hits = c ? parseInt(c.hits) : 0;
                const opacity = hits > 0 ? Math.max(0.1, hits / maxHits) : 0;
                const isRage = c?.type === 'rage_click';
                return (
                  <div key={`${gx}_${gy}`} title={hits > 0 ? `${hits} clicks${isRage ? ' (rage)' : ''}` : ''}
                    style={{ background: hits > 0 ? (isRage ? `rgba(220,38,38,${opacity})` : `rgba(239,68,68,${opacity})`) : 'transparent' }} />
                );
              })
            )}
          </div>
        )
      }
      <div style={{ display: 'flex', gap: 16, marginTop: 12, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, background: 'rgba(239,68,68,0.8)', borderRadius: 2 }} /> High click density
        </span>
        <span style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <span style={{ width: 12, height: 12, background: 'rgba(220,38,38,0.9)', borderRadius: 2 }} /> Rage clicks
        </span>
      </div>
    </div>
  );
}

// ── Root ──────────────────────────────────────────────────────────────────────
export default function AnalyticsTab() {
  const [tab, setTab]   = useState('overview');
  const [days, setDays] = useState(30);

  return (
    <div className="at-root fade-in">
      <div className="at-header">
        <div className="at-subtabs">
          {SUBTABS.map(t => (
            <button key={t.id}
              className={`at-subtab ${tab === t.id ? 'at-subtab--active' : ''}`}
              onClick={() => setTab(t.id)}>
              {t.label}
            </button>
          ))}
        </div>
        {['overview', 'sessions', 'friction', 'funnels', 'heatmap', 'performance'].includes(tab) && (
          <select className="at-days-select" value={days} onChange={e => setDays(parseInt(e.target.value))}>
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>
        )}
      </div>

      <div className="at-panel">
        {tab === 'overview'    && <OverviewPanel    days={days} />}
        {tab === 'sessions'    && <SessionsPanel    days={days} />}
        {tab === 'friction'    && <FrictionPanel    days={days} />}
        {tab === 'funnels'     && <FunnelsPanel     days={days} />}
        {tab === 'segments'    && <SegmentsPanel />}
        {tab === 'heatmap'     && <HeatmapPanel     days={days} />}
        {tab === 'experiments' && <ExperimentsPanel />}
        {tab === 'retention'   && <RetentionPanel />}
        {tab === 'performance' && <PerformancePanel days={days} />}
        {tab === 'insights'    && <InsightsPanel />}
      </div>
    </div>
  );
}
