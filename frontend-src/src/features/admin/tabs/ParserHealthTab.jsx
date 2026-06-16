// ParserHealthTab — Sprint 1 admin dashboard for parse outcomes.
//
// Pulls from /api/admin/parses/{summary,recent,:id}. Three sections:
//   1. KPI strip — 24h totals + extraction method mix + AI usage + cost
//   2. Per-bank table — success rate + AI rate by bank
//   3. Recent parses — paginated table; click a row to see full record
//
// No charting library — plain HTML so the tab is self-contained. We can move
// to recharts later if we want trend lines.

import { useEffect, useState } from 'react';
import { fmt, fmtPct } from '@bondly/ui/lib/format.js';

const ZAR_PER_USD = 18.5; // approximation — sync with score-parsers script

function pct(num, den) {
  if (!den) return '–';
  return (100 * num / den).toFixed(1) + '%';
}

function formatLatency(ms) {
  if (ms == null) return '–';
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}

function formatMethod(m) {
  if (!m) return '—';
  if (m === 'parser_engine')    return 'parser-engine';
  if (m === 'parser_engine_ai') return 'parser-engine + AI';
  if (m === 'legacy')           return 'legacy';
  return m;
}

function StatusPill({ status }) {
  const colors = {
    done:    { bg: 'rgba(22,163,74,0.12)',  fg: '#16a34a' },
    failed:  { bg: 'rgba(239,68,68,0.12)',  fg: '#ef4444' },
    partial: { bg: 'rgba(234,179,8,0.12)',  fg: '#a16207' },
  };
  const c = colors[status] || { bg: 'rgba(0,0,0,0.06)', fg: '#666' };
  return (
    <span style={{
      display: 'inline-block', padding: '2px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, letterSpacing: '0.04em',
      textTransform: 'uppercase', background: c.bg, color: c.fg,
    }}>{status}</span>
  );
}

