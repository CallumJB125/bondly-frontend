import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingDown, ShieldCheck, Sparkles, Award, Users, Scissors } from 'lucide-react';
import { me } from '../../lib/api.js';
import { fmt, fmtPct } from '@bondly/ui/lib/format.js';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';

/**
 * Quality Score card — surfaces the Bondly Quality Score with breakdown.
 * Reinforces the score with practical advice: which factor to improve next
 * for the biggest jump.
 */
export function QualityScoreCard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    me.qualityScore().then(setData).catch(() => setData(false));
  }, []);
  if (data === false || !data) return null;

  const bandColour = {
    pre_cleared:    '#16a34a',
    premium:        '#22c55e',
    standard:       '#f59e0b',
    decline_likely: '#dc2626',
  }[data.band] || '#6b7280';
  const bandLabel = {
    pre_cleared:    'Pre-cleared',
    premium:        'Premium',
    standard:       'Standard',
    decline_likely: 'Decline-likely',
  }[data.band] || 'Unscored';

  // Biggest single jump available — the highest-points factor we DON'T have.
  const nextWin = (data.breakdown || [])
    .filter(b => b.points === 0)
    .sort((a, b) => {
      const possible = { 'KYC verified': 25, 'Income verified': 20, 'Income stability': 15, 'Debt-to-income ratio': 15, 'Statement length': 10, 'Spending fully categorised': 10 };
      return (possible[b.label] || 0) - (possible[a.label] || 0);
    })[0];

  return (
    <Card style={{ marginBottom: 'var(--space-5)' }}>
      <CardHeader>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Award size={16} /> Bondly Quality Score
        </span>
      </CardHeader>
      <CardBody>
        <div style={{ display:'flex', alignItems:'center', gap:18, marginBottom:16 }}>
          <div style={{ width:72, height:72, borderRadius:'50%', background: bandColour, color:'#fff', display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
            <div style={{ fontSize:'1.5rem', fontWeight:800, lineHeight:1 }}>{data.score}</div>
            <div style={{ fontSize:'0.625rem', opacity:0.9, marginTop:2 }}>/ 100</div>
          </div>
          <div>
            <div style={{ fontWeight:800, fontSize:'1rem', color: bandColour }}>{bandLabel}</div>
            <div style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', marginTop:4 }}>
              This is what banks see on your application. Higher scores get faster decisions and better rates.
            </div>
          </div>
        </div>
        {nextWin && (
          <div style={{ background:'rgba(22,163,74,.06)', border:'1px solid rgba(22,163,74,.25)', borderRadius:8, padding:'10px 12px', fontSize:'0.8125rem' }}>
            <strong>Biggest single jump available:</strong> {nextWin.label} — {nextWin.evidence}
          </div>
        )}
        <div style={{ marginTop:12 }}>
          <details style={{ fontSize:'0.8125rem' }}>
            <summary style={{ cursor:'pointer', color:'var(--text-secondary)' }}>How it's calculated</summary>
            <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:4 }}>
              {data.breakdown.map((b, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderTop:i===0?'none':'1px solid var(--border-color)' }}>
                  <span style={{ color:'var(--text-secondary)' }}>{b.label}</span>
                  <span style={{ fontWeight:700, color: b.points > 0 ? '#16a34a' : b.points < 0 ? '#dc2626' : 'var(--text-secondary)' }}>
                    {b.points > 0 ? '+' : ''}{b.points} pts
                  </span>
                </div>
              ))}
            </div>
          </details>
        </div>
      </CardBody>
    </Card>
  );
}

/**
 * Switch monitor — for users with an existing bond. Tells them whether
 * a market-rate switch would meaningfully save them money.
 */
