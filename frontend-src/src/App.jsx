import { BrowserRouter, Routes, Route, Navigate, useLocation, useNavigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Suspense, lazy, useEffect, useState, Component } from 'react';
import { useAuth } from './context/AuthContext.jsx';
import { auth as authApi, setToken, getDecodedToken } from './lib/api.js';
import Nav from './components/Nav.jsx';
import ChatWidget from './components/ChatWidget.jsx';
import StickyCtaBar from './components/StickyCtaBar.jsx';
import InstallBanner from './components/InstallBanner.jsx';
import InterventionNudge from './components/InterventionNudge.jsx';
import { initSessionTracker, trackPageView, trackError, identifyUser } from '@bondly/ui/lib/session.js';
import { initGlobalErrorCapture } from '@bondly/ui/lib/errors.js';
import { initAnalytics, trackPageView as trackAnalyticsPageView, identify as analyticsIdentify } from '@bondly/ui/lib/analytics.js';

function isChunkError(err) {
  const msg = err?.message || err?.toString() || '';
  return (
    err?.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading (CSS )?chunk \d+ failed/i.test(msg) ||
    /Importing a module script failed/i.test(msg) ||
    // Safari / Chrome serve a stale chunk 404 → HTML fallback → these errors:
    /is not a valid JavaScript MIME type/i.test(msg) ||
    /Failed to load module script/i.test(msg) ||
    /Resource load failed/i.test(msg) ||
    // Vite chunk fingerprint mismatch — only safe to auto-reload ONCE per
    // session to avoid an infinite reload loop if the new chunk is broken.
    /assets\/.+\.js/i.test(msg)
  );
}

// Reload only once per session — avoids infinite reload loops when the
// new chunk is genuinely broken. This kicked us before: stale chunks
// fix themselves with one reload, real bugs need the error page.
const RELOAD_GUARD_KEY = 'bondly_chunk_reload_v1';
function reloadOnceForStaleChunk() {
  try {
    const last = parseInt(sessionStorage.getItem(RELOAD_GUARD_KEY) || '0', 10);
    if (last && Date.now() - last < 30000) return false;   // already reloaded in last 30s
    sessionStorage.setItem(RELOAD_GUARD_KEY, String(Date.now()));
  } catch {/* ok */}
  window.location.reload();
  return true;
}

// Window-level guard for chunk-load failures that fire OUTSIDE React's render
// cycle — these are exactly the back-button-after-deploy crashes (Safari +
// Chrome both throw asynchronous errors when a lazy() import resolves to a
// stale chunk hash that no longer exists). The ErrorBoundary catches render
// errors; this catches the import-time errors that beat React to the punch.
if (typeof window !== 'undefined') {
  window.addEventListener('error', (e) => {
    if (isChunkError(e.error || { message: e.message })) {
      e.preventDefault();
      reloadOnceForStaleChunk();
    }
  });
  window.addEventListener('unhandledrejection', (e) => {
    if (isChunkError(e.reason)) {
      e.preventDefault();
      reloadOnceForStaleChunk();
    }
  });
}

class ErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { error: null, info: null }; }
  static getDerivedStateFromError(error) { return { error }; }
  componentDidCatch(error, info) {
    // Stale chunk after a deploy — silently reload (once per session) so the
    // user never sees the error page. The reload-guard inside
    // reloadOnceForStaleChunk prevents infinite loops on genuinely broken chunks.
    if (isChunkError(error)) { if (reloadOnceForStaleChunk()) return; }
    this.setState({ info });
    try { trackError(error?.toString(), window.location.href); } catch {}
    try {
      const token = localStorage.getItem('bondly_token');
      fetch('/api/errors/log', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
        body: JSON.stringify({
          err: error?.toString(),
          stack: error?.stack,
          componentStack: info?.componentStack,
          url: window.location.href,
          ua: navigator.userAgent,
        }),
      }).catch(() => {});
    } catch {}
  }
  render() {
    if (!this.state.error) return this.props.children;
    // Chunk errors trigger a reload — show spinner only while reload is in flight (state.info not yet set)
    if (isChunkError(this.state.error) && !this.state.info) {
      return <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh' }}><div className="spinner" style={{ width:32, height:32, borderWidth:3, borderTopColor:'var(--mint)', borderColor:'var(--border-color)' }} /></div>;
    }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', padding: '2rem', textAlign: 'center' }}>
        <div style={{ fontSize: '2rem', marginBottom: 16 }}>⚠️</div>
        <h2 style={{ fontWeight: 700, marginBottom: 8 }}>Something went wrong</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 24, maxWidth: 400 }}>
          An unexpected error occurred. Your data is safe — reload the page to continue.
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{ padding: '10px 24px', background: 'var(--forest)', color: '#fff', border: 'none', borderRadius: 8, fontWeight: 600, cursor: 'pointer', fontSize: '0.9375rem' }}
        >
          Reload page
        </button>
      </div>
    );
  }
}

