import { useState, useEffect, useRef, useCallback } from 'react';
import { useReadinessScore, useSpendingAnalysis } from './hooks/useFinanceQueries.js';
import { fmt } from '../../lib/format.js';
import { calcAffordability } from '../../lib/finance.js';
import { PRIME_RATE } from '../../lib/constants.js';
import { myIntelligence } from '../../lib/api.js';
import './ReadinessScoreTab.css';

const GRADE_COLOR = { A: '#22c55e', B: '#84cc16', C: '#eab308', D: '#f97316', E: '#ef4444' };
const GRADE_BG    = { A: 'rgba(34,197,94,.12)', B: 'rgba(132,204,22,.12)', C: 'rgba(234,179,8,.12)', D: 'rgba(249,115,22,.12)', E: 'rgba(239,68,68,.12)' };

// Animated count-up hook
function useCountUp(target, duration = 900, enabled = true) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    if (!enabled || target == null) return;
    let start = null;
    const from = 0;
    const step = ts => {
      if (!start) start = ts;
      const pct = Math.min(1, (ts - start) / duration);
      const ease = 1 - Math.pow(1 - pct, 3);
      setVal(Math.round(from + (target - from) * ease));
      if (pct < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }, [target, enabled]);
  return val;
}

// SVG score ring with 6 arc segments
function ScoreRing({ score, grade, components }) {
  const R = 80, CX = 96, CY = 96, SW = 12;
  const circ = 2 * Math.PI * R;
  // Arc spans 270° starting from bottom-left (offset = 135° from top)
  const ARC = 270;
  const arcLen = (circ * ARC) / 360;
  const gap = circ - arcLen;

  // Rotation so arc starts at bottom-left
  const rotate = 135;

  const totalMax = 300 + 200 + 200 + 150 + 100 + 50; // 1000
  const componentOrder = ['affordability', 'incomeStability', 'cashFlow', 'spendingRisk', 'debtLoad', 'savingsBehaviour'];
  const segColors = ['#6366f1', '#22c55e', '#06b6d4', '#f59e0b', '#8b5cf6', '#ec4899'];

  // Each segment = its share of the 270° arc
  const segments = componentOrder.map((key, i) => {
    const c = components[key];
    const segArc = (c.max / totalMax) * ARC;
    const fillArc = (c.score / totalMax) * ARC;
    return { key, color: segColors[i], segArc, fillArc, max: c.max, score: c.score };
  });

  // Build arc dash segments
  let accumulated = 0;
  const arcs = segments.map(seg => {
    const startAngle = accumulated;
    accumulated += seg.segArc;
    const startOffset = -(arcLen * (startAngle / ARC)) + gap / 2;
    const fillLen = arcLen * (seg.fillArc / ARC);
    return { ...seg, startOffset, fillLen };
  });

  const fillFraction = score / 1000;
  const fillLen = arcLen * fillFraction;

  return (
    <svg width="192" height="192" viewBox="0 0 192 192" className="rsc-ring">
      {/* Track */}
      <circle cx={CX} cy={CY} r={R} fill="none"
        stroke="var(--color-surface-2)" strokeWidth={SW}
        strokeDasharray={`${arcLen} ${gap}`}
        strokeDashoffset={gap / 2}
        transform={`rotate(${rotate} ${CX} ${CY})`}
        strokeLinecap="round"
      />
      {/* Fill — single arc coloured by grade */}
      <circle cx={CX} cy={CY} r={R} fill="none"
        stroke={GRADE_COLOR[grade]}
        strokeWidth={SW}
        strokeDasharray={`${fillLen} ${circ - fillLen}`}
        strokeDashoffset={gap / 2}
        transform={`rotate(${rotate} ${CX} ${CY})`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.34,1.56,.64,1)', filter: `drop-shadow(0 0 6px ${GRADE_COLOR[grade]}55)` }}
      />
      {/* Centre text */}
      <text x={CX} y={CY - 10} textAnchor="middle" fontSize="28" fontWeight="900" fill={GRADE_COLOR[grade]} fontFamily="inherit">
        {score}
      </text>
      <text x={CX} y={CY + 14} textAnchor="middle" fontSize="13" fontWeight="700" fill={GRADE_COLOR[grade]} fontFamily="inherit">
        {grade}
      </text>
      <text x={CX} y={CY + 30} textAnchor="middle" fontSize="10" fill="var(--color-text-muted)" fontFamily="inherit">
        out of 1000
      </text>
    </svg>
  );
}

