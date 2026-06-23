import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bankApi, bankFmtR, bankFmtPct, monthlyFromRate, timeUntil } from './bankApi.js';
// (BidRow component defined below uses these too)

// Cost-of-funds proxy for the estimated net interest margin (NIM). We don't have
// a real funding curve in the demo, so we use SA prime as a sensible baseline and
// label every derived figure as an ESTIMATE. NIM est = bid rate − this baseline.
const COST_OF_FUNDS_PCT = 11.75; // SA prime (approx) — used only as a margin yardstick

// 8-column grid (extends the shared .bids-table 6-col default with Est. margin + Expires).
const BID_GRID = '140px 1fr 110px 110px 130px 130px 120px 110px';

function estMarginBps(rate) {
  if (rate == null || !isFinite(rate)) return null;
  return Math.round((rate - COST_OF_FUNDS_PCT) * 100);
}

// Hours until expiry (negative once past). null when no expiry on file.
function hoursUntil(iso) {
  if (!iso) return null;
  return (new Date(iso).getTime() - Date.now()) / 3600000;
}

export default function BankBids() {
  const [bids, setBids] = useState(null);
  const [err, setErr]   = useState(null);
  const [tab, setTab]   = useState('active');

  function reload() {
    bankApi.bids().then(d => setBids(d.bids)).catch(e => setErr(e.message));
  }
  useEffect(() => { reload(); }, []);

  if (err) return <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>;
  if (!bids) return <div className="bank-section">Loading…</div>;

  const filtered = bids.filter(b =>
    tab === 'active'   ? b.status === 'active' :
    tab === 'won'      ? b.status === 'accepted' :
    tab === 'lost'     ? ['lost','rejected'].includes(b.status) :
    tab === 'expired'  ? b.status === 'expired' :
    tab === 'withdrawn'? b.status === 'withdrawn' :
    true
  );

  const counts = {
    active:   bids.filter(b => b.status === 'active').length,
    won:      bids.filter(b => b.status === 'accepted').length,
    lost:     bids.filter(b => ['lost','rejected'].includes(b.status)).length,
    expired:  bids.filter(b => b.status === 'expired').length,
    withdrawn:bids.filter(b => b.status === 'withdrawn').length,
  };

  const wonBids    = bids.filter(b => b.status === 'accepted');
  const lostBids   = bids.filter(b => ['lost','rejected'].includes(b.status));
  const totalDecided = wonBids.length + lostBids.length;
  const winRate    = totalDecided ? Math.round((wonBids.length / totalDecided) * 100) : null;

  const decidedWithDates = [...wonBids, ...lostBids].filter(b => b.submittedAt && (b.updatedAt || b.resolvedAt));
  const avgDays = decidedWithDates.length
    ? Math.round(decidedWithDates.reduce((s, b) => {
        const end = new Date(b.updatedAt || b.resolvedAt || b.submittedAt);
        return s + (end - new Date(b.submittedAt)) / 86400000;
      }, 0) / decidedWithDates.length)
    : null;

  const wonWithMargin = wonBids.filter(b => b.spreadBps != null);
  const avgMargin = wonWithMargin.length
    ? Math.round(wonWithMargin.reduce((s, b) => s + b.spreadBps, 0) / wonWithMargin.length)
    : null;

  // #45 Active bids expiring within 48h — needs attention before they lapse.
  const expiringSoon = bids.filter(b => {
    if (b.status !== 'active') return false;
    const hrs = hoursUntil(b.expiresAt);
    return hrs != null && hrs > 0 && hrs < 48;
  }).length;

  return (
    <>
      <h2>My bids</h2>
      <p className="lede">Every offer your team has put on the table.</p>

      <div style={{ display: 'flex', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {[
          { label: 'Win rate', value: winRate != null ? winRate + '%' : '—', sub: 'won ÷ decided', good: winRate >= 30, bad: winRate != null && winRate < 15 },
          { label: 'Total bids', value: bids.length, sub: 'all time' },
          { label: 'Avg days to decision', value: avgDays != null ? avgDays + 'd' : '—', sub: 'won + lost bids' },
          { label: 'Avg spread (won)', value: avgMargin != null ? avgMargin + ' bps' : '—', sub: 'above prime rate' },
          { label: 'Expiring ≤48h', value: expiringSoon, sub: 'active bids — act soon', bad: expiringSoon > 0 },
        ].map(s => (
          <div key={s.label} style={{
            flex: '1 1 120px', padding: '10px 14px',
            background: s.good ? '#f0fdf4' : s.bad ? '#fef2f2' : '#f9fafb',
            border: '1px solid ' + (s.good ? '#bbf7d0' : s.bad ? '#fecaca' : '#e5e7eb'),
            borderRadius: 8,
          }}>
            <div style={{ fontSize: '0.65rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em' }}>{s.label}</div>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: s.good ? '#166534' : s.bad ? '#991b1b' : '#0b1e2d', marginTop: 2 }}>{s.value}</div>
            {s.sub && <div style={{ fontSize: '0.62rem', color: '#9ca3af', marginTop: 1 }}>{s.sub}</div>}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6, marginBottom: 14 }}>
        {[
          { id: 'active',    label: 'Active',    n: counts.active },
          { id: 'won',       label: 'Won',        n: counts.won },
          { id: 'lost',      label: 'Lost',       n: counts.lost },
          { id: 'expired',   label: 'Expired',    n: counts.expired },
          { id: 'withdrawn', label: 'Withdrawn',  n: counts.withdrawn },
        ].map(t => (
          <button key={t.id} onClick={() => setTab(t.id)}
            style={{
              padding: '7px 14px',
              background: tab === t.id ? '#0b1e2d' : '#fff',
              color: tab === t.id ? '#fff' : '#0b1e2d',
              border: '1px solid ' + (tab === t.id ? '#0b1e2d' : '#e5e7eb'),
              borderRadius: 8, fontWeight: 700, fontSize: '0.82rem',
              cursor: 'pointer',
            }}>
            {t.label} · {t.n}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bank-section" style={{ textAlign: 'center', padding: '28px 24px' }}>
          <div style={{ fontSize: '1.8rem', marginBottom: 10 }}>{bids.length === 0 ? '📋' : '📂'}</div>
          <div style={{ fontWeight: 700, color: '#0b1e2d', marginBottom: 6 }}>
            {bids.length === 0 ? "You haven't placed any bids yet" : `Nothing in the ${tab} bucket`}
          </div>
          {bids.length === 0 && (
            <p style={{ color: '#6b7280', fontSize: '0.83rem', maxWidth: 360, margin: '0 auto 14px', lineHeight: 1.5 }}>
              Head to Deal review to see open mortgage applications and place your first competitive offer.
            </p>
          )}
          {bids.length === 0 && (
            <a href="/bank/applications" style={{ display: 'inline-block', padding: '8px 18px', background: '#0b1e2d', color: '#fff', borderRadius: 7, fontSize: '0.83rem', fontWeight: 700, textDecoration: 'none' }}>
              Go to Deal review →
            </a>
          )}
        </div>
      ) : (
        <>
        <div className="bids-table">
          <div className="row header" style={{ gridTemplateColumns: BID_GRID }}>
            <div>Application</div>
            <div>Type / amount</div>
            <div>Your rate</div>
            <div>Monthly</div>
            <div title={`Estimated net interest margin = your rate − ${COST_OF_FUNDS_PCT}% cost-of-funds baseline`}>Est. margin*</div>
            <div>Status</div>
            <div>Expires</div>
            <div>Submitted</div>
          </div>
          {filtered.map(b => <BidRow key={b.id} b={b} onChanged={reload} />)}
        </div>
        <div style={{ fontSize: '0.68rem', color: '#9ca3af', marginTop: 8 }}>
          *Est. margin is indicative only — net interest margin estimated as your rate minus a {COST_OF_FUNDS_PCT}% cost-of-funds baseline (SA prime proxy). Not your actual funding cost.
        </div>
        </>
      )}
    </>
  );
}

function BidRow({ b, onChanged }) {
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState(null);
  const [amend, setAmend]       = useState(false);
  async function loadPostMortem() {
    setExpanded(true);
    if (analysis) return;
    setLoading(true); setErr(null);
    try { const r = await bankApi.postMortem(b.id); setAnalysis(r); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }

  const marginBps = estMarginBps(b.rate);
  // qualityScore is only present when the bids feed carries it — never fabricated.
  const quality   = b.qualityScore != null ? b.qualityScore : (b.qualityScoreAtBid != null ? b.qualityScoreAtBid : null);
  const isActive  = b.status === 'active';
  const hrs       = isActive ? hoursUntil(b.expiresAt) : null;
  const expSoon   = hrs != null && hrs > 0 && hrs < 48;
  const expired   = hrs != null && hrs <= 0;

  return (
    <>
      <div className="row" style={{ gridTemplateColumns: BID_GRID }}>
        <div>
          <Link className="ref" to={`/bank/applications/${b.ref}`} style={{ color: '#0b1e2d', textDecoration: 'none' }}>{b.ref}</Link>
          {quality != null && (
            <div style={{ fontSize: '0.66rem', color: '#6b7280', marginTop: 2 }}>Quality {quality}</div>
          )}
        </div>
        <div>
          <span className={'type-tag ' + (b.applicationType || 'origination')} style={{ marginRight: 6 }}>
            {b.applicationType === 'swap' ? 'Switch' : 'New bond'}
          </span>
          {bankFmtR(b.applicationAmount)}
        </div>
        <div className="rate">{bankFmtPct(b.rate)}</div>
        <div>{bankFmtR(b.monthly)}</div>
        <div title={marginBps != null && marginBps < 0
            ? `Below cost-of-funds baseline — this bid prices under the ${COST_OF_FUNDS_PCT}% yardstick (negative estimated NIM)`
            : `Estimated NIM = ${bankFmtPct(b.rate)} − ${COST_OF_FUNDS_PCT}% baseline`}
          style={{ fontWeight: 700, color: marginBps == null ? '#9ca3af' : marginBps < 0 ? '#991b1b' : '#166534' }}>
          {marginBps == null ? '—' : `${marginBps < 0 ? '⚠ ' : ''}~${marginBps >= 0 ? '+' : ''}${marginBps} bps`}
        </div>
        <div>
          <span className={'bid-status ' + b.status}>{b.status}</span>
          {b.status === 'lost' && (
            <button onClick={loadPostMortem}
              style={{ marginLeft: 6, background: 'transparent', color: '#7c3aed', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, textDecoration: 'underline' }}>
              Why?
            </button>
          )}
          {isActive && (
            <button onClick={() => setAmend(a => !a)}
              style={{ marginLeft: 6, background: 'transparent', color: '#0b1e2d', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, textDecoration: 'underline' }}>
              {amend ? 'Close' : 'Amend'}
            </button>
          )}
        </div>
        <div style={{ fontSize: '0.76rem', fontWeight: expSoon ? 700 : 400, color: expired ? '#991b1b' : expSoon ? '#b45309' : '#6b7280' }}>
          {!isActive ? '—' : !b.expiresAt ? '—' : expired ? 'expired' : (
            <span title={`Expires ${new Date(b.expiresAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}`}>
              {expSoon && '⚠ '}{timeUntil(b.expiresAt)}
            </span>
          )}
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>
          {new Date(b.submittedAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
      {amend && (
        <AmendBid b={b} onDone={() => { setAmend(false); onChanged && onChanged(); }} />
      )}
      {expanded && (
        <div style={{ padding: '12px 16px', borderBottom: '1px solid #e5e7eb', background: '#f5f3ff', fontSize: '0.85rem', color: '#0f1a24' }}>
          {loading && <span style={{ color: '#7c3aed', fontStyle: 'italic' }}>Analysing…</span>}
          {err     && <span style={{ color: '#991b1b' }}>{err}</span>}
          {analysis && (
            <>
              <strong style={{ color: '#7c3aed' }}>🤖 Post-mortem ({analysis.gapBp} bp behind):</strong> {analysis.analysis}
            </>
          )}
        </div>
      )}
    </>
  );
}

// Bid amendment flow (#23): show current bid → propose a new rate → preview the
// impact (new monthly + margin shift) → confirm. Persists via PATCH /api/bank/bids/:bidId.
function AmendBid({ b, onDone }) {
  const [rate, setRate] = useState(String(b.rate ?? ''));
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  const newRate = Number(rate);
  const valid   = isFinite(newRate) && newRate > 0 && newRate <= 30;
  const changed = valid && Math.abs(newRate - b.rate) > 0.0001;
  // Recompute monthly from the proposed rate against the application amount + term.
  const newMonthly = valid && b.applicationAmount && b.term
    ? monthlyFromRate(b.applicationAmount, newRate, b.term)
    : null;
  const oldMargin = estMarginBps(b.rate);
  const newMargin = valid ? estMarginBps(newRate) : null;

  async function save() {
    if (!changed) return;
    setBusy(true); setErr(null);
    try {
      const body = { rate: newRate };
      if (newMonthly) body.monthly = newMonthly;
      await bankApi.updateBid(b.id, body);
      onDone();
    } catch (e) { setErr(e.message); setBusy(false); }
  }

  return (
    <div style={{ padding: '14px 16px', borderBottom: '1px solid #e5e7eb', background: '#f9fafb' }}>
      <div style={{ fontWeight: 700, color: '#0b1e2d', marginBottom: 10, fontSize: '0.86rem' }}>Amend bid · {b.ref}</div>
      <div style={{ display: 'flex', gap: 18, flexWrap: 'wrap', alignItems: 'flex-end' }}>
        <div>
          <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em' }}>Current</div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{bankFmtPct(b.rate)}</div>
          <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{bankFmtR(b.monthly)}/mo</div>
        </div>
        <div style={{ fontSize: '1.2rem', color: '#9ca3af', paddingBottom: 6 }}>→</div>
        <div>
          <label style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em', display: 'block', marginBottom: 2 }}>Proposed rate (%)</label>
          <input type="number" step="0.05" min="0" max="30" value={rate} onChange={e => setRate(e.target.value)}
            style={{ width: 110, padding: '7px 10px', border: '1px solid #d1d5db', borderRadius: 6, fontSize: '0.9rem', fontWeight: 700 }} />
        </div>
        <div>
          <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em' }}>New monthly</div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>{newMonthly != null ? bankFmtR(newMonthly) : '—'}</div>
          {newMonthly != null && b.monthly != null && changed && (
            <div style={{ fontSize: '0.72rem', color: newMonthly < b.monthly ? '#166534' : '#991b1b' }}>
              {newMonthly < b.monthly ? '↓ ' : '↑ '}{bankFmtR(Math.abs(newMonthly - b.monthly))}/mo
            </div>
          )}
        </div>
        <div>
          <div style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em' }}>Est. margin*</div>
          <div style={{ fontWeight: 800, fontSize: '0.95rem' }}>
            {oldMargin != null ? `~${oldMargin} bps` : '—'}{changed && newMargin != null ? ` → ~${newMargin} bps` : ''}
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={save} disabled={busy || !changed}
            style={{ padding: '8px 16px', background: busy || !changed ? '#9ca3af' : '#0b1e2d', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.82rem', cursor: busy || !changed ? 'default' : 'pointer' }}>
            {busy ? 'Saving…' : 'Confirm amendment'}
          </button>
        </div>
      </div>
      {err && <div style={{ color: '#991b1b', fontSize: '0.78rem', marginTop: 8 }}>{err}</div>}
      <div style={{ fontSize: '0.66rem', color: '#9ca3af', marginTop: 8 }}>
        *Est. margin = proposed rate − {COST_OF_FUNDS_PCT}% cost-of-funds baseline. Indicative only. The customer sees the updated offer once confirmed.
      </div>
    </div>
  );
}
