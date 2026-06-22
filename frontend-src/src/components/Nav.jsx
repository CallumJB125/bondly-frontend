import { useState, useEffect, useRef } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { notifications as notifApi } from '../lib/api.js';
import { fmtDate } from '@bondly/ui/lib/format.js';
import LandingNav from '../features/landing/LandingNav.jsx';
import './Nav.css';

const ICON = {
  home:    <svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  bell:    <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
};

export default function Nav() {
  const { user, logout, isAdmin } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [notifs, setNotifs]       = useState([]);
  const [notifOpen, setNotifOpen] = useState(false);
  const notifRef = useRef(null);

  const initial   = user?.name?.[0]?.toUpperCase() || 'G';
  const [dashTab, setDashTab] = useState(() => sessionStorage.getItem('bondly_dash_tab') || 'home');

  useEffect(() => {
    function sync() { setDashTab(sessionStorage.getItem('bondly_dash_tab') || 'home'); }
    window.addEventListener('storage', sync);
    window.addEventListener('bondly:navigate', sync);
    return () => { window.removeEventListener('storage', sync); window.removeEventListener('bondly:navigate', sync); };
  }, []);

  useEffect(() => {
    if (!user) return;
    notifApi.list().then(d => setNotifs(d || [])).catch(() => {});
  }, [user]);

  useEffect(() => {
    function handler(e) {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    }
    if (notifOpen) document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [notifOpen]);

  const unread = notifs.filter(n => !n.read).length;

  // Switch dashboard tabs from the mobile bottom bar. navigate() only feeds
  // Dashboard's mount-time initial tab, so when the user is already on
  // /dashboard it does nothing — fire bondly:navigate too, which the mounted
  // Dashboard listens for and uses to switch the panel in place.
  const goTab = (t) => {
    sessionStorage.setItem('bondly_dash_tab', t);
    setDashTab(t);
    window.dispatchEvent(new CustomEvent('bondly:navigate', { detail: { tab: t } }));
    navigate('/dashboard', { state: { tab: t } });
  };

  // Auth, admin, bank and the legacy hook funnel render no global chrome.
  if (['/login', '/register', '/forgot-password', '/admin', '/hook', '/bank'].some(p => location.pathname.startsWith(p))) {
    return null;
  }
  // Landing ("/" + "/home"), the /switch flow and Contact each ship the shared
  // LandingNav themselves (Landing also carries its announce bar), so the
  // global chrome stays out on those routes to avoid a double nav.
  if (
    location.pathname === '/' ||
    location.pathname === '/home' ||
    location.pathname.startsWith('/switch') ||
    location.pathname.startsWith('/contact') ||
    location.pathname.startsWith('/test')
  ) {
    return null;
  }

  // Guests get the minimalist LandingNav site-wide — this replaces the old
  // marketing bar. Logged-in users keep the app chrome below (notifications,
  // avatar, mobile tab bar).
  if (!user) {
    return <LandingNav />;
  }

  return (
    <>
      {/* Desktop sticky nav (logged-in app shell) */}
      <nav className="nav-desktop">
        <div className="nav-desktop__inner container">
          <Link to="/" className="nav-logo">
            <svg width="26" height="26" viewBox="0 0 26 26" fill="none" aria-hidden="true" style={{ display: 'inline-block', verticalAlign: 'middle', marginRight: 8, flexShrink: 0 }}>
              <rect width="26" height="26" rx="6" fill="#1a7a45"/>
              <path d="M13 4 L21 11 H19 V21 H7 V11 H5 Z" fill="white"/>
              <rect x="10.5" y="16" width="5" height="5" rx="0.5" fill="#1a7a45"/>
            </svg>
            Bondly
          </Link>

          <div className="nav-desktop__links">
            <Link to="/dashboard" className={location.pathname === '/dashboard' ? 'active' : ''}>Dashboard</Link>
          </div>

          <div className="nav-desktop__actions">
            <div style={{ position: 'relative' }} ref={notifRef}>
              <button
                className="nav-notif-btn"
                onClick={() => setNotifOpen(o => !o)}
                aria-label={unread > 0 ? `Notifications, ${unread} unread` : 'Notifications'}
                aria-expanded={notifOpen}
                aria-haspopup="true"
              >
                <span aria-hidden="true">{ICON.bell}</span>
                {unread > 0 && (
                  <span className="nav-notif-badge" aria-hidden="true">{unread > 9 ? '9+' : unread}</span>
                )}
              </button>
              {notifOpen && (
                <div className="nav-notif-dropdown">
                  <div className="nav-notif-dropdown__header">
                    <span>Notifications</span>
                    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                      {unread > 0 && (
                        <button
                          style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                          onClick={() => {
                            notifApi.markAllRead().catch(() => {});
                            setNotifs(prev => prev.map(n => ({ ...n, read: true })));
                          }}
                        >Mark all read</button>
                      )}
                      <button onClick={() => setNotifOpen(false)}>✕</button>
                    </div>
                  </div>
                  <div style={{ maxHeight: 320, overflowY: 'auto' }}>
                    {notifs.length === 0 ? (
                      <div style={{ padding: 'var(--space-5)', textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
                        You're all caught up ✓
                      </div>
                    ) : notifs.map(n => (
                      <div
                        key={n.id}
                        style={{ padding: 'var(--space-3) var(--space-5)', borderBottom: '1px solid var(--border-color)', background: n.read ? 'transparent' : 'rgba(200,168,75,0.06)', cursor: n.read ? 'default' : 'pointer' }}
                        onClick={() => {
                          if (n.read) return;
                          notifApi.markRead(n.id).catch(() => {});
                          setNotifs(prev => prev.map(x => x.id === n.id ? { ...x, read: true } : x));
                        }}
                      >
                        <div style={{ fontWeight: n.read ? 400 : 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>{n.title || 'Notification'}</div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>{n.message}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{fmtDate(n.createdAt)}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
            {isAdmin && (
              <Link to="/admin" className="btn btn--ghost btn--sm" style={{ fontSize: '0.8125rem' }}>Admin</Link>
            )}
            <div className="nav-avatar" onClick={() => navigate('/profile')} title={`${user.name} · click for profile`}>
              {initial}
            </div>
            <button
              onClick={() => { logout(); navigate('/'); }}
              className="nav-signout-btn"
              aria-label="Sign out"
              title="Sign out"
            >
              <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            </button>
          </div>
        </div>
      </nav>

      {/* Mobile top bar — logo + quick actions, visible only on small screens */}
      <div className="nav-mobile-topbar">
        <Link to="/" className="nav-mobile-topbar__logo">
          <svg width="22" height="22" viewBox="0 0 26 26" fill="none" aria-hidden="true">
            <rect width="26" height="26" rx="6" fill="#1a7a45"/>
            <path d="M13 4 L21 11 H19 V21 H7 V11 H5 Z" fill="white"/>
            <rect x="10.5" y="16" width="5" height="5" rx="0.5" fill="#1a7a45"/>
          </svg>
          <span>Bondly</span>
        </Link>
        <div className="nav-mobile-topbar__actions">
          <button className="nav-mobile-topbar__qualify" onClick={() => navigate('/preapproval')}>
            Check my bond
          </button>
          <button
            className="nav-mobile-topbar__bell"
            onClick={() => setNotifOpen(v => !v)}
            aria-label="Notifications"
          >
            {ICON.bell}
            {unread > 0 && <span className="nav-mobile-topbar__badge">{unread > 9 ? '9+' : unread}</span>}
          </button>
        </div>
      </div>

      {/* Mobile bottom bar */}
      <nav className="nav-mobile" aria-label="Main navigation">
        <button
          className={`nav-mobile__item ${location.pathname === '/dashboard' && dashTab === 'home' ? 'active' : ''}`}
          onClick={() => goTab('home')}
        >
          <span aria-hidden="true">{ICON.home}</span>
          <span>Overview</span>
        </button>
        <button
          className={`nav-mobile__item ${location.pathname === '/dashboard' && dashTab === 'money' ? 'active' : ''}`}
          onClick={() => goTab('money')}
        >
          <span aria-hidden="true"><svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg></span>
          <span>Finances</span>
        </button>
        <button
          className={`nav-mobile__item ${location.pathname === '/dashboard' && dashTab === 'vault' ? 'active' : ''}`}
          onClick={() => goTab('vault')}
        >
          <span aria-hidden="true"><svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></span>
          <span>Docs</span>
        </button>
        <button
          className={`nav-mobile__item ${location.pathname === '/dashboard' && dashTab === 'costs' ? 'active' : ''}`}
          onClick={() => goTab('costs')}
        >
          <span aria-hidden="true"><svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg></span>
          <span>Tools</span>
        </button>
        <button
          className={`nav-mobile__item ${location.pathname === '/dashboard' && dashTab === 'bond' ? 'active' : ''}`}
          onClick={() => goTab('bond')}
        >
          <span aria-hidden="true"><svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg></span>
          <span>My Bond</span>
        </button>
        {isAdmin && (
          <button
            className={`nav-mobile__item ${location.pathname.startsWith('/admin') ? 'active' : ''}`}
            onClick={() => navigate('/admin')}
          >
            <span aria-hidden="true"><svg width="22" height="22" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg></span>
            <span>Admin</span>
          </button>
        )}
      </nav>
    </>
  );
}
