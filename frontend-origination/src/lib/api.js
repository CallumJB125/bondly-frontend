import { trackApiError } from '@bondly/ui/lib/errors.js';
// ── API client ────────────────────────────────────────────

function getToken() {
  return localStorage.getItem('bondly_token');
}

export function setToken(t) {
  localStorage.setItem('bondly_token', t);
}

export function clearToken() {
  localStorage.removeItem('bondly_token');
}

export function isLoggedIn() {
  return !!getToken();
}

// C-4: Decode token payload for display purposes only — NOT for authorization.
// The signature is not verified here (impossible client-side without the secret).
// Admin status MUST be validated server-side on every request via adminAuth middleware.
export function getDecodedToken() {
  const t = getToken();
  if (!t) return null;
  try {
    const payload = t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(payload));
  } catch {
    return null;
  }
}

// isAdmin() is retained only for UI display hints (showing/hiding nav items).
// Every actual admin API call is protected by server-side adminAuth middleware.
// Do NOT use this function to gate access to sensitive data or operations.
export function isAdmin() {
  return getDecodedToken()?.role === 'admin';
}

async function apiFetch(path, opts = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: 'Bearer ' + token } : {}),
    ...opts.headers,
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 30000);

  let res;
  try {
    res = await fetch(path, { ...opts, headers, signal: controller.signal });
  } catch (networkErr) {
    if (networkErr.name === 'AbortError') {
      throw new Error('Request timed out. Please try again.');
    }
    // Only log network failures on non-beacon endpoints (beacon is fire-and-forget)
    if (!path.includes('/beacon') && !path.includes('/errors/log')) {
      trackApiError(opts.method || 'GET', path, 0, networkErr.message);
    }
    throw networkErr;
  } finally {
    clearTimeout(timeoutId);
  }

  // Session expired — only redirect on non-auth endpoints (401 on auth = wrong credentials)
  if (res.status === 401 && !path.includes('/api/auth/')) {
    clearToken();
    window.location.href = '/login?expired=1';
    return;
  }

  // User account deleted — only redirect when checking own profile, not on arbitrary 404s
  if (res.status === 404 && path === '/api/auth/me') {
    const preview = await res.clone().json().catch(() => ({}));
    if (preview?.error === 'User not found') {
      clearToken();
      window.location.href = '/login?expired=1';
      return;
    }
  }

  // Rate limited — show a clear message instead of a JSON parse failure
  if (res.status === 429) {
    const err = new Error('Too many attempts — please wait 15 minutes before trying again.');
    err.status = 429;
    trackApiError(opts.method || 'GET', path, 429, 'rate limited');
    throw err;
  }

  const j = await res.json();

  if (!j.success) {
    const err = new Error(j.error || 'Request failed');
    err.status = res.status;
    if (res.status >= 500) trackApiError(opts.method || 'GET', path, res.status, j.error);
    throw err;
  }
  return j.data;
}

// ── Intelligence (sector + geographic heatmaps) ───────────
export const intelligence = {
  heatmaps: () => apiFetch('/api/intelligence/heatmaps'),
  modelHealth: () => apiFetch('/api/intelligence/model-health'),
};

// ── Auth ──────────────────────────────────────────────────
export const auth = {
  login:       (email, password) => apiFetch('/api/auth/login',    { method: 'POST', body: JSON.stringify({ email, password }) }),
  register:    (name, email, password, referralCode, anonSessionId) => apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, ...(referralCode ? { referralCode } : {}), ...(anonSessionId ? { anonSessionId } : {}) }) }),
  me:          () => apiFetch('/api/auth/me'),
  verify:      (token) => apiFetch('/api/auth/verify?token=' + token),
  forgotPw:    (email) => apiFetch('/api/auth/forgot-password',    { method: 'POST', body: JSON.stringify({ email }) }),
  resetPw:     (token, password) => apiFetch('/api/auth/reset-password', { method: 'POST', body: JSON.stringify({ token, password }) }),
  magicLink:   (email) => apiFetch('/api/auth/magic-link',         { method: 'POST', body: JSON.stringify({ email }) }),
  magicVerify:        (token) => apiFetch('/api/auth/magic-verify',          { method: 'POST', body: JSON.stringify({ token }) }),
  verifyEmail:        (otp)   => apiFetch('/api/auth/verify-email',           { method: 'POST', body: JSON.stringify({ otp }) }),
  resendVerification: ()      => apiFetch('/api/auth/resend-verification',    { method: 'POST' }),
  deleteAccount: () => apiFetch('/api/user', { method: 'DELETE' }),
  logout:        () => apiFetch('/api/auth/logout', { method: 'POST' }),
  refresh:       () => apiFetch('/api/auth/refresh', { method: 'POST' }),
  exportData:    () => fetch('/api/user/export', { headers: { Authorization: 'Bearer ' + localStorage.getItem('bondly_token') } }).then(r => r.blob()),
};

