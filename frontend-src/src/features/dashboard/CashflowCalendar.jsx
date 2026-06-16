import { useState } from 'react';
import { fmt } from '../../lib/format.js';
import { useCashflowCalendar } from './hooks/useFinanceQueries.js';
import './CashflowCalendar.css';

export default function CashflowCalendar() {
  const { data: raw, isLoading, isError, refetch } = useCashflowCalendar();
  const data = raw?.available !== false ? raw : null;
  const [hovered, setHovered] = useState(null);

  if (isLoading) return <div style={{ height: 320, background: 'var(--color-surface-2)', borderRadius: 12, animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />;
  if (isError) return (
    <div style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
      Failed to load cashflow data. <button onClick={() => refetch()} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
    </div>
  );
  if (!data)   return <p className="cfc-empty">Upload a bank statement to see your cash flow forecast.</p>;

  const today = new Date().getDate();
  const days  = data.days || [];
  const minBal = Math.min(...days.map(d => d.balance));
  const maxBal = Math.max(...days.map(d => d.balance));
  const range  = maxBal - minBal || 1;

  // Balance sparkline path
  const W = 280, H = 60;
  const pts = days.map((d, i) => {
    const x = (i / (days.length - 1)) * W;
    const y = H - ((d.balance - minBal) / range) * (H - 8) - 4;
    return `${x},${y}`;
  });
  const fillPath = `M${pts[0]} L${pts.slice(1).join(' L')} L${W},${H} L0,${H} Z`;

  // Thin days — days where balance < 20% of max
  const thinThreshold = maxBal * 0.2;

  return (
    <div className="cfc">
      {/* Balance line chart */}
      <div className="cfc-chart-wrap">
        <div className="cfc-chart__header">
          <span>Projected balance — next 31 days</span>
          {minBal < thinThreshold && (
            <span className="cfc-chart__warn">⚠ Low balance on some days</span>
          )}
        </div>
        <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="cfc-chart">
          <path d={fillPath} fill="var(--color-primary)" fillOpacity="0.1" />
          <polyline points={pts.join(' ')} fill="none" stroke="var(--color-primary)" strokeWidth="1.5" strokeLinejoin="round" />
          {/* Today marker */}
          {today <= 31 && (
            <line
              x1={((today - 1) / 30) * W} y1="0"
              x2={((today - 1) / 30) * W} y2={H}
              stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="3,3"
            />
          )}
        </svg>
        <div className="cfc-chart__labels">
          <span>Day 1</span><span>Day 15</span><span>Day 31</span>
        </div>
      </div>

      {/* Stats */}
      <div className="cfc-stats">
        {data.salaryDay && (
          <div className="cfc-stat">
            <div className="cfc-stat__label">Salary day</div>
            <div className="cfc-stat__val">{data.salaryDay}th</div>
            {data.salaryAmount > 0 && <div className="cfc-stat__sub">{fmt(data.salaryAmount)}/mo</div>}
          </div>
        )}
        <div className="cfc-stat">
          <div className="cfc-stat__label">Projected end balance</div>
          <div className="cfc-stat__val" style={{ color: days[30]?.balance < 0 ? '#ef4444' : 'var(--color-text)' }}>
            {fmt(days[30]?.balance ?? 0)}
          </div>
        </div>
        <div className="cfc-stat">
          <div className="cfc-stat__label">Lowest point</div>
          <div className="cfc-stat__val" style={{ color: minBal < 0 ? '#ef4444' : minBal < thinThreshold ? '#eab308' : '#22c55e' }}>
            {fmt(minBal)}
          </div>
        </div>
      </div>

      {/* 31-day calendar */}
      <div className="cfc-grid">
        {days.map((d, i) => {
          const isToday     = d.day === today;
          const hasSalary   = d.income > 0;
          const hasDebits   = d.expenses > 0;
          const isThin      = d.balance < thinThreshold && d.balance >= 0;
          const isNegative  = d.balance < 0;
          const isHovered   = hovered === i;
          return (
            <div
              key={i}
              className={[
                'cfc-day',
                isToday    ? 'cfc-day--today'    : '',
                hasSalary  ? 'cfc-day--salary'   : '',
                isThin     ? 'cfc-day--thin'     : '',
                isNegative ? 'cfc-day--negative' : '',
              ].filter(Boolean).join(' ')}
              onMouseEnter={() => setHovered(i)}
              onMouseLeave={() => setHovered(null)}
            >
              <span className="cfc-day__num">{d.day}</span>
              {hasSalary  && <span className="cfc-day__dot cfc-day__dot--in"  title={`+${fmt(d.income)}`} />}
              {hasDebits  && <span className="cfc-day__dot cfc-day__dot--out" title={`-${fmt(d.expenses)}`} />}
              {isHovered && (d.income > 0 || d.expenses > 0) && (
                <div className="cfc-day__tooltip">
                  {d.events.map((ev, j) => (
                    <div key={j} className={`cfc-day__event cfc-day__event--${ev.type}`}>
                      {ev.type === 'income' ? '+' : '-'}{fmt(ev.amount)} {ev.label}
                    </div>
                  ))}
                  <div className="cfc-day__balance">Balance: {fmt(d.balance)}</div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="cfc-legend">
        <span><span className="cfc-legend__dot cfc-legend__dot--in" />Salary/income</span>
        <span><span className="cfc-legend__dot cfc-legend__dot--out" />Debit/subscription</span>
        <span className="cfc-legend__warn">⚠ Low balance day</span>
      </div>
    </div>
  );
}
