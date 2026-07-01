import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  TrendingUp, Activity, Home, DollarSign, PiggyBank,
  ShoppingBag, Shield, Repeat, Lightbulb, ArrowRight,
  Upload, CheckCircle, AlertTriangle, XCircle,
} from 'lucide-react';
import { finances } from '../../lib/api.js';
import { fmt } from '@bondly/ui/lib/format.js';
import { SkeletonCard } from '@bondly/ui/components/Skeleton.jsx';
import './FIReport.css';

// ── Score ring ────────────────────────────────────────────────────────────────
function ScoreRing({ score, size = 160 }) {
  const r = (size - 20) / 2;
  const circ = 2 * Math.PI * r;
  const [drawn, setDrawn] = useState(0);

  useEffect(() => {
    const id = setTimeout(() => setDrawn(score), 80);
    return () => clearTimeout(id);
  }, [score]);

  const color = score >= 70 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const dash = (drawn / 100) * circ;

  return (
    <svg
      width={size}
      height={size}
      className="fir-ring"
      style={{ '--ring-transition': '1.4s cubic-bezier(.4,0,.2,1)' }}
    >
      <circle cx={size / 2} cy={size / 2} r={r} className="fir-ring__track" />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        className="fir-ring__fill"
        stroke={color}
        strokeDasharray={`${dash} ${circ}`}
        strokeDashoffset={0}
        strokeLinecap="round"
        style={{ transition: `stroke-dasharray var(--ring-transition)` }}
        transform={`rotate(-90 ${size / 2} ${size / 2})`}
      />
      <text x="50%" y="46%" className="fir-ring__score" fill={color} textAnchor="middle" dominantBaseline="middle">
        {score}
      </text>
      <text x="50%" y="62%" className="fir-ring__label" fill="#94a3b8" textAnchor="middle" dominantBaseline="middle">
        / 100
      </text>
    </svg>
  );
}

// ── Benchmark bar ─────────────────────────────────────────────────────────────
function BenchmarkRow({ label, userVal, userPct, benchmarkPct, benchmarkLabel, narrative, positive }) {
  const color = positive ? '#22c55e' : '#ef4444';
  return (
    <div className="fir-bench-row">
      <div className="fir-bench-meta">
        <span className="fir-bench-label">{label}</span>
        <span className="fir-bench-narrative">{narrative}</span>
      </div>
      <div className="fir-bench-bars">
        <div className="fir-bench-track">
          <div
            className="fir-bench-fill"
            style={{ width: `${Math.min(userPct, 100)}%`, background: color }}
          />
        </div>
        <span className="fir-bench-val">{userVal}</span>
      </div>
      <div className="fir-bench-bars fir-bench-bars--ref">
        <div className="fir-bench-track fir-bench-track--ref">
          <div
            className="fir-bench-fill fir-bench-fill--ref"
            style={{ width: `${Math.min(benchmarkPct, 100)}%` }}
          />
        </div>
        <span className="fir-bench-val fir-bench-val--ref">{benchmarkLabel}</span>
      </div>
    </div>
  );
}

// ── Dimension bar ─────────────────────────────────────────────────────────────
const DIM_ICONS = {
  income: DollarSign, savings: PiggyBank, debt: Activity,
  spending: ShoppingBag, emergency: Shield, subscriptions: Repeat, cashflow: TrendingUp,
};
const DIM_LABELS = {
  income: 'Income', savings: 'Savings', debt: 'Debt burden',
  spending: 'Lifestyle spend', emergency: 'Emergency fund', subscriptions: 'Subscriptions', cashflow: 'Cash flow',
};

function DimRow({ dimKey, dim }) {
  const Icon = DIM_ICONS[dimKey] || Activity;
  const color = dim.score >= 70 ? '#22c55e' : dim.score >= 50 ? '#eab308' : '#ef4444';
  return (
    <div className="fir-dim-row">
      <div className="fir-dim-icon" style={{ color }}>
        <Icon size={16} />
      </div>
      <span className="fir-dim-name">{DIM_LABELS[dimKey] || dimKey}</span>
      <div className="fir-dim-track">
        <div
          className="fir-dim-fill"
          style={{ width: `${dim.score}%`, background: color }}
        />
      </div>
      <span className="fir-dim-label" style={{ color }}>{dim.label}</span>
      <span className="fir-dim-score" style={{ color }}>{dim.score}</span>
    </div>
  );
}

