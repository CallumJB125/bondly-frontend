import { useState, useRef, useEffect } from 'react';
import { Upload, TrendingDown, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, Info, ChevronRight } from 'lucide-react';
import { scanMortgageStatement } from '../../lib/api.js';
import { fmt, fmtPct, fmtDate } from '@bondly/ui/lib/format.js';
import { calcAmortSchedule } from '@bondly/ui/lib/finance.js';
import { PRIME_RATE, BANKS, BANK_SPREADS } from '@bondly/ui/lib/constants.js';
import Card, { CardHeader, CardBody, StatCard } from '@bondly/ui/components/Card.jsx';
import Button from '@bondly/ui/components/Button.jsx';
import { useToast } from '@bondly/ui/components/Toast.jsx';
import './MortgageStatementTab.css';

function remainingMonths(balance, annualRate, payment) {
  const r = annualRate / 100 / 12;
  if (r <= 0 || payment <= 0) return null;
  if (payment <= balance * r) return null;
  const n = -Math.log(1 - (balance * r) / payment) / Math.log(1 + r);
  return isFinite(n) && n > 0 ? Math.round(n) : null;
}

function monthlyPaymentFor(balance, annualRate, termMonths) {
  const r = annualRate / 100 / 12;
  if (r === 0 || termMonths <= 0) return balance / Math.max(1, termMonths);
  return balance * r * Math.pow(1 + r, termMonths) / (Math.pow(1 + r, termMonths) - 1);
}

function fmtMonths(months) {
  if (!months) return null;
  const y = Math.floor(months / 12);
  const m = months % 12;
  if (y === 0) return `${m} month${m !== 1 ? 's' : ''}`;
  if (m === 0) return `${y} year${y !== 1 ? 's' : ''}`;
  return `${y} yr ${m} mo`;
}

const SCAN_MESSAGES = [
  'Reading your statement…',
  'Identifying transactions…',
  'Calculating loan details…',
  'Checking interest rate…',
  'Almost done…',
];

// ── Upload zone ───────────────────────────────────────────────────────────────
function UploadZone({ onFile, scanning }) {
  const ref = useRef(null);
  const [over, setOver] = useState(false);
  const [uploadError, setUploadError] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [msgIdx, setMsgIdx] = useState(0);

  useEffect(() => {
    if (!scanning) { setMsgIdx(0); return; }
    const t = setInterval(() => setMsgIdx(i => (i + 1) % SCAN_MESSAGES.length), 4000);
    return () => clearInterval(t);
  }, [scanning]);

  const MAX_MB = 10;
  function handleFiles(files) {
    const f = files[0];
    if (!f) return;
    if (f.size > MAX_MB * 1024 * 1024) {
      setUploadError(`File too large — ${(f.size / 1024 / 1024).toFixed(1)}MB (max ${MAX_MB}MB)`);
      return;
    }
    setUploadError(null);
    setSelectedFile(f);
    onFile(f);
  }

  if (scanning) {
    return (
      <div className="ms-upload ms-upload--scanning">
        <RefreshCw size={28} className="ms-spin" />
        <strong>{SCAN_MESSAGES[msgIdx]}</strong>
        {selectedFile && (
          <span className="ms-upload__selected">{selectedFile.name} · {(selectedFile.size / 1024 / 1024).toFixed(1)} MB</span>
        )}
        <span>Extracting loan details with AI</span>
      </div>
    );
  }

  return (
    <>
      <button
        type="button"
        className={`ms-upload${over ? ' ms-upload--over' : ''}`}
        onClick={() => ref.current?.click()}
        onDragOver={e => { e.preventDefault(); setOver(true); }}
        onDragLeave={() => setOver(false)}
        onDrop={e => { e.preventDefault(); setOver(false); handleFiles(e.dataTransfer.files); }}
      >
        <input ref={ref} type="file" accept=".pdf,.csv,application/pdf,text/csv" style={{ display: 'none' }}
          onChange={e => handleFiles(e.target.files)} />
        <Upload size={28} className="ms-upload__icon" />
        <strong>Upload your home loan statement</strong>
        <span>Tap to select a PDF or CSV · ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec, SA Home Loans</span>
        <div className="ms-upload__btn">Select file</div>
        <div className="ms-upload__privacy">Your statement is never stored — processed securely and discarded.</div>
      </button>
      {uploadError && <p className="ms-upload__error">{uploadError}</p>}
    </>
  );
}