export function SwitchMonitorCard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    me.switchMonitor().then(setData).catch(() => setData(false));
  }, []);
  if (data === false || !data?.available) return null;

  return (
    <Card style={{ marginBottom: 'var(--space-5)' }}>
      <CardHeader>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <TrendingDown size={16} /> Switch monitor
        </span>
      </CardHeader>
      <CardBody>
        <p style={{ margin:'0 0 12px', fontSize:'0.875rem', color:'var(--text-secondary)' }}>
          We watch your bond rate against the market for you. Here's where you stand right now.
        </p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>Your rate</div>
            <div style={{ fontWeight:800, fontSize:'1.125rem' }}>{fmtPct(data.currentRate)}</div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>{fmt(data.currentMonthly)}/mo</div>
          </div>
          <div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>Best market rate</div>
            <div style={{ fontWeight:800, fontSize:'1.125rem', color: data.worthSwitching ? '#16a34a' : 'inherit' }}>{fmtPct(data.bestMarketRate)}</div>
            <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>{fmt(data.bestMonthly)}/mo</div>
          </div>
        </div>
        <div style={{ marginTop:12, padding:'10px 12px', background: data.worthSwitching ? 'rgba(22,163,74,.06)' : 'rgba(0,0,0,.04)', borderRadius:8, fontSize:'0.8125rem' }}>
          {data.explainer}
        </div>
        {data.worthSwitching && (
          <Link to="/switch" style={{ display:'inline-block', marginTop:12, padding:'8px 16px', background:'var(--lime)', color:'var(--forest)', borderRadius:6, fontWeight:700, fontSize:'0.875rem', textDecoration:'none' }}>
            Start a switch →
          </Link>
        )}
      </CardBody>
    </Card>
  );
}

/**
 * Rate-drop projection — pre-positions users for SARB cuts.
 */
export function RateDropProjectionCard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    me.rateDropProjection().then(setData).catch(() => setData(false));
  }, []);
  if (data === false || !data?.available || !data?.scenarios?.length) return null;

  return (
    <Card style={{ marginBottom: 'var(--space-5)' }}>
      <CardHeader>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Sparkles size={16} /> If SARB cuts rates…
        </span>
      </CardHeader>
      <CardBody>
        <p style={{ margin:'0 0 14px', fontSize:'0.875rem', color:'var(--text-secondary)' }}>
          Prime is currently <strong>{fmtPct(data.currentPrime)}</strong>. Here's how much more bond you'd qualify for at lower rates.
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {data.scenarios.map((s, i) => (
            <div key={i} style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', alignItems:'center', gap:8, padding:'10px 12px', background:'var(--card-bg)', border:'1px solid var(--border-color)', borderRadius:8 }}>
              <div>
                <div style={{ fontWeight:700, fontSize:'0.875rem' }}>Prime −{s.primeDeltaPct}%</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>{fmtPct(s.newPrimeRate)}</div>
              </div>
              <div style={{ textAlign:'center' }}>
                <div style={{ fontSize:'0.875rem' }}>{fmt(s.newMaxBond)}</div>
                <div style={{ fontSize:'0.6875rem', color:'var(--text-secondary)' }}>max bond</div>
              </div>
              <div style={{ textAlign:'right', color:'#16a34a', fontWeight:700, fontSize:'0.875rem' }}>+{fmt(s.unlock)}</div>
            </div>
          ))}
        </div>
        <p style={{ margin:'12px 0 0', fontSize:'0.75rem', color:'var(--text-secondary)' }}>
          We auto-update these scenarios when SARB moves. Tap "Watch & alert" in your profile to be the first to know.
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * Pre-qualification certificate — single button that downloads the PDF.
 */
export function PreQualCertificateCard() {
  return (
    <Card style={{ marginBottom: 'var(--space-5)' }}>
      <CardHeader>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <ShieldCheck size={16} /> Pre-qualification certificate
        </span>
      </CardHeader>
      <CardBody>
        <p style={{ margin:'0 0 12px', fontSize:'0.875rem', color:'var(--text-secondary)' }}>
          A PDF you can hand to estate agents — shows your Bondly Quality Score, verified income, and qualifying bond. Valid for 30 days.
        </p>
        <a href={me.prequalCertificateUrl()} target="_blank" rel="noopener noreferrer"
           style={{ display:'inline-block', padding:'8px 16px', background:'var(--forest,#152d4a)', color:'#fff', borderRadius:6, fontWeight:700, fontSize:'0.875rem', textDecoration:'none' }}>
          Download my certificate →
        </a>
      </CardBody>
    </Card>
  );
}

/**
 * Peer benchmark — "people like you" bond capacity comparison.
 * Uses platform's own snapshot history (income-banded peers); self-hides
 * when fewer than 5 peers exist in the band to avoid creepy/thin claims.
 */
export function PeerBenchmarkCard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    me.peerBenchmark().then(setData).catch(() => setData(false));
  }, []);
  if (data === false || !data?.available) return null;

  const ahead = typeof data.myPercentile === 'number' && data.myPercentile >= 50;
  const headline = data.myPercentile === null
    ? `${data.peerCount} Bondly users in your income band typically qualify for around ${fmt(data.peers.median)}.`
    : ahead
      ? `You qualify for more than ${data.myPercentile}% of people in your income band.`
      : `Most people in your income band qualify for more — there's room to close the gap.`;

  return (
    <Card style={{ marginBottom: 'var(--space-5)' }}>
      <CardHeader>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Users size={16} /> People earning what you earn
        </span>
      </CardHeader>
      <CardBody>
        <p style={{ margin:'0 0 12px', fontSize:'0.875rem', color:'var(--text-secondary)' }}>{headline}</p>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr 1fr', gap:8, marginBottom: 12 }}>
          {[['Bottom 25%', data.peers.p25], ['Median', data.peers.median], ['Top 25%', data.peers.p75]].map(([label, val]) => (
            <div key={label} style={{ padding:'10px 8px', background:'var(--bg-page)', border:'1px solid var(--border-color)', borderRadius:8, textAlign:'center' }}>
              <div style={{ fontSize:'0.6875rem', color:'var(--text-secondary)', textTransform:'uppercase', letterSpacing:'.05em' }}>{label}</div>
              <div style={{ fontWeight:700, fontSize:'0.9375rem' }}>{fmt(val)}</div>
            </div>
          ))}
        </div>
        <p style={{ margin:0, fontSize:'0.75rem', color:'var(--text-secondary)' }}>
          Based on {data.peerCount} Bondly users earning between {fmt(data.band.from)} and {fmt(data.band.to)} per month. Anonymous, aggregated.
        </p>
      </CardBody>
    </Card>
  );
}

