import { useState, useEffect } from 'react';
import { InlineFeedback } from '../../components/FeedbackButton.jsx';
import { Link, useLocation, useNavigate, useParams } from 'react-router-dom';
import { CheckCircle, AlertTriangle, XCircle } from 'lucide-react';
import { fmt, fmtPct } from '../../lib/format.js';
import { calcMonthly, calcAffordability, calcTransferDuty, calcUpfrontCosts, calcAmortSchedule, calcSwapSavings, calcTotalInterest } from '../../lib/finance.js';
import { PRIME_RATE, STRESS_RATE, BANKS } from '../../lib/constants.js';
import { useRateSettings } from '../../lib/usePrimeRate.js';
import RatesExplained from '../../components/RatesExplained.jsx';
import { loans as loansApi, payments as paymentsApi, isLoggedIn, parseStatementForPreapproval } from '../../lib/api.js';
import { useRef } from 'react';
import Button from '../../components/Button.jsx';
import Card, { CardHeader, CardBody } from '../../components/Card.jsx';
import Input, { Select, CurrencyInput } from '../../components/Input.jsx';
import PropertySearchCTA from '../../components/PropertySearchCTA.jsx';
import './Tools.css';

const TOOLS = [
  { id: 'repayment',    label: 'Repayment Calculator' },
  { id: 'affordability',label: 'Affordability Check' },
  { id: 'qualify',      label: 'Qualify from Statement' },
  { id: 'rate-impact',  label: 'Rate Impact Simulator' },
  { id: 'swap',         label: 'Bond Swap Calculator' },
  { id: 'payoff',       label: 'Early Payoff & Switch Savings' },
  { id: 'transfer-duty',label: 'Transfer Duty' },
  { id: 'rent-vs-buy',  label: 'Rent vs Buy' },
  { id: 'reverse-repayment', label: 'Reverse Bond Calculator' },
];
const SLUG_TO_ID = {
  // full slugs
  'repayment-calculator': 'repayment', 'affordability-check': 'affordability',
  'qualify-from-statement': 'qualify', 'rate-impact-simulator': 'rate-impact',
  'bond-swap-calculator': 'swap', 'early-payoff': 'payoff',
  'transfer-duty': 'transfer-duty', 'rent-vs-buy': 'rent-vs-buy',
  'reverse-bond-calculator': 'reverse-repayment',
  // short-slug aliases
  'repayment': 'repayment', 'affordability': 'affordability',
  'qualify-statement': 'qualify', 'rate-impact': 'rate-impact',
  'bond-swap': 'swap', 'payoff': 'payoff',
  'rent-vs-buy-short': 'rent-vs-buy',
  'reverse-repayment': 'reverse-repayment',
};
const ID_TO_SLUG = Object.fromEntries(Object.entries(SLUG_TO_ID).map(([k,v]) => [v,k]));

// Known tool ids (for unknown-slug guard)
const KNOWN_IDS = new Set(TOOLS.map(t => t.id));

function ReverseBondCalculator({ livePrime, liveStress }) {
  const [price, setPrice]   = useState('');
  const [deposit, setDeposit] = useState('');
  const [term, setTerm]     = useState(20);

  const purchasePrice = parseFloat(price.replace(/[^\d.]/g, '')) || 0;
  const dep           = parseFloat(deposit.replace(/[^\d.]/g, '')) || 0;
  const bondAmount    = Math.max(0, purchasePrice - dep);
  const monthly       = bondAmount > 0 ? calcMonthly(bondAmount, livePrime, term) : 0;
  const monthlyStress = bondAmount > 0 ? calcMonthly(bondAmount, liveStress, term) : 0;
  const requiredIncome = monthlyStress > 0 ? Math.ceil(monthlyStress / 0.28) : 0;
  const td            = purchasePrice > 0 ? calcTransferDuty(purchasePrice) : null;
  const upfront       = purchasePrice > 0 ? calcUpfrontCosts(purchasePrice, bondAmount) : null;

  return (
    <div className="tools-card">
      <h2 className="tools-card__title">Reverse Bond Calculator</h2>
      <p className="tools-card__desc">
        Enter a property price to find out what income you need and what the monthly repayment will be.
      </p>
      <div className="tools-fields">
        <div className="tools-field">
          <label htmlFor="rb-price">Property price</label>
          <CurrencyInput
            id="rb-price"
            value={price}
            onChange={e => setPrice(e.target.value)}
            placeholder="e.g. 1 500 000"
          />
        </div>
        <div className="tools-field">
          <label htmlFor="rb-deposit">Deposit <span style={{fontWeight:400,fontSize:'0.85em',opacity:0.65}}>(optional)</span></label>
          <CurrencyInput
            id="rb-deposit"
            value={deposit}
            onChange={e => setDeposit(e.target.value)}
            placeholder="e.g. 150 000"
          />
        </div>
        <div className="tools-field">
          <label htmlFor="rb-term">Loan term</label>
          <Select
            id="rb-term"
            value={String(term)}
            onChange={e => setTerm(Number(e.target.value))}
            options={[
              { value: '10', label: '10 years' },
              { value: '15', label: '15 years' },
              { value: '20', label: '20 years' },
              { value: '25', label: '25 years' },
              { value: '30', label: '30 years' },
            ]}
          />
        </div>
      </div>

      {purchasePrice > 0 && (
        <div className="tools-result">
          <div className="tools-result__row tools-result__row--primary">
            <span>Required gross monthly income</span>
            <strong>{requiredIncome > 0 ? fmt(requiredIncome) : '—'}</strong>
          </div>
          <div className="tools-result__row">
            <span>Monthly repayment at prime ({livePrime}%)</span>
            <strong>{monthly > 0 ? fmt(monthly) : '—'}</strong>
          </div>
          <div className="tools-result__row">
            <span>Bond amount</span>
            <strong>{bondAmount > 0 ? fmt(bondAmount) : '—'}</strong>
          </div>
          {td && (
            <div className="tools-result__row">
              <span>Transfer duty</span>
              <strong>{fmt(td.duty)}</strong>
            </div>
          )}
          {upfront && (
            <div className="tools-result__row">
              <span>Est. total upfront costs</span>
              <strong>{fmt(upfront.total)}</strong>
            </div>
          )}
          <p className="tools-result__caveat">
            Income estimate uses SA banks' stress-test rate of {liveStress}% and the standard 28% gross income rule. Individual bank criteria vary.
          </p>
        </div>
      )}
      {purchasePrice === 0 && (
        <div className="tools-empty">Enter a property price to see the results.</div>
      )}
    </div>
  );
}

