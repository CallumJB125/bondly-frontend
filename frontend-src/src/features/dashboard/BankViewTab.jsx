import { useState } from 'react';
import { finances } from '../../lib/api.js';
import { useReadinessScore } from './hooks/useFinanceQueries.js';
import './BankViewTab.css';

const SEV_COLOR  = { low: '#22c55e', medium: '#eab308', high: '#ef4444' };
const SEV_BG     = { low: 'rgba(34,197,94,.1)', medium: 'rgba(234,179,8,.1)', high: 'rgba(239,68,68,.1)' };
const SEV_LABEL  = { low: 'Good', medium: 'Watch', high: 'Risk' };

const SIG_ICONS = {
  overdraft:           '💳',
  income_consistency:  '📈',
  debit_returns:       '↩️',
  gambling:            '🎲',
  cash_advances:       '💸',
  dti:                 '⚖️',
  discretionary_pct:   '🛍️',
  savings_rate:        '🏦',
  month_end_stress:    '📅',
  credit_facilities:   '🗂️',
  lifestyle_inflation: '📊',
  fixed_coverage:      '🔒',
  alcohol_entertainment:'🍺',
  income_sources:      '💼',
};

function SignalCard({ sig, isSelected, onClick }) {
  const color = SEV_COLOR[sig.severity];
  const bg    = SEV_BG[sig.severity];
  return (
    <div
      className={`bv-signal ${isSelected ? 'bv-signal--selected' : ''} bv-signal--${sig.severity}`}
      onClick={onClick}
      style={isSelected ? { borderColor: color, background: bg } : {}}
    >
      <div className="bv-signal__top">
        <span className="bv-signal__icon">{SIG_ICONS[sig.id] || '•'}</span>
        <div className="bv-signal__info">
          <div className="bv-signal__label">{sig.label}</div>
          <div className="bv-signal__val">{sig.userValue}</div>
        </div>
        <div className="bv-signal__badge" style={{ background: bg, color }}>
          {SEV_LABEL[sig.severity]}
        </div>
      </div>
      <div className="bv-signal__score-row">
        {[1,2,3,4,5,6,7,8,9,10].map(n => (
          <div key={n} className="bv-signal__pip"
            style={{ background: n <= sig.score ? color : 'var(--color-surface-2)' }} />
        ))}
      </div>
    </div>
  );
}

function CoachPanel({ sig }) {
  if (!sig) return (
    <div className="bv-coach bv-coach--empty">
      <div className="bv-coach__empty-icon">🏦</div>
      <div className="bv-coach__empty-text">Select any signal card to see what banks think — and what to do about it</div>
    </div>
  );

  const color = SEV_COLOR[sig.severity];
  const bg    = SEV_BG[sig.severity];

  return (
    <div className="bv-coach">
      <div className="bv-coach__header" style={{ borderColor: color }}>
        <span className="bv-coach__icon">{SIG_ICONS[sig.id] || '•'}</span>
        <div>
          <div className="bv-coach__title">{sig.label}</div>
          <div className="bv-coach__badge" style={{ background: bg, color }}>{SEV_LABEL[sig.severity]} — {sig.score}/10</div>
        </div>
      </div>

      <div className="bv-coach__section">
        <div className="bv-coach__section-title">Your data</div>
        <div className="bv-coach__value">{sig.userValue}</div>
      </div>

      <div className="bv-coach__section">
        <div className="bv-coach__section-title">What banks see</div>
        <div className="bv-coach__text">{sig.bankView}</div>
      </div>

      <div className="bv-coach__section">
        <div className="bv-coach__section-title">What to do</div>
        <div className="bv-coach__coaching">{sig.coaching}</div>
      </div>
    </div>
  );
}

function DossierModal({ dossier, onClose }) {
  return (
    <div className="bv-modal-overlay" onClick={onClose}>
      <div className="bv-modal" onClick={e => e.stopPropagation()}>
        <div className="bv-modal__header">
          <div>
            <div className="bv-modal__title">Your Bank Dossier</div>
            <div className="bv-modal__sub">How a credit analyst would assess your file today</div>
          </div>
          <button className="bv-modal__close" onClick={onClose}>✕</button>
        </div>
        <div className="bv-modal__body">
          <div className="bv-modal__dossier">{dossier}</div>
        </div>
        <div className="bv-modal__footer">
          <span className="bv-modal__disclaimer">AI-generated assessment based on your uploaded statement data. Not a formal credit decision.</span>
          <button className="bv-modal__print" onClick={() => window.print()}>Download PDF</button>
        </div>
      </div>
    </div>
  );
}

export default function BankViewTab() {
  const { data: raw, isLoading: loading, isError, refetch } = useReadinessScore();
  const data = raw?.available ? raw : null;
  const [selected, setSelected] = useState(null);
  const [dossier,  setDossier]  = useState(null);
  const [dosLoading, setDosLoading] = useState(false);

  async function generateDossier() {
    setDosLoading(true);
    try {
      const r = await finances.bankDossier();
      if (r?.dossier) setDossier(r.dossier);
    } catch {}
    setDosLoading(false);
  }

  if (loading) return (
    <div style={{ height: 300, background: 'var(--color-surface-2)', borderRadius: 12, animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />
  );
  if (isError) return (
    <div style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
      Failed to load bank view. <button onClick={() => refetch()} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
    </div>
  );

  if (!data?.bankSignals) return (
    <p style={{ color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
      Upload a bank statement to see how lenders view your finances.
    </p>
  );

  const signals = data.bankSignals;
  const highCount   = signals.filter(s => s.severity === 'high').length;
  const medCount    = signals.filter(s => s.severity === 'medium').length;
  const lowCount    = signals.filter(s => s.severity === 'low').length;

  // Sort: high first, then medium, then low
  const sorted = [...signals].sort((a, b) => {
    const order = { high: 0, medium: 1, low: 2 };
    return order[a.severity] - order[b.severity];
  });

  const selectedSig = sorted.find(s => s.id === selected) || null;

  return (
    <div className="bv">
      {/* Summary strip */}
      <div className="bv-summary">
        <div className="bv-summary__item bv-summary__item--low">
          <span className="bv-summary__num">{lowCount}</span>
          <span>Green signals</span>
        </div>
        <div className="bv-summary__item bv-summary__item--medium">
          <span className="bv-summary__num">{medCount}</span>
          <span>Watch</span>
        </div>
        <div className="bv-summary__item bv-summary__item--high">
          <span className="bv-summary__num">{highCount}</span>
          <span>Risk flags</span>
        </div>
        <div className="bv-summary__cta" style={{ marginLeft: 'auto' }}>
          <button className="bv-dossier-btn" onClick={generateDossier} disabled={dosLoading}>
            {dosLoading ? 'Generating…' : '📄 Generate my bank dossier'}
          </button>
        </div>
      </div>

      {/* Two-column layout */}
      <div className="bv-layout">
        <div className="bv-signals">
          {sorted.map(sig => (
            <SignalCard
              key={sig.id}
              sig={sig}
              isSelected={selected === sig.id}
              onClick={() => setSelected(selected === sig.id ? null : sig.id)}
            />
          ))}
        </div>
        <div className="bv-coach-wrap">
          <CoachPanel sig={selectedSig} />
        </div>
      </div>

      {dossier && <DossierModal dossier={dossier} onClose={() => setDossier(null)} />}
    </div>
  );
}
