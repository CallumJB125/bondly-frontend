import { useState, useRef, useEffect } from 'react';
import { InlineFeedback } from '@bondly/ui/components/FeedbackButton.jsx';
import { trackFormField, track, trackAction } from '@bondly/ui/lib/session.js';
import { track as aTrack } from '@bondly/ui/lib/analytics.js';
import { Link, useNavigate } from 'react-router-dom';
import OriginationNav from '../../components/OriginationNav.jsx';
import { Smartphone, Briefcase, BarChart2, Target, CheckCircle } from 'lucide-react';
import { applications, leads, parseStatementForPreapproval, qualifyManual, profile as profileApi } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '@bondly/ui/components/Toast.jsx';
import { PRIME_RATE, STRESS_RATE, START_APPLICATION } from '@bondly/ui/lib/constants.js';
import StepProgress from '@bondly/ui/components/StepProgress.jsx';
import { useApplicationDraft } from '@bondly/ui/lib/applicationDraft.jsx';
import { useRateSettings } from '@bondly/ui/lib/usePrimeRate.js';
import RatesExplained from '@bondly/ui/components/RatesExplained.jsx';
import { calcMaxBond, calcMonthly } from '@bondly/ui/lib/finance.js';
import { fmt, parseNum } from '@bondly/ui/lib/format.js';
import Button from '@bondly/ui/components/Button.jsx';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';
import Input, { Select, CurrencyInput } from '@bondly/ui/components/Input.jsx';
import PropertySearchCTA from '@bondly/ui/components/PropertySearchCTA.jsx';
import './Preapproval.css';

// ── Sub-components ────────────────────────────────────────────────────────────