// ── Loans / Bonds ─────────────────────────────────────────
export const loans = {
  list:      ()          => apiFetch('/api/loans'),
  create:    (data)      => apiFetch('/api/loans',                   { method: 'POST',   body: JSON.stringify(data) }),
  update:    (id, data)  => apiFetch('/api/loans/' + id,             { method: 'PUT',    body: JSON.stringify(data) }),
  remove:    (id)        => apiFetch('/api/loans/' + id,             { method: 'DELETE' }),
  sync:      (id, data)  => apiFetch('/api/loans/' + id + '/sync',   { method: 'POST',   body: JSON.stringify(data) }),
  readiness: (id)        => apiFetch('/api/loans/' + id + '/readiness'),
};

// ── Document vault ────────────────────────────────────────
export const documents = {
  list:   (category) => apiFetch('/api/documents' + (category ? '?category=' + category : '')),
  remove: (id)       => apiFetch('/api/documents/' + id, { method: 'DELETE' }),
  upload: (file, category, label) => {
    const token = localStorage.getItem('bondly_token');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('category', category);
    if (label) fd.append('label', label);
    return fetch('/api/documents', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: fd,
    }).then(r => r.json()).then(j => { if (!j.success) throw new Error(j.error); return j.data; });
  },
};

// ── Payments ──────────────────────────────────────────────
export const payments = {
  list:   ()     => apiFetch('/api/payments'),
  log:    (data) => apiFetch('/api/payments',        { method: 'POST',   body: JSON.stringify(data) }),
  remove: (id)   => apiFetch('/api/payments/' + id,  { method: 'DELETE' }),
};

// ── Profile ───────────────────────────────────────────────
export const profile = {
  get:                 ()     => apiFetch('/api/profile'),
  update:              (data) => apiFetch('/api/profile',               { method: 'PUT', body: JSON.stringify(data) }),
  updateFinancial:     (data) => apiFetch('/api/profile/financial',     { method: 'PUT', body: JSON.stringify(data) }),
  updateNotifications: (data) => apiFetch('/api/profile/notifications', { method: 'PUT', body: JSON.stringify(data) }),
};

// ── Applications (swap + pre-approval) ───────────────────
export const applications = {
  list:   ()     => apiFetch('/api/applications'),
  create: (data) => apiFetch('/api/applications',    { method: 'POST',   body: JSON.stringify(data) }),
  updateStatus: (id, status, note) => apiFetch('/api/applications/' + id + '/status', {
    method: 'PUT',
    body: JSON.stringify({ status, note }),
  }),
};

// ── Swap applications ─────────────────────────────────────
export const swaps = {
  list:        ()        => apiFetch('/api/swap-applications'),
  create:      (data)    => apiFetch('/api/swap-applications', { method: 'POST', body: JSON.stringify(data) }),
  attachVault: (id, documentId) => apiFetch(`/api/swaps/${id}/attach-vault`, { method: 'POST', body: JSON.stringify({ documentId }) }),
  addBank:     (id, bank) => apiFetch(`/api/swap-applications/${id}/add-bank`, { method: 'POST', body: JSON.stringify({ bank }) }),
  submitForReview: (id) => apiFetch(`/api/swaps/${id}/submit`, { method: 'POST' }),
  deleteDoc:   (id, docIdx) => apiFetch(`/api/swaps/${id}/documents/${docIdx}`, { method: 'DELETE' }),
  acceptOffer: (id, offerId) => apiFetch(`/api/swap-applications/${id}/offers/${offerId}/accept`, { method: 'PUT' }),
  declineOffer:(id, offerId) => apiFetch(`/api/swap-applications/${id}/offers/${offerId}/decline`, { method: 'PUT' }),
  uploadDoc: (id, formData) => {
    const token = getToken();
    return fetch('/api/swap-applications/' + id + '/document', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: formData,
    }).then(r => r.json()).then(j => {
      if (!j.success) throw new Error(j.error);
      return j.data;
    });
  },
};


// ── Alerts ────────────────────────────────────────────────
export const alerts = {
  getRateTarget:       ()        => apiFetch('/api/alerts/rate-target'),
  setRateTarget:       (data)    => apiFetch('/api/alerts/rate-target',       { method: 'POST',   body: JSON.stringify(data) }),
  deleteRateTarget:    ()        => apiFetch('/api/alerts/rate-target',       { method: 'DELETE' }),
  getSavingsThreshold:    ()                  => apiFetch('/api/alerts/savings-threshold'),
  setSavingsThreshold:    (amount, phone, note) => apiFetch('/api/alerts/savings-threshold', { method: 'POST', body: JSON.stringify({ monthlyThreshold: amount, phone, note }) }),
  deleteSavingsThreshold: ()                  => apiFetch('/api/alerts/savings-threshold', { method: 'DELETE' }),
};

// ── Notifications ─────────────────────────────────────────
export const notifications = {
  list: () => apiFetch('/api/notifications').then(d => Array.isArray(d) ? d : (d?.notifications || [])),
  markRead: (id) => apiFetch('/api/notifications/mark-read', { method: 'POST', body: JSON.stringify({ ids: [id] }) }),
  markAllRead: () => apiFetch('/api/notifications/mark-read', { method: 'POST', body: JSON.stringify({}) }),
};

