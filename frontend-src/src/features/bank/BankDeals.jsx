import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { bankApi, bankFmtR, bankFmtPct, getBankToken } from './bankApi.js';
import LineChart from '../../components/LineChart.jsx';

export default function BankDeals() {
  const { cappId } = useParams();
  if (cappId) return <DealDetail cappId={cappId} />;
  return <DealList />;
}

// Advance a won deal one step through the conveyancing pipeline.
// bankApi.js is out of scope for this change, so this calls the new
// PATCH /api/bank/deals/:cappId/stage endpoint directly with the bank token.
async function advanceDealStage(cappId, note) {
  const token = getBankToken();
  const r = await fetch(`/api/bank/deals/${encodeURIComponent(cappId)}/stage`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: JSON.stringify({ note: note || '' }),
  });
  const j = await r.json().catch(() => ({ success: false, error: 'Bad response' }));
  if (!j.success) throw new Error(j.error || 'Could not advance stage');
  return j.data.deal;
}

function DealList() {
  const [deals, setDeals] = useState(null);
  const [err, setErr]     = useState(null);
  const [busyId, setBusyId] = useState(null);
  useEffect(() => { bankApi.deals().then(d => setDeals(d.deals)).catch(e => setErr(e.message)); }, []);

  async function advance(deal, e) {
    // The card is a <Link>; don't navigate when the banker clicks the control.
    e.preventDefault();
    e.stopPropagation();
    const next = deal.nextStage;
    if (!next || next.by !== 'bank') return;
    if (busyId) return;
    setBusyId(deal.cappId);
    // Optimistic: mark the next stage done locally so N/7 ticks up immediately.
    setDeals(prev => prev.map(d => d.cappId !== deal.cappId ? d : {
      ...d,
      stages: d.stages.map(s => s.id === next.id ? { ...s, done: true, at: new Date().toISOString(), by: 'bank' } : s),
      nextStage: d.stages[d.stages.findIndex(s => s.id === next.id) + 1] || null,
    }));
    try {
      const fresh = await advanceDealStage(deal.cappId);
      setDeals(prev => prev.map(d => d.cappId === deal.cappId ? fresh : d));
    } catch (err2) {
      alert(err2.message);
      // Roll back by refetching the authoritative list.
      bankApi.deals().then(d => setDeals(d.deals)).catch(() => {});
    } finally {
      setBusyId(null);
    }
  }
  if (err) return <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>;
  if (!deals) return <div className="bank-section">Loading…</div>;
  if (deals.length === 0) return (
    <>
      <h2>Won deals</h2>
      <div className="bank-section" style={{ textAlign: 'center', padding: '32px 24px' }}>
        <div style={{ fontSize: '2rem', marginBottom: 12 }}>🤝</div>
        <div style={{ fontWeight: 700, color: '#0b1e2d', marginBottom: 6 }}>No won deals yet</div>
        <p style={{ color: '#6b7280', fontSize: '0.83rem', maxWidth: 380, margin: '0 auto 16px', lineHeight: 1.5 }}>
          When a customer accepts one of your bids it'll land here with their contact details and the conveyancing tracker.
        </p>
        <a href="/bank/applications" style={{ display: 'inline-block', padding: '8px 18px', background: '#0b1e2d', color: '#fff', borderRadius: 7, fontSize: '0.83rem', fontWeight: 700, textDecoration: 'none' }}>
          Go to Deal review →
        </a>
      </div>
    </>
  );
  const totalBook = deals.reduce((s, d) => s + (d.requestedAmount || 0), 0);
  const dealsWithRate = deals.filter(d => d.bid?.rate != null && d.requestedAmount);
  const weightedRate = dealsWithRate.length
    ? dealsWithRate.reduce((s, d) => s + d.bid.rate * d.requestedAmount, 0)
      / dealsWithRate.reduce((s, d) => s + d.requestedAmount, 0)
    : null;

  // Mortgage terms cluster around 20–30yr, so bucket by year band (#6).
  const buckets = { '≤20yr': 0, '21–25yr': 0, '26–30yr': 0, '30yr+': 0 };
  deals.forEach(d => {
    const yrs = (d.bid?.term || 240) / 12;
    if (yrs <= 20) buckets['≤20yr']++;
    else if (yrs <= 25) buckets['21–25yr']++;
    else if (yrs <= 30) buckets['26–30yr']++;
    else buckets['30yr+']++;
  });
  const maxBucket = Math.max(...Object.values(buckets), 1);

  return (
    <>
      <h2>Won deals · {deals.length}</h2>
      <p className="lede">Customers who accepted your offer. Advance milestones as conveyancing progresses.</p>

      <div className="bank-section" style={{ marginBottom: 16 }}>
        <h3 style={{ marginBottom: 12 }}>Portfolio health</h3>
        <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginBottom: 16 }}>
          <Stat label="Book value" value={bankFmtR(totalBook)} />
          <Stat label="Weighted avg rate" value={weightedRate != null ? weightedRate.toFixed(2) + '%' : '—'} />
          <Stat label="Active deals" value={deals.length} />
        </div>
        <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 8 }}>Maturity profile</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', height: 60 }}>
          {Object.entries(buckets).map(([label, n]) => (
            <div key={label} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
              <div style={{ fontSize: '0.7rem', color: '#374151', fontWeight: 700 }}>{n}</div>
              <div style={{ width: '100%', background: '#c8a84b', borderRadius: '3px 3px 0 0', height: Math.max(4, (n / maxBucket) * 40) + 'px' }} />
              <div style={{ fontSize: '0.62rem', color: '#6b7280' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {deals.map(d => {
        const done   = d.stages.filter(s => s.done).length;
        const total  = d.stages.length;
        const pct    = Math.round((done / total) * 100);
        const next   = d.nextStage;
        return (
          <Link key={d.cappId} to={`/bank/deals/${d.cappId}`}
            className="bank-card" style={{ gridTemplateColumns: '1fr 1fr 1fr 1fr 200px', display: 'grid', alignItems: 'center', gap: 14, marginBottom: 10, padding: 16, textDecoration: 'none', color: 'inherit', border: '1px solid #e5e7eb', borderRadius: 10, background: '#fff' }}>
            <div>
              <div style={{ fontFamily: 'monospace', fontWeight: 700, fontSize: '0.95rem' }}>{d.ref}</div>
              <div className="type-tag" style={{ background: 'rgba(30,58,95,0.15)', color: '#152d4a', display: 'inline-block', padding: '2px 8px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 700, marginTop: 2 }}>
                {d.type === 'swap' ? 'Switch' : 'New bond'}
              </div>
            </div>
            <div>
              <div className="lbl" style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.06em' }}>Customer</div>
              <div className="val" style={{ fontWeight: 700 }}>{d.customer?.name || '—'}</div>
              <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{d.customer?.email || ''}</div>
            </div>
            <div>
              <div className="lbl" style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.06em' }}>Rate / Amount</div>
              <div className="val" style={{ fontWeight: 700 }}>{d.bid ? bankFmtPct(d.bid.rate) : '—'}</div>
              <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>{bankFmtR(d.requestedAmount)}</div>
            </div>
            <div>
              <div className="lbl" style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.06em' }}>Next step</div>
              <div className="val" style={{ fontWeight: 700, fontSize: '0.86rem' }}>
                {next ? next.label : '✓ Complete'}
              </div>
            </div>
            <div>
              <div className="lbl" style={{ fontSize: '0.66rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.06em', marginBottom: 4 }}>{done}/{total} stages</div>
              <div style={{ height: 6, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
                <div style={{ width: pct + '%', height: '100%', background: pct === 100 ? '#16a34a' : '#c8a84b' }} />
              </div>
              {next && next.by === 'bank' ? (
                <button
                  onClick={e => advance(d, e)}
                  disabled={busyId === d.cappId}
                  title={`Mark "${next.label}" complete`}
                  style={{ marginTop: 8, width: '100%', padding: '6px 10px', background: busyId === d.cappId ? '#9ca3af' : '#0b1e2d', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.74rem', cursor: busyId === d.cappId ? 'default' : 'pointer' }}>
                  {busyId === d.cappId ? 'Saving…' : `✓ ${next.label}`}
                </button>
              ) : !next ? (
                <div style={{ marginTop: 8, fontSize: '0.72rem', color: '#15803d', fontWeight: 700 }}>✓ Complete</div>
              ) : null}
            </div>
          </Link>
        );
      })}
    </>
  );
}

// Anonymised per-borrower risk timeline (A4.1). Reuses the admin per-borrower
// timeline logic via /api/bank/borrower/:userId/timeline (bankAuth, POPIA-scoped).
// Honest: real snapshots only — empty state when there is no history; no
// fabricated multi-month curve.
function RiskTimeline({ userId }) {
  const [tl, setTl] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => { bankApi.borrowerTimeline(userId).then(setTl).catch(e => setErr(e.message)); }, [userId]);

  if (err) return null;
  if (!tl) return <div className="bank-section">Loading risk timeline…</div>;

  const points = tl.timeline || [];
  const TIER_COLOR = { green: '#16a34a', amber: '#c8a84b', red: '#dc2626', critical: '#7f1d1d' };
  return (
    <div className="bank-section">
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        Borrower risk timeline
        <span title="Computed from real platform risk snapshots" style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: '#16a34a', background: 'rgba(22,163,74,0.10)', border: '1px solid rgba(22,163,74,0.3)', padding: '2px 7px', borderRadius: 6 }}>Real</span>
        {tl.currentTier && (
          <span style={{ fontFamily: 'monospace', fontSize: '0.62rem', color: '#fff', background: TIER_COLOR[tl.currentTier] || '#6b7280', padding: '2px 7px', borderRadius: 6, textTransform: 'uppercase' }}>{tl.currentTier}</span>
        )}
      </h3>
      {points.length < 2 ? (
        <p style={{ color: '#6b7280', fontSize: '0.8rem' }}>
          {points.length === 0 ? 'No risk snapshots on file yet for this borrower.' : 'Only one snapshot so far — a trend appears once more history accrues.'}
        </p>
      ) : (
        <div style={{ background: '#0b1e2d', borderRadius: 10, padding: '12px 8px 4px' }}>
          <LineChart
            series={[{ values: points.map(p => Math.round((p.score ?? 0) * 100) / 100), color: '#c8a84b', label: 'Risk score' }]}
            labels={points.map(p => (p.snapshotDate ? String(p.snapshotDate).slice(0, 10) : ''))}
            height={140}
            yLabel="Risk score"
          />
        </div>
      )}
    </div>
  );
}

function DealDetail({ cappId }) {
  const [deal, setDeal] = useState(null);
  const [err, setErr]   = useState(null);
  const [busy, setBusy] = useState(false);
  const [reload, setReload] = useState(0);
  const [bureau, setBureau] = useState(null);
  const [fica, setFica]     = useState(null);
  useEffect(() => { bankApi.deal(cappId).then(d => setDeal(d.deal)).catch(e => setErr(e.message)); }, [cappId, reload]);

  if (err)   return <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>;
  if (!deal) return <div className="bank-section">Loading…</div>;

  async function advance(stageId, note) {
    setBusy(true);
    try {
      await bankApi.advanceMilestone(cappId, stageId, note);
      setReload(r => r + 1);
    } catch (e) { alert(e.message); }
    finally { setBusy(false); }
  }
  async function pullBureau() {
    setBusy(true);
    try { const r = await bankApi.pullBureau(cappId); setBureau(r.report); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  async function runFica() {
    setBusy(true);
    try { const r = await bankApi.runFica(cappId); setFica(r.result); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }

  return (
    <>
      <div style={{ display: 'flex', gap: 10, marginBottom: 4 }}>
        <Link to="/bank/deals" style={{ color: '#6b7280', fontSize: '0.78rem', textDecoration: 'none' }}>← Back to deals</Link>
      </div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span>{deal.customer?.name}</span>
        <span style={{ fontFamily: 'monospace', fontSize: '0.7rem', color: '#6b7280' }}>{deal.ref}</span>
      </h2>
      <p className="lede">
        Accepted offer · {deal.bid ? `${bankFmtPct(deal.bid.rate)} on ${bankFmtR(deal.requestedAmount)}, ${bankFmtR(deal.bid.monthly)}/mo for ${Math.round(deal.bid.term/12)} yrs` : '—'}
      </p>

      <div className="bank-detail-grid">
        <div className="col-main">
          <div className="bank-section">
            <h3>Conveyancing milestones</h3>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {deal.stages.map((s, i) => {
                const isCurrent = !s.done && (i === 0 || deal.stages[i - 1].done);
                return (
                  <div key={s.id} style={{
                    display: 'flex', gap: 12, alignItems: 'flex-start',
                    padding: 12, borderRadius: 8,
                    background: s.done ? '#f0fdf4' : isCurrent ? '#fffbeb' : '#f9fafb',
                    border: '1px solid ' + (s.done ? '#bbf7d0' : isCurrent ? '#fde68a' : '#e5e7eb'),
                  }}>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                      background: s.done ? '#16a34a' : isCurrent ? '#c8a84b' : '#e5e7eb',
                      color: s.done || isCurrent ? '#fff' : '#9ca3af',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontWeight: 800, fontSize: '0.78rem',
                    }}>{s.done ? '✓' : i + 1}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700 }}>{s.label}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>{s.desc}</div>
                      {s.done && s.at && (
                        <div style={{ fontSize: '0.7rem', color: '#15803d', marginTop: 4 }}>
                          ✓ {new Date(s.at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                          {s.by && ` · by ${s.by}`}
                        </div>
                      )}
                      {s.note && <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: 4, fontStyle: 'italic' }}>"{s.note}"</div>}
                      {isCurrent && s.by === 'bank' && (
                        <button onClick={() => {
                          const note = prompt(`Add a note for "${s.label}"? (optional)`) || '';
                          advance(s.id, note);
                        }} disabled={busy}
                          style={{ marginTop: 8, padding: '6px 14px', background: '#0b1e2d', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                          Mark as done
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {deal.borrowerId && <RiskTimeline userId={deal.borrowerId} />}

          {deal.docs.length > 0 && (
            <div className="bank-section">
              <h3>Documents on file · {deal.docs.length}</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {deal.docs.map(doc => (
                  <a key={doc.id}
                    href="#"
                    onClick={e => { e.preventDefault(); bankApi.download(`/api/bank/applications/${deal.ref}/documents/${doc.id}`, doc.filename || docLabel(doc.category)); }}
                    style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 12px', borderRadius: 6, background: '#f5f6f8', border: '1px solid #e5e7eb', textDecoration: 'none', color: '#0b1e2d', fontSize: '0.85rem' }}>
                    <span>{docLabel(doc.category)}{doc.filename ? ' · ' + doc.filename : ''}</span>
                    <span style={{ color: '#6b7280', fontSize: '0.74rem' }}>↗ open</span>
                  </a>
                ))}
              </div>
            </div>
          )}

          <ComplianceCard
            bureau={bureau} fica={fica}
            onPullBureau={pullBureau} onRunFica={runFica} busy={busy}
          />

          <DealMessages cappId={cappId} />
        </div>

        <div className="col-side">
          <div className="bank-section">
            <h3>Quick actions</h3>
            <a href="#" onClick={e => { e.preventDefault(); bankApi.download(`/api/bank/deals/${cappId}/prequal.pdf`, `prequal-${cappId}.pdf`); }}
              style={{ display: 'block', padding: '10px 14px', background: '#c8a84b', color: '#0b1e2d', borderRadius: 7, fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none', textAlign: 'center', marginBottom: 8 }}>
              📄 Download pre-qual letter
            </a>
            <a href="#" onClick={e => { e.preventDefault(); bankApi.download(bankApi.followUpIcsPath(cappId, 7), `follow-up-${cappId}.ics`); }}
              style={{ display: 'block', padding: '10px 14px', background: '#fff', color: '#0b1e2d', border: '1px solid #e5e7eb', borderRadius: 7, fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none', textAlign: 'center', marginBottom: 8 }}>
              📅 Add 7-day follow-up to calendar
            </a>
            <a href={`mailto:${deal.customer?.email}`}
              style={{ display: 'block', padding: '10px 14px', background: '#fff', color: '#0b1e2d', border: '1px solid #e5e7eb', borderRadius: 7, fontWeight: 700, fontSize: '0.86rem', textDecoration: 'none', textAlign: 'center' }}>
              ✉️ Email customer
            </a>
          </div>

          <div className="bank-section">
            <h3>Customer contact</h3>
            <div className="bank-row"><span className="k">Name</span><span className="v">{deal.customer?.name || '—'}</span></div>
            <div className="bank-row"><span className="k">Email</span><span className="v"><a href={`mailto:${deal.customer?.email}`} style={{ color: '#0b1e2d' }}>{deal.customer?.email}</a></span></div>
            <div className="bank-row"><span className="k">Phone</span><span className="v"><a href={`tel:${deal.customer?.phone}`} style={{ color: '#0b1e2d' }}>{deal.customer?.phone || '—'}</a></span></div>
            <div className="bank-row"><span className="k">ID number</span><span className="v" style={{ fontFamily: 'monospace' }}>{deal.customer?.idNumber || '—'}</span></div>
          </div>

          {deal.propertyContext && (
            <div className="bank-section">
              <h3>Property</h3>
              <div className="bank-row"><span className="k">Type</span><span className="v">{deal.propertyContext.propertyType || '—'}</span></div>
              <div className="bank-row"><span className="k">Location</span><span className="v">{[deal.propertyContext.suburb, deal.propertyContext.province].filter(Boolean).join(', ') || '—'}</span></div>
              <div className="bank-row"><span className="k">Purchase price</span><span className="v">{bankFmtR(deal.propertyContext.purchasePrice)}</span></div>
              <div className="bank-row"><span className="k">Deposit</span><span className="v">{bankFmtR(deal.propertyContext.deposit)}</span></div>
              <div className="bank-row"><span className="k">OTP signed</span><span className="v">{deal.propertyContext.otpSignedAt ? new Date(deal.propertyContext.otpSignedAt).toLocaleDateString('en-ZA') : 'no'}</span></div>
            </div>
          )}

          {deal.swapContext && (
            <div className="bank-section">
              <h3>Current bond (being switched)</h3>
              <div className="bank-row"><span className="k">Bank</span><span className="v">{deal.swapContext.currentBank || '—'}</span></div>
              <div className="bank-row"><span className="k">Rate</span><span className="v">{deal.swapContext.currentRate != null ? bankFmtPct(deal.swapContext.currentRate) : '—'}</span></div>
              <div className="bank-row"><span className="k">Balance</span><span className="v">{bankFmtR(deal.swapContext.currentBalance)}</span></div>
            </div>
          )}

          {deal.coApplicant && (
            <div className="bank-section">
              <h3>Co-applicant</h3>
              <div className="bank-row"><span className="k">Name</span><span className="v">{deal.coApplicant.name || '—'}</span></div>
              <div className="bank-row"><span className="k">Relationship</span><span className="v">{deal.coApplicant.relationship || '—'}</span></div>
              <div className="bank-row"><span className="k">Income</span><span className="v">{bankFmtR(deal.coApplicant.monthlyIncome)}/mo</span></div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

function SmartReplies({ cappId, msgs, setText }) {
  const [sugg, setSugg] = useState([]);
  const [busy, setBusy] = useState(false);
  // Only load when there's a customer message at the bottom of the thread
  const lastIsCustomer = msgs && msgs.length > 0 && msgs[msgs.length - 1]?.fromRole === 'customer';
  async function load() {
    if (!lastIsCustomer) return;
    setBusy(true);
    try { const r = await bankApi.smartReplies(cappId); setSugg(r.suggestions || []); }
    catch {} finally { setBusy(false); }
  }
  useEffect(() => { setSugg([]); if (lastIsCustomer) load(); }, [msgs?.length, lastIsCustomer]);
  if (!lastIsCustomer || sugg.length === 0) return null;
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
      <span style={{ fontSize: '0.7rem', color: '#7c3aed', fontWeight: 700, padding: '4px 0' }}>✨ AI suggestions:</span>
      {sugg.map((s, i) => (
        <button key={i} onClick={() => setText(s)} type="button"
          style={{ padding: '4px 10px', fontSize: '0.72rem', background: '#f5f3ff', border: '1px solid #ddd6fe', borderRadius: 99, color: '#5b21b6', cursor: 'pointer', fontWeight: 600 }}>
          {s}
        </button>
      ))}
    </div>
  );
}

function NudgeDrafter({ cappId, setText }) {
  const [busy, setBusy] = useState(false);
  async function draft() {
    setBusy(true);
    try { const r = await bankApi.draftNudge(cappId); setText(r.draft); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  return (
    <div style={{ marginBottom: 10 }}>
      <button onClick={draft} disabled={busy} type="button"
        style={{ padding: '5px 12px', fontSize: '0.72rem', background: '#fff', border: '1px dashed #c8a84b', borderRadius: 99, color: '#78350f', cursor: 'pointer', fontWeight: 700 }}>
        🤖 Draft a nudge message
      </button>
    </div>
  );
}

function docLabel(cat) {
  return ({
    id: 'SA ID',
    payslip: 'Payslip',
    residence: 'Proof of residence',
    bank_statement: 'Bank statement',
    tax: 'IRP5',
    offer_to_purchase: 'Offer to Purchase',
  })[cat] || cat || 'Document';
}

function ComplianceCard({ bureau, fica, onPullBureau, onRunFica, busy }) {
  return (
    <div className="bank-section">
      <h3>Compliance checks</h3>
      {(bureau?._isStub || fica?._isStub) && (
        <div style={{ fontSize: '0.7rem', color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', borderRadius: 6, padding: '5px 9px', marginBottom: 10, fontWeight: 600 }}>
          Demo — bureau / FICA integration pending
        </div>
      )}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
        <div>
          {!bureau ? (
            <button onClick={onPullBureau} disabled={busy}
              style={{ width: '100%', padding: 10, background: '#0b1e2d', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              Pull credit bureau
            </button>
          ) : (
            <div style={{ padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: '0.78rem' }}>
              <div style={{ fontWeight: 800, color: '#0f1a24', marginBottom: 4 }}>
                Bureau score: {bureau.bureauScore} <span style={{ color: /poor|bad|high.?risk/i.test(bureau.scoreBand) ? '#b91c1c' : /fair|average|medium/i.test(bureau.scoreBand) ? '#b45309' : '#15803d', fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', marginLeft: 4 }}>{bureau.scoreBand}</span>
              </div>
              <div style={{ color: '#374151' }}>
                Accounts: {bureau.accounts.open} open / {bureau.accounts.total} total<br/>
                Defaults: {bureau.accounts.defaults}{bureau.accounts.judgments > 0 ? ` · Judgments: ${bureau.accounts.judgments}` : ''}<br/>
                12mo enquiries: {bureau.enquiries12Mo}
              </div>
            </div>
          )}
        </div>
        <div>
          {!fica ? (
            <button onClick={onRunFica} disabled={busy}
              style={{ width: '100%', padding: 10, background: '#0b1e2d', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
              Run FICA check
            </button>
          ) : (
            <div style={{ padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7, fontSize: '0.78rem' }}>
              <div style={{ fontWeight: 800, color: '#0f1a24', marginBottom: 4 }}>
                ✓ Risk rating: {fica.riskRating}
              </div>
              <div style={{ color: '#374151' }}>
                ID verified: {fica.idVerified ? '✓' : '✗'}<br/>
                Name match: {fica.nameMatch ? '✓' : '✗'}<br/>
                Sanctions / PEP: {(fica.sanctionsHit || fica.pepHit) ? '⚠️ hit' : 'clear'}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value }) {
  return (
    <div style={{ padding: '8px 14px', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 7, minWidth: 110 }}>
      <div style={{ fontSize: '0.62rem', textTransform: 'uppercase', color: '#6b7280', fontWeight: 700, letterSpacing: '0.04em' }}>{label}</div>
      <div style={{ fontSize: '1rem', fontWeight: 800, color: '#0b1e2d', marginTop: 2 }}>{value}</div>
    </div>
  );
}

function DealMessages({ cappId }) {
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [templates, setTemplates] = useState([]);
  function load() { bankApi.dealMessages(cappId).then(d => setMsgs(d.messages)).catch(() => {}); }
  useEffect(() => {
    load();
    let src;
    bankApi.openEventSource().then(s => {
      if (!s) return;
      src = s;
      s.onmessage = e => {
        try { const d = JSON.parse(e.data); if (d.type === 'new_message' && d.cappId === cappId) load(); } catch {}
      };
    });
    const t = setInterval(load, 60_000);
    return () => { src?.close(); clearInterval(t); };
  }, [cappId]);
  useEffect(() => { bankApi.messageTemplates(cappId).then(d => setTemplates(d.templates)).catch(() => {}); }, [cappId]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await bankApi.sendDealMessage(cappId, text); setText(''); load(); }
    catch (e2) { alert(e2.message); } finally { setBusy(false); }
  }

  return (
    <div className="bank-section">
      <h3>Messages</h3>
      <div style={{ fontSize: '0.74rem', color: '#6b7280', marginBottom: 10 }}>
        Direct line to the customer — they see this in their dashboard.
      </div>

      {templates.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 10 }}>
          {templates.map(t => (
            <button key={t.id} onClick={() => setText(t.text)} type="button"
              style={{ padding: '4px 10px', fontSize: '0.72rem', background: '#fff', border: '1px solid #e5e7eb', borderRadius: 99, color: '#0b1e2d', cursor: 'pointer', fontWeight: 600 }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      <SmartReplies cappId={cappId} msgs={msgs} setText={setText} />
      <NudgeDrafter cappId={cappId} setText={setText} />

      <div style={{ maxHeight: 280, overflowY: 'auto', marginBottom: 10, padding: 8, background: '#f9fafb', borderRadius: 7, border: '1px solid #e5e7eb' }}>
        {!msgs && <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>Loading…</div>}
        {msgs && msgs.length === 0 && <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>No messages yet — say hello!</div>}
        {msgs && msgs.map(m => (
          <div key={m.id} style={{
            marginBottom: 8,
            display: 'flex', flexDirection: 'column',
            alignItems: m.fromRole === 'bank' ? 'flex-end' : 'flex-start',
          }}>
            <div style={{
              maxWidth: '85%',
              padding: '7px 11px', borderRadius: 8,
              background: m.fromRole === 'bank' ? '#0b1e2d' : '#fff',
              color: m.fromRole === 'bank' ? '#fff' : '#0f1a24',
              border: m.fromRole === 'bank' ? 'none' : '1px solid #e5e7eb',
              fontSize: '0.82rem',
            }}>{m.text}</div>
            <div style={{ fontSize: '0.66rem', color: '#6b7280', marginTop: 2 }}>
              {m.fromName} · {new Date(m.at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} style={{ display: 'flex', gap: 6 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Type a message…" style={{ flex: 1, padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.86rem' }} />
        <button type="submit" disabled={busy || !text.trim()} style={{ padding: '8px 14px', background: '#c8a84b', color: '#0b1e2d', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Send</button>
      </form>
    </div>
  );
}
