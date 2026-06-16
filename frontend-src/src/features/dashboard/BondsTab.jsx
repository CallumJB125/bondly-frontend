import { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { Home, CheckCircle } from 'lucide-react';
import { EmptyState } from '../../components/EmptyState.jsx';
import { loans as loansApi, deeds as deedsApi, documents as docsApi, swaps as swapsApi } from '../../lib/api.js';
import { useToast } from '../../components/Toast.jsx';
import { fmt, fmtPct } from '../../lib/format.js';
import { PRIME_RATE, BANKS } from '../../lib/constants.js';
import { calcEquityForecast, calcSwapSavings } from '../../lib/finance.js';
import { usePrimeRate } from '../../lib/usePrimeRate.js';
import Button from '../../components/Button.jsx';
import Card, { CardHeader, CardBody } from '../../components/Card.jsx';
import Input, { Select, CurrencyInput } from '../../components/Input.jsx';
import Modal from '../../components/Modal.jsx';

const EMPTY = { bank: 'ABSA', amount: '', rate: String(PRIME_RATE), term: '20', purchasePrice: '', startDate: '' };


function SwitchSavingsTracker({ swap }) {
  if (!swap) return null;
  const acceptedOffer = (swap.offers || []).find(o => o.status === 'accepted');
  const monthlySaving = swap.monthlySaving || 0;
  if (monthlySaving <= 0) return null;

  const completedDate = new Date(swap.updatedAt || swap.createdAt);
  const monthsElapsed = Math.max(0, Math.floor((Date.now() - completedDate) / (1000 * 60 * 60 * 24 * 30.44)));
  const totalSaved = Math.round(monthsElapsed * monthlySaving);

  return (
    <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-4)', background: 'rgba(108,187,167,0.1)', border: '1.5px solid var(--mint)', borderRadius: 'var(--border-radius)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <CheckCircle size={20} color="var(--mint)" />
        <span style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--mint)' }}>Bond switch complete!</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{swap.currentBank} → {swap.targetBank}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 'var(--space-4)' }}>
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Monthly saving</div>
          <div style={{ fontWeight: 700, color: 'var(--mint)', fontSize: '1.1rem' }}>{fmt(monthlySaving)}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>per month</div>
        </div>
        {acceptedOffer?.rate && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>New rate</div>
            <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{fmtPct(acceptedOffer.rate)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>per annum</div>
          </div>
        )}
        <div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Months saving</div>
          <div style={{ fontWeight: 700, fontSize: '1.1rem' }}>{monthsElapsed || '< 1'}</div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>months</div>
        </div>
        {totalSaved > 0 && (
          <div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Total saved</div>
            <div style={{ fontWeight: 700, color: 'var(--mint)', fontSize: '1.1rem' }}>{fmt(totalSaved)}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>since switch</div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function BondsTab({ loans, payments, onRefresh }) {
  const primeRate = usePrimeRate();
  const [showAdd, setShowAdd] = useState(false);
  const [editId, setEditId]   = useState(null);
  const [form, setForm]       = useState(EMPTY);
  const [loading, setLoading]         = useState(false);
  const [syncId, setSyncId]           = useState(null);
  const [readinessId, setReadinessId] = useState(null);
  const [readinessData, setReadinessData] = useState({});
  const [completedSwaps, setCompletedSwaps] = useState([]);
  const [scanning, setScanning]           = useState(false);
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
  const scanRef = useRef(null);
  const showToast = useToast();

  useEffect(() => {
    swapsApi.list().then(all => {
      setCompletedSwaps((all || []).filter(s => s.status === 'completed' || s.conveyancingStage === 'complete'));
    }).catch(() => {});
  }, []);

  async function fetchReadiness(loanId) {
    try {
      const data = await loansApi.readiness(loanId);
      setReadinessData(d => ({ ...d, [loanId]: data }));
    } catch (err) {
      showToast(err.message || 'Could not load readiness data', 'error');
      setReadinessId(null);
    }
  }

  function toggleReadiness(loanId) {
    if (readinessId === loanId) { setReadinessId(null); return; }
    setReadinessId(loanId);
    if (!readinessData[loanId]) fetchReadiness(loanId);
  }

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  function startEdit(loan) {
    setForm({
      bank:          loan.bank || 'ABSA',
      amount:        String(loan.amount),
      rate:          String(loan.rate),
      term:          String(loan.term),
      purchasePrice: String(loan.purchasePrice || ''),
      startDate:     loan.startDate || '',
    });
    setEditId(loan.id);
    setShowAdd(false);
  }

  function cancelForm() { setShowAdd(false); setEditId(null); setForm(EMPTY); }

  async function save() {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showToast('Enter a valid bond amount', 'error'); return;
    }
    setLoading(true);
    try {
      const payload = {
        bank:          form.bank,
        amount:        parseFloat(form.amount),
        rate:          parseFloat(form.rate) || PRIME_RATE,
        term:          parseInt(form.term)   || 20,
        purchasePrice: parseFloat(form.purchasePrice) || undefined,
        startDate:     form.startDate || undefined,
      };
      if (editId) {
        await loansApi.update(editId, payload);
        showToast('Bond updated', 'success');
      } else {
        await loansApi.create(payload);
        showToast('Bond added', 'success');
      }
      cancelForm();
      onRefresh();
      if (!editId) try { sessionStorage.removeItem('bondly_hook_context'); } catch {/* ok */}
    } catch (err) {
      showToast(err.message || 'Could not save bond', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function remove(id) {
    if (pendingRemoveId !== id) { setPendingRemoveId(id); return; }
    setPendingRemoveId(null);
    try {
      await loansApi.remove(id);
      showToast('Bond removed', 'success');
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Could not remove bond', 'error');
    }
  }

  async function scanStatement(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('File must be under 10MB', 'error'); return; }
    setScanning(true);
    try {
      const fd = new FormData();
      fd.append('statement', file);
      const res = await fetch('/api/loans/scan-statement', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + localStorage.getItem('bondly_token') },
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Could not read statement');
      setForm(f => ({
        ...f,
        bank:   data.bank || f.bank,
        amount: data.balance ? String(Math.round(data.balance)) : f.amount,
        rate:   data.rate   ? String(data.rate)   : f.rate,
        purchasePrice: data.originalAmount ? String(Math.round(data.originalAmount)) : f.purchasePrice,
      }));
      showToast(`Scanned — ${data.bank || 'bank'} bond, R ${Math.round(data.balance || 0).toLocaleString()} balance${data.rate ? `, ${data.rate}% rate` : ''}`, 'success');
    } catch (err) {
      showToast(err.message || 'Could not read statement', 'error');
    } finally {
      setScanning(false);
    }
  }

  const BondFormContent = (
    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
      {/* Scan bond statement shortcut */}
      <input ref={scanRef} type="file" accept=".pdf" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) scanStatement(e.target.files[0]); e.target.value = ''; }} />
      <button
        type="button"
        onClick={() => scanRef.current?.click()}
        disabled={scanning}
        style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 16px', background: 'rgba(30,58,95,0.07)', border: '1.5px dashed rgba(30,58,95,0.4)', borderRadius: 'var(--border-radius-sm)', cursor: scanning ? 'wait' : 'pointer', fontSize: '0.875rem', color: 'var(--mint)', fontWeight: 600, width: '100%', justifyContent: 'center' }}
      >
        {scanning
          ? <><span style={{ width: 14, height: 14, border: '2px solid var(--mint)', borderTopColor: 'transparent', borderRadius: '50%', display: 'inline-block', animation: 'spin 0.7s linear infinite' }} /> Reading statement…</>
          : <><svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg> Scan bond statement PDF — auto-fill</>
        }
      </button>
      <Select label="Bank" id="bfBank" value={form.bank} onChange={set('bank')}>
        {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
      </Select>
      <CurrencyInput label="Outstanding balance (R)" id="bfAmount" value={form.amount} onChange={set('amount')} placeholder="1 200 000" autoFocus />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Input label="Rate (%)" id="bfRate" type="number" value={form.rate} onChange={set('rate')} placeholder={String(PRIME_RATE)} step="0.25" min="5" max="30" />
        <Input label="Term (years)" id="bfTerm" type="number" value={form.term} onChange={set('term')} placeholder="20" min="1" max="30" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Input label="Bond start date" id="bfStart" type="date" value={form.startDate.length === 7 ? form.startDate + '-01' : form.startDate} onChange={e => setForm(f => ({ ...f, startDate: e.target.value.slice(0, 7) }))} />
        <CurrencyInput label="Purchase price (R, optional)" id="bfPrice" value={form.purchasePrice} onChange={set('purchasePrice')} placeholder="For equity tracking" />
      </div>
      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
        Start date lets us calculate how much you've paid off and how long remains.
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
        <Button variant="lime" onClick={save} loading={loading}>Save bond</Button>
        <Button variant="ghost" onClick={cancelForm}>Cancel</Button>
      </div>
    </div>
  );

  return (
    <div className="fade-in">
      {/* Modal for add / edit bond */}
      {(showAdd || editId) && (
        <Modal title={editId ? 'Edit Bond' : 'Add Bond'} onClose={cancelForm}>
          {BondFormContent}
        </Modal>
      )}

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>My Bonds ({loans.length})</h3>
        {!showAdd && !editId && (
          <Button variant="lime" size="sm" onClick={() => { setShowAdd(true); setEditId(null); setForm(EMPTY); }}>
            + Add bond
          </Button>
        )}
      </div>

      {loans.length === 0 && !showAdd && (
        <EmptyState
          icon="🏠"
          title="No bonds added yet"
          body="Add your bond details to unlock your amortisation schedule, equity tracker, and rate comparison."
          action={<Button variant="lime" size="sm" onClick={() => { setShowAdd(true); setEditId(null); setForm(EMPTY); }}>+ Add my bond</Button>}
        />
      )}

      {loans.map(loan => {
        const loanPmts   = payments.filter(p => p.loanId === loan.id);
        const totalPaid  = loanPmts.reduce((s, p) => s + (p.amount || 0), 0);

        return (
          <Card key={loan.id} style={{ marginBottom: 'var(--space-5)' }}>
            <CardHeader>
              <div>
                <strong>{loan.bank}</strong>
                <span style={{ marginLeft: 'var(--space-3)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                  {fmtPct(loan.rate)} · {loan.term} yr original term
                </span>
                {loan.address && loan.address !== 'My Property' && (
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>{loan.address}</div>
                )}
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap', justifyContent: 'flex-end' }}>
                <ConfidenceBadge score={loan.dataConfidence} onClick={() => toggleReadiness(loan.id)} />
                <Button variant="ghost" size="sm" onClick={() => setSyncId(syncId === loan.id ? null : loan.id)}>Sync balance</Button>
                <Button variant="ghost" size="sm" onClick={() => startEdit(loan)}>Edit</Button>
                {pendingRemoveId === loan.id ? (
                  <>
                    <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>Sure?</span>
                    <Button variant="danger" size="sm" onClick={() => remove(loan.id)}>Yes, remove</Button>
                    <Button variant="ghost" size="sm" onClick={() => setPendingRemoveId(null)}>Cancel</Button>
                  </>
                ) : (
                  <Button variant="danger" size="sm" onClick={() => remove(loan.id)}>Remove</Button>
                )}
              </div>
            </CardHeader>
            <CardBody>
              {/* Progress bar */}
              {loan.pctPaid != null && (
                <div style={{ marginBottom: 'var(--space-4)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 6 }}>
                    <span>{loan.pctPaid}% paid off</span>
                    {loan.payoffDate && <span>Projected payoff: {loan.payoffDate}</span>}
                  </div>
                  <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${loan.pctPaid}%`, background: 'var(--lime)', borderRadius: 4, transition: 'width 0.6s ease' }} />
                  </div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                    <span>{fmt(loan.originalAmount)} original</span>
                    <span>{fmt(loan.calculatedBalance ?? loan.amount)} remaining</span>
                  </div>
                </div>
              )}

              {/* Key stats grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
                <Stat label="Outstanding balance" val={fmt(loan.calculatedBalance ?? loan.amount)}
                  sub={loan.balanceSyncedAt ? `Synced ${loan.balanceSyncedAt.slice(0,10)}` : loan.startDate ? 'Calculated' : 'Manually entered'} />
                <Stat label="Monthly payment" val={fmt(loan.monthlyPayment)}
                  sub={loan.monthlyPayment ? `R ${(loan.currentInterestComponent || 0).toLocaleString('en-ZA')} interest + R ${(loan.currentPrincipalComponent || 0).toLocaleString('en-ZA')} principal` : null} />
                {loan.monthsRemaining > 0 && (
                  <Stat label="Months remaining" val={String(loan.monthsRemaining)}
                    sub={`${Math.floor(loan.monthsRemaining / 12)} yrs ${loan.monthsRemaining % 12} mo`} />
                )}
                {loan.principalPaid > 0 && (
                  <Stat label="Principal paid" val={fmt(loan.principalPaid)} sub="Since bond start" />
                )}
                {loan.interestPaid > 0 && (
                  <Stat label="Interest paid" val={fmt(loan.interestPaid)} sub="Since bond start" />
                )}
                {loan.equity != null && (
                  <Stat label="Equity" val={fmt(loan.equity)}
                    sub={`${loan.equityPct}% of purchase price`}
                    highlight={loan.equity > 0} />
                )}
                {loanPmts.length > 0 && (
                  <Stat label="Logged payments" val={fmt(totalPaid)} sub={`${loanPmts.length} payments`} />
                )}
              </div>

              {/* Interest vs Principal visual split */}
              {loan.currentInterestComponent > 0 && loan.currentPrincipalComponent > 0 && (() => {
                const total = loan.currentInterestComponent + loan.currentPrincipalComponent;
                const iPct  = Math.round(loan.currentInterestComponent / total * 100);
                const pPct  = 100 - iPct;
                return (
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 5 }}>
                      <span>Monthly payment breakdown</span>
                      <span>{fmtPct(loan.rate)} · {fmt(loan.monthlyPayment || loan.currentInterestComponent + loan.currentPrincipalComponent)}/mo</span>
                    </div>
                    <div style={{ display: 'flex', height: 10, borderRadius: 5, overflow: 'hidden' }}>
                      <div title={`Interest: ${fmt(loan.currentInterestComponent)} (${iPct}%)`} style={{ width: `${iPct}%`, background: '#e67e22', transition: 'width 0.6s' }} />
                      <div title={`Principal: ${fmt(loan.currentPrincipalComponent)} (${pPct}%)`} style={{ width: `${pPct}%`, background: 'var(--lime, #b8e04a)', transition: 'width 0.6s' }} />
                    </div>
                    <div style={{ display: 'flex', gap: 'var(--space-4)', marginTop: 5, fontSize: '0.75rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 10, background: '#e67e22', borderRadius: 2, display: 'inline-block' }} />
                        Interest {fmt(loan.currentInterestComponent)} ({iPct}%)
                      </span>
                      <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        <span style={{ width: 10, height: 10, background: 'var(--lime, #b8e04a)', borderRadius: 2, display: 'inline-block' }} />
                        Principal {fmt(loan.currentPrincipalComponent)} ({pPct}%)
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Equity Forecast — 3 scenarios over 10 years */}
              {loan.purchasePrice && loan.monthsElapsed != null && (() => {
                const forecast = calcEquityForecast(loan.purchasePrice, loan.originalAmount || loan.amount, loan.rate, loan.term, loan.monthsElapsed, 10);
                const years = [0, 2, 5, 10];
                return (
                  <div style={{ marginBottom: 'var(--space-4)' }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 'var(--space-3)' }}>Property equity forecast (10-year projection)</div>
                    <div style={{ overflowX: 'auto' }}>
                      <table className="data-table" style={{ fontSize: '0.8125rem' }}>
                        <thead>
                          <tr>
                            <th>Year</th>
                            <th style={{ textAlign: 'right' }}>Bond balance</th>
                            <th style={{ textAlign: 'right', color: '#e67e22' }}>Conservative (4%)</th>
                            <th style={{ textAlign: 'right', color: 'var(--text-secondary)' }}>Base (6.5%)</th>
                            <th style={{ textAlign: 'right', color: 'var(--mint)' }}>Optimistic (9%)</th>
                          </tr>
                        </thead>
                        <tbody>
                          {years.map(y => {
                            const c = forecast.conservative[y];
                            const b = forecast.base[y];
                            const o = forecast.optimistic[y];
                            return (
                              <tr key={y}>
                                <td>{y === 0 ? 'Now' : `+${y} yrs`}</td>
                                <td style={{ textAlign: 'right' }}>{fmt(c.balance)}</td>
                                <td style={{ textAlign: 'right', color: '#e67e22' }}>{fmt(c.equity)} <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>({c.equityPct}%)</span></td>
                                <td style={{ textAlign: 'right' }}>{fmt(b.equity)} <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>({b.equityPct}%)</span></td>
                                <td style={{ textAlign: 'right', color: 'var(--mint)' }}>{fmt(o.equity)} <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>({o.equityPct}%)</span></td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 'var(--space-2)' }}>
                      Estimates only · Assumes your current interest rate remains constant · Conservative 4% / Base 6.5% / Optimistic 9% annual property appreciation (SA historical range) · Actual growth varies significantly by location, property type, and market conditions.
                    </div>
                  </div>
                );
              })()}

              {/* Sync balance panel */}
              {syncId === loan.id && (
                <SyncBalancePanel loan={loan} onSynced={() => { setSyncId(null); onRefresh(); }} showToast={showToast} />
              )}

              {/* Readiness checklist */}
              {readinessId === loan.id && (
                <ReadinessChecklist
                  data={readinessData[loan.id]}
                  onDocUploaded={() => { fetchReadiness(loan.id); onRefresh(); }}
                  showToast={showToast}
                />
              )}

              {/* Rate health / switch opportunity */}
              {(() => {
                const completedSwap = completedSwaps.find(s => s.loanId === loan.id);
                if (completedSwap) return null; // already switched — tracker shows below
                const abovePrime = Math.round((loan.rate - primeRate) * 100) / 100;
                const potentialSaving = abovePrime > 0.1
                  ? Math.round(calcSwapSavings(loan.amount, loan.rate, primeRate, (loan.term || 20) * 12).monthlySaving)
                  : 0;
                if (potentialSaving > 100) {
                  return (
                    <div className="bond-rate-alert">
                      <div>
                        <div className="bond-rate-alert__text">
                          Paying {fmtPct(loan.rate)} — {fmtPct(abovePrime)} above prime
                        </div>
                        <div className="bond-rate-alert__saving">
                          Could save ~{fmt(potentialSaving)}/month by switching
                        </div>
                      </div>
                      <Link to="/optimize">
                        <Button variant="lime" size="sm">Switch &amp; save →</Button>
                      </Link>
                    </div>
                  );
                }
                if (abovePrime <= 0) {
                  return <div className="bond-rate-healthy">✓ At or below prime — competitive rate</div>;
                }
                return (
                  <div className="bond-rate-healthy" style={{ color: 'var(--text-secondary)' }}>
                    Rate: {fmtPct(loan.rate)} · {fmtPct(abovePrime)} above prime
                    {' · '}<Link to="/optimize" style={{ color: 'var(--mint)' }}>Check if we can do better →</Link>
                  </div>
                );
              })()}

              {/* Post-switch savings tracker */}
              <SwitchSavingsTracker
                swap={completedSwaps.find(s => s.loanId === loan.id)}
              />
            </CardBody>
          </Card>
        );
      })}

      {/* Deeds Office lookup — hidden until live Windeed API is connected */}
      {/* <DeedsLookup onImport={onRefresh} /> */}
    </div>
  );
}

function Stat({ label, val, sub, highlight }) {
  return (
    <div>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
      <div style={{ fontWeight: 700, color: highlight ? 'var(--lime)' : 'var(--text-primary)' }}>{val}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SyncBalancePanel({ loan, onSynced, showToast }) {
  const [mode, setMode]       = useState('amount'); // 'amount' | 'paste'
  const [balance, setBalance] = useState('');
  const [text, setText]       = useState('');
  const [loading, setLoading] = useState(false);

  async function sync() {
    setLoading(true);
    try {
      const payload = mode === 'amount'
        ? { currentBalance: parseFloat(balance) }
        : { statementText: text };
      await loansApi.sync(loan.id, payload);
      showToast('Balance updated', 'success');
      onSynced();
    } catch (err) {
      showToast(err.message || 'Could not sync balance', 'error');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ background: 'var(--bg-card-alt, rgba(0,0,0,0.08))', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-4)', marginTop: 'var(--space-3)' }}>
      <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>Sync outstanding balance</div>
      <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <button onClick={() => setMode('amount')} style={{ background: mode === 'amount' ? 'var(--lime)' : 'transparent', color: mode === 'amount' ? 'var(--forest)' : 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Enter amount</button>
        <button onClick={() => setMode('paste')} style={{ background: mode === 'paste' ? 'var(--lime)' : 'transparent', color: mode === 'paste' ? 'var(--forest)' : 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '4px 12px', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 600 }}>Paste statement</button>
      </div>
      {mode === 'amount' ? (
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Current outstanding balance (R)</label>
            <input type="number" value={balance} onChange={e => setBalance(e.target.value)} placeholder="e.g. 1150000" style={{ width: '100%', padding: 'var(--space-3)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '1rem' }} />
          </div>
          <Button variant="lime" onClick={sync} loading={loading} disabled={!balance}>Update</Button>
        </div>
      ) : (
        <div>
          <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Paste text from your bank statement — we'll extract the balance automatically</label>
          <textarea value={text} onChange={e => setText(e.target.value)} rows={5} placeholder={'Paste your bond statement text here...\ne.g. "Capital outstanding: R 1 150 000.00"'} style={{ width: '100%', padding: 'var(--space-3)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'monospace' }} />
          <Button variant="lime" onClick={sync} loading={loading} disabled={!text} style={{ marginTop: 'var(--space-3)' }}>Extract & sync</Button>
        </div>
      )}
    </div>
  );
}

// ── Confidence badge ──────────────────────────────────────────────────────────
function ConfidenceBadge({ score, onClick }) {
  if (score == null) return null;
  const color = score >= 80 ? '#16a34a' : score >= 60 ? '#d97706' : '#dc2626';
  const label = score >= 80 ? 'High confidence' : score >= 60 ? 'Partial' : 'Needs docs';
  return (
    <button onClick={onClick} title="Click to view data verification checklist" style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'transparent', border: `1px solid ${color}`, borderRadius: 20, padding: '3px 10px', cursor: 'pointer', color, fontSize: '0.75rem', fontWeight: 700 }}>
      <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, display: 'inline-block' }} />
      {score}% {label}
    </button>
  );
}

// ── Readiness checklist ───────────────────────────────────────────────────────
const STATUS_ICON = { verified: '✓', partial: '◐', missing: '○', unverified: '○' };
const STATUS_COLOR = { verified: '#16a34a', partial: '#d97706', missing: '#dc2626', unverified: '#dc2626' };

const DOC_LABELS = {
  id:              'SA ID or passport (front page)',
  payslip:         'Payslip',
  bank_statement:  'Bank statement',
  bond_statement:  'Bond / mortgage statement',
  residence:       'Proof of address (covered by your bank statement)',
};

function ReadinessChecklist({ data, onDocUploaded, showToast }) {
  const fileRefs = useRef({});
  const [uploading, setUploading] = useState({});

  async function handleUpload(category, file) {
    setUploading(u => ({ ...u, [category]: true }));
    try {
      await docsApi.upload(file, category, `${DOC_LABELS[category] || category} — ${file.name}`);
      showToast('Document uploaded', 'success');
      onDocUploaded();
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    } finally {
      setUploading(u => ({ ...u, [category]: false }));
    }
  }

  if (!data) {
    return <div style={{ padding: 'var(--space-4)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading verification status…</div>;
  }

  return (
    <div style={{ marginTop: 'var(--space-4)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-4)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-3)' }}>
        <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>Data verification checklist</span>
        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          {data.dataConfidence}% complete{data.readyToSubmit ? ' — ready to submit' : data.ready ? ' — warn banks of gaps' : ' — not ready'}
        </span>
      </div>

      {/* Score bar */}
      <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden', marginBottom: 'var(--space-4)' }}>
        <div style={{ height: '100%', width: `${data.dataConfidence}%`, background: data.dataConfidence >= 80 ? '#16a34a' : data.dataConfidence >= 60 ? '#d97706' : '#dc2626', transition: 'width 0.4s ease', borderRadius: 3 }} />
      </div>

      <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
        {data.checks?.map(check => (
          <div key={check.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-card-alt, rgba(0,0,0,0.05))', borderRadius: 'var(--border-radius-sm)', borderLeft: `3px solid ${STATUS_COLOR[check.status]}` }}>
            <span style={{ color: STATUS_COLOR[check.status], fontWeight: 700, fontSize: '1rem', marginTop: 1, flexShrink: 0 }}>{STATUS_ICON[check.status]}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                {check.label}
                {check.required && <span style={{ marginLeft: 6, fontSize: '0.7rem', color: '#dc2626', fontWeight: 700 }}>REQUIRED</span>}
              </div>
              {check.status !== 'verified' && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {check.status === 'partial'
                    ? `${check.docCount} uploaded — ${(check.minDocs ?? check.docCount + 1) - check.docCount} more needed`
                    : check.hint}
                </div>
              )}
              {check.status === 'verified' && (
                <div style={{ fontSize: '0.8125rem', color: '#16a34a', marginTop: 2 }}>
                  {check.key === 'bond_balance' ? 'Verified from statement or Deeds Office' : `${check.docCount} document${check.docCount > 1 ? 's' : ''} on file`}
                </div>
              )}
            </div>
            {/* Upload button for doc-based checks that aren't fully verified */}
            {check.category && check.status !== 'verified' && (
              <div>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  style={{ display: 'none' }}
                  ref={el => fileRefs.current[check.category] = el}
                  onChange={e => { if (e.target.files[0]) handleUpload(check.category, e.target.files[0]); e.target.value = ''; }}
                />
                <Button
                  variant="lime"
                  size="sm"
                  loading={uploading[check.category]}
                  onClick={() => fileRefs.current[check.category]?.click()}
                >
                  Upload
                </Button>
              </div>
            )}
          </div>
        ))}
      </div>

      {!data.ready && (
        <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.2)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
          Banks require all the above documents to process a bond swap. Incomplete applications are likely to be delayed or declined.
        </div>
      )}
    </div>
  );
}

function DeedsLookup({ onImport }) {
  const [idNumber, setIdNumber]     = useState('');
  const [result, setResult]         = useState(null);
  const [loading, setLoading]       = useState(false);
  const [importing, setImporting]   = useState(false);
  const [selected, setSelected]     = useState([]);
  const [error, setError]           = useState('');
  const showToast = useToast();

  async function lookup() {
    if (idNumber.replace(/\s/g,'').length !== 13) { setError('Enter a valid 13-digit SA ID number'); return; }
    setLoading(true); setError(''); setResult(null); setSelected([]);
    try {
      const data = await deedsApi.lookup(idNumber.replace(/\s/g,''));
      setResult(data);
      if (!data.bonds?.length) setError('No bonds found for this ID number. You may need to add your bond manually.');
    } catch(e) {
      setError(e.message || 'Deeds lookup failed');
    } finally {
      setLoading(false);
    }
  }

  async function importSelected() {
    if (!selected.length) return;
    setImporting(true);
    try {
      await deedsApi.import(selected);
      showToast(`${selected.length} bond${selected.length > 1 ? 's' : ''} imported from Deeds Office`, 'success');
      setResult(null); setSelected([]);
      onImport?.();
    } catch(e) {
      showToast(e.message || 'Import failed', 'error');
    } finally {
      setImporting(false);
    }
  }

  function toggleBond(bond) {
    setSelected(s => s.find(b => b.bondNumber === bond.bondNumber) ? s.filter(b => b.bondNumber !== bond.bondNumber) : [...s, bond]);
  }

  return (
    <Card style={{ marginTop: 'var(--space-6)' }}>
      <CardHeader>Find my property — Deeds Office</CardHeader>
      <CardBody>
        <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
          Enter your SA ID number to automatically find your registered property bonds from the Deeds Office.
          {' (In demo mode — Bondly will enable live Deeds lookups for verified accounts.)'}
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end', marginBottom: 'var(--space-3)' }}>
          <div style={{ flex: 1 }}>
            <label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>SA ID number (13 digits)</label>
            <input
              type="text"
              inputMode="numeric"
              maxLength={13}
              placeholder="0000000000000"
              value={idNumber}
              onChange={e => setIdNumber(e.target.value.replace(/\D/g,''))}
              style={{ width: '100%', padding: 'var(--space-3)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '1rem', letterSpacing: '0.05em' }}
            />
          </div>
          <Button variant="forest" onClick={lookup} loading={loading}>Search Deeds Office</Button>
        </div>
        {error && <div style={{ fontSize: '0.875rem', color: '#dc2626', marginBottom: 'var(--space-3)' }}>{error}</div>}

        {result?.bonds?.length > 0 && (
          <div className="deeds-results fade-in">
            {result.source === 'demo' && (
              <div style={{ background: 'rgba(var(--lime-rgb,120,185,80),0.12)', border: '1px solid rgba(120,185,80,0.35)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-3) var(--space-4)', marginBottom: 'var(--space-3)', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                <strong style={{ color: 'var(--text-primary)' }}>Demo data</strong> — these are realistic sample bonds generated from your ID number for testing purposes. Connect a Windeed API key in production to retrieve your actual registered bonds from the Deeds Office.
              </div>
            )}
            <div style={{ fontWeight: 600, marginBottom: 'var(--space-3)' }}>
              {result.bonds.length} bond{result.bonds.length > 1 ? 's' : ''} found — select which to import:
            </div>
            {result.bonds.map((bond, i) => {
              const isSelected = !!selected.find(b => b.bondNumber === bond.bondNumber);
              return (
                <div key={i} className={`deeds-bond-row ${isSelected ? 'deeds-bond-row--selected' : ''}`} onClick={() => toggleBond(bond)}>
                  <div className="deeds-bond-row__check">{isSelected ? '✓' : '○'}</div>
                  <div className="deeds-bond-row__info">
                    <div style={{ fontWeight: 600 }}>{bond.propertyAddress || bond.address || 'Property address'}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                      {bond.bank} · R {(bond.bondAmount || bond.amount || 0).toLocaleString('en-ZA')} outstanding · {bond.rate}% · {bond.monthsRemaining} months remaining
                      {bond.registrationDate && ` · Registered ${bond.registrationDate.slice(0,7)}`}
                    </div>
                  </div>
                </div>
              );
            })}
            <div style={{ marginTop: 'var(--space-4)' }}>
              <Button variant="lime" onClick={importSelected} loading={importing} disabled={!selected.length}>
                Import {selected.length || ''} bond{selected.length !== 1 ? 's' : ''} to my dashboard
              </Button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
