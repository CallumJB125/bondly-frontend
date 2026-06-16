import { useState } from 'react';
import { CreditCard } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState.jsx';
import { payments as pmtApi } from '../../lib/api.js';
import { useToast } from '../../components/Toast.jsx';
import { fmt, fmtDate } from '../../lib/format.js';
import Button from '../../components/Button.jsx';
import Card, { CardHeader, CardBody } from '../../components/Card.jsx';
import Input, { Select } from '../../components/Input.jsx';
import Modal from '../../components/Modal.jsx';

export default function PaymentsTab({ loans, payments, onRefresh }) {
  const [form, setForm]   = useState({ loanId: '', amount: '', date: today(), notes: '' });
  const [loading, setLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
  const showToast = useToast();

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  async function log() {
    if (!loans.length) { showToast('Add a bond first', 'error'); return; }
    if (!form.amount || parseFloat(form.amount) <= 0) { showToast('Enter a valid amount', 'error'); return; }
    setLoading(true);
    try {
      await pmtApi.log({
        loanId: parseInt(form.loanId) || loans[0].id,
        amount: parseFloat(form.amount),
        date:   form.date || today(),
        notes:  form.notes,
        isExtra: true,
      });
      showToast('Payment logged', 'success');
      setForm({ loanId: '', amount: '', date: today(), notes: '' });
      setShowForm(false);
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Could not log payment', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (pendingRemoveId !== id) { setPendingRemoveId(id); return; }
    try {
      await pmtApi.remove(id);
      showToast('Payment removed', 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Could not remove', 'error');
    }
  }

  const sortedPmts = [...payments].sort((a, b) => new Date(b.date) - new Date(a.date));

  return (
    <div className="fade-in">
      {showForm && (
        <Modal title="Log Extra Payment" onClose={() => setShowForm(false)}>
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            {loans.length > 1 && (
              <Select label="Bond" id="pmtLoan" value={form.loanId} onChange={set('loanId')}>
                <option value="">Select bond</option>
                {loans.map(l => <option key={l.id} value={l.id}>{l.bank} — {fmt(l.amount)}</option>)}
              </Select>
            )}
            <div>
              <div style={{ display: 'flex', gap: 6, marginBottom: 8, flexWrap: 'wrap' }}>
                {[500, 1000, 2000, 5000].map(amt => (
                  <button
                    key={amt}
                    type="button"
                    onClick={() => setForm(f => ({ ...f, amount: String(amt) }))}
                    style={{
                      padding: '4px 12px', borderRadius: 20, border: '1.5px solid var(--border-color)',
                      background: form.amount === String(amt) ? 'var(--lime)' : 'var(--bg-page)',
                      color: form.amount === String(amt) ? 'var(--forest)' : 'var(--text-secondary)',
                      fontWeight: 600, fontSize: '0.8125rem', cursor: 'pointer', fontFamily: 'var(--font-sans)',
                    }}
                  >
                    R{amt.toLocaleString()}
                  </button>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Amount (R)" id="pmtAmt" type="number" value={form.amount} onChange={set('amount')} placeholder="5 000" min="1" autoFocus />
                <Input label="Date" id="pmtDate" type="date" value={form.date} onChange={set('date')} />
              </div>
            </div>
            <Input label="Notes (optional)" id="pmtNotes" type="text" value={form.notes} onChange={set('notes')} placeholder="e.g. bonus payment" />
            <Button variant="lime" onClick={log} loading={loading}>Log payment</Button>
          </div>
        </Modal>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>Payment History</h3>
        <Button variant="lime" size="sm" onClick={() => setShowForm(s => !s)}>
          + Log extra payment
        </Button>
      </div>

      {sortedPmts.length === 0 ? (
        <EmptyState
          icon="💳"
          title="No extra payments logged yet"
          body="Every extra payment reduces your interest and shortens your term. Even R500/month extra makes a big difference over 20 years."
          action={<Button variant="lime" size="sm" onClick={() => setShowForm(true)}>+ Log your first extra payment</Button>}
        />
      ) : (
        <Card>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Bond</th>
                  <th style={{ textAlign: 'right' }}>Amount</th>
                  <th>Notes</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {sortedPmts.map(p => {
                  const loan = loans.find(l => l.id === p.loanId);
                  return (
                    <tr key={p.id}>
                      <td>{fmtDate(p.date)}</td>
                      <td>{loan?.bank || '—'}</td>
                      <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(p.amount)}</td>
                      <td style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{p.notes || '—'}</td>
                      <td>
                        {pendingRemoveId === p.id ? (
                          <span style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sure?</span>
                            <button onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Yes</button>
                            <button onClick={() => setPendingRemoveId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem' }}>No</button>
                          </span>
                        ) : (
                          <button
                            onClick={() => remove(p.id)}
                            style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8125rem' }}
                          >
                            Remove
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}

function today() {
  return new Date().toISOString().split('T')[0];
}