// ── KYC / Identity verification ──────────────────────────
export const kyc = {
  status: () => apiFetch('/api/kyc/status'),
  submit: (formData) => {
    const token = getToken();
    return fetch('/api/kyc/submit', {
      method: 'POST',
      headers: token ? { Authorization: 'Bearer ' + token } : {},
      body: formData,
    }).then(r => r.json()).then(j => { if (!j.success) throw new Error(j.error); return j.data; });
  },
};

// ── Risk score ────────────────────────────────────────────
export const risk = {
  get:     () => apiFetch('/api/risk-score'),
  history: () => apiFetch('/api/risk-score/history'),
};

// ── Calculators ───────────────────────────────────────────
export const calc = {
  swap:         (data) => apiFetch('/api/calc/swap',         { method: 'POST', body: JSON.stringify(data) }),
  repayment:    (data) => apiFetch('/api/calc/repayment',    { method: 'POST', body: JSON.stringify(data) }),
  affordability:(data) => apiFetch('/api/calc/affordability',{ method: 'POST', body: JSON.stringify(data) }),
  rateImpact:   (data) => apiFetch('/api/calc/rate-impact',  { method: 'POST', body: JSON.stringify(data) }),
  transferDuty: (data) => apiFetch('/api/calc/transfer-duty',{ method: 'POST', body: JSON.stringify(data) }),
};

// ── Bank offers ───────────────────────────────────────────
export const bankOffers = {
  list: () => apiFetch('/api/bank-offers'),
};

// ── Prime rate ────────────────────────────────────────────
export const primeRate = {
  get:     () => apiFetch('/api/settings/prime-rate'),
  history: () => apiFetch('/api/settings/prime-rate-history'),
};

// ── Referrals ─────────────────────────────────────────────
export const referrals = {
  get:    ()     => apiFetch('/api/referrals'),
  invite: (email) => apiFetch('/api/referrals/invite', { method: 'POST', body: JSON.stringify({ email }) }),
};

// ── Leads ─────────────────────────────────────────────────
export const leads = {
  submit: (data) => fetch('/api/leads', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),
};

export const publicAlerts = {
  subscribeRateAlert: (data) => fetch('/api/rate-alerts/subscribe', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(data),
  }).then(r => r.json()),
};

export const publicStats = {
  marketStats: () => fetch('/api/public/market-stats').then(r => r.json()).then(j => j.data ?? j),
};

// ── Financial Fitness — spending snapshots + goals ────────────────────────────
export const financialFitness = {
  getSnapshots: () => apiFetch('/api/financial-fitness/snapshots'),
  saveSnapshot: (analysis) => apiFetch('/api/financial-fitness/save-snapshot', {
    method: 'POST',
    body: JSON.stringify(analysis),
  }),
  getGoals: () => apiFetch('/api/financial-fitness/goals'),
  saveGoal: (targetBond, targetDate) => apiFetch('/api/financial-fitness/goals', {
    method: 'POST',
    body: JSON.stringify({ targetBond, targetDate }),
  }),
  deleteGoal: () => apiFetch('/api/financial-fitness/goals', { method: 'DELETE' }),
  getProgress:    () => apiFetch('/api/financial-fitness/progress'),
  getCommitments: () => apiFetch('/api/financial-fitness/commitments'),
  saveCommitments: (commitments, snapshotId) => apiFetch('/api/financial-fitness/commitments', {
    method: 'POST', body: JSON.stringify({ commitments, snapshotId }),
  }),
  getCoachNote: (snapshotId) => apiFetch('/api/financial-fitness/coach-note', {
    method: 'POST', body: JSON.stringify({ snapshotId }),
  }),
  rateAccuracy: (snapshotId, rating) => apiFetch('/api/financial-fitness/rate-accuracy', {
    method: 'POST', body: JSON.stringify({ snapshotId, rating }),
  }),
};

export const adminApi = {
  auditSnapshot: (snapshotId) => apiFetch('/api/admin/audit-snapshot/' + snapshotId, { method: 'POST' }),
};

