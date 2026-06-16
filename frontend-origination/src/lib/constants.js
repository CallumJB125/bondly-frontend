// ── SA Finance constants ──────────────────────────────────
export const PRIME_RATE   = 11.25; // % — updated May 2026 (SARB cut 25bps)
export const STRESS_RATE  = 13.25; // % — prime + 2% stress test (SA bank standard)
export const BANKS = ['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'Investec', 'SA Home Loans'];

// Bank spreads above prime (percentage points)
// Investec -0.25% applies to qualifying clients only (typically excellent credit + bond > R1.5M)
// Last updated: April 2025
export const BANK_SPREADS = {
  ABSA:             0.0,
  FNB:              0.0,
  Nedbank:          0.25,
  'Standard Bank':  0.0,
  Capitec:          0.5,
  Investec:        -0.25, // qualifying clients only — excellent credit + typically >R1.5M bond
  'SA Home Loans':  0.5,
};

// Weighted market-average spread (excluding Investec — qualifying clients only)
// Used for rate comparisons; updated when BANK_SPREADS changes
export const MARKET_AVG_SPREAD = (() => {
  const mainstream = Object.entries(BANK_SPREADS).filter(([bank]) => bank !== 'Investec');
  return Math.round(mainstream.reduce((sum, [, s]) => sum + s, 0) / mainstream.length * 100) / 100;
})();

export const APP_NAME = 'Bondly';
