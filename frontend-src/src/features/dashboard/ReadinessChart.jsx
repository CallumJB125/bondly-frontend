import { useEffect, useMemo, useState } from 'react';
import { TrendingUp } from 'lucide-react';
import { financialFitness } from '../../lib/api.js';
import { fmt } from '@bondly/ui/lib/format.js';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';

/**
 * Readiness over time — small SVG line chart of qualifying bond per snapshot.
 *
 * Pulls all of the user's saved financial fitness snapshots and plots the
 * qualifying bond per upload date. Two snapshots is the minimum useful series;
 * the card self-hides under that so we don't show a single dot.
 *
 * The shape of the line tells the customer whether they're progressing
 * (heading up) or losing ground (heading down) — same data they'd otherwise
 * have to compare manually across statements.
 */
export default function ReadinessChart() {
  const [snaps, setSnaps] = useState(null);

  useEffect(() => {
    financialFitness.getSnapshots()
      .then(d => setSnaps(Array.isArray(d?.snapshots) ? d.snapshots : []))
      .catch(() => setSnaps([]));
  }, []);

  // Build the series oldest → newest, falling back through the various
  // possible snapshot shapes (old field names, new ones).
  const series = useMemo(() => {
    if (!Array.isArray(snaps)) return [];
    return snaps
      .slice()
      .reverse() // API returns newest-first; chart wants left-to-right time
      .map(s => {
        const bond =
            s.bondCapacity?.maxBond
         ?? s.bondCapacity?.amount
         ?? s.maxBond
         ?? s.qualifyingBond
         ?? 0;
        return {
          date: s.createdAt || s.uploadedAt || s.date || null,
          bond: Number(bond) || 0,
        };
      })
      .filter(p => p.date && p.bond > 0);
  }, [snaps]);

  if (snaps === null) return null;          // still loading
  if (series.length < 2) return null;       // need ≥ 2 points to draw a line

  // Scale into a 320×120 viewBox with a 24px gutter so points don't clip.
  const W = 320, H = 120, PAD = 24;
  const xs = series.map((_, i) => PAD + (i * (W - 2 * PAD)) / (series.length - 1));
  const max = Math.max(...series.map(p => p.bond));
  const min = Math.min(...series.map(p => p.bond));
  const range = Math.max(1, max - min);
  const ys = series.map(p => H - PAD - ((p.bond - min) / range) * (H - 2 * PAD));
  const path = xs.map((x, i) => `${i === 0 ? 'M' : 'L'}${x.toFixed(1)} ${ys[i].toFixed(1)}`).join(' ');

  const first = series[0], last = series[series.length - 1];
  const delta = last.bond - first.bond;
  const deltaPct = first.bond > 0 ? (delta / first.bond) * 100 : 0;
  const trendUp = delta >= 0;
  const stroke = trendUp ? '#16a34a' : '#dc2626';

  return (
    <Card style={{ marginBottom: 'var(--space-5)' }}>
      <CardHeader>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <TrendingUp size={16} /> Your readiness over time
        </span>
      </CardHeader>
      <CardBody>
        <div style={{ display:'flex', alignItems:'baseline', justifyContent:'space-between', marginBottom: 10 }}>
          <div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>Qualifying bond now</div>
            <div style={{ fontWeight:800, fontSize:'1.25rem' }}>{fmt(last.bond)}</div>
          </div>
          <div style={{ textAlign:'right' }}>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>Since {new Date(first.date).toLocaleDateString('en-ZA', { month:'short', year:'numeric' })}</div>
            <div style={{ fontWeight:700, fontSize:'0.9375rem', color: stroke }}>
              {trendUp ? '+' : ''}{fmt(delta)} ({deltaPct >= 0 ? '+' : ''}{deltaPct.toFixed(1)}%)
            </div>
          </div>
        </div>

        <svg viewBox={`0 0 ${W} ${H}`} style={{ width:'100%', height:'auto', display:'block' }} role="img" aria-label="Qualifying bond over time">
          {/* Subtle area fill under the line for emphasis */}
          <path d={`${path} L${xs[xs.length-1].toFixed(1)} ${H-PAD} L${xs[0].toFixed(1)} ${H-PAD} Z`}
                fill={stroke} opacity="0.08" />
          <path d={path} fill="none" stroke={stroke} strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" />
          {xs.map((x, i) => (
            <circle key={i} cx={x} cy={ys[i]} r={i === xs.length - 1 ? 3.5 : 2.5}
                    fill={stroke} stroke="#fff" strokeWidth="1.5" />
          ))}
        </svg>

        <p style={{ margin:'10px 0 0', fontSize:'0.75rem', color:'var(--text-secondary)' }}>
          Updates each time you upload a new bank statement. {trendUp
            ? 'Keep doing what you’re doing — your borrowing power is growing.'
            : 'Heading down — open the Optimize tab to see which spending categories pulled it lower.'}
        </p>
      </CardBody>
    </Card>
  );
}
