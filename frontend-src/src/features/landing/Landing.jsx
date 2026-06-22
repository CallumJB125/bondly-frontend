import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { calcSwapSavings, calcSavingsRange } from '@bondly/ui/lib/finance.js';
import { fmt } from '@bondly/ui/lib/format.js';
import { track, trackAction } from '@bondly/ui/lib/session.js';
import { PRIME_RATE, DEFAULT_RATE_SPREAD } from '@bondly/ui/lib/constants.js';
import { useRateSettings } from '@bondly/ui/lib/usePrimeRate.js';
import { publicStats } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import GetAnOfferButton from './GetAnOfferButton.jsx';
import LandingNav from './LandingNav.jsx';
import UnderstandYourBond from './UnderstandYourBond.jsx';
import './Landing.css';

// Env-aware sister-product URL (Bondly Home / origination), mirroring the
// pattern used elsewhere in the app (Nav.jsx, Footer).
const ORIGINATION_URL = typeof window !== 'undefined'
  ? (import.meta.env?.VITE_ORIGINATION_URL || 'http://localhost:5174')
  : 'http://localhost:5174';

// ─────────────────────────────────────────────────────────────
// useCountUp — animate a number toward `target` whenever it changes.
// Ticks via requestAnimationFrame with an ease-out curve; counts up or
// down, and smoothly re-targets mid-flight. No animation on first mount.
// ─────────────────────────────────────────────────────────────
function useCountUp(target, duration = 650) {
  const [display, setDisplay] = useState(target);
  const currentRef = useRef(target);
  const rafRef = useRef(0);

  useEffect(() => {
    const from = currentRef.current;
    const to = target;
    const reduce = typeof window !== 'undefined' && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (from === to || reduce) {
      currentRef.current = to;
      setDisplay(to);
      return;
    }
    let startTs = null;
    const ease = (t) => 1 - Math.pow(1 - t, 3); // easeOutCubic
    const tick = (ts) => {
      if (startTs === null) startTs = ts;
      const p = Math.min(1, (ts - startTs) / duration);
      const val = Math.round(from + (to - from) * ease(p));
      currentRef.current = val;
      setDisplay(val);
      if (p < 1) rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration]);

  return display;
}

// ─────────────────────────────────────────────────────────────
// ANNOUNCE BAR — shows the LIVE prime rate
// ─────────────────────────────────────────────────────────────
function Announce() {
  const navigate = useNavigate();
  const livePrime = useRateSettings().primeRate || PRIME_RATE;
  return (
    <div className="ls-announce">
      Prime is <strong>{livePrime}%</strong> — most switchers cut their rate by 0.5–1%.
      <a
        href="#savings-check"
        onClick={(e) => {
          e.preventDefault();
          trackAction('announce_check_clicked');
          const el = document.getElementById('savings-check');
          if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
          else navigate('/switch');
        }}
      >Check yours →</a>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// BANK STRIP — "We negotiate with" trust row of bank logos.
// Logos are normalised to uniform white via CSS filter; per-logo
// heights keep them optically balanced (icons read taller than
// pure wordmarks). Assets live in /public/banks.
// ─────────────────────────────────────────────────────────────
const NEGOTIATE_BANKS = [
  { src: '/banks/absa.png',         alt: 'Absa',          h: 22 },
  { src: '/banks/fnb.png',          alt: 'FNB',           h: 30 },
  { src: '/banks/nedbank.png',      alt: 'Nedbank',       h: 18 },
  { src: '/banks/standardbank.png', alt: 'Standard Bank', h: 29 },
  { src: '/banks/capitec.png',      alt: 'Capitec',       h: 20 },
  { src: '/banks/investec.png',     alt: 'Investec',      h: 22 },
  { src: '/banks/sahomeloans.png',  alt: 'SA Home Loans', h: 29 },
];

function BankStrip() {
  return (
    <div className="ls-wrap ls-negotiate" aria-label="Banks we negotiate with">
      <span className="ls-negotiate__label">We negotiate with</span>
      <div className="ls-negotiate__row">
        {NEGOTIATE_BANKS.map((b) => (
          <img
            key={b.alt}
            className="ls-negotiate__logo"
            src={b.src}
            alt={b.alt}
            loading="lazy"
            decoding="async"
            style={{ height: `${b.h}px` }}
          />
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO + SAVINGS CHECK calculator (press-to-reveal)
// ─────────────────────────────────────────────────────────────
const CALC_CAPTIONS = ['Checking all 7 banks…', 'Matching people like you…', 'Crunching your numbers…'];

// Custom easing — refined ease-out (steep start, long silky settle). Shared by
// the calculator reveal and the FAQ dropdown so motion feels of a piece.
const EASE_SILK = [0.22, 1, 0.36, 1];

function Hero() {
  const navigate = useNavigate();
  const location = useLocation();
  const livePrime = useRateSettings().primeRate || PRIME_RATE;

  // Prefill from URL query params if present (preserves existing behaviour).
  const searchParams = new URLSearchParams(location.search);
  const qBalance = searchParams.get('balance') || '1200000';
  const qRate    = searchParams.get('rate')    || '12.50';
  const qTerm    = searchParams.get('term')    || '18';

  const [balance, setBalance] = useState(qBalance);
  const [rate, setRate]       = useState(qRate);
  const [term, setTerm]       = useState(qTerm);

  // Reveal state machine: the savings figure is no longer shown live. The user
  // enters their bond, presses "Calculate my savings", a brief spinner runs,
  // then the range is revealed and the CTA morphs to "See my official offer".
  const [revealState, setRevealState] = useState('idle'); // 'idle' | 'calculating' | 'revealed'
  const reduceMotion = useReducedMotion();
  const revealTimerRef = useRef(0);
  const revealedRef = useRef(false); // fire savings_revealed once per session

  const bal = parseFloat(String(balance).replace(/[^\d.]/g, '')) || 0;
  const rt  = parseFloat(rate) || 0;
  const trm = parseInt(term, 10) || 0;

  const inputsValid = bal > 0 && rt > 0 && rt <= 40 && trm >= 1 && trm <= 40;
  const rateWarning = rt > 25 && rt <= 40;

  // Slider fill (% of track) — drives the navy "progress" gradient.
  const RATE_MIN = 5, RATE_MAX = 25, TERM_MIN = 1, TERM_MAX = 30;
  const ratePct = Math.min(100, Math.max(0, ((rt - RATE_MIN) / (RATE_MAX - RATE_MIN)) * 100));
  const termPct = Math.min(100, Math.max(0, ((trm - TERM_MIN) / (TERM_MAX - TERM_MIN)) * 100));

  const safeBal  = bal  > 0 ? bal  : 1_200_000;
  const safeRate = rt   > livePrime ? rt   : livePrime + DEFAULT_RATE_SPREAD;
  const safeTerm = trm  > 0 ? trm  : 18;

  const result = calcSwapSavings(safeBal, safeRate, livePrime, safeTerm * 12);
  const monthlySaving = inputsValid ? Math.max(0, Math.round(result.monthlySaving)) : 0;
  const { low, high } = calcSavingsRange(monthlySaving);
  const revealed = revealState === 'revealed';

  // Animate the low anchor up from 0 on reveal; show nothing until revealed.
  const animLow = useCountUp(revealed ? low : 0);

  // Reset the reveal whenever inputs change — a stale number must never
  // contradict the bond the user is now describing.
  useEffect(() => {
    setRevealState((s) => (s === 'idle' ? s : 'idle'));
    if (revealTimerRef.current) { clearTimeout(revealTimerRef.current); revealTimerRef.current = 0; }
  }, [balance, rate, term]);

  useEffect(() => () => { if (revealTimerRef.current) clearTimeout(revealTimerRef.current); }, []);

  function doReveal() {
    setRevealState('revealed');
    if (!revealedRef.current) {
      revealedRef.current = true;
      trackAction('savings_revealed', { low, high, saving: monthlySaving });
    }
  }

  function onCalculate() {
    if (!inputsValid || revealState === 'calculating') return;
    trackAction('hero_calc_started', { balance: bal, rate: rt, term: trm });
    if (reduceMotion) { doReveal(); return; } // skip the artificial delay for reduced-motion / SR users
    setRevealState('calculating');
    revealTimerRef.current = setTimeout(doReveal, 1800);
  }

  const onField = (setter, field) => (e) => {
    setter(e.target.value);
    trackAction('calculator_interacted', { field });
  };

  // Rotating caption shown under the spinner while "calculating".
  const [calcStep, setCalcStep] = useState(0);
  useEffect(() => {
    if (revealState !== 'calculating') { setCalcStep(0); return; }
    const iv = setInterval(() => setCalcStep((i) => (i + 1) % CALC_CAPTIONS.length), 600);
    return () => clearInterval(iv);
  }, [revealState]);

  // Outstanding balance: store raw digits, display with space thousands separators.
  const fmtBalance = (raw) => {
    const digits = String(raw).replace(/[^\d]/g, '');
    if (!digits) return '';
    return digits.replace(/\B(?=(\d{3})+(?!\d))/g, ' '); // non-breaking space
  };
  const onBalanceChange = (e) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    setBalance(raw);
    trackAction('calculator_interacted', { field: 'balance' });
  };

  const goToSwitch = (source) => {
    trackAction('hero_reveal_cta_clicked', { balance: bal, rate: rt, term: trm, location: source });
    try {
      // Carry the EXACT prime used for this reveal so /switch reproduces the
      // same range — even if the live prime resolves to a different value
      // between the two screens (closes the async-prime drift).
      sessionStorage.setItem('bondly_hero_switch', JSON.stringify({ balance: bal, rate: rt, termYears: trm, prime: livePrime }));
    } catch (_) {}
    const params = new URLSearchParams();
    if (bal > 0) params.set('balance', String(Math.round(bal)));
    if (rt > 0)  params.set('rate', String(rt));
    if (trm > 0) params.set('term', String(trm));
    if (livePrime > 0) params.set('prime', String(livePrime));
    const qs = params.toString();
    navigate(qs ? `/switch?${qs}` : '/switch');
  };

  return (
    <header className="ls-hero">
      <div className="ls-wrap ls-hero__grid">
        <div className="ls-hero__copy">
          <div className="ls-eyebrow">SA's #1 bond switching service</div>
          <h1 className="ls-serif ls-hero__title">
            Stop <em>overpaying</em> on your home loan.
          </h1>
          <p className="ls-hero__sub">
            We negotiate with all seven major South African banks to find your best rate — and switch your bond for free.
          </p>
          <div className="ls-hero__ctas">
            <GetAnOfferButton onClick={() => goToSwitch('hero')} />
            <a
              className="ls-btn ls-btn--ghost"
              href="#how-it-works"
              onClick={(e) => {
                e.preventDefault();
                trackAction('hero_how_it_works_clicked');
                document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
              }}
            >How it works</a>
          </div>
          <p className="ls-reassure">Free · No credit check to start · Takes 60 seconds</p>
          <div className="ls-trust-row">
            <div>
              <svg className="ls-trust-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M10.7 2.5H5A2.5 2.5 0 0 0 2.5 5v5.7a1.5 1.5 0 0 0 .44 1.06l6.3 6.3a1.5 1.5 0 0 0 2.12 0l5.7-5.7a1.5 1.5 0 0 0 0-2.12l-6.3-6.3A1.5 1.5 0 0 0 10.7 2.5ZM6.5 7.75A1.25 1.25 0 1 1 6.5 5.25a1.25 1.25 0 0 1 0 2.5Z"/>
              </svg>
              <b>100% Free</b>
            </div>
            <div>
              <svg className="ls-trust-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path d="M10 1.9l2.32 4.7 5.18.75-3.75 3.66.89 5.16L10 13.74l-4.64 2.43.89-5.16L2.5 7.35l5.18-.75L10 1.9Z"/>
              </svg>
              <b>4.8 stars</b>
            </div>
            <div>
              <svg className="ls-trust-icon" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                <path fillRule="evenodd" clipRule="evenodd" d="M3.5 5.5A1.5 1.5 0 0 1 5 4h8.5a1 1 0 0 1 0 2H6a.75.75 0 0 0 0 1.5h10A1.5 1.5 0 0 1 17.5 9v5A1.5 1.5 0 0 1 16 15.5H5A1.5 1.5 0 0 1 3.5 14V5.5Zm10.75 4.75a1.25 1.25 0 1 0 0 2.5 1.25 1.25 0 0 0 0-2.5Z"/>
              </svg>
              <b>R8.4m saved this month</b>
            </div>
          </div>
        </div>

        {/* LIVE calculator card */}
        <aside className="ls-calc" id="savings-check">
          <div className="ls-calc__head">
            <div className="ls-calc__head-text">
              <h3 className="ls-calc__title">Your savings estimate</h3>
              <p className="ls-calc__subtitle">Drag to match your current bond.</p>
            </div>
            <span className="ls-pill">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" fill="currentColor" opacity="0.18"/>
                <path d="M12 2 4 5v6c0 5 3.4 8.5 8 10 4.6-1.5 8-5 8-10V5l-8-3Z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
                <path d="m9 12 2 2 4-4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              No credit check
            </span>
          </div>
          <div className="ls-calc__body">
            <div className="ls-field">
              <label htmlFor="ls-balance">Outstanding balance</label>
              <div className="ls-input">
                <span aria-hidden="true">R</span>
                <input
                  id="ls-balance"
                  type="text"
                  inputMode="numeric"
                  value={fmtBalance(balance)}
                  onChange={onBalanceChange}
                  aria-label="Outstanding balance"
                />
              </div>
            </div>
            <div className="ls-two">
              <div className="ls-field ls-field--slider">
                <div className="ls-slider__top">
                  <label htmlFor="ls-rate">Current rate</label>
                  <span className="ls-slider__val">{rate}%</span>
                </div>
                <input
                  id="ls-rate"
                  className="ls-slider"
                  type="range"
                  min="5" max="25" step="0.25"
                  value={rate}
                  onChange={onField(setRate, 'rate')}
                  style={{ '--fill': `${ratePct}%` }}
                  aria-label="Current interest rate"
                  aria-valuetext={`${rate} percent`}
                />
              </div>
              <div className="ls-field ls-field--slider">
                <div className="ls-slider__top">
                  <label htmlFor="ls-term">Years remaining</label>
                  <span className="ls-slider__val">{term} yrs</span>
                </div>
                <input
                  id="ls-term"
                  className="ls-slider"
                  type="range"
                  min="1" max="30" step="1"
                  value={term}
                  onChange={onField(setTerm, 'term')}
                  style={{ '--fill': `${termPct}%` }}
                  aria-label="Years remaining on bond"
                  aria-valuetext={`${term} years`}
                />
              </div>
            </div>

            {rateWarning && (
              <p style={{ fontSize: '0.8rem', color: '#b45309', background: '#fef3c7', borderRadius: 4, padding: '6px 10px', margin: '4px 0' }}>
                Rates above 25% are unusual — double-check your entry.
              </p>
            )}
            {/* The result panel stays hidden until the user presses
                "Calculate my savings", then expands to run the bank-checking
                sequence and reveal the figure. */}
            <AnimatePresence initial={false}>
              {revealState !== 'idle' && (
                <motion.div
                  key="result"
                  initial={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
                  animate={{ height: 'auto', opacity: 1, marginTop: 20, marginBottom: 18 }}
                  exit={{ height: 0, opacity: 0, marginTop: 0, marginBottom: 0 }}
                  transition={{
                    height:       reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE_SILK },
                    marginTop:    reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE_SILK },
                    marginBottom: reduceMotion ? { duration: 0 } : { duration: 0.5, ease: EASE_SILK },
                    opacity:      reduceMotion ? { duration: 0 } : { duration: 0.4, ease: EASE_SILK, delay: 0.08 },
                  }}
                  style={{ overflow: 'hidden' }}
                >
                  <div className="ls-result" aria-live="polite">
                    {revealState === 'calculating' ? (
                      <div className="ls-result__calc">
                        <div className="spinner ls-result__spinner" aria-hidden="true" />
                        <span className="ls-result__calc-cap">{CALC_CAPTIONS[calcStep]}</span>
                      </div>
                    ) : (
                      <>
                        <small>BASED ON PEOPLE LIKE YOU WE'VE HELPED SAVE</small>
                        <div className="ls-serif ls-result__big">
                          from {fmt(animLow)}<sub>/month</sub>
                        </div>
                        <p>We confirm your exact number on the next step · estimate at prime</p>
                      </>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {revealed ? (
              <button className="ls-btn ls-btn--primary ls-calc__cta" onClick={() => goToSwitch('hero_calc')}>
                See my official offer →
              </button>
            ) : (
              <button
                className="ls-btn ls-btn--primary ls-calc__cta"
                onClick={onCalculate}
                disabled={!inputsValid || revealState === 'calculating'}
              >
                {revealState === 'calculating' ? 'Calculating…' : 'Calculate my savings'}
              </button>
            )}
            <p className="ls-calc__foot">Less than 2 minutes · Bank-level security · No personal info needed</p>
          </div>
        </aside>
      </div>
      <BankStrip />
    </header>
  );
}

// ─────────────────────────────────────────────────────────────
// PROOF BAND — keeps real stats wired when available
// ─────────────────────────────────────────────────────────────
function ProofBand() {
  const [stats, setStats] = useState(null);
  useEffect(() => { publicStats.marketStats().then(setStats).catch(() => {}); }, []);

  const savingLabel = stats?.avgMonthlySaving
    ? `R ${Math.round(stats.avgMonthlySaving / 100) * 100}+`
    : 'R 500+';

  const items = [
    { b: 'R 8.4m+',  s: 'Saved for homeowners' },
    { b: savingLabel, s: 'Typical monthly saving' },
    { b: '0.5–1%',   s: 'Typical rate drop' },
    { b: '48 hrs',   s: 'To first quote' },
    { b: 'R 0',      s: 'Cost to you, ever' },
  ];

  return (
    <div className="ls-band">
      <div className="ls-wrap ls-band__grid">
        {items.map((it) => (
          <div key={it.s} className="ls-stat">
            <b className="ls-serif">{it.b}</b>
            <span>{it.s}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────
// HOW IT WORKS
// ─────────────────────────────────────────────────────────────
function HowItWorks() {
  const steps = [
    {
      n: '1',
      title: 'Tell us about your bond',
      body: 'Share your balance, current rate, or just upload a statement. No bank visit, no credit check at this stage.',
    },
    {
      n: '2',
      title: 'We gather the best rates',
      body: 'Bondly negotiates with all seven major South African banks and brings back their best offers, side by side.',
    },
    {
      n: '3',
      title: 'Pick the offer you like',
      body: 'Choose the rate which suits you. Bondly handles the paperwork and legal registration to switch seamlessly at no cost to you.',
    },
  ];
  return (
    <section className="ls-section" id="how-it-works">
      <div className="ls-wrap">
        <h2 className="ls-serif ls-h2">Switching your bond is refreshingly simple</h2>
        <p className="ls-sec-sub">
          From your first quote to a signed-off switch, Bondly does the heavy lifting. You stay in control of the decision
        </p>
        <div className="ls-steps">
          {steps.map((s) => (
            <div key={s.n} className="ls-step">
              <div className="ls-serif ls-step__num">{s.n}</div>
              <h3 className="ls-step__title">{s.title}</h3>
              <p>{s.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// CASE STUDY
// ─────────────────────────────────────────────────────────────
function CaseStudy() {
  return (
    <section className="ls-wrap ls-case-wrap">
      <div className="ls-sec-eyebrow">Case study</div>
      <h2 className="ls-serif ls-h2">What a bondly switch actually looks like</h2>
      <div className="ls-case">
        <div className="ls-case__left">
          <blockquote className="ls-serif">
            "I was paying 0.75% above prime for eight years without knowing it. Bondly got me to
            prime flat — R 1,100 back every month."
          </blockquote>
          <div className="ls-case__who"><b>Thandi M.</b> · Johannesburg · switched Feb 2026</div>
        </div>
        <div className="ls-case__right">
          <div className="ls-case__row"><span>Old rate</span><b>12.00%</b></div>
          <div className="ls-case__row"><span>New rate</span><b>11.25%</b></div>
          <div className="ls-case__row"><span>Monthly saving</span><b>R 1,100</b></div>
          <div className="ls-case__row ls-case__row--last"><span>Time to switch</span><b>6 weeks</b></div>
        </div>
      </div>
      <p className="ls-disclaimer">
        Real client outcome, shared with permission. Individual results vary with credit profile,
        bond size and prevailing rates.
      </p>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// BANKS + SAVER STATS — "no matter which bank you're with"
// ─────────────────────────────────────────────────────────────
// 2×3 logo grid — full-colour brand marks on white cards. Per-logo
// heights keep wordmarks and icon-marks optically balanced. Assets
// live in /public/banks.
const SAVER_BANKS = [
  { src: '/banks/absa.png',               name: 'Absa',          h: 26 },
  { src: '/banks/fnb-color.png',          name: 'FNB',           h: 40 },
  { src: '/banks/nedbank.png',            name: 'Nedbank',       h: 22 },
  { src: '/banks/standardbank-color.png', name: 'Standard Bank', h: 30 },
  { src: '/banks/capitec-color.png',      name: 'Capitec',       h: 24 },
  { src: '/banks/investec.png',           name: 'Investec',      h: 26 },
];

const SAVER_STATS = [
  { big: '48hr', label: 'To your first quote',     detail: 'most clients hear back within two days' },
  { big: 'R920', label: 'Average monthly saving',  detail: 'on bond repayments' },
  { big: '94%',  label: 'Approval rate',           detail: 'based on successful switches' },
  { big: 'R0',   label: 'Cost to you, ever',       detail: '100% free service, always' },
];

function BanksSaver() {
  return (
    <section className="ls-section ls-banks" id="banks">
      <div className="ls-wrap ls-banks__grid">
        <div className="ls-banks__intro">
          <h2 className="ls-serif ls-banks__title">
            Bondly can help you save on your home, no matter which bank you're with.
          </h2>
          <p className="ls-banks__sub">
            We negotiate with every major lender in South Africa, so a better rate is never more
            than a switch away.
          </p>
          <div className="ls-banks__logos">
            {SAVER_BANKS.map((b) => (
              <div key={b.name} className="ls-banks__chip">
                <img
                  className="ls-banks__logo"
                  src={b.src}
                  alt={b.name}
                  loading="lazy"
                  decoding="async"
                  style={{ height: `${b.h}px` }}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="ls-banks__panel">
          <ul className="ls-banks__stats">
            {SAVER_STATS.map((s) => (
              <li key={s.label} className="ls-banks__stat">
                <span className="ls-serif ls-banks__big">{s.big}</span>
                <span className="ls-banks__meta">
                  <span className="ls-banks__label">{s.label}</span>
                  <span className="ls-banks__detail">{s.detail}</span>
                </span>
              </li>
            ))}
          </ul>
          <div className="ls-banks__note">
            <span className="ls-banks__note-icon" aria-hidden="true">
              <svg viewBox="0 0 24 24" fill="none">
                <path
                  d="M3 11l4-4 4 3 3-3 4 4M3 11v4a2 2 0 002 2h2m-4-6h4m10-4v4a2 2 0 01-2 2h-2m4-6h-4m-7 6l2 2 3-3"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <p>Bondly is free because we're paid by the bank you switch to, never by you.</p>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// FAQ — sticky heading + accordion list ("Questions, answered.")
// ─────────────────────────────────────────────────────────────
const FAQ_ITEMS = [
  {
    q: 'Is Bondly really free?',
    a: 'Yes. Bondly is completely free for homeowners — we never charge you a cent. We earn a fee from the bank you choose to switch to, so our interests stay aligned with finding you the lowest rate.',
  },
  {
    q: 'Will checking my rate affect my credit score?',
    a: "No. Getting your initial estimate takes no credit check at all. A formal credit enquiry only happens once you pick an offer and decide to proceed — and we'll always tell you before that point.",
  },
  {
    q: 'How long does switching take?',
    a: 'Most switches complete in about 4–6 weeks. You typically get your first quote within 48 hours, and Bondly handles the bond registration and legal paperwork so you barely have to lift a finger.',
  },
  {
    q: 'Which banks does Bondly work with?',
    a: 'We negotiate with all seven major South African banks, so you see their best offers side by side and switch to whichever rate suits you — without shopping around bank by bank yourself.',
  },
  {
    q: 'Am I obligated to switch if I get a quote?',
    a: "Not at all. Your quote is yours to keep with zero obligation. If none of the offers beat what you already have, you walk away — no cost, no pressure, no catch.",
  },
  {
    q: 'What does Bondly actually handle for me?',
    a: 'Everything between you and a lower rate: we gather competing offers, compare them, negotiate on your behalf, and manage the attorneys and bond registration through to a signed-off switch. You just choose the offer you like.',
  },
];

function FAQ() {
  const [open, setOpen] = useState(null);
  const reduce = useReducedMotion();

  const toggle = (i) => {
    setOpen((prev) => {
      const next = prev === i ? null : i;
      if (next === i) trackAction('faq_opened', { question: FAQ_ITEMS[i].q });
      return next;
    });
  };

  return (
    <section className="ls-section ls-faq" id="faq">
      <div className="ls-wrap ls-faq__grid">
        <div className="ls-faq__aside">
          <div className="ls-faq__sticky">
            <h2 className="ls-serif ls-faq__title">Questions, answered.</h2>
            <p className="ls-faq__sub">Everything you might want to know before you check your rate.</p>
          </div>
        </div>

        <div className="ls-faq__list">
          {FAQ_ITEMS.map((item, i) => {
            const isOpen = open === i;
            return (
              <div key={item.q} className={`ls-faq__item${isOpen ? ' is-open' : ''}`}>
                <button
                  type="button"
                  className="ls-faq__q"
                  aria-expanded={isOpen}
                  aria-controls={`faq-panel-${i}`}
                  onClick={() => toggle(i)}
                >
                  <span>{item.q}</span>
                  <span className="ls-faq__icon" aria-hidden="true">
                    <svg viewBox="0 0 24 24" fill="none">
                      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                  </span>
                </button>
                <AnimatePresence initial={false}>
                  {isOpen && (
                    <motion.div
                      key="panel"
                      initial={{ height: 0 }}
                      animate={{ height: 'auto' }}
                      exit={{ height: 0 }}
                      transition={{
                        height: reduce ? { duration: 0 } : { duration: 0.42, ease: EASE_SILK },
                      }}
                      style={{ overflow: 'hidden' }}
                    >
                      <motion.div
                        id={`faq-panel-${i}`}
                        className="ls-faq__panel"
                        role="region"
                        initial={{ opacity: 0, y: -8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -8 }}
                        transition={{
                          opacity: reduce ? { duration: 0 } : { duration: 0.32, ease: EASE_SILK, delay: isOpen ? 0.06 : 0 },
                          y: reduce ? { duration: 0 } : { duration: 0.42, ease: EASE_SILK },
                        }}
                      >
                        <p>{item.a}</p>
                      </motion.div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// FINAL CTA
// ─────────────────────────────────────────────────────────────
function FinalCTA() {
  const navigate = useNavigate();
  return (
    <section className="ls-wrap">
      <div className="ls-final">
        <h2 className="ls-serif ls-h2">See what you'd save.</h2>
        <p>Free · No credit check · 7 banks competing for your bond</p>
        <button
          className="ls-btn ls-btn--primary ls-btn--lg"
          onClick={() => { trackAction('final_cta_clicked', { location: 'final_cta' }); navigate('/switch'); }}
        >
          Check my savings now →
        </button>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────
// FOOTER
// ─────────────────────────────────────────────────────────────
function Footer() {
  return (
    <footer className="ls-wrap ls-footer">
      <div>© 2026 Bondly (Pty) Ltd · Registered bond originator · POPIA compliant · Not a bank; rates indicative.</div>
      <div className="ls-footer__links">
        <Link to="/privacy">Privacy</Link>
        <Link to="/terms">Terms</Link>
        <Link to="/paia">PAIA</Link>
        <a href={ORIGINATION_URL} target="_blank" rel="noopener noreferrer">Bondly Home ↗</a>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────
// PAGE
// ─────────────────────────────────────────────────────────────
export default function Landing() {
  useEffect(() => { track('landing_view', 'page'); }, []);

  return (
    <div className="ls-page">
      <Announce />
      <LandingNav />
      <Hero />
      <HowItWorks />
      <UnderstandYourBond />
      <CaseStudy />
      <BanksSaver />
      <FAQ />
      <FinalCTA />
      <Footer />
    </div>
  );
}