const Landing       = lazy(() => import('./features/landing/Landing.jsx'));
const Hook          = lazy(() => import('./features/hook/Hook.jsx'));
const Login         = lazy(() => import('./features/auth/Login.jsx'));
const Register      = lazy(() => import('./features/auth/Register.jsx'));
const ForgotPw      = lazy(() => import('./features/auth/ForgotPassword.jsx'));
const ResetPw       = lazy(() => import('./features/auth/ResetPassword.jsx'));
const Preapproval   = lazy(() => import('./features/preapproval/Preapproval.jsx'));
const Dashboard     = lazy(() => import('./features/dashboard/Dashboard.jsx'));
const Analytics     = lazy(() => import('./features/intelligence/Analytics.jsx'));
const Tools         = lazy(() => import('./features/tools/Tools.jsx'));
const Optimize      = lazy(() => import('./features/optimize/Optimize.jsx'));
const Profile       = lazy(() => import('./features/profile/Profile.jsx'));
const Application   = lazy(() => import('./features/application/Application.jsx'));
const FAQ           = lazy(() => import('./features/faq/FAQ.jsx'));
const Glossary      = lazy(() => import('./features/glossary/Glossary.jsx'));
const About         = lazy(() => import('./features/about/About.jsx'));
const BlogIndex     = lazy(() => import('./features/blog/BlogIndex.jsx'));
const BlogPost      = lazy(() => import('./features/blog/BlogPost.jsx'));
const Admin         = lazy(() => import('./features/admin/Admin.jsx'));
const Intelligence  = lazy(() => import('./features/intelligence/Intelligence.jsx'));
const Onboarding    = lazy(() => import('./features/auth/Onboarding.jsx'));
const Privacy       = lazy(() => import('./features/legal/Privacy.jsx'));
const Terms         = lazy(() => import('./features/legal/Terms.jsx'));
const Paia          = lazy(() => import('./features/legal/Paia.jsx'));
const GetAQuote     = lazy(() => import('./features/quote/GetAQuote.jsx'));
const ShareResult   = lazy(() => import('./features/share/ShareResult.jsx'));
const AcceptInvite  = lazy(() => import('./features/auth/AcceptInvite.jsx'));
const NotFound      = lazy(() => import('./features/error/NotFound.jsx'));
const LocationPage  = lazy(() => import('./features/locations/LocationPage.jsx'));
const ComparePage    = lazy(() => import('./features/compare/ComparePage.jsx'));
const MortgageCheck       = lazy(() => import('./features/mortgage/MortgageCheck.jsx'));
const MortgageReadiness   = lazy(() => import('./features/mortgage/MortgageReadiness.jsx'));
const FirstTimeBuyer      = lazy(() => import('./features/firstTimeBuyer/FirstTimeBuyerGuide.jsx'));
const Guarantee      = lazy(() => import('./features/guarantee/Guarantee.jsx'));
const Letter         = lazy(() => import('./features/letter/Letter.jsx'));
const Switch         = lazy(() => import('./features/switch/Switch.jsx'));

