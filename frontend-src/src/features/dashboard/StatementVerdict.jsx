// StatementVerdict.jsx — redesigned statement-intelligence result view.
//
// Three-layer, progressive-disclosure model that replaces the 50-number /
// three-competing-scores result screen:
//
//   LAYER 1  THE VERDICT — one hero answer + one state pill (+ 0–100 readiness)
//   LAYER 2  THE PATH     — the single highest-impact lever + CTA + bank chips
//   LAYER 3  THE DETAIL   — everything dense, collapsed by default (<details>)
//
// Hero is SAVINGS-FIRST (the commission driver): when an existing bond is
// detected we lead with "switch and save R/mo"; otherwise we fall back to
// "you qualify for up to R…" (you can't compute a saving with no current rate).
//
// Reads the existing parse-response shape (see lib/api.parseStatementForPreapproval);
// no backend changes. Additive — does not touch the live Preapproval/Finances flow.
// Ships with DEMO_RESULT so it renders standalone for design preview.

import { useState } from 'react';
import { fmt, fmtShort } from '../../lib/format.js';
import './StatementVerdict.css';

// ── readiness → state pill ─────────────────────────────────────────────────
function readinessState(score) {
  if (score >= 75) return { key: 'ready',   label: 'Ready to switch',  tone: 'good' };
  if (score >= 50) return { key: 'almost',  label: 'Almost ready',     tone: 'warn' };
  return { key: 'notyet', label: 'Not ready yet', tone: 'bad' };
}

// ── bank approval → 3 buckets (no 7-bar chart) ─────────────────────────────
function bucketBanks(approvalConfidence = {}) {
  const out = { likely: [], maybe: [], unlikely: [] };
  for (const b of Object.values(approvalConfidence)) {
    const conf = b.conf ?? b.confidence ?? 0;
    if (conf >= 70) out.likely.push(b);
    else if (conf >= 50) out.maybe.push(b);
    else out.unlikely.push(b);
  }
  return out;
}

// PV factor: monthly saving → lifetime bond-impact (matches Insights tab).
const PV_FACTOR = 83;

export default function StatementVerdict({ result = DEMO_RESULT, onPrimaryCta }) {
  const {
    income = {}, qualification = {}, existingMortgage = {},
    readiness = {}, optimizations = [], expenses = {},
    approvalConfidence = {}, savings = null,
  } = result;

  const score = readiness.score ?? 0;
  const state = readinessState(score);
  const hasBond = !!existingMortgage.detected;

  // ── hero framing ──────────────────────────────────────────────────────────
  const monthlySaving = savings?.monthlyDelta ?? existingMortgage.potentialMonthlySaving ?? 0;
  const heroIsSaving = hasBond && monthlySaving > 0;
  const termSaving = monthlySaving * 12 * 20; // 20-yr horizon, display only
  const banks = bucketBanks(approvalConfidence);

  // ── top lever: highest-priority optimization, framed as money ─────────────
  const lever = [...optimizations].sort(
    (a, b) => RANK[b.priority] - RANK[a.priority] || (b.monthlySaving ?? 0) - (a.monthlySaving ?? 0)
  )[0];
  const leverBondImpact = lever ? Math.round((lever.monthlySaving ?? 0) * PV_FACTOR) : 0;

  return (
    <div className="sv">
      {/* ───────────── LAYER 1 — THE VERDICT ───────────── */}
      <section className={`sv-hero sv-hero--${state.tone}`}>
        {heroIsSaving ? (
          <>
            <div className="sv-hero__eyebrow">Switch and save</div>
            <div className="sv-hero__figure">{fmt(monthlySaving)}<span>/mo</span></div>
            <div className="sv-hero__sub">{fmt(termSaving)} over your bond term</div>
          </>
        ) : (
          <>
            <div className="sv-hero__eyebrow">You qualify for up to</div>
            <div className="sv-hero__figure">{fmt(qualification.maxBond)}</div>
            <div className="sv-hero__sub">~{fmt(qualification.maxMonthly)}/month</div>
          </>
        )}

        <div className="sv-hero__status">
          <span className={`sv-pill sv-pill--${state.tone}`}>● {state.label}</span>
          <span className="sv-readiness" title="Your home-loan readiness, 0–100">
            {score}<span>/100</span>
          </span>
        </div>
      </section>

      {/* ───────────── LAYER 2 — THE PATH ───────────── */}
      {lever && (
        <section className="sv-lever">
          <div className="sv-lever__tag">⚡ Biggest lever</div>
          <div className="sv-lever__title">{lever.title}</div>
          <div className="sv-lever__impact">
            {heroIsSaving
              ? <>→ frees up {fmt(lever.monthlySaving)}/mo toward a better rate</>
              : <>→ unlocks ~{fmtShort(leverBondImpact)} more bond</>}
          </div>
          {lever.description && <p className="sv-lever__desc">{lever.description}</p>}
          <button className="sv-cta" onClick={onPrimaryCta}>
            {heroIsSaving ? 'See my switch plan →' : 'See my plan to qualify for more →'}
          </button>
        </section>
      )}

      {/* compact bank-approval strip (replaces the 7-bar chart) */}
      {(banks.likely.length || banks.maybe.length || banks.unlikely.length) > 0 && (
        <section className="sv-banks">
          {banks.likely.length > 0 && (
            <div className="sv-banks__row">
              <span className="sv-banks__lbl sv-banks__lbl--good">Likely to approve</span>
              <span className="sv-chips">{banks.likely.map(b => <i key={b.name} className="sv-chip sv-chip--good">{b.name}</i>)}</span>
            </div>
          )}
          {banks.maybe.length > 0 && (
            <div className="sv-banks__row">
              <span className="sv-banks__lbl sv-banks__lbl--warn">Maybe</span>
              <span className="sv-chips">{banks.maybe.map(b => <i key={b.name} className="sv-chip sv-chip--warn">{b.name}</i>)}</span>
            </div>
          )}
          {banks.unlikely.length > 0 && (
            <div className="sv-banks__row">
              <span className="sv-banks__lbl sv-banks__lbl--bad">Unlikely</span>
              <span className="sv-chips">{banks.unlikely.map(b => <i key={b.name} className="sv-chip sv-chip--bad">{b.name}</i>)}</span>
            </div>
          )}
        </section>
      )}

      {/* ───────────── LAYER 3 — THE DETAIL (collapsed) ───────────── */}
      <div className="sv-detail">
        <details className="sv-acc">
          <summary>Where your money goes</summary>
          <div className="sv-acc__body">
            {Object.entries(expenses.breakdown || {})
              .filter(([, v]) => v > 0)
              .sort((a, b) => b[1] - a[1])
              .map(([cat, v]) => (
                <div className="sv-row" key={cat}>
                  <span className="sv-row__k">{CAT_LABEL[cat] || cat}</span>
                  <span className="sv-row__v">{fmt(v)}/mo</span>
                </div>
              ))}
          </div>
        </details>

        <details className="sv-acc">
          <summary>Full readiness breakdown</summary>
          <div className="sv-acc__body">
            {Object.entries(readiness.components || {}).map(([k, c]) => {
              const sc = c.score ?? c, max = c.max ?? 100;
              return (
                <div className="sv-bar" key={k}>
                  <div className="sv-bar__head">
                    <span>{c.label || k}</span>
                    <span className="sv-bar__num">{sc}/{max}</span>
                  </div>
                  <div className="sv-bar__track"><i style={{ width: `${(sc / max) * 100}%` }} /></div>
                  {c.detail && <div className="sv-bar__detail">{c.detail}</div>}
                </div>
              );
            })}
          </div>
        </details>

        <details className="sv-acc">
          <summary>How banks see you</summary>
          <div className="sv-acc__body">
            <div className="sv-row"><span className="sv-row__k">Bank-facing score</span><span className="sv-row__v">{readiness.bankScore ?? '—'} / 1000</span></div>
            <div className="sv-row"><span className="sv-row__k">Grade</span><span className="sv-row__v">{readiness.grade ?? '—'}</span></div>
            <div className="sv-row"><span className="sv-row__k">Verified income</span><span className="sv-row__v">{fmt(income.monthlyAmount)}/mo ({income.confidence})</span></div>
            <p className="sv-note">This is the internal scorecard banks weigh — it’s why your readiness sits where it does. You don’t need to act on the number itself; act on the lever above.</p>
          </div>
        </details>
      </div>
    </div>
  );
}

