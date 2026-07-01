import { useEffect, useRef, useState } from 'react';
import { bankApi } from './bankApi.js';

/**
 * Live ecosystem simulation — a plain-language window into Bondly "in full effect":
 * synthetic customers applying, AI banks competing, fraud caught, and how
 * accurately we predict. The hero is a real-time scrolling event feed
 * (/api/bank/sim-events, polled with a cursor) backed by the aggregate
 * scoreboard (/api/bank/sim-status). Built to be understood at a glance.
 */
export default function BankSimulation() {
  const [s, setS] = useState(null);
  const [err, setErr] = useState(null);
  const [tab, setTab] = useState('overview');

  useEffect(() => {
    let alive = true;
    const load = () => bankApi.simStatus().then(d => { if (alive) setS(d); }).catch(e => alive && setErr(e.message));
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (err) return <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>;
  if (!s || s.empty) return (
    <>
      <HeadlineSummary />
      <RightNowHero />
      <LiveFeed />
    </>
  );

  const o = s.overview || {}, a = s.accuracy || {};
  const pct = x => x == null ? '—' : Math.round(x * 100) + '%';

  const ac = s.accomplishments || {};
  const act = s.activity || {};

  return (
    <div style={{ display: 'grid', gap: 0, paddingBottom: 20 }}>
      <HeadlineSummary />
      <RightNowHero />
      <TabBar tab={tab} setTab={setTab} />
      <div style={{ minHeight: 320, padding: '12px 0' }}>
        {tab === 'overview' && <OverviewTab s={s} />}
        {tab === 'economy' && <EconomyTab s={s} o={o} a={a} pct={pct} ac={ac} />}
        {tab === 'banks' && <BanksTab s={s} />}
        {tab === 'customers' && <CustomersTab s={s} o={o} act={act} />}
      </div>
      <div style={{ height: 280 }}><LiveFeed fill /></div>
    </div>
  );
}

function TabBar({ tab, setTab }) {
  const tabs = [
    { key: 'overview', label: '📊 Overview' },
    { key: 'economy', label: '🧭 Economy' },
    { key: 'banks', label: '🏦 Banks' },
    { key: 'customers', label: '😀 Customers' },
  ];
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '2px solid #e5e7eb', background: '#fff', padding: '0 4px', marginTop: 8 }}>
      {tabs.map(t => (
        <button key={t.key} onClick={() => setTab(t.key)} style={{
          padding: '10px 18px', fontSize: '0.82rem', fontWeight: 700,
          background: 'none', border: 'none', cursor: 'pointer',
          borderBottom: tab === t.key ? '2px solid #0f1a24' : '2px solid transparent',
          color: tab === t.key ? '#0f1a24' : '#64748b',
          marginBottom: -2, transition: 'color 0.15s',
        }}>{t.label}</button>
      ))}
    </div>
  );
}

