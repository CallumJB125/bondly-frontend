import { useState, useEffect } from 'react';
import { loans as loansApi } from '../../lib/api.js';
import { useDebtOptimizer, useFinancialHealth } from './hooks/useFinanceQueries.js';
import { fmt, fmtPct } from '../../lib/format.js';
import './DebtCommander.css';

function DTIGauge({ dti }) {
  const color = dti <= 35 ? '#22c55e' : dti <= 50 ? '#eab308' : '#ef4444';
  const label = dti <= 35 ? 'Healthy' : dti <= 50 ? 'Elevated' : 'High risk';
  const pct   = Math.min(100, dti);
  const r = 36, circ = 2 * Math.PI * r;
  return (
    <div className="dc-gauge">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${circ * pct / 100} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="44" y="40" textAnchor="middle" fill={color} fontSize="14" fontWeight="800">{dti}%</text>
        <text x="44" y="53" textAnchor="middle" fill="var(--color-text-muted)" fontSize="9">DTI</text>
      </svg>
      <div className="dc-gauge__label" style={{ color }}>{label}</div>
      <div className="dc-gauge__sub">Debt-to-income</div>
    </div>
  );
}

const DEBT_FIELDS = [
  { key: 'bondBalance', label: 'Bond',         rate: 11.75, locked: true },
  { key: 'carLoan',     label: 'Car loan',      rate: 14,    placeholder: 'R 0' },
  { key: 'creditCard',  label: 'Credit card',   rate: 22,    placeholder: 'R 0' },
  { key: 'storeCard',   label: 'Store account', rate: 24,    placeholder: 'R 0' },
  { key: 'personalLoan',label: 'Personal loan', rate: 18,    placeholder: 'R 0' },
];