function ScoreGauge({ score }) {
  const r  = 52;
  const cx = 64, cy = 62;
  const circ  = Math.PI * r;
  const filled = Math.min(1, score / 100) * circ;
  const color  = score >= 70 ? '#16a34a' : score >= 45 ? '#d97706' : '#ef4444';
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <svg width="128" height="70" viewBox="0 0 128 70" aria-label={`Home readiness score: ${score} out of 100`}>
      <path d={d} fill="none" stroke="var(--border-color)" strokeWidth="11" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`} />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color}
        fontSize="22" fontWeight="800" fontFamily="inherit">{score}</text>
      <text x={cx} y={cy + 7} textAnchor="middle" fill="var(--text-secondary)"
        fontSize="9" fontFamily="inherit">/ 100</text>
    </svg>
  );
}

function ZoneBadge({ zone }) {
  const cfg = {
    green:  { icon: '●', label: 'Green Zone', sub: 'Ready to buy',  cls: 'pa-zone--green' },
    yellow: { icon: '●', label: 'Yellow Zone', sub: 'Almost there', cls: 'pa-zone--yellow' },
    red:    { icon: '●', label: 'Red Zone',    sub: 'Not ready yet', cls: 'pa-zone--red' },
  };
  const c = cfg[zone] || cfg.red;
  return (
    <div className={`pa-zone ${c.cls}`}>
      <span className="pa-zone__dot">{c.icon}</span>
      <div>
        <div className="pa-zone__label">{c.label}</div>
        <div className="pa-zone__sub">{c.sub}</div>
      </div>
    </div>
  );
}

const SPEND_META = {
  groceries:     { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg>, label: 'Groceries & Food' },
  entertainment: { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="1" x2="6" y2="4"/><line x1="10" y1="1" x2="10" y2="4"/><line x1="14" y1="1" x2="14" y2="4"/></svg>, label: 'Dining & Entertainment' },
  fuel:          { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 22V7a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v15"/><path d="M15 14a2 2 0 1 0 4 0V9.83a2 2 0 0 0-.59-1.42L17 7"/><line x1="3" y1="22" x2="20" y2="22"/><rect x="7" y="10" width="4" height="4"/></svg>, label: 'Fuel & Transport' },
  utilities:     { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>, label: 'Utilities' },
  insurance:     { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>, label: 'Insurance' },
  subscriptions: { icon: <Smartphone size={16}/>, label: 'Subscriptions' },
  other:         { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>, label: 'Other expenses' },
};

function SpendingRow({ cat, userAmount, peerAmount, overSpend, overSpendPct }) {
  const meta = SPEND_META[cat] || { icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><line x1="2" y1="10" x2="22" y2="10"/></svg>, label: cat };
  if (!userAmount && !peerAmount) return null;
  const maxAmt = Math.max(userAmount, peerAmount, 1);
  // Cap display at 500% to avoid absurd figures from poor parse quality
  const displayPct = overSpendPct > 500 ? '500%+' : `${overSpendPct}%`;
  return (
    <div className="pa-spend-row">
      <div className="pa-spend-row__head">
        <span className="pa-spend-row__icon">{meta.icon}</span>
        <span className="pa-spend-row__label">{meta.label}</span>
        <span className={`pa-spend-row__amount ${overSpend ? 'pa-spend-row__amount--over' : ''}`}>
          {fmt(userAmount)}/mo
          {overSpend && <span className="pa-spend-row__badge">+{displayPct} vs peers</span>}
        </span>
      </div>
      <div className="pa-spend-bars">
        <div className="pa-spend-bars__you">
          <div className="pa-spend-bars__fill pa-spend-bars__fill--user" style={{ width: `${(userAmount / maxAmt) * 100}%` }} />
        </div>
        <div className="pa-spend-bars__peer">
          <div className="pa-spend-bars__fill pa-spend-bars__fill--peer" style={{ width: `${(peerAmount / maxAmt) * 100}%` }} />
          <span className="pa-spend-bars__peer-label">Peers: {fmt(peerAmount)}/mo</span>
        </div>
      </div>
    </div>
  );
}

function OptCard({ opt }) {
  return (
    <div className={`pa-opt-card pa-opt-card--${opt.priority}`}>
      <span className="pa-opt-card__icon">{opt.icon}</span>
      <div className="pa-opt-card__body">
        <div className="pa-opt-card__title">{opt.title}</div>
        <div className="pa-opt-card__desc">{opt.description}</div>
      </div>
      {opt.loanImpact > 0 && (
        <div className="pa-opt-card__impact">
          +{fmt(opt.loanImpact)}
          <span>bond</span>
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

function calcQualifyingBond(income, debt) {
  const maxMonthly = Math.max(0, income * 0.30 - debt);
  return calcMaxBond(maxMonthly, STRESS_RATE, 20);
}

// Sum all monthly debt obligations from a parsed analysis result.
// Includes both detected "other debts" (car, credit, personal) and
// the existing mortgage repayment, which is tracked separately.
function calcTotalDebt(analysisOrStored) {
  const other = analysisOrStored?.debts?.totalMonthly || 0;
  const bond  = analysisOrStored?.existingMortgage?.detected
    ? (analysisOrStored.existingMortgage.avgAmount || 0)
    : 0;
  return other + bond;
}

const STEPS = ['Quick estimate', 'Bank statement', 'Review your details', 'Your result'];
// Plain-English description shown under "Step X of 4 · …" so first-time
// users know what each step is actually for.
const STEP_DESCRIPTIONS = [
  'Tell us your income — takes 10 seconds',
  'Upload your bank statement — auto-analysed in 90 seconds',
  'Confirm employment, family + property details',
  'See what banks will offer + your next step',
];

const UPLOAD_STAGES = [
  'Reading your statement…',
  'Detecting income…',
  'Calculating your affordability…',
];
const UPLOAD_STAGES_OCR = [
  'Scanning PDF pages… (1–2 min)',
  'Running OCR on statement…',
  'Extracting transactions…',
  'Detecting income…',
  'Calculating your affordability…',
];

export default function Preapproval() {
  // Live prime + stress — admin updates flow here; constants.js is only the boot-time fallback.
  const _rateSettings = useRateSettings();
  const livePrime  = _rateSettings.primeRate  || PRIME_RATE;
  const liveStress = _rateSettings.stressRate || STRESS_RATE;
  const [showRatesModal, setShowRatesModal] = useState(false);
  const [step, setStep]             = useState(0); // 0 = income-first estimate
  const [empType, setEmpType]       = useState('salaried');
  const [propType, setPropType]     = useState('freehold');
  const [uploading, setUploading]   = useState(false);
  const [aiConsent, setAiConsent]   = useState(false);
  const [uploadStage, setUploadStage] = useState(0);
  const [isOcrScan, setIsOcrScan]   = useState(false);
  const [parseProgress, setParseProgress] = useState(null); // server-sent progress message
  const [parseError, setParseError] = useState(null);
  const [analysis, setAnalysis]     = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [qualifying, setQualifying] = useState(false);
  const [statementSource, setStatementSource] = useState(null); // 'statement' | 'profile' | null
  const [incomeVerified, setIncomeVerified] = useState(false);
  const [incomeEditVal, setIncomeEditVal] = useState('');
  const [exitIntent, setExitIntent] = useState(false);
  const [exitEmail, setExitEmail]   = useState('');
  const [exitSaved, setExitSaved]   = useState(false);
  const [incomeError, setIncomeError] = useState(false);
  const [skippedSteps, setSkippedSteps] = useState(new Set());
  const [shareLink, setShareLink]   = useState('');
  const [shareLoading, setShareLoading] = useState(false);
  const [bondApp, setBondApp]       = useState({
    propertyAddress: '',
    purchasePrice:   '',
    propertyType:    'freehold',
    otpSigned:       false,
    banks:           [], // default none selected → certificate path; user opts in to full bond submission
  });
  const [submittingApp, setSubmittingApp] = useState(false);
  const exitFiredRef        = useRef(false);
  const stepEnteredAt       = useRef(Date.now());  // timing each step
  const uploadCount         = useRef(0);            // re-upload detection
  const parserDistrustFired = useRef(false);        // fire once per session
  const resultAbandonTimer  = useRef(null);         // trust: did they leave quickly after results?
  const [form, setForm] = useState({
    income: '', debt: '', deposit: '',
    name: '', phone: '', email: '', idNumber: '', contact: 'WhatsApp',
    maritalStatus: '',
    marriageType: '',
    dependants: '0',
    // Property details (step 4)
    hasProperty: false,
    propertyAddress: '',
    purchasePrice: '',
    hasOtp: false,
  });

  useEffect(() => {
    if (!uploading) { setUploadStage(0); setIsOcrScan(false); return; }
    const stages = isOcrScan ? UPLOAD_STAGES_OCR : UPLOAD_STAGES;
    const t = setInterval(() => setUploadStage(i => (i + 1) % stages.length), isOcrScan ? 4000 : 2500);
    return () => clearInterval(t);
  }, [uploading, isOcrScan]);

  const fileRef  = useRef(null);
  const { isLoggedIn, user } = useAuth();
  const showToast = useToast();
  const navigate  = useNavigate();
  const draft     = useApplicationDraft();
  // True once the user returns from the account gate (post-register) — drives the
  // "Continue to application" CTA shown on the now-unlocked profile.
  const [unlockedFromGate, setUnlockedFromGate] = useState(false);

  // Persist full form/analysis so state survives the register round-trip.
  const TEASER_RESTORE_KEY = 'bondly_preapproval_teaser_restore';
  function persistForTeaserGate() {
    try {
      sessionStorage.setItem(TEASER_RESTORE_KEY, JSON.stringify({ form, analysis, empType, propType }));
    } catch {}
    draft.set({
      income:        parseNum(form.income) || null,
      debt:          parseNum(form.debt) || null,
      savings:       parseNum(form.deposit) || null,
      affordability: (parseNum(form.income) > 0 ? calcQualifyingBond(parseNum(form.income), parseNum(form.debt)) : null),
      source:        'preapproval',
    });
  }

  // Restore on mount if we have a teaser-gate snapshot (post-register return).
  useEffect(() => {
    let snap = null;
    try {
      const raw = sessionStorage.getItem(TEASER_RESTORE_KEY);
      if (raw) { snap = JSON.parse(raw); sessionStorage.removeItem(TEASER_RESTORE_KEY); }
    } catch {}
    if (snap?.form) {
      setForm(f => ({ ...f, ...snap.form }));
      if (snap.analysis) setAnalysis(snap.analysis);
      if (snap.empType) setEmpType(snap.empType);
      if (snap.propType) setPropType(snap.propType);
      setStep(3);
      setUnlockedFromGate(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Track funnel entry once on mount
  useEffect(() => { track('preapproval_started', 'preapproval'); }, []);

  // Step timing — fires whenever step changes
  useEffect(() => {
    const prev = stepEnteredAt.current;
    stepEnteredAt.current = Date.now();
    // entry_source: hero_statement = came via homepage statement upload fast-path;
    //               url_income     = came via ?income= URL param (e.g. from landing calc);
    //               cold_start     = direct navigation with no pre-fill.
    const entry_source = statementSource === 'statement'
      ? 'hero_statement'
      : (skippedSteps.has(1) && new URLSearchParams(window.location.search).get('income'))
        ? 'url_income'
        : 'cold_start';
    aTrack('preapproval_step_enter', { step, prevDurationMs: Date.now() - prev, entry_source });
    // When step 3 (financial profile) renders, start a result-abandon timer
    if (step === 3) {
      const zone = analysis?.affordabilityZone?.zone;
      aTrack('preapproval_zone_revealed', {
        zone: zone || 'none',
        readinessScore: analysis?.readiness?.score,
        employmentType: empType,
        hasStatement: statementSource === 'statement',
      });
      resultAbandonTimer.current = setTimeout(() => {
        resultAbandonTimer.current = null; // cleared = they stayed long enough
      }, 45_000);
    } else {
      // Navigating away from step 3 (e.g. back) — cancel timer if they went forward
      if (step === 4) {
        clearTimeout(resultAbandonTimer.current);
        resultAbandonTimer.current = null;
      }
    }
    return () => {};
  }, [step]); // eslint-disable-line react-hooks/exhaustive-deps

  // Result abandon — fires on unmount if user left step 3 within 45s
  useEffect(() => {
    return () => {
      if (resultAbandonTimer.current) {
        clearTimeout(resultAbandonTimer.current);
        aTrack('result_abandon', {
          step,
          zone: analysis?.affordabilityZone?.zone || 'none',
          durationMs: Date.now() - stepEnteredAt.current,
        });
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Exit intent — fire when mouse moves to top 20px on step 2/3 (after user has engaged)
  useEffect(() => {
    if (step < 2 || step > 3 || exitFiredRef.current) return;
    function onMouseMove(e) {
      if (e.clientY < 20 && !exitFiredRef.current) {
        exitFiredRef.current = true;
        setExitIntent(true);
      }
    }
    document.addEventListener('mousemove', onMouseMove);
    return () => document.removeEventListener('mousemove', onMouseMove);
  }, [step]);

  // Pre-fill from sessionStorage (hero statement) or URL params — runs once on mount
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const urlIncome = params.get('income');
    const urlPrice  = params.get('price');

    let storedResult = null;
    try {
      const raw = sessionStorage.getItem('bondly_stmt_result');
      if (raw) { storedResult = JSON.parse(raw); sessionStorage.removeItem('bondly_stmt_result'); }
    } catch {}

    if (storedResult) {
      setAnalysis(storedResult);
      setStatementSource('statement');
      setStep(2);
      setForm(f => ({
        ...f,
        income: storedResult.income?.detected && storedResult.income.monthlyAmount
          ? String(Math.round(storedResult.income.monthlyAmount))
          : f.income,
        debt: (() => {
          const total = calcTotalDebt(storedResult);
          return total > 0 ? String(Math.round(total)) : f.debt;
        })(),
        deposit: storedResult.accountBalance > 0 && !f.deposit
          ? String(Math.round(storedResult.accountBalance))
          : f.deposit,
      }));
      if (storedResult.income?.employmentHint === 'commission') setEmpType('self_employed');
    } else if (urlIncome) {
      setForm(f => ({ ...f, income: urlIncome }));
      setSkippedSteps(new Set([1]));
      setStep(2);
    }
  }, []);

  // Pre-fill from profile on mount
  useEffect(() => {
    if (!isLoggedIn) return;
    profileApi.get().then(d => {
      setForm(f => ({
        ...f,
        name:    d.name    || user?.name  || f.name,
        email:   d.email   || user?.email || f.email,
        phone:   d.phone   || f.phone,
        income:  d.monthlyIncome    > 0 ? String(Math.round(d.monthlyIncome))    : f.income,
        debt:    d.totalMonthlyDebt > 0 ? String(Math.round(d.totalMonthlyDebt)) : f.debt,
      }));
      if (d.employmentType) setEmpType(d.employmentType.includes('self') ? 'self_employed' : 'salaried');
      if (d.monthlyIncome > 0 || d.totalMonthlyDebt > 0) setStatementSource('profile');
    }).catch(() => {
      // Fall back to auth context name/email
      setForm(f => ({
        ...f,
        name:  user?.name  || f.name,
        email: user?.email || f.email,
      }));
    });
  }, [isLoggedIn]);

  // Autosave draft to localStorage so users can resume if they close the tab
  const DRAFT_KEY = 'bondly_preapproval_draft';
  useEffect(() => {
    if (step >= 3) { localStorage.removeItem(DRAFT_KEY); return; } // clear on success
    try {
      const sanitized = { ...form, income: Math.max(0, parseFloat(form.income) || 0) || form.income };
      localStorage.setItem(DRAFT_KEY, JSON.stringify({ step, form: sanitized, empType, propType }));
    } catch {}
  }, [step, form, empType, propType]);

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  // Step 2 → 3: run full server scoring if we don't already have affordabilityZone
  async function handleContinueToResults() {
    const hasFullAnalysis = analysis?.affordabilityZone && analysis?.readiness;
    if (hasFullAnalysis) { setStep(3); return; }
    if (inc <= 0) { setStep(3); return; } // no income — show what-we-found view
    setQualifying(true);
    try {
      const res = await qualifyManual({ income: inc, debt: dbt, deposit: dep, empType });
      if (res.success) {
        // Merge manual analysis with any statement data (expenses, balance, debts) already extracted
        setAnalysis(prev => ({
          ...(prev || {}),
          ...res.data,
          // Preserve statement-extracted fields if they exist
          expenses:  prev?.expenses?.total > 0 ? prev.expenses : res.data.expenses,
          debts:     prev?.debts?.totalMonthly > 0 ? prev.debts : res.data.debts,
          accountBalance: prev?.accountBalance ?? res.data.accountBalance,
        }));
      }
    } catch { showToast('Using an estimated analysis — full results require a connection', 'info'); } finally {
      setQualifying(false);
    }
    setStep(3);
    trackAction('preapproval_step3_reached', { hasAnalysis: !!analysis, income: inc });
    window.gtag?.('event', 'preapproval_results_viewed', { event_category: 'preapproval' });
  }

  const inc = parseNum(form.income);
  const dbt = parseNum(form.debt);
  const dep = parseNum(form.deposit);
  const qualifyingBond   = inc > 0 ? calcQualifyingBond(inc, dbt) : 0;
  const maxPurchasePrice = qualifyingBond + dep;
  const maxMonthly       = qualifyingBond > 0 ? calcMonthly(qualifyingBond, livePrime, 20) : 0;

  // ── Step 1: Bank statement upload ─────────────────────────────────────────
  async function handleFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.name.match(/\.(csv|pdf)$/i)) {
      showToast('Please upload a CSV or PDF bank statement', 'error');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      showToast('File must be under 10MB', 'error');
      return;
    }
    setUploading(true);
    setIsOcrScan(false);
    setParseProgress(null);
    setParseError(null);
    setAnalysis(null);
    setIncomeVerified(false);
    setStatementSource(null);
    const parseStart = Date.now();
    uploadCount.current += 1;
    if (uploadCount.current > 1) {
      aTrack('re_upload', { attempt: uploadCount.current, page: '/preapproval' });
    }
    trackAction('statement_parse_started', { step: 1 });
    try {
      const res = await parseStatementForPreapproval(file, {
        onWillOcr:  () => setIsOcrScan(true),
        onProgress: (msg) => setParseProgress(msg),
      });
      if (!res.success) throw new Error(res.error || 'Could not analyse statement');
      const d = res.data;

      // Override profile-prefilled fields with statement data where available
      setForm(f => ({
        ...f,
        income: d.income?.detected && d.income.monthlyAmount
          ? String(Math.round(d.income.monthlyAmount))
          : f.income,
        debt: (() => {
          const total = calcTotalDebt(d);
          return total > 0 ? String(Math.round(total)) : f.debt;
        })(),
        deposit: d.accountBalance > 0 && !f.deposit
          ? String(Math.round(d.accountBalance))
          : f.deposit,
      }));

      if (d.income?.employmentType === 'commission' || d.income?.employmentHint === 'commission') {
        setEmpType('self_employed');
      }

      setAnalysis(d);
      setStatementSource('statement');
      trackAction('statement_uploaded', {
        incomeDetected:   !!d.income?.detected,
        confidence:       d.income?.confidence || null,
        affordabilityZone: d.affordabilityZone?.zone || null,
        parseDurationMs:  Date.now() - parseStart,
        step: 1,
      });
      parserDistrustFired.current = false; // reset on fresh upload
      showToast('Statement analysed — figures updated below', 'success');
      window.gtag?.('event', 'statement_uploaded', { event_category: 'preapproval' });

      // Persist to profile if logged in
      if (isLoggedIn && d.income?.detected && d.income.monthlyAmount) {
        profileApi.updateFinancial({
          monthlyIncome:    Math.round(d.income.monthlyAmount),
          totalMonthlyDebt: d.debts?.totalMonthly ? Math.round(d.debts.totalMonthly) : undefined,
        }).catch(() => {});
      }
      setStep(2);
    } catch (err) {
      trackAction('statement_upload_failed', { error: String(err.message).slice(0, 80), step: 1 });
      // Long bank-specific messages (IMAGE_PDF) are shown inline — short generic errors use toast
      const msg = err.message || 'Could not read statement — please try a different file';
      if (msg.length > 120) {
        setParseError(msg);
      } else {
        showToast(msg, 'error');
      }
    } finally {
      setUploading(false);
      setParseProgress(null);
      if (e.target) e.target.value = '';
    }
  }

  function renderStep0() {
    const incomeVal = parseFloat(form.income) || 0;
    const estimate  = incomeVal > 0 ? calcQualifyingBond(incomeVal, parseFloat(form.debt) || 0) : 0;
    const monthly   = estimate > 0 ? calcMonthly(estimate, livePrime, 20) : 0;

    return (
      <div className="fade-in">
        <h1 className="preapproval-title">How much home can you afford?</h1>
        <p className="preapproval-sub">
          Enter your income for an instant estimate — no statements, no sign-up required.
        </p>

        <div style={{ display: 'grid', gap: 'var(--space-4)', marginBottom: 'var(--space-4)' }}>
          <div className="pa-field-row">
            <label className="pa-field">
              <span className="pa-field__label">Monthly income (gross) *</span>
              <span className="pa-field__wrap">
                <span className="pa-field__prefix">R</span>
                <input
                  className="pa-field__input"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 45 000"
                  value={form.income}
                  onChange={e => { setForm(f => ({ ...f, income: e.target.value })); setIncomeError(false); }}
                  autoFocus
                  aria-label="Gross monthly income in Rands"
                  aria-describedby={incomeError ? 'pa-income-error' : undefined}
                />
              </span>
            </label>
            {incomeError && (
              <p id="pa-income-error" style={{ fontSize: '0.8125rem', color: '#dc2626', margin: '-8px 0 4px', fontWeight: 500 }}>
                Please enter your monthly income
              </p>
            )}
            <label className="pa-field">
              <span className="pa-field__label">
                Monthly debt payments <span className="pa-field__optional">(optional)</span>
              </span>
              <span className="pa-field__wrap">
                <span className="pa-field__prefix">R</span>
                <input
                  className="pa-field__input"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 5 000"
                  value={form.debt}
                  onChange={e => setForm(f => ({ ...f, debt: e.target.value }))}
                  aria-label="Monthly debt repayments in Rands"
                />
              </span>
            </label>
            {inc > 0 && dbt >= inc && (
              <p style={{ fontSize: '0.8125rem', color: 'var(--color-danger, #dc2626)', margin: '6px 0 0' }}>
                Monthly debt payments can't exceed your income — please check these figures.
              </p>
            )}
          </div>
        </div>

        {estimate > 0 && (
          <div className="fade-in" style={{ background: 'linear-gradient(160deg, #1a5c38 0%, #0f3d24 100%)', border: '1px solid rgba(255,255,255,0.12)', borderRadius: 'var(--border-radius-lg)', padding: '28px 28px 24px', marginBottom: 'var(--space-5)', textAlign: 'center', boxShadow: '0 16px 48px rgba(0,0,0,0.18)' }}>
            <div style={{ color: 'rgba(255,255,255,0.65)', fontSize: '0.8125rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 600, marginBottom: 8 }}>
              You could qualify for up to
            </div>
            <div style={{ color: '#ffffff', fontWeight: 400, fontSize: 'clamp(2.25rem, 7vw, 2.75rem)', fontFamily: 'var(--font-serif)', lineHeight: 1.05, fontVariantNumeric: 'tabular-nums', marginBottom: 6 }}>
              {fmt(estimate)}
            </div>
            <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: '0.875rem' }}>
              ≈ {fmt(monthly)}/month at prime ({livePrime}%) · 20-year term
            </div>
            <div style={{ marginTop: 16, padding: '10px 16px', background: 'rgba(255,255,255,0.1)', borderRadius: 8, fontSize: '0.8125rem', color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
              This is an estimate using the SA NCA stress-rate formula. Upload your bank statement for a more precise, lender-ready figure.
            </div>
          </div>
        )}

        {estimate > 0 && (
          <div style={{ marginBottom: 'var(--space-4)' }}>
            <PropertySearchCTA maxBond={estimate} compact defaultExpanded />
          </div>
        )}

        <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
          <Button
            variant="lime"
            full
            onClick={() => {
              const incomeVal = parseFloat(form.income) || 0;
              if (incomeVal <= 0) { setIncomeError(true); showToast('Please enter your gross monthly income', 'error'); return; }
              setIncomeError(false); setForm(f => ({ ...f })); setSkippedSteps(new Set([1])); setStep(2);
            }}
          >
            {estimate > 0 ? 'See my full affordability →' : 'Continue →'}
          </Button>
          {estimate > 0 && (
            <Button
              variant="ghost"
              full
              onClick={() => {
                const incomeVal = parseFloat(form.income) || 0;
                if (incomeVal <= 0) { setIncomeError(true); showToast('Please enter your gross monthly income', 'error'); return; }
                setIncomeError(false); setForm(f => ({ ...f })); setStep(1);
              }}
            >
              Upload bank statement for a more accurate result →
            </Button>
          )}
        </div>

        <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-4)' }}>
          ✓ No credit check · ✓ No sign-up required · ✓ POPIA compliant
        </p>
      </div>
    );
  }

  function renderStep1() {
    const monthsHint = empType === 'self_employed' ? '6–12 months of statements recommended' : '3 months ideal, 1 month minimum';
    return (
      <div className="fade-in">
        <h1 className="preapproval-title">Upload your bank statement — AI analyses it in 90 seconds</h1>
        <p className="preapproval-sub">
          AI reads your income, debts and spending automatically — no manual entry, no broker call needed.
        </p>

        <div className="pa-trust-bar">
          <span>256-bit encrypted</span>
          <span>·</span>
          <span>✓ Never stored</span>
          <span>·</span>
          <span>✓ No credit check</span>
          <span>·</span>
          <span>✓ POPIA compliant</span>
        </div>

        <div className="pa-emp-row" style={{ marginBottom: 'var(--space-4)' }}>
          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginRight: 8 }}>Employment:</span>
          {[
            { key: 'salaried',     label: 'Salaried' },
            { key: 'self_employed', label: 'Self-employed / Commission' },
          ].map(opt => (
            <button
              key={opt.key}
              type="button"
              className={`pa-chip ${empType === opt.key ? 'pa-chip--active' : ''}`}
              onClick={() => setEmpType(opt.key)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        {empType === 'self_employed' && (
          <div className="pa-info-box pa-info-box--amber fade-in" style={{ marginBottom: 'var(--space-4)' }}>
            Banks require 6–12 months of statements for self-employed / commission income. Upload as many as you have for the most accurate result.
          </div>
        )}

        {/* What happens next explainer */}
        <div className="pa-explainer">
          <p className="pa-explainer__title">Here's what we do with it</p>
          <div className="pa-explainer__steps">
            <div className="pa-explainer__step">
              <span className="pa-explainer__icon">🔍</span>
              <div>
                <strong>We detect your income &amp; expenses</strong>
                <span>Our system reads your actual figures — no manual entry needed</span>
              </div>
            </div>
            <div className="pa-explainer__step">
              <span className="pa-explainer__icon">🏦</span>
              <div>
                <strong>We calculate your maximum bond</strong>
                <span>Using the NCA stress-rate formula all 7 SA banks apply</span>
              </div>
            </div>
            <div className="pa-explainer__step">
              <span className="pa-explainer__icon">🔒</span>
              <div>
                <strong>Your statement is never stored</strong>
                <span>Processed in memory and discarded. We keep only the extracted figures.</span>
              </div>
            </div>
          </div>
          <p className="pa-explainer__time">⏱ Takes about 3 minutes · No credit check</p>
        </div>

        {/* POPIA / AI consent — must be accepted before upload is enabled */}
        <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '0 0 16px', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
          <input
            type="checkbox"
            checked={aiConsent}
            onChange={e => setAiConsent(e.target.checked)}
            style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--lime)' }}
          />
          <span>
            I agree that my bank statement will be analysed using{' '}
            <strong style={{ color: 'var(--text-primary)' }}>Claude AI (Anthropic, USA)</strong>{' '}
            to extract transactions and income. No data is sold or shared beyond this analysis.{' '}
            <a href="/privacy" style={{ color: 'var(--lime)' }}>Privacy Policy</a>
          </span>
        </label>

        <input
          ref={fileRef}
          type="file"
          accept=".csv,.pdf,application/pdf,text/csv"
          style={{ display: 'none' }}
          onChange={handleFileUpload}
        />

        <button
          type="button"
          className={`pa-upload-zone ${uploading ? 'pa-upload-zone--loading' : ''} ${!aiConsent ? 'pa-upload-zone--disabled' : ''}`}
          onClick={() => !uploading && aiConsent && fileRef.current?.click()}
          disabled={uploading || !aiConsent}
          title={!aiConsent ? 'Please accept the AI processing consent above first' : undefined}
        >
          {uploading ? (
            <>
              <div className="pa-upload-zone__spinner" />
              <strong>{parseProgress?.message || (isOcrScan ? UPLOAD_STAGES_OCR[uploadStage] : UPLOAD_STAGES[uploadStage])}</strong>
              {parseProgress?.percent != null
                ? <span>No credit check · {parseProgress.percent}% complete — up to 8 minutes for scanned PDFs</span>
                : <span>No credit check · {isOcrScan ? 'OCR scan — up to 4 minutes' : 'usually 30 seconds to 4 minutes'}</span>
              }
            </>
          ) : (
            <>
              <span className="pa-upload-zone__icon"><svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg></span>
              <strong>Tap to upload your bank statement</strong>
              <span>CSV or PDF · {monthsHint}</span>
              <span style={{ fontSize: '0.8rem', opacity: 0.6, marginTop: 4 }}>ABSA, FNB, Nedbank, Standard Bank, Capitec</span>
            </>
          )}
        </button>

        <p className="pa-upload__security">
          256-bit encrypted · Analysed by AI · Stored securely in South Africa
        </p>

        {parseError && (
          <div className="pa-parse-error fade-in" role="alert">
            <div className="pa-parse-error__icon">⚠️</div>
            <div className="pa-parse-error__body">
              <strong className="pa-parse-error__title">We couldn't read this PDF</strong>
              <p className="pa-parse-error__msg">{parseError}</p>
              <button
                type="button"
                className="pa-parse-error__retry"
                onClick={() => { setParseError(null); fileRef.current?.click(); }}
              >
                Try a different file →
              </button>
            </div>
          </div>
        )}

        <div className="pa-upload-why">
          <details>
            <summary>Why do we need this?</summary>
            <p>
              Your statement lets us detect your real income, existing debt, and spending — giving you a result banks will actually honour. It's never stored on our servers.
            </p>
          </details>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginTop: 'var(--space-5)', alignItems: 'center' }}>
          <button
            type="button"
            style={{ background: 'none', border: '1.5px solid var(--border-color)', borderRadius: 8, color: 'var(--text-secondary)', fontSize: '0.875rem', cursor: 'pointer', padding: '10px 20px', fontFamily: 'var(--font-sans)', minHeight: 44, transition: 'border-color 0.15s, color 0.15s' }}
            onMouseEnter={e => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-primary)'; }}
            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border-color)'; e.currentTarget.style.color = 'var(--text-secondary)'; }}
            onClick={() => { setSkippedSteps(new Set([1])); setStep(2); }}
          >
            I don't have my statement — enter figures manually →
          </button>
        </div>
      </div>
    );
  }

  // ── Step 2: Review & confirm ───────────────────────────────────────────────
  function renderStep2() {
    const d = analysis;
    const sourceLabel = statementSource === 'statement'
      ? `Detected from your ${d?.statementMonths || 1}-month statement`
      : statementSource === 'profile'
      ? 'Loaded from your profile — adjust if needed'
      : null;

    return (
      <div className="fade-in">
        <h1 className="preapproval-title">Confirm your details</h1>
        <p className="preapproval-sub">
          {sourceLabel || 'Enter your financial details below.'}
        </p>

        {/* Statement detection banner */}
        {d?.income?.detected ? (
          <div className={`pa-detected-banner fade-in${d.income.employmentHint === 'commission' ? ' pa-detected-banner--warn' : ''}`}>
            <span className="pa-detected-banner__icon">{d.income.employmentHint === 'commission' ? '⚠' : '✓'}</span>
            <div>
              {d.income.employmentHint === 'commission' ? (
                <>
                  <strong>Irregular income detected</strong> — monthly average estimated over {d.statementMonths} month{d.statementMonths !== 1 ? 's' : ''}.
                  <br /><span style={{ fontSize: '0.8125rem', opacity: 0.8 }}>For commission income, upload 3–6 months for a more accurate figure.</span>
                </>
              ) : (
                <>
                  <strong>Statement verified</strong> — {d.statementMonths} month{d.statementMonths !== 1 ? 's' : ''} of data
                  {d.income.confidence && (
                    <span className={`pa-conf pa-conf--${d.income.confidence}`}> · {d.income.confidence} confidence</span>
                  )}
                </>
              )}
            </div>
          </div>
        ) : d && (
          <div className="pa-detected-banner pa-detected-banner--warn fade-in">
            <span className="pa-detected-banner__icon">⚠</span>
            <div>
              <strong>Income not detected in statement</strong>
              <br /><span style={{ fontSize: '0.8125rem', opacity: 0.8 }}>Common with commission or business income. Enter your average monthly income below.</span>
            </div>
          </div>
        )}

        <Card>
          <CardHeader>Employment</CardHeader>
          <CardBody>
            <div className="pa-emp-grid">
              <button
                type="button"
                className={`pa-emp-card ${empType === 'salaried' ? 'pa-emp-card--active' : ''}`}
                onClick={() => setEmpType('salaried')}
              >
                <span className="pa-emp-card__icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg></span>
                <strong>Salaried</strong>
                <span>Regular monthly salary</span>
              </button>
              <button
                type="button"
                className={`pa-emp-card ${empType === 'self_employed' ? 'pa-emp-card--active' : ''}`}
                onClick={() => setEmpType('self_employed')}
              >
                <span className="pa-emp-card__icon"><Briefcase size={20}/></span>
                <strong>Self-employed</strong>
                <span>Business, freelance or commission</span>
              </button>
            </div>
          </CardBody>
        </Card>

        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader>Income &amp; Commitments</CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <CurrencyInput
                label="Gross monthly income (R)"
                id="pa-inc"
                value={form.income}
                onChange={e => {
                  setForm(f => ({ ...f, income: e.target.value }));
                  // Parser detected income but user is manually changing it — trust signal
                  if (analysis?.income?.detected && !parserDistrustFired.current) {
                    parserDistrustFired.current = true;
                    aTrack('parser_distrust', { field: 'income', page: '/preapproval' });
                  }
                }}
                placeholder="45 000"
                autoFocus
                onBlur={() => form.income && trackFormField('preapproval', 'income', 2)}
              />
              <CurrencyInput
                label="Total existing monthly debt repayments (R)"
                id="pa-dbt"
                value={form.debt}
                onChange={set('debt')}
                placeholder="Car, credit cards, personal loans"
                onBlur={() => trackFormField('preapproval', 'debt', 2)}
              />
              <div>
                <CurrencyInput
                  label="Available deposit (R)"
                  id="pa-dep"
                  value={form.deposit}
                  onChange={set('deposit')}
                  placeholder="0"
                  onBlur={() => trackFormField('preapproval', 'deposit', 2)}
                />
                <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4, lineHeight: 1.5 }}>
                  {analysis?.accountBalance > 0
                    ? <>We pre-filled your account balance of <strong>{fmt(analysis.accountBalance)}</strong>. Reduce this if you can't put the full amount toward a deposit.</>
                    : <>Cash savings you can put toward the purchase. A 10% deposit (e.g. {fmt(Math.round((inc || 500000) * 0.10 / 10000) * 10000)} on a {fmt(inc > 0 ? Math.round(qualifyingBond / 100000) * 100000 : 500000)} bond) lets you borrow significantly more.</>
                  }
                </p>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card style={{ marginTop: 'var(--space-4)' }}>
          <CardHeader>Property Preference</CardHeader>
          <CardBody>
            <div className="pa-prop-grid">
              {[
                { key: 'freehold',  label: 'Freehold / House',       sub: 'Standalone property, no levies', icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg> },
                { key: 'sectional', label: 'Apartment / Sectional',   sub: 'Levies apply (R1k–3k/mo)',      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"/></svg> },
              ].map(opt => (
                <button key={opt.key} type="button"
                  className={`pa-prop-card ${propType === opt.key ? 'pa-prop-card--active' : ''}`}
                  onClick={() => setPropType(opt.key)}>
                  <span>{opt.icon}</span>
                  <strong>{opt.label}</strong>
                  <span>{opt.sub}</span>
                </button>
              ))}
            </div>
            <div style={{ marginTop: 'var(--space-4)' }}>
              <div className="field__label">Number of financial dependants</div>
              <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '2px 0 var(--space-2)' }}>
                People who rely on your income — banks factor this into affordability.
              </p>
              <div className="pa-contact-chips">
                {['0', '1', '2', '3', '4+'].map(n => (
                  <button key={n} type="button"
                    className={`pa-chip ${form.dependants === n ? 'pa-chip--active' : ''}`}
                    onClick={() => setForm(f => ({ ...f, dependants: n }))}>
                    {n}
                  </button>
                ))}
              </div>
            </div>
          </CardBody>
        </Card>

        {/* Live estimate */}
        {qualifyingBond > 0 && (
          <div className="pa-estimate-box fade-in" style={{ marginTop: 'var(--space-4)' }}>
            <div className="pa-estimate-label">Maximum bond</div>
            <div className="pa-estimate-amount">{fmt(qualifyingBond)}</div>
            {dep > 0 && (
              <div style={{ fontSize: '0.875rem', color: 'var(--mint)', marginTop: 2 }}>
                + {fmt(dep)} deposit = {fmt(maxPurchasePrice)} total budget
              </div>
            )}
            <div className="pa-estimate-monthly">{fmt(maxMonthly)} / month at prime ({livePrime}%)</div>
            <div className="pa-estimate-note">
              Stress-tested at {liveStress}% — SA bank standard{' '}
              <button type="button" onClick={() => setShowRatesModal(true)}
                style={{ background:'none', border:'none', padding:0, font:'inherit', color:'var(--primary,#2563eb)', cursor:'pointer', borderBottom:'1px dotted currentColor' }}>
                (what's this?)
              </button>
            </div>
          </div>
        )}

        {/* Detected data summary when income wasn't found */}
        {d && !d.income?.detected && (d.expenses?.breakdown || d.debts?.totalMonthly > 0 || d.accountBalance > 0) && (
          <div className="pa-detected-summary fade-in" style={{ marginTop: 'var(--space-4)' }}>
            <div className="pa-detected-summary__title">What we found in your statement</div>
            <div className="pa-detected-summary__rows">
              {d.accountBalance > 0 && (
                <div className="pa-detected-summary__row">
                  <span>Account balance</span>
                  <strong>{fmt(d.accountBalance)}</strong>
                </div>
              )}
              {d.expenses?.total > 0 && (
                <div className="pa-detected-summary__row">
                  <span>Monthly expenses</span>
                  <strong>{fmt(d.expenses.total)}</strong>
                </div>
              )}
              {d.existingMortgage?.detected && d.existingMortgage.avgAmount > 0 && (
                <div className="pa-detected-summary__row">
                  <span>Current bond repayment</span>
                  <strong>{fmt(d.existingMortgage.avgAmount)}/mo</strong>
                </div>
              )}
              {d.debts?.totalMonthly > 0 && (
                <div className="pa-detected-summary__row">
                  <span>Other debt repayments</span>
                  <strong>{fmt(d.debts.totalMonthly)}/mo</strong>
                </div>
              )}
              {d.expenses?.breakdown && Object.entries(d.expenses.breakdown).filter(([, v]) => v > 0).map(([cat, amt]) => (
                <div key={cat} className="pa-detected-summary__row pa-detected-summary__row--sub">
                  <span>{SPEND_META[cat]?.label || cat}</span>
                  <span>{fmt(amt)}/mo</span>
                </div>
              ))}
            </div>
            <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '8px 0 0', lineHeight: 1.5 }}>
              Enter your income above to calculate your bond affordability, or continue to see your spending insights.
            </p>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-5)' }}>
          <Button variant="ghost" onClick={() => setStep(skippedSteps.has(1) ? 0 : 1)}>← Back</Button>
          <Button
            variant="lime" full
            disabled={(!(parseNum(form.income) > 0) && !analysis) || (inc > 0 && dbt >= inc) || qualifying}
            loading={qualifying}
            onClick={handleContinueToResults}
          >
            {parseNum(form.income) > 0 ? 'See my financial profile →' : 'See what we found →'}
          </Button>
        </div>

        {!analysis && (
          <p style={{ textAlign: 'center', marginTop: 'var(--space-3)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            <button
              type="button"
              style={{ background: 'none', border: 'none', color: 'var(--mint)', cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline' }}
              onClick={() => setStep(1)}
            >
              Upload a bank statement for a more detailed analysis
            </button>
          </p>
        )}
      </div>
    );
  }

  // ── Step 3: Full Financial Profile ─────────────────────────────────────────
  function renderStep3() {
    const d = analysis;
    const zone      = d?.affordabilityZone;
    const readiness = d?.readiness;
    const benchmarks = d?.spendingBenchmarks || {};
    const opts       = d?.optimizations || [];
    const qual       = d?.qualification;
    const profile    = d?.riskProfile;
    const expenses   = d?.expenses?.breakdown || {};

    const riskFlags  = d?.riskFlags || {};

    const bondAmt    = qualifyingBond > 0 ? qualifyingBond : (qual?.maxBond || 0);
    const monthlyPmt = bondAmt > 0 ? calcMonthly(bondAmt, livePrime, 20) : 0;
    const buyingPower = bondAmt + dep;
    const totalUpside = Math.max(0, opts.reduce((s, o) => s + Math.max(0, o.loanImpact || 0), 0));

    const showIncomeVerify = analysis?.needsIncomeVerification && !incomeVerified;
    const detectedIncomeAmt = analysis?.income?.monthlyAmount || 0;

    function confirmIncome(override) {
      const confirmed = override ?? detectedIncomeAmt;
      setForm(f => ({
        ...f,
        income: String(confirmed),
        debt:   String(calcTotalDebt(analysis) || parseFloat(f.debt) || 0),
      }));
      setIncomeVerified(true);
    }

    return (
      <div className="fade-in">
        <h1 className="preapproval-title" style={{ marginBottom: 'var(--space-2)' }}>
          Your Financial Profile
        </h1>

        {showIncomeVerify && (
          <div className="pa-income-verify">
            <div className="pa-income-verify__icon">⚠️</div>
            <div className="pa-income-verify__body">
              <p className="pa-income-verify__title">Please confirm your monthly income</p>
              <p className="pa-income-verify__sub">
                We detected <strong>{fmt(detectedIncomeAmt)}/month</strong> from your statement.
                {analysis?.incomeVerificationReason === 'very_high_income' && ' High-income figures need a quick confirmation.'}
                {analysis?.incomeVerificationReason === 'single_unrecognised_credit' && ' This came from a single unrecognised credit — please verify it\'s your salary.'}
                {analysis?.incomeVerificationReason === 'income_exceeds_lifestyle' && ' The figure looks high relative to your account activity — please confirm or correct.'}
                {analysis?.incomeVerificationReason === 'single_high_income' && ' This was detected from a single transaction — please verify.'}
              </p>
              <div className="pa-income-verify__row">
                <div className="pa-income-verify__input-wrap">
                  <span className="pa-income-verify__prefix">R</span>
                  <input
                    className="pa-income-verify__input"
                    type="text"
                    inputMode="numeric"
                    placeholder={detectedIncomeAmt.toLocaleString('en-ZA')}
                    value={incomeEditVal}
                    onChange={e => setIncomeEditVal(e.target.value.replace(/[^0-9]/g, ''))}
                  />
                  <span className="pa-income-verify__suffix">/month gross</span>
                </div>
                <button
                  className="pa-income-verify__confirm"
                  onClick={() => confirmIncome(incomeEditVal ? Number(incomeEditVal) : detectedIncomeAmt)}
                >
                  {incomeEditVal && Number(incomeEditVal) !== detectedIncomeAmt ? 'Update & confirm' : 'Looks right ✓'}
                </button>
              </div>
            </div>
          </div>
        )}

        {zone && (
          <>
            <ZoneBadge zone={zone.zone} />
            <p className="pa-zone-message">{zone.message}</p>
          </>
        )}

        {readiness && (
          <div className="pa-score-card">
            <div className="pa-score-card__head">
              <div>
                <div className="pa-score-card__title">Home Readiness Score</div>
                <div className="pa-score-card__sub">Based on your {statementSource === 'statement' ? 'verified statement' : 'entered figures'}</div>
              </div>
              <ScoreGauge score={readiness.score} />
            </div>
            <div className="pa-score-components">
              {Object.values(readiness.components).map(c => {
                const safeScore = Math.max(0, Math.min(c.score, c.max));
                return (
                  <div key={c.label} className="pa-score-comp">
                    <div className="pa-score-comp__label">{c.label}</div>
                    <div className="pa-score-comp__bar">
                      <div className="pa-score-comp__fill" style={{ width: `${(safeScore / c.max) * 100}%` }} />
                    </div>
                    <div className="pa-score-comp__val">{safeScore}/{c.max}</div>
                  </div>
                );
              })}
            </div>
            {totalUpside > 0 && (
              <div className="pa-score-card__upside">
                Following our recommendations could unlock up to <strong>{fmt(totalUpside)}</strong> more borrowing power
              </div>
            )}
          </div>
        )}

        {/* ── Deeper-insight teaser gate ──────────────────────────────────────
            For anonymous users, lock the deeper insights (statement summary +
            spending breakdown + risk/red-flag cards) behind a free-account gate.
            The affordability number + ScoreGauge above stay fully visible. */}
        <div className={!isLoggedIn ? 'pa-teaser-lock' : undefined}>
          {!isLoggedIn && (
            <div className="pa-teaser-gate">
              <div className="pa-teaser-gate__icon">🔒</div>
              <div className="pa-teaser-gate__title">Unlock your full Financial Profile</div>
              <div className="pa-teaser-gate__sub">
                See your spending breakdown, peer comparison and bank red-flag analysis — free.
              </div>
              <Button variant="lime" full onClick={() => {
                trackAction('preapproval_cta_clicked', { step: 3 });
                persistForTeaserGate();
                navigate('/register?intent=preapproval');
              }}>
                Create a free account &amp; continue
              </Button>
            </div>
          )}
          <div className={!isLoggedIn ? 'pa-teaser-lock__content' : undefined} aria-hidden={!isLoggedIn || undefined}>
        {/* No-income statement summary */}
        {d && !d.income?.detected && (d.expenses?.breakdown || d.debts?.totalMonthly > 0 || d.accountBalance > 0) && (
          <div className="pa-statement-found fade-in" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="pa-statement-found__title">From your bank statement</div>
            <div className="pa-statement-found__grid">
              {d.accountBalance > 0 && (
                <div className="pa-statement-found__item">
                  <div className="pa-statement-found__label">Account balance</div>
                  <div className="pa-statement-found__val">{fmt(d.accountBalance)}</div>
                </div>
              )}
              {d.expenses?.total > 0 && (
                <div className="pa-statement-found__item">
                  <div className="pa-statement-found__label">Monthly expenses</div>
                  <div className="pa-statement-found__val">{fmt(d.expenses.total)}<span>/mo</span></div>
                </div>
              )}
              {d.existingMortgage?.detected && d.existingMortgage.avgAmount > 0 && (
                <div className="pa-statement-found__item">
                  <div className="pa-statement-found__label">Current bond</div>
                  <div className="pa-statement-found__val">{fmt(d.existingMortgage.avgAmount)}<span>/mo</span></div>
                </div>
              )}
              {d.debts?.totalMonthly > 0 && (
                <div className="pa-statement-found__item">
                  <div className="pa-statement-found__label">Other debt</div>
                  <div className="pa-statement-found__val">{fmt(d.debts.totalMonthly)}<span>/mo</span></div>
                </div>
              )}
            </div>
            {d.expenses?.breakdown && Object.entries(d.expenses.breakdown).filter(([, v]) => v > 0).length > 0 && (
              <div className="pa-section" style={{ marginTop: 'var(--space-4)' }}>
                <div className="pa-section__title"><BarChart2 size={18} style={{display:'inline',verticalAlign:'middle',marginRight:8}}/>Your Spending Breakdown</div>
                <div className="pa-spend-list">
                  {Object.entries(d.expenses.breakdown).map(([cat, amt]) => {
                    if (!amt) return null;
                    return (
                      <SpendingRow key={cat} cat={cat} userAmount={amt} peerAmount={0} overSpend={false} overSpendPct={0} />
                    );
                  })}
                </div>
              </div>
            )}
            <div className="pa-info-box pa-info-box--amber" style={{ marginTop: 'var(--space-4)' }}>
              Income wasn't detected in this statement — enter it on the previous screen to calculate your bond affordability.
            </div>
          </div>
        )}

        {/* Risk flag warning cards — non-blocking, shown when gambling or payday detected */}
        {riskFlags.gambling?.detected && riskFlags.gambling.monthly_total > 0 && (
          <div className="pa-info-box pa-risk-flag" style={{ marginBottom: 'var(--space-3)', background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.30)', borderRadius: 10, padding: 'var(--space-4)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>⚠ Gambling activity detected — {fmt(riskFlags.gambling.monthly_total)}/mo</div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              SA banks use a 6-month lookback and flag any gambling activity. This will trigger a manual review and significantly reduces approval likelihood — even with a strong income. Stop all gambling transactions at least 3 months before applying.
            </div>
          </div>
        )}
        {riskFlags.payday?.detected && (
          <div className="pa-info-box pa-risk-flag" style={{ marginBottom: 'var(--space-3)', background: 'rgba(245,158,11,0.08)', border: '1px solid rgba(245,158,11,0.30)', borderRadius: 10, padding: 'var(--space-4)' }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>
              ⚠ Short-term loan detected — {riskFlags.payday.lenders?.[0]?.name || 'high-cost lender'}{riskFlags.payday.monthly_total > 0 ? ` · ${fmt(riskFlags.payday.monthly_total)}/mo` : ''}
            </div>
            <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
              SA banks treat payday and short-term borrowing as a high-risk signal. Settle this loan and allow 3 months of clean statements before applying for a home loan.
            </div>
          </div>
        )}
          </div>
        </div>

        {/* Simple bond summary when no full analysis */}
        {!readiness && bondAmt > 0 && (
          <div className="pa-info-box pa-info-box--blue" style={{ marginBottom: 'var(--space-4)' }}>
            Upload a bank statement to get your full Home Readiness Score, spending breakdown, and personalised recommendations.
          </div>
        )}

        <div className="pa-bond-summary">
          <div className="pa-bond-summary__item">
            <div className="pa-bond-summary__label">Maximum bond</div>
            <div className="pa-bond-summary__val">{fmt(bondAmt)}</div>
          </div>
          <div className="pa-bond-summary__divider" />
          <div className="pa-bond-summary__item">
            <div className="pa-bond-summary__label">Monthly payment</div>
            <div className="pa-bond-summary__val">{fmt(Math.round(monthlyPmt))}<span>/mo</span></div>
          </div>
          {dep > 0 && (
            <>
              <div className="pa-bond-summary__divider" />
              <div className="pa-bond-summary__item">
                <div className="pa-bond-summary__label">How much you could borrow</div>
                <div className="pa-bond-summary__val pa-bond-summary__val--highlight">{fmt(buyingPower)}</div>
              </div>
            </>
          )}
        </div>

        <PropertySearchCTA maxBond={bondAmt} defaultExpanded />

        {profile && (
          <div className="pa-metrics-row">
            <div className="pa-metric">
              <div className="pa-metric__label">Risk grade</div>
              <div className="pa-metric__val" style={{ color: profile.color }}>{profile.grade}</div>
            </div>
            <div className="pa-metric">
              <div className="pa-metric__label">Debt-to-income</div>
              <div className="pa-metric__val">{profile.dti}%</div>
            </div>
            {profile.netDisposable !== null && (
              <div className="pa-metric">
                {/* Without a statement we have no living-expense data, so netDisposable
                    is income − debt only (i.e. before living costs). Label it honestly
                    so gross income is never presented as true spare cash. */}
                <div className="pa-metric__label">
                  {Object.keys(expenses).length > 0 ? 'Net disposable' : 'Net disposable (before living costs)'}
                </div>
                <div className="pa-metric__val">{fmt(profile.netDisposable)}<span>/mo</span></div>
              </div>
            )}
          </div>
        )}

        {Object.keys(expenses).length > 0 && (() => {
          const incomeConf = d?.income?.confidence;
          const incomeOk = detectedIncomeAmt >= 3000 && incomeConf !== 'none';
          const hasPeerData = incomeOk && Object.keys(benchmarks).length > 0;
          return (
            <div className="pa-section">
              <div className="pa-section__title"><BarChart2 size={18} style={{display:'inline',verticalAlign:'middle',marginRight:8}}/>Your Spending Breakdown</div>
              {hasPeerData
                ? <div className="pa-section__sub">Comparing you to similar earners</div>
                : <div className="pa-section__sub" style={{ color: 'var(--color-warning, #d97706)' }}>
                    Spending amounts shown — peer comparison requires a clearer statement upload
                  </div>
              }
              <div className="pa-spend-list">
                {Object.entries(expenses).map(([cat, amt]) => {
                  if (!amt || amt <= 0) return null;
                  return (
                    <SpendingRow
                      key={cat}
                      cat={cat}
                      userAmount={Math.max(0, amt)}
                      peerAmount={hasPeerData ? (benchmarks[cat]?.peerAmount || 0) : 0}
                      overSpend={hasPeerData ? (benchmarks[cat]?.overSpend || false) : false}
                      overSpendPct={hasPeerData ? (benchmarks[cat]?.overSpendPct || 0) : 0}
                    />
                  );
                })}
              </div>
            </div>
          );
        })()}

        {opts.length > 0 && (
          <div className="pa-section">
            <div className="pa-section__title"><Target size={18} style={{display:'inline',verticalAlign:'middle',marginRight:8}}/>How to improve your score</div>
            <div className="pa-section__sub">Personalised recommendations based on your data</div>
            <div className="pa-opt-list">
              {opts.map((opt, i) => <OptCard key={i} opt={opt} />)}
            </div>
          </div>
        )}

        {zone?.zone !== 'red' && bondAmt > 0 && (
          <div className="pa-hook-box">
            <div className="pa-hook-box__icon"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></div>
            <div className="pa-hook-box__text">
              {zone?.zone === 'green'
                ? `You qualify for properties up to ${fmt(buyingPower || bondAmt)}. Bondly can submit to multiple banks simultaneously to get you the best rate.`
                : `You're ${fmt(Math.max(0, 700000 - bondAmt))} away from the Green Zone. Follow the recommendations above to be able to borrow more.`}
            </div>
          </div>
        )}

        <InlineFeedback context="preapproval_step3" label="Does this affordability result look right?" />

        {/* Low-bond nudge */}
        {bondAmt > 0 && bondAmt < 600000 && (
          <div style={{ background: 'rgba(200,168,75,0.07)', border: '1px solid rgba(200,168,75,0.22)', borderRadius: 10, padding: '16px 18px', marginTop: 8, marginBottom: 4 }}>
            <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 6 }}>Build your borrowing capacity first</div>
            <p style={{ margin: '0 0 12px', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.6 }}>
              At {fmt(bondAmt)} your options in most SA markets are limited. Our free financial optimizer analyses your income and debts and gives you a personalised plan — showing exactly what to change to qualify for more.
            </p>
            <Button variant="lime" onClick={() => {
              if (analysis) {
                try { sessionStorage.setItem('bondly_optimizer_from_pa', JSON.stringify(analysis)); } catch {}
              }
              navigate('/optimize');
            }}>See my improvement plan →</Button>
          </div>
        )}

        <div className="pa-results-sticky-cta">
          <Button variant="lime" full onClick={() => { trackAction('preapproval_cta_clicked', { step: 3 }); setStep(4); }}>
            {unlockedFromGate ? 'Continue to application →' : "Get pre-approved — it's free →"}
          </Button>
        </div>

        <div className="pa-results-cta pa-results-cta--desktop">
          <Button variant="lime" full onClick={() => { trackAction('preapproval_cta_clicked', { step: 3 }); setStep(4); }}>
            {unlockedFromGate ? 'Continue to application →' : "Get pre-approved — it's free →"}
          </Button>
          {bondAmt > 0 && (
            <button
              type="button"
              className="pa-compare-btn"
              onClick={() => navigate(`/tools?tool=rent-vs-buy&price=${Math.round(buyingPower || bondAmt)}&deposit=${Math.round(dep)}`)}
            >
              <span className="pa-compare-btn__icon"><BarChart2 size={18}/></span>
              <span className="pa-compare-btn__text">
                <strong>Compare my net worth as a buyer vs renter</strong>
                <span>See how {fmt(buyingPower || bondAmt)} in property compares to renting over time</span>
              </span>
              <span className="pa-compare-btn__arrow">→</span>
            </button>
          )}
          {isLoggedIn
            ? <Button variant="ghost" onClick={() => navigate('/dashboard')}>View my dashboard</Button>
            : <Button variant="ghost" onClick={() => navigate('/register?intent=preapproval')}>Create a free account</Button>
          }
        </div>

        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', marginTop: 'var(--space-4)', lineHeight: 1.6 }}>
          This analysis uses SA NCA affordability standards. Results are indicative — final approval is subject to formal bank assessment.
        </p>
      </div>
    );
  }

  // ── Step 4: Contact form ───────────────────────────────────────────────────
  async function submit() {
    if (!form.name.trim())  { showToast('Please enter your name', 'error');         return; }
    if (!form.phone.trim()) { showToast('Please enter your phone number', 'error'); return; }
    const digits = form.phone.replace(/\s+/g, '');
    if (!/^(\+27|0)[6-8]\d{8}$/.test(digits)) {
      showToast('Please enter a valid SA mobile number, e.g. 082 000 0000', 'error');
      return;
    }
    setSubmitting(true);
    try {
      const qual = analysis?.qualification;
      const payload = {
        type: 'preapproval',
        source: 'preapproval_form',
        monthlyIncome:     parseNum(form.income),
        debt:              parseNum(form.debt),
        deposit:           parseNum(form.deposit),
        employment:        empType,
        propertyType:      propType,
        hasProperty:       form.hasProperty,
        propertyAddress:   form.propertyAddress || null,
        purchasePrice:     form.purchasePrice ? parseFloat(form.purchasePrice) : null,
        hasOtp:            form.hasOtp,
        maxBond:           qualifyingBond || qual?.maxBond,
        statementVerified: !!analysis,
        affordabilityZone: analysis?.affordabilityZone?.zone,
        homeReadinessScore: analysis?.readiness?.score,
        name:          form.name,
        phone:         form.phone,
        email:         form.email,
        idNumber:      form.idNumber || null,
        contactMethod:  form.contact,
        maritalStatus:  form.maritalStatus  || null,
        marriageType:   form.marriageType   || null,
        dependants:     form.dependants     || null,
      };
      if (isLoggedIn) {
        await applications.create(payload);
      } else {
        await leads.submit(payload);
      }
      trackAction('preapproval_submitted', { isLoggedIn, income: inc });
      setStep('done');
    } catch (err) {
      trackAction('preapproval_submit_failed', { error: String(err.message).slice(0, 80) });
      showToast(err.message || 'Could not submit — please try again', 'error');
    } finally {
      setSubmitting(false);
    }
  }

  // Unified Submit — routes by intent (Step 2.3 reconciliation rule):
  //  • banks selected  → submitBondApp() (bond_application payload, → 'app_done')
  //  • no banks         → submit() (preapproval payload, routed by isLoggedIn, → 'done')
  // Both functions stay logically distinct; payload shapes preserved byte-for-byte.
  function submitApplication() {
    if (bondApp.banks.length > 0) return submitBondApp();
    return submit();
  }

  const APPLICATION_STEPS = ['Affordability', 'Property', 'Details', 'Documents', 'Submit'];
  const ALL_BANKS = ['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'Investec', 'SA Home Loans'];

  function renderStep4() {
    const bondAmt = qualifyingBond || analysis?.qualification?.maxBond || 0;
    function toggleBank(bank) {
      setBondApp(a => ({
        ...a,
        banks: a.banks.includes(bank) ? a.banks.filter(b => b !== bank) : [...a.banks, bank],
      }));
    }
    return (
      <div className="fade-in">
        <StepProgress steps={APPLICATION_STEPS} current={2} />
        <h1 className="preapproval-title">{START_APPLICATION}</h1>
        <p className="preapproval-sub">
          A Bondly advisor will contact you with competing offers from all 7 SA banks — free of charge.
        </p>

        {bondAmt > 0 && (
          <div className="pa-estimate-box" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="pa-estimate-label">Your maximum bond</div>
            <div className="pa-estimate-amount">{fmt(bondAmt)}</div>
            {dep > 0 && <div style={{ fontSize: '0.875rem', color: 'var(--mint)', marginTop: 2 }}>+ {fmt(dep)} deposit = {fmt(bondAmt + dep)} total budget</div>}
            <div className="pa-estimate-monthly">{fmt(calcMonthly(bondAmt, livePrime, 20))}/month at prime ({livePrime}%)</div>
          </div>
        )}

        <PropertySearchCTA maxBond={bondAmt} defaultExpanded />

        <Card style={{ marginBottom: 'var(--space-4)' }}>
          <CardBody>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 'var(--space-4)', color: 'var(--text-primary)' }}>Your details</div>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <Input label="Full name" id="pa-name" type="text" value={form.name}
                onChange={set('name')} placeholder="Jane Smith" required autoFocus />
              <div>
                <Input label="SA ID number" id="pa-id" type="text" inputMode="numeric"
                  value={form.idNumber} onChange={set('idNumber')} placeholder="e.g. 9001015009087" />
                <p style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', margin: '4px 0 0', lineHeight: 1.5 }}>
                  13-digit SA ID — required by banks for a formal bond application
                </p>
              </div>
              <Input label="Mobile number" id="pa-phone" type="tel" value={form.phone}
                onChange={set('phone')} placeholder="082 000 0000" required />
              <Input label="Email address" id="pa-email" type="email" value={form.email}
                onChange={set('email')} placeholder="jane@example.com" />
              <div>
                <div className="field__label">Preferred contact method</div>
                <div className="pa-contact-chips">
                  {['WhatsApp', 'Phone call', 'Email'].map(m => (
                    <button key={m} type="button"
                      className={`pa-chip ${form.contact === m ? 'pa-chip--active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, contact: m }))}>
                      {m}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="field__label">Marital status</div>
                <div className="pa-contact-chips">
                  {['Single', 'Married', 'Divorced / Widowed'].map(s => (
                    <button key={s} type="button"
                      className={`pa-chip ${form.maritalStatus === s ? 'pa-chip--active' : ''}`}
                      onClick={() => setForm(f => ({ ...f, maritalStatus: s, marriageType: s === 'Married' ? f.marriageType : '' }))}>
                      {s}
                    </button>
                  ))}
                </div>
                {form.maritalStatus === 'Married' && (
                  <div className="pa-contact-chips fade-in" style={{ marginTop: 'var(--space-2)' }}>
                    {['In community of property', 'Out of COP (antenuptial contract)'].map(t => (
                      <button key={t} type="button"
                        className={`pa-chip ${form.marriageType === t ? 'pa-chip--active' : ''}`}
                        onClick={() => setForm(f => ({ ...f, marriageType: t }))}>
                        {t}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card style={{ marginBottom: 'var(--space-5)' }}>
          <CardBody>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 'var(--space-3)', color: 'var(--text-primary)' }}>
              Do you have a specific property in mind?
            </div>
            <div className="pa-contact-chips" style={{ marginBottom: 'var(--space-3)' }}>
              {['Yes', 'No — just browsing'].map(v => (
                <button key={v} type="button"
                  className={`pa-chip ${(v === 'Yes') === form.hasProperty ? 'pa-chip--active' : ''}`}
                  onClick={() => setForm(f => ({ ...f, hasProperty: v === 'Yes' }))}>
                  {v}
                </button>
              ))}
            </div>
            {form.hasProperty && (
              <div style={{ display: 'grid', gap: 'var(--space-3)' }} className="fade-in">
                <Input label="Property address" id="pa-addr" type="text" value={form.propertyAddress}
                  onChange={e => { setForm(f => ({ ...f, propertyAddress: e.target.value })); setBondApp(a => ({ ...a, propertyAddress: e.target.value })); }} placeholder="12 Main Road, Cape Town" />
                <Input label="Purchase price (R)" id="pa-price" type="number" value={form.purchasePrice}
                  onChange={e => { setForm(f => ({ ...f, purchasePrice: e.target.value })); setBondApp(a => ({ ...a, purchasePrice: e.target.value })); }} placeholder="1500000" />
                <div>
                  <div className="field__label">Offer to Purchase (OTP) signed?</div>
                  <div className="pa-contact-chips">
                    {['Yes', 'Not yet'].map(v => (
                      <button key={v} type="button"
                        className={`pa-chip ${(v === 'Yes') === form.hasOtp ? 'pa-chip--active' : ''}`}
                        onClick={() => { setForm(f => ({ ...f, hasOtp: v === 'Yes' })); setBondApp(a => ({ ...a, otpSigned: v === 'Yes' })); }}>
                        {v}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </CardBody>
        </Card>

        {/* Documents (optional) — no hard blocker; Submit reachable without docs */}
        <Card style={{ marginBottom: 'var(--space-4)' }}>
          <CardBody>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
              Supporting documents <span className="pa-field__optional">(optional)</span>
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0, lineHeight: 1.5 }}>
              You can submit now and add documents later — your advisor will request anything still needed (ID, payslips, bank statements) when they contact you.
            </p>
          </CardBody>
        </Card>

        {/* Banks — selecting banks switches this into a full bond-application submission */}
        <Card style={{ marginBottom: 'var(--space-4)' }}>
          <CardBody>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>Submit to these banks</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-4)' }}>
              Select banks to submit a full application now, or leave all unselected to just get your pre-qualification certificate.
            </p>
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {ALL_BANKS.map(bank => (
                <label key={bank} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 8, border: bondApp.banks.includes(bank) ? '1px solid var(--lime)' : '1px solid var(--border-color)', background: bondApp.banks.includes(bank) ? 'rgba(163,230,53,0.06)' : 'transparent', transition: 'all 0.15s' }}>
                  <input type="checkbox" checked={bondApp.banks.includes(bank)} onChange={() => toggleBank(bank)}
                    style={{ width: 16, height: 16, accentColor: 'var(--lime)', cursor: 'pointer' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{bank}</span>
                </label>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 'var(--space-3) 0 0' }}>
              {bondApp.banks.length} bank{bondApp.banks.length !== 1 ? 's' : ''} selected
            </p>
          </CardBody>
        </Card>

        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)', padding: '10px 14px', background: 'var(--bg-page)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
          <strong style={{ display: 'block', marginBottom: 6, color: 'var(--text-primary)', fontSize: '0.875rem' }}>What happens next:</strong>
          <ol style={{ margin: 0, paddingLeft: 18, lineHeight: 1.7 }}>
            <li>Bondly submits your application directly to all 7 SA banks</li>
            <li>A Bondly advisor contacts you within 48 hours with competing offers</li>
            <li>No obligation — free to proceed or decline</li>
          </ol>
          <a href="/guarantee" style={{ color: 'var(--mint)', textDecoration: 'underline', fontSize: '0.8125rem', display: 'block', marginTop: 8 }}>Covered by our Best Rate Guarantee →</a>
        </div>
        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <Button variant="ghost" onClick={() => setStep(3)}>← Back</Button>
          <Button variant="lime" full loading={submitting || submittingApp} onClick={submitApplication}>
            {bondApp.banks.length > 0
              ? `Submit to ${bondApp.banks.length} bank${bondApp.banks.length !== 1 ? 's' : ''} →`
              : 'Submit & get my certificate →'}
          </Button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          By submitting you agree to our{" "}
          <Link to="/terms" style={{ textDecoration: 'underline' }}>Terms</Link>{" "}and{" "}
          <Link to="/privacy" style={{ textDecoration: 'underline' }}>Privacy Policy</Link>.
          No credit check at this stage — a formal credit check is only done by the bank when you accept an offer.
        </p>
      </div>
    );
  }
  // ── Stage 2: Submit to banks ───────────────────────────────────────────────
  async function submitBondApp() {
    if (!bondApp.propertyAddress.trim()) { showToast('Please enter the property address', 'error'); return; }
    if (!bondApp.purchasePrice)           { showToast('Please enter the purchase price', 'error'); return; }
    if (bondApp.banks.length === 0)       { showToast('Please select at least one bank', 'error'); return; }
    setSubmittingApp(true);
    try {
      const bondAmt = qualifyingBond || analysis?.qualification?.maxBond || 0;
      await leads.submit({
        source:          'bond_application',
        purpose:         'buy',
        name:            form.name,
        phone:           form.phone,
        email:           form.email,
        contactMethod:   form.contact,
        monthlyIncome:   parseNum(form.income),
        employment:      empType,
        existingDebt:    parseNum(form.debt),
        deposit:         parseNum(form.deposit),
        maxBond:         bondAmt,
        statementVerified: !!analysis,
        affordabilityZone:  analysis?.affordabilityZone?.zone,
        homeReadinessScore: analysis?.readiness?.score,
        maritalStatus:   form.maritalStatus || null,
        marriageType:    form.marriageType  || null,
        propertyAddress: bondApp.propertyAddress,
        purchasePrice:   parseFloat(bondApp.purchasePrice),
        propertyType:    bondApp.propertyType,
        hasOtp:          bondApp.otpSigned,
        selectedBanks:   bondApp.banks.join(', '),
        type:            'bond_application',
      });
      setStep('app_done');
    } catch (err) {
      showToast(err.message || 'Could not submit — please try again', 'error');
    } finally {
      setSubmittingApp(false);
    }
  }

  function renderStepApply() {
    const bondAmt = qualifyingBond || analysis?.qualification?.maxBond || 0;
    const ALL_BANKS = ['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'Investec', 'SA Home Loans'];
    function toggleBank(bank) {
      setBondApp(a => ({
        ...a,
        banks: a.banks.includes(bank) ? a.banks.filter(b => b !== bank) : [...a.banks, bank],
      }));
    }
    return (
      <div className="fade-in">
        <h1 className="preapproval-title">Submit your bond application</h1>
        <p className="preapproval-sub">
          We'll submit to all selected banks simultaneously. You typically hear back within 2–3 business days.
        </p>

        {bondAmt > 0 && (
          <div className="pa-estimate-box" style={{ marginBottom: 'var(--space-4)' }}>
            <div className="pa-estimate-label">Pre-approved up to</div>
            <div className="pa-estimate-amount">{fmt(bondAmt)}</div>
          </div>
        )}

        <Card style={{ marginBottom: 'var(--space-4)' }}>
          <CardBody>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>Property details</div>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <Input label="Property address" id="ba-addr" type="text"
                value={bondApp.propertyAddress}
                onChange={e => setBondApp(a => ({ ...a, propertyAddress: e.target.value }))}
                placeholder="12 Main Road, Cape Town, 8001" required />
              <Input label="Purchase price (R)" id="ba-price" type="number"
                value={bondApp.purchasePrice}
                onChange={e => setBondApp(a => ({ ...a, purchasePrice: e.target.value }))}
                placeholder="1500000" required />
              <div>
                <div className="field__label">Property type</div>
                <div className="pa-contact-chips">
                  {['Freehold', 'Sectional title', 'Share block', 'Agricultural'].map(t => (
                    <button key={t} type="button"
                      className={`pa-chip ${bondApp.propertyType === t.toLowerCase().replace(' ', '_') ? 'pa-chip--active' : ''}`}
                      onClick={() => setBondApp(a => ({ ...a, propertyType: t.toLowerCase().replace(' ', '_') }))}>
                      {t}
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <div className="field__label">Offer to Purchase (OTP)</div>
                <div className="pa-contact-chips">
                  {['Signed', 'Not yet signed'].map(v => (
                    <button key={v} type="button"
                      className={`pa-chip ${bondApp.otpSigned === (v === 'Signed') ? 'pa-chip--active' : ''}`}
                      onClick={() => setBondApp(a => ({ ...a, otpSigned: v === 'Signed' }))}>
                      {v}
                    </button>
                  ))}
                </div>
                {!bondApp.otpSigned && (
                  <p className="fade-in" style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 'var(--space-2) 0 0' }}>
                    You can still submit — your advisor will guide you through signing the OTP.
                  </p>
                )}
              </div>
            </div>
          </CardBody>
        </Card>

        <Card style={{ marginBottom: 'var(--space-5)' }}>
          <CardBody>
            <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>Submit to these banks</div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: '0 0 var(--space-4)' }}>
              All 7 selected by default — more banks means better chances of approval and competitive rates.
            </p>
            <div style={{ display: 'grid', gap: 'var(--space-2)' }}>
              {ALL_BANKS.map(bank => (
                <label key={bank} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', cursor: 'pointer', padding: 'var(--space-3)', borderRadius: 8, border: bondApp.banks.includes(bank) ? '1px solid var(--lime)' : '1px solid var(--border-color)', background: bondApp.banks.includes(bank) ? 'rgba(163,230,53,0.06)' : 'transparent', transition: 'all 0.15s' }}>
                  <input type="checkbox" checked={bondApp.banks.includes(bank)} onChange={() => toggleBank(bank)}
                    style={{ width: 16, height: 16, accentColor: 'var(--lime)', cursor: 'pointer' }} />
                  <span style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{bank}</span>
                </label>
              ))}
            </div>
            <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', margin: 'var(--space-3) 0 0' }}>
              {bondApp.banks.length} bank{bondApp.banks.length !== 1 ? 's' : ''} selected
            </p>
          </CardBody>
        </Card>

        <div style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <Button variant="ghost" onClick={() => setStep('done')}>← Back</Button>
          <Button variant="lime" full loading={submittingApp} onClick={submitBondApp}>
            Submit to {bondApp.banks.length} bank{bondApp.banks.length !== 1 ? 's' : ''} →
          </Button>
        </div>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5, margin: 0 }}>
          No upfront fees. Bondly is paid a referral fee by the bank only if your bond is approved.
        </p>
      </div>
    );
  }

  // ── Stage 2 done ────────────────────────────────────────────────────────────
  if (step === 'app_done') {
    return (
      <div className="page preapproval-page">
        <div className="container container--narrow">
          <div className="fade-in" style={{ textAlign: 'center', padding: 'var(--space-8) 0' }}>
            <div style={{ fontSize: '3rem', marginBottom: 'var(--space-4)' }}>🎉</div>
            <h1 className="preapproval-title">Application submitted!</h1>
            <p className="preapproval-sub">
              Your bond application has been sent to <strong>{bondApp.banks.length} bank{bondApp.banks.length !== 1 ? 's' : ''}</strong>.<br />
              A Bondly advisor will contact you via <strong>{form.contact}</strong> within 2–4 business hours to confirm and track your applications.
            </p>
            <div style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 12, padding: 'var(--space-5)', margin: 'var(--space-6) 0', textAlign: 'left' }}>
              <div style={{ fontWeight: 700, marginBottom: 'var(--space-3)', fontSize: '0.875rem' }}>What happens next</div>
              {[
                { num: '1', text: 'Your advisor reviews your application and contacts you to confirm details.' },
                { num: '2', text: 'Applications submitted to ' + bondApp.banks.join(', ') + '.' },
                { num: '3', text: 'Banks respond with conditional offers — typically 2–3 business days.' },
                { num: '4', text: 'Bondly presents all offers side-by-side and helps you choose the best rate.' },
              ].map(({ num, text }) => (
                <div key={num} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'flex-start' }}>
                  <div style={{ width: 24, height: 24, borderRadius: '50%', background: 'var(--lime)', color: 'var(--forest)', fontWeight: 800, fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{num}</div>
                  <span style={{ fontSize: '0.9375rem', lineHeight: 1.5 }}>{text}</span>
                </div>
              ))}
            </div>
            {isLoggedIn
              ? <Button variant="lime" onClick={() => navigate('/dashboard')}>Go to dashboard →</Button>
              : <Button variant="lime" onClick={() => navigate('/register?intent=preapproval')}>Create an account to track your application →</Button>
            }
          </div>
        </div>
      </div>
    );
  }

  // ── Done ───────────────────────────────────────────────────────────────────
  if (step === 'done') {
    const bondAmt  = qualifyingBond || analysis?.qualification?.maxBond || 0;
    const certBondAmt = Math.round(bondAmt / 1000) * 1000; // round to nearest R1000 so numeral and words always match
    const monthly  = bondAmt > 0 ? calcMonthly(bondAmt, livePrime, 20) : 0;
    const issuedAt = new Date();
    const validUntil = new Date(issuedAt.getTime() + 90 * 24 * 60 * 60 * 1000);
    const fmtDate  = d => d.toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });

    function numberToWords(n) {
      if (!n || n <= 0) return '';
      const ones = ['','one','two','three','four','five','six','seven','eight','nine','ten','eleven','twelve','thirteen','fourteen','fifteen','sixteen','seventeen','eighteen','nineteen'];
      const tens = ['','','twenty','thirty','forty','fifty','sixty','seventy','eighty','ninety'];
      function chunk(num) {
        if (num < 20) return ones[num];
        if (num < 100) return tens[Math.floor(num/10)] + (num%10 ? '-'+ones[num%10] : '');
        return ones[Math.floor(num/100)] + ' hundred' + (num%100 ? ' and '+chunk(num%100) : '');
      }
      const m = Math.round(n / 1000);
      if (m >= 1000) return chunk(Math.floor(m/1000)) + ' million' + (m%1000 ? ' '+chunk(m%1000) : '') + ' thousand rand';
      if (m > 0) return chunk(m) + ' thousand rand';
      return chunk(Math.round(n)) + ' rand';
    }

    function shareWhatsApp() {
      const msg = `Hi! I've been pre-qualified by Bondly for a home loan of up to ${fmt(bondAmt)} — monthly repayment approximately ${fmt(monthly)}/month. bondly.co.za`;
      window.open('https://wa.me/?text=' + encodeURIComponent(msg), '_blank');
    }

    async function generateShareLink() {
      if (shareLink) { navigator.clipboard?.writeText(shareLink); showToast('Link copied!', 'success'); return; }
      setShareLoading(true);
      try {
        const tok = localStorage.getItem('bondly_token');
        const r = await fetch('/api/preapproval/letter', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', ...(tok ? { Authorization: 'Bearer ' + tok } : {}) },
          body: JSON.stringify({ bondAmount: Math.round(bondAmt), propertyAddress: form.propertyAddress || 'Property as negotiated', purchasePrice: form.purchasePrice || null }),
        });
        const token = r.headers.get('X-Share-Token');
        if (!token) throw new Error('Could not generate link');
        const link = `${window.location.origin}/letter/${token}`;
        setShareLink(link);
        navigator.clipboard?.writeText(link);
        showToast('Share link copied to clipboard!', 'success');
      } catch { showToast('Could not generate share link', 'error'); }
      finally { setShareLoading(false); }
    }

    return (
      <div className="page preapproval-page">
        <div className="container container--narrow">
          <div className="prequal-cert-actions no-print">
            <div style={{ display:'flex', gap:'var(--space-3)', flexWrap:'wrap', marginBottom:'var(--space-4)' }}>
              <button className="prequal-print-btn" onClick={() => window.print()}>
                🖨 Print / Save as PDF
              </button>
              <button className="prequal-share-btn" onClick={shareWhatsApp}>
                📲 Share via WhatsApp
              </button>
              {isLoggedIn && bondAmt > 0 && (
                <button className="prequal-share-btn" onClick={generateShareLink} disabled={shareLoading} style={{ background: 'var(--forest)', color: 'var(--lime)' }}>
                  {shareLoading ? '…' : shareLink ? '✓ Link copied' : '🔗 Copy share link'}
                </button>
              )}
              {isLoggedIn
                ? <Button variant="ghost" size="sm" onClick={() => navigate('/dashboard')}>Go to dashboard →</Button>
                : <Button variant="ghost" size="sm" onClick={() => navigate('/register?intent=preapproval')}>Create account →</Button>
              }
            </div>
            <p style={{ fontSize:'0.75rem', color:'var(--text-secondary)', margin:0 }}>
              ✓ A Bondly advisor will contact you via <strong>{form.contact}</strong> — typically within a few hours.
            </p>
          </div>

          <div className="prequal-cert fade-in">
            <div className="prequal-cert__header">
              <div className="prequal-cert__logo">
                <svg width="18" height="18" viewBox="0 0 100 100" fill="currentColor" aria-hidden="true" style={{ display:'inline-block', verticalAlign:'middle', marginRight:6 }}>
                  <path fillRule="evenodd" d="M50,14 L89,52 L83,52 L83,82 L17,82 L17,52 L11,52 Z M42,82 L42,70 A8,8 0 0,1 58,70 L58,82 Z M22,54 L35,54 L35,66 L22,66 Z M65,54 L78,54 L78,66 L65,66 Z" />
                </svg>
                Bondly
              </div>
              <div className="prequal-cert__title">Pre-Qualification Certificate</div>
            </div>

            <div className="prequal-cert__meta">
              <span>Issued: {fmtDate(issuedAt)}</span>
              <span className="prequal-cert__valid">Valid until: {fmtDate(validUntil)}</span>
            </div>

            <div className="prequal-cert__body">
              <p className="prequal-cert__prepared">This certifies that</p>
              <h2 className="prequal-cert__name">{form.name || 'Applicant'}</h2>
              <p className="prequal-cert__sub">has been pre-qualified for a home loan of up to</p>

              {bondAmt > 0 ? (
                <>
                  <div className="prequal-cert__amount">{fmt(certBondAmt)}</div>
                  <div className="prequal-cert__words">{numberToWords(certBondAmt).toUpperCase()}</div>
                </>
              ) : (
                <div className="prequal-cert__amount">—</div>
              )}

              <div className="prequal-cert__divider" />

              <div className="prequal-cert__details">
                {monthly > 0 && (
                  <div className="prequal-cert__detail-row">
                    <span>Monthly repayment estimate</span>
                    <strong>{fmt(monthly)}/month at prime {livePrime}% over 20 years</strong>
                  </div>
                )}
                {dep > 0 && (
                  <div className="prequal-cert__detail-row">
                    <span>Maximum purchasing power</span>
                    <strong>{fmt(bondAmt + dep)} (bond + {fmt(dep)} deposit)</strong>
                  </div>
                )}
                <div className="prequal-cert__detail-row">
                  <span>Income verification</span>
                  <strong>{statementSource === 'statement' && analysis ? '✓ Bank statement verified' : 'Self-declared'}</strong>
                </div>
                <div className="prequal-cert__detail-row">
                  <span>Employment type</span>
                  <strong>{empType === 'self_employed' ? 'Self-employed / Commission' : empType === 'contract' ? 'Contract' : 'Salaried'}</strong>
                </div>
                {form.hasProperty && form.propertyAddress && (
                  <div className="prequal-cert__detail-row">
                    <span>Property</span>
                    <strong>{form.propertyAddress}{form.purchasePrice ? ' · R ' + parseInt(form.purchasePrice).toLocaleString('en-ZA') : ''}</strong>
                  </div>
                )}
              </div>

              <div className="prequal-cert__divider" />

              <div className="prequal-cert__conditions">
                <p><strong>This pre-qualification is subject to:</strong></p>
                <ul>
                  <li>Final credit bureau assessment by the lending institution</li>
                  <li>Formal bond application and bank approval</li>
                  <li>Property valuation by the lending institution</li>
                  <li>NCA affordability assessment at point of application</li>
                  {form.hasProperty && !form.hasOtp && <li>A signed Offer to Purchase will be required at formal application stage</li>}
                </ul>
              </div>
            </div>

            <div className="prequal-cert__footer">
              <div className="prequal-cert__footer-brand">Bondly · NCA Compliant · bondly.co.za</div>
              <div className="prequal-cert__footer-disc">This certificate does not constitute a formal bond approval or guarantee of financing. Rates shown are indicative at current prime lending rate ({livePrime}%).</div>
            </div>
          </div>
          {bondAmt > 0 && (
            <div className="pa-stage2-cta no-print fade-in">
              <div className="pa-stage2-cta__icon">🏠</div>
              <div className="pa-stage2-cta__body">
                <div className="pa-stage2-cta__title">Found your property?</div>
                <div className="pa-stage2-cta__sub">
                  Once you have a signed Offer to Purchase, Bondly submits your full bond application to all 7 SA banks simultaneously — free of charge.
                </div>
              </div>
              <Button variant="lime" onClick={() => setStep('apply')}>
                Submit to banks
              </Button>
            </div>
          )}
        </div>
      </div>
    );
  }

  const progressIdx = Math.min(step, STEPS.length - 1);

  return (
    <div className="page preapproval-page">
      <OriginationNav />
      {/* Exit intent overlay */}
      {exitIntent && !exitSaved && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }} onClick={() => setExitIntent(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--border-radius)', padding: 'var(--space-7)', maxWidth: 420, width: '100%', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }} onClick={e => e.stopPropagation()}>
            <div style={{ fontSize: '1.5rem', marginBottom: 'var(--space-3)' }}>⏸</div>
            <h3 style={{ fontWeight: 700, fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Don't lose your progress</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem', marginBottom: 'var(--space-5)', lineHeight: 1.6 }}>
              Enter your email and we'll save your spot. Come back anytime — your figures will be waiting.
            </p>
            <input
              type="email"
              autoFocus
              placeholder="you@example.com"
              value={exitEmail}
              onChange={e => setExitEmail(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' && exitEmail.trim()) {
                  leads.submit({ type: 'exit_intent', email: exitEmail.trim(), step, source: 'preapproval_exit_intent' }).catch(() => {});
                  setExitSaved(true);
                }
              }}
              style={{ width: '100%', padding: '11px 14px', borderRadius: 'var(--border-radius-sm)', border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.9375rem', marginBottom: 'var(--space-3)', boxSizing: 'border-box' }}
            />
            <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
              <Button variant="lime" full onClick={() => {
                if (!exitEmail.trim()) return;
                leads.submit({ type: 'exit_intent', email: exitEmail.trim(), step, source: 'preapproval_exit_intent' }).catch(() => {});
                setExitSaved(true);
              }}>Save my progress →</Button>
              <Button variant="ghost" onClick={() => setExitIntent(false)}>Continue</Button>
            </div>
          </div>
        </div>
      )}
      {exitSaved && exitIntent && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 'var(--space-4)' }} onClick={() => setExitIntent(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--border-radius)', padding: 'var(--space-7)', maxWidth: 420, width: '100%', textAlign: 'center', boxShadow: '0 24px 64px rgba(0,0,0,0.4)' }}>
            <div style={{ fontSize: '2rem', marginBottom: 'var(--space-3)' }}>✓</div>
            <h3 style={{ fontWeight: 700, fontSize: '1.125rem', marginBottom: 'var(--space-2)' }}>Got it — we'll follow up!</h3>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-5)' }}>We'll send a reminder to <strong>{exitEmail}</strong> so you can pick up where you left off.</p>
            <Button variant="lime" onClick={() => setExitIntent(false)}>Continue application →</Button>
          </div>
        </div>
      )}
      <div className="container container--narrow">
        <div className="preapproval-header">
          <Link to="/"><Button variant="ghost" size="sm">← Back</Button></Link>
        </div>

        {/* "Step 2 of 4 · About your finances" header — plain-English so a
            first-time buyer knows where they are and what's coming. */}
        {step !== 'apply' && step !== 4 && (
          <div className="pa-progress-header">
            <div className="pa-progress-header__label">
              Step {progressIdx + 1} of {STEPS.length}
              <span className="pa-progress-header__sep"> · </span>
              <strong>{STEPS[progressIdx]}</strong>
            </div>
            <div className="pa-progress-header__desc">{STEP_DESCRIPTIONS[progressIdx]}</div>
          </div>
        )}

        {step !== 4 && (
          <div className="pa-progress">
            {STEPS.map((label, i) => (
              <div key={label} className={`pa-progress__step ${progressIdx > i && !skippedSteps.has(i) ? 'completed' : progressIdx === i ? 'active' : ''}`}>
                <div className="pa-progress__dot">{progressIdx > i && !skippedSteps.has(i) ? '✓' : skippedSteps.has(i) && progressIdx > i ? '–' : i + 1}</div>
                <span>{label}</span>
              </div>
            ))}
          </div>
        )}

        {step === 0 && renderStep0()}
        {step === 1 && renderStep1()}
        {step === 2 && renderStep2()}
        {step === 3 && renderStep3()}
        {step === 4 && renderStep4()}
        {step === 'apply' && renderStepApply()}

        {step < 4 && !isLoggedIn && (
          <p className="pa-guest-note">
            Already have an account?{' '}
            <Link to="/login">Sign in</Link> to use the full dashboard.
          </p>
        )}
      </div>
      <RatesExplained
        open={showRatesModal}
        onClose={() => setShowRatesModal(false)}
        primeRate={livePrime}
        stressRate={liveStress}
        lastChanged={_rateSettings.primeRateLastChanged}
      />
    </div>
  );
}
