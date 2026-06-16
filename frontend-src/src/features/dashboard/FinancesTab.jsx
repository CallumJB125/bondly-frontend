import { useState, useEffect, useCallback, useRef, lazy, Suspense } from 'react';
import {
  Heart, TrendingUp, TrendingDown, CreditCard, Target,
  RefreshCw, ChevronDown, ChevronUp, AlertTriangle,
  CheckCircle, XCircle, Plus, Trash2, Edit2, Info,
  Zap, AlertCircle, BarChart2, Calendar, MessageSquare, X,
  Building2, Lock, Upload, Home, ChevronRight, AlertOctagon,
  ShieldCheck, TrendingUp as TrendUp, DollarSign, PieChart,
  Activity, Layers,
} from 'lucide-react';
import NetWorthCenter       from './NetWorthCenter.jsx';
import SpendingIntelligence  from './SpendingIntelligence.jsx';
import IncomeIntelligence    from './IncomeIntelligence.jsx';
import DebtCommander         from './DebtCommander.jsx';
import CashflowCalendar      from './CashflowCalendar.jsx';
import ReadinessScoreTab     from './ReadinessScoreTab.jsx';
import BankViewTab           from './BankViewTab.jsx';
import { finances as financesApi } from '../../lib/api.js';
import { bankLikelihood, calcMaxBond } from '../../lib/mortgage.js';
import { track as aTrack } from '../../lib/analytics.js';
import { fmt, fmtPct, fmtDate, fmtShort } from '../../lib/format.js';
import { useToast } from '../../components/Toast.jsx';
import Card, { CardHeader, CardBody } from '../../components/Card.jsx';
import Button from '../../components/Button.jsx';
import Input, { Select } from '../../components/Input.jsx';
import { SkeletonCard } from '../../components/Skeleton.jsx';
import './FinancesTab.css';

const SUB_TABS = [
  { id: 'health',        label: 'Score',      icon: Heart },
  { id: 'insights',      label: 'Insights',   icon: Zap },
  { id: 'spending',      label: 'Spending',   icon: PieChart },
  { id: 'income',        label: 'Income',     icon: DollarSign },
  { id: 'net-worth',     label: 'Net Worth',  icon: Layers },
  { id: 'debt',          label: 'Debt',       icon: Activity },
  { id: 'calendar',      label: 'Calendar',   icon: Calendar },
  { id: 'subscriptions', label: 'Subs',       icon: CreditCard },
  { id: 'goals',         label: 'Goals',      icon: Target },
  { id: 'bank-view',     label: 'Banks',      icon: Building2 },
  { id: 'forecast',      label: 'Forecast',   icon: TrendingUp },
];

const GRADE_COLORS = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444' };
const GRADE_LABELS = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Needs work', E: 'Critical' };

const CATEGORY_COLORS = [
  '#4a7fa5', '#c8a84b', '#22c55e', '#f97316', '#8b5cf6',
  '#ec4899', '#06b6d4', '#84cc16', '#f59e0b', '#ef4444',
];

