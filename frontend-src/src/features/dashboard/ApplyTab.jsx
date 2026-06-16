import { useState, useEffect } from 'react';
import { CheckCircle, Clock, Building2, TrendingDown, ChevronRight } from 'lucide-react';
import { myApplication, financialFitness } from '../../lib/api.js';
import ApplicationDocumentsUpload from './ApplicationDocumentsUpload.jsx';
import { useToast } from '../../components/Toast.jsx';
import { calcMaxBond, calcMonthly } from '../../lib/finance.js';
import { usePrimeRate } from '../../lib/usePrimeRate.js';
import { fmt } from '../../lib/format.js';
import Button from '../../components/Button.jsx';
import Card, { CardHeader, CardBody } from '../../components/Card.jsx';
import Input, { Select } from '../../components/Input.jsx';

function calcTransferDuty(price) {
  let duty = 0;
  if (price <= 1100000) duty = 0;
  else if (price <= 1512500) duty = (price - 1100000) * 0.03;
  else if (price <= 2117500) duty = 12375 + (price - 1512500) * 0.06;
  else if (price <= 2722500) duty = 48675 + (price - 2117500) * 0.08;
  else if (price <= 12100000) duty = 97475 + (price - 2722500) * 0.11;
  else duty = 1128600 + (price - 12100000) * 0.13;
  return Math.round(duty);
}

function calcBuyCosts(price) {
  const transferDuty = calcTransferDuty(price);
  const bondReg      = Math.round(price * 0.012 + 5000);
  const transferAtty = Math.round(price * 0.014 + 6000);
  return { transferDuty, bondReg, transferAtty, total: transferDuty + bondReg + transferAtty };
}

function getAffordabilityFlags(income, expenses, debt, employment, years) {
  const flags = [];
  const inc = parseFloat(income) || 0;
  const dbt = parseFloat(debt)   || 0;
  const yrs = parseFloat(years)  || 0;
  if (inc <= 0) return [];
  const dti = (dbt / inc) * 100;
  if (dti > 40) flags.push({ type: 'error', msg: `DTI ratio ${dti.toFixed(0)}% is above 40% — banks typically decline. Reduce debt first.` });
  else if (dti > 30) flags.push({ type: 'warn', msg: `DTI ratio ${dti.toFixed(0)}% is borderline. Lower debt improves your chances.` });
  if (employment === 'Permanent' && years !== '' && yrs < 1) flags.push({ type: 'warn', msg: 'Less than 1 year at current employer — most banks require at least 12 months.' });
  if (employment === 'Contract')             flags.push({ type: 'warn', msg: 'Contract employment may require a larger deposit or additional income proof.' });
  if (employment === 'Self-employed')        flags.push({ type: 'warn', msg: 'Self-employed: banks require 2 years of audited financials or tax returns.' });
  const stressR = 13.25 / 100 / 12, n = 240;
  const maxMonthlyStress = Math.max(0, inc * 0.30 - dbt);
  const stressQualified  = maxMonthlyStress * (Math.pow(1 + stressR, n) - 1) / (stressR * Math.pow(1 + stressR, n));
  if (stressQualified > 0) flags.push({ type: 'info', msg: `NCA stress-rate qualification (at 13.25%): ${fmt(stressQualified)} — actual max bond at prime rate will be higher.` });
  return flags;
}

// ── Application status tracker ───────────────────────────────────────────────

const APP_STAGES = [
  { key: 'submitted',      label: 'Application submitted',   desc: 'We have received your details' },
  { key: 'reviewing',      label: 'Banks reviewing',          desc: 'Banks are comparing your application' },
  { key: 'offer_available', label: 'Best offer secured',      desc: 'Banks have submitted their best offers' },
  { key: 'accepted',       label: 'Offer accepted',           desc: 'Congratulations — bond approved!' },
];

