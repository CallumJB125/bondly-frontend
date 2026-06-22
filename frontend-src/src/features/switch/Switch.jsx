import { useState, useEffect, useRef } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { fmt, fmtRange, fmtShort } from '@bondly/ui/lib/format.js';
import { calcSavingsRange, calcSwitchOutcomes, calcSwitchScore } from '@bondly/ui/lib/finance.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { CurrencyInput } from '@bondly/ui/components/Input.jsx';
import { publicAlerts, parseStatementForPreapproval } from '../../lib/api.js';
import { PRIME_RATE, DEFAULT_RATE_SPREAD } from '@bondly/ui/lib/constants.js';
import { useRateSettings } from '@bondly/ui/lib/usePrimeRate.js';
import { trackAction } from '@bondly/ui/lib/session.js';
import LandingNav from '../landing/LandingNav.jsx';
import './Switch.css';

const PRIME = PRIME_RATE;
const BANKS = ['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'Investec', 'SA Home Loans'];

const ORIGINATION_URL = typeof window !== 'undefined'
  ? (import.meta.env?.VITE_ORIGINATION_URL || 'http://localhost:5174')
  : 'http://localhost:5174';

// Landing-grade footer (copied from Landing.jsx so /switch closes like /home)
function SwitchFooter() {
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

// ── Inline icons (currentColor, hairline) — never emoji ───────────────────────
const CheckIcon = ({ className = 'switch-ico' }) => (
  <svg className={className} width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
    <path d="M3 8.5l3.2 3.2L13 4.8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const DocIcon = ({ className = 'switch-ico' }) => (
  <svg className={className} width="18" height="18" viewBox="0 0 18 18" fill="none" aria-hidden="true">
    <path d="M4 1.5h6L14.5 6v10.5h-11V1.5z" stroke="currentColor" strokeWidth="1.4" strokeLinejoin="round" />
    <path d="M10 1.5V6h4.5M6 9.5h6M6 12.5h6" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const UploadIcon = ({ className = 'switch-ico' }) => (
  <svg className={className} width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
    <path d="M11 14V4m0 0L7 8m4-4l4 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    <path d="M4 14v3.5h14V14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

// Income bands shown on the lightweight qualify step (no exact rands at first
// touch). Each maps to a representative midpoint sent as monthlyIncome so the
// existing /api/leads contract (which expects a number) still validates.
const INCOME_BANDS = [
  { value: 'under_20k', label: 'Under R20 000', mid: 15000 },
  { value: '20_35k',    label: 'R20 000 – R35 000', mid: 27500 },
  { value: '35_50k',    label: 'R35 000 – R50 000', mid: 42500 },
  { value: '50_75k',    label: 'R50 000 – R75 000', mid: 62500 },
  { value: '75k_plus',  label: 'R75 000+', mid: 90000 },
];

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
        {done ? <CheckIcon className="switch-reading__icon-svg" /> : <div className="spinner switch-reading__spinner" />}
      </div>
      <div className="switch-reading__steps">
        {steps.map((s, i) => (
          <div key={s} className={`switch-reading__step ${i <= step ? 'switch-reading__step--done' : ''} ${i === step && !done ? 'switch-reading__step--active' : ''}`}>
            <span className="switch-reading__step-dot">{i < step || done ? <CheckIcon /> : i === step ? '◐' : '○'}</span>
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
            className="ls-btn ls-btn--primary switch-goodrate__btn"
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
            <div className="switch-goodrate__watch-done"><CheckIcon /> You're on the list. We'll be in touch the moment something changes.</div>
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

// Plain-language helper text under each score factor (grade 3–5 reading level)
const SCORE_COMPONENT_DESC = {
  rate:    'How much higher your rate is than the best rate.',
  term:    'How many years you still have left to pay.',
  balance: 'How much you still owe on your home.',
};

// "Your bond today" facts — lifted out of the verdict so the hero can show the
// customer's own numbers on the right, beside the headline.
function BondTodayFacts({ balance, currentRate, termYears = 20, livePrime }) {
  const out = calcSwitchOutcomes(balance, currentRate, livePrime, termYears);
  const rateGap = Math.max(0, currentRate - livePrime);
  return (
    <div className="switch-facts">
      <div className="switch-facts__title">Your bond today</div>
      <div className="switch-facts__grid">
        <div className="switch-facts__item">
          <span className="switch-facts__cap">What you still owe</span>
          <span className="switch-facts__val">{fmt(balance)}</span>
        </div>
        <div className="switch-facts__item">
          <span className="switch-facts__cap">Your interest rate</span>
          <span className="switch-facts__val">{currentRate.toFixed(2)}%</span>
          <span className={`switch-facts__tag ${rateGap > 0 ? 'switch-facts__tag--warn' : 'switch-facts__tag--ok'}`}>
            {rateGap > 0 ? `${rateGap.toFixed(2)}% above prime` : 'at / below prime'}
          </span>
        </div>
        <div className="switch-facts__item">
          <span className="switch-facts__cap">What you pay each month</span>
          <span className="switch-facts__val">≈ {fmt(out.currentPayment)}</span>
        </div>
        <div className="switch-facts__item">
          <span className="switch-facts__cap">Years left to pay</span>
          <span className="switch-facts__val">{termYears} {termYears === 1 ? 'year' : 'years'}</span>
        </div>
      </div>
      <div className="switch-facts__note">
        Bondly aims for a rate near prime ({livePrime.toFixed(2)}%) — lower than what you pay now. See how much that could help you below.
      </div>
    </div>
  );
}

function SwitchVerdict({ balance, currentRate, termYears = 20, livePrime, onLockIn, onSeeOffers }) {
  const [scoreOpen, setScoreOpen] = useState(false);
  const navigate = useNavigate();

  // Bondly's sharp-end achievable rate = prime (best mainstream spread). Using
  // prime keeps this estimate identical to the Landing reveal, which also
  // computes the saving against the live prime rate.
  const bestRate = livePrime;
  const out = calcSwitchOutcomes(balance, currentRate, bestRate, termYears);
  const saving = Math.round(out.monthlySaving);

  // Rand figures render as ±10% bands (snapped to R50) — the same
  // false-precision-avoiding treatment used on the Landing reveal.
  const range         = calcSavingsRange(out.monthlySaving);
  const annualRange   = calcSavingsRange(out.annualSaving);
  const termRange     = calcSavingsRange(out.lifetimeSaving);
  const interestRange = calcSavingsRange(out.interestSaved);

  // Path B — "debt-free sooner" label
  const monthsFaster = out.monthsSaved;
  const yearsFaster  = Math.floor(monthsFaster / 12);
  const remMonths    = monthsFaster % 12;
  const fasterLabel  = monthsFaster < 1
    ? '—'
    : monthsFaster < 12
      ? `${monthsFaster} month${monthsFaster === 1 ? '' : 's'}`
      : remMonths === 0
        ? `${yearsFaster} year${yearsFaster === 1 ? '' : 's'}`
        : `${yearsFaster}yr ${remMonths}mo`;
  const payoffYears = ((out.payoffMonths || out.termMonths) / 12);

  const rateGap = Math.max(0, currentRate - livePrime);
  const { score, components } = calcSwitchScore({ currentRate, prime: livePrime, balance, termYears, bestRate });

  // Plain-language value shown beside each score component
  const componentValue = (key) => {
    if (key === 'rate')    return rateGap > 0 ? `+${rateGap.toFixed(2)}% vs prime` : 'at prime';
    if (key === 'term')    return `${termYears} yr${termYears === 1 ? '' : 's'} left`;
    if (key === 'balance') return `${fmtShort(balance)} owing`;
    return '';
  };

  return (
    <div className="switch-verdict fade-in">
      <div className="switch-verdict__header">
        {saving > 0 ? (
          <>
            <div className="switch-verdict__pill"><CheckIcon /> Based on people like you we've helped save</div>
            <div className="ls-serif switch-verdict__headline switch-verdict__headline--range">{fmtRange(range.low, range.high)}<span>/mo</span></div>
            <div className="switch-verdict__sub">estimated range if you let Bondly handle your switch</div>
          </>
        ) : (
          <>
            <div className="switch-verdict__pill switch-verdict__pill--grey">Looking good</div>
            <div className="ls-serif switch-verdict__headline switch-verdict__headline--text">Your bond looks competitive</div>
            <div className="switch-verdict__sub">A free Bondly review will confirm whether there's room to improve</div>
          </>
        )}
      </div>

      {saving <= 0 && (
        <GoodRateBlock
          onProceed={onLockIn}
          onSeeOffers={onSeeOffers}
        />
      )}

      {saving > 0 && (
        <>
          {/* ① Bondly Switch Score — built from the user's own inputs, not the saving */}
          <div className="switch-score">
            <div className="switch-score__head">
              <div className="switch-score__label">Bondly Switch Score</div>
              <div className="switch-score__val">{score}<span>/100</span></div>
            </div>

            {/* Stacked bar — each segment's width is the points that factor adds */}
            <div className="switch-score__stack" role="img" aria-label={`Switch score ${score} out of 100`}>
              {components.map(c => (c.points > 0 ? (
                <span
                  key={c.key}
                  className={`switch-score__seg switch-score__seg--${c.key}`}
                  style={{ width: `${c.points}%` }}
                />
              ) : null))}
            </div>

            <div className="switch-score__caption">
              {score >= 70
                ? 'Strong candidate — there is real room for Bondly to improve your deal.'
                : score >= 45
                ? 'Good candidate — a switch is likely to move your numbers meaningfully.'
                : 'Worth a check — the gap is smaller, but Bondly will confirm if a better deal exists.'}
            </div>

            {/* Breakdown — exactly how the score adds up, from their own figures */}
            <div className="switch-score__components">
              {components.map(c => (
                <div className="switch-score__component" key={c.key}>
                  <div className="switch-score__component-head">
                    <span className={`switch-score__component-key switch-score__seg--${c.key}`} aria-hidden="true" />
                    <span className="switch-score__component-label">{c.label}</span>
                    <span className="switch-score__component-meta">{componentValue(c.key)}</span>
                    <span className="switch-score__component-pts">+{c.points}</span>
                  </div>
                  <p className="switch-score__component-desc">{SCORE_COMPONENT_DESC[c.key]}</p>
                  <span className="switch-score__component-track">
                    <span className={`switch-score__component-fill switch-score__seg--${c.key}`} style={{ width: `${Math.round(c.fill * 100)}%` }} />
                  </span>
                </div>
              ))}
            </div>

            <button
              type="button"
              className="switch-score__disclose"
              aria-expanded={scoreOpen}
              onClick={() => setScoreOpen(o => !o)}
            >
              Understand your score better
              <span className={`switch-score__disclose-icon${scoreOpen ? ' is-open' : ''}`} aria-hidden="true">
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none"><path d="M7 1v12M1 7h12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" /></svg>
              </span>
            </button>
            {scoreOpen && (
              <div className="switch-score__disclose-body">
                <p>Your score comes only from the details you gave us — not from the savings. Three things change it:</p>
                <ul>
                  <li><strong>Rate headroom:</strong> how much higher your {currentRate.toFixed(2)}% rate is than the ~{livePrime.toFixed(2)}% prime rate Bondly aims for. A bigger gap means more to save.</li>
                  <li><strong>Years remaining:</strong> the more years you have left to pay, the more a lower rate helps you.</li>
                  <li><strong>Bond size:</strong> the same drop in rate saves more money on a bigger loan.</li>
                </ul>
                <p><strong>To raise your number:</strong> a clean bank statement and proof of income help banks give you their best rate. You can add your statement in the next step.</p>
              </div>
            )}
          </div>

          {/* ② Two ways the same switch can work for you */}
          <div className="switch-paths">
            <h3 className="switch-paths__title">How Bondly can help you</h3>
            <div className="switch-paths__grid">
              {/* Path A — pay less each month */}
              <div className="switch-path switch-path--pay">
                <div className="switch-path__cap">Option 1 · Lower your monthly payment</div>
                <div className="switch-path__big">{fmtRange(range.low, range.high)}<small>/mo back in your pocket</small></div>
                <div className="switch-path__rows">
                  <div className="switch-path__row">
                    <span>New repayment</span>
                    <strong>≈ {fmt(out.newPayment)} <em>from {fmt(out.currentPayment)}</em></strong>
                  </div>
                  <div className="switch-path__row">
                    <span>Saved per year</span>
                    <strong>{fmtRange(annualRange.low, annualRange.high)}</strong>
                  </div>
                  <div className="switch-path__row">
                    <span>Saved over {termYears} years</span>
                    <strong>{fmtRange(termRange.low, termRange.high)}</strong>
                  </div>
                </div>
                <div className="switch-path__foot">Same {termYears}-year term — you simply pay less each month.</div>
              </div>

              {/* Path B — finish sooner */}
              {monthsFaster > 0 && (
                <div className="switch-path switch-path--sooner">
                  <div className="switch-path__cap">Option 2 · Finish your bond sooner</div>
                  <div className="switch-path__big">{fasterLabel}<small>debt-free sooner</small></div>
                  <div className="switch-path__rows">
                    <div className="switch-path__row">
                      <span>You keep paying</span>
                      <strong>≈ {fmt(out.currentPayment)} <em>/mo, same as today</em></strong>
                    </div>
                    <div className="switch-path__row">
                      <span>Interest you avoid</span>
                      <strong>{fmtRange(interestRange.low, interestRange.high)}</strong>
                    </div>
                    <div className="switch-path__row">
                      <span>Bond cleared in</span>
                      <strong>{payoffYears.toFixed(1)} yrs <em>vs {termYears}</em></strong>
                    </div>
                  </div>
                  <div className="switch-path__foot">Same payment, lower rate — more of every rand kills the balance.</div>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      <div className="switch-verdict__disclaimer">
        Estimate only — actual savings depend on your full credit and income profile. Bondly will confirm your outcome after reviewing your file. No credit check at this stage.
      </div>

      {saving > 0 && (
        <div className="switch-verdict__cta-area">
          <button
            className="ls-btn ls-btn--primary switch-verdict__cta"
            onClick={onLockIn}
          >
            Lock in my estimate →
          </button>
          <div className="switch-verdict__cta-note">Takes 20 seconds · email or phone only · no credit check</div>
        </div>
      )}

      {/* Financial helper — clearly secondary side-door, account requirement disclosed up front */}
      <div className="switch-verdict__optimize">
        <div className="switch-verdict__optimize-label">Not ready to proceed? Strengthen your profile first</div>
        <div className="switch-verdict__optimize-desc">
          Our free financial helper analyses your spending and shows exactly what banks flag before you apply. <strong>This needs a free Bondly account.</strong>
        </div>
        <button
          className="switch-verdict__optimize-btn"
          onClick={() => navigate('/optimize')}
        >
          Strengthen my profile (free account) →
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
        <div className="switch-statement__icon"><DocIcon className="switch-statement__icon-svg" /></div>
        <h2 className="ls-serif switch-statement__title">Want firmer, confirmed numbers?</h2>
        <p className="switch-statement__body">
          Optional — add your latest bank statement (PDF) and banks can confirm an exact offer instead of an estimate. You can skip this and a consultant will follow up either way.
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
              <span className="switch-statement__file-icon"><CheckIcon /></span>
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
              <div className="switch-statement__dropzone-icon"><UploadIcon className="switch-statement__dropzone-icon-svg" /></div>
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
            className="ls-btn ls-btn--primary switch-statement__cta"
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
const DEMO_VALUES = { balance: '1200000', rate: String(PRIME + 1.75), term: '20', bank: 'ABSA' };

// Bond data + correlationId are handed from the verdict's "Lock in my estimate"
// to the dedicated /switch/apply info-gathering route via sessionStorage so the
// staged lead keeps stitching across the route change.
const APPLY_KEY = 'bondly_switch_apply';
function readApplyPayload() {
  try {
    const raw = sessionStorage.getItem(APPLY_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

export default function Switch({ demo = false, apply = false }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { primeRate: livePrime } = useRateSettings();

  // On the dedicated apply route, the bond data is carried from the verdict. If
  // someone lands here directly (refresh / deep-link) with nothing stored, send
  // them back to the estimate so they always start from a real number.
  const applyPayload = apply ? readApplyPayload() : null;
  useEffect(() => {
    if (apply && !applyPayload) { navigate('/switch', { replace: true }); return; }
    if (apply) window.scrollTo(0, 0);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Call getInitialForm exactly once via ref so sessionStorage is only consumed once
  const initialFormRef = useRef(null);
  if (initialFormRef.current === null) {
    initialFormRef.current = (() => {
      if (demo) return { ...DEMO_VALUES, prime: '' };
      if (apply) {
        const p = applyPayload || {};
        return {
          balance: p.balance != null ? String(p.balance) : '',
          rate: p.rate != null ? String(p.rate) : String(PRIME + DEFAULT_RATE_SPREAD),
          term: p.term != null ? String(p.term) : '20',
          bank: p.bank || '',
          prime: p.prime != null ? String(p.prime) : '',
        };
      }
      const base = { balance: '', rate: String(PRIME + DEFAULT_RATE_SPREAD), term: '20', bank: '', prime: '' };
      try {
        const stored = sessionStorage.getItem('bondly_hero_switch');
        if (stored) {
          // The Landing/Hook calculators capture the OUTSTANDING BALANCE directly,
          // so we carry it straight through — no lossy monthly→balance round-trip.
          // `prime` is the exact rate the Landing reveal used; reuse it so the
          // range here reproduces the figure the user already saw.
          const { balance, rate, termYears, prime } = JSON.parse(stored);
          sessionStorage.removeItem('bondly_hero_switch');
          return {
            balance: balance > 0 ? String(Math.round(balance)) : base.balance,
            rate: rate != null ? String(rate) : base.rate,
            term: termYears != null ? String(termYears) : base.term,
            bank: base.bank,
            prime: prime != null ? String(prime) : '',
          };
        }
      } catch {}
      // URL query params fallback: ?balance=1200000&rate=11.75&term=20&prime=11.25
      try {
        const params = new URLSearchParams(window.location.search);
        const balance = parseFloat(params.get('balance') || '0');
        const rate = params.get('rate');
        const termYears = params.get('term');
        const prime = params.get('prime');
        if (balance > 0 || rate || termYears) {
          return {
            balance: balance > 0 ? String(Math.round(balance)) : base.balance,
            rate: rate ? String(rate) : base.rate,
            term: termYears ? String(termYears) : base.term,
            bank: base.bank,
            prime: prime ? String(prime) : '',
          };
        }
      } catch {}
      return base;
    })();
  }
  const initialForm = initialFormRef.current;

  // Auto-show estimate when user arrives with carried-over numbers
  const prefilled = !demo && parseFloat(initialForm.balance) > 0 && !!initialForm.rate;
  // On the apply route the verdict is already behind us — drop straight into the
  // info-gathering ladder (logged-in users skip the email rung, as before).
  const initialMode = apply
    ? (user ? 'qualify' : 'lockin')
    : demo ? 'verdict' : prefilled ? 'verdict' : 'form';

  // Progressive ladder modes:
  // 'form' | 'reading' | 'verdict' | 'lockin' | 'qualify' | 'statement'
  //   | 'reading-statement' | 'formal' | 'confirm'
  const [mode, setMode] = useState(initialMode);
  const [form, setForm] = useState(initialForm);
  const [proceeded, setProceeded] = useState(false);
  const [pendingFile, setPendingFile] = useState(null); // optional statement file for accelerator
  const [submitTried, setSubmitTried] = useState(false);

  // Stable id stitching every staged lead POST for this visitor (lock-in →
  // qualify → formal) so the backend can merge them into one lead later
  // without a frontend change. Demo never posts.
  const correlationRef = useRef(null);
  if (correlationRef.current === null) {
    correlationRef.current = (() => {
      if (apply && applyPayload?.correlationId) return applyPayload.correlationId;
      try { return crypto.randomUUID(); } catch { return `lead_${Date.now()}_${Math.round(Math.random() * 1e9)}`; }
    })();
  }

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  function handleSubmit(e) {
    e.preventDefault();
    setSubmitTried(true);
    const balanceEmpty = !form.balance || (parseFloat(String(form.balance).replace(/\s/g, '')) || 0) <= 0;
    if (balanceEmpty || rateOutOfRange || balanceTooHigh || balanceNegative) return;
    setMode('reading');
  }

  // Original path: form → reading → verdict
  function handleReadingDone() {
    setMode('verdict');
  }

  // Statement parse path: statement → reading-statement → formal
  function handleStatementReadingDone() {
    setMode('formal');
  }

  // Primary ladder entry from the verdict. Hand the bond data + correlationId to
  // the dedicated /switch/apply route, which owns the whole info-gathering flow
  // (no "is your bank giving you the best rate?" hero — just collect & quote).
  function handleLockIn() {
    trackAction('switch_verdict_lockin_clicked');
    try {
      sessionStorage.setItem(APPLY_KEY, JSON.stringify({
        balance: String(balance),
        rate: String(currentRate),
        term: String(termYears),
        bank: form.bank,
        prime: String(estimatePrime),
        correlationId: correlationRef.current,
      }));
    } catch {}
    navigate('/switch/apply');
  }

  // Optional accelerator — jump straight to the statement step.
  function handleSeeOffers() {
    setMode('statement');
  }

  // Called when StatementUpload has a file: lead is already captured at
  // lock-in, so go straight to the reading animation (no second lead POST).
  function handleStatementSubmit(file) {
    trackAction('switch_statement_added');
    setPendingFile(file);
    setMode('reading-statement');
  }

  // Outstanding balance is the single source of truth — captured directly by the
  // Landing/Hook calculators and entered directly here. No monthly→balance
  // round-trip (the monthly repayment is a DERIVED, displayed figure instead).
  const balanceInput = Math.max(0, Math.min(parseFloat(form.balance) || 0, 50_000_000));
  const currentRate  = parseFloat(form.rate) || PRIME + DEFAULT_RATE_SPREAD;
  const termYears    = parseFloat(form.term) || 20;
  // Prefer the prime carried from the Landing reveal; fall back to live prime
  // for direct /switch entry. Guarantees the range matches what the user saw.
  const estimatePrime = parseFloat(form.prime) || livePrime;
  const balanceTooHigh = (parseFloat(form.balance) || 0) > 50_000_000;
  const balanceNegative = form.balance !== '' && (parseFloat(form.balance) || 0) <= 0;
  const rateOutOfRange = currentRate <= 0 || currentRate > 30;
  const balance      = balanceInput > 0 ? balanceInput : 1_200_000;

  // In verdict mode the hero becomes a 1:2 two-column — headline on the left,
  // the customer's "Your bond today" facts on the right. Only when there's a
  // real saving to talk about (the good-rate branch has no facts panel).
  const heroSaving = Math.round(
    calcSwitchOutcomes(balance, currentRate, estimatePrime, termYears).monthlySaving
  );
  const showHeroFacts = mode === 'verdict' && heroSaving > 0;

  // Staged lead capture. Each rung enriches the same lead via correlationId.
  // Demo never posts. Fire-and-forget — an advisor follows up regardless.
  async function postLead(extra) {
    if (demo) return;
    try {
      await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          correlationId: correlationRef.current,
          purpose: 'switch',
          currentBank: form.bank,
          currentBalance: balance,
          currentRate,
          currentTerm: termYears,
          ...extra,
        }),
      });
    } catch (_) {/* fail silently — advisor will follow up */}
  }

  return (
    <div className="switch-page ls-page">
      <LandingNav />
      {/* Hero */}
      <section className="switch-hero">
        <div className={`ls-wrap switch-hero__inner${
          apply
            ? ' switch-hero__inner--apply'
            : (mode === 'form' || mode === 'reading' || mode === 'reading-statement')
              ? ''
              : showHeroFacts
                ? ' switch-hero__inner--facts'
                : ' switch-hero__inner--solo'
        }`}>
          <div className="switch-hero__copy">
            {apply ? (
              <div className="ls-eyebrow switch-hero__eyebrow">Lock in your estimate · get your quote</div>
            ) : (
              <>
                <div className="ls-eyebrow switch-hero__eyebrow">Free bond switch comparison</div>
                <h1 className="ls-serif switch-hero__title">Is your bank giving you the best rate?</h1>
                <p className="switch-hero__sub">
                  Most homeowners could save on their bond rate, but are never given the opportunity. See how much you could save based on your details.
                </p>
              </>
            )}
            <div className="switch-hero__trust">
              <span><CheckIcon /> Get pre-approved in minutes</span>
              <span><CheckIcon /> Paperwork handled for you</span>
              <span><CheckIcon /> Completely free</span>
            </div>
          </div>

          {mode === 'form' && (
            <form className="switch-form" onSubmit={handleSubmit}>
              <div className="switch-form__heading">How much is left on your home loan?</div>
              <div className="switch-form__intro">
                Enter your outstanding balance and rate — we'll show you exactly where your bond stands today and the two ways a switch could change it.
              </div>

              <button
                type="button"
                className="switch-form__statement-shortcut"
                onClick={() => setMode('statement')}
              >
                <span className="switch-form__statement-shortcut-icon"><DocIcon /></span>
                <span>
                  <strong>Upload your bank statement instead</strong>
                  <span className="switch-form__statement-shortcut-sub"> — we'll read your details automatically (90 sec)</span>
                </span>
                <span className="switch-form__statement-shortcut-arrow">→</span>
              </button>

              <div className="switch-form__fields">
                <div>
                  <CurrencyInput
                    label="Outstanding balance on your bond"
                    placeholder="e.g. 1 200 000"
                    value={form.balance}
                    onChange={set('balance')}
                  />
                  <p className="switch-form__field-hint">Roughly what you still owe — check your latest home-loan statement or banking app. An estimate is fine.</p>
                  {submitTried && !form.balance && <p className="switch-form__msg switch-form__msg--err">Please enter your outstanding balance.</p>}
                  {balanceTooHigh && <p className="switch-form__msg switch-form__msg--warn">That seems high — double-check you haven't added extra zeros.</p>}
                  {balanceNegative && <p className="switch-form__msg switch-form__msg--err">Balance must be a positive amount.</p>}
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
                  {rateOutOfRange && form.rate !== '' && <p className="switch-form__msg switch-form__msg--err">SA home loan rates are typically between 8% and 25% — please check your entry.</p>}
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

              {form.balance && parseFloat(form.balance) > 0 && (
                <div className="switch-form__ready-nudge">
                  <CheckIcon /> Balance captured — hit the button below to see your full breakdown
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
                className="ls-btn ls-btn--primary switch-form__submit"
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

          {showHeroFacts && (
            <div className="switch-hero__facts">
              <BondTodayFacts
                balance={balance}
                currentRate={currentRate}
                termYears={termYears}
                livePrime={estimatePrime}
              />
            </div>
          )}
        </div>
      </section>

      {/* Verdict / ladder steps / Confirm */}
      {(mode === 'verdict' || mode === 'lockin' || mode === 'qualify' || mode === 'statement' || mode === 'formal' || mode === 'confirm') && (
        <section className="switch-verdict-section">
          <div className="ls-wrap">
            {mode === 'verdict' && (
              <SwitchVerdict
                balance={balance}
                currentRate={currentRate}
                termYears={termYears}
                livePrime={estimatePrime}
                onLockIn={handleLockIn}
                onSeeOffers={handleSeeOffers}
              />
            )}
            {mode === 'lockin' && (
              <LockInStep
                defaultEmail={user?.email || ''}
                onSubmit={async ({ email, phone }) => {
                  trackAction('switch_lockin_submitted');
                  await postLead({ email, phone, source: 'switch_lockin', stage: 'lead' });
                  setMode('qualify');
                }}
              />
            )}
            {mode === 'qualify' && (
              <QualifyStep
                onSubmit={async ({ incomeBand, monthlyIncome, employment }) => {
                  trackAction('switch_qualify_submitted', { incomeBand });
                  await postLead({ incomeBand, monthlyIncome, employment, source: 'switch_qualify', stage: 'qualified' });
                  setMode('statement');
                }}
                onSkip={() => { setMode('confirm'); setProceeded(true); }}
              />
            )}
            {mode === 'statement' && (
              <StatementUpload
                onProceed={handleStatementSubmit}
                onBack={() => setMode('qualify')}
                onSkip={() => { setMode('confirm'); setProceeded(true); }}
              />
            )}
            {mode === 'formal' && (
              <FormalDetailsStep
                onSubmit={async (details) => {
                  trackAction('switch_formal_submitted');
                  await postLead({ ...details, source: 'switch_formal', stage: 'submission_ready' });
                  setMode('confirm');
                  setProceeded(true);
                }}
                onSkip={() => { setMode('confirm'); setProceeded(true); }}
              />
            )}
            {mode === 'confirm' && <SwitchConfirm balance={balance} currentRate={currentRate} />}
          </div>
        </section>
      )}

      {/* How it works — always shown below */}
      {mode === 'form' && (
        <section className="switch-how">
          <div className="ls-wrap">
            <div className="switch-how__eyebrow">How it works</div>
            <h2 className="ls-serif switch-how__title">Switching is simpler than you think</h2>
            <div className="switch-how__steps">
              {[
                { n: '1', title: 'Compare in 90 seconds', body: 'Upload your statement or enter your bond details. We compare all 7 banks instantly.', time: '90 sec' },
                { n: '2', title: 'Choose your best offer', body: 'See every bank\'s rate, monthly payment, and what you\'d save. No credit check.', time: '5 min' },
                { n: '3', title: 'We handle the paperwork', body: 'Our team submits to your chosen bank and coordinates the attorneys.', time: '4–8 wks' },
              ].map(s => (
                <div key={s.n} className="switch-how__step">
                  <div className="switch-how__step-num">{s.n}</div>
                  <div className="switch-how__step-time">{s.time}</div>
                  <div className="ls-serif switch-how__step-title">{s.title}</div>
                  <div className="switch-how__step-body">{s.body}</div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      <SwitchFooter />
    </div>
  );
}

// ── Ladder step A: Lock in (email/phone only) ─────────────────────────────────
function LockInStep({ defaultEmail = '', onSubmit }) {
  const [email, setEmail] = useState(defaultEmail);
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState('idle');
  const canSubmit = !!email || !!phone;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit || status === 'sending') return;
    setStatus('sending');
    await onSubmit({ email, phone });
  }

  return (
    <div className="switch-contact switch-step fade-in">
      <div className="switch-step__rung">Step 1 of 3 · Lock in your estimate</div>
      <h2 className="ls-serif switch-contact__title">Lock in your estimate</h2>
      <p className="switch-contact__sub">Just an email or phone number to save your estimate and let a Bondly consultant follow up. No credit check, no obligation.</p>
      <p className="switch-contact__reassurance">Your details are only shared with banks that submit you an offer.</p>
      <form className="switch-contact__form" onSubmit={submit}>
        <label className="switch-form__label">
          Email address
          <input className="switch-form__input" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required={!phone} autoFocus />
        </label>
        <label className="switch-form__label">
          Phone number
          <input className="switch-form__input" type="tel" placeholder="e.g. 082 555 1234" value={phone} onChange={e => setPhone(e.target.value)} required={!email} />
        </label>
        <button type="submit" className="ls-btn ls-btn--primary switch-form__submit" disabled={status === 'sending' || !canSubmit}>
          {status === 'sending' ? 'Saving…' : 'Lock in my estimate →'}
        </button>
        <p className="switch-form__note">No credit check · No obligation · POPIA compliant</p>
      </form>
    </div>
  );
}

// ── Ladder step B: Light qualify (income band + employment) ───────────────────
function QualifyStep({ onSubmit, onSkip }) {
  const [incomeBand, setIncomeBand] = useState('');
  const [employment, setEmployment] = useState('');
  const [status, setStatus] = useState('idle');
  const canSubmit = !!incomeBand && !!employment;

  async function submit(e) {
    e.preventDefault();
    if (!canSubmit || status === 'sending') return;
    setStatus('sending');
    const band = INCOME_BANDS.find(b => b.value === incomeBand);
    await onSubmit({ incomeBand, monthlyIncome: band?.mid, employment });
  }

  return (
    <div className="switch-contact switch-step fade-in">
      <div className="switch-step__rung">Step 2 of 3 · A couple of quick questions</div>
      <h2 className="ls-serif switch-contact__title">Help us match the right banks</h2>
      <p className="switch-contact__sub">Two quick questions so we approach the lenders most likely to approve you. No exact figures needed yet.</p>
      <form className="switch-contact__form" onSubmit={submit}>
        <label className="switch-form__label">
          Monthly income (before tax)
          <select className="switch-form__input" value={incomeBand} onChange={e => setIncomeBand(e.target.value)} required autoFocus>
            <option value="">Select a range…</option>
            {INCOME_BANDS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
          </select>
        </label>
        <label className="switch-form__label">
          Employment type
          <select className="switch-form__input" value={employment} onChange={e => setEmployment(e.target.value)} required>
            <option value="">Select…</option>
            <option value="salaried">Salaried</option>
            <option value="self_employed">Self-employed</option>
            <option value="contractor">Contractor</option>
            <option value="retired">Retired</option>
          </select>
        </label>
        <button type="submit" className="ls-btn ls-btn--primary switch-form__submit" disabled={status === 'sending' || !canSubmit}>
          {status === 'sending' ? 'Saving…' : 'Continue →'}
        </button>
        <button type="button" className="switch-step__skip" onClick={onSkip}>Skip for now →</button>
        <p className="switch-form__note">No credit check · No obligation · POPIA compliant</p>
      </form>
    </div>
  );
}

// ── Ladder step D: Formal details (only at final bank submission) ─────────────
function FormalDetailsStep({ onSubmit, onSkip }) {
  const [form, setForm] = useState({ name: '', idNumber: '', income: '', propertyAddress: '' });
  const [status, setStatus] = useState('idle');
  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }));

  async function submit(e) {
    e.preventDefault();
    if (status === 'sending') return;
    setStatus('sending');
    await onSubmit({
      name: form.name || undefined,
      idNumber: form.idNumber ? form.idNumber.replace(/\s/g, '') : null,
      monthlyIncome: form.income ? parseFloat(form.income.replace(/[^0-9.]/g, '')) : undefined,
      propertyAddress: form.propertyAddress || null,
    });
  }

  return (
    <div className="switch-contact switch-step fade-in">
      <div className="switch-step__rung">Final step · Ready to submit to banks</div>
      <h2 className="ls-serif switch-contact__title">Final details before we submit</h2>
      <p className="switch-contact__sub">Banks legally need these to make you a formal offer. We only share them with lenders that come back with a deal.</p>
      <form className="switch-contact__form" onSubmit={submit}>
        <label className="switch-form__label">
          Your full name
          <input className="switch-form__input" type="text" placeholder="e.g. Sarah Dlamini" value={form.name} onChange={set('name')} autoFocus />
        </label>
        <label className="switch-form__label">
          SA ID number
          <input className="switch-form__input" type="text" inputMode="numeric" placeholder="e.g. 8001015009087" maxLength={13} value={form.idNumber} onChange={set('idNumber')} />
        </label>
        <label className="switch-form__label">
          Monthly gross income (before tax)
          <input className="switch-form__input" type="text" inputMode="numeric" placeholder="e.g. 45 000" value={form.income} onChange={set('income')} />
        </label>
        <label className="switch-form__label">
          Property address <span className="switch-form__optional">(helps us approach banks faster)</span>
          <input className="switch-form__input" type="text" placeholder="e.g. 14 Main Road, Cape Town" value={form.propertyAddress} onChange={set('propertyAddress')} />
        </label>
        <button type="submit" className="ls-btn ls-btn--primary switch-form__submit" disabled={status === 'sending'}>
          {status === 'sending' ? 'Submitting…' : 'Submit to banks →'}
        </button>
        <button type="button" className="switch-step__skip" onClick={onSkip}>I'll send these later →</button>
        <p className="switch-form__note">No credit check now · POPIA compliant · You confirm before anything is submitted</p>
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

  // Fire the API call in the background — don't block the success screen on it.
  // /api/switch/proceed is auth-only: it creates a switchDeal record for the
  // logged-in dashboard tracker. An anonymous switcher's lead + admin Telegram
  // alert are already captured via the public /api/leads call in the contact
  // step, so firing this while signed out just produces a doomed 401. Only call
  // it when actually authenticated.
  useEffect(() => {
    const token = localStorage.getItem('bondly_token');
    if (!token) return;
    fetch('/api/switch/proceed', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ balance, currentRate }),
    }).catch(() => {/* silent — advisor follows up regardless */});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const firstName = user?.name ? user.name.split(' ')[0] : null;

  return (
    <div className="switch-confirm fade-in">
      <div className="switch-confirm__icon"><CheckIcon className="switch-confirm__icon-svg" /></div>
      <h2 className="ls-serif switch-confirm__title">
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
        <button className="ls-btn ls-btn--primary" onClick={() => navigate('/dashboard', { state: { tab: 'bond', bondSubTab: 'switch' } })}>
          Track progress in dashboard →
        </button>
      ) : (
        <button className="ls-btn ls-btn--primary" onClick={() => navigate('/register?intent=switch')}>
          Create a free account to track progress →
        </button>
      )}
    </div>
  );
}