export default function Tools() {
  const location   = useLocation();
  const navigate   = useNavigate();
  const { tool: toolSlug } = useParams();
  const qp         = new URLSearchParams(location.search);

  // Resolve slug → id. If slug is present but unknown, redirect to repayment.
  let urlTool = qp.get('tool') || 'repayment';
  if (toolSlug) {
    const resolved = SLUG_TO_ID[toolSlug];
    if (resolved) {
      urlTool = resolved;
    } else if (!KNOWN_IDS.has(toolSlug)) {
      // Unknown slug — redirect
      navigate('/tools/repayment-calculator', { replace: true });
      urlTool = 'repayment';
    } else {
      // toolSlug is already a raw id (e.g. 'payoff')
      urlTool = toolSlug;
    }
  }

  const urlPrice   = parseFloat(qp.get('price'))   || 0;
  const urlDeposit = parseFloat(qp.get('deposit')) || 0;
  const urlRent    = parseFloat(qp.get('rent'))    || 0;
  const urlIncome  = parseFloat(qp.get('income'))  || 0;
  const urlMode    = qp.get('mode') || '';

  const [active, setActive]       = useState(urlTool);
  const [prefill, setPrefill]     = useState(false);

  // Set document.title based on active tool
  useEffect(() => {
    const tool = TOOLS.find(t => t.id === active);
    const label = tool ? tool.label : 'SA Bond Calculators';
    document.title = `${label} · Bondly Switch`;
    return () => { document.title = 'Bondly Switch'; };
  }, [active]);
  const [loanData, setLoanData]   = useState(null);
  const loggedIn = isLoggedIn();
  const rateSettings = useRateSettings();
  const livePrime    = rateSettings.primeRate  ?? PRIME_RATE;
  const liveStress   = rateSettings.stressRate ?? STRESS_RATE;

  // When arriving from landing or preapproval, rvbPrefill carries the qualifying numbers.
  // monthlySave is estimated at 20% of income — a conservative SA savings-rate assumption.
  const rvbPrefill = urlPrice > 0 ? {
    price:   urlPrice,
    deposit: urlDeposit,
    rent:    urlRent,
    income:  urlIncome,
  } : null;

  // Load user's primary bond if they opt in to pre-fill
  useEffect(() => {
    if (!prefill || !loggedIn) return;
    Promise.all([loansApi.list(), paymentsApi.list()]).then(([ls, ps]) => {
      const loan = ls?.[0];
      if (!loan) return;
      const monthly = calcMonthly(loan.amount, loan.rate, loan.term);
      const loanPmts = (ps || []).filter(p => p.loanId === loan.id);
      const totalPaid = loanPmts.reduce((s, p) => s + (p.amount || 0), 0);
      const monthsElapsed = monthly > 0 ? (Math.round(totalPaid / monthly) || 0) : 0;
      const schedule = calcAmortSchedule(loan.amount, loan.rate, loan.term);
      const row = schedule[Math.min(monthsElapsed, schedule.length - 1)];
      const balance = row?.balance ?? loan.amount;
      const monthsRemaining = Math.max(0, (loan.term * 12) - monthsElapsed);
      setLoanData({ amount: loan.amount, rate: loan.rate, term: loan.term, bank: loan.bank, balance: Math.max(0, balance), monthsElapsed, monthsRemaining });
    }).catch(() => {});
  }, [prefill, loggedIn]);

  return (
    <div className="page tools-page">
      <div className="container">
        <div className="tools-header">
          <div>
            <div className="tools-eyebrow">Free calculators</div>
            <h1 className="tools-title">SA Bond Calculators</h1>
            <p className="tools-subtitle">All the tools a South African homeowner needs — free, instant, no sign-up required.</p>
          </div>
          <Link to="/preapproval">
            <Button variant="lime">Get Pre-Approved — It's Free</Button>
          </Link>
        </div>

        {/* Pre-fill toggle — only shown to logged-in users */}
        {loggedIn && (
          <div className="tools-prefill-bar">
            <label className="tools-prefill-toggle">
              <div className={`toggle ${prefill ? 'active' : ''}`} onClick={() => setPrefill(p => !p)} />
              <span>Pre-fill from my bond data</span>
            </label>
            {prefill && loanData && (
              <span className="tools-prefill-source">
                Using: {loanData.bank} · {fmt(loanData.balance)} outstanding · {fmtPct(loanData.rate)}
              </span>
            )}
            {prefill && !loanData && (
              <span className="tools-prefill-source">Loading your bond data…</span>
            )}
          </div>
        )}

        {/* "Start here" card — helps first-time visitors pick the right
            calculator by intent. Hidden once a non-default tool is picked. */}
        {(active === 'repayment' || !active) && (
          <div className="tools-starthere">
            <div className="tools-starthere__title">Not sure where to start?</div>
            <div className="tools-starthere__grid">
              <button
                className="tools-starthere__card"
                onClick={() => { setActive('affordability'); navigate('/tools/affordability-check', { replace: true }); }}
              >
                <div className="tools-starthere__card-eyebrow">I'm thinking about buying</div>
                <div className="tools-starthere__card-title">How much can I borrow?</div>
                <div className="tools-starthere__card-desc">Enter your income — see what banks will likely approve.</div>
              </button>
              <button
                className="tools-starthere__card"
                onClick={() => { setActive('swap'); navigate('/tools/bond-swap-calculator', { replace: true }); }}
              >
                <div className="tools-starthere__card-eyebrow">I already have a bond</div>
                <div className="tools-starthere__card-title">Could I save by switching?</div>
                <div className="tools-starthere__card-desc">Enter your current rate — see how much less you'd pay elsewhere.</div>
              </button>
              <button
                className="tools-starthere__card"
                onClick={() => { setActive('payoff'); navigate('/tools/early-payoff', { replace: true }); }}
              >
                <div className="tools-starthere__card-eyebrow">I have a bond + extra cash</div>
                <div className="tools-starthere__card-title">How fast can I pay it off?</div>
                <div className="tools-starthere__card-desc">See how a R 500/mo extra payment cuts years off your bond.</div>
              </button>
            </div>
            <Link to="/first-time-buyer-guide" className="tools-starthere__guide">
              Or read our plain-English first-time-buyer guide →
            </Link>
          </div>
        )}

        <div className="tools-layout">
          <nav className="tools-nav">
            {TOOLS.map(t => (
              <button
                key={t.id}
                className={`tools-nav__item ${active === t.id ? 'active' : ''}`}
                onClick={() => { setActive(t.id); navigate('/tools/' + (ID_TO_SLUG[t.id] || t.id), { replace: true }); }}
              >
                {t.label}
              </button>
            ))}
          </nav>

          <div className="tools-content">
            {active === 'repayment'     && <RepaymentCalc prefill={prefill ? loanData : null} initialMode={urlMode} />}
            {active === 'affordability' && <AffordabilityCalc />}
            {active === 'qualify'       && <QualifyFromStatement />}
            {active === 'rate-impact'   && <RateImpactCalc prefill={prefill ? loanData : null} />}
            {active === 'swap'          && <SwapCalc prefill={prefill ? loanData : null} />}
            {active === 'payoff'        && <PayoffCalc prefill={prefill ? loanData : null} />}
            {active === 'transfer-duty' && <TransferDutyCalc />}
            {active === 'rent-vs-buy'   && <RentVsBuyCalc prefill={rvbPrefill} />}
            {active === 'reverse-repayment' && <ReverseBondCalculator livePrime={livePrime} liveStress={liveStress} />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Repayment Calculator ──────────────────────────────────
function RepaymentCalc({ prefill, initialMode }) {
  const [mode, setMode] = useState(initialMode === 'reverse' ? 'loan' : 'repayment'); // 'repayment' | 'loan'
  const [f, setF] = useState({ amount: '1000000', rate: String(PRIME_RATE), term: '20', monthly: '' });
  useEffect(() => {
    if (prefill) setF(p => ({ ...p, amount: String(prefill.balance), rate: String(prefill.rate), term: String(Math.ceil(prefill.monthsRemaining / 12) || prefill.term) }));
    else setF(p => ({ ...p, amount: '1000000', rate: String(PRIME_RATE), term: '20' }));
  }, [prefill]);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const amount  = parseFloat(f.amount)  || 0;
  const rate    = parseFloat(f.rate)    || PRIME_RATE;
  const term    = parseInt(f.term)      || 20;
  const monthly = parseFloat(f.monthly) || 0;

  const rateInvalid  = rate <= 0 || rate > 40;
  const termInvalid  = term < 1 || term > 40;
  const amountTooLow = mode === 'repayment' && amount > 0 && amount < 10_000;

  // mode: repayment → loan amount → monthly payment
  const calcedMonthly      = mode === 'repayment' && amount && !rateInvalid && !termInvalid && !amountTooLow ? calcMonthly(amount, rate, term) : 0;
  const totalInterest      = mode === 'repayment' && amount && !rateInvalid && !termInvalid ? calcTotalInterest(amount, rate, term) : 0;
  // mode: loan → monthly payment → max loan amount
  // PV = PMT * [1 - (1+r)^-n] / r  where r = monthly rate, n = months
  const r = (rate / 100) / 12;
  const n = term * 12;
  const calcedLoan = mode === 'loan' && monthly && r > 0 && !rateInvalid && !termInvalid
    ? monthly * (1 - Math.pow(1 + r, -n)) / r
    : 0;
  const calcedLoanInterest = mode === 'loan' && calcedLoan ? (monthly * n) - calcedLoan : 0;

  const modeBtnStyle = (m) => ({
    flex: 1, padding: '8px 0', fontSize: '0.875rem', fontWeight: 600, cursor: 'pointer', border: 'none', borderRadius: 6,
    background: mode === m ? 'var(--forest)' : 'transparent',
    color: mode === m ? 'var(--lime)' : 'var(--text-secondary)',
    transition: 'background 0.15s',
  });

  return (
    <CalcCard title="Repayment Calculator">
      <div style={{ display: 'flex', background: 'var(--bg-base)', borderRadius: 8, padding: 4, gap: 4, marginBottom: 4 }}>
        <button style={modeBtnStyle('repayment')} onClick={() => setMode('repayment')}>Calculate repayment</button>
        <button style={modeBtnStyle('loan')} onClick={() => setMode('loan')}>Calculate loan amount</button>
      </div>

      {mode === 'repayment' ? (
        <>
          <CurrencyInput label="Loan amount" id="rc-amt" value={f.amount} onChange={set('amount')} placeholder="1 200 000" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <Input label="Interest rate (%)" id="rc-rate" type="text" inputMode="decimal" value={f.rate} onChange={set('rate')} suffix="%" />
            <Input label="Term (years)" id="rc-term" type="text" inputMode="numeric" value={f.term} onChange={set('term')} />
          </div>
          {rateInvalid && f.rate !== '' && <p style={{ color: 'var(--error, #dc2626)', fontSize: '0.8125rem', marginTop: 4 }}>Enter a rate between 0.1% and 40%</p>}
          {termInvalid && f.term !== '' && <p style={{ color: 'var(--error, #dc2626)', fontSize: '0.8125rem', marginTop: 4 }}>Enter a term between 1 and 40 years</p>}
          {amountTooLow && <p style={{ color: 'var(--error, #dc2626)', fontSize: '0.8125rem', marginTop: 4 }}>Enter a loan amount of at least R 10 000</p>}
          {calcedMonthly > 0 && (
            <div className="calc-result fade-in">
              <ResultRow label="Monthly repayment" value={fmt(calcedMonthly)} accent />
              <ResultRow label="Total repaid"       value={fmt(calcedMonthly * term * 12)} />
              <ResultRow label="Total interest"     value={fmt(totalInterest)} sub={`${fmtPct(totalInterest / (amount + totalInterest) * 100, 0)} of total`} />
            </div>
          )}
          {calcedMonthly > 0 && amount > 0 && (
            <AmortVis principal={amount} ratePercent={rate} termYears={term} monthlyPayment={calcedMonthly} />
          )}
        </>
      ) : (
        <>
          <CurrencyInput label="Monthly payment I can afford" id="rc-pmt" value={f.monthly} onChange={set('monthly')} placeholder="15 000" />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <Input label="Interest rate (%)" id="rc-rate2" type="text" inputMode="decimal" value={f.rate} onChange={set('rate')} suffix="%" />
            <Input label="Term (years)" id="rc-term2" type="text" inputMode="numeric" value={f.term} onChange={set('term')} />
          </div>
          {rateInvalid && f.rate !== '' && <p style={{ color: 'var(--error, #dc2626)', fontSize: '0.8125rem', marginTop: 4 }}>Enter a rate between 0.1% and 40%</p>}
          {termInvalid && f.term !== '' && <p style={{ color: 'var(--error, #dc2626)', fontSize: '0.8125rem', marginTop: 4 }}>Enter a term between 1 and 40 years</p>}
          {calcedLoan > 0 && (
            <div className="calc-result fade-in">
              <ResultRow label="Maximum loan amount" value={fmt(calcedLoan)} accent />
              <ResultRow label="Total repaid"         value={fmt(monthly * n)} />
              <ResultRow label="Total interest"       value={fmt(calcedLoanInterest)} sub={`${fmtPct(calcedLoanInterest / (calcedLoan + calcedLoanInterest) * 100, 0)} of total`} />
              <PropertySearchCTA maxBond={calcedLoan} compact defaultExpanded />
            </div>
          )}
        </>
      )}
    </CalcCard>
  );
}

// ── Affordability Calculator ──────────────────────────────
function AffordabilityCalc() {
  const [f, setF] = useState({ income: '', price: '', deposit: '', debt: '', term: '20' });
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const inc       = parseFloat(f.income)  || 0;
  const price     = parseFloat(f.price)   || 0;
  const dep       = parseFloat(f.deposit) || 0;
  const dbt       = parseFloat(f.debt)    || 0;
  const termYears = parseInt(f.term, 10)  || 20;
  const res   = inc > 0 ? calcAffordability(inc, price || 0, dep, dbt, termYears) : null;
  // Live rates from the backend's authoritative settings (admin-updated,
  // SARB-auto-fetched). Falls back to constants.js if backend is unreachable.
  const rateSettings = useRateSettings();
  const livePrime    = rateSettings.primeRate ?? PRIME_RATE;
  const liveStress   = rateSettings.stressRate ?? STRESS_RATE;
  const [showRatesModal, setShowRatesModal] = useState(false);

  return (
    <CalcCard title="Affordability Check">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <CurrencyInput label="Gross monthly income" id="ac-inc" value={f.income} onChange={set('income')} placeholder="45 000" />
        <CurrencyInput label={<>Property price <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></>} id="ac-price" value={f.price} onChange={set('price')} placeholder="leave blank to find out" />
        <CurrencyInput label={<>Deposit available <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></>} id="ac-dep" value={f.deposit} onChange={set('deposit')} placeholder="0" />
        <CurrencyInput label={<>Other monthly debt <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></>} id="ac-dbt" value={f.debt} onChange={set('debt')} placeholder="0" />
        <Select label="Loan term" id="ac-term" value={f.term} onChange={set('term')}>
          <option value="10">10 years</option>
          <option value="15">15 years</option>
          <option value="20">20 years (most common)</option>
          <option value="25">25 years</option>
          <option value="30">30 years</option>
        </Select>
      </div>
      {res && (() => {
        const maxMonthlyEst = calcMonthly(res.maxBond, livePrime, termYears);
        const lastChanged = rateSettings.primeRateLastChanged
          ? new Date(rateSettings.primeRateLastChanged).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
          : null;
        return (
          <div className="calc-result fade-in">
            {price > 0 ? (
              <div className={`calc-verdict ${res.canAfford ? 'green' : res.borderline ? 'amber' : 'red'}`}>
                {res.canAfford ? <><CheckCircle size={16} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/>You likely qualify!</> : res.borderline ? <><AlertTriangle size={16} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/>Borderline — a larger deposit helps</> : <><XCircle size={16} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/>May be out of range at this price</>}
                {res.confidence && <span style={{ marginLeft: 8, fontSize: '0.75rem', opacity: 0.7 }}>({res.confidence} confidence)</span>}
              </div>
            ) : (
              <div className="calc-verdict green">
                <CheckCircle size={16} style={{display:'inline',verticalAlign:'middle',marginRight:6}}/>Here's how much you could borrow — enter a property price above to check a specific home
              </div>
            )}
            {res.maxBond >= 200000 ? (
              <>
                <ResultRow label="Est. monthly repayment" value={fmt(price > 0 ? res.monthly : maxMonthlyEst)} accent sub={`at prime ${fmtPct(livePrime)} · over ${termYears} years`} />
                <ResultRow label="Maximum bond"            value={fmt(res.maxBond)} sub={`qualified at ${fmtPct(liveStress)} stress rate`} />
                {dep > 0 && <ResultRow label="Total budget" value={fmt(res.maxBond + dep)} sub="bond + deposit" accent />}
                <PropertySearchCTA maxBond={res.maxBond} compact defaultExpanded />
              </>
            ) : (
              /* Honesty guard: below R 200k there's no SA property meaningfully on offer.
                 Showing "Maximum bond R 28 000" is demoralising and misleading. Pivot
                 the result to financial-control coaching that's actually actionable. */
              <div style={{ background:'rgba(245,158,11,.08)', border:'1px solid rgba(245,158,11,.25)', borderRadius:10, padding:'16px 18px' }}>
                <div style={{ fontWeight:700, fontSize:'0.9375rem', marginBottom:8 }}>
                  Build your bond capacity first
                </div>
                <p style={{ margin:'0 0 10px', fontSize:'0.875rem', color:'var(--text-secondary)', lineHeight:1.5 }}>
                  Based on your numbers, your current bond capacity is below R 200&nbsp;000 — not enough to meaningfully buy in SA today. The fastest way to change that: increase income, reduce monthly debt, or save for a deposit.
                </p>
                <p style={{ margin:'0 0 12px', fontSize:'0.875rem', color:'var(--text-secondary)' }}>
                  Upload a recent bank statement and we'll show you exactly which expenses are dragging your qualification down + a step-by-step plan to fix it.
                </p>
                <Link to="/optimize" style={{ display:'inline-block', padding:'9px 18px', background:'var(--lime)', color:'var(--forest)', borderRadius:7, fontWeight:700, fontSize:'0.875rem', textDecoration:'none' }}>
                  Build my plan →
                </Link>
              </div>
            )}
            {price > 0 && <ResultRow label="Transfer duty"    value={price <= 1_210_000 ? 'Exempt' : fmt(res.costs.duty)} />}
            {price > 0 && <ResultRow label="Est. upfront costs" value={fmt(res.costs.total)} />}
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
              Banks qualify bonds at a {fmtPct(liveStress)} stress rate (prime + 2%) to allow for future rate hikes. Your actual monthly repayment at today's prime rate ({fmtPct(livePrime)}) is shown above. These are estimates — final approval depends on your full credit profile.
              {' '}
              <button type="button" onClick={() => setShowRatesModal(true)}
                style={{ background:'none', border:'none', padding:0, font:'inherit', color:'#2563eb', cursor:'pointer', borderBottom:'1px dotted currentColor' }}>
                What do these rates mean?
              </button>
              {lastChanged && <span style={{ color:'var(--text-secondary)' }}> · Prime last updated {lastChanged}.</span>}
            </p>
            <RatesExplained
              open={showRatesModal}
              onClose={() => setShowRatesModal(false)}
              primeRate={livePrime}
              stressRate={liveStress}
              lastChanged={rateSettings.primeRateLastChanged}
            />
          </div>
        );
      })()}
    </CalcCard>
  );
}

// ── Rate Impact Simulator ─────────────────────────────────
function RateImpactCalc({ prefill }) {
  const [f, setF] = useState({ amount: '', rate: String(PRIME_RATE), term: '20', newRate: '' });
  useEffect(() => {
    if (prefill) setF(p => ({ ...p, amount: String(prefill.balance), rate: String(prefill.rate), term: String(Math.ceil(prefill.monthsRemaining / 12) || prefill.term) }));
    else setF({ amount: '', rate: String(PRIME_RATE), term: '20', newRate: '' });
  }, [prefill]);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const amount  = parseFloat(f.amount)  || 0;
  const rate    = parseFloat(f.rate)    || PRIME_RATE;
  const term    = parseInt(f.term)      || 20;
  const newRate = parseFloat(f.newRate) || 0;
  const current = amount ? calcMonthly(amount, rate, term) : 0;
  const updated = amount && newRate ? calcMonthly(amount, newRate, term) : 0;
  const diff = current - updated;

  return (
    <CalcCard title="Rate Impact Simulator">
      <CurrencyInput label="Outstanding balance" id="ri-amt" value={f.amount} onChange={set('amount')} placeholder="1 000 000" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
        <Input label="Current rate (%)" id="ri-rate"    type="text" inputMode="decimal" value={f.rate}    onChange={set('rate')}    suffix="%" />
        <Input label="New rate (%)"     id="ri-newrate" type="text" inputMode="decimal" value={f.newRate}  onChange={set('newRate')} suffix="%" placeholder={String(PRIME_RATE - 0.5)} />
        <Input label="Term (years)"     id="ri-term"    type="text" inputMode="numeric" value={f.term}     onChange={set('term')} />
      </div>
      {!amount && <p className="calc-placeholder">Enter your outstanding balance above to see the impact of a rate change.</p>}
      {amount > 0 && !newRate && <p className="calc-placeholder">Enter a new rate above to compare.</p>}
      {current > 0 && updated > 0 && (
        <div className="calc-result fade-in">
          <ResultRow label="Current monthly"  value={fmt(current)} />
          <ResultRow label="New monthly"      value={fmt(updated)} accent />
          <ResultRow label="Monthly saving"   value={diff > 0 ? `${fmt(diff)} cheaper` : diff < 0 ? `${fmt(Math.abs(diff))} more` : 'No change'} accent={diff > 0} />
          <ResultRow label="Annual saving"    value={diff > 0 ? fmt(diff * 12) : diff < 0 ? `${fmt(Math.abs(diff) * 12)} more` : 'No change'} />
          <ResultRow label="Total over term"  value={diff > 0 ? fmt(diff * term * 12) : diff < 0 ? `${fmt(Math.abs(diff) * term * 12)} more` : 'No change'} />
        </div>
      )}
    </CalcCard>
  );
}

// ── Bond Swap Calculator ──────────────────────────────────
function SwapCalc({ prefill }) {
  const [f, setF] = useState({ balance: '', currentRate: String(PRIME_RATE), newRate: '', term: '20' });
  useEffect(() => {
    if (prefill) setF(p => ({ ...p, balance: String(prefill.balance), currentRate: String(prefill.rate), term: String(Math.ceil(prefill.monthsRemaining / 12) || prefill.term) }));
    else setF({ balance: '', currentRate: String(PRIME_RATE), newRate: '', term: '20' });
  }, [prefill]);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));
  const balance  = parseFloat(f.balance)     || 0;
  const current  = parseFloat(f.currentRate) || PRIME_RATE;
  const newRate  = parseFloat(f.newRate)      || 0;
  const term     = parseInt(f.term)          || 20;
  const result   = balance && newRate ? calcSwapSavings(balance, current, newRate, term * 12) : null;

  return (
    <CalcCard title="Bond Swap Calculator">
      <CurrencyInput label="Outstanding balance" id="sc-bal" value={f.balance} onChange={set('balance')} placeholder="1 000 000" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-4)' }}>
        <Input label="Current rate (%)"  id="sc-cur"  type="text" inputMode="decimal" value={f.currentRate} onChange={set('currentRate')} suffix="%" />
        <Input label="New rate (%)"      id="sc-new"  type="text" inputMode="decimal" value={f.newRate}      onChange={set('newRate')}     suffix="%" placeholder="10.75" />
        <Input label="Remaining (years)" id="sc-term" type="text" inputMode="numeric" value={f.term}         onChange={set('term')} />
      </div>
      {balance > 0 && !newRate && (
        <p className="calc-placeholder">Enter a new rate above to see your potential saving ↑</p>
      )}
      {result && (
        <div className="calc-result fade-in">
          <ResultRow label="Current monthly" value={fmt(result.currentMonthly)} />
          <ResultRow label="New monthly"     value={fmt(result.newMonthly)}     accent />
          <ResultRow label="Monthly saving"  value={fmt(result.monthlySaving)}  accent={result.monthlySaving > 0} />
          <ResultRow label="Total saving"    value={fmt(result.totalSaving)}    accent={result.totalSaving > 0} />
        </div>
      )}
    </CalcCard>
  );
}