/**
 * Subscription cancel concierge — table of detected subscriptions with a
 * direct cancel link per provider. Cancels are still manual (banks block
 * programmatic cancellation), but eliminating the "where do I go to cancel?"
 * Googling cuts the friction from minutes to seconds.
 */
export function SubscriptionCancelCard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    me.subscriptionCancels().then(setData).catch(() => setData(false));
  }, []);
  if (data === false || !data?.available || !data.subscriptions?.length) return null;

  return (
    <Card style={{ marginBottom: 'var(--space-5)' }}>
      <CardHeader>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Scissors size={16} /> Subscription cancel concierge
        </span>
      </CardHeader>
      <CardBody>
        <p style={{ margin:'0 0 14px', fontSize:'0.875rem', color:'var(--text-secondary)' }}>
          We spotted <strong>{data.subscriptions.length}</strong> recurring subscriptions costing <strong>{fmt(data.totalMonthly)}/mo</strong>.
          Cancelling the ones you don't use could save up to <strong>{fmt(data.annualSavingsIfAllCancelled)}</strong> a year.
        </p>
        <ul style={{ listStyle:'none', padding:0, margin:0 }}>
          {data.subscriptions.slice(0, 8).map((s, i) => (
            <li key={i} style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 0', borderTop: i === 0 ? 'none' : '1px dashed var(--border-color)' }}>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:'0.875rem' }}>{s.provider}</div>
                <div style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>{s.howTo}</div>
              </div>
              <div style={{ textAlign:'right', minWidth: 80 }}>
                <div style={{ fontWeight:700, fontSize:'0.875rem' }}>{fmt(s.monthly)}/mo</div>
              </div>
              {s.cancelUrl ? (
                <a href={s.cancelUrl} target="_blank" rel="noopener noreferrer"
                   style={{ padding:'6px 10px', background:'var(--lime,#c8a84b)', color:'var(--forest,#152d4a)', borderRadius:6, fontSize:'0.75rem', fontWeight:700, textDecoration:'none', whiteSpace:'nowrap' }}>
                  Cancel →
                </a>
              ) : (
                <span style={{ padding:'6px 10px', background:'var(--bg-page)', color:'var(--text-secondary)', borderRadius:6, fontSize:'0.75rem', whiteSpace:'nowrap' }}>
                  Manual
                </span>
              )}
            </li>
          ))}
        </ul>
        <p style={{ margin:'12px 0 0', fontSize:'0.75rem', color:'var(--text-secondary)' }}>
          Cancelling is still done on the provider's site — we just save you the Google search.
        </p>
      </CardBody>
    </Card>
  );
}
