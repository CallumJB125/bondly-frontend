// ── Admin React Query hooks ────────────────────────────────────────────────────
// Drop-in replacements for the repetitive useState + useEffect fetch patterns.
// Usage: const { data = [], isLoading, error } = useAdminUsers()
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { admin, adminAnalytics, bankSubmissions as bsApi } from '../../../lib/api.js';

// ── Users ──────────────────────────────────────────────────────────────────────
export function useAdminUsers(options = {}) {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => admin.customers().then(r => r.data || []),
    ...options,
  });
}

// ── Leads ──────────────────────────────────────────────────────────────────────
// Endpoint returns { leads, convertedCount, totalAll } (apiFetch already unwraps the
// envelope). Normalized so callers always get that shape regardless of array/object.
export function useAdminLeads(includeConverted = false, options = {}) {
  return useQuery({
    queryKey: ['admin', 'leads', { includeConverted }],
    queryFn: () => admin.leads(includeConverted).then(d => ({
      leads: Array.isArray(d) ? d : (d?.leads || []),
      convertedCount: d?.convertedCount || 0,
      totalAll: d?.totalAll ?? (Array.isArray(d) ? d.length : (d?.leads?.length || 0)),
    })),
    ...options,
  });
}

// ── Swap applications ──────────────────────────────────────────────────────────
export function useAdminSwapApps(options = {}) {
  return useQuery({
    queryKey: ['admin', 'swapApps'],
    queryFn: () => admin.swapApps().then(r => r.data || []),
    ...options,
  });
}

// ── Commissions ────────────────────────────────────────────────────────────────
export function useAdminCommissions(options = {}) {
  return useQuery({
    queryKey: ['admin', 'commissions'],
    // apiFetch already unwraps the envelope; endpoint returns { commissions, totals }.
    queryFn: () => admin.commissions().then(d => d || { commissions: [], totals: {} }),
    ...options,
  });
}

// ── Stats ──────────────────────────────────────────────────────────────────────
export function useAdminStats(options = {}) {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => admin.stats().then(d => d || {}),
    ...options,
  });
}

// ── KYC queue ──────────────────────────────────────────────────────────────────
export function useAdminKycQueue(options = {}) {
  return useQuery({
    queryKey: ['admin', 'kyc'],
    queryFn: () => admin.kycQueue().then(d => Array.isArray(d) ? d : []),
    ...options,
  });
}

// ── Claude usage ───────────────────────────────────────────────────────────────
export function useClaudeUsage(options = {}) {
  return useQuery({
    queryKey: ['admin', 'claudeUsage'],
    queryFn: () => admin.claudeUsage().then(r => r.data || { usage: [], totalCost: 0 }),
    ...options,
  });
}

// ── Analytics overview ─────────────────────────────────────────────────────────
export function useAnalyticsOverview(days = 30, options = {}) {
  return useQuery({
    queryKey: ['analytics', 'overview', days],
    queryFn: () => adminAnalytics.overview(days).then(r => r.data || {}),
    staleTime: 60_000,
    ...options,
  });
}

export function useAnalyticsFunnels(days = 30, options = {}) {
  return useQuery({
    queryKey: ['analytics', 'funnels', days],
    queryFn: () => adminAnalytics.funnels(days).then(r => r.data || []),
    staleTime: 60_000,
    ...options,
  });
}

export function useAnalyticsSegments(options = {}) {
  return useQuery({
    queryKey: ['analytics', 'segments'],
    queryFn: () => adminAnalytics.segments().then(r => r.data || []),
    staleTime: 120_000,
    ...options,
  });
}

export function useAnalyticsInsights(options = {}) {
  return useQuery({
    queryKey: ['analytics', 'insights'],
    queryFn: () => adminAnalytics.insights().then(r => r.data || []),
    staleTime: 300_000,
    ...options,
  });
}

// ── Chats / inbox ────────────────────────────────────────────────────────────────
export function useAdminChats(options = {}) {
  return useQuery({
    queryKey: ['admin', 'chats'],
    queryFn: () => admin.chats().then(d => d || []),
    ...options,
  });
}

