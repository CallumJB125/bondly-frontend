import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle } from 'lucide-react';
import { leads } from '../../lib/api.js';
import { useToast } from '../../components/Toast.jsx';
import { fmt, fmtPct } from '../../lib/format.js';
import { calcMonthly } from '../../lib/finance.js';
import { PRIME_RATE, BANKS, BANK_SPREADS } from '../../lib/constants.js';
import Button from '../../components/Button.jsx';
import Input, { Select } from '../../components/Input.jsx';
import './GetAQuote.css';

const EMPLOYMENT_TYPES = ['Permanent employee', 'Contract', 'Self-employed', 'Other'];
const CONTACT_METHODS  = ['WhatsApp', 'Phone call', 'Email'];

function calcPotentialSaving(balance, currentRate, term) {
  if (!balance || !currentRate || !term) return null;
  const monthly = calcMonthly(balance, currentRate, term);
  // Best possible spread from BANK_SPREADS (lowest spread = best deal)
  const bestSpread = Math.min(...Object.values(BANK_SPREADS));
  const bestRate = PRIME_RATE + bestSpread;
  if (bestRate >= currentRate) return null;
  const bestMonthly = calcMonthly(balance, bestRate, term);
  const monthlySaving = monthly - bestMonthly;
  const totalSaving = monthlySaving * term * 12;
  return { monthlySaving, totalSaving, bestRate };
}

