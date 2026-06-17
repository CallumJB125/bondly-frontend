// CommissionsTab — commission pipeline summary + records, with status updates and
// a "log commission" modal. Standardized (Phase C cont.): self-fetches via React Query
// (shared cache with the dashboard KPIs); mutations update the cache directly.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { admin } from '../../../lib/api.js';
import { useAdminCommissions } from '../hooks/useAdminQueries.js';
import { fmt, fmtDate } from '@bondly/ui/lib/format.js';

const COMMISSIONS_KEY = ['admin', 'commissions'];

export default function CommissionsTab({ showToast }) {
  const qc = useQueryClient();
  const { data = { commissions: [], totals: {} } } = useAdminCommissions();
  const { commissions = [], totals = {} } = data;
  const [filter, setFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ bank: '', loanAmount: '', actualAmount: '', invoiceRef: '', notes: '' });

  const filtered = filter === 'all' ? commissions : commissions.filter(c => c.status === filter);
  const totalAll = (totals.pending || 0) + (totals.received || 0) + (totals.reconciled || 0);

  async function updateStatus(id, status) {
    try {
      const updated = await admin.updateCommission(id, { status });
      qc.setQueryData(COMMISSIONS_KEY, d => d ? { ...d, commissions: d.commissions.map(c => c.id === id ? updated : c) } : d);
      showToast('Status updated', 'success');
    } catch { showToast('Failed to update', 'error'); }
  }

  return (
    <div className="fade-in">
      {/* Summary cards */}
      <div className="comm-summary">
        {[
          { label: 'Pending',    value: fmt(totals.pending    || 0), sub: `${commissions.filter(c=>c.status==='pending').length} records`,    color: '#f59e0b' },
          { label: 'Received',   value: fmt(totals.received   || 0), sub: `${commissions.filter(c=>c.status==='received').length} records`,   color: '#3b82f6' },
          { label: 'Reconciled', value: fmt(totals.reconciled || 0), sub: `${commissions.filter(c=>c.status==='reconciled').length} records`, color: '#16a34a' },
          { label: 'Total Pipeline', value: fmt(totalAll), sub: 'All statuses combined', color: '#6366f1' },
        ].map(k => (
          <div key={k.label} className="comm-card">
            <div className="adm-kpi-accent" style={{ background: k.color }} />
            <div className="comm-card__label">{k.label}</div>
            <div className="comm-card__value" style={{ color: k.color }}>{k.value}</div>
            <div className="comm-card__sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['all','All'],['pending','Pending'],['received','Received'],['reconciled','Reconciled']].map(([v,l]) => (
          <button key={v} className={`cust-filter-chip ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
        <button className="adm-quick-action adm-quick-action--primary" style={{ marginLeft: 'auto' }} onClick={() => setAddOpen(true)}>+ Log commission</button>
      </div>

      <div className="cust-table-wrap">
        <table className="data-table">
          <thead><tr><th>Bank</th><th>Loan Amount</th><th>Commission</th><th>Status</th><th>Invoice Ref</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>No commissions recorded yet</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.bank || '—'}</td>
                <td>{c.loanAmount ? fmt(c.loanAmount) : '—'}</td>
                <td style={{ fontWeight: 700 }}>{fmt(c.actualAmount || c.estimatedAmount || 0)}{!c.actualAmount && c.estimatedAmount ? <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> est.</span> : ''}</td>
                <td>
                  <span className={`pill pill--${c.status === 'reconciled' ? 'green' : c.status === 'received' ? 'blue' : 'orange'}`}>
                    {c.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{c.invoiceRef || '—'}</td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{fmtDate(c.receivedAt || c.createdAt)}</td>
                <td>
                  {c.status === 'pending' && (
                    <button onClick={() => updateStatus(c.id, 'received')}
                      style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: '1px solid #2563eb', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
                      Mark received
                    </button>
                  )}
                  {c.status === 'received' && (
                    <button onClick={() => updateStatus(c.id, 'reconciled')}
                      style={{ fontSize: '0.75rem', color: '#16a34a', background: 'none', border: '1px solid #16a34a', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
                      Reconcile
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setAddOpen(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', margin: 0 }}>Log Commission</h3>
              <button onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {[['Bank', 'bank', 'text', 'ABSA'], ['Loan Amount (R)', 'loanAmount', 'number', '1200000'], ['Commission Received (R)', 'actualAmount', 'number', '6000'], ['Invoice Ref', 'invoiceRef', 'text', 'INV-2026-001']].map(([lbl, key, type, ph]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{lbl}</label>
                  <input type={type} placeholder={ph} value={addForm[key]} onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setAddOpen(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button onClick={async () => {
                  if (!addForm.bank || !addForm.actualAmount) { showToast('Bank and amount required', 'error'); return; }
                  try {
                    await fetch('/api/admin/commissions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('bondly_token') }, body: JSON.stringify({ bank: addForm.bank, loanAmount: parseFloat(addForm.loanAmount) || 0, actualAmount: parseFloat(addForm.actualAmount), invoiceRef: addForm.invoiceRef, notes: addForm.notes }) });
                    await qc.invalidateQueries({ queryKey: COMMISSIONS_KEY });
                    setAddOpen(false);
                    setAddForm({ bank: '', loanAmount: '', actualAmount: '', invoiceRef: '', notes: '' });
                    showToast('Commission logged', 'success');
                  } catch { showToast('Failed to save', 'error'); }
                }} style={{ flex: 2, padding: 10, borderRadius: 8, background: 'var(--forest)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