const BankLogin             = lazy(() => import('./features/bank/BankLogin.jsx'));
const BankShell             = lazy(() => import('./features/bank/BankShell.jsx'));
const BankDashboard         = lazy(() => import('./features/bank/BankDashboard.jsx'));
const BankApplications      = lazy(() => import('./features/bank/BankApplications.jsx'));
const BankApplicationDetail = lazy(() => import('./features/bank/BankApplicationDetail.jsx'));
const BankBids              = lazy(() => import('./features/bank/BankBids.jsx'));
const BankAcceptInvite      = lazy(() => import('./features/bank/BankAcceptInvite.jsx'));
const BankTeam              = lazy(() => import('./features/bank/BankTeam.jsx'));
const BankAuditLog          = lazy(() => import('./features/bank/BankAuditLog.jsx'));
const BankDeals             = lazy(() => import('./features/bank/BankDeals.jsx'));
const BankAutoBid           = lazy(() => import('./features/bank/BankAutoBid.jsx'));
const BankAnalytics         = lazy(() => import('./features/bank/BankAnalytics.jsx'));
const BankIntelligence      = lazy(() => import('./features/bank/BankIntelligence.jsx'));
const BankSettings          = lazy(() => import('./features/bank/BankSettings.jsx'));
const BankTriage            = lazy(() => import('./features/bank/BankTriage.jsx'));
const BankRoadmap           = lazy(() => import('./features/bank/BankRoadmap.jsx'));

// Redirect to the origination app (localhost:5174 in dev, real domain in prod)
const ORIGINATION_BASE = import.meta.env.VITE_ORIGINATION_URL || 'http://localhost:5174';
function OriginRedirect({ path }) {
  useEffect(() => { window.location.replace(ORIGINATION_BASE + path); }, [path]);
  return null;
}

function PrivateRoute({ children }) {
  const { isLoggedIn, loading } = useAuth();
  const location = useLocation();
  if (loading) return <PageLoader />;
  if (isLoggedIn) return children;
  // Pass the destination so Login can show context ("Please sign in to view your dashboard")
  const routeLabel = location.pathname.replace(/^\//, '').replace(/-/g, ' ') || 'page';
  return <Navigate to="/login" state={{ from: location, redirectReason: routeLabel }} replace />;
}

function AdminRoute({ children }) {
  const { isLoggedIn, isAdmin, loading } = useAuth();
  if (loading) return <PageLoader />;
  if (!isLoggedIn) return <Navigate to="/login" replace />;
  if (!isAdmin) return <Navigate to="/dashboard" replace />;
  return children;
}

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh' }}>
      <div className="spinner" style={{ width: 32, height: 32, borderWidth: 3, borderTopColor: 'var(--mint)', borderColor: 'var(--border-color)' }} />
    </div>
  );
}

const BASE_URL = 'https://bondly.co.za';
const BASE_TITLE = 'Bondly — Switch Your Home Loan & Save | SA Bond Comparison';
const ROUTE_TITLES = {
  '/':                   BASE_TITLE,
  '/login':              'Sign In | Bondly',
  '/register':           'Create Account | Bondly',
  '/forgot-password':    'Reset Password | Bondly',
  '/reset-password':     'Set New Password | Bondly',
  '/preapproval':        'Check Your Bond Amount | Bondly',
  '/get-a-quote':        'Check Your Bond Amount | Bondly',
  '/optimize':           'Financial Check | Bondly',
  '/dashboard':          'My Dashboard | Bondly',
  '/profile':            'My Profile | Bondly',
  '/application':        'My Application | Bondly',
  '/onboarding':         'Get Started | Bondly',
  '/faq':                'Frequently Asked Questions | Bondly',
  '/glossary':           'Home Loan Glossary | Bondly',
  '/about':              'About Us | Bondly',
  '/blog':               'Home Loan Guides & Tips | Bondly',
  '/privacy':            'Privacy Policy & POPIA Notice | Bondly',
  '/terms':              'Terms of Service | Bondly',
  '/tools':              'Home Loan Calculators | Bondly',
  '/tools/repayment-calculator': 'Repayment Calculator | Bondly',
  '/tools/affordability-calculator': 'Affordability Calculator | Bondly',
  '/tools/rate-impact-simulator': 'Rate Impact Simulator | Bondly',
  '/mortgage':           'Mortgage Health Check | Bondly',
  '/mortgage-readiness': 'Can I afford a home loan? | Bondly',
  '/can-i-afford':       'Can I afford a home loan? | Bondly',
  '/first-time-buyer-guide': 'First-time home buyer guide — no jargon | Bondly',
  '/guarantee':          'Best Rate Guarantee | Bondly',
  '/switch':             'Switch Your Bond — Compare 7 Banks | Bondly',
  '/admin':              'Admin | Bondly',
  '/bank':               'Bond Desk | Bondly',
  '/bank/login':         'Sign in | Bond Desk',
};