// ── Async parse job poller — polls /api/qualify/job/:id until done/failed/timeout ─
export async function pollParseJob(jobId, { onProgress } = {}) {
  const deadline = Date.now() + 8 * 60 * 1000; // 8-minute max (OCR + AI can take 3-4 min)
  let consecutiveNetworkErrors = 0;
  let pollCount = 0;
  let wakeResolve = null;

  // iOS Safari suspends JS timers when the tab is backgrounded. When the user
  // returns, visibilitychange fires synchronously — we use it to abort the
  // current sleep early and poll immediately, rather than waiting up to 3s more.
  function onVisibilityChange() {
    if (document.visibilityState === 'visible' && wakeResolve) {
      wakeResolve();
      wakeResolve = null;
    }
  }
  document.addEventListener('visibilitychange', onVisibilityChange);

  function sleep(ms) {
    return new Promise(r => {
      const timer = setTimeout(r, ms);
      wakeResolve = () => { clearTimeout(timer); r(); };
    });
  }

  try {
    while (Date.now() < deadline) {
      // First two polls: 1s apart (catches cache hits and fast parses immediately).
      // After that: 3s apart to avoid hammering the server.
      await sleep(pollCount < 2 ? 1000 : 3000);
      pollCount++;
      try {
        const r = await fetch('/api/qualify/job/' + jobId);
        const j = await r.json();
        consecutiveNetworkErrors = 0;
        if (!j.success) throw new Error(j.error || 'Analysis failed');
        if (j.data.status === 'done')   return j.data.result;
        if (j.data.status === 'failed') throw new Error(j.data.error || 'Statement analysis failed — please try again');
        // status === 'processing' — surface progress message and keep polling
        if (j.data.progress && onProgress) onProgress(j.data.progress);
      } catch (e) {
        // Re-throw errors that came from the server (not from fetch itself)
        if (e.message && !e.message.startsWith('Failed to fetch') && !e.message.startsWith('NetworkError') && !e.message.startsWith('Load failed')) throw e;
        consecutiveNetworkErrors++;
        if (consecutiveNetworkErrors >= 3) throw new Error('Connection lost during analysis — please try again');
        // Silently retry on transient network blips
      }
    }
    // Rescue poll: if iOS suspended JS long enough that Date.now() jumped past the
    // deadline, the job may have finished during that pause — check once before giving up.
    try {
      const r = await fetch('/api/qualify/job/' + jobId);
      const j = await r.json();
      if (j?.success && j.data?.status === 'done')   return j.data.result;
      if (j?.success && j.data?.status === 'failed') throw new Error(j.data.error || 'Statement analysis failed — please try again');
    } catch (e) {
      if (e.message && !e.message.startsWith('Failed to fetch') && !e.message.startsWith('NetworkError') && !e.message.startsWith('Load failed')) throw e;
    }
    throw new Error('Statement analysis timed out — please try again');
  } finally {
    document.removeEventListener('visibilitychange', onVisibilityChange);
  }
}

// ── Pre-approval statement parse (public) — returns full financial profile ────
export async function parseStatementForPreapproval(file, { onWillOcr, onProgress } = {}) {
  const fd = new FormData();
  fd.append('statement', file);
  const _stmtToken = localStorage.getItem('bondly_token');
  const headers = _stmtToken ? { Authorization: 'Bearer ' + _stmtToken } : {};
  let initJ;
  try {
    const r = await fetch('/api/qualify/from-statement?async=1', { method: 'POST', body: fd, headers });
    initJ = await r.json();
  } catch {
    throw new Error('Upload failed — please check your connection and try again');
  }
  if (!initJ.success) return initJ; // propagate error in the same shape callers expect
  // Tell the UI upfront if OCR scanning is required (adds 1-2 minutes on Pi)
  if (initJ.data?.willOcr && onWillOcr) onWillOcr();
  // Cache hits come back with status: 'done' immediately — no polling needed
  if (initJ.data?.status === 'done' && initJ.data?.result) return { success: true, data: initJ.data.result };
  const result = await pollParseJob(initJ.data.jobId, { onProgress });
  return { success: true, data: result };
}

// ── Mortgage statement scan (public) — extracts 5 named fields from PDF ─────
export function scanMortgageStatement(file) {
  const fd = new FormData();
  fd.append('statement', file);
  return fetch('/api/mortgage/scan', { method: 'POST', body: fd }).then(r => r.json());
}

// ── Manual qualify (public) — full scoring from self-entered figures ──────────
export function qualifyManual({ income, debt, deposit, empType }) {
  return fetch('/api/qualify/manual', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ income, debt, deposit, empType }),
  }).then(r => r.json());
}

// ── Admin ─────────────────────────────────────────────────
export const feedback = {
  vote:   (context, verdict, sessionId, page) => apiFetch('/api/feedback', { method: 'POST', body: JSON.stringify({ context, verdict, sessionId, page }) }),
  report: (message, email, page, sessionId)   => apiFetch('/api/feedback/report', { method: 'POST', body: JSON.stringify({ message, email, page, sessionId }) }),
};