function ApplicationStatus({ app, onAccept, onWithdraw }) {
  const stageIdx = APP_STAGES.findIndex(s => s.key === app.status);
  const hasOffer = app.status === 'offer_available' || app.status === 'accepted';
  const accepted = app.status === 'accepted';

  return (
    <div className="app-status fade-in">
      <div className="app-status__header">
        <div className="app-status__title">Your Bond Application</div>
        <div className="app-status__sub">
          Requested: <strong>{fmt(app.requestedAmount)}</strong>
        </div>
      </div>

      {/* Stage timeline */}
      <div className="app-status__timeline">
        {APP_STAGES.map((stage, i) => {
          const done    = i < stageIdx;
          const current = i === stageIdx;
          return (
            <div key={stage.key} className={`app-status__stage ${done ? 'done' : current ? 'current' : 'pending'}`}>
              <div className="app-status__stage-dot">
                {done ? <CheckCircle size={16} /> : current ? <Clock size={16} /> : <span />}
              </div>
              <div className="app-status__stage-body">
                <div className="app-status__stage-label">{stage.label}</div>
                {current && <div className="app-status__stage-desc">{stage.desc}</div>}
              </div>
            </div>
          );
        })}
      </div>

      {/* Offer card */}
      {hasOffer && app.bestRate && (
        <div className={`app-status__offer ${accepted ? 'app-status__offer--accepted' : ''}`}>
          <div className="app-status__offer-badge">
            {accepted ? <CheckCircle size={14} /> : <TrendingDown size={14} />}
            {accepted ? 'Accepted' : 'Best offer secured'}
          </div>
          <div className="app-status__offer-grid">
            <div className="app-status__offer-item">
              <div className="app-status__offer-label">Interest rate</div>
              <div className="app-status__offer-val">{app.bestRate}%</div>
            </div>
            <div className="app-status__offer-item">
              <div className="app-status__offer-label">Approved amount</div>
              <div className="app-status__offer-val">{fmt(app.bestAmount)}</div>
            </div>
            <div className="app-status__offer-item">
              <div className="app-status__offer-label">Monthly payment</div>
              <div className="app-status__offer-val">{fmt(app.bestMonthly)}/mo</div>
            </div>
            <div className="app-status__offer-item">
              <div className="app-status__offer-label">From</div>
              <div className="app-status__offer-val">{app.winningBank || 'A leading bank'}</div>
            </div>
          </div>
          {!accepted && (
            <div className="app-status__offer-actions">
              <button className="app-status__accept-btn" onClick={onAccept}>
                Accept this offer <ChevronRight size={14} />
              </button>
              <button className="app-status__decline-btn" onClick={onWithdraw}>
                Request more options
              </button>
            </div>
          )}
          {accepted && (
            <div className="app-status__accepted-note">
              <Building2 size={14} />
              A Bondly advisor will be in touch with next steps within 1 business day.
            </div>
          )}
        </div>
      )}

      {!hasOffer && (
        <div className="app-status__waiting">
          <div className="app-status__waiting-icon">
            <div className="app-status__pulse" />
            <Building2 size={22} />
          </div>
          <div className="app-status__waiting-text">
            <strong>We are working for you</strong>
            <span>Our team is negotiating with multiple banks to find you the best possible rate. We will update you as soon as we have an offer.</span>
          </div>
        </div>
      )}

      <div className="app-status__footer">
        Questions? Contact us at <a href="mailto:support@bondly.co.za">support@bondly.co.za</a>
      </div>
    </div>
  );
}

// ── Main component ───────────────────────────────────────────────────────────

