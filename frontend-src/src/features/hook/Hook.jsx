import { useState, useEffect, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { fmt, fmtPct } from '@bondly/ui/lib/format.js';
import { trackAction } from '@bondly/ui/lib/session.js';
import { CurrencyInput } from '@bondly/ui/components/Input.jsx';
import { PRIME_RATE, BANKS } from '@bondly/ui/lib/constants.js';
import { useRateSettings } from '@bondly/ui/lib/usePrimeRate.js';
import RatesExplained from '@bondly/ui/components/RatesExplained.jsx';
import { bondHealthScore } from '../../lib/bondScore.js';
import './Hook.css';

// Cross-app link to the origination (Bondly Home) site. Env-driven so it points
// at the real origination URL in prod instead of a dead localhost link.
const ORIGINATION_URL = import.meta.env?.VITE_ORIGINATION_URL || 'http://localhost:5174';

// Per-bank spreads above prime — paired with the BANKS list from constants.js.
// Order matters: BANK_SPREADS[i] applies to BANKS[i].
const BANK_SPREADS = [0.0, 0.25, 0.35, 0.5, 0.75, 1.0, 1.5];

export const HOOK_SEEN_KEY = 'bondly_hook_seen';

// ── Bond Health Score gauge ────────────────────────────────
// Pure SVG ring — no external dependencies.
function BondHealthGauge({ score, grade, label, color, verdict }) {
  const R = 48;
  const STROKE = 9;
  const C = 2 * Math.PI * R;
  const filled = C * (score / 100);
  const gap = C - filled;

  function handleShare() {
    const text = `My Bondly Bond Health Score is ${score}/100 — ${label}. Check yours at bondly.co.za`;
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(() => {
        alert('Score copied to clipboard!');
      }).catch(() => {
        prompt('Copy this:', text);
      });
    } else {
      prompt('Copy this:', text);
    }
  }

  return (
    <div className="bhs-wrap">
      <div className="bhs-inner">
        <div className="bhs-ring-wrap">
          <svg className="bhs-svg" viewBox="0 0 120 120" aria-hidden="true">
            {/* Track */}
            <circle
              cx="60" cy="60" r={R}
              fill="none"
              stroke="rgba(15,26,36,0.08)"
              strokeWidth={STROKE}
            />
            {/* Arc — starts at 12 o'clock, rotated -90deg via transform */}
            <circle
              cx="60" cy="60" r={R}
              fill="none"
              stroke={color}
              strokeWidth={STROKE}
              strokeLinecap="round"
              strokeDasharray={`${filled} ${gap}`}
              strokeDashoffset={0}
              transform="rotate(-90 60 60)"
              style={{ transition: 'stroke-dasharray 0.6s cubic-bezier(.4,0,.2,1)' }}
            />
          </svg>
          <div className="bhs-center">
            <span className="bhs-score" style={{ color }}>{score}</span>
            <span className="bhs-denom">/100</span>
          </div>
        </div>

        <div className="bhs-meta">
          <div className="bhs-grade-row">
            <span className="bhs-grade" style={{ background: color }}>{grade}</span>
            <span className="bhs-label">{label}</span>
          </div>
          <p className="bhs-verdict">{verdict}</p>
          <p className="bhs-disclaimer">
            Indicative optimisation score — not a credit score. Subject to bank credit assessment.
          </p>
          <button type="button" className="bhs-share" onClick={handleShare}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/>
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
            </svg>
            Share my bond score
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Count-up money number ─────────────────────────────────
// Animates from 0 → target once on mount. Respects reduced-motion.
function CountUp({ value, className }) {
  const [display, setDisplay] = useState(value);
  const raf = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce || !value) { setDisplay(value); return; }
    const start = performance.now();
    const dur = 900;
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(value * eased));
      if (t < 1) raf.current = requestAnimationFrame(tick);
    };
    setDisplay(0);
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [value]);
  return <span className={className}>{fmt(display)}</span>;
}

