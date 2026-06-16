import { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Clock, AlertTriangle, CreditCard, Target, Bell, Home, Building2, Key, FileText, TrendingUp, TrendingDown, Scale, BarChart2, Gift, Repeat2 } from 'lucide-react';
import HomeTab from './HomeTab.jsx';
import HiddenCostsTab from './HiddenCostsTab.jsx';
import { useAuth } from '../../context/AuthContext.jsx';
import { useToast } from '../../components/Toast.jsx';
import { loans as loansApi, payments as paymentsApi, risk as riskApi, notifications as notifApi, kyc as kycApi, alerts as alertsApi, primeRate as primeRateApi, financialFitness, finances, profile as profileApi, swaps as swapsApi, calc as calcApi } from '../../lib/api.js';
import { fmt, fmtPct, fmtDate } from '../../lib/format.js';
import { calcMonthly, calcAmortSchedule, calcEquity } from '../../lib/finance.js';
import { PRIME_RATE, BANKS, BANK_SPREADS, MARKET_AVG_SPREAD } from '../../lib/constants.js';
import { calcSwapSavings } from '../../lib/finance.js';
import { trackAction } from '../../lib/session.js';
import { track as aTrack } from '../../lib/analytics.js';
import PropertySearchCTA from '../../components/PropertySearchCTA.jsx';
import Button from '../../components/Button.jsx';
import Card, { CardHeader, CardBody, StatCard } from '../../components/Card.jsx';
import { QualityScoreCard, SwitchMonitorCard, RateDropProjectionCard, PreQualCertificateCard, PeerBenchmarkCard, SubscriptionCancelCard } from './EngagementCards.jsx';
import ConveyancingTracker from './ConveyancingTracker.jsx';
import ReadinessChart from './ReadinessChart.jsx';
import Input, { Select } from '../../components/Input.jsx';
import BondHealthRing from './BondHealthRing.jsx';
import { SkeletonCard } from '../../components/Skeleton.jsx';
import BondsTab from './BondsTab.jsx';
import PaymentsTab from './PaymentsTab.jsx';
import ScheduleTab from './ScheduleTab.jsx';
import SwapsTab from './SwapsTab.jsx';
import ApplyTab from './ApplyTab.jsx';
import VaultTab from './VaultTab.jsx';
import FinancesTab from './FinancesTab.jsx';
import MortgageStatementTab from './MortgageStatementTab.jsx';
import OffersTab from './OffersTab.jsx';
import OnboardingChecklist from './OnboardingChecklist.jsx';
import './Dashboard.css';

const TABS = [
  { id: 'home',  label: 'Home',         icon: Home },
  { id: 'money', label: 'Money',        icon: BarChart2 },
  { id: 'vault', label: 'Vault',        icon: FileText },
  { id: 'costs', label: 'Hidden Costs', icon: TrendingDown },
  { id: 'bond',  label: 'Bond',         icon: Building2 },
];

const BOND_SUBTABS = [
  { id: 'overview', label: 'Overview' },
  { id: 'switch',   label: 'Switch & Save' },
  { id: 'offers',   label: 'Offers' },
  { id: 'apply',    label: 'Submit' },
  { id: 'scan',     label: 'Scan Statement' },
];

// Map legacy sessionStorage/nav-state tab IDs to new ones
function resolveTab(raw) {
  const map = {
    overview: 'home', fitness: 'money', optimizer: 'money',
    finances: 'money', statement: 'bond', switch: 'bond',
    apply: 'bond', swaps: 'bond',
  };
  return map[raw] || raw || 'home';
}

function resolveBondSubTab(raw) {
  if (raw === 'switch' || raw === 'swaps') return 'switch';
  if (raw === 'apply') return 'apply';
  if (raw === 'offers') return 'offers';
  if (raw === 'statement') return 'scan';
  return 'overview';
}


