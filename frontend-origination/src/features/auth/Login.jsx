import { useState, useEffect } from 'react';
import { Link, useNavigate, useLocation, Navigate } from 'react-router-dom';
import { Mail, CheckCircle } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { auth } from '../../lib/api.js';
import { trackAction } from '../../lib/session.js';
import Button from '../../components/Button.jsx';
import Input from '../../components/Input.jsx';
import './Auth.css';

function VerifyEmailWall({ email, onVerified }) {
  const [otp, setOtp]         = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown]   = useState(0);
  const showToast = useToast();

  async function verify(e) {
    e.preventDefault();
    if (otp.length !== 6) { showToast('Enter the 6-digit code', 'error'); return; }
    setLoading(true);
    try {
      await auth.verifyEmail(otp);
      trackAction('email_verified');
      onVerified();
    } catch (err) {
      trackAction('email_verify_failed', { error: String(err.message).slice(0, 80) });
      showToast(err.message || 'Invalid code', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    try {
      await auth.resendVerification();
      trackAction('email_verify_resend');
      showToast('New code sent', 'success');
      setCooldown(60);
      const t = setInterval(() => setCooldown(c => { if (c <= 1) { clearInterval(t); return 0; } return c - 1; }), 1000);
    } catch (err) {
      showToast(err.message || 'Could not resend', 'error');
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">Bondly</Link>
        <div style={{ textAlign: 'center', padding: 'var(--space-4) 0 var(--space-2)' }}>
          <div style={{ width: 48, height: 48, borderRadius: '50%', background: 'rgba(108,187,167,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto var(--space-4)' }}>
            <Mail size={22} color="var(--mint)" />
          </div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700, marginBottom: 8 }}>Check your inbox</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.9rem', marginBottom: 'var(--space-5)' }}>
            We sent a 6-digit code to <strong>{email}</strong>
          </p>
        </div>
        <form onSubmit={verify} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          <input
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            maxLength={6}
            placeholder="000000"
            value={otp}
            onChange={e => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
            style={{ textAlign: 'center', fontSize: '1.75rem', letterSpacing: '0.3em', fontWeight: 700, padding: '14px', borderRadius: 'var(--border-radius)', border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontFamily: 'var(--font-mono, monospace)', width: '100%' }}
            autoFocus
          />
          <Button variant="lime" type="submit" loading={loading} style={{ width: '100%' }}>
            Verify email
          </Button>
        </form>
        <p style={{ textAlign: 'center', marginTop: 'var(--space-5)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Didn't get it?{' '}
          {cooldown > 0
            ? <span>Resend in {cooldown}s</span>
            : <button onClick={resend} disabled={resending} style={{ background: 'none', border: 'none', color: 'var(--mint)', cursor: 'pointer', fontWeight: 600, fontSize: 'inherit' }}>
                {resending ? 'Sending…' : 'Resend code'}
              </button>
          }
        </p>
      </div>
    </div>
  );
}

export default function Login() {
  const location = useLocation();
  const magicError   = new URLSearchParams(location.search).get('magic_error');
  const sessionExpired = new URLSearchParams(location.search).get('expired');
  const authRequired = location.state?.reason === 'auth_required';
  const [tab, setTab]         = useState(
    location.state?.tab || (window.innerWidth <= 640 ? 'magic' : 'login')
  );
  const referralCode          = location.state?.referralCode || '';
  const intent                = location.state?.intent || new URLSearchParams(location.search).get('intent') || '';
  const [consentGiven, setConsentGiven] = useState(false);
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [name, setName]       = useState('');
  const [loading, setLoading] = useState(false);
  const [magicSent, setMagicSent] = useState(false);
  const [showPw, setShowPw]   = useState(false);
  const [pendingVerify, setPendingVerify] = useState(false);
  const [verifySource, setVerifySource]   = useState('register'); // 'register' | 'login'
  const [loginFailCount, setLoginFailCount] = useState(0);

  const { login, register, isLoggedIn, isAdmin } = useAuth();
  const showToast = useToast();
  const navigate  = useNavigate();

  useEffect(() => {
    const titles = { login: 'Sign In | Bondly Home', register: 'Create Account | Bondly Home', magic: 'Magic Link | Bondly Home' };
    document.title = titles[tab] || 'Sign In | Bondly Home';
    return () => { document.title = 'Bondly Home | Get Your First Home Loan in South Africa'; };
  }, [tab]);

  // OTP wall must be checked before the isLoggedIn redirect — login() sets isLoggedIn=true
  // before setPendingVerify(true) is called, so the isLoggedIn gate would skip the wall.
  if (pendingVerify) {
    return (
      <VerifyEmailWall
        email={email}
        onVerified={() => {
          const hasPendingOptimizer = !!sessionStorage.getItem('bondly_optimizer_pending');
          if (hasPendingOptimizer) { sessionStorage.removeItem('bondly_optimizer_pending'); navigate('/optimize'); return; }
          if (intent === 'switch') { navigate('/switch'); return; }
          navigate(verifySource === 'login' ? '/dashboard' : '/preapproval');
        }}
      />
    );
  }

  // Already logged in and verified — redirect away
  if (isLoggedIn) {
    const from = location.state?.from?.pathname;
    return <Navigate to={from || (isAdmin ? '/admin' : '/dashboard')} replace />;
  }

  async function handleLogin(e) {
    e.preventDefault();
    if (email) localStorage.setItem('bondly_last_email', email.toLowerCase().trim());
    setLoading(true);
    try {
      const data = await login(email, password);
      trackAction('login_success');
      // Unverified user — token is stored but show OTP wall before proceeding
      if (data.user?.emailVerified === false) {
        setVerifySource('login');
        setPendingVerify(true);
        return;
      }
      showToast('Welcome back!', 'success');
      const role = data.role || data.user?.role;
      const hasPendingOptimizer = !!sessionStorage.getItem('bondly_optimizer_pending');
      if (hasPendingOptimizer) { sessionStorage.removeItem('bondly_optimizer_pending'); navigate('/optimize'); return; }
      if (intent === 'switch') { navigate('/switch'); return; }
      navigate(role === 'admin' ? '/admin' : '/dashboard');
    } catch (err) {
      trackAction('login_failed', { error: String(err.message).slice(0, 80) });
      showToast(err.message || 'Login failed', 'error');
      setLoginFailCount(c => c + 1);
    } finally {
      setLoading(false);
    }
  }

  async function handleRegister(e) {
    e.preventDefault();
    if (!name.trim()) { showToast('Please enter your name', 'error'); return; }
    if (!consentGiven) {
      setSubmitAttempted(true);
      trackAction('register_consent_blocked');
      showToast('Please accept the Privacy Policy to continue', 'error');
      return;
    }
    setSubmitAttempted(false);
    setLoading(true);
    try {
      const data = await register(name.trim(), email, password, referralCode || undefined);
      trackAction('register_success', { requiresVerification: !!data?.requiresVerification });
      // Show OTP wall if server sent a verification email; otherwise go straight to dashboard
      if (data?.requiresVerification) {
        setPendingVerify(true);
      } else {
        const hasPendingOptimizer = !!sessionStorage.getItem('bondly_optimizer_pending');
        if (hasPendingOptimizer) sessionStorage.removeItem('bondly_optimizer_pending');
        if (!hasPendingOptimizer && intent === 'switch') { navigate('/switch'); return; }
        // New registrations go straight to preapproval — the most important first action
        navigate(hasPendingOptimizer ? '/optimize' : '/preapproval');
      }
    } catch (err) {
      trackAction('register_failed', { error: String(err.message).slice(0, 80) });
      showToast(err.message || 'Registration failed', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function handleMagicLink(e) {
    e.preventDefault();
    if (!email) { showToast('Please enter your email', 'error'); return; }
    setLoading(true);
    try {
      await auth.magicLink(email);
      trackAction('magic_link_sent');
      setMagicSent(true);
    } catch {
      trackAction('magic_link_failed');
      showToast('Could not send link. Please try again.', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function sendMagicLinkQuick() {
    const target = email || '';
    if (!target) { setTab('magic'); return; }
    setLoading(true);
    try {
      await auth.magicLink(target);
      trackAction('magic_link_sent', { source: 'expired_banner' });
      setTab('magic');
      setMagicSent(true);
    } catch {
      setTab('magic');
    } finally {
      setLoading(false);
    }
  }

  function continueAsGuest() {
    trackAction('guest_mode_selected');
    navigate('/tools');
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <Link to="/" className="auth-logo">Bondly</Link>
        <h1 className="auth-title">
          {tab === 'login'    ? 'Welcome back'         :
           tab === 'register' ? 'Create your account'  :
                                'Sign in with email'}
        </h1>
        <p className="auth-sub">
          {tab === 'login'    ? 'Sign in to your Bondly account'                     :
           tab === 'register' ? (
             intent === 'switch'
               ? 'One step away from starting your bond switch — free forever.'
               : intent === 'preapproval'
               ? 'One step away from your pre-approval results — free forever.'
               : 'Free forever. No credit card required.'
           ) :
                                "We'll send a one-click sign-in link to your inbox."}
        </p>

        {authRequired && (
          <div style={{ background: '#f0f9ff', border: '1.5px solid #bae6fd', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.875rem', color: '#0c4a6e' }} role="alert">
            Please sign in to continue.
          </div>
        )}
        {sessionExpired && (
          <div style={{ background: '#fffbeb', border: '1.5px solid #fcd34d', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.875rem', color: '#92400e', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }} role="alert">
            <span>Your session expired. Please sign in again.</span>
            <button
              type="button"
              onClick={sendMagicLinkQuick}
              disabled={loading}
              style={{ background: '#92400e', color: '#fff', border: 'none', borderRadius: 6, padding: '5px 12px', fontWeight: 700, fontSize: '0.8125rem', cursor: 'pointer', whiteSpace: 'nowrap', fontFamily: 'var(--font-sans)' }}
            >
              Send magic link →
            </button>
          </div>
        )}
        {magicError && (
          <div style={{ background: '#fef2f2', border: '1.5px solid #fca5a5', borderRadius: 8, padding: '10px 14px', marginBottom: 16, fontSize: '0.875rem', color: '#991b1b' }} role="alert">
            That sign-in link has expired or is invalid. Request a new one below.
          </div>
        )}

        {/* Tabs */}
        {(() => {
          const TABS = ['login', 'register', 'magic'];
          const LABELS = { login: 'Sign in', register: 'Register', magic: 'Magic link' };
          function handleTabKey(e) {
            const idx = TABS.indexOf(tab);
            if (e.key === 'ArrowRight') { e.preventDefault(); setTab(TABS[(idx + 1) % TABS.length]); }
            if (e.key === 'ArrowLeft')  { e.preventDefault(); setTab(TABS[(idx - 1 + TABS.length) % TABS.length]); }
          }
          return (
            <>
              <div className="auth-tabs" role="tablist" aria-label="Sign in options">
                {TABS.map(t => (
                  <button
                    key={t}
                    role="tab"
                    id={`auth-tab-${t}`}
                    aria-selected={tab === t}
                    aria-controls={`auth-panel-${t}`}
                    className={tab === t ? 'active' : ''}
                    onClick={() => { setTab(t); if (t === 'register') setEmail(''); trackAction('auth_tab_switched', { tab: t }); }}
                    onKeyDown={handleTabKey}
                    tabIndex={tab === t ? 0 : -1}
                  >
                    {LABELS[t]}
                  </button>
                ))}
              </div>
              {tab === 'magic' && (
                <p className="auth-magic-hint">No password — we email you a one-click sign-in link.</p>
              )}
            </>
          );
        })()}

        {/* Login form */}
        {tab === 'login' && (
          <form onSubmit={handleLogin} className="auth-form" role="tabpanel" id="auth-panel-login" aria-labelledby="auth-tab-login" tabIndex={-1}>
            <Input label="Email address" id="loginEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus autoComplete="email" />
            <div className="auth-pw-wrap">
              <Input label="Password" id="loginPw" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="••••••••" required autoComplete="current-password" />
              <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            <div style={{ textAlign: 'right', marginTop: '-4px' }}>
              <Link to="/forgot-password" style={{ fontSize: '0.8125rem', color: 'var(--mint)', padding: '8px 0', minHeight: 44, display: 'inline-flex', alignItems: 'center' }} onClick={() => trackAction('forgot_password_clicked')}>Forgot password?</Link>
            </div>
            {loginFailCount >= 1 && (
              <div style={{ background: 'rgba(108,187,167,0.1)', border: '1.5px solid var(--mint)', borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem', color: 'var(--text-primary)' }}>
                Having trouble? You can{' '}
                <button
                  type="button"
                  onClick={() => { setTab('magic'); trackAction('magic_link_nudge_clicked'); }}
                  style={{ background: 'none', border: 'none', color: 'var(--forest)', fontWeight: 700, cursor: 'pointer', fontSize: 'inherit', textDecoration: 'underline', padding: 0 }}
                >
                  sign in with a magic link
                </button>
                {' '}instead — no password needed.
              </div>
            )}
            <Button type="submit" variant="forest" full loading={loading}>Sign in</Button>
          </form>
        )}

        {/* Register form */}
        {tab === 'register' && (
          <form onSubmit={handleRegister} className="auth-form" role="tabpanel" id="auth-panel-register" aria-labelledby="auth-tab-register" tabIndex={-1}>
            <Input label="Full name" id="regName" type="text" value={name} onChange={e => setName(e.target.value)} placeholder="Jane Smith" required autoFocus autoComplete="name" />
            <Input label="Email address" id="regEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoComplete="email" />
            <div className="auth-pw-wrap">
              <Input label="Password (min 8 chars)" id="regPw" type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)} placeholder="Choose a strong password" required minLength={8} autoComplete="new-password" />
              <button type="button" className="auth-pw-toggle" onClick={() => setShowPw(v => !v)} tabIndex={-1} aria-label={showPw ? 'Hide password' : 'Show password'}>
                {showPw ? 'Hide' : 'Show'}
              </button>
            </div>
            <label
              className={submitAttempted && !consentGiven ? 'popia-checkbox--shake' : ''}
              style={{ display: 'flex', alignItems: 'flex-start', gap: 10, cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}
            >
              <input
                type="checkbox"
                checked={consentGiven}
                onChange={e => { setConsentGiven(e.target.checked); if (e.target.checked) setSubmitAttempted(false); }}
                style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--lime)', width: 18, height: 18 }}
              />
              <span>
                I agree to Bondly's{' '}
                <Link to="/terms" style={{ color: 'var(--forest)', textDecoration: 'underline' }}>Terms of Service</Link>{' '}
                and{' '}
                <Link to="/privacy" style={{ color: 'var(--forest)', textDecoration: 'underline' }}>Privacy Policy &amp; POPIA Notice</Link>.
                I consent to the processing of my personal information in accordance with POPIA.
              </span>
            </label>
            <Button type="submit" variant="lime" full loading={loading}>Create account</Button>
          </form>
        )}

        {/* Magic link form */}
        {tab === 'magic' && (
          <div role="tabpanel" id="auth-panel-magic" aria-labelledby="auth-tab-magic" tabIndex={-1}>
          {magicSent ? (
            <div className="auth-magic-sent">
              <div style={{ marginBottom: 'var(--space-3)' }}><Mail size={32} strokeWidth={1.5} style={{ color: 'var(--lime)' }} /></div>
              <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>Check your inbox</p>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.9375rem' }}>
                We sent a sign-in link to <strong>{email}</strong>. Click the link to sign in instantly — no password needed.
              </p>
            </div>
          ) : (
            <form onSubmit={handleMagicLink} className="auth-form">
              <p className="auth-magic-desc">We'll email you a one-click sign-in link — no password needed.</p>
              <Input label="Email address" id="magicEmail" type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" required autoFocus />
              <Button type="submit" variant="forest" full loading={loading}>Send sign-in link</Button>
            </form>
          )}
          </div>
        )}

        <div className="auth-guest">
          <button onClick={continueAsGuest}>Just exploring? Use the free calculators →</button>
        </div>
        <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
          <Link to="/" style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', textDecoration: 'none' }}>← Back to home</Link>
        </div>
      </div>
    </div>
  );
}
