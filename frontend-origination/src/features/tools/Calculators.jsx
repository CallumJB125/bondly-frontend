import { useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import OriginationNav from '../../components/OriginationNav.jsx';
import { calcMonthly, calcTotalInterest, calcTransferDuty, calcUpfrontCosts, calcAmortSchedule, calcMaxBond, calcAffordability } from '@bondly/ui/lib/finance.js';
import { PRIME_RATE, STRESS_RATE } from '@bondly/ui/lib/constants.js';
import { fmt, parseNum } from '@bondly/ui/lib/format.js';
import './Calculators.css';

// ── Tab config ────────────────────────────────────────────
const TABS = [
  { slug: 'repayment',      label: 'Repayment' },
  { slug: 'affordability',  label: 'Affordability' },
  { slug: 'borrowing-power', label: 'What can I borrow?' },
  { slug: 'rent-vs-buy',    label: 'Rent vs Buy' },
  { slug: 'transfer-duty',  label: 'Transfer duty' },
  { slug: 'upfront-costs',  label: 'Upfront costs' },
];

// ── Inline SVG icons ──────────────────────────────────────
function IconCalc() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="4" y="2" width="16" height="20" rx="2" />
      <line x1="8" y1="6" x2="16" y2="6" />
      <line x1="8" y1="10" x2="10" y2="10" />
      <line x1="14" y1="10" x2="16" y2="10" />
      <line x1="8" y1="14" x2="10" y2="14" />
      <line x1="14" y1="14" x2="16" y2="14" />
      <line x1="8" y1="18" x2="10" y2="18" />
      <line x1="14" y1="18" x2="16" y2="18" />
    </svg>
  );
}
function IconArrow() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

// ── Shared CTA ────────────────────────────────────────────
function CalcCTA() {
  return (
    <div className="calc-cta">
      <p className="calc-cta__text">Ready to take the next step?</p>
      <Link to="/preapproval" className="calc-cta__btn">
        Start your free pre-approval <IconArrow />
      </Link>
    </div>
  );
}

// ── Caveat ────────────────────────────────────────────────
function Caveat({ extra }) {
  return (
    <p className="calc-caveat">
      Estimate only — actual figures depend on your lender, credit profile, and market conditions.
      {extra && <> {extra}</>}
    </p>
  );
}

