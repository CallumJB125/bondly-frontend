import { useEffect, useState } from 'react';
import { NavLink, Outlet, useNavigate, Navigate } from 'react-router-dom';
import { bankApi, getBankToken, clearBankToken, getDecodedBankToken } from './bankApi.js';
import './bank.css';

function OnboardingTour() {
  const [show, setShow] = useState(() => {
    try { return !localStorage.getItem('bondly_bank_tour_seen'); } catch { return true; }
  });
  if (!show) return null;
  function dismiss() {
    try { localStorage.setItem('bondly_bank_tour_seen', '1'); } catch {}
    setShow(false);
  }
  return (
    <div style={{
      position: 'fixed', bottom: 20, right: 20, zIndex: 9999,
      background: '#0b1e2d', color: '#fff', padding: 18, borderRadius: 12,
      maxWidth: 320, boxShadow: '0 8px 30px rgba(0,0,0,0.3)',
    }}>
      <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#c8a84b', fontWeight: 800, marginBottom: 6 }}>👋 Welcome to Bond Desk</div>
      <h4 style={{ margin: '0 0 8px', fontWeight: 800, fontSize: '0.95rem' }}>Two-minute orientation</h4>
      <ol style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', lineHeight: 1.5 }}>
        <li><strong>Deal review</strong> — your prioritised queue of applications, each with a recommendation.</li>
        <li><strong>Dashboard</strong> — morning briefing: what happened, what's waiting.</li>
        <li><strong>My bids / Won deals</strong> — track active bids and closed deals.</li>
        <li><strong>Auto-bid</strong> — set rules, we bid for you 24/7.</li>
        <li><strong>Portfolio &amp; risk</strong> — your book's concentration, early warning signals.</li>
        <li><strong>Market intelligence</strong> — sector and geography trends as zoom-out context.</li>
      </ol>
      <button onClick={dismiss} style={{ marginTop: 12, padding: '7px 16px', background: '#c8a84b', color: '#0b1e2d', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer', width: '100%' }}>
        Got it — let me in
      </button>
    </div>
  );
}

// Grouped-sidebar section header (#32). A clear, deliberate group label —
// reads as a heading, not a disabled nav item. First group drops the divider.
function SectionLabel({ children, first }) {
  return (
    <div style={{
      fontSize: '0.58rem',
      textTransform: 'uppercase',
      letterSpacing: '0.14em',
      fontWeight: 700,
      color: 'rgba(255,255,255,0.42)',
      margin: first ? '6px 0 6px 14px' : '16px 0 6px 14px',
      userSelect: 'none',
      pointerEvents: 'none',
      ...(first ? {} : { borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 14 }),
    }}>
      {children}
    </div>
  );
}

export default function BankShell() {
  const nav = useNavigate();
  const [me, setMe] = useState(null);
  const [notifications, setNotifications] = useState([]);
  const [showNotifs, setShowNotifs] = useState(false);
  const unread = notifications.filter(n => !n.read).length;

  useEffect(() => {
    if (!getBankToken()) return;
    bankApi.me().then(d => setMe(d.user)).catch(() => {});
    // #19 — seed the Alerts panel from standing items (conveyancing milestones,
    // fraud flags, new apps) so it isn't empty when there's no live SSE event.
    bankApi.standup().then(s => {
      const now = new Date().toISOString();
      const seed = [];
      if (s.awaitingMyMilestone > 0) seed.push({ id: 'cm',    type: 'milestone',       text: `${s.awaitingMyMilestone} conveyancing milestone${s.awaitingMyMilestone > 1 ? 's' : ''} awaiting your action`, at: now, read: false });
      if (s.fraudFlaggedActive > 0)  seed.push({ id: 'fraud', type: 'risk_alert',      text: `${s.fraudFlaggedActive} live application${s.fraudFlaggedActive > 1 ? 's' : ''} linked to a flagged fraud network`, at: now, read: false });
      if (s.newApplications > 0)     seed.push({ id: 'new',   type: 'new_application',  text: `${s.newApplications} new application${s.newApplications > 1 ? 's' : ''} in the last 24h`, at: now, read: false });
      if (seed.length) setNotifications(prev => [...seed, ...prev.filter(p => !['cm','fraud','new'].includes(p.id))]);
    }).catch(() => {});
    bankApi.openEventSource().then(src => {
      if (!src) return;
      src.onmessage = e => {
        try {
          const d = JSON.parse(e.data);
          if (['new_application','outbid','risk_alert','tier_change'].includes(d.type)) {
            setNotifications(prev => [{
              id: Date.now(),
              type: d.type,
              text: d.message || notifText(d),
              at: new Date().toISOString(),
              read: false,
            }, ...prev].slice(0, 50));
          }
        } catch {}
      };
    });
  }, []);

  function notifText(d) {
    if (d.type === 'new_application') return `New application ${d.ref || ''} arrived`;
    if (d.type === 'outbid') return `You were outbid on ${d.ref || 'a deal'}`;
    if (d.type === 'risk_alert') return `Risk alert: ${d.userId || 'borrower'} moved to ${d.newTier}`;
    return d.type;
  }

  if (!getBankToken()) return <Navigate to="/bank/login" replace />;

  const decoded = getDecodedBankToken();
  const bankName = me?.bankName || decoded?.bankName || 'Bank';

  async function doLogout() {
    await bankApi.logout();
    clearBankToken();
    nav('/bank/login', { replace: true });
  }

  const brandColor = me?.brandColor || decoded?.brandColor || '#c8a84b';

  return (
    <div className="bank-shell">
      <OnboardingTour />
      <aside className="bank-sidebar">
        <h1 onClick={() => nav('/bank/dashboard')} style={{ cursor: 'pointer' }}><span className="dot" style={{ background: brandColor, boxShadow: `0 0 0 3px ${brandColor}30` }} /> {me?.logoUrl ? <img src={me.logoUrl} alt="" style={{ height: 22, marginLeft: 6, verticalAlign: 'middle' }} /> : 'Bond Desk'}</h1>
        <div className="sub">by Bondly</div>
        <div style={{ position: 'relative', marginBottom: 8 }}>
          <button
            onClick={() => { setShowNotifs(s => !s); setNotifications(ns => ns.map(n => ({ ...n, read: true }))); }}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 7, padding: '5px 10px', color: '#fff', cursor: 'pointer', fontSize: '0.82rem', display: 'flex', alignItems: 'center', gap: 6, width: '100%' }}>
            🔔 Alerts
            {unread > 0 && (
              <span style={{ background: '#c8a84b', color: '#0b1e2d', borderRadius: 99, padding: '1px 6px', fontSize: '0.65rem', fontWeight: 800 }}>{unread}</span>
            )}
          </button>
          {showNotifs && (
            <div style={{ position: 'absolute', left: 0, top: '100%', zIndex: 1000, width: 280, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, boxShadow: '0 8px 24px rgba(0,0,0,0.15)', maxHeight: 320, overflowY: 'auto', marginTop: 4 }}>
              {notifications.length === 0 ? (
                <div style={{ padding: 16, fontSize: '0.82rem', color: '#6b7280' }}>No alerts yet.</div>
              ) : notifications.map(n => (
                <div key={n.id} style={{ padding: '10px 14px', borderBottom: '1px solid #f3f4f6', fontSize: '0.82rem', color: '#0b1e2d' }}>
                  <div style={{ fontWeight: 600 }}>{n.text}</div>
                  <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: 2 }}>{new Date(n.at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}</div>
                </div>
              ))}
            </div>
          )}
        </div>
        <nav>
          <SectionLabel first>Workspace</SectionLabel>
          <NavLink to="/bank/applications" className={({isActive}) => isActive ? 'active' : ''}>Deal review</NavLink>
          <NavLink to="/bank/dashboard"    className={({isActive}) => isActive ? 'active' : ''}>Dashboard</NavLink>

          <SectionLabel>Activity</SectionLabel>
          <NavLink to="/bank/bids"         className={({isActive}) => isActive ? 'active' : ''}>My bids</NavLink>
          <NavLink to="/bank/deals"        className={({isActive}) => isActive ? 'active' : ''}>Won deals</NavLink>
          <NavLink to="/bank/auto-bid"     className={({isActive}) => isActive ? 'active' : ''}>Auto-bid</NavLink>

          <SectionLabel>Intelligence</SectionLabel>
          <NavLink to="/bank/analytics"    className={({isActive}) => isActive ? 'active' : ''}>Portfolio &amp; risk</NavLink>
          <NavLink to="/bank/intelligence" className={({isActive}) => isActive ? 'active' : ''}>Market intelligence</NavLink>
          <NavLink to="/bank/triage"       className={({isActive}) => isActive ? 'active' : ''}>Triage</NavLink>
          <NavLink to="/bank/roadmap"      className={({isActive}) => isActive ? 'active' : ''}>
            Retention radar
            <span style={{ marginLeft: 6, fontSize: '0.55rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: '#c4b5fd', border: '1px solid rgba(196,181,253,0.5)', borderRadius: 999, padding: '1px 5px' }}>Roadmap</span>
          </NavLink>

          {(me?.role === 'bank_admin') && (
            <>
              <SectionLabel>Admin</SectionLabel>
              <NavLink to="/bank/team"     className={({isActive}) => isActive ? 'active' : ''}>Team</NavLink>
              <NavLink to="/bank/settings" className={({isActive}) => isActive ? 'active' : ''}>Settings</NavLink>
            </>
          )}
        </nav>
        <div className="me">
          <strong>{bankName}</strong>
          {me?.name || decoded?.bankUserName || decoded?.bankEmail}
          <button className="logout" onClick={doLogout}>Sign out</button>
        </div>
      </aside>
      <main className="bank-content">
        <Outlet />
      </main>
    </div>
  );
}
