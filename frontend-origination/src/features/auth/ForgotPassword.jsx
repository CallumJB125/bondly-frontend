import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { auth } from '../../lib/api.js';
import Button from '@bondly/ui/components/Button.jsx';
import Input from '@bondly/ui/components/Input.jsx';
import './Auth.css';

export default function ForgotPassword() {
  useEffect(() => {
    document.title = 'Reset Password | Bondly Home';
    return () => { document.title = 'Bondly Home | Get Your First Home Loan in South Africa'; };
  }, []);
  const [email, setEmail]     = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent]       = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    try {
      await auth.forgotPw(email);
      setSent(true);
    } catch {
      setSent(true); // don't reveal whether email exists
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">Bondly</Link>
        <h1 className="auth-title">Reset your password</h1>

        {sent ? (
          <div className="auth-magic-sent">
            <div style={{ marginBottom: 'var(--space-3)' }}><Mail size={32} strokeWidth={1.5} style={{ color: 'var(--lime)' }} /></div>
            <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Check your inbox</p>
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
              If an account with that email exists, we've sent a password reset link.
            </p>
            <div style={{ marginTop: 'var(--space-5)', textAlign: 'center' }}>
              <Link to="/login" style={{ color: 'var(--forest)', fontWeight: 600 }}>← Back to sign in</Link>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="auth-form">
            <Input label="Email address" id="fpEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
            <Button type="submit" variant="forest" full loading={loading}>Send reset link</Button>
            <div style={{ textAlign: 'center' }}>
              <Link to="/login" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>← Back to sign in</Link>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