// ── Early Payoff & Switch Savings Calculator ──────────────
function PayoffCalc({ prefill }) {
  const [f, setF] = useState({ balance: '', rate: String(PRIME_RATE), monthly: '', newRate: '' });
  useEffect(() => {
    if (prefill) {
      const bal  = prefill.balance;
      const rate = prefill.rate;
      const mo   = Math.ceil(prefill.monthsRemaining) || (prefill.term * 12);
      const pmt  = calcMonthly(bal, rate, mo / 12);
      setF(p => ({ ...p, balance: String(Math.round(bal)), rate: String(rate), monthly: String(Math.round(pmt)) }));
    } else {
      setF({ balance: '', rate: String(PRIME_RATE), monthly: '', newRate: '' });
    }
  }, [prefill]);

  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  const balance  = parseFloat(f.balance)  || 0;
  const rate     = parseFloat(f.rate)     || PRIME_RATE;
  const monthly  = parseFloat(f.monthly)  || 0;
  const newRate  = parseFloat(f.newRate)  || 0;

  // n = -ln(1 - PV*r/PMT) / ln(1+r)  — standard amortisation months-to-payoff
  function monthsToPayoff(pv, annualRate, pmt) {
    if (!pv || !pmt || !annualRate) return null;
    const r = annualRate / 100 / 12;
    const num = Math.log(1 - (pv * r) / pmt);
    const den = Math.log(1 + r);
    if (!isFinite(num) || den === 0 || (-num) / den <= 0) return null;
    return Math.ceil(-num / den);
  }

  // Simulate amortisation to get accurate total interest (handles overpayment final month)
  function calcInterestPaid(pv, annualRate, pmt) {
    if (!pv || !pmt || !annualRate) return null;
    const r = annualRate / 100 / 12;
    let bal = pv, totalInterest = 0;
    for (let i = 0; i < 1200; i++) {
      const interest = bal * r;
      totalInterest += interest;
      bal = bal + interest - Math.min(pmt, bal + interest);
      if (bal < 0.01) break;
    }
    return totalInterest;
  }

  const currentMonths  = monthsToPayoff(balance, rate, monthly);
  const switchedMonths = newRate && monthly ? monthsToPayoff(balance, newRate, monthly) : null;

  const monthsSaved    = currentMonths && switchedMonths ? Math.max(0, currentMonths - switchedMonths) : null;
  const interestNow    = currentMonths  ? calcInterestPaid(balance, rate, monthly)    : null;
  const interestNew    = switchedMonths ? calcInterestPaid(balance, newRate, monthly)  : null;
  const interestSaved  = interestNow != null && interestNew != null ? Math.max(0, interestNow - interestNew) : null;

  // Min payment guard: monthly must exceed first month's interest
  const minPayment = balance > 0 ? Math.ceil(balance * (rate / 100 / 12)) + 1 : 0;
  const paymentTooLow = monthly > 0 && monthly < minPayment;

  return (
    <CalcCard title="Early Payoff & Switch Savings">
      <p className="calc-desc">
        See how many months your bond has left — and how much interest you'd save by switching to a better rate today.
      </p>
      <CurrencyInput label="Outstanding balance" id="po-bal" value={f.balance} onChange={set('balance')} placeholder="950 000" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <Input label="Current rate (%)"   id="po-rate"  type="text" inputMode="decimal" value={f.rate}    onChange={set('rate')}    suffix="%" />
        <CurrencyInput label="Monthly payment" id="po-pmt"   value={f.monthly} onChange={set('monthly')} placeholder={balance ? String(Math.round(calcMonthly(balance, rate, 20))) : '13 000'} />
      </div>

      {paymentTooLow && (
        <p style={{ fontSize: '0.8125rem', color: 'var(--color-error)', margin: 0 }}>
          Monthly payment must exceed the first month's interest ({fmt(minPayment)}) to make progress on the bond.
        </p>
      )}

      {currentMonths && !paymentTooLow && (
        <div className="calc-result fade-in">
          <ResultRow label="Months remaining at current rate" value={`${currentMonths} months (${(currentMonths / 12).toFixed(1)} yrs)`} />
          <ResultRow label="Total interest still to pay"      value={fmt(interestNow)} sub="at current rate" />
        </div>
      )}

      {currentMonths && !paymentTooLow && (
        <>
          <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-4)' }}>
            <p style={{ margin: '0 0 var(--space-3)', fontSize: '0.875rem', color: 'var(--text-secondary)', fontWeight: 600 }}>
              What if you switched to a better rate?
            </p>
            <Input label="New rate after switching (%)" id="po-newrate" type="text" inputMode="decimal" value={f.newRate} onChange={set('newRate')} suffix="%" placeholder={String((rate - 0.5).toFixed(2))} />
          </div>

          {switchedMonths && interestSaved != null && (
            <div className="calc-result fade-in">
              <ResultRow label="Months remaining at new rate"  value={`${switchedMonths} months (${(switchedMonths / 12).toFixed(1)} yrs)`} accent />
              <ResultRow label="Total interest after switching" value={fmt(interestNew)} />
              <ResultRow label="Months saved"                  value={`${monthsSaved} months`} accent={monthsSaved > 0} />
              <ResultRow label="Interest saved"                value={fmt(interestSaved)} accent={interestSaved > 0} />
              {interestSaved > 0 && (
                <Link to="/preapproval" style={{ display: 'block', textDecoration: 'none', marginTop: 'var(--space-3)' }}>
                  <Button variant="lime" style={{ width: '100%' }}>
                    Start my switch — it's free →
                  </Button>
                </Link>
              )}
              {interestSaved <= 0 && (
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
                  The new rate doesn't save interest at this payment level — try a rate at least 0.25% below your current one.
                </p>
              )}
            </div>
          )}
        </>
      )}

      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 0 }}>
        Interest saved assumes you keep the same monthly payment after switching — all extra goes toward reducing principal faster.
        Excludes bond cancellation and registration fees (typically R5k–R15k total).
      </p>
    </CalcCard>
  );
}

