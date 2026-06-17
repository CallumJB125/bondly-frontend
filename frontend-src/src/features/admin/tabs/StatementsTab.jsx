// StatementsTab — uploaded bank statements list + inspect modal.
// Standardized (Phase C cont.): self-fetches via React Query with a loading skeleton
// and the shared EmptyState, instead of being prop-fed from the Admin monolith.
import { useState } from 'react';
import { admin } from '../../../lib/api.js';
import { useAdminStatements } from '../hooks/useAdminQueries.js';
import EmptyState from '../components/EmptyState.jsx';

function SkeletonRows({ rows = 6 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="adm-skeleton" style={{ height: 44, borderRadius: 6, background: 'var(--bg-card)' }} />
      ))}
    </div>
  );
}

export default function StatementsTab({ showToast }) {
  const { data: statements = [], isLoading } = useAdminStatements();
  const token = localStorage.getItem('bondly_token');
  const [inspecting, setInspecting] = useState(null); // statement record being inspected

  // Show the summary immediately, then lazy-load raw transactions (kept out of
  // the list payload to keep it light).
  async function inspectStatement(s) {
    setInspecting(s);
    if (s.rawTransactions) return;
    try {
      const d = await admin.statementDetail(s.id);
      setInspecting(cur => (cur && cur.id === s.id) ? { ...cur, rawTransactions: d.rawTransactions || [] } : cur);
    } catch { /* leave summary-only */ }
  }

  function download(stmt) {
    fetch('/api/admin/statements/' + stmt.id + '/download', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = stmt.filename; a.click(); })
      .catch(() => showToast('Download failed', 'error'));
  }

  const SOURCE_COLORS = { qualify: ['#3b82f620','#3b82f6'], onboarding: ['#10b98120','#10b981'], preapproval: ['#f59e0b20','#f59e0b'] };

  if (isLoading) return <div style={{ padding: '8px 0 40px' }}><SkeletonRows rows={8} /></div>;

  if (!statements.length) return (
    <div style={{ padding: '8px 0 40px' }}>
      <EmptyState title="No statements yet" sub="Uploaded bank statements will appear here once users submit them." />
    </div>
  );

  return (
    <div style={{ padding: '0 0 40px' }}>
      {inspecting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) setInspecting(null); }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 900, padding: 24, position: 'relative' }}>
            <button onClick={() => setInspecting(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            <h3 style={{ margin: '0 0 4px', fontWeight: 700 }}>{inspecting.filename}</h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              {inspecting.userName || 'Anonymous'} · {inspecting.source} · {inspecting.bankFormat || 'unknown format'} · {inspecting.transactionCount || 0} transactions
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                ['Income detected', inspecting.incomeDetected ? `R ${(inspecting.incomeMonthly||0).toLocaleString('en-ZA')} / mo` : 'Not detected', inspecting.incomeDetected ? '#10b981' : '#ef4444'],
                ['Confidence', inspecting.incomeConfidence || '—', '#6366f1'],
                ['Transactions', `${inspecting.creditCount||0} credits · ${inspecting.debitCount||0} debits`, 'var(--text-secondary)'],
                ['Max bond', inspecting.maxBond ? `R ${Math.round(inspecting.maxBond).toLocaleString('en-ZA')}` : '—', 'var(--text-primary)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: 'var(--bg-page)', borderRadius: 8, padding: '10px 14px', minWidth: 160 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>
            {inspecting.rawTransactions?.length ? (
              <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      {['Date','Description','Amount','Type','Category'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inspecting.rawTransactions.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: t.isCredit ? '#10b98108' : 'transparent' }}>
                        <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{t.date || '—'}</td>
                        <td style={{ padding: '7px 12px', maxWidth: 300 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.description}>{t.description}</div></td>
                        <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: t.isCredit ? '#10b981' : 'var(--text-primary)', textAlign: 'right' }}>R {(t.amount||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                        <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: t.isCredit ? '#10b98120' : '#ef444420', color: t.isCredit ? '#10b981' : '#ef4444' }}>{t.isCredit ? 'CR' : 'DR'}</span>
                        </td>
                        <td style={{ padding: '7px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.category || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No raw transactions stored for this statement.</div>
            )}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 16, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        {statements.length} statement{statements.length !== 1 ? 's' : ''} stored
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              {['Date', 'User', 'File', 'Source', 'Format', 'Txns', 'Income', ''].map((h, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statements.map(s => {
              const [bg, fg] = SOURCE_COLORS[s.source] || ['#6366f120', '#6366f1'];
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                    {s.uploadedAt ? new Date(s.uploadedAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {s.userName
                      ? <div><div style={{ fontWeight: 600 }}>{s.userName}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.userEmail}</div></div>
                      : <span style={{ color: 'var(--text-secondary)' }}>Anonymous</span>}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.filename}>{s.filename}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: bg, color: fg }}>{s.source || '—'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{s.bankFormat || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {s.transactionCount != null ? `${s.transactionCount} (${s.creditCount||0}↑ ${s.debitCount||0}↓)` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {s.incomeDetected
                      ? <span style={{ fontWeight: 700, color: '#10b981' }}>R {(s.incomeMonthly||0).toLocaleString('en-ZA')} <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.incomeConfidence}</span></span>
                      : <span style={{ color: '#ef4444', fontSize: '0.8125rem' }}>Not detected</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                    <button onClick={() => inspectStatement(s)}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                      Inspect
                    </button>
                    <button onClick={() => download(s)}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                      ↓
                    </button>
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
