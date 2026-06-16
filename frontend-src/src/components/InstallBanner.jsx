import { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import './InstallBanner.css';

const STORAGE_KEY = 'bondly_install_dismissed';
const VISITS_KEY  = 'bondly_visits';
// Suppress on auth flows and on the Hook funnel landing ('/') — the install
// prompt should never fire before a first-time visitor has experienced value.
const SUPPRESS_ON = new Set(['/', '/login', '/signup', '/register', '/reset-password', '/magic', '/switch', '/preapproval']);

export default function InstallBanner() {
  const [show, setShow]     = useState(false);
  const [prompt, setPrompt] = useState(null); // Android beforeinstallprompt event
  const [isIOS, setIsIOS]   = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    // Don't interrupt auth flows or show to admins
    if (SUPPRESS_ON.has(pathname)) return;
    if (pathname.startsWith('/admin') || pathname.startsWith('/bank')) return;

    // Already dismissed or already installed
    if (localStorage.getItem(STORAGE_KEY)) return;
    if (window.matchMedia('(display-mode: standalone)').matches) return;
    if (window.navigator.standalone) return; // iOS standalone

    // Track visits — only show from 2nd visit onward
    const visits = parseInt(localStorage.getItem(VISITS_KEY) || '0') + 1;
    localStorage.setItem(VISITS_KEY, visits);
    if (visits < 2) return;

    const ios = /iphone|ipad|ipod/i.test(navigator.userAgent) && !window.MSStream;
    setIsIOS(ios);

    if (ios) {
      // iOS has no beforeinstallprompt — show manual instruction
      const timer = setTimeout(() => setShow(true), 3000);
      return () => clearTimeout(timer);
    }

    // Android/Chrome: capture the deferred prompt
    const handler = (e) => {
      e.preventDefault();
      setPrompt(e);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  function dismiss() {
    localStorage.setItem(STORAGE_KEY, '1');
    setShow(false);
  }

  async function install() {
    if (!prompt) return;
    prompt.prompt();
    const { outcome } = await prompt.userChoice;
    if (outcome === 'accepted') dismiss();
    else setShow(false);
  }

  if (!show || pathname.startsWith('/admin') || pathname.startsWith('/bank') || pathname.startsWith('/switch') || pathname.startsWith('/preapproval')) return null;

  return (
    <div className="install-banner" role="banner" aria-label="Add to Home Screen">
      <div className="install-banner__icon" aria-hidden="true">
        <svg width="28" height="28" viewBox="0 0 100 100" fill="var(--lime)">
          <path fillRule="evenodd" d="M50,14 L89,52 L83,52 L83,82 L17,82 L17,52 L11,52 Z M42,82 L42,70 A8,8 0 0,1 58,70 L58,82 Z M22,54 L35,54 L35,66 L22,66 Z M65,54 L78,54 L78,66 L65,66 Z" />
        </svg>
      </div>
      <div className="install-banner__body">
        <strong>Add Bondly to your home screen</strong>
        {isIOS ? (
          <span>Tap <strong>Share</strong> → <strong>Add to Home Screen</strong> for quick access</span>
        ) : (
          <span>Track your bond and save from anywhere — no app store needed</span>
        )}
      </div>
      <div className="install-banner__actions">
        {!isIOS && (
          <button className="install-banner__btn install-banner__btn--primary" onClick={install}>
            Install
          </button>
        )}
        <button className="install-banner__btn install-banner__btn--ghost" onClick={dismiss}>
          {isIOS ? 'Got it' : 'Not now'}
        </button>
      </div>
    </div>
  );
}