function calcMonthlyPayment(balance, annualRate, years = 5) {
  const r = annualRate / 100 / 12;
  const n = years * 12;
  if (r === 0) return balance / n;
  return balance * (r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
}

export default function DebtCommander({ loans }) {
  const { data: optimizer, isLoading: optLoading, isError: optError, refetch: refetchOpt } = useDebtOptimizer();
  const { data: healthData, isLoading: healthLoading } = useFinancialHealth();
  const [debts,      setDebts]      = useState(() => JSON.parse(localStorage.getItem('bondly_debt_inputs') || '{}'));
  const [extraPmt,   setExtraPmt]   = useState(500);
  const [strategy,   setStrategy]   = useState('avalanche');

  const income  = healthData?.income ?? 0;
  const loading = optLoading || healthLoading;

  // Pre-fill bond balance from loan prop
  useEffect(() => {
    if (loans?.[0]?.amount) {
      setDebts(d => ({ ...d, bondBalance: loans[0].amount }));
    }
  }, [loans]);

  function setDebt(key, val) {
    setDebts(d => {
      const next = { ...d, [key]: val };
      localStorage.setItem('bondly_debt_inputs', JSON.stringify(next));
      return next;
    });
  }

  const parse = v => parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;

  const debtItems = DEBT_FIELDS
    .map(f => ({ ...f, balance: parse(debts[f.key] ?? 0) }))
    .filter(f => f.balance > 0);

  const totalDebt   = debtItems.reduce((s, d) => s + d.balance, 0);
  const dti         = income > 0 ? Math.round((totalDebt / (income * 12)) * 100) : 0;
  const totalMonthlyMin = debtItems.reduce((s, d) => s + calcMonthlyPayment(d.balance, d.rate), 0);

  // Payoff order
  const sorted = strategy === 'avalanche'
    ? [...debtItems].sort((a, b) => b.rate - a.rate)
    : [...debtItems].sort((a, b) => a.balance - b.balance);

  // Estimate months to debt-free with extra payment
  function monthsToPayoff(balance, annualRate, extraMonthly) {
    if (balance <= 0) return 0;
    const r = annualRate / 100 / 12;
    const pmt = calcMonthlyPayment(balance, annualRate) + extraMonthly;
    if (r === 0) return Math.ceil(balance / pmt);
    return Math.ceil(-Math.log(1 - (balance * r) / pmt) / Math.log(1 + r));
  }

  const baseMonths  = debtItems.length ? Math.max(...debtItems.map(d => monthsToPayoff(d.balance, d.rate, 0))) : 0;
  const extraMonths = debtItems.length ? Math.max(...debtItems.map(d => monthsToPayoff(d.balance, d.rate, extraPmt / debtItems.length))) : 0;
  const savedMonths = Math.max(0, baseMonths - extraMonths);

  if (loading) return <div style={{ height: 200, background: 'var(--color-surface-2)', borderRadius: 12, animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />;
  if (optError) return (
    <div style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
      Failed to load debt data. <button onClick={() => refetchOpt()} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
    </div>
  );

  return (
    <div className="dc">
      {/* Hero */}
      <div className="dc-hero">
        <DTIGauge dti={dti} />
        <div className="dc-hero__stats">
          <div>
            <div className="dc-hero__label">Total debt</div>
            <div className="dc-hero__val">{fmt(totalDebt)}</div>
          </div>
          <div>
            <div className="dc-hero__label">Min monthly payments</div>
            <div className="dc-hero__val">{fmt(Math.round(totalMonthlyMin))}/mo</div>
          </div>
          {income > 0 && (
            <div className="dc-hero__dti-bar">
              <div className="dc-hero__dti-track">
                <div className="dc-hero__dti-fill" style={{
                  width: Math.min(100, dti) + '%',
                  background: dti <= 35 ? '#22c55e' : dti <= 50 ? '#eab308' : '#ef4444',
                }} />
                <div className="dc-hero__dti-marker" style={{ left: '35%' }} title="Healthy threshold (35%)" />
              </div>
              <div className="dc-hero__dti-labels">
                <span>0%</span><span style={{ marginLeft: '30%' }}>35% healthy</span><span>100%</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Debt inputs */}
      <div className="dc-inputs">
        <div className="dc-inputs__title">Your debts</div>
        {DEBT_FIELDS.map(f => (
          <div key={f.key} className="dc-input-row">
            <div className="dc-input-row__left">
              <div className="dc-input-row__label">{f.label}</div>
              <div className="dc-input-row__rate">{f.rate}% rate</div>
            </div>
            <input
              className="dc-input-row__input"
              type="text"
              inputMode="numeric"
              placeholder={f.placeholder || 'Auto-synced'}
              value={debts[f.key] ?? ''}
              readOnly={f.locked}
              style={f.locked ? { opacity: 0.6 } : {}}
              onChange={e => !f.locked && setDebt(f.key, e.target.value)}
            />
          </div>
        ))}
      </div>

      {/* Strategy + extra payment */}
      {debtItems.length > 0 && (
        <>
          <div className="dc-strategy">
            <div className="dc-strategy__title">Payoff strategy</div>
            <div className="dc-strategy__toggle">
              {[
                { id: 'avalanche', label: 'Avalanche', desc: 'Highest rate first — saves most interest' },
                { id: 'snowball',  label: 'Snowball',  desc: 'Smallest balance first — fastest wins' },
              ].map(s => (
                <button
                  key={s.id}
                  className={`dc-strategy__btn ${strategy === s.id ? 'active' : ''}`}
                  onClick={() => setStrategy(s.id)}
                >
                  <strong>{s.label}</strong>
                  <span>{s.desc}</span>
                </button>
              ))}
            </div>

            <div className="dc-payoff-order">
              {sorted.map((d, i) => (
                <div key={d.key} className="dc-payoff-row">
                  <span className="dc-payoff-row__num">{i + 1}</span>
                  <span className="dc-payoff-row__name">{d.label}</span>
                  <span className="dc-payoff-row__rate">{d.rate}%</span>
                  <span className="dc-payoff-row__bal">{fmt(d.balance)}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Extra payment slider */}
          <div className="dc-extra">
            <div className="dc-extra__header">
              <span>Extra payment per month</span>
              <strong>{fmt(extraPmt)}</strong>
            </div>
            <input
              type="range"
              min="0"
              max="10000"
              step="100"
              value={extraPmt}
              onChange={e => setExtraPmt(Number(e.target.value))}
              className="dc-extra__slider"
            />
            {savedMonths > 0 && (
              <div className="dc-extra__impact">
                Pay off debt <strong>{savedMonths} month{savedMonths !== 1 ? 's' : ''} sooner</strong> with {fmt(extraPmt)}/month extra
              </div>
            )}
          </div>
        </>
      )}

      {/* Optimizer insights */}
      {optimizer?.available && optimizer?.insights?.length > 0 && (
        <div className="dc-insights">
          <div className="dc-insights__title">Optimiser insights</div>
          {optimizer.insights.slice(0, 3).map((ins, i) => (
            <div key={i} className="dc-insight-row">
              <span className="dc-insight-row__dot" />
              <span>{ins.text || ins.description || ins}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
