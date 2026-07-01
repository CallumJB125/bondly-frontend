import { useIncomeAnalysis } from './hooks/useFinanceQueries.js';
import { fmt, fmtDate } from '@bondly/ui/lib/format.js';
import Sparkline from '../../components/Sparkline.jsx';
import './IncomeIntelligence.css';

function StabilityRing({ score }) {
  const r = 36, circ = 2 * Math.PI * r;
  const color = score >= 75 ? '#22c55e' : score >= 50 ? '#eab308' : '#ef4444';
  const label = score >= 75 ? 'Stable' : score >= 50 ? 'Variable' : 'Irregular';
  return (
    <div className="ii-ring">
      <svg width="88" height="88" viewBox="0 0 88 88">
        <circle cx="44" cy="44" r={r} fill="none" stroke="var(--color-surface-2)" strokeWidth="8" />
        <circle cx="44" cy="44" r={r} fill="none" stroke={color} strokeWidth="8"
          strokeDasharray={`${circ * score / 100} ${circ}`}
          strokeDashoffset={circ * 0.25}
          strokeLinecap="round"
          style={{ transition: 'stroke-dasharray 1s ease' }}
        />
        <text x="44" y="41" textAnchor="middle" fill={color} fontSize="15" fontWeight="800">{score}</text>
        <text x="44" y="54" textAnchor="middle" fill="var(--color-text-muted)" fontSize="9">/100</text>
      </svg>
      <div className="ii-ring__label" style={{ color }}>{label}</div>
      <div className="ii-ring__sub">Income stability</div>
    </div>
  );
}

export default function IncomeIntelligence() {
  const { data: raw, isLoading, isError, error, refetch } = useIncomeAnalysis();
  const data = raw?.available !== false ? raw : null;

  if (isLoading) return <div style={{ height: 200, background: 'var(--color-surface-2)', borderRadius: 12, animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />;
  if (isError) return (
    <div style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
      Failed to load income data. <button onClick={() => refetch()} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
    </div>
  );
  if (!data)   return <p className="ii-empty">No income data yet — upload a bank statement to detect income sources.</p>;

  const monthValues  = (data.monthlyHistory || []).map(m => m.total);
  const ytdProgress  = data.avgMonthlyIncome > 0
    ? Math.min(100, Math.round((data.ytdIncome / (data.avgMonthlyIncome * 12)) * 100))
    : 0;
  const currentMonth = new Date().getMonth() + 1;
  const ytdExpected  = data.avgMonthlyIncome * currentMonth;

  return (
    <div className="ii">
      {/* Hero row */}
      <div className="ii-hero">
        <StabilityRing score={data.stabilityScore ?? 0} />
        <div className="ii-hero__stats">
          <div className="ii-hero__stat">
            <div className="ii-hero__label">
              Avg monthly income
              <span className="income-gross-badge">Gross estimate</span>
            </div>
            <div className="ii-hero__val">{fmt(data.avgMonthlyIncome)}</div>
            <div className="ii-hero__sub">Est. net: {fmt(data.estimatedNet || Math.round((data.avgMonthlyIncome || 0) * 0.85))}</div>
            {(data.caveat || data.singleMonthAdjusted) && (
              <div className="income-caveat-notice">
                ⚠ {data.caveat || 'Based on 1 month of data — upload 2+ months for a verified figure.'}
              </div>
            )}
          </div>
          <div className="ii-hero__stat">
            <div className="ii-hero__label">YTD income</div>
            <div className="ii-hero__val">{fmt(data.ytdIncome)}</div>
            <div className="ii-hero__sub">
              vs {fmt(ytdExpected)} expected
              {data.ytdIncome >= ytdExpected
                ? <span style={{ color: '#22c55e' }}> ↑ ahead</span>
                : <span style={{ color: '#f97316' }}> ↓ behind</span>
              }
            </div>
          </div>
          {monthValues.length >= 2 && (
            <Sparkline values={monthValues} width={120} height={32} color="#22c55e" fill />
          )}
        </div>
      </div>

      {/* YTD progress bar */}
      <div className="ii-ytd">
        <div className="ii-ytd__header">
          <span>YTD progress to annual income estimate</span>
          <span>{ytdProgress}%</span>
        </div>
        <div className="ii-ytd__track">
          <div className="ii-ytd__fill" style={{ width: ytdProgress + '%' }} />
          <div className="ii-ytd__marker" style={{ left: `${Math.round((currentMonth / 12) * 100)}%` }} title="Where you should be" />
        </div>
        <div className="ii-ytd__labels">
          <span>Jan</span><span>Jun</span><span>Dec</span>
        </div>
      </div>

      {/* Monthly chart */}
      {monthValues.length >= 2 && (
        <div className="ii-chart">
          <div className="ii-chart__header">Monthly income (12 months)</div>
          <div className="ii-chart__bars">
            {(data.monthlyHistory || []).slice(-12).map((m, i) => {
              const pct = data.avgMonthlyIncome > 0 ? Math.min(100, (m.total / data.avgMonthlyIncome) * 80) : 0;
              const mo  = new Date(m.month).toLocaleString('default', { month: 'short' });
              return (
                <div key={i} className="ii-chart__col">
                  <div className="ii-chart__bar" style={{ height: pct + '%' }} />
                  <div className="ii-chart__mo">{mo}</div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Disruption alert */}
      {data.disruption?.detected === true && (
        <div className="ii-alert ii-alert--warning">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
          <span>Income disruption detected — {data.disruption.direction} trend, {Math.round(data.disruption.dropPct * 100)}% change detected</span>
        </div>
      )}

      {/* Income sources */}
      {(data.sources || []).length > 0 && (
        <div className="ii-sources">
          <div className="ii-sources__title">Detected income sources</div>
          {data.sources.map((s, i) => (
            <div key={i} className="ii-source-row">
              <div className="ii-source-row__icon">
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="20 6 9 17 4 12"/></svg>
              </div>
              <div className="ii-source-row__left">
                <div className="ii-source-row__name">{s.name}</div>
                <div className="ii-source-row__meta">
                  {s.occurrences}× · last {fmtDate(s.lastSeen)}
                </div>
              </div>
              <div className="ii-source-row__amt">{fmt(s.avgAmount)}/mo</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
