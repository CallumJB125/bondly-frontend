import { useEffect, useMemo, useState } from 'react';
import { admin } from '../../../lib/api.js';

/**
 * MergeCustomerButton — opens a small modal to merge another customer INTO
 * the current one. The merge is destructive at the data level (the loser
 * is soft-deleted via mergedIntoUserId) so we force a one-line confirmation
 * before firing the POST.
 *
 * Props:
 *   winner   — the customer currently being viewed
 *   users    — full list of registered customers (already loaded by parent)
 *   onMerged — callback after a successful merge so the parent can refresh
 *   showToast
 */
export default function MergeCustomerButton({ winner, users, onMerged, showToast }) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [pickId,  setPickId]  = useState(null);
  const [working, setWorking] = useState(false);

  // Candidates: every other customer, ranked by closeness to the winner
  // (same email domain / same phone / same name first-word). Helps the admin
  // spot the likely dupe at the top of the list.
  const candidates = useMemo(() => {
    if (!winner) return [];
    const q = query.trim().toLowerCase();
    const winnerDomain = (winner.email || '').split('@')[1] || '';
    const winnerName0  = (winner.name  || '').split(' ')[0]?.toLowerCase() || '';
    return (users || [])
      .filter(u => u && u.id !== winner.id && !u.mergedIntoUserId)
      .map(u => {
        let score = 0;
        if (winnerDomain && (u.email || '').endsWith('@' + winnerDomain)) score += 3;
        if (winnerName0 && (u.name || '').toLowerCase().startsWith(winnerName0)) score += 2;
        if (winner.phone && u.phone && winner.phone.replace(/\D/g, '') === u.phone.replace(/\D/g, '')) score += 5;
        if (winner.idNumber && u.idNumber && winner.idNumber === u.idNumber) score += 6;
        return { u, score };
      })
      .filter(({ u }) => {
        if (!q) return true;
        return (u.name || '').toLowerCase().includes(q) ||
               (u.email || '').toLowerCase().includes(q) ||
               (u.phone || '').includes(q);
      })
      .sort((a, b) => b.score - a.score || (a.u.name || '').localeCompare(b.u.name || ''))
      .slice(0, 50);
  }, [users, winner, query]);

  async function runMerge() {
    if (!pickId || !winner) return;
    const loser = users.find(u => u.id === pickId);
    if (!loser) return;
    const sure = window.confirm(
      `Merge "${loser.name || loser.email}" INTO "${winner.name || winner.email}"?\n\n` +
      `• All their loans / applications / snapshots / activity will be re-pointed to ${winner.name || 'this customer'}.\n` +
      `• "${loser.name || loser.email}" will be soft-deleted (preserved for audit, hidden from lists).\n` +
      `• Reversible by clearing mergedIntoUserId from the loser record.`
    );
    if (!sure) return;
    setWorking(true);
    try {
      const r = await fetch(`/api/admin/customers/${winner.id}/merge/${pickId}`, {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('bondly_token') || ''), 'Content-Type': 'application/json' },
        body: '{}',
      }).then(r => r.json());
      if (!r?.success) throw new Error(r?.error || 'Merge failed');
      const movedSummary = Object.entries(r.data?.moved || {}).map(([k, v]) => `${v} ${k}`).join(', ');
      showToast?.(`Merged. ${movedSummary || 'No related records.'}`, 'success');
      setOpen(false);
      setPickId(null);
      onMerged?.();
    } catch (e) {
      showToast?.(e.message || 'Merge failed', 'error');
    } finally {
      setWorking(false);
    }
  }

  if (!winner) return null;
  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setQuery(''); setPickId(null); }}
        className="cust-profile__action-btn"
        title="Merge another customer into this one"
      >
        ⇆ Merge
      </button>
    );
  }
  return (
    <div className="adm-cmd-overlay" onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}>
      <div className="adm-cmd-panel" role="dialog" aria-modal="true" style={{ maxWidth: 560 }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border-color)' }}>
          <div style={{ fontWeight: 800, fontSize: '1rem' }}>Merge another customer into {winner.name || winner.email}</div>
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Their loans, applications, snapshots, and activity will be re-pointed to this profile. Likely dupes are ranked first.
          </div>
        </div>
        <input
          autoFocus
          value={query}
          onChange={e => setQuery(e.target.value)}
          placeholder="Filter by name, email, or phone…"
          className="adm-cmd-input"
        />
        <ul className="adm-cmd-list">
          {candidates.length === 0 ? (
            <li className="adm-cmd-empty">No candidates match.</li>
          ) : candidates.map(({ u, score }) => (
            <li
              key={u.id}
              className={'adm-cmd-item ' + (pickId === u.id ? 'is-active' : '')}
              onClick={() => setPickId(u.id)}
            >
              <span className="adm-cmd-kind adm-cmd-kind--customer">{score >= 5 ? 'LIKELY DUPE' : 'CUSTOMER'}</span>
              <span className="adm-cmd-label">
                <span>{u.name || u.email}</span>
                <span className="adm-cmd-sub">{u.email || u.phone || u.id}</span>
              </span>
            </li>
          ))}
        </ul>
        <div className="adm-cmd-foot" style={{ justifyContent: 'flex-end' }}>
          <button type="button" onClick={() => setOpen(false)} className="adm-table-toolbar__btn" disabled={working}>Cancel</button>
          <button type="button" onClick={runMerge} className="adm-bulk-bar__btn" disabled={!pickId || working}>
            {working ? 'Merging…' : 'Merge into this profile'}
          </button>
        </div>
      </div>
    </div>
  );
}
