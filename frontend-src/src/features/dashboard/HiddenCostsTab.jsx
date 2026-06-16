import { useState, useEffect } from 'react';
import { finances } from '../../lib/api.js';
import { fmt, fmtDate } from '../../lib/format.js';
import { InsightCard } from './FinancesTab.jsx';
import CashflowPulse from './CashflowPulse.jsx';
import './HiddenCostsTab.css';

// ── Subscription Timeline ─────────────────────────────────────────────────────
function SubscriptionTimeline({ showToast }) {
  const [subs,    setSubs]    = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    finances.subscriptions()
      .then(d => setSubs(d?.subscriptions || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  async function handleCancel(id) {
    try {
      await finances.updateSubscription(id, { status: 'cancelled' });
      setSubs(prev => prev.map(s => s.id === id ? { ...s, status: 'cancelled' } : s));
      showToast?.('Marked as cancelled', 'success');
    } catch {
      showToast?.('Could not update subscription', 'error');
    }
  }

  if (loading) return <div className="hc-skeleton" />;

  const active = subs.filter(s => s.status === 'active');
  const totalThisMonth = active.reduce((sum, s) => sum + Number(s.avg_amount || 0), 0);
  const renewalsCount  = active.length;

  if (active.length === 0) {
    return <p className="hc-empty">No active subscriptions detected yet. Upload a bank statement to start tracking.</p>;
  }

  const daySlots = Array.from({ length: 31 }, (_, i) => i + 1);

  function isDormant(s) {
    if (!s.last_seen) return false;
    const days = (Date.now() - new Date(s.last_seen).getTime()) / 86400000;
    return days > 60;
  }

  return (
    <div className="hc-timeline">
      <div className="hc-timeline__tally">
        <div className="hc-timeline__tally-cell">
          <div className="hc-timeline__tally-val">{fmt(totalThisMonth)}</div>
          <div className="hc-timeline__tally-label">Total this month</div>
        </div>
        <div className="hc-timeline__tally-divider" />
        <div className="hc-timeline__tally-cell">
          <div className="hc-timeline__tally-val">{renewalsCount}</div>
          <div className="hc-timeline__tally-label">Active subscriptions</div>
        </div>
      </div>

      <div className="hc-calendar">
        {daySlots.map(day => {
          const onDay = active.filter(s => Number(s.billing_day) === day);
          return (
            <div key={day} className={`hc-calendar__slot ${onDay.length ? 'hc-calendar__slot--has' : ''}`} title={onDay.map(s => s.name || s.merchant_name || 'Subscription').join(', ')}>
              <span className="hc-calendar__day">{day}</span>
              {onDay.slice(0, 3).map((s, i) => (
                <span
                  key={i}
                  className={`hc-calendar__dot ${isDormant(s) ? 'hc-calendar__dot--dormant' : ''}`}
                />
              ))}
            </div>
          );
        })}
      </div>

      <div className="hc-sub-list">
        {active.map(s => {
          const dormant = isDormant(s);
          return (
            <div key={s.id} className={`hc-sub-row ${dormant ? 'hc-sub-row--dormant' : ''}`}>
              <div className="hc-sub-row__left">
                <div className="hc-sub-row__name">{s.name || s.merchant_name || 'Subscription'}</div>
                <div className="hc-sub-row__meta">
                  {s.billing_day ? `Bills day ${s.billing_day}` : ''}
                  {s.frequency ? ` · ${s.frequency}` : ''}
                  {dormant ? ' · possibly cancelled, still billing?' : ''}
                </div>
              </div>
              <div className="hc-sub-row__right">
                <div className="hc-sub-row__amount">{fmt(Number(s.avg_amount || 0))}/mo</div>
                {dormant && (
                  <button className="hc-sub-row__cancel" onClick={() => handleCancel(s.id)}>
                    Mark cancelled
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Fee Tracker ───────────────────────────────────────────────────────────────
function FeeTracker() {
  const [fees,    setFees]    = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    finances.fees()
      .then(d => setFees(d?.available !== false ? d : null))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="hc-skeleton" />;
  if (!fees || fees.totalAnnual === 0) {
    return <p className="hc-empty">No bank fees detected in your statements yet.</p>;
  }

  const CAPITEC_ANNUAL = 828;
  const yourBar  = Math.min(100, (fees.totalAnnual / Math.max(fees.totalAnnual, CAPITEC_ANNUAL * 2)) * 100);
  const capitecBar = Math.min(100, (CAPITEC_ANNUAL / Math.max(fees.totalAnnual, CAPITEC_ANNUAL * 2)) * 100);

  return (
    <div className="hc-fees">
      <div className="hc-fees__hero">
        <div className="hc-fees__hero-val">{fmt(fees.totalAnnual)}</div>
        <div className="hc-fees__hero-label">in bank fees this year</div>
        <div className="hc-fees__hero-sub">{fmt(fees.totalMonthly)}/month average</div>
      </div>

      <div className="hc-fees__comparison">
        <div className="hc-fees__comparison-row">
          <span className="hc-fees__comparison-label">Your fees</span>
          <div className="hc-fees__comparison-track">
            <div className="hc-fees__comparison-fill hc-fees__comparison-fill--yours" style={{ width: yourBar + '%' }} />
          </div>
          <span className="hc-fees__comparison-val">{fmt(fees.totalAnnual)}</span>
        </div>
        <div className="hc-fees__comparison-row">
          <span className="hc-fees__comparison-label">Capitec</span>
          <div className="hc-fees__comparison-track">
            <div className="hc-fees__comparison-fill hc-fees__comparison-fill--capitec" style={{ width: capitecBar + '%' }} />
          </div>
          <span className="hc-fees__comparison-val">{fmt(CAPITEC_ANNUAL)}</span>
        </div>
      </div>

      {fees.potentialAnnualSaving > 500 && (
        <div className="hc-fees__cta" onClick={() => window.location.href = '/tools'}>
          Save {fmt(fees.potentialAnnualSaving)}/year by switching banks →
        </div>
      )}

      <div className="hc-fees__items">
        {fees.items.map((item, i) => (
          <div key={i} className="hc-fee-row">
            <div className="hc-fee-row__desc">{item.description}</div>
            <div className="hc-fee-row__right">
              <div className="hc-fee-row__monthly">{fmt(item.monthlyAvg)}/mo</div>
              <div className="hc-fee-row__annual">{fmt(item.total)}/yr</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Main tab ──────────────────────────────────────────────────────────────────
export default function HiddenCostsTab({ showToast }) {
  const [opps,    setOpps]    = useState([]);

  useEffect(() => {
    finances.opportunities()
      .then(d => setOpps((d?.opportunities || []).filter(x => !x.dismissed).slice(0, 5)))
      .catch(() => {});
  }, []);

  return (
    <div className="hc-tab">

      {/* Cash flow pulse */}
      <section className="hc-section">
        <div className="hc-section__header">
          <h3 className="hc-section__title">Cash flow pulse</h3>
          <p className="hc-section__sub">Runway forecast based on your income and spending patterns</p>
        </div>
        <CashflowPulse compact={false} />
      </section>

      {/* Subscription timeline */}
      <section className="hc-section">
        <div className="hc-section__header">
          <h3 className="hc-section__title">Subscriptions</h3>
          <p className="hc-section__sub">Recurring charges — calendar view shows when each one bills</p>
        </div>
        <SubscriptionTimeline showToast={showToast} />
      </section>

      {/* Fee tracker */}
      <section className="hc-section">
        <div className="hc-section__header">
          <h3 className="hc-section__title">Fee tracker</h3>
          <p className="hc-section__sub">Every bank fee you've paid in the last 12 months</p>
        </div>
        <FeeTracker />
      </section>

      {/* Savings opportunities */}
      {opps.length > 0 && (
        <section className="hc-section">
          <div className="hc-section__header">
            <h3 className="hc-section__title">Savings opportunities</h3>
            <p className="hc-section__sub">Actions that could improve your financial position</p>
          </div>
          <div className="hc-opportunities">
            {opps.map((opp, i) => (
              <InsightCard key={opp.id || i} insight={opp} onResolve={() => {}} isPriority={i === 0} />
            ))}
          </div>
        </section>
      )}

    </div>
  );
}