// ── Impact simulator ──────────────────────────────────────────────────────────
function ImpactSimulator({ balance, rate, installment, termMonthsRemaining }) {
  const [extra, setExtra] = useState('');
  const extraVal = parseFloat(extra.replace(/[^0-9.]/g, '')) || 0;

  const months = termMonthsRemaining || remainingMonths(balance, rate, installment) || 240;

  const baseSchedule = calcAmortSchedule(balance, rate, months / 12, 0);
  const accelSchedule = extraVal > 0 ? calcAmortSchedule(balance, rate, months / 12, extraVal) : null;

  const baseTotalInterest   = baseSchedule.reduce((s, r) => s + r.interest, 0);
  const accelTotalInterest  = accelSchedule ? accelSchedule.reduce((s, r) => s + r.interest, 0) : null;
  const interestSaved       = accelTotalInterest !== null ? Math.max(0, baseTotalInterest - accelTotalInterest) : null;
  const monthsSaved         = accelSchedule ? Math.max(0, baseSchedule.length - accelSchedule.length) : null;

  const payoffDate = (m) => {
    const d = new Date();
    d.setMonth(d.getMonth() + m);
    return d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
  };

  return (
    <Card>
      <CardHeader>Impact Simulator</CardHeader>
      <CardBody>
        <p className="ms-sim__desc">
          What if you paid extra each month? Based on your current balance of <strong>{fmt(balance)}</strong> at <strong>{fmtPct(rate)}</strong>.
        </p>
        <div className="ms-sim__input-row">
          <div className="ms-sim__input-wrap">
            <span className="ms-sim__prefix">R</span>
            <input
              className="ms-sim__input"
              type="text"
              inputMode="numeric"
              placeholder="e.g. 1 000"
              value={extra}
              onChange={e => setExtra(e.target.value)}
            />
            <span className="ms-sim__suffix">/month extra</span>
          </div>
          {extra && (
            <button className="ms-sim__clear" onClick={() => setExtra('')}>✕</button>
          )}
        </div>

        {extraVal > 0 && interestSaved !== null ? (
          <div className="ms-sim__results fade-in">
            <div className="ms-sim__result ms-sim__result--good">
              <div className="ms-sim__result-val">{fmt(Math.round(interestSaved))}</div>
              <div className="ms-sim__result-lbl">Interest saved</div>
            </div>
            <div className="ms-sim__result ms-sim__result--good">
              <div className="ms-sim__result-val">{fmtMonths(monthsSaved)}</div>
              <div className="ms-sim__result-lbl">Paid off sooner</div>
            </div>
            <div className="ms-sim__result">
              <div className="ms-sim__result-val">{payoffDate(baseSchedule.length - (monthsSaved || 0))}</div>
              <div className="ms-sim__result-lbl">New payoff date</div>
            </div>
          </div>
        ) : (
          <div className="ms-sim__hint">
            <Info size={13} /> Enter an amount to see the impact on your total interest and payoff date.
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Refinancing opportunity ───────────────────────────────────────────────────
function RefinancingCard({ rate, balance, termMonthsRemaining, onTabChange }) {
  const bestRate = Math.min(...BANKS.map(b => PRIME_RATE + (BANK_SPREADS[b] || 0)));
  const diff = rate - bestRate;
  if (diff <= 0.5) return null;

  const months = termMonthsRemaining || 240;
  const currentMonthly = monthlyPaymentFor(balance, rate, months);
  const bestMonthly    = monthlyPaymentFor(balance, bestRate, months);
  const monthlySaving  = Math.round(currentMonthly - bestMonthly);
  const totalSaving    = Math.round(monthlySaving * months);

  return (
    <Card className="ms-refi-card">
      <CardHeader>
        <TrendingDown size={16} />
        <span>Refinancing Opportunity</span>
      </CardHeader>
      <CardBody>
        <div className="ms-refi-alert">
          <AlertTriangle size={18} className="ms-refi-alert__icon" />
          <div>
            <div className="ms-refi-alert__headline">
              You're paying <strong>{fmtPct(diff, 2)}</strong> above the best available rate
            </div>
            <div className="ms-refi-alert__sub">
              Your rate: <strong>{fmtPct(rate)}</strong> · Best available: <strong>{fmtPct(bestRate)}</strong>
            </div>
          </div>
        </div>
        <div className="ms-refi-savings">
          <div className="ms-refi-stat">
            <div className="ms-refi-stat__val">{fmt(monthlySaving)}/mo</div>
            <div className="ms-refi-stat__lbl">Monthly saving</div>
          </div>
          <div className="ms-refi-stat">
            <div className="ms-refi-stat__val">{fmt(totalSaving)}</div>
            <div className="ms-refi-stat__lbl">Over remaining term</div>
          </div>
        </div>
        <p className="ms-refi-note">
          <Info size={12} /> Savings are estimates based on current published rates. Actual rate depends on your credit profile and bond size.
        </p>
        <Button variant="lime" onClick={() => onTabChange('switch')}>
          See all bank rates → Switch &amp; Save
          <ChevronRight size={14} style={{ marginLeft: 4 }} />
        </Button>
      </CardBody>
    </Card>
  );
}

// ── Payment breakdown bar ─────────────────────────────────────────────────────
function PaymentBreakdown({ installment, principalLastPayment, interestLastPayment, balance, rate }) {
  let principal = principalLastPayment;
  let interest  = interestLastPayment;

  if ((!principal || !interest) && balance && rate && installment) {
    const r = rate / 100 / 12;
    interest  = Math.round(balance * r);
    principal = Math.round(Math.max(0, installment - interest));
  }

  if (!principal && !interest) return null;

  const total    = (principal || 0) + (interest || 0);
  const princPct = total > 0 ? Math.round((principal / total) * 100) : 0;
  const intPct   = 100 - princPct;

  return (
    <Card>
      <CardHeader>This Month's Payment Breakdown</CardHeader>
      <CardBody>
        <div className="ms-breakdown__bar-wrap">
          <div className="ms-breakdown__bar">
            <div className="ms-breakdown__principal" style={{ width: `${princPct}%` }} title={`Principal: ${fmt(principal)}`} />
            <div className="ms-breakdown__interest" style={{ width: `${intPct}%` }} title={`Interest: ${fmt(interest)}`} />
          </div>
          <div className="ms-breakdown__legend">
            <div className="ms-breakdown__legend-item ms-breakdown__legend-item--principal">
              <span className="ms-breakdown__dot" />
              <span>Principal <strong>{fmt(principal)}</strong> ({princPct}%)</span>
            </div>
            <div className="ms-breakdown__legend-item ms-breakdown__legend-item--interest">
              <span className="ms-breakdown__dot" />
              <span>Interest <strong>{fmt(interest)}</strong> ({intPct}%)</span>
            </div>
          </div>
        </div>
        {intPct > 70 && (
          <p className="ms-breakdown__note">
            {intPct}% of your payment is interest right now — this is normal in the early years of a bond. Extra payments reduce the balance fast and flip this ratio sooner.
          </p>
        )}
      </CardBody>
    </Card>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function MortgageStatementTab({ loans, onTabChange }) {
  const [scanning, setScanning]   = useState(false);
  const [scanError, setScanError] = useState('');
  const [result, setResult]       = useState(null);
  const showToast = useToast();

  async function handleFile(file) {
    if (file.size > 10 * 1024 * 1024) { showToast('File must be under 10MB', 'error'); return; }
    setScanError('');
    setScanning(true);
    try {
      const data = await scanMortgageStatement(file);
      if (!data.success && data.error) {
        setScanError(data.error);
        return;
      }
      if (!data.balance && !data.rate) {
        setScanError('Could not detect home loan details. Please ensure this is a home loan / bond account statement (not a bank account statement).');
        return;
      }
      setResult(data);
    } catch {
      setScanError('Something went wrong scanning your statement.');
    } finally {
      setScanning(false);
    }
  }

  function reset() { setResult(null); setScanError(''); }

  if (!result) {
    return (
      <div className="ms-tab fade-in">
        <div className="ms-header">
          <h2 className="ms-header__title">Bond Statement Analyser</h2>
          <p className="ms-header__sub">
            Upload your home loan statement to see your full loan breakdown, discover what portion of each payment goes to interest, and simulate the impact of extra payments.
          </p>
        </div>

        <UploadZone onFile={handleFile} scanning={scanning} />

        {scanError && (
          <div className="ms-error">
            <AlertTriangle size={14} /> {scanError}
          </div>
        )}

        <div className="ms-intro-points">
          <div className="ms-intro-point"><CheckCircle size={14} /> Principal vs interest breakdown for each payment</div>
          <div className="ms-intro-point"><CheckCircle size={14} /> Impact simulator — see how extra payments shrink your term</div>
          <div className="ms-intro-point"><CheckCircle size={14} /> Rate comparison vs current best available</div>
          <div className="ms-intro-point"><CheckCircle size={14} /> Statement is never stored — processed and discarded</div>
        </div>
      </div>
    );
  }

  const { bank, balance, rate, installment, originalAmount, principalLastPayment, interestLastPayment,
          nextPaymentDate, arrearsAmount, accountNumber, termMonthsRemaining, statementDate, propertyAddress, source } = result;

  const months   = termMonthsRemaining || remainingMonths(balance, rate, installment);
  const loanPct  = originalAmount > 0 ? Math.round((1 - balance / originalAmount) * 100) : null;

  return (
    <div className="ms-tab fade-in">
      <div className="ms-results-header">
        <div>
          <h2 className="ms-header__title">
            {bank ? `${bank} Home Loan` : 'Home Loan'} — Statement Analysis
          </h2>
          {statementDate && (
            <div className="ms-results-header__date">Statement date: {fmtDate(statementDate)}</div>
          )}
          {source === 'regex' && (
            <div className="ms-results-header__note">Some details extracted via pattern matching — verify below.</div>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={reset}>Upload another</Button>
      </div>

      {arrearsAmount > 0 && (
        <div className="ms-arrears-banner">
          <AlertTriangle size={16} />
          <strong>Arrears detected: {fmt(arrearsAmount)}</strong> — your account appears to have overdue payments. Contact your bank immediately to avoid penalty interest.
        </div>
      )}

      {/* Overview stats */}
      <div className="ms-stats-grid">
        <StatCard label="Outstanding Balance" value={fmt(balance)} sub={loanPct !== null ? `${loanPct}% paid off` : undefined} />
        <StatCard label="Monthly Instalment"  value={fmt(installment)} sub={rate ? `at ${fmtPct(rate)}` : undefined} />
        <StatCard label="Interest Rate"       value={fmtPct(rate)} sub={`Prime is ${fmtPct(PRIME_RATE)}`} />
        {months && <StatCard label="Term Remaining" value={fmtMonths(months)} sub={nextPaymentDate ? `Next payment ${fmtDate(nextPaymentDate)}` : undefined} />}
      </div>

      {/* Extra detail row */}
      {(propertyAddress || accountNumber || originalAmount) && (
        <div className="ms-meta-row">
          {originalAmount > 0 && (
            <div className="ms-meta-item">
              <div className="ms-meta-item__label">Original amount</div>
              <div className="ms-meta-item__val">{fmt(originalAmount)}</div>
            </div>
          )}
          {accountNumber && (
            <div className="ms-meta-item">
              <div className="ms-meta-item__label">Account number</div>
              <div className="ms-meta-item__val">{accountNumber}</div>
            </div>
          )}
          {propertyAddress && (
            <div className="ms-meta-item ms-meta-item--address">
              <div className="ms-meta-item__label">Property</div>
              <div className="ms-meta-item__val">{propertyAddress}</div>
            </div>
          )}
        </div>
      )}

      <PaymentBreakdown
        installment={installment}
        principalLastPayment={principalLastPayment}
        interestLastPayment={interestLastPayment}
        balance={balance}
        rate={rate}
      />

      <ImpactSimulator
        key={balance}
        balance={balance}
        rate={rate}
        installment={installment}
        termMonthsRemaining={months}
      />

      <RefinancingCard
        rate={rate}
        balance={balance}
        termMonthsRemaining={months}
        onTabChange={onTabChange}
      />
    </div>
  );
}
