// Bondly Analytics — lightweight behavioural event collector
// Privacy-safe: PII/financial data masked before any transmission.
// Extends session.js (borrows session ID) — does NOT replace it.

import { getSessionId, registerAnalyticsForward } from './session.js';

const INGEST_URL    = '/api/analytics/events';
const SESSION_URL   = '/api/analytics/session';
const ANON_KEY      = 'bly_anon_id';
const REPLAY_KEY    = 'bly_replay';
const BATCH_INTERVAL_MS  = 5_000;
const MAX_BATCH          = 20;
const REPLAY_MAX_FRAMES  = 800;
const RAGE_CLICK_COUNT   = 3;
const RAGE_CLICK_WIN_MS  = 800;
const INACTIVITY_MS      = 30_000;

// ── PII / financial masking ───────────────────────────────────────────────────
const MASK_RULES = [
  [/R\s?[\d\s,.]+/g,                                   '[AMOUNT]'],
  [/[a-zA-Z0-9._%+\-]+@[a-zA-Z0-9.\-]+\.[a-zA-Z]{2,}/g, '[EMAIL]'],
  [/\b27\d{9}\b|\b0[6-8]\d{8}\b/g,                    '[PHONE]'],
  [/\b\d{13}\b/g,                                      '[ID]'],
];
function mask(s) {
  if (typeof s !== 'string') return s;
  let v = s;
  for (const [re, sub] of MASK_RULES) v = v.replace(re, sub);
  return v.slice(0, 300);
}
function maskObj(o) {
  if (!o || typeof o !== 'object') return o;
  const out = {};
  for (const [k, v] of Object.entries(o)) out[k] = typeof v === 'string' ? mask(v) : v;
  return out;
}

// Elements that must never be tracked
const MASK_SELECTORS = ['[data-pii]', '[data-financial]', '[type=password]', '.finances-tab'];
function shouldMask(el) {
  try { return MASK_SELECTORS.some(s => el.closest(s)); } catch { return false; }
}

// ── Element fingerprint (tagName#id.classes, ≤60 chars) ──────────────────────
// A-M6: do NOT include innerText/value — they may contain PII (names, amounts, IDs).
// Use only structural identifiers: tag, id, classes, aria-label (truncated).
function fingerprint(el) {
  if (!el || el === document.body) return 'body';
  const tag   = el.tagName?.toLowerCase() || '';
  const id    = el.id ? `#${el.id}` : '';
  const cls   = [...(el.classList || [])].slice(0, 3).map(c => `.${c}`).join('');
  const aria  = (el.getAttribute?.('aria-label') || '').slice(0, 20);
  return `${tag}${id}${cls}${aria ? '[' + aria + ']' : ''}`.slice(0, 60);
}

// ── Anonymous ID (persists across sessions for funnel correlation) ────────────
function getAnonId() {
  try {
    let id = localStorage.getItem(ANON_KEY);
    if (!id) { id = 'anon_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7); localStorage.setItem(ANON_KEY, id); }
    return id;
  } catch { return 'anon_unknown'; }
}

// ── Module state ──────────────────────────────────────────────────────────────
let _userId   = null;
let _seq      = 0;
let _batch    = [];
let _batchTimer = null;
let _inactivityTimer = null;
let _rageMap  = {};           // target fingerprint → [{t}]
let _lastPage = '';
let _scrollMilestones = new Set();
let _pendingClick = null;     // for dead-click detection
let _initialized = false;

// ── Core track function ───────────────────────────────────────────────────────
export { track as trackAction };  // alias — feature components can import either name
export function track(type, meta = {}) {
  try {
    // Cancel pending dead-click on any meaningful follow-up event
    if (_pendingClick && type !== 'click' && type !== 'dead_click' && type !== 'rage_click') {
      _pendingClick = null;
    }
    _batch.push({
      seq:  _seq++,
      ts:   new Date().toISOString(),
      type,
      page: window.location.pathname,
      meta: maskObj(meta),
    });
    captureReplayFrame(type, meta);
    if (_batch.length >= MAX_BATCH) flushBatch();
  } catch {}
}

export function trackPageView(page) {
  _scrollMilestones = new Set(); // reset scroll depth tracking per page
  _lastPage = page;
  track('page_view', { page });
}

export function trackFeature(feature) {
  track('feature_used', { feature });
}

export function identify(userId) {
  _userId = userId;
  // Ship a minimal session update linking this session to the user
  const sid = getSessionId();
  if (sid && userId) {
    fetch(SESSION_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ id: sid, userId, anonId: getAnonId() }),
    }).catch(() => {});
  }
}