function RouteHead() {
  const location = useLocation();

  useEffect(() => {
    const path  = location.pathname;
    const url   = BASE_URL + path;

    // Title: exact match, then prefix scan, then fallback
    let title = ROUTE_TITLES[path];
    if (!title) {
      const prefix = Object.keys(ROUTE_TITLES).find(k => k !== '/' && path.startsWith(k));
      title = prefix ? ROUTE_TITLES[prefix] : BASE_TITLE;
    }

    // Don't override blog post titles — BlogPost.jsx sets its own via useEffect
    if (!path.match(/^\/blog\/.+/)) document.title = title;

    // Canonical
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = url;

    // og:url
    const ogUrl = document.querySelector('meta[property="og:url"]');
    if (ogUrl) ogUrl.setAttribute('content', url);

    // noindex admin pages
    let noindex = document.querySelector('meta[name="robots"][data-dynamic]');
    if (path.startsWith('/admin')) {
      if (!noindex) {
        noindex = document.createElement('meta');
        noindex.name = 'robots';
        noindex.setAttribute('data-dynamic', '1');
        document.head.appendChild(noindex);
      }
      noindex.content = 'noindex, nofollow';
    } else if (noindex) {
      noindex.remove();
    }
  }, [location.pathname]);

  return null;
}

function SessionTracker() {
  const location = useLocation();
  const { user } = useAuth();

  useEffect(() => {
    initGlobalErrorCapture(); // wire up window.onerror, unhandledrejection, resource errors
    const cleanupSession = initSessionTracker();
    const cleanupAnalytics = initAnalytics();
    return () => { cleanupSession(); cleanupAnalytics(); };
  }, []);

  useEffect(() => {
    trackPageView(location.pathname);
    trackAnalyticsPageView(location.pathname);
  }, [location.pathname]);

  useEffect(() => {
    if (user?.id) {
      identifyUser(user.id);
      analyticsIdentify(user.id);
    }
  }, [user?.id]);

  return null;
}

function MagicLinkHandler() {
  const location = useLocation();
  const navigate = useNavigate();
  const { loginWithToken } = useAuth();

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const type = params.get('type');

    if (type === 'magic' && token) {
      authApi.magicVerify(token).then(data => {
        setToken(data.token);
        const decoded = getDecodedToken();
        loginWithToken(data.token, { name: data.user?.name, email: data.user?.email, ...decoded });
        const hasPendingOptimizer = !!sessionStorage.getItem('bondly_optimizer_pending');
        const role = data.role || decoded?.role;
        navigate(hasPendingOptimizer ? '/optimize' : (role === 'admin' ? '/admin' : '/dashboard'), { replace: true });
      }).catch(() => {
        navigate('/login?magic_error=1', { replace: true });
      });
    }
  }, [location.search]); // re-run if URL changes (e.g. user already had site open)

  return null;
}

function ConsentBanner() {
  const [visible, setVisible] = useState(() => !localStorage.getItem('bondly_consent'));

  if (!visible) return null;

  function accept() {
    localStorage.setItem('bondly_consent', '1');
    localStorage.setItem('bly_consent_seen', '1');
    setVisible(false);
  }

  function optOutAnalytics() {
    localStorage.setItem('bly_analytics_opt_out', '1');
    localStorage.setItem('bondly_consent', '1');
    localStorage.setItem('bly_consent_seen', '1');
    setVisible(false);
  }

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)', left: '50%', transform: 'translateX(-50%)',
      zIndex: 9000,
      background: 'var(--bg-card)', border: '1px solid var(--border-color)',
      padding: '8px 12px 8px 16px',
      display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'nowrap',
      boxShadow: '0 4px 24px rgba(0,0,0,0.18)',
      borderRadius: 40, whiteSpace: 'nowrap', maxWidth: '95vw',
    }}>
      <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        We use cookies &amp; anonymous analytics · <strong>POPIA</strong>{' '}
        <a href="/privacy" style={{ color: 'var(--mint)', textDecoration: 'underline' }}>Privacy policy</a>
      </p>
      <button
        onClick={optOutAnalytics}
        style={{ fontSize: '0.7rem', padding: '4px 10px', background: 'none', border: '1px solid var(--border-color)', borderRadius: 20, cursor: 'pointer', color: 'var(--text-secondary)', flexShrink: 0 }}
      >
        Opt out
      </button>
      <button
        onClick={accept}
        style={{ fontSize: '0.75rem', fontWeight: 700, padding: '5px 14px', background: 'var(--lime)', color: 'var(--forest)', border: 'none', borderRadius: 20, cursor: 'pointer', flexShrink: 0 }}
      >
        Accept
      </button>
    </div>
  );
}

