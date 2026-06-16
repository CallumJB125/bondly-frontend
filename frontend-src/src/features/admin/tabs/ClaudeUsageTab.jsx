import { useState, useEffect } from 'react';
import { RefreshCw } from 'lucide-react';
import Card, { CardHeader, CardBody } from '../../../components/Card.jsx';

function apiFetchAdmin(path) {
  const token = localStorage.getItem('bondly_token');
  return fetch(path, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
    .then(r => {
      if (r.status === 401) { localStorage.removeItem('bondly_token'); window.location.href = '/login?expired=1'; return null; }
      return r.json();
    })
    .then(j => { if (!j) return null; if (!j.success) throw new Error(j.error); return j.data; });
}

export default function ClaudeUsageTab() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [err, setErr]         = useState('');

  useEffect(() => {
    apiFetchAdmin('/api/admin/claude-usage')
      .then(d => setData(d))
      .catch(e => setErr(e.message))
      .finally(() => setLoading(false));
  }, []);

  const PURPOSE_LABEL = {
    extract_transactions:  'PDF extraction',
    categorise_transactions: 'Categorisation',
    extract_metadata:      'Metadata',
    audit_statement:       'Statement audit',
    coach_note:            'Coach notes',
    unknown:               'Other',
  };

  const MODEL_COLOR = { 'claude-haiku-4-5-20251001': '#06b6d4', 'claude-sonnet-4-6': '#8b5cf6' };
  const MODEL_LABEL = { 'claude-haiku-4-5-20251001': 'Haiku', 'claude-sonnet-4-6': 'Sonnet' };

  function fmtCost(usd) {
    const v = Number(usd) || 0;
    if (!v) return '$0.00';
    return '$' + v.toFixed(4);
  }
  function fmtTokens(n) {
    const v = Number(n) || 0;
    if (!v) return '0';
    if (v >= 1000000) return (v/1000000).toFixed(2) + 'M';
    if (v >= 1000)    return Math.round(v/1000) + 'k';
    return String(v);
  }

  if (loading) return <div className="ff-loading"><RefreshCw size={20} className="ff-spin" /><span>Loading…</span></div>;
  if (err)     return <div style={{ color: 'var(--error)', padding: 24 }}>{err}</div>;
  if (!data)   return null;

  const { monthly, prevMonth, allTime, recent } = data;

  function SummaryCard({ title, summary, highlight }) {
    return (
      <div style={{ background: highlight ? 'var(--forest)' : 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 10, padding: '16px 20px', flex: 1, minWidth: 160 }}>
        <div style={{ fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', color: highlight ? 'rgba(255,255,255,0.7)' : 'var(--text-secondary)', marginBottom: 8 }}>{title}</div>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, color: highlight ? '#fff' : 'var(--text-primary)', marginBottom: 4 }}>{fmtCost(summary.costUsd)}</div>
        <div style={{ fontSize: '0.8125rem', color: highlight ? 'rgba(255,255,255,0.6)' : 'var(--text-secondary)' }}>{summary.calls} calls · {fmtTokens(summary.inputTokens + summary.outputTokens)} tokens</div>
      </div>
    );
  }

  function BreakdownTable({ summary }) {
    const entries = Object.entries(summary.byPurpose).sort((a,b) => b[1].costUsd - a[1].costUsd);
    if (!entries.length) return <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No data yet.</div>;
    return (
      <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--border)' }}>
            {['Purpose','Calls','Input','Output','Cost'].map(h => (
              <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Purpose' ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {entries.map(([p, v]) => (
            <tr key={p} style={{ borderBottom: '1px solid var(--border)' }}>
              <td style={{ padding: '8px 10px' }}>{PURPOSE_LABEL[p] || p}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{v.calls}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtTokens(v.inputTokens)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtTokens(v.outputTokens)}</td>
              <td style={{ padding: '8px 10px', textAlign: 'right', fontWeight: 700 }}>{fmtCost(v.costUsd)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    );
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 20, maxWidth: 860 }}>

      {/* Summary cards */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <SummaryCard title="This month"  summary={monthly}   highlight />
        <SummaryCard title="Last month"  summary={prevMonth} />
        <SummaryCard title="All time"    summary={allTime}   />
      </div>

      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'var(--bg-secondary)', padding: '8px 14px', borderRadius: 8, border: '1px solid var(--border)' }}>
        Estimates based on Haiku ($0.80/$4.00 per MTok) and Sonnet ($3.00/$15.00 per MTok).
        Actual billing at <a href="https://console.anthropic.com/settings/billing" target="_blank" rel="noreferrer" style={{ color: 'var(--forest)' }}>console.anthropic.com</a>
      </div>

      {/* This month breakdown */}
      <Card>
        <CardHeader>This month — by feature</CardHeader>
        <CardBody><BreakdownTable summary={monthly} /></CardBody>
      </Card>

      {/* Recent calls log */}
      <Card>
        <CardHeader>Recent calls</CardHeader>
        <CardBody>
          {!recent.length ? <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No calls logged yet — upload a statement to start.</div> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)' }}>
                    {['Time','Model','Purpose','In','Out','Cost'].map(h => (
                      <th key={h} style={{ padding: '6px 10px', textAlign: h === 'Time' || h === 'Model' || h === 'Purpose' ? 'left' : 'right', color: 'var(--text-secondary)', fontWeight: 600, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', whiteSpace: 'nowrap' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {recent.map((r, i) => (
                    <tr key={i} style={{ borderBottom: '1px solid var(--border)' }}>
                      <td style={{ padding: '7px 10px', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{new Date(r.ts).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}</td>
                      <td style={{ padding: '7px 10px' }}>
                        <span style={{ padding: '2px 7px', borderRadius: 10, background: (MODEL_COLOR[r.model] || '#9ca3af') + '18', color: MODEL_COLOR[r.model] || '#9ca3af', fontWeight: 700, fontSize: '0.75rem' }}>
                          {MODEL_LABEL[r.model] || r.model}
                        </span>
                      </td>
                      <td style={{ padding: '7px 10px' }}>{PURPOSE_LABEL[r.purpose] || r.purpose}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtTokens(r.inputTokens)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', color: 'var(--text-secondary)' }}>{fmtTokens(r.outputTokens)}</td>
                      <td style={{ padding: '7px 10px', textAlign: 'right', fontWeight: 600 }}>{fmtCost(r.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
