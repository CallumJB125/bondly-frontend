/**
 * bondHealthScore — indicative bond optimisation score (0–100).
 *
 * This is NOT a credit score. It measures how well-optimised a homeowner's
 * current bond is relative to what is available in the SA market right now.
 * It is indicative only and subject to bank credit assessment.
 *
 * Formula (two components, equally weighted):
 *
 * 1. Rate component (50 pts max)
 *    Maps the user's rate relative to prime:
 *      ≤ prime          → 50 pts (excellent)
 *      prime + 0.5%     → 37.5 pts
 *      prime + 1.0%     → 25 pts
 *      prime + 1.5%     → 12.5 pts
 *      ≥ prime + 2%     → 0 pts
 *    Linear interpolation between those anchors, clamped to [0, 50].
 *
 * 2. Overpayment component (50 pts max)
 *    monthlySaving as a % of monthlyPayment reflects the avoidable waste:
 *      0%   saving → 50 pts (nothing being wasted)
 *      5%   saving → 37.5 pts
 *      10%  saving → 25 pts
 *      15%  saving → 12.5 pts
 *      ≥20% saving → 0 pts
 *    Linear interpolation, clamped to [0, 50].
 *
 * Total = rateScore + overpaymentScore, rounded to nearest integer.
 *
 * Grade mapping:
 *   80–100 → A  "Excellent"
 *   60–79  → B  "Good"
 *   40–59  → C  "Fair"
 *   20–39  → D  "Poor"
 *   0–19   → E  "Critical"
 */

export function bondHealthScore({ currentRate, primeRate, monthlySaving, monthlyPayment }) {
  const prime = primeRate || 11.75;

  // ── Component 1: rate gap above prime ─────────────────────
  // gap = 0 → full 50 pts; gap ≥ 2 → 0 pts; linear in between.
  const rateGap = Math.max(0, currentRate - prime);
  const rateScore = Math.max(0, 50 - (rateGap / 2) * 50);

  // ── Component 2: monthly overpayment as % of payment ──────
  // 0% waste → full 50 pts; ≥20% waste → 0 pts.
  const savingPct = monthlyPayment > 0 ? (monthlySaving / monthlyPayment) * 100 : 0;
  const overpaymentScore = Math.max(0, 50 - (savingPct / 20) * 50);

  const score = Math.round(Math.min(100, rateScore + overpaymentScore));

  let grade, label, color;
  if (score >= 80) { grade = 'A'; label = 'Excellent';  color = '#16a34a'; }
  else if (score >= 60) { grade = 'B'; label = 'Good';      color = '#65a30d'; }
  else if (score >= 40) { grade = 'C'; label = 'Fair';      color = '#ca8a04'; }
  else if (score >= 20) { grade = 'D'; label = 'Poor';      color = '#ea580c'; }
  else                  { grade = 'E'; label = 'Critical';  color = '#dc2626'; }

  return { score, grade, label, color };
}
