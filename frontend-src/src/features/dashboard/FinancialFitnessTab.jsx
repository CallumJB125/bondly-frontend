import { useState, useEffect, useRef } from 'react';
import { Upload, TrendingUp, TrendingDown, AlertTriangle, CheckCircle,
         RefreshCw, Target, X, ChevronRight, AlertOctagon, ChevronDown, ChevronUp, ExternalLink } from 'lucide-react';
import { financialFitness as ffApi, parseStatementForPreapproval, loans as loansApi } from '../../lib/api.js';
import { fmt, fmtDate } from '@bondly/ui/lib/format.js';
import { useToast } from '@bondly/ui/components/Toast.jsx';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';
import { STRESS_RATE, LOAN_TERM, BANK_PROFILES, calcMaxBond, bankLikelihood } from '@bondly/ui/lib/mortgage.js';
import './FinancialFitnessTab.css';

const CATEGORY_META = {
  gambling:      { label: 'Gambling & betting',     color: '#dc2626', discretionary: true,  bankRisk: true },
  entertainment: { label: 'Dining & entertainment', color: '#ef4444', discretionary: true  },
  subscriptions: { label: 'Subscriptions',          color: '#06b6d4', discretionary: true  },
  other:         { label: 'Other living costs',     color: '#6b7280', discretionary: true  },
  groceries:     { label: 'Groceries & pharmacy',   color: '#10b981', discretionary: false },
  fuel:          { label: 'Transport & fuel',       color: '#f97316', discretionary: false },
  utilities:     { label: 'Utilities & internet',   color: '#3b82f6', discretionary: false },
  insurance:     { label: 'Insurance & medical',    color: '#8b5cf6', discretionary: false },
};

const UPLOAD_STEPS = [
  'Reading statement…',
  'Detecting income…',
  'Identifying spending patterns…',
  'Flagging risk factors…',
  'Building your plan…',
];

function pv() {
  const r = STRESS_RATE / 100 / 12, n = LOAN_TERM;
  return (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n));
}

function calcLocalMaxBond(income, debt) {
  return Math.round(Math.max(0, income * 0.30 - debt) * pv());
}

function daysSince(iso) {
  return iso ? Math.floor((Date.now() - new Date(iso).getTime()) / 86400000) : null;
}

function fmtAge(days) {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 30)  return `${days} days ago`;
  const m = Math.floor(days / 30);
  return m === 1 ? '1 month ago' : `${m} months ago`;
}

// Gross income estimate from nett take-home (SA tax bracket approximation)
function estimateGross(nett) {
  if (!nett || nett <= 0) return null;
  if (nett <= 10000)  return { lo: Math.round(nett * 1.10), hi: Math.round(nett * 1.16) };
  if (nett <= 20000)  return { lo: Math.round(nett * 1.22), hi: Math.round(nett * 1.30) };
  if (nett <= 35000)  return { lo: Math.round(nett * 1.28), hi: Math.round(nett * 1.36) };
  if (nett <= 60000)  return { lo: Math.round(nett * 1.33), hi: Math.round(nett * 1.43) };
  return { lo: Math.round(nett * 1.38), hi: Math.round(nett * 1.50) };
}


const DEBT_RATE_ESTIMATES = { creditcard: 21.0, retail: 24.0, personal: 18.0, vehicle: 11.5, student: 13.0, other: 16.0 };
function debtRate(item) {
  if (item.isCreditCard) return DEBT_RATE_ESTIMATES.creditcard;
  const p = (item.payee || '').toLowerCase();
  if (/retail|edgars|foschini|truworths|account/i.test(p)) return DEBT_RATE_ESTIMATES.retail;
  if (/vehicle|car|motor|toyota|bmw|vw|ford|hyundai|nissan|mazda/i.test(p)) return DEBT_RATE_ESTIMATES.vehicle;
  if (/student|study|nsfas/i.test(p)) return DEBT_RATE_ESTIMATES.student;
  return DEBT_RATE_ESTIMATES.other;
}

// ── Empty / invite ───────────────────────────────────────────────────────────

function UploadIntro({ onFile }) {
  const inputRef = useRef();
  const [drag, setDrag] = useState(false);

  function handleFile(f) { if (f) onFile(f); }

  return (
    <div className="ff-intro">
      <div className="ff-intro__text">
        <div className="ff-intro__heading">See exactly what's holding back your bond</div>
        <p>Upload a bank statement and we'll analyse your spending, flag what banks look out for, and show you a personalised action plan — including how much more bond each change unlocks.</p>
        <ul className="ff-intro__list">
          <li><CheckCircle size={14} /> Spending compared against earners in your income bracket</li>
          <li><CheckCircle size={14} /> Risk factors banks flag (gambling, overspend, instability)</li>
          <li><CheckCircle size={14} /> Goal-based action plan: set a bond target, get a roadmap</li>
          <li><CheckCircle size={14} /> Track improvement over time with each upload</li>
        </ul>
      </div>
      <div
        className={`ff-upload ff-upload--large ${drag ? 'ff-upload--drag' : ''}`}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={e => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current.click()}
      >
        <input ref={inputRef} type="file" accept=".csv,.pdf" style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])} />
        <Upload size={28} />
        <div className="ff-upload__title">Upload your bank statement</div>
        <div className="ff-upload__sub">CSV or PDF · FNB, ABSA, Nedbank, Standard Bank, Capitec</div>
        <div className="ff-upload__note">Your data is processed securely and never shared.</div>
      </div>
    </div>
  );
}

// ── Progress animation ───────────────────────────────────────────────────────

