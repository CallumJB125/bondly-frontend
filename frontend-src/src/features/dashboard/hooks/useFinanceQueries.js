// ── Finance React Query hooks ────────────────────────────────────────────────
// Shared data-fetching hooks for FinancesTab sub-components.
// All hooks use a 5-minute stale time so tab-switching within that window
// uses cached data instead of re-fetching.
// Usage: const { data, isLoading, isError, error, refetch } = useReadinessScore()
import { useQuery } from '@tanstack/react-query';
import { finances } from '../../../lib/api.js';

const STALE = 5 * 60 * 1000; // 5 minutes

// ── Readiness score ───────────────────────────────────────────────────────────
export function useReadinessScore(options = {}) {
  return useQuery({
    queryKey: ['finance', 'readinessScore'],
    queryFn: () => finances.readinessScore(),
    staleTime: STALE,
    ...options,
  });
}

// ── Spending analysis ─────────────────────────────────────────────────────────
export function useSpendingAnalysis(options = {}) {
  return useQuery({
    queryKey: ['finance', 'spendingAnalysis'],
    queryFn: () => finances.spendingAnalysis(),
    staleTime: STALE,
    ...options,
  });
}

// ── Merchants ─────────────────────────────────────────────────────────────────
export function useMerchants(options = {}) {
  return useQuery({
    queryKey: ['finance', 'merchants'],
    queryFn: () => finances.merchants(),
    staleTime: STALE,
    ...options,
  });
}

// ── Income analysis ───────────────────────────────────────────────────────────
export function useIncomeAnalysis(options = {}) {
  return useQuery({
    queryKey: ['finance', 'incomeAnalysis'],
    queryFn: () => finances.incomeAnalysis(),
    staleTime: STALE,
    ...options,
  });
}

// ── Net worth (initial load with empty body) ──────────────────────────────────
export function useNetWorth(options = {}) {
  return useQuery({
    queryKey: ['finance', 'netWorth'],
    queryFn: () => finances.netWorth({}),
    staleTime: STALE,
    ...options,
  });
}

// ── Health history ────────────────────────────────────────────────────────────
export function useHealthHistory(options = {}) {
  return useQuery({
    queryKey: ['finance', 'healthHistory'],
    queryFn: () => finances.healthHistory(),
    staleTime: STALE,
    ...options,
  });
}

// ── Debt optimizer ────────────────────────────────────────────────────────────
export function useDebtOptimizer(options = {}) {
  return useQuery({
    queryKey: ['finance', 'debtOptimizer'],
    queryFn: () => finances.debtOptimizer(),
    staleTime: STALE,
    ...options,
  });
}

// ── Financial health (used by DebtCommander for income) ───────────────────────
export function useFinancialHealth(options = {}) {
  return useQuery({
    queryKey: ['finance', 'health'],
    queryFn: () => finances.health(),
    staleTime: STALE,
    ...options,
  });
}

// ── Cashflow calendar ─────────────────────────────────────────────────────────
export function useCashflowCalendar(options = {}) {
  return useQuery({
    queryKey: ['finance', 'cashflowCalendar'],
    queryFn: () => finances.cashflowCalendar(),
    staleTime: STALE,
    ...options,
  });
}
