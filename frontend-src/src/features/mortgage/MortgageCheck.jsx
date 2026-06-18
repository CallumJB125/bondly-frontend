import { useState, useRef, useMemo } from 'react';
import { Link } from 'react-router-dom';
import { Upload, TrendingDown, AlertTriangle, CheckCircle, Info, ChevronRight } from 'lucide-react';
import { fmt } from '@bondly/ui/lib/format.js';
import { scanMortgageStatement } from '../../lib/api.js';
import { PRIME_RATE } from '@bondly/ui/lib/constants.js';
import './MortgageCheck.css';

// ── Constants ────────────────────────────────────────────────────────────────
const PRIME = PRIME_RATE;
const BANKS = ['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'Investec', 'SA Home Loans', 'Other'];

// ── Financial math ────────────────────────────────────────────────────────────
function remainingMonths(balance, annualRate, payment) {
  const r = annualRate / 100 / 12;
  if (r <= 0 || payment <= 0) return null;
  if (payment <= balance * r) return null; // payment doesn't cover interest
  const n = -Math.log(1 - (balance * r) / payment) / Math.log(1 + r);
  return isFinite(n) && n > 0 ? Math.round(n) : null;
}

function monthlyPaymentFor(balance, annualRate, termMonths) {
  const r = annualRate / 100 / 12;
  if (r === 0 || termMonths <= 0) return balance / Math.max(1, termMonths);
  return balance * r * Math.pow(1 + r, termMonths) / (Math.pow(1 + r, termMonths) - 1);
}

function totalInterest(balance, annualRate, payment) {
  const months = remainingMonths(balance, annualRate, payment);
  if (!months) return null;
  return Math.max(0, months * payment - balance);
}

function switchingCost(balance) {
  // Rough SA bond registration + attorney + cancellation cost estimate by balance band
  if (balance < 500000) return 18000;
  if (balance < 1000000) return 23000;
  if (balance < 1500000) return 28000;
  if (balance < 2000000) return 33000;
  if (balance < 3000000) return 38000;
  return 44000;
}

function fmtMonths(months) {
  if (!months) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
  return `${y} yr ${m} mo`;
}

// ── Rate position helper ──────────────────────────────────────────────────────
function ratePosition(rate) {
  const diff = rate - PRIME;
  if (diff > 1.0) return { label: `Prime + ${diff.toFixed(2)}%`, grade: 'poor',    color: '#ef4444', tip: 'Well above prime — significant room to save by switching.' };
  if (diff > 0.5) return { label: `Prime + ${diff.toFixed(2)}%`, grade: 'fair',    color: '#f97316', tip: 'Above prime — a targeted switch could save you thousands.' };
  if (diff > 0)   return { label: `Prime + ${diff.toFixed(2)}%`, grade: 'average', color: '#eab308', tip: 'Slightly above prime — competitive banks may offer you better.' };
  if (diff === 0) return { label: 'Prime',                        grade: 'good',    color: '#22c55e', tip: 'At prime — solid rate. Bondly can check if you can do better.' };
  return { label: `Prime − ${Math.abs(diff).toFixed(2)}%`,       grade: 'great',   color: '#16a34a', tip: 'Below prime — well negotiated. Switching likely not worth it unless you want equity release.' };
}

// ── Scenario table ────────────────────────────────────────────────────────────
const SCENARIOS = [
  { label: 'Prime + 0.5%', rate: PRIME + 0.5  },
  { label: 'Prime',        rate: PRIME        },
  { label: 'Prime − 0.25%',rate: PRIME - 0.25 },
  { label: 'Prime − 0.5%', rate: PRIME - 0.5  },
  { label: 'Prime − 0.75%',rate: PRIME - 0.75 },
  { label: 'Prime − 1%',   rate: PRIME - 1.0  },
];

// ── Upload dropzone ───────────────────────────────────────────────────────────
function DropZone({ onFile, scanning }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);

  function handleFiles(files) {
    const f = files[0];
    if (f && f.type === 'application/pdf') onFile(f);
    else if (f && f.name.toLowerCase().endsWith('.pdf')) onFile(f);
  }

  return (
    <div
      className={`mort-dropzone${over ? ' mort-dropzone--over' : ''}${scanning ? ' mort-dropzone--scanning' : ''}`}
      onClick={() => !scanning && ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={e => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
    >
      <input ref={ref} type="file" accept=".pdf,application/pdf" style={{ display: 'none' }} onChange={e => handleFiles(e.target.files)} />
      {scanning ? (
        <>
          <div className="mort-dropzone__spinner" />
          <strong>Reading your statement…</strong>
          <span>Claude AI is extracting your loan details</span>
        </>
      ) : (
        <>
          <Upload size={28} className="mort-dropzone__icon" />
          <strong>Upload home loan statement</strong>
          <span>PDF only · your statement is not stored</span>
          <div className="mort-dropzone__btn">Browse files</div>
        </>
      )}
    </div>
  );
}

// ── Results ───────────────────────────────────────────────────────────────────
function Results({ data }) {
  const { balance, rate, installment, originalAmount, propertyValue } = data;
  const pos = ratePosition(rate);
  const months = remainingMonths(balance, rate, installment);
  const totalInt = totalInterest(balance, rate, installment);
  const switchCost = switchingCost(balance);
  const equity = propertyValue > 0 ? propertyValue - balance : null;
  const equityPct = equity !== null ? Math.round((equity / propertyValue) * 100) : null;

  const scenarios = useMemo(() => {
    return SCENARIOS
      .filter(s => s.rate < rate)
      .map(s => {
        const newPayment = months ? monthlyPaymentFor(balance, s.rate, months) : null;
        const monthlySave = newPayment ? Math.round(installment - newPayment) : null;
        const lifetimeSave = (monthlySave && months) ? Math.round(monthlySave * months) : null;
        const paybackMonths = (monthlySave && monthlySave > 0) ? Math.ceil(switchCost / monthlySave) : null;
        return { ...s, newPayment, monthlySave, lifetimeSave, paybackMonths };
      })
      .filter(s => s.monthlySave > 0)
      .slice(-4); // show up to 4 scenarios
  }, [balance, rate, installment, months, switchCost]);

  const loanProgress = originalAmount > 0 ? Math.round((1 - balance / originalAmount) * 100) : null;

  return (
    <div className="mort-results fade-in">

      {/* ── Rate health card ── */}
      <div className={`mort-rate-card mort-rate-card--${pos.grade}`}>
        <div className="mort-rate-card__left">
          <div className="mort-rate-card__label">Your current rate</div>
          <div className="mort-rate-card__rate">{rate.toFixed(2)}%</div>
          <div className="mort-rate-card__pos" style={{ color: pos.color }}>{pos.label}</div>
        </div>
        <div className="mort-rate-card__right">
          <div className="mort-rate-card__prime">
            <span>Prime</span>
            <strong>{PRIME}%</strong>
          </div>
          <div className="mort-rate-card__tip">{pos.tip}</div>
        </div>
      </div>

      {/* ── Loan snapshot ── */}
      <div className="mort-snapshot">
        <div className="mort-snapshot__item">
          <div className="mort-snapshot__val">{fmt(balance)}</div>
          <div className="mort-snapshot__lbl">Outstanding balance</div>
        </div>
        <div className="mort-snapshot__item">
          <div className="mort-snapshot__val">{fmt(installment)}/mo</div>
          <div className="mort-snapshot__lbl">Monthly instalment</div>
        </div>
        {months && (
          <div className="mort-snapshot__item">
            <div className="mort-snapshot__val">{fmtMonths(months)}</div>
            <div className="mort-snapshot__lbl">Remaining term</div>
          </div>
        )}
        {totalInt !== null && (
          <div className="mort-snapshot__item">
            <div className="mort-snapshot__val">{fmt(Math.round(totalInt))}</div>
            <div className="mort-snapshot__lbl">Total interest remaining</div>
          </div>
        )}
        {loanProgress !== null && (
          <div className="mort-snapshot__item">
            <div className="mort-snapshot__val">{loanProgress}%</div>
            <div className="mort-snapshot__lbl">Loan paid off</div>
          </div>
        )}
        {equity !== null && (
          <div className="mort-snapshot__item">
            <div className="mort-snapshot__val">{fmt(equity)}</div>
            <div className="mort-snapshot__lbl">Equity ({equityPct}%)</div>
          </div>
        )}
      </div>

      {/* ── Switching savings table ── */}
      {scenarios.length > 0 && (
        <div className="mort-section">
          <h2 className="mort-section__title">What switching could save you</h2>
          <p className="mort-section__sub">
            Based on your current balance of {fmt(balance)} and {months ? fmtMonths(months) + ' remaining.' : 'your loan details.'}
          </p>
          <div className="mort-table-wrap">
            <table className="mort-table">
              <thead>
                <tr>
                  <th>Target rate</th>
                  <th>Monthly saving</th>
                  <th>Lifetime saving</th>
                  <th>Break-even</th>
                </tr>
              </thead>
              <tbody>
                {scenarios.map(s => (
                  <tr key={s.label} className={s.rate === PRIME - 0.5 ? 'mort-table__row--highlight' : ''}>
                    <td><strong>{s.label}</strong><br /><span className="mort-table__rate">{s.rate.toFixed(2)}%</span></td>
                    <td className="mort-table__save">{s.monthlySave ? `${fmt(s.monthlySave)}/mo` : '—'}</td>
                    <td className="mort-table__lifetime">{s.lifetimeSave ? fmt(s.lifetimeSave) : '—'}</td>
                    <td className="mort-table__payback">{s.paybackMonths ? fmtMonths(s.paybackMonths) : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mort-table__note">
            <Info size={12} /> Break-even includes estimated switching costs of {fmt(switchCost)} (bond registration + attorney fees). Savings are over your remaining term at today's balance.
          </p>
        </div>
      )}

      {/* ── Interest savings callout ── */}
      {scenarios.length > 0 && scenarios[scenarios.length - 1].lifetimeSave > 50000 && (
        <div className="mort-callout">
          <TrendingDown size={20} className="mort-callout__icon" />
          <div>
            <strong>You could save up to {fmt(scenarios[scenarios.length - 1].lifetimeSave)}</strong> over the life of your bond at{' '}
            {scenarios[scenarios.length - 1].label.toLowerCase()}. Bondly submits your application to all 7 major SA banks simultaneously — at no cost to you.
          </div>
        </div>
      )}

      {/* ── No savings scenarios ── */}
      {scenarios.length === 0 && pos.grade === 'great' && (
        <div className="mort-callout mort-callout--positive">
          <CheckCircle size={20} className="mort-callout__icon" />
          <div>
            <strong>Your rate is already excellent</strong> — you're below prime, which puts you ahead of most SA borrowers. Switching would likely cost more than you'd save unless you want to access equity or change loan terms.
          </div>
        </div>
      )}

      {/* ── CTA ── */}
      <div className="mort-cta">
        <h3>Want a better rate? Bondly shops all 7 banks for you.</h3>
        <p>We show you rate offers from ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec and SA Home Loans — so banks compete for your business. Free, no obligation, no impact to your credit score until you accept.</p>
        <div className="mort-cta__btns">
          <Link to="/preapproval" className="btn btn--lime">
            See if you qualify — free <ChevronRight size={15} style={{ verticalAlign: 'middle', marginLeft: 2 }} />
          </Link>
          <a href="/home#faq" className="btn btn--ghost">What does switching cost?</a>
        </div>
      </div>

    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MortgageCheck() {
  const fileRef = useRef(null);
  const [scanning, setScanning] = useState(false);
  const [scanError, setScanError] = useState('');
  const [scanSource, setScanSource] = useState(null);
  const [results, setResults] = useState(null);

  const [form, setForm] = useState({
    bank:           '',
    balance:        '',
    rate:           '',
    installment:    '',
    originalAmount: '',
    propertyValue:  '',
  });

  function set(key, val) { setForm(f => ({ ...f, [key]: val })); }

  async function handleUpload(file) {
    setScanError('');
    setScanning(true);
    try {
      const data = await scanMortgageStatement(file);
      if (!data.success && data.error) { setScanError(data.error); return; }
      setScanSource(data.source);
      if (data.bank)           set('bank',           data.bank);
      if (data.balance)        set('balance',        String(Math.round(data.balance)));
      if (data.rate)           set('rate',           String(data.rate));
      if (data.installment)    set('installment',    String(Math.round(data.installment)));
      if (data.originalAmount) set('originalAmount', String(Math.round(data.originalAmount)));
    } catch {
      setScanError('Something went wrong scanning your statement. Please enter details manually.');
    } finally {
      setScanning(false);
    }
  }

  function handleAnalyse() {
    const balance     = parseFloat(form.balance.replace(/[^0-9.]/g, ''));
    const rate        = parseFloat(form.rate.replace(/[^0-9.]/g, ''));
    const installment = parseFloat(form.installment.replace(/[^0-9.]/g, ''));

    if (!balance || balance < 10000)     { setScanError('Please enter your outstanding balance (minimum R10,000).'); return; }
    if (!rate || rate < 4 || rate > 30)  { setScanError('Please enter a valid interest rate between 4% and 30%.'); return; }
    if (!installment || installment < 500) { setScanError('Please enter your monthly instalment.'); return; }

    setScanError('');
    setResults({
      bank:           form.bank,
      balance,
      rate,
      installment,
      originalAmount: parseFloat(form.originalAmount.replace(/[^0-9.]/g, '')) || 0,
      propertyValue:  parseFloat(form.propertyValue.replace(/[^0-9.]/g, '')) || 0,
    });
  }

  return (
    <div className="page mort-page">
      <div className="container container--narrow">

        <div className="mort-header">
          <Link to="/tools/repayment-calculator" className="btn btn--ghost btn--sm">← Back to calculators</Link>
          <div className="mort-header__eyebrow">Mortgage Health Check</div>
          <h1 className="mort-header__title">Is your home loan rate working for you?</h1>
          <p className="mort-header__sub">
            Upload your home loan statement (or enter your details manually) to see your rate position, how much you could save by switching, and how much interest you have left to pay.
          </p>
        </div>

        {/* ── Input panel ── */}
        {!results && (
          <div className="mort-input-panel fade-in">
            <div className="mort-upload-wrap">
              <DropZone onFile={handleUpload} scanning={scanning} />
              {scanSource && (
                <div className="mort-scan-badge">
                  <CheckCircle size={13} /> Details extracted — review below and adjust if needed
                </div>
              )}
              {scanError && (
                <div className="mort-error">
                  <AlertTriangle size={14} /> {scanError}
                </div>
              )}
            </div>

            <div className="mort-divider"><span>or enter manually</span></div>

            <div className="mort-form">
              <div className="mort-form__row">
                <div className="mort-form__field">
                  <label className="mort-form__label">Bank</label>
                  <select className="mort-form__select" value={form.bank} onChange={e => set('bank', e.target.value)}>
                    <option value="">Select bank…</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div className="mort-form__field">
                  <label className="mort-form__label">Current interest rate (%)</label>
                  <div className="mort-form__input-wrap">
                    <input className="mort-form__input" type="number" step="0.01" min="4" max="30"
                      placeholder="e.g. 11.50" value={form.rate} onChange={e => set('rate', e.target.value)} />
                    <span className="mort-form__suffix">%</span>
                  </div>
                  <div className="mort-form__hint">Prime is currently {PRIME}%</div>
                </div>
              </div>

              <div className="mort-form__row">
                <div className="mort-form__field">
                  <label className="mort-form__label">Outstanding balance</label>
                  <div className="mort-form__input-wrap">
                    <span className="mort-form__prefix">R</span>
                    <input className="mort-form__input mort-form__input--prefixed" type="text" inputMode="numeric"
                      placeholder="e.g. 1 200 000" value={form.balance} onChange={e => set('balance', e.target.value)} />
                  </div>
                </div>
                <div className="mort-form__field">
                  <label className="mort-form__label">Monthly instalment</label>
                  <div className="mort-form__input-wrap">
                    <span className="mort-form__prefix">R</span>
                    <input className="mort-form__input mort-form__input--prefixed" type="text" inputMode="numeric"
                      placeholder="e.g. 13 500" value={form.installment} onChange={e => set('installment', e.target.value)} />
                  </div>
                </div>
              </div>

              <div className="mort-form__row">
                <div className="mort-form__field">
                  <label className="mort-form__label">Original loan amount <span className="mort-form__opt">(optional)</span></label>
                  <div className="mort-form__input-wrap">
                    <span className="mort-form__prefix">R</span>
                    <input className="mort-form__input mort-form__input--prefixed" type="text" inputMode="numeric"
                      placeholder="e.g. 1 500 000" value={form.originalAmount} onChange={e => set('originalAmount', e.target.value)} />
                  </div>
                  <div className="mort-form__hint">Enables % paid off calculation</div>
                </div>
                <div className="mort-form__field">
                  <label className="mort-form__label">Current property value <span className="mort-form__opt">(optional)</span></label>
                  <div className="mort-form__input-wrap">
                    <span className="mort-form__prefix">R</span>
                    <input className="mort-form__input mort-form__input--prefixed" type="text" inputMode="numeric"
                      placeholder="e.g. 2 000 000" value={form.propertyValue} onChange={e => set('propertyValue', e.target.value)} />
                  </div>
                  <div className="mort-form__hint">Enables equity calculation</div>
                </div>
              </div>

              {scanError && (
                <div className="mort-error">
                  <AlertTriangle size={14} /> {scanError}
                </div>
              )}

              <button className="btn btn--lime mort-form__submit" onClick={handleAnalyse}>
                Analyse my mortgage →
              </button>
            </div>
          </div>
        )}

        {/* ── Results ── */}
        {results && (
          <>
            <Results data={results} />
            <div style={{ textAlign: 'center', marginTop: 24 }}>
              <button className="btn btn--ghost btn--sm" onClick={() => { setResults(null); setScanSource(null); }}>
                ← Check another mortgage
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  );
}
