import { useState } from 'react';
import { fmt } from '@bondly/ui/lib/format.js';
import { useSpendingAnalysis, useMerchants } from './hooks/useFinanceQueries.js';
import './SpendingIntelligence.css';

const CAT_COLORS = [
  '#4a7fa5','#c8a84b','#22c55e','#f97316','#8b5cf6',
  '#ec4899','#14b8a6','#ef4444','#84cc16','#f59e0b',
  '#6366f1','#06b6d4',
];

const CATEGORY_LABELS = {
  salary:            'Salary',
  other_income:      'Other Income',
  mortgage:          'Home Loan',
  rent:              'Rent',
  vehicle_finance:   'Vehicle Finance',
  personal_loan:     'Personal Loan',
  credit_card:       'Credit Card',
  insurance:         'Insurance',
  groceries:         'Groceries',
  fuel:              'Fuel & Transport',
  utilities:         'Utilities',
  subscriptions:     'Subscriptions',
  online_shopping:   'Online Shopping',
  medical:           'Medical',
  entertainment:     'Entertainment',
  dining_out:        'Dining Out',
  education:         'Education',
  domestic:          'Domestic',
  bank_fees:         'Bank Fees',
  transfer:          'Transfers',
  atm:               'Cash / ATM',
  gambling:          'Gambling',
  crypto_investment: 'Crypto',
  sars_tax:          'Tax (SARS)',
  childcare:         'Childcare',
  school_fees:       'School Fees',
  savings_transfer:  'Savings',
  internal_transfer: 'Internal Transfer',
  other:             'Other',
};

// type: essential | discretionary | debt | flagged | savings | neutral
const CATEGORY_META = {
  mortgage:          { type: 'debt',          bankNote: 'Counted as committed debt by all banks' },
  rent:              { type: 'essential',      bankNote: 'Banks count rent as a committed monthly expense' },
  vehicle_finance:   { type: 'debt',          bankNote: 'Counted as committed debt by all banks' },
  personal_loan:     { type: 'debt',          bankNote: 'Counted as committed debt — reduces max bond' },
  credit_card:       { type: 'debt',          bankNote: 'Banks use at least the minimum payment as committed debt' },
  insurance:         { type: 'essential' },
  groceries:         { type: 'essential' },
  fuel:              { type: 'essential' },
  utilities:         { type: 'essential' },
  subscriptions:     { type: 'discretionary', bankNote: 'High subscription spend can be flagged as lifestyle risk' },
  online_shopping:   { type: 'discretionary', bankNote: 'Counted as discretionary spending — keep it reasonable' },
  medical:           { type: 'essential' },
  entertainment:     { type: 'discretionary' },
  dining_out:        { type: 'discretionary', bankNote: 'Banks view frequent dining out as poor budgeting' },
  education:         { type: 'essential' },
  domestic:          { type: 'discretionary' },
  bank_fees:         { type: 'essential' },
  atm:               { type: 'flagged',       bankNote: 'Cash withdrawals are untrackable — high ATM use concerns banks' },
  gambling:          { type: 'flagged',       bankNote: 'Any gambling activity is flagged — can affect approval' },
  crypto_investment: { type: 'discretionary', bankNote: 'Some banks treat crypto spend as a risk indicator' },
  savings_transfer:  { type: 'savings' },
  transfer:          { type: 'neutral' },
  internal_transfer: { type: 'neutral' },
  sars_tax:          { type: 'essential' },
  childcare:         { type: 'essential' },
  school_fees:       { type: 'essential' },
  salary:            { type: 'income' },
  other_income:      { type: 'income' },
  other:             { type: 'neutral' },
};

const TYPE_BADGE = {
  essential:     { label: 'Essential',     color: '#64748b' },
  discretionary: { label: 'Discretionary', color: '#d97706' },
  debt:          { label: 'Debt',          color: '#dc2626' },
  flagged:       { label: 'Bank flag',     color: '#dc2626' },
  savings:       { label: 'Savings',       color: '#16a34a' },
  income:        { label: 'Income',        color: '#2563eb' },
  neutral:       { label: null,            color: '#64748b' },
};