export default function FinancesTab({ initialSubTab }) {
  const [subTab, setSubTab] = useState(initialSubTab || 'health');
  const [health, setHealth] = useState(null);
  const [healthLoading, setHealthLoading] = useState(true);
  const showToast = useToast();

  useEffect(() => {
    financesApi.health()
      .then(h => setHealth(h))
      .catch(() => setHealth({ available: false }))
      .finally(() => setHealthLoading(false));
  }, []);

  function handleRecomputed(newHealth) {
    setHealth({ available: true, ...newHealth });
  }

  if (healthLoading) {
    return (
      <div className="finances-tab">
        <div className="finances-tab__header">
          <h2 className="finances-tab__title">Financial Intelligence</h2>
          <p className="finances-tab__subtitle">AI-powered insights from your bank statements</p>
        </div>
        <SkeletonCard lines={8} />
      </div>
    );
  }

  if (!health?.available) {
    return (
      <div className="finances-tab">
        <div className="finances-tab__header">
          <h2 className="finances-tab__title">Financial Intelligence</h2>
          <p className="finances-tab__subtitle">AI-powered insights from your bank statements</p>
        </div>
        <FinancesEmptyState />
      </div>
    );
  }

  return (
    <div className="finances-tab">
      <div className="finances-tab__header">
        <h2 className="finances-tab__title">Financial Intelligence</h2>
        <p className="finances-tab__subtitle">AI-powered insights from your bank statements</p>
      </div>

      <div className="finances-subtabs">
        {SUB_TABS.map(t => {
          const Icon = t.icon;
          return (
            <button
              key={t.id}
              className={`finances-subtab${subTab === t.id ? ' finances-subtab--active' : ''}`}
              onClick={() => { setSubTab(t.id); aTrack('finances_subtab_viewed', { subTab: t.id }); }}
            >
              <Icon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div className="finances-tab__body">
        {subTab === 'health'        && <ReadinessScoreTab />}
        {subTab === 'insights'      && <InsightsSubTab health={health} showToast={showToast} onNavigate={setSubTab} />}
        {subTab === 'spending'      && <SpendingIntelligence showToast={showToast} />}
        {subTab === 'income'        && <IncomeIntelligence />}
        {subTab === 'net-worth'     && <NetWorthCenter showToast={showToast} />}
        {subTab === 'debt'          && <DebtCommander />}
        {subTab === 'calendar'      && <CashflowCalendar />}
        {subTab === 'subscriptions' && <SubscriptionsSubTab showToast={showToast} />}
        {subTab === 'goals'         && <GoalsSubTab health={health} showToast={showToast} />}
        {subTab === 'bank-view'     && <BankViewTab />}
        {subTab === 'forecast'      && <ForecastSubTab showToast={showToast} />}
      </div>
    </div>
  );
}

// ── Health Sub-Tab ────────────────────────────────────────
function HealthSubTab({ health, healthLoading, onRecomputed, showToast }) {
  const [mortgageReadiness, setMortgageReadiness] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recomputing, setRecomputing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [hist, mr] = await Promise.all([
        financesApi.healthHistory(),
        financesApi.mortgageReadiness().catch(() => null),
      ]);
      setHistory(hist || []);
      setMortgageReadiness(mr);
      if (health?.overallScore != null) {
        aTrack('finances_health_score_viewed', { score: health.overallScore, grade: health.grade });
      }
    } catch (e) {
      showToast(e.message || 'Could not load health data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function recompute() {
    setRecomputing(true);
    try {
      const h = await financesApi.recompute();
      onRecomputed(h);
      showToast('Health score recalculated', 'success');
    } catch (e) {
      showToast(e.message || 'Recompute failed', 'error');
    } finally {
      setRecomputing(false);
    }
  }

  if (healthLoading || loading) return <SkeletonCard lines={6} />;

  const grade = health.grade || 'C';
  const gradeColor = GRADE_COLORS[grade] || '#eab308';
  const score = Math.round(health.overallScore || 0);
  const circumference = 2 * Math.PI * 54;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="health-tab">
      {/* Mortgage Readiness Hero — the main event */}
      {mortgageReadiness && (
        <MortgageReadinessHero mr={mortgageReadiness} improvements={health.improvements} />
      )}

      {/* Financial health breakdown — collapsed when MR hero is shown */}
      <details className="health-details" open={!mortgageReadiness}>
        <summary className="health-details__summary">
          <span>Financial health breakdown</span>
          <span className="health-details__grade" style={{ color: gradeColor }}>{grade} · {score}/100</span>
        </summary>

        {/* Score ring + grade */}
        <div className="health-hero">
          <div className="health-ring-wrap">
            <svg width="140" height="140" viewBox="0 0 140 140">
              <circle cx="70" cy="70" r="54" fill="none" stroke="var(--border)" strokeWidth="12" />
              <circle
                cx="70" cy="70" r="54" fill="none"
                stroke={gradeColor} strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={circumference}
                strokeDashoffset={offset}
                transform="rotate(-90 70 70)"
                style={{ transition: 'stroke-dashoffset 1s ease' }}
              />
              <text x="70" y="64" textAnchor="middle" fill="var(--text-primary)" fontSize="28" fontWeight="700">{score}</text>
              <text x="70" y="82" textAnchor="middle" fill={gradeColor} fontSize="13" fontWeight="600">{grade}</text>
            </svg>
          </div>
          <div className="health-hero__info">
            <div className="health-grade-label" style={{ color: gradeColor }}>
              {GRADE_LABELS[grade] || 'Fair'}
            </div>
            <p className="health-hero__desc">
              Your financial health is measured across 7 areas based on your transaction history.
            </p>
            {health.dataQuality && (
              <div className="health-quality-pill">
                <span>Data quality:</span>
                <span className={`health-quality-dot health-quality-dot--${health.dataQuality}`}></span>
                <span style={{ textTransform: 'capitalize' }}>{health.dataQuality}</span>
              </div>
            )}
            <button className="health-recompute-btn" onClick={recompute} disabled={recomputing}>
              <RefreshCw size={13} className={recomputing ? 'spinning' : ''} />
              {recomputing ? 'Recalculating…' : 'Recalculate'}
            </button>
          </div>
        </div>

        {/* Sub-scores */}
        {health.subScores && (
          <Card style={{ marginTop: 'var(--space-5)' }}>
            <CardHeader>Score breakdown</CardHeader>
            <CardBody>
              <div className="subscore-list">
                {Object.entries(health.subScores).map(([key, val]) => {
                  const pct = Math.min(100, Math.max(0, Math.round(typeof val === 'object' ? (val.score ?? 0) : val)));
                  const color = pct >= 70 ? '#22c55e' : pct >= 50 ? '#eab308' : '#ef4444';
                  const label = typeof val === 'object' && val.label
                    ? val.label
                    : key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
                  return (
                    <div key={key} className="subscore-row">
                      <span className="subscore-label">{label}</span>
                      <div className="subscore-bar">
                        <div className="subscore-fill" style={{ width: pct + '%', background: color }} />
                      </div>
                      <span className="subscore-pct" style={{ color }}>{pct}</span>
                    </div>
                  );
                })}
              </div>
            </CardBody>
          </Card>
        )}

        {/* Score history mini-chart */}
        {history.length > 1 && (
          <Card style={{ marginTop: 'var(--space-5)' }}>
            <CardHeader>Score history</CardHeader>
            <CardBody>
              <ScoreHistoryChart history={history} />
            </CardBody>
          </Card>
        )}

        {/* Improvement tips */}
        {health.improvements?.length > 0 && (
          <Card style={{ marginTop: 'var(--space-5)' }}>
            <CardHeader>How to improve</CardHeader>
            <CardBody>
              <div className="improvement-list">
                {health.improvements.slice(0, 4).map((tip, i) => (
                  <div key={i} className="improvement-item">
                    <div className="improvement-gain">+{tip.points || tip.gain || 0} pts</div>
                    <div className="improvement-content">
                      <div className="improvement-category">{tip.area || tip.category || ''}</div>
                      <div className="improvement-action">{tip.detail || tip.action || tip.title}</div>
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>
        )}
      </details>
    </div>
  );
}

// ── Spending Sub-Tab ──────────────────────────────────────
function SpendingSubTab({ showToast }) {
  const [analysis, setAnalysis] = useState(null);
  const [patterns, setPatterns] = useState([]);
  const [txns, setTxns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeCat, setActiveCat] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [a, p, t] = await Promise.all([
        financesApi.spendingAnalysis(),
        financesApi.patterns(),
        financesApi.transactions({ limit: 50 }),
      ]);
      setAnalysis(a);
      setPatterns(p || []);
      setTxns(t?.transactions || []);
    } catch (e) {
      showToast(e.message || 'Could not load spending data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolvePattern(id) {
    try {
      await financesApi.resolvePattern(id);
      setPatterns(p => p.map(x => x.id === id ? { ...x, resolvedAt: new Date().toISOString() } : x));
    } catch {}
  }

  if (loading) return <SkeletonCard lines={6} />;

  // API returns raw rows [{category, direction, month, total, count}] — aggregate by category
  const cats = (() => {
    const rows = Array.isArray(analysis) ? analysis : (analysis?.rows || []);
    const map = {};
    for (const r of rows) {
      if (r.direction !== 'debit') continue;
      const k = r.category || 'other';
      map[k] = (map[k] || 0) + Number(r.total);
    }
    return Object.entries(map)
      .map(([category, total]) => ({ category, total }))
      .sort((a, b) => b.total - a.total);
  })();

  if (!analysis || cats.length === 0) {
    return (
      <EmptyState
        icon={<BarChart2 size={40} />}
        title="No spending data"
        message="Upload a bank statement to see your spending breakdown."
      />
    );
  }

  const total = cats.reduce((s, c) => s + c.total, 0);
  const activeData = activeCat ? cats.find(c => c.category === activeCat) : null;

  return (
    <div className="spending-tab">
      {/* Category donut + list */}
      <div className="spending-layout">
        <Card className="spending-chart-card">
          <CardHeader>Spending by category</CardHeader>
          <CardBody>
            <DonutChart categories={cats} total={total} onSelect={setActiveCat} activeKey={activeCat} />
          </CardBody>
        </Card>

        <Card className="spending-cats-card">
          <CardHeader>Categories</CardHeader>
          <CardBody>
            <div className="cat-list">
              {cats.map((c, i) => {
                const pct = total > 0 ? (c.total / total * 100).toFixed(1) : 0;
                const color = CATEGORY_COLORS[i % CATEGORY_COLORS.length];
                return (
                  <button
                    key={c.category}
                    className={`cat-row${activeCat === c.category ? ' cat-row--active' : ''}`}
                    onClick={() => setActiveCat(a => a === c.category ? null : c.category)}
                  >
                    <span className="cat-dot" style={{ background: color }} />
                    <span className="cat-name">{c.category}</span>
                    <span className="cat-pct">{pct}%</span>
                    <span className="cat-amt">{fmt(c.total)}</span>
                  </button>
                );
              })}
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Merchant drill-down */}
      {activeData?.topMerchants?.length > 0 && (
        <Card style={{ marginTop: 'var(--space-5)' }}>
          <CardHeader>{activeData.category} — top merchants</CardHeader>
          <CardBody>
            <div className="merchant-list">
              {activeData.topMerchants.map((m, i) => (
                <div key={i} className="merchant-row">
                  <span className="merchant-name">{m.merchant}</span>
                  <div className="merchant-bar-wrap">
                    <div className="merchant-bar" style={{
                      width: (m.total / activeData.total * 100) + '%',
                      background: CATEGORY_COLORS[cats.findIndex(c => c.category === activeCat) % CATEGORY_COLORS.length]
                    }} />
                  </div>
                  <span className="merchant-amt">{fmt(m.total)}</span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Patterns moved to the Insights tab */}

      {/* Recent transactions */}
      {txns.length > 0 && (
        <Card style={{ marginTop: 'var(--space-5)' }}>
          <CardHeader>Recent transactions</CardHeader>
          <CardBody>
            <div className="txn-list">
              {txns.slice(0, 20).map((t, i) => (
                <div key={i} className="txn-row">
                  <div className="txn-info">
                    <span className="txn-merchant">{t.merchant || t.description}</span>
                    <span className="txn-cat">{t.category}</span>
                  </div>
                  <div className="txn-right">
                    <span className={`txn-amt txn-amt--${t.direction}`}>
                      {t.direction === 'credit' ? '+' : '-'}{fmt(Math.abs(t.amount))}
                    </span>
                    <span className="txn-date">{fmtDate(t.date)}</span>
                  </div>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

// ── Subscriptions Sub-Tab ─────────────────────────────────
export function SubscriptionsSubTab({ showToast }) {
  const [subs, setSubs] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financesApi.subscriptions();
      setSubs(data || []);
    } catch (e) {
      showToast(e.message || 'Could not load subscriptions', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function updateStatus(id, status) {
    try {
      await financesApi.updateSubscription(id, { status });
      setSubs(s => s.map(x => x.id === id ? { ...x, status } : x));
      aTrack('finances_subscription_actioned', { action: status });
    } catch (e) {
      showToast(e.message || 'Could not update', 'error');
    }
  }

  if (loading) return <SkeletonCard lines={5} />;

  if (!subs.length) {
    return (
      <EmptyState
        icon={<CreditCard size={40} />}
        title="No subscriptions detected"
        message="Upload a bank statement to automatically detect recurring payments and subscriptions."
      />
    );
  }

  const active = subs.filter(s => s.status === 'active');
  const cancelled = subs.filter(s => s.status === 'cancelled');
  const monthlyTotal = active.reduce((s, sub) => s + sub.monthlyAmount, 0);
  const annualTotal = monthlyTotal * 12;

  // Group by type for duplicate detection
  const typeGroups = {};
  active.forEach(s => {
    if (!typeGroups[s.serviceType]) typeGroups[s.serviceType] = [];
    typeGroups[s.serviceType].push(s);
  });
  const duplicates = Object.values(typeGroups).filter(g => g.length > 1).flat().map(s => s.id);

  return (
    <div className="subs-tab">
      {/* Summary */}
      <div className="subs-summary">
        <div className="subs-stat">
          <span className="subs-stat__label">Active subscriptions</span>
          <span className="subs-stat__value">{active.length}</span>
        </div>
        <div className="subs-stat">
          <span className="subs-stat__label">Monthly total</span>
          <span className="subs-stat__value subs-stat__value--highlight">{fmt(monthlyTotal)}</span>
        </div>
        <div className="subs-stat">
          <span className="subs-stat__label">Annual spend</span>
          <span className="subs-stat__value">{fmt(annualTotal)}</span>
        </div>
      </div>

      {duplicates.length > 0 && (
        <div className="subs-duplicate-warning">
          <AlertTriangle size={16} />
          <span>You may have duplicate subscriptions in the same category — consider cancelling one.</span>
        </div>
      )}

      <Card style={{ marginTop: 'var(--space-5)' }}>
        <CardHeader>Active ({active.length})</CardHeader>
        <CardBody>
          <div className="sub-list">
            {active.map(sub => (
              <SubCard key={sub.id} sub={sub} isDuplicate={duplicates.includes(sub.id)} onStatus={updateStatus} />
            ))}
          </div>
        </CardBody>
      </Card>

      {cancelled.length > 0 && (
        <Card style={{ marginTop: 'var(--space-5)' }}>
          <CardHeader>Cancelled ({cancelled.length})</CardHeader>
          <CardBody>
            <div className="sub-list">
              {cancelled.map(sub => (
                <SubCard key={sub.id} sub={sub} isDuplicate={false} onStatus={updateStatus} />
              ))}
            </div>
          </CardBody>
        </Card>
      )}
    </div>
  );
}

function SubCard({ sub, isDuplicate, onStatus }) {
  const isActive = sub.status === 'active';
  return (
    <div className={`sub-card${isDuplicate ? ' sub-card--duplicate' : ''}${!isActive ? ' sub-card--cancelled' : ''}`}>
      <div className="sub-card__body">
        <div className="sub-card__name">
          {sub.merchant}
          {isDuplicate && <span className="sub-duplicate-badge">Possible duplicate</span>}
        </div>
        <div className="sub-card__meta">
          <span>{sub.serviceType || 'Subscription'}</span>
          {sub.lastSeen && <span>Last charged {fmtDate(sub.lastSeen)}</span>}
          <span className="sub-frequency">{sub.frequency}</span>
        </div>
      </div>
      <div className="sub-card__right">
        <span className="sub-amt">{fmt(sub.monthlyAmount)}/mo</span>
        <button
          className={`sub-toggle sub-toggle--${isActive ? 'cancel' : 'restore'}`}
          onClick={() => onStatus(sub.id, isActive ? 'cancelled' : 'active')}
        >
          {isActive ? 'Cancel' : 'Restore'}
        </button>
      </div>
    </div>
  );
}

// ── Goals Sub-Tab ─────────────────────────────────────────
function GoalsSubTab({ health, showToast }) {
  const [goals, setGoals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState({ name: '', targetAmount: '', targetDate: '', category: 'savings', monthlyContribution: '' });
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financesApi.goals();
      setGoals(data || []);
    } catch (e) {
      showToast(e.message || 'Could not load goals', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addGoal(e) {
    e.preventDefault();
    if (!form.name || !form.targetAmount) return;
    setSaving(true);
    try {
      const g = await financesApi.createGoal({
        name: form.name,
        targetAmount: parseFloat(form.targetAmount),
        targetDate: form.targetDate || null,
        category: form.category,
        monthlyContribution: parseFloat(form.monthlyContribution) || 0,
      });
      setGoals(prev => [...prev, g]);
      setForm({ name: '', targetAmount: '', targetDate: '', category: 'savings', monthlyContribution: '' });
      setShowAdd(false);
      aTrack('finances_goal_created', { category: form.category });
      showToast('Goal added', 'success');
    } catch (e) {
      showToast(e.message || 'Could not add goal', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function deleteGoal(id) {
    try {
      await financesApi.deleteGoal(id);
      setGoals(g => g.filter(x => x.id !== id));
      showToast('Goal removed', 'success');
    } catch (e) {
      showToast(e.message || 'Could not remove', 'error');
    }
  }

  async function updateContrib(id, monthlyContribution) {
    try {
      const updated = await financesApi.updateGoal(id, { monthlyContribution: parseFloat(monthlyContribution) || 0 });
      setGoals(g => g.map(x => x.id === id ? updated : x));
    } catch {}
  }

  if (loading) return <SkeletonCard lines={5} />;

  return (
    <div className="goals-tab">
      <div className="goals-header">
        <h3 className="goals-title">{goals.length} goal{goals.length !== 1 ? 's' : ''}</h3>
        <Button size="sm" onClick={() => setShowAdd(s => !s)}>
          <Plus size={14} /> Add goal
        </Button>
      </div>

      {showAdd && (
        <Card style={{ marginBottom: 'var(--space-5)' }}>
          <CardHeader>New goal</CardHeader>
          <CardBody>
            <form className="goal-form" onSubmit={addGoal}>
              <Input
                label="Goal name"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                placeholder="e.g. Emergency fund"
                required
              />
              <div className="goal-form-row">
                <Input
                  label="Target amount (R)"
                  type="number"
                  value={form.targetAmount}
                  onChange={e => setForm(f => ({ ...f, targetAmount: e.target.value }))}
                  placeholder="50000"
                  required
                />
                <Input
                  label="Monthly contribution (R)"
                  type="number"
                  value={form.monthlyContribution}
                  onChange={e => setForm(f => ({ ...f, monthlyContribution: e.target.value }))}
                  placeholder="1000"
                />
              </div>
              <div className="goal-form-row">
                <Select
                  label="Category"
                  value={form.category}
                  onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                >
                  <option value="savings">Savings</option>
                  <option value="emergency_fund">Emergency fund</option>
                  <option value="investment">Investment</option>
                  <option value="deposit">Home deposit</option>
                  <option value="debt_free">Debt-free</option>
                  <option value="other">Other</option>
                </Select>
                <Input
                  label="Target date (optional)"
                  type="date"
                  value={form.targetDate}
                  onChange={e => setForm(f => ({ ...f, targetDate: e.target.value }))}
                />
              </div>
              <div className="goal-form-actions">
                <Button type="submit" loading={saving}>Save goal</Button>
                <Button variant="ghost" type="button" onClick={() => setShowAdd(false)}>Cancel</Button>
              </div>
            </form>
          </CardBody>
        </Card>
      )}

      {goals.length === 0 && !showAdd ? (
        <GoalTemplates health={health} onSelect={tpl => { setForm(tpl); setShowAdd(true); }} />
      ) : (
        <div className="goals-list">
          {goals.map(g => (
            <GoalCard key={g.id} goal={g} onDelete={deleteGoal} onUpdateContrib={updateContrib} />
          ))}
        </div>
      )}
    </div>
  );
}

function GoalCard({ goal, onDelete, onUpdateContrib }) {
  const [editing, setEditing] = useState(false);
  const [contrib, setContrib] = useState(String(goal.monthly_contribution || goal.monthlyContribution || ''));

  const target   = Number(goal.target_amount  || goal.targetAmount  || 0);
  const current  = Number(goal.current_amount || goal.currentAmount || 0);
  const progress = target > 0 ? Math.min(100, (current / target) * 100) : 0;
  const remaining = Math.max(0, target - current);

  const onTrack  = goal.on_track;
  const projDate = goal.projected_completion_date;
  const behindBy = Number(goal.behind_by || 0);

  const progressColor = onTrack === false ? '#f97316' : onTrack === true ? '#22c55e' : 'var(--mint)';

  function fmtProjDate(iso) {
    if (!iso) return null;
    const d = new Date(iso);
    return d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
  }

  const monthsLeft = goal.months_to_goal || goal.monthsToTarget;

  return (
    <Card style={{ marginBottom: 'var(--space-4)' }}>
      <CardBody>
        <div className="goal-card">
          <div className="goal-card__header">
            <div className="goal-card__name">{goal.name}</div>
            <div className="goal-card__actions">
              <button className="goal-action" onClick={() => setEditing(e => !e)}><Edit2 size={14} /></button>
              <button className="goal-action goal-action--delete" onClick={() => onDelete(goal.id)}><Trash2 size={14} /></button>
            </div>
          </div>
          <div className="goal-card__amounts">
            <span className="goal-current">{fmt(current)}</span>
            <span className="goal-sep"> / </span>
            <span className="goal-target">{fmt(target)}</span>
          </div>

          {/* Timeline bar */}
          <div className="goal-timeline">
            <div className="goal-timeline__track">
              <div className="goal-timeline__fill" style={{ width: progress + '%', background: progressColor }} />
            </div>
            <div className="goal-timeline__labels">
              <span>Start</span>
              <span style={{ color: progressColor }}>{Math.round(progress)}%</span>
              <span>Goal</span>
            </div>
          </div>

          <div className="goal-card__meta">
            {remaining > 0 && <span>{fmt(remaining)} to go</span>}
            {projDate && onTrack !== false && (
              <span className="goal-meta--green">On track for {fmtProjDate(projDate)}{monthsLeft ? ` · ${monthsLeft} months` : ''}</span>
            )}
            {projDate && onTrack === false && (
              <span className="goal-meta--amber">Behind — at this rate: {fmtProjDate(projDate)}{behindBy > 0 ? ` (${fmt(behindBy)} behind target)` : ''}</span>
            )}
            {!projDate && goal.targetDate && <span>Target: {fmtDate(goal.targetDate)}</span>}
          </div>

          {editing && (
            <div className="goal-edit-row">
              <Input
                label="Monthly contribution (R)"
                type="number"
                value={contrib}
                onChange={e => setContrib(e.target.value)}
              />
              <Button size="sm" onClick={() => { onUpdateContrib(goal.id, contrib); setEditing(false); }}>Save</Button>
            </div>
          )}
        </div>
      </CardBody>
    </Card>
  );
}

// ── Forecast Sub-Tab ──────────────────────────────────────
function ForecastSubTab({ showToast }) {
  const [cashflow, setCashflow] = useState(null);
  const [loading, setLoading] = useState(true);
  const [changes, setChanges] = useState({
    incomeChange: 0,
    rentChange: 0,
    foodReduction: 0,
    entertainmentReduction: 0,
    extraDebtPayment: 0,
  });
  const [scenario, setScenario] = useState(null);
  const [scenarioLoading, setScenarioLoading] = useState(false);
  const [advisorQ, setAdvisorQ] = useState('');
  const [advisorResp, setAdvisorResp] = useState(null);
  const [advisorLoading, setAdvisorLoading] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await financesApi.cashflow();
      setCashflow(data);
    } catch (e) {
      showToast(e.message || 'Could not load forecast', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function runScenario() {
    setScenarioLoading(true);
    try {
      const data = await financesApi.scenario(changes);
      setScenario(data);
    } catch (e) {
      showToast(e.message || 'Scenario failed', 'error');
    } finally {
      setScenarioLoading(false);
    }
  }

  async function askAdvisor(e) {
    e.preventDefault();
    if (!advisorQ.trim()) return;
    setAdvisorLoading(true);
    aTrack('finances_advisor_queried', { promptLength: advisorQ.trim().length });
    try {
      const data = await financesApi.advisorInsights(advisorQ);
      setAdvisorResp(data);
    } catch (e) {
      showToast(e.message || 'Could not get AI advice', 'error');
    } finally {
      setAdvisorLoading(false);
    }
  }

  if (loading) return <SkeletonCard lines={6} />;

  if (!cashflow) {
    return (
      <EmptyState
        icon={<TrendingUp size={40} />}
        title="No forecast data yet"
        message="Upload a bank statement to generate your 24-month cashflow forecast."
      />
    );
  }

  const baseline = cashflow.baseline || [];
  const avgIncome = cashflow.avgMonthlyIncome || 0;
  const avgExpenses = cashflow.avgMonthlyExpenses || 0;
  const avgNet = avgIncome - avgExpenses;
  const projectedSavings = cashflow.projectedAnnualSavings || 0;

  return (
    <div className="forecast-tab">
      {/* Summary */}
      <div className="forecast-summary">
        <div className="forecast-stat">
          <span className="forecast-stat__label">Avg monthly income</span>
          <span className="forecast-stat__value forecast-stat__value--green">{fmt(avgIncome)}</span>
        </div>
        <div className="forecast-stat">
          <span className="forecast-stat__label">Avg monthly expenses</span>
          <span className="forecast-stat__value forecast-stat__value--red">{fmt(avgExpenses)}</span>
        </div>
        <div className="forecast-stat">
          <span className="forecast-stat__label">Net monthly surplus</span>
          <span className={`forecast-stat__value ${avgNet >= 0 ? 'forecast-stat__value--green' : 'forecast-stat__value--red'}`}>
            {avgNet >= 0 ? '+' : ''}{fmt(avgNet)}
          </span>
        </div>
        <div className="forecast-stat">
          <span className="forecast-stat__label">Projected annual savings</span>
          <span className="forecast-stat__value">{fmt(projectedSavings)}</span>
        </div>
      </div>

      {/* Baseline chart */}
      {baseline.length > 0 && (
        <Card style={{ marginTop: 'var(--space-5)' }}>
          <CardHeader>24-month cashflow projection</CardHeader>
          <CardBody>
            <CashflowChart months={baseline} />
          </CardBody>
        </Card>
      )}

      {/* Scenario simulator */}
      <Card style={{ marginTop: 'var(--space-5)' }}>
        <CardHeader>Scenario simulator</CardHeader>
        <CardBody>
          <p className="scenario-desc">
            Adjust variables to see how changes would affect your finances over the next 24 months.
          </p>
          <div className="scenario-sliders">
            <ScenarioSlider
              label="Income change"
              value={changes.incomeChange}
              min={-5000} max={20000} step={500}
              format={v => (v >= 0 ? '+' : '') + fmt(v) + '/mo'}
              onChange={v => setChanges(c => ({ ...c, incomeChange: v }))}
            />
            <ScenarioSlider
              label="Rent/bond change"
              value={changes.rentChange}
              min={-5000} max={5000} step={250}
              format={v => (v >= 0 ? '+' : '') + fmt(v) + '/mo'}
              onChange={v => setChanges(c => ({ ...c, rentChange: v }))}
            />
            <ScenarioSlider
              label="Food spending reduction"
              value={changes.foodReduction}
              min={0} max={5000} step={100}
              format={v => '-' + fmt(v) + '/mo'}
              onChange={v => setChanges(c => ({ ...c, foodReduction: v }))}
            />
            <ScenarioSlider
              label="Entertainment reduction"
              value={changes.entertainmentReduction}
              min={0} max={3000} step={100}
              format={v => '-' + fmt(v) + '/mo'}
              onChange={v => setChanges(c => ({ ...c, entertainmentReduction: v }))}
            />
            <ScenarioSlider
              label="Extra debt payment"
              value={changes.extraDebtPayment}
              min={0} max={10000} step={250}
              format={v => '+' + fmt(v) + '/mo'}
              onChange={v => setChanges(c => ({ ...c, extraDebtPayment: v }))}
            />
          </div>
          <Button onClick={runScenario} loading={scenarioLoading} style={{ marginTop: 'var(--space-4)' }}>
            Run scenario
          </Button>

          {scenario && (
            <div className="scenario-results">
              <div className="scenario-result-item">
                <span>Net surplus (baseline)</span>
                <span className="scenario-result-val">{fmt(scenario.baselineNetMonthly)}/mo</span>
              </div>
              <div className="scenario-result-item">
                <span>Net surplus (with changes)</span>
                <span className="scenario-result-val scenario-result-val--highlight">{fmt(scenario.scenarioNetMonthly)}/mo</span>
              </div>
              <div className="scenario-result-item">
                <span>24-month cumulative gain</span>
                <span className={`scenario-result-val ${scenario.cumulativeGain >= 0 ? 'scenario-result-val--green' : 'scenario-result-val--red'}`}>
                  {scenario.cumulativeGain >= 0 ? '+' : ''}{fmt(scenario.cumulativeGain)}
                </span>
              </div>
              {scenario.projectedSavings24m != null && (
                <div className="scenario-result-item">
                  <span>Projected savings in 24 months</span>
                  <span className="scenario-result-val">{fmt(scenario.projectedSavings24m)}</span>
                </div>
              )}
              {scenario.debtFreeMonths && (
                <div className="scenario-result-item">
                  <span>Estimated debt-free in</span>
                  <span className="scenario-result-val">{scenario.debtFreeMonths} months</span>
                </div>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* AI Advisor */}
      <Card style={{ marginTop: 'var(--space-5)' }}>
        <CardHeader>
          <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
            <MessageSquare size={16} />
            AI Financial Advisor
          </span>
        </CardHeader>
        <CardBody>
          <p className="advisor-desc">
            Ask your AI advisor anything about your finances. It has full context of your spending, income, subscriptions, and goals.
          </p>
          <form className="advisor-form" onSubmit={askAdvisor}>
            <Input
              value={advisorQ}
              onChange={e => setAdvisorQ(e.target.value)}
              placeholder="e.g. How can I save R2,000 more per month?"
            />
            <Button type="submit" loading={advisorLoading} disabled={!advisorQ.trim()}>Ask</Button>
          </form>
          {advisorResp && (
            <div className="advisor-response">
              <div className="advisor-response__label">AI Advisor</div>
              <div className="advisor-response__text">{advisorResp.insight}</div>
              {advisorResp.actions?.length > 0 && (
                <ul className="advisor-actions">
                  {advisorResp.actions.map((a, i) => <li key={i}>{a}</li>)}
                </ul>
              )}
              <div className="advisor-disclaimer">
                For illustration only. Not financial advice. Please consult a licensed financial advisor for personalised recommendations.
              </div>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ── Helper components ─────────────────────────────────────

function PatternCard({ pattern, onResolve }) {
  const SEVERITY_COLORS = { high: '#ef4444', medium: '#f97316', low: '#eab308' };
  const severity = pattern.severity || 'medium';
  return (
    <div className={`pattern-card pattern-card--${severity}`}>
      <div className="pattern-card__header">
        <span className="pattern-type">{pattern.patternType?.replace(/_/g, ' ')}</span>
        <span className="pattern-severity" style={{ color: SEVERITY_COLORS[severity] }}>{severity}</span>
      </div>
      <p className="pattern-desc">{pattern.description}</p>
      {pattern.monthlyCost > 0 && (
        <p className="pattern-cost">Monthly impact: {fmt(pattern.monthlyCost)}</p>
      )}
      <button className="pattern-resolve" onClick={() => onResolve(pattern.id)}>
        <CheckCircle size={13} /> Mark resolved
      </button>
    </div>
  );
}

function DonutChart({ categories, total, onSelect, activeKey }) {
  const size = 160;
  const cx = size / 2;
  const cy = size / 2;
  const r = 58;
  let cumAngle = -Math.PI / 2;
  const slices = categories.map((c, i) => {
    const pct = total > 0 ? c.total / total : 0;
    const angle = pct * 2 * Math.PI;
    const x1 = cx + r * Math.cos(cumAngle);
    const y1 = cy + r * Math.sin(cumAngle);
    const endAngle = cumAngle + angle;
    const x2 = cx + r * Math.cos(endAngle);
    const y2 = cy + r * Math.sin(endAngle);
    const large = angle > Math.PI ? 1 : 0;
    const path = `M${cx},${cy} L${x1},${y1} A${r},${r} 0 ${large},1 ${x2},${y2} Z`;
    const slice = { path, color: CATEGORY_COLORS[i % CATEGORY_COLORS.length], category: c.category, pct };
    cumAngle = endAngle;
    return slice;
  });

  const active = activeKey ? categories.find(c => c.category === activeKey) : null;
  const activePct = active && total > 0 ? (active.total / total * 100).toFixed(1) : null;

  return (
    <div className="donut-wrap">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {slices.map((s, i) => (
          <path
            key={i} d={s.path} fill={s.color}
            opacity={activeKey && activeKey !== s.category ? 0.35 : 1}
            style={{ cursor: 'pointer', transition: 'opacity 0.2s' }}
            onClick={() => onSelect(k => k === s.category ? null : s.category)}
          />
        ))}
        <circle cx={cx} cy={cy} r={34} fill="var(--bg-card)" />
        {active ? (
          <>
            <text x={cx} y={cy - 6} textAnchor="middle" fill="var(--text-primary)" fontSize="12" fontWeight="700">{activePct}%</text>
            <text x={cx} y={cy + 9} textAnchor="middle" fill="var(--text-secondary)" fontSize="9">{active.category.slice(0, 10)}</text>
          </>
        ) : (
          <text x={cx} y={cy + 4} textAnchor="middle" fill="var(--text-secondary)" fontSize="9">All categories</text>
        )}
      </svg>
    </div>
  );
}

export function ScoreHistoryChart({ history }) {
  const pts = history.slice(-12);
  if (pts.length < 2) return null;
  const scores = pts.map(h => h.overallScore || 0);
  const minS = Math.min(...scores) - 5;
  const maxS = Math.max(...scores) + 5;
  const w = 320; const h = 80;
  const pad = 8;
  const points = pts.map((p, i) => {
    const x = pad + (i / (pts.length - 1)) * (w - 2 * pad);
    const y = h - pad - ((p.overallScore - minS) / (maxS - minS)) * (h - 2 * pad);
    return `${x},${y}`;
  }).join(' ');
  return (
    <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
      <polyline points={points} fill="none" stroke="var(--mint)" strokeWidth="2" strokeLinejoin="round" />
      {pts.map((p, i) => {
        const x = pad + (i / (pts.length - 1)) * (w - 2 * pad);
        const y = h - pad - ((p.overallScore - minS) / (maxS - minS)) * (h - 2 * pad);
        return <circle key={i} cx={x} cy={y} r={3} fill="var(--mint)" />;
      })}
    </svg>
  );
}

export function CashflowChart({ months }) {
  const w = 420; const h = 100; const pad = 10;
  const incomes = months.map(m => m.projectedIncome || 0);
  const expenses = months.map(m => m.projectedExpenses || 0);
  const allVals = [...incomes, ...expenses];
  const maxV = Math.max(...allVals) || 1;

  function barX(i, offset) {
    const slotW = (w - 2 * pad) / months.length;
    return pad + i * slotW + offset;
  }
  const slotW = (w - 2 * pad) / months.length;
  const bw = slotW * 0.4;

  return (
    <div className="cashflow-chart-wrap">
      <svg width="100%" viewBox={`0 0 ${w} ${h}`} style={{ overflow: 'visible' }}>
        {months.map((m, i) => {
          const ih = ((m.projectedIncome || 0) / maxV) * (h - 2 * pad);
          const eh = ((m.projectedExpenses || 0) / maxV) * (h - 2 * pad);
          return (
            <g key={i}>
              <rect x={barX(i, 0)} y={h - pad - ih} width={bw} height={ih} fill="#22c55e" opacity="0.8" rx="1" />
              <rect x={barX(i, bw + 1)} y={h - pad - eh} width={bw} height={eh} fill="#ef4444" opacity="0.7" rx="1" />
            </g>
          );
        })}
      </svg>
      <div className="cashflow-legend">
        <span><span className="cashflow-legend-dot" style={{ background: '#22c55e' }} />Income</span>
        <span><span className="cashflow-legend-dot" style={{ background: '#ef4444' }} />Expenses</span>
      </div>
    </div>
  );
}

function ScenarioSlider({ label, value, min, max, step, format, onChange }) {
  return (
    <div className="scenario-slider">
      <div className="scenario-slider__header">
        <span className="scenario-slider__label">{label}</span>
        <span className="scenario-slider__value">{format(value)}</span>
      </div>
      <input
        type="range" min={min} max={max} step={step} value={value}
        onChange={e => onChange(Number(e.target.value))}
        className="scenario-range"
      />
      <div className="scenario-slider__bounds">
        <span>{format(min)}</span>
        <span>{format(max)}</span>
      </div>
    </div>
  );
}

function EmptyState({ icon, title, message, action }) {
  return (
    <div className="finances-empty">
      <div className="finances-empty__icon">{icon}</div>
      <h3 className="finances-empty__title">{title}</h3>
      <p className="finances-empty__message">{message}</p>
      {action && <div className="finances-empty__action">{action}</div>}
    </div>
  );
}

// ── Sprint 1: Mortgage Readiness Hero ─────────────────────
const PV_FACTOR = 83; // approximate PV factor for 20yr @ 13.25% — used for impact estimates

export function MortgageReadinessHero({ mr, improvements }) {
  const score = mr.overallScore || 0;
  const color = score >= 75 ? '#22c55e' : score >= 55 ? '#d97706' : '#ef4444';
  const circumference = 2 * Math.PI * 40;
  const offset = circumference - (score / 100) * circumference;

  const topBlocker = mr.blockers?.[0];

  // Rough months-to-next-level projection
  let projectedMonths = null;
  if (improvements?.length && score < 80) {
    const totalPoints = improvements.slice(0, 3).reduce((s, t) => s + (t.points || t.gain || 0), 0);
    if (totalPoints > 0) {
      projectedMonths = Math.round((80 - score) / (totalPoints / 3));
      if (projectedMonths > 36) projectedMonths = null; // don't show if too far out
    }
  }

  return (
    <div className="mr-hero">
      <div className="mr-hero__ring-wrap">
        <svg width="100" height="100" viewBox="0 0 100 100">
          <circle cx="50" cy="50" r="40" fill="none" stroke="var(--border)" strokeWidth="9" />
          <circle
            cx="50" cy="50" r="40" fill="none"
            stroke={color} strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            transform="rotate(-90 50 50)"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
          <text x="50" y="46" textAnchor="middle" fill="var(--text-primary)" fontSize="20" fontWeight="700">{score}</text>
          <text x="50" y="60" textAnchor="middle" fill={color} fontSize="9" fontWeight="600">/100</text>
        </svg>
        <div className="mr-hero__level" style={{ color }}>{mr.levelLabel || 'Needs improvement'}</div>
      </div>

      <div className="mr-hero__content">
        <div className="mr-hero__bond">
          <span className="mr-hero__bond-label">You qualify for up to</span>
          <span className="mr-hero__bond-amount">{fmt(mr.maxBondEstimate || 0)}</span>
          <span className="mr-hero__bond-suffix">today</span>
        </div>

        {topBlocker && (
          <div className="mr-hero__blocker">
            <AlertTriangle size={13} style={{ color: '#d97706', flexShrink: 0 }} />
            <span>Main blocker: {topBlocker.detail}</span>
          </div>
        )}

        {projectedMonths && (
          <div className="mr-hero__trajectory">
            At your current trajectory: <strong>{projectedMonths} months</strong> to reach the next level
          </div>
        )}

        <a className="mr-hero__cta" href="#improvements" onClick={e => { e.preventDefault(); document.querySelector('.health-details')?.setAttribute('open', ''); document.querySelector('.improvement-list')?.scrollIntoView({ behavior: 'smooth' }); }}>
          See how to improve <ChevronRight size={13} />
        </a>
      </div>
    </div>
  );
}

// ── Sprint 2: AI Insights Feed ────────────────────────────

const INSIGHT_HEADLINES = {
  gambling_detected:         () => 'Gambling activity will block your bond application automatically',
  food_delivery_dependency:  (p) => `You're spending more on Uber Eats than groceries`,
  payday_spike:              (p) => `You spend most of your monthly budget within 3 days of payday`,
  lifestyle_creep:           (p) => `Your spending grew while your income didn't`,
  income_volatile:           () => 'Your income varies too much — banks notice this',
  savings_absent:            () => 'No savings transfers detected — banks want to see discipline',
  subscription_accumulation: (p) => {
    const m = p.monthly_impact || 0;
    return `You're paying ${fmt(m)}/month in subscriptions — ${fmt(m * 12)}/year`;
  },
  impulse_spending:          (p) => {
    const n = p.evidence?.txnCount || '';
    return `${n ? n + ' impulse purchases' : 'Impulse purchases'} in 24 hours — a pattern banks flag`;
  },
  cash_dependent:            (p) => {
    const pct = p.evidence?.pctExpenses || '';
    return `${pct ? pct + '% of' : 'Most of'} your spending is cash — invisible to affordability checks`;
  },
  fee_heavy:                 (p) => {
    const annual = p.monthly_impact ? fmt(p.monthly_impact * 12) : '';
    return `You're paying ${annual ? annual + '/year' : 'too much'} in bank fees — easy to fix`;
  },
  alcohol_overspend:         (p) => {
    const pct = p.evidence?.pctIncome || '';
    return `High alcohol spend${pct ? ` — ${pct}% of income` : ''} — banks notice this`;
  },
};

const INSIGHT_BANK_CONTEXT = {
  gambling_detected:         'South African banks use a 6-month lookback. Even one month of gambling flags the application for manual review and often automatic rejection.',
  food_delivery_dependency:  'Banks don\'t penalise delivery directly, but high discretionary spend reduces your net disposable income and lowers your qualifying bond amount.',
  payday_spike:              'Banks assess average monthly spending. Payday spikes suggest poor cash flow discipline and inflate your apparent monthly expenses.',
  lifestyle_creep:           'If your spending grows faster than your income, banks see declining affordability headroom — which directly reduces your qualifying bond amount.',
  income_volatile:           'SA banks require 3 months of consistent payslips. Volatile income (freelance, commissions) requires a higher deposit and stronger savings history.',
  savings_absent:            'Banks see zero savings history as a red flag. It suggests you\'d struggle to maintain bond repayments in lean months.',
  subscription_accumulation: 'Subscriptions are treated as fixed recurring expenses in affordability calculations. High subscription burden reduces your disposable income.',
  impulse_spending:          'Banks look for consistent spending patterns. Frequent impulse transactions signal unpredictable cash flow behaviour.',
  cash_dependent:            'Cash withdrawals are untraceable. Banks prefer to see card transactions as they give a clearer picture of your true spending behaviour.',
  fee_heavy:                 'High bank fees reduce net disposable income. Banks notice this in affordability calculations and it can lower your qualifying amount.',
  alcohol_overspend:         'While not automatically flagged like gambling, consistently high alcohol spend is categorised as high-risk discretionary and reduces your affordability score.',
};

const INSIGHT_BADGE = {
  gambling_detected:         { label: 'BANK RISK', color: '#dc2626' },
  income_volatile:           { label: 'BANK RISK', color: '#dc2626' },
  cash_dependent:            { label: 'BANK RISK', color: '#dc2626' },
  food_delivery_dependency:  { label: 'TREND',     color: '#d97706' },
  payday_spike:              { label: 'TREND',     color: '#d97706' },
  lifestyle_creep:           { label: 'TREND',     color: '#d97706' },
  impulse_spending:          { label: 'TREND',     color: '#d97706' },
  subscription_accumulation: { label: 'OPPORTUNITY', color: '#16a34a' },
  fee_heavy:                 { label: 'OPPORTUNITY', color: '#16a34a' },
  savings_absent:            { label: 'IMPROVE',   color: '#3b82f6' },
  alcohol_overspend:         { label: 'IMPROVE',   color: '#3b82f6' },
};

export const BANK_RISK_TYPES = new Set(['gambling_detected', 'income_volatile', 'cash_dependent']);
export const SEVERITY_ORDER = { critical: 0, high: 1, medium: 2, low: 3 };
export const GRADE_COLORS_EXPORT = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444' };
export const GRADE_LABELS_EXPORT = { A: 'Excellent', B: 'Good', C: 'Fair', D: 'Needs work', E: 'Critical' };

function InsightsSubTab({ health, showToast, onNavigate }) {
  const [patterns, setPatterns] = useState([]);
  const [opps, setOpps] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [p, o] = await Promise.all([
        financesApi.patterns(),
        financesApi.opportunities(),
      ]);
      setPatterns(p || []);
      setOpps(o || []);
    } catch (e) {
      showToast(e.message || 'Could not load insights', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  async function resolvePattern(id) {
    try {
      await financesApi.resolvePattern(id);
      setPatterns(ps => ps.filter(x => x.id !== id));
    } catch {}
  }

  async function dismissOpp(id) {
    try {
      await financesApi.dismissOpportunity(id);
      setOpps(os => os.filter(x => x.id !== id));
    } catch {}
  }

  if (loading) return <SkeletonCard lines={6} />;

  // Build unified insights list
  const allInsights = [
    ...patterns.map(p => ({
      id: p.id,
      source: 'pattern',
      type: p.pattern_type || p.patternType,
      severity: p.severity || 'medium',
      monthly_impact: Number(p.monthly_impact || 0),
      recommendation: p.recommendation,
      evidence: typeof p.evidence === 'string' ? (() => { try { return JSON.parse(p.evidence); } catch { return {}; } })() : (p.evidence || {}),
      raw: p,
    })),
    ...opps.map(o => ({
      id: o.id,
      source: 'opportunity',
      type: o.opportunity_type || o.type || 'opportunity',
      severity: o.severity || 'medium',
      monthly_impact: Number(o.estimated_monthly_saving || o.monthlySaving || 0),
      recommendation: o.action || o.description,
      evidence: {},
      raw: o,
    })),
  ];

  // Sort: bank-risk first within each severity tier
  allInsights.sort((a, b) => {
    const sevDiff = (SEVERITY_ORDER[a.severity] || 2) - (SEVERITY_ORDER[b.severity] || 2);
    if (sevDiff !== 0) return sevDiff;
    const aBank = BANK_RISK_TYPES.has(a.type) ? 0 : 1;
    const bBank = BANK_RISK_TYPES.has(b.type) ? 0 : 1;
    return aBank - bBank;
  });

  if (allInsights.length === 0) {
    return (
      <EmptyState
        icon={<Zap size={40} />}
        title="No insights yet"
        message="Upload a bank statement to get AI-powered financial insights."
      />
    );
  }

  const [priority, ...rest] = allInsights;

  return (
    <div className="insights-tab">
      <div className="insights-tab__intro">
        <span className="insights-count">{allInsights.length} insight{allInsights.length !== 1 ? 's' : ''} detected</span>
        {BANK_RISK_TYPES.has(priority?.type) && (
          <span className="insights-risk-warning"><AlertOctagon size={13} /> Bank risk factors present</span>
        )}
      </div>

      {/* Priority card */}
      <div className="insights-priority-label">Your #1 priority this month</div>
      <InsightCard
        insight={priority}
        onResolve={priority.source === 'pattern' ? resolvePattern : dismissOpp}
        isPriority
      />

      {/* Remaining insights */}
      {rest.length > 0 && (
        <div className="insights-list">
          {rest.map(ins => (
            <InsightCard
              key={ins.id}
              insight={ins}
              onResolve={ins.source === 'pattern' ? resolvePattern : dismissOpp}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export function InsightCard({ insight, onResolve, isPriority }) {
  const [bankContextOpen, setBankContextOpen] = useState(false);
  const { type, monthly_impact, recommendation, evidence, severity } = insight;

  const headlineFn = INSIGHT_HEADLINES[type];
  const headline = headlineFn ? headlineFn(insight) : (insight.raw.title || type?.replace(/_/g, ' '));
  const badge = INSIGHT_BADGE[type] || { label: severity?.toUpperCase() || 'NOTE', color: '#6b7280' };
  const bankContext = INSIGHT_BANK_CONTEXT[type];
  const bondImpact = monthly_impact > 0 ? Math.round(monthly_impact * PV_FACTOR) : null;

  return (
    <div className={`insight-card insight-card--${severity}${isPriority ? ' insight-card--priority' : ''}`}>
      <div className="insight-card__top">
        <span className="insight-badge" style={{ background: badge.color + '18', color: badge.color, borderColor: badge.color + '40' }}>
          {badge.label === 'BANK RISK' && <AlertOctagon size={11} />}
          {badge.label}
        </span>
        <button className="insight-dismiss" onClick={() => onResolve(insight.id)} aria-label="Dismiss">
          <X size={13} />
        </button>
      </div>

      <div className="insight-card__headline">{headline}</div>

      {monthly_impact > 0 && (
        <div className="insight-card__impact">
          {bondImpact > 10000
            ? `This is costing you ${fmt(monthly_impact)}/mo — reducing your max bond by ~${fmt(bondImpact)}`
            : `This is costing you ${fmt(monthly_impact)}/mo`
          }
        </div>
      )}

      {recommendation && (
        <div className="insight-card__action">
          <ChevronRight size={12} style={{ flexShrink: 0, color: 'var(--text-secondary)' }} />
          <span>{recommendation}</span>
        </div>
      )}

      {bankContext && (
        <div className="insight-bank-context">
          <button
            className="insight-bank-toggle"
            onClick={() => setBankContextOpen(o => !o)}
          >
            {bankContextOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
            What banks see
          </button>
          {bankContextOpen && (
            <div className="insight-bank-text">{bankContext}</div>
          )}
        </div>
      )}
    </div>
  );
}

// ── Sprint 3: Bank View Sub-Tab ───────────────────────────

const STATUS_CONFIG = {
  likely:     { label: 'Likely',      color: '#16a34a', bg: '#f0fdf4' },
  possible:   { label: 'Possible',    color: '#d97706', bg: '#fffbeb' },
  borderline: { label: 'Borderline',  color: '#ea580c', bg: '#fff7ed' },
  unlikely:   { label: 'Unlikely',    color: '#9ca3af', bg: 'var(--bg-surface)' },
};

function BankViewSubTab({ health, showToast, onNavigate }) {
  const income = health?.metrics?.monthlyIncome || 0;
  const dtiDecimal = income > 0 ? ((health?.metrics?.dtiPct || 0) / 100) : 0;
  const employmentType = 'salaried'; // default; ideally from user profile

  if (!income) {
    return (
      <EmptyState
        icon={<Building2 size={40} />}
        title="No financial data yet"
        message="Upload a bank statement to see which banks would approve you today."
      />
    );
  }

  const banks = bankLikelihood(income, dtiDecimal, employmentType);
  const likelyCount = banks.filter(b => b.status === 'likely' || b.status === 'possible').length;

  return (
    <div className="bank-view-tab">
      <div className="bank-view__summary">
        <span className="bank-view__count">
          <strong style={{ color: likelyCount >= 4 ? '#16a34a' : likelyCount >= 2 ? '#d97706' : '#ef4444' }}>
            {likelyCount} of {banks.length}
          </strong> banks would consider you today
        </span>
        <button className="bank-view__improve-link" onClick={() => onNavigate('insights')}>
          What would improve this? <ChevronRight size={12} />
        </button>
      </div>

      <div className="bank-grid">
        {banks.map(bank => {
          const cfg = STATUS_CONFIG[bank.status] || STATUS_CONFIG.unlikely;
          return (
            <div key={bank.name} className="bank-card" style={{ borderColor: cfg.color + '30', background: cfg.bg }}>
              <div className="bank-card__header">
                <span className="bank-card__name">{bank.name}</span>
                <span className="bank-card__status" style={{ color: cfg.color }}>
                  {bank.status === 'likely' && <CheckCircle size={13} />}
                  {bank.status === 'unlikely' && <XCircle size={13} />}
                  {cfg.label}
                </span>
              </div>
              <div className="bank-card__reason">{bank.reason}</div>
              {bank.status !== 'likely' && bank.maxDti && income > 0 && (
                <div className="bank-card__fix">
                  To qualify: reduce monthly debt by {fmt(Math.max(0, Math.round((dtiDecimal - bank.maxDti) * income)))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="bank-view__note">
        Estimates based on standard qualifying criteria at 13.25% stress rate over 20 years. Actual approval depends on full credit assessment.
      </div>
    </div>
  );
}

// ── Sprint 4: Goal Templates ──────────────────────────────

const GOAL_TEMPLATES = [
  {
    id: 'deposit',
    icon: Home,
    title: 'Home Deposit',
    description: '10% of your max bond qualification',
    category: 'deposit',
    getAmount: (health) => Math.round((health?.maxBondEstimate || health?.metrics?.maxBond || 1000000) * 0.10),
  },
  {
    id: 'emergency',
    icon: ShieldCheck,
    title: 'Emergency Fund',
    description: '3 months of living expenses',
    category: 'emergency_fund',
    getAmount: (health) => Math.round((health?.metrics?.monthlyExpenses || 10000) * 3),
  },
  {
    id: 'debt',
    icon: TrendingDown,
    title: 'Pay Off Debt',
    description: 'Clear all current monthly debt',
    category: 'debt_free',
    getAmount: (health) => Math.round((health?.metrics?.declaredDebt || health?.metrics?.dtiPct / 100 * health?.metrics?.monthlyIncome || 0) * 12),
  },
];

function GoalTemplates({ health, onSelect }) {
  return (
    <div className="goal-templates">
      <div className="goal-templates__title">Start with a goal that matters</div>
      <div className="goal-templates__grid">
        {GOAL_TEMPLATES.map(tpl => {
          const Icon = tpl.icon;
          const amount = tpl.getAmount(health);
          return (
            <button
              key={tpl.id}
              className="goal-template-card"
              onClick={() => onSelect({
                name: tpl.title,
                targetAmount: String(amount),
                category: tpl.category,
                targetDate: '',
                monthlyContribution: '',
              })}
            >
              <Icon size={22} className="goal-template-card__icon" />
              <div className="goal-template-card__title">{tpl.title}</div>
              <div className="goal-template-card__desc">{tpl.description}</div>
              {amount > 0 && <div className="goal-template-card__amount">{fmt(amount)}</div>}
            </button>
          );
        })}
      </div>
      <div className="goal-templates__or">
        <button className="goal-templates__custom" onClick={() => onSelect({ name: '', targetAmount: '', category: 'savings', targetDate: '', monthlyContribution: '' })}>
          <Plus size={14} /> Set a custom goal
        </button>
      </div>
    </div>
  );
}

// ── Sprint 5: Pre-upload Empty State ─────────────────────

export function FinancesEmptyState() {
  return (
    <div className="fi-empty">
      <div className="fi-empty__left">
        <h2 className="fi-empty__heading">Unlock your financial intelligence</h2>
        <p className="fi-empty__sub">After uploading a bank statement, you'll see:</p>
        <ul className="fi-empty__list">
          <li><CheckCircle size={15} style={{ color: '#16a34a' }} /> Your exact bond qualification amount</li>
          <li><CheckCircle size={15} style={{ color: '#16a34a' }} /> The patterns most likely to block a bank application</li>
          <li><CheckCircle size={15} style={{ color: '#16a34a' }} /> Which of SA's 7 major banks would approve you today</li>
        </ul>
        <a href="/preapproval" className="fi-empty__cta">
          <Upload size={16} /> Upload your bank statement
        </a>
        <div className="fi-empty__trust">
          <ShieldCheck size={13} /> Secure &nbsp;·&nbsp; Never sold &nbsp;·&nbsp; 2-minute analysis
        </div>
      </div>

      <div className="fi-empty__preview" aria-hidden="true">
        <div className="fi-empty__blur-wrap">
          {/* Mocked score ring */}
          <div className="fi-empty__mock-ring">
            <svg width="80" height="80" viewBox="0 0 80 80">
              <circle cx="40" cy="40" r="30" fill="none" stroke="var(--border)" strokeWidth="8" />
              <circle cx="40" cy="40" r="30" fill="none" stroke="#84cc16" strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${0.74 * 2 * Math.PI * 30} ${2 * Math.PI * 30}`}
                transform="rotate(-90 40 40)" />
              <text x="40" y="37" textAnchor="middle" fill="var(--text-primary)" fontSize="14" fontWeight="700">74</text>
              <text x="40" y="50" textAnchor="middle" fill="#84cc16" fontSize="8">B</text>
            </svg>
            <span className="fi-empty__mock-label">Bond readiness</span>
          </div>
          {/* Mocked insight badges */}
          <div className="fi-empty__mock-badges">
            <span className="fi-empty__mock-badge" style={{ color: '#dc2626' }}>BANK RISK · Gambling</span>
            <span className="fi-empty__mock-badge" style={{ color: '#d97706' }}>TREND · Lifestyle creep</span>
            <span className="fi-empty__mock-badge" style={{ color: '#16a34a' }}>OPPORTUNITY · Subscriptions</span>
          </div>
          {/* Mocked bank dots */}
          <div className="fi-empty__mock-banks">
            {['ABSA', 'FNB', 'Capitec', 'Nedbank', 'Std Bank', 'SA HL', 'Investec'].map((b, i) => (
              <span key={b} className="fi-empty__mock-bank">
                <span className="fi-empty__mock-dot" style={{ background: i < 4 ? '#16a34a' : '#9ca3af' }} />
                {b}
              </span>
            ))}
          </div>
          {/* Frosted glass overlay */}
          <div className="fi-empty__overlay">
            <Lock size={20} />
            <span>Upload to unlock</span>
          </div>
        </div>
      </div>
    </div>
  );
}
