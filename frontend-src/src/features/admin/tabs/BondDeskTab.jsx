import { useEffect, useState } from 'react';
import { fmt } from '../../../lib/format.js';

const BANK_OPTIONS = [
  { slug: 'absa',        name: 'ABSA' },
  { slug: 'fnb',         name: 'FNB' },
  { slug: 'nedbank',     name: 'Nedbank' },
  { slug: 'standard',    name: 'Standard Bank' },
  { slug: 'capitec',     name: 'Capitec' },
  { slug: 'investec',    name: 'Investec' },
  { slug: 'sahomeloans', name: 'SA Home Loans' },
];

export default function BondDeskTab({ showToast }) {
  const [summary, setSummary] = useState(null);
  const [requests, setRequests] = useState(null);
  const [users, setUsers]       = useState(null);
  const [reload, setReload]     = useState(0);

  function tok() { return 'Bearer ' + (localStorage.getItem('bondly_token') || ''); }

  useEffect(() => {
    fetch('/api/admin/bond-desk/summary',         { headers: { Authorization: tok() } }).then(r => r.json()).then(j => j.success && setSummary(j.data));
    fetch('/api/admin/bank-access-requests',      { headers: { Authorization: tok() } }).then(r => r.json()).then(j => j.success && setRequests(j.data));
    fetch('/api/admin/bank-users',                { headers: { Authorization: tok() } }).then(r => r.json()).then(j => j.success && setUsers(j.data));
  }, [reload]);

  async function approve(reqRow) {
    const slug = reqRow.bankSlug || prompt(`Which bank does ${reqRow.email} work for? Enter slug (e.g. absa, fnb, nedbank)`)?.toLowerCase();
    if (!slug) return;
    const opt = BANK_OPTIONS.find(b => b.slug === slug);
    try {
      const r = await fetch(`/api/admin/bank-access-requests/${reqRow.id}/approve`, {
        method: 'POST',
        headers: { Authorization: tok(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ bankSlug: slug, bankName: opt?.name }),
      }).then(r => r.json());
      if (!r.success) throw new Error(r.error);
      showToast?.(`Approved ${reqRow.email} — invite emailed`, 'success');
      setReload(x => x + 1);
    } catch (e) { showToast?.(e.message || 'Could not approve', 'error'); }
  }
  async function deny(reqRow) {
    const reason = prompt('Reason (optional, the user does not see this):') || '';
    try {
      const r = await fetch(`/api/admin/bank-access-requests/${reqRow.id}/deny`, {
        method: 'POST',
        headers: { Authorization: tok(), 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      }).then(r => r.json());
      if (!r.success) throw new Error(r.error);
      showToast?.(`Denied ${reqRow.email}`, 'success');
      setReload(x => x + 1);
    } catch (e) { showToast?.(e.message || 'Could not deny', 'error'); }
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {summary && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(170px, 1fr))', gap: 12 }}>
          <Kpi label="Open mortgages"     v={summary.openApplications} />
          <Kpi label="Bond Desk users"    v={summary.bankUsers}        sub={`${summary.bankAdmins} bank lead${summary.bankAdmins === 1 ? '' : 's'}`} />
          <Kpi label="Pending requests"   v={summary.pendingRequests}  warn={summary.pendingRequests > 0} />
          <Kpi label="Active bids"        v={summary.counts.activeBids}/>
          <Kpi label="Accepted bids"      v={summary.counts.acceptedBids} good />
          <Kpi label="Avg active rate"    v={summary.avgActiveRate != null ? summary.avgActiveRate.toFixed(2) + '%' : '—'} />
        </div>
      )}

      <div className="card" style={{ padding: 18 }}>
        <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Pending access requests</h3>
        <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
          Approving sends a magic invite to set a password. The first person at each bank gets <strong>bank_admin</strong> role — they can then invite their colleagues without further approval.
        </p>
        {!requests && <div>Loading…</div>}
        {requests && requests.pending.length === 0 && <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem' }}>No pending requests right now.</div>}
        {requests && requests.pending.map(r => (
          <div key={r.id} style={{
            display: 'grid',
            gridTemplateColumns: '2fr 2fr 1fr auto',
            gap: 12, padding: 12,
            background: 'var(--bg-page)',
            border: '1px solid var(--border-color)',
            borderRadius: 8, marginBottom: 6, alignItems: 'center',
          }}>
            <div>
              <div style={{ fontWeight: 700 }}>{r.name}</div>
              <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{r.email}</div>
            </div>
            <div style={{ fontSize: '0.82rem' }}>
              {r.bankName
                ? <><span style={{ color: '#15803d', fontWeight: 700 }}>✓ {r.bankName}</span> <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>(matched from email)</span></>
                : <span style={{ color: '#b45309', fontWeight: 700 }}>Bank unknown — pick on approve</span>}
              {r.message && <div style={{ marginTop: 4, fontSize: '0.74rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>"{r.message}"</div>}
            </div>
            <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
              {new Date(r.requestedAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => approve(r)}
                style={{ padding: '7px 14px', background: 'var(--forest, #1e3a5f)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer', whiteSpace: 'nowrap' }}>
                Approve
              </button>
              <button onClick={() => deny(r)}
                style={{ padding: '7px 14px', background: 'transparent', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                Deny
              </button>
            </div>
          </div>
        ))}
      </div>

      {users && (
        <div className="card" style={{ padding: 18 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 4 }}>Bond Desk users · {users.users.length}</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
            All users with access to the Bond Desk. Demo accounts created at seed time are flagged.
          </p>
          <table style={{ width: '100%', fontSize: '0.875rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: 'var(--text-secondary)', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)' }}>Name</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)' }}>Email</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)' }}>Bank</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)' }}>Role</th>
                <th style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)' }}>Last login</th>
              </tr>
            </thead>
            <tbody>
              {users.users.map(u => (
                <tr key={u.id}>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)' }}>{u.name} {u.demo && <span style={{ fontSize: '0.65rem', color: '#92400e', background: '#fef3c7', padding: '1px 6px', borderRadius: 99, marginLeft: 4 }}>demo</span>}</td>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)', color: 'var(--text-secondary)' }}>{u.email}</td>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)' }}>{u.bankName}</td>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)', fontSize: '0.72rem' }}>{u.role}</td>
                  <td style={{ padding: '8px 6px', borderBottom: '1px solid var(--border-color)', fontSize: '0.74rem', color: 'var(--text-secondary)' }}>
                    {u.lastLogin ? new Date(u.lastLogin).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }) : 'never'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {users.invites.length > 0 && (
            <>
              <h4 style={{ marginTop: 18, marginBottom: 6, fontWeight: 700 }}>Pending invites · {users.invites.length}</h4>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
                {users.invites.map(i => (
                  <li key={i.id} style={{ padding: '6px 0', borderBottom: '1px dashed var(--border-color)', fontSize: '0.85rem', display: 'flex', justifyContent: 'space-between' }}>
                    <span>{i.email} → <strong>{i.bankName}</strong> ({i.role})</span>
                    <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem' }}>expires {new Date(i.expiresAt).toLocaleDateString('en-ZA')}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      )}
    </div>
  );
}

function Kpi({ label, v, sub, good, warn }) {
  return (
    <div className="card" style={{ padding: 14 }}>
      <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: good ? '#15803d' : warn ? '#b45309' : 'var(--text-primary)' }}>{v}</div>
      {sub && <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
