import { useEffect, useState } from 'react';

/**
 * ActivityTimeline — chronological feed for a single customer.
 * Fetches /api/admin/customers/:id/activity which already merges events
 * from leads, applications, KYC, statements, notes, audit, and SLA
 * scheduler outputs.
 *
 * Renders a vertical timeline with one row per event. Type-specific
 * icon + colour so the admin can scan for anomalies (SLA breaches
 * are red, merges are amber, signups are green).
 */
const TYPE_STYLE = {
  signup:         { icon: '🆕', bg: 'rgba(22,163,74,0.10)',  fg: '#16a34a' },
  login:          { icon: '🔑', bg: 'rgba(99,102,241,0.10)', fg: '#3730a3' },
  lead:           { icon: '📨', bg: 'rgba(59,130,246,0.10)', fg: '#1d4ed8' },
  merge:          { icon: '⇆',  bg: 'rgba(217,119,6,0.10)',  fg: '#92400e' },
  kyc_submit:     { icon: '🪪', bg: 'rgba(74,127,165,0.10)', fg: '#1e3a5f' },
  kyc_approve:    { icon: '✓',  bg: 'rgba(22,163,74,0.10)',  fg: '#16a34a' },
  kyc_reject:     { icon: '✗',  bg: 'rgba(220,38,38,0.10)',  fg: '#991b1b' },
  statement:      { icon: '📄', bg: 'rgba(74,158,107,0.10)', fg: '#16502d' },
  snapshot:       { icon: '📊', bg: 'rgba(74,158,107,0.10)', fg: '#16502d' },
  app_created:    { icon: '📝', bg: 'rgba(99,102,241,0.10)', fg: '#3730a3' },
  broker_assign:  { icon: '👤', bg: 'rgba(74,127,165,0.10)', fg: '#1e3a5f' },
  broker_contact: { icon: '📞', bg: 'rgba(22,163,74,0.10)',  fg: '#16a34a' },
  broker_rotate:  { icon: '🔄', bg: 'rgba(217,119,6,0.10)',  fg: '#92400e' },
  sla_breach:     { icon: '⏰', bg: 'rgba(220,38,38,0.10)',  fg: '#991b1b' },
  sla_due_soon:   { icon: '⌛', bg: 'rgba(217,119,6,0.10)',  fg: '#92400e' },
  swap_status:    { icon: '🔁', bg: 'rgba(74,127,165,0.10)', fg: '#1e3a5f' },
  commission:     { icon: '💰', bg: 'rgba(22,163,74,0.10)',  fg: '#16a34a' },
  note:           { icon: '📝', bg: 'rgba(99,102,241,0.10)', fg: '#3730a3' },
  audit:          { icon: '🔍', bg: 'rgba(0,0,0,0.06)',      fg: '#374151' },
};

function relTime(iso) {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 0) return 'just now';
  const m = Math.floor(ms / 60000);
  if (m < 1)    return 'just now';
  if (m < 60)   return m + 'm ago';
  if (m < 1440) return Math.floor(m / 60) + 'h ago';
  if (m < 10080)return Math.floor(m / 1440) + 'd ago';
  return new Date(iso).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function ActivityTimeline({ userId }) {
  const [events,  setEvents]  = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    fetch('/api/admin/customers/' + userId + '/activity?limit=200', {
      headers: { Authorization: 'Bearer ' + (localStorage.getItem('bondly_token') || '') },
    })
      .then(r => r.json())
      .then(d => setEvents(d?.data?.events || []))
      .catch(() => setEvents([]))
      .finally(() => setLoading(false));
  }, [userId]);

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading activity…</div>;
  if (!events.length) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>No activity recorded for this customer yet.</div>;

  return (
    <div className="adm-timeline">
      {events.map((e, i) => {
        const t = TYPE_STYLE[e.type] || { icon: '•', bg: 'rgba(0,0,0,0.05)', fg: '#374151' };
        return (
          <div key={i} className="adm-timeline__row">
            <div className="adm-timeline__dot" style={{ background: t.bg, color: t.fg }}>{t.icon}</div>
            <div className="adm-timeline__body">
              <div className="adm-timeline__label" style={{ color: t.fg }}>{e.label}</div>
              {e.detail && <div className="adm-timeline__detail">{e.detail}</div>}
              <div className="adm-timeline__when">{relTime(e.at)} &middot; {new Date(e.at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}</div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
