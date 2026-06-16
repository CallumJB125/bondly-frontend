import { useState, useEffect } from 'react';
import { X } from 'lucide-react';

const CONSENT_KEY    = 'bly_consent_seen';
const OPT_OUT_KEY    = 'bly_analytics_opt_out';
const ADMIN_PATTERNS = ['/admin'];

export default function AnalyticsConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    // Don't show on admin routes
    if (ADMIN_PATTERNS.some(p => window.location.pathname.startsWith(p))) return;
    try {
      if (!localStorage.getItem(CONSENT_KEY)) setVisible(true);
    } catch {}
  }, []);

  function accept() {
    try { localStorage.setItem(CONSENT_KEY, '1'); } catch {}
    setVisible(false);
  }

  function optOut() {
    try {
      localStorage.setItem(OPT_OUT_KEY, '1');
      localStorage.setItem(CONSENT_KEY, '1');
    } catch {}
    setVisible(false);
    // Reload so initAnalytics respects the opt-out flag on next init
    window.location.reload();
  }

  if (!visible) return null;

  return (
    <div
      className="bly-consent-bar"
      role="dialog"
      aria-label="Analytics consent"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9998,
        background: 'var(--bg-card)',
        borderTop: '1px solid var(--border-color)',
        padding: '12px 20px',
        display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap',
        fontSize: '0.8125rem', color: 'var(--text-secondary)',
        boxShadow: '0 -4px 16px rgba(0,0,0,0.08)',
      }}
    >
      {/* FIX 1: on mobile, contain the bar as an inset card so it stops
          overlapping the bottom form fields and the WhatsApp bubble. */}
      <style>{`
        @media (max-width: 600px) {
          .bly-consent-bar {
            left: 12px !important;
            right: 12px !important;
            bottom: 12px !important;
            border: 1px solid var(--border-color) !important;
            border-radius: 12px !important;
            box-shadow: 0 8px 28px rgba(0,0,0,0.18) !important;
          }
        }
      `}</style>
      <span style={{ flex: 1, minWidth: 200 }}>
        We use anonymous analytics to improve the app. No personal financial data is stored in analytics.
      </span>
      <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
        <button
          onClick={optOut}
          style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 6, padding: '5px 12px', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}
        >
          Opt out
        </button>
        <button
          onClick={accept}
          style={{ background: 'var(--mint)', border: 'none', borderRadius: 6, padding: '5px 16px', cursor: 'pointer', color: '#000', fontWeight: 600, fontSize: '0.8125rem' }}
        >
          Got it
        </button>
        <button onClick={accept} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 4 }}>
          <X size={14} />
        </button>
      </div>
    </div>
  );
}
