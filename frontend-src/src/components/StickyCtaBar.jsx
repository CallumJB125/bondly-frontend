import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import './StickyCtaBar.css';

const HIDE_ON = new Set([
  '/login', '/register', '/forgot-password', '/reset-password',
  '/onboarding', '/dashboard', '/profile', '/application',
  '/optimize', '/optimizer', '/preapproval',
]);

export default function StickyCtaBar() {
  const [visible, setVisible] = useState(false);
  const { user } = useAuth();
  const { pathname } = useLocation();
  const isLanding = pathname === '/';

  useEffect(() => {
    setVisible(false);
    const onScroll = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', onScroll, { passive: true });
    // On non-landing pages show after 1.5 s so it doesn't pop immediately on load
    const timer = !isLanding ? setTimeout(() => setVisible(true), 1500) : null;
    return () => {
      window.removeEventListener('scroll', onScroll);
      if (timer) clearTimeout(timer);
    };
  }, [pathname, isLanding]);

  if (user) return null;
  if (isLanding) return null; // landing page has its own sticky bar with scroll-to-form behaviour
  if (HIDE_ON.has(pathname)) return null;
  if (pathname.startsWith('/admin') || pathname.startsWith('/bank') || pathname.startsWith('/s/') || pathname.startsWith('/accept-invite/')) return null;

  const isSwitch          = pathname === '/switch' || pathname === '/switch/demo';
  const isPreapproval     = pathname === '/preapproval';
  const isMortgageCheck   = pathname === '/mortgage-readiness';

  return (
    <div className={`sticky-cta-bar ${visible ? 'sticky-cta-bar--visible' : ''}`}>
      <div className="sticky-cta-bar__inner">
        <div className="sticky-cta-bar__proof">
          {isPreapproval
            ? <><strong>7 banks</strong> compared &nbsp;·&nbsp; No credit check &nbsp;·&nbsp; 100% free</>
            : <><strong>R650–R1,100/mo</strong> typical saving* &nbsp;·&nbsp; No credit check &nbsp;·&nbsp; 100% free</>
          }
        </div>
        <div className="sticky-cta-bar__actions">
          {isSwitch ? (
            <Link to="/switch" className="sticky-cta-bar__btn sticky-cta-bar__btn--primary">
              Start my switch — free →
            </Link>
          ) : (
            <Link to="/preapproval" className="sticky-cta-bar__btn sticky-cta-bar__btn--primary">
              {isPreapproval ? 'Continue my pre-approval →' : 'Check what I qualify for →'}
            </Link>
          )}
          {!isSwitch && !isPreapproval && !isMortgageCheck && (
            <Link to="/switch" className="sticky-cta-bar__btn sticky-cta-bar__btn--ghost">
              Check my switch savings
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}
