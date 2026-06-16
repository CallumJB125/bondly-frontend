import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { auth } from '../../lib/api.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import './Auth.css';

export default function ResetPassword() {
  const [password, setPassword]   = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading]     = useState(false);
  const [params]                  = useSearchParams();
  const navigate  = useNavigate();
  const showToast = useToast();
  const token     = params.get('token');

  async function handleSubmit(e) {
    e.preventDefault();
    if (password !== password2) { showToast('Passwords do not match', 'error'); return; }
    if (password.length < 8)    { showToast('Password must be at least 8 characters', 'error'); return; }
    setLoading(true);
    try {
      await auth.resetPw(token, password);
      showToast('Password updated! Please sign in.', 'success');
      navigate('/login');
    } catch (err) {
      showToast(err.message || 'Reset link expired or invalid.', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (!token) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <p style={{ color: 'var(--color-error)', textAlign: 'center' }}>Invalid reset link.</p>
          <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
            <Link to="/forgot-password">Request a new reset link →</Link>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">Bondly</Link>
        <h1 className="auth-title">Choose a new password</h1>
        <form onSubmit={handleSubmit} className="auth-form">
          <Input label="New password" id="rp1" type="password" value={password} onChange={e => setPassword(e.target.value)} placeholder="At least 8 characters" required minLength={8} autoFocus />
          <Input label="Confirm password" id="rp2" type="password" value={password2} onChange={e => setPassword2(e.target.value)} placeholder="Repeat your password" required />
          <Button type="submit" variant="forest" full loading={loading}>Set new password</Button>
        </form>
      </div>
    </div>
  );
}
