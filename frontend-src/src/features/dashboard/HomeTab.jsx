import { useState, useEffect } from 'react';
import { finances, financialFitness } from '../../lib/api.js';
import { fmt, fmtDate } from '@bondly/ui/lib/format.js';
import { useCountUp } from '../../lib/useCountUp.js';
import Sparkline from '../../components/Sparkline.jsx';
import {
  MortgageReadinessHero,
  InsightCard,
  FinancesEmptyState,
  GRADE_COLORS_EXPORT as GRADE_COLORS,
  GRADE_LABELS_EXPORT as GRADE_LABELS,
  BANK_RISK_TYPES,
  SEVERITY_ORDER,
} from './FinancesTab.jsx';
import ConveyancingTracker from './ConveyancingTracker.jsx';
import ReadinessChart from './ReadinessChart.jsx';
import {
  QualityScoreCard,
  SwitchMonitorCard,
  RateDropProjectionCard,
  PreQualCertificateCard,
  PeerBenchmarkCard,
  SubscriptionCancelCard,
} from './EngagementCards.jsx';
import './HomeTab.css';

// Snapshot optimizations can be strings (legacy) or rich advice objects; render
// the raw object as a React child throws (React error #31). Always coerce.
function optLabel(opt) {
  if (!opt) return '';
  if (typeof opt === 'string') return opt;
  return opt.title || opt.action || opt.bondLine || opt.description || '';
}

function gradeFromScore(score) {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'E';
}

