import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useToast } from '@bondly/ui/components/Toast.jsx';
import Button from '@bondly/ui/components/Button.jsx';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';
import Input from '@bondly/ui/components/Input.jsx';

const TERMS = [
  'The competitor rate offer must be from an FSP-registered bond originator or directly from a South African bank.',
  'The offer must be for the same applicant, same property, and a loan amount within 10% of your Bondly-placed bond.',
  'The claim must be submitted within 30 days of your Bondly application being accepted by a bank.',
  'You must provide written proof of the lower rate (a formal bank quotation or offer letter).',
  'The claim applies to new home loans and bond switches facilitated by Bondly.',
  'One claim per applicant. Bondly reserves the right to verify all submissions before payment.',
  'Payment of R1,000 (EFT) will be made within 5 business days of a verified and approved claim.',
];

export default function Guarantee() {
  const showToast = useToast();
  const [form, setForm] = useState({ name: '', email: '', phone: '', bondRef: '', competitorBank: '', competitorRate: '', notes: '' });
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  async function submit(e) {
    e.preventDefault();
    if (!form.name || !form.email || !form.competitorBank || !form.competitorRate) {
      showToast('Please fill in all required fields', 'error');
      return;
    }
    setLoading(true);
    try {
      const r = await fetch('/api/guarantee/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || 'Could not submit claim');
      setSubmitted(true);
    } catch (err) {
      showToast(err.message || 'Could not submit — please email us at admin@bondly.co.za', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (submitted) {
    return (
      <div style={{ maxWidth: 560, margin: '60px auto', padding: '0 20px', textAlign: 'center' }}>
        <div style={{ fontSize: '3rem', marginBottom: 16 }}>✓</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.75rem', marginBottom: 12 }}>Claim received</h1>
        <p style={{ color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24 }}>
          We'll review your submission and respond within 2 business days. If everything checks out, R1,000 lands in your account within 5 business days.
        </p>
        <Link to="/" style={{ color: 'var(--mint)', textDecoration: 'none', fontWeight: 600 }}>← Back to Bondly</Link>
      </div>
    );
  }

  return (
    <div style={{ maxWidth: 680, margin: '0 auto', padding: '40px 20px 80px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: '2.5rem', marginBottom: 12 }}>🛡️</div>
        <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '2rem', marginBottom: 12 }}>Best Rate Guarantee</h1>
        <p style={{ color: 'var(--text-secondary)', fontSize: '1.0625rem', lineHeight: 1.6, maxWidth: 520, margin: '0 auto' }}>
          Bondly submits your application to all 7 major SA banks simultaneously. If another registered originator or bank can beat our accepted offer within 30 days, we pay you <strong style={{ color: 'var(--lime)' }}>R1,000</strong>.
        </p>
      </div>

      {/* Terms */}
      <Card style={{ marginBottom: 32 }}>
        <CardHeader>Terms & conditions</CardHeader>
        <CardBody>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 10 }}>
            {TERMS.map((t, i) => (
              <li key={i} style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.55 }}>{t}</li>
            ))}
          </ol>
        </CardBody>
      </Card>

      {/* Claim form */}
      <Card>
        <CardHeader>Submit a claim</CardHeader>
        <CardBody>
          <form onSubmit={submit} style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Input label="Full name *" id="gc-name" value={form.name} onChange={set('name')} placeholder="Jane Sithole" />
              <Input label="Email *" id="gc-email" type="email" value={form.email} onChange={set('email')} placeholder="jane@email.co.za" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Input label="Phone" id="gc-phone" type="tel" value={form.phone} onChange={set('phone')} placeholder="082 000 0000" />
              <Input label="Bondly application reference (if known)" id="gc-ref" value={form.bondRef} onChange={set('bondRef')} placeholder="e.g. from your confirmation email" />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
              <Input label="Competitor bank / originator *" id="gc-bank" value={form.competitorBank} onChange={set('competitorBank')} placeholder="e.g. ooba / FNB" />
              <Input label="Rate offered (%) *" id="gc-rate" type="number" step="0.01" value={form.competitorRate} onChange={set('competitorRate')} placeholder="10.25" />
            </div>
            <div>
              <label style={{ display: 'block', fontWeight: 600, fontSize: '0.875rem', marginBottom: 6 }}>Additional notes</label>
              <textarea
                value={form.notes}
                onChange={set('notes')}
                placeholder="Any additional context about the competitor offer (optional)"
                rows={3}
                style={{ width: '100%', padding: '10px 12px', border: '1.5px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', background: 'var(--bg-input)', color: 'var(--text-primary)', fontSize: '0.9375rem', resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
              />
            </div>
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', margin: 0 }}>
              You'll need to email supporting documentation (bank quote or offer letter) to <strong>admin@bondly.co.za</strong> with your claim reference number. We'll send it after submission.
            </p>
            <Button type="submit" variant="lime" full loading={loading}>Submit guarantee claim →</Button>
          </form>
        </CardBody>
      </Card>
    </div>
  );
}
