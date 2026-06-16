import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Home, RefreshCw, BarChart2, CreditCard } from 'lucide-react';
import { loans } from '../../lib/api.js';
import { useToast } from '../../components/Toast.jsx';
import { trackAction } from '../../lib/session.js';
import { PRIME_RATE, BANKS } from '../../lib/constants.js';
import Button from '../../components/Button.jsx';
import Input, { Select } from '../../components/Input.jsx';
import './Auth.css';
import './Onboarding.css';

export default function Onboarding() {
  const [step, setStep]   = useState(1);   // 1 = add bond, 2 = done
  const [loading, setLoading] = useState(false);
  const [form, setForm]   = useState({
    bank: 'ABSA',
    amount: '',
    rate: String(PRIME_RATE),
    term: '20',
    purchasePrice: '',
  });
  const startedAt = useRef(Date.now());

  const showToast = useToast();
  const navigate  = useNavigate();

  useEffect(() => { trackAction('onboarding_viewed'); }, []);

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  async function addBond() {
    if (!form.amount || parseFloat(form.amount) <= 0) {
      showToast('Please enter a valid bond amount', 'error');
      trackAction('onboarding_bond_submit_invalid');
      return;
    }
    trackAction('onboarding_bond_submitted', {
      bank: form.bank,
      hasPurchasePrice: !!form.purchasePrice,
      dwellMs: Date.now() - startedAt.current,
    });
    setLoading(true);
    try {
      await loans.create({
        bank:          form.bank,
        amount:        parseFloat(form.amount),
        rate:          parseFloat(form.rate) || PRIME_RATE,
        term:          parseInt(form.term)   || 20,
        purchasePrice: parseFloat(form.purchasePrice) || undefined,
      });
      trackAction('onboarding_bond_success');
      setStep(2);
    } catch (err) {
      trackAction('onboarding_bond_failed', { error: String(err.message).slice(0, 80) });
      showToast(err.message || 'Could not add bond', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (step === 2) {
    let hookSaving = null;
    try { hookSaving = JSON.parse(sessionStorage.getItem('bondly_hook_context') || 'null')?.monthlySaving || null; } catch {}
    const ctaLabel = hookSaving > 0
      ? `Confirm my R${hookSaving.toLocaleString()}/month saving →`
      : 'Check if I can save on my bond →';
    return (
      <div className="auth-page">
        <div className="auth-card onboarding-card">
          <div className="onboarding-success">
            <div style={{ marginBottom: 'var(--space-4)' }}><Home size={48} strokeWidth={1.5} color="var(--lime)" /></div>
            <h2>Your dashboard is ready</h2>
            <p style={{ color: 'var(--text-secondary)', marginBottom: 'var(--space-5)' }}>Here's what's waiting for you:</p>
            <div style={{ display: 'grid', gap: 'var(--space-3)', marginBottom: 'var(--space-5)', textAlign: 'left' }}>
              {[
                { Icon: RefreshCw, title: 'Compare all 7 banks', desc: 'See if you could save by switching — and by how much' },
                { Icon: BarChart2, title: 'Amortisation schedule', desc: 'Month-by-month breakdown of your full repayment' },
                { Icon: Home,      title: 'Equity tracker', desc: 'Watch your ownership stake grow over time' },
                { Icon: CreditCard,title: 'Bond health score', desc: 'A score out of 100 showing your bond health' },
              ].map(f => (
                <div key={f.title} style={{ display: 'flex', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'rgba(0,0,0,0.04)', borderRadius: 8 }}>
                  <span style={{ flexShrink: 0, display: 'flex', alignItems: 'center', color: 'var(--lime)' }}><f.Icon size={20} /></span>
                  <div>
                    <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{f.title}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
            <Button variant="lime" full onClick={() => { trackAction('onboarding_cta_swaps'); navigate('/dashboard', { state: { tab: 'swaps' } }); }}>{ctaLabel}</Button>
            <button className="auth-guest" style={{ border: 'none', background: 'none', marginTop: 'var(--space-2)' }} onClick={() => { trackAction('onboarding_cta_overview'); navigate('/dashboard'); }}>
              <span>Go to overview first</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card onboarding-card">
        <div className="auth-logo">Bondly</div>
        <h1 className="auth-title">Add your bond</h1>
        <p className="auth-sub">Enter your home loan details to unlock your dashboard.</p>

        <div className="auth-form">
          <Select label="Your bank" id="obBank" value={form.bank} onChange={set('bank')}>
            {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
          </Select>

          <Input label="Outstanding balance (R)" id="obAmount" type="number" value={form.amount} onChange={set('amount')} placeholder="1 200 000" required min="10000"
            onBlur={() => form.amount && trackAction('onboarding_field_filled', { field: 'amount' })} />

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
            <Input label="Interest rate (%)" id="obRate" type="number" value={form.rate} onChange={set('rate')} placeholder={String(PRIME_RATE)} step="0.25" min="5" max="30"
              onBlur={() => form.rate && parseFloat(form.rate) !== PRIME_RATE && trackAction('onboarding_field_filled', { field: 'rate' })} />
            <Input label="Term remaining (years)" id="obTerm" type="number" value={form.term} onChange={set('term')} placeholder="20" min="1" max="30"
              onBlur={() => form.term && form.term !== '20' && trackAction('onboarding_field_filled', { field: 'term' })} />
          </div>

          <Input label="Original purchase price (R, optional)" id="obPrice" type="number" value={form.purchasePrice} onChange={set('purchasePrice')} placeholder="Helps track equity"
            onBlur={() => form.purchasePrice && trackAction('onboarding_field_filled', { field: 'purchasePrice' })} />

          <Button variant="lime" full loading={loading} onClick={addBond}>Add bond →</Button>
          <button className="auth-guest" style={{ border: 'none', background: 'none' }} onClick={() => { trackAction('onboarding_skipped', { dwellMs: Date.now() - startedAt.current }); navigate('/dashboard'); }}>
            <span>Skip for now — I'll add it later</span>
          </button>
        </div>
      </div>
    </div>
  );
}
