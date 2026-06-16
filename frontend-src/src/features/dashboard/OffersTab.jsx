import { useEffect, useState } from 'react';
import { fmt } from '../../lib/format.js';
import { offers, myApplication } from '../../lib/api.js';

/**
 * OffersTab — customer's bid inbox + application update centre.
 *
 * The end-to-end picture for the customer here:
 *   • See where their application sits in the funnel
 *   • Update it — most importantly, add an OTP once they sign one. Banks
 *     keying off propertyContext.otpStatus move from indicative pricing to
 *     a firm offer when this flips.
 *   • Add a co-applicant (joint bond) at any point
 *   • Accept the best bid → all other bids close, winning bank gets PII
 *   • Decline an individual bid without accepting another (keeps the rest open)
 *   • POPIA feed showing which banks have looked at the application
 */
export default function OffersTab() {
  const [apps,    setApps]    = useState(null);
  const [appRow,  setAppRow]  = useState(null);  // current customer application (raw)
  const [viewers, setViewers] = useState(null);
  const [convey,  setConvey]  = useState(null);  // accepted-deal timelines
  const [busy,    setBusy]    = useState(null);
  const [err,     setErr]     = useState(null);
  const [info,    setInfo]    = useState(null);
  const [editing, setEditing] = useState(null);  // 'property' | 'co-applicant' | null

  async function load() {
    try {
      const [o, app, v, c] = await Promise.all([
        offers.list(),
        myApplication.get().catch(() => ({ application: null })),
        offers.viewers().catch(() => ({ views: [] })),
        offers.conveyancing().catch(() => ({ applications: [] })),
      ]);
      setApps(o.applications || []);
      setAppRow(app?.application || null);
      setViewers(v?.views || []);
      setConvey(c?.applications || []);
    } catch (e) { setErr(e.message); }
  }
  useEffect(() => { load(); }, []);

  async function accept(bidId) {
    if (!confirm('Accept this offer? All other offers will be closed and the winning bank will be able to see your contact details for the conveyancing step.')) return;
    setBusy(bidId); setErr(null); setInfo(null);
    try {
      await offers.accept(bidId);
      setInfo('Offer accepted. The bank will be in touch to start conveyancing.');
      load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function decline(bidId) {
    const reason = prompt('Why are you declining this offer? (optional)') || '';
    setBusy(bidId); setErr(null); setInfo(null);
    try {
      await offers.decline(bidId, reason);
      setInfo('Offer declined. Your other offers stay open.');
      load();
    } catch (e) { setErr(e.message); }
    finally { setBusy(null); }
  }

  async function saveApplication(patch) {
    try {
      await myApplication.update(appRow.id, patch);
      setEditing(null); setInfo('Application updated.');
      load();
    } catch (e) { setErr(e.message); }
  }

  if (err && !apps) return <div className="card" style={{ padding: 18 }}>Could not load offers: {err}</div>;
  if (!apps) return <div className="card" style={{ padding: 18 }}>Loading…</div>;

  const noApps = apps.length === 0;
  const isOrigination = appRow?.type === 'origination';
  const otpSigned = appRow?.propertyContext?.otpStatus === 'offer_signed';

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>

      {info && <Banner color="green">{info}</Banner>}
      {err  && <Banner color="red">{err}</Banner>}

      <ScoreCoachCard />


      {/* Conveyancing — only renders once a bid has been accepted */}
      {convey && convey.length > 0 && convey.map(c => (
        <div key={c.cappId}>
        <NpsPrompt cappId={c.cappId} stages={c.stages} />
        <CustomerDealMessages cappId={c.cappId} bankName={c.bank.name} />
        <div className="card" style={{ padding: 22, background: 'linear-gradient(180deg, #f0fdf4 0%, #ffffff 100%)', border: '2px solid #bbf7d0' }}>
          <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 800, color: '#15803d' }}>
            ✓ Accepted offer · with {c.bank.name}
          </div>
          <h3 style={{ fontWeight: 800, margin: '4px 0', fontSize: '1.25rem' }}>
            {c.bid ? `${c.bid.rate?.toFixed(2)}% on ${fmt(c.requestedAmount)} · ${fmt(c.bid.monthly)}/mo` : ''}
          </h3>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
            Your contact at {c.bank.name}: <strong>{c.bank.contactName || 'your bond consultant'}</strong> · {c.bank.contactEmail ? <a href={`mailto:${c.bank.contactEmail}`}>{c.bank.contactEmail}</a> : 'will reach out shortly'}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {c.stages.map((s, i) => {
              const isCurrent = !s.done && (i === 0 || c.stages[i - 1].done);
              return (
                <div key={s.id} style={{
                  display: 'flex', gap: 12, alignItems: 'flex-start',
                  padding: 12, borderRadius: 8,
                  background: s.done ? 'rgba(22,163,74,0.08)' : isCurrent ? '#fffbeb' : '#f9fafb',
                  border: '1px solid ' + (s.done ? '#bbf7d0' : isCurrent ? '#fde68a' : 'var(--border-color)'),
                }}>
                  <div style={{
                    width: 26, height: 26, borderRadius: '50%', flexShrink: 0,
                    background: s.done ? '#16a34a' : isCurrent ? '#c8a84b' : '#e5e7eb',
                    color: s.done || isCurrent ? '#fff' : '#9ca3af',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontWeight: 800, fontSize: '0.74rem',
                  }}>{s.done ? '✓' : i + 1}</div>
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: '0.9rem' }}>{s.label}</div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>{s.desc}</div>
                    {s.done && s.at && (
                      <div style={{ fontSize: '0.7rem', color: '#15803d', marginTop: 4 }}>
                        ✓ {new Date(s.at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
                      </div>
                    )}
                    {s.note && <div style={{ fontSize: '0.74rem', color: 'var(--text-primary)', marginTop: 4, fontStyle: 'italic' }}>"{s.note}"</div>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
        </div>
      ))}

      {/* Application status + update controls */}
      {appRow && (
        <div className="card" style={{ padding: 20 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', flexWrap: 'wrap', gap: 8 }}>
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--text-secondary)' }}>
                Your application · {appRow.type === 'swap' ? 'Switch' : 'New bond'}
              </div>
              <h3 style={{ fontWeight: 800, margin: '4px 0', fontSize: '1.25rem' }}>{fmt(appRow.requestedAmount)}</h3>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                Submitted {new Date(appRow.createdAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })} · status {String(appRow.status).replace(/_/g, ' ')}
              </div>
            </div>
            {isOrigination && (
              <div style={{
                padding: '5px 12px', borderRadius: 999,
                fontSize: '0.72rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase',
                background: otpSigned ? '#dcfce7' : '#fef3c7',
                color:      otpSigned ? '#166534' : '#92400e',
              }}>
                {otpSigned ? '✓ OTP signed' : 'Pre-approval'}
              </div>
            )}
          </div>

          {/* Pre-approval CTA — once they sign an OTP, prompt them to upload it */}
          {isOrigination && !otpSigned && (
            <div style={{
              marginTop: 14, padding: 14,
              background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)',
              border: '1px solid #fde68a', borderRadius: 8,
            }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Found a property? Upgrade to a firm offer.</div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                You're getting indicative pricing right now. As soon as you sign an Offer to Purchase, tell us — banks switch to firm, conveyancing-ready offers.
              </div>
              <button onClick={() => setEditing('property')}
                style={{ padding: '8px 16px', background: '#0b1e2d', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
                Add property details / OTP →
              </button>
            </div>
          )}

          {/* Existing property summary */}
          {appRow.propertyContext && (
            <div style={{ marginTop: 14, padding: 12, background: 'var(--bg-page)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                <strong style={{ fontSize: '0.85rem' }}>Property</strong>
                <button onClick={() => setEditing('property')} style={{ background: 'transparent', color: 'var(--mint, #16a34a)', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>Edit</button>
              </div>
              <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)' }}>
                {appRow.propertyContext.propertyType || '—'} · {[appRow.propertyContext.suburb, appRow.propertyContext.province].filter(Boolean).join(', ') || '—'} · {appRow.propertyContext.purchasePrice ? fmt(appRow.propertyContext.purchasePrice) : '—'}
              </div>
            </div>
          )}

          {/* Co-applicant block */}
          <div style={{ marginTop: 10, padding: 12, background: 'var(--bg-page)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <strong style={{ fontSize: '0.85rem' }}>Co-applicant</strong>
              <button onClick={() => setEditing('co-applicant')} style={{ background: 'transparent', color: 'var(--mint, #16a34a)', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
                {appRow.coApplicant ? 'Edit' : 'Add a co-applicant'}
              </button>
            </div>
            <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
              {appRow.coApplicant
                ? `${appRow.coApplicant.name} (${appRow.coApplicant.relationship}) · ${fmt(appRow.coApplicant.monthlyIncome)}/mo`
                : 'Adding a partner / spouse boosts your borrowing power. Banks combine both incomes for affordability.'}
            </div>
          </div>

          {/* External offers — what other lenders have already offered them */}
          <ExternalOffersPanel
            cappId={appRow.id}
            offers={appRow.externalOffers || []}
            onChange={load}
          />

          {/* Inline editor */}
          {editing === 'property' && (
            <PropertyEditor
              value={appRow.propertyContext || {}}
              onSave={p => saveApplication({ property: p })}
              onCancel={() => setEditing(null)}
            />
          )}
          {editing === 'co-applicant' && (
            <CoApplicantEditor
              value={appRow.coApplicant}
              onSave={c => saveApplication({ coApplicant: c })}
              onCancel={() => setEditing(null)}
            />
          )}
        </div>
      )}

      {/* Offers block */}
      {noApps ? (
        <div className="card" style={{ padding: 24 }}>
          {appRow ? (
            // Application exists but no bids yet — make the wait feel alive
            <>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                <div style={{
                  width: 42, height: 42, borderRadius: '50%',
                  background: 'rgba(30,58,95,0.15)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: '1.4rem',
                }}>⏳</div>
                <div>
                  <h3 style={{ fontWeight: 800, margin: 0, fontSize: '1.1rem' }}>Waiting for your first offer</h3>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.82rem', margin: '4px 0 0' }}>
                    We're showing your file to our partner banks now. First offers usually land within 24 hours.
                  </p>
                </div>
              </div>
              {viewers && viewers.length > 0 ? (
                <div style={{ padding: 14, background: 'rgba(74,127,165,0.08)', border: '1px solid rgba(74,127,165,0.20)', borderRadius: 8, fontSize: '0.85rem' }}>
                  <strong>{new Set(viewers.map(v => v.bankName)).size} bank{new Set(viewers.map(v => v.bankName)).size === 1 ? '' : 's'} have looked at your file.</strong>{' '}
                  Most recent: {viewers[0].bankName} on {new Date(viewers[0].at).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}.
                </div>
              ) : (
                <div style={{ padding: 14, background: 'var(--bg-page)', border: '1px solid var(--border-color)', borderRadius: 8, fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  No bank views yet — we'll email you the moment your first offer arrives.
                </div>
              )}
            </>
          ) : (
            // No application submitted yet
            <>
              <h3 style={{ fontWeight: 700, marginBottom: 4 }}>No offers yet</h3>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 14 }}>
                Once you submit an application, partner banks will start submitting their best rates here. You'll see them all side-by-side.
              </p>
            </>
          )}
        </div>
      ) : apps.map(a => (
        <div key={a.applicationId}>
          {a.bids.filter(b => ['active','accepted'].includes(b.status)).length >= 2 && (
            <ExplainOffersCard />
          )}
        <div className="card" style={{ padding: 22 }}>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700, color: 'var(--text-secondary)' }}>
              {a.bids.length} offer{a.bids.length === 1 ? '' : 's'} on {fmt(a.requestedAmount)} · ref {a.ref}
            </div>
            <h3 style={{ fontWeight: 800, margin: '4px 0 2px', fontSize: '1.15rem' }}>
              {a.acceptedBidId ? "You've accepted an offer." : "Pick the offer that works for you."}
            </h3>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }} key={'bids-'+a.applicationId}>
            {a.bids.map((b, i) => {
              const isBest    = i === 0 && b.status === 'active' && !a.acceptedBidId;
              const isWinner  = b.status === 'accepted';
              const isClosed  = ['lost','withdrawn','rejected','expired','customer_declined'].includes(b.status);
              return (
                <div key={b.id} style={{
                  position: 'relative',
                  background: isWinner ? '#f0fdf4' : 'var(--bg-card)',
                  border: '2px solid ' + (isWinner ? '#16a34a' : isBest ? 'var(--forest)' : 'var(--border-color)'),
                  borderRadius: 10, padding: 16,
                  opacity: isClosed ? 0.55 : 1,
                }}>
                  {isBest && <Badge color="forest">Lowest monthly</Badge>}
                  {isWinner && <Badge color="green">✓ Accepted</Badge>}
                  {b.status === 'expired' && <Badge color="gray">Expired</Badge>}
                  {b.status === 'customer_declined' && <Badge color="gray">You declined</Badge>}

                  <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{b.bankName}</div>
                  <div style={{ fontSize: '1.6rem', fontWeight: 800, marginTop: 4, color: 'var(--text-primary)' }}>
                    {fmt(b.monthly)}<span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}> / mo</span>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
                    {b.rate?.toFixed(2)}% · {Math.round((b.term||240)/12)} yr term
                  </div>
                  {b.conditions && (
                    <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 10, padding: 8, background: 'rgba(0,0,0,0.03)', borderRadius: 6 }}>
                      {b.conditions}
                    </div>
                  )}
                  <div style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
                    Valid until {new Date(b.expiresAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}
                  </div>
                  {b.status === 'active' && !a.acceptedBidId && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <button onClick={() => accept(b.id)} disabled={busy === b.id}
                        style={{ width: '100%', padding: '9px', background: 'var(--forest)', color: 'var(--lime)', border: 'none', borderRadius: 7, fontWeight: 800, fontSize: '0.875rem', cursor: busy === b.id ? 'wait' : 'pointer', opacity: busy === b.id ? 0.6 : 1 }}>
                        {busy === b.id ? 'Accepting…' : 'Accept this offer'}
                      </button>
                      <button onClick={() => decline(b.id)} disabled={busy === b.id}
                        style={{ width: '100%', padding: '6px', background: 'transparent', color: 'var(--text-secondary)', border: '1px solid var(--border-color)', borderRadius: 7, fontWeight: 600, fontSize: '0.78rem', cursor: busy === b.id ? 'wait' : 'pointer' }}>
                        Decline this offer
                      </button>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
        </div>
      ))}

      {viewers && viewers.length > 0 && (
        <div className="card" style={{ padding: 20 }}>
          <h3 style={{ fontWeight: 700, marginBottom: 4, fontSize: '1rem' }}>Who's looked at your application</h3>
          <p style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', marginBottom: 12 }}>
            POPIA s73 right of access — every bank access is logged.
          </p>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0, maxHeight: 280, overflowY: 'auto' }}>
            {viewers.slice(0, 50).map((v, i) => (
              <li key={i} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: i < viewers.length - 1 ? '1px dashed var(--border-color)' : 'none', fontSize: '0.82rem' }}>
                <span><strong>{v.bankName}</strong> — {viewerActionLabel(v.action)}</span>
                <span style={{ color: 'var(--text-secondary)' }}>{new Date(v.at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}

function Banner({ color, children }) {
  const styles = {
    green: { background: '#dcfce7', color: '#166534', border: '1px solid #bbf7d0' },
    red:   { background: '#fee2e2', color: '#991b1b', border: '1px solid #fecaca' },
  };
  return <div style={{ ...styles[color], borderRadius: 8, padding: '10px 14px', fontSize: '0.875rem' }}>{children}</div>;
}

function Badge({ color, children }) {
  const map = {
    forest: { bg: 'var(--forest, #1e3a5f)', fg: 'var(--lime, #c8f135)' },
    green:  { bg: '#16a34a', fg: '#fff' },
    gray:   { bg: '#6b7280', fg: '#fff' },
  }[color];
  return <div style={{ position: 'absolute', top: -10, left: 12, background: map.bg, color: map.fg, fontSize: '0.65rem', fontWeight: 800, padding: '3px 8px', borderRadius: 99, textTransform: 'uppercase', letterSpacing: '0.06em' }}>{children}</div>;
}

function PropertyEditor({ value, onSave, onCancel }) {
  const [v, setV] = useState({
    propertyType:   value.propertyType   || 'House',
    purchasePrice:  value.purchasePrice  || '',
    deposit:        value.deposit        || '',
    suburb:         value.suburb         || '',
    province:       value.province       || 'Gauteng',
    otpStatus:      value.otpStatus      || 'searching',
  });
  return (
    <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--border-color)', borderRadius: 8 }}>
      <h4 style={{ fontWeight: 700, marginBottom: 10 }}>Update property details</h4>
      <Row label="OTP status">
        <select value={v.otpStatus} onChange={e => setV({ ...v, otpStatus: e.target.value })} style={input}>
          <option value="searching">Still shopping — no OTP yet</option>
          <option value="offer_signed">✓ I've signed an Offer to Purchase</option>
        </select>
      </Row>
      <Row label="Property type">
        <select value={v.propertyType} onChange={e => setV({ ...v, propertyType: e.target.value })} style={input}>
          <option>House</option><option>Apartment</option><option>Townhouse</option><option>Plot</option><option>Other</option>
        </select>
      </Row>
      <Row label="Purchase price (R)"><input type="number" value={v.purchasePrice} onChange={e => setV({ ...v, purchasePrice: e.target.value })} style={input} placeholder="1750000" /></Row>
      <Row label="Deposit (R)"><input type="number" value={v.deposit} onChange={e => setV({ ...v, deposit: e.target.value })} style={input} placeholder="175000" /></Row>
      <Row label="Suburb"><input value={v.suburb} onChange={e => setV({ ...v, suburb: e.target.value })} style={input} placeholder="Sandton" /></Row>
      <Row label="Province">
        <select value={v.province} onChange={e => setV({ ...v, province: e.target.value })} style={input}>
          {['Gauteng','Western Cape','KwaZulu-Natal','Eastern Cape','Free State','Limpopo','Mpumalanga','North West','Northern Cape'].map(p => <option key={p}>{p}</option>)}
        </select>
      </Row>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'flex-end' }}>
        <button onClick={onCancel} style={btnGhost}>Cancel</button>
        <button onClick={() => onSave(v)} style={btnPrimary}>Save</button>
      </div>
    </div>
  );
}

function CoApplicantEditor({ value, onSave, onCancel }) {
  const [v, setV] = useState({
    name:          value?.name          || '',
    relationship:  value?.relationship  || 'Spouse',
    monthlyIncome: value?.monthlyIncome || '',
    monthlyDebt:   value?.monthlyDebt   || '',
    employmentType:value?.employmentType|| 'Permanent',
  });
  return (
    <div style={{ marginTop: 14, padding: 14, border: '1px solid var(--border-color)', borderRadius: 8 }}>
      <h4 style={{ fontWeight: 700, marginBottom: 10 }}>{value ? 'Edit co-applicant' : 'Add a co-applicant'}</h4>
      <Row label="Their full name"><input value={v.name} onChange={e => setV({ ...v, name: e.target.value })} style={input} /></Row>
      <Row label="Relationship">
        <select value={v.relationship} onChange={e => setV({ ...v, relationship: e.target.value })} style={input}>
          <option>Spouse</option><option>Partner</option><option>Parent</option><option>Sibling</option><option>Other</option>
        </select>
      </Row>
      <Row label="Their monthly income (R)"><input type="number" value={v.monthlyIncome} onChange={e => setV({ ...v, monthlyIncome: e.target.value })} style={input} placeholder="35000" /></Row>
      <Row label="Their monthly debt (R)"><input type="number" value={v.monthlyDebt} onChange={e => setV({ ...v, monthlyDebt: e.target.value })} style={input} placeholder="4500" /></Row>
      <Row label="Employment">
        <select value={v.employmentType} onChange={e => setV({ ...v, employmentType: e.target.value })} style={input}>
          <option>Permanent</option><option>Contract</option><option>Self-employed</option><option>Commission</option><option>Other</option>
        </select>
      </Row>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, justifyContent: 'space-between' }}>
        <button onClick={() => onSave(null)} style={{ ...btnGhost, color: '#991b1b' }}>Remove co-applicant</button>
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={onCancel} style={btnGhost}>Cancel</button>
          <button onClick={() => onSave(v)} style={btnPrimary}>Save</button>
        </div>
      </div>
    </div>
  );
}

function ExternalOffersPanel({ cappId, offers, onChange }) {
  const [adding, setAdding] = useState(false);
  const [v, setV] = useState({ bankName: 'FNB', rate: '', monthly: '', term: '240', conditions: '', validUntil: '' });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  async function submit(e) {
    e.preventDefault(); setErr(null); setBusy(true);
    try {
      await myApplication.addExternalOffer(cappId, v);
      setAdding(false); setV({ bankName: 'FNB', rate: '', monthly: '', term: '240', conditions: '', validUntil: '' });
      onChange?.();
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }
  async function remove(oid) {
    if (!confirm('Remove this offer?')) return;
    try { await myApplication.removeExternalOffer(cappId, oid); onChange?.(); }
    catch (e) { alert(e.message); }
  }

  return (
    <div style={{ marginTop: 10, padding: 12, background: 'var(--bg-page)', borderRadius: 8, border: '1px solid var(--border-color)' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
        <strong style={{ fontSize: '0.85rem' }}>Other offers you have</strong>
        {!adding && (
          <button onClick={() => setAdding(true)} style={{ background: 'transparent', color: 'var(--mint, #16a34a)', border: 'none', cursor: 'pointer', fontSize: '0.78rem', fontWeight: 700 }}>
            + Add an offer
          </button>
        )}
      </div>
      <div style={{ fontSize: '0.74rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
        Have you been quoted by your own broker or another bank? Tell us — banks bidding here will see the offer and try to beat it.
      </div>

      {offers.length === 0 && !adding && (
        <div style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontStyle: 'italic' }}>None added yet.</div>
      )}

      {offers.map(o => (
        <div key={o.id} style={{
          display: 'flex', justifyContent: 'space-between', alignItems: 'center',
          padding: '8px 10px', background: 'var(--bg-card)', border: '1px solid var(--border-color)',
          borderRadius: 6, marginBottom: 6, fontSize: '0.85rem',
        }}>
          <div>
            <strong>{o.bankName}</strong> · {o.rate?.toFixed(2)}%
            {o.monthly ? <span style={{ color: 'var(--text-secondary)' }}> · {fmt(o.monthly)}/mo</span> : null}
            {o.validUntil ? <span style={{ color: 'var(--text-secondary)', fontSize: '0.72rem', marginLeft: 8 }}>valid {new Date(o.validUntil).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' })}</span> : null}
          </div>
          <button onClick={() => remove(o.id)} style={{ background: 'transparent', color: '#991b1b', border: 'none', cursor: 'pointer', fontSize: '0.74rem' }}>
            Remove
          </button>
        </div>
      ))}

      {adding && (
        <form onSubmit={submit} style={{ marginTop: 8, padding: 10, border: '1px solid var(--border-color)', borderRadius: 6, background: 'var(--bg-card)' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8 }}>
            <label style={lblStyle}>
              <span>Bank</span>
              <select value={v.bankName} onChange={e => setV({ ...v, bankName: e.target.value })} style={input}>
                {['ABSA','FNB','Nedbank','Standard Bank','Capitec','Investec','SA Home Loans','Other'].map(b => <option key={b}>{b}</option>)}
              </select>
            </label>
            <label style={lblStyle}>
              <span>Rate (%)</span>
              <input type="number" step="0.05" value={v.rate} onChange={e => setV({ ...v, rate: e.target.value })} style={input} placeholder="11.10" required />
            </label>
            <label style={lblStyle}>
              <span>Monthly (R)</span>
              <input type="number" value={v.monthly} onChange={e => setV({ ...v, monthly: e.target.value })} style={input} placeholder="optional" />
            </label>
            <label style={lblStyle}>
              <span>Term (months)</span>
              <input type="number" value={v.term} onChange={e => setV({ ...v, term: e.target.value })} style={input} />
            </label>
            <label style={lblStyle}>
              <span>Valid until</span>
              <input type="date" value={v.validUntil} onChange={e => setV({ ...v, validUntil: e.target.value })} style={input} />
            </label>
          </div>
          <label style={{ ...lblStyle, marginTop: 8, display: 'block' }}>
            <span>Conditions (optional)</span>
            <input value={v.conditions} onChange={e => setV({ ...v, conditions: e.target.value })} style={input} placeholder="e.g. Subject to property valuation, life cover required" />
          </label>
          {err && <div style={{ color: '#991b1b', fontSize: '0.78rem', marginTop: 6 }}>{err}</div>}
          <div style={{ display: 'flex', gap: 6, justifyContent: 'flex-end', marginTop: 8 }}>
            <button type="button" onClick={() => setAdding(false)} style={btnGhost}>Cancel</button>
            <button type="submit" disabled={busy} style={btnPrimary}>{busy ? 'Saving…' : 'Save offer'}</button>
          </div>
        </form>
      )}
    </div>
  );
}
const lblStyle = { display: 'flex', flexDirection: 'column', gap: 3, fontSize: '0.72rem', color: 'var(--text-secondary)', fontWeight: 700 };

function Row({ label, children }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <label style={{ fontSize: '0.78rem', color: 'var(--text-secondary)', fontWeight: 600 }}>{label}</label>
      {children}
    </div>
  );
}
const input = { width: '100%', padding: '7px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: '0.875rem', background: 'var(--bg-card)' };
const btnGhost = { background: 'transparent', border: '1px solid var(--border-color)', padding: '7px 14px', borderRadius: 7, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' };
const btnPrimary = { background: 'var(--forest, #1e3a5f)', color: '#fff', border: 'none', padding: '7px 16px', borderRadius: 7, fontSize: '0.82rem', fontWeight: 700, cursor: 'pointer' };

function viewerActionLabel(a) {
  return ({
    view_detail:   'viewed application',
    view_document: 'opened a document',
    submit_bid:    'submitted a bid',
    update_bid:    'updated their bid',
    withdraw_bid:  'withdrew their bid',
  })[a] || a;
}

function ScoreCoachCard() {
  const [data, setData] = useState(null);
  useEffect(() => {
    offers.qualityCoaching().then(d => { if (d?.tips) setData(d); }).catch(() => {});
  }, []);
  if (!data || !data.tips) return null;
  return (
    <div className="card" style={{ padding: 20, background: 'linear-gradient(180deg, #fefce8 0%, #ffffff 100%)', border: '1px solid #fde68a' }}>
      <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: '#78350f', fontWeight: 800, marginBottom: 4 }}>
        💪 Score coach · current Bondly score {data.currentScore}/100
      </div>
      <div style={{ fontSize: '0.875rem', color: 'var(--text-primary)', whiteSpace: 'pre-wrap', lineHeight: 1.6, marginTop: 6 }}>{data.tips}</div>
    </div>
  );
}

function NpsPrompt({ cappId, stages }) {
  const settled = stages?.find(s => s.id === 'settled')?.done;
  const [rating, setRating] = useState(null);
  const [comment, setComment] = useState('');
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);
  if (!settled || done) return null;
  async function submit() {
    setBusy(true);
    try { await offers.submitNps(cappId, rating, comment); setDone(true); }
    catch (e) { alert(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="card" style={{ padding: 18, marginBottom: 10, background: '#f0fdf4', border: '1px solid #bbf7d0' }}>
      <div style={{ fontWeight: 700, marginBottom: 6 }}>🎉 Your bond is settled — how did we do?</div>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 10 }}>
        On a scale of 0 to 10, how likely are you to recommend Bondly to a friend?
      </div>
      <div style={{ display: 'flex', gap: 4, marginBottom: 10, flexWrap: 'wrap' }}>
        {[0,1,2,3,4,5,6,7,8,9,10].map(n => (
          <button key={n} onClick={() => setRating(n)}
            style={{ width: 32, height: 32, border: '1px solid ' + (rating === n ? '#16a34a' : '#e5e7eb'), background: rating === n ? '#16a34a' : '#fff', color: rating === n ? '#fff' : '#0f1a24', borderRadius: 6, fontWeight: 700, cursor: 'pointer' }}>
            {n}
          </button>
        ))}
      </div>
      {rating != null && (
        <>
          <textarea value={comment} onChange={e => setComment(e.target.value)} placeholder="Tell us why (optional)"
            style={{ width: '100%', padding: 8, border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.86rem', minHeight: 60, marginBottom: 8 }} />
          <button onClick={submit} disabled={busy}
            style={{ padding: '8px 18px', background: 'var(--forest, #1e3a5f)', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer' }}>
            {busy ? 'Sending…' : 'Submit'}
          </button>
        </>
      )}
    </div>
  );
}

function ExplainOffersCard() {
  const [text, setText] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);
  async function explain() {
    setBusy(true); setErr(null);
    try { const r = await offers.explainOffers(); setText(r.explanation); }
    catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="card" style={{ padding: 18, marginBottom: 10, background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)', border: '1px solid #ddd6fe' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <div>
          <strong style={{ color: '#5b21b6' }}>🤖 Not sure which offer to pick?</strong>
          <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginTop: 4 }}>
            Get a plain-English comparison from our AI assistant — no jargon, no bias.
          </div>
        </div>
        {!text && (
          <button onClick={explain} disabled={busy}
            style={{ padding: '9px 18px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: '0.86rem', cursor: 'pointer' }}>
            {busy ? 'Thinking…' : 'Explain my offers'}
          </button>
        )}
      </div>
      {err && <div style={{ color: '#991b1b', fontSize: '0.82rem', marginTop: 10 }}>{err}</div>}
      {text && (
        <div style={{ marginTop: 12, padding: 12, background: '#fff', border: '1px solid #ddd6fe', borderRadius: 7, fontSize: '0.875rem', lineHeight: 1.6, whiteSpace: 'pre-wrap' }}>
          {text}
        </div>
      )}
    </div>
  );
}

function CustomerDealMessages({ cappId, bankName }) {
  const [msgs, setMsgs] = useState(null);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  function load() { offers.dealMessages(cappId).then(d => setMsgs(d.messages)).catch(() => {}); }
  useEffect(() => { load(); const t = setInterval(load, 10000); return () => clearInterval(t); }, [cappId]);

  async function send(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setBusy(true);
    try { await offers.sendDealMessage(cappId, text); setText(''); load(); }
    catch (e2) { alert(e2.message); } finally { setBusy(false); }
  }

  if (!msgs || msgs.length === 0) {
    return (
      <div className="card" style={{ padding: 14, marginBottom: 10 }}>
        <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
          💬 Message your contact at <strong>{bankName}</strong>
        </div>
        <form onSubmit={send} style={{ display: 'flex', gap: 6 }}>
          <input value={text} onChange={e => setText(e.target.value)} placeholder="Ask a question, share an update…" style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: '0.86rem' }} />
          <button type="submit" disabled={busy || !text.trim()} style={{ padding: '8px 14px', background: 'var(--forest, #1e3a5f)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Send</button>
        </form>
      </div>
    );
  }
  return (
    <div className="card" style={{ padding: 14, marginBottom: 10 }}>
      <div style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', marginBottom: 8 }}>
        💬 Messages with <strong>{bankName}</strong>
      </div>
      <div style={{ maxHeight: 240, overflowY: 'auto', padding: 8, background: 'var(--bg-page)', borderRadius: 7, marginBottom: 8 }}>
        {msgs.map(m => (
          <div key={m.id} style={{ marginBottom: 6, display: 'flex', flexDirection: 'column', alignItems: m.fromRole === 'customer' ? 'flex-end' : 'flex-start' }}>
            <div style={{
              maxWidth: '85%', padding: '7px 11px', borderRadius: 8,
              background: m.fromRole === 'customer' ? 'var(--forest, #1e3a5f)' : '#fff',
              color: m.fromRole === 'customer' ? '#fff' : 'var(--text-primary)',
              border: m.fromRole === 'customer' ? 'none' : '1px solid var(--border-color)',
              fontSize: '0.82rem',
            }}>{m.text}</div>
            <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginTop: 2 }}>
              {m.fromName} · {new Date(m.at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
            </div>
          </div>
        ))}
      </div>
      <form onSubmit={send} style={{ display: 'flex', gap: 6 }}>
        <input value={text} onChange={e => setText(e.target.value)} placeholder="Reply…" style={{ flex: 1, padding: '8px 10px', border: '1px solid var(--border-color)', borderRadius: 6, fontSize: '0.86rem' }} />
        <button type="submit" disabled={busy || !text.trim()} style={{ padding: '8px 14px', background: 'var(--forest, #1e3a5f)', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>Send</button>
      </form>
    </div>
  );
}