// ── Transfer Duty Calculator ──────────────────────────────
function TransferDutyCalc() {
  const [price, setPrice] = useState('');
  const p = parseFloat(price) || 0;
  const duty = p ? calcTransferDuty(p) : 0;
  const bondReg = p ? Math.round(p * 0.012 + 5000) : 0;
  const transferFee = p ? Math.round(p * 0.014 + 6000) : 0;

  return (
    <CalcCard title="Transfer Duty Calculator">
      <p className="calc-desc">SARS transfer duty thresholds 2025/26 — applies to residential properties sold after 1 April 2025.</p>
      <CurrencyInput label="Purchase price" id="td-price" value={price} onChange={e => setPrice(e.target.value)} placeholder="1 500 000" />
      {p > 0 && (
        <div className="calc-result fade-in">
          <ResultRow label="Transfer duty"    value={p <= 1_210_000 ? 'Exempt' : fmt(duty)} accent={p <= 1_210_000} />
          <ResultRow label="Bond registration" value={fmt(bondReg)} />
          <ResultRow label="Transfer attorney" value={fmt(transferFee)} />
          <ResultRow label="Total upfront"    value={fmt(duty + bondReg + transferFee)} accent />
          {p <= 1_210_000 && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--mint)', marginTop: 'var(--space-3)' }}>
              ✓ Properties under R1.21M are exempt from transfer duty.
            </p>
          )}
        </div>
      )}
      <div className="calc-table">
        <h4>2025/26 Thresholds</h4>
        {[
          { range: 'R0 – R1,210,000',         rate: '0%' },
          { range: 'R1,210,001 – R1,663,800',  rate: '3%' },
          { range: 'R1,663,801 – R2,329,300',  rate: '6%' },
          { range: 'R2,329,301 – R2,994,800',  rate: '8%' },
          { range: 'R2,994,801 – R13,310,000', rate: '11%' },
          { range: 'Above R13,310,000',        rate: '13%' },
        ].map(r => (
          <div key={r.range} className="calc-table__row">
            <span>{r.range}</span>
            <strong>{r.rate}</strong>
          </div>
        ))}
      </div>
    </CalcCard>
  );
}

