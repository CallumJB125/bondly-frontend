import { useState, useEffect } from 'react';
import { finances } from '../../lib/api.js';
import { fmt } from '@bondly/ui/lib/format.js';
import { CashflowChart } from './FinancesTab.jsx';
import './CashflowPulse.css';

export default function CashflowPulse({ compact = false }) {
  const [risk,      setRisk]      = useState(null);
  const [cashflow,  setCashflow]  = useState(null);
  const [loading,   setLoading]   = useState(true);

  useEffect(() => {
    const fetches = [finances.cashflowRisk()];
    if (!compact) fetches.push(finances.cashflow());
    Promise.allSettled(fetches).then(([rRes, cfRes]) => {
      if (rRes.status === 'fulfilled' && rRes.value?.available !== false) setRisk(rRes.value);
      if (cfRes && cfRes.status === 'fulfilled') setCashflow(cfRes.value);
    }).finally(() => setLoading(false));
  }, [compact]);

  if (loading) return <div className={`cfp-skeleton ${compact ? 'cfp-skeleton--compact' : ''}`} />;
  if (!risk)   return null;

  const runway = risk.daysOfRunway ?? (
    risk.dailySpendRate > 0
      ? Math.round((risk.projectedEndBalance ?? 0) / risk.dailySpendRate)
      : null
  );
  const runwayColor = runway == null ? 'var(--color-text-muted)'
    : runway > 10 ? '#22c55e'
    : runway > 5  ? '#eab308'
    : '#ef4444';

  const fillPct = runway != null ? Math.min(100, Math.max(0, (runway / 30) * 100)) : 50;

  if (compact) {
    return (
      <div className="cfp-compact">
        <div className="cfp-compact__bar-wrap">
          <div className="cfp-compact__bar-fill" style={{ width: fillPct + '%', background: runwayColor }} />
        </div>
        {runway != null && (
          <div className="cfp-compact__label" style={{ color: runwayColor }}>
            {runway} days of runway at your current rate
          </div>
        )}
      </div>
    );
  }

  const score = risk.riskScore ?? risk.score ?? null;
  const circumference = 2 * Math.PI * 28;
  const scoreOffset = score != null ? circumference * (1 - score / 100) : circumference;
  const scoreColor = score == null ? 'var(--color-border)'
    : score >= 70 ? '#22c55e'
    : score >= 40 ? '#eab308'
    : '#ef4444';

  return (
    <div className="cfp-expanded">
      <div className="cfp-expanded__top">
        <div className="cfp-expanded__bar-section">
          <div className="cfp-expanded__bar-labels">
            <span className="cfp-expanded__bar-label">Start of month</span>
            <span className="cfp-expanded__bar-label">Today</span>
            <span className="cfp-expanded__bar-label">End of month</span>
          </div>
          <div className="cfp-expanded__bar-track">
            <div className="cfp-expanded__bar-fill" style={{ width: fillPct + '%', background: runwayColor }} />
          </div>
          {runway != null && (
            <div className="cfp-expanded__runway-label" style={{ color: runwayColor }}>
              {runway > 0 ? `${runway} days of runway remaining` : 'Cash flow risk: funds may run short'}
            </div>
          )}
        </div>

        {score != null && (
          <div className="cfp-expanded__score">
            <svg width="72" height="72" viewBox="0 0 72 72">
              <circle cx="36" cy="36" r="28" fill="none" stroke="var(--color-border)" strokeWidth="6" />
              <circle
                cx="36" cy="36" r="28" fill="none"
                stroke={scoreColor} strokeWidth="6"
                strokeDasharray={circumference}
                strokeDashoffset={scoreOffset}
                strokeLinecap="round"
                transform="rotate(-90 36 36)"
                style={{ transition: 'stroke-dashoffset 0.6s ease' }}
              />
              <text x="36" y="40" textAnchor="middle" fill={scoreColor} fontSize="16" fontWeight="700">{score}</text>
            </svg>
            <div className="cfp-expanded__score-label">Cash flow score</div>
          </div>
        )}
      </div>

      {risk.triggers?.length > 0 && (
        <div className="cfp-expanded__triggers">
          <div className="cfp-expanded__triggers-heading">Risk factors</div>
          {risk.triggers.map((t, i) => (
            <div key={i} className="cfp-trigger">
              <span className="cfp-trigger__dot" style={{ background: runwayColor }} />
              <span>{t}</span>
            </div>
          ))}
        </div>
      )}

      {cashflow && (
        <div className="cfp-expanded__chart">
          <CashflowChart months={cashflow.months || cashflow} />
        </div>
      )}
    </div>
  );
}