// ═══════════════════════════════════════════════════════════
// 1. REPAYMENT CALCULATOR
// ═══════════════════════════════════════════════════════════
function RepaymentCalc() {
  const [amount,   setAmount]   = useState('');
  const [rate,     setRate]     = useState(String(PRIME_RATE));
  const [term,     setTerm]     = useState('20');
  const [result,   setResult]   = useState(null);

  const calculate = useCallback(() => {
    const a = parseNum(amount);
    const r = parseNum(rate, PRIME_RATE);
    const t = parseNum(term, 20);
    if (!a || a <= 0) return;
    const monthly      = calcMonthly(a, r, t);
    const totalInterest = calcTotalInterest(a, r, t);
    const totalRepaid  = monthly * t * 12;

    // Amort data for visual: year 1 vs midpoint vs final year
    const schedule = calcAmortSchedule(a, r, t);
    const yr1 = schedule.slice(0, 12);
    const midStart = Math.floor(t / 2) * 12;
    const yrMid = schedule.slice(midStart, midStart + 12);
    const yrLast = schedule.slice(-12);

    function yearSplit(rows) {
      const totI = rows.reduce((s, r) => s + r.interest, 0);
      const totP = rows.reduce((s, r) => s + r.principal, 0);
      const tot  = totI + totP;
      return { iPct: tot > 0 ? (totI / tot) * 100 : 50, pPct: tot > 0 ? (totP / tot) * 100 : 50 };
    }

    setResult({
      monthly, totalInterest, totalRepaid,
      yr1:  yearSplit(yr1),
      yrMid: yearSplit(yrMid),
      yrLast: yearSplit(yrLast),
      midYear: Math.floor(t / 2),
      term: t,
    });
  }, [amount, rate, term]);

  return (
    <div className="calc-body">
      <div className="calc-fields">
        <div className="calc-field">
          <label className="calc-label" htmlFor="rep-amount">Bond amount</label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input
              id="rep-amount"
              className="calc-input calc-input--prefix"
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1 200 000"
              value={amount}
              onChange={e => setAmount(e.target.value)}
            />
          </div>
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="rep-rate">
            Interest rate
            <span className="calc-label__note">Default: prime {PRIME_RATE}%</span>
          </label>
          <div className="calc-input-wrap">
            <input
              id="rep-rate"
              className="calc-input calc-input--suffix"
              type="text"
              inputMode="decimal"
              value={rate}
              onChange={e => setRate(e.target.value)}
            />
            <span className="calc-suffix">%</span>
          </div>
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="rep-term">
            Loan term
            <span className="calc-label__note">Default: 20 years</span>
          </label>
          <div className="calc-input-wrap">
            <input
              id="rep-term"
              className="calc-input calc-input--suffix"
              type="text"
              inputMode="numeric"
              value={term}
              onChange={e => setTerm(e.target.value)}
            />
            <span className="calc-suffix">yrs</span>
          </div>
        </div>
        <button className="calc-btn" onClick={calculate}>
          Calculate repayment
        </button>
      </div>

      {result ? (
        <div className="calc-results">
          <div className="calc-results__primary">
            <span className="calc-results__label">Monthly repayment</span>
            <span className="calc-results__value">{fmt(result.monthly)}</span>
          </div>
          <div className="calc-results__row">
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Total repaid</span>
              <span className="calc-results__stat-val">{fmt(result.totalRepaid)}</span>
            </div>
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Total interest</span>
              <span className="calc-results__stat-val calc-results__stat-val--accent">{fmt(result.totalInterest)}</span>
            </div>
          </div>

          {/* Amortisation visual */}
          <div className="amort">
            <p className="amort__heading">How your payment splits over time</p>
            <div className="amort__bars">
              {[
                { label: 'Year 1',           data: result.yr1 },
                { label: `Year ${result.midYear}`, data: result.yrMid },
                { label: `Year ${result.term}`,    data: result.yrLast },
              ].map(({ label, data }) => (
                <div className="amort__bar-group" key={label}>
                  <span className="amort__bar-label">{label}</span>
                  <div className="amort__bar" role="img" aria-label={`${label}: ${Math.round(data.iPct)}% interest, ${Math.round(data.pPct)}% principal`}>
                    <div className="amort__segment amort__segment--interest" style={{ width: `${data.iPct}%` }} />
                    <div className="amort__segment amort__segment--principal" style={{ width: `${data.pPct}%` }} />
                  </div>
                  <span className="amort__bar-pct">{Math.round(data.iPct)}% interest</span>
                </div>
              ))}
            </div>
            <div className="amort__legend">
              <span className="amort__legend-item amort__legend-item--interest">Interest</span>
              <span className="amort__legend-item amort__legend-item--principal">Principal</span>
            </div>
          </div>

          <Caveat extra="Interest/principal split uses standard amortisation at the rate entered." />
          <CalcCTA />
        </div>
      ) : (
        <div className="calc-placeholder">
          <IconCalc />
          <p>Results will appear here once you enter a bond amount above.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 2. TRANSFER DUTY CALCULATOR
// ═══════════════════════════════════════════════════════════
function TransferDutyCalc() {
  const [price,  setPrice]  = useState('');
  const [tried,  setTried]  = useState(false);
  const [result, setResult] = useState(null);

  const p = parseNum(price);
  const priceEmpty = !price || p <= 0;

  const calculate = useCallback(() => {
    setTried(true);
    if (priceEmpty) return;
    const duty = calcTransferDuty(p);
    setResult({ price: p, duty });
  }, [price, p, priceEmpty]);

  // Bracket table for reference
  const BRACKETS = [
    { range: 'Up to R 1 210 000',                rate: '0%',  note: 'Exempt' },
    { range: 'R 1 210 001 – R 1 663 800',         rate: '3%',  note: 'above R 1 210 000' },
    { range: 'R 1 663 801 – R 2 329 300',         rate: '6%',  note: 'above R 1 663 800' },
    { range: 'R 2 329 301 – R 2 994 800',         rate: '8%',  note: 'above R 2 329 300' },
    { range: 'R 2 994 801 – R 13 310 000',        rate: '11%', note: 'above R 2 994 800' },
    { range: 'Above R 13 310 000',                rate: '13%', note: 'above R 13 310 000' },
  ];

  return (
    <div className="calc-body">
      <div className="calc-fields">
        <div className="calc-field">
          <label className="calc-label" htmlFor="td-price">
            Property purchase price
            <span className="calc-label__note">SARS 2025/26 tables</span>
          </label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input
              id="td-price"
              className={`calc-input calc-input--prefix${tried && priceEmpty ? ' calc-input--error' : ''}`}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1 500 000"
              value={price}
              onChange={e => { setPrice(e.target.value); setTried(false); }}
            />
          </div>
          {tried && priceEmpty && <p className="calc-field-error">Enter a property price to calculate.</p>}
        </div>
        <button className="calc-btn" onClick={calculate}>
          Calculate transfer duty
        </button>
      </div>

      {result ? (
        <div className="calc-results">
          {result.duty === 0 ? (
            <div className="calc-results__primary calc-results__primary--good">
              <span className="calc-results__label">Transfer duty</span>
              <span className="calc-results__value">R 0</span>
              <span className="calc-results__sub">Properties below R 1 210 000 are exempt from transfer duty (2025/26)</span>
            </div>
          ) : (
            <>
              <div className="calc-results__primary">
                <span className="calc-results__label">Transfer duty payable</span>
                <span className="calc-results__value">{fmt(result.duty)}</span>
              </div>
              <div className="calc-results__row">
                <div className="calc-results__stat">
                  <span className="calc-results__stat-label">Purchase price</span>
                  <span className="calc-results__stat-val">{fmt(result.price)}</span>
                </div>
                <div className="calc-results__stat">
                  <span className="calc-results__stat-label">Duty as % of price</span>
                  <span className="calc-results__stat-val">{(result.duty / result.price * 100).toFixed(2)}%</span>
                </div>
              </div>
            </>
          )}

          {/* Bracket reference */}
          <div className="duty-brackets">
            <p className="duty-brackets__heading">SARS 2025/26 transfer duty brackets</p>
            <div className="duty-brackets__table">
              {BRACKETS.map((b, i) => {
                const isActive = result.duty > 0 && (
                  (i === 0 && result.duty === 0) ||
                  (i === 1 && result.price > 1_210_000 && result.price <= 1_663_800) ||
                  (i === 2 && result.price > 1_663_800 && result.price <= 2_329_300) ||
                  (i === 3 && result.price > 2_329_300 && result.price <= 2_994_800) ||
                  (i === 4 && result.price > 2_994_800 && result.price <= 13_310_000) ||
                  (i === 5 && result.price > 13_310_000)
                ) || (i === 0 && result.price <= 1_210_000);
                return (
                  <div className={`duty-row${isActive ? ' duty-row--active' : ''}`} key={i}>
                    <span className="duty-row__range">{b.range}</span>
                    <span className="duty-row__rate">{b.rate}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <Caveat extra="Transfer duty is paid to SARS within 6 months of the sale agreement." />
          <CalcCTA />
        </div>
      ) : (
        <div className="calc-placeholder">
          <IconCalc />
          <p>Results will appear here once you enter a property price above.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 3. UPFRONT COSTS / DEPOSIT CALCULATOR
// ═══════════════════════════════════════════════════════════
function UpfrontCostsCalc() {
  const [price,      setPrice]      = useState('');
  const [depositPct, setDepositPct] = useState('10');
  const [tried,      setTried]      = useState(false);
  const [result,     setResult]     = useState(null);

  const p = parseNum(price);
  const priceEmpty = !price || p <= 0;
  const priceTooLow = p > 0 && p < 50_000;
  const rawDpPct = parseNum(depositPct, 0);
  const dpPct = Math.min(100, Math.max(0, rawDpPct));
  const depositTooHigh = rawDpPct > 100;

  const calculate = useCallback(() => {
    setTried(true);
    if (priceEmpty || priceTooLow) return;
    const deposit = Math.round(p * dpPct / 100);
    const bondAmt = Math.max(0, p - deposit);
    const costs   = calcUpfrontCosts(p, bondAmt);
    setResult({ price: p, deposit, bondAmt, dpPct, ...costs });
  }, [price, depositPct, p, dpPct, priceEmpty]);

  return (
    <div className="calc-body">
      <div className="calc-fields">
        <div className="calc-field">
          <label className="calc-label" htmlFor="uc-price">Property purchase price</label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input
              id="uc-price"
              className={`calc-input calc-input--prefix${tried && priceEmpty ? ' calc-input--error' : ''}`}
              type="text"
              inputMode="decimal"
              placeholder="e.g. 1 200 000"
              value={price}
              onChange={e => { setPrice(e.target.value); setTried(false); }}
            />
          </div>
          {tried && priceEmpty && <p className="calc-field-error">Enter a property price to calculate.</p>}
          {priceTooLow && <p className="calc-field-error">Property price seems too low — please enter the full purchase price.</p>}
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="uc-deposit">
            Deposit (optional)
            <span className="calc-label__note">Leave at 0% for 100% bond</span>
          </label>
          <div className="calc-input-wrap">
            <input
              id="uc-deposit"
              className={`calc-input calc-input--suffix${depositTooHigh ? ' calc-input--error' : ''}`}
              type="text"
              inputMode="decimal"
              value={depositPct}
              onChange={e => setDepositPct(e.target.value)}
            />
            <span className="calc-suffix">%</span>
          </div>
          {depositTooHigh && <p className="calc-field-error">Deposit cannot exceed 100% of the purchase price.</p>}
        </div>
        <button className="calc-btn" onClick={calculate}>
          Show total upfront costs
        </button>
      </div>

      {result ? (
        <div className="calc-results">
          {/* Grand total — most important figure */}
          <div className="calc-results__primary">
            <span className="calc-results__label">Total cash needed on day of transfer</span>
            <span className="calc-results__value">{fmt(result.deposit + result.total)}</span>
          </div>

          {/* Line-by-line breakdown */}
          <div className="upfront-breakdown">
            <p className="upfront-breakdown__heading">Full breakdown</p>
            {[
              {
                label: 'Deposit',
                val:   result.deposit,
                note:  `${result.dpPct}% of purchase price`,
                highlight: result.deposit > 0,
              },
              {
                label: 'Transfer duty (SARS 2025/26)',
                val:   result.duty,
                note:  result.duty === 0 ? 'Exempt — property below R 1 210 000' : 'Payable to SARS',
              },
              {
                label: 'Bond registration costs',
                val:   result.bondReg,
                note:  'New bond registration with Deeds Office',
              },
              {
                label: 'Transfer attorney fees',
                val:   result.transferFee,
                note:  'Conveyancer + Deeds Office costs',
              },
            ].map(({ label, val, note, highlight }) => (
              <div className={`upfront-row${highlight ? ' upfront-row--highlight' : ''}`} key={label}>
                <div className="upfront-row__left">
                  <span className="upfront-row__label">{label}</span>
                  {note && <span className="upfront-row__note">{note}</span>}
                </div>
                <span className="upfront-row__val">{fmt(val)}</span>
              </div>
            ))}
            <div className="upfront-row upfront-row--total">
              <span className="upfront-row__label">Total cash required</span>
              <span className="upfront-row__val">{fmt(result.deposit + result.total)}</span>
            </div>
          </div>

          <div className="calc-results__row">
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Bond amount needed</span>
              <span className="calc-results__stat-val">{fmt(result.bondAmt)}</span>
            </div>
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Excl. deposit (fees only)</span>
              <span className="calc-results__stat-val">{fmt(result.total)}</span>
            </div>
          </div>

          <Caveat extra="Bond registration and attorney fees are estimates; actual quotes may vary by conveyancer." />
          <CalcCTA />
        </div>
      ) : (
        <div className="calc-placeholder">
          <IconCalc />
          <p>Results will appear here — see exactly how much cash you need on transfer day.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 4. AFFORDABILITY CALCULATOR
// ═══════════════════════════════════════════════════════════
const MAX_SALARY = 5_000_000;

function AffordabilityCalc() {
  const [income,  setIncome]  = useState('');
  const [debt,    setDebt]    = useState('');
  const [deposit, setDeposit] = useState('');
  const [tried,   setTried]   = useState(false);
  const [result,  setResult]  = useState(null);

  const inc = parseNum(income);
  const incomeEmpty = !income || inc <= 0;
  const incomeTooHigh = inc > MAX_SALARY;

  const calculate = useCallback(() => {
    setTried(true);
    if (incomeEmpty || incomeTooHigh) return;
    const d   = parseNum(debt, 0);
    const dep = parseNum(deposit, 0);
    const res = calcAffordability(inc, 0, dep, d, 20);
    const maxBond = calcMaxBond(res.maxMonthly, PRIME_RATE, 20);
    setResult({ ...res, maxBond, prime: PRIME_RATE });
  }, [income, debt, deposit, inc, incomeEmpty, incomeTooHigh]);

  return (
    <div className="calc-body">
      <div className="calc-fields">
        <div className="calc-field">
          <label className="calc-label" htmlFor="aff-income">
            Monthly gross income
            <span className="calc-label__note">Before tax (from payslip)</span>
          </label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input id="aff-income"
              className={`calc-input calc-input--prefix${(tried && incomeEmpty) || incomeTooHigh ? ' calc-input--error' : ''}`}
              type="text" inputMode="decimal"
              placeholder="e.g. 45 000" value={income}
              onChange={e => { setIncome(e.target.value); setTried(false); }} />
          </div>
          {tried && incomeEmpty && <p className="calc-field-error">Enter your monthly gross income.</p>}
          {incomeTooHigh && <p className="calc-field-error">Income above R 5 000 000/month — please double-check your entry.</p>}
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="aff-debt">
            Monthly debt payments
            <span className="calc-label__note">Car, personal loans, credit cards</span>
          </label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input id="aff-debt" className="calc-input calc-input--prefix" type="text" inputMode="decimal"
              placeholder="e.g. 3 500" value={debt} onChange={e => setDebt(e.target.value)} />
          </div>
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="aff-deposit">
            Deposit available (optional)
          </label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input id="aff-deposit" className="calc-input calc-input--prefix" type="text" inputMode="decimal"
              placeholder="e.g. 100 000" value={deposit} onChange={e => setDeposit(e.target.value)} />
          </div>
        </div>
        <button className="calc-btn" onClick={calculate}>Calculate affordability</button>
      </div>

      {result ? (
        <div className="calc-results">
          <div className="calc-results__primary">
            <span className="calc-results__label">Maximum bond you qualify for</span>
            <span className="calc-results__value">{fmt(result.maxBond)}</span>
          </div>
          <div className="calc-results__row">
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Max monthly repayment</span>
              <span className="calc-results__stat-val">{fmt(result.maxMonthly)}</span>
            </div>
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Rate used (prime)</span>
              <span className="calc-results__stat-val">{result.prime}%</span>
            </div>
          </div>
          {parseNum(deposit) > 0 && (
            <div className="calc-results__row">
              <div className="calc-results__stat">
                <span className="calc-results__stat-label">Max property price</span>
                <span className="calc-results__stat-val">{fmt(result.maxBond + parseNum(deposit))}</span>
              </div>
            </div>
          )}
          <Caveat extra="Banks qualify bonds at prime + 2% stress rate and cap repayments at ~30% of gross income." />
          <CalcCTA />
        </div>
      ) : (
        <div className="calc-placeholder">
          <IconCalc />
          <p>Enter your income above to see your maximum bond amount.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// 5. RENT VS BUY CALCULATOR
// ═══════════════════════════════════════════════════════════
function RentVsBuyCalc() {
  const [rent,       setRent]       = useState('');
  const [price,      setPrice]      = useState('');
  const [depositPct, setDepositPct] = useState('10');
  const [years,      setYears]      = useState('10');
  const [result,     setResult]     = useState(null);

  const calculate = useCallback(() => {
    const r   = parseNum(rent);
    const p   = parseNum(price);
    if (!r || !p || r <= 0 || p <= 0) return;
    const dep     = Math.round(p * parseNum(depositPct, 0) / 100);
    const bond    = Math.max(0, p - dep);
    const yrs     = Math.max(1, parseNum(years, 10));
    const monthly = calcMonthly(bond, PRIME_RATE, 20);
    const costs   = calcUpfrontCosts(p, bond);
    const totalBuy  = dep + costs.total + monthly * yrs * 12;
    const totalRent = r * yrs * 12;
    const appreciation = p * (Math.pow(1.06, yrs) - 1); // 6% pa SA average
    const netBuy    = totalBuy - appreciation;
    setResult({ totalBuy, totalRent, netBuy, appreciation, monthly, dep, yrs, bond });
  }, [rent, price, depositPct, years]);

  return (
    <div className="calc-body">
      <div className="calc-fields">
        <div className="calc-field">
          <label className="calc-label" htmlFor="rvb-rent">Monthly rent</label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input id="rvb-rent" className="calc-input calc-input--prefix" type="text" inputMode="decimal"
              placeholder="e.g. 12 000" value={rent} onChange={e => setRent(e.target.value)} />
          </div>
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="rvb-price">Property purchase price</label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input id="rvb-price" className="calc-input calc-input--prefix" type="text" inputMode="decimal"
              placeholder="e.g. 1 500 000" value={price} onChange={e => setPrice(e.target.value)} />
          </div>
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="rvb-deposit">Deposit</label>
          <div className="calc-input-wrap">
            <input id="rvb-deposit" className="calc-input calc-input--suffix" type="text" inputMode="decimal"
              value={depositPct} onChange={e => setDepositPct(e.target.value)} />
            <span className="calc-suffix">%</span>
          </div>
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="rvb-years">Time horizon</label>
          <div className="calc-input-wrap">
            <input id="rvb-years" className="calc-input calc-input--suffix" type="text" inputMode="numeric"
              value={years} onChange={e => setYears(e.target.value)} />
            <span className="calc-suffix">yrs</span>
          </div>
        </div>
        <button className="calc-btn" onClick={calculate}>Compare rent vs buy</button>
      </div>

      {result ? (
        <div className="calc-results">
          <div className="calc-results__row">
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Total cost to rent ({result.yrs} yrs)</span>
              <span className="calc-results__stat-val">{fmt(result.totalRent)}</span>
            </div>
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Total cost to buy</span>
              <span className="calc-results__stat-val">{fmt(result.totalBuy)}</span>
            </div>
          </div>
          <div className="calc-results__primary">
            <span className="calc-results__label">Net cost to buy (after property growth)</span>
            <span className={`calc-results__value${result.netBuy < result.totalRent ? ' calc-results__value--good' : ''}`}>
              {fmt(result.netBuy)}
            </span>
          </div>
          <div className="calc-results__row">
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Est. property appreciation (6% pa)</span>
              <span className="calc-results__stat-val calc-results__stat-val--accent">{fmt(result.appreciation)}</span>
            </div>
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Monthly bond repayment</span>
              <span className="calc-results__stat-val">{fmt(result.monthly)}</span>
            </div>
          </div>
          <p className="calc-insight">
            {result.netBuy < result.totalRent
              ? `Buying is estimated to cost ${fmt(result.totalRent - result.netBuy)} less than renting over ${result.yrs} years after property growth.`
              : `Renting costs ${fmt(result.totalBuy - result.totalRent)} less upfront over ${result.yrs} years — but you build no equity.`
            }
          </p>
          <Caveat extra="Property appreciation assumed at 6% pa (SA average). Actual returns vary. Does not include rates, levies, or maintenance." />
          <CalcCTA />
        </div>
      ) : (
        <div className="calc-placeholder">
          <IconCalc />
          <p>Enter your rent and a property price to compare the true cost of each option.</p>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
// MAIN CALCULATORS PAGE
// ═══════════════════════════════════════════════════════════
// ── Borrowing power (reverse affordability) ───────────────
// Works backwards from a repayment the user is comfortable with to the bond +
// house price it supports. Shows both the figure at the entered/prime rate and
// the conservative bank-stress figure (what they're realistically approved for).
function BorrowingPowerCalc() {
  const [monthly, setMonthly] = useState('');
  const [deposit, setDeposit] = useState('');
  const [rate,    setRate]    = useState(String(PRIME_RATE));
  const [term,    setTerm]    = useState('20');
  const [result,  setResult]  = useState(null);

  const calculate = useCallback(() => {
    const m   = parseNum(monthly);
    const dep = parseNum(deposit, 0);
    const r   = parseNum(rate, PRIME_RATE);
    const t   = parseNum(term, 20);
    if (!m || m <= 0) return;
    const bondAtRate   = calcMaxBond(m, r, t);
    const bondAtStress = calcMaxBond(m, STRESS_RATE, t);
    setResult({
      bondAtRate,
      bondAtStress,
      housePrice:       bondAtRate + dep,
      housePriceStress: bondAtStress + dep,
      deposit: dep,
    });
  }, [monthly, deposit, rate, term]);

  return (
    <div className="calc-body">
      <div className="calc-fields">
        <div className="calc-field">
          <label className="calc-label" htmlFor="bp-monthly">Monthly repayment you’re comfortable with</label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input id="bp-monthly" className="calc-input calc-input--prefix" type="number" min="0" placeholder="e.g. 12 000" value={monthly} onChange={e => setMonthly(e.target.value)} />
          </div>
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="bp-deposit">
            Deposit available
            <span className="calc-label__note">Optional</span>
          </label>
          <div className="calc-input-wrap">
            <span className="calc-prefix">R</span>
            <input id="bp-deposit" className="calc-input calc-input--prefix" type="number" min="0" placeholder="e.g. 150 000" value={deposit} onChange={e => setDeposit(e.target.value)} />
          </div>
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="bp-rate">
            Interest rate
            <span className="calc-label__note">Default: prime {PRIME_RATE}%</span>
          </label>
          <div className="calc-input-wrap">
            <input id="bp-rate" className="calc-input calc-input--suffix" type="number" step="0.25" min="1" max="30" value={rate} onChange={e => setRate(e.target.value)} />
            <span className="calc-suffix">%</span>
          </div>
        </div>
        <div className="calc-field">
          <label className="calc-label" htmlFor="bp-term">
            Loan term
            <span className="calc-label__note">Default: 20 years</span>
          </label>
          <div className="calc-input-wrap">
            <input id="bp-term" className="calc-input calc-input--suffix" type="number" min="5" max="30" value={term} onChange={e => setTerm(e.target.value)} />
            <span className="calc-suffix">yrs</span>
          </div>
        </div>
        <button className="calc-btn" onClick={calculate}>Calculate what I can borrow</button>
      </div>

      {result ? (
        <div className="calc-results">
          <div className="calc-results__primary">
            <span className="calc-results__label">Bond you could afford</span>
            <span className="calc-results__value">{fmt(result.bondAtRate)}</span>
          </div>
          <div className="calc-results__row">
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Target house price{result.deposit > 0 ? ' (incl. deposit)' : ''}</span>
              <span className="calc-results__stat-val">{fmt(result.housePrice)}</span>
            </div>
            <div className="calc-results__stat">
              <span className="calc-results__stat-label">Bank-stress estimate (at {STRESS_RATE}%)</span>
              <span className="calc-results__stat-val calc-results__stat-val--accent">{fmt(result.bondAtStress)}</span>
            </div>
          </div>
          <Caveat extra={`Banks assess affordability at a stress rate of about ${STRESS_RATE}%, so the conservative figure is closer to what you'll actually be approved for. A deposit increases the house price you can target.`} />
          <CalcCTA />
        </div>
      ) : (
        <div className="calc-placeholder">
          <IconCalc />
          <p>Enter a monthly repayment above to see the bond and house price it supports.</p>
        </div>
      )}
    </div>
  );
}

const CALC_COMPONENTS = {
  'repayment':       RepaymentCalc,
  'affordability':   AffordabilityCalc,
  'borrowing-power': BorrowingPowerCalc,
  'rent-vs-buy':   RentVsBuyCalc,
  'transfer-duty': TransferDutyCalc,
  'upfront-costs': UpfrontCostsCalc,
};

const CALC_DESCRIPTIONS = {
  'repayment':     'See your monthly bond repayment, total cost, and how your payments shift from interest to principal over time.',
  'affordability': 'Find out the maximum bond you qualify for based on your income, existing debt, and deposit.',
  'borrowing-power': 'Work backwards from a monthly repayment you’re comfortable with to the bond amount and house price it supports — the reverse of the affordability calculator.',
  'rent-vs-buy':   'Compare the true long-term cost of renting vs buying — including property growth, upfront costs, and monthly repayments.',
  'transfer-duty': 'Calculate the SARS transfer duty payable on your property purchase (2025/26 brackets).',
  'upfront-costs': 'See every rand of cash you need on transfer day — deposit, transfer duty, bond registration, and attorney fees.',
};

export default function Calculators() {
  const { tool } = useParams();
  const navigate  = useNavigate();

  const activeSlug = TABS.find(t => t.slug === tool)?.slug ?? 'repayment';
  const ActiveCalc = CALC_COMPONENTS[activeSlug];

  return (
    <div className="calcs-page">
      <OriginationNav />

      <main className="calcs-main">
        {/* Page title */}
        <div className="calcs-hero">
          <h1 className="calcs-hero__title">First-home calculators</h1>
          <p className="calcs-hero__sub">Free tools to help you understand the real costs of buying your first home in South Africa.</p>
        </div>

        {/* Tab bar */}
        <div className="calcs-tabs" role="tablist" aria-label="Calculator tabs">
          {TABS.map(t => (
            <button
              key={t.slug}
              role="tab"
              aria-selected={t.slug === activeSlug}
              aria-controls={`calc-panel-${t.slug}`}
              className={`calcs-tab${t.slug === activeSlug ? ' calcs-tab--active' : ''}`}
              onClick={() => navigate(`/tools/${t.slug}`)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Calculator panel */}
        <div
          className="calcs-panel"
          id={`calc-panel-${activeSlug}`}
          role="tabpanel"
          aria-label={TABS.find(t => t.slug === activeSlug)?.label}
        >
          <p className="calcs-panel__desc">{CALC_DESCRIPTIONS[activeSlug]}</p>
          <ActiveCalc />
        </div>
      </main>

      <footer className="calcs-footer">
        <p>
          <Link to="/">Bondly Home</Link>
          <span className="calcs-footer__sep">·</span>
          <Link to="/mortgage-readiness">Affordability check</Link>
          <span className="calcs-footer__sep">·</span>
          <Link to="/first-time-buyer-guide">First-home guide</Link>
          <span className="calcs-footer__sep">·</span>
          <Link to="/faq">FAQ</Link>
          <span className="calcs-footer__sep">·</span>
          <Link to="/preapproval">Pre-approval</Link>
        </p>
        <p className="calcs-footer__legal">© {new Date().getFullYear()} Bondly Home. All calculators provide estimates only.</p>
      </footer>
    </div>
  );
}
