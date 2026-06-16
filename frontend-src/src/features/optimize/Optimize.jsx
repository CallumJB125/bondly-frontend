import { useState, useRef, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, TrendingUp, ChevronDown, ChevronUp, Edit2, Check, X, ShoppingCart, UtensilsCrossed, Film, Fuel, Zap, Shield, Repeat, AlertTriangle, Package, BarChart2, Sliders, Home, Camera } from 'lucide-react';
import { trackAction } from '@bondly/ui/lib/session.js';
import { fmt, fmtDate } from '@bondly/ui/lib/format.js';
import { useAuth } from '../../context/AuthContext.jsx';
import { financialFitness, pollParseJob } from '../../lib/api.js';
import StatementLoader from '@bondly/ui/components/StatementLoader.jsx';
import {
  GoalPanel, ProgressSection, SnapshotHistory, PayOffFasterPanel, CommitPanel,
} from '../dashboard/FinancialFitnessTab.jsx';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';
import { adminApi } from '../../lib/api.js';
import { useToast } from '@bondly/ui/components/Toast.jsx';
import PropertySearchCTA from '@bondly/ui/components/PropertySearchCTA.jsx';
import './Optimize.css';
import '../dashboard/FinancialFitnessTab.css';

const STRESS_PV = 74.7; // R1/mo saved ≈ R74.7 extra bond at 13.25% stress, 20yr

const CAT_META = {
  groceries:         { label: 'Groceries & Food',     icon: ShoppingCart },
  dining_out:        { label: 'Dining & Restaurants', icon: UtensilsCrossed },
  entertainment:     { label: 'Entertainment & Gym',  icon: Film },
  fuel:              { label: 'Fuel & Transport',     icon: Fuel },
  utilities:         { label: 'Utilities & Mobile',   icon: Zap },
  insurance:         { label: 'Insurance',            icon: Shield },
  subscriptions:     { label: 'Subscriptions & Fees', icon: Repeat },
  gambling:          { label: 'Gambling',             icon: AlertTriangle },
  crypto_investment: { label: 'Crypto purchases',     icon: AlertTriangle },
  other:             { label: 'Other expenses',       icon: Package },
};

// Categories that materially affect affordability decisions — surface with
// a red FLAGGED badge so users see them as the lowest-pain cuts.
const SENSITIVE_CATS = new Set(['gambling', 'crypto_investment']);

// "Suggest cuts" preset — per-category default reduction (%) when the user
// clicks the auto-suggest button. Gambling goes to 0; the rest are sensible
// SA-discretionary trims.
const SMART_CUTS_PCT = {
  gambling:          100,
  crypto_investment:  50,
  subscriptions:      40,
  dining_out:         30,
  entertainment:      25,
  other:              20,
};

const PRIORITY_COLOR = { critical: '#ef4444', high: '#f97316', medium: '#eab308' };
const SCORE_KEY = { color: s => s >= 70 ? '#22c55e' : s >= 45 ? '#eab308' : '#ef4444' };

// ── Sample result for demo mode ────────────────────────────────────────────
const DEMO_RESULT = {
  detected: true,
  statementMonths: 1,
  income: { detected: true, monthlyAmount: 28500, confidence: 'high', occurrences: 1, employmentType: 'salaried' },
  debts: { totalMonthly: 3200, items: [{ payee: 'Vehicle Finance', avgAmount: 3200 }] },
  existingMortgage: { detected: false },
  expenses: {
    total: 17400,
    breakdown: { groceries: 4200, dining_out: 3800, fuel: 2100, utilities: 1900, insurance: 2400, entertainment: 1800, subscriptions: 1200 },
    subscriptionItems: [{ name: 'Netflix', monthlyAmount: 199 }, { name: 'Spotify', monthlyAmount: 99 }],
  },
  qualification: { maxBond: 1240000, maxMonthly: 5430, monthlyAtPrime: 13100, verdict: 'likely_qualify', verdictLabel: 'You likely qualify', stressRate: 13.25 },
  riskProfile: { grade: 'B', label: 'Low–moderate risk', color: '#22c55e', dti: 11.2, expenseRatio: 61, netDisposable: 7900, incomeStability: 'Low (single occurrence)', employmentType: 'salaried' },
  readiness: { score: 54, label: 'Getting there', breakdown: {} },
  spendingBenchmarks: {
    groceries:     { userAmount: 4200, peerAmount: 3990, userPct: 14.7, peerPct: 14, overSpend: true,  overSpendPct: 5,  bracketLabel: 'earners R20k–R35k/month' },
    dining_out:    { userAmount: 3800, peerAmount: 1995, userPct: 13.3, peerPct: 7,  overSpend: true,  overSpendPct: 90, bracketLabel: 'earners R20k–R35k/month' },
    fuel:          { userAmount: 2100, peerAmount: 1995, userPct: 7.4,  peerPct: 7,  overSpend: false, overSpendPct: 0,  bracketLabel: 'earners R20k–R35k/month' },
    utilities:     { userAmount: 1900, peerAmount: 1995, userPct: 6.7,  peerPct: 7,  overSpend: false, overSpendPct: 0,  bracketLabel: 'earners R20k–R35k/month' },
    insurance:     { userAmount: 2400, peerAmount: 1425, userPct: 8.4,  peerPct: 5,  overSpend: true,  overSpendPct: 68, bracketLabel: 'earners R20k–R35k/month' },
    entertainment: { userAmount: 1800, peerAmount: 1425, userPct: 6.3,  peerPct: 5,  overSpend: true,  overSpendPct: 26, bracketLabel: 'earners R20k–R35k/month' },
    subscriptions: { userAmount: 1200, peerAmount:  570, userPct: 4.2,  peerPct: 2,  overSpend: true,  overSpendPct: 110,bracketLabel: 'earners R20k–R35k/month' },
  },
  optimizations: [
    { type: 'dining_out', priority: 'high', title: 'Cut dining out by 50%', description: 'You spend R3,800/month on restaurants and payment terminals — nearly double the peer benchmark. Reducing to R1,900 would meaningfully improve your bond qualification.', monthlySaving: 1900, loanImpact: 141930 },
    { type: 'subscriptions', priority: 'medium', title: 'Review subscriptions and fees', description: 'You have R1,200/month in subscriptions — double the peer average. Cancel unused services to free up R630/month.', monthlySaving: 630, loanImpact: 47061 },
    { type: 'insurance', priority: 'medium', title: 'Shop your insurance', description: 'Your insurance spend is 68% above the peer benchmark. Getting a comparison quote could save R975/month with no lifestyle change.', monthlySaving: 975, loanImpact: 72832 },
  ],
  accountBalance: null,
  _isDemo: true,
};