// Mini horizontal progress bar for each component
function ComponentBar({ score, max, color }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="rsc-comp__bar-track">
      <div className="rsc-comp__bar-fill"
        style={{ width: `${pct}%`, background: pct >= 70 ? '#22c55e' : pct >= 40 ? '#eab308' : '#ef4444' }}
      />
    </div>
  );
}

// ── Improvement simulator ────────────────────────────────────────────────────
// Pulls real per-category spend from finances.spendingAnalysis() so the user
// can simulate cuts on the categories THEY actually spend in — not a single
// abstract "discretionary" slider. Falls back to the original simple slider
// when the spending API has no data (no statement uploaded yet).

// Categories users have real flexibility on, in default cut-suggestion order.
const CUTTABLE_CATEGORIES = [
  'gambling',
  'crypto_investment',
  'entertainment',
  'dining_out',
  'subscriptions',
  'other',
];
// Smart-suggestion default reduction per category (%).
const SMART_CUTS = {
  gambling:          100,
  subscriptions:      40,
  dining_out:         30,
  entertainment:      25,
  crypto_investment:  50,
  other:              20,
};
// Human-readable labels for the category list.
const CAT_LABEL = {
  gambling:           'Gambling',
  crypto_investment:  'Crypto purchases',
  entertainment:      'Entertainment',
  dining_out:         'Dining out',
  subscriptions:      'Subscriptions',
  other:              'Other / shopping',
};
// Sensitive categories get a warning highlight in the UI.
const SENSITIVE = new Set(['gambling', 'crypto_investment']);

