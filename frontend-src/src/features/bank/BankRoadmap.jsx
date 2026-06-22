import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bankApi, bankFmtR } from './bankApi.js';

// ── Retention Radar — book-level cross-bank intelligence (ROADMAP · SIMULATED) ──
// Phase 1C/1D/3A: share-of-wallet (R7), switch/flight radar (R4), distress
// early-warning feed (R3). Every value is simulated and badged accordingly.

const C = {
  purple: '#6d28d9', purpleBg: '#ede9fe', purpleBorder: '#ddd6fe',
  red: '#b91c1c', amber: '#b45309', green: '#15803d', faint: '#6b7280', text: '#111827',
};

function RoadmapBanner() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', background: C.purpleBg, border: `1px solid ${C.purpleBorder}`, borderRadius: 10, padding: '10px 14px', marginBottom: 18 }}>
      <span style={{ fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.purple, background: '#fff', border: `1px solid ${C.purpleBorder}`, borderRadius: 999, padding: '2px 8px' }}>Roadmap · simulated</span>
      <span style={{ fontSize: '0.82rem', color: '#4c1d95' }}>
        Preview of cross-bank intelligence Bondly can surface at <strong>book level</strong> — what only an aggregator that sees a customer's accounts across <em>all</em> their banks can know. Figures are simulated on a Cape Town synthetic cohort.
      </span>
    </div>
  );
}

