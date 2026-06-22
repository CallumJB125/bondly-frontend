// Bank portal uses its own token slot so it can't accidentally collide with
// a customer/admin session in the same browser. The portal is rendered as a
// completely separate app shell under /bank/*.
import { fmt } from '@bondly/ui/lib/format.js';
import { calcMonthly } from '@bondly/ui/lib/finance.js';

const TOKEN_KEY = 'bondly_bank_token';

export function getBankToken()  { return localStorage.getItem(TOKEN_KEY); }
export function setBankToken(t) { localStorage.setItem(TOKEN_KEY, t); }
export function clearBankToken(){ localStorage.removeItem(TOKEN_KEY); }

export function getDecodedBankToken() {
  const t = getBankToken();
  if (!t) return null;
  try {
    const p = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(p));
  } catch { return null; }
}

async function bankFetch(path, opts = {}) {
  const token = getBankToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...opts.headers,
  };
  const r = await fetch(path, { ...opts, headers });
  if (r.status === 401 && !path.endsWith('/login')) {
    clearBankToken();
    window.location.href = '/bank/login?expired=1';
    // Navigation is async; return a never-resolving promise so downstream
    // .then(d => d.deals) callers don't run against undefined and crash.
    return new Promise(() => {});
  }
  const j = await r.json().catch(() => ({ success: false, error: 'Bad response' }));
  if (!j.success) {
    const err = new Error(j.error || 'Request failed');
    err.status = r.status;
    throw err;
  }
  return j.data;
}