function ImprovementSimulator({ data, categories = [] }) {
  const [extraSavings,  setExtraSavings]  = useState(0);
  const [extraDebt,     setExtraDebt]     = useState(0);
  const [addStatements, setAddStatements] = useState(false);
  const [cuts,          setCuts]          = useState({});  // { categoryName: reductionPercent }

  if (!data) return null;

  const income   = data.monthlyIncome || 0;
  const baseScore = data.score;
  const baseBond  = data.availableBond || 0;

  // Sort cuttable categories by current spend (descending) so the user sees
  // the biggest impact first. Skip categories with no spend.
  const cuttableRows = CUTTABLE_CATEGORIES
    .map(key => {
      const found = categories.find(c => (c.category || '').toLowerCase() === key);
      return found ? { key, amount: Number(found.amount) || 0 } : null;
    })
    .filter(r => r && r.amount > 0)
    .sort((a, b) => b.amount - a.amount);

  const hasCategoryData = cuttableRows.length > 0;

  // Total monthly Rand savings from the per-category sliders.
  const totalCutSavings = cuttableRows.reduce((sum, row) => {
    const pct = cuts[row.key] || 0;
    return sum + row.amount * (pct / 100);
  }, 0);

  // ── Impact model (kept consistent with the previous version) ──────────────
  // Cuts behave like extra savings (the freed-up money services more bond).
  // savingsImpact and cutSavingsImpact use the same formula, just summed.
  const effectiveExtraSavings = extraSavings + totalCutSavings;
  const savingsImpact = Math.round((effectiveExtraSavings / Math.max(1, income)) * 100 * 2.5);
  const debtImpact    = Math.round((extraDebt           / Math.max(1, income)) * 80);
  const stmtImpact    = addStatements ? 55 : 0;

  const totalImpact = Math.min(250, savingsImpact + debtImpact + stmtImpact);
  const newScore    = Math.min(1000, baseScore + totalImpact);
  const newGrade    = newScore >= 850 ? 'A' : newScore >= 700 ? 'B' : newScore >= 550 ? 'C' : newScore >= 400 ? 'D' : 'E';

  const newBond     = Math.round(baseBond * (1 + totalImpact / 1200));
  const bondDelta   = newBond - baseBond;

  const READY = 750;
  const monthsSaved = totalImpact > 0 && baseScore < READY
    ? Math.max(0, Math.round((READY - baseScore) / 8) - Math.round((READY - newScore) / 8))
    : 0;

  const hasImpact = totalImpact > 0;

  // Apply the smart-cut preset to whatever categories the user actually has.
  function applySmartSuggestion() {
    const next = {};
    for (const row of cuttableRows) {
      next[row.key] = SMART_CUTS[row.key] || 0;
    }
    setCuts(next);
  }
  function resetCuts() { setCuts({}); }

  return (
    <div className="rsc-sim">
      <div className="rsc-sim__title">What if you spent less?</div>
      <div className="rsc-sim__subtitle">
        {hasCategoryData
          ? 'Move any slider to see how cutting real spend changes your readiness and how much you could borrow'
          : 'Upload a bank statement to simulate per-category cuts'}
      </div>

      {/* ── Section A: per-category spending cuts (NEW) ─────────────────── */}
      {hasCategoryData && (
        <div className="rsc-sim__section">
          <div className="rsc-sim__section-head">
            <span className="rsc-sim__section-title">Cut spending by category</span>
            <div className="rsc-sim__section-actions">
              <button type="button" className="rsc-sim__suggest-btn" onClick={applySmartSuggestion}>
                Suggest cuts
              </button>
              {Object.values(cuts).some(v => v > 0) && (
                <button type="button" className="rsc-sim__reset-btn" onClick={resetCuts}>Reset</button>
              )}
            </div>
          </div>

          <div className="rsc-sim__cat-list">
            {cuttableRows.map(row => {
              const pct       = cuts[row.key] || 0;
              const savedRand = Math.round(row.amount * (pct / 100));
              const label     = CAT_LABEL[row.key] || row.key;
              const sens      = SENSITIVE.has(row.key);
              return (
                <div key={row.key} className={`rsc-sim__cat-row ${sens ? 'rsc-sim__cat-row--sensitive' : ''}`}>
                  <div className="rsc-sim__cat-head">
                    <span className="rsc-sim__cat-name">
                      {label}
                      {sens && <span className="rsc-sim__cat-flag">flagged</span>}
                    </span>
                    <span className="rsc-sim__cat-amt">
                      {fmt(row.amount)}
                      <span className="rsc-sim__cat-arrow">→</span>
                      <strong>{fmt(row.amount - savedRand)}</strong>
                    </span>
                  </div>
                  <div className="rsc-sim__cat-controls">
                    <input
                      type="range" min="0" max="100" step="5"
                      value={pct}
                      onChange={e => setCuts({ ...cuts, [row.key]: +e.target.value })}
                      className="rsc-sim__slider"
                    />
                    <span className="rsc-sim__cat-pct">−{pct}%</span>
                  </div>
                </div>
              );
            })}
          </div>

          {totalCutSavings > 0 && (
            <div className="rsc-sim__cat-summary">
              You'd free up <strong>{fmt(totalCutSavings)}/month</strong>
              {' '}({fmt(totalCutSavings * 12)}/year) by cutting these categories
            </div>
          )}
        </div>
      )}

      {/* ── Section B: extra savings + extra debt payment ──────────────── */}
      <div className="rsc-sim__section">
        <div className="rsc-sim__section-head">
          <span className="rsc-sim__section-title">Save & pay down</span>
        </div>
        <div className="rsc-sim__controls">
          <div className="rsc-sim__row">
            <div className="rsc-sim__label">
              <span>Extra savings per month</span>
              <strong>{fmt(extraSavings)}</strong>
            </div>
            <input type="range" min="0" max="10000" step="250"
              value={extraSavings} onChange={e => setExtraSavings(+e.target.value)}
              className="rsc-sim__slider" />
          </div>

          <div className="rsc-sim__row">
            <div className="rsc-sim__label">
              <span>Extra debt payment</span>
              <strong>{fmt(extraDebt)}</strong>
            </div>
            <input type="range" min="0" max="10000" step="250"
              value={extraDebt} onChange={e => setExtraDebt(+e.target.value)}
              className="rsc-sim__slider" />
          </div>

          <label className="rsc-sim__toggle">
            <input type="checkbox" checked={addStatements} onChange={e => setAddStatements(e.target.checked)} />
            <span>Upload 2 more months of statements</span>
            <span className="rsc-sim__toggle-badge">+55 pts</span>
          </label>
        </div>
      </div>

      {hasImpact ? (
        <div className="rsc-sim__impact">
          <div className="rsc-sim__impact-row">
            <span>Readiness score</span>
            <span>
              <s style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>{baseScore}</s>
              {' → '}
              <strong style={{ color: GRADE_COLOR[newGrade] }}>{newScore}</strong>
              <span className="rsc-sim__impact-badge" style={{ background: GRADE_BG[newGrade], color: GRADE_COLOR[newGrade] }}> +{totalImpact}</span>
            </span>
          </div>
          {bondDelta > 0 && (
            <div className="rsc-sim__impact-row">
              <span>How much you could borrow</span>
              <span><s style={{ color: 'var(--color-text-muted)', fontWeight: 400 }}>{fmt(baseBond)}</s>{' → '}<strong>{fmt(newBond)}</strong> <span className="rsc-sim__impact-badge rsc-sim__impact-badge--green">+{fmt(bondDelta)}</span></span>
            </div>
          )}
          {monthsSaved > 0 && (
            <div className="rsc-sim__impact-row">
              <span>Mortgage-ready</span>
              <span><strong>{monthsSaved} month{monthsSaved !== 1 ? 's' : ''} sooner</strong></span>
            </div>
          )}
        </div>
      ) : (
        <div className="rsc-sim__idle">Move any slider to see the impact on your score and how much you could borrow</div>
      )}
    </div>
  );
}