// ── Live tween: smoothly animates a number toward `target` whenever it
// changes (e.g. as the user edits the calculator). Not a count-from-zero —
// it eases from the previous value to the new one. Respects reduced-motion.
function useTween(target, duration = 420) {
  const [value, setValue] = useState(target);
  const fromRef = useRef(target);
  const raf = useRef(0);
  useEffect(() => {
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduce) { fromRef.current = target; setValue(target); return; }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const v = from + (target - from) * eased;
      setValue(v);
      if (t < 1) raf.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [target, duration]);
  return value;
}

// ── Savings-over-time sparkline (inline SVG, zero deps) ─────────
// Plots cumulative saving across the bond term as a smooth area + line.
function SavingsSparkline({ monthlySaving, termMonths }) {
  const W = 280, H = 64, PAD = 4;
  if (!monthlySaving || monthlySaving <= 0 || termMonths <= 0) return null;
  const N = 24;
  const pts = Array.from({ length: N + 1 }, (_, i) => {
    const m = (termMonths * i) / N;
    const cum = monthlySaving * m;
    return cum;
  });
  const max = pts[pts.length - 1] || 1;
  const coords = pts.map((v, i) => {
    const x = PAD + (i / N) * (W - PAD * 2);
    const y = H - PAD - (v / max) * (H - PAD * 2);
    return [x, y];
  });
  const line = coords.map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`).join(' ');
  const area = `${line} L${(W - PAD).toFixed(1)} ${(H - PAD).toFixed(1)} L${PAD} ${(H - PAD).toFixed(1)} Z`;
  const [lastX, lastY] = coords[coords.length - 1];
  return (
    <svg className="hook-spark" viewBox={`0 0 ${W} ${H}`} role="img"
      aria-label={`Cumulative saving grows to ${fmt(Math.round(max))} over the term`}>
      <defs>
        <linearGradient id="hookSparkFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="var(--brand)" stopOpacity="0.22" />
          <stop offset="100%" stopColor="var(--brand)" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={area} fill="url(#hookSparkFill)" />
      <path d={line} fill="none" stroke="var(--brand)" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="var(--brand)" />
      <circle cx={lastX} cy={lastY} r="3.5" fill="none" stroke="var(--bg-card,#fff)" strokeWidth="1.5" />
    </svg>
  );
}

function deriveBalance(monthly, ratePct, termYears) {
  const r = (ratePct / 100) / 12;
  const n = Math.max(1, Math.round(termYears * 12));
  if (!isFinite(monthly) || monthly <= 0 || !isFinite(r) || r <= 0) return 0;
  return monthly * (1 - Math.pow(1 + r, -n)) / r;
}

function pmt(balance, ratePct, n) {
  const r = (ratePct / 100) / 12;
  return balance * r / (1 - Math.pow(1 + r, -n));
}

const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
function sampleMonths(n = 3, short = false) {
  const now = new Date();
  const out = [];
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - (n - 1 - i), 1);
    const yr = short ? `'${String(d.getFullYear()).slice(-2)}` : d.getFullYear();
    out.push(`${MONTH_LABELS[d.getMonth()]} ${yr}`);
  }
  return out;
}

function bestOffer(balance, termYears, currentBank, primeRate) {
  const n = Math.max(1, Math.round(termYears * 12));
  const offers = BANKS.map((bank, i) => {
    const rate = primeRate + (BANK_SPREADS[i] ?? 0);
    return { bank, rate, monthly: pmt(balance, rate, n) };
  })
    .filter(o => !currentBank || o.bank !== currentBank)
    .sort((a, b) => a.rate - b.rate);
  return offers[0];
}