// ── Improvement card ──────────────────────────────────────────────────────────
const WHY_MAP = [
  { match: /subscription/i, why: 'Subscription creep is the #1 silent drain on SA household budgets.' },
  { match: /emergency/i,    why: 'Banks see your buffer. Less than 3 months and you\'re high-risk.' },
  { match: /debt|credit/i,  why: 'Every rand of debt reduces your bond qualification amount.' },
  { match: /sav/i,          why: 'A higher savings rate signals discipline to every lender.' },
  { match: /income/i,       why: 'Consistent deposits are the first thing underwriters check.' },
];

function getWhy(text) {
  const hit = WHY_MAP.find(w => w.match.test(text));
  return hit ? hit.why : 'Small changes in this area compound over a 20-year bond term.';
}

// ── Main component ────────────────────────────────────────────────────────────
export default function FIReport() {
  const navigate = useNavigate();
  const [health, setHealth] = useState(null);
  const [risk, setRisk]     = useState(null);
  const [ready, setReady]   = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]   = useState(false);

  useEffect(() => {
    Promise.all([
      finances.health(),
      finances.cashflowRisk(),
      finances.mortgageReadiness(),
    ])
      .then(([h, r, rd]) => {
        setHealth(h);
        setRisk(r);
        setReady(rd);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="fir-page">
        <div className="fir-loading">
          <SkeletonCard lines={4} />
          <SkeletonCard lines={3} />
          <SkeletonCard lines={6} />
        </div>
      </div>
    );
  }

  if (error || !health) {
    return (
      <div className="fir-page fir-page--empty">
        <div className="fir-empty">
          <Upload size={48} className="fir-empty__icon" />
          <h2 className="fir-empty__title">Upload your statements to unlock your report</h2>
          <p className="fir-empty__body">
            Connect your bank account or upload 3 months of statements and we'll generate your full Financial X-Ray in seconds.
          </p>
          <button className="fir-btn fir-btn--primary" onClick={() => navigate('/dashboard')}>
            Go to dashboard <ArrowRight size={16} />
          </button>
        </div>
      </div>
    );
  }

  const { overallScore, grade, dimensions, metrics, categoryBreakdown, improvements } = health;
  const gradeColor = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', F: '#ef4444' }[grade] || '#94a3b8';

  // Signal 1 — income stability
  const cv = risk?.incomeStabilityCV ?? 0;
  const stabilityLabel = cv < 0.15 ? 'Reliable' : cv < 0.25 ? 'Moderate' : 'Variable';
  const stabilityColor = cv < 0.15 ? '#22c55e' : cv < 0.25 ? '#eab308' : '#ef4444';
  const stabilityText  = cv < 0.15
    ? 'Consistent monthly deposits detected'
    : `Your income varies by ${Math.round(cv * 100)}% month to month`;

  // Signal 2 — DTI
  const dti = metrics?.dti ?? 0;
  const dtiPct = Math.round(dti * 100);
  const dtiLabel = dti < 0.30 ? 'Below the 30% red line' : dti < 0.43 ? 'Approaching bank limits' : 'Above the threshold';
  const dtiColor = dti < 0.30 ? '#22c55e' : dti < 0.43 ? '#eab308' : '#ef4444';

  // Signal 3 — bond readiness
  const maxBond = ready?.maxBondEstimate ?? 0;
  const readinessLevel = ready?.readinessLevel ?? 'not_ready';
  const bondLabel = readinessLevel === 'ready' ? 'You qualify today' : readinessLevel === 'nearly_ready' ? 'Almost there' : 'Building toward this';
  const bondColor = readinessLevel === 'ready' ? '#22c55e' : '#eab308';

  // Benchmarks
  const savingsRate = metrics?.savingsRate ?? 0;
  const housePct    = categoryBreakdown && metrics?.income
    ? (categoryBreakdown['Housing'] ?? 0) / metrics.income
    : 0;
  const discPct  = metrics?.discretionaryPct ?? 0;
  const emgMonths = metrics?.emergencyMonths ?? 0;

  // Switching opportunity
  const monthlyIncome = metrics?.income ?? 0;
  const saving = monthlyIncome > 0
    ? Math.round(monthlyIncome * 0.02)
    : Math.round((maxBond * 0.015) / 12);
  const saving5yr = saving * 60;

  const top3 = (improvements || []).slice(0, 3);

  return (
    <div className="fir-page">

      {/* ── 1. HERO ─────────────────────────────────────────────────── */}
      <section className="fir-hero">
        <div className="fir-hero__inner">
          <div className="fir-hero__left">
            <span className="fir-badge">Financial X-Ray</span>
            <h1 className="fir-hero__title">Your Financial<br />Intelligence Report</h1>
            <p className="fir-hero__sub">Based on your real transaction data · Generated today</p>
            <p className="fir-hero__tagline">
              This is what banks see when they assess your application — and exactly where you stand against South African benchmarks.
            </p>
          </div>
          <div className="fir-hero__right">
            <ScoreRing score={overallScore} size={180} />
            <div className="fir-hero__grade-wrap">
              <span className="fir-hero__grade" style={{ color: gradeColor, borderColor: gradeColor }}>
                {grade}
              </span>
              <span className="fir-hero__grade-label">Financial Health</span>
            </div>
          </div>
        </div>
        <div className="fir-hero__glow" />
      </section>

      <div className="fir-content">

        {/* ── 2. WHAT BANKS SEE ─────────────────────────────────── */}
        <section className="fir-section">
          <h2 className="fir-section__title">What banks see when they look at you</h2>
          <p className="fir-section__sub">Three signals that determine whether you get approved — and at what rate.</p>
          <div className="fir-signals">

            <div className="fir-signal">
              <div className="fir-signal__icon" style={{ background: `${stabilityColor}18`, color: stabilityColor }}>
                <TrendingUp size={22} />
              </div>
              <div className="fir-signal__label" style={{ color: stabilityColor }}>{stabilityLabel}</div>
              <div className="fir-signal__metric">Income stability</div>
              <div className="fir-signal__text">{stabilityText}</div>
              {risk?.returnDebits > 0 && (
                <div className="fir-signal__alert">
                  <AlertTriangle size={13} /> {risk.returnDebits} returned debit{risk.returnDebits > 1 ? 's' : ''} in 90 days
                </div>
              )}
            </div>

            <div className="fir-signal">
              <div className="fir-signal__icon" style={{ background: `${dtiColor}18`, color: dtiColor }}>
                <Activity size={22} />
              </div>
              <div className="fir-signal__label" style={{ color: dtiColor }}>{dtiPct}% DTI</div>
              <div className="fir-signal__metric">Debt burden</div>
              <div className="fir-signal__text">{dtiLabel} — banks red-flag above 43%</div>
            </div>

            <div className="fir-signal">
              <div className="fir-signal__icon" style={{ background: `${bondColor}18`, color: bondColor }}>
                <Home size={22} />
              </div>
              <div className="fir-signal__label" style={{ color: bondColor }}>{fmt(maxBond)}</div>
              <div className="fir-signal__metric">Bond qualification</div>
              <div className="fir-signal__text">{bondLabel}</div>
              {readinessLevel === 'ready' && (
                <div className="fir-signal__check">
                  <CheckCircle size={13} /> Meets bank criteria now
                </div>
              )}
            </div>

          </div>
        </section>

        {/* ── 3. BENCHMARK COMPARISONS ──────────────────────────── */}
        <section className="fir-section">
          <h2 className="fir-section__title">What your spending reveals</h2>
          <p className="fir-section__sub">Your numbers, benchmarked against South African households.</p>
          <div className="fir-bench-table">
            <div className="fir-bench-header">
              <span>Your profile</span>
              <span />
              <span>SA benchmark</span>
            </div>

            <BenchmarkRow
              label="Savings rate"
              userVal={`${Math.round(savingsRate * 100)}%`}
              userPct={savingsRate * 100}
              benchmarkPct={12}
              benchmarkLabel="SA avg 12%"
              positive={savingsRate >= 0.12}
              narrative={
                savingsRate >= 0.12
                  ? `You save more than most South Africans`
                  : `Below the SA average — a key lender concern`
              }
            />

            <BenchmarkRow
              label="Housing cost"
              userVal={`${Math.round(housePct * 100)}%`}
              userPct={housePct * 100}
              benchmarkPct={28}
              benchmarkLabel="SA norm 28%"
              positive={housePct <= 0.28}
              narrative={
                housePct <= 0.28
                  ? `Housing spend is within healthy range`
                  : `Housing takes ${Math.round(housePct * 100)}% of income — above the 28% norm`
              }
            />

            <BenchmarkRow
              label="Lifestyle spend"
              userVal={`${Math.round(discPct * 100)}%`}
              userPct={discPct * 100}
              benchmarkPct={15}
              benchmarkLabel="SA norm 15%"
              positive={discPct <= 0.15}
              narrative={
                discPct <= 0.15
                  ? `Disciplined discretionary spending`
                  : `Lifestyle at ${Math.round(discPct * 100)}% — above the SA average of 15%`
              }
            />

            <BenchmarkRow
              label="Emergency runway"
              userVal={`${emgMonths.toFixed(1)} months`}
              userPct={(emgMonths / 6) * 100}
              benchmarkPct={50}
              benchmarkLabel="Recommended 3 mo"
              positive={emgMonths >= 3}
              narrative={
                emgMonths >= 3
                  ? `Solid buffer — lenders see financial resilience`
                  : `${emgMonths.toFixed(1)} months runway — banks want to see 3+`
              }
            />
          </div>
        </section>

        {/* ── 4. SWITCHING OPPORTUNITY ──────────────────────────── */}
        {readinessLevel !== 'not_ready' ? (
          <section className="fir-opportunity">
            <div className="fir-opportunity__badge">Opportunity identified</div>
            <h2 className="fir-opportunity__title">
              You could save <span className="fir-opportunity__highlight">{fmt(saving)} per month</span> by switching
            </h2>
            <p className="fir-opportunity__body">
              Most South African homeowners overpay their bank by 0.5–1% on their bond rate. At your income level, switching could save you{' '}
              <strong>{fmt(saving5yr)}</strong> over five years — money that stays in your pocket, not your bank's.
            </p>
            <button
              className="fir-btn fir-btn--opportunity"
              onClick={() => navigate('/switch')}
            >
              See your personalised rate <ArrowRight size={16} />
            </button>
          </section>
        ) : (
          <section className="fir-building">
            <div className="fir-building__icon"><Shield size={28} /></div>
            <div>
              <h3 className="fir-building__title">Building your profile</h3>
              <p className="fir-building__body">
                {ready?.nextSteps?.[0] ?? 'A few more steps and you\'ll be bond-ready.'}
              </p>
            </div>
            <button
              className="fir-btn fir-btn--ghost"
              onClick={() => navigate('/dashboard')}
            >
              View your plan
            </button>
          </section>
        )}

        {/* ── 5. DIMENSION BREAKDOWN ────────────────────────────── */}
        <section className="fir-section">
          <h2 className="fir-section__title">Your financial DNA</h2>
          <p className="fir-section__sub">Seven dimensions banks use to profile you.</p>
          <div className="fir-dims">
            {Object.entries(dimensions || {}).map(([key, dim]) => (
              <DimRow key={key} dimKey={key} dim={dim} />
            ))}
          </div>
        </section>

        {/* ── 6. 3 ACTIONS ──────────────────────────────────────── */}
        {top3.length > 0 && (
          <section className="fir-section">
            <h2 className="fir-section__title">3 things to act on now</h2>
            <p className="fir-section__sub">High-impact changes based on your specific data.</p>
            <div className="fir-actions">
              {top3.map((text, i) => (
                <div key={i} className="fir-action">
                  <div className="fir-action__num">{i + 1}</div>
                  <div className="fir-action__icon"><Lightbulb size={18} /></div>
                  <div className="fir-action__body">
                    <div className="fir-action__text">{text}</div>
                    <div className="fir-action__why">{getWhy(text)}</div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── 7. BOTTOM CTA ─────────────────────────────────────── */}
        <section className="fir-cta">
          <h2 className="fir-cta__title">Ready to put this intelligence to work?</h2>
          <p className="fir-cta__sub">Your report is live. The best time to act on it is now.</p>
          <div className="fir-cta__btns">
            <button
              className="fir-btn fir-btn--primary"
              onClick={() => navigate('/switch')}
            >
              Switch my bank <ArrowRight size={16} />
            </button>
            <button
              className="fir-btn fir-btn--ghost"
              onClick={() => navigate('/dashboard')}
            >
              Back to dashboard
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