const RANK = { critical: 4, high: 3, medium: 2, low: 1 };
const CAT_LABEL = {
  groceries: 'Groceries', dining_out: 'Dining out', fuel: 'Fuel', utilities: 'Utilities',
  insurance: 'Insurance', entertainment: 'Entertainment', subscriptions: 'Subscriptions',
  gambling: 'Gambling', crypto_investment: 'Crypto', other: 'Other',
};

// ── Standalone preview data (existing-bond holder → savings hero) ───────────
export const DEMO_RESULT = {
  income: { monthlyAmount: 38500, confidence: 'high', employmentType: 'salaried' },
  qualification: { maxBond: 1850000, maxMonthly: 19400, verdict: 'likely_qualify' },
  existingMortgage: { detected: true, monthlyPayment: 14200, potentialMonthlySaving: 1240 },
  savings: { monthlyDelta: 1240 },
  readiness: {
    score: 72, grade: 'B', bankScore: 720,
    components: {
      affordability:    { score: 230, max: 300, label: 'Affordability',     detail: 'Comfortable debt-to-income' },
      incomeStability:  { score: 180, max: 200, label: 'Income stability',  detail: 'Steady salary, 12 mo verified' },
      cashFlow:         { score: 120, max: 200, label: 'Cash flow',         detail: 'Tight in 2 of the last 6 months' },
      spendingRisk:     { score:  95, max: 150, label: 'Spending risk',     detail: 'Some discretionary overspend' },
      debtLoad:         { score:  80, max: 100, label: 'Debt load',         detail: 'Low non-bond debt' },
      savingsBehaviour: { score:  15, max:  50, label: 'Savings behaviour', detail: 'Little month-end surplus' },
    },
  },
  approvalConfidence: {
    fnb:      { name: 'FNB', conf: 82 }, absa: { name: 'ABSA', conf: 78 }, capitec: { name: 'Capitec', conf: 74 },
    nedbank:  { name: 'Nedbank', conf: 61 }, standard: { name: 'Standard Bank', conf: 55 },
    investec: { name: 'Investec', conf: 40 }, sahl: { name: 'SA Home Loans', conf: 48 },
  },
  optimizations: [
    { type: 'gambling', priority: 'critical', title: 'Pause betting spend (R2,100/mo)',
      description: 'Banks flag any betting activity — pausing it for 3 months before you apply materially lifts approval odds.',
      monthlySaving: 2100, loanImpact: 175000 },
    { type: 'subscriptions', priority: 'medium', title: 'Trim 3 unused subscriptions', monthlySaving: 540, loanImpact: 45000 },
  ],
  expenses: { total: 21800, breakdown: {
    groceries: 5200, dining_out: 2400, fuel: 1900, utilities: 2100,
    insurance: 3100, subscriptions: 1280, gambling: 2100, other: 3720,
  } },
};
