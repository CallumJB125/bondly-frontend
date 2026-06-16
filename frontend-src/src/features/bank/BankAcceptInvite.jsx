import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { bankApi, setBankToken } from './bankApi.js';
import './bank.css';

export default function BankAcceptInvite() {
  const { token } = useParams();
  const nav = useNavigate();
  const [invite, setInvite] = useState(null);
  const [err, setErr]       = useState(null);
  const [name, setName]     = useState('');
  const [password, setPwd]  = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy]     = useState(false);

  useEffect(() => {
    bankApi.validateInvite(token)
      .then(d => { setInvite(d); setName(d.name || ''); })
      .catch(e => setErr(e.message));
  }, [token]);

  async function submit(e) {
    e.preventDefault(); setErr(null);
    if (password.length < 8) return setErr('Password must be at least 8 characters');
    if (password !== confirm)  return setErr("Passwords don't match");
    setBusy(true);
    try {
      const data = await bankApi.acceptInvite({ token, name, password });
      setBankToken(data.token);
      nav('/bank/applications', { replace: true });
    } catch (e2) {
      setErr(e2.message);
    } finally { setBusy(false); }
  }

  if (err && !invite) {
    return (
      <div className="bank-login-wrap">
        <div className="bank-login-card">
          <div className="brand"><span className="dot" /> Bond Desk</div>
          <h2>Invite invalid</h2>
          <p style={{ color: '#991b1b', marginTop: 8 }}>{err}</p>
          <Link to="/bank/login" style={{ color: '#0b1e2d', textDecoration: 'underline', fontSize: '0.85rem' }}>Back to sign in</Link>
        </div>
      </div>
    );
  }
  if (!invite) return (
    <div className="bank-login-wrap"><div className="bank-login-card">Loading invite…</div></div>
  );

  return (
    <div className="bank-login-wrap">
      <form className="bank-login-card" onSubmit={submit}>
        <div className="brand"><span className="dot" /> Bond Desk · {invite.bankName}</div>
        <h2>Welcome aboard</h2>
        <p className="lede">
          You're being added as {invite.role === 'bank_admin' ? 'the lead Bond Desk user' : 'a Bond Desk user'} for <strong>{invite.bankName}</strong>.
          Set a password to finish.
        </p>

        <label>Email</label>
        <input type="email" value={invite.email} disabled style={{ background: '#f9fafb', color: '#6b7280' }} />

        <label>Your name</label>
        <input value={name} onChange={e => setName(e.target.value)} required autoFocus />

        <label>Password</label>
        <input type="password" value={password} onChange={e => setPwd(e.target.value)} required minLength={8} />

        <label>Confirm password</label>
        <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)} required minLength={8} />

        {err && <div className="err">{err}</div>}
        <button type="submit" disabled={busy}>{busy ? 'Setting up…' : 'Set password and sign in'}</button>
      </form>
    </div>
  );
}
