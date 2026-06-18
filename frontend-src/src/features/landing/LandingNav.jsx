import { Link, useLocation } from 'react-router-dom';
import { trackAction } from '@bondly/ui/lib/session.js';
import { useAuth } from '../../context/AuthContext.jsx';
import './Landing.css';

// Env-aware sister-product URL (Bondly Home / origination), mirroring the
// pattern used elsewhere in the app (Nav.jsx, Landing.jsx, Footer).
const ORIGINATION_URL = typeof window !== 'undefined'
  ? (import.meta.env?.VITE_ORIGINATION_URL || 'http://localhost:5174')
  : 'http://localhost:5174';

// ─────────────────────────────────────────────────────────────
// NAV — 4 links, 1 CTA, cross-sell demoted.
// Shared between the Landing surface and the /switch route so both
// present the identical poster-zine nav bar.
// ─────────────────────────────────────────────────────────────
export default function LandingNav() {
  const { user } = useAuth();
  const location = useLocation();
  // "How it works" / "FAQ" anchor in-page when we're already on the landing surface.
  const onLanding = location.pathname === '/home' || location.pathname === '/';
  const howHref = onLanding ? '#how-it-works' : '/home#how-it-works';
  const faqHref = onLanding ? '#faq' : '/home#faq';
  return (
    <nav className="ls-nav">
      <div className="ls-wrap ls-nav__inner">
        <Link className="ls-logo" to="/">
          <span className="ls-logo__mark" aria-hidden="true">⌂</span>Bondly
        </Link>
        <div className="ls-nav__links">
          <a href={howHref}>How it works</a>
          <Link to="/calculators">Calculators</Link>
          <Link to="/blog">Guides</Link>
          <a href={faqHref}>FAQ</a>
        </div>
        <div className="ls-nav__right">
          <a
            className="ls-crosssell"
            href={ORIGINATION_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => trackAction('crosssell_clicked', { source: 'nav' })}
          >
            Buying instead? <b>Bondly Home ↗</b>
          </a>
          {user ? (
            <Link className="ls-btn ls-btn--primary" to="/dashboard">Dashboard</Link>
          ) : (
            <Link className="ls-btn ls-btn--primary" to="/switch">See my offers</Link>
          )}
        </div>
      </div>
    </nav>
  );
}
