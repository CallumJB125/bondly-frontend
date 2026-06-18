import React from 'react';
import ReactDOM from 'react-dom/client';
import { AlertTriangle } from 'lucide-react';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import { ThemeProvider } from './context/ThemeContext.jsx';
import { ToastProvider } from '@bondly/ui/components/Toast.jsx';
import { ApplicationDraftProvider } from '@bondly/ui/lib/applicationDraft.jsx';
import '@bondly/ui/styles/fonts.css';
import '@bondly/ui/styles/tokens.css';
import '@bondly/ui/styles/base.css';

function isChunkError(err) {
  const msg = err?.message || err?.toString() || '';
  return (
    err?.name === 'ChunkLoadError' ||
    /Failed to fetch dynamically imported module/i.test(msg) ||
    /Loading (CSS )?chunk \d+ failed/i.test(msg) ||
    /Importing a module script failed/i.test(msg)
  );
}

// Reload silently on stale Vite chunks (after every deploy)
window.addEventListener('vite:preloadError', () => { window.location.reload(); });

class ErrorBoundary extends React.Component {
  constructor(props) { super(props); this.state = { error: null }; }
  static getDerivedStateFromError(err) { return { error: err }; }
  componentDidCatch(error) {
    if (isChunkError(error)) { window.location.reload(); }
  }
  render() {
    if (!this.state.error) return this.props.children;
    if (isChunkError(this.state.error)) {
      return <div style={{ minHeight:'100vh', display:'flex', alignItems:'center', justifyContent:'center' }}><div style={{ width:36, height:36, border:'3px solid #e2e8f0', borderTopColor:'#1e3a5f', borderRadius:'50%', animation:'spin 0.8s linear infinite' }} /></div>;
    }
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 32, fontFamily: 'sans-serif', background: '#f8fafc' }}>
        <div style={{ maxWidth: 480, textAlign: 'center' }}>
          <div style={{ marginBottom: 16, display: 'flex', justifyContent: 'center' }}><AlertTriangle size={48} color="#d97706" /></div>
          <h2 style={{ marginBottom: 12, fontSize: '1.25rem', color: '#1e3a5f' }}>Something went wrong</h2>
          <p style={{ color: '#666', marginBottom: 24, lineHeight: 1.6 }}>
            An unexpected error occurred. Try refreshing the page — your data is safe.
          </p>
          <button
            onClick={() => window.location.reload()}
            style={{ background: '#1e3a5f', color: '#fff', border: 'none', borderRadius: 8, padding: '12px 28px', fontSize: '0.9375rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Reload page
          </button>
        </div>
      </div>
    );
  }
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <AuthProvider>
          <ToastProvider>
            <ApplicationDraftProvider>
              <App />
            </ApplicationDraftProvider>
          </ToastProvider>
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
);

// Service worker registration.
//
// A previous build (commit ad2a0934) registered a CACHE-FIRST service worker
// and the v2.0 rebuild (b351674f) then removed the registration entirely while
// leaving sw.js on the server. The result: returning mobile / PWA users kept
// the old cache-first worker controlling the page, which serves a stale
// index.html referencing JS chunk hashes that no longer exist after a deploy —
// so every lazy()-loaded route (i.e. every bottom-tab navigation) 404s its
// chunk and the app crashes into the ErrorBoundary.
//
// Re-registering points those devices at the current network-first sw.js, whose
// activate handler deletes all non-current caches and calls skipWaiting() +
// clients.claim() — evicting the poisoned cache-first store and un-bricking
// existing users. updateViaCache: 'none' + reg.update() force the browser to
// revalidate the worker script itself rather than serve a cached copy.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker
      .register('/sw.js', { updateViaCache: 'none' })
      .then(reg => reg.update())
      .catch(() => {});
  });
}
