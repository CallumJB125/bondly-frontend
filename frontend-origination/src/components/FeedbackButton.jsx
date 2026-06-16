import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';

const SESSION_KEY = 'bondly_sid';

function getSessionId() {
  try { return sessionStorage.getItem(SESSION_KEY) || localStorage.getItem(SESSION_KEY) || null; } catch { return null; }
}

export function InlineFeedback({ context, label = 'Was this helpful?' }) {
  const [voted, setVoted] = useState(null);
  const location = useLocation();

  async function vote(verdict) {
    if (voted) return;
    setVoted(verdict);
    try {
      await fetch('/api/feedback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ context, verdict, sessionId: getSessionId(), page: location.pathname }),
      });
    } catch {}
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 16, padding: '10px 14px', background: 'var(--bg-page)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
      <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', flex: 1 }}>{voted ? (voted === 'up' ? 'Thanks for your feedback!' : 'Thanks — we\'ll look into this.') : label}</span>
      {!voted && (
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={() => vote('up')}
            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, color: 'var(--text-primary)', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#10b98120'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >👍</button>
          <button onClick={() => vote('down')}
            style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, padding: '4px 10px', cursor: 'pointer', fontSize: '1rem', lineHeight: 1, color: 'var(--text-primary)', transition: 'background 0.15s' }}
            onMouseEnter={e => e.currentTarget.style.background = '#ef444420'}
            onMouseLeave={e => e.currentTarget.style.background = 'none'}
          >👎</button>
        </div>
      )}
    </div>
  );
}

export default function FeedbackButton() {
  const [open, setOpen]       = useState(false);
  const [message, setMessage] = useState('');
  const [email, setEmail]     = useState('');
  const [sent, setSent]       = useState(false);
  const [sending, setSending] = useState(false);
  const [visible, setVisible] = useState(false);
  const location = useLocation();

  // Delay appearance so it doesn't flash immediately on every page
  useEffect(() => {
    setSent(false);
    setMessage('');
    const t = setTimeout(() => setVisible(true), 4000);
    return () => clearTimeout(t);
  }, [location.pathname]);

  async function submit(e) {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await fetch('/api/feedback/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message, email: email || null, page: location.pathname, sessionId: getSessionId() }),
      });
      setSent(true);
    } catch {}
    setSending(false);
  }

  if (!visible) return null;

  return (
    <>
      {/* Floating trigger */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          aria-label="Report a problem"
          style={{
            position: 'fixed', bottom: 80, right: 16, zIndex: 8000,
            background: 'var(--bg-card)', border: '1px solid var(--border-color)',
            borderRadius: 20, padding: '6px 12px',
            fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)',
            cursor: 'pointer', boxShadow: '0 2px 12px rgba(0,0,0,0.12)',
            display: 'flex', alignItems: 'center', gap: 5,
            opacity: 0.8, transition: 'opacity 0.15s',
          }}
          onMouseEnter={e => e.currentTarget.style.opacity = '1'}
          onMouseLeave={e => e.currentTarget.style.opacity = '0.8'}
        >
          <span style={{ fontSize: '0.875rem' }}>⚑</span> Report a problem
        </button>
      )}

      {/* Drawer */}
      {open && (
        <div style={{
          position: 'fixed', bottom: 16, right: 16, zIndex: 8001,
          background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 12, width: 300, boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
          padding: 16, display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontWeight: 700, fontSize: '0.9375rem' }}>Something wrong?</span>
            <button onClick={() => setOpen(false)} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '1.1rem', color: 'var(--text-secondary)', padding: '0 2px', lineHeight: 1 }}>✕</button>
          </div>

          {sent ? (
            <div style={{ textAlign: 'center', padding: '16px 0', color: 'var(--mint)', fontWeight: 600, fontSize: '0.9375rem' }}>
              ✓ Received — thanks!
            </div>
          ) : (
            <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              <textarea
                value={message}
                onChange={e => setMessage(e.target.value)}
                placeholder="Tell us what went wrong…"
                rows={3}
                style={{ width: '100%', boxSizing: 'border-box', padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', resize: 'vertical', fontFamily: 'inherit' }}
              />
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Email (optional — for follow-up)"
                style={{ padding: '7px 10px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
              />
              <button
                type="submit"
                disabled={!message.trim() || sending}
                style={{ padding: '8px 0', background: 'var(--lime)', color: 'var(--forest)', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.875rem', cursor: message.trim() ? 'pointer' : 'not-allowed', opacity: message.trim() ? 1 : 0.5 }}
              >
                {sending ? 'Sending…' : 'Send report'}
              </button>
            </form>
          )}

          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', lineHeight: 1.4, marginTop: -4 }}>
            Page: <code style={{ fontSize: '0.7rem' }}>{location.pathname}</code>
          </div>
        </div>
      )}
    </>
  );
}
