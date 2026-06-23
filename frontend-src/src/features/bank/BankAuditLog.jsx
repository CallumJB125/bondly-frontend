import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bankApi } from './bankApi.js';

// #41 POPIA access log — read-only record of what this bank's team did and when.
// Data comes from server-side audit rows (db.bidViews); scoped to the bank.
export default function BankAuditLog() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  const [q, setQ]       = useState('');

  useEffect(() => { bankApi.auditLog().then(setData).catch(e => setErr(e.message)); }, []);

  if (err)   return <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>;
  if (!data) return <div className="bank-section">Loading…</div>;

  const term = q.trim().toLowerCase();
  const entries = term
    ? data.entries.filter(e =>
        (e.ref || '').toLowerCase().includes(term) ||
        (e.bankUserName || '').toLowerCase().includes(term) ||
        (e.actionLabel || '').toLowerCase().includes(term))
    : data.entries;

  const fmtTs = (iso) => iso ? new Date(iso).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

  return (
    <>
      <h2>Access log</h2>
      <p className="lede">
        Every action your team takes on an application is recorded here for POPIA accountability —
        who accessed what, and when. Read-only.
      </p>

      <div className="bank-section">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 12 }}>
          <h3 style={{ margin: 0 }}>Recent activity · {entries.length}{term ? ` of ${data.total}` : ''}</h3>
          <input
            value={q}
            onChange={e => setQ(e.target.value)}
            placeholder="Filter by ref, person or action…"
            style={{ flex: '0 1 280px', padding: '7px 11px', border: '1px solid #d1d5db', borderRadius: 7, fontSize: '0.83rem' }}
          />
        </div>

        {entries.length === 0 ? (
          <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>
            {term ? 'No entries match your filter.' : 'No recorded activity yet.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.84rem' }}>
              <thead>
                <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>When</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Team member</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Action</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>Application</th>
                  <th style={{ padding: '8px 10px', borderBottom: '1px solid #e5e7eb' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.map(e => (
                  <tr key={e.id}>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#6b7280', whiteSpace: 'nowrap' }}>{fmtTs(e.at)}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontWeight: 600, color: '#0b1e2d' }}>{e.bankUserName}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>{e.actionLabel}</td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6' }}>
                      {e.ref ? <Link to={`/bank/applications/${e.ref}`} style={{ fontFamily: 'monospace', color: '#0b1e2d' }}>{e.ref}</Link> : '—'}
                    </td>
                    <td style={{ padding: '8px 10px', borderBottom: '1px solid #f3f4f6', color: '#9ca3af', fontFamily: 'monospace', fontSize: '0.76rem' }}>{e.ip || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}