// ── Sessions ─────────────────────────────────────────────────────────────────────
export function useAdminSessions(options = {}) {
  return useQuery({
    queryKey: ['admin', 'sessions'],
    queryFn: () => admin.sessions().then(d => d || []),
    ...options,
  });
}

// ── Statements ───────────────────────────────────────────────────────────────────
export function useAdminStatements(options = {}) {
  return useQuery({
    queryKey: ['admin', 'statements'],
    queryFn: () => admin.statements().then(d => d || []),
    ...options,
  });
}

// ── Errors + statement failures ──────────────────────────────────────────────────
export function useAdminErrors(options = {}) {
  return useQuery({
    queryKey: ['admin', 'errors'],
    queryFn: () => admin.errors().then(d => d || []),
    ...options,
  });
}
export function useAdminStatementFailures(options = {}) {
  return useQuery({
    queryKey: ['admin', 'statementFailures'],
    queryFn: () => admin.statementFailures().then(d => d || []),
    ...options,
  });
}

// ── Feedback ─────────────────────────────────────────────────────────────────────
export function useAdminFeedback(options = {}) {
  return useQuery({
    queryKey: ['admin', 'feedback'],
    queryFn: () => admin.feedback().then(d => d || { feedback: [], reports: [] }),
    ...options,
  });
}

// ── Audit log (paginated) ────────────────────────────────────────────────────────
export function useAdminAuditLog(page = 1, limit = 50, options = {}) {
  return useQuery({
    queryKey: ['admin', 'auditLog', page, limit],
    queryFn: () => admin.auditLog({ page, limit }).then(d => d || { entries: [], total: 0 }),
    ...options,
  });
}

// ── Buyer intents ────────────────────────────────────────────────────────────────
export function useAdminBuyerIntents(options = {}) {
  return useQuery({
    queryKey: ['admin', 'buyerIntents'],
    queryFn: () => admin.buyerIntents().then(d => d || []),
    ...options,
  });
}

// ── Bank submissions ─────────────────────────────────────────────────────────────
// bsApi.list() resolves to { submissions: [...] } (apiFetch already unwraps the envelope).
export function useAdminSubmissions(options = {}) {
  return useQuery({
    queryKey: ['admin', 'submissions'],
    queryFn: () => bsApi.list().then(d => d?.submissions || []),
    ...options,
  });
}

// ── SSE event → cache invalidation map ───────────────────────────────────────────
// The admin SSE stream (useAdminEventStream) pushes live events. Once a tab is on
// React Query, its event handler MUST invalidate the affected query keys instead of
// calling setState — otherwise live pushes fight the cache (double-update / stale data).
// Wire this in Admin.jsx's useAdminEventStream callback as tabs migrate (Phase C3).
export const ADMIN_EVENT_INVALIDATIONS = {
  sla_breach:    [['admin', 'swapApps'], ['admin', 'stats']],
  sla_due_soon:  [['admin', 'swapApps'], ['admin', 'stats']],
  broker_rotate: [['admin', 'swapApps']],
};
export function invalidateForAdminEvent(queryClient, type) {
  (ADMIN_EVENT_INVALIDATIONS[type] || []).forEach(queryKey =>
    queryClient.invalidateQueries({ queryKey })
  );
}

// NOTE: the original hooks above (useAdminUsers/Leads/SwapApps/Commissions/Stats/Kyc/
// ClaudeUsage) use `.then(r => r.data ...)`, but apiFetch already returns `j.data`, so
// that double-unwraps. They were never wired (dead code). Reconcile each to the proven
// inline shape (`.then(d => d || default)`) when first adopting it during C3 migration.

// ── Mutation helpers ───────────────────────────────────────────────────────────

export function useUpdateUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }) => admin.updateCustomer(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useDeleteUser() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id) => admin.deleteCustomer(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'users'] }),
  });
}

export function useRefreshAnalyticsInsights() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (days) => adminAnalytics.refreshInsights(days),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['analytics', 'insights'] }),
  });
}