function MiniEventFeed({ kinds, max = 8, title }) {
  const [events, setEvents] = useState([]);
  const cursor = useRef(0);
  useEffect(() => {
    let alive = true;
    const poll = () => bankApi.simEvents(cursor.current).then(d => {
      if (!alive) return;
      const fresh = (d.events || []).filter(e => !kinds || kinds.includes(e.kind));
      if (!fresh.length) return;
      cursor.current = d.lastSeq || cursor.current;
      setEvents(prev => [...fresh.slice().reverse(), ...prev].slice(0, max));
    }).catch(() => {});
    poll();
    const t = setInterval(poll, 2000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!events.length) return (
    <div style={{ fontSize: '0.78rem', color: '#94a3b8', padding: '12px 0' }}>Waiting for events…</div>
  );

  const KIND_TONE = { upload: '#0ea5e9', bid: '#7c3aed', fraud: '#dc2626', distress: '#d97706', switch: '#0891b2', default: '#b45309', cx: '#db2777' };

  return (
    <div>
      {title && <div style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em', color: '#334155', marginBottom: 8 }}>{title}</div>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
        {events.map((e, i) => (
          <div key={e.seq ?? i} style={{ display: 'flex', gap: 10, padding: '7px 0', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1rem', flexShrink: 0, lineHeight: 1.3 }}>{e.icon || '•'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.84rem', color: '#0f1a24', fontWeight: 600, lineHeight: 1.35 }}>{e.text}</div>
              {e.detail && <div style={{ fontSize: '0.74rem', color: '#64748b', marginTop: 1, lineHeight: 1.3 }}>{e.detail}</div>}
            </div>
            <span style={{ fontSize: '0.6rem', fontWeight: 700, textTransform: 'uppercase', color: KIND_TONE[e.kind] || '#64748b', flexShrink: 0, paddingTop: 2 }}>{e.kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function OverviewTab({ s }) {
  const ac = s.accomplishments || {}, f = s.funnel || {}, o = s.overview || {};
  const stages = f.stages || [];
  const landed = stages[0]?.count || 0;
  const visible = stages[stages.length - 1]?.count || 0;
  const convPct = landed > 0 ? Math.round((visible / landed) * 100) : 0;
  const prog = s.progress || {};

  const sentences = [
    landed > 0 ? `${landed} synthetic customers are in the pipeline, ${convPct}% are reaching banks.` : null,
    prog.topBlocker ? `The main blocker right now: ${prog.topBlocker.slice(0, 120)}.` : null,
    f.topDropReasons?.length ? `Biggest drop-off reason: ${f.topDropReasons[0].reason} (${f.topDropReasons[0].n} customers).` : null,
    o.customerExperience?.nps != null ? `Customer NPS is ${o.customerExperience.nps > 0 ? '+' : ''}${o.customerExperience.nps}${o.customerExperience.worstStep ? ` — roughest step: ${o.customerExperience.worstStep?.label || o.customerExperience.worstStep}` : ''}.` : null,
  ].filter(Boolean);

  return (
    <div style={{ display: 'grid', gap: 12, paddingTop: 4 }}>
      {sentences.length > 0 && (
        <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155', marginBottom: 8, letterSpacing: '0.05em' }}>📝 STATE OF PLAY</div>
          {sentences.map((sent, i) => (
            <div key={i} style={{ fontSize: '0.88rem', color: '#0f1a24', lineHeight: 1.6, marginBottom: i < sentences.length - 1 ? 4 : 0 }}>{sent}</div>
          ))}
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 12 }}>
        <div>
          <AlertsStrip />
        </div>
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
          <MiniEventFeed kinds={null} max={8} title="⚡ WHAT'S HAPPENING NOW" />
        </div>
      </div>
      <TrendStrip />
    </div>
  );
}

function EconomyTab({ s, o, a, pct, ac }) {
  const f = s.funnel || {};
  const act = s.activity || {};
  return (
    <div style={{ display: 'grid', gap: 12, paddingTop: 4 }}>
      <ProgressCard progress={s.progress} />
      <MacHealthCard h={s.macHealth} />
      <FunnelPanel funnel={s.funnel} />
      {/* Drop story */}
      {f.topDropReasons?.length > 0 && (
        <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155', marginBottom: 10, letterSpacing: '0.05em' }}>🔍 WHY CUSTOMERS ARE DROPPING</div>
          {f.topDropReasons.map((r, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, padding: '6px 0', borderBottom: i < f.topDropReasons.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <span style={{ fontSize: '0.82rem', color: '#dc2626', fontWeight: 700, flexShrink: 0 }}>−{r.n}</span>
              <span style={{ fontSize: '0.84rem', color: '#334155' }}>{r.reason}</span>
            </div>
          ))}
        </div>
      )}
      {/* Builder narrative */}
      {act.builder?.building && (
        <div style={{ background: '#fefce8', border: '1px solid #fde68a', borderRadius: 10, padding: '14px 16px' }}>
          <div style={{ fontSize: '0.7rem', fontWeight: 800, color: '#92400e', marginBottom: 6, letterSpacing: '0.05em' }}>🔨 WHAT'S BEING BUILT TO FIX THIS</div>
          <div style={{ fontSize: '0.88rem', color: '#78350f', lineHeight: 1.55 }}>{act.builder.building}</div>
          <div style={{ fontSize: '0.74rem', color: '#92400e', marginTop: 6 }}>{(act.builder.featuresBuilt || ac.featuresBuilt) || 0} features built · {(act.builder.improvements || ac.improvements) || 0} improved</div>
        </div>
      )}
      {/* Live application stream */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
        <MiniEventFeed kinds={['upload']} max={6} title="📥 CUSTOMER APPLICATIONS COMING IN" />
      </div>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', display: 'grid', gap: 10 }}>
        <Bar label="🎯 Goal: banks can confidently DECIDE with Bond Desk (live)" value={ac.decisionReadyPct} tone="#16a34a" />
        <Bar label="📐 Intelligence section validated by banks (would-decide)" value={ac.banksCanDecide ? Math.round(100 * (+String(ac.banksCanDecide).split('/')[0]) / (+String(ac.banksCanDecide).split('/')[1] || 5)) : 0} tone="#7c3aed" />
      </div>
      {s.panel && (
        <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: 12, padding: '14px 16px', color: '#fff' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7dd3fc', marginBottom: 4 }}>🧪 PANEL PROOF — graded vs hidden ground truth</div>
          <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginBottom: 10 }}>whether the panel is actually right, and whether deciding on it makes money</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
            <Proof big={s.panel.savedPer1k || '—'} label="vs bureau-only" tone="#34d399" />
            <Proof big={s.panel.fraudCaught != null ? `${s.panel.fraudCaught}%` : '—'} label={`fraud caught (bureau lets ${s.panel.fraudMissedByBureau ?? '—'}% through)`} tone="#f87171" />
            <Proof big={s.panel.recAccuracy != null ? `${Math.round(s.panel.recAccuracy * 100)}%` : '—'} label={`recommendation accuracy · ${s.panel.falseDecline ?? '—'}% false-decline`} tone="#a5b4fc" />
            <Proof big={s.panel.whyFaithful != null ? `${s.panel.whyFaithful}%` : '—'} label={`"show the math" faithful · ${s.panel.calibrated ? 'calibrated ✓' : 'calibrating'}`} tone="#fcd34d" />
          </div>
          <div style={{ fontSize: '0.62rem', color: '#cbd5e1', marginTop: 10 }}>
            income {s.panel.income ?? '—'}% estimate error · fraud detection AUC {s.panel.fraudAUC ?? '—'} · distress detection AUC {s.panel.distressAUC ?? '—'} · switch prediction AUC {s.panel.switchAUC ?? '—'}
          </div>
        </div>
      )}
    </div>
  );
}

function BanksTab({ s }) {
  const act = s.activity || {};
  const postures = act.banks?.postures || [];
  const experience = act.banks?.experience || [];
  const asks = act.banks?.asks || [];
  const reactions = act.banks?.reactions || [];

  const allBanks = [...new Set([
    ...postures.map(p => p.bank),
    ...experience.map(e => e.bank),
    ...asks.map(a => a.bank),
  ])];

  const hasData = allBanks.length > 0;

  return (
    <div style={{ display: 'grid', gap: 12, paddingTop: 4 }}>
      {/* Live bid/switch/default stream */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
        <MiniEventFeed kinds={['bid', 'switch', 'default']} max={8} title="🏦 BANK DECISIONS — live bid stream" />
      </div>

      {hasData ? (
        <>
          <BankLeaderboard />
          {/* Per-bank detail cards */}
          <div style={{ display: 'grid', gap: 10 }}>
            {allBanks.map(bank => {
              const pos = postures.find(p => p.bank === bank);
              const exp = experience.find(e => e.bank === bank);
              const bankAsks = asks.filter(a => a.bank === bank);
              const bankReactions = reactions.filter(r => r.bank === bank);
              const fb = exp?.feedback;
              return (
                <div key={bank} style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '14px 16px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    <strong style={{ fontSize: '0.95rem', color: '#0f1a24' }}>{bank}</strong>
                    {fb && (
                      <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: '#64748b' }}>
                        {fb.trust != null && <span>trust <b style={{ color: fb.trust >= 7 ? '#16a34a' : '#dc2626' }}>{fb.trust}/10</b></span>}
                        {fb.workflow != null && <span>workflow <b style={{ color: fb.workflow >= 7 ? '#16a34a' : '#dc2626' }}>{fb.workflow}/10</b></span>}
                      </div>
                    )}
                  </div>
                  {pos?.strategy && (
                    <div style={{ fontSize: '0.83rem', color: '#475569', fontStyle: 'italic', lineHeight: 1.5, marginBottom: bankAsks.length ? 10 : 0, background: '#f8fafc', borderRadius: 6, padding: '8px 10px' }}>
                      "{pos.strategy}"
                    </div>
                  )}
                  {bankAsks.length > 0 && (
                    <div style={{ marginTop: 8 }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: 4 }}>ASKING FOR:</div>
                      {bankAsks.slice(0, 3).map((a, i) => (
                        <div key={i} style={{ fontSize: '0.8rem', color: '#334155', padding: '3px 0', lineHeight: 1.4 }}>→ {a.ask}</div>
                      ))}
                    </div>
                  )}
                  {bankReactions.length > 0 && (
                    <div style={{ marginTop: 8, paddingTop: 8, borderTop: '1px solid #f1f5f9' }}>
                      <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#64748b', marginBottom: 4 }}>REACTING TO WHAT WAS BUILT:</div>
                      {bankReactions.slice(0, 2).map((r, i) => (
                        <div key={i} style={{ fontSize: '0.78rem', color: '#334155', padding: '3px 0', lineHeight: 1.4 }}>
                          <b style={{ color: r.like >= 7 ? '#16a34a' : '#b45309' }}>{r.like}/10</b> · {r.feature}: {r.verdict}
                        </div>
                      ))}
                    </div>
                  )}
                  {fb?.topImprovement && (
                    <div style={{ marginTop: 8, fontSize: '0.78rem', color: '#0f1a24', background: '#fef9c3', borderRadius: 6, padding: '6px 10px' }}>
                      💡 <b>Wants:</b> {fb.topImprovement}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
          <BankThinking postures={postures} experience={experience} />
        </>
      ) : (
        <div style={{ background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 12, padding: '28px 20px', textAlign: 'center', color: '#64748b' }}>
          <div style={{ fontSize: '2rem', marginBottom: 8 }}>🏦</div>
          <div style={{ fontWeight: 700, fontSize: '0.9rem', marginBottom: 4 }}>No bank data yet</div>
          <div style={{ fontSize: '0.8rem' }}>Banks will appear here once they start bidding on deals. Resolve the blocker in the stall banner to get bids flowing.</div>
        </div>
      )}
    </div>
  );
}

function CustomersTab({ s, o, act }) {
  return (
    <div style={{ display: 'grid', gap: 12, paddingTop: 4 }}>
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 14px' }}>
        <MiniEventFeed kinds={['cx']} max={6} title="💬 CUSTOMER VOICES — what they're saying right now" />
      </div>
      <CustomerExperience cx={o.customerExperience} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 8 }}>
        <CollapsibleCard icon="🏦" title="Banks — what they want" defaultOpen={true}>
          {(act.banks?.asks || []).slice(0, 4).map((x, i) => <L key={i} k={x.bank + ':'} v={x.ask} />)}
          {!(act.banks?.asks || []).length && <Muted>listening to banks…</Muted>}
        </CollapsibleCard>
        <CollapsibleCard icon="🙋" title="Customers — what they want" defaultOpen={true}>
          {act.customers ? <>
            <L k="NPS" v={(act.customers.nps > 0 ? '+' : '') + act.customers.nps + (act.customers.worstStep ? ` · roughest: ${act.customers.worstStep}` : '')} />
            {(act.customers.wants || []).map((w, i) => <L key={i} k="•" v={w} />)}
          </> : <Muted>running customer journeys…</Muted>}
        </CollapsibleCard>
        <CollapsibleCard icon="🔨" title="Builder — building now" defaultOpen={false}>
          <div style={{ fontSize: '0.78rem', color: '#0f1a24', fontWeight: 600, lineHeight: 1.35, marginBottom: 4 }}>{act.builder?.building || '(between builds)'}</div>
          <Muted>{(act.builder?.featuresBuilt ?? s.accomplishments?.featuresBuilt) || 0} built · {(act.builder?.improvements ?? s.accomplishments?.improvements) || 0} improved</Muted>
        </CollapsibleCard>
        <CollapsibleCard icon="🧠" title="Models — accuracy" defaultOpen={false}>
          {act.models ? <>
            <L k="Income" v={`${act.models.incomeMAPE}% estimate error`} />
            <L k="Fraud detection" v={`AUC ${act.models.fraudAUC}`} />
            <L k="Distress detection" v={`AUC ${act.models.distressAUC}`} />
            <L k="Switch prediction" v={`AUC ${act.models.switchAUC}`} />
          </> : <Muted>training models…</Muted>}
        </CollapsibleCard>
      </div>
      {(act.banks?.reactions || []).length > 0 && (
        <CollapsibleCard icon="📣" title="Banks reacting to what we shipped" defaultOpen={false}>
          {act.banks.reactions.map((r, i) => <L key={i} k={`${r.bank} ${r.like ?? '?'}/10`} v={`${r.verdict || ''} · ${r.feature}`} />)}
        </CollapsibleCard>
      )}
    </div>
  );
}

/**
 * HeadlineSummary — the single most important thing to know right now.
 * Polls simStatus every 5s and surfaces one prominent card: idle/stalled/healthy.
 */
function HeadlineSummary() {
  const [s, setS] = useState(null);
  useEffect(() => {
    let alive = true;
    const load = () => bankApi.simStatus().then(d => { if (alive) setS(d); }).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);

  if (!s || s.empty) {
    return (
      <div style={{ background: '#0b1320', borderRadius: 12, padding: 20, color: '#fff' }}>
        <div style={{ fontSize: '1.5rem', fontWeight: 800, marginBottom: 6 }}>▶ Ready to simulate</div>
        <div style={{ fontSize: '0.88rem', color: '#94a3b8', marginBottom: 12 }}>No simulation is running. Start the producer on the Mac mini to begin.</div>
        <pre style={{ background: '#111827', borderRadius: 8, padding: '10px 14px', fontSize: '0.78rem', color: '#34d399', margin: 0, overflowX: 'auto' }}>{`ssh bondly-mac "~/bondly-sim/sim-supervisor.sh start"`}</pre>
      </div>
    );
  }

  if (s.progress?.status === 'STALLED') {
    const blocker = String(s.progress.topBlocker || 'Unknown blocker');
    return (
      <div style={{ background: '#1c0a0a', border: '1px solid #7f1d1d', borderRadius: 12, padding: 20, color: '#fca5a5' }}>
        <div style={{ fontSize: '1.4rem', fontWeight: 800, marginBottom: 6 }}>⛔ Simulation stalled</div>
        <div style={{ fontSize: '0.9rem', color: '#fecaca', lineHeight: 1.5 }}>{blocker}</div>
        <div style={{ fontSize: '0.72rem', color: '#9f1239', marginTop: 8 }}>Fix this blocker on the mini, then the sim will resume automatically.</div>
      </div>
    );
  }

  const ac = s.accomplishments || {}, f = s.funnel || {}, o = s.overview || {};
  const stages = f.stages || [];
  const landed = stages[0]?.count || 0;
  const visible = stages[stages.length - 1]?.count || 0;
  const convPct = landed > 0 ? Math.round((visible / landed) * 100) : 0;
  const bwp = String(ac.banksWouldPay || '');
  const switches = ac.banksCanDecide ? String(ac.banksCanDecide).split('/')[0] : (o.dataPlane?.switches ?? null);
  const parts = [
    switches ? `${switches} switches won` : null,
    bwp ? `${bwp} bank acceptance` : null,
    convPct > 0 ? `${convPct}% funnel conversion` : null,
  ].filter(Boolean);
  const headline = parts.length ? parts.join(' · ') : 'Simulation running';

  return (
    <div style={{ border: '1.5px solid #16a34a', borderRadius: 12, padding: 20, background: '#f0fdf4' }}>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#15803d', marginBottom: 4 }}>{headline}</div>
      <div style={{ fontSize: '0.8rem', color: '#166534' }}>Simulation active · live data</div>
    </div>
  );
}

/**
 * RightNowHero — the story in 2 seconds. Oversized live counters + a one-line
 * ticker of the latest notable event. Self-contained: polls /api/bank/sim-events
 * with its own cursor so it works regardless of the rest of the page.
 */
function RightNowHero() {
  const [counts, setCounts] = useState({});
  const [tick, setTick] = useState(null);
  const cursor = useRef(0);
  useEffect(() => {
    let alive = true;
    const poll = () => bankApi.simEvents(cursor.current).then(d => {
      if (!alive) return;
      const fresh = d.events || [];
      if (!fresh.length) return;
      cursor.current = d.lastSeq || cursor.current;
      setCounts(prev => { const n = { ...prev }; for (const e of fresh) n[e.kind] = (n[e.kind] || 0) + 1; return n; });
      const notable = [...fresh].reverse().find(e => ['bid', 'switch', 'fraud', 'distress'].includes(e.kind)) || fresh[fresh.length - 1];
      if (notable) setTick(notable);
    }).catch(() => {});
    poll();
    const t = setInterval(poll, 1500);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const big = [
    { label: 'Applying',     value: counts.upload || 0,                          tone: '#38bdf8' },
    { label: 'Bank bids',    value: counts.bid || 0,                             tone: '#a78bfa' },
    { label: 'Switches won', value: counts.switch || 0,                          tone: '#22d3ee' },
    { label: 'Risk flagged', value: (counts.fraud || 0) + (counts.distress || 0), tone: '#f87171' },
  ];
  return (
    <div style={{ background: 'linear-gradient(135deg,#0b1320 0%,#0f1a24 60%,#11243a 100%)', borderRadius: 12, padding: '16px 22px', color: '#fff' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.14em', color: '#22c55e', display: 'flex', alignItems: 'center', gap: 7 }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />RIGHT NOW
        </span>
        <span style={{ fontSize: '0.68rem', color: '#64748b' }}>live ecosystem · this run</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 18 }}>
        {big.map(b => (
          <div key={b.label}>
            <div style={{ fontSize: 'clamp(1.9rem,4.5vw,2.8rem)', fontWeight: 800, lineHeight: 1, color: '#fff', fontVariantNumeric: 'tabular-nums' }}>{b.value.toLocaleString()}</div>
            <div style={{ fontSize: '0.76rem', fontWeight: 700, color: b.tone, marginTop: 5 }}>{b.label}</div>
          </div>
        ))}
      </div>
      {tick && (
        <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #1e293b', display: 'flex', gap: 10, alignItems: 'center', minWidth: 0 }}>
          <span style={{ color: '#22c55e', flexShrink: 0 }}>▶</span>
          <span style={{ fontSize: '1.15rem', flexShrink: 0 }}>{tick.icon || '•'}</span>
          <span style={{ fontSize: '0.98rem', color: '#e2e8f0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{tick.text}</span>
        </div>
      )}
    </div>
  );
}

/**
 * AlertsStrip — iteration 2 of the watcher-driven build. Both local-LLM watchers
 * converged on "no real-time alerting". This derives the things needing attention
 * RIGHT NOW from the live signals (stalled progress + top blocker, funnel loss,
 * banks-would-pay gap, fraud/distress events) and surfaces them by severity.
 * Self-contained + defensive on types.
 */
function AlertsStrip() {
  const [s, setS] = useState(null);
  const [evKinds, setEvKinds] = useState({});
  const cursor = useRef(0);
  useEffect(() => {
    let alive = true;
    const poll = () => {
      bankApi.simStatus().then(d => { if (alive && d && !d.empty) setS(d); }).catch(() => {});
      bankApi.simEvents(cursor.current).then(d => {
        if (!alive) return;
        const fresh = d.events || [];
        if (!fresh.length) return;
        cursor.current = d.lastSeq || cursor.current;
        setEvKinds(prev => { const n = { ...prev }; for (const e of fresh) n[e.kind] = (n[e.kind] || 0) + 1; return n; });
      }).catch(() => {});
    };
    poll();
    const t = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const alerts = [];
  if (s) {
    const prog = s.progress || {}, f = s.funnel || {}, acc = s.accomplishments || {};
    // STALLED is already the HeadlineSummary top card — don't repeat it here
    if (f.headline) alerts.push({ sev: 'med', icon: '🧭', text: `Funnel: ${String(f.headline).slice(0, 200)}` });
    const bwp = String(acc.banksWouldPay || ''); const m = bwp.match(/^(\d+)\s*\/\s*(\d+)/);
    if (m && Number(m[2]) > 0 && Number(m[1]) / Number(m[2]) < 0.5) alerts.push({ sev: 'med', icon: '🏦', text: `Only ${bwp} banks would pay — conversion gap to close` });
    if (evKinds.fraud) alerts.push({ sev: 'high', icon: '🚨', text: `${evKinds.fraud} fraud event${evKinds.fraud > 1 ? 's' : ''} caught this session` });
    if (evKinds.distress) alerts.push({ sev: 'med', icon: '⚠️', text: `${evKinds.distress} distress signal${evKinds.distress > 1 ? 's' : ''} flagged` });
  }
  if (!s) return null;
  if (!alerts.length) return (
    <div style={{ background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10, padding: '8px 14px', fontSize: '0.8rem', color: '#15803d', fontWeight: 600 }}>✅ No active alerts — economy nominal</div>
  );
  const SEV = { high: { bg: '#fef2f2', bd: '#fecaca', fg: '#b91c1c' }, med: { bg: '#fffbeb', bd: '#fde68a', fg: '#b45309' } };
  return (
    <div style={{ display: 'grid', gap: 6 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.05em', color: '#334155' }}>🔔 ALERTS</span>
        <span style={{ fontSize: '0.64rem', color: '#94a3b8' }}>{alerts.length} need{alerts.length === 1 ? 's' : ''} attention</span>
      </div>
      {alerts.slice(0, 4).map((a, i) => {
        const c = SEV[a.sev] || SEV.med;
        return (
          <div key={i} style={{ background: c.bg, border: `1px solid ${c.bd}`, borderRadius: 10, padding: '8px 14px', display: 'flex', gap: 10, alignItems: 'center', fontSize: '0.82rem', color: c.fg }}>
            <span style={{ fontSize: '1rem', flexShrink: 0 }}>{a.icon}</span><span style={{ fontWeight: 600 }}>{a.text}</span>
          </div>
        );
      })}
    </div>
  );
}

/**
 * Spark — tiny inline sparkline from a series of numbers (auto-scaled).
 */
function Spark({ values, tone }) {
  if (!values || values.length < 2) return <div style={{ height: 26 }} />;
  const min = Math.min(...values), max = Math.max(...values), rng = (max - min) || 1;
  const W = 100, H = 26;
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * W},${H - ((v - min) / rng) * H}`).join(' ');
  return (
    <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" style={{ width: '100%', height: 26, display: 'block' }}>
      <polyline points={pts} fill="none" stroke={tone} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/**
 * TrendStrip — iteration 1 of the watcher-driven build. Both local-LLM watchers
 * flagged the same #1 gap: no sense of change over time. This accumulates the
 * economy's key metrics live (client-side, while the page is open) and draws
 * sparklines so you can track the mini-economy's trajectory, not just its "now".
 */
function TrendStrip() {
  const [hist, setHist] = useState([]);
  useEffect(() => {
    let alive = true;
    const poll = () => bankApi.simStatus().then(s => {
      if (!alive || !s || s.empty) return;
      const p = s.panel || {}, o = s.overview || {}, cx = o.customerExperience || {}, f = s.funnel || {};
      const stages = f.stages || [];
      const landed = stages[0]?.count, visible = stages[stages.length - 1]?.count;
      setHist(h => [...h, {
        nps: cx.nps,
        conv: (landed && visible) ? Math.round((visible / landed) * 100) : null,
        income: p.income, fraudAUC: p.fraudAUC, switchAUC: p.switchAUC,
        customers: o.customers?.total,
      }].slice(-48));
    }).catch(() => {});
    poll();
    const t = setInterval(poll, 5000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  const series = [
    { key: 'nps',       label: 'Customer NPS',        tone: '#db2777', fmt: v => (v > 0 ? '+' : '') + v, desc: "Net Promoter Score — % who would recommend minus % who wouldn't. Positive is good." },
    { key: 'conv',      label: 'Funnel → banks',      tone: '#16a34a', fmt: v => `${v}%`, desc: '% of people who landed on the site and became visible to banks' },
    { key: 'income',    label: 'Income estimate error', tone: '#0ea5e9', fmt: v => `${v}%`, desc: 'Average % error when estimating income from bank statements (lower is better)' },
    { key: 'fraudAUC',  label: 'Fraud detection',     tone: '#dc2626', fmt: v => v.toFixed(2), desc: 'How accurately we identify fraudulent applicants (1.0 = perfect)' },
    { key: 'switchAUC', label: 'Switch prediction',   tone: '#0891b2', fmt: v => v.toFixed(2), desc: 'How accurately we predict who will successfully switch banks (1.0 = perfect)' },
    { key: 'customers', label: 'Customers',            tone: '#7c3aed', fmt: v => v.toLocaleString(), desc: 'Total synthetic customers in this simulation run' },
  ];
  const mins = hist.length > 1 ? Math.round((hist.length - 1) * 5 / 60 * 10) / 10 : 0;
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', color: '#334155' }}>📈 TRENDS — the economy over time</span>
        <span style={{ fontSize: '0.66rem', color: '#94a3b8' }}>{mins > 0 ? `last ${mins} min · live` : 'collecting…'}</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(125px,1fr))', gap: 16 }}>
        {series.map(s => {
          const vals = hist.map(h => Number(h[s.key])).filter(v => Number.isFinite(v));
          const last = vals.length ? vals[vals.length - 1] : null;
          const first = vals.length ? vals[0] : null;
          const up = last != null && first != null && last !== first ? (last > first ? '▲' : '▼') : '';
          return (
            <div key={s.key}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 2 }}>
                <span style={{ fontSize: '0.64rem', color: '#64748b', fontWeight: 700 }} title={s.desc}>{s.label}</span>
                <span style={{ fontSize: '0.82rem', fontWeight: 800, color: s.tone }}>{last != null ? s.fmt(last) : '—'} <span style={{ fontSize: '0.6rem', color: '#cbd5e1' }}>{up}</span></span>
              </div>
              <Spark values={vals} tone={s.tone} />
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * BankLeaderboard — iteration 3 of the watcher-driven build. Pulls per-bank
 * competition stats from simStatus (experience + postures) and the live event
 * stream (bid counts per bank extracted from event text). Shows who's winning
 * deals, who trusts the panel, and who wants what fixed.
 */
const SA_BANKS = ['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'Investec', 'SA Home Loans'];
function BankLeaderboard() {
  const [s, setS] = useState(null);
  const [bidCounts, setBidCounts] = useState({});
  const [winCounts, setWinCounts] = useState({});
  const cursor = useRef(0);
  useEffect(() => {
    let alive = true;
    const pollStatus = () => bankApi.simStatus().then(d => { if (alive && d && !d.empty) setS(d); }).catch(() => {});
    const pollEvents = () => bankApi.simEvents(cursor.current).then(d => {
      if (!alive) return;
      const fresh = d.events || [];
      if (!fresh.length) return;
      cursor.current = d.lastSeq || cursor.current;
      setBidCounts(prev => {
        const n = { ...prev };
        for (const e of fresh) {
          if (e.kind !== 'bid') continue;
          const bank = SA_BANKS.find(b => (e.text || '').toLowerCase().includes(b.toLowerCase()));
          if (bank) n[bank] = (n[bank] || 0) + 1;
        }
        return n;
      });
      setWinCounts(prev => {
        const n = { ...prev };
        for (const e of fresh) {
          if (e.kind !== 'switch') continue;
          const bank = SA_BANKS.find(b => (e.text || '').toLowerCase().includes(b.toLowerCase()));
          if (bank) n[bank] = (n[bank] || 0) + 1;
        }
        return n;
      });
    }).catch(() => {});
    pollStatus(); pollEvents();
    const t1 = setInterval(pollStatus, 5000);
    const t2 = setInterval(pollEvents, 1500);
    return () => { alive = false; clearInterval(t1); clearInterval(t2); };
  }, []);

  const experience = s?.activity?.banks?.experience || [];
  const postures = s?.activity?.banks?.postures || [];
  const allBanks = [...new Set([
    ...Object.keys(bidCounts), ...Object.keys(winCounts),
    ...experience.map(e => e.bank), ...postures.map(p => p.bank),
  ])].sort();
  if (!allBanks.length) return null;

  const rows = allBanks.map(bank => {
    const exp = experience.find(e => e.bank === bank) || {};
    const pos = postures.find(p => p.bank === bank) || {};
    const bids = bidCounts[bank] || 0;
    const wins = winCounts[bank] || 0;
    const winRate = bids ? Math.round((wins / bids) * 100) : null;
    const trustScore = exp.feedback?.trust;
    return { bank, bids, wins, winRate, trustScore, topWant: exp.feedback?.topImprovement, strategy: pos.strategy };
  }).sort((a, b) => b.wins - a.wins || b.bids - a.bids);

  const maxBids = Math.max(...rows.map(r => r.bids), 1);
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.05em', color: '#334155', marginBottom: 10 }}>🏆 BANK LEADERBOARD — who's winning deals</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {rows.map((r, i) => (
          <div key={r.bank} style={{ display: 'grid', gridTemplateColumns: '110px 1fr 60px 60px 50px', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: '0.78rem', fontWeight: 700, color: i === 0 ? '#7c3aed' : '#0f1a24', display: 'flex', alignItems: 'center', gap: 5 }}>
              {i === 0 && <span style={{ fontSize: '0.6rem' }}>👑</span>}{r.bank}
            </span>
            <div style={{ position: 'relative', height: 8, background: '#f1f5f9', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${Math.round((r.bids / maxBids) * 100)}%`, background: i === 0 ? '#7c3aed' : '#94a3b8', borderRadius: 4, transition: 'width .4s' }} />
            </div>
            <span style={{ fontSize: '0.72rem', color: '#475569', textAlign: 'right' }}>{r.bids} bids</span>
            <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#0891b2', textAlign: 'right' }}>{r.wins} wins</span>
            <span style={{ fontSize: '0.7rem', fontWeight: 700, color: r.winRate >= 30 ? '#16a34a' : r.winRate >= 10 ? '#b45309' : '#94a3b8', textAlign: 'right' }}>
              {r.winRate != null ? `${r.winRate}%` : '—'}
            </span>
          </div>
        ))}
      </div>
      {rows.some(r => r.trustScore != null) && (
        <div style={{ marginTop: 10, paddingTop: 8, borderTop: '1px solid #f1f5f9', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {rows.filter(r => r.trustScore != null).map(r => (
            <span key={r.bank} style={{ fontSize: '0.68rem', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: '2px 8px', color: '#475569' }}>
              {r.bank}: trust {r.trustScore}/10
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function Bar({ label, value, tone = '#16a34a' }) {
  const v = Math.max(0, Math.min(100, value || 0));
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', fontWeight: 700, color: '#475569', marginBottom: 5 }}>
        <span>{label}</span><span>{v}%</span>
      </div>
      <div style={{ height: 12, background: '#eef2f7', borderRadius: 6, overflow: 'hidden' }}>
        <div style={{ width: `${v}%`, height: '100%', background: `linear-gradient(90deg, ${tone}aa, ${tone})`, transition: 'width .6s' }} />
      </div>
    </div>
  );
}
function CollapsibleCard({ icon, title, children, defaultOpen = true }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, overflow: 'hidden' }}>
      <div onClick={() => setOpen(o => !o)} style={{ padding: '10px 12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', cursor: 'pointer', userSelect: 'none' }}>
        <span style={{ fontSize: '0.7rem', fontWeight: 800, color: '#334155' }}>{icon} {title}</span>
        <span style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{open ? '▾' : '▸'}</span>
      </div>
      {open && <div style={{ padding: '0 12px 10px' }}>{children}</div>}
    </div>
  );
}
function Proof({ big, label, tone }) {
  return (
    <div>
      <div style={{ fontSize: '1.45rem', fontWeight: 800, color: tone, lineHeight: 1.1 }}>{big}</div>
      <div style={{ fontSize: '0.62rem', color: '#cbd5e1', lineHeight: 1.3 }}>{label}</div>
    </div>
  );
}
function L({ k, v }) { return <div style={{ fontSize: '0.7rem', color: '#475569', marginBottom: 4, lineHeight: 1.35 }}><b style={{ color: '#0f1a24' }}>{k}</b> {v}</div>; }
function Muted({ children }) { return <div style={{ fontSize: '0.7rem', color: '#94a3b8' }}>{children}</div>; }

function MacHealthCard({ h }) {
  if (!h) return null;
  const ramColor = h.ramPct > 85 ? '#ef4444' : h.ramPct > 70 ? '#f59e0b' : '#16a34a';
  const swapColor = h.swapUsedGB > 2 ? '#ef4444' : h.swapUsedGB > 1 ? '#f59e0b' : '#16a34a';
  const loadColor = h.load1 > h.cpuCores * 0.8 ? '#ef4444' : h.load1 > h.cpuCores * 0.5 ? '#f59e0b' : '#16a34a';
  return (
    <div style={{ background: '#0f172a', borderRadius: 10, padding: '12px 16px', color: '#fff', border: '1px solid #1e293b' }}>
      <div style={{ fontSize: '0.68rem', fontWeight: 800, color: '#7dd3fc', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
        🖥 Mac Mini — compute health
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8 }}>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: ramColor }}>{h.ramPct}%</div>
          <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>RAM used · {h.ramUsedGB}/{h.ramTotalGB} GB</div>
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: swapColor }}>{h.swapUsedGB ?? '—'} GB</div>
          <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>swap used of {h.swapTotalGB ?? '—'} GB</div>
        </div>
        <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: loadColor }}>{h.load1}</div>
          <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>load avg (1m) · {h.cpuCores} cores</div>
        </div>
        {h.diskFreePct != null && <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: h.diskFreePct < 15 ? '#ef4444' : '#16a34a' }}>{h.diskFreePct}%</div>
          <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>disk free</div>
        </div>}
        {h.dockerContainers != null && <div>
          <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#a5b4fc' }}>{h.dockerContainers}</div>
          <div style={{ fontSize: '0.6rem', color: '#94a3b8' }}>docker containers</div>
        </div>}
      </div>
      {(h.ollamaModels || []).length > 0 && (
        <div style={{ marginTop: 8, borderTop: '1px solid #1e293b', paddingTop: 8 }}>
          <div style={{ fontSize: '0.6rem', color: '#64748b', marginBottom: 4 }}>OLLAMA — models in memory</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {h.ollamaModels.map((m, i) => (
              <div key={i} style={{ fontSize: '0.65rem', background: m.gpu ? '#14532d' : '#1e293b', color: m.gpu ? '#86efac' : '#94a3b8', borderRadius: 4, padding: '2px 6px' }}>
                {m.name} · {m.sizeGB} GB {m.gpu ? '⚡GPU' : '🐌CPU'}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FunnelPanel({ funnel }) {
  if (!funnel || !funnel.stages?.length) return null;
  const max = Math.max(...funnel.stages.map(s => s.count), 1);
  const LABELS = { landed: 'Landed', registered: 'Registered', uploaded_income: 'Uploaded statements', applied: 'Applied', bank_visible: 'Visible to banks' };
  return (
    <div style={{ background: 'linear-gradient(135deg,#1e1b4b,#312e81)', borderRadius: 12, padding: '14px 16px', color: '#fff' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: '#c4b5fd' }}>🧭 PRODUCT FUNNEL — synthetic customers through the real product</span>
        <span style={{ fontSize: '0.66rem', color: '#fca5a5', fontWeight: 700 }}>{funnel.headline}</span>
      </div>
      <div style={{ fontSize: '0.6rem', color: '#a5b4fc', marginBottom: 10 }}>where we lose customers + where banks lose sight of them</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
        {funnel.stages.map((s, i) => (
          <div key={s.stage} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span style={{ width: 130, fontSize: '0.68rem', color: '#e0e7ff', flexShrink: 0 }}>{LABELS[s.stage] || s.stage}</span>
            <div style={{ flex: 1, height: 16, background: 'rgba(255,255,255,0.08)', borderRadius: 4, overflow: 'hidden' }}>
              <div style={{ width: `${Math.round(s.count / max * 100)}%`, height: '100%', background: i === funnel.stages.length - 1 ? 'linear-gradient(90deg,#34d399,#10b981)' : 'linear-gradient(90deg,#818cf8,#6366f1)' }} />
            </div>
            <span style={{ width: 78, textAlign: 'right', fontSize: '0.66rem', color: '#e0e7ff', flexShrink: 0 }}>{s.count} · {s.pct}%{i > 0 && s.conv < 100 ? <span style={{ color: '#fca5a5' }}> (−{100 - s.conv}%)</span> : ''}</span>
          </div>
        ))}
      </div>
      {funnel.bankInterest && (
        <div style={{ fontSize: '0.66rem', color: '#cbd5e1', marginTop: 10 }}>
          Bank interest: {funnel.bankInterest.bankVisible}/{funnel.bankInterest.applied} applied became visible deals · <b style={{ color: '#fca5a5' }}>{funnel.bankInterest.lostBeforeBank} lost before any bank saw them</b>
        </div>
      )}
      {funnel.topDropReasons?.length > 0 && (
        <div style={{ fontSize: '0.62rem', color: '#a5b4fc', marginTop: 6 }}>
          Top drop reasons: {funnel.topDropReasons.map(r => `${r.reason} (${r.n})`).join(' · ')}
        </div>
      )}
      {funnel.knownIssues?.length > 0 && (
        <div style={{ fontSize: '0.62rem', color: '#fcd34d', marginTop: 8, background: 'rgba(252,211,77,0.1)', borderRadius: 6, padding: '6px 8px' }}>
          ⚠ {funnel.knownIssues[0]}
        </div>
      )}
    </div>
  );
}
const METRIC_INFO = {
  decideReadyPct:      { label: 'Banks can decide',      explain: '% of deals where the bank has enough data to make a lending decision',                                              direction: 'Higher is better',                                        target_explain: 'Our target is 80%+ of deals fully decision-ready' },
  avgDecisionSupport:  { label: 'Decision support score', explain: 'Average quality of data supporting each bank\'s decision (0–10)',                                                  direction: 'Higher is better',                                        target_explain: 'Target is 7+/10' },
  wouldPayPct:         { label: 'Banks would pay',        explain: '% of banks who say they\'d pay for Bond Desk access based on this deal quality',                                   direction: 'Higher is better (target is to exceed 40% threshold)',     target_explain: 'Once >40% of banks would pay, the product is commercially viable' },
  dataRichnessPct:     { label: 'Deals with rich data',   explain: '% of deals that include income, risk signals, and behavioural data (not just basic application)',                  direction: 'Higher is better',                                        target_explain: 'Target is 70%+ data-rich deals' },
  decisionSpread:      { label: 'Decision variety',       explain: 'How many banks are making different decisions (lend/price/refer/decline). Low spread = all banks deciding the same way', direction: 'Higher is better — we want diverse bank strategies',   target_explain: 'Target is 3+ distinct bank outcomes per deal' },
};

function ProgressCard({ progress }) {
  if (!progress || !progress.metrics?.length) return null;
  const STATUS = {
    'ON TARGET': '#16a34a', IMPROVING: '#2563eb', STALLED: '#d97706', REGRESSING: '#dc2626',
  };
  const tone = STATUS[progress.status] || '#64748b';
  const arrow = d => d === 'up' ? '↑' : d === 'down' ? '↓' : d === 'flat' ? '→' : '·';
  return (
    <div style={{ background: '#fff', border: `1px solid ${tone}`, borderLeft: `4px solid ${tone}`, borderRadius: 12, padding: '12px 16px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 6 }}>
        <span style={{ fontSize: '0.74rem', fontWeight: 800, color: '#0f1a24' }}>📈 Are we getting closer to what banks want?</span>
        <span style={{ fontSize: '0.72rem', fontWeight: 800, color: tone }}>{progress.status} · {progress.onTarget}/{progress.totalMetrics} on target</span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(140px,1fr))', gap: 8, marginTop: 10 }}>
        {progress.metrics.map(mt => {
          const info = METRIC_INFO[mt.key] || { label: mt.key, explain: '', direction: '', target_explain: '' };
          return (
            <div key={mt.key} title={info.explain + (info.direction ? ' · ' + info.direction : '')}
              style={{ background: mt.hit ? '#f0fdf4' : '#fef2f2', border: `1px solid ${mt.hit ? '#bbf7d0' : '#fecaca'}`, borderRadius: 8, padding: '7px 10px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 2 }}>
                <span style={{ fontSize: '0.78rem', fontWeight: 800, background: mt.hit ? '#16a34a' : '#dc2626', color: '#fff', borderRadius: 4, padding: '1px 6px' }}>
                  {mt.hit ? '✓ On target' : '✗ Not yet'}
                </span>
                <span style={{ fontSize: '0.72rem', color: mt.hit ? '#15803d' : '#b91c1c', fontWeight: 700 }}>
                  {mt.value ?? '—'}{mt.key.endsWith('Pct') ? '%' : ''} <span style={{ fontSize: '0.7rem', color: mt.dir === 'down' ? '#dc2626' : mt.dir === 'up' ? '#16a34a' : '#94a3b8' }}>{arrow(mt.dir)}</span>
                </span>
              </div>
              <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#0f1a24' }}>{info.label}</div>
              <div style={{ fontSize: '0.58rem', color: '#94a3b8', marginTop: 2 }}>{info.target_explain}</div>
            </div>
          );
        })}
      </div>
      {progress.topBlocker && <div style={{ fontSize: '0.64rem', color: '#92400e', marginTop: 8 }}>⚠ Top blocker: {progress.topBlocker}</div>}
    </div>
  );
}
function MissionControl({ ac, act, panel, funnel, progress, macHealth }) {
  const m = act.models;
  const tiles = [
    ['Features built', ac.featuresBuilt ?? '—', '#7c3aed', `${ac.improvements || 0} improved`],
    ['Deployed to demo', ac.deploys ?? '—', '#0891b2', 'auto · verify+rollback'],
    ['Models trained', ac.modelsTrained ?? '—', '#0d9488', 'income·fraud·distress·switch'],
    ['Decision specs', ac.decisionSpecs ?? '—', '#b45309', 'negotiated WITH banks'],
    ['Banks can decide', ac.banksCanDecide ?? '—', '#15803d', 'on the spec (sim)'],
    ['Would pay', ac.banksWouldPay ?? '—', '#db2777', 'the real bar'],
  ];
  return (
    <div style={{ display: 'grid', gap: 10 }}>
      <ProgressCard progress={progress} />
      {/* Progress toward the goal */}
      <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderRadius: 10, padding: '12px 16px', display: 'grid', gap: 10 }}>
        <Bar label="🎯 Goal: banks can confidently DECIDE with Bond Desk (live)" value={ac.decisionReadyPct} tone="#16a34a" />
        <Bar label="📐 Intelligence section validated by banks (would-decide)" value={ac.banksCanDecide ? Math.round(100 * (+String(ac.banksCanDecide).split('/')[0]) / (+String(ac.banksCanDecide).split('/')[1] || 5)) : 0} tone="#7c3aed" />
      </div>
      {/* Panel PROOF — graded against hidden ground truth (the would-pay evidence) */}
      {panel && (
        <div style={{ background: 'linear-gradient(135deg,#0f172a,#1e293b)', borderRadius: 12, padding: '14px 16px', color: '#fff' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: '#7dd3fc', marginBottom: 4 }}>🧪 PANEL PROOF — graded vs hidden ground truth (held-out cohort)</div>
          <div style={{ fontSize: '0.62rem', color: '#94a3b8', marginBottom: 10 }}>not persona sentiment — whether the panel is actually RIGHT, and whether deciding on it makes money</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(130px,1fr))', gap: 10 }}>
            <Proof big={panel.savedPer1k || '—'} label="vs bureau-only" tone="#34d399" />
            <Proof big={panel.fraudCaught != null ? `${panel.fraudCaught}%` : '—'} label={`fraud caught (bureau lets ${panel.fraudMissedByBureau ?? '—'}% through)`} tone="#f87171" />
            <Proof big={panel.recAccuracy != null ? `${Math.round(panel.recAccuracy * 100)}%` : '—'} label={`recommendation accuracy · ${panel.falseDecline ?? '—'}% false-decline`} tone="#a5b4fc" />
            <Proof big={panel.whyFaithful != null ? `${panel.whyFaithful}%` : '—'} label={`"show the math" faithful · ${panel.calibrated ? 'calibrated ✓' : 'calibrating'}`} tone="#fcd34d" />
          </div>
          <div style={{ fontSize: '0.62rem', color: '#cbd5e1', marginTop: 10 }}>
            income {panel.income ?? '—'}% estimate error · fraud detection AUC {panel.fraudAUC ?? '—'} · distress detection AUC {panel.distressAUC ?? '—'} · switch prediction AUC {panel.switchAUC ?? '—'}
          </div>
        </div>
      )}
      <FunnelPanel funnel={funnel} />
      <MacHealthCard h={macHealth} />
      {/* Accomplishment tiles */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(118px,1fr))', gap: 8 }}>
        {tiles.map(([label, val, tone, sub]) => (
          <div key={label} style={{ background: '#fff', border: '1px solid #e5e7eb', borderTop: `3px solid ${tone}`, borderRadius: 8, padding: '8px 12px' }}>
            <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f1a24', lineHeight: 1.1 }}>{val}</div>
            <div style={{ fontSize: '0.66rem', fontWeight: 700, color: '#475569' }}>{label}</div>
            <div style={{ fontSize: '0.6rem', color: '#94a3b8', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>
          </div>
        ))}
      </div>
      {/* What every LLM is doing / thinking / generating */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(230px,1fr))', gap: 8 }}>
        <CollapsibleCard icon="🏦" title="Banks (llama3.1) — what they want" defaultOpen={true}>
          {(act.banks?.asks || []).slice(0, 4).map((x, i) => <L key={i} k={x.bank + ':'} v={x.ask} />)}
          {!(act.banks?.asks || []).length && <Muted>listening to banks…</Muted>}
        </CollapsibleCard>
        <CollapsibleCard icon="🙋" title="Customers (qwen2.5) — what they want" defaultOpen={true}>
          {act.customers ? <>
            <L k="NPS" v={(act.customers.nps > 0 ? '+' : '') + act.customers.nps + (act.customers.worstStep ? ` · roughest: ${act.customers.worstStep}` : '')} />
            {(act.customers.wants || []).map((w, i) => <L key={i} k="•" v={w} />)}
          </> : <Muted>running customer journeys…</Muted>}
        </CollapsibleCard>
        <CollapsibleCard icon="🔨" title="Builder (Claude) — building now" defaultOpen={false}>
          <div style={{ fontSize: '0.78rem', color: '#0f1a24', fontWeight: 600, lineHeight: 1.35, marginBottom: 4 }}>{act.builder?.building || '(between builds)'}</div>
          <Muted>{(act.builder?.featuresBuilt ?? ac.featuresBuilt) || 0} built · {(act.builder?.improvements ?? ac.improvements) || 0} improved</Muted>
        </CollapsibleCard>
        <CollapsibleCard icon="🧠" title="Models (Observer) — intelligence + WHY" defaultOpen={false}>
          {m ? <>
            <L k="income" v={`${m.incomeMAPE}% err`} />
            <L k="fraud" v={`AUC ${m.fraudAUC} · ${(m.explain?.fraud || []).join(' ')}`} />
            <L k="distress" v={`AUC ${m.distressAUC} · ${(m.explain?.distress || []).join(' ')}`} />
            <L k="switch" v={`AUC ${m.switchAUC} · ${(m.explain?.switch || []).join(' ')}`} />
          </> : <Muted>training models…</Muted>}
        </CollapsibleCard>
      </div>
      {/* Recent bank reactions to what we shipped */}
      {(act.banks?.reactions || []).length > 0 && (
        <CollapsibleCard icon="📣" title="Banks reacting to what we shipped" defaultOpen={true}>
          {act.banks.reactions.map((r, i) => <L key={i} k={`${r.bank} ${r.like ?? '?'}/10`} v={`${r.verdict || ''} · ${r.feature}`} />)}
        </CollapsibleCard>
      )}
    </div>
  );
}

function Pillar({ icon, title, tone, children }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #e5e7eb', borderTop: `3px solid ${tone}`, borderRadius: 10, padding: 16 }}>
      <div style={{ fontSize: '0.72rem', fontWeight: 800, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 8 }}>{icon} {title}</div>
      {children}
    </div>
  );
}
function Big({ children }) { return <div style={{ fontSize: '1.8rem', fontWeight: 800, color: '#0f1a24', lineHeight: 1.1 }}>{children}</div>; }
function score(v) { if (v == null) return <span style={{ color: '#cbd5e1' }}>—</span>; const c = v >= 8 ? '#15803d' : v >= 6 ? '#b45309' : '#dc2626'; return <span style={{ color: c, fontWeight: 700 }}>{v}/10</span>; }
const stars = n => '★'.repeat(Math.round(n || 0)) + '☆'.repeat(5 - Math.round(n || 0));

/**
 * CustomerExperience — the customer side of the two-sided sim. LLM customers walk
 * Upload → See savings → Switch → KYC and rate how smooth each step felt; we show
 * the step ratings, an overall NPS, the roughest step, and real gripes.
 */
function CustomerExperience({ cx, compact }) {
  if (!cx || !cx.byStep) return (
    <div className="bank-section" style={compact ? { margin: 0 } : {}}>
      <h3 style={{ margin: 0 }}>😀 Customer experience</h3>
      <p className="lede" style={{ fontSize: '0.82rem' }}>No customer voices yet. Run <code>customer-experience-loop.mjs --forever</code>.</p>
    </div>
  );
  const steps = Object.values(cx.byStep);
  const npsTone = cx.nps >= 30 ? '#15803d' : cx.nps >= 0 ? '#b45309' : '#dc2626';
  return (
    <div className="bank-section" style={compact ? { margin: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflowY: 'auto' } : {}}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
        <h3 style={{ margin: 0 }}>😀 How smooth is the customer experience</h3>
        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>{cx.n} AI customers</span>
      </div>
      {!compact && <p className="lede" style={{ fontSize: '0.84rem', marginTop: 4 }}>Each step is rated by an AI customer playing one of our synthetic applicants — in character, reacting to their own real outcome.</p>}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(110px,1fr))', gap: 8, margin: '10px 0' }}>
        {steps.map(st => {
          const rough = st.label === cx.worstStep?.label;
          return (
            <div key={st.label} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, background: rough ? '#fef2f2' : '#fff', borderColor: rough ? '#fecaca' : '#e5e7eb' }}>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f1a24' }}>{st.icon} {st.label}</div>
              <div style={{ fontSize: '1.1rem', color: st.avg >= 4 ? '#15803d' : st.avg >= 3 ? '#b45309' : '#dc2626', letterSpacing: 1, marginTop: 4 }}>{stars(st.avg)}</div>
              <div style={{ fontSize: '0.72rem', color: '#64748b' }}>{st.avg.toFixed(1)}/5{rough ? ' · roughest step' : ''}</div>
            </div>
          );
        })}
        <div style={{ border: `1px solid ${npsTone}33`, borderRadius: 10, padding: 12, background: '#fff', borderTop: `3px solid ${npsTone}` }}>
          <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#0f1a24' }}>Overall NPS</div>
          <div style={{ fontSize: '1.6rem', fontWeight: 800, color: npsTone, lineHeight: 1.2 }}>{cx.nps > 0 ? '+' : ''}{cx.nps}</div>
          <div style={{ fontSize: '0.72rem', color: '#64748b' }}>would-recommend score</div>
        </div>
      </div>

      {cx.gripes?.length > 0 && (
        <div>
          <div style={{ fontSize: '0.74rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em', color: '#64748b', marginBottom: 6 }}>What's frustrating them</div>
          {cx.gripes.slice().reverse().slice(0, compact ? 2 : 99).map((g, i) => (
            <div key={i} style={{ fontSize: '0.84rem', color: '#334155', padding: '5px 0', borderBottom: i < cx.gripes.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
              <span style={{ color: '#db2777' }}>“{g.gripe}”</span> <span style={{ color: '#94a3b8', fontSize: '0.74rem' }}>— {g.archetype} customer</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * BankThinking — what each bank is thinking: its strategy in its own words, the
 * reasons behind its latest bid/hold decisions, and how it rates using Bond Desk.
 */
function BankThinking({ postures, experience, compact }) {
  if (!postures?.length && !experience?.length) return null;
  const stratFor = b => postures?.find(p => p.bank === b)?.strategy;
  const rows = (experience?.length ? experience : (postures || []).map(p => ({ bank: p.bank }))).slice(0, 7);
  return (
    <div className="bank-section" style={compact ? { margin: 0, display: 'flex', flexDirection: 'column', minHeight: 0, overflow: 'hidden' } : {}}>
      <h3 style={{ margin: 0 }}>🏦 What the banks are thinking</h3>
      {!compact && <p className="lede" style={{ fontSize: '0.84rem' }}>Each bank is played by AI as itself — here's its stance, why it's bidding or holding, and how it rates using Bond Desk.</p>}
      <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 8 : 12, marginTop: 10, ...(compact ? { overflowY: 'auto', minHeight: 0, flex: 1 } : {}) }}>
        {rows.map((e, i) => {
          const strat = stratFor(e.bank);
          const decisions = (e.decisions || []).slice(0, 3);
          const fb = e.feedback;
          return (
            <div key={i} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 14 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
                <strong style={{ fontSize: '0.95rem' }}>{e.bank}{e.rbac && !e.rbac.rbacConsistent && <span style={{ color: '#dc2626', fontSize: '0.65rem', marginLeft: 6 }}>⚠ RBAC bug</span>}</strong>
                {fb && <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>nav {score(fb.navigation)} · trust {score(fb.trust)} · workflow {score(fb.workflow)} · SSO {score(fb.ssoRbac)}</span>}
              </div>
              {strat && <div style={{ fontSize: '0.82rem', color: '#475569', marginTop: 6, fontStyle: 'italic' }}>”{strat}”</div>}
              {decisions.length > 0 && (
                <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {decisions.map((d, j) => (
                    <span key={j} style={{ fontSize: '0.74rem', background: '#f8fafc', border: '1px solid #e5e7eb', borderRadius: 6, padding: '3px 8px', color: '#334155' }}>
                      <strong style={{ textTransform: 'uppercase', color: d.decision === 'bid' ? '#7c3aed' : '#64748b' }}>{d.decision}</strong> — {d.reason}
                    </span>
                  ))}
                </div>
              )}
              {fb?.topImprovement && <div style={{ marginTop: 8, fontSize: '0.8rem', color: '#0f1a24' }}><span style={{ color: '#64748b' }}>Wants:</span> {fb.topImprovement}</div>}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/**
 * LiveFeed — the real-time monitor. Polls /api/bank/sim-events with a `since`
 * cursor every 1.5s, prepends only NEW events (so the list scrolls), animates
 * each one in, and keeps running per-kind counters so you can see the ecosystem
 * working, not just a static scoreboard.
 */
const KIND_LABEL = { upload: 'Applications', bid: 'Bank bids', fraud: 'Fraud checks', distress: 'Distress flags', switch: 'Switches', default: 'Defaults', cx: 'Customer voice' };
const KIND_TONE  = { upload: '#0ea5e9', bid: '#7c3aed', fraud: '#dc2626', distress: '#15803d', switch: '#0891b2', default: '#b45309', cx: '#db2777' };
const KIND_ORDER = ['upload', 'bid', 'fraud', 'distress', 'switch', 'default', 'cx'];

function LiveFeed({ fill }) {
  const [events, setEvents] = useState([]);   // newest first, capped for the DOM
  const [counts, setCounts] = useState({});
  const [rate, setRate] = useState(0);        // events / minute (rolling)
  const [filter, setFilter] = useState('all');
  const [ratingFilter, setRatingFilter] = useState('all'); // 'all' | 'happy' | 'frustrated'
  const [connected, setConnected] = useState(false);
  const cursor = useRef(0);
  const stamps = useRef([]);                   // ms timestamps of recent arrivals

  useEffect(() => {
    let alive = true;
    const poll = () => bankApi.simEvents(cursor.current).then(d => {
      if (!alive) return;
      setConnected(true);
      const fresh = d.events || [];
      if (fresh.length) {
        cursor.current = d.lastSeq || cursor.current;
        setCounts(prev => {
          const next = { ...prev };
          for (const e of fresh) next[e.kind] = (next[e.kind] || 0) + 1;
          return next;
        });
        const now = Date.now();
        for (let i = 0; i < fresh.length; i++) stamps.current.push(now);
        // Prepend newest-first, keep the DOM light (last 80 visible).
        setEvents(prev => [...fresh.slice().reverse(), ...prev].slice(0, 80));
      }
      // Throughput over a rolling 20s window → per-minute.
      const cut = Date.now() - 20000;
      stamps.current = stamps.current.filter(t => t >= cut);
      setRate(Math.round(stamps.current.length * 3)); // 20s → ×3 = per minute
    }).catch(() => alive && setConnected(false));
    poll();
    const t = setInterval(poll, 1500);
    return () => { alive = false; clearInterval(t); };
  }, []);

  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const apps = counts.upload || 0;
  const getRating = e => { const m = String(e.detail || '').match(/(\d)\/5/); return m ? Number(m[1]) : null; };
  const baseShown = filter === 'all' ? events : events.filter(e => e.kind === filter);
  const shown = (filter === 'cx' && ratingFilter !== 'all')
    ? baseShown.filter(e => { const r = getRating(e); if (r == null) return false; return ratingFilter === 'happy' ? r >= 4 : r <= 2; })
    : baseShown;
  // Derived flow metrics — the "so what" of the stream.
  const winRate = apps ? Math.round(((counts.switch || 0) / apps) * 100) : 0;
  const caughtRate = (counts.fraud || 0); // fraud events fired
  const flow = [
    { label: 'Applications', value: apps, tone: KIND_TONE.upload, sub: 'statements in' },
    { label: 'Bank bids', value: counts.bid || 0, tone: KIND_TONE.bid, sub: `${apps ? ((counts.bid || 0) / apps).toFixed(1) : 0} per applicant` },
    { label: 'Switches won', value: counts.switch || 0, tone: KIND_TONE.switch, sub: `${winRate}% conversion` },
    { label: 'Risk flagged', value: (counts.fraud || 0) + (counts.distress || 0), tone: KIND_TONE.fraud, sub: `${counts.fraud || 0} fraud · ${counts.distress || 0} distress` },
  ];

  return (
    <div className="bank-section" style={{ padding: 0, overflow: 'hidden', ...(fill ? { display: 'flex', flexDirection: 'column', height: '100%', margin: 0, minHeight: 0 } : {}) }}>
      <style>{`
        @keyframes simRowIn { from { opacity: 0; transform: translateY(-8px); background:#ecfeff; } to { opacity: 1; transform: none; background:transparent; } }
        @keyframes simPulse { 0%,100% { opacity: 1; } 50% { opacity: .35; } }
        .sim-feed-row { animation: simRowIn .45s ease-out; }
        .sim-chip { cursor: pointer; border: 1px solid #e2e8f0; background:#fff; border-radius: 999px; padding: 3px 11px; font-size: 0.74rem; font-weight: 600; color:#475569; user-select:none; }
        .sim-chip.on { color:#fff; border-color: transparent; }
      `}</style>

      {/* Header strip — connection + throughput + running counters */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, padding: '14px 18px', borderBottom: '1px solid #1e293b', background: '#0f1a24' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ width: 9, height: 9, borderRadius: '50%', background: connected ? '#22c55e' : '#ef4444', display: 'inline-block', animation: connected ? 'simPulse 1.4s infinite' : 'none' }} />
          <strong style={{ color: '#fff', fontSize: '0.95rem' }}>Live event stream</strong>
          <span style={{ color: '#64748b', fontSize: '0.78rem' }}>{connected ? `${total.toLocaleString()} events` : 'waiting for producer…'}</span>
        </div>
        <span style={{ fontSize: '0.74rem', color: '#94a3b8' }}>
          <strong style={{ color: '#22c55e', fontVariantNumeric: 'tabular-nums' }}>{rate}</strong> events/min
        </span>
      </div>

      {/* Flow strip — the whole pipeline at a glance */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', background: '#0b1320' }}>
        {flow.map((f, i) => (
          <div key={f.label} style={{ padding: '12px 16px', borderRight: i < flow.length - 1 ? '1px solid #1e293b' : 'none', borderTop: `2px solid ${f.tone}` }}>
            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: '#fff', lineHeight: 1.1, fontVariantNumeric: 'tabular-nums' }}>{f.value.toLocaleString()}</div>
            <div style={{ fontSize: '0.74rem', fontWeight: 700, color: '#cbd5e1', marginTop: 2 }}>{f.label}</div>
            <div style={{ fontSize: '0.68rem', color: '#64748b' }}>{f.sub}</div>
          </div>
        ))}
      </div>

      {/* Filter chips */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', padding: '10px 16px', borderBottom: filter === 'cx' ? 'none' : '1px solid #e5e7eb', background: '#f8fafc' }}>
        <span className={'sim-chip' + (filter === 'all' ? ' on' : '')} style={filter === 'all' ? { background: '#0f1a24' } : {}} onClick={() => { setFilter('all'); setRatingFilter('all'); }}>All · {total}</span>
        {KIND_ORDER.filter(k => counts[k]).map(k => (
          <span key={k} className={'sim-chip' + (filter === k ? ' on' : '')} style={filter === k ? { background: KIND_TONE[k] } : {}} onClick={() => { setFilter(k); setRatingFilter('all'); }}>
            {KIND_LABEL[k]} · {counts[k]}
          </span>
        ))}
      </div>
      {/* Rating sub-filter — only visible when CX kind is selected */}
      {filter === 'cx' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', padding: '6px 16px 10px', borderBottom: '1px solid #e5e7eb', background: '#fdf4f8' }}>
          {[
            { key: 'all', label: 'All ratings' },
            { key: 'happy', label: '4–5 ★ (Happy)' },
            { key: 'frustrated', label: '1–2 ★ (Frustrated)' },
          ].map(opt => (
            <span key={opt.key} className={'sim-chip' + (ratingFilter === opt.key ? ' on' : '')}
              style={ratingFilter === opt.key ? { background: KIND_TONE.cx } : {}}
              onClick={() => setRatingFilter(opt.key)}>
              {opt.label}
            </span>
          ))}
        </div>
      )}

      {/* The scrolling feed */}
      <div style={{ ...(fill ? { flex: 1, minHeight: 0 } : { maxHeight: 360 }), overflowY: 'auto' }}>
        {shown.length === 0 && (
          <div style={{ padding: '28px 18px', color: '#94a3b8', fontSize: '0.86rem' }}>
            {events.length === 0
              ? <>No events yet. Run <code style={{ color: '#475569' }}>TARGET=http://localhost:3000 node sim-agents/event-stream.mjs --forever</code> on the laptop.</>
              : `No ${KIND_LABEL[filter]?.toLowerCase() || ''} in the recent window.`}
          </div>
        )}
        {shown.map(e => (
          <div key={e.seq} className="sim-feed-row" style={{ display: 'flex', gap: 12, padding: '10px 18px', borderBottom: '1px solid #f1f5f9', alignItems: 'flex-start' }}>
            <span style={{ fontSize: '1.1rem', lineHeight: 1.2, flexShrink: 0 }}>{e.icon || '•'}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '0.88rem', color: '#0f1a24', fontWeight: 600 }}>{e.text}</div>
              {e.detail && <div style={{ fontSize: '0.78rem', color: '#64748b', marginTop: 1 }}>{e.detail}</div>}
            </div>
            <span style={{ fontSize: '0.62rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: '#fff', background: e.tone || '#64748b', borderRadius: 4, padding: '2px 6px', flexShrink: 0, whiteSpace: 'nowrap' }}>{e.kind}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
