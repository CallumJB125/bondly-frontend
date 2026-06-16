// Global error capture — catches everything the ErrorBoundary misses.
// Initialised once in App.jsx. Sends to /api/errors/log with rate-limiting.

const ENDPOINT   = '/api/errors/log';
const RATE_MS    = 5 * 60 * 1000; // same error at most once per 5 min client-side
const _seen      = new Map();      // message → lastSentAt

function _ctx() {
  try {
    const raw = localStorage.getItem('bondly_token');
    let userId = null;
    if (raw) {
      try { userId = JSON.parse(atob(raw.split('.')[1].replace(/-/g,'+').replace(/_/g,'/'))).userId; } catch {}
    }
    return { userId, page: window.location.pathname };
  } catch { return { page: window.location.pathname }; }
}

function _send(message, stack, context, extra = {}) {
  if (!message) return;
  const key = String(message).slice(0, 120);
  const now = Date.now();
  if (_seen.has(key) && now - _seen.get(key) < RATE_MS) return;
  _seen.set(key, now);
  try {
    fetch(ENDPOINT, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: String(message).slice(0, 500),
        stack:   stack  ? String(stack).slice(0, 2000) : null,
        context: context || null,
        url:     window.location.pathname,
        ua:      navigator.userAgent.slice(0, 200),
        ..._ctx(),
        ...extra,
      }),
    }).catch(() => { /* silently drop — avoid infinite loop if /api/errors/log is itself down */ });
  } catch { /* fetch API not available (SSR/test env) */ }
}

export function initGlobalErrorCapture() {
  // 1. Uncaught synchronous JS errors
  const _prevOnerror = window.onerror;
  window.onerror = function(msg, src, line, col, err) {
    // Ignore benign browser extension noise
    if (/extension|moz-extension|safari-extension/i.test(String(src))) return false;
    _send(err?.message || String(msg), err?.stack, `onerror @ ${src}:${line}`);
    return _prevOnerror ? _prevOnerror.apply(this, arguments) : false;
  };

  // 2. Unhandled promise rejections
  window.addEventListener('unhandledrejection', ev => {
    const r = ev.reason;
    // ChunkLoadErrors are handled by ErrorBoundary (auto-reload) — skip
    if (/ChunkLoadError|Failed to fetch dynamically imported/i.test(r?.message || '')) return;
    _send(r?.message || String(r), r?.stack, 'unhandledrejection');
  });

  // 3. Failed resource loads (script/css/img/font) — capture phase
  window.addEventListener('error', ev => {
    if (!ev.target || ev.target === window) return; // JS errors handled by onerror
    const src = ev.target.src || ev.target.href || '';
    if (!src || /google|gtag|analytics|fonts\.g/i.test(src)) return; // ignore third-party
    _send(`Resource load failed: ${src.split('/').pop().slice(0, 80)}`, null, 'resource_error', { url: src.slice(0, 200) });
  }, { capture: true });
}

// Called by apiFetch for systematic API failures (5xx, 401 expiry, network errors)
export function trackApiError(method, path, status, errorMessage) {
  // Don't log expected user-facing errors (wrong password etc.)
  if (status === 400 || status === 404) return;
  // Don't log auth endpoint 401s (wrong credentials — expected)
  if (status === 401 && /\/api\/auth\/(login|register|magic)/.test(path)) return;
  const msg = `API ${status || 'network'}: ${method} ${path}`;
  _send(msg, null, 'api_error', { extra: String(errorMessage || '').slice(0, 150) });
}