function catLabel(cat) {
  return CATEGORY_LABELS[cat] || cat.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function SmartInsights({ categories, totalSpend }) {
  const insights = [];

  const pct = (cat) => {
    const c = categories.find(x => x.category === cat);
    return c ? (c.amount / totalSpend) * 100 : 0;
  };
  const amt = (cat) => {
    const c = categories.find(x => x.category === cat);
    return c ? c.amount : 0;
  };

  const hasGambling = amt('gambling') > 0;
  const atmPct = pct('atm');
  const diningPct = pct('dining_out');
  const shoppingPct = pct('online_shopping');
  const subsPct = pct('subscriptions');
  const debtTotal = ['mortgage','vehicle_finance','personal_loan','credit_card']
    .reduce((s, c) => s + amt(c), 0);
  const hasTransfer = categories.find(c => c.category === 'transfer');
  const uncategorisedPct = pct('other') + pct('transfer');

  if (hasGambling) {
    insights.push({
      severity: 'high',
      icon: '⚠',
      title: 'Gambling detected',
      body: `${fmt(amt('gambling'))} in gambling transactions. Banks flag this during affordability assessment and it can materially reduce your approval odds.`,
    });
  }

  if (atmPct > 10) {
    insights.push({
      severity: 'medium',
      icon: '💵',
      title: `${Math.round(atmPct)}% of spending is cash`,
      body: 'Banks can\'t verify what cash is spent on. Reduce ATM withdrawals before applying — every rand tracked is a rand that can\'t hurt your application.',
    });
  }

  if (debtTotal > 0) {
    insights.push({
      severity: 'info',
      icon: '🏦',
      title: 'Committed debt obligations',
      body: `${fmt(debtTotal)}/mo in debt repayments. Banks deduct this from your disposable income before calculating your max bond — the lower this is, the more you can borrow.`,
    });
  }

  if (diningPct > 20) {
    insights.push({
      severity: 'medium',
      icon: '🍽',
      title: `High dining out spend (${Math.round(diningPct)}%)`,
      body: `${fmt(amt('dining_out'))}/mo on restaurants and takeaways. Banks see this as discretionary lifestyle spend. Reducing it for 1–2 months before applying will improve your affordability picture.`,
    });
  }

  if (shoppingPct > 15) {
    insights.push({
      severity: 'medium',
      icon: '🛍',
      title: `Online shopping at ${Math.round(shoppingPct)}% of spend`,
      body: `${fmt(amt('online_shopping'))}/mo on online retail. Temu, Shein, and similar platforms are counted as discretionary spend by banks. Cutting back before application helps.`,
    });
  }

  if (subsPct > 12) {
    insights.push({
      severity: 'low',
      icon: '📱',
      title: `High subscription spend (${Math.round(subsPct)}%)`,
      body: `${fmt(amt('subscriptions'))}/mo across subscriptions. Review whether all are active — banks see high subscription counts as a lifestyle overhead.`,
    });
  }

  if (uncategorisedPct > 25 && hasTransfer) {
    insights.push({
      severity: 'low',
      icon: '❓',
      title: 'Large portion unclassified',
      body: `${Math.round(uncategorisedPct)}% of your spend is in "Transfers" or "Other" — these may include real expenses that aren't being counted. Upload a newer statement to improve categorisation.`,
    });
  }

  if (insights.length === 0) return null;

  return (
    <div className="si-insights">
      <div className="si-insights__title">What banks see</div>
      {insights.map((ins, i) => (
        <div key={i} className={`si-insight si-insight--${ins.severity}`}>
          <span className="si-insight__icon">{ins.icon}</span>
          <div className="si-insight__body">
            <strong>{ins.title}</strong>
            <p>{ins.body}</p>
          </div>
        </div>
      ))}
    </div>
  );
}

export default function SpendingIntelligence({ showToast }) {
  const { data: rawSpending, isLoading: spendingLoading, isError: spendingError, refetch: refetchSpending } = useSpendingAnalysis();
  const { data: rawMerchants, isLoading: merchantsLoading } = useMerchants();
  const [view, setView] = useState('treemap');

  const loading = spendingLoading || merchantsLoading;

  // Normalise spending — API returns { rows, anomalies } or legacy array
  const spending = rawSpending
    ? (Array.isArray(rawSpending) ? { rows: rawSpending, anomalies: [] } : rawSpending)
    : null;
  const merchants = (rawMerchants?.available !== false ? rawMerchants?.merchants : null) || [];

  if (loading) return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {[140, 60, 60, 60].map((h, i) => (
        <div key={i} style={{ height: h, borderRadius: 12, background: 'var(--color-surface-2)', animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
      ))}
    </div>
  );
  if (spendingError) return (
    <div style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
      Failed to load spending data. <button onClick={() => refetchSpending()} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
    </div>
  );

  const categories = (spending?.categories || spending?.rows || []).sort((a, b) => b.amount - a.amount);
  const anomalies  = spending?.anomalies || [];
  const totalSpend  = categories.reduce((s, c) => s + c.amount, 0);

  const biggestChange = categories
    .filter(c => c.previousAmount > 0)
    .map(c => ({ ...c, delta: c.amount - c.previousAmount, pct: ((c.amount - c.previousAmount) / c.previousAmount) * 100 }))
    .sort((a, b) => Math.abs(b.pct) - Math.abs(a.pct))[0];

  return (
    <div className="si">
      <div className="si-toggle">
        {[{ id: 'treemap', label: 'Category map' }, { id: 'merchants', label: 'Top merchants' }].map(v => (
          <button key={v.id} className={`si-toggle__btn ${view === v.id ? 'active' : ''}`} onClick={() => setView(v.id)}>
            {v.label}
          </button>
        ))}
      </div>

      {biggestChange && (
        <div className={`si-callout ${biggestChange.delta > 0 ? 'si-callout--up' : 'si-callout--down'}`}>
          <strong>{catLabel(biggestChange.category)}</strong> is {Math.round(Math.abs(biggestChange.pct))}%
          {biggestChange.delta > 0 ? ' higher' : ' lower'} than last month
          {' '}({biggestChange.delta > 0 ? '+' : ''}{fmt(biggestChange.delta)})
        </div>
      )}

      {view === 'treemap' && categories.length > 0 && (
        <>
          <div className="si-treemap">
            {categories.map((cat, i) => {
              const pct   = totalSpend > 0 ? (cat.amount / totalSpend) * 100 : 0;
              const color = CAT_COLORS[i % CAT_COLORS.length];
              const vsLast = cat.previousAmount > 0 ? cat.amount - cat.previousAmount : null;
              const meta = CATEGORY_META[cat.category];
              const isFlagged = meta?.type === 'flagged';
              return (
                <div
                  key={cat.category}
                  className="si-treemap__cell"
                  style={{
                    width: `${Math.max(pct, 8)}%`,
                    background: color + '22',
                    borderColor: isFlagged ? '#dc262655' : color + '55',
                    color,
                    outline: isFlagged ? '1px solid #dc262644' : 'none',
                  }}
                  title={`${catLabel(cat.category)}: ${fmt(cat.amount)} (${pct.toFixed(1)}%)`}
                >
                  <div className="si-treemap__cat">{catLabel(cat.category)}</div>
                  <div className="si-treemap__amt">{fmt(cat.amount)}</div>
                  {vsLast !== null && (
                    <div className="si-treemap__vs" style={{ color: vsLast > 0 ? '#ef4444' : '#22c55e' }}>
                      {vsLast > 0 ? '↑' : '↓'}{fmt(Math.abs(vsLast))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="si-bars">
            {categories.slice(0, 10).map((cat, i) => {
              const pct   = totalSpend > 0 ? (cat.amount / totalSpend) * 100 : 0;
              const color = CAT_COLORS[i % CAT_COLORS.length];
              const meta  = CATEGORY_META[cat.category];
              const badge = meta?.type ? TYPE_BADGE[meta.type] : null;
              return (
                <div key={cat.category} className="si-bar-row">
                  <div className="si-bar-row__label">
                    <span className="si-bar-row__dot" style={{ background: color }} />
                    <span className="si-bar-row__name">{catLabel(cat.category)}</span>
                  </div>
                  <div className="si-bar-row__track">
                    <div className="si-bar-row__fill" style={{ width: pct + '%', background: color }} />
                  </div>
                  <div className="si-bar-row__right">
                    <span className="si-bar-row__amt">{fmt(cat.amount)}</span>
                    {badge?.label && (
                      <span className="si-bar-row__badge" style={{ color: badge.color, borderColor: badge.color + '44' }}>
                        {badge.label}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <SmartInsights categories={categories} totalSpend={totalSpend} />
        </>
      )}

      {view === 'merchants' && (
        <div className="si-merchants">
          {merchants.length === 0
            ? <p className="si-empty">No merchant data yet — upload a bank statement to see where your money goes.</p>
            : merchants.map((m, i) => (
              <div key={i} className="si-merchant-row">
                <div className="si-merchant-row__rank">#{i + 1}</div>
                <div className="si-merchant-row__name">{m.merchant}</div>
                <div className="si-merchant-row__right">
                  <div className="si-merchant-row__total">{fmt(m.total)}</div>
                  <div className="si-merchant-row__count">{m.count}×</div>
                </div>
              </div>
            ))
          }
        </div>
      )}

      {anomalies.length > 0 && (
        <div className="si-anomalies">
          <div className="si-anomalies__title">Unusual transactions</div>
          {anomalies.map((a, i) => (
            <div key={i} className="si-anomaly-row">
              <span className="si-anomaly-row__icon">⚠</span>
              <div className="si-anomaly-row__body">
                <span className="si-anomaly-row__desc">{a.description}</span>
                <span className="si-anomaly-row__date">{String(a.date).slice(0, 10)}</span>
              </div>
              <span className="si-anomaly-row__amt">{fmt(a.amount)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
