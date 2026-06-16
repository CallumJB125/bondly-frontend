// SVG health score ring — mirrors the original monolith's ring component
export default function BondHealthRing({ score = 0, grade = 'N/A' }) {
  const pct = Math.min(100, Math.max(0, score));
  const r = 54;
  const circ = 2 * Math.PI * r;
  const dash = (pct / 100) * circ;
  const gap  = circ - dash;

  const color =
    pct >= 80 ? 'var(--color-grade-a)' :
    pct >= 60 ? 'var(--color-grade-b)' :
    pct >= 40 ? 'var(--color-grade-c)' :
    'var(--color-grade-e)';

  const gradeLabel = grade || (
    pct >= 80 ? 'Excellent' :
    pct >= 60 ? 'Good' :
    pct >= 40 ? 'Fair' :
    'Poor'
  );

  return (
    <div style={{ display: 'inline-flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}>
      <svg width="140" height="140" viewBox="0 0 140 140">
        <circle cx="70" cy="70" r={r} fill="none" stroke="var(--border-color)" strokeWidth="12" />
        <circle
          cx="70" cy="70" r={r}
          fill="none"
          strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${gap}`}
          strokeDashoffset={circ / 4}
          style={{ stroke: color, transition: 'stroke-dasharray 0.6s ease' }}
        />
        <text x="70" y="65" textAnchor="middle" dominantBaseline="middle" style={{ fontSize: 28, fontWeight: 700, fill: color, fontFamily: 'var(--font-sans)' }}>
          {Math.round(pct)}
        </text>
        <text x="70" y="88" textAnchor="middle" style={{ fontSize: 11, fill: 'var(--text-secondary)', fontFamily: 'var(--font-sans)', fontWeight: 600, letterSpacing: '0.06em', textTransform: 'uppercase' }}>
          {gradeLabel}
        </text>
      </svg>
    </div>
  );
}
