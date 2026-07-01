import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { bankApi, setBankToken, getBankToken } from './bankApi.js';
import './bank.css';

export default function BankLogin() {
  const nav = useNavigate();
  const [search] = useSearchParams();
  const [mode, setMode] = useState('signin');  // 'signin' | 'request'
  const [email, setEmail]       = useState('');
  const [password, setPassword] = useState('');
  const [err, setErr]           = useState(search.get('expired') ? 'Your session expired — please sign in again.' : '');
  const [busy, setBusy]         = useState(false);

  useEffect(() => {
    if (getBankToken()) nav('/bank/applications', { replace: true });
  }, [nav]);

  async function submit(e) {
    e.preventDefault();
    setErr(''); setBusy(true);
    try {
      const data = await bankApi.login(email, password);
      setBankToken(data.token);
      nav('/bank/applications', { replace: true });
    } catch (e2) {
      setErr(e2.message || 'Login failed');
    } finally { setBusy(false); }
  }

  async function ssoSubmit() {
    if (!email) { setErr('Enter your work email to sign in with SSO'); return; }
    setErr(''); setBusy(true);
    try {
      const data = await bankApi.ssoLogin(email);   // simulated IdP federation
      setBankToken(data.token);
      nav('/bank/applications', { replace: true });
    } catch (e2) {
      setErr(e2.message || 'SSO sign-in failed');
    } finally { setBusy(false); }
  }

  if (mode === 'request') return <RequestAccessCard onBack={() => setMode('signin')} />;

  return (
    <div className="bank-login-wrap">
      <form className="bank-login-card" onSubmit={submit}>
        <div className="brand"><span className="dot" /> Bond Desk · by Bondly</div>
        <h2>Sign in</h2>
        <p className="lede">Browse open mortgages, see verified affordability, and submit competitive offers.</p>

        <label>Work email</label>
        <input type="email" value={email} onChange={e => setEmail(e.target.value)} autoFocus required placeholder="you@yourbank.co.za" />

        <label>Password</label>
        <input type="password" value={password} onChange={e => setPassword(e.target.value)} required />

        {err && <div className="err">{err}</div>}

        <button type="submit" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, margin: '14px 0', color: '#9ca3af', fontSize: '0.72rem' }}>
          <span style={{ flex: 1, height: 1, background: '#e5e7eb' }} /> OR <span style={{ flex: 1, height: 1, background: '#e5e7eb' }} />
        </div>
        <button type="button" onClick={ssoSubmit} disabled={busy}
          style={{ width: '100%', background: '#fff', color: '#0b1e2d', border: '1px solid #d1d5db', fontWeight: 700 }}>
          🔐 Sign in with SSO
        </button>
        <div style={{ textAlign: 'center', marginTop: 6, fontSize: '0.68rem', color: '#9ca3af' }}>
          Simulated SSO (demo) — real deployments federate to your identity provider. Access is still invite-gated.
        </div>

        <div style={{ textAlign: 'center', marginTop: 14, fontSize: '0.82rem', color: '#6b7280' }}>
          Don't have access yet?{' '}
          <button type="button" onClick={() => { setErr(''); setMode('request'); }}
            style={{ background: 'transparent', border: 'none', color: '#0b1e2d', fontWeight: 700, cursor: 'pointer', textDecoration: 'underline', padding: 0 }}>
            Request access
          </button>
        </div>

        <div className="demo-creds">
          <strong>Demo accounts (testing only)</strong>
          <code>underwriter@absa.demo</code>, <code>@fnb.demo</code>, <code>@nedbank.demo</code>, <code>@standardbank.demo</code>, <code>@capitec.demo</code> &middot; password <code>TestBank2026!</code>
        </div>
      </form>
    </div>
  );
}

function RequestAccessCard({ onBack }) {
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [message, setMessage] = useState('');
  const [busy, setBusy]       = useState(false);
  const [done, setDone]       = useState(false);
  const [err, setErr]         = useState('');

  async function submit(e) {
    e.preventDefault(); setErr(''); setBusy(true);
    try {
      const r = await bankApi.requestAccess({ name, email, message });
      setDone(r?.message || "Request received. We'll be in touch.");
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  return (
    <div className="bank-login-wrap">
      <form className="bank-login-card" onSubmit={submit}>
        <div className="brand"><span className="dot" /> Bond Desk · by Bondly</div>
        <h2>Request access</h2>
        <p className="lede">Use your work email. We'll match it to your bank, then review and approve within one business day.</p>

        {done ? (
          <>
            <div style={{ background: '#dcfce7', border: '1px solid #bbf7d0', color: '#166534', borderRadius: 8, padding: '14px 16px', fontSize: '0.875rem' }}>
              {done}
            </div>
            <button type="button" onClick={onBack} style={{ background: 'transparent', color: '#0b1e2d', border: '1px solid #e5e7eb', marginTop: 14 }}>Back to sign in</button>
          </>
        ) : (
          <>
            <label>Your name</label>
            <input value={name} onChange={e => setName(e.target.value)} required autoFocus placeholder="Sipho Mthembu" />

            <label>Work email</label>
            <input type="email" value={email} onChange={e => setEmail(e.target.value)} required placeholder="you@yourbank.co.za" />

            <label>What team are you on? (optional)</label>
            <textarea value={message} onChange={e => setMessage(e.target.value)} rows={3}
              style={{ width: '100%', padding: '10px 12px', fontSize: '0.9375rem', border: '1px solid #e5e7eb', borderRadius: 8, background: '#fff', fontFamily: 'inherit', resize: 'vertical' }}
              placeholder="e.g. Home loans new business, Sandton branch" />

            {err && <div className="err">{err}</div>}
            <button type="submit" disabled={busy}>{busy ? 'Sending…' : 'Request access'}</button>
            <button type="button" onClick={onBack} style={{ background: 'transparent', color: '#6b7280', border: 'none', marginTop: 6, fontSize: '0.82rem' }}>
              ← Back to sign in
            </button>
          </>
        )}
      </form>
    </div>
  );
}