export default function Hook() {
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [stage, setStage] = useState('form'); // form | compare
  const [form, setForm] = useState({ monthly: '', rate: '', term: '20', bank: '' });

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  const monthlyInput = parseFloat(form.monthly) || 0;
  const currentRate  = parseFloat(form.rate) || 0;
  const termYears    = parseFloat(form.term) || 20;
  const termMonths   = Math.max(1, Math.round(termYears * 12));
  const balance      = monthlyInput > 0 && currentRate > 0 ? deriveBalance(monthlyInput, currentRate, termYears) : 0;
  // Single source of truth: pull the live rate settings from the backend
  // (admin updates them from the dashboard; SARB cuts/hikes flow through
  // the pending-approval queue). Falls back to constants.js values while
  // the fetch is in flight or if the backend is unreachable.
  const rateSettings = useRateSettings();
  const primeRate    = rateSettings.primeRate;
  const [showRatesModal, setShowRatesModal] = useState(false);
  const best         = balance > 0 ? bestOffer(balance, termYears, form.bank, primeRate) : null;
  const monthlySaving = best ? Math.max(0, monthlyInput - best.monthly) : 0;
  const lifetimeSaving = monthlySaving * termMonths;
  const lifetimeCurrent = monthlyInput * termMonths;
  const lifetimeBest    = best ? best.monthly * termMonths : 0;

  // Animated values for the live in-form preview — ease smoothly between
  // figures as the user edits, so the calculator feels like a live product.
  const previewMonthly  = useTween(monthlySaving);
  const previewLifetime = useTween(lifetimeSaving);

  // Bond Health Score — computed at component level so both compare branches can use it.
  // noRealSaving path: monthlySaving=0 → strong score. Overpaying path: real saving → lower score.
  const bhs = currentRate > 0 ? bondHealthScore({
    currentRate,
    primeRate,
    monthlySaving,
    monthlyPayment: monthlyInput,
  }) : null;

  // Honesty guard: when our model's best offer can't beat the user's current
  // deal (they're already below prime, or the spread table doesn't reach them),
  // we MUST NOT show the WASTED stamp, the red "+R 0" overpayment rows, or a
  // "lowest rate" badge that's actually higher than what they're paying. The
  // user is already on a strong rate — celebrate it and offer rate-watching.
  const noRealSaving = !best
    || monthlySaving < 50                       // <R 50/mo isn't worth a switch
    || (best.rate !== undefined && currentRate > 0 && best.rate >= currentRate);

  function exitTo(path, label) {
    try { localStorage.setItem(HOOK_SEEN_KEY, '1'); } catch {}
    trackAction('hook_exit', { path, label });
    // If we're already at the target URL (e.g. /) React Router would no-op and
    // the user stays stuck on the Hook because RootGate only re-evaluates on
    // mount. A full assign re-runs the gate with the new hook-seen flag.
    const here = typeof window !== 'undefined' ? window.location.pathname : '';
    if (path === here) { window.location.assign(path); return; }
    navigate(path);
  }

  function resetHook() {
    try { localStorage.removeItem(HOOK_SEEN_KEY); } catch {}
    setStage('form');
    setForm({ monthly: '', rate: '', term: '20', bank: '' });
  }

  function handleSubmit(e) {
    e.preventDefault();
    trackAction('hook_form_submitted', { bank: form.bank, term: form.term });
    setStage('compare');
  }

  return (
    <div className="hook-page">
      <header className="hook-topbar">
        <a href="/" className="hook-brand" onClick={e => { e.preventDefault(); resetHook(); }}>
          <span className="hook-brand-tile" aria-hidden="true">B</span>
          Bondly
          <span className="hook-brand-tag">Switch</span>
        </a>
        <a href="tel:+27796971786" className="hook-phone">+27 79 697 1786</a>
      </header>

      {stage === 'form' && (
        <main className="hook-main hook-main--form">
          <div className="hook-eyebrow" role="status">
            <span className="hook-eyebrow__dot" aria-hidden="true" />
            <span>SA homeowners overpay <strong>R1,200/month</strong> — right now.</span>
          </div>
          <h1 className="hook-headline">
            You're being overcharged by your bank.
          </h1>
          <p className="hook-headline-sub">Here's the proof — in one number.</p>
          <p className="hook-lede">
            Type the amount on your last debit order for your <strong>bond — your home loan</strong>. We'll show you exactly what your bank is taking that it shouldn't.
          </p>

          <form className="hook-form" onSubmit={handleSubmit}>
            {/* Hero input — the single most important field, visually dominant */}
            <div className="hook-hero-field">
              <label className="hook-hero-field__label" htmlFor="hook-monthly">
                Your monthly bond payment
              </label>
              <CurrencyInput
                id="hook-monthly"
                className="hook-hero-currency"
                placeholder="e.g. 10 500"
                value={form.monthly}
                onChange={set('monthly')}
                autoFocus
              />
              <p className="hook-hero-field__hint">
                The home-loan debit order on your bank statement. Approximate is fine.
              </p>
              <span className="hook-prime-badge" title="Calculations use the live prime rate from our backend">
                <span className="hook-prime-badge__dot" aria-hidden="true" />
                Powered by current prime rate · {fmtPct(primeRate)}
              </span>
            </div>

            {/* Live indicative preview — updates as you type, animated. */}
            {balance > 0 && currentRate > 0 && !noRealSaving && (
              <div className="hook-livepreview" aria-live="polite">
                <div className="hook-livepreview__head">
                  <span className="hook-livepreview__label">Indicative saving</span>
                  <span className="hook-livepreview__rate">
                    {fmtPct(currentRate)} → {fmtPct(best.rate)}
                  </span>
                </div>
                <div className="hook-livepreview__figures">
                  <div className="hook-livepreview__fig">
                    <span className="hook-livepreview__fig-num">{fmt(Math.round(previewMonthly))}</span>
                    <span className="hook-livepreview__fig-unit">/month</span>
                  </div>
                  <div className="hook-livepreview__fig hook-livepreview__fig--total">
                    <span className="hook-livepreview__fig-num hook-livepreview__fig-num--gold">{fmt(Math.round(previewLifetime))}</span>
                    <span className="hook-livepreview__fig-unit">over {termYears} yrs</span>
                  </div>
                </div>
                <SavingsSparkline monthlySaving={monthlySaving} termMonths={termMonths} />
                <p className="hook-livepreview__note">Indicative — your real offers come from the banks.</p>
              </div>
            )}

            {/* Secondary details — calm, grouped, smart defaults already set */}
            <div className="hook-details">
              <div className="hook-details__grid">
                <div className="hook-field-wrap">
                  <label className="hook-field" htmlFor="hook-rate">
                    Interest rate (%)
                  </label>
                  <input
                    id="hook-rate"
                    className="hook-input"
                    type="text"
                    inputMode="decimal"
                    placeholder={(primeRate + 1.0).toFixed(2)}
                    value={form.rate}
                    onChange={set('rate')}
                  />
                  <p className="hook-field-hint">Most SA home loans sit near {fmtPct(primeRate + 1)} (prime {fmtPct(primeRate)}) — change if you know yours.</p>
                </div>
                <div className="hook-field-wrap">
                  <label className="hook-field" htmlFor="hook-term">Loan term</label>
                  <select id="hook-term" className="hook-input" value={form.term} onChange={set('term')}>
                    {[5, 10, 15, 20, 25, 30].map(y => <option key={y} value={y}>{y} years</option>)}
                  </select>
                  <p className="hook-field-hint">Most bonds are 20 years.</p>
                </div>
              </div>
              <div className="hook-field-wrap">
                <label className="hook-field" htmlFor="hook-bank">Current bank <span className="hook-field-opt">optional</span></label>
                <select id="hook-bank" className="hook-input" value={form.bank} onChange={set('bank')}>
                  <option value="">Select your bank</option>
                  {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                </select>
              </div>
            </div>

            <button
              type="submit"
              className={`hook-btn hook-btn--primary hook-btn--xl${(!form.monthly || !form.rate) ? ' hook-btn--waiting' : ''}`}
              disabled={!form.monthly || !form.rate}
            >
              {(!form.monthly || !form.rate) ? 'Enter your payment to continue' : 'Show me what I’m overpaying'}
              {(form.monthly && form.rate) && (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                </svg>
              )}
            </button>

            {/* FIX 2: risk-reversal badge immediately under the primary CTA */}
            <div className="hook-reassure" role="note">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
                <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/>
              </svg>
              No credit check · No impact on your credit score
            </div>

            <div className="hook-privacy">
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" aria-hidden="true" focusable="false">
                <rect x="2" y="6" width="10" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.25"/>
                <path d="M4.5 6V4.5a2.5 2.5 0 0 1 5 0V6" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              Never shared or sold · no credit check · takes 20 seconds
            </div>
          </form>

          {/* What happens next strip */}
          <div className="hook-next">
            <p className="hook-next__label">What happens next</p>
            <ol className="hook-next__steps">
              <li className="hook-next__step">
                <span className="hook-next__num">1</span>
                <span className="hook-next__text">See exactly what you're overpaying</span>
              </li>
              <li className="hook-next__step">
                <span className="hook-next__num">2</span>
                <span className="hook-next__text">We get banks to compete for your bond</span>
              </li>
              <li className="hook-next__step">
                <span className="hook-next__num">3</span>
                <span className="hook-next__text">Choose your best offer — we handle the switch</span>
              </li>
            </ol>
          </div>

          <div className="hook-lenders" aria-label="SA lenders we compare">
            <p className="hook-lenders__caption">We compare all 7 — they compete for your bond.</p>
            <div className="hook-lenders__row">
              {['ABSA','FNB','Nedbank','Standard Bank','Capitec','Investec','SA Home Loans'].map(b => (
                <span key={b} className="hook-lenders__tile">{b}</span>
              ))}
            </div>
          </div>

          <div className="hook-form-footer">
            {/* Soft escape hatch — visitors who already know Bondly or who don't
                want the bond-check funnel can jump straight to the marketing
                homepage. We stamp `bondly_hook_seen` so RootGate respects the
                choice on future visits. */}
            <a
              href="/home"
              className="hook-skip"
              onClick={() => { try { localStorage.setItem('bondly_hook_seen', '1'); } catch {} }}
            >
              See the full Bondly site →
            </a>
            <a href={ORIGINATION_URL} className="hook-crosssell">
              Buying your first home instead? <strong>Bondly Home →</strong>
            </a>
          </div>
        </main>
      )}

      {/* Honest path: our model can't beat the user's current rate. */}
      {stage === 'compare' && noRealSaving && (
        <main className="hook-main hook-main--compare">
          <h1 className="hook-headline">You're already on a strong rate.</h1>
          <p className="hook-lede">
            Your <strong>{form.bank || 'current bank'}</strong> bond is at <strong>{fmtPct(currentRate)}</strong> — that's
            {currentRate < primeRate
              ? <> <strong>{(primeRate - currentRate).toFixed(2)}%</strong> below prime (currently <strong>{fmtPct(primeRate)}</strong>, set by the SARB).</>
              : <> at prime ({fmtPct(primeRate)}, set by the SARB).</>}
            We can't credibly promise to beat it right now without a fresh, live quote from each bank.
          </p>
          <p className="hook-lede hook-lede--small">
            <button type="button" className="hook-linkbtn" onClick={() => setShowRatesModal(true)}>
              What's prime? ⓘ
            </button>
            {rateSettings.primeRateLastChanged && (
              <span className="hook-lede__meta">
                {' '}· Prime last updated{' '}
                {new Date(rateSettings.primeRateLastChanged).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </p>
          <RatesExplained
            open={showRatesModal}
            onClose={() => setShowRatesModal(false)}
            primeRate={primeRate}
            stressRate={rateSettings.stressRate}
            lastChanged={rateSettings.primeRateLastChanged}
          />

          <div className="hook-papers hook-papers--solo">
            <article className="hook-paper hook-paper--good">
              <div className="hook-paper__pill">Strong deal</div>
              <div className="hook-paper__eyebrow">Bond Statement · Your current bond</div>
              <h2 className="hook-paper__bank hook-paper__bank--good">{form.bank || 'Your bank'}</h2>
              <div className="hook-paper__acct">Acc · **** **** {(1000 + Math.round(monthlyInput) % 9000).toString().slice(-4)}</div>
              <div className="hook-paper__params">
                <span>Rate <strong>{fmtPct(currentRate)}</strong></span>
                <span>Term <strong>{termYears} yrs</strong></span>
              </div>
              <div className="hook-paper__foot">
                <div className="hook-paper__foot-row">
                  <span>Monthly bond</span>
                  <strong>{fmt(Math.round(monthlyInput))}</strong>
                </div>
                <div className="hook-paper__foot-row hook-paper__foot-row--big">
                  <span>Lifetime cost</span>
                  <strong className="hook-paper__good-strong">{fmt(Math.round(lifetimeCurrent))}</strong>
                </div>
              </div>
            </article>
          </div>

          <div className="hook-delta">
            <div className="hook-delta-row hook-delta-row--big">
              <span className="hook-delta-label">What Bondly can still do for you</span>
              <span className="hook-delta-val">Watch & alert</span>
            </div>
            <p className="hook-delta-note">
              Rates move every quarter. We'll watch the market and ping you the moment a real saving opens up — no spam, no nudging you into a worse deal. You can also use Bondly to track your bond paydown, project lifetime savings, and plan your next move.
            </p>
          </div>

          {bhs && (
            <BondHealthGauge
              {...bhs}
              verdict="Your bond is well-optimised — you're paying close to the best available rate."
            />
          )}

          <div className="hook-actions">
            <button
              className="hook-btn hook-btn--primary"
              onClick={() => {
                try {
                  sessionStorage.setItem('bondly_hook_context', JSON.stringify({
                    monthly: monthlyInput, rate: currentRate, term: termYears, bank: form.bank,
                    monthlySaving: 0, lifetimeSaving: 0, alreadyStrong: true,
                  }));
                } catch {}
                exitTo('/home', 'cta_track_rate');
              }}
            >
              Track my rate with Bondly
            </button>
            <button className="hook-btn hook-btn--ghost" onClick={() => setStage('form')}>
              Try different numbers
            </button>
          </div>

          {/* Even when we can't beat their rate, Bondly does other things —
              optimiser, statement upload, paydown projection. Send them to the
              main homepage rather than dead-ending the funnel here. */}
          <a
            href="/home"
            className="hook-skip"
            onClick={() => { try { localStorage.setItem('bondly_hook_seen', '1'); } catch {} }}
          >
            See what else we offer →
          </a>
        </main>
      )}

      {stage === 'compare' && best && !noRealSaving && (
        <main className="hook-main hook-main--compare">
          <h1 className="hook-headline">Here's how much money we can save you.</h1>
          <p className="hook-lede">
            Two statements. Same bond. Same {termYears} years. The number on the left, in red — that's what's leaving your account every month, for nothing.
          </p>

          <div className="hook-papers">
            {/* CURRENT — paper with WASTED stamp */}
            <article className="hook-paper hook-paper--bad">
              <div className="hook-paper__eyebrow">Bond Statement · Current</div>
              <h2 className="hook-paper__bank">{form.bank || 'Current Bank'}</h2>
              <div className="hook-paper__acct">Acc · **** **** {(1000 + Math.round(monthlyInput) % 9000).toString().slice(-4)}</div>
              <div className="hook-paper__params">
                <span>Rate <strong>{fmtPct(currentRate)}</strong></span>
                <span>Term <strong>{termYears} yrs</strong></span>
              </div>

              <div className="hook-paper__cols">
                <span>Month</span>
                <span>Overpaid</span>
              </div>
              <div className="hook-paper__rows">
                {sampleMonths(9, true).map(m => (
                  <div key={m} className="hook-paper__row">
                    <span className="hook-paper__row-date">{m}</span>
                    <span className="hook-paper__row-desc">Overpayment</span>
                    <span className="hook-paper__row-amt hook-paper__row-amt--bad">+{fmt(Math.round(monthlySaving))}</span>
                  </div>
                ))}
                <div className="hook-paper__more">— {Math.max(0, termYears * 12 - 9)} more months —</div>
              </div>

              <div className="hook-paper__foot">
                <div className="hook-paper__foot-row">
                  <span>Monthly bond</span>
                  <strong>{fmt(Math.round(monthlyInput))}</strong>
                </div>
                <div className="hook-paper__foot-row">
                  <span>Overpaid / month</span>
                  <strong className="hook-paper__bad-strong">{fmt(Math.round(monthlySaving))}</strong>
                </div>
                <div className="hook-paper__foot-row hook-paper__foot-row--big">
                  <span>Lifetime waste</span>
                  <strong className="hook-paper__bad-strong">{fmt(Math.round(lifetimeSaving))}</strong>
                </div>
              </div>

              <div className="hook-paper__stamp" aria-hidden="true">Wasted</div>
            </article>

            {/* vs separator */}
            <div className="hook-vs" aria-hidden="true">vs</div>

            {/* BEST — clean paper. We deliberately don't name a specific
                competitor bank on the right-hand side: that would be advice
                (recommending a lender). Instead we show "If you moved with
                Bondly" so the offer is framed as our outcome, not a claim
                about any one bank's rate. */}
            <article className="hook-paper hook-paper--good">
              <div className="hook-paper__pill">If you moved with Bondly</div>
              <div className="hook-paper__eyebrow">Bond Statement · Projected</div>
              <h2 className="hook-paper__bank hook-paper__bank--good">Bondly</h2>
              <div className="hook-paper__acct">Acc · **** **** new</div>
              <div className="hook-paper__params">
                <span>Indicative rate <strong>{fmtPct(best.rate)}</strong></span>
                <span>Term <strong>{termYears} yrs</strong></span>
              </div>

              <div className="hook-paper__cols">
                <span>Month</span>
                <span>Overpaid</span>
              </div>
              <div className="hook-paper__rows">
                {sampleMonths(9, true).map(m => (
                  <div key={m} className="hook-paper__row">
                    <span className="hook-paper__row-date">{m}</span>
                    <span className="hook-paper__row-desc">Market rate</span>
                    <span className="hook-paper__row-amt hook-paper__row-amt--good">R 0</span>
                  </div>
                ))}
                <div className="hook-paper__more">— {Math.max(0, termYears * 12 - 9)} more months —</div>
              </div>

              <div className="hook-paper__foot">
                <div className="hook-paper__foot-row">
                  <span>Monthly bond</span>
                  <strong>{fmt(Math.round(best.monthly))}</strong>
                </div>
                <div className="hook-paper__foot-row">
                  <span>Overpaid / month</span>
                  <strong className="hook-paper__good-strong">R 0</strong>
                </div>
                <div className="hook-paper__foot-row hook-paper__foot-row--big">
                  <span>Lifetime waste</span>
                  <strong className="hook-paper__good-strong">R 0</strong>
                </div>
              </div>
            </article>
          </div>

          <div className="hook-delta">
            <div className="hook-delta-row">
              <span className="hook-delta-label">Wasted every month</span>
              <span className="hook-delta-val">{fmt(Math.round(monthlySaving))}</span>
            </div>
            <div className="hook-delta-row hook-delta-row--big">
              <span className="hook-delta-label">That's what switching banks puts back in your pocket.</span>
              <CountUp value={Math.round(lifetimeSaving)} className="hook-delta-val" />
            </div>
            <p className="hook-delta-note">
              <strong>{fmt(Math.round(monthlySaving))} every month</strong>, for the next {termYears} years.
            </p>
          </div>

          {bhs && (
            <BondHealthGauge
              {...bhs}
              verdict={`You're overpaying ${fmt(Math.round(monthlySaving))}/month — switching could fix this.`}
            />
          )}

          <div className="hook-actions">
            <button
              className="hook-btn hook-btn--primary"
              onClick={() => {
                // Preserve the bond context so Landing's switch widget and
                // /switch's form auto-fill from where the user left off.
                try {
                  sessionStorage.setItem('bondly_hero_switch', JSON.stringify({
                    balance: Math.round(balance),
                    rate: currentRate,
                  }));
                  sessionStorage.setItem('bondly_hook_context', JSON.stringify({
                    monthly: monthlyInput,
                    rate: currentRate,
                    term: termYears,
                    bank: form.bank,
                    monthlySaving: Math.round(monthlySaving),
                    lifetimeSaving: Math.round(lifetimeSaving),
                  }));
                } catch {}
                exitTo('/home', 'cta_get_started');
              }}
            >
              Get started with Bondly and start saving
            </button>
            <button className="hook-btn hook-btn--ghost" onClick={() => setStage('form')}>
              Start over
            </button>
          </div>
        </main>
      )}

      <a
        href="https://wa.me/27796971786"
        className="hook-whatsapp"
        aria-label="Chat with us on WhatsApp"
        target="_blank"
        rel="noopener noreferrer"
      >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true" focusable="false">
          <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
        </svg>
      </a>

      <footer className="hook-foot-bar">
        <span>
          Bondly (Pty) Ltd · POPIA compliant. Indicative · subject to bank credit assessment · rates updated daily.
        </span>
      </footer>
    </div>
  );
}
