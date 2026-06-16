import { useEffect, useState } from 'react';
import { PRIME_RATE } from './constants.js';

/**
 * Live prime-rate hook.
 *
 * The backend keeps the authoritative number at db.settings.primeRate
 * (admin updates flow through the existing PUT /api/prime-rate endpoint
 * with user notification). Frontend pages used to import the hardcoded
 * PRIME_RATE constant directly, which meant a SARB rate move only landed
 * on the site after a frontend redeploy AND someone remembered to edit
 * constants.js — a real-world drift bug we hit (Hook.jsx had its OWN
 * stale 11.75% literal).
 *
 * This hook:
 *   • Returns the constants.js value immediately so the first render
 *     never blocks (cheap-and-safe SSR-style default).
 *   • Fires a one-off GET /api/public/settings on mount and swaps in
 *     the live value once it lands.
 *   • Caches the fetched value in sessionStorage so subsequent pages
 *     in the same tab read it synchronously (no flicker).
 *
 * If the fetch fails (network, backend down), the constants.js fallback
 * remains. Never throws, never blocks render.
 */
const CACHE_KEY = 'bondly_rate_settings_v1';

function _readCache() {
  try {
    const raw = sessionStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const obj = JSON.parse(raw);
    return obj && Number.isFinite(obj.primeRate) ? obj : null;
  } catch { return null; }
}

/**
 * Hook used by individual UI pieces that only need the prime number.
 * Backwards-compatible with the original signature — returns a number.
 */
export function usePrimeRate() {
  return useRateSettings().primeRate;
}

/**
 * Hook returning the full rate-settings bag — { primeRate, stressRate,
 * primeRateLastChanged, primeExplainer }. Used by the RatesExplained modal
 * and any UI surface that wants to show "Prime last updated: 25 Jul 2025".
 */
export function useRateSettings() {
  const [state, setState] = useState(() => {
    const cached = _readCache();
    return cached ?? { primeRate: PRIME_RATE, stressRate: PRIME_RATE + 2, primeRateLastChanged: null, primeExplainer: null };
  });

  useEffect(() => {
    let cancelled = false;
    fetch('/api/public/settings', { credentials: 'omit' })
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (cancelled || !j?.data) return;
        const data = j.data;
        const v = parseFloat(data.primeRate);
        if (Number.isFinite(v) && v > 0) {
          const next = {
            primeRate:            v,
            stressRate:           parseFloat(data.stressRate) || (v + 2),
            primeRateLastChanged: data.primeRateLastChanged || null,
            primeExplainer:       data.primeExplainer || null,
          };
          setState(next);
          try { sessionStorage.setItem(CACHE_KEY, JSON.stringify(next)); } catch {/* ok */}
        }
      })
      .catch(() => { /* keep fallback */ });
    return () => { cancelled = true; };
  }, []);

  return state;
}