export default function GetAQuote() {
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();
  const showToast = useToast();

  const [bond, setBond] = useState({
    currentBank:    '',
    currentBalance: '',
    currentRate:    '',
    currentTerm:    '20',
  });
  const [contact, setContact] = useState({
    name:          '',
    phone:         '',
    email:         '',
    contactMethod: 'WhatsApp',
  });
  const [financial, setFinancial] = useState({
    monthlyIncome: '',
    employment:    'Permanent employee',
    yearsEmployed: '',
    existingDebt:  '',
  });

  function setBondField(k)      { return e => setBond(f => ({ ...f, [k]: e.target.value })); }
  function setContactField(k)   { return e => setContact(f => ({ ...f, [k]: e.target.value })); }
  function setFinancialField(k) { return e => setFinancial(f => ({ ...f, [k]: e.target.value })); }

  const balance = parseFloat(bond.currentBalance) || 0;
  const rate    = parseFloat(bond.currentRate)    || 0;
  const term    = parseInt(bond.currentTerm)      || 20;
  const saving  = balance > 0 && rate > 0 ? calcPotentialSaving(balance, rate, term) : null;

  function validateStep1() {
    if (!bond.currentBank)          { showToast('Please select your current bank', 'error'); return false; }
    if (!balance || balance < 50000) { showToast('Please enter your outstanding balance (minimum R 50 000)', 'error'); return false; }
    if (!rate || rate < 5)           { showToast('Please enter your current interest rate', 'error'); return false; }
    return true;
  }

  function validateStep2() {
    if (!contact.name.trim())  { showToast('Please enter your name', 'error'); return false; }
    if (!contact.phone.trim()) { showToast('Please enter your phone number', 'error'); return false; }
    const digits = contact.phone.replace(/\s+/g, '');
    if (!/^(\+27|0)[6-8]\d{8}$/.test(digits)) { showToast('Please enter a valid SA mobile number, e.g. +27 82 123 4567', 'error'); return false; }
    return true;
  }

  async function submit() {
    if (!validateStep2()) return;
    setLoading(true);
    try {
      await leads.submit({
        source:         'get_a_quote',
        name:           contact.name.trim(),
        phone:          contact.phone.trim(),
        email:          contact.email.trim() || undefined,
        contactMethod:  contact.contactMethod,
        currentBank:    bond.currentBank,
        currentBalance: balance || undefined,
        currentRate:    rate    || undefined,
        currentTerm:    term    || undefined,
        monthlyIncome:  parseFloat(financial.monthlyIncome) || undefined,
        employment:     financial.employment,
        yearsEmployed:  parseInt(financial.yearsEmployed)   || undefined,
        existingDebt:   parseFloat(financial.existingDebt)  || undefined,
        purpose:        'switch',
      });
      setStep(4); // done
    } catch (err) {
      showToast(err.message || 'Could not submit — please try again', 'error');
    } finally {
      setLoading(false);
    }
  }

  // ── Done screen ──────────────────────────────────────────────────────────────
  if (step === 4) {
    return (
      <div className="quote-page">
        <div className="quote-card quote-card--done">
          <div style={{ marginBottom: 'var(--space-4)', display:'flex', justifyContent:'center' }}><CheckCircle size={64} color="var(--color-success)"/></div>
          <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', marginBottom: 'var(--space-3)' }}>
            We're on it!
          </h1>
          <p style={{ color: 'var(--text-secondary)', lineHeight: 1.7, marginBottom: 'var(--space-5)' }}>
            A Bondly advisor will contact <strong>{contact.name}</strong> via{' '}
            <strong>{contact.contactMethod.toLowerCase()}</strong> — usually within a few hours
            during business hours (Mon–Fri, 8am–5pm).
          </p>
          {saving && (
            <div className="quote-saving-box">
              <div className="quote-saving-label">Potential saving</div>
              <div className="quote-saving-amount">{fmt(Math.round(saving.monthlySaving))}<span>/mo</span></div>
              <div className="quote-saving-sub">Up to {fmt(Math.round(saving.totalSaving))} over the life of your bond</div>
            </div>
          )}
          <div style={{ display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center', marginTop: 'var(--space-6)' }}>
            <Button variant="lime" onClick={() => navigate('/register')}>Create a free account →</Button>
            <Button variant="ghost" onClick={() => navigate('/')}>Back to home</Button>
          </div>
          <p style={{ marginTop: 'var(--space-4)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
            Want to track your bond &amp; see your savings live?{' '}
            <Link to="/register" style={{ color: 'var(--mint)' }}>Sign up free</Link> — takes 30 seconds.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="quote-page">
      {/* Progress bar */}
      <div className="quote-progress">
        <div className="quote-progress__bar" style={{ width: `${(step / 3) * 100}%` }} />
      </div>

      <div className="quote-card">
        <Link to="/" className="quote-logo">Bondly</Link>

        {/* ── Step 1: Bond details ──────────────────────────────────────── */}
        {step === 1 && (
          <>
            <h1 className="quote-title">Check your bond amount</h1>
            <p className="quote-sub">Tell us about your current home loan and we'll show you exactly how much you could save by switching banks.</p>

            <div className="quote-form">
              <Select label="Current bank" id="q-bank" value={bond.currentBank} onChange={setBondField('currentBank')}>
                <option value="">Select your bank</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>

              <Input label="Outstanding balance (R)" id="q-balance" type="number" value={bond.currentBalance}
                onChange={setBondField('currentBalance')} placeholder="e.g. 1 200 000" min="50000" />

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Current interest rate (%)" id="q-rate" type="number" value={bond.currentRate}
                  onChange={setBondField('currentRate')} placeholder={String(PRIME_RATE)} step="0.25" min="5" max="30" />
                <Input label="Years remaining" id="q-term" type="number" value={bond.currentTerm}
                  onChange={setBondField('currentTerm')} placeholder="20" min="1" max="30" />
              </div>

              {/* Live savings preview */}
              {saving && (
                <div className="quote-saving-preview">
                  <div className="quote-saving-preview__label">Potential saving if you switch</div>
                  <div className="quote-saving-preview__amount">{fmt(Math.round(saving.monthlySaving))}<span>/mo</span></div>
                  <div className="quote-saving-preview__sub">
                    Best available rate: <strong>{fmtPct(saving.bestRate)}</strong> ·{' '}
                    Save up to <strong>{fmt(Math.round(saving.totalSaving))}</strong> total
                  </div>
                </div>
              )}

              <Button variant="lime" full onClick={() => { if (validateStep1()) setStep(2); }}>
                See my savings →
              </Button>

              <div style={{ textAlign: 'center', marginTop: 'var(--space-2)', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                Don't have a bond yet?{' '}
                <Link to="/preapproval" style={{ color: 'var(--mint)', fontWeight: 600 }}>Check what you qualify for →</Link>
              </div>
            </div>
          </>
        )}

        {/* ── Step 2: Contact details ───────────────────────────────────── */}
        {step === 2 && (
          <>
            <h1 className="quote-title">Where should we send your quote?</h1>
            <p className="quote-sub">A Bondly advisor will contact you with competing bank offers — free of charge.</p>

            {saving && (
              <div className="quote-saving-preview quote-saving-preview--compact">
                <span>Your potential saving: </span>
                <strong style={{ color: 'var(--lime-dark)' }}>{fmt(Math.round(saving.monthlySaving))}/mo</strong>
                <span style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem' }}> · {fmt(Math.round(saving.totalSaving))} total</span>
              </div>
            )}

            <div className="quote-form">
              <Input label="Full name" id="q-name" type="text" value={contact.name}
                onChange={setContactField('name')} placeholder="Jane Smith" required autoFocus />

              <Input label="Mobile number (WhatsApp)" id="q-phone" type="tel" value={contact.phone}
                onChange={setContactField('phone')} placeholder="+27 82 123 4567" required />

              <Input label="Email address (optional)" id="q-email" type="email" value={contact.email}
                onChange={setContactField('email')} placeholder="you@example.com" />

              <div>
                <div style={{ fontSize: '0.875rem', fontWeight: 600, marginBottom: 'var(--space-2)', color: 'var(--text-secondary)' }}>
                  How would you like us to contact you?
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)', flexWrap: 'wrap' }}>
                  {CONTACT_METHODS.map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setContact(f => ({ ...f, contactMethod: m }))}
                      className={`quote-contact-chip ${contact.contactMethod === m ? 'active' : ''}`}
                    >
                      {m}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <Button variant="ghost" onClick={() => setStep(1)}>← Back</Button>
                <Button variant="lime" full onClick={() => { if (validateStep2()) setStep(3); }}>
                  Almost done →
                </Button>
              </div>
            </div>
          </>
        )}

        {/* ── Step 3: Financial details ─────────────────────────────────── */}
        {step === 3 && (
          <>
            <h1 className="quote-title">One last thing</h1>
            <p className="quote-sub">Banks need to verify you can afford the bond. This takes 30 seconds.</p>

            <div className="quote-form">
              <Input label="Gross monthly income (R)" id="q-income" type="number" value={financial.monthlyIncome}
                onChange={setFinancialField('monthlyIncome')} placeholder="e.g. 45 000" min="0" />

              <Select label="Employment type" id="q-employment" value={financial.employment} onChange={setFinancialField('employment')}>
                {EMPLOYMENT_TYPES.map(e => <option key={e} value={e}>{e}</option>)}
              </Select>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                <Input label="Years at current employer" id="q-years" type="number" value={financial.yearsEmployed}
                  onChange={setFinancialField('yearsEmployed')} placeholder="3" min="0" max="50" />
                <Input label="Other monthly debt (R)" id="q-debt" type="number" value={financial.existingDebt}
                  onChange={setFinancialField('existingDebt')} placeholder="Car, store cards…" min="0" />
              </div>

              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.5, margin: 0 }}>
                By submitting you agree to Bondly's{' '}
                <Link to="/terms" style={{ color: 'var(--forest)' }}>Terms</Link> and{' '}
                <Link to="/privacy" style={{ color: 'var(--forest)' }}>Privacy Policy</Link>.
                We won't share your details without your permission.
              </p>

              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <Button variant="ghost" onClick={() => setStep(2)}>← Back</Button>
                <Button variant="lime" full loading={loading} onClick={submit}>
                  Get my free quote →
                </Button>
              </div>
            </div>
          </>
        )}

        {/* Guest note */}
        {step < 4 && (
          <p className="quote-guest">
            Already have an account?{' '}
            <Link to="/login" state={{ tab: 'login' }}>Sign in</Link>
            {' '}to use the full dashboard.
          </p>
        )}
      </div>
    </div>
  );
}