export default function Dashboard() {
  const location = useLocation();
  // On fresh page load (no tab in navigation state), always default to 'home'.
  // sessionStorage is only used when navigating via in-app events (bondly:navigate)
  // where location.state?.tab is explicitly set by the app.
  const [tab, setTab]             = useState(() => resolveTab(location.state?.tab || null));
  const [bondSubTab, setBondSubTab] = useState(() => {
    const raw = location.state?.tab || null;
    return resolveBondSubTab(raw);
  });
  const [financesSubTab, setFinancesSubTab] = useState(location.state?.subtab || null);
  const [hasSnapshots, setHasSnapshots] = useState(false);
  const [loansList, setLoansList] = useState([]);
  const [paymentsList, setPayments]= useState([]);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const [riskScore, setRiskScore] = useState(null);
  const [notifs, setNotifs]       = useState([]);
  const [kycStatus, setKycStatus] = useState(null);
  const [notifOpen, setNotifOpen] = useState(false);
  const [loading, setLoading]     = useState(true);
  const [kycBannerDismissed, setKycBannerDismissed] = useState(() => sessionStorage.getItem('bondly_kyc_banner_dismissed') === '1');
  const [swapsList, setSwapsList] = useState([]);

  const { user }  = useAuth();
  const showToast = useToast();
  const navigate  = useNavigate();

  const load = useCallback(async () => {
    try {
      const [l, p, r, sw] = await Promise.all([
        loansApi.list(),
        paymentsApi.list(),
        riskApi.get().catch(() => null),
        swapsApi.list().catch(() => []),
      ]);
      setLoansList(l || []);
      setPayments(p || []);
      setRiskScore(r);
      setSwapsList(sw || []);
    } catch (err) {
      showToast('Could not load data', 'error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  useEffect(() => {
    notifApi.list().then(d => setNotifs(d || [])).catch(() => {});
    kycApi.status().then(d => setKycStatus(d)).catch(() => {});
    financialFitness.getSnapshots().then(d => setHasSnapshots((d?.snapshots?.length || 0) > 0)).catch(() => {});
  }, []);

  useEffect(() => {
    function handleNav(e) {
      const { tab: t, subtab, bondSubTab: bst } = e.detail || {};
      if (t) {
        const resolved = resolveTab(t);
        setTab(resolved);
        sessionStorage.setItem('bondly_dash_tab', resolved);
        if (resolved === 'bond') {
          const bsResolved = bst || resolveBondSubTab(t);
          setBondSubTab(bsResolved);
        }
      }
      if (subtab) setFinancesSubTab(subtab);
    }
    window.addEventListener('bondly:navigate', handleNav);
    return () => window.removeEventListener('bondly:navigate', handleNav);
  }, []);

  const loan = loansList[selectedIdx] || null;
  const unread = notifs.filter(n => !n.read).length;

  const stats = useMemo(() => {
    if (!loan) return null;
    const monthly = calcMonthly(loan.amount || 0, loan.rate || PRIME_RATE, loan.term || 20);
    const loanPmts = paymentsList.filter(p => p.loanId === loan.id);
    const totalPaid = loanPmts.reduce((s, p) => s + (p.amount || 0), 0);
    const monthsElapsed = loan.monthsElapsed != null
      ? loan.monthsElapsed
      : (monthly > 0 ? (Math.round(totalPaid / monthly) || 0) : 0);
    const schedule = calcAmortSchedule(loan.amount || 0, loan.rate || PRIME_RATE, loan.term || 20);
    const row = schedule[Math.min(monthsElapsed, schedule.length - 1)];
    const principalPaid = row ? (loan.amount - row.balance) : 0;
    const interestPaid  = totalPaid - principalPaid;
    const equity = loan.purchasePrice
      ? calcEquity(loan.purchasePrice, loan.amount, loan.rate, loan.term, monthsElapsed)
      : null;
    const monthsRemaining = loan.monthsRemaining != null
      ? loan.monthsRemaining
      : Math.max(0, (loan.term || 20) * 12 - monthsElapsed);
    return { monthly, totalPaid, principalPaid, interestPaid, monthsElapsed, monthsRemaining, equity, balance: row?.balance ?? loan.amount, schedule };
  }, [loan, paymentsList]);

  const animatedBalance = stats?.balance ?? loan?.amount ?? 0;

  // Clamp selectedIdx when a bond is deleted and the list shrinks.
  useEffect(() => {
    if (loansList.length === 0) return;
    if (selectedIdx >= loansList.length) {
      setSelectedIdx(loansList.length - 1);
    }
  }, [loansList.length]);

  if (loading) {
    return (
      <div className="page">
        <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}>
          <div className="dash-stats-grid" style={{ marginBottom: 'var(--space-6)' }}>
            <SkeletonCard /><SkeletonCard /><SkeletonCard /><SkeletonCard />
          </div>
          <div className="dash-overview-cols">
            <SkeletonCard lines={6} />
            <SkeletonCard lines={4} />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="page dash-page">
      {/* Mobile header */}
      <div className="dash-mobile-top">
        <div className="dash-mobile-top__row">
          <div>
            <div className="dash-greeting-label">Good {timeOfDay()}</div>
            <h3 className="dash-greeting-name">{user?.name?.split(' ')[0] || 'there'}</h3>
          </div>
          <div className="dash-mobile-top__actions">
            <button className="dash-notif-btn" onClick={() => setNotifOpen(o => !o)}>
              <svg width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              {unread > 0 && <span className="dash-notif-badge">{unread > 99 ? '99+' : unread}</span>}
            </button>
            <div className="nav-avatar" onClick={() => navigate('/profile')}>
              {(user?.name || 'G')[0].toUpperCase()}
            </div>
          </div>
        </div>
        {loan && (() => {
          const bestRate = Math.min(...BANKS.map(b => PRIME_RATE + (BANK_SPREADS[b] || 0)));
          const rem = Math.max(12, stats?.monthsRemaining || loan.term * 12);
          const savings = loan.rate > bestRate + 0.15
            ? calcSwapSavings(stats?.balance ?? loan.amount, loan.rate, bestRate, rem)
            : null;
          return (
            <div className="dash-balance-card">
              <div className="dash-balance-label">My bond balance</div>
              <div className="dash-balance-amount">{fmt(animatedBalance)}</div>
              <div className="dash-balance-meta">
                <span>Rate: <strong style={{ color: 'var(--lime)' }}>{fmtPct(loan.rate)}</strong></span>
                {savings && savings.monthlySaving >= 150
                  ? (
                    <span className="dash-savings-hint" title={`Based on switching your ${fmt(stats?.balance ?? loan.amount)} balance from ${fmtPct(loan.rate)} to the best available rate. Includes estimated switching costs.`}>
                      Save {fmt(savings.monthlySaving)}/mo
                      <svg style={{ marginLeft: 4, verticalAlign: 'middle', opacity: 0.7 }} width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                    </span>
                  )
                  : <span className="pill pill--lime">{loan.bank}</span>
                }
              </div>
              {loan.updatedAt && (
                <p className="dash-freshness">Last synced {fmtDate(loan.updatedAt)} · <button onClick={load}>Sync now</button></p>
              )}
            </div>
          );
        })()}
      </div>

      {/* Notification dropdown */}
      {notifOpen && (
        <div className="notif-dropdown">
          <div className="notif-dropdown__header">
            <strong>Notifications</strong>
            <button onClick={() => setNotifOpen(false)}>✕</button>
          </div>
          {notifs.length === 0 ? (
            <p className="notif-empty">No notifications yet.</p>
          ) : notifs.map(n => (
            <div key={n.id} className={`notif-item ${n.read ? '' : 'notif-item--unread'}`}>
              <div className="notif-item__title">{n.title || 'Notification'}</div>
              <div className="notif-item__body">{n.message}</div>
              <div className="notif-item__date">{fmtDate(n.createdAt)}</div>
            </div>
          ))}
        </div>
      )}

      {/* Bond selector (multi-bond) */}
      {loansList.length > 1 && (
        <div className="container" style={{ paddingTop: 'var(--space-5)' }}>
          <div className="dash-bond-chips">
            {loansList.map((l, i) => (
              <button
                key={l.id}
                className={`bond-chip ${i === selectedIdx ? 'active' : ''}`}
                onClick={() => setSelectedIdx(i)}
              >
                {l.bank || 'Bond'}{l.address && l.address !== 'My Property' ? ` · ${l.address.split(',')[0]}` : ''} — {fmt(l.amount)}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tab bar */}
      <div className="dash-tabs-bar">
        <div className="container">
          <div className="dash-tabs" role="tablist" aria-label="Dashboard sections">
            {TABS.map(t => (
              <button
                key={t.id}
                role="tab"
                id={`dash-tab-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`dash-panel-${t.id}`}
                tabIndex={tab === t.id ? 0 : -1}
                className={`dash-tab ${tab === t.id ? 'active' : ''} ${t.highlight && loansList.length > 0 ? 'dash-tab--highlight' : ''}`}
                onClick={() => { setTab(t.id); sessionStorage.setItem('bondly_dash_tab', t.id); trackAction('dash_tab_switched', { tab: t.id }); }}
                onKeyDown={e => {
                  const ids = TABS.map(x => x.id);
                  const idx = ids.indexOf(t.id);
                  if (e.key === 'ArrowRight') { e.preventDefault(); const next = TABS[(idx + 1) % TABS.length]; setTab(next.id); sessionStorage.setItem('bondly_dash_tab', next.id); }
                  if (e.key === 'ArrowLeft')  { e.preventDefault(); const prev = TABS[(idx - 1 + TABS.length) % TABS.length]; setTab(prev.id); sessionStorage.setItem('bondly_dash_tab', prev.id); }
                }}
              >
                {t.icon && <span aria-hidden="true"><t.icon size={15} /></span>}
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* My Bond sub-tabs */}
      {tab === 'bond' && (
        <div className="dash-subtabs-bar">
          <div className="container">
            <div className="dash-subtabs">
              {BOND_SUBTABS.map(s => (
                <button
                  key={s.id}
                  className={`dash-subtab ${bondSubTab === s.id ? 'active' : ''}`}
                  onClick={() => setBondSubTab(s.id)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* KYC verification prompt — only relevant when user is trying to switch */}
      {kycStatus && kycStatus.kycStatus !== 'approved' && !kycBannerDismissed && tab === 'bond' && bondSubTab === 'switch' && (
        <div className={`kyc-banner kyc-banner--${kycStatus.kycStatus === 'pending_review' ? 'pending' : kycStatus.kycStatus === 'rejected' ? 'rejected' : 'required'}`}>
          <div className="container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
              <span style={{ fontSize: '1.25rem' }}>
                {kycStatus.kycStatus === 'pending_review' ? <Clock size={20}/> : kycStatus.kycStatus === 'rejected' ? <AlertTriangle size={20} color="var(--color-warning)"/> : <CreditCard size={20}/>}
              </span>
              <div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  {kycStatus.kycStatus === 'pending_review' ? 'Identity verification under review'
                   : kycStatus.kycStatus === 'rejected'     ? 'Identity verification unsuccessful — action needed'
                   : 'Verify your identity to unlock bond switching'}
                </div>
                <div style={{ fontSize: '0.8125rem', opacity: 0.8, marginTop: 2 }}>
                  {kycStatus.kycStatus === 'pending_review'
                    ? 'We\'ll review your documents within 1 business day. You can still use all features in the meantime.'
                    : kycStatus.kycStatus === 'rejected'
                    ? kycStatus.kycRejectionReason || 'Please resubmit with a clear SA ID document and selfie.'
                    : 'Banks require FICA verification before processing your bond application. Takes 2 minutes.'}
                </div>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <Link to="/profile" onClick={() => {}}>
                <Button variant={kycStatus.kycStatus === 'pending_review' ? 'ghost' : 'lime'} size="sm">
                  {kycStatus.kycStatus === 'pending_review' ? 'View status' : 'Verify now →'}
                </Button>
              </Link>
              <button
                onClick={() => { setKycBannerDismissed(true); sessionStorage.setItem('bondly_kyc_banner_dismissed', '1'); }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '4px', lineHeight: 1 }}
                title="Dismiss"
              >✕</button>
            </div>
          </div>
        </div>
      )}

      {/* Onboarding checklist — shown above tab content until dismissed */}
      <div className="container">
        <OnboardingChecklist
          hasScore={hasSnapshots}
          hasLoans={loansList.length > 0}
          hasApplication={swapsList.length > 0}
          onTabChange={t => { setTab(resolveTab(t)); sessionStorage.setItem('bondly_dash_tab', resolveTab(t)); }}
        />
      </div>

      {/* Tab panels */}
      <div
        className="container dash-panel-wrap tab-panel"
        key={tab}
        role="tabpanel"
        id={`dash-panel-${tab}`}
        aria-labelledby={`dash-tab-${tab}`}
        tabIndex={0}
      >
        {tab === 'home' && (
          loansList.length === 0 && !hasSnapshots
            ? <FirstUseWizard onRefresh={load} onTabChange={t => { setTab(resolveTab(t)); sessionStorage.setItem('bondly_dash_tab', resolveTab(t)); }} />
            : <HomeTab loans={loansList} user={user} onTabChange={(t, bst) => {
                const resolved = resolveTab(t);
                setTab(resolved);
                sessionStorage.setItem('bondly_dash_tab', resolved);
                if (resolved === 'bond' && bst) setBondSubTab(bst);
              }} />
        )}
        {tab === 'money' && <FinancesTab initialSubTab={financesSubTab} />}
        {tab === 'vault' && <VaultTab />}
        {tab === 'costs' && <HiddenCostsTab showToast={showToast} />}
        {tab === 'bond' && (
          <>
            {bondSubTab === 'overview' && (
              <BondOverviewPanel
                loansList={loansList} paymentsList={paymentsList}
                loan={loan} stats={stats} onRefresh={load}
              />
            )}
            {bondSubTab === 'switch'   && <SwapsTab loans={loansList} />}
            {bondSubTab === 'apply'    && <ApplyTab loans={loansList} onRefresh={load} />}
            {bondSubTab === 'offers'   && <OffersTab />}
            {bondSubTab === 'scan'     && (
              <MortgageStatementTab
                loans={loansList}
                onTabChange={t => { setTab(resolveTab(t)); sessionStorage.setItem('bondly_dash_tab', resolveTab(t)); }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Bond overview — wraps the old details/payments/schedule sub-tabs ──────────
function BondOverviewPanel({ loansList, paymentsList, loan, stats, onRefresh }) {
  const [subTab, setSubTab] = useState('details');
  const INNER = [
    { id: 'details',  label: 'Details' },
    { id: 'payments', label: 'Payments' },
    { id: 'schedule', label: 'Schedule' },
  ];
  return (
    <>
      <div className="dash-subtabs" style={{ marginBottom: 'var(--space-4)' }}>
        {INNER.map(s => (
          <button key={s.id} className={`dash-subtab ${subTab === s.id ? 'active' : ''}`} onClick={() => setSubTab(s.id)}>
            {s.label}
          </button>
        ))}
      </div>
      {subTab === 'details'  && <BondsTab   loans={loansList} payments={paymentsList} onRefresh={onRefresh} />}
      {subTab === 'payments' && <PaymentsTab loans={loansList} payments={paymentsList} onRefresh={onRefresh} />}
      {subTab === 'schedule' && <ScheduleTab loans={loansList} payments={paymentsList} />}
    </>
  );
}

// ── First-use wizard ──────────────────────────────────────
function FirstUseWizard({ onRefresh, onTabChange }) {
  const [intent, setIntent]       = useState(() => sessionStorage.getItem('bondly_journey_intent') || null);
  const [hookSaving, setHookSaving] = useState(() => {
    try {
      const ctx = JSON.parse(sessionStorage.getItem('bondly_hook_context') || 'null');
      return ctx?.monthlySaving > 0 ? ctx.monthlySaving : null;
    } catch { return null; }
  });
  const [uploading, setUploading] = useState(false);
  const [estimateForm, setEstimateForm] = useState({ income: '', bondBalance: '' });
  const [estimateResult, setEstimateResult] = useState(null);
  const [estimating, setEstimating] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const fileRef   = useRef(null);
  const showToast = useToast();
  const navigate  = useNavigate();

  async function handleStatement(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append('statement', file);
      const res = await fetch('/api/onboarding/analyse', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + localStorage.getItem('bondly_token') },
        body: fd,
      }).then(r => r.json());
      if (!res.success) throw new Error(res.error || 'Could not analyse statement');
      showToast('Statement analysed! Head to My Bond to review what we found.', 'success');
      onRefresh();
      onTabChange('bond');
      sessionStorage.removeItem('bondly_hook_context');
      setHookSaving(null);
    } catch (err) {
      showToast(err.message || 'Could not read statement', 'error');
    } finally {
      setUploading(false);
    }
  }

  // Step 1 — intent gate
  if (!intent) {
    return (
      <div className="first-use-wizard fade-in">
        <div className="first-use-wizard__inner">
          <h2 className="first-use-wizard__title">What brings you to Bondly?</h2>
          <p className="first-use-wizard__sub">We'll personalise your dashboard based on your goal.</p>
          <div className="first-use-wizard__intent-cards">
            {/* Primary — largest group, full width */}
            <button
              className="first-use-intent-card first-use-intent-card--primary"
              onClick={() => { trackAction('intent_selected', { intent: 'quick_estimate' }); sessionStorage.setItem('bondly_journey_intent', 'quick_estimate'); setIntent('quick_estimate'); }}
            >
              <span className="first-use-intent-card__icon"><Key size={24} /></span>
              <div className="first-use-intent-card__body">
                <strong>See how much I can borrow</strong>
                <span>Upload a bank statement · see your max bond in 2 minutes · no credit check</span>
              </div>
              <span className="first-use-intent-card__arrow">→</span>
            </button>
            {/* Secondary pair */}
            <div className="first-use-intent-cards--secondary">
              <button className="first-use-intent-card" onClick={() => { trackAction('intent_selected', { intent: 'existing_bond' }); setIntent('existing'); sessionStorage.setItem('bondly_journey_intent', 'existing'); }}>
                <span className="first-use-intent-card__icon"><Building2 size={20} /></span>
                <div className="first-use-intent-card__body">
                  <strong>I already have a bond</strong>
                  <span>Track balance &amp; switch to a better rate</span>
                </div>
              </button>
              <button className="first-use-intent-card" onClick={() => { trackAction('intent_selected', { intent: 'check_finances' }); sessionStorage.setItem('bondly_journey_intent', 'improving_finances'); profileApi.update({ journeyStage: 'improving_finances' }).catch(() => {}); navigate('/optimize'); }}>
                <span className="first-use-intent-card__icon"><TrendingUp size={20} /></span>
                <div className="first-use-intent-card__body">
                  <strong>Check my finances first</strong>
                  <span>Upload a statement · get your bond score</span>
                </div>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Step 1b — quick estimate flow
  if (intent === 'quick_estimate') {
    async function handleEstimate(e) {
      e.preventDefault();
      const income = parseFloat(estimateForm.income);
      if (!income || income <= 0) { showToast('Please enter your monthly income', 'error'); return; }
      setEstimating(true);
      try {
        const result = await calcApi.affordability({ income, deposit: 0 });
        setEstimateResult(result);
      } catch (err) {
        showToast(err.message || 'Could not calculate estimate', 'error');
      } finally {
        setEstimating(false);
      }
    }

    return (
      <div className="first-use-wizard fade-in">
        <div className="first-use-wizard__inner">
          <h2 className="first-use-wizard__title">See how much you can borrow</h2>
          <p className="first-use-wizard__sub">Enter your monthly income for a quick estimate — no credit check, no upload needed.</p>

          {!estimateResult ? (
            <form onSubmit={handleEstimate} className="quick-estimate-form">
              <div className="quick-estimate-form__field">
                <label htmlFor="qe-income">Monthly gross income (R)</label>
                <Input
                  id="qe-income"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 35 000"
                  value={estimateForm.income}
                  onChange={e => setEstimateForm(f => ({ ...f, income: e.target.value.replace(/\s/g, '') }))}
                />
              </div>
              <div className="quick-estimate-form__field">
                <label htmlFor="qe-balance">Current bond balance (optional)</label>
                <Input
                  id="qe-balance"
                  type="text"
                  inputMode="numeric"
                  placeholder="e.g. 800 000"
                  value={estimateForm.bondBalance}
                  onChange={e => setEstimateForm(f => ({ ...f, bondBalance: e.target.value.replace(/\s/g, '') }))}
                />
              </div>
              <Button variant="lime" type="submit" loading={estimating} style={{ width: '100%', marginTop: 'var(--space-3)' }}>
                {estimating ? 'Calculating…' : 'Show my estimate →'}
              </Button>
            </form>
          ) : (
            <div className="quick-estimate-result fade-in">
              <div className="quick-estimate-result__main">
                <div className="quick-estimate-result__label">Maximum bond amount</div>
                <div className="quick-estimate-result__value">{fmt(estimateResult.bondAmount ?? estimateResult.maxBond ?? 0)}</div>
              </div>
              <div className="quick-estimate-result__row">
                <span>Estimated monthly repayment</span>
                <strong>{fmt(estimateResult.monthlyRepayment ?? 0)}</strong>
              </div>
              {estimateResult.maxProperty > 0 && (
                <div className="quick-estimate-result__row">
                  <span>Maximum property value</span>
                  <strong>{fmt(estimateResult.maxProperty)}</strong>
                </div>
              )}

              {/* How we calculated this */}
              <button className="quick-estimate-calc-toggle" onClick={() => setShowCalc(v => !v)}>
                {showCalc ? '▲' : '▼'} How we calculated this
              </button>
              {showCalc && (() => {
                const income = parseFloat(estimateForm.income) || 0;
                const maxMonthly = Math.round(income * 0.30);
                const r = 0.1175 / 12;
                const n = 240;
                const bondAmount = estimateResult.bondAmount ?? 0;
                return (
                  <div className="quick-estimate-calc fade-in">
                    <div className="quick-estimate-calc__step">
                      <span className="quick-estimate-calc__num">1</span>
                      <div>
                        <strong>30% of income rule</strong>
                        <div className="quick-estimate-calc__detail">Banks allow up to 30% of gross income toward bond repayments. Your limit: {fmt(income)} × 30% = <strong>{fmt(maxMonthly)}/month</strong></div>
                      </div>
                    </div>
                    <div className="quick-estimate-calc__step">
                      <span className="quick-estimate-calc__num">2</span>
                      <div>
                        <strong>Prime rate + 20-year term</strong>
                        <div className="quick-estimate-calc__detail">Using current prime rate of 11.75% over 20 years, {fmt(maxMonthly)}/month supports a bond of <strong>{fmt(bondAmount)}</strong></div>
                      </div>
                    </div>
                    <div className="quick-estimate-calc__step">
                      <span className="quick-estimate-calc__num">3</span>
                      <div>
                        <strong>What this really means</strong>
                        <div className="quick-estimate-calc__detail">This is a rough estimate — your actual approval depends on your expenses, debts, and credit history. Upload your statement to get a precise score.</div>
                      </div>
                    </div>
                  </div>
                );
              })()}
              <p className="quick-estimate-result__note">
                To get a precise score and apply, upload your bank statement — it takes 2 minutes and there's no credit check.
              </p>
              <p className="quick-estimate-result__reverse-link">
                Want to set your monthly budget instead?{' '}
                <button
                  className="quick-estimate-result__link-btn"
                  onClick={() => navigate('/tools?tab=repayment&mode=reverse')}
                >
                  → Use the repayment calculator
                </button>
              </p>
              <div className="quick-estimate-result__ctas">
                <Button variant="lime" onClick={() => navigate('/preapproval')}>Upload statement</Button>
                <Button variant="ghost" onClick={() => { setIntent('existing'); sessionStorage.setItem('bondly_journey_intent', 'existing'); }}>Learn more about switching</Button>
              </div>
            </div>
          )}

          <p className="first-use-wizard__privacy">
            <button className="first-use-wizard__back" onClick={() => { setIntent(null); sessionStorage.removeItem('bondly_journey_intent'); setEstimateResult(null); }}>← Back</button>
          </p>
        </div>
      </div>
    );
  }

  // Step 2 — existing bond setup
  return (
    <div className="first-use-wizard fade-in">
      <div className="first-use-wizard__inner">
        <div className="first-use-wizard__icon"><FileText size={36} /></div>
        <h2 className="first-use-wizard__title">Set up your bond</h2>
        <p className="first-use-wizard__sub">
          The fastest way is to upload your latest bank statement — we'll detect your bond, income, and payment history automatically.
        </p>

        {hookSaving && (
          <div className="hook-savings-banner">
            <span className="hook-savings-banner__icon">💡</span>
            <span>Based on your details, you could save <strong>~R{hookSaving.toLocaleString()}/month</strong> on your bond. Let's confirm the exact figure below.</span>
          </div>
        )}

        <div className="first-use-wizard__options">
          <div className="first-use-option first-use-option--primary">
            <div className="first-use-option__icon"><FileText size={20} /></div>
            <div className="first-use-option__content">
              <strong>Upload bank statement</strong>
              <span>CSV or PDF · We detect your bond, income, and payment history</span>
            </div>
            <input ref={fileRef} type="file" accept=".csv,.pdf" style={{ display: 'none' }} onChange={handleStatement} />
            <Button variant="lime" size="sm" loading={uploading} onClick={() => fileRef.current?.click()}>
              {uploading ? 'Analysing…' : 'Upload statement'}
            </Button>
          </div>

          <div className="first-use-option">
            <div className="first-use-option__icon"><svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg></div>
            <div className="first-use-option__content">
              <strong>Enter details manually</strong>
              <span>Add your bond, rate, and term yourself</span>
            </div>
            <Button variant="ghost" size="sm" onClick={() => onTabChange('bond')}>
              Add bond →
            </Button>
          </div>
        </div>

        <p className="first-use-wizard__privacy">
          Your statement is analysed locally and never shared. We only read what's needed. ·{' '}
          <button className="first-use-wizard__back" onClick={() => setIntent(null)}>← Back</button>
        </p>
      </div>
    </div>
  );
}

// ── Financial Journey Card ─────────────────────────────────
function FinancialJourneyCard({ compact = false }) {
  const navigate  = useNavigate();
  const [snapshots, setSnapshots] = useState(null);

  useEffect(() => {
    financialFitness.getSnapshots().then(d => setSnapshots(d.snapshots || [])).catch(() => setSnapshots([]));
  }, []);

  if (snapshots === null) return null; // loading

  const latest  = snapshots[0];
  const prev    = snapshots[1];
  const score   = latest?.readiness?.score ?? latest?.readiness ?? null;
  const prevScore = prev?.readiness?.score ?? prev?.readiness ?? null;
  const delta   = score != null && prevScore != null ? score - prevScore : null;
  const scoreColor = score == null ? 'var(--text-secondary)' : score >= 70 ? '#22c55e' : score >= 45 ? '#eab308' : '#ef4444';
  const maxBond = latest?.qualification?.maxBond ?? 0;

  // Months-to-readiness estimate: each optimization adds ~5 pts if acted on
  const monthsToReady = score != null && score < 70
    ? Math.max(1, Math.ceil((70 - score) / 5))
    : 0;

  if (!latest) {
    // No snapshots yet — prompt to use optimizer
    return (
      <Card style={{ marginTop: compact ? 0 : 'var(--space-5)' }}>
        <CardHeader>Your Financial Journey</CardHeader>
        <CardBody>
          <div style={{ textAlign: 'center', padding: 'var(--space-4) 0' }}>
            <div style={{ marginBottom: 'var(--space-2)' }}><BarChart2 size={32} strokeWidth={1} style={{ color: 'var(--text-secondary)' }} /></div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              Upload a bank statement to see your home readiness score, spending breakdown vs SA peers, and a personalised action plan.
            </p>
            <Button variant="lime" size="sm" onClick={() => navigate('/optimize')}>
              Start my financial journey →
            </Button>
          </div>
        </CardBody>
      </Card>
    );
  }

  return (
    <Card style={{ marginTop: compact ? 0 : 'var(--space-5)' }}>
      <CardHeader>
        <span>Your Financial Journey</span>
        {snapshots.length > 1 && (
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', fontWeight: 400 }}>
            {snapshots.length} snapshots
          </span>
        )}
      </CardHeader>
      <CardBody>
        <div className="fj-row">
          <div className="fj-score">
            <div className="fj-score__val" style={{ color: scoreColor }}>{score ?? '—'}</div>
            <div className="fj-score__label">Home Readiness</div>
            {delta != null && (
              <div className={`fj-score__delta ${delta >= 0 ? 'fj-score__delta--up' : 'fj-score__delta--down'}`}>
                {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} pts since last month
              </div>
            )}
          </div>
          <div className="fj-stats">
            {/* Honesty guard: showing "Max bond R 35,000" to someone who
                can't actually afford a meaningful property is demoralizing
                and pointless. SA flats start well above R 200k. Below that
                threshold, we hide the number and pivot to financial control
                coaching — the user needs to get their finances on track
                before bond math is useful. */}
            {maxBond >= 200000 && (
              <div className="fj-stat">
                <div className="fj-stat__val">{fmt(maxBond)}</div>
                <div className="fj-stat__label">Max bond</div>
              </div>
            )}
            {maxBond > 0 && maxBond < 200000 && (
              <div className="fj-stat fj-stat--build">
                <div className="fj-stat__val" style={{ fontSize:'0.95rem', fontWeight:700, lineHeight:1.2 }}>Build first</div>
                <div className="fj-stat__label">Bond capacity will grow as we strengthen your finances</div>
              </div>
            )}
            {monthsToReady > 0 && (
              <div className="fj-stat">
                <div className="fj-stat__val">{monthsToReady}</div>
                <div className="fj-stat__label">est. months to ready</div>
              </div>
            )}
            {score >= 70 && (
              <div className="fj-stat fj-stat--ready">
                <div className="fj-stat__val">✓</div>
                <div className="fj-stat__label">Ready to apply</div>
              </div>
            )}
          </div>
        </div>

        {/* Score bar */}
        <div className="fj-bar-wrap">
          <div className="fj-bar">
            <div className="fj-bar__fill" style={{ width: `${Math.min(100, score ?? 0)}%`, background: scoreColor }} />
            <div className="fj-bar__target" style={{ left: '70%' }} title="Target: 70+" />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 3 }}>
            <span>0</span><span style={{ color: '#22c55e', fontWeight: 600 }}>70 ready</span><span>100</span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-4)' }}>
          <Button variant="lime" size="sm" onClick={() => navigate('/optimize')}>
            {score >= 70 ? 'View full report' : 'Upload this month →'}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => navigate('/preapproval')}>
            Check my bond →
          </Button>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Rate vs Market Card ───────────────────────────────────
function RateVsMarketCard({ loan }) {
  if (!loan) return null;
  // Market avg computed dynamically from BANK_SPREADS (excl. Investec — qualifying clients only)
  const marketAvg   = Math.round((PRIME_RATE + MARKET_AVG_SPREAD) * 100) / 100;
  const bestRate    = PRIME_RATE - 0.25; // Investec qualifying clients only
  const spreadAbove = Math.round((loan.rate - PRIME_RATE) * 100) / 100;
  const status      = loan.rate > PRIME_RATE + 0.5 ? 'high' : loan.rate > PRIME_RATE + 0.1 ? 'above' : 'competitive';

  const bars = [
    { label: 'Your rate',    rate: loan.rate,  color: status === 'high' ? '#e67e22' : status === 'above' ? '#f0ad4e' : 'var(--mint)' },
    { label: 'Est. market',  rate: marketAvg,  color: 'var(--text-secondary)' },
    { label: 'Prime rate',   rate: PRIME_RATE, color: 'var(--mint)' },
    { label: 'Best (est.)',  rate: bestRate,   color: 'var(--lime, #b8e04a)' },
  ];
  const maxRate = Math.max(...bars.map(b => b.rate));

  return (
    <Card style={{ marginTop: 'var(--space-5)' }}>
      <CardHeader>Your Rate vs Market</CardHeader>
      <CardBody>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
          {bars.map(b => (
            <div key={b.label} style={{ display: 'grid', gridTemplateColumns: '100px 1fr 56px', alignItems: 'center', gap: 'var(--space-3)' }}>
              <div style={{ fontSize: '0.8rem', color: b.label === 'Your rate' ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: b.label === 'Your rate' ? 700 : 400 }}>{b.label}</div>
              <div style={{ height: 8, background: 'var(--border-color)', borderRadius: 4, overflow: 'hidden' }}>
                <div style={{ height: '100%', width: `${(b.rate / maxRate * 100).toFixed(1)}%`, background: b.color, borderRadius: 4, transition: 'width 0.6s' }} />
              </div>
              <div style={{ fontSize: '0.8rem', fontWeight: 600, textAlign: 'right', color: b.color }}>{fmtPct(b.rate)}</div>
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 'var(--space-3)' }}>
          {status === 'high'
            ? `Your rate is ${fmtPct(spreadAbove)} above prime — you're likely overpaying. Compare banks to see if you could save.`
            : status === 'above'
            ? `You're slightly above prime flat. Comparing banks could reveal a lower rate.`
            : `You're on a competitive rate. We'll alert you if a better deal appears.`}
          {' '}<span style={{ opacity: 0.55 }}>Market avg and best-possible figures are estimates based on current published spreads — actual rates depend on credit profile and bond size.</span>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Milestones ────────────────────────────────────────────
function MilestonesPanel({ loan, stats }) {
  if (!loan || !stats?.schedule) return null;
  const { schedule, monthsElapsed, balance } = stats;
  const now = new Date();

  const monthsToDate = (n) => {
    const d = new Date(now);
    d.setMonth(d.getMonth() + Math.round(n));
    return d.toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' });
  };

  // Debt-free
  const remaining = Math.max(0, schedule.length - monthsElapsed);
  const debtFree = monthsToDate(remaining);

  // 50% balance paid
  const half = loan.amount * 0.50;
  const half50Row = schedule.findIndex(r => r.balance <= half);
  const half50Months = half50Row >= 0 ? Math.max(0, half50Row - monthsElapsed) : null;
  const half50Reached = balance <= half;

  // Interest crossover: month when cumulative principal paid > cumulative interest paid
  let cumPrincipal = 0, cumInterest = 0, crossoverMonth = null;
  for (let i = 0; i < schedule.length; i++) {
    cumPrincipal += schedule[i].principal;
    cumInterest  += schedule[i].interest;
    if (crossoverMonth === null && cumPrincipal > cumInterest) {
      crossoverMonth = i;
      break;
    }
  }
  const crossoverMonths = crossoverMonth !== null ? Math.max(0, crossoverMonth - monthsElapsed) : null;
  const crossoverReached = crossoverMonth !== null && monthsElapsed >= crossoverMonth;

  const milestones = [
    {
      icon: <Target size={20}/>,
      label: 'Debt-free',
      value: debtFree,
      sub: `${remaining} month${remaining !== 1 ? 's' : ''} to go`,
      done: remaining === 0,
    },
    {
      icon: <Scale size={20}/>,
      label: '50% balance paid',
      value: half50Reached ? 'Reached!' : (half50Months !== null ? monthsToDate(half50Months) : '—'),
      sub: half50Reached ? `Balance is ${fmt(balance)}` : (half50Months !== null ? `${half50Months} months away` : ''),
      done: half50Reached,
    },
    {
      icon: <TrendingUp size={20}/>,
      label: 'Paying more principal than interest',
      value: crossoverReached ? 'Reached!' : (crossoverMonths !== null ? monthsToDate(crossoverMonths) : '—'),
      sub: crossoverReached ? 'Your money is now building equity faster' : (crossoverMonths !== null ? `${crossoverMonths} months away` : ''),
      done: crossoverReached,
    },
  ];

  return (
    <Card style={{ marginTop: 'var(--space-5)' }}>
      <CardHeader>Milestones</CardHeader>
      <CardBody>
        <div className="milestones-grid">
          {milestones.map(m => (
            <div key={m.label} className={`milestone-card ${m.done ? 'milestone-card--done' : ''}`}>
              <div className="milestone-card__icon">{m.icon}</div>
              <div className="milestone-card__label">{m.label}</div>
              <div className="milestone-card__value">{m.value}</div>
              {m.sub && <div className="milestone-card__sub">{m.sub}</div>}
            </div>
          ))}
        </div>
      </CardBody>
    </Card>
  );
}

// ── Score improvement tips ────────────────────────────────
function ImprovementTips({ improvements }) {
  const [open, setOpen] = useState(false);
  if (!improvements?.length) return null;

  const top = improvements.slice(0, open ? improvements.length : 2);
  const totalGain = improvements.reduce((s, i) => s + i.gain, 0);

  return (
    <Card style={{ marginTop: 'var(--space-5)' }}>
      <CardHeader>How to improve your score</CardHeader>
      <CardBody>
        <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          Follow these steps to gain up to <strong style={{ color: 'var(--lime)' }}>+{totalGain} points</strong>
        </p>
        <div className="improvement-list">
          {top.map((tip, i) => (
            <div key={i} className="improvement-item">
              <div className="improvement-item__gain">+{tip.gain}</div>
              <div className="improvement-item__content">
                <div className="improvement-item__category">{tip.category}</div>
                <div className="improvement-item__action">{tip.action}</div>
              </div>
            </div>
          ))}
        </div>
        {improvements.length > 2 && (
          <button className="improvement-toggle" onClick={() => setOpen(o => !o)}>
            {open ? 'Show less' : `Show ${improvements.length - 2} more tip${improvements.length - 2 !== 1 ? 's' : ''}`}
          </button>
        )}
      </CardBody>
    </Card>
  );
}

// ── Property search card ──────────────────────────────────
function PropertySearchCard({ loan, stats }) {
  if (!loan || !stats) return null;
  const maxBond = Math.round((stats.balance || loan.amount) * 1.25 / 50000) * 50000;
  return <PropertySearchCTA maxBond={maxBond} />;
}

// ── Active Switch Progress Card ───────────────────────────
const SWITCH_STAGE_LABELS = {
  awaiting_documents:       { label: 'Awaiting documents',      step: 1 },
  submitted:                { label: 'Under review',             step: 2 },
  under_review:             { label: 'Bank assessment',          step: 2 },
  approved:                 { label: 'Offers received',          step: 3 },
  in_progress:              { label: 'Conveyancing',             step: 4 },
  offer_accepted:           { label: 'Offer accepted',           step: 4 },
  cancellation_notice_sent: { label: 'Cancellation notice sent', step: 4 },
  attorney_instructed:      { label: 'Attorney instructed',      step: 4 },
  valuation_ordered:        { label: 'Valuation ordered',        step: 4 },
  valuation_done:           { label: 'Valuation complete',       step: 4 },
  registration_in_progress: { label: 'Deeds Office registration',step: 5 },
  registered:               { label: 'Bond registered',          step: 5 },
  completed:                { label: 'Switch complete',          step: 6 },
};
const SWITCH_STEPS = ['Documents', 'Review', 'Offers', 'Conveyancing', 'Registration', 'Complete'];

function ActiveSwitchCard({ swaps, onTabChange }) {
  if (!swaps?.length) return null;
  const active = swaps.filter(s => !['rejected', 'cancelled', 'completed'].includes(s.status));
  if (!active.length) return null;
  const app = active[0]; // Show the most recent active switch
  const statusKey = app.conveyancingStage || app.status || '';
  const info = SWITCH_STAGE_LABELS[statusKey] || { label: statusKey.replace(/_/g, ' '), step: 1 };
  const currentStep = info.step - 1; // 0-indexed

  return (
    <Card style={{ marginTop: 'var(--space-5)', border: '1.5px solid rgba(200,168,75,0.35)', background: 'rgba(200,168,75,0.04)' }}>
      <CardHeader>
        <span style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)' }}>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', flexShrink: 0 }} />
          Switch in progress
        </span>
      </CardHeader>
      <CardBody>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
          {app.currentBank} → {app.targetBank || 'best offer'}
        </div>
        <div style={{ display: 'flex', gap: 0, marginBottom: 'var(--space-3)' }}>
          {SWITCH_STEPS.map((step, i) => (
            <div key={step} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', position: 'relative' }}>
              <div style={{
                width: 20, height: 20, borderRadius: '50%', fontSize: '0.625rem', fontWeight: 700,
                display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1,
                background: i < currentStep ? 'var(--lime)' : i === currentStep ? 'var(--gold)' : 'var(--border-color)',
                color: i <= currentStep ? 'var(--forest)' : 'var(--text-secondary)',
              }}>
                {i < currentStep ? '✓' : i + 1}
              </div>
              <div style={{ fontSize: '0.6rem', color: i === currentStep ? 'var(--gold)' : 'var(--text-secondary)', marginTop: 4, textAlign: 'center', lineHeight: 1.2, fontWeight: i === currentStep ? 700 : 400 }}>
                {step}
              </div>
              {i < SWITCH_STEPS.length - 1 && (
                <div style={{ position: 'absolute', top: 10, left: '60%', right: '-40%', height: 2, background: i < currentStep ? 'var(--lime)' : 'var(--border-color)', zIndex: 0 }} />
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: '0.8125rem', color: 'var(--text-primary)', fontWeight: 600, marginBottom: 'var(--space-1)' }}>
          {info.label}
        </div>
        {app.conveyancingHistory?.length > 0 && (
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Last update: {fmtDate(app.conveyancingHistory[app.conveyancingHistory.length - 1].movedAt)}
          </div>
        )}
        <button
          onClick={() => onTabChange('switch')}
          style={{ marginTop: 'var(--space-3)', fontSize: '0.8125rem', color: 'var(--gold)', background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontWeight: 600 }}
        >
          View full details →
        </button>
      </CardBody>
    </Card>
  );
}

// ── Loyalty Tax Card ──────────────────────────────────────
function LoyaltyTaxCard({ loan, stats }) {
  if (!loan || !stats) return null;
  const bestRate = Math.min(...BANKS.map(b => PRIME_RATE + (BANK_SPREADS[b] || 0)));
  const gap = Math.max(0, loan.rate - bestRate);
  if (gap < 0.25) return null; // within 0.25% — not worth showing
  const balance = stats.balance || loan.amount;
  const loyaltyTaxPerMonth = Math.round((gap / 100 / 12) * balance);
  const loyaltyTaxPerYear  = loyaltyTaxPerMonth * 12;

  // Track visibility once — strong retention/urgency signal
  useEffect(() => {
    aTrack('loyalty_tax_seen', { gapPct: gap, monthlyCost: loyaltyTaxPerMonth });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="loyalty-tax-card fade-in" style={{ marginTop: 'var(--space-5)', background: 'rgba(239,68,68,0.06)', border: '1.5px solid rgba(239,68,68,0.2)', borderRadius: 'var(--border-radius)', padding: 'var(--space-4)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <div style={{ fontSize: '1.25rem' }}>⚖️</div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem', color: 'var(--text-primary)' }}>Loyalty tax</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
            What {loan.bank} charges you for staying loyal
          </div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-3)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Per month</div>
          <div style={{ fontWeight: 800, fontSize: '1.125rem', color: '#ef4444' }}>{fmt(loyaltyTaxPerMonth)}</div>
        </div>
        <div style={{ background: 'var(--bg-card)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-3)', border: '1px solid var(--border-color)' }}>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: 2 }}>Per year</div>
          <div style={{ fontWeight: 800, fontSize: '1.125rem', color: '#ef4444' }}>{fmt(loyaltyTaxPerYear)}</div>
        </div>
      </div>
      <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
        Your rate ({fmtPct(loan.rate)}) is <strong>{fmtPct(gap)} above</strong> the best available rate ({fmtPct(bestRate)}).
        New customers at competing banks pay less for the same balance.
      </div>
    </div>
  );
}

// ── Rate Alert Widget ─────────────────────────────────────
function RateAlertWidget({ loan }) {
  const [alert, setAlert]     = useState(null);
  const [editing, setEditing] = useState(false);
  const [target, setTarget]   = useState('');
  const [saving, setSaving]   = useState(false);
  const showToast = useToast();

  useEffect(() => {
    alertsApi.getRateTarget().then(setAlert).catch(() => {});
  }, []);

  async function save() {
    const val = parseFloat(target);
    if (isNaN(val) || val < 5 || val > 25) {
      showToast('Enter a valid rate between 5% and 25%', 'error');
      return;
    }
    setSaving(true);
    try {
      const data = await alertsApi.setRateTarget({ targetRate: val, loanId: loan?.id });
      setAlert(data);
      setEditing(false);
      showToast('Rate alert set! We\'ll email you when prime drops below your target.', 'success');
    } catch {
      showToast('Could not save alert', 'error');
    } finally { setSaving(false); }
  }

  async function remove() {
    try {
      await alertsApi.deleteRateTarget();
      setAlert(null);
      showToast('Rate alert removed', 'success');
    } catch { showToast('Could not remove alert', 'error'); }
  }

  return (
    <Card style={{ marginTop: 'var(--space-5)' }}>
      <CardHeader>Rate Alert</CardHeader>
      <CardBody>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-3)' }}>
          Current prime rate: <strong style={{ color: 'var(--mint)' }}>{fmtPct(PRIME_RATE)}</strong>.
          Get notified when it drops to your target.
        </p>
        {alert && !editing ? (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-page)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
              <Bell size={20} color="var(--mint)"/>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>Alert set at {fmtPct(alert.targetRate)}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  {loan?.rate > alert.targetRate
                    ? `${fmtPct(loan.rate - alert.targetRate)} above your target — we'll notify you`
                    : 'Your current rate is at or below your target!'}
                </div>
              </div>
              <button onClick={() => { setTarget(String(alert.targetRate)); setEditing(true); }} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem' }}>Edit</button>
              <button onClick={remove} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '0.8125rem' }}>Remove</button>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <input
                type="number"
                step="0.25"
                min="5"
                max="25"
                placeholder={loan ? fmtPct(loan.rate - 0.5) : '10.5'}
                value={target}
                onChange={e => setTarget(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && save()}
                style={{ width: '100%', padding: '9px 36px 9px 14px', borderRadius: 'var(--border-radius-sm)', border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}
              />
              <span style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', fontSize: '0.8125rem', color: 'var(--text-secondary)', pointerEvents: 'none' }}>%</span>
            </div>
            <Button variant="lime" size="sm" loading={saving} onClick={save}>Set alert</Button>
            {editing && <button onClick={() => setEditing(false)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem' }}>Cancel</button>}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Overview Tab ──────────────────────────────────────────
function UrgencyBanner({ loan, stats, onTabChange }) {
  if (!loan || !stats) return null;
  const bestRate = Math.min(...BANKS.map(b => PRIME_RATE + (BANK_SPREADS[b] || 0)));
  const bestBank = BANKS.find(b => PRIME_RATE + (BANK_SPREADS[b] || 0) === bestRate) || 'Investec';
  if (loan.rate <= bestRate + 0.15) return null;
  const rem = Math.max(12, stats.monthsRemaining || loan.term * 12);
  const result = calcSwapSavings(stats.balance, loan.rate, bestRate, rem);
  if (!result || result.monthlySaving < 150) return null;
  const switchCost = Math.round(stats.balance * 0.005 + 3000 + stats.balance * 0.012 + 5000);
  const breakEven  = Math.ceil(switchCost / result.monthlySaving);

  return (
    <div className="urgency-banner fade-in">
      <span className="urgency-banner__bolt"><AlertTriangle size={18} /></span>
      <div className="urgency-banner__body">
        <div className="urgency-banner__headline">
          You could be overpaying <strong>{fmt(result.monthlySaving)}/month</strong>
        </div>
        <div className="urgency-banner__sub">
          Your rate: {fmtPct(loan.rate)} · Best available: {fmtPct(bestRate)} via {bestBank} · Break-even in {breakEven} months
        </div>
      </div>
      <Button variant="lime" size="sm" onClick={() => { aTrack('switch_cta_clicked', { source: 'urgency_banner' }); onTabChange('switch'); }}>
        Switch now →
      </Button>
    </div>
  );
}


// ── Journey context strip — shown when user picked an intent but has no bond yet ──
function JourneyContextStrip({ intent, onTabChange, onReset }) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const isGettingBond = intent === 'getting_bond';
  const maxBond = user?.latestMaxBond || 0;
  const zone    = user?.latestAffordabilityZone || null;
  const zoneColor = { green: '#16a34a', yellow: '#d97706', red: '#dc2626' }[zone] || 'var(--text-secondary)';

  // Honest copy: the "apply" tab creates a customer application record
  // that Bondly's broker team manually submits to lenders — it is NOT an
  // instant 7-bank API integration. Phrasing it that way was misleading.
  // The step CTA below reflects what actually happens.
  const steps = isGettingBond
    ? [
        { label: 'Check your affordability', sublabel: 'Upload a statement or enter income to see your max bond', active: true,  locked: false, action: () => navigate('/preapproval'), cta: 'Check now →' },
        { label: 'Review your finances',     sublabel: 'See which banks would approve you and what to improve', active: false, locked: true,  action: () => navigate('/preapproval'), cta: 'See results →' },
        { label: 'Submit for a bond review', sublabel: 'Our broker team takes your details to lenders — follow-up within 48h', active: false, locked: true,  action: () => onTabChange('apply'),   cta: 'Submit →' },
      ]
    : [
        { label: 'Upload a statement',  sublabel: 'Get your spending breakdown and bond score', active: true,  locked: false, action: () => navigate('/optimize'),   cta: 'Upload now →' },
        { label: 'Review your score',   sublabel: 'See how your finances compare to SA peers',  active: false, locked: true,  action: () => navigate('/optimize'),   cta: 'See score →' },
        { label: 'Submit when ready',   sublabel: 'When your finances qualify, our team takes your application to lenders',  active: false, locked: true,  action: () => onTabChange('apply'),    cta: 'Submit →' },
      ];

  return (
    <div className="first-use-wizard fade-in">
      <div className="first-use-wizard__inner">
        <div className="journey-strip__header">
          <div className="journey-strip__icon">
            {isGettingBond ? <Key size={22} /> : <TrendingUp size={22} />}
          </div>
          <div style={{ flex: 1 }}>
            <h2 className="first-use-wizard__title" style={{ marginBottom: 2 }}>
              {isGettingBond ? 'How much can I borrow?' : 'Improving your finances'}
            </h2>
            <p style={{ margin: 0, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
              {isGettingBond ? 'Upload a statement to see your exact qualification' : 'Get bond-ready in 3 steps'}
            </p>
          </div>
          {isGettingBond && maxBond >= 200000 && (
            <div style={{ textAlign: 'right', flexShrink: 0 }}>
              <div style={{ fontSize: '1.125rem', fontWeight: 800, color: zoneColor }}>{fmt(maxBond)}</div>
              <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', marginTop: 1 }}>est. max bond</div>
            </div>
          )}
        </div>

        <div className="journey-strip__steps">
          {steps.map((step, i) => (
            <div key={i} className={`journey-strip__step ${step.active ? 'journey-strip__step--active' : ''} ${step.locked ? 'journey-strip__step--locked' : ''}`}>
              <div className="journey-strip__step-num">
                {step.locked ? <span className="journey-strip__lock">🔒</span> : i + 1}
              </div>
              <div className="journey-strip__step-body">
                <div className="journey-strip__step-label">{step.label}</div>
                <div className="journey-strip__step-sub">{step.sublabel}</div>
              </div>
              {!step.locked && (
                <button className="journey-strip__step-cta" onClick={step.action}>{step.cta}</button>
              )}
            </div>
          ))}
        </div>

        {!isGettingBond && (
          <div style={{ background: 'rgba(200,168,75,0.08)', border: '1px solid rgba(200,168,75,0.2)', borderRadius: 'var(--border-radius-sm)', padding: 'var(--space-3) var(--space-4)', marginTop: 'var(--space-4)', display: 'flex', alignItems: 'center', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 200 }}>
              <div style={{ fontWeight: 600, fontSize: '0.875rem', color: 'var(--text-primary)' }}>Want to check what you qualify for?</div>
              <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>Upload a statement · see your max bond · no credit check.</div>
            </div>
            <button
              className="journey-strip__step-cta"
              onClick={() => navigate('/preapproval')}
              style={{ flexShrink: 0 }}
            >
              Check my bond →
            </button>
          </div>
        )}

        <div className="journey-strip__footer">
          {isGettingBond && (
            <span className="journey-strip__estimate">⏱ See your max bond in under 2 minutes · no credit check</span>
          )}
          <button className="journey-strip__reset" onClick={onReset}>← Change my goal</button>
        </div>
      </div>
    </div>
  );
}

function OverviewTab({ loan, stats, loans, payments, riskScore, swaps, onTabChange, onRefresh, user }) {
  const [rateHistory, setRateHistory] = useState([]);
  const [journeyIntent, setJourneyIntent] = useState(() => sessionStorage.getItem('bondly_journey_intent') || null);
  useEffect(() => {
    primeRateApi.history().then(d => setRateHistory(d || [])).catch(() => {});
  }, []);
  // Track health score visibility once per session
  useEffect(() => {
    if (riskScore?.grade) {
      aTrack('health_score_viewed', { grade: riskScore.grade, score: riskScore.score ?? riskScore.overall });
    }
  }, [riskScore?.grade]); // eslint-disable-line react-hooks/exhaustive-deps

  if (!loan) {
    if (journeyIntent && journeyIntent !== 'existing') {
      return <JourneyContextStrip intent={journeyIntent} onTabChange={onTabChange} onReset={() => { sessionStorage.removeItem('bondly_journey_intent'); setJourneyIntent(null); }} />;
    }
    return <FirstUseWizard onRefresh={onRefresh} onTabChange={onTabChange} />;
  }

  const { monthly, totalPaid, principalPaid, interestPaid, equity } = stats;

  return (
    <div className="fade-in">
      <div className="dash-desktop-greeting">
        Good {timeOfDay()}, {user?.name?.split(' ')[0] || 'there'} —
        <span className="dash-desktop-greeting__sub"> here's your bond health</span>
      </div>
      <RateChangeBanner history={rateHistory} />
      <UrgencyBanner loan={loan} stats={stats} onTabChange={onTabChange} />
      <div className="dash-stats-grid">
        {[
          { label: 'Outstanding',     value: fmt(stats.balance),   sub: `of ${fmt(loan.amount)} original` },
          { label: 'Monthly Payment', value: fmt(monthly),          sub: `at ${fmtPct(loan.rate)}${loan.source === 'statement_import' && !loan.rateConfirmed ? ' (est.)' : ''}` },
          { label: 'Principal Paid',  value: fmt(principalPaid),    sub: equity ? `${fmtPct(equity.equityPct * 100, 1)} equity` : undefined },
          { label: 'Interest Paid',   value: fmt(interestPaid),     sub: totalPaid > 0 ? `${fmtPct(interestPaid / totalPaid * 100, 0)} of payments` : undefined },
        ].map((card, i) => (
          <div key={card.label} className="fade-in" style={{ animationDelay: `${i * 60}ms` }}>
            <StatCard label={card.label} value={card.value} sub={card.sub} />
          </div>
        ))}
      </div>

      <div className="dash-overview-cols">
        <div className="dash-overview-main">
          {equity && (
            <Card>
              <CardHeader>Equity Tracker</CardHeader>
              <CardBody>
                <div className="equity-bar-wrap">
                  <div className="equity-bar">
                    <div className="equity-bar__fill" style={{ width: `${Math.min(100, equity.equityPct * 100).toFixed(1)}%` }} />
                  </div>
                  <span>{fmtPct(equity.equityPct * 100, 1)} equity</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 'var(--space-3)', marginTop: 'var(--space-4)' }}>
                  <div className="equity-stat"><div>Current value</div><strong>{fmt(equity.currentValue)}</strong></div>
                  <div className="equity-stat"><div>Equity</div><strong style={{ color: 'var(--mint)' }}>{fmt(equity.equity)}</strong></div>
                  <div className="equity-stat"><div>Outstanding</div><strong>{fmt(equity.currentBalance)}</strong></div>
                </div>
              </CardBody>
            </Card>
          )}

          <Card style={{ marginTop: equity ? 'var(--space-5)' : 0 }}>
            <CardHeader>My Bond — {loan.bank}</CardHeader>
            <CardBody>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-4)' }}>
                {[
                  { label: 'Bank',          val: loan.bank },
                  { label: 'Interest rate', val: fmtPct(loan.rate), estimated: loan.source === 'statement_import' && !loan.rateConfirmed },
                  { label: 'Term',          val: `${loan.term} years` },
                  { label: 'Monthly',       val: fmt(monthly) },
                ].map(s => (
                  <div key={s.label}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{s.label}</div>
                    <div style={{ fontWeight: 700 }}>
                      {s.val}
                      {s.estimated && <span style={{ fontSize: '0.7rem', fontWeight: 400, color: 'var(--text-secondary)', marginLeft: 5 }}>(estimated)</span>}
                    </div>
                  </div>
                ))}
              </div>
            </CardBody>
          </Card>

          {/* Conveyancing tracker shows ONLY when the user has an active
              bond application. Pinned to the top because for those users
              this is the most important card on the dashboard. */}
          <ConveyancingTracker />
          <RateVsMarketCard loan={loan} />
          <MilestonesPanel loan={loan} stats={stats} />
          <PropertySearchCard loan={loan} stats={stats} />
          {/* Phase: STRATEGY_MEMO additions — Quality Score, Switch Monitor,
              Rate-Drop Projection, Pre-Qual Certificate. Each fetches its own
              data and self-hides when there's nothing to show. */}
          <QualityScoreCard />
          <ReadinessChart />
          <PeerBenchmarkCard />
          <RateDropProjectionCard />
          <SwitchMonitorCard />
          <SubscriptionCancelCard />
          <PreQualCertificateCard />
          <ReferralCard user={user} />
        </div>

        <div className="dash-overview-side">
          <ActiveSwitchCard swaps={swaps} onTabChange={onTabChange} />
          <SwitchScoreCard loan={loan} stats={stats} onTabChange={onTabChange} />
          <LoyaltyTaxCard loan={loan} stats={stats} />
          <InstantSavingsCalc loan={loan} stats={stats} />
          {!riskScore && (
            <Card style={{ marginTop: 'var(--space-5)', background: 'linear-gradient(135deg, rgba(108,187,167,0.08) 0%, rgba(108,187,167,0.02) 100%)', border: '1.5px dashed rgba(108,187,167,0.35)' }}>
              <CardBody style={{ textAlign: 'center', padding: 'var(--space-5) var(--space-4)' }}>
                <div style={{ fontSize: '2rem', marginBottom: 'var(--space-2)' }}>📊</div>
                <div style={{ fontWeight: 700, fontSize: '1rem', marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>Get your full financial picture</div>
                <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)', lineHeight: 1.5 }}>
                  Upload a bank statement to unlock your Bond Health Score, income analysis, and a personalised savings plan.
                </p>
                <button
                  onClick={() => onTabChange('statement')}
                  style={{ background: 'var(--mint)', color: 'var(--forest)', border: 'none', borderRadius: 8, padding: '10px 20px', fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer', width: '100%' }}
                >
                  Upload statement — free →
                </button>
              </CardBody>
            </Card>
          )}
          {riskScore && (
            <Card style={{ marginTop: 'var(--space-5)' }}>
              <CardHeader>Bond Health Score</CardHeader>
              <CardBody style={{ textAlign: 'center' }}>
                <BondHealthRing score={riskScore.score ?? riskScore.overall} grade={riskScore.grade} />
                <div style={{ marginTop: 'var(--space-4)' }}>
                  {(riskScore.factors ?? Object.values(riskScore.breakdown ?? {}))
                    .map(f => (
                    <div key={f.name ?? f.label} className="risk-factor">
                      <div className="risk-factor__name">{f.name ?? f.label}</div>
                      <div className="risk-factor__bar">
                        <div className="risk-factor__fill" style={{ width: `${f.score}%` }} />
                      </div>
                      <div className="risk-factor__score">{f.score}</div>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {riskScore?.improvements && (
            <ImprovementTips improvements={riskScore.improvements} />
          )}

          <RateAlertWidget loan={loan} />
          <RateHistoryChart loan={loan} history={rateHistory} />
          <FinancialJourneyCard />
        </div>
      </div>
    </div>
  );
}

// ── Rate History Chart ────────────────────────────────────
function RateHistoryChart({ loan, history: historyProp }) {
  const [fetchedHistory, setFetchedHistory] = useState([]);

  useEffect(() => {
    if (!historyProp) {
      primeRateApi.history().then(d => setFetchedHistory(d || [])).catch(() => {});
    }
  }, [historyProp]);

  const history = historyProp ?? fetchedHistory;
  if (history.length < 2) return null;

  const W = 280, H = 90, PAD = { top: 8, right: 8, bottom: 20, left: 28 };
  const innerW = W - PAD.left - PAD.right;
  const innerH = H - PAD.top - PAD.bottom;

  const rates = history.map(h => h.rate);
  const minR = Math.min(...rates) - 0.5;
  const maxR = Math.max(...rates) + 0.5;

  const dates = history.map(h => new Date(h.date).getTime());
  const minD = Math.min(...dates);
  const maxD = Math.max(...dates);

  const px = (d) => PAD.left + ((d - minD) / (maxD - minD || 1)) * innerW;
  const py = (r) => PAD.top + innerH - ((r - minR) / (maxR - minR || 1)) * innerH;

  const points = history.map(h => `${px(new Date(h.date).getTime())},${py(h.rate)}`).join(' ');
  const area   = `M ${px(dates[0])} ${PAD.top + innerH} L ${points.split(' ').map((p,i) => (i === 0 ? `${PAD.left + 0},${PAD.top+innerH} L ${p}` : p)).join(' L ')} L ${px(dates[dates.length-1])} ${PAD.top+innerH} Z`;

  // Simple step-line (rates don't interpolate — they jump)
  let stepPath = '';
  for (let i = 0; i < history.length; i++) {
    const x = px(new Date(history[i].date).getTime());
    const y = py(history[i].rate);
    if (i === 0) { stepPath += `M ${x} ${y}`; }
    else {
      const prevX = px(new Date(history[i-1].date).getTime());
      stepPath += ` L ${x} ${py(history[i-1].rate)} L ${x} ${y}`;
    }
  }

  const latest = history[history.length - 1];
  const prev   = history[history.length - 2];
  const direction = latest.rate > prev.rate ? '↑' : latest.rate < prev.rate ? '↓' : '→';
  const dirColor  = latest.rate > prev.rate ? '#ef4444' : latest.rate < prev.rate ? 'var(--lime)' : 'var(--text-secondary)';

  return (
    <Card style={{ marginTop: 'var(--space-5)' }}>
      <CardHeader>SA Prime Rate History</CardHeader>
      <CardBody>
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
          <div>
            <div style={{ fontSize: '1.5rem', fontWeight: 800 }}>{latest.rate}%</div>
            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Current prime rate</div>
          </div>
          <div style={{ color: dirColor, fontWeight: 700, fontSize: '1.1rem' }}>{direction}</div>
          {loan && (
            <div style={{ marginLeft: 'auto', textAlign: 'right' }}>
              <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{fmtPct(loan.rate)}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Your rate</div>
            </div>
          )}
        </div>
        <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', display: 'block', overflow: 'visible' }}>
          {/* Y-axis ticks */}
          {[minR + 0.5, (minR + maxR) / 2, maxR - 0.5].map(r => (
            <g key={r}>
              <line x1={PAD.left - 3} y1={py(r)} x2={PAD.left} y2={py(r)} stroke="var(--border-color)" strokeWidth="1" />
              <text x={PAD.left - 5} y={py(r) + 4} textAnchor="end" fontSize="8" fill="var(--text-secondary)">{r.toFixed(1)}</text>
            </g>
          ))}
          {/* Grid lines */}
          {[minR + 0.5, (minR + maxR) / 2, maxR - 0.5].map(r => (
            <line key={'g'+r} x1={PAD.left} y1={py(r)} x2={W - PAD.right} y2={py(r)} stroke="var(--border-color)" strokeWidth="0.5" strokeDasharray="3,3" />
          ))}
          {/* Step line */}
          <path d={stepPath} fill="none" stroke="var(--lime)" strokeWidth="1.5" />
          {/* Data points */}
          {history.map((h, i) => (
            <circle key={i} cx={px(new Date(h.date).getTime())} cy={py(h.rate)} r="3" fill="var(--lime)" />
          ))}
          {/* X-axis labels: first + last */}
          <text x={PAD.left} y={H - 4} fontSize="8" fill="var(--text-secondary)">{history[0].date.slice(0,7)}</text>
          <text x={W - PAD.right} y={H - 4} textAnchor="end" fontSize="8" fill="var(--text-secondary)">{latest.date.slice(0,7)}</text>
        </svg>
        <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-2)', marginBottom: 0 }}>
          Rate changes since {history[0].date.slice(0,7)} · Set by SARB MPC
        </p>
      </CardBody>
    </Card>
  );
}

// ── Switch Score ──────────────────────────────────────────
function calcSwitchScore(loan, stats) {
  const bestRate = Math.min(...BANKS.map(b => PRIME_RATE + (BANK_SPREADS[b] || 0)));
  const ratePremium = Math.max(0, loan.rate - bestRate);
  let score = 0;
  score += Math.min(40, Math.round(ratePremium * 28));          // rate gap (up to 40)
  score += Math.min(25, Math.round((stats.balance || 0) / 40000)); // loan size (up to 25)
  const yrs = Math.max(0, (stats.monthsRemaining || loan.term * 12) / 12);
  score += Math.min(20, Math.round(yrs * 1.4));                 // time remaining (up to 20)
  score += 15;                                                   // market timing bonus
  if ((stats.balance || 0) < 150000) score = Math.min(score, 25); // too small
  return Math.max(0, Math.min(99, score));
}

function SwitchScoreCard({ loan, stats, onTabChange }) {
  if (!loan || !stats) return null;
  const score = calcSwitchScore(loan, stats);
  if (score < 25) return null;
  const bestRate = Math.min(...BANKS.map(b => PRIME_RATE + (BANK_SPREADS[b] || 0)));
  const color = score >= 70 ? 'var(--color-grade-a)' : score >= 45 ? 'var(--color-warning)' : 'var(--text-secondary)';
  const label = score >= 70 ? 'Strong candidate to switch' : score >= 45 ? 'Worth exploring' : 'Low priority right now';
  const circumference = 2 * Math.PI * 32;

  return (
    <Card style={{ marginTop: 'var(--space-5)' }}>
      <CardHeader>Switch Score</CardHeader>
      <CardBody>
        <div className="switch-score">
          <div className="switch-score__ring-wrap">
            <svg viewBox="0 0 80 80" width="80" height="80">
              <circle cx="40" cy="40" r="32" fill="none" stroke="var(--bg-page)" strokeWidth="8" />
              <circle cx="40" cy="40" r="32" fill="none" style={{ stroke: color }} strokeWidth="8"
                strokeDasharray={circumference}
                strokeDashoffset={circumference - (circumference * score / 100)}
                strokeLinecap="round"
                transform="rotate(-90 40 40)"
              />
            </svg>
            <div className="switch-score__label-ring">{score}%</div>
          </div>
          <div className="switch-score__body">
            <div className="switch-score__verdict" style={{ color }}>{label}</div>
            <p className="switch-score__desc">
              {score >= 70
                ? `Your rate (${fmtPct(loan.rate)}) is above best available (${fmtPct(bestRate)}). Now is a strong time to switch.`
                : `You're ${fmtPct(Math.max(0, loan.rate - bestRate))} above the best rate. Compare to see if it's worth acting.`}
            </p>
            <button className="switch-score__cta" onClick={() => onTabChange('switch')}>
              Compare all banks →
            </button>
          </div>
        </div>
      </CardBody>
    </Card>
  );
}

// ── Instant Savings Calculator ────────────────────────────
function InstantSavingsCalc({ loan, stats }) {
  const [newRate, setNewRate] = useState('');
  if (!loan || !stats) return null;
  const bestRate = Math.min(...BANKS.map(b => PRIME_RATE + (BANK_SPREADS[b] || 0)));
  const inputRate = newRate !== '' ? parseFloat(newRate) : null;
  const calcRate  = inputRate ?? bestRate;
  const rem = Math.max(12, stats.monthsRemaining || loan.term * 12);
  const savings = !isNaN(calcRate) && calcRate > 0 && calcRate < loan.rate
    ? calcSwapSavings(stats.balance, loan.rate, calcRate, rem)
    : null;

  return (
    <Card style={{ marginTop: 'var(--space-5)' }}>
      <CardHeader>Instant Savings Calculator</CardHeader>
      <CardBody>
        <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
          What if you switched to a lower rate? Your current rate: <strong>{fmtPct(loan.rate)}</strong>
        </p>
        <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <input
              type="number" step="0.25" min={bestRate - 0.5} max={loan.rate - 0.25}
              placeholder={String(bestRate)}
              value={newRate}
              onChange={e => setNewRate(e.target.value)}
              className="savings-calc-input"
            />
            <span className="savings-calc-suffix">%</span>
          </div>
          {newRate && <button className="savings-calc-clear" onClick={() => setNewRate('')}>✕</button>}
        </div>
        {savings ? (
          <div className="savings-result fade-in">
            <div className="savings-result__row">
              <span>Monthly saving</span>
              <strong style={{ color: 'var(--color-grade-a)', fontSize: '1.125rem' }}>{fmt(savings.monthlySaving)}<span style={{ fontSize: '0.75rem' }}>/mo</span></strong>
            </div>
            <div className="savings-result__row">
              <span>Total over remaining term</span>
              <strong style={{ color: 'var(--mint)' }}>{fmt(savings.totalSaving)}</strong>
            </div>
          </div>
        ) : (
          <div className="savings-result-hint">
            Best available rate: <strong>{fmtPct(bestRate)}</strong> — try entering it above.
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Referral Card ─────────────────────────────────────────
function ReferralCard({ user }) {
  const [copied, setCopied] = useState(false);
  const code = user?.id ? `B${user.id.toString().padStart(4, '0')}` : 'SHARE';
  const referralUrl = `https://bondly.co.za?ref=${code}`;

  function copy() {
    navigator.clipboard?.writeText(referralUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2500);
  }

  return (
    <div className="referral-card fade-in">
      <div className="referral-card__top">
        <span className="referral-card__gift"><Gift size={20} /></span>
        <div>
          <div className="referral-card__headline">Earn R500 per referral</div>
          <div className="referral-card__sub">Share Bondly with a friend who switches their bond — you both win.</div>
        </div>
      </div>
      <div className="referral-card__link-row">
        <code className="referral-card__code">{referralUrl}</code>
        <button className={`referral-card__copy ${copied ? 'copied' : ''}`} onClick={copy}>
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
    </div>
  );
}

// ── Rate Change Banner ────────────────────────────────────
function RateChangeBanner({ history }) {
  if (!history || history.length < 2) return null;
  const latest = history[history.length - 1];
  const prev   = history[history.length - 2];
  const diff   = latest.rate - prev.rate;
  if (Math.abs(diff) < 0.01) return null;

  // Only show if change was within last 90 days
  const daysAgo = (Date.now() - new Date(latest.date).getTime()) / 86400000;
  if (daysAgo > 90) return null;

  const isGood = diff < 0;
  return (
    <div className={`rate-change-banner ${isGood ? 'rate-change-banner--good' : 'rate-change-banner--bad'}`}>
      <span className="rate-change-banner__icon">{isGood ? <TrendingDown size={18}/> : <TrendingUp size={18}/>}</span>
      <span>
        Prime rate {isGood ? 'dropped' : 'rose'} by <strong>{Math.abs(diff).toFixed(2)}%</strong> on {new Date(latest.date).toLocaleDateString('en-ZA', { month: 'short', day: 'numeric' })}
        {isGood ? ' — your monthly repayment has decreased.' : ' — check your current repayment.'}
      </span>
    </div>
  );
}

function timeOfDay() {
  const h = new Date().getHours();
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  return 'evening';
}
