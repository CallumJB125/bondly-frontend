import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { calcSwapSavings } from '../../lib/finance.js';
import { fmt } from '../../lib/format.js';
import { track, trackAction } from '../../lib/session.js';
import { PRIME_RATE } from '../../lib/constants.js';
import { useRateSettings } from '../../lib/usePrimeRate.js';
import { publicStats } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './Landing.css';

// Env-aware sister-product URL (Bondly Home / origination), mirroring the
// pattern used elsewhere in the app (Nav.jsx, Footer).
const ORIGINATION_URL = typeof window !== 'undefined'
  ? (import.meta.env?.VITE_ORIGINATION_URL || 'http://localhost:5174')
  : 'http://localhost:5174';

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
// NAV — 4 links, 1 CTA, cross-sell demoted
// ─────────────────────────────────────────────────────────────
function LandingNav() {
  const { user } = useAuth();
  const location = useLocation();
  // "How it works" anchors in-page when we're already on the landing surface.
  const howHref = location.pathname === '/home' || location.pathname === '/'
    ? '#how-it-works'
    : '/home#how-it-works';
  return (
    <nav className="ls-nav">
      <div className="ls-wrap ls-nav__inner">
        <Link className="ls-logo" to="/">
          <span className="ls-logo__mark" aria-hidden="true">⌂</span>Bondly
        </Link>
        <div className="ls-nav__links">
          <a href={howHref}>How it works</a>
          <Link to="/calculators">Calculators</Link>
          <Link to="/blog">Guides</Link>
          <Link to="/faq">FAQ</Link>
        </div>
        <div className="ls-nav__right">
          <a
            className="ls-crosssell"
            href={ORIGINATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackAction('crosssell_clicked', { source: 'nav' })}
          >
            Buying instead? <b>Bondly Home ↗</b>
          </a>
          {user ? (
            <Link className="ls-btn ls-btn--primary" to="/dashboard">Dashboard</Link>
          ) : (
            <Link className="ls-btn ls-btn--primary" to="/switch">See my offers</Link>
          )}
        </div>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────
// HERO + live SAVINGS CHECK calculator
// ─────────────────────────────────────────────────────────────
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

  // Fire calculator_completed only once per session.
  const calcCompletedRef = useRef(false);

  const bal = parseFloat(String(balance).replace(/[^\d.]/g, '')) || 0;
  const rt  = parseFloat(rate) || 0;
  const trm = parseInt(term, 10) || 0;

  const inputsValid = bal > 0 && rt > 0 && rt <= 40 && trm >= 1 && trm <= 40;
  const rateWarning = rt > 25 && rt <= 40;

  const safeBal  = bal  > 0 ? bal  : 1_200_000;
  const safeRate = rt   > livePrime ? rt   : livePrime + 1.25;
  const safeTerm = trm  > 0 ? trm  : 18;

  const result = calcSwapSavings(safeBal, safeRate, livePrime, safeTerm * 12);
  const monthlySaving = inputsValid ? Math.max(0, Math.round(result.monthlySaving)) : 0;
  const totalSaving   = inputsValid ? Math.max(0, Math.round(result.totalSaving)) : 0;

  useEffect(() => {
    if (monthlySaving > 0 && !calcCompletedRef.current) {
      calcCompletedRef.current = true;
      trackAction('calculator_completed', { saving: monthlySaving });
    }
  }, [monthlySaving]);

  const onField = (setter, field) => (e) => {
    setter(e.target.value);
    trackAction('calculator_interacted', { field });
  };

  const goToSwitch = (source) => {
    trackAction('hero_calc_cta_clicked', { balance: bal, rate: rt, term: trm, location: source });
    try {
      sessionStorage.setItem('bondly_hero_switch', JSON.stringify({ balance: bal, rate: rt, termYears: trm }));
    } catch (_) {}
    const params = new URLSearchParams();
    if (bal > 0) params.set('balance', String(Math.round(bal)));
    if (rt > 0)  params.set('rate', String(rt));
    if (trm > 0) params.set('term', String(trm));
    const qs = params.toString();
    navigate(qs ? `/switch?${qs}` : '/switch');
  };

  return (
    <header className="ls-hero">
      <div className="ls-wrap ls-hero__grid">
        <div className="ls-hero__copy">
          <div className="ls-eyebrow">Bond switching · South Africa</div>
          <h1 className="ls-serif ls-hero__title">
            Stop overpaying on your <em>bond.</em>
          </h1>
          <p className="ls-hero__sub">
            Most homeowners sit on their bank's standard rate for years. Bondly makes all 7 major
            banks compete for your bond and negotiates the best rate on your behalf — free.
          </p>
          <div className="ls-hero__ctas">
            <button className="ls-btn ls-btn--primary ls-btn--lg" onClick={() => goToSwitch('hero')}>
              See what I'd save →
            </button>
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
            <div><b>Registered</b>bond originator</div>
            <div><b>POPIA</b>compliant</div>
            <div><b>★ 4.8</b>on Hellopeter</div>
            <div><b>R 8.4m+</b>saved to date</div>
          </div>
        </div>

        {/* LIVE calculator card */}
        <aside className="ls-calc" id="savings-check">
          <div className="ls-calc__head">
            <span>SAVINGS CHECK</span><em>takes 30 seconds</em>
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
                  value={balance}
                  onChange={onField(setBalance, 'balance')}
                  aria-label="Outstanding balance"
                />
              </div>
            </div>
            <div className="ls-two">
              <div className="ls-field">
                <label htmlFor="ls-rate">Current rate</label>
                <div className="ls-input">
                  <input
                    id="ls-rate"
                    type="number"
                    inputMode="decimal"
                    min="5" max="25" step="0.25"
                    value={rate}
                    onChange={onField(setRate, 'rate')}
                    aria-label="Current interest rate"
                  />
                  <span aria-hidden="true">%</span>
                </div>
              </div>
              <div className="ls-field">
                <label htmlFor="ls-term">Years remaining</label>
                <div className="ls-input">
                  <input
                    id="ls-term"
                    type="number"
                    inputMode="numeric"
                    min="1" max="30"
                    value={term}
                    onChange={onField(setTerm, 'term')}
                    aria-label="Years remaining on bond"
                  />
                </div>
              </div>
            </div>

            {rateWarning && (
              <p style={{ fontSize: '0.8rem', color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '6px 10px', margin: '4px 0' }}>
                Rates above 25% are unusual — double-check your entry.
              </p>
            )}
            <div className="ls-result" style={{ opacity: inputsValid ? 1 : 0.4, pointerEvents: inputsValid ? 'auto' : 'none' }}>
              <small>{inputsValid ? 'YOU COULD SAVE' : 'ENTER DETAILS TO SEE'}</small>
              <div className="ls-serif ls-result__big" aria-live="polite">
                {inputsValid ? <>{fmt(monthlySaving)}<sub>/month</sub></> : <span style={{ fontSize: '2rem' }}>—</span>}
              </div>
              {inputsValid && <p>≈ {fmt(totalSaving)} over your remaining term · estimate at prime</p>}
            </div>

            <button className="ls-btn ls-btn--primary ls-calc__cta" onClick={() => goToSwitch('hero_calc')}>
              Get my 7 real offers →
            </button>
            <p className="ls-calc__foot">No credit check · No obligation · Banks compete, you choose</p>
          </div>
        </aside>
      </div>
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
      title: 'Share your bond details',
      body: 'Your balance, current rate and a few details — or just upload a statement. No bank visit, no credit check at this stage.',
    },
    {
      n: '2',
      title: '7 banks compete',
      body: 'ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec and SA Home Loans each submit their best offer, side by side within 48 hours.',
    },
    {
      n: '3',
      title: 'Pick your offer, we switch you',
      body: 'Choose the best rate. We handle the paperwork, cancellation and registration end-to-end. Banks pay us the same fee whichever you pick.',
    },
  ];
  return (
    <section className="ls-section" id="how-it-works">
      <div className="ls-wrap">
        <div className="ls-sec-eyebrow">How it works</div>
        <h2 className="ls-serif ls-h2">Three steps. We do the heavy lifting.</h2>
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
      <h2 className="ls-serif ls-h2">What a switch actually looks like</h2>
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
      <ProofBand />
      <HowItWorks />
      <CaseStudy />
      <FinalCTA />
      <Footer />
    </div>
  );
}
