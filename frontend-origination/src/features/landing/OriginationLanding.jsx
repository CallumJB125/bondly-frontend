import { useState, useCallback, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { calcMaxBond } from '../../lib/mortgage.js';
import { calcMonthly } from '../../lib/finance.js';
import { useRateSettings } from '../../lib/usePrimeRate.js';
import { fmt, fmtPct, parseNum } from '../../lib/format.js';
import { trackAction } from '../../lib/analytics.js';
import './OriginationLanding.css';

// ── Constants ────────────────────────────────────────────────
// sessionStorage key for carrying calc values into the funnel
const CALC_STORAGE_KEY = 'bondly_orig_calc';
// env-aware sister-site URL (Bondly Switch) — reused existing pattern
const SWITCH_URL = import.meta.env.VITE_SWITCH_URL || 'http://localhost:5173';
// Real WhatsApp deep-link used across the codebase
const WHATSAPP_URL = 'https://wa.me/27796971786?text=Hi%20Bondly%2C%20I%20want%20to%20check%20what%20home%20loan%20I%20qualify%20for';
const LOAN_TERM_YEARS = 20;

// ── Count-up hook: smoothly animates a number toward `target` ─
function useCountUp(target, duration = 600) {
  const [display, setDisplay] = useState(target);
  const fromRef = useRef(target);
  const rafRef = useRef(null);

  useEffect(() => {
    const reduced = typeof window !== 'undefined'
      && window.matchMedia
      && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced || target === fromRef.current) {
      setDisplay(target);
      fromRef.current = target;
      return undefined;
    }
    const from = fromRef.current;
    const start = performance.now();
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic
      setDisplay(Math.round(from + (target - from) * eased));
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else fromRef.current = target;
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => { if (rafRef.current) cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return display;
}

// ── Reveal-on-scroll (visible by default; observer just plays a lift) ──
function useReveal() {
  const ref = useRef(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    const reveal = () => el.classList.add('orig-reveal--in');
    if (typeof IntersectionObserver === 'undefined') { reveal(); return undefined; }
    const obs = new IntersectionObserver(([entry]) => {
      if (entry.isIntersecting) { reveal(); obs.disconnect(); }
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    obs.observe(el);
    const fallback = setTimeout(reveal, 600);
    return () => { obs.disconnect(); clearTimeout(fallback); };
  }, []);
  return ref;
}

function Reveal({ as: Tag = 'div', delay = 0, className = '', children, ...rest }) {
  const ref = useReveal();
  return (
    <Tag
      ref={ref}
      className={`orig-reveal ${className}`}
      style={delay ? { '--reveal-delay': `${delay}ms` } : undefined}
      {...rest}
    >
      {children}
    </Tag>
  );
}

// ── Value-prop icons (stroke SVG, matched to the mockup) ─────
function IconClock() {
  return <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
}
function IconShield() {
  return <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" /></svg>;
}
function IconRand() {
  return <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1v22M17 5H9.5a3.5 3.5 0 000 7h5a3.5 3.5 0 010 7H6" /></svg>;
}
function IconBuilding() {
  return <svg fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24" aria-hidden="true"><path d="M3 21h18M5 21V7l7-4 7 4v14M9 21v-6h6v6" /></svg>;
}
function IconWhatsApp() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
    </svg>
  );
}

// ── Main component ───────────────────────────────────────────
export default function OriginationLanding() {
  const navigate = useNavigate();
  const { primeRate: livePrime } = useRateSettings();

  // Prefill from URL params / sessionStorage, else mockup defaults (35 000 / 3 000)
  const [incomeRaw, setIncomeRaw] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('income')) return params.get('income');
      const stored = sessionStorage.getItem(CALC_STORAGE_KEY);
      if (stored) { const p = JSON.parse(stored); if (p.income) return String(p.income); }
    } catch (_) { /* ignore */ }
    return '35000';
  });
  const [debtRaw, setDebtRaw] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('debt')) return params.get('debt');
      const stored = sessionStorage.getItem(CALC_STORAGE_KEY);
      if (stored) { const p = JSON.parse(stored); if (p.debt) return String(p.debt); }
    } catch (_) { /* ignore */ }
    return '3000';
  });

  // Whether the user has edited an input — controls the "EXAMPLE" tag.
  // Result stays illustrative until first edit (preserves prior behaviour).
  const [edited, setEdited] = useState(false);

  // fire calculator_completed only once per session
  const completedRef = useRef(false);

  const income = parseNum(incomeRaw, 0);
  const debt = parseNum(debtRaw, 0);

  const maxBond = calcMaxBond(income, debt);
  const monthly = maxBond > 0 ? calcMonthly(maxBond, livePrime, LOAN_TERM_YEARS) : 0;
  const animatedBond = useCountUp(maxBond);

  const handleInputChange = useCallback((setter, field) => (e) => {
    setter(e.target.value.replace(/[^\d]/g, ''));
    setEdited(true);
    trackAction('calculator_interacted', { field });
  }, []);

  const handleCtaClick = useCallback((location, to) => {
    trackAction('cta_clicked', { location });
    if (to) navigate(to);
  }, [navigate]);

  const handleWhatsApp = useCallback((source) => {
    trackAction('whatsapp_clicked', { source });
  }, []);

  // calculator_completed — once per session when an estimate first appears
  useEffect(() => {
    if (maxBond > 0 && !completedRef.current) {
      completedRef.current = true;
      trackAction('calculator_completed', { estimate: maxBond });
    }
  }, [maxBond]);

  // scroll-depth milestones (25/50/75/100%), fire once each
  useEffect(() => {
    const fired = new Set();
    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight;
      const total = document.documentElement.scrollHeight;
      if (total < 200) return;
      const pct = Math.min(100, Math.round((scrolled / total) * 100));
      for (const m of [25, 50, 75, 100]) {
        if (pct >= m && !fired.has(m)) { fired.add(m); trackAction('scroll_depth', { scrollPct: m }); }
      }
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // persist income/debt to sessionStorage whenever they change
  useEffect(() => {
    try { sessionStorage.setItem(CALC_STORAGE_KEY, JSON.stringify({ income, debt })); } catch (_) { /* ignore */ }
  }, [income, debt]);

  // Real pre-approval target — carries income/debt into the funnel (existing pattern)
  const preapprovalUrl = `/mortgage-readiness${income > 0 ? `?income=${income}${debt > 0 ? `&debt=${debt}` : ''}` : ''}`;

  const showExampleTag = !edited;

  return (
    <div className="orig-landing">

      {/* ── ANNOUNCE BAR — live prime ───────────────────────── */}
      <div className="orig-announce">
        First-time buyers pay <strong>R 0 transfer duty</strong> under R 1.21m.
        <Link to="/mortgage-readiness">See what you can afford →</Link>
      </div>

      {/* ── NAV ─────────────────────────────────────────────── */}
      <nav className="orig-nav" aria-label="Main">
        <div className="orig-wrap orig-nav__inner">
          <Link className="orig-nav__logo" to="/" aria-label="Bondly Home — homepage">
            <span className="orig-nav__logo-mark">⌂</span>Bondly <small>Home</small>
          </Link>
          <div className="orig-nav__links">
            <Link to="/mortgage-readiness">Affordability</Link>
            <Link to="/first-time-buyer-guide">First-home guide</Link>
            <Link to="/tools">Calculators</Link>
            <Link to="/faq">FAQ</Link>
          </div>
          <div className="orig-nav__right">
            <a className="orig-nav__crosssell" href={SWITCH_URL} target="_blank" rel="noopener noreferrer">
              Own a home? <b>Bondly Switch ↗</b>
            </a>
            <Link className="orig-btn orig-btn--primary" to="/preapproval" onClick={() => trackAction('cta_clicked', { location: 'nav' })}>
              Get pre-approved
            </Link>
          </div>
        </div>
      </nav>

      {/* ── HERO ────────────────────────────────────────────── */}
      <header className="orig-hero">
        <div className="orig-wrap orig-hero__grid">
          <div>
            <div className="orig-eyebrow">First home loans · Updated for 2026 rates</div>
            <h1 className="orig-hero__h1">Find out what home you can afford — <em>in 2 minutes.</em></h1>
            <p className="orig-hero__sub">
              One application, all 7 South African home-loan lenders. We compare their offers and
              negotiate for you. No paperwork to start, no credit check, no cost — ever.
            </p>
            <div className="orig-hero__ctas">
              <button
                className="orig-btn orig-btn--primary orig-btn--lg"
                onClick={() => handleCtaClick('hero', preapprovalUrl)}
              >
                Check my affordability →
              </button>
              <a
                className="orig-btn orig-btn--ghost"
                href="#how-it-works"
                onClick={() => trackAction('cta_clicked', { location: 'hero_how' })}
              >
                How it works
              </a>
            </div>
            <p className="orig-hero__reassure">
              Prefer to talk? <a href="tel:+27796971786">079 697 1786</a> · Mon–Fri 8–5
            </p>
            <div className="orig-trust-row">
              <div><b>No credit check</b>for your estimate</div>
              <div><b>100% free</b>lenders pay us</div>
              <div><b>All 7 lenders</b>one application</div>
              <div><b>Prime {fmtPct(livePrime)}</b>live rate</div>
            </div>
          </div>

          {/* ── LIVE CALCULATOR CARD ────────────────────────── */}
          <aside className="orig-calc" role="region" aria-label="Affordability calculator">
            <div className="orig-calc__head">
              <span>WHAT CAN I AFFORD?</span><em>instant estimate</em>
            </div>
            <div className="orig-calc__body">
              <div className="orig-field">
                <label className="orig-field__label" htmlFor="calc-income">
                  Monthly salary <small>(before tax)</small>
                </label>
                <div className="orig-field__input">
                  <span>R</span>
                  <input
                    id="calc-income"
                    type="text"
                    inputMode="numeric"
                    value={incomeRaw}
                    onChange={handleInputChange(setIncomeRaw, 'income')}
                    placeholder="35 000"
                    aria-label="Monthly salary before tax, in Rands"
                  />
                </div>
              </div>
              <div className="orig-field">
                <label className="orig-field__label" htmlFor="calc-debt">
                  Monthly debt repayments <small>(optional)</small>
                </label>
                <div className="orig-field__input">
                  <span>R</span>
                  <input
                    id="calc-debt"
                    type="text"
                    inputMode="numeric"
                    value={debtRaw}
                    onChange={handleInputChange(setDebtRaw, 'debt')}
                    placeholder="3 000"
                    aria-label="Monthly debt repayments, in Rands"
                  />
                </div>
              </div>

              <div className="orig-result" aria-live="polite" aria-atomic="true">
                {showExampleTag && <div className="orig-result__tag">EXAMPLE</div>}
                <div className="orig-result__label">YOU COULD AFFORD UP TO</div>
                <div className={`orig-result__big${maxBond > 0 ? '' : ' orig-result__big--placeholder'}`}>
                  {maxBond > 0 ? fmt(animatedBond) : 'R —'}
                </div>
                <p className="orig-result__sub">
                  {monthly > 0 ? (
                    <>≈ {fmt(monthly)}/month at prime ({fmtPct(livePrime)})</>
                  ) : (
                    <>enter your salary to see your number</>
                  )}
                  {showExampleTag && monthly > 0 && ' · enter your salary for your real number'}
                </p>
              </div>

              <button
                className="orig-btn orig-btn--primary"
                onClick={() => handleCtaClick('calculator', preapprovalUrl)}
              >
                Get my free pre-approval →
              </button>
              <p className="orig-calc__foot">
                No impact on your credit score · or{' '}
                <a href={WHATSAPP_URL} target="_blank" rel="noreferrer" onClick={() => handleWhatsApp('calculator')}>
                  start on WhatsApp
                </a>
              </p>
            </div>
          </aside>
        </div>
      </header>

      {/* ── VALUE PROPS ─────────────────────────────────────── */}
      <section className="orig-props">
        <div className="orig-wrap">
          <div className="orig-sec-eyebrow">Why Bondly Home</div>
          <h2 className="orig-h2">Built for first-time buyers</h2>
          <div className="orig-prop-grid">
            {[
              { icon: <IconClock />, title: '2-minute estimate', desc: 'See what you qualify for before doing anything else. Just your income — no documents.' },
              { icon: <IconShield />, title: 'Your score stays safe', desc: 'Affordability checks never touch your credit record. A check happens only when you formally apply.' },
              { icon: <IconRand />, title: 'Zero cost, ever', desc: 'Lenders pay us the same commission whichever you choose — you pay the same rate as going direct.' },
              { icon: <IconBuilding />, title: 'All 7 lenders, one form', desc: 'ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec and SA Home Loans — applied to at once.' },
            ].map(({ icon, title, desc }, i) => (
              <Reveal key={title} className="orig-prop" delay={i * 70}>
                {icon}
                <h3>{title}</h3>
                <p>{desc}</p>
              </Reveal>
            ))}
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS — two steps ────────────────────────── */}
      <section className="orig-steps-band" id="how-it-works">
        <div className="orig-wrap">
          <div className="orig-sec-eyebrow">How it works</div>
          <h2 className="orig-h2">From statement to approval in two steps</h2>
          <div className="orig-steps">
            <Reveal className="orig-step">
              <div className="orig-step__num">1</div>
              <h3>Upload your bank statement</h3>
              <p>Drag in your latest PDF. Bondly reads your income, debts and spending in 90 seconds — salary credits and recurring debts detected automatically. No manual forms.</p>
            </Reveal>
            <Reveal className="orig-step" delay={90}>
              <div className="orig-step__num">2</div>
              <h3>All 7 lenders respond</h3>
              <p>Every lender receives your application simultaneously. You see each indicative offer side by side, and we negotiate the best rate on your behalf.</p>
            </Reveal>
          </div>
        </div>
      </section>

      {/* ── RESULTS PREVIEW (illustrative) ──────────────────── */}
      <section className="orig-preview">
        <div className="orig-wrap">
          <div className="orig-sec-eyebrow">Your results include</div>
          <h2 className="orig-h2">Here&#8217;s exactly what you&#8217;ll see</h2>
          <div className="orig-pv-grid">
            {[
              { label: 'Maximum bond', val: 'R 1 200 000', desc: 'The highest loan amount lenders are likely to approve on your income.' },
              { label: 'Monthly repayment', val: '≈ R 12 400', desc: 'Your estimated payment at current prime, so you can plan your budget.' },
              { label: 'Bank likelihood', val: '5 of 7 likely', desc: 'Which lenders are most likely to say yes — and which need more info.' },
              { label: 'How to improve', val: '+R 84k bond', desc: 'Clear actions, e.g. reduce debt by R 1 000/mo to raise your maximum.' },
            ].map(({ label, val, desc }, i) => (
              <Reveal key={label} className="orig-pv" delay={i * 80}>
                <small>{label}</small>
                <div className="orig-pv__val">{val}</div>
                <p>{desc}</p>
              </Reveal>
            ))}
          </div>
          <p className="orig-pv-note">
            Example based on R 45 000/mo gross income with R 3 000/mo existing debt. Estimates only, subject to lender assessment.
          </p>
        </div>
      </section>

      {/* ── FINAL CTA ───────────────────────────────────────── */}
      <section className="orig-wrap">
        <div className="orig-final">
          <h2 className="orig-h2">Let&#8217;s find out what you can afford.</h2>
          <p>2 minutes · No credit check · All 7 lenders · Completely free</p>
          <button
            className="orig-btn orig-btn--primary orig-btn--lg"
            onClick={() => handleCtaClick('final', preapprovalUrl)}
          >
            Get my free pre-approval →
          </button>
          <a
            className="orig-final__wa"
            href={WHATSAPP_URL}
            target="_blank"
            rel="noreferrer"
            onClick={() => handleWhatsApp('final')}
          >
            or start on WhatsApp →
          </a>
        </div>
      </section>

      {/* ── FOOTER ──────────────────────────────────────────── */}
      <footer className="orig-wrap orig-footer">
        <div>© {new Date().getFullYear()} Bondly (Pty) Ltd · Registered bond originator · POPIA compliant · Not a bank; estimates subject to lender approval.</div>
        <div className="orig-footer__links">
          <Link to="/privacy">Privacy</Link>
          <Link to="/terms">Terms</Link>
          <Link to="/paia">PAIA</Link>
          <a href={SWITCH_URL} target="_blank" rel="noopener noreferrer">Bondly Switch ↗</a>
        </div>
      </footer>

      {/* ── FLOATING WHATSAPP ───────────────────────────────── */}
      <a
        className="orig-float-wa"
        href={WHATSAPP_URL}
        target="_blank"
        rel="noreferrer"
        aria-label="Chat with us on WhatsApp"
        onClick={() => handleWhatsApp('float')}
      >
        <IconWhatsApp /> <span className="orig-float-wa__label">WhatsApp us</span>
      </a>

    </div>
  );
}