export const admin = {
  stats:        (opts = {}) => apiFetch('/api/admin/stats' + (opts.hideTest ? '?hideTest=true' : '')),
  users:        (opts = {}) => {
    const p = new URLSearchParams();
    if (opts.hideTest)  p.set('hideTest', 'true');
    if (opts.search)    p.set('search', opts.search);
    if (opts.page)      p.set('page', String(opts.page));
    if (opts.limit)     p.set('limit', String(opts.limit));
    const qs = p.toString();
    return apiFetch('/api/admin/customers' + (qs ? '?' + qs : ''));
  },
  swaps:        () => apiFetch('/api/admin/swap-applications'),
  updateSwap:   (id, data) => apiFetch('/api/admin/swap-applications/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  errors:       () => apiFetch('/api/admin/errors'),
  statementFailures: () => apiFetch('/api/admin/statement-failures'),
  commissions:  () => apiFetch('/api/admin/commissions'),
  primeRate:    (rate) => apiFetch('/api/admin/prime-rate', { method: 'PUT', body: JSON.stringify({ rate }) }),
  sendRateAlert: () => apiFetch('/api/admin/rate-alerts/send', { method: 'POST' }),
  // SARB auto-fetch workflow — observed rate moves are queued as pending
  // entries; admin reviews + accepts (which applies the prime change) or dismisses.
  sarbCheck:    () => apiFetch('/api/admin/prime-rate/check-sarb', { method: 'POST' }),
  sarbPending:  () => apiFetch('/api/admin/prime-rate/pending'),
  sarbAccept:   (id) => apiFetch(`/api/admin/prime-rate/pending/${id}/accept`, { method: 'POST' }),
  sarbDismiss:  (id) => apiFetch(`/api/admin/prime-rate/pending/${id}/dismiss`, { method: 'POST' }),
  // Broker pipeline
  pipeline:     (opts = {}) => apiFetch('/api/admin/pipeline' + (opts.hideTest ? '?hideTest=true' : '')),
  brokerAction: (type, id, data) => apiFetch(`/api/admin/pipeline/${type}/${id}/broker-action`, { method: 'POST', body: JSON.stringify(data) }),
  profilePdfUrl:(type, id) => `/api/admin/pipeline/${type}/${id}/profile.pdf`,
  kycList:      () => apiFetch('/api/admin/kyc'),
  kycReview:    (userId, action, reason) => apiFetch('/api/admin/kyc/' + userId, { method: 'PUT', body: JSON.stringify({ action, reason }) }),
  recordOffer:  (swapId, data) => apiFetch(`/api/admin/swap-applications/${swapId}/offers`, { method: 'POST', body: JSON.stringify(data) }),
  verifyIncome: (swapId, data) => apiFetch(`/api/admin/swap-applications/${swapId}/verify`, { method: 'PUT', body: JSON.stringify(data) }),
  requestDocs:  (swapId, message) => apiFetch(`/api/admin/swap-applications/${swapId}/request-docs`, { method: 'POST', body: JSON.stringify({ message }) }),
  updateBankStatus: (swapId, bank, status, note) => apiFetch(`/api/admin/swap-applications/${swapId}/bank-status`, { method: 'PUT', body: JSON.stringify({ bank, status, note }) }),
  updateStage:  (swapId, stage, note) => apiFetch(`/api/admin/swap-applications/${swapId}/stage`, { method: 'PUT', body: JSON.stringify({ stage, note }) }),
  swapReadiness:    (swapId)      => apiFetch(`/api/admin/swap-applications/${swapId}/readiness`),
  chats:        () => apiFetch('/api/admin/chats'),
  replyChat:    (userId, message) => apiFetch(`/api/admin/chats/${userId}`, { method: 'POST', body: JSON.stringify({ message }) }),
  buyerIntents: () => apiFetch('/api/admin/buyer-intents'),
  leads:        () => apiFetch('/api/admin/leads'),
  updateLead:   (id, data) => apiFetch('/api/admin/leads/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  deleteLead:   (id) => apiFetch('/api/admin/leads/' + id, { method: 'DELETE' }),
  statements:   () => apiFetch('/api/admin/statements'),
  downloadStatementUrl: (id) => '/api/admin/statements/' + id + '/download',
  updateCommission: (id, data) => apiFetch('/api/admin/commissions/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  userActivity:   (id) => apiFetch('/api/admin/users/' + id + '/activity'),
  sessions:       ()    => apiFetch('/api/admin/sessions'),
  feedback:       ()    => apiFetch('/api/admin/feedback'),
  customer:     (id) => apiFetch('/api/admin/customers/' + id),
  addNote:      (id, text, type) => apiFetch('/api/admin/customers/' + id + '/notes', { method: 'POST', body: JSON.stringify({ text, type }) }),
  deleteCustomer:(id) => apiFetch('/api/admin/customers/' + id, { method: 'DELETE', body: JSON.stringify({ confirm: 'DELETE_CUSTOMER' }) }),
  resetPassword:(id, password) => apiFetch('/api/admin/customers/' + id + '/password', { method: 'PUT', body: JSON.stringify({ password }) }),
  alerts:       () => apiFetch('/api/admin/alerts'),
  bulkEmail:    (data) => apiFetch('/api/admin/bulk-email', { method: 'POST', body: JSON.stringify(data) }),
  staff:              () => apiFetch('/api/admin/staff'),
  inviteStaff:        (email) => apiFetch('/api/admin/staff/invite', { method: 'POST', body: JSON.stringify({ email }) }),
  cancelInvite:       (token) => apiFetch(`/api/admin/staff/invite/${token}`, { method: 'DELETE' }),
  resetStaffPassword: (id, password) => apiFetch(`/api/admin/staff/${id}/password`, { method: 'PUT', body: JSON.stringify({ password }) }),
  deleteStaff:        (id) => apiFetch(`/api/admin/staff/${id}`, { method: 'DELETE' }),
  auditLog: (params = {}) => {
    const p = new URLSearchParams();
    if (params.page)  p.set('page',  String(params.page));
    if (params.limit) p.set('limit', String(params.limit));
    const qs = p.toString();
    return apiFetch('/api/admin/audit-log' + (qs ? '?' + qs : ''));
  },
  diary:     () => apiFetch('/api/admin/diary'),
  diaryAdd:  (text, type, addedBy) => apiFetch('/api/admin/diary/add', { method: 'POST', body: JSON.stringify({ text, type, addedBy }) }),
  diarySend: () => apiFetch('/api/admin/diary/send-digest', { method: 'POST' }),
  version:   () => apiFetch('/api/admin/version'),
};

// ── Staff invite (public — no auth) ──────────────────────
export const staffInvite = {
  validate:     (token) => apiFetch(`/api/admin/staff/invite/${token}`, { noAuth: true }),
  accept:       (token, name, password) => apiFetch('/api/admin/staff/accept-invite', { method: 'POST', noAuth: true, body: JSON.stringify({ token, name, password }) }),
};

// ── Deeds Office ──────────────────────────────────────────
export const deeds = {
  lookup: (idNumber) => apiFetch('/api/deeds/lookup', { method: 'POST', body: JSON.stringify({ idNumber }) }),
  import: (bonds) => apiFetch('/api/deeds/import', { method: 'POST', body: JSON.stringify({ bonds }) }),
};

// ── Support chat ──────────────────────────────────────────
export const chat = {
  history: () => apiFetch('/api/chat'),
  send:    (message) => apiFetch('/api/chat', { method: 'POST', body: JSON.stringify({ message }) }),
  clear:   () => apiFetch('/api/chat', { method: 'DELETE' }),
};

// ── WhatsApp ──────────────────────────────────────────────
export const whatsapp = {
  invite:          ()     => apiFetch('/api/whatsapp/invite'),
  updateSettings:  (data) => apiFetch('/api/profile/whatsapp', { method: 'PUT', body: JSON.stringify(data) }),
};

// ── Shareable savings links ───────────────────────────────
export const share = {
  create: (data)  => apiFetch('/api/share', { method: 'POST', body: JSON.stringify(data) }),
  get:    (token) => fetch('/api/share/' + token).then(r => r.json()).then(j => { if (!j.success) throw new Error(j.error); return j.data; }),
};

// ── Refinance decision engine ─────────────────────────────
export const decisions = {
  recommend: (loanId) => apiFetch('/api/decisions/recommend', { method: 'POST', body: JSON.stringify({ loanId }) }),
};

// ── Bank submissions (admin) ──────────────────────────────
export const bankSubmissions = {
  list:       ()         => apiFetch('/api/admin/bank-submissions'),
  get:        (id)       => apiFetch('/api/admin/bank-submissions/' + id),
  create:     (data)     => apiFetch('/api/admin/bank-submissions', { method: 'POST', body: JSON.stringify(data) }),
  updateBank: (id, data) => apiFetch('/api/admin/bank-submissions/' + id + '/bank', { method: 'PATCH', body: JSON.stringify(data) }),
  accept:     (id, bank) => apiFetch('/api/admin/bank-submissions/' + id + '/accept', { method: 'POST', body: JSON.stringify({ bank }) }),
  cancel:     (id)       => apiFetch('/api/admin/bank-submissions/' + id, { method: 'DELETE' }),
};

// ── Customer applications ─────────────────────────────────
export const myApplication = {
  get:    ()                       => apiFetch('/api/applications/my'),
  start:  (data)                   => apiFetch('/api/applications/start', { method: 'POST', body: JSON.stringify(data) }),
  update: (cappId, data)           => apiFetch('/api/me/customer-applications/' + encodeURIComponent(cappId), { method: 'PATCH', body: JSON.stringify(data) }),
  addExternalOffer:    (cappId, data) => apiFetch('/api/me/customer-applications/' + encodeURIComponent(cappId) + '/external-offers', { method: 'POST', body: JSON.stringify(data) }),
  removeExternalOffer: (cappId, oid)  => apiFetch('/api/me/customer-applications/' + encodeURIComponent(cappId) + '/external-offers/' + encodeURIComponent(oid), { method: 'DELETE' }),
};

// ── Bond Desk offers (customer side) ─────────────────────
export const offers = {
  list:         ()              => apiFetch('/api/me/offers'),
  accept:       (bidId)         => apiFetch('/api/me/offers/' + bidId + '/accept', { method: 'POST' }),
  decline:      (bidId, reason) => apiFetch('/api/me/offers/' + bidId + '/decline', { method: 'POST', body: JSON.stringify({ reason }) }),
  viewers:      ()              => apiFetch('/api/me/application/viewers'),
  conveyancing: ()              => apiFetch('/api/me/conveyancing'),
  dealMessages: (cappId)        => apiFetch('/api/me/deals/' + cappId + '/messages'),
  sendDealMessage: (cappId, text) => apiFetch('/api/me/deals/' + cappId + '/messages', { method: 'POST', body: JSON.stringify({ text }) }),
  explainOffers:   ()           => apiFetch('/api/me/offers/explain', { method: 'POST' }),
  qualityCoaching: ()           => apiFetch('/api/me/quality-coaching'),
  submitNps:    (cappId, rating, comment) => apiFetch('/api/me/nps', { method: 'POST', body: JSON.stringify({ cappId, rating, comment }) }),
};

// ── Financial Intelligence Platform ──────────────────────
// Cross-the-finish-line + premium UX features (Phase: STRATEGY_MEMO 7.1–7.4)
export const myIntelligence = {
  getProfile: ()               => apiFetch('/api/me/intelligence/profile'),
  getSectors: ()               => apiFetch('/api/me/intelligence/sectors'),
  patchGeo:   (town, province) => apiFetch('/api/me/intelligence/geo',    { method: 'PATCH', body: JSON.stringify({ town, province }) }),
  patchSector:(sector)         => apiFetch('/api/me/intelligence/sector', { method: 'PATCH', body: JSON.stringify({ sector }) }),
};

export const me = {
  qualityScore:           () => apiFetch('/api/me/quality-score'),
  switchMonitor:          () => apiFetch('/api/me/switch-monitor'),
  rateDropProjection:     () => apiFetch('/api/me/rate-drop-projection'),
  conveyancing:           (applicationId) => apiFetch(`/api/me/applications/${applicationId}/conveyancing`),
  prequalCertificateUrl:  () => '/api/me/prequal-certificate.pdf',
  peerBenchmark:          () => apiFetch('/api/me/peer-benchmark'),
  subscriptionCancels:    () => apiFetch('/api/me/subscription-cancels'),
};

export const finances = {
  transactions: (params = {}) => {
    const p = new URLSearchParams();
    if (params.limit)    p.set('limit',    String(params.limit));
    if (params.offset)   p.set('offset',   String(params.offset));
    if (params.category) p.set('category', params.category);
    if (params.from)     p.set('from',     params.from);
    if (params.to)       p.set('to',       params.to);
    const qs = p.toString();
    return apiFetch('/api/transactions' + (qs ? '?' + qs : ''));
  },
  health:          ()       => apiFetch('/api/financial-health'),
  healthHistory:   ()       => apiFetch('/api/financial-health/history'),
  recompute:       ()       => apiFetch('/api/financial-health/recompute', { method: 'POST' }),
  patterns:        ()       => apiFetch('/api/behaviour/patterns'),
  resolvePattern:  (id)     => apiFetch('/api/behaviour/patterns/' + id + '/resolve', { method: 'PUT' }),
  spendingAnalysis:()       => apiFetch('/api/behaviour/spending-analysis'),
  subscriptions:   ()       => apiFetch('/api/subscriptions'),
  updateSubscription: (id, data) => apiFetch('/api/subscriptions/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  goals:           ()       => apiFetch('/api/goals'),
  createGoal:      (data)   => apiFetch('/api/goals', { method: 'POST', body: JSON.stringify(data) }),
  updateGoal:      (id, data) => apiFetch('/api/goals/' + id, { method: 'PUT', body: JSON.stringify(data) }),
  deleteGoal:      (id)     => apiFetch('/api/goals/' + id, { method: 'DELETE' }),
  cashflow:        ()       => apiFetch('/api/forecast/cashflow'),
  scenario:        (changes) => apiFetch('/api/forecast/scenario', { method: 'POST', body: JSON.stringify({ changes }) }),
  opportunities:   ()       => apiFetch('/api/opportunities'),
  dismissOpportunity: (id)  => apiFetch('/api/opportunities/' + id + '/dismiss', { method: 'POST' }),
  actionOpportunity:  (id)  => apiFetch('/api/opportunities/' + id + '/action',  { method: 'POST' }),
  advisorInsights: (question) => apiFetch('/api/advisor/insights', { method: 'POST', body: JSON.stringify({ question }) }),
  // Advanced intelligence
  opportunityCost:   (amount, label) => apiFetch(`/api/opportunity-cost?amount=${amount}${label ? '&label=' + encodeURIComponent(label) : ''}`),
  debtOptimizer:     ()              => apiFetch('/api/debt-optimizer'),
  cashflowRisk:      ()              => apiFetch('/api/cashflow-risk'),
  mortgageReadiness: ()              => apiFetch('/api/mortgage-readiness'),
  financialDigest:   ()              => apiFetch('/api/financial-digest'),
  netWorth:          (assets = {})   => apiFetch('/api/net-worth', { method: 'POST', body: JSON.stringify(assets) }),
  anomalies:         ()              => apiFetch('/api/anomalies'),
  fees:              ()              => apiFetch('/api/fees'),
  merchants:         ()              => apiFetch('/api/spending/merchants'),
  incomeAnalysis:    ()              => apiFetch('/api/income/analysis'),
  cashflowCalendar:  ()              => apiFetch('/api/cashflow/calendar'),
  readinessScore:    ()              => apiFetch('/api/readiness-score'),
  scoreHistory:      ()              => apiFetch('/api/readiness-score/history'),
  bankDossier:       ()              => apiFetch('/api/readiness-score/dossier', { method: 'POST' }),
};

// ── Behavioural Analytics (admin) ─────────────────────────
export const adminAnalytics = {
  overview:        (days = 30)         => apiFetch(`/api/admin/analytics/overview?days=${days}`),
  funnels:         (days = 30)         => apiFetch(`/api/admin/analytics/funnels?days=${days}`),
  funnel:          (id, days = 30)     => apiFetch(`/api/admin/analytics/funnels?funnelId=${id}&days=${days}`),
  sessions:        (params = {})       => {
    const p = new URLSearchParams({ days: params.days || 30, limit: params.limit || 50, page: params.page || 1 });
    if (params.minFrictionScore !== undefined) p.set('minFrictionScore', params.minFrictionScore);
    if (params.userId)         p.set('userId',         params.userId);
    if (params.hasRageClick)   p.set('hasRageClick',   params.hasRageClick);
    if (params.hasFormAbandon) p.set('hasFormAbandon', params.hasFormAbandon);
    return apiFetch('/api/admin/analytics/sessions?' + p);
  },
  replay:          (sessionId)         => apiFetch(`/api/admin/analytics/sessions/${sessionId}/replay`),
  segments:        ()                  => apiFetch('/api/admin/analytics/segments'),
  retention:       (weeks = 8)         => apiFetch(`/api/admin/analytics/retention?weeks=${weeks}`),
  experiments:     ()                  => apiFetch('/api/admin/analytics/experiments'),
  createExperiment:(data)              => apiFetch('/api/admin/analytics/experiments', { method: 'POST', body: JSON.stringify(data) }),
  patchExperiment: (id, status)        => apiFetch(`/api/admin/analytics/experiments/${id}`, { method: 'PATCH', body: JSON.stringify({ status }) }),
  friction:        (params = {})       => {
    const p = new URLSearchParams({ days: params.days || 30, limit: params.limit || 50, page: params.page || 1 });
    if (params.type) p.set('type', params.type);
    return apiFetch('/api/admin/analytics/friction?' + p);
  },
  insights:         ()                         => apiFetch('/api/admin/analytics/insights'),
  refreshInsights:  (days = 7)                 => apiFetch('/api/admin/analytics/insights/refresh', { method: 'POST', body: JSON.stringify({ days }) }),
  generateInsights: (days = 7)                 => apiFetch('/api/admin/analytics/insights/generate', { method: 'POST', body: JSON.stringify({ days }) }),
  performance:      (days = 30)                => apiFetch(`/api/admin/analytics/performance?days=${days}`),
  heatmap:          (page, days = 30)          => apiFetch(`/api/admin/analytics/heatmap?days=${days}${page ? '&page=' + encodeURIComponent(page) : ''}`),
};

// ── AI Audit API ───────────────────────────────────────────────────────────────
export const adminAudit = {
  overview:           () => apiFetch('/api/admin/audit/overview'),
  runs:               (limit=50, offset=0) => apiFetch(`/api/admin/audit/runs?limit=${limit}&offset=${offset}`),
  runDetail:          (id) => apiFetch(`/api/admin/audit/runs/${id}`),
  bankReport:         () => apiFetch('/api/admin/audit/bank-report'),
  failures:           () => apiFetch('/api/admin/audit/failures'),
  errors:             (params={}) => apiFetch(`/api/admin/audit/errors?${new URLSearchParams(params)}`),
  reviewError:        (id, action) => apiFetch(`/api/admin/audit/errors/${id}`, { method: 'PUT', body: JSON.stringify({ action }) }),
  hallucinations:     () => apiFetch('/api/admin/audit/hallucinations'),
  calibration:        () => apiFetch('/api/admin/audit/calibration'),
  drift:              (days=90) => apiFetch(`/api/admin/audit/drift?days=${days}`),
  promptComparison:   () => apiFetch('/api/admin/audit/prompt-comparison'),
  modelVersions:      () => apiFetch('/api/admin/audit/model-versions'),
  runRegression:      () => apiFetch('/api/admin/audit/run-regression', { method: 'POST' }),
  seedGolden:         () => apiFetch('/api/admin/audit/seed-golden', { method: 'POST' }),
  generateSynthetic:  (opts) => apiFetch('/api/admin/audit/generate-synthetic', { method: 'POST', body: JSON.stringify(opts) }),
  parseStats:         (days=30) => apiFetch(`/api/admin/audit/parse-stats?days=${days}`),
};

export const adminFairLending = {
  report: (minGroup = 10) => apiFetch(`/api/admin/fair-lending/report?minGroup=${minGroup}`),
};

// ── Risk Intelligence (bank-facing portfolio monitor) ─────
export const getIntelligencePortfolio = () => apiFetch('/api/intelligence/portfolio');
export const getIntelligenceAccounts  = (params) => {
  const p = new URLSearchParams();
  if (params?.page)  p.set('page',  String(params.page));
  if (params?.limit) p.set('limit', String(params.limit));
  if (params?.tier)  p.set('tier',  params.tier);
  const qs = p.toString();
  return apiFetch('/api/intelligence/accounts' + (qs ? '?' + qs : ''));
};
export const getIntelligenceAccount = (userId) => apiFetch(`/api/intelligence/account/${encodeURIComponent(userId)}`);
export const getIntelligenceAlerts  = (resolved = false) => apiFetch(`/api/intelligence/alerts?resolved=${resolved}`);