export const bankApi = {
  login:   (email, password) => bankFetch('/api/bank/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
  logout:  ()                => bankFetch('/api/bank/logout', { method: 'POST' }).catch(() => {}),
  me:      ()                => bankFetch('/api/bank/me'),
  dashboard:    ()           => bankFetch('/api/bank/dashboard'),
  applications: (params={})  => {
    const q = new URLSearchParams();
    Object.entries(params).forEach(([k, v]) => { if (v !== undefined && v !== '' && v !== null) q.set(k, v); });
    const qs = q.toString();
    return bankFetch('/api/bank/applications' + (qs ? '?' + qs : ''));
  },
  application: (ref)         => bankFetch('/api/bank/applications/' + encodeURIComponent(ref)),
  submitBid:   (ref, body)   => bankFetch('/api/bank/applications/' + encodeURIComponent(ref) + '/bid', { method: 'POST', body: JSON.stringify(body) }),
  updateBid:   (bidId, body) => bankFetch('/api/bank/bids/' + encodeURIComponent(bidId), { method: 'PATCH', body: JSON.stringify(body) }),
  withdrawBid: (bidId)       => bankFetch('/api/bank/bids/' + encodeURIComponent(bidId), { method: 'DELETE' }),
  bids:        ()            => bankFetch('/api/bank/bids'),

  // Access request + invites
  requestAccess: (body)              => bankFetch('/api/bank/request-access', { method: 'POST', body: JSON.stringify(body) }),
  validateInvite: (token)            => bankFetch('/api/bank/accept-invite/' + encodeURIComponent(token)),
  acceptInvite:   (body)             => bankFetch('/api/bank/accept-invite', { method: 'POST', body: JSON.stringify(body) }),
  teamInvites:    ()                 => bankFetch('/api/bank/invites'),
  inviteColleague:(body)             => bankFetch('/api/bank/invites', { method: 'POST', body: JSON.stringify(body) }),
  cancelInvite:   (token)            => bankFetch('/api/bank/invites/' + encodeURIComponent(token), { method: 'DELETE' }),

  // Won deals + conveyancing
  deals:          ()                       => bankFetch('/api/bank/deals'),
  deal:           (cappId)                 => bankFetch('/api/bank/deals/' + encodeURIComponent(cappId)),
  advanceMilestone:(cappId, stage, note)   => bankFetch('/api/bank/deals/' + encodeURIComponent(cappId) + '/milestone', { method: 'POST', body: JSON.stringify({ stage, note }) }),

  // Auto-bid engine
  autoBidRules:   ()                       => bankFetch('/api/bank/auto-bid-rules'),
  createAutoBidRule: (body)                => bankFetch('/api/bank/auto-bid-rules', { method: 'POST', body: JSON.stringify(body) }),
  updateAutoBidRule: (id, body)            => bankFetch('/api/bank/auto-bid-rules/' + id, { method: 'PATCH', body: JSON.stringify(body) }),
  deleteAutoBidRule: (id)                  => bankFetch('/api/bank/auto-bid-rules/' + id, { method: 'DELETE' }),
  autoBidHistory: ()                       => bankFetch('/api/bank/auto-bid-history'),

  // Analytics
  analytics:      ()                       => bankFetch('/api/bank/analytics'),

  // Rate sheet
  rateSheet:      ()                       => bankFetch('/api/bank/rate-sheet'),
  saveRateSheet:  (body)                   => bankFetch('/api/bank/rate-sheet', { method: 'PUT', body: JSON.stringify(body) }),

  // Deal messaging
  dealMessages:   (cappId)                 => bankFetch('/api/bank/deals/' + encodeURIComponent(cappId) + '/messages'),
  sendDealMessage:(cappId, text)           => bankFetch('/api/bank/deals/' + encodeURIComponent(cappId) + '/messages', { method: 'POST', body: JSON.stringify({ text }) }),

  // Compliance stubs
  pullBureau:     (cappId)                 => bankFetch('/api/bank/deals/' + encodeURIComponent(cappId) + '/bureau-pull', { method: 'POST' }),
  runFica:        (cappId)                 => bankFetch('/api/bank/deals/' + encodeURIComponent(cappId) + '/fica-check', { method: 'POST' }),

  // Bondly Intelligence — geo + sector analysis
  intelligence:   ()                       => bankFetch('/api/bank/intelligence'),

  // Roadmap (SIMULATED) — book-level cross-bank intelligence preview
  roadmapPortfolio: ()                     => bankFetch('/api/bank/roadmap/portfolio'),

  // ML Models — backtest results
  mlModels:       ()                       => bankFetch('/api/bank/ml-models'),

  // Contagion / systemic-risk
  contagionReport: ()                      => bankFetch('/api/intelligence/contagion-report'),
  simulateShock:   (body)                  => bankFetch('/api/intelligence/simulate-shock', { method: 'POST', body: JSON.stringify(body) }),
  saveThresholds:  (body)                  => bankFetch('/api/intelligence/thresholds', { method: 'PUT', body: JSON.stringify(body) }),

  // AI + workbench enhancements
  copilot:        (ref, question)          => bankFetch('/api/bank/applications/' + encodeURIComponent(ref) + '/copilot', { method: 'POST', body: JSON.stringify({ question }) }),
  extractDoc:     (ref, file, hint)        => {
    const tok = getBankToken();
    const fd = new FormData(); fd.append('file', file); fd.append('hint', hint || '');
    return fetch('/api/bank/applications/' + encodeURIComponent(ref) + '/extract-doc', {
      method: 'POST', headers: tok ? { Authorization: 'Bearer ' + tok } : {}, body: fd,
    }).then(r => r.json()).then(j => { if (!j.success) throw new Error(j.error); return j.data; });
  },
  coach:          (ref)                    => bankFetch('/api/bank/applications/' + encodeURIComponent(ref) + '/coach'),
  comparables:    (ref)                    => bankFetch('/api/bank/applications/' + encodeURIComponent(ref) + '/comparables'),
  standup:        ()                       => bankFetch('/api/bank/standup'),
  pipelineForecast:()                      => bankFetch('/api/bank/pipeline-forecast'),
  postMortem:     (bidId)                  => bankFetch('/api/bank/bids/' + encodeURIComponent(bidId) + '/post-mortem'),
  messageTemplates:(cappId)                => bankFetch('/api/bank/deals/' + encodeURIComponent(cappId) + '/templates'),
  updateProfile:  (body)                   => bankFetch('/api/bank/profile', { method: 'PATCH', body: JSON.stringify(body) }),
  openEventSource: async () => {
    const tok = getBankToken();
    if (!tok) return null;
    try {
      const data = await bankFetch('/api/bank/sse-ticket', { method: 'POST' });
      return new EventSource('/api/bank/events?ticket=' + encodeURIComponent(data.ticket));
    } catch {
      return null; // no ?token= fallback — never put the bank JWT in a URL
    }
  },
  followUpIcsPath: (cappId, days = 7)      => '/api/bank/deals/' + encodeURIComponent(cappId) + '/follow-up.ics?days=' + days,
  // Header-auth blob download — token goes in the Authorization header, never the
  // URL, so it can't leak into access logs / history / Referer.
  download: async (path, filename) => {
    const tok = getBankToken();
    const r = await fetch(path, { headers: tok ? { Authorization: 'Bearer ' + tok } : {} });
    if (r.status === 401) { clearBankToken(); window.location.href = '/bank/login?expired=1'; return new Promise(() => {}); }
    if (!r.ok) throw new Error('Download failed (' + r.status + ')');
    const url = URL.createObjectURL(await r.blob());
    const a = document.createElement('a');
    a.href = url; a.download = filename || ''; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10000);
  },

  // Wave 3 (simulator, planner, triage, explainers)
  simulateRule:   (body)                   => bankFetch('/api/bank/auto-bid-rules/simulate', { method: 'POST', body: JSON.stringify(body) }),
  targetPlanner:  (target)                 => bankFetch('/api/bank/target-planner?target=' + Number(target)),
  triage:         ()                       => bankFetch('/api/bank/triage'),
  explainCompetitorBid: (ref, body)        => bankFetch('/api/bank/applications/' + encodeURIComponent(ref) + '/explain-competitor-bid', { method: 'POST', body: JSON.stringify(body) }),
  structuringTips:(ref)                    => bankFetch('/api/bank/applications/' + encodeURIComponent(ref) + '/structuring-tips'),

  // Wave 4
  smartReplies:   (cappId)                 => bankFetch('/api/bank/deals/' + encodeURIComponent(cappId) + '/messages/suggested-replies'),
  suggestedRules: ()                       => bankFetch('/api/bank/auto-bid-rules/suggested'),
  draftNudge:     (cappId)                 => bankFetch('/api/bank/deals/' + encodeURIComponent(cappId) + '/draft-nudge'),
  npsScores:      ()                       => bankFetch('/api/bank/nps'),
};

export function bankFmtR(n) {
  if (n == null || !isFinite(n)) return '—';
  return fmt(n);
}
export function bankFmtPct(n) {
  if (n == null || !isFinite(n)) return '—';
  return (Math.round(n * 100) / 100).toFixed(2) + '%';
}

export function monthlyFromRate(balance, ratePct, termMonths = 240) {
  if (!balance || !ratePct || !termMonths) return 0;
  return Math.round(calcMonthly(balance, ratePct, termMonths / 12));
}

export function timeUntil(iso) {
  if (!iso) return '—';
  const ms = new Date(iso).getTime() - Date.now();
  if (ms <= 0) return 'closed';
  const days  = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  if (days >= 1) return `${days}d ${hours}h`;
  const mins = Math.floor((ms % 3600000) / 60000);
  return `${hours}h ${mins}m`;
}