// ── Net worth ring ────────────────────────────────────────────────────────────
function NetWorthRing({ assets, liabilities, netWorth }) {
  const total    = assets + Math.abs(liabilities);
  const assetPct = total > 0 ? assets / total : 0.5;
  const r = 52, cx = 64, cy = 64;
  const circ = 2 * Math.PI * r;
  const assetArc = circ * assetPct;
  return (
    <svg width="128" height="128" viewBox="0 0 128 128">
      {/* Liability arc */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef444430" strokeWidth="14" />
      {/* Asset arc */}
      <circle
        cx={cx} cy={cy} r={r} fill="none"
        stroke="#22c55e" strokeWidth="14"
        strokeDasharray={`${assetArc} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1s ease' }}
      />
      <text x={cx} y={cy - 8} textAnchor="middle" fill="var(--color-text)" fontSize="11" fontWeight="500" opacity="0.6">Net worth</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="var(--color-text)" fontSize="13" fontWeight="800">
        {netWorth >= 1000000 ? `R${(netWorth/1000000).toFixed(1)}M` : netWorth >= 1000 ? `R${Math.round(netWorth/1000)}k` : fmt(netWorth)}
      </text>
    </svg>
  );
}

// ── Health score ring ─────────────────────────────────────────────────────────
function HealthRing({ score }) {
  const r = 34, circ = 2 * Math.PI * r;
  const color = score >= 70 ? '#22c55e' : score >= 45 ? '#eab308' : '#ef4444';
  const label = score >= 70 ? 'Strong' : score >= 45 ? 'Building' : 'At risk';
  return (
    <div className="home-health-ring">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="8" />
        <circle
          cx="44" cy="44" r={r} fill="none"
          stroke={color} strokeWidth="8"
          strokeDasharray={`${circ * (score / 100)} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="44" y="41" textAnchor="middle" fill={color} fontSize="16" fontWeight="800">{score}</text>
        <text x="44" y="55" textAnchor="middle" fill="var(--color-text-muted)" fontSize="9">/100</text>
      </svg>
      <div className="home-health-ring__label" style={{ color }}>{label}</div>
    </div>
  );
}

// ── Pulse bar ─────────────────────────────────────────────────────────────────
function PulseBar({ income, expenses, savings }) {
  const savingsRate = income > 0 ? Math.round((savings / income) * 100) : 0;
  const expPct      = income > 0 ? Math.min(98, Math.round((expenses / income) * 100)) : 0;
  const color       = savingsRate >= 15 ? '#22c55e' : savingsRate >= 5 ? '#eab308' : '#ef4444';
  return (
    <div className="home-pulse-bar">
      <div className="home-pulse-bar__labels">
        <span>Income <strong>{fmt(income)}</strong></span>
        <span style={{ color }}>Saving <strong>{savingsRate}%</strong></span>
        <span>Spent <strong>{fmt(expenses)}</strong></span>
      </div>
      <div className="home-pulse-bar__track">
        <div className="home-pulse-bar__expenses" style={{ width: expPct + '%' }} />
        <div className="home-pulse-bar__savings" style={{ width: Math.max(0, 100 - expPct) + '%', background: color }} />
      </div>
    </div>
  );
}

// ── Sparkline stat tile ───────────────────────────────────────────────────────
function StatTile({ label, value, formatted, values, color, positive }) {
  const delta = values?.length >= 2 ? values[values.length - 1] - values[values.length - 2] : null;
  return (
    <div className="home-stat-tile">
      <div className="home-stat-tile__top">
        <span className="home-stat-tile__label">{label}</span>
        {delta !== null && (
          <span className="home-stat-tile__delta" style={{ color: (positive ? delta >= 0 : delta <= 0) ? '#22c55e' : '#ef4444' }}>
            {delta >= 0 ? '↑' : '↓'} {fmt(Math.abs(delta))}
          </span>
        )}
      </div>
      <div className="home-stat-tile__value">{formatted || fmt(value)}</div>
      {values?.length >= 2 && (
        <div className="home-stat-tile__spark">
          <Sparkline values={values} width={80} height={28} color={color || 'var(--color-primary)'} fill />
        </div>
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────
export default function HomeTab({ loans, user, onTabChange }) {
  const [health,    setHealth]    = useState(null);
  const [mr,        setMr]        = useState(null);
  const [snapshots, setSnapshots] = useState([]);
  const [insights,  setInsights]  = useState([]);
  const [netWorth,  setNetWorth]  = useState(null);
  const [anomalies, setAnomalies] = useState([]);
  const [history,   setHistory]   = useState([]);
  const [loading,   setLoading]   = useState(true);
  const [ready,     setReady]     = useState(false);

  useEffect(() => {
    Promise.allSettled([
      finances.health(),
      finances.mortgageReadiness(),
      financialFitness.getSnapshots(),
      finances.patterns(),
      finances.opportunities(),
      finances.netWorth({}),
      finances.anomalies(),
      finances.healthHistory(),
    ]).then(([hRes, mrRes, snapsRes, pRes, oRes, nwRes, anRes, histRes]) => {
      const h   = hRes.status   === 'fulfilled' ? hRes.value   : null;
      const m   = mrRes.status  === 'fulfilled' ? mrRes.value  : null;
      const snp = snapsRes.status === 'fulfilled' ? snapsRes.value : null;
      const p   = pRes.status   === 'fulfilled' ? pRes.value   : null;
      const o   = oRes.status   === 'fulfilled' ? oRes.value   : null;
      const nw  = nwRes.status  === 'fulfilled' ? nwRes.value  : null;
      const an  = anRes.status  === 'fulfilled' ? anRes.value  : null;
      const hist = histRes.status === 'fulfilled' ? histRes.value : null;

      setHealth(h?.available !== false ? h : null);
      setMr(m?.available !== false ? m : null);
      setSnapshots(snp?.snapshots || []);
      if (nw?.available !== false) setNetWorth(nw);
      if (hist?.history) setHistory(hist.history);

      if (an?.available !== false && an?.anomalies?.length) {
        const now = new Date();
        const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
        const dismissed = JSON.parse(localStorage.getItem('bondly_dismissed_anomalies') || '{}');
        setAnomalies(an.anomalies.filter(a => !dismissed[`${a.category}_${monthKey}`]));
      }

      const patterns = (p?.patterns || []).filter(x => !x.resolved);
      const opps     = (o?.opportunities || []).filter(x => !x.dismissed);
      const merged   = [
        ...patterns.map(x => ({ ...x, _source: 'pattern' })),
        ...opps.map(x => ({ ...x, _source: 'opportunity' })),
      ].sort((a, b) => {
        const aBR = BANK_RISK_TYPES.has(a.pattern_type) ? -1 : 0;
        const bBR = BANK_RISK_TYPES.has(b.pattern_type) ? -1 : 0;
        if (aBR !== bBR) return aBR - bBR;
        return (SEVERITY_ORDER[a.severity] ?? 4) - (SEVERITY_ORDER[b.severity] ?? 4);
      });
      setInsights(merged);
    }).finally(() => { setLoading(false); setTimeout(() => setReady(true), 50); });
  }, []);

  const nwValue     = netWorth?.netWorth ?? 0;
  const assets      = netWorth?.totalAssets ?? (nwValue > 0 ? nwValue * 1.3 : 0);
  const liabilities = netWorth?.totalLiabilities ?? (nwValue > 0 ? nwValue * 0.3 : 0);
  const healthScore = health?.overallScore ?? health?.score ?? 0;
  const income      = health?.income ?? 0;
  const expenses    = health?.totalExpenses ?? health?.expenses ?? 0;
  const savings     = Math.max(0, income - expenses);

  // sparkline history arrays
  const spendingHistory  = history.map(h => h.totalExpenses ?? h.expenses ?? 0).filter(Boolean);
  const savingsHistory   = history.map(h => Math.max(0, (h.income ?? 0) - (h.totalExpenses ?? h.expenses ?? 0)));
  const bondBalance      = loans?.[0]?.amount;

  const isEmpty = !health && snapshots.length === 0;

  if (loading) {
    return (
      <div className="home-loading">
        <div className="home-skeleton" style={{ height: 140 }} />
        <div className="home-skeleton" style={{ height: 56 }} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 12 }}>
          <div className="home-skeleton" style={{ height: 90 }} />
          <div className="home-skeleton" style={{ height: 90 }} />
          <div className="home-skeleton" style={{ height: 90 }} />
        </div>
        <div className="home-skeleton" style={{ height: 120 }} />
      </div>
    );
  }

  if (isEmpty) return <FinancesEmptyState />;

  const topInsight = insights[0] || null;

  return (
    <div className={`home-tab ${ready ? 'home-tab--ready' : ''}`}>

      {/* ── Command hero: net worth ring + health ring ── */}
      <div className="home-hero">
        <div className="home-hero__rings">
          <NetWorthRing assets={assets} liabilities={liabilities} netWorth={nwValue} />
          {healthScore > 0 && <HealthRing score={healthScore} />}
        </div>
        <div className="home-hero__stats">
          {netWorth?.changeFromLastMonth != null && (
            <div className={`home-hero__nw-delta ${netWorth.changeFromLastMonth >= 0 ? 'pos' : 'neg'}`}>
              {netWorth.changeFromLastMonth >= 0 ? '↑' : '↓'} {fmt(Math.abs(netWorth.changeFromLastMonth))} net worth this month
            </div>
          )}
          {income > 0 && (
            <PulseBar income={income} expenses={expenses} savings={savings} />
          )}
        </div>
      </div>

      {/* ── Sparkline stat tiles ── */}
      {(spendingHistory.length >= 2 || savingsHistory.length >= 2 || bondBalance) && (
        <div className="home-tiles">
          {spendingHistory.length >= 2 && (
            <StatTile
              label="Monthly spend"
              value={spendingHistory[spendingHistory.length - 1]}
              values={spendingHistory}
              color="#f97316"
              positive={false}
            />
          )}
          {savingsHistory.length >= 2 && (
            <StatTile
              label="Monthly savings"
              value={savingsHistory[savingsHistory.length - 1]}
              values={savingsHistory}
              color="#22c55e"
              positive={true}
            />
          )}
          {bondBalance && (
            <StatTile
              label="Bond balance"
              value={bondBalance}
              color="#4a7fa5"
            />
          )}
        </div>
      )}

      {/* ── Bond readiness ── */}
      {mr && (
        <div className="home-section">
          <MortgageReadinessHero mr={mr} improvements={health?.improvements} />
        </div>
      )}

      {/* ── FI-F4: Assumptions & confidence panel ── */}
      {health && (health.assumptions?.length > 0 || health.confidence != null || health.dataQuality) && (
        <div className="home-section">
          <details style={{ background: 'var(--color-surface)', border: '1px solid var(--color-border)', borderRadius: 8, padding: '10px 14px' }}>
            <summary style={{ cursor: 'pointer', fontSize: '0.8rem', color: 'var(--color-text-muted)', fontWeight: 600, userSelect: 'none' }}>
              How your score is calculated
              {health.dataQuality && (
                <span style={{
                  marginLeft: 8,
                  fontSize: '0.7rem',
                  padding: '1px 6px',
                  borderRadius: 4,
                  background: health.dataQuality === 'high' ? '#16401f' : health.dataQuality === 'medium' ? '#3d2e00' : '#3d1010',
                  color: health.dataQuality === 'high' ? '#22c55e' : health.dataQuality === 'medium' ? '#f59e0b' : '#ef4444',
                }}>
                  {health.dataQuality} data quality
                </span>
              )}
            </summary>
            <div style={{ marginTop: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
              {/* FI-F4: savings shown as band, not exact figure */}
              {income > 0 && (() => {
                const s = savings;
                const band = s >= 5000 ? 'R 5 000+' : s >= 2000 ? 'R 2 000 – 5 000' : s >= 500 ? 'R 500 – 2 000' : s > 0 ? 'Under R 500' : 'Negative / zero';
                return (
                  <div style={{ fontSize: '0.78rem', color: 'var(--color-text-muted)' }}>
                    <strong>Estimated monthly savings:</strong> {band} (band — not an exact figure; based on transaction analysis)
                  </div>
                );
              })()}
              {/* FI-F4: render hardcoded multiplier assumptions */}
              {health.subScores && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 3 }}>
                  {Object.entries(health.subScores).map(([k, v]) => v?.weight != null && (
                    <div key={k}><strong>{v.label}:</strong> {v.weight}% weight → score {v.score ?? '—'}/100</div>
                  ))}
                </div>
              )}
              {/* FI-F4: render explicit assumptions array if present */}
              {health.assumptions?.length > 0 && (
                <div style={{ marginTop: 4 }}>
                  <div style={{ fontSize: '0.72rem', fontWeight: 600, color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 4 }}>Assumptions</div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontSize: '0.75rem', color: 'var(--color-text-muted)', display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {health.assumptions.map((a, i) => <li key={i}>{a}</li>)}
                  </ul>
                </div>
              )}
              {health.confidence != null && (
                <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', marginTop: 2 }}>
                  <strong>Model confidence:</strong> {Math.round(health.confidence * 100)}%
                </div>
              )}
              {health.transactionCount != null && (
                <div style={{ fontSize: '0.72rem', color: 'var(--color-text-muted)' }}>
                  Based on {health.transactionCount} transaction{health.transactionCount !== 1 ? 's' : ''} analysed
                </div>
              )}
            </div>
          </details>
        </div>
      )}

      {/* ── Top insight ── */}
      {topInsight && (
        <div className="home-section">
          <div className="home-section__header">
            <span className="home-section__title">Top insight</span>
            <button className="home-section__link"
              onClick={() => window.dispatchEvent(new CustomEvent('bondly:navigate', { detail: { tab: 'money', subtab: 'insights' } }))}>
              See all →
            </button>
          </div>
          <InsightCard insight={topInsight} onResolve={() => {}} isPriority={false} />
        </div>
      )}

      {/* ── Anomaly feed ── */}
      {anomalies.length > 0 && (
        <div className="home-section">
          <div className="home-section__header">
            <span className="home-section__title">
              Unusual spending
              <span className="home-anomaly-badge">{anomalies.length}</span>
            </span>
          </div>
          <div className="home-anomalies">
            {anomalies.slice(0, 3).map((a, i) => {
              const now = new Date();
              const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
              return (
                <div key={i} className="home-anomaly-card">
                  <div className="home-anomaly-card__body">
                    <div className="home-anomaly-card__cat">{a.category}</div>
                    <div className="home-anomaly-card__desc">{a.description}</div>
                  </div>
                  <div className="home-anomaly-card__right">
                    <div className="home-anomaly-card__delta">+{fmt(a.delta)}</div>
                    <button className="home-anomaly-card__dismiss" title="Dismiss"
                      onClick={() => {
                        const dismissed = JSON.parse(localStorage.getItem('bondly_dismissed_anomalies') || '{}');
                        dismissed[`${a.category}_${monthKey}`] = true;
                        localStorage.setItem('bondly_dismissed_anomalies', JSON.stringify(dismissed));
                        setAnomalies(prev => prev.filter((_, j) => j !== i));
                      }}>✕</button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── Quick actions ── */}
      <div className="home-quick-actions">
        {[
          { label: 'Upload statement', icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>, action: () => onTabChange('bond', 'scan') },
          { label: 'Set a goal',       icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>, action: () => window.dispatchEvent(new CustomEvent('bondly:navigate', { detail: { tab: 'money', subtab: 'goals' } })) },
          { label: 'Compare banks',    icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>, action: () => onTabChange('bond', 'switch') },
          { label: 'Net worth',        icon: <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>, action: () => window.dispatchEvent(new CustomEvent('bondly:navigate', { detail: { tab: 'money', subtab: 'net-worth' } })) },
        ].map(({ label, icon, action }) => (
          <button key={label} className="home-quick-action" onClick={action}>
            <span className="home-quick-action__icon">{icon}</span>
            <span className="home-quick-action__label">{label}</span>
          </button>
        ))}
      </div>

      {/* ── Recent statements ── */}
      {snapshots.length > 0 && (
        <div className="home-section">
          <div className="home-section__header">
            <span className="home-section__title">Recent statements</span>
            <button className="home-section__link"
              onClick={() => window.dispatchEvent(new CustomEvent('bondly:navigate', { detail: { tab: 'vault' } }))}>
              View all →
            </button>
          </div>
          <div className="home-snaps-list">
            {snapshots.slice(0, 3).map((s, i) => {
              const score = s.readiness?.score ?? (typeof s.readiness === 'number' ? s.readiness : 0);
              const grade = gradeFromScore(score);
              return (
                <div key={i} className="home-snap-card">
                  <div className="home-snap-card__left">
                    <div className="home-snap-card__date">{fmtDate(s.uploadedAt)}</div>
                    {s.statementMonths && <div className="home-snap-card__months">{s.statementMonths} months</div>}
                  </div>
                  <div className="home-snap-card__mid">
                    {s.qualification?.maxBond > 0 && <div className="home-snap-card__bond">{fmt(s.qualification.maxBond)}</div>}
                    {s.optimizations?.[0] && <div className="home-snap-card__tip">{optLabel(s.optimizations[0])}</div>}
                  </div>
                  <div className="home-snap-card__grade"
                    style={{ color: GRADE_COLORS[grade], borderColor: GRADE_COLORS[grade] }}
                    title={GRADE_LABELS[grade]}>
                    {grade}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Finish-line engagement cards — each self-fetches and self-hides when
          there's no data. Ordered so the most actionable signal for the user's
          current stage surfaces first (conveyancing for live applications,
          then quality score and readiness for everyone else). */}
      <ConveyancingTracker />
      <QualityScoreCard />
      <ReadinessChart />
      <PeerBenchmarkCard />
      <RateDropProjectionCard />
      <SwitchMonitorCard />
      <SubscriptionCancelCard />
      <PreQualCertificateCard />
    </div>
  );
}