// A-C2: record a conversion for an experiment after a success event.
// Call this after any conversion action (e.g. form submit, purchase).
export async function recordConversion(experimentId) {
  try {
    const anonId = getAnonId();
    await fetch(`/api/analytics/experiment/${experimentId}/convert`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...authHeader() },
      body: JSON.stringify({ anonId }),
    });
    track('experiment_expose', { experimentId, event: 'converted' });
  } catch {}
}

export async function getVariant(experimentId) {
  const cacheKey = 'bly_exp_' + experimentId;
  try {
    const cached = localStorage.getItem(cacheKey);
    if (cached) return cached;
    const anonId = getAnonId();
    const r = await fetch(`/api/analytics/experiment/${experimentId}/variant?anonId=${anonId}`,
      { headers: authHeader() });
    if (!r.ok) return null;
    const j = await r.json();
    const variant = j.data?.variant || j.variant || null;
    if (variant) {
      localStorage.setItem(cacheKey, variant);
      track('experiment_expose', { experimentId, variant });
    }
    return variant;
  } catch { return null; }
}

// ── Auth header helper ────────────────────────────────────────────────────────
function authHeader() {
  try {
    const t = localStorage.getItem('bondly_token');
    return t ? { Authorization: 'Bearer ' + t } : {};
  } catch { return {}; }
}

// ── Batch flush ───────────────────────────────────────────────────────────────
function flushBatch(reason) {
  if (_batch.length === 0) return;
  const events  = _batch.splice(0, _batch.length);
  const payload = JSON.stringify({
    sessionId: getSessionId(),
    anonId:    getAnonId(),
    userId:    _userId,
    events,
  });
  if (reason === 'unload' && navigator.sendBeacon) {
    navigator.sendBeacon(INGEST_URL, new Blob([payload], { type: 'application/json' }));
  } else {
    fetch(INGEST_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: payload,
    }).catch(() => { _batch.unshift(...events.slice(0, 40 - _batch.length)); });
  }
}

// ── Replay frame capture ──────────────────────────────────────────────────────
const REPLAY_EVENT_TYPES = new Set(['click', 'rage_click', 'dead_click', 'scroll_depth', 'mousemove']);
function captureReplayFrame(type, meta) {
  if (!REPLAY_EVENT_TYPES.has(type)) return;
  try {
    const store  = JSON.parse(sessionStorage.getItem(REPLAY_KEY) || '[]');
    const frame  = {
      ts:  new Date().toISOString(), type,
      x:   meta.x, y: meta.y, vw: meta.vw, vh: meta.vh,
      scrollPct: meta.scrollPct,
      target: meta.target,
      page: window.location.pathname,
    };
    store.push(frame);
    if (store.length > REPLAY_MAX_FRAMES) store.splice(0, store.length - REPLAY_MAX_FRAMES);
    sessionStorage.setItem(REPLAY_KEY, JSON.stringify(store));
  } catch {}
}

// ── Mouse movement (throttled) — resets inactivity + captures replay frame ────
let _mouseMoveThrottle = 0;
function handleMouseMove(e) {
  resetInactivityTimer();
  const now = Date.now();
  if (now - _mouseMoveThrottle < 200) return; // ~5 fps for replay
  _mouseMoveThrottle = now;
  captureReplayFrame('mousemove', {
    x: e.clientX, y: e.clientY,
    vw: window.innerWidth, vh: window.innerHeight,
  });
}

function flushReplay(reason) {
  try {
    const frames = JSON.parse(sessionStorage.getItem(REPLAY_KEY) || '[]');
    if (frames.length === 0) return;
    sessionStorage.removeItem(REPLAY_KEY);
    const payload = JSON.stringify({
      sessionId: getSessionId(),
      anonId:    getAnonId(),
      userId:    _userId,
      events:    [{ seq: _seq++, ts: new Date().toISOString(), type: 'replay_batch',
                    page: window.location.pathname, meta: { frames } }],
    });
    if (reason === 'unload' && navigator.sendBeacon) {
      navigator.sendBeacon(INGEST_URL, new Blob([payload], { type: 'application/json' }));
    } else {
      fetch(INGEST_URL, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload }).catch(() => {});
    }
  } catch {}
}

