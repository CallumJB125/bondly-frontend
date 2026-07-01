/**
 * Shared multi-series SVG LineChart.
 *
 * Extracted from BankIntelligence TrendsTab so the same primitive can render the
 * monthly distress trend, the banded win-rate trend, and any other small
 * multi-line series without pulling in a charting library.
 *
 * Props:
 *   series  : [{ values: (number|null)[], color: string, label?: string }]
 *             one entry per line; `null` values create gaps in the line.
 *   labels  : string[]  — x-axis tick labels (e.g. period keys "2025-10").
 *             Labels are rendered from index 5 onward (so "2025-10" → "10")
 *             to match the existing TrendsTab behaviour.
 *   height  : number    — SVG height in px (default 140).
 *   yLabel  : string    — optional rotated y-axis caption.
 *   gridLines: number[] — optional horizontal gridline values
 *                         (default [0,25,50,75,100], filtered to data range).
 */
export default function LineChart({ series, labels, height = 140, yLabel = '', gridLines = [0, 25, 50, 75, 100] }) {
  const allVals = series.flatMap(s => s.values.filter(v => v != null));
  const min = Math.min(...allVals, 0);
  const max = Math.max(...allVals, 1);
  const range = max - min || 1;
  const W = 600, H = height, PAD = { top: 12, right: 16, bottom: 24, left: 44 };
  const iW = W - PAD.left - PAD.right;
  const iH = H - PAD.top - PAD.bottom;
  const n = labels.length;
  const x = i => PAD.left + (i / Math.max(n - 1, 1)) * iW;
  const y = v => PAD.top + iH - ((v - min) / range) * iH;

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
      {yLabel && (
        <text x={10} y={H / 2} textAnchor="middle" fontSize="8.5" fill="#4a6080"
          transform={`rotate(-90, 10, ${H / 2})`} letterSpacing="0.5">{yLabel}</text>
      )}
      {gridLines.filter(v => v >= min && v <= max).map(v => (
        <g key={v}>
          <line x1={PAD.left} x2={W - PAD.right} y1={y(v)} y2={y(v)} stroke="rgba(255,255,255,0.06)" strokeWidth="1" />
          <text x={PAD.left - 4} y={y(v) + 4} textAnchor="end" fontSize="9" fill="#4a6080">{v}</text>
        </g>
      ))}
      {labels.map((l, i) => (
        <text key={i} x={x(i)} y={H - 4} textAnchor="middle" fontSize="9" fill="#4a6080">
          {String(l).slice(5)}
        </text>
      ))}
      {series.map((s, si) => {
        let d = '';
        s.values.forEach((v, i) => {
          if (v == null) return;
          const cmd = (i === 0 || s.values[i - 1] == null) ? 'M' : 'L';
          d += `${cmd}${x(i)},${y(v)} `;
        });
        return (
          <g key={si}>
            <path d={d} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" />
            {s.values.map((v, i) => v != null && (
              <circle key={i} cx={x(i)} cy={y(v)} r="3" fill={s.color} />
            ))}
          </g>
        );
      })}
    </svg>
  );
}
