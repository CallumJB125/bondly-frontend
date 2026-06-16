import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { fmt, fmtPct } from '../../lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CurrencyInput } from '../../components/Input.jsx';
import { publicAlerts, parseStatementForPreapproval } from '../../lib/api.js';
import { PRIME_RATE } from '../../lib/constants.js';
import { useRateSettings } from '../../lib/usePrimeRate.js';
import './Switch.css';

const PRIME = PRIME_RATE;
const BANKS = ['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'Investec', 'SA Home Loans'];

// Simulated bank offers based on income/bond/credit profile
function computeOffers(income, balance, currentRate, termYears = 20) {
  const spreads = [0.0, 0.25, 0.35, 0.5, 0.75, 1.0, 1.5];
  const n = Math.max(1, Math.round(termYears * 12));
  const currentPayment = balance * (currentRate / 100 / 12) / (1 - Math.pow(1 + currentRate / 100 / 12, -n));
  return BANKS.map((bank, i) => {
    const spread = spreads[i];
    const rate = PRIME + spread;
    const monthlyPayment = balance * (rate / 100 / 12) / (1 - Math.pow(1 + rate / 100 / 12, -n));
    const monthlySaving = currentPayment - monthlyPayment;
    return { bank, rate, spread, monthlyPayment: Math.round(monthlyPayment), monthlySaving: Math.round(monthlySaving) };
  }).sort((a, b) => a.rate - b.rate);
}

// ── Reading animation ─────────────────────────────────────────────────────────
function StatementReadingReveal({ onComplete, hasFile = false }) {
  const steps = hasFile
    ? ['Reading bank statement…', 'Extracting your finances…', 'Comparing 7 bank offers…', 'Finding your best rate…']
    : ['Analysing your inputs…', 'Looking up current bank rates…', 'Comparing 7 bank offers…', 'Finding your best rate…'];
  const [step, setStep] = useState(0);
  const [done, setDone] = useState(false);

  useEffect(() => {
    let i = 0;
    const iv = setInterval(() => {
      i++;
      if (i < steps.length) { setStep(i); }
      else { clearInterval(iv); setDone(true); setTimeout(onComplete, 400); }
    }, 350);
    return () => clearInterval(iv);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="switch-reading">
      <div className="switch-reading__icon">
        {done ? '✓' : <div className="spinner switch-reading__spinner" />}
      </div>
      <div className="switch-reading__steps">
        {steps.map((s, i) => (
          <div key={s} className={`switch-reading__step ${i <= step ? 'switch-reading__step--done' : ''} ${i === step && !done ? 'switch-reading__step--active' : ''}`}>
            <span className="switch-reading__step-dot">{i < step || done ? '✓' : i === step ? '◐' : '○'}</span>
            {s}
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Verdict panel ─────────────────────────────────────────────────────────────
function GoodRateBlock({ onProceed, onSeeOffers }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState('idle'); // 'idle' | 'sending' | 'done' | 'error'

  async function submitWatch(e) {
    e.preventDefault();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setStatus('error'); return; }
    setStatus('sending');
    try {
      await publicAlerts.subscribeRateAlert({ email, currentRate });
      setStatus('done');
    } catch {
      setStatus('error');
    }
  }

  return (
    <div className="switch-goodrate">
      <div className="switch-goodrate__lede">
        Based on what you've told us, you appear to be in a reasonable position — but Bondly may still be able to improve your deal. The only way to know for sure is a free review.
      </div>

      <div className="switch-goodrate__options">
        <div className="switch-goodrate__option">
          <div className="switch-goodrate__option-cap">Still worth a free check</div>
          <div className="switch-goodrate__option-body">
            It costs nothing to let Bondly review your home loan with all 7 lenders. A formal assessment sometimes reveals a better outcome than an estimate can show.
          </div>
          <button
            className="btn btn--lime switch-goodrate__btn"
            onClick={() => {
              if (user) { onProceed(); }
              else { navigate('/register?intent=switch'); }
            }}
          >
            Apply for a free review →
          </button>
          {onSeeOffers && (
            <button
              type="button"
              className="switch-goodrate__btn-secondary"
              onClick={onSeeOffers}
            >
              Or upload your statement for a real offer →
            </button>
          )}
        </div>

        <div id="rate-alert" className="switch-goodrate__option switch-goodrate__option--watch">
          <div className="switch-goodrate__option-cap">Or — watch the market for me</div>
          <div className="switch-goodrate__option-body">
            Drop your email and we'll alert you if prime moves or a bank starts undercutting your rate. No spam, unsubscribe in one click.
          </div>
          {status === 'done' ? (
            <div className="switch-goodrate__watch-done">✓ You're on the list. We'll be in touch the moment something changes.</div>
          ) : (
            <form className="switch-goodrate__watch-form" onSubmit={submitWatch}>
              <input
                type="email"
                className="switch-goodrate__watch-input"
                placeholder="you@example.com"
                value={email}
                onChange={e => setEmail(e.target.value)}
                disabled={status === 'sending'}
                required
              />
              <button
                type="submit"
                className="switch-goodrate__watch-btn"
                disabled={status === 'sending' || !email}
              >
                {status === 'sending' ? 'Adding…' : 'Watch the market for me'}
              </button>
              {status === 'error' && (
                <div className="switch-goodrate__watch-error">Please enter a valid email.</div>
              )}
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

function SwitchVerdict({ income, balance, currentRate, termYears = 20, onProceed, onSeeOffers }) {
  const offers = computeOffers(income, balance, currentRate, termYears);
  const best   = offers[0];
  const saving  = best.monthlySaving;
  const annualSaving = saving * 12;
  const termMonths   = Math.max(1, Math.round(termYears * 12));
  const termSaving   = saving * termMonths;
  const currentPayment = balance * (currentRate / 100 / 12) / (1 - Math.pow(1 + currentRate / 100 / 12, -termMonths));

  // "Debt-free sooner" — if you keep paying the same monthly amount you pay today
  // but at the lower rate, the loan amortises faster.
  const newMonthlyRate = best.rate / 100 / 12;
  let monthsFaster = 0;
  if (newMonthlyRate > 0 && currentPayment > balance * newMonthlyRate) {
    const newTerm = Math.log(currentPayment / (currentPayment - balance * newMonthlyRate))
                  / Math.log(1 + newMonthlyRate);
    monthsFaster = Math.max(0, Math.round(termMonths - newTerm));
  }
  const yearsFaster   = Math.floor(monthsFaster / 12);
  const remMonths     = monthsFaster % 12;
  const fasterLabel   = monthsFaster < 1
    ? '—'
    : monthsFaster < 12
      ? `${monthsFaster} months`
      : remMonths === 0
        ? `${yearsFaster} years`
        : `${yearsFaster}yr ${remMonths}mo`;

  const navigate = useNavigate();

  return (
    <div className="switch-verdict fade-in">
      <div className="switch-verdict__header">
        {saving > 0 ? (
          <>
            <div className="switch-verdict__pill switch-verdict__pill--green">You could save</div>
            <div className="switch-verdict__headline">{fmt(saving)}<span>/mo</span></div>
            <div className="switch-verdict__sub">if you let Bondly handle your switch</div>
          </>
        ) : (
          <>
            <div className="switch-verdict__pill switch-verdict__pill--grey">Looking good</div>
            <div className="switch-verdict__headline" style={{ fontSize: 'clamp(1.5rem,4vw,2rem)' }}>Your bond looks competitive</div>
            <div className="switch-verdict__sub">A free Bondly review will confirm whether there's room to improve</div>
          </>
        )}
      </div>

      {saving <= 0 && (
        <GoodRateBlock
          onProceed={onProceed}
          onSeeOffers={onSeeOffers}
        />
      )}

      {saving > 0 && (() => {
        // Candidacy score — proxy for how strong a switch candidate this profile is
        const scorePct = Math.min(95, Math.round(50 + (saving / Math.max(1, Math.round(currentPayment))) * 300));
        return (
          <>
            {/* Bondly candidacy score */}
            <div className="switch-score">
              <div className="switch-score__label">Bondly switch score</div>
              <div className="switch-score__bar-wrap">
                <div className="switch-score__bar" style={{ width: `${scorePct}%` }} />
              </div>
              <div className="switch-score__val">{scorePct} / 100</div>
              <div className="switch-score__caption">
                {scorePct >= 80
                  ? 'Strong candidate — Bondly is very likely to improve your deal.'
                  : scorePct >= 65
                  ? 'Good candidate — there is meaningful room to improve your outcome.'
                  : 'Moderate candidate — Bondly will check if a better deal is available.'}
              </div>
            </div>

            {/* Saving summary — no rates shown */}
            <div className="switch-story">
              <div className="switch-story__list">
                <div className="switch-story__line">
                  <span>Estimated monthly saving</span>
                  <strong>{fmt(saving)}</strong>
                </div>
                <div className="switch-story__line">
                  <span>Saved per year</span>
                  <strong>{fmt(annualSaving)}</strong>
                </div>
                <div className="switch-story__line">
                  <span>Saved across your {termYears}-year bond</span>
                  <strong>{fmt(termSaving)}</strong>
                </div>
              </div>
            </div>

            {/* Debt-free hero */}
            {monthsFaster > 0 && (
              <div className="switch-debtfree">
                <div className="switch-debtfree__lede">Or — keep your current repayment the same and Bondly negotiates you a better deal, and you're</div>
                <div className="switch-debtfree__big">debt-free {fasterLabel} sooner</div>
              </div>
            )}
          </>
        );
      })()}

      <div className="switch-verdict__disclaimer">
        Estimate only — actual savings depend on your full credit and income profile. Bondly will confirm your outcome after reviewing your file. No credit check at this stage.
      </div>

      {saving > 0 && (
        <div className="switch-verdict__cta-area">
          <button
            className="btn btn--lime switch-verdict__cta"
            onClick={onSeeOffers}
          >
            Let Bondly negotiate for me →
          </button>
          <div className="switch-verdict__cta-note">Upload your bank statement · No obligation · Free to homeowners</div>
          <button
            type="button"
            className="switch-verdict__cta-secondary"
            onClick={onProceed}
          >
            Skip upload — just apply →
          </button>
        </div>
      )}

      {/* Financial helper funnel */}
      <div className="switch-verdict__optimize">
        <div className="switch-verdict__optimize-label">Want to strengthen your application first?</div>
        <div className="switch-verdict__optimize-desc">
          Bondly's financial helper analyses your full spending picture — showing you exactly what banks flag and how to improve your profile before applying.
        </div>
        <button
          className="switch-verdict__optimize-btn"
          onClick={() => navigate('/optimize')}
        >
          See my full financial picture →
        </button>
      </div>
    </div>
  );
}

// ── Statement upload page ─────────────────────────────────────────────────────
function StatementUpload({ onProceed, onBack, onSkip }) {
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [dragOver, setDragOver] = useState(false);
  const [parsing, setParsing] = useState(false);

  function handleFile(f) {
    if (!f) return;
    if (f.type !== 'application/pdf') { alert('Please upload a PDF bank statement.'); return; }
    setFile(f);
  }

  async function handleGetOffers() {
    if (!file) {
      fileRef.current?.click();
      return;
    }
    setParsing(true);
    try {
      await parseStatementForPreapproval(file);
    } catch (err) {
      console.error('Statement parse error (proceeding anyway):', err);
    }
    // Always proceed — lead is captured even on parse error
    onProceed(file);
  }

  return (
    <div className="switch-statement fade-in">
      <button type="button" className="switch-statement__back" onClick={onBack}>
        ← Back to estimate
      </button>

      <div className="switch-statement__card">
        <div className="switch-statement__icon">📄</div>
        <h2 className="switch-statement__title">Get real, confirmed offers</h2>
        <p className="switch-statement__body">
          Upload your latest bank statement (PDF) and we'll get you real, confirmed offers from the banks — not just an estimate.
        </p>
        <div className="switch-statement__trust">
          <span>No credit check</span>
          <span>·</span>
          <span>POPIA compliant</span>
          <span>·</span>
          <span>Your statement is never shared without consent</span>
        </div>

        <div
          className={`switch-statement__dropzone${dragOver ? ' switch-statement__dropzone--over' : ''}${file ? ' switch-statement__dropzone--attached' : ''}`}
          onClick={() => !file && fileRef.current?.click()}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
        >
          {file ? (
            <div className="switch-statement__file-info">
              <span className="switch-statement__file-icon">✓</span>
              <span className="switch-statement__file-name">{file.name}</span>
              <button
                type="button"
                className="switch-statement__file-remove"
                onClick={e => { e.stopPropagation(); setFile(null); }}
              >
                Remove
              </button>
            </div>
          ) : (
            <>
              <div className="switch-statement__dropzone-icon">⬆</div>
              <div className="switch-statement__dropzone-label">
                Drag your PDF here, or <span className="switch-statement__dropzone-link">browse</span>
              </div>
              <div className="switch-statement__dropzone-hint">PDF only · Last 3 months preferred</div>
            </>
          )}
        </div>

        <input
          ref={fileRef}
          type="file"
          accept="application/pdf"
          style={{ display: 'none' }}
          onChange={e => handleFile(e.target.files[0])}
        />

        {parsing ? (
          <div className="switch-statement__parsing">
            <div className="spinner" style={{ width: 24, height: 24, marginRight: 10 }} />
            Reading your statement…
          </div>
        ) : (
          <button
            className="btn btn--lime switch-statement__cta"
            onClick={handleGetOffers}
          >
            {file ? 'Get my real offers →' : 'Upload statement to continue →'}
          </button>
        )}

        <button
          type="button"
          className="switch-statement__skip"
          onClick={onSkip}
        >
          Skip — just submit my details
        </button>
      </div>
    </div>
  );
}

// ── Main Switch page ──────────────────────────────────────────────────────────
const DEMO_VALUES = { monthly: '10500', rate: String(PRIME + 1.75), term: '20', bank: 'ABSA' };

// Derive outstanding balance from monthly payment, annual rate (%), term (years)
function deriveBalance(monthly, ratePct, termYears) {
  const r = (ratePct / 100) / 12;
  const n = Math.max(1, Math.round(termYears * 12));
  if (!isFinite(monthly) || monthly <= 0 || !isFinite(r) || r <= 0) return 0;
  return monthly * (1 - Math.pow(1 + r, -n)) / r;
}

export default function Switch({ demo = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primeRate: livePrime } = useRateSettings();

  // Call getInitialForm exactly once via ref so sessionStorage is only consumed once
  const initialFormRef = useRef(null);
  if (initialFormRef.current === null) {
    initialFormRef.current = (() => {
      if (demo) return DEMO_VALUES;
      const base = { monthly: '', rate: String(PRIME + 1.0), term: '20', bank: '' };
      try {
        const stored = sessionStorage.getItem('bondly_hero_switch');
        if (stored) {
          const { balance, rate, termYears } = JSON.parse(stored);
          sessionStorage.removeItem('bondly_hero_switch');
          const r = (parseFloat(rate) / 100) / 12;
          const n = Math.max(1, Math.round((parseFloat(termYears) || 20) * 12));
          const monthly = balance > 0 && r > 0
            ? Math.round(balance * r / (1 - Math.pow(1 + r, -n)))
            : 0;
          return {
            monthly: monthly > 0 ? String(monthly) : base.monthly,
            rate: rate != null ? String(rate) : base.rate,
            term: termYears != null ? String(termYears) : base.term,
            bank: base.bank,
          };
        }
      } catch {}
      // URL query params fallback: ?balance=1200000&rate=11.75&term=20
      try {
        const params = new URLSearchParams(window.location.search);
        const balance = parseFloat(params.get('balance') || '0');
        const rate = params.get('rate');
        const termYears = params.get('term');
        if (balance > 0 || rate || termYears) {
          const resolvedRate = parseFloat(rate) || PRIME + 1.0;
          const resolvedTerm = parseFloat(termYears) || 20;
          const r = (resolvedRate / 100) / 12;
          const n = Math.max(1, Math.round(resolvedTerm * 12));
          const monthly = balance > 0 && r > 0
            ? Math.round(balance * r / (1 - Math.pow(1 + r, -n)))
            : 0;
          return {
            monthly: monthly > 0 ? String(monthly) : base.monthly,
            rate: rate ? String(rate) : base.rate,
            term: termYears ? String(termYears) : base.term,
            bank: base.bank,
          };
        }
      } catch {}
      return base;
    })();
  }
  const initialForm = initialFormRef.current;

  // Auto-show estimate when user arrives with carried-over numbers
  const prefilled = !demo && parseFloat(initialForm.monthly) > 0 && !!initialForm.rate;
  const initialMode = demo ? 'verdict' : prefilled ? 'verdict' : 'form';

  // 'form' | 'reading' | 'verdict' | 'statement' | 'reading-statement' | 'contact' | 'confirm'
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState(initialForm);
  const [proceeded, setProceeded] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // file waiting after contact capture
  const [submitTried, setSubmitTried] = useState(false);

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitTried(true);
    const monthlyEmpty = !form.monthly || (parseFloat(form.monthly.replace(/\s/g, '')) || 0) <= 0;
    if (monthlyEmpty || rateOutOfRange || monthlyTooHigh || monthlyNegative) return;
    setMode('reading');
  }

  // Original path: form → reading → verdict
  function handleReadingDone() {
    setMode('verdict');
  }

  // Statement parse path: statement → reading-statement → confirm
  function handleStatementReadingDone() {
    setMode('confirm');
    setProceeded(true);
  }

  function handleProceed() {
    if (!user) {
      setMode('contact');
    } else {
      setMode('confirm');
      setProceeded(true);
    }
  }

  function handleSeeOffers() {
    setMode('statement');
  }

  // Called when StatementUpload has a file and initiates parse animation
  function handleStatementSubmit(file) {
    setPendingFile(file);
    if (!user) {
      setMode('contact'); // capture lead first, then animate
    } else {
      setMode('reading-statement');
    }
  }

  const monthlyInput = Math.max(0, Math.min(parseFloat(form.monthly) || 0, 1_000_000));
  const currentRate  = parseFloat(form.rate) || PRIME + 1.0;
  const termYears    = parseFloat(form.term) || 20;
  const monthlyTooHigh = (parseFloat(form.monthly) || 0) > 1_000_000;
  const monthlyNegative = form.monthly !== '' && (parseFloat(form.monthly) || 0) <= 0;
  const rateOutOfRange = currentRate <= 0 || currentRate > 30;
  const balance      = monthlyInput > 0
    ? deriveBalance(monthlyInput, currentRate, termYears)
    : 1_200_000;
  const income       = 0;

  return (
    <div className="switch-page">
      {/* Hero */}
      <section className="switch-hero">
        <div className="container switch-hero__inner">
          <div className="switch-hero__copy">
            <div className="section-pill section-pill--lime">Free bond switch comparison</div>
            <h1 className="switch-hero__title">Is your bank giving you the best rate?</h1>
            <p className="switch-hero__sub">
              Most SA homeowners are on their bank's default rate — not their best. Enter a few details and we'll show you what you could save if we handle the switch for you.
            </p>
            <div className="switch-hero__trust">
              <span>✓ Free for homeowners</span>
              <span>✓ No credit check</span>
              <span>✓ 4–8 weeks to switch</span>
            </div>
          </div>

          {mode === 'form' && (
            <form className="switch-form" onSubmit={handleSubmit}>
              <div className="switch-form__heading">What do you pay the bank each month?</div>
              <div className="switch-form__intro">
                Type the rand amount from your home loan debit order — the one that leaves your account each month.
              </div>

              <button
                type="button"
                className="switch-form__statement-shortcut"
                onClick={() => setMode('statement')}
              >
                <span className="switch-form__statement-shortcut-icon">📄</span>
                <span>
                  <strong>Upload your bank statement instead</strong>
                  <span className="switch-form__statement-shortcut-sub"> — we'll read your details automatically (90 sec)</span>
                </span>
                <span className="switch-form__statement-shortcut-arrow">→</span>
              </button>

              <div className="switch-form__fields">
                <div>
                  <CurrencyInput
                    label="Your monthly debit order (home loan)"
                    placeholder="e.g. 10 500"
                    value={form.monthly}
                    onChange={set('monthly')}
                  />
                  <p className="switch-form__field-hint">The rand amount that leaves your account each month. Check your bank app — it usually shows as "Home Loan" or your bank's name.</p>
                  {submitTried && !form.monthly && <p style={{ color: '#dc2626', background: '#fee2e2', borderRadius: 6, padding: '5px 10px', fontSize: '0.8125rem', marginTop: 4 }}>Please enter your monthly home loan payment.</p>}
                  {monthlyTooHigh && <p style={{ color: '#b45309', background: '#fef3c7', borderRadius: 6, padding: '5px 10px', fontSize: '0.8125rem', marginTop: 4 }}>That seems high — double-check you haven't added extra zeros.</p>}
                  {monthlyNegative && <p style={{ color: '#dc2626', background: '#fee2e2', borderRadius: 6, padding: '5px 10px', fontSize: '0.8125rem', marginTop: 4 }}>Monthly payment must be a positive amount.</p>}
                </div>
                <div>
                  <label className="switch-form__label">
                    Interest rate
                    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                      <input
                        className="switch-form__input"
                        type="text"
                        inputMode="decimal"
                        placeholder={`e.g. ${(livePrime + 1).toFixed(2)}`}
                        value={form.rate}
                        onChange={set('rate')}
                        style={{ paddingRight: 36 }}
                      />
                      <span style={{ position: 'absolute', right: 12, color: 'var(--text-secondary)', fontSize: '0.9em', pointerEvents: 'none' }}>%</span>
                    </div>
                  </label>
                  <p className="switch-form__field-hint">We've pre-filled a typical rate. Change it if you know yours — check your debit-order letter or bank app.</p>
                  {rateOutOfRange && form.rate !== '' && <p style={{ color: '#dc2626', fontSize: '0.8125rem', marginTop: 4 }}>SA home loan rates are typically between 8% and 25% — please check your entry.</p>}
                </div>
                <label className="switch-form__label">
                  Years left on your bond <span style={{ fontWeight: 400, fontSize: '0.85em', opacity: 0.65 }}>(optional)</span>
                  <select
                    className="switch-form__input"
                    value={form.term}
                    onChange={set('term')}
                  >
                    <option value="5">5 years</option>
                    <option value="10">10 years</option>
                    <option value="15">15 years</option>
                    <option value="20">20 years</option>
                    <option value="25">25 years</option>
                    <option value="30">30 years</option>
                  </select>
                </label>
                <label className="switch-form__label">
                  Your current bank <span style={{ fontWeight: 400, fontSize: '0.85em', opacity: 0.65 }}>(optional)</span>
                  <select
                    className="switch-form__input"
                    value={form.bank}
                    onChange={set('bank')}
                  >
                    <option value="">Select…</option>
                    {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </label>
              </div>

              {form.monthly && parseFloat(form.monthly) > 0 && (
                <div className="switch-form__ready-nudge">
                  ✓ Amount captured — hit the button below to see what you could save
                </div>
              )}
              <div className="switch-form__reassurance">
                <div className="switch-form__reassurance-title">When you continue:</div>
                <ul className="switch-form__reassurance-list">
                  <li>We compare all 7 lenders instantly</li>
                  <li>A Bondly consultant reviews your details</li>
                  <li>We come back with real offers — usually within 48 hours</li>
                </ul>
                <div className="switch-form__reassurance-note">No obligation · No credit check at this stage</div>
              </div>
              <button
                type="submit"
                className="btn btn--lime switch-form__submit"
              >
                Continue →
              </button>
              <div className="switch-form__note">
                Approximate is fine. We model your bond the way your bank does.
              </div>
            </form>
          )}

          {mode === 'reading' && (
            <div className="switch-form switch-form--reading">
              <StatementReadingReveal onComplete={handleReadingDone} hasFile={false} />
            </div>
          )}

          {mode === 'reading-statement' && (
            <div className="switch-form switch-form--reading">
              <StatementReadingReveal onComplete={handleStatementReadingDone} hasFile={true} />
            </div>
          )}
        </div>
      </section>

      {/* Verdict / Statement / Confirm */}
      {(mode === 'verdict' || mode === 'statement' || mode === 'confirm' || mode === 'contact') && (
        <section className="switch-verdict-section">
          <div className="container">
            {mode === 'verdict' && (
              <SwitchVerdict
                income={income}
                balance={balance}
                currentRate={currentRate}
                termYears={termYears}
                onProceed={handleProceed}
                onSeeOffers={handleSeeOffers}
              />
            )}
            {mode === 'statement' && (
              <StatementUpload
                onProceed={handleStatementSubmit}
                onBack={() => setMode('verdict')}
                onSkip={handleProceed}
              />
            )}
            {mode === 'contact' && (
              <SwitchContact
                balance={balance}
                currentRate={currentRate}
                bank={form.bank}
                term={termYears}
                onDone={() => {
                  if (pendingFile) {
                    setMode('reading-statement');
                  } else {
                    setMode('confirm');
                    setProceeded(true);
                  }
                }}
              />
            )}
            {mode === 'confirm' && <SwitchConfirm balance={balance} currentRate={currentRate} />}
          </div>
        </section>
      )}

      {/* How it works — always shown below */}
      {mode === 'form' && (
        <section className="switch-how">
          <div className="container">
            <h2 className="switch-how__title">How the switch works</h2>
            <div className="switch-how__steps">
              {[
                { n: '1', title: 'Compare in 90 seconds', body: 'Upload your statement or enter your bond details. We compare all 7 banks instantly.', time: '90 sec' },
                { n: '2', title: 'Choose your best offer', body: 'See every bank\'s rate, monthly payment, and what you\'d save. No credit check.', time: '5 min' },
                { n: '3', title: 'We handle the paperwork', body: 'Our team submits to your chosen bank and coordinates the attorneys.', time: '4–8 wks' },
              ].map(s => (
                <div key={s.n} className="switch-how__step">
                  <div className="switch-how__step-num">{s.n}</div>
                  <div className="switch-how__step-time">{s.time}</div>
                  <div className="switch-how__step-title">{s.title}</div>
                  <div className="switch-how__step-body">{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}
    </div>
  );
}

// ── Contact capture (unauthenticated users) ───────────────────────────────────
function SwitchContact({ balance, currentRate, bank, term, onDone }) {
  const [form, setForm] = useState({ name: '', email: '', phone: '', propertyAddress: '', income: '', employmentType: '', maritalStatus: '', marriageType: '', idNumber: '' });
  const [status, setStatus] = useState('idle'); // idle | sending | done | error
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus('sending');
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          propertyAddress: form.propertyAddress || null,
          employment: form.employmentType,
          monthlyIncome: form.income ? parseFloat(form.income.replace(/[^0-9.]/g, '')) : undefined,
          idNumber: form.idNumber ? form.idNumber.replace(/\s/g, '') : null,
          maritalStatus: form.maritalStatus || null,
          source: 'switch_form',
          purpose: 'switch',
          currentBank: bank,
          currentBalance: balance,
          currentRate,
          currentTerm: term,
        }),
      });
    } catch (_) {/* fail silently — advisor will follow up */}
    setStatus('done');
    onDone();
  }

  return (
    <div className="switch-contact fade-in">
      <h2 className="switch-contact__title">Where should we send your results?</h2>
      <p className="switch-contact__sub">Enter your details and a Bondly consultant will be in touch within 48 hours with real offers from all 7 banks — no credit check, no obligation.</p>
      <p className="switch-contact__reassurance">Your details are only shared with banks that submit you an offer.</p>
      <form className="switch-contact__form" onSubmit={handleSubmit}>
        <label className="switch-form__label">
          Your name
          <input className="switch-form__input" type="text" placeholder="e.g. Sarah Dlamini" value={form.name} onChange={set('name')} autoFocus />
        </label>
        <label className="switch-form__label">
          Email address
          <input className="switch-form__input" type="email" placeholder="you@example.com" value={form.email} onChange={set('email')} required={!form.phone} />
        </label>
        <label className="switch-form__label">
          Phone number
          <input className="switch-form__input" type="tel" placeholder="e.g. 082 555 1234" value={form.phone} onChange={set('phone')} required={!form.email} />
        </label>
        <label className="switch-form__label">
          Property address <span className="switch-form__optional">(optional — helps us approach banks faster)</span>
          <input className="switch-form__input" type="text" placeholder="e.g. 14 Main Road, Cape Town" value={form.propertyAddress} onChange={set('propertyAddress')} />
        </label>
        <label className="switch-form__label">
          Monthly gross income (before tax)
          <input className="switch-form__input" type="text" inputMode="numeric" placeholder="e.g. 45 000" value={form.income} onChange={set('income')} />
        </label>
        <label className="switch-form__label">
          Employment type
          <select className="switch-form__input" value={form.employmentType} onChange={set('employmentType')}>
            <option value="">Select…</option>
            <option value="salaried">Salaried</option>
            <option value="self_employed">Self-employed</option>
            <option value="contractor">Contractor</option>
            <option value="retired">Retired</option>
          </select>
        </label>
        <label className="switch-form__label">
          Marital status <span className="switch-form__optional">(optional)</span>
          <select className="switch-form__input" value={form.maritalStatus} onChange={set('maritalStatus')}>
            <option value="">Select…</option>
            <option value="single">Single</option>
            <option value="married_cop">Married (in community of property)</option>
            <option value="married_anc">Married (ANC — out of community)</option>
            <option value="divorced">Divorced</option>
            <option value="widowed">Widowed</option>
          </select>
        </label>
        <label className="switch-form__label">
          SA ID number <span className="switch-form__optional">(optional — required for formal bank submission)</span>
          <input className="switch-form__input" type="text" inputMode="numeric" placeholder="e.g. 8001015009087" maxLength={13} value={form.idNumber} onChange={set('idNumber')} />
        </label>
        <button
          type="submit"
          className="btn btn--lime switch-form__submit"
          disabled={status === 'sending' || (!form.email && !form.phone)}
        >
          {status === 'sending' ? 'Submitting…' : 'Get my offers →'}
        </button>
        <p className="switch-form__note">No credit check · No obligation · POPIA compliant</p>
      </form>
    </div>
  );
}

// ── Confirm screen ────────────────────────────────────────────────────────────
const PIPELINE_STEPS = ['Upload Docs', 'Submitted', 'Under Review', 'Offers In', 'In Progress', 'Completed'];
const PIPELINE_ACTIVE = 1; // index of 'Submitted'

function SwitchConfirm({ balance, currentRate }) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fire the API call in the background — don't block the success screen on it
  useEffect(() => {
    const token = localStorage.getItem('bondly_token');
    fetch('/api/switch/proceed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ balance, currentRate }),
    }).catch(() => {/* silent — advisor follows up regardless */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = user?.name ? user.name.split(' ')[0] : null;

  return (
    <div className="switch-confirm fade-in">
      <div className="switch-confirm__icon">✓</div>
      <h2 className="switch-confirm__title">
        {firstName ? `You're in, ${firstName}.` : "You're in."}
      </h2>
      <p className="switch-confirm__body">
        We'll be in touch — here's what happens next:
      </p>

      <div className="switch-confirm__next-steps">
        <div className="switch-confirm__next-step">
          <span className="switch-confirm__next-num">1</span>
          <div>
            <strong>We compare all 7 lenders</strong>
            <span> — ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec, and SA Home Loans — against your current rate.</span>
          </div>
        </div>
        <div className="switch-confirm__next-step">
          <span className="switch-confirm__next-num">2</span>
          <div>
            <strong>A Bondly consultant reviews your file</strong>
            <span> and selects the strongest applications to submit.</span>
          </div>
        </div>
        <div className="switch-confirm__next-step">
          <span className="switch-confirm__next-num">3</span>
          <div>
            <strong>Real offers arrive — usually within 48 hours.</strong>
            <span> We handle all the paperwork from there.</span>
          </div>
        </div>
      </div>

      <p className="switch-confirm__calm">
        No obligation · Free to homeowners · We'll contact you to confirm your details before anything is submitted to a bank.
      </p>

      <div className="switch-pipeline">
        {PIPELINE_STEPS.map((label, i) => (
          <div
            key={label}
            className={`switch-pipeline__step${i < PIPELINE_ACTIVE ? ' done' : ''}${i === PIPELINE_ACTIVE ? ' current' : ''}`}
          >
            <div className="switch-pipeline__dot">
              {i < PIPELINE_ACTIVE ? '✓' : i + 1}
            </div>
            <div className="switch-pipeline__label">{label}</div>
            {i < PIPELINE_STEPS.length - 1 && <div className="switch-pipeline__line" />}
          </div>
        ))}
      </div>

      {user ? (
        <button className="btn btn--lime" onClick={() => navigate('/dashboard', { state: { tab: 'bond', bondSubTab: 'switch' } })}>
          Track progress in dashboard →
        </button>
      ) : (
        <button className="btn btn--lime" onClick={() => navigate('/register?intent=switch')}>
          Create a free account to track progress →
        </button>
      )}
    </div>
  );
}