async function fetchJson(url) {
  const token = localStorage.getItem('bondly_token');
  const resp = await fetch(url, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
  const txt = await resp.text();
  const json = JSON.parse(txt);
  if (!resp.ok || json?.success === false) throw new Error(json?.error || `HTTP ${resp.status}`);
  return json?.data ?? json;
}

export default function ParserHealthTab() {
  const [hours, setHours]       = useState(24);
  const [summary, setSummary]   = useState(null);
  const [recent, setRecent]     = useState([]);
  const [selected, setSelected] = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error, setError]       = useState(null);

  async function load() {
    setLoading(true); setError(null);
    try {
      const [s, r] = await Promise.all([
        fetchJson(`/api/admin/parses/summary?hours=${hours}`),
        fetchJson('/api/admin/parses/recent?limit=100'),
      ]);
      setSummary(s);
      setRecent(r);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); /* eslint-disable-next-line */ }, [hours]);

  const agg = summary?.aggregate || {};
  const total       = Number(agg.total || 0);
  const succeeded   = Number(agg.succeeded || 0);
  const failed      = Number(agg.failed || 0);
  const aiUsed      = Number(agg.ai_used || 0);
  const camelot     = Number(agg.camelot || 0);
  const parserEng   = Number(agg.parser_engine || 0);
  const legacy      = Number(agg.legacy || 0);
  const avgLatency  = Number(agg.avg_latency_ms || 0);
  const totalUsd    = Number(agg.total_ai_cost_usd || 0);
  const avgCostZar  = total ? (totalUsd * ZAR_PER_USD) / total : 0;

  return (
    <div style={{ padding: '20px 0' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <h2 style={{ fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>Parser Health</h2>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {[1, 24, 24*7, 24*30].map(h => (
            <button
              key={h}
              onClick={() => setHours(h)}
              style={{
                padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)',
                background: hours === h ? 'var(--bg-elevated, #111827)' : 'transparent',
                color: hours === h ? 'white' : 'var(--text-secondary)',
                fontSize: 13, cursor: 'pointer',
              }}
            >
              {h === 1 ? '1h' : h === 24 ? '24h' : h === 168 ? '7d' : '30d'}
            </button>
          ))}
          <button onClick={load} style={{ padding: '6px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'transparent', cursor: 'pointer', fontSize: 13 }}>
            ↻ Refresh
          </button>
        </div>
      </div>

      {loading && <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading…</div>}
      {error   && <div style={{ padding: 20, color: '#ef4444', background: 'rgba(239,68,68,0.06)', borderRadius: 8 }}>Error: {error}</div>}

      {summary && !loading && (
        <>
          {/* KPI strip */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12,
            marginBottom: 24,
          }}>
            <KPI label="Total parses"    value={total.toLocaleString()} sub={`last ${hours}h`} />
            <KPI label="Succeeded"        value={pct(succeeded, total)} sub={`${succeeded} of ${total}`} good={succeeded === total} />
            <KPI label="Failed"           value={pct(failed, total)} sub={`${failed} parses`} bad={failed > 0} />
            <KPI label="Claude used"      value={pct(aiUsed, total)} sub={`${aiUsed} parses`} warn={aiUsed / Math.max(total, 1) > 0.20} />
            <KPI label="Avg latency"      value={formatLatency(avgLatency)} sub={total ? 'across all parses' : '—'} />
            <KPI label="Avg cost"         value={`R ${avgCostZar.toFixed(2)}`} sub={`Claude spend, R ${(totalUsd * ZAR_PER_USD).toFixed(2)} total`} />
          </div>

          {/* Method breakdown */}
          <div style={{ marginBottom: 24 }}>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 8 }}>Extraction method mix</h3>
            <MethodBar parts={[
              { label: 'Camelot/regex',  count: camelot,   color: '#16a34a' },
              { label: 'parser-engine',  count: parserEng, color: '#4a7fa5' },
              { label: 'Legacy',         count: legacy,    color: '#c97a2a' },
              { label: 'Unknown',        count: Math.max(0, total - camelot - parserEng - legacy), color: '#9ca3af' },
            ]} />
          </div>

          {/* Per bank */}
          {summary.perBank?.length > 0 && (
            <div style={{ marginBottom: 24 }}>
              <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 8 }}>By bank</h3>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left',  padding: '8px 0' }}>Bank</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>Parses</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>Success rate</th>
                    <th style={{ textAlign: 'right', padding: '8px 12px' }}>AI invoked</th>
                  </tr>
                </thead>
                <tbody>
                  {summary.perBank.map(b => (
                    <tr key={b.bank} style={{ borderBottom: '1px solid rgba(0,0,0,0.04)' }}>
                      <td style={{ padding: '8px 0', fontWeight: 600 }}>{b.bank}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{b.count}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{pct(b.succeeded, b.count)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right' }}>{pct(b.ai_used, b.count)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Recent parses */}
          <div>
            <h3 style={{ fontSize: '0.875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 8 }}>Recent parses ({recent.length})</h3>
            <div style={{ overflowX: 'auto', border: '1px solid var(--border-color)', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr style={{ background: 'var(--bg-subtle, #f9fafb)', color: 'var(--text-secondary)', fontSize: 11, textTransform: 'uppercase' }}>
                    <th style={{ textAlign: 'left',  padding: '10px 12px' }}>When</th>
                    <th style={{ textAlign: 'left',  padding: '10px 12px' }}>Bank</th>
                    <th style={{ textAlign: 'left',  padding: '10px 12px' }}>Method</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Txns</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Income</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Latency</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px' }}>AI</th>
                    <th style={{ textAlign: 'right', padding: '10px 12px' }}>Cost</th>
                    <th style={{ textAlign: 'center', padding: '10px 12px' }}>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map(r => (
                    <tr key={r.id}
                        onClick={() => setSelected(r)}
                        style={{ cursor: 'pointer', borderTop: '1px solid var(--border-color)' }}>
                      <td style={{ padding: '8px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{new Date(r.ts).toLocaleString('en-ZA', { hour12: false })}</td>
                      <td style={{ padding: '8px 12px' }}>{r.bank_id || '—'}</td>
                      <td style={{ padding: '8px 12px' }}>{formatMethod(r.extraction_method)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.txn_count ?? '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{r.income_zar ? fmt(r.income_zar) : '—'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>{formatLatency(r.latency_ms)}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}>{r.ai_invoked === true ? '✓' : r.ai_invoked === false ? '—' : '?'}</td>
                      <td style={{ padding: '8px 12px', textAlign: 'right', fontVariantNumeric: 'tabular-nums' }}>
                        {r.ai_cost_usd ? `R ${(Number(r.ai_cost_usd) * ZAR_PER_USD).toFixed(2)}` : '—'}
                      </td>
                      <td style={{ padding: '8px 12px', textAlign: 'center' }}><StatusPill status={r.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {selected && <ParseDetailDrawer parse={selected} onClose={() => setSelected(null)} />}
        </>
      )}
    </div>
  );
}

function KPI({ label, value, sub, good, bad, warn }) {
  const accent = bad ? '#ef4444' : warn ? '#a16207' : good ? '#16a34a' : 'var(--text-primary)';
  return (
    <div style={{ padding: 12, border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-card, white)' }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)' }}>{label}</div>
      <div style={{ fontSize: '1.5rem', fontWeight: 700, color: accent, marginTop: 4 }}>{value}</div>
      <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>
    </div>
  );
}

function MethodBar({ parts }) {
  const total = parts.reduce((a, b) => a + b.count, 0);
  if (!total) return <div style={{ color: 'var(--text-secondary)', fontSize: 13 }}>No data yet.</div>;
  return (
    <div>
      <div style={{ display: 'flex', height: 22, borderRadius: 4, overflow: 'hidden', border: '1px solid var(--border-color)' }}>
        {parts.map(p => p.count > 0 && (
          <div key={p.label}
               title={`${p.label}: ${p.count} (${((p.count/total)*100).toFixed(1)}%)`}
               style={{ flex: p.count, background: p.color }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', marginTop: 8, fontSize: 12, color: 'var(--text-secondary)' }}>
        {parts.map(p => (
          <div key={p.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ width: 10, height: 10, background: p.color, borderRadius: 2, display: 'inline-block' }} />
            {p.label} — <strong style={{ color: 'var(--text-primary)' }}>{p.count}</strong>
            <span style={{ color: 'var(--text-secondary)' }}>({((p.count/total)*100).toFixed(0)}%)</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ParseDetailDrawer({ parse, onClose }) {
  return (
    <div onClick={onClose}
         style={{
           position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)', zIndex: 1000,
           display: 'flex', justifyContent: 'flex-end',
         }}>
      <div onClick={e => e.stopPropagation()}
           style={{
             width: 'min(640px, 100%)', height: '100%', background: 'var(--bg-card, white)',
             padding: 24, overflowY: 'auto',
           }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
          <div>
            <h3 style={{ margin: 0, fontSize: '1.125rem' }}>Parse detail</h3>
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>{parse.id}</div>
          </div>
          <button onClick={onClose} style={{ background: 'transparent', border: 'none', fontSize: 20, cursor: 'pointer' }}>×</button>
        </div>

        <table style={{ width: '100%', fontSize: 13 }}>
          <tbody>
            <Row k="Timestamp"          v={new Date(parse.ts).toLocaleString('en-ZA', { hour12: false })} />
            <Row k="Status"             v={<StatusPill status={parse.status} />} />
            <Row k="Job ID"             v={parse.job_id} mono />
            <Row k="Request ID"         v={parse.request_id} mono />
            <Row k="User ID"            v={parse.user_id || 'anonymous'} mono />
            <Row k="Bank"               v={parse.bank_id || '—'} />
            <Row k="Extraction method"  v={formatMethod(parse.extraction_method)} />
            <Row k="Transactions"       v={parse.txn_count ?? '—'} />
            <Row k="Detected income"    v={parse.income_zar ? fmt(parse.income_zar) : '—'} />
            <Row k="Balance reconciles" v={parse.balance_ok == null ? '—' : parse.balance_ok ? '✓ yes' : '✗ no'} />
            <Row k="Confidence"         v={parse.confidence != null ? (Number(parse.confidence) * 100).toFixed(1) + '%' : '—'} />
            <Row k="Claude invoked"     v={parse.ai_invoked === true ? '✓ yes' : parse.ai_invoked === false ? 'no' : '—'} />
            <Row k="Claude cost"        v={parse.ai_cost_usd ? `R ${(Number(parse.ai_cost_usd) * ZAR_PER_USD).toFixed(2)}` : '—'} />
            <Row k="Latency"            v={formatLatency(parse.latency_ms)} />
            {parse.error_message && (
              <Row k="Error" v={<div style={{ color: '#ef4444', fontFamily: 'monospace', fontSize: 12 }}>{parse.error_message}</div>} />
            )}
          </tbody>
        </table>

        {parse.validation_issues?.length > 0 && (
          <>
            <h4 style={{ marginTop: 24, marginBottom: 8 }}>Validation issues ({parse.validation_issues.length})</h4>
            <pre style={{ background: 'var(--bg-subtle, #f9fafb)', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto' }}>
              {JSON.stringify(parse.validation_issues, null, 2)}
            </pre>
          </>
        )}

        {parse.stage_trace?.length > 0 && (
          <>
            <h4 style={{ marginTop: 24, marginBottom: 8 }}>Stage trace</h4>
            <pre style={{ background: 'var(--bg-subtle, #f9fafb)', padding: 12, borderRadius: 6, fontSize: 11, overflow: 'auto' }}>
              {JSON.stringify(parse.stage_trace, null, 2)}
            </pre>
          </>
        )}
      </div>
    </div>
  );
}

function Row({ k, v, mono }) {
  return (
    <tr>
      <td style={{ padding: '6px 12px 6px 0', color: 'var(--text-secondary)', fontSize: 12, width: '40%', verticalAlign: 'top' }}>{k}</td>
      <td style={{ padding: '6px 0', fontFamily: mono ? 'monospace' : 'inherit', fontSize: mono ? 12 : 13, wordBreak: 'break-all' }}>{v}</td>
    </tr>
  );
}
