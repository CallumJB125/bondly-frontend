import { useState, useEffect } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { staffInvite } from '../../lib/api.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { setToken } from '../../lib/api.js';
import { useToast } from '@bondly/ui/components/Toast.jsx';
import Button from '@bondly/ui/components/Button.jsx';
import Input from '@bondly/ui/components/Input.jsx';
import './Auth.css';

export default function AcceptInvite() {
  const { token }             = useParams();
  const navigate              = useNavigate();
  const showToast             = useToast();
  const { setUser }           = useAuth();

  const [invite, setInvite]   = useState(null);   // { email, expiresAt }
  const [checking, setChecking] = useState(true);
  const [invalid, setInvalid] = useState(null);

  const [name, setName]       = useState('');
  const [password, setPassword] = useState('');
  const [password2, setPassword2] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    staffInvite.validate(token)
      .then(d => setInvite(d))
      .catch(err => setInvalid(err.message || 'Invalid or expired invite link'))
      .finally(() => setChecking(false));
  }, [token]);

  async function handleSubmit(e) {
    e.preventDefault();
    if (!name.trim())           { showToast('Please enter your name', 'error'); return; }
    if (password !== password2) { showToast('Passwords do not match', 'error'); return; }
    if (password.length < 8)    { showToast('Password must be at least 8 characters', 'error'); return; }
    setLoading(true);
    try {
      const data = await staffInvite.accept(token, name.trim(), password);
      setToken(data.token);
      setUser({
        name:       data.user?.name  || name,
        email:      data.user?.email || invite?.email,
        role:       data.role || 'admin',
        userId:     data.user?.id,
        superAdmin: data.user?.superAdmin || false,
      });
      showToast(`Welcome to Bondly, ${name.split(' ')[0]}!`, 'success');
      navigate('/admin', { replace: true });
    } catch (err) {
      showToast(err.message || 'Could not create account', 'error');
    } finally {
      setLoading(false);
    }
  }

  if (checking) {
    return (
      <div className="auth-page">
        <div className="auth-card" style={{ textAlign: 'center' }}>
          <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderTopColor: 'var(--mint)', borderColor: 'var(--border-color)', margin: '0 auto' }} />
          <p style={{ color: 'var(--text-secondary)', marginTop: 16 }}>Checking your invite…</p>
        </div>
      </div>
    );
  }

  if (invalid) {
    return (
      <div className="auth-page">
        <div className="auth-card">
          <Link to="/" className="auth-logo">Bondly</Link>
          <h1 className="auth-title">Invite not valid</h1>
          <p style={{ color: 'var(--color-error)', textAlign: 'center', fontSize: '0.9rem' }}>{invalid}</p>
          <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem', marginTop: 12 }}>
            Ask your admin to send a new invite.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">Bondly</Link>
        <h1 className="auth-title">Create your account</h1>
        <p style={{ color: 'var(--text-secondary)', textAlign: 'center', fontSize: '0.875rem', marginBottom: 24 }}>
          You've been invited to the Bondly admin panel.<br />
          <strong style={{ color: 'var(--text-primary)' }}>{invite?.email}</strong>
        </p>
        <form onSubmit={handleSubmit} className="auth-form">
          <Input
            label="Your full name"
            id="ai-name"
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Jane Smith"
            required
            autoFocus
          />
          <Input
            label="Password"
            id="ai-pw"
            type="password"
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="At least 8 characters"
            required
            minLength={8}
          />
          <Input
            label="Confirm password"
            id="ai-pw2"
            type="password"
            value={password2}
            onChange={e => setPassword2(e.target.value)}
            placeholder="Repeat your password"
            required
          />
          <Button type="submit" variant="forest" full loading={loading}>
            Create account &amp; sign in
          </Button>
        </form>
      </div>
    </div>
  );
}
