import { Link } from 'react-router-dom';
import './NotFound.css';

export default function NotFound() {
  return (
    <div className="notfound-page">
      <div className="notfound-inner">
        <div className="notfound-code">404</div>
        <h1 className="notfound-title">Page not found</h1>
        <p className="notfound-sub">This page doesn't exist or may have moved.</p>
        <div className="notfound-links">
          <Link to="/" className="btn btn--lime">Back to home</Link>
          <Link to="/preapproval" className="btn btn--ghost">Check my rate →</Link>
        </div>
        <div className="notfound-shortcuts">
          <p>Or go directly to:</p>
          <div className="notfound-shortcuts__grid">
            <Link to="/tools/repayment-calculator">Repayment Calculator</Link>
            <Link to="/optimize">Financial Check</Link>
            <Link to="/blog">Guides</Link>
            <a href="/home#faq">FAQ</a>
          </div>
        </div>
      </div>
    </div>
  );
}
