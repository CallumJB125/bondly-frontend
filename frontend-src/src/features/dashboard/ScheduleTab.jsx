import { useState, useMemo } from 'react';
import { fmt, fmtPct } from '@bondly/ui/lib/format.js';
import { calcAmortSchedule, calcMonthly } from '@bondly/ui/lib/finance.js';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';
import Button from '@bondly/ui/components/Button.jsx';
import { Select } from '@bondly/ui/components/Input.jsx';

const PAGE_SIZE = 24;

export default function ScheduleTab({ loans, payments }) {
  const [loanId, setLoanId]   = useState(null);
  const [page, setPage]       = useState(0);
  const [extra, setExtra]     = useState(0);

  const loan = loanId ? loans.find(l => l.id === parseInt(loanId)) : loans[0];

  const schedule = useMemo(() => {
    if (!loan) return [];
    return calcAmortSchedule(loan.amount, loan.rate, loan.term, extra);
  }, [loan, extra]);

  const baseSchedule = useMemo(() => {
    if (!loan) return [];
    return calcAmortSchedule(loan.amount, loan.rate, loan.term, 0);
  }, [loan]);

  const totalInterest     = schedule.reduce((s, r) => s + r.interest, 0);
  const totalInterestBase = baseSchedule.reduce((s, r) => s + r.interest, 0);
  const interestSaved     = totalInterestBase - totalInterest;
  const monthsSaved       = baseSchedule.length - schedule.length;

  const pageRows = schedule.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const totalPages = Math.ceil(schedule.length / PAGE_SIZE);

  function exportCSV() {
    const header = 'Month,Payment,Principal,Interest,Balance\n';
    const rows = schedule.map(r =>
      `${r.month},${r.payment.toFixed(2)},${r.principal.toFixed(2)},${r.interest.toFixed(2)},${r.balance.toFixed(2)}`
    ).join('\n');
    const blob = new Blob([header + rows], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `bondly-schedule-${loan?.bank || 'bond'}.csv`;
    a.click();
  }

  if (!loan) {
    return <div className="empty-state"><p>Add a bond to view the schedule.</p></div>;
  }

  return (
    <div className="fade-in">
      {/* Controls */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 'var(--space-4)', alignItems: 'flex-end', marginBottom: 'var(--space-5)' }}>
        {loans.length > 1 && (
          <Select label="Bond" id="schedLoan" value={loanId || ''} onChange={e => { setLoanId(e.target.value); setPage(0); }} style={{ minWidth: 200 }}>
            {loans.map(l => <option key={l.id} value={l.id}>{l.bank} — {fmt(l.amount)}</option>)}
          </Select>
        )}
        <div>
          <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 600, marginBottom: 4 }}>Extra monthly (R)</label>
          <input
            type="number"
            value={extra || ''}
            onChange={e => { setExtra(parseFloat(e.target.value) || 0); setPage(0); }}
            placeholder="0"
            style={{ padding: '10px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)', width: 130 }}
          />
        </div>
        <Button variant="ghost" size="sm" onClick={exportCSV}>Export CSV</Button>
      </div>

      {/* Summary */}
      {extra > 0 && interestSaved > 0 && (
        <div style={{ background: 'rgba(30,58,95,0.10)', border: '1px solid rgba(30,58,95,0.25)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-4)', marginBottom: 'var(--space-5)' }}>
          <strong style={{ color: 'var(--mint)' }}>
            Paying {fmt(extra)} extra / month saves you {fmt(interestSaved)} in interest
            {monthsSaved > 0 ? ` and pays off ${Math.round(monthsSaved / 12)} years earlier.` : '.'}
          </strong>
        </div>
      )}

      <Card>
        <CardHeader>
          Amortisation Schedule — {loan.bank}
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
            {schedule.length} months ({(schedule.length / 12).toFixed(1)} yrs)
          </span>
        </CardHeader>
        <div style={{ overflowX: 'auto' }}>
          <table className="data-table">
            <thead>
              <tr>
                <th>Month</th>
                <th style={{ textAlign: 'right' }}>Payment</th>
                <th style={{ textAlign: 'right' }}>Principal</th>
                <th style={{ textAlign: 'right' }}>Interest</th>
                <th style={{ textAlign: 'right' }}>Balance</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map(r => (
                <tr key={r.month}>
                  <td>{r.month}</td>
                  <td style={{ textAlign: 'right' }}>{fmt(r.payment)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--mint)' }}>{fmt(r.principal)}</td>
                  <td style={{ textAlign: 'right', color: 'var(--orange)' }}>{fmt(r.interest)}</td>
                  <td style={{ textAlign: 'right', fontWeight: 600 }}>{fmt(r.balance)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {totalPages > 1 && (
          <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-4)' }}>
            <Button variant="ghost" size="sm" disabled={page === 0} onClick={() => setPage(p => p - 1)}>← Prev</Button>
            <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Page {page + 1} of {totalPages}</span>
            <Button variant="ghost" size="sm" disabled={page >= totalPages - 1} onClick={() => setPage(p => p + 1)}>Next →</Button>
          </div>
        )}
      </Card>

      <div style={{ marginTop: 'var(--space-4)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        Total interest: <strong>{fmt(totalInterest)}</strong> over {(schedule.length / 12).toFixed(1)} years at {fmtPct(loan.rate)}.
      </div>
    </div>
  );
}