// ── Rent vs Buy Calculator ────────────────────────────────
function RentVsBuyCalc({ prefill }) {
  const [f, setF] = useState({
    rent: '', price: '', deposit: '', term: '20', income: '', expenses: '',
    propGrowth: '6.5', rentIncrease: '8', investReturn: '8', inflation: '5.5', incomeGrowth: '5',
  });
  const [showAssumptions, setShowAssumptions] = useState(false);
  const set = k => e => setF(p => ({ ...p, [k]: e.target.value }));

  // Pre-fill when navigating from landing "Still renting?" or pre-approval result
  useEffect(() => {
    if (prefill?.price > 0) {
      setF(p => ({
        ...p,
        price:   String(Math.round(prefill.price)),
        deposit: prefill.deposit > 0 ? String(Math.round(prefill.deposit)) : p.deposit,
        rent:    prefill.rent    > 0 ? String(Math.round(prefill.rent))    : p.rent,
        income:  prefill.income  > 0 ? String(Math.round(prefill.income))  : p.income,
      }));
    }
  }, [prefill]);

  const rent         = parseFloat(f.rent)         || 0;
  const deposit      = parseFloat(f.deposit)      || 0;
  const term         = parseInt(f.term)           || 20;
  const income       = parseFloat(f.income)       || 0;
  const expenses     = f.expenses !== '' ? (parseFloat(f.expenses) || 0) : (income > 0 ? Math.round(income * 0.55) : 0);
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const propGrowth   = clamp(parseFloat(f.propGrowth)   || 6.5, -20, 30);
  const rentIncrease = clamp(parseFloat(f.rentIncrease) || 8,   -20, 30);
  const investReturn = clamp(parseFloat(f.investReturn) || 8,   -20, 30);
  const inflation    = clamp(parseFloat(f.inflation)    || 5.5, -10, 20);
  const incomeGrowth = clamp(parseFloat(f.incomeGrowth) || 5,   -20, 30);

  // Price is optional — auto-derive from income when left blank
  const priceEntered = parseFloat(f.price) || 0;
  const priceAuto    = !priceEntered && income > 0
    ? Math.round(calcAffordability(income, 0, deposit, 0, term).maxBond + deposit)
    : 0;
  const price      = priceEntered || priceAuto;
  const priceIsAuto = !priceEntered && priceAuto > 0;

  let result    = null;
  let chartData = null;
  if (rent && price) {
    const bondAmt = Math.max(0, price - deposit);
    const r = PRIME_RATE / 100 / 12;
    const n = term * 12;
    const monthly   = bondAmt > 0 ? calcMonthly(bondAmt, PRIME_RATE, term) : 0;
    const rentTotal = rent * n;
    const upfront   = calcUpfrontCosts(price, bondAmt);
    const buyTotal  = monthly * n + upfront.total;
    const propVal   = price * Math.pow(1 + propGrowth / 100, term);
    let bal = bondAmt;
    for (let i = 0; i < n && bal > 0; i++) { const ip = bal * r; bal = Math.max(0, bal - (monthly - ip)); }
    const equity = propVal - bal;
    result = { monthly, rentTotal, buyTotal, propVal, equity, upfront, diff: buyTotal - equity - rentTotal };
    if (income > 0) {
      chartData = computeNetWorthTimeline({ price, deposit, upfrontCosts: upfront.total, rent, monthly, propGrowth, rentIncrease, investReturn, inflation, incomeGrowth, term, income, expenses });
    }
  }

  return (
    <CalcCard title="Rent vs Buy">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
        <CurrencyInput label="Monthly take-home income" id="rvb-income" value={f.income}  onChange={set('income')}  placeholder="45 000" />
        <CurrencyInput label="Current monthly rent"     id="rvb-rent"   value={f.rent}    onChange={set('rent')}    placeholder="12 000" />
        <CurrencyInput
          label={<>Property price <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{priceIsAuto ? `auto: ${fmt(priceAuto)} based on your income` : '(optional — we\'ll estimate from your income)'}</span></>}
          id="rvb-price" value={f.price} onChange={set('price')}
          placeholder={priceAuto > 0 ? String(priceAuto) : '1 500 000'}
        />
        <CurrencyInput label={<>Deposit <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>(optional)</span></>} id="rvb-dep" value={f.deposit} onChange={set('deposit')} placeholder="0" />
        <Input label="Term (years)"                 id="rvb-term"   type="text" inputMode="numeric" value={f.term}    onChange={set('term')} />
      </div>
      {chartData
        ? <NetWorthChart data={chartData} term={term} income={income} expenses={expenses} monthly={result.monthly} rent={rent} />
        : income === 0 && rent > 0 && (
          <div className="calc-placeholder">
            Enter your monthly take-home income above to see how your net worth compares over time.
          </div>
        )
      }

      <div className="rvb-assumptions">
        <button className="rvb-assumptions__toggle" onClick={() => setShowAssumptions(p => !p)}>
          <span>Assumptions</span>
          <span style={{ fontSize: '0.75rem' }}>{showAssumptions ? '▲ hide' : '▼ edit'}</span>
        </button>
        {showAssumptions && (
          <div className="rvb-assumptions__body">
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
              <CurrencyInput
                label={<>Monthly living expenses <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{income > 0 ? `defaults to 55% = ${fmt(Math.round(income * 0.55))}` : 'defaults to 55% of income'}</span></>}
                id="rvb-exp" value={f.expenses} onChange={set('expenses')} placeholder={income > 0 ? String(Math.round(income * 0.55)) : 'e.g. 25 000'}
              />
              <Input label="Property growth (% pa)"             id="rvb-pg"  type="text" inputMode="decimal" value={f.propGrowth}   onChange={set('propGrowth')}   suffix="%" />
              <Input label="Annual rent increase (% pa)"        id="rvb-ri"  type="text" inputMode="decimal" value={f.rentIncrease} onChange={set('rentIncrease')} suffix="%" />
              <Input label="Savings / investment return (% pa)" id="rvb-ir"  type="text" inputMode="decimal" value={f.investReturn} onChange={set('investReturn')} suffix="%" />
              <Input label="Inflation (% pa)"                   id="rvb-inf" type="text" inputMode="decimal" value={f.inflation}    onChange={set('inflation')}    suffix="%" />
              <Input label="Annual income growth (% pa)"        id="rvb-ig"  type="text" inputMode="decimal" value={f.incomeGrowth} onChange={set('incomeGrowth')} suffix="%" />
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-3)', lineHeight: 1.5 }}>
              SA historical averages: property ~6.5% pa · rental increases ~8% pa · JSE equity ~8% pa · CPI ~5.5% pa · salary growth ~5% pa
            </p>
          </div>
        )}
      </div>

      {result && (
        <div className="calc-result fade-in">
          <ResultRow label="Monthly mortgage"                           value={fmt(result.monthly)} />
          <ResultRow label="Est. upfront costs (duty + registration)"   value={fmt(result.upfront.total)} sub="est." />
          <ResultRow label={`Total rent (${term} yrs)`}                 value={fmt(result.rentTotal)} />
          <ResultRow label={`Total buy cost (${term} yrs)`}             value={fmt(result.buyTotal)} sub="incl. upfront" />
          <ResultRow label="Est. property value then"                   value={fmt(result.propVal)} sub={`${propGrowth}% pa est.`} />
          <ResultRow label="Est. equity after term"                     value={fmt(result.equity)} accent />
          <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-page)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Cost only (excludes what you could invest as a renter): buying costs {result.diff < 0 ? <strong style={{ color: 'var(--forest)' }}>R{Math.round(Math.abs(result.diff)/1000)}k less</strong> : <strong style={{ color: '#d97706' }}>R{Math.round(result.diff/1000)}k more</strong>} than renting over {term} years once you factor in equity. See the net worth chart above for the full comparison.
          </div>
          {income > 0 && (() => {
            const ownerSurplus = income - expenses - result.monthly;
            const renterSurplus = income - expenses - rent;
            return (
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', fontSize: '0.8125rem', background: 'var(--bg-page)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-3) var(--space-4)', marginTop: 'var(--space-3)' }}>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>As homeowner (today)</span><br />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{fmt(income)} − {fmt(expenses)} living − {fmt(result.monthly)} bond</span><br />
                  <strong style={{ color: ownerSurplus > 0 ? 'var(--forest)' : '#dc2626' }}>
                    {ownerSurplus >= 0 ? `${fmt(ownerSurplus)}/mo saved` : `${fmt(Math.abs(ownerSurplus))}/mo shortfall`}
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-secondary)' }}>As renter (today)</span><br />
                  <span style={{ color: 'var(--text-secondary)', fontSize: '0.75rem' }}>{fmt(income)} − {fmt(expenses)} living − {fmt(rent)} rent</span><br />
                  <strong style={{ color: renterSurplus > 0 ? '#6366f1' : '#dc2626' }}>
                    {renterSurplus >= 0 ? `${fmt(renterSurplus)}/mo saved` : `${fmt(Math.abs(renterSurplus))}/mo shortfall`}
                  </strong>
                </div>
              </div>
            );
          })()}
          <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
            Estimates only · Prime rate {fmtPct(PRIME_RATE)} · Property growth {propGrowth}% pa · Income growth {incomeGrowth}% pa · Expenses grow with CPI ({inflation}%) · Net worth chart renter starts with deposit + upfront costs invested · Excludes rates, levies and maintenance
          </p>
        </div>
      )}
    </CalcCard>
  );
}