function ScoreArc({ score }) {
  const r = 52, cx = 64, cy = 62;
  const circ  = Math.PI * r;
  const filled = Math.min(1, score / 100) * circ;
  const color  = SCORE_KEY.color(score);
  const d = `M ${cx - r} ${cy} A ${r} ${r} 0 0 1 ${cx + r} ${cy}`;
  return (
    <svg width="128" height="70" viewBox="0 0 128 70">
      <path d={d} fill="none" stroke="var(--border-color)" strokeWidth="11" strokeLinecap="round" />
      <path d={d} fill="none" stroke={color} strokeWidth="11" strokeLinecap="round"
        strokeDasharray={`${filled} ${circ}`} />
      <text x={cx} y={cy - 8} textAnchor="middle" fill={color} fontSize="22" fontWeight="800" fontFamily="inherit">{score}</text>
      <text x={cx} y={cy + 7} textAnchor="middle" fill="var(--text-secondary)" fontSize="9" fontFamily="inherit">/ 100</text>
    </svg>
  );
}

function SpendBar({ label, userAmt, peerAmt, Icon, overSpend, overSpendPct }) {
  const max = Math.max(userAmt, peerAmt, 1);
  return (
    <div className="opt-spend-row">
      <div className="opt-spend-row__head">
        <Icon size={14} className="opt-spend-row__cat-icon" />
        <span className="opt-spend-row__label">{label}</span>
        <span className={`opt-spend-row__amount ${overSpend ? 'opt-spend-row__amount--over' : ''}`}>
          {fmt(userAmt)}/mo
          {overSpend && <span className="opt-spend-badge">+{overSpendPct}% vs peers</span>}
        </span>
      </div>
      <div className="opt-spend-bars">
        <div className="opt-spend-bars__track">
          <div className="opt-spend-bars__fill opt-spend-bars__fill--you" style={{ width: `${(userAmt / max) * 100}%` }} />
        </div>
        <span className="opt-spend-bars__side-label">You</span>
        <div className="opt-spend-bars__track">
          <div className="opt-spend-bars__fill opt-spend-bars__fill--peer" style={{ width: `${(peerAmt / max) * 100}%` }} />
        </div>
        <span className="opt-spend-bars__side-label">Peers</span>
      </div>
    </div>
  );
}

function WhatIfSlider({ cat, label, Icon, current, peer, onChange, sensitive = false }) {
  const saving = Math.max(0, current - peer);
  return (
    <div className={`opt-slider-row ${sensitive ? 'opt-slider-row--sensitive' : ''}`}>
      <div className="opt-slider-row__head">
        <span style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <Icon size={13} /> {label}
          {sensitive && <span className="opt-slider-row__flag">flagged</span>}
        </span>
        <span className="opt-slider-row__val">
          <span style={{ color: 'var(--text-secondary)' }}>{fmt(current)}</span>
          <span style={{ margin: '0 4px', color: 'var(--text-secondary)' }}>→</span>
          <strong>{fmt(peer)}</strong>/mo
        </span>
      </div>
      <input
        type="range"
        min={0}
        max={Math.max(current * 1.1, peer * 1.1, 500)}
        step={100}
        value={peer}
        onChange={e => onChange(cat, Number(e.target.value))}
        className="opt-slider"
      />
      {saving > 0 && (
        <div className="opt-slider-row__impact">
          Save {fmt(saving)}/mo → +{fmt(Math.round(saving * STRESS_PV))} bond
        </div>
      )}
    </div>
  );
}

// ── Teaser shown to guests ──────────────────────────────────────────────────
function GateTeaser({ result, onRegister, onLogin, fromPreapproval }) {
  const score    = result.readiness?.score ?? 0;
  const income   = result.income?.monthlyAmount ?? 0;
  const optCount = result.optimizations?.length ?? 0;
  const topOpts  = (result.optimizations || []).slice(0, 3);

  return (
    <div className="opt-gate fade-in">
      <div className="opt-gate__hero">
        <div className="opt-gate__score-wrap">
          <ScoreArc score={score} />
          <div className="opt-gate__score-label">Readiness score</div>
        </div>
        <div className="opt-gate__stats">
          {income > 0 && (
            <div>
              <div className="opt-gate__stat-val">{fmt(income)}/mo</div>
              <div className="opt-gate__stat-label">Detected income</div>
            </div>
          )}
          {result.qualification?.maxBond > 0 && (
            <div>
              <div className={`opt-gate__stat-val ${result.qualification.maxBond < 500000 ? 'opt-gate__stat-val--warn' : ''}`}>
                {fmt(result.qualification.maxBond)}
              </div>
              <div className="opt-gate__stat-label">Current max bond</div>
            </div>
          )}
          {optCount > 0 && (
            <div>
              <div className="opt-gate__stat-val">{optCount} actions</div>
              <div className="opt-gate__stat-label">To improve your score</div>
            </div>
          )}
        </div>
      </div>

      {topOpts.length > 0 && (
        <div className="opt-gate__preview">
          <div className="opt-gate__preview-label">Your personalised action plan</div>
          <div className="opt-gate__blur-list">
            {topOpts.map((opt, i) => (
              <div key={i} className="opt-gate__blur-row">
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: PRIORITY_COLOR[opt.priority] }}>#{i+1}</span>
                <span style={{ flex: 1 }}>{opt.title}</span>
                {opt.loanImpact > 0 && <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>+{fmt(opt.loanImpact)}</span>}
              </div>
            ))}
          </div>
          <div className="opt-gate__blur-overlay" />
        </div>
      )}

      <div className="opt-gate__cta">
        <h2 className="opt-gate__cta-title">
          {fromPreapproval ? 'Unlock your full improvement plan — free' : 'Unlock your full report — free'}
        </h2>
        <p className="opt-gate__cta-sub">
          {fromPreapproval
            ? 'Create a free account to see your full spending breakdown, what-if bond simulator and ranked action plan — so you can track your progress month by month until you qualify.'
            : 'Create a free account to see your full spending breakdown, what-if simulator and personalised action plan. We save your results so you can track progress month by month.'}
        </p>
        <button className="btn btn--lime opt-gate__cta-btn" onClick={onRegister}>
          Create free account →
        </button>
        <button className="opt-gate__signin-link" onClick={onLogin}>Already have an account? Sign in</button>
      </div>
    </div>
  );
}

