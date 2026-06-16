import { useEffect, useState } from 'react';
import { bankApi, getDecodedBankToken } from './bankApi.js';

export default function BankTeam() {
  const me = getDecodedBankToken();
  const [data, setData]     = useState(null);
  const [err, setErr]       = useState(null);
  const [reload, setReload] = useState(0);

  // Invite form
  const [invEmail, setInvEmail] = useState('');
  const [invName, setInvName]   = useState('');
  const [invRole, setInvRole]   = useState('bidder');
  const [invBusy, setInvBusy]   = useState(false);
  const [invErr, setInvErr]     = useState(null);
  const [invOk, setInvOk]       = useState(null);

  useEffect(() => {
    bankApi.teamInvites()
      .then(d => setData(d))
      .catch(e => setErr(e.message));
  }, [reload]);

  async function invite(e) {
    e.preventDefault();
    setInvBusy(true); setInvErr(null); setInvOk(null);
    try {
      await bankApi.inviteColleague({ email: invEmail, name: invName, role: invRole });
      setInvOk(`Invite sent to ${invEmail}`);
      setInvEmail(''); setInvName('');
      setReload(r => r + 1);
    } catch (e2) { setInvErr(e2.message); }
    finally { setInvBusy(false); }
  }

  async function cancel(token) {
    if (!confirm('Cancel this invite?')) return;
    try {
      await bankApi.cancelInvite(token);
      setReload(r => r + 1);
    } catch (e2) { alert(e2.message); }
  }

  return (
    <>
      <h2>Your team</h2>
      <p className="lede">Invite colleagues from your bank's email domain. They get access immediately — no admin approval needed.</p>

      <div className="bank-section">
        <h3>Invite a colleague</h3>
        <form onSubmit={invite} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr auto auto', gap: 10, alignItems: 'end' }}>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>Their name</label>
            <input value={invName} onChange={e => setInvName(e.target.value)} placeholder="Naledi Dube"
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>Work email (same domain)</label>
            <input type="email" value={invEmail} onChange={e => setInvEmail(e.target.value)} placeholder={'colleague@' + (me?.bankEmail?.split('@')[1] || 'yourbank.co.za')} required
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6 }} />
          </div>
          <div>
            <label style={{ display: 'block', fontSize: '0.72rem', textTransform: 'uppercase', fontWeight: 700, color: '#6b7280', marginBottom: 4 }}>Role</label>
            <select value={invRole} onChange={e => setInvRole(e.target.value)}
              style={{ width: '100%', padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6 }}>
              <option value="bidder">Bidder</option>
              <option value="analyst">Analyst (read-only)</option>
              <option value="bank_admin">Admin</option>
            </select>
          </div>
          <button type="submit" disabled={invBusy}
            style={{ padding: '10px 18px', background: '#c8a84b', color: '#0b1e2d', border: 'none', borderRadius: 7, fontWeight: 700, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            {invBusy ? 'Sending…' : 'Send invite'}
          </button>
        </form>
        {invErr && <div style={{ color: '#991b1b', fontSize: '0.82rem', marginTop: 10 }}>{invErr}</div>}
        {invOk  && <div style={{ color: '#15803d', fontSize: '0.82rem', marginTop: 10 }}>{invOk}</div>}
      </div>

      <div className="bank-section">
        <h3>Pending invites · {data?.invites?.length || 0}</h3>
        {err && <div style={{ color: '#991b1b' }}>{err}</div>}
        {!data && !err && <div>Loading…</div>}
        {data && data.invites.length === 0 && (
          <div style={{ color: '#6b7280', fontSize: '0.85rem' }}>No open invites. Send one above.</div>
        )}
        {data && data.invites.map(i => (
          <div key={i.id} style={{
            display: 'flex', justifyContent: 'space-between', alignItems: 'center',
            padding: '10px 12px', borderRadius: 6, background: '#f9fafb',
            border: '1px solid #e5e7eb', marginBottom: 6, fontSize: '0.875rem',
          }}>
            <div>
              <div style={{ fontWeight: 700 }}>{i.email}{i.name ? ` · ${i.name}` : ''}</div>
              <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                expires {new Date(i.expiresAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                {i.role && (
                  <span style={{
                    fontSize: '0.65rem', padding: '2px 7px', borderRadius: 99, fontWeight: 700, marginLeft: 6,
                    background: i.role === 'bank_admin' ? '#dbeafe' : i.role === 'analyst' ? '#fef3c7' : '#f3f4f6',
                    color: i.role === 'bank_admin' ? '#1e40af' : i.role === 'analyst' ? '#92400e' : '#374151',
                  }}>{i.role === 'bank_admin' ? 'Admin' : i.role === 'analyst' ? 'Analyst' : 'Bidder'}</span>
                )}
              </div>
            </div>
            <button onClick={() => cancel(i.token)}
              style={{ background: 'transparent', border: '1px solid #fecaca', color: '#991b1b', padding: '5px 12px', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, cursor: 'pointer' }}>
              Cancel
            </button>
          </div>
        ))}
      </div>
      {data?.members && data.members.length > 0 && (
        <div className="bank-section">
          <h3>Team members · {data.members.length}</h3>
          {data.members.map(m => (
            <div key={m.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #f3f4f6', fontSize: '0.875rem' }}>
              <div>
                <span style={{ fontWeight: 700 }}>{m.name || m.email}</span>
                <span style={{ fontSize: '0.72rem', color: '#6b7280', marginLeft: 8 }}>{m.email}</span>
              </div>
              <span style={{
                fontSize: '0.65rem', padding: '2px 7px', borderRadius: 99, fontWeight: 700,
                background: m.role === 'bank_admin' ? '#dbeafe' : m.role === 'analyst' ? '#fef3c7' : '#f3f4f6',
                color: m.role === 'bank_admin' ? '#1e40af' : m.role === 'analyst' ? '#92400e' : '#374151',
              }}>{m.role === 'bank_admin' ? 'Admin' : m.role === 'analyst' ? 'Analyst' : 'Bidder'}</span>
            </div>
          ))}
        </div>
      )}
    </>
  );
}
