import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuth } from './context/AuthContext.jsx';

const SWITCH_BASE = import.meta.env.VITE_SWITCH_URL || 'http://localhost:5173';

function SwitchRedirect({ path }) {
  useEffect(() => { window.location.replace(SWITCH_BASE + path); }, [path]);
  return null;
}

const OriginationLanding  = lazy(() => import('./features/landing/OriginationLanding.jsx'));
const MortgageReadiness   = lazy(() => import('./features/mortgage/MortgageReadiness.jsx'));
const FirstTimeBuyer      = lazy(() => import('./features/firstTimeBuyer/FirstTimeBuyerGuide.jsx'));
// Rich pre-approval flow ported from bondly.co.za: quick estimate → bank statement → review → result
const OriginationPreapproval = lazy(() => import('./features/preapproval/Preapproval.jsx'));
const OriginationDashboard   = lazy(() => import('./features/dashboard/OriginationDashboard.jsx'));
const Login               = lazy(() => import('./features/auth/Login.jsx'));
const Register            = lazy(() => import('./features/auth/Register.jsx'));
const ForgotPassword      = lazy(() => import('./features/auth/ForgotPassword.jsx'));
const ResetPassword       = lazy(() => import('./features/auth/ResetPassword.jsx'));
const Privacy             = lazy(() => import('./features/legal/Privacy.jsx'));
const Terms               = lazy(() => import('./features/legal/Terms.jsx'));
const Paia                = lazy(() => import('./features/legal/Paia.jsx'));
const Glossary            = lazy(() => import('./features/glossary/Glossary.jsx'));
const FAQ                 = lazy(() => import('./features/faq/FAQ.jsx'));
const Calculators         = lazy(() => import('./features/tools/Calculators.jsx'));
const NotFound            = lazy(() => import('./features/error/NotFound.jsx'));

function Spinner() {
  return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ width: 32, height: 32, border: '3px solid #d8f0e8', borderTopColor: '#2D6A4F', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
    </div>
  );
}

function PrivateRoute({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Spinner />;
  if (!user) return <Navigate to="/login" state={{ from: location, reason: 'auth_required' }} replace />;
  return children;
}

export default function App() {
  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Suspense fallback={<Spinner />}>
        <Routes>
          <Route path="/"                       element={<OriginationLanding />} />
          <Route path="/mortgage-readiness"     element={<MortgageReadiness />} />
          <Route path="/can-i-afford"           element={<Navigate to="/mortgage-readiness" replace />} />
          <Route path="/mortgage"               element={<Navigate to="/mortgage-readiness" replace />} />
          <Route path="/first-time-buyer-guide" element={<FirstTimeBuyer />} />
          <Route path="/first-time-buyer"       element={<Navigate to="/first-time-buyer-guide" replace />} />
          <Route path="/calculators"            element={<Navigate to="/tools" replace />} />
          <Route path="/preapproval"            element={<OriginationPreapproval />} />
          <Route path="/login"                  element={<Login />} />
          <Route path="/register"               element={<Register />} />
          <Route path="/forgot-password"        element={<ForgotPassword />} />
          <Route path="/reset-password"         element={<ResetPassword />} />
          <Route path="/privacy"                element={<Privacy />} />
          <Route path="/terms"                  element={<Terms />} />
          <Route path="/paia"                   element={<Paia />} />
          <Route path="/glossary"               element={<Glossary />} />
          <Route path="/faq"                    element={<FAQ />} />
          <Route path="/tools"                  element={<Calculators />} />
          <Route path="/tools/:tool"            element={<Calculators />} />
          <Route path="/dashboard"              element={<PrivateRoute><OriginationDashboard /></PrivateRoute>} />
          {/* Content pages shared with switching app */}
          <Route path="/about"                  element={<SwitchRedirect path="/about" />} />
          <Route path="/blog"                   element={<SwitchRedirect path="/blog" />} />
          <Route path="/blog/:slug"             element={<SwitchRedirect path="/blog" />} />
          <Route path="/guarantee"              element={<SwitchRedirect path="/guarantee" />} />
          <Route path="/optimize"               element={<SwitchRedirect path="/optimize" />} />
          <Route path="/switch"                 element={<SwitchRedirect path="/switch" />} />
          <Route path="*"                       element={<NotFound />} />
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