// Timeline chart (SVG)
function TimelineChart({ timeline, score }) {
  if (!timeline) return null;
  const W = 280, H = 64;
  const READY = timeline.readyThreshold || 750;

  // Draw two projected lines from current score to READY
  const currentM = 0;
  const baseM    = score >= READY ? 0 : Math.ceil((READY - score) / 8);
  const optM     = score >= READY ? 0 : Math.max(1, Math.ceil(baseM * 0.55));
  const totalM   = Math.max(baseM, 12);

  const xFor = m => (m / totalM) * W;
  const yFor = s => H - ((Math.min(s, READY + 50) - Math.max(0, score - 50)) / (READY + 50 - Math.max(0, score - 50))) * (H - 8) - 4;

  // Current trajectory points
  const basePts = [[xFor(0), yFor(score)], [xFor(baseM), yFor(READY)]];
  // Optimised trajectory
  const optPts  = [[xFor(0), yFor(score)], [xFor(optM), yFor(READY)]];

  const yReady  = yFor(READY);

  return (
    <div className="rsc-timeline">
      <div className="rsc-timeline__header">
        <span>Timeline to mortgage-ready</span>
        {timeline.monthsSaved > 0 && (
          <span className="rsc-timeline__saved">Save {timeline.monthsSaved} months with your plan</span>
        )}
      </div>
      <svg width="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="rsc-timeline__svg">
        {/* Ready threshold line */}
        <line x1={0} y1={yReady} x2={W} y2={yReady} stroke="var(--color-text-muted)" strokeWidth="1" strokeDasharray="4,3" />
        <text x={W - 2} y={yReady - 3} textAnchor="end" fontSize="7" fill="var(--color-text-muted)" fontFamily="inherit">750 — ready</text>
        {/* Base trajectory */}
        {score < READY && (
          <polyline points={basePts.map(p => p.join(',')).join(' ')}
            fill="none" stroke="var(--color-text-muted)" strokeWidth="1.5" strokeDasharray="4,3" />
        )}
        {/* Optimised trajectory */}
        <polyline points={optPts.map(p => p.join(',')).join(' ')}
          fill="none" stroke="#6366f1" strokeWidth="2" />
        {/* Current score dot */}
        <circle cx={xFor(0)} cy={yFor(score)} r="4" fill="#6366f1" />
        {/* Labels */}
        <text x={xFor(0) + 4} y={yFor(score) - 5} fontSize="8" fill="var(--color-text)" fontFamily="inherit">{score}</text>
      </svg>
      <div className="rsc-timeline__footer">
        <span>Today</span>
        {score < READY ? (
          <>
            <span style={{ color: '#6366f1', fontWeight: 600 }}>{timeline.optimisedReadyDate}</span>
            {timeline.currentReadyDate !== timeline.optimisedReadyDate && (
              <span style={{ color: 'var(--color-text-muted)' }}>{timeline.currentReadyDate} (current path)</span>
            )}
          </>
        ) : (
          <span style={{ color: '#22c55e', fontWeight: 700 }}>Ready now ✓</span>
        )}
      </div>
      {timeline.keyLever && (
        <div className="rsc-timeline__lever">
          <span className="rsc-timeline__lever-dot" />
          {timeline.keyLever}
        </div>
      )}
    </div>
  );
}