// ── Qualify from Bank Statement ───────────────────────────
function QualifyFromStatement() {
  const [file, setFile]     = useState(null);
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState('');
  const inputRef = useRef();
  // Live rate settings so the "qualified at 13.25%" line tracks SARB moves
  const _rateSettings = useRateSettings();
  const stressRateLive = _rateSettings.stressRate ?? STRESS_RATE;

  async function analyse() {
    if (!file) return;
    setLoading(true); setError(''); setResult(null);
    try {
      const j = await parseStatementForPreapproval(file);
      if (!j.success) throw new Error(j.error || 'Could not analyse');
      setResult(j.data);
    } catch(e) {
      setError(e.message || 'Could not analyse statement');
    } finally {
      setLoading(false);
    }
  }

  const verdict = result?.qualification?.verdict;
  const rp = result?.riskProfile;

  const GRADE_COLORS = { A: '#10b981', B: '#22c55e', C: '#eab308', D: '#f97316', E: '#dc2626' };
  const EMP_LABELS   = { salaried: 'Salaried', self_employed: 'Self-employed / Contract', investment: 'Investment income', unknown: 'Unknown' };

  function expenseCatLabel(cat) {
    return { groceries: 'Groceries & shopping', fuel: 'Fuel & transport', utilities: 'Utilities & comms',
      insurance: 'Insurance & medical aid', entertainment: 'Entertainment & lifestyle',
      subscriptions: 'Subscriptions', other: 'Other spending' }[cat] || cat;
  }

  return (
    <CalcCard title="Qualify from Bank Statement">
      <p className="calc-desc">
        Upload a bank statement (CSV or PDF) and we'll build a full credit risk profile: income, debts, living costs, DTI ratio, and the maximum bond you likely qualify for — using the same SA NCA formula banks use.
      </p>
      <div
        className={`qualify-dropzone ${file ? 'qualify-dropzone--has-file' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={e => e.preventDefault()}
        onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setFile(f); }}
      >
        <input ref={inputRef} type="file" accept=".csv,.pdf" style={{ display: 'none' }} onChange={e => setFile(e.target.files[0])} />
        {file
          ? <><span style={{ color: 'var(--mint)' }}>✓</span><span style={{ fontWeight: 600 }}>{file.name}</span><span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Click to change</span></>
          : <><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><span style={{ fontWeight: 600 }}>Drop your bank statement here</span><span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>CSV or PDF · Export from your bank&apos;s internet banking</span></>
        }
      </div>
      <p className="qualify-banks-note">Supports ABSA, FNB, Nedbank, Standard Bank, Capitec</p>
      {error && <div style={{ fontSize: '0.875rem', color: 'var(--color-error)' }}>{error}</div>}
      <Button variant="lime" onClick={analyse} loading={loading} disabled={!file}>Analyse statement</Button>
      {loading && <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'center', margin: 0 }}>AI is reading your statement — this takes 60–90 seconds. Please keep this tab open.</p>}

      {result && (
        <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>

          {/* Risk grade + DTI bar */}
          {rp && (
            <div className="qualify-risk-header">
              <div className="qualify-grade-badge" style={{ borderColor: GRADE_COLORS[rp.grade] || '#6b7280', color: GRADE_COLORS[rp.grade] || '#6b7280' }}>
                <span className="qualify-grade-letter">{rp.grade}</span>
                <span className="qualify-grade-sub">Risk grade</span>
              </div>
              <div className="qualify-grade-info">
                <div className="qualify-grade-label">{rp.label}</div>
                <div className="qualify-dti-row">
                  <span>Debt-to-income ratio</span>
                  <strong style={{ color: rp.dti > 45 ? '#dc2626' : rp.dti > 35 ? '#f97316' : '#22c55e' }}>{rp.dti}%</strong>
                </div>
                <div className="qualify-dti-bar">
                  <div className="qualify-dti-bar__fill" style={{ width: `${Math.min(100, rp.dti)}%`, background: GRADE_COLORS[rp.grade] || '#6b7280' }} />
                </div>
                <div className="qualify-dti-scale">
                  <span>0%</span><span>25% good</span><span>45% high</span><span>60%+</span>
                </div>
              </div>
            </div>
          )}

          {/* Income card */}
          <div className="qualify-section">
            <div className="qualify-section__title">Income</div>
            {result.detected ? (
              <>
                <div className="qualify-detected__row">
                  <span>Monthly income detected</span>
                  <strong style={{ color: 'var(--mint)' }}>{fmt(result.income.monthlyAmount)}</strong>
                </div>
                <div className="qualify-detected__row">
                  <span>Employment type</span>
                  <strong>{EMP_LABELS[result.income.employmentType] || 'Unknown'}</strong>
                </div>
                <div className="qualify-detected__row">
                  <span>Income stability</span>
                  <strong>{rp?.incomeStability}</strong>
                </div>
                <div className="qualify-detected__row">
                  <span>Confidence</span>
                  <span className={`qualify-badge qualify-badge--${result.income.confidence}`}>{result.income.confidence}</span>
                </div>
              </>
            ) : (
              <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No regular income detected. Consider a longer statement period (3+ months).</p>
            )}
          </div>

          {/* Debts card */}
          <div className="qualify-section">
            <div className="qualify-section__title">Debt obligations</div>
            {result.existingMortgage?.detected && (
              <div className="qualify-detected__row">
                <span>Existing home loan{result.existingMortgage.lender ? ` (${result.existingMortgage.lender})` : ''}</span>
                <strong style={{ color: '#f97316' }}>{fmt(result.existingMortgage.avgAmount)}/mo</strong>
              </div>
            )}
            {result.debts?.items?.length > 0 ? result.debts.items.map((d, i) => (
              <div key={i} className="qualify-detected__row">
                <span className="qualify-debt-label">{d.payee}</span>
                <strong>{fmt(d.avgAmount)}/mo</strong>
              </div>
            )) : (
              <div className="qualify-detected__row">
                <span>No other loan repayments detected</span>
                <strong style={{ color: '#22c55e' }}>R 0/mo</strong>
              </div>
            )}
            {result.debts?.totalMonthly > 0 && (
              <div className="qualify-detected__row qualify-total-row">
                <span>Total monthly obligations</span>
                <strong>{fmt(result.debts.totalMonthly + (result.existingMortgage?.detected ? result.existingMortgage.avgAmount : 0))}/mo</strong>
              </div>
            )}
          </div>

          {/* Living expenses card */}
          {result.expenses?.total > 0 && (
            <div className="qualify-section">
              <div className="qualify-section__title">
                Living expenses detected
                {rp?.expenseRatio != null && (
                  <span className="qualify-section__sub">{rp.expenseRatio}% of income</span>
                )}
              </div>
              {Object.entries(result.expenses.breakdown).map(([cat, amt]) => (
                <div key={cat} className="qualify-detected__row">
                  <span>{expenseCatLabel(cat)}</span>
                  <strong>{fmt(amt)}/mo</strong>
                </div>
              ))}
              <div className="qualify-detected__row qualify-total-row">
                <span>Total living costs</span>
                <strong>{fmt(result.expenses.total)}/mo</strong>
              </div>
            </div>
          )}

          {/* Net disposable */}
          {rp?.netDisposable != null && result.detected && (
            <div className="qualify-section qualify-section--highlight">
              <div className="qualify-detected__row">
                <span>Gross income</span>
                <strong>{fmt(result.income.monthlyAmount)}</strong>
              </div>
              <div className="qualify-detected__row">
                <span>Minus debt obligations</span>
                <strong style={{ color: '#f97316' }}>− {fmt(rp.totalObligations)}</strong>
              </div>
              {result.expenses?.total > 0 && (
                <div className="qualify-detected__row">
                  <span>Minus living expenses</span>
                  <strong style={{ color: '#f97316' }}>− {fmt(result.expenses.total)}</strong>
                </div>
              )}
              <div className="qualify-detected__row qualify-total-row">
                <span>Net monthly disposable</span>
                <strong style={{ color: rp.netDisposable >= 0 ? '#22c55e' : '#dc2626' }}>
                  {rp.netDisposable >= 0 ? fmt(rp.netDisposable) : `−${fmt(Math.abs(rp.netDisposable))}`}
                </strong>
              </div>
            </div>
          )}

          {/* Bond qualification */}
          <div className="calc-result">
            <div className={`calc-verdict ${verdict === 'likely_qualify' ? 'green' : verdict === 'borderline' ? 'amber' : 'red'}`}>
              {result.qualification?.verdictLabel}
            </div>
            <ResultRow label="Maximum bond (qualified at stress rate)" value={fmt(result.qualification?.maxBond || 0)} accent />
            <ResultRow label="Max qualifying repayment (30% of income)"  value={fmt(result.qualification?.maxMonthly || 0)} />
            <ResultRow label="Est. monthly repayment at prime"           value={fmt(result.qualification?.monthlyAtPrime || 0)} />
            <PropertySearchCTA maxBond={result.qualification?.maxBond || 0} compact defaultExpanded />
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-3)' }}>
              SA banks qualify at stress rate ({fmtPct(stressRateLive)} — prime + 2%) and cap repayments at 30% of gross income minus existing debt obligations. Estimates only — for an accurate assessment, <Link to="/preapproval">apply for pre-approval</Link>.
            </p>
          </div>

          {/* Low-bond nudge — guide user to optimize before applying */}
          {(result.qualification?.maxBond || 0) > 0 && (result.qualification?.maxBond || 0) < 600000 && (
            <div style={{ background: 'rgba(200,168,75,0.08)', border: '1px solid rgba(200,168,75,0.25)', borderRadius: 10, padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>
                Improve your finances before applying — it's free
              </div>
              <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
                Your current bond estimate is below R600k, which limits your options in most SA markets. Our financial optimizer analyses your statement and gives you a personalised action plan — showing exactly what to change to qualify for more.
              </p>
              <button onClick={() => {
                if (result) { try { sessionStorage.setItem('bondly_optimizer_from_pa', JSON.stringify(result)); } catch {} }
                navigate('/optimize');
              }} style={{ display: 'inline-block', marginTop: 4, padding: '9px 18px', background: 'var(--lime)', color: 'var(--forest)', borderRadius: 7, fontWeight: 700, fontSize: '0.9rem', border: 'none', cursor: 'pointer', alignSelf: 'flex-start' }}>
                See my improvement plan →
              </button>
            </div>
          )}

        </div>
      )}

      {result && (
        <InlineFeedback context="qualify_statement" label="Did this statement analysis look accurate?" />
      )}
    </CalcCard>
  );
}


// ── Net Worth Timeline (data helper) ─────────────────────
// income    = monthly take-home pay (same for both scenarios — equal starting point)
// expenses  = monthly living costs (same for both — food, transport, etc.)
// disposable = income − expenses = what's left before housing
// Homeowner saves: max(0, disposable − mortgage) per month
// Renter saves:    max(0, disposable − rentNow) per month  (rentNow grows at rentIncrease% pa)
// Both invest their respective monthly savings at investReturn% pa.
// Homeowner net worth = equity (propValue − bondBalance) + liquid savings portfolio
// Renter net worth    = (deposit + upfront costs invested) + accumulated income savings
// Income and expenses both grow over time; bond payment stays fixed (key homeowner advantage).
function computeNetWorthTimeline({ price, deposit, upfrontCosts, rent, monthly, propGrowth, rentIncrease, investReturn, inflation, incomeGrowth, term, income, expenses }) {
  const bondAmt    = Math.max(0, price - deposit);
  const mortgageR  = PRIME_RATE / 100 / 12;
  const investR    = investReturn / 100 / 12;
  const incomeR    = incomeGrowth / 100;
  const inflR      = inflation / 100;

  let bondBalance     = bondAmt;
  let homeownerLiquid = 0;
  // Renter invests the deposit + the upfront costs they didn't spend on buying
  let renterSavings   = deposit + (upfrontCosts || 0);

  const yr0Renter = renterSavings;
  const points = [{ year: 0, homeowner: deposit, homeownerReal: deposit, renter: yr0Renter, renterReal: yr0Renter }];

  for (let yr = 0; yr < term; yr++) {
    for (let m = 0; m < 12; m++) {
      const t = yr + m / 12;

      // Income and living expenses grow annually
      const incomeNow   = income   * Math.pow(1 + incomeR, t);
      const expensesNow = expenses * Math.pow(1 + inflR,   t);
      const disposable  = incomeNow - expensesNow;

      // Amortise bond
      if (bondBalance > 0) {
        const ip = bondBalance * mortgageR;
        bondBalance = Math.max(0, bondBalance - (monthly - ip));
      }

      // Homeowner: compound liquid savings, add monthly surplus after bond
      const homeOwnerSave = Math.max(0, disposable - monthly);
      homeownerLiquid = homeownerLiquid * (1 + investR) + homeOwnerSave;

      // Renter: compound pot, add monthly surplus after rent (rent escalates each year)
      renterSavings = renterSavings * (1 + investR);
      const rentNow = rent * Math.pow(1 + rentIncrease / 100, t);
      renterSavings += Math.max(0, disposable - rentNow);
    }

    const propValue  = price * Math.pow(1 + propGrowth / 100, yr + 1);
    const homeNW     = (propValue - bondBalance) + homeownerLiquid;
    const inflFactor = Math.pow(1 + inflR, yr + 1);
    points.push({
      year:          yr + 1,
      homeowner:     homeNW,
      homeownerReal: homeNW / inflFactor,
      renter:        renterSavings,
      renterReal:    renterSavings / inflFactor,
    });
  }
  return points;
}

// ── Net Worth Over Time Chart ─────────────────────────────
function NetWorthChart({ data, term }) {
  const W = 560, H = 260;
  const PAD = { top: 20, right: 16, bottom: 40, left: 76 };
  const plotW = W - PAD.left - PAD.right;
  const plotH = H - PAD.top - PAD.bottom;

  // Scale Y axis on real values only — keeps the chart from being dominated by nominal figures
  const allVals = data.flatMap(d => [d.homeownerReal, d.renterReal]);
  const rawMin  = Math.min(...allVals);
  const rawMax  = Math.max(...allVals);
  const minVal  = rawMin < 0 ? rawMin * 1.08 : 0;
  const maxVal  = rawMax * 1.08;
  const range   = maxVal - minVal || 1;

  const xScale = yr => PAD.left + (yr / term) * plotW;
  const yScale = v  => PAD.top  + plotH - ((v - minVal) / range) * plotH;

  const buildPath = key =>
    data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xScale(d.year).toFixed(1)},${yScale(d[key]).toFixed(1)}`).join(' ');

  // Crossover on real values
  let crossoverYr = null;
  for (let i = 1; i < data.length; i++) {
    if (data[i - 1].homeownerReal < data[i - 1].renterReal && data[i].homeownerReal >= data[i].renterReal) {
      crossoverYr = data[i].year; break;
    }
  }

  // Y axis: 5 evenly-spaced ticks
  const ticks = Array.from({ length: 6 }, (_, i) => minVal + (range / 5) * i);

  function axisLabel(v) {
    const abs = Math.abs(v);
    const neg = v < -0.5 ? '−' : '';
    if (abs >= 1_000_000_000) return `${neg}R${(abs / 1_000_000_000).toFixed(1)}bn`;
    if (abs >= 1_000_000)     return `${neg}R${(abs / 1_000_000).toFixed(1)}m`;
    if (abs >= 1_000)         return `${neg}R${Math.round(abs / 1_000)}k`;
    if (abs < 0.5)            return 'R0';
    return `${neg}R${Math.round(abs)}`;
  }

  // X axis ticks
  const step = term > 15 ? 5 : term > 7 ? 2 : 1;
  const xTicks = [];
  for (let yr = 0; yr <= term; yr += step) xTicks.push(yr);
  if (!xTicks.includes(term)) xTicks.push(term);

  const final = data[data.length - 1];

  return (
    <div className="rvb-chart-wrap">
      <div className="rvb-chart-header">
        <div>
          <span className="rvb-chart-title">Net Worth Over Time</span>
          <span className="rvb-chart-subtitle">in today&apos;s money — inflation-adjusted</span>
        </div>
        <div className="rvb-chart-legend">
          <span className="rvb-legend-item">
            <span className="rvb-legend-dot rvb-legend-dot--owner" />
            Homeowner (equity + savings)
          </span>
          <span className="rvb-legend-item">
            <span className="rvb-legend-dot rvb-legend-dot--renter" />
            Renter savings
          </span>
          <span className="rvb-legend-item">
            <span className="rvb-legend-dot rvb-legend-dot--real" />
            Renter savings (nominal, for ref.)
          </span>
        </div>
      </div>

      <svg viewBox={`0 0 ${W} ${H}`} className="rvb-chart-svg">
        <defs>
          <clipPath id="rvb-plot">
            <rect x={PAD.left} y={PAD.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>
        {/* Y grid lines + labels */}
        {ticks.map((v, i) => (
          <g key={i}>
            <line
              x1={PAD.left} y1={yScale(v).toFixed(1)}
              x2={W - PAD.right} y2={yScale(v).toFixed(1)}
              stroke="var(--border-color)" strokeWidth="1"
              strokeDasharray={Math.abs(v) < 0.5 ? 'none' : '3,4'}
            />
            <text x={PAD.left - 6} y={yScale(v) + 4} textAnchor="end" fontSize="10" fill="var(--text-secondary)">
              {axisLabel(v)}
            </text>
          </g>
        ))}

        {/* Zero baseline */}
        <line x1={PAD.left} y1={yScale(0)} x2={W - PAD.right} y2={yScale(0)}
          stroke="var(--border-color)" strokeWidth="1.5" />

        {/* X axis */}
        {xTicks.map(yr => (
          <g key={yr}>
            <line x1={xScale(yr)} y1={PAD.top + plotH} x2={xScale(yr)} y2={PAD.top + plotH + 5}
              stroke="var(--border-color)" strokeWidth="1" />
            <text x={xScale(yr)} y={PAD.top + plotH + 17} textAnchor="middle" fontSize="11" fill="var(--text-secondary)">
              Yr {yr}
            </text>
          </g>
        ))}

        {/* Crossover marker */}
        {crossoverYr !== null && (
          <>
            <line
              x1={xScale(crossoverYr)} y1={PAD.top}
              x2={xScale(crossoverYr)} y2={PAD.top + plotH}
              stroke="#f59e0b" strokeWidth="1.5" strokeDasharray="3,3" opacity="0.8"
            />
            <text x={xScale(crossoverYr) + 5} y={PAD.top + 14} fontSize="10" fill="#f59e0b" fontWeight="600">
              Yr {crossoverYr}
            </text>
          </>
        )}

        {/* Lines clipped to plot area so they don't overflow Y axis bounds */}
        <g clipPath="url(#rvb-plot)">
          <path d={buildPath('renter')}        fill="none" className="rvb-path--real"   strokeWidth="1.5" strokeDasharray="6,4" />
          <path d={buildPath('renterReal')}    fill="none" className="rvb-path--renter" strokeWidth="2" />
          <path d={buildPath('homeownerReal')} fill="none" className="rvb-path--owner"  strokeWidth="2.5" />
        </g>
      </svg>

      <div className="rvb-chart-stats">
        <div className="rvb-chart-stat">
          <span>Homeowner net worth at yr {term} <span style={{ fontStyle: 'italic' }}>(today&apos;s money)</span></span>
          <strong className="rvb-stat--owner">{axisLabel(final.homeownerReal)}</strong>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{axisLabel(final.homeowner)} nominal</span>
        </div>
        <div className="rvb-chart-stat">
          <span>Renter savings at yr {term} <span style={{ fontStyle: 'italic' }}>(today&apos;s money)</span></span>
          <strong className="rvb-stat--renter">{axisLabel(final.renterReal)}</strong>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{axisLabel(final.renter)} nominal</span>
        </div>
        <div className="rvb-chart-stat">
          <span>Difference</span>
          <strong className={final.homeownerReal >= final.renterReal ? 'rvb-stat--owner' : 'rvb-stat--renter'}>
            {axisLabel(Math.abs(final.homeownerReal - final.renterReal))}
            {' '}{final.homeownerReal >= final.renterReal ? 'ahead buying' : 'ahead renting'}
          </strong>
        </div>
      </div>

      {crossoverYr !== null ? (
        <p className="rvb-chart-note">
          Homeowner net worth overtakes renter savings (in today&apos;s money) at <strong>Year {crossoverYr}</strong>.
          The dashed line shows renter savings in nominal rands — the gap between it and the solid line is the inflation penalty on cash savings.
        </p>
      ) : final.homeownerReal > final.renterReal ? (
        <p className="rvb-chart-note">
          Buying builds more real wealth throughout this scenario. Both figures are in today&apos;s purchasing power — the nominal renter line (dashed) shows how inflation quietly erodes the headline number.
        </p>
      ) : (
        <p className="rvb-chart-note">
          Renter savings outpace homeowner net worth here in real terms. This can happen when rent is low relative to the bond payment, or when investment returns are strong. The dashed nominal line shows the headline savings figure — real returns account for inflation erosion over time.
        </p>
      )}
    </div>
  );
}

// ── Amortisation Visualisation ────────────────────────────
// Shows interest vs principal split for sample years — no chart library.
// Helps users viscerally understand front-loading of interest.
function AmortVis({ principal, ratePercent, termYears, monthlyPayment }) {
  // Build a year-by-year summary from the amortisation schedule
  const schedule = calcAmortSchedule(principal, ratePercent, termYears);

  // Group monthly rows into annual totals
  function annualTotals(year) {
    const startMonth = (year - 1) * 12 + 1;
    const endMonth   = year * 12;
    let interestSum  = 0;
    let principalSum = 0;
    for (let i = startMonth - 1; i < endMonth && i < schedule.length; i++) {
      interestSum  += schedule[i].interest  || 0;
      principalSum += schedule[i].principal || 0;
    }
    return { interest: interestSum, principal: principalSum, total: interestSum + principalSum };
  }

  // Sample years: 1, 5, 10, 15, 20 — but only those within term
  const sampleYears = [1, 5, 10, 15, 20].filter(y => y <= termYears);
  const rows = sampleYears.map(yr => ({ year: yr, ...annualTotals(yr) }));

  // Max total for bar scaling
  const maxTotal = Math.max(...rows.map(r => r.total));

  // Year-1 interest for the takeaway line
  const yr1 = rows.find(r => r.year === 1);
  const yr1Interest = yr1 ? yr1.interest : 0;

  return (
    <div className="amort-vis fade-in">
      <div className="amort-vis__header">
        <span className="amort-vis__title">Where your repayments go — year by year</span>
        <div className="amort-vis__legend">
          <span className="amort-vis__legend-item">
            <span className="amort-vis__dot amort-vis__dot--interest" aria-hidden="true" />
            Interest
          </span>
          <span className="amort-vis__legend-item">
            <span className="amort-vis__dot amort-vis__dot--principal" aria-hidden="true" />
            Principal
          </span>
        </div>
      </div>

      <div className="amort-vis__bars" role="list" aria-label="Annual interest vs principal split">
        {rows.map(row => {
          const intPct  = maxTotal > 0 ? (row.interest  / maxTotal) * 100 : 0;
          const prinPct = maxTotal > 0 ? (row.principal / maxTotal) * 100 : 0;
          const intShare = row.total > 0 ? Math.round((row.interest / row.total) * 100) : 0;
          return (
            <div key={row.year} className="amort-vis__row" role="listitem">
              <div className="amort-vis__row-label" aria-label={`Year ${row.year}`}>
                Yr {row.year}
              </div>
              <div className="amort-vis__bar-track" aria-label={`${intShare}% interest, ${100 - intShare}% principal`}>
                <div
                  className="amort-vis__bar-segment amort-vis__bar-segment--interest"
                  style={{ width: `${intPct}%` }}
                  title={`Interest: ${fmt(row.interest)}`}
                />
                <div
                  className="amort-vis__bar-segment amort-vis__bar-segment--principal"
                  style={{ width: `${prinPct}%` }}
                  title={`Principal: ${fmt(row.principal)}`}
                />
              </div>
              <div className="amort-vis__row-values">
                <span className="amort-vis__val--interest">{fmt(Math.round(row.interest))}</span>
                <span className="amort-vis__val-sep">·</span>
                <span className="amort-vis__val--principal">{fmt(Math.round(row.principal))}</span>
              </div>
            </div>
          );
        })}
      </div>

      {yr1Interest > 0 && (
        <div className="amort-vis__takeaway">
          In year 1 you pay <strong>{fmt(Math.round(yr1Interest))}</strong> in interest — switching to a lower rate cuts this directly.{' '}
          <a href="/tools/bond-swap-calculator" className="amort-vis__takeaway-link">See how much you'd save →</a>
        </div>
      )}
    </div>
  );
}

// ── Shared sub-components ─────────────────────────────────
function CalcCard({ title, children }) {
  return (
    <Card className="fade-in">
      <CardHeader>{title}</CardHeader>
      <CardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {children}
        </div>
      </CardBody>
    </Card>
  );
}

function ResultRow({ label, value, accent, sub }) {
  return (
    <div className={`result-row ${accent ? 'result-row--accent' : ''}`}>
      <span>{label}</span>
      <span>
        <strong>{value}</strong>
        {sub && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginLeft: 6 }}>{sub}</span>}
      </span>
    </div>
  );
}
