import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

import { Upload, BarChart2, ArrowRight } from 'lucide-react';
import { calcAffordability, calcMonthly } from '../../lib/finance.js';
import { fmt, fmtPct } from '../../lib/format.js';
import { trackAction } from '../../lib/session.js';
import { PRIME_RATE, STRESS_RATE } from '../../lib/constants.js';
import { useRateSettings } from '../../lib/usePrimeRate.js';
import { pollParseJob, leads as leadsApi } from '../../lib/api.js';
import { CurrencyInput } from '../../components/Input.jsx';
import StatementLoader from '../../components/StatementLoader.jsx';
import RatesExplained from '../../components/RatesExplained.jsx';
import { Link } from 'react-router-dom';
import OriginationNav from '../../components/OriginationNav.jsx';
import './MortgageReadiness.css';

export default function MortgageReadiness() {
  useEffect(() => {
    document.title = 'Affordability Calculator | Bondly Home';
    return () => { document.title = 'Bondly Home | Get Your First Home Loan in South Africa'; };
  }, []);

  const navigate = useNavigate();
  const [mode, setMode] = useState('manual'); // 'manual' | 'statement'
  const [income, setIncome] = useState('');
  const [price, setPrice]   = useState('');

  // Statement path state
  const fileRef = useRef(null);
  const [stmtFile, setStmtFile]     = useState(null);
  const [stmtResult, setStmtResult] = useState(null);
  const [loading, setLoading]       = useState(false);
  const [loadingMsg, setLoadingMsg] = useState(null);
  const [slow, setSlow]             = useState(false);
  const [error, setError]           = useState('');

  // Live prime + stress from the backend's authoritative settings
  const _rateSettings = useRateSettings();
  const livePrime  = _rateSettings.primeRate  || PRIME_RATE;
  const liveStress = _rateSettings.stressRate || STRESS_RATE;
  const [showRatesModal, setShowRatesModal] = useState(false);

  // Lead capture
  const [showLeadCapture, setShowLeadCapture] = useState(false);
  const [leadName, setLeadName]       = useState('');
  const [leadEmail, setLeadEmail]     = useState('');
  const [leadPhone, setLeadPhone]     = useState('');
  const [leadEmpType, setLeadEmpType] = useState('salaried');
  const [leadDeposit, setLeadDeposit] = useState('');
  const [leadSubmitting, setLeadSubmitting] = useState(false);

  const inc = parseFloat(income) || 0;
  const pr  = parseFloat(price)  || 0;
  const afford = inc > 0 ? calcAffordability(inc, pr || 0) : null;
  const monthlyEst = afford && !pr ? calcMonthly(afford.maxBond, livePrime, 20) : 0;

  const detectedIncome = stmtResult?.income?.monthlyAmount || 0;
  const stmtAfford = detectedIncome > 0 ? calcAffordability(detectedIncome, 0) : null;

  async function analyseStatement() {
    if (!stmtFile) return;
    setLoading(true); setError(''); setStmtResult(null); setSlow(false); setLoadingMsg(null);
    const slowTimer = setTimeout(() => setSlow(true), 90000);
    try {
      const fd = new FormData();
      fd.append('statement', stmtFile);
      const tok = localStorage.getItem('bondly_token');
      const headers = tok ? { Authorization: 'Bearer ' + tok } : {};
      const res  = await fetch('/api/qualify/from-statement?async=1', { method: 'POST', body: fd, headers });
      const initJ = await res.json();
      if (!initJ.success) throw new Error(initJ.error || 'Could not analyse');
      if (initJ.data?.status === 'done' && initJ.data?.result) {
        setStmtResult(initJ.data.result);
        return;
      }
      const result = await pollParseJob(initJ.data.jobId, { onProgress: p => setLoadingMsg(p?.message || null) });
      setStmtResult(result);
      trackAction('mortgage_readiness_stmt_done', { detected: !!result?.income?.detected });
    } catch (e) {
      setError(e.message || 'Could not parse statement — try entering manually');
    } finally {
      clearTimeout(slowTimer);
      setLoading(false);
      setSlow(false);
    }
  }

  const hasManualResult   = mode === 'manual' && afford !== null;
  const hasStatementResult = mode === 'statement' && stmtResult !== null;
  const hasResult = hasManualResult || hasStatementResult;

  const displayMaxBond = hasStatementResult
    ? (stmtResult?.qualification?.maxBond || stmtAfford?.maxBond || 0)
    : afford?.maxBond || 0;

  // Always derive repayment from the same bond amount shown as the headline,
  // so the two figures are never contradictory.
  const displayBondForRepayment = hasStatementResult
    ? (stmtResult?.qualification?.maxBond || stmtAfford?.maxBond || 0)
    : pr > 0 ? Math.min(pr, displayMaxBond) : displayMaxBond;
  const displayMonthly = displayBondForRepayment > 0 ? calcMonthly(displayBondForRepayment, livePrime, 20) : 0;

  function goToPreapproval() {
    trackAction('mortgage_readiness_preapproval_cta');
    setShowLeadCapture(true);
  }

  async function submitLead(e) {
    e.preventDefault();
    setLeadSubmitting(true);
    try {
      await leadsApi.submit({
        name: leadName,
        email: leadEmail,
        phone: leadPhone,
        employment: leadEmpType,
        income: mode === 'manual' ? inc : (stmtResult?.income?.monthlyAmount || 0),
        source: 'mortgage-readiness',
        maxBond: displayMaxBond,
        propertyPrice: pr || undefined,
        deposit: leadDeposit ? parseFloat(leadDeposit.replace(/[^0-9.]/g, '')) : 0,
      });
    } catch {}
    const params = new URLSearchParams();
    if (mode === 'manual') {
      if (inc) params.set('income', String(inc));
      if (pr)  params.set('price', String(pr));
    } else if (stmtResult) {
      if (stmtResult.income?.monthlyAmount) params.set('income', String(stmtResult.income.monthlyAmount));
      try { sessionStorage.setItem('bondly_stmt_result', JSON.stringify(stmtResult)); } catch {}
    }
    setLeadSubmitting(false);
    setShowLeadCapture(false);
    navigate('/preapproval' + (params.toString() ? '?' + params.toString() : ''));
  }

  function goToOptimize() {
    if (stmtResult) { try { sessionStorage.setItem('bondly_optimizer_from_pa', JSON.stringify(stmtResult)); } catch {} }
    trackAction('mortgage_readiness_optimize_cta');
    navigate('/optimize');
  }

  return (
    <>
      <OriginationNav />
      <div className="mr-page">
        <div className="container mr-inner">

          {/* Header */}
          <div className="mr-header">
            <div className="section-pill">Buying a home</div>
            <h1 className="mr-header__title">What home loan<br />can I afford?</h1>
            <p className="mr-header__sub">
              Enter your income or upload a bank statement. We calculate how much you could borrow the way banks do — instantly, for free. We'll also tell you if you're better off building first.
            </p>
          </div>

          {/* Mode toggle */}
          <div className="mr-toggle">
            <button
              className={`mr-toggle__btn ${mode === 'manual' ? 'mr-toggle__btn--active' : ''}`}
              onClick={() => { setMode('manual'); setStmtResult(null); setError(''); }}
            >
              Enter manually
            </button>
            <button
              className={`mr-toggle__btn ${mode === 'statement' ? 'mr-toggle__btn--active' : ''}`}
              onClick={() => setMode('statement')}
            >
              Upload bank statement
              <span className="mr-toggle__badge">More accurate</span>
            </button>
          </div>

          {/* Manual path */}
          {mode === 'manual' && (
            <div className="mr-form fade-in">
              <p className="mr-form__context">
                This is a free instant estimate — no sign-up needed. Want a full pre-approval with bank offers? You can do that next.
              </p>
              <div className="mr-form__fields">
                <div className="mr-form__field">
                  <CurrencyInput
                    label="Monthly salary (before tax)"
                    value={income}
                    onChange={e => setIncome(e.target.value)}
                    placeholder="e.g. 45 000"
                    onBlur={() => income && trackAction('mr_income_entered', { value: inc })}
                  />
                  <p className="mr-form__hint">Use the gross amount from your payslip — before deductions. If your take-home is R 22 000, your gross is typically R 28 000–R 32 000.</p>
                </div>
                <div className="mr-form__field">
                  <CurrencyInput
                    label={<>Property price <span className="mr-form__opt">(optional — leave blank to find your budget)</span></>}
                    value={price}
                    onChange={e => setPrice(e.target.value)}
                    placeholder="e.g. 2 500 000"
                  />
                </div>
              </div>
              {!afford ? (
                <p className="mr-form__hint mr-form__hint--action">Enter your income above — your estimate appears instantly below.</p>
              ) : inc < 1000 ? (
                <p className="mr-form__hint mr-form__hint--warn">This income looks too low — please enter your gross monthly salary (before deductions).</p>
              ) : inc > 5_000_000 ? (
                <p className="mr-form__hint mr-form__hint--warn">This income looks unusually high — please double-check the figure.</p>
              ) : afford.maxBond <= 0 ? (
                <p className="mr-form__hint mr-form__hint--warn">Your declared debt obligations exceed what banks allow at this income level — no home loan is likely available without reducing your existing debt first.</p>
              ) : (
                <div className="mr-form__results-cue" role="status" aria-live="polite">
                  ↓ Your estimate is ready — see results below
                </div>
              )}
            </div>
          )}

          {/* Statement path */}
          {mode === 'statement' && (
            <div className="mr-stmt fade-in">
              {loading ? (
                <StatementLoader slow={slow} progressMessage={loadingMsg} />
              ) : (
                <>
                  <div
                    className={`mr-stmt__drop ${stmtFile ? 'mr-stmt__drop--has-file' : ''}`}
                    onClick={() => fileRef.current?.click()}
                    onDragOver={e => e.preventDefault()}
                    onDrop={e => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) setStmtFile(f); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={e => e.key === 'Enter' && fileRef.current?.click()}
                  >
                    <input ref={fileRef} type="file" accept=".csv,.pdf" style={{ display: 'none' }}
                      onChange={e => { setStmtFile(e.target.files[0]); setStmtResult(null); setError(''); }} />
                    {stmtFile ? (
                      <>
                        <Upload size={22} />
                        <span className="mr-stmt__file-name">{stmtFile.name}</span>
                        <span className="mr-stmt__change">Click to change</span>
                      </>
                    ) : (
                      <>
                        <Upload size={22} />
                        <span>Drop your bank statement here</span>
                        <span className="mr-stmt__hint">PDF or CSV · ABSA · FNB · Nedbank · Standard Bank · Capitec</span>
                      </>
                    )}
                  </div>
                  {error && <div className="mr-stmt__error">{error}</div>}
                  <button
                    className="mr-stmt__analyse"
                    onClick={analyseStatement}
                    disabled={!stmtFile}
                  >
                    Analyse statement →
                  </button>
                  <p className="mr-stmt__privacy">Your statement is processed securely and never stored on our servers.</p>
                </>
              )}
            </div>
          )}

          {/* Results */}
          {hasResult && (
            <div className="mr-results fade-in">
              <div className="mr-results__grid">
                {hasStatementResult && stmtResult.income?.detected && (
                  <div className="mr-stat">
                    <div className="mr-stat__label">Detected monthly income</div>
                    <div className="mr-stat__val">{fmt(stmtResult.income.monthlyAmount)}</div>
                  </div>
                )}
                {displayMaxBond > 0 && (
                  <div className="mr-stat mr-stat--primary">
                    <div className="mr-stat__label">How much you could borrow</div>
                    <div className="mr-stat__val mr-stat__val--big">{fmt(Math.round(displayMaxBond))}</div>
                    <div className="mr-stat__note">estimated max bond</div>
                  </div>
                )}
                {displayMonthly > 0 && (
                  <div className="mr-stat">
                    <div className="mr-stat__label">Est. monthly repayment</div>
                    <div className="mr-stat__val">{fmt(Math.round(displayMonthly))}</div>
                    <div className="mr-stat__note">
                      {pr > 0 && !hasStatementResult && pr <= displayMaxBond
                        ? <>for {fmt(Math.round(pr))} property · at prime {fmtPct(livePrime)} · </>
                        : <>at prime {fmtPct(livePrime)} · 20-yr term · </>}
                      <button type="button" onClick={() => setShowRatesModal(true)}
                        style={{ background:'none', border:'none', padding:0, font:'inherit', color:'var(--primary,#2563eb)', cursor:'pointer', borderBottom:'1px dotted currentColor' }}>
                        what's prime?
                      </button>
                    </div>
                  </div>
                )}
                {pr > 0 && afford && (
                  <div className={`mr-verdict-inline mr-verdict-inline--${afford.canAfford ? 'green' : afford.borderline ? 'amber' : 'red'}`}>
                    {afford.canAfford
                      ? '✓ You likely qualify for this property'
                      : afford.borderline
                      ? '△ Borderline — a deposit would help'
                      : '✕ This property may be out of range'}
                  </div>
                )}
              </div>

              <p className="mr-results__disclaimer">
                Estimate only · {hasStatementResult
                  ? `based on ${stmtResult.statementMonths || 1} months of data`
                  : <>at {fmtPct(liveStress)} stress rate <button type="button" onClick={() => setShowRatesModal(true)}
                       style={{ background:'none', border:'none', padding:0, font:'inherit', color:'var(--primary,#2563eb)', cursor:'pointer', borderBottom:'1px dotted currentColor' }}>
                       (what's this?)
                     </button></>} · individual bank offers will vary
              </p>

              {/* Funnel CTAs */}
              <div className="mr-funnel">
                <div className="mr-funnel__heading">What would you like to do next?</div>
                <div className="mr-funnel__cards">
                  {/* Primary CTA: always go to pre-approval */}
                  <button className="mr-funnel__card mr-funnel__card--primary" onClick={goToPreapproval}>
                    <div className="mr-funnel__card-icon"><ArrowRight size={20} /></div>
                    <div>
                      <div className="mr-funnel__card-title">Start my pre-approval — free</div>
                      <div className="mr-funnel__card-desc">
                        {hasStatementResult
                          ? 'Our broker team takes your application to the SA banks most likely to approve you. You hear back within 3–10 business days.'
                          : 'Bondly submits to multiple SA banks on your behalf. No credit check at this stage — just your details and what you can afford.'}
                      </div>
                    </div>
                  </button>
                  {/* Secondary: nudge to upload for accuracy (only on manual path) */}
                  {!hasStatementResult && (
                    <button className="mr-funnel__card" onClick={() => setMode('statement')}>
                      <div className="mr-funnel__card-icon"><Upload size={20} /></div>
                      <div>
                        <div className="mr-funnel__card-title">Get a more accurate result</div>
                        <div className="mr-funnel__card-desc">Upload a bank statement and Bondly analyses your actual income, debts, and spending — gives you a figure banks will actually honour.</div>
                      </div>
                    </button>
                  )}
                  <button className="mr-funnel__card" onClick={goToOptimize}>
                    <div className="mr-funnel__card-icon"><BarChart2 size={20} /></div>
                    <div>
                      <div className="mr-funnel__card-title">See your full financial picture</div>
                      <div className="mr-funnel__card-desc">
                        {displayMaxBond > 0 && displayMaxBond < 800000
                          ? 'The amount you could borrow is limited right now. Our financial helper shows exactly what to change to qualify for more.'
                          : 'See what banks see — spending risks, approval blockers, and a personalised plan to improve your bond outcome.'}
                      </div>
                    </div>
                  </button>
                </div>
                <p className="mr-funnel__note">Free · No credit check · No obligation</p>
              </div>
              <div className="mr-preapproval-cta">
                <button className="mr-preapproval-cta__btn mr-preapproval-cta__btn--primary" onClick={goToPreapproval}>
                  I'm ready — start my pre-approval →
                </button>
                <p className="mr-preapproval-cta__note">
                  Skip the statement upload — jump straight to your pre-approval. Bondly submits to multiple SA banks on your behalf and you get real offers, typically within 3–10 business days.
                </p>
              </div>
            </div>
          )}

        </div>
      </div>
      {/* Sticky CTA bar */}
      <div className={`mr-sticky-bar${hasResult || (mode === 'manual' && inc > 0) ? ' mr-sticky-bar--visible' : ''}`}>
        <div className="mr-sticky-bar__inner">
          <div className="mr-sticky-bar__meta">
            {displayMaxBond > 0
              ? <><strong>{fmt(Math.round(displayMaxBond))}</strong> estimated bond · No credit check · Free</>
              : <>No credit check · Takes 2 minutes · 100% free</>}
          </div>
          <button className="mr-sticky-bar__cta" onClick={goToPreapproval}>
            Check what I qualify for →
          </button>
        </div>
      </div>

      {/* Lead capture modal */}
      {showLeadCapture && (
        <div className="mr-modal-overlay" onClick={() => setShowLeadCapture(false)}>
          <div className="mr-modal" onClick={e => e.stopPropagation()}>
            <button className="mr-modal__close" onClick={() => setShowLeadCapture(false)}>✕</button>
            <h2 className="mr-modal__title">One last step</h2>
            <p className="mr-modal__sub">We'll connect you with the banks most likely to approve you — no obligation.</p>
            <form className="mr-modal__form" onSubmit={submitLead}>
              <div className="mr-modal__field">
                <label className="mr-modal__label">Full name</label>
                <input className="mr-modal__input" type="text" required placeholder="Your name"
                  value={leadName} onChange={e => setLeadName(e.target.value)} />
              </div>
              <div className="mr-modal__field">
                <label className="mr-modal__label">Email</label>
                <input className="mr-modal__input" type="email" required placeholder="you@email.com"
                  value={leadEmail} onChange={e => setLeadEmail(e.target.value)} />
              </div>
              <div className="mr-modal__field">
                <label className="mr-modal__label">Mobile number</label>
                <input className="mr-modal__input" type="tel" required placeholder="082 000 0000"
                  value={leadPhone} onChange={e => setLeadPhone(e.target.value)} />
              </div>
              <div className="mr-modal__field">
                <label className="mr-modal__label">Employment type</label>
                <select className="mr-modal__input" value={leadEmpType} onChange={e => setLeadEmpType(e.target.value)}>
                  <option value="salaried">Salaried employee</option>
                  <option value="self-employed">Self-employed</option>
                  <option value="contractor">Contractor / Freelancer</option>
                  <option value="retired">Retired</option>
                </select>
              </div>
              <div className="mr-modal__field">
                <label className="mr-modal__label">Deposit available <span style={{fontWeight:400,color:'var(--text-muted)',fontSize:'0.8em'}}>(optional)</span></label>
                <input className="mr-modal__input" type="text" inputMode="numeric" placeholder="e.g. 150 000 (or 0 if none)"
                  value={leadDeposit} onChange={e => setLeadDeposit(e.target.value)} />
              </div>
              <button className="mr-modal__submit" type="submit" disabled={leadSubmitting}>
                {leadSubmitting ? 'Submitting…' : 'See my pre-approval →'}
              </button>
              <p className="mr-modal__privacy">Your details are only shared with banks that submit you an offer.</p>
            </form>
          </div>
        </div>
      )}

      <RatesExplained
        open={showRatesModal}
        onClose={() => setShowRatesModal(false)}
        primeRate={livePrime}
        stressRate={liveStress}
        lastChanged={_rateSettings.primeRateLastChanged}
      />
    </>
  );
}