// SessionStorage key — survives accidental refresh but auto-clears on tab close.
// Real users were losing 3 steps of form fill on a fat-finger reload; this
// restores them silently.
const APPLY_FORM_KEY = 'bondly_apply_form_v1';
const APPLY_STEP_KEY = 'bondly_apply_step_v1';
function _readPersistedForm() {
  try {
    const raw = sessionStorage.getItem(APPLY_FORM_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
function _readPersistedStep() {
  try {
    const v = parseInt(sessionStorage.getItem(APPLY_STEP_KEY) || '1', 10);
    return Number.isFinite(v) && v >= 1 && v <= 4 ? v : 1;
  } catch { return 1; }
}

export default function ApplyTab({ loans, onRefresh }) {
  const primeRate = usePrimeRate();
  const [step, setStep]               = useState(_readPersistedStep);
  const [form, setForm]               = useState(() => _readPersistedForm() || ({
    income: '', expenses: '', debt: '', deposit: '',
    propertyPrice: '', propertyType: 'House', propertyStatus: 'Existing',
    otpStatus: 'searching',   // 'searching' (pre-approval) | 'offer_signed' (firm)
    suburb: '', province: 'Gauteng',
    employment: 'Permanent', years: '', employer: '', purpose: 'Purchase',
    name: '', phone: '', email: '', idNumber: '',
    // Swap (refinance) fields — only required when purpose === 'Refinance'.
    // Without these the broker has nothing to take to a new lender.
    currentBank: '', currentRate: '', currentBalance: '',
    currentMonthly: '', monthsRemaining: '',
  }));
  // Persist form + step on every change so refresh restores them.
  useEffect(() => {
    try { sessionStorage.setItem(APPLY_FORM_KEY, JSON.stringify(form)); } catch {/* ok */}
  }, [form]);
  useEffect(() => {
    try { sessionStorage.setItem(APPLY_STEP_KEY, String(step)); } catch {/* ok */}
  }, [step]);
  const [loading, setLoading]         = useState(false);
  const [submittedBond, setSubmittedBond] = useState(null);
  const [appStatus, setAppStatus]     = useState(null);
  const [appLoading, setAppLoading]   = useState(true);
  const [prefillSource, setPrefillSource] = useState(null); // 'snapshot' | null
  const showToast = useToast();

  // Check for existing active application on mount; pre-fill income from latest snapshot
  useEffect(() => {
    myApplication.get()
      .then(d => setAppStatus(d.application))
      .catch(() => {})
      .finally(() => setAppLoading(false));

    const tok = localStorage.getItem('bondly_token');
    if (tok) {
      fetch('/api/auth/me', { headers: { Authorization: 'Bearer ' + tok } })
        .then(r => r.json())
        .then(d => {
          const u = d.data?.user;
          if (!u) return;
          setForm(f => ({
            ...f,
            name:  f.name  || u.name  || '',
            email: f.email || u.email || '',
            phone: f.phone || u.phone || '',
          }));
        })
        .catch(() => {});
    }

    financialFitness.getSnapshots()
      .then(d => {
        const snaps = d.snapshots || [];
        const latest = snaps[0];
        if (!latest) return;
        const income    = latest.income?.monthlyAmount;
        const debt      = latest.debts?.totalMonthly;
        const expenses  = latest.expenses?.total;
        if (income > 0) {
          setForm(f => ({
            ...f,
            income:   f.income   || String(Math.round(income)),
            debt:     f.debt     || (debt     > 0 ? String(Math.round(debt))     : f.debt),
            expenses: f.expenses || (expenses > 0 ? String(Math.round(expenses)) : f.expenses),
          }));
          setPrefillSource('snapshot');
        }
      })
      .catch(() => {});
  }, []);

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  const inc  = parseFloat(form.income)        || 0;
  const exp  = parseFloat(form.expenses)      || 0;
  const dbt  = parseFloat(form.debt)          || 0;
  const dep  = parseFloat(form.deposit)       || 0;
  const prop = parseFloat(form.propertyPrice) || 0;

  const maxBond = (() => {
    if (!inc) return 0;
    const disp    = inc - exp - dbt;
    const monthly = Math.max(0, disp * 0.30);
    const r = primeRate / 100 / 12, n = 240;
    return monthly * (Math.pow(1 + r, n) - 1) / (r * Math.pow(1 + r, n)) + dep;
  })();

  const maxMonthly  = maxBond > 0 ? calcMonthly(maxBond, primeRate, 20) : 0;
  const buyCosts    = prop > 0 ? calcBuyCosts(prop) : null;
  const totalCashNeeded = buyCosts ? dep + buyCosts.total : null;
  const shortfall   = totalCashNeeded && dep > 0 ? totalCashNeeded - dep : null;
  const affordFlags = step >= 2 ? getAffordabilityFlags(form.income, form.expenses, form.debt, form.employment, form.years) : [];

  async function submit() {
    if (!form.name || !form.phone) { showToast('Name and phone are required', 'error'); return; }
    setLoading(true);
    try {
      const isSwap = form.purpose === 'Refinance';
      // For a swap the bondAmount is the outstanding balance, not (price - deposit).
      const swapBalance = parseFloat(form.currentBalance) || 0;
      const bondAmount = Math.round(isSwap ? swapBalance : (prop ? Math.max(prop - dep, 0) : maxBond));
      const appRes = await myApplication.start({
        requestedAmount: Math.round(isSwap ? swapBalance : maxBond),
        type: isSwap ? 'swap' : 'origination',
        income: inc, expenses: exp, debt: dbt, deposit: dep,
        employment: form.employment,
        yearsEmployed: parseInt(form.years) || 0,
        phone: form.phone,
        idNumber: form.idNumber || undefined,
        notes: `Purpose: ${form.purpose}. Applicant: ${form.name}. Employer: ${form.employer || 'not provided'}.`,
        // Swap context — server.js reads these to build a proper swapApplication
        // entry (lines ~3496-3506) and surface them to the broker UI.
        currentBank:     isSwap ? form.currentBank   : undefined,
        currentRate:     isSwap ? (parseFloat(form.currentRate)     || null) : undefined,
        currentBalance:  isSwap ? (parseFloat(form.currentBalance)  || null) : undefined,
        currentMonthly:  isSwap ? (parseFloat(form.currentMonthly)  || null) : undefined,
        monthsRemaining: isSwap ? (parseInt(form.monthsRemaining)   || null) : undefined,
        property: {
          bondAmount,
          purchasePrice:  prop || 0,
          deposit:        dep,
          suburb:         form.suburb,
          province:       form.province,
          propertyType:   form.propertyType,
          propertyStatus: form.propertyStatus,
          otpStatus:      form.otpStatus,
          otpSignedAt:    form.otpStatus === 'offer_signed' ? new Date().toISOString() : null,
          term:           20,
        },
      });
      setAppStatus(appRes.application);
      setSubmittedBond(maxBond);
      showToast('Application submitted! We are going to market for you.', 'success');
      setStep(5);
      // Clear the persisted draft — the application is now live, not a draft.
      try { sessionStorage.removeItem(APPLY_FORM_KEY); sessionStorage.removeItem(APPLY_STEP_KEY); } catch {/* ok */}
      onRefresh();
    } catch (err) {
      showToast(err.message || 'Could not submit', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function acceptOffer() {
    if (!appStatus?.id) return;
    setLoading(true);
    try {
      // Update customer application status locally
      setAppStatus(prev => ({ ...prev, status: 'accepted' }));
      showToast('Offer accepted! We will be in touch shortly.', 'success');
    } catch(e) {
      showToast(e.message || 'Could not accept offer', 'error');
    } finally {
      setLoading(false);
    }
  }

  // Show spinner while checking application status
  if (appLoading) {
    return <div style={{ display:'flex', justifyContent:'center', padding:40 }}><div className="spinner" /></div>;
  }

  // Active application exists — show status tracker
  if (appStatus && !['cancelled','rejected'].includes(appStatus.status) && step !== 4) {
    return (
      <ApplicationStatus
        app={appStatus}
        onAccept={acceptOffer}
        onWithdraw={() => setAppStatus(null)}
      />
    );
  }

  if (step === 5) {
    const nextSteps = [
      { icon: '📨', title: 'Confirmation email sent', sub: 'Check your inbox — we\'ve emailed you a summary', done: true },
      { icon: '🏦', title: 'Banks review your application', sub: 'Typically 3–5 business days for initial feedback', done: false },
      { icon: '📞', title: 'Bondly advisor calls you', sub: 'Within 1 business day to confirm details', done: false },
      { icon: '✅', title: 'Receive your offers', sub: 'Compare quotes and choose the best rate', done: false },
    ];
    return (
      <div className="dash-apply-success fade-in">
        <div style={{ marginBottom: 'var(--space-4)', display:'flex', justifyContent:'center' }}><CheckCircle size={56} color="var(--color-success)"/></div>
        <h3>Application submitted!</h3>
        <p>Multiple banks are now comparing your application to find the most competitive rate.</p>
        <p style={{ marginTop: 'var(--space-2)', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
          Estimated max bond: <strong style={{ color: 'var(--text-primary)' }}>{fmt(submittedBond || maxBond)}</strong>
        </p>
        <div style={{ marginTop: 'var(--space-5)', textAlign: 'left' }}>
          <p style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 'var(--space-3)' }}>What happens next</p>
          {nextSteps.map((s, i) => (
            <div key={i} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-3)', alignItems: 'flex-start' }}>
              <div style={{ width: 36, height: 36, borderRadius: '50%', background: s.done ? 'rgba(108,187,167,0.15)' : 'var(--bg-card)', border: '1.5px solid var(--border-color)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, fontSize: '1rem' }}>{s.icon}</div>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{s.title}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>{s.sub}</div>
              </div>
            </div>
          ))}
        </div>

        {/* Interactive document collector. Each row uploads to the vault
            via POST /api/documents; status pulls from GET /api/documents.
            Replaces the static "go to the Documents tab" punt with an
            inline upload flow so the customer's path is one screen. */}
        <div style={{ marginTop: 'var(--space-5)', textAlign: 'left' }}>
          <ApplicationDocumentsUpload
            token={localStorage.getItem('bondly_token') || ''}
            showToast={showToast}
          />
        </div>

        <div style={{ marginTop: 'var(--space-5)', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', alignItems: 'center' }}>
          {appStatus && (
            <Button variant="forest" full onClick={() => setStep(1)}>
              View application status
            </Button>
          )}
          <Button variant="ghost" onClick={() => setStep(1)}>Back to apply</Button>
        </div>
      </div>
    );
  }

  const Progress = () => (
    <div className="apply-progress">
      {['Your budget', 'The property', 'Your situation', 'Submit'].map((label, i) => (
        <div key={label} className={`apply-progress__step ${step > i + 1 ? 'completed' : step === i + 1 ? 'active' : ''}`}>
          <div className="apply-progress__dot">{step > i + 1 ? '✓' : i + 1}</div>
          <span>{label}</span>
        </div>
      ))}
    </div>
  );

  return (
    <div className="fade-in">
      <div style={{ marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: 'var(--space-2)' }}>Submit to Banks</h3>
        <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'var(--color-surface-2)', borderRadius: 'var(--radius-lg)', fontSize: '0.8125rem', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
          {maxBond >= 200000
            ? <>Based on your details, you could qualify for up to <strong style={{ color: 'var(--color-text)' }}>{fmt(maxBond)}</strong>. Fill in the form below and our broker team will submit to all 7 SA banks on your behalf — <strong>no credit check, free, and takes 3 minutes.</strong></>
            : <>Fill in your finances below. Our broker team will submit to all 7 SA banks on your behalf — <strong>no credit check, free, and takes 3 minutes.</strong> You will receive offers within 3–5 business days.</>
          }
        </div>
      </div>
      <Progress />

      {step === 1 && (
        <Card>
          <CardHeader>Your Income &amp; Finances</CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div>
                <Input label="Gross monthly income (R)" id="paInc" type="number" value={form.income} onChange={e => { set('income')(e); setPrefillSource(null); }} placeholder="45 000" />
                {prefillSource === 'snapshot' && (
                  <div style={{ fontSize: '0.75rem', color: 'var(--mint)', marginTop: 4, display: 'flex', alignItems: 'center', gap: 5 }}>
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="20 6 9 17 4 12"/></svg>
                    Pre-filled from your last statement analysis — edit if needed
                  </div>
                )}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Monthly living expenses (R)" id="paExp" type="number" value={form.expenses} onChange={set('expenses')} placeholder="0" />
                <Input label="Monthly debt payments (R)" id="paDbt" type="number" value={form.debt} onChange={set('debt')} placeholder="car, personal loans" />
              </div>

              {maxBond > 0 && (
                <div className="apply-bond-estimate fade-in">
                  <div className="apply-bond-estimate__inner">
                    <div className="apply-bond-estimate__label">How much you could borrow</div>
                    <div className="apply-bond-estimate__amount">{fmt(maxBond)}</div>
                    <div className="apply-bond-estimate__monthly">{fmt(maxMonthly)} / month at prime rate</div>
                  </div>
                  {buyCosts && (
                    <div style={{ borderTop: '1px solid rgba(30,58,95,0.25)', paddingTop: 'var(--space-3)', marginTop: 'var(--space-3)' }}>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 700, marginBottom: 'var(--space-2)' }}>Total buying cost breakdown</div>
                      {[
                        ['Bond amount', fmt(maxBond - dep)],
                        ['Deposit', fmt(dep)],
                        ['Transfer duty', buyCosts.transferDuty === 0 ? 'R 0 (exempt)' : fmt(buyCosts.transferDuty)],
                        ['Bond registration costs', fmt(buyCosts.bondReg)],
                        ['Transfer attorney costs', fmt(buyCosts.transferAtty)],
                      ].map(([l, v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', padding: '3px 0', color: 'var(--text-secondary)' }}>
                          <span>{l}</span><strong style={{ color: 'var(--text-primary)' }}>{v}</strong>
                        </div>
                      ))}
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', fontWeight: 700, borderTop: '1px solid rgba(30,58,95,0.25)', marginTop: 8, paddingTop: 8 }}>
                        <span>Total cash needed upfront</span>
                        <span style={{ color: shortfall && shortfall > dep ? '#dc2626' : 'var(--mint)' }}>{fmt(totalCashNeeded)}</span>
                      </div>
                      {dep > 0 && shortfall !== null && shortfall > 0 && (
                        <div style={{ fontSize: '0.8125rem', color: '#d97706', marginTop: 4 }}>
                          You will need an additional {fmt(shortfall)} for transfer + registration costs on top of your deposit.
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
              <Button variant="lime" full onClick={() => setStep(2)} disabled={!form.income}>Next: Property →</Button>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 2 && (
        <Card>
          <CardHeader>Property Details</CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>

              {/* Primary choice: pre-approval vs definite. Banks key off this to
                  know whether to issue indicative or firm pricing. */}
              <div>
                <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, marginBottom: 8 }}>Where are you in the buying journey?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                  <button type="button" onClick={() => setForm(f => ({ ...f, otpStatus: 'searching' }))}
                    style={{
                      padding: '14px 14px', textAlign: 'left',
                      background: form.otpStatus === 'searching' ? 'rgba(30,58,95,0.10)' : 'var(--bg-card)',
                      border: '2px solid ' + (form.otpStatus === 'searching' ? 'var(--forest)' : 'var(--border-color)'),
                      borderRadius: 'var(--border-radius-sm)',
                      cursor: 'pointer',
                    }}>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>I'm still shopping</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>Get indicative offers so I know what I can afford before I make an offer.</div>
                  </button>
                  <button type="button" onClick={() => setForm(f => ({ ...f, otpStatus: 'offer_signed' }))}
                    style={{
                      padding: '14px 14px', textAlign: 'left',
                      background: form.otpStatus === 'offer_signed' ? 'rgba(30,58,95,0.10)' : 'var(--bg-card)',
                      border: '2px solid ' + (form.otpStatus === 'offer_signed' ? 'var(--forest)' : 'var(--border-color)'),
                      borderRadius: 'var(--border-radius-sm)',
                      cursor: 'pointer',
                    }}>
                    <div style={{ fontWeight: 800, marginBottom: 4 }}>I've signed an Offer to Purchase</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>I have a property in mind and need a firm bond approval — fast.</div>
                  </button>
                </div>
              </div>

              <Input label="Property price (R)" id="paPropP" type="number" value={form.propertyPrice} onChange={set('propertyPrice')} placeholder="e.g. 1 500 000" />
              <Input label="Deposit available (R)" id="paDepP" type="number" value={form.deposit} onChange={set('deposit')} placeholder="0 — can be from savings or gift" />
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Select label="Property type" id="paPropType" value={form.propertyType} onChange={set('propertyType')}>
                  <option>House</option>
                  <option>Townhouse</option>
                  <option>Sectional title</option>
                  <option>Apartment</option>
                  <option>Vacant land</option>
                </Select>
                <Select label="Build status" id="paPropStatus" value={form.propertyStatus} onChange={set('propertyStatus')}>
                  <option>Existing</option>
                  <option>New build</option>
                  <option>Off-plan</option>
                </Select>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Suburb" id="paSuburb" type="text" value={form.suburb} onChange={set('suburb')} placeholder="e.g. Sandton" />
                <Select label="Province" id="paProvince" value={form.province} onChange={set('province')}>
                  <option>Gauteng</option>
                  <option>Western Cape</option>
                  <option>KwaZulu-Natal</option>
                  <option>Eastern Cape</option>
                  <option>Free State</option>
                  <option>Mpumalanga</option>
                  <option>Limpopo</option>
                  <option>North West</option>
                  <option>Northern Cape</option>
                </Select>
              </div>
              {maxBond > 0 && (
                <div style={{ background: 'rgba(30,58,95,0.10)', border: '1px solid rgba(30,58,95,0.25)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-4)', fontSize: '0.875rem' }}>
                  <div style={{ fontWeight: 700, marginBottom: 8 }}>Updated estimate with property details</div>
                  {buyCosts && (
                    <>
                      {[
                        ['Transfer duty',         buyCosts.transferDuty === 0 ? 'R 0 (exempt)' : fmt(buyCosts.transferDuty)],
                        ['Bond registration',     fmt(buyCosts.bondReg)],
                        ['Transfer attorney',     fmt(buyCosts.transferAtty)],
                        ['Total upfront costs',   fmt(totalCashNeeded)],
                      ].map(([l, v]) => (
                        <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '3px 0', color: 'var(--text-secondary)' }}>
                          <span>{l}</span><strong style={{ color: 'var(--text-primary)' }}>{v}</strong>
                        </div>
                      ))}
                    </>
                  )}
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
                <Button variant="lime" full onClick={() => setStep(3)}>Next: Employment →</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 3 && (
        <Card>
          <CardHeader>Employment Details</CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <Select label="Employment type" id="paEmp" value={form.employment} onChange={set('employment')}>
                <option>Permanent</option>
                <option>Contract</option>
                <option>Self-employed</option>
                <option>Freelance / Gig</option>
              </Select>
              <Input label="Employer name" id="paEmployer" type="text" value={form.employer} onChange={set('employer')} placeholder="e.g. Shoprite Holdings" />
              <Input label="Years at current employer" id="paYrs" type="number" value={form.years} onChange={set('years')} placeholder="3" min="0" />
              <Select label="Purpose" id="paPurp" value={form.purpose} onChange={set('purpose')}>
                <option>Purchase</option>
                <option>Refinance</option>
                <option>Equity release</option>
              </Select>

              {/* Refinance / swap branch — banks won't quote a switch without
                  the current loan particulars. Capturing these upfront means
                  the broker can go straight to a quote rather than chasing
                  the customer for paperwork over 3-5 days. */}
              {form.purpose === 'Refinance' && (
                <div style={{ display:'grid', gap:'var(--space-3)', padding:'var(--space-4)', background:'rgba(74,127,165,0.05)', border:'1px solid rgba(74,127,165,0.25)', borderRadius:8 }}>
                  <div style={{ fontWeight:700, color:'#1e3a5f' }}>About your current bond</div>
                  <Select label="Current bank" id="paCurBank" value={form.currentBank} onChange={set('currentBank')}>
                    <option value="">Select your current bank…</option>
                    <option>ABSA</option>
                    <option>FNB</option>
                    <option>Nedbank</option>
                    <option>Standard Bank</option>
                    <option>Capitec</option>
                    <option>Investec</option>
                    <option>SA Home Loans</option>
                    <option>Other</option>
                  </Select>
                  <Input label="Current interest rate (%)" id="paCurRate"   type="number" step="0.01" value={form.currentRate}    onChange={set('currentRate')}    placeholder="11.75" />
                  <Input label="Current bond balance (R)"  id="paCurBal"    type="number"             value={form.currentBalance} onChange={set('currentBalance')} placeholder="1 250 000" />
                  <Input label="Current monthly payment (R)" id="paCurMo"   type="number"             value={form.currentMonthly} onChange={set('currentMonthly')} placeholder="13 500" />
                  <Input label="Months remaining on bond"   id="paCurTerm"  type="number"             value={form.monthsRemaining} onChange={set('monthsRemaining')} placeholder="216" />
                  <p style={{ margin:0, fontSize:'0.75rem', color:'#1e3a5f' }}>
                    Find these on your latest bond statement (most banks have a PDF in their app). Approximate is fine — your broker will verify the exact numbers before submission.
                  </p>
                </div>
              )}

              {/* Self-employed / freelance branch — these applicants have a very
                  different bank reality (2yr financials, larger deposit, often
                  declined on first pass). Telling them upfront sets honest
                  expectations and prevents wasted submissions. */}
              {(form.employment === 'Self-employed' || form.employment === 'Freelance / Gig') && (
                <div style={{ padding: 'var(--space-4)', background:'rgba(217,119,6,0.06)', border:'1px solid rgba(217,119,6,0.25)', borderRadius:8 }}>
                  <div style={{ fontWeight:700, color:'#92400e', marginBottom: 6 }}>
                    Heads up — {form.employment.toLowerCase()} applications are different
                  </div>
                  <p style={{ fontSize:'0.8125rem', color:'#78350f', margin:'0 0 10px' }}>
                    SA banks treat self-employed and freelance applicants more conservatively. We'll still go to market for you, but here's what to expect so nothing surprises you:
                  </p>
                  <ul style={{ margin:0, paddingLeft:18, fontSize:'0.8125rem', color:'#78350f', lineHeight:1.6 }}>
                    <li><strong>2 years of audited financials</strong> or signed tax returns (IT34) — required by every bank.</li>
                    <li><strong>Larger deposit usually needed</strong> — most banks want 20–30% (vs 0–10% for permanent income).</li>
                    <li><strong>3–6 months’ worth of business + personal bank statements</strong>, not just the latest 3.</li>
                    <li><strong>Your broker will pre-screen</strong> with the 1–2 lenders that work best for self-employed before submitting widely.</li>
                  </ul>
                  <p style={{ fontSize:'0.75rem', color:'#92400e', margin:'10px 0 0' }}>
                    You can still submit now — we’ll just route to the right specialists rather than firing it at every bank.
                  </p>
                </div>
              )}
              {affordFlags.length > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
                  {affordFlags.map((f, i) => (
                    <div key={i} style={{ padding: 'var(--space-3)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.8125rem',
                      background: f.type === 'error' ? 'rgba(220,38,38,0.08)' : f.type === 'warn' ? 'rgba(217,119,6,0.08)' : 'rgba(74,127,165,0.08)',
                      border: `1px solid ${f.type === 'error' ? 'rgba(220,38,38,0.3)' : f.type === 'warn' ? 'rgba(217,119,6,0.3)' : 'rgba(74,127,165,0.3)'}`,
                      color: f.type === 'error' ? '#dc2626' : f.type === 'warn' ? '#d97706' : 'var(--text-secondary)' }}>
                      {f.type === 'error' ? '⚠ ' : f.type === 'warn' ? '▲ ' : 'ℹ '}{f.msg}
                    </div>
                  ))}
                </div>
              )}
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
                <Button variant="lime" full onClick={() => setStep(4)}>Next: Contact →</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}

      {step === 4 && (
        <Card>
          <CardHeader>Submit your application</CardHeader>
          <CardBody>
            <div className="apply-bond-estimate fade-in" style={{ marginBottom: 'var(--space-4)' }}>
              <div className="apply-bond-estimate__inner">
                <div className="apply-bond-estimate__label">How much you could borrow</div>
                <div className="apply-bond-estimate__amount">{fmt(maxBond)}</div>
                <div className="apply-bond-estimate__monthly">{fmt(maxMonthly)} / month at prime rate</div>
              </div>
            </div>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <div style={{ background: 'rgba(30,58,95,0.05)', border: '1.5px solid rgba(30,58,95,0.15)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-3) var(--space-4)', fontSize: '0.875rem', marginBottom: 'var(--space-2)' }}>
                <div style={{ fontWeight: 700, color: '#1e3a5f', marginBottom: 4 }}>You are submitting a formal mortgage application</div>
                <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Your application will be sent to 7 SA banks — ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec, and SA Home Loans. No credit check at this stage. Free service.</div>
              </div>
              <Input label="Full name" id="paName" type="text" value={form.name} onChange={set('name')} placeholder="Jane Smith" required />
              <Input label="SA ID number" id="paId" type="text" value={form.idNumber} onChange={set('idNumber')} placeholder="13-digit ID number" />
              <Input label="Phone number" id="paPhone" type="tel" value={form.phone} onChange={set('phone')} placeholder="082 000 0000" required />
              <Input label="Email (optional)" id="paEmail" type="email" value={form.email} onChange={set('email')} placeholder="jane@example.com" />
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <Button variant="ghost" onClick={() => setStep(3)}>← Back</Button>
                <Button variant="lime" full onClick={submit} loading={loading}>Submit to 7 banks →</Button>
              </div>
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}
