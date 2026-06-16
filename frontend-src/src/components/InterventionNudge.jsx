import { useState, useEffect, useRef } from 'react';
import { X } from 'lucide-react';

const TYPE_STYLES = {
  trust:      { border: '#f97316', bg: 'rgba(249,115,22,0.08)', icon: '🔒' },
  help:       { border: '#3b82f6', bg: 'rgba(59,130,246,0.08)', icon: '💡' },
  tip:        { border: '#22c55e', bg: 'rgba(34,197,94,0.08)',  icon: '✦'  },
  nudge:      { border: '#a855f7', bg: 'rgba(168,85,247,0.08)', icon: '👋' },
  suggestion: { border: '#0ea5e9', bg: 'rgba(14,165,233,0.08)', icon: '🎯' },
};

function authHeader() {
  try {
    const t = localStorage.getItem('bondly_token');
    return t ? { Authorization: 'Bearer ' + t } : {};
  } catch { return {}; }
}

export default function InterventionNudge() {
  const [nudge, setNudge]     = useState(null);
  const [visible, setVisible] = useState(false);
  const dismissTimer          = useRef(null);

  useEffect(() => {
    function onIntervention(e) {
      const n = e.detail;
      if (!n?.message) return;
      setNudge(n);
      setVisible(true);
      // Auto-dismiss after 12 seconds
      clearTimeout(dismissTimer.current);
      dismissTimer.current = setTimeout(() => setVisible(false), 12_000);
    }
    document.addEventListener('bondly:intervention', onIntervention);
    return () => {
      document.removeEventListener('bondly:intervention', onIntervention);
      clearTimeout(dismissTimer.current);
    };
  }, []);

  function dismiss() {
    clearTimeout(dismissTimer.current);
    setVisible(false);
  }

  function handleCta() {
    if (nudge?.type) {
      fetch(`/api/analytics/interventions/${nudge.type}/acted`, {
        method: 'POST',
        headers: authHeader(),
      }).catch(() => {});
    }
    dismiss();
    if (nudge?.ctaUrl) window.location.href = nudge.ctaUrl;
  }

  if (!visible || !nudge) return null;

  const style = TYPE_STYLES[nudge.type] || TYPE_STYLES.tip;

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 16, zIndex: 9999,
      maxWidth: 340, width: 'calc(100vw - 32px)',
      background: style.bg,
      border: `1.5px solid ${style.border}`,
      borderRadius: 12,
      padding: '14px 16px',
      boxShadow: '0 8px 32px rgba(0,0,0,0.18)',
      animation: 'nudge-in 0.25s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <span style={{ fontSize: '1.1rem', flexShrink: 0, marginTop: 1 }}>{style.icon}</span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ margin: '0 0 10px', fontSize: '0.875rem', lineHeight: 1.5, color: 'var(--text-primary)' }}>
            {nudge.message}
          </p>
          {nudge.cta && (
            <button
              onClick={handleCta}
              style={{
                background: style.border, color: '#fff', border: 'none',
                borderRadius: 6, padding: '6px 14px', fontSize: '0.8125rem',
                fontWeight: 600, cursor: 'pointer',
              }}
            >
              {nudge.cta}
            </button>
          )}
        </div>
        <button onClick={dismiss} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-secondary)', padding: 2, flexShrink: 0 }}>
          <X size={14} />
        </button>
      </div>
      <style>{`@keyframes nudge-in { from { opacity:0; transform:translateY(12px); } to { opacity:1; transform:translateY(0); } }`}</style>
    </div>
  );
}
