import { useEffect, useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { bankApi, bankFmtR, bankFmtPct } from './bankApi.js';

/**
 * Daily standup view — the bank opens this with their morning coffee and gets:
 *   - what happened in the last 24h (new applications, auto-bids, wins, losses)
 *   - what's waiting on them (milestones, high-quality unbid deals)
 *   - their expected pipeline value
 *   - a live ticker for events as they happen
 */
export default function BankDashboard() {
  const [standup,  setStandup]  = useState(null);
  const [forecast, setForecast] = useState(null);
  const [feed,     setFeed]     = useState([]);
  const feedRef = useRef([]);
  const [err, setErr] = useState(null);
  const [me, setMe] = useState(null);

  useEffect(() => {
    bankApi.standup().then(setStandup).catch(e => setErr(e.message));
    bankApi.pipelineForecast().then(setForecast).catch(() => {});
    bankApi.me().then(setMe).catch(() => {});
  }, []);

  // Live SSE — show new applications + bids as they happen
  useEffect(() => {
    let es;
    bankApi.openEventSource().then(src => {
      if (!src) return;
      es = src;
      src.onmessage = (e) => {
        try {
          const evt = JSON.parse(e.data);
          if (['new_application', 'new_bid', 'competitor_win'].includes(evt.type)) {
            feedRef.current = [evt, ...feedRef.current].slice(0, 15);
            setFeed([...feedRef.current]);
          }
        } catch {}
      };
      src.onerror = () => { /* silent — EventSource auto-reconnects */ };
    });
    return () => es?.close();
  }, []);

  if (err)      return <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>;
  if (!standup) return <div className="bank-section">Loading your morning briefing…</div>;

  const time = new Date().getHours();
  const greeting = time < 12 ? 'Good morning' : time < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      <ExecSummary standup={standup} forecast={forecast} />
      {standup.fraudFlaggedActive > 0 && (
        <div style={{ background: '#fef2f2', border: '1px solid #fca5a5', borderRadius: 10, padding: '12px 16px', marginBottom: 20, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '1.2rem' }}>🚨</span>
            <div>
              <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.9rem' }}>{standup.fraudFlaggedActive} active bid{standup.fraudFlaggedActive === 1 ? '' : 's'} linked to flagged fraud networks</div>
              <div style={{ fontSize: '0.78rem', color: '#b91c1c', marginTop: 2 }}>Review before bidding closes — these require immediate attention.</div>
            </div>
          </div>
          <a href="/bank/intelligence" style={{ padding: '7px 14px', background: '#dc2626', color: '#fff', borderRadius: 7, fontSize: '0.78rem', fontWeight: 800, textDecoration: 'none', whiteSpace: 'nowrap' }}>Review now →</a>
        </div>
      )}
      <h2>{greeting}, {((me?.user?.name || me?.name) || '').trim().split(/\s+/)[0] || standup.bankName}</h2>
      <p className="lede">Here's what's happened since this time yesterday.</p>

      {/* Standup KPIs — last-24h snapshot */}
      <div className="bank-kpis">
        <Kpi label="New applications (24h)"     v={standup.newApplications} sub={standup.highQualityNew.length ? `${standup.highQualityNew.length} high-quality` : null} />
        <Kpi label="Auto-bids placed (24h)"     v={standup.autoBidsToday} good={standup.autoBidsToday > 0} />
        <Kpi label="Won (24h)"                  v={standup.wonToday} good={standup.wonToday > 0} />
        <Kpi label="Lost (24h)"                 v={standup.lostToday} bad={standup.lostToday > 3} />
        <Kpi label="Active pipeline value"      v={bankFmtR(standup.pipelineValue)} />
        <Kpi label="Awaiting your action"       v={standup.awaitingMyMilestone} sub="conveyancing milestones" warn={standup.awaitingMyMilestone > 0} />
      </div>

      {/* Quick links */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <Link to="/bank/applications" style={primaryLink}>Browse open mortgages →</Link>
        <Link to="/bank/auto-bid"     style={ghostLink}>Manage auto-bid rules</Link>
        <Link to="/bank/analytics"    style={ghostLink}>Open analytics</Link>
        <Link to="/bank/deals"        style={ghostLink}>My deals</Link>
      </div>

      {/* High-quality unseen — the most actionable thing */}
      {standup.highQualityNew && standup.highQualityNew.length > 0 && (
        <div className="bank-section" style={{ background: 'linear-gradient(180deg, #fefce8 0%, #ffffff 100%)', borderColor: '#fde68a' }}>
          <h3 style={{ color: '#78350f' }}>⭐ High-quality deals you haven't bid on yet</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 10 }}>
            {standup.highQualityNew.map(a => (
              <Link key={a.ref} to={`/bank/applications/${a.ref}`}
                style={{ padding: 14, background: '#fff', border: '1px solid #fde68a', borderRadius: 10, textDecoration: 'none', color: 'inherit' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.85rem' }}>{a.ref}</span>
                  <span style={{ background: '#dcfce7', color: '#166534', padding: '1px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800 }}>Q {a.qualityScore}</span>
                </div>
                <div style={{ fontSize: '1.1rem', fontWeight: 800 }}>{bankFmtR(a.requestedAmount)}</div>
                <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{a.type === 'swap' ? 'Switch' : 'New bond'} · {a.region}</div>
              </Link>
            ))}
          </div>
        </div>
      )}

      <TargetPlanner />

      {/* Pipeline forecast */}
      {forecast && (
        <div className="bank-section">
          <h3>Pipeline forecast</h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 }}>
            <ForecastBlock label="Active bids"           v={forecast.activeBids} />
            <ForecastBlock label="Pipeline value"        v={bankFmtR(forecast.pipelineValue)} sub="total amount on open bids" />
            <ForecastBlock label="Expected to win"       v={bankFmtR(forecast.expectedAmount)} sub="× win rate per quality band" good />
            <ForecastBlock label="Est. 20-yr interest"   v={bankFmtR(forecast.expectedInterest)} sub="~1.5% margin assumption" good />
            <ForecastBlock label="Already won"           v={bankFmtR(forecast.wonValue)} sub="locked-in pipeline" />
            <ForecastBlock label="Won deals 20-yr value" v={bankFmtR(forecast.wonInterest)} sub="lifetime interest income" />
          </div>
        </div>
      )}

      {/* Live event ticker */}
      <div className="bank-section">
        <h3>{feed.length === 0 ? 'Live feed' : `Live · last ${feed.length} event${feed.length === 1 ? '' : 's'}`} <span style={{ fontSize: '0.7rem', color: '#16a34a', marginLeft: 6 }}>● connected</span></h3>
        {feed.length === 0 ? (
          <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>Listening for new applications and bids… they'll appear here in real time.</div>
        ) : (
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {feed.map((e, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #f3f4f6', fontSize: '0.85rem' }}>
                <span>
                  {e.type === 'new_application' ? '🆕 New application' : e.type === 'new_bid' ? '💰 Bid placed' : '🎯 Competitor won'}
                  {' '}
                  {e.ref && <Link to={`/bank/applications/${e.ref}`} style={{ fontFamily: 'monospace', color: '#0b1e2d' }}>{e.ref}</Link>}
                  {e.qualityScore != null && <span style={{ color: '#6b7280', marginLeft: 6 }}>· Q{e.qualityScore}</span>}
                  {e.amount      != null && <span style={{ color: '#6b7280', marginLeft: 6 }}>· {bankFmtR(e.amount)}</span>}
                  {e.rate        != null && <span style={{ color: '#6b7280', marginLeft: 6 }}>· {bankFmtPct(e.rate)} by {e.bankSlug}</span>}
                  {e.winningRateRounded != null && <span style={{ color: '#dc2626', marginLeft: 6 }}>· ~{bankFmtPct(e.winningRateRounded)} by {e.winningBankSlug}</span>}
                </span>
                <span style={{ color: '#9ca3af', fontSize: '0.74rem' }}>{new Date(e.at).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

function ExecSummary({ standup, forecast }) {
  const total = (standup.wonToday || 0) + (standup.lostToday || 0);
  let marketLabel, marketColor;
  if (total === 0) {
    if (standup.avgGapBps != null) {
      marketLabel = `Quiet day — recent losses ran ${standup.avgGapBps}bp off the winner; sharpen pricing to convert`;
    } else {
      marketLabel = 'No bids resolved today — review open deals to stay in the running';
    }
    marketColor = '#6b7280';
  } else {
    const pct = Math.round((standup.wonToday / total) * 100);
    marketLabel = `Winning ${pct}% of bids this week`;
    if (standup.avgGapBps != null) marketLabel += ` · ${standup.avgGapBps}bp avg gap`;
    if (pct < 30) marketLabel += ' — sharpen to compete';
    else if (pct < 50) marketLabel += ' — room to push';
    marketColor = pct >= 50 ? '#15803d' : pct >= 30 ? '#b45309' : '#b91c1c';
  }
  const marketDot = total === 0 ? '#9ca3af' : marketColor;

  const pipelineColor = forecast && forecast.activeBids > 0 ? '#15803d' : '#6b7280';
  const pipelineDot   = pipelineColor;
  const pipelineLabel = forecast
    ? `Pipeline: R${Number(forecast.pipelineValue || 0).toLocaleString('en-ZA')} · ${forecast.activeBids} active bids`
    : '—';

  const waiting = standup.awaitingMyMilestone || 0;
  const actionColor = waiting > 0 ? (waiting >= 3 ? '#b91c1c' : '#b45309') : '#15803d';
  const actionLabel = waiting > 0 ? `${waiting} conveyancing milestones waiting` : 'All clear';

  const cards = [
    { label: 'Market position',  value: marketLabel,   dot: marketDot,   color: marketColor },
    { label: 'Pipeline',         value: pipelineLabel, dot: pipelineDot, color: pipelineColor },
    { label: 'Action required',  value: actionLabel,   dot: actionColor, color: actionColor },
  ];

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 24 }}>
      {cards.map(({ label, value, dot, color }) => (
        <div key={label} style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: dot, flexShrink: 0, display: 'inline-block' }} />
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#6b7280', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: 2 }}>{label}</div>
            <div style={{ fontSize: '0.92rem', fontWeight: 800, color, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

function Kpi({ label, v, sub, good, bad, warn }) {
  return (
    <div className="bank-kpi" style={good ? { borderColor: '#bbf7d0' } : bad ? { borderColor: '#fecaca' } : warn ? { borderColor: '#fde68a' } : null}>
      <div className="label">{label}</div>
      <div className="value" style={{ color: good ? '#15803d' : bad ? '#b91c1c' : warn ? '#b45309' : undefined }}>{v}</div>
      {sub && <div className="sub">{sub}</div>}
    </div>
  );
}
function ForecastBlock({ label, v, sub, good }) {
  return (
    <div style={{ padding: 14, background: '#fff', border: '1px solid #e5e7eb', borderRadius: 8 }}>
      <div style={{ fontSize: '0.7rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '1.25rem', fontWeight: 800, marginTop: 4, color: good ? '#15803d' : '#0f1a24' }}>{v}</div>
      {sub && <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
function TargetPlanner() {
  const [target, setTarget] = useState('50000000');
  const [plan, setPlan]     = useState(null);
  const [busy, setBusy]     = useState(false);
  async function compute() {
    setBusy(true);
    try { const r = await bankApi.targetPlanner(target); setPlan(r); }
    catch {} finally { setBusy(false); }
  }
  return (
    <div className="bank-section" style={{ background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)', borderColor: '#ddd6fe' }}>
      <h3 style={{ color: '#5b21b6' }}>🎯 Hit-my-target planner</h3>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
        <label style={{ flex: 1 }}>
          <div style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', marginBottom: 4 }}>Booked target (R)</div>
          <input type="text" inputMode="numeric"
            value={target ? 'R ' + Number(target).toLocaleString('en-ZA').replace(/,/g, ' ') : ''}
            onChange={e => setTarget(e.target.value.replace(/[^\d]/g, ''))}
            style={{ width: '100%', padding: '8px 10px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: '0.9rem' }} />
        </label>
        <button onClick={compute} disabled={busy}
          style={{ padding: '9px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
          {busy ? '…' : 'Plan'}
        </button>
      </div>
      {plan && (
        <div style={{ marginTop: 12, padding: 10, background: '#fff', borderRadius: 6, fontSize: '0.85rem', color: '#0f1a24', lineHeight: 1.6 }}>
          To hit <strong>{bankFmtR(plan.target)}</strong> in bookings, place <strong>{plan.bidsNeeded}</strong> bids — based on your {plan.winRate}% win rate and average deal size of {bankFmtR(plan.avgDealSize)}.
          Estimated 20-yr interest income: <strong>{bankFmtR(plan.estimatedLifetimeInterest)}</strong>.
        </div>
      )}
      {plan && plan.wonToDateValue != null && plan.monthTarget != null && (
        <div style={{ marginTop: 8, padding: '8px 12px', background: plan.onTrack ? '#f0fdf4' : '#fef3c7', borderRadius: 6, display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ fontSize: '1.1rem' }}>{plan.onTrack ? '✅' : '⚠️'}</span>
          <div style={{ fontSize: '0.82rem' }}>
            <strong style={{ color: plan.onTrack ? '#15803d' : '#b45309' }}>{plan.onTrack ? 'On track' : 'Behind pace'}</strong>
            {' — '}booked {bankFmtR(plan.wonToDateValue)} of {bankFmtR(plan.monthTarget)} target this month
            {plan.projectedValue != null && <span style={{ color: '#6b7280' }}> · projected {bankFmtR(plan.projectedValue)} at current pace</span>}
          </div>
        </div>
      )}
    </div>
  );
}

const primaryLink = { padding: '11px 18px', background: '#c8a84b', color: '#0b1e2d', borderRadius: 8, fontWeight: 800, textDecoration: 'none', fontSize: '0.875rem' };
const ghostLink   = { padding: '11px 18px', background: '#fff', color: '#0b1e2d', border: '1px solid #e5e7eb', borderRadius: 8, fontWeight: 700, textDecoration: 'none', fontSize: '0.875rem' };
