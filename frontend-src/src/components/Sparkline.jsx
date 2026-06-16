export default function Sparkline({ values = [], width = 60, height = 24, color = 'var(--color-primary)', fill = false }) {
  if (!values || values.length < 2) return null;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const w = width, h = height;
  const step = w / (values.length - 1);
  const pts = values.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`);
  const polyline = pts.join(' ');
  const fillPath = `M${pts[0]} L${pts.slice(1).join(' L')} L${(values.length - 1) * step},${h} L0,${h} Z`;

  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible', display: 'block' }}>
      {fill && <path d={fillPath} fill={color} fillOpacity="0.12" />}
      <polyline
        points={polyline}
        fill="none"
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* Last point dot */}
      <circle
        cx={(values.length - 1) * step}
        cy={h - ((values[values.length - 1] - min) / range) * (h - 4) - 2}
        r="2.5"
        fill={color}
      />
    </svg>
  );
}