const WA_NUMBER = '27796971786';
const WA_MSG    = encodeURIComponent("Hi, I'd like to know more about switching my bond with Bondly");

function WhatsAppFab() {
  const { pathname } = useLocation();
  if (pathname.startsWith('/admin') || pathname.startsWith('/s/') || pathname.startsWith('/accept-invite/')) return null;
  return (
    <a
      href={`https://wa.me/${WA_NUMBER}?text=${WA_MSG}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat on WhatsApp"
      className="wa-fab"
    >
      {/* WhatsApp logo */}
      <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
        <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z"/>
      </svg>
    </a>
  );
}

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine);
  useEffect(() => {
    const on  = () => setOffline(false);
    const off = () => setOffline(true);
    window.addEventListener('online', on);
    window.addEventListener('offline', off);
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off); };
  }, []);
  if (!offline) return null;
  return (
    <div className="offline-banner" role="alert" aria-live="assertive">
      You're offline — some features may be unavailable
    </div>
  );
}

// First-time logged-out visitors see the Hook funnel at /. Returning visitors
// (have account OR have already seen the hook) get the regular Landing.
// Override with ?force-hook=1 or ?force-landing=1 for testing.
function RootGate() {
  const search = typeof window !== 'undefined' ? window.location.search : '';
  const params = new URLSearchParams(search);
  // The redesigned Landing is calculator-first — it IS the hook. Show it by
  // default at "/". The legacy Hook funnel remains reachable via ?force-hook=1.
  if (params.get('force-hook') === '1')    return <Hook />;
  return <Landing />;
}

function AppContent() {
  // Bank portal is a separate workspace — none of the customer-facing
  // chrome (chat, consent, install prompt, intervention nudges) should leak in.
  const location = useLocation();
  const isBankPortal = location.pathname.startsWith('/bank');
  return (
    <>
      <a href="#main-content" className="skip-link">Skip to main content</a>
      <OfflineBanner />
      <RouteHead />
      <SessionTracker />
      <Nav />
      {!isBankPortal && <ChatWidget />}
      {!isBankPortal && <ConsentBanner />}
      {!isBankPortal && <InstallBanner />}
      {!isBankPortal && <InterventionNudge />}
      {!isBankPortal && <StickyCtaBar />}
      <MagicLinkHandler />
      <Suspense fallback={<PageLoader />}>
        <main id="main-content">
        <Routes>
          {/* Public */}
          <Route path="/"               element={<RootGate />} />
          <Route path="/home"           element={<Landing />} />
          <Route path="/hook"           element={<Hook />} />
          <Route path="/login"          element={<Login />} />
          <Route path="/register"       element={<Register />} />
          <Route path="/forgot-password" element={<ForgotPw />} />
          <Route path="/reset-password"  element={<ResetPw />} />
          {/* Pre-approval is a BUYING flow — it belongs on the origination product, not the switch site. */}
          <Route path="/preapproval"    element={<OriginRedirect path="/preapproval" />} />
          <Route path="/faq"            element={<FAQ />} />
          <Route path="/glossary"       element={<Glossary />} />
          <Route path="/about"          element={<About />} />
          <Route path="/blog"           element={<BlogIndex />} />
          <Route path="/blog/:slug"     element={<BlogPost />} />
          <Route path="/privacy"        element={<Privacy />} />
          <Route path="/terms"          element={<Terms />} />
          <Route path="/paia"           element={<Paia />} />
          <Route path="/get-a-quote"    element={<Navigate to="/preapproval" replace />} />
          <Route path="/switch"         element={<Switch />} />
          <Route path="/switch/demo"    element={<Switch demo />} />
          <Route path="/guarantee"      element={<Guarantee />} />
          <Route path="/letter/:token"  element={<Letter />} />

          {/* Tools — individual URLs for SEO */}
          <Route path="/tools"          element={<Navigate to="/tools/repayment-calculator" replace />} />
          <Route path="/calculators"    element={<Navigate to="/tools/repayment-calculator" replace />} />
          <Route path="/tools/:tool"    element={<Tools />} />
          {/* Origination routes — redirect to origination app (localhost:5174 in dev) */}
          <Route path="/mortgage"               element={<OriginRedirect path="/mortgage-readiness" />} />
          <Route path="/mortgage-readiness"     element={<OriginRedirect path="/mortgage-readiness" />} />
          <Route path="/can-i-afford"           element={<OriginRedirect path="/can-i-afford" />} />
          <Route path="/first-time-buyer-guide" element={<OriginRedirect path="/first-time-buyer-guide" />} />

          {/* Protected */}
          <Route path="/onboarding"  element={<PrivateRoute><Onboarding /></PrivateRoute>} />
          <Route path="/dashboard"   element={<PrivateRoute><Dashboard /></PrivateRoute>} />
          <Route path="/analytics"   element={<PrivateRoute><Analytics /></PrivateRoute>} />
          <Route path="/optimize"           element={<Optimize />} />
          <Route path="/optimizer"          element={<Navigate to="/optimize" replace />} />
          <Route path="/financial-optimizer" element={<Navigate to="/optimize" replace />} />
          <Route path="/how-it-works"        element={<Navigate to="/faq" replace />} />
          <Route path="/tools/financial-check" element={<Navigate to="/tools" replace />} />
          <Route path="/profile"     element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/application" element={<PrivateRoute><Application /></PrivateRoute>} />

          {/* Admin */}
          <Route path="/admin"             element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/admin/:tab"        element={<AdminRoute><Admin /></AdminRoute>} />
          <Route path="/admin/intelligence" element={<AdminRoute><Intelligence /></AdminRoute>} />

          {/* Bank portal — separate auth scope (bondly_bank_token) */}
          <Route path="/bank/login"               element={<BankLogin />} />
          <Route path="/bank/accept-invite/:token" element={<BankAcceptInvite />} />
          <Route path="/bank"                     element={<BankShell />}>
            <Route index                          element={<Navigate to="/bank/applications" replace />} />
            <Route path="dashboard"               element={<BankDashboard />} />
            <Route path="applications"            element={<BankApplications />} />
            <Route path="applications/:ref"       element={<BankApplicationDetail />} />
            <Route path="bids"                    element={<BankBids />} />
            <Route path="deals"                   element={<BankDeals />} />
            <Route path="deals/:cappId"           element={<BankDeals />} />
            <Route path="won"                     element={<Navigate to="/bank/deals" replace />} />
            <Route path="portfolio"               element={<Navigate to="/bank/analytics" replace />} />
            <Route path="auto-bid"                element={<BankAutoBid />} />
            <Route path="triage"                  element={<BankTriage />} />
            <Route path="roadmap"                 element={<BankRoadmap />} />
            <Route path="analytics"               element={<BankAnalytics />} />
            <Route path="intelligence"            element={<BankIntelligence />} />
            <Route path="settings"                element={<BankSettings />} />
            <Route path="team"                    element={<BankTeam />} />
            <Route path="audit-log"               element={<BankAuditLog />} />
          </Route>

          {/* Share / invite */}
          {/* Location SEO pages */}
          <Route path="/home-loans-:location" element={<LocationPage />} />

          {/* Bank comparison pages */}
          <Route path="/compare/:slug" element={<ComparePage />} />

          {/* Share / invite */}
          <Route path="/s/:token"             element={<ShareResult />} />
          <Route path="/accept-invite/:token" element={<AcceptInvite />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
        </main>
      </Suspense>
    </>
  );
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 30_000, retry: 1, refetchOnWindowFocus: false },
  },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <ErrorBoundary>
          <AppContent />
        </ErrorBoundary>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