// ── Income field with inline override ──────────────────────────────────────
function IncomeField({ income, detected, confidence, occurrences, onOverride, recalculating }) {
  const notDetected = !detected || income === 0;
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');

  function startEdit() {
    setDraft(notDetected ? '' : String(Math.round(income)));
    setEditing(true);
  }

  function cancel() { setEditing(false); }

  function save() {
    const v = parseFloat(draft.replace(/[^0-9.]/g, ''));
    if (v > 0) onOverride(v);
    setEditing(false);
  }

  const confidenceColor = confidence === 'high' ? '#22c55e' : confidence === 'medium' ? '#eab308' : '#f97316';
  const confidenceLabel = confidence === 'high'
    ? `${occurrences}× detected`
    : confidence === 'medium' ? 'Single month' : 'Low confidence — edit if wrong';

  if (editing) {
    return (
      <div className="opt-income-edit">
        <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>R</span>
        <input
          type="number"
          value={draft}
          onChange={e => setDraft(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') save(); if (e.key === 'Escape') cancel(); }}
          autoFocus
          className="opt-income-input"
          min={0}
        />
        <button onClick={save} className="opt-income-btn opt-income-btn--save" title="Save"><Check size={13} /></button>
        <button onClick={cancel} className="opt-income-btn opt-income-btn--cancel" title="Cancel"><X size={13} /></button>
      </div>
    );
  }

  if (notDetected && !editing) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span className="opt-summary-strip__val" style={{ color: 'var(--text-secondary)' }}>Not detected</span>
        <button onClick={startEdit} className="opt-income-edit-btn opt-income-edit-btn--prompt" title="Enter your income" disabled={recalculating}>
          <Edit2 size={11} /> Enter income
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span className="opt-summary-strip__val">{income > 0 ? fmt(income) : '—'}</span>
      {income > 0 && (
        <>
          <span style={{ fontSize: '0.6875rem', fontWeight: 600, color: confidenceColor, background: `${confidenceColor}18`, borderRadius: 999, padding: '1px 7px' }}>
            {confidenceLabel}
          </span>
          <button onClick={startEdit} className="opt-income-edit-btn" title="Correct income" disabled={recalculating}>
            <Edit2 size={11} />
          </button>
        </>
      )}
      {recalculating && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>updating…</span>}
    </div>
  );
}

// ── Main component ──────────────────────────────────────────────────────────
export default function Optimize() {
  const navigate   = useNavigate();
  const fileRef    = useRef(null);
  const photoRef   = useRef(null);
  const { isLoggedIn } = useAuth();
  const showToast = useToast();

  const [uploading,     setUploading]     = useState(false);
  const [uploadSlow,    setUploadSlow]    = useState(false);
  const [aiConsent,     setAiConsent]     = useState(false);
  const [error,         setError]         = useState('');
  const [result,        setResult]        = useState(null);
  const [adjustments,   setAdjustments]   = useState({});
  const [showAllBenchmarks, setShowAllBenchmarks] = useState(false);
  const [showAllOpts,   setShowAllOpts]   = useState(false);
  const [saved,         setSaved]         = useState(false);
  const [recalculating, setRecalculating] = useState(false);
  const [savedSnapshotId, setSavedSnapshotId] = useState(null);
  const [accuracyRating,  setAccuracyRating]  = useState(null);
  const [latestSnap,      setLatestSnap]      = useState(null);
  const [goal,            setGoal]            = useState(null);
  const [progress,        setProgress]        = useState(null);
  const [commitments,     setCommitments]     = useState([]);
  const [allSnapshots,    setAllSnapshots]    = useState([]);
  const [fromPreapproval, setFromPreapproval] = useState(false);

  // On mount: restore pending result if user just registered; also load latest snapshot + fintech data
  useEffect(() => {
    const loadSupporting = () => {
      financialFitness.getGoals().then(d => setGoal(d.goals?.[0] || null)).catch(() => {});
      financialFitness.getProgress().then(d => setProgress(d)).catch(() => {});
      financialFitness.getCommitments().then(d => setCommitments(d.commitments || [])).catch(() => {});
    };

    // Result passed from the preapproval page — works for guests and logged-in users
    try {
      const raw = sessionStorage.getItem('bondly_optimizer_from_pa');
      if (raw) {
        const data = JSON.parse(raw);
        sessionStorage.removeItem('bondly_optimizer_from_pa');
        restoreResult(data, false);
        setFromPreapproval(true);
        if (isLoggedIn) loadSupporting();
        return;
      }
    } catch {}

    if (!isLoggedIn) return;

    try {
      const raw = sessionStorage.getItem('bondly_optimizer_pending');
      if (raw) {
        const data = JSON.parse(raw);
        sessionStorage.removeItem('bondly_optimizer_pending');
        restoreResult(data, true);
        loadSupporting();
        return;
      }
    } catch {}
    financialFitness.getSnapshots()
      .then(d => {
        const snaps = d.snapshots || [];
        setAllSnapshots(snaps);
        if (snaps.length) {
          window.gtag?.('event', 'statement_analysed', { event_category: 'optimizer' });
          setLatestSnap(snaps[0]);
        }
      })
      .catch(() => {});
    loadSupporting();
  }, [isLoggedIn]);

  function restoreResult(data, autoSave = false) {
    setResult(data);
    const adj = {};
    for (const [cat, bm] of Object.entries(data.spendingBenchmarks || {})) {
      adj[cat] = bm.peerAmount;
    }
    setAdjustments(adj);
    if (autoSave && !data._isDemo) {
      financialFitness.saveSnapshot(data)
        .then(r => {
          setSaved(true);
          setSavedSnapshotId(r?.snapshot?.id || null);
          showToast('Analysis saved to your profile', 'success');
          financialFitness.getSnapshots().then(d => setAllSnapshots(d.snapshots || [])).catch(() => {});
          financialFitness.getProgress().then(d => setProgress(d)).catch(() => {});
        })
        .catch(() => {});
    }
  }

  async function handleFile(file) {
    if (!file) return;
    const isImg = file.type.startsWith('image/');
    if (!isImg && !file.name.match(/\.(csv|pdf)$/i)) {
      setError('Please upload a PDF, CSV, or photo of your statement');
      return;
    }
    trackAction('upload_attempted', { type: isImg ? 'image' : file.name.match(/\.pdf$/i) ? 'pdf' : 'csv' });
    setUploading(true); setUploadSlow(false); setError(''); setResult(null); setAdjustments({}); setSaved(false);
    const slowTimer = setTimeout(() => setUploadSlow(true), 90000);
    try {
      const fd = new FormData();
      fd.append('statement', file);
      const _tok = localStorage.getItem('bondly_token');
      const headers = _tok ? { Authorization: 'Bearer ' + _tok } : {};
      let initJ;
      try {
        const r = await fetch('/api/qualify/from-statement?async=1', { method: 'POST', body: fd, headers });
        initJ = await r.json();
      } catch {
        throw new Error('Upload failed — please check your connection and try again');
      }
      if (!initJ.success) throw new Error(initJ.error || 'Could not analyse');
      const data = await pollParseJob(initJ.data.jobId);
      trackAction('upload_success', { type: isImg ? 'image' : 'document' });
      if (isLoggedIn) {
        restoreResult(data, true);
      } else {
        restoreResult(data, false);
      }
    } catch (e) {
      const msg = e.message || '';
      trackAction('upload_failed', { error: msg.slice(0, 100) });
      if (msg === 'Load failed' || msg === 'Failed to fetch' || msg === 'NetworkError when attempting to fetch resource.') {
        setError('Upload failed — if you\'re on iPhone, make sure the PDF is downloaded to your device first (open Files app → tap the file → wait for the download to complete), then try again.');
      } else {
        setError(msg || 'Could not parse statement');
      }
    } finally {
      clearTimeout(slowTimer);
      setUploading(false);
      setUploadSlow(false);
    }
  }

  function handleDemo() {
    setError('');
    restoreResult(DEMO_RESULT, false);
  }

  const incomeDebounceRef = useRef(null);
  useEffect(() => () => clearTimeout(incomeDebounceRef.current), []);

  const handleIncomeOverride = useCallback((newIncome) => {
    if (!result || newIncome <= 0 || newIncome > 5_000_000) return;
    clearTimeout(incomeDebounceRef.current);
    incomeDebounceRef.current = setTimeout(() => submitIncomeOverride(newIncome), 600);
  }, [result]);

  async function submitIncomeOverride(newIncome) {
    setRecalculating(true);
    try {
      const res = await fetch('/api/qualify/recalculate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          income: newIncome,
          expenses: result.expenses,
          debts: result.debts,
          existingMortgage: result.existingMortgage,
          statementMonths: result.statementMonths,
        }),
      });
      const j = await res.json();
      if (!j.success) throw new Error(j.error);
      setResult(prev => ({
        ...prev,
        income: { ...prev.income, monthlyAmount: newIncome },
        qualification: j.data.qualification,
        spendingBenchmarks: j.data.spendingBenchmarks,
        optimizations: j.data.optimizations,
        readiness: j.data.readiness,
      }));
      const adj = {};
      for (const [cat, bm] of Object.entries(j.data.spendingBenchmarks || {})) {
        adj[cat] = bm.peerAmount;
      }
      setAdjustments(adj);
    } catch (e) {
      showToast('Could not recalculate — ' + e.message, 'error');
    } finally {
      setRecalculating(false);
    }
  }

  function handleGateRegister() {
    try { sessionStorage.setItem('bondly_optimizer_pending', JSON.stringify(result)); } catch {}
    navigate('/login', { state: { tab: 'register' } });
  }

  function handleGateLogin() {
    try { sessionStorage.setItem('bondly_optimizer_pending', JSON.stringify(result)); } catch {}
    navigate('/login', { state: { tab: 'login' } });
  }

  function handleAdjust(cat, val) {
    setAdjustments(a => ({ ...a, [cat]: val }));
  }

  function handleRestoreLatest() {
    if (!latestSnap) return;
    restoreResult(latestSnap, false);
    setSaved(true);
    setSavedSnapshotId(latestSnap.id || null);
  }

  function handleReset() {
    setResult(null);
    setAdjustments({});
    setSaved(false);
  }

  const baseline   = result?.qualification?.maxBond || 0;
  const income     = result?.income?.monthlyAmount  || 0;
  const bm         = result?.spendingBenchmarks || {};
  const optimizations    = result?.optimizations || [];
  const benchmarkEntries = Object.entries(bm);

  const totalSavingFromSliders = Object.entries(adjustments).reduce((sum, [cat, newAmt]) => {
    const current = bm[cat]?.userAmount || 0;
    return sum + Math.max(0, current - newAmt);
  }, 0);
  const projectedBond = baseline + Math.round(totalSavingFromSliders * STRESS_PV);

  const displayedBenchmarks = showAllBenchmarks ? benchmarkEntries : benchmarkEntries.slice(0, 5);
  const displayedOpts       = showAllOpts ? optimizations : optimizations.slice(0, 3);
  const canApply            = income > 0 && baseline >= 300000;

  return (
    <div className="opt-page">
      <div className="container opt-inner">

        {/* Header */}
        <div className="opt-header">
          <div className="opt-header__eyebrow">{fromPreapproval ? 'Improvement Plan' : 'Financial Optimizer'}</div>
          <h1 className="opt-header__title">
            {fromPreapproval
              ? 'Here\'s exactly what to change to qualify for more'
              : 'See where your money goes — and what it unlocks'}
          </h1>
          <p className="opt-header__sub">
            {fromPreapproval
              ? 'Your statement has been analysed. See how your spending compares to SA peers and get a ranked action plan to grow your bond qualification.'
              : 'Upload your bank statement (PDF or CSV) and AI analyses it in 90 seconds — showing exactly how your spending compares to SA peers and how close you are to home loan readiness. No broker call needed.'}
          </p>
          <div className="opt-header__trust">
            <span>✦ Analysed by AI · 90 seconds</span>
            <span className="opt-dot" />
            <span>No credit check</span>
            <span className="opt-dot" />
            <span>POPIA compliant</span>
          </div>
        </div>

        {/* Upload zone — shown when no result yet */}
        {!result && (
          <div className="opt-upload fade-in">
            {fromPreapproval && (
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 16px', marginBottom:16, background:'rgba(200,168,75,0.08)', border:'1px solid rgba(200,168,75,0.28)', borderRadius:8, fontSize:'0.875rem' }}>
                <span style={{ fontSize:'1rem', flexShrink:0 }}>📋</span>
                <div>
                  <strong>Almost there — upload your bank statement below</strong>
                  <span style={{ color:'var(--text-secondary)' }}> to unlock your personalised improvement plan. It takes 90 seconds and no sign-up is needed.</span>
                </div>
              </div>
            )}
            {/* POPIA / AI consent — must be accepted before upload is enabled */}
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 10, margin: '0 0 14px', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.45 }}>
              <input
                type="checkbox"
                checked={aiConsent}
                onChange={e => setAiConsent(e.target.checked)}
                style={{ marginTop: 2, flexShrink: 0, accentColor: 'var(--lime)' }}
              />
              <span>
                I agree that my bank statement will be analysed using{' '}
                <strong style={{ color: 'var(--text-primary)' }}>Claude AI (Anthropic, USA)</strong>{' '}
                to extract transactions and income. No data is sold or shared beyond this analysis.{' '}
                <a href="/privacy" style={{ color: 'var(--lime)' }}>Privacy Policy</a>
              </span>
            </label>

            {/* Hidden inputs — separate so iOS file picker doesn't mix types */}
            <input ref={fileRef} type="file" accept=".csv,.pdf" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])} />
            <input ref={photoRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }}
              onChange={e => handleFile(e.target.files?.[0])} />
            <div
              className={`opt-dropzone ${uploading ? 'opt-dropzone--loading' : ''} ${!aiConsent ? 'opt-dropzone--disabled' : ''}`}
              onClick={() => !uploading && aiConsent && fileRef.current?.click()}
              onDragOver={e => { if (aiConsent) e.preventDefault(); }}
              onDrop={e => { e.preventDefault(); if (aiConsent) handleFile(e.dataTransfer.files[0]); }}
              title={!aiConsent ? 'Please accept the AI processing consent above first' : undefined}
            >
              {uploading ? (
                <StatementLoader slow={uploadSlow} />
              ) : (
                <>
                  <Upload size={28} className="opt-dropzone__icon" />
                  <strong>Drop your bank statement here</strong>
                  <span>PDF or CSV · ABSA, FNB, Nedbank, Standard Bank, Capitec, Investec</span>
                  <button className="opt-dropzone__btn">Choose file</button>
                </>
              )}
            </div>
            {!uploading && (
              <div style={{ textAlign: 'center', marginTop: 8 }}>
                <button
                  className="opt-demo-btn"
                  style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'inline-flex', alignItems: 'center', gap: 6 }}
                  onClick={() => aiConsent && photoRef.current?.click()}
                  disabled={!aiConsent}
                >
                  <Camera size={14} /> Take a photo of your statement instead
                </button>
              </div>
            )}
            {error && (
              <div className="opt-error">
                {error}
                {/scanned|image|ocr/i.test(error) && (
                  <div style={{ marginTop: 8, fontSize: '0.8125rem' }}>
                    To export a CSV: open your banking app → Statements → Download → CSV format.
                  </div>
                )}
              </div>
            )}

            {/* Use last analysis — shown when user has previous snapshots */}
            {isLoggedIn && latestSnap && (
              <div style={{ textAlign: 'center', marginTop: 'var(--space-4)' }}>
                <button className="opt-demo-btn" style={{ color: 'var(--lime)', borderColor: 'var(--lime)' }} onClick={handleRestoreLatest}>
                  ↩ Use your last analysis ({fmtDate(latestSnap.uploadedAt || latestSnap.createdAt)})
                </button>
              </div>
            )}

            {/* Demo button */}
            <div style={{ textAlign: 'center', marginTop: 'var(--space-3)' }}>
              <button className="opt-demo-btn" onClick={handleDemo}>
                See an example first →
              </button>
            </div>

            {/* Blurred preview — shows what the result looks like before uploading */}
            {!latestSnap && (
              <div className="opt-preview-teaser">
                <div className="opt-preview-teaser__blur" aria-hidden>
                  <div className="opt-preview-teaser__score-row">
                    <div className="opt-preview-teaser__score-block">
                      <div className="opt-preview-teaser__score-num">74</div>
                      <div className="opt-preview-teaser__score-label">Bond readiness</div>
                    </div>
                    <div className="opt-preview-teaser__grade">B</div>
                  </div>
                  <div className="opt-preview-teaser__bars">
                    {[['Affordability', 82], ['Income stability', 65], ['Debt ratio', 71], ['Spending', 58]].map(([label, pct]) => (
                      <div key={label} className="opt-preview-teaser__bar-row">
                        <span>{label}</span>
                        <div className="opt-preview-teaser__bar-track">
                          <div className="opt-preview-teaser__bar-fill" style={{ width: `${pct}%` }} />
                        </div>
                        <span>{pct}</span>
                      </div>
                    ))}
                  </div>
                  <div className="opt-preview-teaser__bond-row">
                    <span>Estimated max bond</span>
                    <strong>R 1,240,000</strong>
                  </div>
                </div>
                <div className="opt-preview-teaser__overlay">
                  <div className="opt-preview-teaser__overlay-icon">📊</div>
                  <div className="opt-preview-teaser__overlay-title">Your bond score is waiting</div>
                  <div className="opt-preview-teaser__overlay-sub">Upload your statement to unlock your personalised result</div>
                </div>
              </div>
            )}

            {/* Value prop for guests */}
            {!isLoggedIn && (
              <div className="opt-value-prop">
                <div className="opt-value-prop__item"><BarChart2 size={16} /><span>Spending vs SA peer benchmarks</span></div>
                <div className="opt-value-prop__item"><Sliders size={16} /><span>What-if bond simulator</span></div>
                <div className="opt-value-prop__item"><TrendingUp size={16} /><span>Monthly progress tracking</span></div>
                <div className="opt-value-prop__item"><Home size={16} /><span>Personalised path to homeownership</span></div>
              </div>
            )}
          </div>
        )}

        {/* Guest teaser gate */}
        {result && !isLoggedIn && (
          <GateTeaser
            result={result}
            onRegister={handleGateRegister}
            onLogin={handleGateLogin}
            fromPreapproval={fromPreapproval}
          />
        )}

        {/* Full results — logged-in users only */}
        {result && isLoggedIn && (
          <div className="fade-in">
            {result._isDemo && (
              <div className="opt-demo-banner">
                This is sample data — <button onClick={handleReset}>upload your own statement</button> to see your real numbers.
              </div>
            )}

            {fromPreapproval && !result._isDemo && (
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'12px 16px', marginBottom:12, background:'rgba(200,168,75,0.07)', border:'1px solid rgba(200,168,75,0.3)', borderRadius:8, fontSize:'0.875rem' }}>
                <span style={{ fontSize:'1rem', flexShrink:0 }}>📈</span>
                <div>
                  <strong>Your personalised improvement plan</strong>
                  <span style={{ color:'var(--text-secondary)' }}> — based on the statement you just uploaded. Work through the actions below to increase your bond qualification.</span>
                </div>
              </div>
            )}

            {/* 3-month upload nudge */}
            {!result._isDemo && (result.statementMonths || 1) === 1 && (
              <div style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'11px 14px', marginBottom:12, background:'#fffbeb', border:'1px solid #fcd34d', borderRadius:8, fontSize:'0.875rem' }}>
                <span style={{ fontSize:'1rem', flexShrink:0 }}>📅</span>
                <div>
                  <strong style={{ color:'#92400e' }}>Only 1 month detected</strong>
                  <span style={{ color:'#78350f' }}> — upload 3 months for higher income confidence, a better readiness score, and results banks will find more convincing.</span>
                </div>
              </div>
            )}

            {/* Savings account warning */}
            {result.isSavingsAccount && !result._isDemo && (
              <div className="opt-savings-warning">
                <strong>Heads up: this looks like a savings account.</strong>{' '}
                Your salary likely lands in a separate cheque or transaction account. Upload that statement instead to get an accurate income detection and bond qualification. You can still enter your income manually below.
              </div>
            )}

            {/* Income-not-detected callout */}
            {!result.income?.detected && !result._isDemo && (
              <div className="opt-income-notice">
                <strong>Salary not found in this statement.</strong>{' '}
                {result.accountBalance != null
                  ? `We found an account balance of ${fmt(result.accountBalance)}. `
                  : ''}
                Enter your monthly take-home below to unlock your bond qualification and spending analysis.
              </div>
            )}

            {/* Summary strip */}
            <div className="opt-summary-strip">
              <div className="opt-summary-strip__item">
                <div className="opt-summary-strip__label">Monthly income</div>
                <IncomeField
                  income={income}
                  detected={result.income?.detected ?? false}
                  confidence={result.income?.confidence}
                  occurrences={result.income?.occurrences}
                  onOverride={handleIncomeOverride}
                  recalculating={recalculating}
                />
              </div>
              <div className="opt-summary-strip__item">
                <div className="opt-summary-strip__label">Monthly expenses</div>
                <div className="opt-summary-strip__val">{fmt(result.expenses?.total || 0)}</div>
              </div>
              {(result.debts?.totalMonthly || 0) > 0 && (
                <div className="opt-summary-strip__item">
                  <div className="opt-summary-strip__label">Monthly debt</div>
                  <div className="opt-summary-strip__val">{fmt(result.debts.totalMonthly)}</div>
                </div>
              )}
              <div className="opt-summary-strip__item">
                <div className="opt-summary-strip__label">Readiness score</div>
                <div className="opt-summary-strip__val" style={{ color: SCORE_KEY.color(result.readiness?.score ?? 0) }}>
                  {result.readiness?.score ?? '—'}/100
                  {result.readiness?.label && (
                    <span className="opt-summary-strip__score-label"> · {result.readiness.label}</span>
                  )}
                </div>
              </div>
              <div className="opt-summary-strip__item">
                <div className="opt-summary-strip__label">Max bond estimate</div>
                <div className="opt-summary-strip__val">{baseline > 0 ? fmt(baseline) : '—'}</div>
              </div>
              {baseline > 0 && canApply && (
                <div className="opt-summary-strip__item" style={{ gridColumn: '1 / -1' }}>
                  <PropertySearchCTA maxBond={baseline} compact defaultExpanded />
                </div>
              )}
              {result.accountBalance != null && (
                <div className="opt-summary-strip__item opt-summary-strip__item--secondary">
                  <div className="opt-summary-strip__label">Account balance</div>
                  <div className="opt-summary-strip__val">{fmt(result.accountBalance)}</div>
                </div>
              )}
              <div className="opt-summary-strip__actions">
                <button className="opt-summary-strip__reset" onClick={handleReset}>↩ New statement</button>
              </div>
            </div>

            {/* Expenses > income warning */}
            {income > 0 && (result.expenses?.total || 0) > income * 1.2 && !result._isDemo && (
              <div className="opt-expense-warning">
                <strong>Income looks too low.</strong>{' '}
                {result.isSavingsAccount
                  ? 'This savings account only shows part of your financial picture. Upload your main transaction account (where your salary lands) for accurate results — or click the edit icon next to "Monthly income" above to enter your real income.'
                  : `We detected ${fmt(income)}/mo income but ${fmt(result.expenses.total)}/mo in expenses. This often happens when the statement includes transfers or one-off payments. The breakdown below shows what we found — click the edit icon next to "Monthly income" above if your income is higher.`
                }
              </div>
            )}

            {/* ── Spending vs peers ── */}
            {benchmarkEntries.length > 0 && (
              <section className="opt-section">
                <h2 className="opt-section__title">Your spending vs SA peers</h2>
                <p className="opt-section__sub">
                  Comparing you to similar {bm[benchmarkEntries[0]?.[0]]?.bracketLabel || 'earners'}.
                </p>
                <details className="opt-peer-note">
                  <summary>How peer numbers work — and what they don't account for</summary>
                  <p>
                    Peer benchmarks come from StatsSA's Living Conditions Survey
                    + SA bank affordability data, grouped only by <strong>income bracket</strong>.
                    They assume an average household shape — usually car-owning,
                    medical-aid-using, mid-density suburbia.
                  </p>
                  <p>
                    If your lifestyle is different — taxi-commuting instead of
                    driving, public-transport instead of fuel, larger family,
                    rural area, no medical aid — your "above peers" or "below
                    peers" numbers won't be apples-to-apples. They're a useful
                    starting point, not a verdict on whether you're spending
                    "wrong".
                  </p>
                </details>

                {/* Warn when the numbers don't add up to a realistic lifestyle.
                    Three signals to surface:
                      • significant uncategorised spending ("other")
                      • groceries way below the peer benchmark
                      • significant cash withdrawals that probably ARE the
                        missing groceries / dining / household pocket money */}
                {(() => {
                  const months   = Math.max(1, result.statementMonths || 1);
                  const otherAmt = Math.round((result.expenses?.breakdown?.other || 0) / months);
                  const grocAmt  = bm.groceries?.userAmount || 0;
                  const grocPeer = bm.groceries?.peerAmount || 0;
                  const cashHint = result.expenses?.cashSpendingHint?.monthly || 0;
                  const grocLow  = grocPeer > 0 && grocAmt < grocPeer * 0.30;

                  const messages = [];
                  if (otherAmt > 500) {
                    messages.push(
                      <li key="other"><strong>R {otherAmt.toLocaleString('en-ZA')}/mo wasn't matched to a category.</strong> Shown as "Uncategorised" below — may include groceries, dining or other everyday spend.</li>
                    );
                  }
                  if (cashHint >= 500) {
                    messages.push(
                      <li key="cash"><strong>R {cashHint.toLocaleString('en-ZA')}/mo in cash withdrawals.</strong> Cash spent in stores like Pick n Pay, Spar or Checkers will show up as groceries in your bank statement only if you tap your card. Cash purchases stay invisible to this view.</li>
                    );
                  }
                  if (grocLow && cashHint < 500) {
                    messages.push(
                      <li key="groc"><strong>Groceries below typical for your income.</strong> Are you shopping on a different card or account? Upload that statement to get a complete picture.</li>
                    );
                  }
                  if (messages.length === 0) return null;
                  return (
                    <div style={{ display:'flex', gap:10, padding:'11px 14px', marginBottom:14, background:'#fef3c7', border:'1px solid #fcd34d', borderRadius:8, fontSize:'0.875rem', alignItems:'flex-start' }}>
                      <span style={{ flexShrink:0, fontSize:'1rem' }}>⚠️</span>
                      <ul style={{ color:'#78350f', margin:0, paddingLeft:18, lineHeight:1.5 }}>{messages}</ul>
                    </div>
                  );
                })()}

                <div className="opt-spend-list">
                  {displayedBenchmarks.map(([cat, data]) => (
                    <SpendBar
                      key={cat}
                      label={CAT_META[cat]?.label || cat}
                      Icon={CAT_META[cat]?.icon || Package}
                      userAmt={data.userAmount}
                      peerAmt={data.peerAmount}
                      overSpend={data.overSpend}
                      overSpendPct={data.overSpendPct}
                    />
                  ))}

                  {/* Show "other/uncategorised" if significant */}
                  {(() => {
                    const otherAmt = Math.round((result.expenses?.breakdown?.other || 0) / Math.max(1, result.statementMonths || 1));
                    if (otherAmt < 300) return null;
                    return (
                      <SpendBar
                        label="Uncategorised spending"
                        Icon={Package}
                        userAmt={otherAmt}
                        peerAmt={0}
                        overSpend={false}
                        overSpendPct={0}
                        note="Transactions we couldn't match to a category — may include groceries, dining, and other everyday expenses"
                      />
                    );
                  })()}

                  {benchmarkEntries.length > 5 && (
                    <button className="opt-show-more" onClick={() => setShowAllBenchmarks(s => !s)}>
                      {showAllBenchmarks
                        ? <><ChevronUp size={14} /> Show less</>
                        : <><ChevronDown size={14} /> Show all {benchmarkEntries.length} categories</>}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* ── Phase 17: Bond-readiness gap closer ────────────────────── */}
            {result?.bondGap && (result.bondGap.actions || []).length > 0 && (
              <section className="opt-section">
                <h2 className="opt-section__title">Close the gap to your next bond</h2>
                <p className="opt-section__sub">
                  Ranked by how much extra bond capacity each action unlocks. Best impact first.
                </p>
                <ul className="opt-actions">
                  {result.bondGap.actions.slice(0, 6).map((a, i) => (
                    <li key={i} className="opt-action">
                      <div className="opt-action__head">
                        <span className="opt-action__label">{a.label}</span>
                        <span className="opt-action__impact">
                          +{fmt(a.bondUnlock)} bond &middot; saves {fmt(a.monthlySaving)}/mo
                        </span>
                      </div>
                      <p className="opt-action__reason">{a.reason}</p>
                      <div className="opt-action__meta">
                        <span className="opt-action__effort" title="Effort 1-5 (lower is easier)">Effort {a.effort}/5</span>
                        {a.cancelUrl && (
                          <a className="opt-action__link" href={a.cancelUrl} target="_blank" rel="noopener noreferrer">
                            Cancel page →
                          </a>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Phase 19: Spending leaks (overspending by category) ───── */}
            {(result?.spendingLeaks || []).length > 0 && (
              <section className="opt-section">
                <h2 className="opt-section__title">Where you are overspending</h2>
                <p className="opt-section__sub">
                  Categories where you spend more than 1.5× the SA peer median for your income. The biggest excess shown first.
                </p>
                <ul className="opt-leaks">
                  {result.spendingLeaks.slice(0, 5).map((l, i) => (
                    <li key={i} className="opt-leak">
                      <div className="opt-leak__head">
                        <strong className="opt-leak__cat">{CAT_META[l.category]?.label || l.category}</strong>
                        <span className="opt-leak__nums">
                          {fmt(l.userMonthly)}/mo &middot; vs peer {fmt(l.peerMonthly)} &middot; +{l.overspendPct}%
                        </span>
                      </div>
                      <p className="opt-leak__suggestion">{l.suggestion}</p>
                      {(l.topTxns || []).length > 0 && (
                        <ul className="opt-leak__txns">
                          {l.topTxns.map((t, j) => (
                            <li key={j} className="opt-leak__txn">
                              <span>{t.description}</span>
                              <strong>{fmt(t.amount)}</strong>
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Phase 18: Subscription audit ──────────────────────────── */}
            {result?.subscriptionAudit && (result.subscriptionAudit.items || []).length > 0 && (
              <section className="opt-section">
                <h2 className="opt-section__title">Subscriptions on your statement</h2>
                <p className="opt-section__sub">
                  Every recurring monthly debit we detected — known services + anything else
                  charging you every month. Total: <strong>{fmt(result.subscriptionAudit.total)}/mo</strong>.
                </p>
                <ul className="opt-subs">
                  {result.subscriptionAudit.items.slice(0, 12).map((s, i) => (
                    <li key={i} className="opt-sub">
                      <div className="opt-sub__head">
                        <strong>{s.payee}</strong>
                        <span>{fmt(s.monthlyAmount)}/mo</span>
                      </div>
                      <div className="opt-sub__meta">
                        Seen {s.months} months
                        {s.knownService ? ' · recognised service' : ' · unrecognised payee — confirm before cancelling'}
                        {s.cancelUrl && (
                          <>
                            {' · '}
                            <a href={s.cancelUrl} target="_blank" rel="noopener noreferrer">cancel page →</a>
                          </>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {/* ── Complete spending picture (every category, not just lifestyle) ── */}
            {result?.fullSpendingBreakdown && result.fullSpendingBreakdown.totalPerMonth > 0 && (
              <section className="opt-section">
                <h2 className="opt-section__title">Where your money actually goes</h2>
                <p className="opt-section__sub">
                  Your full monthly outflow — {fmt(result.fullSpendingBreakdown.totalPerMonth)}/mo across every category we identified.
                  The peer comparison above only shows lifestyle; this is everything.
                </p>
                <div className="opt-full-spend">
                  {[
                    { key: 'debtObligations', label: 'Debt obligations',     hint: 'Bond, vehicle finance, credit card, personal loans' },
                    { key: 'essential',       label: 'Essential payments',   hint: 'Medical, education, school fees, childcare, SARS' },
                    { key: 'sensitive',       label: 'Affordability-flagged', hint: 'Gambling, crypto — these affect bank decisions' },
                    { key: 'transfers',       label: 'Transfers & savings',   hint: 'Internal, peer, savings vehicles' },
                    { key: 'banking',         label: 'Banking',               hint: 'ATM withdrawals, bank fees' },
                    { key: 'other',           label: 'Other',                 hint: 'Categories we recognised but don\'t fit a fixed bucket' },
                  ].map(({ key, label, hint }) => {
                    const bucket = result.fullSpendingBreakdown.sections[key] || {};
                    const entries = Object.entries(bucket).sort((a, b) => b[1] - a[1]);
                    if (entries.length === 0) return null;
                    const subtotal = entries.reduce((s, [, v]) => s + v, 0);
                    const isSensitive = key === 'sensitive';
                    return (
                      <div key={key} className={`opt-full-spend__group ${isSensitive ? 'opt-full-spend__group--sensitive' : ''}`}>
                        <div className="opt-full-spend__group-head">
                          <span className="opt-full-spend__group-label">{label}</span>
                          <span className="opt-full-spend__group-total">{fmt(subtotal)}/mo</span>
                        </div>
                        <div className="opt-full-spend__group-hint">{hint}</div>
                        <div className="opt-full-spend__rows">
                          {entries.map(([cat, amt]) => (
                            <div key={cat} className="opt-full-spend__row">
                              <span className="opt-full-spend__row-cat">{CAT_META[cat]?.label || cat.replace(/_/g, ' ')}</span>
                              <span className="opt-full-spend__row-amt">{fmt(amt)}/mo</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── What-if simulator ── */}
            {income > 0 && benchmarkEntries.length > 0 && (
              <section className="opt-section">
                <div className="opt-section__head-row">
                  <h2 className="opt-section__title">What if you spent less?</h2>
                  <div className="opt-section__actions">
                    <button
                      type="button"
                      className="opt-suggest-btn"
                      onClick={() => {
                        const next = {};
                        for (const [cat, data] of benchmarkEntries) {
                          const pct = SMART_CUTS_PCT[cat];
                          if (pct != null && data?.userAmount > 0) {
                            next[cat] = Math.round(data.userAmount * (1 - pct / 100));
                          }
                        }
                        setAdjustments(prev => ({ ...prev, ...next }));
                      }}
                    >
                      Suggest cuts
                    </button>
                    {Object.keys(adjustments).length > 0 && (
                      <button
                        type="button"
                        className="opt-reset-btn"
                        onClick={() => setAdjustments({})}
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>
                <p className="opt-section__sub">
                  Move sliders to see your bond change. Gambling and crypto purchases are flagged because they materially affect affordability decisions.
                </p>
                <div className="opt-whatif-box">
                  <div className="opt-whatif-box__bond">
                    <div className="opt-whatif-box__bond-label">Projected max bond</div>
                    <div className={`opt-whatif-box__bond-val ${projectedBond > baseline ? 'opt-whatif-box__bond-val--up' : ''}`}>
                      {fmt(projectedBond)}
                    </div>
                    {totalSavingFromSliders > 0 && (
                      <div className="opt-whatif-box__bond-delta">
                        <TrendingUp size={14} /> +{fmt(Math.round(totalSavingFromSliders * STRESS_PV))} from {fmt(baseline)} baseline
                      </div>
                    )}
                  </div>
                  <div className="opt-slider-list">
                    {benchmarkEntries.map(([cat, data]) => (
                      <WhatIfSlider
                        key={cat}
                        cat={cat}
                        label={CAT_META[cat]?.label || cat}
                        Icon={CAT_META[cat]?.icon || Package}
                        current={data.userAmount}
                        peer={adjustments[cat] ?? data.peerAmount}
                        sensitive={SENSITIVE_CATS.has(cat)}
                        onChange={handleAdjust}
                      />
                    ))}
                  </div>
                  {totalSavingFromSliders > 0 && (
                    <div className="opt-whatif-box__summary">
                      You'd free up <strong>{fmt(totalSavingFromSliders)}/month</strong>
                      {' '}({fmt(totalSavingFromSliders * 12)}/year) by cutting these categories
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* ── Action plan ── */}
            {optimizations.length > 0 && (
              <section className="opt-section">
                <h2 className="opt-section__title">Your personalised action plan</h2>
                <p className="opt-section__sub">Ranked by impact — tackle the top ones first.</p>
                <div className="opt-action-list">
                  {displayedOpts.map((opt, i) => (
                    <div key={i} className={`opt-action-card opt-action-card--${opt.priority}`}>
                      <div className="opt-action-card__rank" style={{ background: PRIORITY_COLOR[opt.priority] || '#6b7280' }}>
                        {i + 1}
                      </div>
                      <div className="opt-action-card__body">
                        <div className="opt-action-card__title">
                          {opt.icon && <span>{opt.icon}</span>} {opt.title}
                        </div>
                        <div className="opt-action-card__desc">{opt.description}</div>
                        {opt.loanImpact > 0 && (
                          <div className="opt-action-card__impact">
                            <TrendingUp size={13} /> Bond impact: +{fmt(opt.loanImpact)}
                          </div>
                        )}
                        {opt.monthlySaving > 0 && (
                          <div className="opt-action-card__saving">Frees up {fmt(opt.monthlySaving)}/month</div>
                        )}
                      </div>
                    </div>
                  ))}
                  {optimizations.length > 3 && (
                    <button className="opt-show-more" onClick={() => setShowAllOpts(s => !s)}>
                      {showAllOpts
                        ? <><ChevronUp size={14} /> Show fewer</>
                        : <><ChevronDown size={14} /> Show all {optimizations.length} recommendations</>}
                    </button>
                  )}
                </div>
              </section>
            )}

            {/* ── Goal panel ── */}
            {!result._isDemo && (
              <GoalPanel
                snapshot={result}
                goal={goal}
                onSaved={g => setGoal(g)}
                onDeleted={() => setGoal(null)}
              />
            )}

            {/* ── Month-over-month progress ── */}
            {!result._isDemo && <ProgressSection progress={progress} />}

            {/* ── Commit to actions ── */}
            {!result._isDemo && optimizations.length > 0 && (
              <CommitPanel
                snapshot={result}
                existingCommitments={commitments}
                onCommitted={() =>
                  financialFitness.getCommitments().then(d => setCommitments(d.commitments || [])).catch(() => {})
                }
              />
            )}

            {/* ── Pay off faster ── */}
            {!result._isDemo && (
              <PayOffFasterPanel snapshot={result} />
            )}

            {/* ── Bond history — hide while showing demo so real data doesn't leak below sample ── */}
            {allSnapshots.length >= 2 && !result._isDemo && (
              <SnapshotHistory snapshots={allSnapshots} />
            )}

            {/* ── CTA ── */}
            <div className="opt-cta-box">
              <h3 className="opt-cta-box__title">
                {result._isDemo ? 'Ready to see your real numbers?'
                  : canApply ? 'Ready to apply?'
                  : income > 0 ? 'Keep building your profile'
                  : 'Get your full picture'}
              </h3>
              <p className="opt-cta-box__sub">
                {result._isDemo
                  ? 'Upload your own bank statement to get a personalised breakdown and your actual bond qualification.'
                  : canApply
                    ? 'Submit your finalised financial picture for a bond review — our broker team takes your application to lenders and follows up with you within 48 hours.'
                  : income > 0
                    ? `Your current max bond estimate of ${fmt(baseline)} is below typical property prices. Work through the action plan above to improve your qualification.`
                    : 'Enter your monthly take-home income above to unlock your bond qualification estimate.'}
              </p>
              <div className="opt-cta-box__btns">
                {result._isDemo ? (
                  <button className="btn btn--lime" onClick={handleReset}>Upload my statement →</button>
                ) : canApply ? (
                  <>
                    <button className="btn btn--lime" onClick={() => {
                      try { sessionStorage.setItem('bondly_stmt_result', JSON.stringify(result)); } catch {}
                      navigate('/preapproval');
                    }}>
                      Get pre-approved free →
                    </button>
                    <button className="btn btn--ghost" onClick={handleReset}>
                      Upload next month's statement
                    </button>
                  </>
                ) : (
                  <button className="btn btn--ghost" onClick={handleReset}>
                    Upload next month's statement
                  </button>
                )}
              </div>
              {!result._isDemo && canApply && (
                <div className="opt-cta-box__track-note">
                  Your results are saved. Re-upload next month to track your progress.
                </div>
              )}
            </div>

          {/* Accuracy rating */}
          {isLoggedIn && savedSnapshotId && !result?._isDemo && (
            <div style={{ marginTop: 20, padding: '14px 16px', background: 'var(--bg-secondary)', borderRadius: 10, textAlign: 'center' }}>
              {!accuracyRating ? (
                <>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 10 }}>How accurate does this analysis look?</div>
                  <div style={{ display: 'flex', gap: 8, justifyContent: 'center', flexWrap: 'wrap' }}>
                    {[['accurate','Looks right ✓','#16a34a'],['some_issues','Some issues','#d97706'],['not_accurate','Way off','#dc2626']].map(([val, label, color]) => (
                      <button key={val}
                        onClick={async () => {
                          try {
                            await financialFitness.rateAccuracy(savedSnapshotId, val);
                            setAccuracyRating(val);
                          } catch {}
                        }}
                        style={{ padding: '6px 14px', borderRadius: 20, border: '1.5px solid ' + color, background: 'transparent', color, fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 500 }}
                      >{label}</button>
                    ))}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                  {accuracyRating === 'accurate' ? 'Thanks — glad it looks right!' : accuracyRating === 'some_issues' ? 'Thanks for flagging — we will look into it.' : 'Thanks for letting us know — we have flagged this for review.'}
                </div>
              )}
            </div>
          )}

          </div>
        )}
      </div>
    </div>
  );
}
