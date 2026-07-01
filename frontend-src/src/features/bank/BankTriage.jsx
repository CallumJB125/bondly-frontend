import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bankApi, bankFmtR, bankFmtPct, downloadCsv } from './bankApi.js';

const daysSince = (iso) => iso ? Math.floor((Date.now() - new Date(iso)) / 86400000) : null;

function triageReason(b) {
  if (b.isLowest) return 'Your rate is lowest in market — you\'re the leading bid';
  if (b.winnability === 'high' && b.trueLowest != null) {
    const gap = Math.round((b.yourRate - b.trueLowest) * 100);
    return gap <= 5 ? 'Within 5bp of market leader — strong position' : 'Competitive rate, strong borrower profile';
  }
  if (b.winnability === 'medium') {
    if (b.trueLowest != null) {
      const gapBps = Math.round((b.yourRate - b.trueLowest) * 100);
      return `${gapBps}bp behind market leader — consider sharpening rate`;
    }
    return 'Borderline — review pricing or borrower profile';
  }
  if (b.winnability === 'low') {
    const days = b.submittedAt ? Math.floor((Date.now() - new Date(b.submittedAt)) / 86400000) : null;
    if (days != null && days > 7) return `${days} days in pipeline with no movement — consider withdrawing`;
    return 'Unlikely to win at current rate — consider walking or repricing';
  }
  return 'Review deal profile';
}

// Phase 1b — rank by EXPECTED VALUE OF ACTING, not raw risk/size.
// A deal you're already winning has ~zero action value (acting only cuts your
// own margin); a deal you're losing by a small, closeable gap with high margin
// is where attention pays off.
function flipProb(b) {
  if (b.isLowest) return 0.05;                               // already leading
  if (b.trueLowest == null) {
    return b.winnability === 'high' ? 0.6 : b.winnability === 'medium' ? 0.35 : 0.12;
  }
  const gap = b.yourRate - b.trueLowest;                     // % above the leader
  if (gap <= 0) return 0.05;
  const base = Math.max(0, 1 - gap / 0.5);                   // gap 0→1, 0.5%→0
  const wWeight = b.winnability === 'high' ? 1 : b.winnability === 'medium' ? 0.8 : 0.5;
  return Math.min(0.95, base * wWeight);
}
function actionValue(b) {
  return flipProb(b) * (Number(b.estLifetimeMargin) || 0);
}
function matchToWin(b) {
  if (b.isLowest || b.trueLowest == null) return null;
  const gap = b.yourRate - b.trueLowest;
  if (gap <= 0) return null;
  return { dropTo: b.trueLowest, gapBps: Math.round(gap * 100) };
}

const TYPOLOGY_GUIDE = {
  income_fabrication: {
    label: 'Income fabrication',
    icon: '💰',
    what: 'The applicant inflated or falsified their salary to qualify for a larger bond.',
    why: 'The most common first-party fraud on mortgage applications. Approving this means the borrower cannot actually service the debt — default is near-certain.',
  },
  mule: {
    label: 'Money mule',
    icon: '🔄',
    what: 'The account is being used to receive and rapidly pass through funds for a third party.',
    why: 'Indicates the applicant may be knowingly or unknowingly involved in money laundering. FICA requires you to file a SAR.',
  },
  loan_stacking: {
    label: 'Loan stacking',
    icon: '📚',
    what: 'Multiple loans taken in quick succession before credit bureaus update.',
    why: 'The applicant is loading up on debt faster than the system can detect. Their real debt-to-income is higher than any single bureau report shows.',
  },
  scam_victim: {
    label: 'Scam victim (APP fraud)',
    icon: '⚠️',
    what: 'The applicant was likely tricked into making a large transfer to a fraudster.',
    why: 'The Conduct Standard requires banks to assess liability. Approving a bond for someone who just lost significant savings also raises affordability concerns.',
  },
  bust_out: {
    label: 'Bust-out fraud',
    icon: '💥',
    what: 'Credit lines were maxed out then the account went dark — a deliberate default pattern.',
    why: 'The applicant has likely already defaulted elsewhere and is attempting to extract more credit before disappearing.',
  },
};