function UploadProgress({ stepIdx }) {
  return (
    <div className="ff-progress">
      <RefreshCw size={28} className="ff-spin" />
      <div className="ff-progress__steps">
        {UPLOAD_STEPS.map((s, i) => (
          <div key={i} className={`ff-progress__step ${i < stepIdx ? 'done' : i === stepIdx ? 'active' : ''}`}>
            {i < stepIdx ? <CheckCircle size={14} /> : <span className="ff-progress__dot" />}
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Post-upload reveal ───────────────────────────────────────────────────────

function ReportReveal({ snapshot, onDismiss }) {
  const [accuracyRating, setAccuracyRating] = useState(null);
  const income  = snapshot.income?.monthlyAmount || 0;
  const debt    = snapshot.debts?.totalMonthly || 0;
  const maxBond = snapshot.qualification?.maxBond || 0;
  const opts    = snapshot.optimizations || [];
  const zone    = snapshot.affordabilityZone;
  const readiness = snapshot.readiness?.score ?? (typeof snapshot.readiness === 'number' ? snapshot.readiness : 0);

  // Total upside if all optimizations implemented
  const totalSaving  = opts.reduce((s, o) => s + (o.monthlySaving || 0), 0);
  const projectedBond = calcLocalMaxBond(income, Math.max(0, debt - totalSaving));
  const upside = projectedBond - maxBond;

  const hasGambling = opts.some(o => o.type === 'gambling');

  const zoneColor = { green: '#16a34a', yellow: '#d97706', red: '#ef4444' }[zone?.zone] || '#6b7280';

  return (
    <div className="ff-reveal">
      <div className="ff-reveal__header">
        <div>
          <div className="ff-reveal__title">Your Financial Fitness Report</div>
          <div className="ff-reveal__sub">Based on your {snapshot.statementMonths || 1}-month statement</div>
        </div>
        <button className="ff-reveal__close" onClick={onDismiss}><X size={18} /></button>
      </div>

      {/* 3-month nudge */}
      {(snapshot.statementMonths || 1) === 1 && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'10px 14px', margin:'0 0 14px', background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, fontSize:'0.8125rem' }}>
          <span style={{ flexShrink:0 }}>📅</span>
          <span style={{ color:'#78350f' }}><strong>1-month statement</strong> — upload 3 months for higher confidence and a more accurate readiness score.</span>
        </div>
      )}

      {/* Key numbers */}
      <div className="ff-reveal__stats">
        <div className="ff-reveal__stat">
          <div className="ff-reveal__stat-label">Income detected</div>
          <div className="ff-reveal__stat-val">{income > 0 ? fmt(income) + '/mo' : 'Not detected'}</div>
        </div>
        <div className="ff-reveal__stat">
          <div className="ff-reveal__stat-label">Monthly debt</div>
          <div className="ff-reveal__stat-val">{fmt(debt)}/mo</div>
        </div>
        <div className="ff-reveal__stat">
          <div className="ff-reveal__stat-label">Living expenses</div>
          <div className="ff-reveal__stat-val">{fmt(snapshot.expenses?.total || 0)}/mo</div>
        </div>
      </div>

      {/* Bond + zone */}
      <div className="ff-reveal__bond-row">
        <div>
          <div className="ff-reveal__bond-label">Max bond qualification</div>
          <div className="ff-reveal__bond-val">{fmt(maxBond)}</div>
        </div>
        <div className="ff-reveal__score-wrap">
          <svg viewBox="0 0 56 56" className="ff-reveal__ring">
            <circle cx="28" cy="28" r="22" strokeWidth="5" className="ff-ring-track" />
            <circle cx="28" cy="28" r="22" strokeWidth="5" className="ff-ring-fill"
              strokeDasharray={`${(readiness / 100) * 138.2} 138.2`}
              transform="rotate(-90 28 28)"
              style={{ stroke: readiness >= 70 ? '#16a34a' : readiness >= 45 ? '#d97706' : '#ef4444' }} />
          </svg>
          <div className="ff-reveal__score-label">
            <span className="ff-reveal__score-num">{readiness}</span>
            <span className="ff-reveal__score-sub">/ 100</span>
          </div>
        </div>
        {zone && (
          <span className="ff-zone" style={{ color: zoneColor, borderColor: zoneColor }}>
            {zone.sublabel || zone.label}
          </span>
        )}
      </div>

      {/* Findings */}
      {opts.length > 0 && (
        <div className="ff-reveal__findings">
          <div className="ff-reveal__findings-title">
            {hasGambling
              ? <><AlertOctagon size={15} style={{ color: '#dc2626' }} /> {opts.length} thing{opts.length > 1 ? 's' : ''} to address — including a bank risk flag</>
              : <><AlertTriangle size={15} style={{ color: '#d97706' }} /> {opts.length} improvement{opts.length > 1 ? 's' : ''} identified</>
            }
          </div>
          {opts.map((o, i) => (
            <div key={i} className={`ff-reveal__finding ${o.priority === 'critical' ? 'ff-reveal__finding--critical' : o.priority === 'high' ? 'ff-reveal__finding--high' : ''}`}>
              <div className="ff-reveal__finding-title">
                {o.priority === 'critical' && <AlertOctagon size={13} />}
                {o.title}
                {o.monthlySaving > 0 && <span className="ff-reveal__finding-amt">{fmt(o.monthlySaving)}/mo</span>}
              </div>
              <div className="ff-reveal__finding-desc">{o.description}</div>
            </div>
          ))}
        </div>
      )}

      {/* Upside */}
      {upside > 5000 && (
        <div className="ff-reveal__upside">
          <TrendingUp size={16} />
          <div>
            <strong>If you address all of the above</strong> — your max bond improves from {fmt(maxBond)} to{' '}
            <strong style={{ color: '#16a34a' }}>{fmt(projectedBond)}</strong>
            {' '}(+{fmt(upside)})
          </div>
        </div>
      )}

      <div className="ff-reveal__actions">
        <button className="ff-reveal__btn ff-reveal__btn--primary" onClick={onDismiss}>
          View full breakdown <ChevronRight size={15} />
        </button>
        <button
          className="ff-reveal__btn ff-reveal__btn--secondary"
          onClick={() => { onDismiss(); window.dispatchEvent(new CustomEvent('bondly:navigate', { detail: { tab: 'finances', subtab: 'bank-view' } })); }}
        >
          See your Bank View <ChevronRight size={15} />
        </button>
      </div>

      {/* Accuracy rating */}
      {snapshot?.id && (
        <div style={{ marginTop: 16, padding: '12px 14px', background: 'rgba(0,0,0,0.04)', borderRadius: 8, textAlign: 'center' }}>
          {!accuracyRating ? (
            <>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 8 }}>How accurate does this look?</div>
              <div style={{ display: 'flex', gap: 6, justifyContent: 'center', flexWrap: 'wrap' }}>
                {[['accurate','Looks right','#16a34a'],['some_issues','Some issues','#d97706'],['not_accurate','Way off','#dc2626']].map(([val, label, color]) => (
                  <button key={val}
                    onClick={async () => {
                      try {
                        await ffApi.rateAccuracy(snapshot.id, val);
                        setAccuracyRating(val);
                      } catch {}
                    }}
                    style={{ padding: '5px 12px', borderRadius: 20, border: '1.5px solid ' + color, background: 'transparent', color, fontSize: '0.75rem', cursor: 'pointer', fontWeight: 500 }}
                  >{label}</button>
                ))}
              </div>
            </>
          ) : (
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              {accuracyRating === 'accurate' ? 'Thanks, glad it looks right!' : 'Thanks for flagging — we will review it.'}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Goal panel ───────────────────────────────────────────────────────────────

const GOAL_CHIPS = [500000, 1000000, 1500000, 2000000, 3000000];

export function GoalPanel({ snapshot, goal, onSaved, onDeleted }) {
  const [targetBond, setTargetBond]   = useState(goal?.targetBond ? String(Math.round(goal.targetBond / 1000) * 1000) : '');
  const [targetDate, setTargetDate]   = useState(goal?.targetDate || '');
  const [saving, setSaving]           = useState(false);
  const showToast = useToast();

  const income  = snapshot?.income?.monthlyAmount || 0;
  const debt    = snapshot?.debts?.totalMonthly || 0;
  const current = snapshot?.qualification?.maxBond || 0;
  const opts    = snapshot?.optimizations || [];
  const target  = parseFloat(targetBond.replace(/\s/g, '')) || 0;
  const gap     = target > current ? target - current : 0;

  // Build ranked action plan toward the gap
  const actions = [...opts]
    .filter(o => o.monthlySaving > 0)
    .sort((a, b) => (b.monthlySaving || 0) - (a.monthlySaving || 0));

  let cumulative = 0;
  const actionPlan = actions.map(o => {
    const bondGain = Math.round(o.monthlySaving * pv());
    cumulative += bondGain;
    return { ...o, bondGain, cumulative };
  });

  const totalGain = actionPlan.reduce((s, a) => s + a.bondGain, 0);
  const stillShort = gap > 0 ? Math.max(0, gap - totalGain) : 0;

  async function save() {
    if (!target || target < 100000) {
      showToast('Enter a target bond of at least R100,000', 'error');
      return;
    }
    setSaving(true);
    try {
      const res = await ffApi.saveGoal(target, targetDate || null);
      onSaved(res.goal);
      showToast('Goal saved', 'success');
    } catch(e) {
      showToast(e.message || 'Could not save goal', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function remove() {
    try { await ffApi.deleteGoal(); onDeleted(); } catch {}
  }

  return (
    <Card>
      <CardHeader
        title="My Bond Goal"
        subtitle="Set a target and we'll show you exactly what to change"
      />
      <CardBody>
        {/* Quick-amount chips */}
        <div className="ff-goal__chips">
          {GOAL_CHIPS.map(amount => (
            <button
              key={amount}
              className={`ff-goal__chip ${parseFloat(targetBond) === amount ? 'ff-goal__chip--active' : ''}`}
              onClick={() => setTargetBond(String(amount))}
            >
              {amount >= 1000000 ? `R${amount / 1000000}M` : `R${amount / 1000}k`}
            </button>
          ))}
        </div>

        <div className="ff-goal__inputs">
          <div className="ff-goal__field">
            <label className="ff-goal__label">I want to qualify for</label>
            <div className="ff-goal__input-wrap">
              <span className="ff-goal__prefix">R</span>
              <input
                type="number"
                className="ff-goal__input"
                placeholder="e.g. 2000000"
                value={targetBond}
                onChange={e => setTargetBond(e.target.value)}
                min="100000"
                step="50000"
              />
            </div>
          </div>
          <div className="ff-goal__field">
            <label className="ff-goal__label">By</label>
            <input
              type="month"
              className="ff-goal__input ff-goal__input--date"
              value={targetDate ? targetDate.slice(0, 7) : ''}
              onChange={e => setTargetDate(e.target.value + '-01')}
            />
          </div>
        </div>

        {target > 0 && current > 0 && (
          <div className="ff-goal__analysis">
            <div className="ff-goal__row">
              <span>Current qualification</span>
              <strong>{fmt(current)}</strong>
            </div>
            <div className="ff-goal__row ff-goal__row--target">
              <span>Your target</span>
              <strong>{fmt(target)}</strong>
            </div>
            {gap > 0 && (
              <div className="ff-goal__gap">
                Gap to close: <strong>{fmt(gap)}</strong>
              </div>
            )}
            {gap <= 0 && (
              <div className="ff-goal__achieved">
                <CheckCircle size={14} /> You already qualify for this amount — ready to apply!
              </div>
            )}
          </div>
        )}

        {gap > 0 && actionPlan.length > 0 && (
          <div className="ff-goal__plan">
            <div className="ff-goal__plan-title">Your action plan to close the gap</div>
            {actionPlan.map((a, i) => (
              <div key={i} className={`ff-goal__action ${a.priority === 'critical' ? 'ff-goal__action--critical' : ''}`}>
                <div className="ff-goal__action-num">{i + 1}</div>
                <div className="ff-goal__action-body">
                  <div className="ff-goal__action-title">
                    {a.title}
                    <span className="ff-goal__action-gain">+{fmt(a.bondGain)} bond</span>
                  </div>
                  {a.monthlySaving > 0 && (
                    <div className="ff-goal__action-saving">Saves {fmt(a.monthlySaving)}/mo → redirected to debt reduction</div>
                  )}
                </div>
                <div className={`ff-goal__action-cum ${a.cumulative >= gap ? 'ff-goal__action-cum--reached' : ''}`}>
                  {fmt(a.cumulative)} total
                </div>
              </div>
            ))}
            {stillShort > 0 && (
              <div className="ff-goal__shortfall">
                After all changes above, you're still <strong>{fmt(stillShort)}</strong> short.
                Consider: paying off additional debt, increasing income, or saving a larger deposit.
              </div>
            )}
            {stillShort === 0 && totalGain >= gap && (
              <>
                <div className="ff-goal__reachable">
                  <CheckCircle size={14} /> Achievable — these changes close the full gap.
                </div>
                <div className="ff-goal__timeline">
                  <span>If you start now, target qualifying date:</span>
                  <strong>{(() => { const d = new Date(); d.setMonth(d.getMonth() + 2); return d.toLocaleDateString('en-ZA', { month: 'long', year: 'numeric' }); })()}</strong>
                </div>
              </>
            )}
            {stillShort > 0 && (
              <div className="ff-goal__timeline ff-goal__timeline--stretch">
                <span>Still {fmt(stillShort)} short after all changes — consider a deposit or income increase to close the gap.</span>
              </div>
            )}
          </div>
        )}

        <div className="ff-goal__footer">
          <button className="ff-goal__save" onClick={save} disabled={saving}>
            {saving ? 'Saving…' : goal ? 'Update goal' : 'Save this goal'}
          </button>
          {goal && (
            <button className="ff-goal__delete" onClick={remove}>Remove goal</button>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ── Spending bars ────────────────────────────────────────────────────────────

function SpendingBar({ category, amount, income, benchmark }) {
  const meta  = CATEGORY_META[category] || { label: category, color: '#6b7280', discretionary: true };
  const pct   = income > 0 ? (amount / income) * 100 : 0;
  const bPct  = benchmark?.peerPct || 0;
  const over  = benchmark?.overSpend;
  const maxPct = Math.max(pct, bPct, 8);
  const barW  = Math.min(100, (pct / maxPct) * 100);
  const bmW   = bPct > 0 ? Math.min(100, (bPct / maxPct) * 100) : null;

  return (
    <div className={`ff-sbar ${meta.bankRisk ? 'ff-sbar--risk' : ''}`}>
      <div className="ff-sbar__label">
        <span>{meta.label}</span>
        <span className="ff-sbar__amount">
          {fmt(amount)}/mo
          {meta.bankRisk && <span className="ff-sbar__badge ff-sbar__badge--risk">bank risk</span>}
          {!meta.bankRisk && over && <span className="ff-sbar__badge ff-sbar__badge--over">above avg</span>}
        </span>
      </div>
      <div className="ff-sbar__track">
        <div className="ff-sbar__fill" style={{ width: barW + '%', background: meta.color }} />
        {bmW !== null && <div className="ff-sbar__bm" style={{ left: bmW + '%' }} title={`Bracket avg (${benchmark.bracketLabel}): ${fmt(benchmark.peerAmount)}/mo`} />}
      </div>
      <div className="ff-sbar__pct">{pct.toFixed(1)}% of income{bPct > 0 && ` · bracket avg ${bPct}%`}</div>
    </div>
  );
}

// ── Subscription cancel panel ─────────────────────────────────────────────────

function SubscriptionPanel({ items }) {
  const [open, setOpen] = useState(false);
  if (!items || items.length === 0) return null;
  const total = items.reduce((s, i) => s + i.monthlyAmount, 0);
  const annualSaving = total * 12;

  return (
    <div className="ff-subs">
      <button className="ff-subs__toggle" onClick={() => setOpen(o => !o)}>
        <span className="ff-subs__toggle-label">
          <span className="ff-subs__toggle-count">{items.length} subscription{items.length > 1 ? 's' : ''} detected</span>
          <span className="ff-subs__toggle-total">· {fmt(total)}/mo</span>
        </span>
        {open ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
      </button>

      {open && (
        <div className="ff-subs__body">
          <div className="ff-subs__list">
            {items.map(sub => (
              <div key={sub.name} className="ff-subs__item">
                <span className="ff-subs__name">{sub.name}</span>
                <span className="ff-subs__amt">{fmt(sub.monthlyAmount)}/mo</span>
                <span className="ff-subs__bond">+{fmt(Math.round(sub.monthlyAmount * pv()))} bond</span>
                {sub.cancelUrl ? (
                  <a
                    href={sub.cancelUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="ff-subs__cancel"
                  >
                    Cancel <ExternalLink size={11} />
                  </a>
                ) : (
                  <span className="ff-subs__cancel ff-subs__cancel--na">Contact to cancel</span>
                )}
              </div>
            ))}
          </div>
          <div className="ff-subs__footer">
            Cancelling all {items.length} saves <strong>{fmt(total)}/mo</strong> · unlocks <strong>{fmt(Math.round(total * pv()))}</strong> more bond capacity
          </div>
        </div>
      )}
    </div>
  );
}

// ── Coaching cards ───────────────────────────────────────────────────────────

const PRIORITY_COLORS = { critical: '#dc2626', high: '#ef4444', medium: '#f97316', low: '#10b981' };

function CoachCard({ item }) {
  const color = PRIORITY_COLORS[item.priority] || '#6b7280';
  return (
    <div className={`ff-coach ${item.priority === 'critical' ? 'ff-coach--critical' : ''}`}>
      <div className="ff-coach__bar" style={{ background: color }} />
      <div className="ff-coach__body">
        <div className="ff-coach__title">
          {item.priority === 'critical' && <AlertOctagon size={14} style={{ color: '#dc2626' }} />}
          {item.title}
        </div>
        <div className="ff-coach__desc">{item.description}</div>
        {item.loanImpact > 0 && (
          <div className="ff-coach__impact">
            <TrendingUp size={13} /> Up to {fmt(item.loanImpact)} more bond
          </div>
        )}
      </div>
    </div>
  );
}

// ── Projection sliders ───────────────────────────────────────────────────────

function ProjectionPanel({ snapshot }) {
  const income   = snapshot.income?.monthlyAmount || 0;
  const debt     = snapshot.debts?.totalMonthly || 0;
  const expenses = snapshot.expenses?.breakdown || {};

  const discretionary = Object.entries(CATEGORY_META)
    .filter(([, m]) => m.discretionary)
    .map(([key, m]) => ({ key, ...m, current: expenses[key] || 0 }))
    .filter(c => c.current > 0);

  const [reductions, setReductions] = useState(() =>
    Object.fromEntries(discretionary.map(c => [c.key, 0]))
  );

  const totalRedirect = Object.values(reductions).reduce((s, v) => s + v, 0);
  const currentBond   = calcMaxBond(income, debt);
  const projectedBond = calcMaxBond(income, Math.max(0, debt - totalRedirect));
  const improvement   = projectedBond - currentBond;

  if (discretionary.length === 0) return null;

  return (
    <Card>
      <CardHeader title="What-if projector"
        subtitle="Move sliders to see how redirecting spend to debt repayment improves your max bond" />
      <CardBody>
        <div className="ff-proj__sliders">
          {discretionary.map(cat => (
            <div key={cat.key} className="ff-proj__row">
              <div className="ff-proj__row-label">
                <span>{cat.label}</span>
                <span className="ff-proj__row-val">-{fmt(reductions[cat.key])}/mo</span>
              </div>
              <input type="range" min={0} max={Math.min(cat.current, 5000)} step={100}
                value={reductions[cat.key]}
                className="ff-proj__slider"
                style={{ '--thumb-color': cat.color }}
                onChange={e => setReductions(r => ({ ...r, [cat.key]: +e.target.value }))} />
              <div className="ff-proj__row-bounds">
                <span>R0</span>
                <span className="ff-proj__current">Currently {fmt(cat.current)}/mo</span>
                <span>-{fmt(Math.min(cat.current, 5000))}</span>
              </div>
            </div>
          ))}
        </div>
        {totalRedirect > 0 && (
          <div className="ff-proj__result">
            <div className="ff-proj__result-row">
              <span>Current max bond</span><strong>{fmt(currentBond)}</strong>
            </div>
            <div className="ff-proj__result-row ff-proj__result-row--gain">
              <span>Projected max bond</span><strong>{fmt(projectedBond)}</strong>
            </div>
            <div className="ff-proj__result-gain">
              <TrendingUp size={15} /> {fmt(improvement)} improvement — redirect {fmt(totalRedirect)}/mo to debt
            </div>
            <div className="ff-proj__result-note">
              SA NCA formula at {STRESS_RATE}% stress rate. Indicative only — actual bank offers vary.
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Pay Off Faster panel ─────────────────────────────────────────────────────

function calcMonthlyPayment(balance, annualRate, months) {
  const r = annualRate / 100 / 12;
  if (r === 0) return balance / months;
  return (balance * r) / (1 - Math.pow(1 + r, -months));
}

function calcNewTerm(balance, annualRate, extraPerMonth, currentPayment) {
  const r = annualRate / 100 / 12;
  const total = currentPayment + extraPerMonth;
  if (total <= r * balance) return Infinity; // never paid off
  return -Math.log(1 - (r * balance) / total) / Math.log(1 + r);
}

function fmtMonths(m) {
  if (!isFinite(m) || m <= 0) return '—';
  const years = Math.floor(m / 12);
  const months = Math.round(m % 12);
  if (years === 0) return `${months}mo`;
  if (months === 0) return `${years}yr`;
  return `${years}yr ${months}mo`;
}

function fmtPayoffDate(monthsFromNow) {
  if (!isFinite(monthsFromNow) || monthsFromNow <= 0) return '—';
  const d = new Date();
  d.setMonth(d.getMonth() + Math.round(monthsFromNow));
  return d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
}

export function PayOffFasterPanel({ snapshot }) {
  const income   = snapshot.income?.monthlyAmount || 0;
  const expenses = snapshot.expenses?.breakdown || {};
  const bm       = snapshot.spendingBenchmarks || {};

  // Bond inputs — try to pre-fill from user's loans
  const [balance,  setBalance]  = useState('');
  const [rate,     setRate]     = useState('');
  const [termMo,   setTermMo]   = useState('');
  const [loanName, setLoanName] = useState('');
  const [loadingLoans, setLoadingLoans] = useState(true);

  useEffect(() => {
    loansApi.list().then(list => {
      const active = (list || []).find(l => l.amount && l.rate && l.term);
      if (active) {
        // Estimate remaining months from enriched data (or use full term)
        const remaining = active.remainingMonths || (active.term * 12);
        setBalance(Math.round(active.amount).toString());
        setRate(active.rate.toString());
        setTermMo(Math.round(remaining).toString());
        setLoanName(`${active.bank} bond`);
      }
    }).catch(() => {}).finally(() => setLoadingLoans(false));
  }, []);

  // Overspend sliders — show any discretionary category > 0
  const discretionary = Object.entries(CATEGORY_META)
    .filter(([k, m]) => m.discretionary && !m.bankRisk && (expenses[k] || 0) > 0)
    .map(([key, m]) => {
      const userAmt    = expenses[key] || 0;
      const bracketAmt = bm[key]?.peerAmount || 0;
      const overBy     = Math.max(0, userAmt - bracketAmt);
      return { key, ...m, current: userAmt, bracketAmt, overBy, suggested: Math.round(overBy / 100) * 100 };
    });

  const [redirects, setRedirects] = useState(() =>
    Object.fromEntries(discretionary.map(c => [c.key, c.suggested]))
  );

  const totalExtra = Object.values(redirects).reduce((s, v) => s + v, 0);

  // Calculations
  const bal  = parseFloat(balance) || 0;
  const r    = parseFloat(rate)    || 0;
  const n    = parseInt(termMo)    || 0;
  const ready = bal > 0 && r > 0 && n > 0;

  const currentPayment = ready ? calcMonthlyPayment(bal, r, n) : 0;
  const newTerm        = ready && totalExtra > 0 ? calcNewTerm(bal, r, totalExtra, currentPayment) : n;
  const monthsSaved    = ready ? Math.max(0, n - newTerm) : 0;
  const interestNow    = ready ? currentPayment * n - bal : 0;
  const interestNew    = ready && totalExtra > 0 ? (currentPayment + totalExtra) * newTerm - bal : interestNow;
  const interestSaved  = Math.max(0, interestNow - interestNew);

  if (discretionary.length === 0 && !ready && loadingLoans) return null;

  return (
    <Card>
      <CardHeader
        title="Pay off your bond faster"
        subtitle="See how cutting waste spend and redirecting it to your bond slashes your term and saves interest"
      />
      <CardBody>

        {/* Bond details */}
        <div style={{ marginBottom: 20 }}>
          {loanName && (
            <div style={{ fontSize: '0.8rem', color: 'var(--mint)', marginBottom: 8, fontWeight: 600 }}>
              ✓ Using your {loanName}
            </div>
          )}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {[
              { label: 'Outstanding balance (R)', val: balance, set: setBalance, ph: 'e.g. 1500000' },
              { label: 'Interest rate (%)', val: rate, set: setRate, ph: 'e.g. 11.75' },
              { label: 'Remaining term (months)', val: termMo, set: setTermMo, ph: 'e.g. 216' },
            ].map(({ label, val, set, ph }) => (
              <div key={label} style={{ flex: '1 1 140px' }}>
                <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4 }}>{label}</div>
                <input
                  type="number" value={val} onChange={e => set(e.target.value)}
                  placeholder={ph}
                  style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', fontSize: '0.875rem', border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-page)', color: 'var(--text-primary)' }}
                />
              </div>
            ))}
          </div>
        </div>

        {/* Spending sliders */}
        {discretionary.length > 0 && (
          <div style={{ marginBottom: 20 }}>
            <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 12 }}>
              Redirect waste spend to your bond
            </div>
            <div className="ff-proj__sliders">
              {discretionary.map(cat => (
                <div key={cat.key} className="ff-proj__row">
                  <div className="ff-proj__row-label">
                    <span style={{ color: cat.color }}>{cat.label}</span>
                    <span className="ff-proj__row-val">
                      +{fmt(redirects[cat.key] || 0)}/mo extra
                    </span>
                  </div>
                  <input
                    type="range" min={0} max={cat.current} step={100}
                    value={redirects[cat.key] || 0}
                    className="ff-proj__slider"
                    style={{ '--thumb-color': cat.color }}
                    onChange={e => setRedirects(r => ({ ...r, [cat.key]: +e.target.value }))}
                  />
                  <div className="ff-proj__row-bounds">
                    <span>R0</span>
                    <span className="ff-proj__current">
                      {cat.overBy > 0
                        ? `R${cat.overBy.toLocaleString('en-ZA')} above bracket avg`
                        : `Currently ${fmt(cat.current)}/mo`}
                    </span>
                    <span>{fmt(cat.current)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Results */}
        {ready && totalExtra > 0 && (
          <div className="ff-payoff__result">
            <div className="ff-payoff__extra">
              Extra to bond: <strong>{fmt(totalExtra)}/mo</strong>
            </div>
            <div className="ff-payoff__grid">
              <div className="ff-payoff__cell">
                <div className="ff-payoff__cell-label">Current term</div>
                <div className="ff-payoff__cell-val">{fmtMonths(n)}</div>
                <div className="ff-payoff__cell-sub">Paid off {fmtPayoffDate(n)}</div>
              </div>
              <div className="ff-payoff__arrow">→</div>
              <div className="ff-payoff__cell ff-payoff__cell--gain">
                <div className="ff-payoff__cell-label">New term</div>
                <div className="ff-payoff__cell-val">{fmtMonths(newTerm)}</div>
                <div className="ff-payoff__cell-sub">Paid off {fmtPayoffDate(newTerm)}</div>
              </div>
            </div>
            <div className="ff-payoff__savings">
              <div className="ff-payoff__saving">
                <TrendingDown size={16} />
                <span><strong>{fmtMonths(monthsSaved)} sooner</strong> — you're free in {fmtPayoffDate(newTerm)}</span>
              </div>
              <div className="ff-payoff__saving ff-payoff__saving--interest">
                <TrendingDown size={16} />
                <span><strong>{fmt(Math.round(interestSaved))}</strong> less interest paid to the bank</span>
              </div>
            </div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 10 }}>
              Assumes extra payment applied monthly from now. Indicative — actual savings depend on your bank's compounding method.
            </div>
          </div>
        )}

        {ready && totalExtra === 0 && discretionary.length > 0 && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textAlign: 'center', padding: '16px 0' }}>
            Move the sliders above to see how much you could save.
          </div>
        )}

        {!ready && !loadingLoans && (
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 8 }}>
            Enter your bond details above to see your payoff projection.
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Freshness + upload strip ─────────────────────────────────────────────────

function UploadStrip({ days, uploading, onFile }) {
  const inputRef = useRef();
  const stale = days !== null && days >= 30;
  return (
    <div className={`ff-strip ${stale ? 'ff-strip--stale' : ''}`}>
      <div className="ff-strip__left">
        {stale
          ? <><AlertTriangle size={14} /> Data is {fmtAge(days)} — upload a fresh statement for accurate coaching</>
          : <><CheckCircle size={14} /> Updated {fmtAge(days)}</>
        }
      </div>
      <button className="ff-strip__btn" disabled={uploading}
        onClick={() => inputRef.current.click()}>
        <input ref={inputRef} type="file" accept=".csv,.pdf" style={{ display: 'none' }}
          onChange={e => onFile(e.target.files[0])} />
        {uploading ? <RefreshCw size={13} className="ff-spin" /> : <Upload size={13} />}
        {uploading ? 'Analysing…' : 'Upload new statement'}
      </button>
    </div>
  );
}

// ── History timeline ─────────────────────────────────────────────────────────

function SpendingTrendChart({ snapshots, category, color }) {
  const vals = [...snapshots].reverse().map(s => s.expenses?.breakdown?.[category] || 0);
  const max = Math.max(...vals, 1);
  const W = 72, H = 26;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * W},${H - (v / max) * H * 0.85}`).join(' ');
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} style={{ overflow: 'visible' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinejoin="round" />
    </svg>
  );
}

export function SnapshotHistory({ snapshots }) {
  // Filter out snapshots with clearly erroneous maxBond values (pre-14-May-2026 parser bug produced R190M+)
  const validSnapshots = snapshots.filter(s => (s.qualification?.maxBond || 0) <= 10_000_000);
  const hasStale = validSnapshots.length < snapshots.length;
  if (validSnapshots.length < 2) return null;
  const maxBond = Math.max(...validSnapshots.map(s => s.qualification?.maxBond || 0));
  return (
    <Card>
      <CardHeader title="Your progress" subtitle="Max bond qualification over time" />
      <CardBody>
        {hasStale && (
          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-3)' }}>
            ⚠ Some older analyses were affected by a now-fixed parsing issue and have been hidden. Re-upload a recent statement for accurate figures.
          </p>
        )}
        <div className="ff-history">
          {validSnapshots.map((s, i) => {
            const bond = s.qualification?.maxBond || 0;
            const prev = validSnapshots[i + 1]?.qualification?.maxBond;
            const delta = prev != null ? bond - prev : null;
            return (
              <div key={s.id} className="ff-history__row">
                <div className="ff-history__date">{fmtDate(s.uploadedAt)}</div>
                <div className="ff-history__bar-wrap">
                  <div className="ff-history__bar" style={{ width: maxBond > 0 ? (bond / maxBond * 100) + '%' : '10%' }} />
                </div>
                <div className="ff-history__bond">
                  {fmt(bond)}
                  {delta != null && (
                    <span className={`ff-history__delta ${delta >= 0 ? 'ff-history__delta--up' : 'ff-history__delta--down'}`}>
                      {delta >= 0 ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
                      {fmt(Math.abs(delta))}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {validSnapshots.length >= 3 && (
          <div className="ff-history__trends">
            <div className="ff-history__trends-title">Spending trends</div>
            <div className="ff-history__trends-grid">
              {Object.entries(CATEGORY_META).map(([key, meta]) => {
                const hasData = validSnapshots.some(s => (s.expenses?.breakdown?.[key] || 0) > 0);
                if (!hasData) return null;
                return (
                  <div key={key} className="ff-history__trend-item">
                    <span className="ff-history__trend-label" style={{ color: meta.color }}>{meta.label}</span>
                    <SpendingTrendChart snapshots={validSnapshots} category={key} color={meta.color} />
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Progress section ─────────────────────────────────────────────────────────

export function ProgressSection({ progress }) {
  if (!progress || !progress.hasProgress) return null;

  const { spending, maxBond, readiness, breakdown, wins, setbacks, commitmentResults, encouragement } = progress;

  return (
    <Card>
      <CardHeader
        title="This month vs last month"
        subtitle={encouragement}
      />
      <CardBody>
        <div className="ff-prog__metrics">
          <div className="ff-prog__metric">
            <div className="ff-prog__metric-label">Total spending</div>
            <div className={`ff-prog__metric-val ${spending.delta < 0 ? 'ff-prog__metric-val--good' : spending.delta > 500 ? 'ff-prog__metric-val--bad' : ''}`}>
              {spending.delta <= 0 ? `-${fmt(Math.abs(spending.delta))}` : `+${fmt(spending.delta)}`}
            </div>
            <div className="ff-prog__metric-sub">{fmt(spending.current)}/mo now</div>
          </div>
          <div className="ff-prog__metric">
            <div className="ff-prog__metric-label">Max bond</div>
            <div className={`ff-prog__metric-val ${maxBond.delta > 0 ? 'ff-prog__metric-val--good' : maxBond.delta < 0 ? 'ff-prog__metric-val--bad' : ''}`}>
              {maxBond.delta >= 0 ? `+${fmt(maxBond.delta)}` : `-${fmt(Math.abs(maxBond.delta))}`}
            </div>
            <div className="ff-prog__metric-sub">{fmt(maxBond.current)} now</div>
          </div>
          <div className="ff-prog__metric">
            <div className="ff-prog__metric-label">Readiness score</div>
            <div className={`ff-prog__metric-val ${readiness.delta > 0 ? 'ff-prog__metric-val--good' : readiness.delta < 0 ? 'ff-prog__metric-val--bad' : ''}`}>
              {readiness.delta >= 0 ? `+${readiness.delta}` : `${readiness.delta}`}
            </div>
            <div className="ff-prog__metric-sub">{readiness.current}/100 now</div>
          </div>
        </div>

        {(wins.length > 0 || setbacks.length > 0) && (
          <div className="ff-prog__highlights">
            {wins.map(cat => {
              const meta = CATEGORY_META[cat] || { label: cat };
              return (
                <div key={cat} className="ff-prog__highlight ff-prog__highlight--win">
                  <TrendingDown size={13} />
                  {meta.label}: {fmt(Math.abs(breakdown[cat].delta))} less
                </div>
              );
            })}
            {setbacks.map(cat => {
              const meta = CATEGORY_META[cat] || { label: cat };
              return (
                <div key={cat} className="ff-prog__highlight ff-prog__highlight--set">
                  <TrendingUp size={13} />
                  {meta.label}: {fmt(breakdown[cat].delta)} more
                </div>
              );
            })}
          </div>
        )}

        {commitmentResults.length > 0 && (
          <div className="ff-prog__comms">
            <div className="ff-prog__comms-title">How you did on your commitments</div>
            {commitmentResults.map((c, i) => (
              <div key={i} className={`ff-prog__comm ff-prog__comm--${c.result}`}>
                <span className="ff-prog__comm-icon">
                  {c.result === 'achieved' ? <CheckCircle size={13} /> : c.result === 'partial' ? <TrendingDown size={13} /> : <AlertTriangle size={13} />}
                </span>
                <span className="ff-prog__comm-label">{c.title}</span>
                <span className="ff-prog__comm-badge">
                  {c.result === 'achieved' ? 'Done' : c.result === 'partial' ? 'Partial' : 'Missed'}
                </span>
              </div>
            ))}
          </div>
        )}

        <div className="ff-prog__cats">
          {Object.entries(breakdown)
            .filter(([, d]) => d.previous > 0 || d.current > 0)
            .sort(([, a], [, b]) => Math.abs(b.delta) - Math.abs(a.delta))
            .slice(0, 6)
            .map(([cat, d]) => {
              const meta = CATEGORY_META[cat] || { label: cat, color: '#6b7280' };
              const isGood = d.delta < -50;
              const isBad  = d.delta >  50;
              return (
                <div key={cat} className="ff-prog__cat">
                  <span className="ff-prog__cat-name" style={{ color: meta.color }}>{meta.label}</span>
                  <div className="ff-prog__cat-nums">
                    <span>{fmt(d.previous)}</span>
                    <span className="ff-prog__cat-arrow">→</span>
                    <span style={{ color: isGood ? '#16a34a' : isBad ? '#ef4444' : 'inherit' }}>{fmt(d.current)}</span>
                    {Math.abs(d.delta) > 50 && (
                      <span className={`ff-prog__cat-delta ${isGood ? 'ff-prog__cat-delta--good' : 'ff-prog__cat-delta--bad'}`}>
                        {isGood ? '-' : '+'}{fmt(Math.abs(d.delta))}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
        </div>
      </CardBody>
    </Card>
  );
}

// ── AI coaching note ─────────────────────────────────────────────────────────

function CoachNoteSection({ snapshot }) {
  const [note, setNote]       = useState(snapshot?.coachNote || null);
  const [loading, setLoading] = useState(false);
  const showToast = useToast();

  async function generate() {
    setLoading(true);
    try {
      const res = await ffApi.getCoachNote(snapshot?.id);
      setNote(res.note);
    } catch (e) {
      showToast(e.message || 'Could not generate note', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!snapshot) return null;

  return (
    <Card>
      <CardHeader
        title="Your coaching note"
        subtitle="Personalised advice based on your actual numbers"
      />
      <CardBody>
        {note ? (
          <div>
            <div className="ff-coachnote__text">{note}</div>
            <button className="ff-coachnote__refresh" onClick={generate} disabled={loading}>
              <RefreshCw size={13} className={loading ? 'ff-spin' : ''} />
              {loading ? 'Refreshing…' : 'Refresh note'}
            </button>
          </div>
        ) : (
          <div className="ff-coachnote__empty">
            <p>Get a personalised coaching note based on your income, spending, and bond situation — written by your AI coach.</p>
            <button className="ff-coachnote__btn" onClick={generate} disabled={loading}>
              {loading ? <><RefreshCw size={14} className="ff-spin" /> Generating…</> : 'Generate coaching note'}
            </button>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Commitment panel ─────────────────────────────────────────────────────────

export function CommitPanel({ snapshot, existingCommitments, onCommitted }) {
  const opts = snapshot?.optimizations || [];
  const showToast = useToast();

  // Pre-populate from existing commitment for this snapshot
  const existing = existingCommitments?.find(c => c.snapshotId === snapshot?.id);
  const [selected, setSelected] = useState(() => {
    if (!existing) return new Set();
    const titles = new Set(existing.commitments.map(c => c.title));
    return new Set(opts.reduce((acc, o, i) => { if (titles.has(o.title)) acc.push(i); return acc; }, []));
  });
  const [saving, setSaving] = useState(false);
  const [committed, setCommitted] = useState(!!existing);

  function toggle(i) {
    setSelected(prev => { const next = new Set(prev); next.has(i) ? next.delete(i) : next.add(i); return next; });
    setCommitted(false);
  }

  const totalSaving = opts.reduce((s, o, i) => selected.has(i) ? s + (o.monthlySaving || 0) : s, 0);

  async function commit() {
    if (selected.size === 0) { showToast('Select at least one commitment', 'error'); return; }
    setSaving(true);
    try {
      const commitments = [...selected].map(i => ({
        type:          opts[i].type,
        category:      opts[i].category,
        title:         opts[i].title,
        monthlySaving: opts[i].monthlySaving || 0,
        loanImpact:    opts[i].loanImpact    || 0,
      }));
      await ffApi.saveCommitments(commitments, snapshot?.id);
      setCommitted(true);
      onCommitted(commitments);
      showToast(`${selected.size} commitment${selected.size !== 1 ? 's' : ''} saved — we'll track these next upload`, 'success');
    } catch (e) {
      showToast(e.message || 'Could not save commitments', 'error');
    } finally {
      setSaving(false);
    }
  }

  if (opts.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Commit to an action"
        subtitle="Tick what you'll work on — we'll check in next time you upload"
      />
      <CardBody>
        <div className="ff-commit__list">
          {opts.map((o, i) => (
            <label key={i} className={`ff-commit__item ${selected.has(i) ? 'ff-commit__item--on' : ''}`}>
              <input type="checkbox" checked={selected.has(i)} onChange={() => toggle(i)} className="ff-commit__check" />
              <div className="ff-commit__body">
                <div className="ff-commit__title">{o.title}</div>
                {o.monthlySaving > 0 && (
                  <div className="ff-commit__saving">
                    <TrendingDown size={11} /> Saves {fmt(o.monthlySaving)}/mo
                  </div>
                )}
              </div>
            </label>
          ))}
        </div>
        {selected.size > 0 && (
          <div className="ff-commit__summary">
            {selected.size} action{selected.size !== 1 ? 's' : ''} selected
            {totalSaving > 0 && <> · saving <strong>{fmt(totalSaving)}/mo</strong></>}
          </div>
        )}
        <button
          className={`ff-commit__btn ${committed ? 'ff-commit__btn--done' : ''}`}
          onClick={commit}
          disabled={saving || selected.size === 0}
        >
          {saving ? 'Saving…' : committed ? <><CheckCircle size={14} /> Committed!</> : `Commit to ${selected.size || ''} action${selected.size !== 1 ? 's' : ''}`}
        </button>
        {committed && (
          <div className="ff-commit__nudge">
            Upload a new statement in 30 days — we'll check how you went against these commitments.
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Ready to apply banner ────────────────────────────────────────────────────

function ReadyToApplyBanner({ readiness, maxBond }) {
  if (readiness < 70) return null;
  return (
    <div className="ff-ready">
      <div className="ff-ready__icon">🏠</div>
      <div className="ff-ready__body">
        <div className="ff-ready__title">You're in a strong position to apply</div>
        <div className="ff-ready__sub">Readiness score {readiness}/100 · Max bond {fmt(maxBond)} — apply to all 7 banks at once for competing offers.</div>
      </div>
      <a href="/get-a-quote" className="ff-ready__btn">Apply now →</a>
    </div>
  );
}

// ── Gross income note ────────────────────────────────────────────────────────

function GrossIncomeNote({ nettIncome, debt }) {
  if (!nettIncome || nettIncome <= 0) return null;
  const gross = estimateGross(nettIncome);
  if (!gross) return null;
  const grossMaxBond = Math.round(Math.max(0, gross.hi * 0.30 - (debt || 0)) * pv());
  return (
    <div className="ff-gross-note">
      <span>Take-home detected: <strong>{fmt(nettIncome)}/mo</strong> · Gross salary est: <strong>{fmt(gross.lo)}–{fmt(gross.hi)}/mo</strong></span>
      <span className="ff-gross-note__bond">Banks may qualify up to <strong>{fmt(grossMaxBond)}</strong> on your payslip</span>
    </div>
  );
}

// ── Peer benchmark summary ───────────────────────────────────────────────────

function PeerBenchmarkSummary({ benchmarks, breakdown }) {
  if (!benchmarks || Object.keys(benchmarks).length === 0) return null;
  const cats = Object.entries(benchmarks)
    .filter(([k]) => (breakdown[k] || 0) > 0)
    .map(([k, b]) => ({ key: k, over: (breakdown[k] || 0) > (b.peerAmount || 0), delta: (breakdown[k] || 0) - (b.peerAmount || 0) }));
  if (cats.length === 0) return null;
  const totalDelta = cats.reduce((s, c) => s + c.delta, 0);
  const overCount  = cats.filter(c => c.over).length;
  const underCount = cats.filter(c => !c.over).length;
  const good = totalDelta <= 0;
  return (
    <div className="ff-peer">
      <div className={`ff-peer__header ${good ? 'ff-peer__header--good' : 'ff-peer__header--warn'}`}>
        {good
          ? <><TrendingDown size={14} /> You spend {fmt(Math.abs(Math.round(totalDelta)))}/mo <strong>less</strong> than your income bracket average</>
          : <><TrendingUp size={14} /> You spend {fmt(Math.round(totalDelta))}/mo <strong>more</strong> than your income bracket average</>
        }
      </div>
      <div className="ff-peer__chips">
        {underCount > 0 && <span className="ff-peer__chip ff-peer__chip--good">{underCount} categories below avg</span>}
        {overCount  > 0 && <span className="ff-peer__chip ff-peer__chip--bad">{overCount} above avg</span>}
      </div>
    </div>
  );
}

// ── Bank likelihood panel ────────────────────────────────────────────────────

const BANK_STATUS_META = {
  likely:    { label: 'Likely ✓',    color: '#16a34a', bg: 'rgba(22,163,74,0.07)'  },
  possible:  { label: 'Borderline',  color: '#d97706', bg: 'rgba(217,119,6,0.07)'  },
  borderline:{ label: 'Borderline',  color: '#d97706', bg: 'rgba(217,119,6,0.07)'  },
  unlikely:  { label: 'Unlikely',    color: '#dc2626', bg: 'rgba(220,38,38,0.05)'  },
};

function BankLikelihoodPanel({ income, dtiDecimal, employmentType, incomeConfidence }) {
  if (!income || income <= 0) return null;
  const banks = bankLikelihood(income, dtiDecimal, employmentType || 'unknown');
  const likelyCount = banks.filter(b => b.status === 'likely').length;
  return (
    <Card>
      <CardHeader
        title="Bank-by-bank outlook"
        subtitle={`${likelyCount} of 7 banks likely to approve based on your current profile`}
      />
      <CardBody>
        {incomeConfidence === 'low' && (
          <div style={{ fontSize:'0.8rem', color:'#d97706', background:'rgba(217,119,6,0.07)', border:'1px solid rgba(217,119,6,0.2)', borderRadius:8, padding:'8px 12px', marginBottom:14 }}>
            Income confidence is low — upload 3 months of statements for a more accurate outlook.
          </div>
        )}
        <div className="ff-banks">
          {banks.map(bank => {
            const meta = BANK_STATUS_META[bank.status];
            return (
              <div key={bank.name} className="ff-bank" style={{ background: meta.bg }}>
                <div className="ff-bank__name">{bank.name}</div>
                <div className="ff-bank__reason">{bank.reason}</div>
                <span className="ff-bank__badge" style={{ color: meta.color, borderColor: meta.color }}>{meta.label}</span>
              </div>
            );
          })}
        </div>
        <div className="ff-banks__note">Indicative only — actual approval depends on your credit score, employment history, and bank-specific scoring models.</div>
      </CardBody>
    </Card>
  );
}

// ── Savings health panel ─────────────────────────────────────────────────────

function SavingsHealthPanel({ income, expenses, debt, accountBalance }) {
  if (!income || income <= 0) return null;
  const totalOut = (expenses?.total || 0) + (debt || 0);
  const surplus = Math.max(0, income - totalOut);
  const savingsRate = income > 0 ? (surplus / income) * 100 : 0;
  const monthsRunway = accountBalance > 0 && (expenses?.total || 0) > 0
    ? accountBalance / expenses.total : null;
  const savingsOk = savingsRate >= 10;
  const runwayOk  = monthsRunway !== null && monthsRunway >= 2.5;
  return (
    <Card>
      <CardHeader title="Savings & safety net" subtitle="Two factors banks quietly check beyond your income" />
      <CardBody>
        <div className="ff-health__grid">
          <div className="ff-health__item">
            <div className="ff-health__label">Monthly savings rate</div>
            <div className="ff-health__val" style={{ color: savingsOk ? '#16a34a' : surplus === 0 ? '#dc2626' : '#d97706' }}>
              {savingsRate.toFixed(1)}%
            </div>
            <div className="ff-health__sub">{fmt(Math.round(surplus))}/mo surplus · target 10%+</div>
            <div className="ff-health__bar-track">
              <div className="ff-health__bar-fill" style={{ width: Math.min(100, (savingsRate / 20) * 100) + '%', background: savingsOk ? '#16a34a' : '#d97706' }} />
              <div className="ff-health__bar-target" style={{ left: '50%' }} />
            </div>
            {surplus === 0
              ? <div className="ff-health__warn">Spending exceeds income — banks will flag this</div>
              : !savingsOk && <div className="ff-health__hint">Save {fmt(Math.round(income * 0.10 - surplus))}/mo more to hit the 10% target</div>
            }
          </div>
          {monthsRunway !== null && (
            <div className="ff-health__item">
              <div className="ff-health__label">Emergency fund runway</div>
              <div className="ff-health__val" style={{ color: runwayOk ? '#16a34a' : '#d97706' }}>
                {monthsRunway.toFixed(1)} months
              </div>
              <div className="ff-health__sub">{fmt(Math.round(accountBalance))} in account · target 2–3 months</div>
              <div className="ff-health__bar-track">
                <div className="ff-health__bar-fill" style={{ width: Math.min(100, (monthsRunway / 4) * 100) + '%', background: runwayOk ? '#16a34a' : '#d97706' }} />
                <div className="ff-health__bar-target" style={{ left: '62.5%' }} />
              </div>
              {!runwayOk && (
                <div className="ff-health__hint">
                  Save {fmt(Math.round(Math.max(0, 2.5 * (expenses?.total || 0) - accountBalance)))} more for a solid buffer
                </div>
              )}
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ── Debt priority panel ──────────────────────────────────────────────────────

function DebtPriorityPanel({ debts }) {
  const items = (debts?.items || []).filter(d => (d.monthlyAmount || d.total || 0) > 0);
  if (items.length < 2) return null;
  const ranked = [...items]
    .map(d => ({
      ...d,
      monthly: d.monthlyAmount || (d.total / Math.max(1, d.count)) || 0,
      rate: debtRate(d),
      bondUnlock: Math.round((d.monthlyAmount || d.total || 0) * pv()),
    }))
    .sort((a, b) => b.rate - a.rate);
  return (
    <Card>
      <CardHeader title="Debt payoff priority" subtitle="Pay highest-rate debt first — saves the most interest (avalanche method)" />
      <CardBody>
        <div className="ff-debts">
          {ranked.map((d, i) => (
            <div key={i} className="ff-debt">
              <div className="ff-debt__rank">{i + 1}</div>
              <div className="ff-debt__body">
                <div className="ff-debt__name">{(d.payee || 'Debt').slice(0, 32)}</div>
                <div className="ff-debt__meta">{fmt(Math.round(d.monthly))}/mo · est. {d.rate.toFixed(0)}% p.a.</div>
              </div>
              <div className="ff-debt__unlock">
                <div className="ff-debt__unlock-val">+{fmt(d.bondUnlock)}</div>
                <div className="ff-debt__unlock-label">bond when cleared</div>
              </div>
            </div>
          ))}
        </div>
        <div className="ff-debts__note">Each monthly payment freed from debt adds that amount × 88.5 to your max bond capacity.</div>
      </CardBody>
    </Card>
  );
}

// ── Net worth panel ──────────────────────────────────────────────────────────

function NetWorthPanel({ accountBalance, debts }) {
  const [input, setInput] = useState(() => localStorage.getItem('bondly_ff_propval') || '');
  const propValue = parseFloat(input) || 0;
  function handleBlur() { localStorage.setItem('bondly_ff_propval', input); }
  const savings = accountBalance || 0;
  const debtProxy = (debts?.totalMonthly || 0) * 36;
  const netWorth = propValue + savings - debtProxy;
  return (
    <Card>
      <CardHeader title="Net worth snapshot" subtitle="Your approximate financial position — add your property value for the full picture" />
      <CardBody>
        <div style={{ marginBottom: 16 }}>
          <div className="ff-networth__label">Property value (if you own)</div>
          <div className="ff-networth__input-wrap">
            <span className="ff-networth__prefix">R</span>
            <input type="number" className="ff-networth__input" placeholder="e.g. 1 500 000"
              value={input} onChange={e => setInput(e.target.value)} onBlur={handleBlur} />
          </div>
        </div>
        <div className="ff-networth__rows">
          {propValue > 0 && <div className="ff-networth__row ff-networth__row--asset"><span>Property value</span><strong>+{fmt(propValue)}</strong></div>}
          {savings > 0 && <div className="ff-networth__row ff-networth__row--asset"><span>Account balance</span><strong>+{fmt(Math.round(savings))}</strong></div>}
          {debtProxy > 0 && <div className="ff-networth__row ff-networth__row--debt"><span>Est. outstanding debt (36mo proxy)</span><strong>−{fmt(Math.round(debtProxy))}</strong></div>}
          <div className="ff-networth__total">
            <span>Estimated net worth</span>
            <strong style={{ color: netWorth >= 0 ? '#16a34a' : '#ef4444' }}>
              {netWorth < 0 ? '−' : ''}{fmt(Math.abs(Math.round(netWorth)))}
            </strong>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Budget alignment panel ───────────────────────────────────────────────────

const RECOMMENDED_PCT = {
  groceries: 0.12, entertainment: 0.05, fuel: 0.08,
  utilities: 0.06, insurance: 0.08, subscriptions: 0.02,
  other: 0.05, gambling: 0,
};

function BudgetAlignmentPanel({ income, breakdown }) {
  if (!income || income <= 0 || Object.keys(breakdown || {}).length === 0) return null;
  const cats = Object.entries(breakdown || {})
    .filter(([, amt]) => amt > 0)
    .map(([key, actual]) => {
      const meta = CATEGORY_META[key] || { label: key, color: '#6b7280' };
      const recommended = Math.round(income * (RECOMMENDED_PCT[key] ?? 0.05));
      const over = Math.max(0, actual - recommended);
      return { key, meta, actual, recommended, over, bondImpact: over > 0 ? Math.round(over * pv()) : 0 };
    })
    .sort((a, b) => b.over - a.over);
  const totalBondGain = cats.reduce((s, c) => s + c.bondImpact, 0);
  const maxActual = Math.max(...cats.map(c => c.actual), 1);
  return (
    <Card>
      <CardHeader title="Bond-linked budget" subtitle="Recommended spend vs actual — based on your income level" />
      <CardBody>
        <div className="ff-budget">
          {cats.map(cat => (
            <div key={cat.key} className="ff-budget__row">
              <div className="ff-budget__name" style={{ color: cat.meta.color }}>{cat.meta.label}</div>
              <div className="ff-budget__bars">
                <div className="ff-budget__bar-track">
                  <div className="ff-budget__bar-actual" style={{ width: Math.min(100, (cat.actual / (maxActual * 1.1)) * 100) + '%', background: cat.meta.color, opacity: cat.over > 0 ? 1 : 0.45 }} />
                  {cat.recommended > 0 && (
                    <div className="ff-budget__bar-target"
                      style={{ left: Math.min(98, (cat.recommended / (maxActual * 1.1)) * 100) + '%' }}
                      title={`Recommended: ${fmt(cat.recommended)}`} />
                  )}
                </div>
              </div>
              <div className="ff-budget__amts">
                <span style={{ color: cat.over > 0 ? '#ef4444' : '#16a34a', fontWeight: 600 }}>{fmt(cat.actual)}</span>
                <span className="ff-budget__rec">rec {fmt(cat.recommended)}</span>
              </div>
              {cat.over > 0 && <div className="ff-budget__impact">+{fmt(cat.bondImpact)} bond</div>}
            </div>
          ))}
        </div>
        {totalBondGain > 0 && (
          <div className="ff-budget__total">
            Aligning all to recommendations unlocks <strong>+{fmt(totalBondGain)} more bond</strong>
          </div>
        )}
        <div className="ff-budget__note">Recommended % based on South African financial health guidelines. The vertical line on each bar shows the target.</div>
      </CardBody>
    </Card>
  );
}

// ── Main tab ─────────────────────────────────────────────────────────────────

export default function FinancialFitnessTab() {
  const [snapshots, setSnapshots]   = useState([]);
  const [goal, setGoal]             = useState(null);
  const [progress, setProgress]     = useState(null);
  const [commitments, setCommitments] = useState([]);
  const [loading, setLoading]       = useState(true);
  const [uploading, setUploading]   = useState(false);
  const [stepIdx, setStepIdx]       = useState(0);
  const [revealSnap, setRevealSnap] = useState(null);
  const showToast = useToast();

  useEffect(() => {
    Promise.all([
      ffApi.getSnapshots().then(d => setSnapshots(d.snapshots || [])),
      ffApi.getGoals().then(d => setGoal(d.goals?.[0] || null)),
      ffApi.getProgress().then(d => setProgress(d)).catch(() => {}),
      ffApi.getCommitments().then(d => setCommitments(d.commitments || [])).catch(() => {}),
    ]).catch(() => {}).finally(async () => {
      setLoading(false);
      // Consume any pending statement result from the optimizer (e.g. after email verification)
      try {
        const raw = sessionStorage.getItem('bondly_optimizer_pending');
        if (raw) {
          sessionStorage.removeItem('bondly_optimizer_pending');
          const analysis = JSON.parse(raw);
          const saved = await ffApi.saveSnapshot(analysis);
          setSnapshots(saved.snapshots || []);
          setRevealSnap(saved.snapshot);
        }
      } catch {}
    });
  }, []);

  async function handleUpload(file) {
    if (!file) return;
    if (file.size > 10 * 1024 * 1024) { showToast('File must be under 10MB', 'error'); return; }
    setUploading(true);
    setStepIdx(0);

    // Animate steps while we wait for the parse
    const timer = setInterval(() => {
      setStepIdx(i => (i < UPLOAD_STEPS.length - 1 ? i + 1 : i));
    }, 600);

    try {
      const res = await parseStatementForPreapproval(file);
      clearInterval(timer);
      if (!res.success) throw new Error(res.error || 'Parse failed');

      const analysis = res.data;
      const saved = await ffApi.saveSnapshot(analysis);
      setSnapshots(saved.snapshots || []);
      setRevealSnap(saved.snapshot);
      // Refresh progress and commitments after new upload
      ffApi.getProgress().then(d => setProgress(d)).catch(() => {});
      ffApi.getCommitments().then(d => setCommitments(d.commitments || [])).catch(() => {});
    } catch (err) {
      clearInterval(timer);
      showToast(err.message || 'Could not analyse statement', 'error');
    } finally {
      setUploading(false);
    }
  }

  if (loading) {
    return (
      <div className="ff-loading">
        <RefreshCw size={24} className="ff-spin" />
        <span>Loading…</span>
      </div>
    );
  }

  if (uploading) {
    return <UploadProgress stepIdx={stepIdx} />;
  }

  const latest   = revealSnap || snapshots[0] || null;
  const income   = latest?.income?.monthlyAmount || 0;
  const maxBond  = latest?.qualification?.maxBond || 0;
  const zone     = latest?.affordabilityZone;
  const readiness = latest?.readiness?.score ?? (typeof latest?.readiness === 'number' ? latest.readiness : 0);
  const breakdown = latest?.expenses?.breakdown || {};
  const benchmarks = latest?.spendingBenchmarks || {};
  const optimizations = latest?.optimizations || [];
  const subscriptionItems = latest?.subscriptionItems || latest?.expenses?.subscriptionItems || [];
  const days = daysSince(latest?.uploadedAt);

  // No data yet → inviting empty state
  if (!latest) {
    return <UploadIntro onFile={handleUpload} />;
  }

  // Post-upload reveal
  if (revealSnap) {
    return (
      <div className="ff-wrap">
        <ReportReveal snapshot={revealSnap} onDismiss={() => setRevealSnap(null)} />
      </div>
    );
  }

  const zoneColor = { green: '#16a34a', yellow: '#d97706', red: '#ef4444' }[zone?.zone] || '#6b7280';

  return (
    <div className="ff-wrap">

      {/* 1. Freshness strip */}
      <UploadStrip days={days} uploading={uploading} onFile={handleUpload} />

      {/* 2. Ready to apply banner */}
      <ReadyToApplyBanner readiness={readiness} maxBond={maxBond} />

      {/* 3. Summary header */}
      <div className="ff-summary">
        <div className="ff-summary__ring-wrap">
          <svg viewBox="0 0 80 80" className="ff-ring-svg">
            <circle cx="40" cy="40" r="34" strokeWidth="7" className="ff-ring-track" />
            <circle cx="40" cy="40" r="34" strokeWidth="7" className="ff-ring-fill"
              strokeDasharray={`${(readiness / 100) * 213.6} 213.6`}
              transform="rotate(-90 40 40)"
              style={{ stroke: readiness >= 70 ? '#16a34a' : readiness >= 45 ? '#d97706' : '#ef4444' }} />
          </svg>
          <div className="ff-ring-label">
            <div className="ff-ring-num">{readiness}</div>
            <div className="ff-ring-sub">/ 100</div>
          </div>
        </div>
        <div className="ff-summary__info">
          <div className="ff-summary__bond">Max bond: <strong>{fmt(maxBond)}</strong></div>
          <div className="ff-summary__income">Income detected: {income > 0 ? fmt(income) + '/mo' : 'Unknown'}</div>
          {zone && (
            <span className="ff-zone" style={{ color: zoneColor, borderColor: zoneColor }}>
              {zone.sublabel || zone.label}
            </span>
          )}
        </div>
      </div>

      {/* 4. Gross income note */}
      <GrossIncomeNote nettIncome={income} debt={latest?.debts?.totalMonthly || 0} />

      {/* 5. Peer benchmark summary */}
      <PeerBenchmarkSummary benchmarks={benchmarks} breakdown={breakdown} />

      {/* 6. Month-over-month progress */}
      <ProgressSection progress={progress} />

      {/* 7. AI coaching note */}
      <CoachNoteSection snapshot={latest} />

      {/* 8. Spending breakdown */}
      <Card>
        <CardHeader title="Spending breakdown"
          subtitle={`${latest.statementMonths || 1}-month average · line = avg for ${Object.values(benchmarks)[0]?.bracketLabel || 'your income bracket'}`} />
        <CardBody>
          <div className="ff-sbars">
            {Object.entries(breakdown)
              .filter(([, amt]) => amt > 0)
              .sort(([ka], [kb]) => {
                if (ka === 'gambling') return -1;
                if (kb === 'gambling') return 1;
                return (breakdown[kb] || 0) - (breakdown[ka] || 0);
              })
              .map(([key, amt]) => (
                <SpendingBar key={key} category={key} amount={amt}
                  income={income} benchmark={benchmarks[key]} />
              ))}
          </div>
          {subscriptionItems.length > 0 && (
            <SubscriptionPanel items={subscriptionItems} />
          )}
          <div className="ff-sbars__totals">
            <span>Total living costs: <strong>{fmt(latest.expenses?.total || 0)}/mo</strong></span>
            <span>Net disposable: <strong>{fmt(latest.riskProfile?.netDisposable || 0)}/mo</strong></span>
          </div>
        </CardBody>
      </Card>

      {/* 9. Action plan */}
      {optimizations.length > 0 && (
        <Card>
          <CardHeader title="Your action plan"
            subtitle="Personalised improvements ranked by bond impact" />
          <CardBody>
            <div className="ff-coaches">
              {optimizations.map((item, i) => <CoachCard key={i} item={item} />)}
            </div>
          </CardBody>
        </Card>
      )}

      {/* 10. Commitments */}
      {optimizations.length > 0 && (
        <CommitPanel
          snapshot={latest}
          existingCommitments={commitments}
          onCommitted={() => ffApi.getCommitments().then(d => setCommitments(d.commitments || [])).catch(() => {})}
        />
      )}

      {/* 11. Bank likelihood */}
      <BankLikelihoodPanel
        income={income}
        dtiDecimal={latest?.riskProfile?.dti ? latest.riskProfile.dti / 100 : 0}
        employmentType={latest?.income?.employmentType}
        incomeConfidence={latest?.income?.confidence}
      />

      {/* 12. Savings health */}
      <SavingsHealthPanel
        income={income}
        expenses={latest?.expenses}
        debt={latest?.debts?.totalMonthly || 0}
        accountBalance={latest?.accountBalance}
      />

      {/* 13. Debt priority */}
      <DebtPriorityPanel debts={latest?.debts} />

      {/* 14. Budget alignment */}
      <BudgetAlignmentPanel income={income} breakdown={breakdown} />

      {/* 15. Goal setting */}
      <GoalPanel
        snapshot={latest}
        goal={goal}
        onSaved={g => setGoal(g)}
        onDeleted={() => setGoal(null)}
      />

      {/* 16. Projection — how much more bond can you qualify for */}
      <ProjectionPanel snapshot={latest} />

      {/* 17. Pay off faster — redirect waste spend to shrink term + save interest */}
      <PayOffFasterPanel snapshot={latest} />

      {/* 18. Net worth */}
      <NetWorthPanel
        accountBalance={latest?.accountBalance}
        debts={latest?.debts}
      />

      {/* 19. History */}
      <SnapshotHistory snapshots={snapshots} />

    </div>
  );
}
