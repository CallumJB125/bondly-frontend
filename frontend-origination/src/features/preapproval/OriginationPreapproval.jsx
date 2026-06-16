import { useState, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { fmt } from '../../lib/format.js';
import { calcMaxBond } from '../../lib/mortgage.js';
import './OriginationPreapproval.css';

const EMPLOYMENT_TYPES = [
  { value: 'salaried', label: 'Salaried (employed)', desc: 'You receive a regular monthly salary' },
  { value: 'self_employed', label: 'Self-employed / Business owner', desc: 'You run your own business or freelance' },
];

const TOTAL_STEPS = 5;
const STEP_LABELS = ['Employment', 'Income', 'Property', 'About you', 'Confirm'];

function validateSAID(id) {
  if (!/^\d{13}$/.test(id)) return false;
  // Luhn check
  let sum = 0;
  for (let i = 0; i < 13; i++) {
    let d = parseInt(id[i]);
    if (i % 2 === 1) { d *= 2; if (d > 9) d -= 9; }
    sum += d;
  }
  return sum % 10 === 0;
}

export default function OriginationPreapproval() {
  const [searchParams] = useSearchParams();
  const [step, setStep] = useState(1);
  const [prefillIncome, setPrefillIncome] = useState(0);
  const [form, setForm] = useState({
    // Step 1
    employmentType: '',
    // Step 2
    grossIncome: '',
    monthlyDebt: '',
    // Step 3
    propertyPrice: '',
    deposit: '',
    suburb: '',
    province: 'Gauteng',
    propertyType: 'House',
    otpStatus: 'searching',
    // Step 4
    name: '',
    idNumber: '',
    employer: '',
    yearsEmployed: '',
    phone: '',
    email: '',
    password: '',
  });
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState(null);

  useEffect(() => {
    let income = '';
    let debt = '';
    if (searchParams.get('income')) income = searchParams.get('income');
    if (searchParams.get('debt')) debt = searchParams.get('debt');
    try {
      const stored = sessionStorage.getItem('bondly_orig_calc');
      if (stored) {
        const parsed = JSON.parse(stored);
        if (!income && parsed.income) income = String(parsed.income);
        if (!debt && parsed.debt) debt = String(parsed.debt);
        sessionStorage.removeItem('bondly_orig_calc');
      }
    } catch {}
    if (income) {
      setForm(f => ({ ...f, grossIncome: income, monthlyDebt: debt || f.monthlyDebt }));
      setPrefillIncome(parseFloat(income) || 0);
    }
  }, []);

  const income = parseFloat(form.grossIncome) || 0;
  const debt = parseFloat(form.monthlyDebt) || 0;
  const price = parseFloat(form.propertyPrice) || 0;
  const deposit = parseFloat(form.deposit) || 0;
  const bondAmount = Math.max(0, price - deposit);
  const maxBond = income > 0 ? calcMaxBond(income, debt) : 0;

  function set(field) {
    return e => {
      const val = e.target ? e.target.value : e;
      setForm(f => ({ ...f, [field]: val }));
      setErrors(er => ({ ...er, [field]: undefined }));
    };
  }

  function next() { setStep(s => s + 1); }
  function back() { setStep(s => s - 1); }

  function validateStep3() {
    const e = {};
    if (!form.suburb.trim()) e.suburb = 'Please enter a suburb or area';
    return e;
  }

  function validateStep4() {
    const e = {};
    if (!form.name.trim()) e.name = 'Full name is required';
    if (form.idNumber && !validateSAID(form.idNumber)) e.idNumber = 'SA ID must be 13 digits';
    if (!form.employer.trim()) e.employer = 'Employer name is required';
    if (!form.phone.trim()) e.phone = 'Phone number is required';
    if (!form.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) e.email = 'Valid email is required';
    if (!form.password || form.password.length < 8) e.password = 'Password must be at least 8 characters';
    if (!/[0-9!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(form.password || '')) e.password = 'Password must include a number or special character';
    return e;
  }

  function goStep3() {
    setStep(3);
  }

  function goStep4() {
    const e = validateStep3();
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep(4);
  }

  function goStep5() {
    const e = validateStep4();
    if (Object.keys(e).length) { setErrors(e); return; }
    setStep(5);
  }

  async function submit() {
    setSubmitting(true);
    setSubmitError('');
    try {
      // 1. Register account (or handle existing)
      const regRes = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          phone: form.phone,
          idNumber: form.idNumber || undefined,
        }),
      });
      let token;
      if (regRes.ok) {
        const regData = await regRes.json();
        token = regData.data?.token || regData.token;
      } else if (regRes.status === 409) {
        // Account exists — log in instead
        const loginRes = await fetch('/api/auth/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email: form.email, password: form.password }),
        });
        if (!loginRes.ok) {
          const d = await loginRes.json().catch(() => ({}));
          setSubmitError(d.message || 'An account with that email exists. Check your password and try again.');
          return;
        }
        const loginData = await loginRes.json();
        token = loginData.data?.token || loginData.token;
      } else {
        const d = await regRes.json().catch(() => ({}));
        setSubmitError(d.message || 'Could not create account. Please try again.');
        return;
      }

      if (!token) {
        setSubmitError('Authentication failed. Please try again.');
        return;
      }

      // 2. Store token so user can access their portal
      localStorage.setItem('bondly_token', token);

      // 3. Submit formal application to Bond Desk
      const appRes = await fetch('/api/applications/start', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          type: 'origination',
          income: income || undefined,
          debt: debt || undefined,
          deposit: deposit || undefined,
          employment: form.employmentType || undefined,
          yearsEmployed: form.yearsEmployed ? parseInt(form.yearsEmployed) : undefined,
          phone: form.phone,
          idNumber: form.idNumber || undefined,
          property: price > 0 ? {
            purchasePrice: price,
            deposit,
            bondAmount,
            propertyType: form.propertyType,
            otpStatus: form.otpStatus,
            suburb: form.suburb,
            province: form.province,
          } : undefined,
          notes: `Employer: ${form.employer}${form.yearsEmployed ? ` (${form.yearsEmployed} yrs)` : ''}`,
        }),
      });

      // 4. Also create CRM lead for broker follow-up
      fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          phone: form.phone,
          monthlyIncome: income || null,
          existingDebt: debt || null,
          employment: form.employmentType || null,
          employer: form.employer || null,
          maxBond: bondAmount || maxBond || null,
          purpose: 'origination',
          source: 'origination_full_application',
          hasProperty: price > 0,
          suburb: form.suburb || null,
          province: form.province || null,
        }),
      }).catch(() => {});

      const appData = appRes.ok ? await appRes.json().catch(() => ({})) : {};
      setResult({
        maxBond,
        bondAmount: bondAmount || maxBond,
        applicationId: appData.data?.application?.id || null,
        bankVisible: appData.data?.application?.bankVisible ?? true,
      });
      setStep(6);
    } catch (err) {
      setSubmitError('Something went wrong. Please try again or contact us on WhatsApp.');
    } finally {
      setSubmitting(false);
    }
  }

  // Result screen
  if (step === 6 && result) {
    return (
      <div className="orig-pa">
        <header className="orig-pa__nav">
          <Link to="/" className="orig-pa__logo">Bondly <span>Home</span></Link>
        </header>
        <main className="orig-pa__body">
          <div className="orig-pa__card orig-pa__card--result">
            <div className="orig-pa__result-icon" style={{ color: '#4a9e6b', fontSize: '3rem' }}>✓</div>
            <h2>Application submitted to 7 banks!</h2>
            <p className="orig-pa__sub">Your formal mortgage application is now live in our broker system. Banks will compete for your business.</p>
            <div className="orig-pa__result-amount">{fmt(result.bondAmount || result.maxBond)}</div>
            <p className="orig-pa__sub" style={{ fontSize: '0.8rem', marginTop: 4 }}>Estimated bond amount — banks will confirm exact qualifying amount</p>

            <div className="orig-pa__result-banks" style={{ marginTop: 24 }}>
              <p className="orig-pa__banks-label">Your application has been sent to:</p>
              <div className="orig-pa__banks-list">
                {['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'Investec', 'SA Home Loans'].map(b => (
                  <span key={b} className="orig-pa__bank-tag">{b}</span>
                ))}
              </div>
            </div>

            <div style={{ marginTop: 24, background: 'rgba(234,179,8,0.08)', border: '1px solid rgba(234,179,8,0.3)', borderRadius: 10, padding: '16px 20px', textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: '#92400e', marginBottom: 8 }}>Speed up your approval — upload documents</div>
              <p style={{ fontSize: '0.8125rem', color: '#78350f', margin: '0 0 10px' }}>Applications with documents go to the front of the queue. Banks need:</p>
              <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem', color: '#78350f', lineHeight: 1.7 }}>
                <li>Last 3 months' payslips</li>
                <li>Last 3 months' bank statements</li>
                <li>Copy of SA ID / passport</li>
              </ul>
              <a href="http://localhost:5173/dashboard" style={{ display: 'inline-block', marginTop: 12, padding: '9px 18px', background: '#4a9e6b', color: '#fff', borderRadius: 8, fontWeight: 700, fontSize: '0.875rem', textDecoration: 'none' }}>
                Upload documents in my portal →
              </a>
            </div>

            <div style={{ marginTop: 24, borderTop: '1px solid rgba(0,0,0,0.08)', paddingTop: 20 }}>
              <p style={{ fontSize: '0.875rem', color: '#555', margin: '0 0 12px' }}>What happens next</p>
              {[
                { icon: '📞', title: 'Bondly consultant calls you', sub: 'Within 1 business day to confirm your details' },
                { icon: '🏦', title: 'Banks review your application', sub: '3–5 business days for initial feedback' },
                { icon: '✅', title: 'You receive competing offers', sub: 'Compare rates and choose the best deal' },
              ].map((s, i) => (
                <div key={i} style={{ display: 'flex', gap: 12, marginBottom: 14, alignItems: 'flex-start', textAlign: 'left' }}>
                  <span style={{ fontSize: '1.25rem', flexShrink: 0 }}>{s.icon}</span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{s.title}</div>
                    <div style={{ fontSize: '0.8rem', color: '#666' }}>{s.sub}</div>
                  </div>
                </div>
              ))}
            </div>

            <a
              href={`https://wa.me/27796971786?text=${encodeURIComponent(`Hi Bondly — I just submitted my home loan application online. My name is ${form.name}. Looking forward to hearing from you.`)}`}
              className="orig-pa__wa-cta"
              target="_blank"
              rel="noreferrer"
              style={{ marginTop: 20 }}
            >
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/>
              </svg>
              Chat to a consultant on WhatsApp →
            </a>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="orig-pa">
      <header className="orig-pa__nav">
        <Link to="/" className="orig-pa__logo">Bondly <span>Home</span></Link>
        <div className="orig-pa__steps" role="list" aria-label="Application progress">
          {Array.from({ length: TOTAL_STEPS }, (_, i) => i + 1).map(n => (
            <div
              key={n}
              role="listitem"
              className={`orig-pa__step-dot${step >= n ? ' active' : ''}${step > n ? ' done' : ''}`}
              aria-label={`Step ${n} of ${TOTAL_STEPS}${step > n ? ' — completed' : step === n ? ' — current' : ''}`}
            >
              {step > n ? '✓' : n}
            </div>
          ))}
        </div>
      </header>

      <div className="orig-pa__progress-bar" role="progressbar" aria-valuenow={step} aria-valuemin={1} aria-valuemax={TOTAL_STEPS}>
        <div className="orig-pa__progress-fill" style={{ width: `${((step - 1) / TOTAL_STEPS) * 100}%` }} />
      </div>
      <p className="orig-pa__step-label">Step {step} of {TOTAL_STEPS} — {STEP_LABELS[step - 1]}</p>

      <main className="orig-pa__body">

        {/* Step 1 — Employment */}
        {step === 1 && (
          <div className="orig-pa__card">
            <h2>How are you employed?</h2>
            <p className="orig-pa__sub">This helps us match you with the right banks. Takes 3 minutes — free, no credit check.</p>
            <div className="orig-pa__options" role="group" aria-label="Employment type">
              {EMPLOYMENT_TYPES.map(t => (
                <button
                  key={t.value}
                  className={`orig-pa__option${form.employmentType === t.value ? ' selected' : ''}`}
                  onClick={() => { setForm(f => ({ ...f, employmentType: t.value })); next(); }}
                  aria-pressed={form.employmentType === t.value}
                >
                  <strong>{t.label}</strong>
                  <span>{t.desc}</span>
                </button>
              ))}
            </div>
            {form.employmentType === 'self_employed' && (
              <div style={{ marginTop: 16, padding: '14px 16px', background: 'rgba(217,119,6,0.06)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 10, fontSize: '0.8125rem', color: '#78350f' }}>
                <strong>Note for self-employed applicants:</strong> banks require 2 years of audited financials or tax returns (IT34) and typically want a larger deposit (20–30%). We'll still go to all 7 banks for you.
              </div>
            )}
          </div>
        )}

        {/* Step 2 — Income */}
        {step === 2 && (
          <div className="orig-pa__card">
            {prefillIncome > 0 && (
              <p className="orig-pa__prefill-note">Pre-filled from your calculator — edit if needed.</p>
            )}
            <h2>What's your monthly income?</h2>
            <p className="orig-pa__sub">Enter your gross (before-tax) monthly income. This determines your maximum bond.</p>
            <div className="orig-pa__fields">
              <label className="orig-pa__label">
                Gross monthly income (R)
                <input
                  className="orig-pa__input"
                  inputMode="numeric"
                  placeholder="e.g. 35 000"
                  value={form.grossIncome ? Number(form.grossIncome).toLocaleString('en-ZA') : form.grossIncome}
                  onChange={e => setForm(f => ({ ...f, grossIncome: e.target.value.replace(/\s/g, '') }))}
                />
              </label>
              <label className="orig-pa__label">
                Total monthly debt repayments (R) — optional
                <input
                  className="orig-pa__input"
                  inputMode="numeric"
                  placeholder="e.g. 3 500 (car, personal loans, credit cards)"
                  value={form.monthlyDebt ? Number(form.monthlyDebt).toLocaleString('en-ZA') : form.monthlyDebt}
                  onChange={e => setForm(f => ({ ...f, monthlyDebt: e.target.value.replace(/\s/g, '') }))}
                />
              </label>

              {income > 0 && (
                <div className="orig-pa__estimate">
                  <span className="orig-pa__estimate-label">You could qualify for up to</span>
                  <span className="orig-pa__estimate-amount">{fmt(maxBond)}</span>
                  <span className="orig-pa__estimate-note">Subject to bank approval · based on standard affordability rules</span>
                </div>
              )}
            </div>
            <div className="orig-pa__actions">
              <button className="orig-btn-back" onClick={back}>← Back</button>
              <button className="orig-btn-next" disabled={!form.grossIncome} onClick={goStep3}>
                Next: Property →
              </button>
            </div>
          </div>
        )}

        {/* Step 3 — Property */}
        {step === 3 && (
          <div className="orig-pa__card">
            <h2>Tell us about the property</h2>
            <p className="orig-pa__sub">If you haven't found a property yet, give your best estimate — you can update this later.</p>
            <div className="orig-pa__fields">

              <div style={{ marginBottom: 16 }}>
                <div style={{ fontSize: '0.8rem', fontWeight: 700, color: '#555', marginBottom: 8 }}>Where are you in your search?</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                  {[
                    { value: 'searching', label: 'Still searching', sub: 'I want to know what I can afford' },
                    { value: 'offer_signed', label: 'Offer signed (OTP)', sub: 'I have a specific property in mind' },
                  ].map(o => (
                    <button
                      key={o.value}
                      type="button"
                      className={`orig-pa__option${form.otpStatus === o.value ? ' selected' : ''}`}
                      onClick={() => setForm(f => ({ ...f, otpStatus: o.value }))}
                      style={{ padding: '12px 14px' }}
                    >
                      <strong>{o.label}</strong>
                      <span>{o.sub}</span>
                    </button>
                  ))}
                </div>
              </div>

              <label className="orig-pa__label">
                Property price (R)
                <input className="orig-pa__input" inputMode="numeric" placeholder="e.g. 1 200 000"
                  value={form.propertyPrice ? Number(form.propertyPrice).toLocaleString('en-ZA') : form.propertyPrice}
                  onChange={e => setForm(f => ({ ...f, propertyPrice: e.target.value.replace(/\s/g, '') }))}
                />
              </label>

              <label className="orig-pa__label">
                Deposit available (R)
                <input className="orig-pa__input" inputMode="numeric" placeholder="e.g. 120 000 (can be 0)"
                  value={form.deposit ? Number(form.deposit).toLocaleString('en-ZA') : form.deposit}
                  onChange={e => setForm(f => ({ ...f, deposit: e.target.value.replace(/\s/g, '') }))}
                />
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="orig-pa__label">
                  Suburb / area *
                  <input className="orig-pa__input" type="text" placeholder="e.g. Sandton"
                    value={form.suburb} onChange={set('suburb')}
                    style={errors.suburb ? { borderColor: '#dc2626' } : {}}
                  />
                  {errors.suburb && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.suburb}</span>}
                </label>
                <label className="orig-pa__label">
                  Province
                  <select className="orig-pa__input" value={form.province} onChange={set('province')}>
                    {['Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape','Free State','Mpumalanga','Limpopo','North West','Northern Cape'].map(p => (
                      <option key={p}>{p}</option>
                    ))}
                  </select>
                </label>
              </div>

              <label className="orig-pa__label">
                Property type
                <select className="orig-pa__input" value={form.propertyType} onChange={set('propertyType')}>
                  {['House','Townhouse','Sectional title','Apartment','Vacant land'].map(t => (
                    <option key={t}>{t}</option>
                  ))}
                </select>
              </label>

              {bondAmount > 0 && (
                <div className="orig-pa__estimate">
                  <span className="orig-pa__estimate-label">Bond amount needed</span>
                  <span className="orig-pa__estimate-amount">{fmt(bondAmount)}</span>
                  <span className="orig-pa__estimate-note">Property price minus deposit</span>
                </div>
              )}
            </div>
            <div className="orig-pa__actions">
              <button className="orig-btn-back" onClick={back}>← Back</button>
              <button className="orig-btn-next" onClick={goStep4}>Next: About you →</button>
            </div>
          </div>
        )}

        {/* Step 4 — Personal details + account creation */}
        {step === 4 && (
          <div className="orig-pa__card">
            <h2>About you</h2>
            <p className="orig-pa__sub">We need these details to submit your application to banks. Your account is created here so you can track your offers.</p>
            <div className="orig-pa__fields">

              <label className="orig-pa__label">
                Full name *
                <input className="orig-pa__input" type="text" placeholder="e.g. Sipho Dlamini"
                  value={form.name} onChange={set('name')}
                  style={errors.name ? { borderColor: '#dc2626' } : {}}
                />
                {errors.name && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.name}</span>}
              </label>

              <label className="orig-pa__label">
                SA ID number *
                <input className="orig-pa__input" type="text" inputMode="numeric" maxLength={13}
                  placeholder="13-digit ID number"
                  value={form.idNumber} onChange={set('idNumber')}
                  style={errors.idNumber ? { borderColor: '#dc2626' } : {}}
                />
                {errors.idNumber && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.idNumber}</span>}
                <span style={{ fontSize: '0.75rem', color: '#666', marginTop: 2, display: 'block' }}>
                  Required by all SA banks for FICA verification
                </span>
              </label>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <label className="orig-pa__label">
                  Employer name *
                  <input className="orig-pa__input" type="text" placeholder="e.g. Shoprite Holdings"
                    value={form.employer} onChange={set('employer')}
                    style={errors.employer ? { borderColor: '#dc2626' } : {}}
                  />
                  {errors.employer && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.employer}</span>}
                </label>
                <label className="orig-pa__label">
                  Years at employer
                  <input className="orig-pa__input" type="number" min="0" max="50" placeholder="e.g. 3"
                    value={form.yearsEmployed} onChange={set('yearsEmployed')}
                  />
                </label>
              </div>

              <label className="orig-pa__label">
                Phone number *
                <input className="orig-pa__input" type="tel" placeholder="+27 82 000 0000"
                  value={form.phone} onChange={set('phone')}
                  style={errors.phone ? { borderColor: '#dc2626' } : {}}
                />
                {errors.phone && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.phone}</span>}
              </label>

              <div style={{ marginTop: 8, paddingTop: 16, borderTop: '1px solid rgba(0,0,0,0.08)' }}>
                <p style={{ fontSize: '0.8rem', fontWeight: 700, color: '#333', marginBottom: 12 }}>Create your Bondly account to track offers</p>

                <label className="orig-pa__label">
                  Email address *
                  <input className="orig-pa__input" type="email" placeholder="you@example.com"
                    value={form.email} onChange={set('email')}
                    style={errors.email ? { borderColor: '#dc2626' } : {}}
                  />
                  {errors.email && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.email}</span>}
                </label>

                <label className="orig-pa__label" style={{ marginTop: 12 }}>
                  Create a password *
                  <input className="orig-pa__input" type="password" placeholder="At least 8 characters, include a number"
                    value={form.password} onChange={set('password')}
                    style={errors.password ? { borderColor: '#dc2626' } : {}}
                  />
                  {errors.password && <span style={{ color: '#dc2626', fontSize: '0.75rem' }}>{errors.password}</span>}
                </label>
              </div>
            </div>
            <div className="orig-pa__actions">
              <button className="orig-btn-back" onClick={back}>← Back</button>
              <button className="orig-btn-next" onClick={goStep5}>Review & submit →</button>
            </div>
          </div>
        )}

        {/* Step 5 — Confirm & submit */}
        {step === 5 && (
          <div className="orig-pa__card">
            <h2>Review your application</h2>
            <p className="orig-pa__sub" style={{ color: '#1e3a5f', fontWeight: 600 }}>
              You are about to submit a formal home loan application. This is the real thing — banks will receive and process your application.
            </p>

            <div style={{ background: '#f8fafc', border: '1.5px solid #e2e8f0', borderRadius: 12, padding: '20px 24px', margin: '16px 0', textAlign: 'left' }}>
              <div style={{ fontWeight: 700, fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: '#888', marginBottom: 14 }}>Application summary</div>
              {[
                ['Applicant', form.name],
                ['Employment', `${form.employmentType === 'salaried' ? 'Salaried' : 'Self-employed'} at ${form.employer}`],
                ['Monthly income', fmt(income)],
                ...(debt > 0 ? [['Monthly debt', fmt(debt)]] : []),
                ['Max bond', fmt(maxBond)],
                ...(form.suburb ? [['Property area', `${form.suburb}, ${form.province}`]] : []),
                ...(price > 0 ? [['Property price', fmt(price)]] : []),
                ...(bondAmount > 0 ? [['Bond needed', fmt(bondAmount)]] : []),
                ['Email', form.email],
                ['Phone', form.phone],
              ].map(([label, value]) => (
                <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '5px 0', borderBottom: '1px solid #f0f0f0', fontSize: '0.875rem' }}>
                  <span style={{ color: '#666' }}>{label}</span>
                  <strong style={{ color: '#222' }}>{value}</strong>
                </div>
              ))}
            </div>

            <div style={{ background: 'rgba(74,158,107,0.07)', border: '1.5px solid rgba(74,158,107,0.3)', borderRadius: 12, padding: '16px 20px', marginBottom: 20, textAlign: 'left' }}>
              <div style={{ fontWeight: 700, color: '#1a6640', marginBottom: 6 }}>Your application goes to all 7 SA banks</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
                {['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'Investec', 'SA Home Loans'].map(b => (
                  <span key={b} className="orig-pa__bank-tag">{b}</span>
                ))}
              </div>
              <p style={{ fontSize: '0.8rem', color: '#1a6640', margin: 0 }}>
                No credit check at this stage. Banks will only do a full check once you accept an offer. Free service — Bondly earns a referral fee from the bank you choose.
              </p>
            </div>

            {submitError && (
              <div style={{ background: 'rgba(220,38,38,0.08)', border: '1px solid rgba(220,38,38,0.3)', borderRadius: 8, padding: '12px 16px', marginBottom: 16, color: '#dc2626', fontSize: '0.875rem' }}>
                {submitError}
              </div>
            )}

            <p className="orig-pa__privacy" style={{ marginBottom: 16 }}>
              🔒 Your information is encrypted. We'll never share your details without your consent.
            </p>

            <div className="orig-pa__actions">
              <button className="orig-btn-back" onClick={back}>← Edit</button>
              <button
                className="orig-btn-next"
                onClick={submit}
                disabled={submitting}
                style={{ background: submitting ? '#888' : undefined }}
              >
                {submitting ? 'Submitting to banks…' : 'Submit to 7 banks →'}
              </button>
            </div>
          </div>
        )}

      </main>
    </div>
  );
}
