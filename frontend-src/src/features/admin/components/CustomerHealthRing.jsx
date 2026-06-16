/**
 * CustomerHealthRing — at-a-glance health badge for a registered customer.
 *
 * Composite score 0-100. Weights chosen to align with the admin's
 * "is this customer ready to convert" mental model:
 *
 *   +25  KYC verified
 *   +20  Has at least one snapshot (we know their finances)
 *   +15  DTI ≤ 30%
 *   +15  Income verified (payslip cross-check passed)
 *   +10  Active loan / bond on file
 *   +10  Logged in within the last 30 days
 *   +5   Has phone number on file
 *
 * Renders as a small SVG ring with the score in the middle. Hue picks
 * red → amber → green based on the score so the customer list reads
 * like a glanceable triage board.
 */
export default function CustomerHealthRing({ customer = {}, size = 36 }) {
  const score = computeCustomerHealth(customer);
  const colour =
      score >= 80 ? '#16a34a'
    : score >= 60 ? '#22c55e'
    : score >= 40 ? '#f59e0b'
    :               '#dc2626';

  // SVG ring geometry
  const r = (size - 6) / 2;
  const c = Math.PI * 2 * r;
  const offset = c * (1 - score / 100);

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} role="img" aria-label={`Health score ${score} / 100`}>
      <circle cx={size / 2} cy={size / 2} r={r}
              stroke="rgba(0,0,0,0.06)" strokeWidth="3" fill="none" />
      <circle cx={size / 2} cy={size / 2} r={r}
              stroke={colour} strokeWidth="3" fill="none"
              strokeDasharray={c}
              strokeDashoffset={offset}
              strokeLinecap="round"
              transform={`rotate(-90 ${size / 2} ${size / 2})`} />
      <text x="50%" y="50%" dy="0.35em" textAnchor="middle"
            style={{ fontSize: `${Math.round(size * 0.36)}px`, fontWeight: 800, fill: colour }}>
        {score}
      </text>
    </svg>
  );
}

/**
 * Pure score function — exported so other places (customer profile header,
 * health-trend sparkline) can use the same definition.
 */
export function computeCustomerHealth(c = {}) {
  let s = 0;
  if (c.kycStatus === 'approved' || c.kycVerified)            s += 25;
  if (c.hasSnapshot || c.snapshotCount > 0 || c.latestSnapshotAt) s += 20;
  if (typeof c.dti === 'number' && c.dti <= 30)                s += 15;
  if (c.incomeVerifiedAt || c.incomeVerifiedBy)                s += 15;
  if (c.loanCount > 0 || c.activeBondId || c.hasActiveLoan)    s += 10;
  if (c.lastLoginAt) {
    const days = (Date.now() - new Date(c.lastLoginAt).getTime()) / 86400e3;
    if (days <= 30) s += 10;
  }
  if (c.phone)                                                 s += 5;
  return Math.max(0, Math.min(100, s));
}
