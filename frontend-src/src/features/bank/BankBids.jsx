import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { bankApi, bankFmtR, bankFmtPct } from './bankApi.js';
// (BidRow component defined below uses these too)

export default function BankBids() {
  const [bids, setBids] = useState(null);
  const [err, setErr]   = useState(null);
  const [tab, setTab]   = useState('active');

  useEffect(() => {
    bankApi.bids().then(d => setBids(d.bids)).catch(e => setErr(e.message));
  }, []);

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
        <div className="bids-table">
          <div className="row header">
            <div>Application</div>
            <div>Type / amount</div>
            <div>Your rate</div>
            <div>Monthly</div>
            <div>Status</div>
            <div>Submitted</div>
          </div>
          {filtered.map(b => <BidRow key={b.id} b={b} />)}
        </div>
      )}
    </>
  );
}

function BidRow({ b }) {
  const [expanded, setExpanded] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [loading, setLoading]   = useState(false);
  const [err, setErr]           = useState(null);
  async function loadPostMortem() {
    setExpanded(true);
    if (analysis) return;
    setLoading(true); setErr(null);
    try { const r = await bankApi.postMortem(b.id); setAnalysis(r); }
    catch (e) { setErr(e.message); }
    finally { setLoading(false); }
  }
  return (
    <>
      <div className="row">
        <div>
          <Link className="ref" to={`/bank/applications/${b.ref}`} style={{ color: '#0b1e2d', textDecoration: 'none' }}>{b.ref}</Link>
        </div>
        <div>
          <span className={'type-tag ' + (b.applicationType || 'origination')} style={{ marginRight: 6 }}>
            {b.applicationType === 'swap' ? 'Switch' : 'New bond'}
          </span>
          {bankFmtR(b.applicationAmount)}
        </div>
        <div className="rate">{bankFmtPct(b.rate)}</div>
        <div>{bankFmtR(b.monthly)}</div>
        <div>
          <span className={'bid-status ' + b.status}>{b.status}</span>
          {b.status === 'lost' && (
            <button onClick={loadPostMortem}
              style={{ marginLeft: 6, background: 'transparent', color: '#7c3aed', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, textDecoration: 'underline' }}>
              Why?
            </button>
          )}
        </div>
        <div style={{ color: '#6b7280', fontSize: '0.78rem' }}>
          {new Date(b.submittedAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
        </div>
      </div>
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
