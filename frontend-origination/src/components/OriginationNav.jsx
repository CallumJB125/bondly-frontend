import { Link, useLocation } from 'react-router-dom';
import './OriginationNav.css';

const SWITCH_URL = import.meta.env.VITE_SWITCH_URL || 'http://localhost:5173';

export default function OriginationNav() {
  const { pathname } = useLocation();
  return (
    <nav className="orig-nav" aria-label="Main">
      <div className="orig-wrap orig-nav__inner">
        <Link className="orig-nav__logo" to="/" aria-label="Bondly Home — homepage">
          <span className="orig-nav__logo-mark">⌂</span>Bondly <small>Home</small>
        </Link>
        <div className="orig-nav__links">
          <Link to="/mortgage-readiness" className={pathname === '/mortgage-readiness' ? 'active' : ''}>Affordability</Link>
          <Link to="/first-time-buyer-guide" className={pathname === '/first-time-buyer-guide' ? 'active' : ''}>First-home guide</Link>
          <Link to="/tools" className={pathname.startsWith('/tools') ? 'active' : ''}>Calculators</Link>
          <Link to="/faq" className={pathname === '/faq' ? 'active' : ''}>FAQ</Link>
        </div>
        <div className="orig-nav__right">
          <a className="orig-nav__crosssell" href={SWITCH_URL} target="_blank" rel="noopener noreferrer">
            Own a home? <b>Bondly Switch ↗</b>
          </a>
          <Link className="orig-nav__cta" to="/preapproval">Get pre-approved</Link>
        </div>
      </div>
    </nav>
  );
}
