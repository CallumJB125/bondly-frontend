import { Link } from 'react-router-dom';
import OriginationNav from '../../components/OriginationNav.jsx';
import './NotFound.css';

export default function NotFound() {
  return (
    <div className="notfound-page">
      <OriginationNav />
      <div className="notfound-inner">
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">Page not found</h1>
        <p className="notfound-sub">This page doesn't exist or may have moved.</p>
        <div className="notfound-links">
          <Link to="/" className="btn btn--lime">Back to home</Link>
          <Link to="/preapproval" className="btn btn--ghost">Get pre-approved →</Link>
        </div>
        <div className="notfound-shortcuts">
          <p>Or go directly to:</p>
          <div className="notfound-shortcuts__grid">
            <Link to="/">Home</Link>
            <Link to="/mortgage-readiness">Affordability check</Link>
            <Link to="/first-time-buyer-guide">First-home guide</Link>
            <Link to="/tools">Calculators</Link>
            <Link to="/faq">FAQ</Link>
            <Link to="/preapproval">Start pre-approval</Link>
          </div>
        </div>
      </div>
    </div>
  );
}
