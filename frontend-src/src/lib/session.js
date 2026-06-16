// Lightweight client-side session tracker
// Records route visits + errors + interactions, beacons to server on page hide/close
// No third parties. Data stored in sessionStorage, flushed to server.

// Fire both GA4 and Plausible with one call.
// category is the GA4 event_category (e.g. 'conversion', 'preapproval').
export function track(eventName, category = 'engagement', props = {}) {
  try { window.gtag?.('event', eventName, { event_category: category, ...props }); } catch {}
  try { window.plausible?.(eventName, { props: { category, ...props } }); } catch {}
}

const SESSION_KEY = 'bly_sid';
const STORE_KEY   = 'bly_session';
const FLUSH_URL   = '/api/session/beacon';
const FLUSH_INTERVAL_MS = 60_000;

function makeId() {
  return 'sid_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7);
}

function load() {
  try { return JSON.parse(sessionStorage.getItem(STORE_KEY) || 'null'); } catch { return null; }
}

function save(session) {
  try { sessionStorage.setItem(STORE_KEY, JSON.stringify(session)); } catch {}
}

function currentPage(s) {
  return s.pages.length > 0 ? s.pages[s.pages.length - 1].route : null;
}

function getOrCreate() {
  let s = load();
  if (!s) {
    s = {
      id:          makeId(),
      startedAt:   new Date().toISOString(),
      pages:       [],
      errors:      [],
      signals:     [], // rage clicks, stuck events, form abandonment
      actions:     [], // named key actions
      userId:      null,
    };
    save(s);
  }
  try { localStorage.setItem(SESSION_KEY, s.id); } catch {}
  return s;
}

function addSignal(type, meta = {}) {
  const s = getOrCreate();
  if (!s.signals) s.signals = [];
  s.signals.push({ type, at: new Date().toISOString(), page: currentPage(s), ...meta });
  s.lastActivityAt = new Date().toISOString();
  if (s.signals.length > 200) s.signals = s.signals.slice(-200);
  save(s);
}

export function trackPageView(route) {
  const s = getOrCreate();
  const now = new Date().toISOString();
  if (s.pages.length > 0) {
    const last = s.pages[s.pages.length - 1];
    if (!last.leftAt) last.leftAt = now;
  }
  s.pages.push({ route, enteredAt: now, leftAt: null });
  s.lastActivityAt = now;
  save(s);
}

export function trackError(message, url) {
  const s = getOrCreate();
  if (!s.errors) s.errors = [];
  s.errors.push({
    message: String(message || '').slice(0, 200),
    url:     String(url || window.location.href).replace(/^https?:\/\/[^/]+/, ''),
    at:      new Date().toISOString(),
    page:    currentPage(s),
  });
  s.lastActivityAt = new Date().toISOString();
  save(s);
}

export function identifyUser(userId) {
  const s = getOrCreate();
  s.userId = userId;
  save(s);
}

// Form field blur — abandonment tracking
export function trackFormField(formName, fieldName, step) {
  addSignal('form_field', { formName, fieldName, step: step || null });
}

// Analytics forward — filled by analytics.js on init to avoid circular imports
let _analyticsForward = null;
export function registerAnalyticsForward(fn) { _analyticsForward = fn; }

// Named key action (CTA click, form submit attempt, etc.)
export function trackAction(name, meta = {}) {
  const s = getOrCreate();
  if (!s.actions) s.actions = [];
  s.actions.push({ name, at: new Date().toISOString(), page: currentPage(s), ...meta });
  s.lastActivityAt = new Date().toISOString();
  if (s.actions.length > 100) s.actions = s.actions.slice(-100);
  save(s);
  // Forward to behavioural analytics engine (registered by analytics.js on init)
  if (_analyticsForward) try { _analyticsForward(name, meta); } catch {}
}

// Flush session to server
function flush(reason) {
  const s = load();
  if (!s) return;
  const now = new Date().toISOString();
  if (s.pages.length > 0 && !s.pages[s.pages.length - 1].leftAt) {
    s.pages[s.pages.length - 1].leftAt = now;
  }
  s.endedAt    = now;
  s.exitReason = reason;
  s.duration   = Math.round((new Date(now) - new Date(s.startedAt)) / 1000);
  save(s);
  const payload = JSON.stringify(s);
  if (navigator.sendBeacon) {
    navigator.sendBeacon(FLUSH_URL, new Blob([payload], { type: 'application/json' }));
  } else {
    fetch(FLUSH_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload, keepalive: true }).catch(() => {});
  }
}

let _flushTimer   = null;
let _stuckTimer   = null;
let _lastActivity = Date.now();
const STUCK_MS    = 90_000; // 90s without interaction = stuck
const RAGE_WINDOW = 2000;   // rage click: 3+ clicks within 2s on same element
let _clickLog     = [];

function resetStuckTimer() {
  _lastActivity = Date.now();
  clearTimeout(_stuckTimer);
  _stuckTimer = setTimeout(() => {
    addSignal('stuck', { stuckMs: STUCK_MS });
  }, STUCK_MS);
}

function handleClick(e) {
  const target = e.target;
  const tag    = target?.tagName?.toLowerCase() || '';
  const text   = (target?.innerText || target?.value || target?.placeholder || '').slice(0, 40);
  const key    = tag + '::' + text;
  const now    = Date.now();

  // Rage click detection
  _clickLog = _clickLog.filter(c => c.key === key && (now - c.t) < RAGE_WINDOW);
  _clickLog.push({ key, t: now });
  if (_clickLog.length >= 3) {
    addSignal('rage_click', { element: tag, text });
    _clickLog = [];
  }

  resetStuckTimer();
}

export function initSessionTracker() {
  getOrCreate();

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush('tab_hidden');
  });
  window.addEventListener('pagehide',     () => flush('pagehide'));
  window.addEventListener('beforeunload', () => flush('beforeunload'));

  // Rage click + stuck detection
  document.addEventListener('click',     handleClick, { passive: true });
  document.addEventListener('keydown',   resetStuckTimer, { passive: true });
  document.addEventListener('scroll',    resetStuckTimer, { passive: true });
  document.addEventListener('mousemove', resetStuckTimer, { passive: true });
  document.addEventListener('touchstart',resetStuckTimer, { passive: true });
  resetStuckTimer();

  _flushTimer = setInterval(() => { const s = load(); if (s) flush('periodic'); }, FLUSH_INTERVAL_MS);

  return () => {
    clearInterval(_flushTimer);
    clearTimeout(_stuckTimer);
    document.removeEventListener('click', handleClick);
  };
}

export function getSessionId() {
  return getOrCreate().id;
}