// ── Keydown handler ───────────────────────────────────────────────────────────
function handleKeydown(e) {
  resetInactivityTimer();
  // Printable character typed = user engaged with what they clicked — not a dead click
  if (e.key.length === 1) _pendingClick = null;
}

// ── Inactivity timer ──────────────────────────────────────────────────────────
function resetInactivityTimer() {
  clearTimeout(_inactivityTimer);
  _inactivityTimer = setTimeout(() => {
    track('inactivity', { durationMs: INACTIVITY_MS, page: window.location.pathname });
  }, INACTIVITY_MS);
}

// ── Click handler ─────────────────────────────────────────────────────────────
function handleClick(e) {
  resetInactivityTimer();
  const el = e.target;
  if (!el || shouldMask(el)) return;

  const fp  = fingerprint(el);
  const now = Date.now();
  const vw  = window.innerWidth;
  const vh  = window.innerHeight;

  // Rage click detection
  if (!_rageMap[fp]) _rageMap[fp] = [];
  _rageMap[fp] = _rageMap[fp].filter(t => (now - t) < RAGE_CLICK_WIN_MS);
  _rageMap[fp].push(now);
  if (_rageMap[fp].length >= RAGE_CLICK_COUNT) {
    track('rage_click', { target: fp, count: _rageMap[fp].length, x: e.clientX, y: e.clientY, vw, vh });
    _rageMap[fp] = [];
    return;
  }

  // Dead click detection — A-H4: skip intentional non-nav interactive elements.
  // Inputs, buttons with type=submit/button/reset, selects, textareas, and anchors with href
  // are intentional — don't flag as dead clicks.
  const isInteractive = (
    ['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName) ||
    (el.tagName === 'BUTTON' && ['submit', 'button', 'reset'].includes((el.type || '').toLowerCase())) ||
    (el.tagName === 'A' && el.getAttribute('href')) ||
    el.getAttribute?.('role') === 'button' ||
    el.getAttribute?.('role') === 'menuitem' ||
    el.getAttribute?.('role') === 'tab'
  );
  if (!isInteractive) {
    _pendingClick = { fp, ts: now };
    setTimeout(() => {
      if (_pendingClick && _pendingClick.fp === fp) {
        // No meaningful follow-up event — dead click
        track('dead_click', { target: fp, x: e.clientX, y: e.clientY, vw, vh });
      }
      _pendingClick = null;
    }, 500);
  }

  // Regular click
  track('click', {
    target: fp,
    x: e.clientX, y: e.clientY, vw, vh,
    feature: el.dataset?.feature || el.closest('[data-feature]')?.dataset?.feature || null,
  });
}

// ── Scroll depth ──────────────────────────────────────────────────────────────
let _scrollThrottle = 0;
function handleScroll() {
  resetInactivityTimer();
  const now = Date.now();
  if (now - _scrollThrottle < 500) return;
  _scrollThrottle = now;
  const scrolled = window.scrollY + window.innerHeight;
  const total    = document.documentElement.scrollHeight;
  if (total < 200) return;
  const pct = Math.min(100, Math.round((scrolled / total) * 100));
  for (const milestone of [25, 50, 75, 100]) {
    if (pct >= milestone && !_scrollMilestones.has(milestone)) {
      _scrollMilestones.add(milestone);
      track('scroll_depth', { scrollPct: milestone, page: window.location.pathname });
    }
  }
}

// ── Form field tracking ───────────────────────────────────────────────────────
// A-H4: _formState tracks which forms have pending fields.
//        clearFormState(formName) must be called on successful submit to prevent abandon.
//        detectFormAbandons() only fires on route/page leave — not on every blur.
const _formState = {};   // formName → { fields: Set, page, submitted: bool }

export function clearFormState(formName) {
  // Call this on successful form submit to prevent a false abandon event.
  if (formName) {
    delete _formState[formName];
  } else {
    // Clear all forms (e.g. on navigation to new route)
    for (const k of Object.keys(_formState)) delete _formState[k];
  }
}

function handleFormBlur(e) {
  const el = e.target;
  if (!el || !['INPUT', 'SELECT', 'TEXTAREA'].includes(el.tagName)) return;
  if (shouldMask(el)) return; // Never track financial/PII fields
  const formName = el.form?.name || el.form?.id || el.closest('form')?.id || 'unknown';
  if (!_formState[formName]) _formState[formName] = { fields: new Set(), page: window.location.pathname, submitted: false };
  _formState[formName].fields.add(el.name || el.id || el.placeholder?.slice(0, 20) || 'field');
  track('form_field', { formName, field: el.name || el.id || 'field', page: window.location.pathname });
}

function handleFormSubmit(e) {
  // Mark the form as successfully submitted so detectFormAbandons skips it.
  const form = e.target;
  if (!form) return;
  const formName = form.name || form.id || 'unknown';
  if (_formState[formName]) _formState[formName].submitted = true;
}

function detectFormAbandons() {
  // Only fire for forms that have fields entered but were NOT submitted.
  for (const [formName, state] of Object.entries(_formState)) {
    if (state.fields.size > 0 && !state.submitted) {
      track('form_abandon', {
        formName,
        fieldsEntered: state.fields.size,
        page: state.page,
      });
    }
  }
  // Clear state after reporting — prevents double-fire on visibilitychange + pagehide
  for (const k of Object.keys(_formState)) delete _formState[k];
}

// ── API performance monkey-patch ──────────────────────────────────────────────
function patchFetch() {
  try {
    const _origFetch = window.fetch;
    window.fetch = function(input, init) {
      const url = typeof input === 'string' ? input : input?.url || '';
      if (!url.startsWith('/api/')) return _origFetch.call(this, input, init);
      const start = performance.now();
      return _origFetch.call(this, input, init).then(res => {
        const ms = Math.round(performance.now() - start);
        if (ms > 200) { // only track notable calls
          track('api_perf', {
            endpoint: url.replace(/\/[0-9a-f\-]{8,}/g, '/:id').slice(0, 80),
            durationMs: ms,
            status: res.status,
          });
        }
        return res;
      }).catch(err => {
        track('api_perf', { endpoint: url.slice(0, 80), durationMs: Math.round(performance.now() - start), status: 0 });
        throw err;
      });
    };
  } catch {}
}

// ── Intervention polling ──────────────────────────────────────────────────────
let _interventionTimer = null;
function startInterventionPolling() {
  _interventionTimer = setInterval(async () => {
    if (!_userId) return;
    try {
      const r = await fetch('/api/analytics/interventions', { headers: authHeader() });
      if (!r.ok) return;
      const j = await r.json();
      const nudges = j.data || j || [];
      if (nudges.length > 0) {
        document.dispatchEvent(new CustomEvent('bondly:intervention', { detail: nudges[0] }));
      }
    } catch {}
  }, 30_000);
}

// ── Init ──────────────────────────────────────────────────────────────────────
export function initAnalytics() {
  if (_initialized) return () => {};
  // Respect analytics opt-out preference
  try { if (localStorage.getItem('bly_analytics_opt_out') === '1') return () => {}; } catch {}
  _initialized = true;

  // Bridge: all session.js trackAction() calls now also flow into the analytics engine
  registerAnalyticsForward(track);

  // Send session start
  const sid = getSessionId();
  fetch(SESSION_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      id:        sid,
      anonId:    getAnonId(),
      startedAt: new Date().toISOString(),
      userAgent: navigator.userAgent,
      screenW:   screen.width,
      screenH:   screen.height,
      entryPage: window.location.pathname,
    }),
  }).catch(() => {});

  patchFetch();

  // Event listeners
  document.addEventListener('click',     handleClick,     { passive: true });
  document.addEventListener('scroll',    handleScroll,    { passive: true });
  document.addEventListener('keydown',   handleKeydown,   { passive: true });
  document.addEventListener('mousemove', handleMouseMove, { passive: true });
  document.addEventListener('focusout',  handleFormBlur,  { passive: true });
  document.addEventListener('submit',    handleFormSubmit, { passive: true });

  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') {
      detectFormAbandons();
      flushBatch('unload');
      flushReplay('unload');
    }
  });
  window.addEventListener('pagehide', () => {
    detectFormAbandons();
    flushBatch('unload');
    flushReplay('unload');
  });

  resetInactivityTimer();
  _batchTimer = setInterval(() => flushBatch(), BATCH_INTERVAL_MS);
  startInterventionPolling();

  return () => {
    clearInterval(_batchTimer);
    clearInterval(_interventionTimer);
    clearTimeout(_inactivityTimer);
    document.removeEventListener('click', handleClick);
    document.removeEventListener('scroll', handleScroll);
    document.removeEventListener('keydown', handleKeydown);
    document.removeEventListener('mousemove', handleMouseMove);
    document.removeEventListener('focusout', handleFormBlur);
    document.removeEventListener('submit', handleFormSubmit);
    _initialized = false;
  };
}