function IntelligenceProfileCard() {
  const [profile, setProfile]     = useState(null);
  const [sectors, setSectors]     = useState([]);
  const [geoEdit, setGeoEdit]     = useState(false);
  const [secEdit, setSecEdit]     = useState(false);
  const [town, setTown]           = useState('');
  const [province, setProvince]   = useState('');
  const [sector, setSector]       = useState('');
  const [saving, setSaving]       = useState(null);
  const [saved, setSaved]         = useState(null);

  useEffect(() => {
    myIntelligence.getProfile().then(r => {
      setProfile(r);
      if (r.geoOverride)    { setTown(r.geoOverride.town || ''); setProvince(r.geoOverride.province || ''); }
      if (r.sectorOverride) setSector(r.sectorOverride);
    }).catch(() => {});
    myIntelligence.getSectors().then(r => setSectors(r.sectors || [])).catch(() => {});
  }, []);

  const saveGeo = useCallback(async () => {
    if (!town.trim() || !province.trim()) return;
    setSaving('geo');
    try {
      await myIntelligence.patchGeo(town.trim(), province.trim());
      setProfile(p => ({ ...p, geoOverride: { town: town.trim(), province: province.trim() } }));
      setGeoEdit(false);
      setSaved('geo');
      setTimeout(() => setSaved(null), 2500);
    } catch (e) { /* non-fatal */ }
    setSaving(null);
  }, [town, province]);

  const saveSector = useCallback(async () => {
    if (!sector) return;
    setSaving('sector');
    try {
      await myIntelligence.patchSector(sector);
      setProfile(p => ({ ...p, sectorOverride: sector }));
      setSecEdit(false);
      setSaved('sector');
      setTimeout(() => setSaved(null), 2500);
    } catch (e) { /* non-fatal */ }
    setSaving(null);
  }, [sector]);

  if (!profile) return null;

  const sectorLabel = sectors.find(s => s.value === (profile.sectorOverride || sector))?.label;

  return (
    <div className="rsc-profile-card">
      <div className="rsc-section-title">Your financial profile
        <span className="rsc-profile-card__sub"> — correct if wrong, improves accuracy</span>
      </div>

      <div className="rsc-profile-card__rows">
        {/* Geo row */}
        <div className="rsc-profile-row">
          <span className="rsc-profile-row__label">Home suburb</span>
          {geoEdit ? (
            <div className="rsc-profile-row__edit">
              <input className="rsc-profile-input" placeholder="Town / suburb" value={town} onChange={e => setTown(e.target.value)} />
              <input className="rsc-profile-input" placeholder="Province" value={province} onChange={e => setProvince(e.target.value)} />
              <button className="rsc-profile-btn rsc-profile-btn--save" onClick={saveGeo} disabled={saving === 'geo'}>
                {saving === 'geo' ? '…' : 'Save'}
              </button>
              <button className="rsc-profile-btn" onClick={() => setGeoEdit(false)}>Cancel</button>
            </div>
          ) : (
            <div className="rsc-profile-row__value">
              {profile.geoOverride
                ? <><strong>{profile.geoOverride.town}</strong>, {profile.geoOverride.province} <span className="rsc-profile-tag">corrected</span></>
                : <span className="rsc-profile-inferred">Inferred from transactions</span>}
              {saved === 'geo' && <span className="rsc-profile-tag rsc-profile-tag--saved">✓ Saved</span>}
              <button className="rsc-profile-btn rsc-profile-btn--edit" onClick={() => setGeoEdit(true)}>Edit</button>
            </div>
          )}
        </div>

        {/* Sector row */}
        <div className="rsc-profile-row">
          <span className="rsc-profile-row__label">Employer sector</span>
          {secEdit ? (
            <div className="rsc-profile-row__edit">
              <select className="rsc-profile-select" value={sector} onChange={e => setSector(e.target.value)}>
                <option value="">Select sector…</option>
                {sectors.map(s => <option key={s.value} value={s.value}>{s.label}</option>)}
              </select>
              <button className="rsc-profile-btn rsc-profile-btn--save" onClick={saveSector} disabled={saving === 'sector' || !sector}>
                {saving === 'sector' ? '…' : 'Save'}
              </button>
              <button className="rsc-profile-btn" onClick={() => setSecEdit(false)}>Cancel</button>
            </div>
          ) : (
            <div className="rsc-profile-row__value">
              {profile.sectorOverride
                ? <><strong>{sectorLabel || profile.sectorOverride}</strong> <span className="rsc-profile-tag">corrected</span></>
                : <span className="rsc-profile-inferred">Inferred from transactions</span>}
              {saved === 'sector' && <span className="rsc-profile-tag rsc-profile-tag--saved">✓ Saved</span>}
              <button className="rsc-profile-btn rsc-profile-btn--edit" onClick={() => setSecEdit(true)}>Edit</button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function ReadinessScoreTab() {
  const { data: rawScore, isLoading: scoreLoading, isError: scoreError, refetch: refetchScore } = useReadinessScore();
  const { data: rawSpend, isLoading: spendLoading } = useSpendingAnalysis();
  const [ready, setReady] = useState(false);
  const [expanded, setExpanded] = useState(null);

  const loading = scoreLoading || spendLoading;
  const data = rawScore?.available ? rawScore : null;

  // Normalise spending categories — API returns { rows, anomalies } or legacy array
  const sv = rawSpend;
  const spendCategories = sv
    ? (sv?.categories || sv?.rows || (Array.isArray(sv) ? sv : []))
    : [];

  // Trigger ready state after loading completes (for count-up animation)
  useEffect(() => {
    if (!loading) {
      const t = setTimeout(() => setReady(true), 50);
      return () => clearTimeout(t);
    }
  }, [loading]);

  const animScore = useCountUp(data?.score, 1200, ready && !!data);

  if (loading) return (
    <div className="rsc-skeleton">
      <div className="rsc-skeleton__ring" />
      <div className="rsc-skeleton__rows">
        {[1,2,3].map(i => <div key={i} className="rsc-skeleton__row" style={{ width: `${90 - i * 10}%` }} />)}
      </div>
    </div>
  );
  if (scoreError) return (
    <div style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
      Failed to load readiness score. <button onClick={() => refetchScore()} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
    </div>
  );

  // Guard against broken/default data: if the API returns available:true but the
  // score and bond values are clearly uncomputed (score=0 and bond≤100), treat it
  // the same as no data so users never see "Score: 0 / Grade B / R25".
  const isBrokenData = data && data.score === 0 && (data.availableBond ?? 0) <= 100;

  if (!data || isBrokenData) return (
    <div className="rsc-empty">
      <div className="rsc-empty__icon">📊</div>
      <div className="rsc-empty__title">Upload a bank statement to unlock your readiness score</div>
      <div className="rsc-empty__sub">We analyse your income, spending, savings and debt to generate your personalised 0–1000 score — and show exactly what to improve.</div>
    </div>
  );

  const { score, grade, gradeLabel, delta, components, approvalConfidence, timeline, availableBond } = data;
  const compList = Object.values(components);
  const weakest  = compList.sort((a, b) => (a.score / a.max) - (b.score / b.max))[0];

  return (
    <div className={`rsc ${ready ? 'rsc--ready' : ''}`}>

      {/* Hero */}
      <div className="rsc-hero">
        <ScoreRing score={ready ? score : 0} grade={grade} components={components} />
        <div className="rsc-hero__meta">
          <div className="rsc-hero__grade" style={{ background: GRADE_BG[grade], color: GRADE_COLOR[grade] }}>
            Grade {grade} — {gradeLabel}
          </div>
          {delta !== null && (
            <div className="rsc-hero__delta" style={{ color: delta >= 0 ? '#22c55e' : '#ef4444' }}>
              {delta >= 0 ? '↑' : '↓'} {Math.abs(delta)} pts vs last month
            </div>
          )}
          <div className="rsc-hero__bond">
            <div className="rsc-hero__bond-label">How much you could borrow</div>
            <div className="rsc-hero__bond-val">{fmt(availableBond)}</div>
          </div>
        </div>
      </div>

      {/* Components */}
      <div className="rsc-components">
        <div className="rsc-section-title">Score breakdown</div>
        <div className="rsc-comp-grid">
          {Object.entries(components).map(([key, c]) => {
            const pct = Math.round((c.score / c.max) * 100);
            const isWeak = c === weakest;
            const isOpen = expanded === key;
            return (
              <div key={key}
                className={`rsc-comp ${isWeak ? 'rsc-comp--weak' : ''} ${isOpen ? 'rsc-comp--open' : ''}`}
                onClick={() => setExpanded(isOpen ? null : key)}
              >
                <div className="rsc-comp__top">
                  <span className="rsc-comp__label">{c.label}</span>
                  <span className="rsc-comp__score">{c.score}<span className="rsc-comp__max">/{c.max}</span></span>
                </div>
                <ComponentBar score={c.score} max={c.max} />
                <div className="rsc-comp__detail">{c.detail}</div>
                {isWeak && <div className="rsc-comp__weak-badge">Focus here first</div>}
              </div>
            );
          })}
        </div>
      </div>

      {/* Top reason codes */}
      {data.topReasons?.length > 0 && (
        <div className="rsc-reasons">
          <div className="rsc-section-title">What's affecting your score</div>
          <ul className="rsc-reasons__list">
            {data.topReasons.map((reason, i) => (
              <li key={i} className="rsc-reasons__item">
                <span className="rsc-reasons__dot" />
                {reason}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Improvement simulator */}
      <ImprovementSimulator data={data} categories={spendCategories} />

      {/* Profile correction card */}
      <IntelligenceProfileCard />

      {/* Timeline */}
      <TimelineChart timeline={timeline} score={score} />

      {/* Per-bank approval confidence */}
      <div className="rsc-banks">
        <div className="rsc-section-title">Bank approval confidence</div>
        <div className="rsc-banks__list">
          {Object.values(approvalConfidence).map(b => (
            <div key={b.name} className="rsc-bank-row">
              <span className="rsc-bank-row__name">{b.name}</span>
              <div className="rsc-bank-row__bar-wrap">
                <div className="rsc-bank-row__bar" style={{ width: `${b.conf}%`, background: b.conf >= 70 ? '#22c55e' : b.conf >= 50 ? '#eab308' : '#ef4444' }} />
              </div>
              <span className="rsc-bank-row__conf" style={{ color: b.conf >= 70 ? '#22c55e' : b.conf >= 50 ? '#eab308' : '#ef4444' }}>{b.conf}%</span>
              <span className="rsc-bank-row__rate">{b.rate}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
