// ── Admin React Query hooks ────────────────────────────────────────────────────
// Drop-in replacements for the repetitive useState + useEffect fetch patterns.
// Usage: const { data = [], isLoading, error } = useAdminUsers()
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { admin, adminAnalytics } from '../../../lib/api.js';

// ── Users ──────────────────────────────────────────────────────────────────────
export function useAdminUsers(options = {}) {
  return useQuery({
    queryKey: ['admin', 'users'],
    queryFn: () => admin.customers().then(r => r.data || []),
    ...options,
  });
}

// ── Leads ──────────────────────────────────────────────────────────────────────
export function useAdminLeads(options = {}) {
  return useQuery({
    queryKey: ['admin', 'leads'],
    queryFn: () => admin.leads().then(r => r.data || []),
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
    queryFn: () => admin.commissions().then(r => r.data || { commissions: [], totalReceived: 0, totalPending: 0 }),
    ...options,
  });
}

// ── Stats ──────────────────────────────────────────────────────────────────────
export function useAdminStats(options = {}) {
  return useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => admin.stats().then(r => r.data || {}),
    ...options,
  });
}

// ── KYC queue ──────────────────────────────────────────────────────────────────
export function useAdminKycQueue(options = {}) {
  return useQuery({
    queryKey: ['admin', 'kyc'],
    queryFn: () => admin.kycQueue().then(r => r.data || []),
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