function TypologyCard({ entry }) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '14px 16px',
      display: 'flex',
      flexDirection: 'column',
      gap: 6,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontWeight: 700, fontSize: '0.9rem', color: '#0b1e2d' }}>
        <span style={{ fontSize: '1.1rem' }}>{entry.icon}</span>
        {entry.label}
      </div>
      <div style={{ fontSize: '0.8rem', color: '#374151' }}><strong>What:</strong> {entry.what}</div>
      <div style={{ fontSize: '0.8rem', color: '#6b7280' }}><strong>Why it matters:</strong> {entry.why}</div>
    </div>
  );
}

function TypologyGuidePanel() {
  const [open, setOpen] = useState(false);
  return (
    <div style={{ marginBottom: 24, border: '1px solid #dbeafe', borderRadius: 10, overflow: 'hidden' }}>
      <button
        onClick={() => setOpen(o => !o)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '12px 16px',
          background: '#eff6ff',
          border: 'none',
          cursor: 'pointer',
          fontSize: '0.85rem',
          fontWeight: 700,
          color: '#1d4ed8',
          textAlign: 'left',
        }}
      >
        <span>What do these flags mean?</span>
        <span style={{ fontSize: '0.75rem', fontWeight: 400, color: '#3b82f6' }}>{open ? '▲ Hide' : '▼ Show fraud typology guide'}</span>
      </button>
      {open && (
        <div style={{
          padding: 16,
          background: '#f8fafc',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))',
          gap: 12,
        }}>
          {Object.values(TYPOLOGY_GUIDE).map(entry => (
            <TypologyCard key={entry.label} entry={entry} />
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Pipeline triage — ranks the bank's active bids by winnability + value,
 * surfacing where to push hard, where to revisit pricing, where to walk away.
 */
export default function BankTriage() {
  const [data, setData] = useState(null);
  const [err,  setErr]  = useState(null);
  const [busy, setBusy] = useState(false);
  const [adjusting, setAdjusting] = useState(null);
  const [newRate, setNewRate]     = useState('');
  const [adjustBusy, setAdjustBusy] = useState(false);

  useEffect(() => { bankApi.triage().then(setData).catch(e => setErr(e.message)); }, []);

  async function adjustBid(bidId) {
    if (!newRate || isNaN(Number(newRate))) return;
    setAdjustBusy(true);
    try {
      await bankApi.updateBid(bidId, { rate: Number(newRate) });
      setData(d => ({
        ...d,
        bids: d.bids.map(b => (b.bidId || b.id) === bidId ? { ...b, yourRate: Number(newRate) } : b),
      }));
      setAdjusting(null); setNewRate('');
    } catch (e) { alert(e.message); }
    finally { setAdjustBusy(false); }
  }

  async function handleWithdraw(bidId) {
    if (!confirm('Withdraw this bid?')) return;
    setBusy(true);
    try {
      await bankApi.withdrawBid(bidId);
      setData(d => ({ ...d, bids: d.bids.filter(b => (b.bidId || b.id) !== bidId) }));
    } catch (e) {
      alert(e.message);
    } finally {
      setBusy(false);
    }
  }

  if (err)  return <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>;
  if (!data) return <div className="bank-section">Loading…</div>;

  // Rank by expected value of acting (deals already winning fall to the bottom).
  const sorted = [...(data.bids || [])].sort((a, b) => actionValue(b) - actionValue(a));

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
        <div>
          <h2>Pipeline triage</h2>
          <p className="lede">Ranked by <strong>expected value of acting</strong> — closeable, high-margin deals first; deals you're already winning drop to the bottom. Sharpen the amber, consider walking from the red.</p>
        </div>
        {sorted.length > 0 && (
          <button
            onClick={() => downloadCsv('bondly-triage', [
              { key: 'ref', label: 'ref' },
              { label: 'type', get: b => b.type === 'swap' ? 'Switch' : 'New bond' },
              { label: 'amount', get: b => b.requestedAmount },
              { label: 'qualityScore', get: b => b.qualityScore },
              { label: 'yourRate', get: b => b.yourRate },
              { label: 'lowestRate', get: b => b.trueLowest },
              { key: 'winnability', label: 'winnability' },
              { label: 'estLifetimeMargin', get: b => b.estLifetimeMargin },
              { label: 'daysInPipeline', get: b => daysSince(b.submittedAt) },
            ], sorted)}
            style={{ padding: '8px 14px', fontSize: '0.8rem', fontWeight: 700, background: '#fff', border: '1px solid #d1d5db', color: '#0b1e2d', borderRadius: 7, cursor: 'pointer', whiteSpace: 'nowrap' }}>
            ↓ Export CSV
          </button>
        )}
      </div>

      <TypologyGuidePanel />

      <div className="bank-kpis">
        <Kpi label="Pursue now"        v={data.summary.pursueNow} good />
        <Kpi label="Review pricing"    v={data.summary.reviewPricing} warn />
        <Kpi label="Consider walking"  v={data.summary.consider} />
        <Kpi label="Total active bids" v={data.summary.total} />
      </div>

      {sorted.length === 0 ? (
        <div className="bank-section" style={{ textAlign: 'center', padding: '32px 24px' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>🏁</div>
          <div style={{ fontWeight: 700, color: '#0b1e2d', marginBottom: 6 }}>No active bids to triage</div>
          <p style={{ color: '#6b7280', fontSize: '0.83rem', maxWidth: 380, margin: '0 auto 16px', lineHeight: 1.5 }}>
            Once you've placed bids on applications, they'll appear here ranked by winnability and value — green to pursue, amber to reprice, red to walk away from.
          </p>
          <a href="/bank/applications" style={{ display: 'inline-block', padding: '8px 18px', background: '#0b1e2d', color: '#fff', borderRadius: 7, fontSize: '0.83rem', fontWeight: 700, textDecoration: 'none' }}>
            Browse deal queue →
          </a>
        </div>
      ) : (
        <div className="bids-table">
          <div className="row header" style={{ gridTemplateColumns: '140px 1fr 100px 100px 100px 130px 80px' }}>
            <div>Application</div><div>Profile</div><div>Your rate</div><div>Lowest</div><div>Winnability</div><div>Est. lifetime margin</div><div>Pipeline</div>
          </div>
          {sorted.map(b => {
            const colour = b.winnability === 'high' ? '#16a34a' : b.winnability === 'medium' ? '#b45309' : '#6b7280';
            const days = daysSince(b.submittedAt);
            return (
              <div key={b.bidId || b.id} className="row" style={{ gridTemplateColumns: '140px 1fr 100px 100px 100px 130px 80px' }}>
                <div>
                  <Link to={`/bank/applications/${b.ref}`} style={{ fontFamily: 'monospace', fontWeight: 700, color: '#0b1e2d', textDecoration: 'none' }}>{b.ref}</Link>
                  {b.hasHighFlags && <div style={{ fontSize: '0.65rem', color: '#dc2626', marginTop: 2 }}>⚠ high-risk flag</div>}
                  <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
                    <button onClick={() => handleWithdraw(b.bidId || b.id)} disabled={busy}
                      style={{ padding: '4px 10px', fontSize: '0.72rem', background: '#fff', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 5, cursor: 'pointer', fontWeight: 700 }}>
                      Withdraw
                    </button>
                    <button onClick={() => { setAdjusting(b.bidId || b.id); setNewRate(b.yourRate?.toFixed(2) || ''); }}
                      style={{ padding: '4px 10px', fontSize: '0.72rem', background: '#fff', border: '1px solid #ddd6fe', color: '#5b21b6', borderRadius: 5, cursor: 'pointer', fontWeight: 700 }}>
                      Adjust rate
                    </button>
                  </div>
                  {adjusting === (b.bidId || b.id) && (
                    <div style={{ marginTop: 8, display: 'flex', gap: 6, alignItems: 'center' }}>
                      <input
                        type="number" step="0.05" value={newRate} onChange={e => setNewRate(e.target.value)}
                        style={{ width: 80, padding: '4px 8px', border: '1px solid #ddd6fe', borderRadius: 5, fontSize: '0.82rem' }}
                        placeholder="Rate %"
                      />
                      <button onClick={() => adjustBid(b.bidId || b.id)} disabled={adjustBusy}
                        style={{ padding: '4px 10px', fontSize: '0.72rem', background: '#5b21b6', color: '#fff', border: 'none', borderRadius: 5, cursor: 'pointer', fontWeight: 700 }}>
                        {adjustBusy ? '…' : 'Save'}
                      </button>
                      <button onClick={() => { setAdjusting(null); setNewRate(''); }}
                        style={{ padding: '4px 8px', fontSize: '0.72rem', background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer' }}>
                        ✕
                      </button>
                    </div>
                  )}
                </div>
                <div>
                  <div style={{ fontSize: '0.82rem' }}>Q{b.qualityScore} · {b.type === 'swap' ? 'Switch' : 'New bond'}</div>
                  <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{bankFmtR(b.requestedAmount)}</div>
                </div>
                <div className="rate">{bankFmtPct(b.yourRate)}</div>
                <div className="rate">{b.trueLowest != null ? bankFmtPct(b.trueLowest) : '—'}{b.isLowest && <span style={{ color: '#16a34a', fontSize: '0.65rem', marginLeft: 4 }}>✓</span>}</div>
                <div>
                  <div style={{ color: colour, fontWeight: 700, textTransform: 'capitalize' }}>{b.winnability}</div>
                  <div style={{ fontSize: '0.68rem', color: '#6b7280', marginTop: 3, fontStyle: 'italic' }}>{triageReason(b)}</div>
                  {(() => { const m = matchToWin(b); return m ? (
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#5b21b6', marginTop: 4 }}>
                      Match to win: drop to {bankFmtPct(m.dropTo)} <span style={{ color: '#6b7280', fontWeight: 600 }}>(−{m.gapBps}bp)</span>
                    </div>
                  ) : b.isLowest ? (
                    <div style={{ fontSize: '0.68rem', fontWeight: 700, color: '#15803d', marginTop: 4 }}>✓ Leading — no action needed</div>
                  ) : null; })()}
                </div>
                <div style={{ color: '#15803d', fontWeight: 700 }}>{bankFmtR(b.estLifetimeMargin)}</div>
                <div>
                  {b.submittedAt ? (
                    <span style={{
                      fontSize: '0.65rem', padding: '2px 6px', borderRadius: 99, fontWeight: 700,
                      background: days > 7 ? '#fee2e2' : days > 3 ? '#fef3c7' : '#f3f4f6',
                      color: days > 7 ? '#991b1b' : days > 3 ? '#92400e' : '#374151',
                    }}>
                      {days}d in pipeline
                    </span>
                  ) : !b.expiresAt && (
                    <span style={{ fontSize: '0.7rem', color: '#9ca3af' }}>—</span>
                  )}
                  {b.expiresAt && (() => {
                    const hoursLeft = (new Date(b.expiresAt) - Date.now()) / 3600000;
                    if (hoursLeft > 48) return null;
                    return (
                      <span style={{ display: 'block', marginTop: 3, fontSize: '0.65rem', padding: '2px 6px', borderRadius: 99, fontWeight: 800, background: '#fef2f2', color: '#991b1b' }}>
                        ⏰ {hoursLeft < 1 ? '< 1h' : Math.round(hoursLeft) + 'h'} left
                      </span>
                    );
                  })()}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </>
  );
}

function Kpi({ label, v, good, warn }) {
  return (
    <div className="bank-kpi" style={good ? { borderColor: '#bbf7d0' } : warn ? { borderColor: '#fde68a' } : null}>
      <div className="label">{label}</div>
      <div className="value" style={{ color: good ? '#15803d' : warn ? '#b45309' : undefined }}>{v}</div>
    </div>
  );
}