const card = { background: '#fff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 18 };
const stat = { fontSize: '1.5rem', fontWeight: 700, color: C.text };
const lbl = { fontSize: '0.62rem', fontWeight: 600, letterSpacing: '0.08em', textTransform: 'uppercase', color: C.faint };
const sub = { fontSize: '0.72rem', color: C.faint, marginTop: 2 };
const th = { textAlign: 'left', fontSize: '0.6rem', fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: C.faint, padding: '8px 10px', borderBottom: '1px solid #e5e7eb' };
const td = { padding: '8px 10px', borderBottom: '1px solid #f3f4f6', fontSize: '0.82rem', color: C.text };
const chip = (bg, fg) => ({ display: 'inline-block', fontSize: '0.66rem', fontWeight: 600, color: fg, background: bg, borderRadius: 999, padding: '2px 7px' });

export default function BankRoadmap() {
  const [d, setD] = useState(null);
  const [err, setErr] = useState(null);

  useEffect(() => {
    bankApi.roadmapPortfolio()
      .then(r => setD(r))
      .catch(e => setErr(e.message || 'Failed to load'));
  }, []);

  if (err) return <div style={{ padding: 24 }}><RoadmapBanner /><p style={{ color: C.red }}>Could not load roadmap preview: {err}</p></div>;
  if (!d) return <div style={{ padding: 24 }}><RoadmapBanner /><p style={{ color: C.faint }}>Loading…</p></div>;
  if (d.available === false) return <div style={{ padding: 24 }}><RoadmapBanner /><p style={{ color: C.faint }}>{d.note || 'Roadmap preview not seeded for this environment.'}</p></div>;

  const sow = d.shareOfWallet || {};
  const radar = d.switchRadar || {};
  const distress = d.distress || {};
  const hidden = d.undisclosedDebt || {};
  const bands = radar.byBand || {};
  const primaryEntries = Object.entries(sow.primaryBankCounts || {}).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ padding: 24, maxWidth: 1100 }}>
      <h2 style={{ margin: '0 0 4px', display: 'flex', alignItems: 'center', gap: 10 }}>Retention radar</h2>
      <p style={{ margin: '0 0 16px', color: C.faint, fontSize: '0.85rem' }}>Cross-bank flight, share-of-wallet and distress across {d.totalApplicants} applicants in the book.</p>
      <RoadmapBanner />

      {/* 3B — Live today vs Roadmap narrative strip */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 20 }}>
        <div style={{ ...card, borderLeft: `3px solid ${C.green}` }}>
          <div style={{ ...lbl, color: C.green, marginBottom: 8 }}>Live in Bond Desk today</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: C.text, lineHeight: 1.7 }}>
            <li>Anonymised deal-review queue, ranked by expected value</li>
            <li>Explainable quality score + switch-payback economics</li>
            <li>Competing-bid view, auto-bid, pricing coach</li>
            <li>Cross-bank distress map (Market intelligence)</li>
          </ul>
        </div>
        <div style={{ ...card, borderLeft: `3px solid ${C.purple}` }}>
          <div style={{ ...lbl, color: C.purple, marginBottom: 8 }}>Roadmap — cross-bank intelligence (simulated)</div>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.82rem', color: C.text, lineHeight: 1.7 }}>
            <li>True cross-bank affordability + undisclosed-debt detection</li>
            <li>Salary / primacy — "will we win the relationship too?"</li>
            <li>Sector competitiveness — your share of mortgages by sector</li>
            <li>Risk-on / risk-off guidance — where to lean in vs pull back</li>
            <li>Retention radar · cross-account income · mule-network graph</li>
          </ul>
        </div>
      </div>

      {/* Headline stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12, marginBottom: 20 }}>
        <div style={card}><div style={lbl}>At flight risk (high)</div><div style={{ ...stat, color: C.red }}>{bands.high ?? 0}</div><div style={sub}>{bankFmtR(radar.bondValueAtRiskHigh)} bond value at risk</div></div>
        <div style={card}><div style={lbl}>Salary at a rival</div><div style={{ ...stat, color: C.amber }}>{sow.salaryElsewhere ?? 0}</div><div style={sub}>{sow.salaryWithUs ?? 0} already bank with you</div></div>
        <div style={card}><div style={lbl}>Win-the-salary upside</div><div style={{ ...stat, color: C.green }}>{bankFmtR(sow.salaryUpsideLifetime)}</div><div style={sub}>lifetime relationship value</div></div>
        <div style={card}><div style={lbl}>Cross-bank distress</div><div style={{ ...stat, color: C.red }}>{distress.atRiskCount ?? 0}</div><div style={sub}>~{distress.avgLeadDaysVsBureau ?? 0} days ahead of bureau</div></div>
        <div style={card}><div style={lbl}>Undisclosed debt</div><div style={stat}>{hidden.prevalencePct ?? 0}%</div><div style={sub}>of book · +{hidden.avgDtiUnderstatement ?? 0}pts DTI understated</div></div>
      </div>

      {/* Share of wallet */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ ...lbl, marginBottom: 10 }}>Share of wallet — where the book actually banks</div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {primaryEntries.map(([bank, n]) => (
            <span key={bank} style={chip('#f3f4f6', C.text)}>{bank} · {n}</span>
          ))}
        </div>
      </div>

      {/* Sector competitiveness — cross-bank market share by sector */}
      <div style={{ ...card, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{ ...lbl, padding: '14px 16px 6px' }}>Sector competitiveness — your share of mortgages by sector <span style={chip(C.purpleBg, C.purple)}>cross-bank · simulated</span></div>
        <p style={{ margin: '0 16px 8px', fontSize: '0.74rem', color: C.faint }}>Only an aggregator that sees deals across every bank can show this. "Decided" = deals with an accepted offer.</p>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Sector</th><th style={th}>Your share</th><th style={th}>Won / decided</th><th style={th}>Deals in market</th><th style={th}>Leading rival</th><th style={th}>Your book value</th></tr></thead>
          <tbody>
            {(d.sectorCompetitiveness || []).map((s) => (
              <tr key={s.sector}>
                <td style={{ ...td, fontWeight: 600 }}>{s.sector}</td>
                <td style={td}>
                  <span style={chip(s.sharePct >= 50 ? '#dcfce7' : s.sharePct >= 30 ? '#fef3c7' : '#fee2e2', s.sharePct >= 50 ? C.green : s.sharePct >= 30 ? C.amber : C.red)}>{s.sharePct}%</span>
                </td>
                <td style={td}>{s.demoWon} / {s.decided}</td>
                <td style={td}>{s.deals}</td>
                <td style={{ ...td, color: C.faint, textTransform: 'capitalize' }}>{s.rivalLeader ? `${s.rivalLeader.bank} (${s.rivalLeader.wins})` : '—'}</td>
                <td style={td}>{bankFmtR(s.demoBondValue)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Risk-on / risk-off guidance */}
      <div style={{ ...card, marginBottom: 20 }}>
        <div style={{ ...lbl, marginBottom: 4 }}>Where to lean in / pull back <span style={chip(C.purpleBg, C.purple)}>simulated</span></div>
        <p style={{ margin: '0 0 12px', fontSize: '0.74rem', color: C.faint }}>Risk-on = under-penetrated, good-quality sectors worth pricing to win. Risk-off = elevated-risk or saturated sectors to tighten.</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(260px,1fr))', gap: 10 }}>
          {(d.riskGuidance || []).map((g) => {
            const tone = g.stance === 'lean-in' ? { bg: '#dcfce7', fg: C.green, label: '↑ Risk-on · lean in' }
                       : g.stance === 'pull-back' ? { bg: '#fee2e2', fg: C.red, label: '↓ Risk-off · pull back' }
                       : { bg: '#f3f4f6', fg: C.faint, label: '→ Hold · selective' };
            return (
              <div key={g.segment} style={{ border: '1px solid #e5e7eb', borderRadius: 10, padding: 12, borderLeft: `3px solid ${tone.fg}` }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.86rem', color: C.text }}>{g.segment}</span>
                  <span style={chip(tone.bg, tone.fg)}>{tone.label}</span>
                </div>
                <div style={{ fontSize: '0.72rem', color: C.faint, marginBottom: 6 }}>Win-share {g.winSharePct}% · quality {g.avgQuality} · {g.deals} deals</div>
                <div style={{ fontSize: '0.78rem', color: C.text, lineHeight: 1.5 }}>{g.rationale}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Switch radar table */}
      <div style={{ ...card, marginBottom: 20, padding: 0, overflow: 'hidden' }}>
        <div style={{ ...lbl, padding: '14px 16px 6px' }}>Top switch-risk customers <span style={chip(C.purpleBg, C.purple)}>simulated</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Ref</th><th style={th}>Region</th><th style={th}>Propensity</th><th style={th}>Signals</th><th style={th}>~Days to switch</th><th style={th}>Bond</th></tr></thead>
          <tbody>
            {(radar.topAtRisk || []).map((r) => (
              <tr key={r.ref}>
                <td style={td}><Link to={`/bank/applications/${r.ref}`}>{r.ref}</Link></td>
                <td style={td}>{r.region}</td>
                <td style={td}><span style={chip(r.score >= 70 ? '#fee2e2' : '#fef3c7', r.score >= 70 ? C.red : C.amber)}>{r.score}/100</span></td>
                <td style={{ ...td, color: C.faint }}>{(r.signals || []).join(', ') || '—'}</td>
                <td style={td}>{r.daysToSwitch}</td>
                <td style={td}>{bankFmtR(r.requestedAmount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Distress early-warning feed */}
      <div style={{ ...card, padding: 0, overflow: 'hidden' }}>
        <div style={{ ...lbl, padding: '14px 16px 6px' }}>Cross-bank distress early-warning <span style={chip(C.purpleBg, C.purple)}>simulated</span></div>
        <table style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead><tr><th style={th}>Ref</th><th style={th}>Region</th><th style={th}>Lead vs bureau</th><th style={th}>Confirmed</th><th style={th}>Signals</th></tr></thead>
          <tbody>
            {(distress.top || []).map((r) => (
              <tr key={r.ref}>
                <td style={td}><Link to={`/bank/applications/${r.ref}`}>{r.ref}</Link></td>
                <td style={td}>{r.region}</td>
                <td style={{ ...td, color: C.red, fontWeight: 600 }}>{r.leadDays} days</td>
                <td style={td}>{r.crossBankConfirmed ? <span style={chip('#fee2e2', C.red)}>cross-bank</span> : <span style={chip('#f3f4f6', C.faint)}>single signal</span>}</td>
                <td style={{ ...td, color: C.faint }}>{(r.signals || []).join('; ') || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
