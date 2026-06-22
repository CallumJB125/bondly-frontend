import { useEffect, useState } from 'react';
import { bankApi, bankFmtPct, bankFmtR } from './bankApi.js';
import LineChart from '../../components/LineChart.jsx';

/**
 * Win/loss analytics — the feedback loop banks need to improve pricing.
 * Shows overall conversion, win rate by quality band, recent loss gaps,
 * and bids-per-week trend.
 */
export default function BankAnalytics() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  useEffect(() => { bankApi.analytics().then(setData).catch(e => setErr(e.message)); }, []);

  if (err)   return <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>;
  if (!data) return <div className="bank-section">Loading…</div>;

  const s = data.summary;
  const weeks = data.bidsPerWeek || [];
  const maxBids = Math.max(...weeks.map(w => w.bidCount), 1);

  return (
    <>
      <h2>Portfolio &amp; risk</h2>
      <p className="lede">How you're doing across the Bond Desk — what's working, what's not.</p>

      <div className="bank-kpis">
        <Kpi label="Total bids" v={s.totalBids} />
        <Kpi label="Won" v={s.wonBids} good />
        <Kpi label="Lost" v={s.lostBids} />
        <Kpi label="Win rate" v={s.winRate == null ? '—' : s.winRate + '%'} good={s.winRate != null && s.winRate >= 30} bad={s.winRate != null && s.winRate < 15} />
        <Kpi label="Avg gap behind winner" v={s.avgGapBp == null ? '—' : s.avgGapBp + ' bp'} sub="on lost deals — how much sharper to win" bad={s.avgGapBp != null && s.avgGapBp > 30} />
        <Kpi
          label="Median time to bid"
          v={s.medianTimeToBidMins == null ? '—' : s.medianTimeToBidMins + ' min'}
          sub={s.speedPercentile != null
            ? `faster than ${s.speedPercentile}% of banks`
            : 'from application submit'}
          good={s.speedPercentile != null && s.speedPercentile >= 75}
        />
      </div>

      {data.responsiveness && data.responsiveness.lift != null && (
        <div className="bank-section" style={{ background: 'linear-gradient(180deg, #fefce8 0%, #ffffff 100%)', borderColor: '#fde68a' }}>
          <h3 style={{ color: '#78350f' }}>⚡ Responsiveness matters</h3>
          <Narrative text={
            data.responsiveness.lift > 0
              ? `Bidding within 30 minutes wins ${data.responsiveness.fastWinRate ?? '?'}% of the time vs ${data.responsiveness.slowWinRate ?? '?'}% when you bid later — a ${data.responsiveness.lift} pp lift that auto-bid can capture automatically.`
              : `Speed hasn't been a decisive factor in your results yet — fast and slow bids are converting at similar rates.`
          } />
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 12, marginTop: 8 }}>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Bid within 30 min</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4 }}>{data.responsiveness.fastWinRate != null ? data.responsiveness.fastWinRate + '%' : '—'} <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>win rate</span></div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{data.responsiveness.fastBids} bids</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Bid later</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: 4 }}>{data.responsiveness.slowWinRate != null ? data.responsiveness.slowWinRate + '%' : '—'} <span style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 500 }}>win rate</span></div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{data.responsiveness.slowBids} bids</div>
            </div>
            <div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700 }}>Lift from speed</div>
              <div style={{ fontSize: '1.4rem', fontWeight: 800, color: data.responsiveness.lift > 0 ? '#15803d' : '#b91c1c', marginTop: 4 }}>{data.responsiveness.lift > 0 ? '+' : ''}{data.responsiveness.lift} pp</div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>{data.responsiveness.lift > 0 ? 'enable auto-bid to capture this' : 'speed not (yet) decisive'}</div>
            </div>
          </div>
        </div>
      )}

      <div className="bank-section">
        <h3>Win rate by Bondly quality band</h3>
        <Narrative text={(() => {
          const bands = data.winRateByScore || [];
          const best = bands.reduce((a, b) => ((b.winRate ?? 0) > (a.winRate ?? 0) ? b : a), bands[0] || {});
          const highBand = bands.find(b => b.band && b.band.toString().startsWith('85'));
          const highRate = highBand?.winRate;
          if (best.band && best.winRate != null) {
            return highRate != null
              ? `Your strongest band is ${best.band} (${best.winRate}% win rate). High-quality (85+) deals close faster and default less — you win ${highRate}% of those, so prioritise them.`
              : `Your strongest win rate is in the ${best.band} quality band (${best.winRate}%). High-quality deals close faster and default less — lean into these.`;
          }
          if (bands.length === 0 || bands.every(b => !b.won && !b.lost)) {
            return 'No bid data yet — place your first bids to see which quality bands you win most.';
          }
          return 'High-quality (85+) deals close faster and default less — track which bands you win most and prioritise those.';
        })()} />
        <div style={{ display: 'grid', gridTemplateColumns: '90px 1fr 100px 100px', gap: 8, fontSize: '0.85rem' }}>
          <div style={{ fontWeight: 700, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Band</div>
          <div style={{ fontWeight: 700, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>Win rate</div>
          <div style={{ fontWeight: 700, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Won</div>
          <div style={{ fontWeight: 700, color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em', textAlign: 'right' }}>Lost</div>
          {data.winRateByScore.map(b => (
            <RowFragment key={b.band}>
              <div style={{ fontWeight: 700 }}>{b.band}</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ flex: 1, background: '#f3f4f6', borderRadius: 4, height: 16, overflow: 'hidden' }}>
                  <div style={{ width: (b.winRate ?? 0) + '%', height: '100%', background: (b.winRate ?? 0) >= 40 ? '#16a34a' : (b.winRate ?? 0) >= 20 ? '#c8a84b' : '#dc2626' }} />
                </div>
                <span style={{ fontWeight: 700, minWidth: 40, textAlign: 'right' }}>{b.winRate == null ? '—' : b.winRate + '%'}</span>
              </div>
              <div style={{ textAlign: 'right' }}>{b.won}</div>
              <div style={{ textAlign: 'right' }}>{b.lost}</div>
            </RowFragment>
          ))}
        </div>
        <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 10 }}>
          If your win rate drops on higher-quality bands, you may be pricing too conservatively for files everyone wants.
        </div>
      </div>

      <div className="bank-section">
        <h3>Weekly activity — bids &amp; win rate (last {weeks.length} weeks)</h3>
        <Narrative text={(() => {
          if (weeks.length < 2) return 'Bid volume and win rate trend over time — more data will reveal whether your conversion is improving.';
          const recent = weeks.slice(-4);
          const avgRecentWr = recent.filter(w => w.bidCount > 0).map(w => (w.wonCount / w.bidCount) * 100);
          const avg = avgRecentWr.length ? Math.round(avgRecentWr.reduce((a, b) => a + b, 0) / avgRecentWr.length) : null;
          const lastWeek = weeks[weeks.length - 1];
          const lastWr = lastWeek?.bidCount > 0 ? Math.round((lastWeek.wonCount / lastWeek.bidCount) * 100) : null;
          if (avg != null && lastWr != null) {
            return lastWr >= avg
              ? `Your win rate this week (${lastWr}%) is at or above your recent 4-week average of ${avg}% — momentum is positive.`
              : `Your win rate this week (${lastWr}%) is below your recent 4-week average of ${avg}% — consider reviewing your pricing or response time.`;
          }
          return 'Track how your bid volume and win rate move together week-on-week to spot pricing or speed issues early.';
        })()} />
        <div style={{ position: 'relative', height: 120, marginTop: 8 }}>
          <svg width="100%" height="100%" viewBox={`0 0 ${weeks.length * 30} 100`} preserveAspectRatio="none" style={{ display: 'block' }}>
            {/* Bid count bars */}
            {weeks.map((w, i) => (
              <rect key={i}
                x={i * 30 + 4} y={100 - (w.bidCount / maxBids) * 80}
                width={22} height={(w.bidCount / maxBids) * 80}
                fill="#e5e7eb" rx="2"
              />
            ))}
            {/* Win rate line */}
            {weeks.length > 1 && (
              <polyline
                points={weeks.map((w, i) => {
                  const wr = w.bidCount > 0 ? (w.wonCount / w.bidCount) : 0;
                  return `${i * 30 + 15},${100 - wr * 80}`;
                }).join(' ')}
                fill="none" stroke="#c8a84b" strokeWidth="2" strokeLinejoin="round"
              />
            )}
            {/* Win rate dots */}
            {weeks.map((w, i) => {
              const wr = w.bidCount > 0 ? (w.wonCount / w.bidCount) : null;
              if (wr === null) return null;
              return <circle key={i} cx={i * 30 + 15} cy={100 - wr * 80} r="3" fill="#c8a84b" />;
            })}
          </svg>
          {/* X-axis labels */}
          <div style={{ display: 'flex', marginTop: 4 }}>
            {weeks.map((w, i) => (
              <div key={i} style={{ flex: 1, fontSize: '0.6rem', color: '#9ca3af', textAlign: 'center', overflow: 'hidden' }}>
                {w.week ? w.week.slice(5) : w.weekStartISO ? w.weekStartISO.slice(5) : `W${i + 1}`}
              </div>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 14, marginTop: 8, fontSize: '0.72rem' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 12, height: 12, background: '#e5e7eb', borderRadius: 2 }} /> Bids</span>
          <span style={{ display: 'flex', alignItems: 'center', gap: 5 }}><span style={{ display: 'inline-block', width: 12, height: 3, background: '#c8a84b', borderRadius: 2, marginBottom: 1 }} /> Win rate</span>
        </div>

        {/* Banded win-rate trend (A4.3) — overall vs fast-response win-rate over
            the same weeks, rendered with the shared multi-series LineChart.
            Both series are real, derived from bidsPerWeek; no synthetic curve. */}
        {weeks.length > 1 && (() => {
          const labels = weeks.map((w, i) => w.week || w.weekStartISO || `2000-W${i + 1}`);
          const overall = weeks.map(w => w.bidCount > 0 ? Math.round((w.wonCount / w.bidCount) * 100) : null);
          const fast = weeks.map(w => (w.fastCount > 0) ? Math.round(((w.fastWonCount ?? 0) / w.fastCount) * 100) : null);
          const series = [{ values: overall, color: '#c8a84b', label: 'Overall' }];
          if (fast.some(v => v != null)) series.push({ values: fast, color: '#16a34a', label: 'Fast-response' });
          return (
            <div style={{ marginTop: 18 }}>
              <div style={{ fontSize: '0.72rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                Win-rate trend (%)
              </div>
              <LineChart series={series} labels={labels} height={150} yLabel="Win rate %" />
              <div style={{ display: 'flex', gap: 14, marginTop: 4, fontSize: '0.72rem' }}>
                {series.map(s => (
                  <span key={s.label} style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    <span style={{ display: 'inline-block', width: 12, height: 3, background: s.color, borderRadius: 2 }} /> {s.label}
                  </span>
                ))}
              </div>
            </div>
          );
        })()}
      </div>

      {data.winRateByProvince && data.winRateByProvince.length > 0 && (
        <div className="bank-section">
          <h3>Win rate by province</h3>
          <Narrative text={(() => {
            const provs = data.winRateByProvince;
            const sorted = [...provs].sort((a, b) => b.winRate - a.winRate);
            const best = sorted[0];
            const worst = sorted[sorted.length - 1];
            if (best && worst && best.province !== worst.province) {
              return `You win ${best.winRate}% of deals in ${best.province} but only ${worst.winRate}% in ${worst.province} — your rate may need regional calibration.`;
            }
            return 'Win rates vary by province — strong regions show where your pricing is most competitive.';
          })()} />
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.85rem' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #e5e7eb' }}>
                {['Province','Bids','Won','Win rate'].map(h => (
                  <th key={h} style={{ textAlign: 'left', padding: '6px 8px', fontSize: '0.7rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.winRateByProvince.map(r => (
                <tr key={r.province} style={{ borderBottom: '1px solid #f3f4f6' }}>
                  <td style={{ padding: '7px 8px', fontWeight: 600 }}>{r.province}</td>
                  <td style={{ padding: '7px 8px', color: '#6b7280' }}>{r.bids}</td>
                  <td style={{ padding: '7px 8px', color: '#15803d', fontWeight: 700 }}>{r.wins}</td>
                  <td style={{ padding: '7px 8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <div style={{ flex: 1, height: 5, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden', maxWidth: 80 }}>
                        <div style={{ width: r.winRate + '%', height: '100%', background: r.winRate >= 30 ? '#16a34a' : r.winRate >= 15 ? '#c8a84b' : '#dc2626' }} />
                      </div>
                      <span style={{ fontWeight: 700, color: r.winRate >= 30 ? '#15803d' : r.winRate >= 15 ? '#78350f' : '#991b1b' }}>{r.winRate}%</span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {data.recentLossGaps && data.recentLossGaps.length > 0 && (
        <div className="bank-section">
          <h3>Recent losses — and how close you were</h3>
          <Narrative text={(() => {
            const gaps = data.recentLossGaps;
            const avgGap = gaps.length ? Math.round(gaps.reduce((a, g) => a + (g.gapBp ?? 0), 0) / gaps.length) : null;
            const closeOnes = gaps.filter(g => (g.gapBp ?? 999) <= 10).length;
            if (avgGap != null && closeOnes > 0) {
              return `You lost ${gaps.length} recent deals by an average of ${avgGap} bp — ${closeOnes} of them by 10 bp or less. Tightening slightly on those deals would likely flip them to wins.`;
            }
            if (avgGap != null) {
              return `You lost ${gaps.length} recent deals by an average of ${avgGap} bp — review where you were closest to understand where targeted rate cuts would have the most impact.`;
            }
            return 'Each row shows exactly how far off the winning rate you were — the smaller the gap, the easier the win with a small rate adjustment.';
          })()} />
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ textAlign: 'left', color: '#6b7280', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                <th style={th}>Application</th>
                <th style={{ ...th, textAlign: 'right' }}>Your rate</th>
                <th style={{ ...th, textAlign: 'right' }}>Winning rate</th>
                <th style={{ ...th, textAlign: 'right' }}>Gap</th>
                <th style={th}>When</th>
              </tr>
            </thead>
            <tbody>
              {data.recentLossGaps.map((g, i) => (
                <tr key={i}>
                  <td style={td}><span style={{ fontFamily: 'monospace' }}>{g.ref}</span></td>
                  <td style={{ ...td, textAlign: 'right' }}>{bankFmtPct(g.yourRate)}</td>
                  <td style={{ ...td, textAlign: 'right' }}>{bankFmtPct(g.winningRate)}</td>
                  <td style={{ ...td, textAlign: 'right', fontWeight: 700, color: g.gapBp > 30 ? '#dc2626' : g.gapBp > 10 ? '#b45309' : '#15803d' }}>{g.gapBp} bp</td>
                  <td style={{ ...td, color: '#6b7280', fontSize: '0.75rem' }}>{new Date(g.when).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <div className="bank-section">
        <h3>Estimated profitability on won book</h3>
        <Narrative text={(() => {
          const nim = data.estimatedNimBps;
          const wonVal = data.summary?.wonBookValue;
          if (nim != null && wonVal != null) {
            const nimPct = (nim / 100).toFixed(2);
            const annualIncome = Math.round(wonVal * nim / 10000);
            return `Your estimated net interest margin on the won book is ${nim}bps (${nimPct}%), generating ~R${annualIncome.toLocaleString('en-ZA')}/yr. ${nim < 80 ? 'Margin is thin — you may be winning volume at the expense of profitability. Consider a pricing floor on future bids.' : nim < 130 ? 'Margin is healthy — your pricing is competitive without giving away too much spread.' : 'Strong margin. Your rates are competitive while preserving solid profitability.'}`;
          }
          if (wonVal != null) {
            return `Won book value: R${wonVal.toLocaleString('en-ZA')}. NIM data not yet available — will populate once pricing data is complete.`;
          }
          return 'Profitability analysis will appear here once you have won deals. Tracks estimated net interest margin (NIM) against market benchmarks.';
        })()} />

        {data.wonBookByQuality && data.wonBookByQuality.length > 0 ? (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
            {data.wonBookByQuality.map(b => (
              <div key={b.band} style={{ padding: '12px 14px', background: '#f9fafb', borderRadius: 8, border: '1px solid #e5e7eb' }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em' }}>Band {b.band}</div>
                <div style={{ fontSize: '1.05rem', fontWeight: 800, marginTop: 4, color: '#0f1a24' }}>{b.nimBps != null ? b.nimBps + 'bps' : '—'}</div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 2 }}>{bankFmtR(b.bookValue)} won</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
            {[
              { label: 'Won book value', v: data.summary?.wonBookValue != null ? bankFmtR(data.summary.wonBookValue) : '—', sub: 'total accepted bids' },
              { label: 'Est. NIM', v: data.estimatedNimBps != null ? data.estimatedNimBps + ' bps' : '—', sub: 'above cost of funds', good: data.estimatedNimBps != null && data.estimatedNimBps >= 100 },
              { label: 'Annual interest income', v: data.estimatedAnnualIncome != null ? bankFmtR(data.estimatedAnnualIncome) : '—', sub: 'on current won book', good: data.estimatedAnnualIncome != null },
            ].map(s => (
              <div key={s.label} style={{ padding: '12px 14px', background: s.good ? '#f0fdf4' : '#f9fafb', border: '1px solid ' + (s.good ? '#bbf7d0' : '#e5e7eb'), borderRadius: 8 }}>
                <div style={{ fontSize: '0.68rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em' }}>{s.label}</div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800, marginTop: 4, color: s.good ? '#15803d' : '#0f1a24' }}>{s.v}</div>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 2 }}>{s.sub}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 10 }}>
          NIM = your rate − prime rate − estimated cost of funds. A healthy mortgage book targets 100–150bps NIM. Winning at rates below prime +0.5% with cost of funds at prime −2% implies very thin margins.
        </div>
      </div>
    </>
  );
}

function Narrative({ text }) {
  return (
    <p style={{ margin: '0 0 12px', fontSize: '0.9rem', color: '#374151', lineHeight: 1.55, padding: '10px 14px', background: '#f0f9ff', borderLeft: '3px solid #0ea5e9', borderRadius: '0 6px 6px 0' }}>
      {text}
    </p>
  );
}

function Kpi({ label, v, sub, good, bad }) {
  return (
    <div className="bank-kpi">
      <div className="label">{label}</div>
      <div className="value" style={{ color: good ? '#15803d' : bad ? '#b91c1c' : undefined }}>{v}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
const th = { padding: '8px 6px', borderBottom: '1px solid #e5e7eb' };
const td = { padding: '8px 6px', borderBottom: '1px solid #f3f4f6' };
function RowFragment({ children }) { return <>{children}</>; }
