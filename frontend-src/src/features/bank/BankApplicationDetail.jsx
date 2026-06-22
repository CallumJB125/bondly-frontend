import { useEffect, useMemo, useRef, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { bankApi, bankFmtR, bankFmtPct, monthlyFromRate, getBankToken } from './bankApi.js';

function getRecommendation(a) {
  const score = a.qualityScore ?? 0;
  const tier = a.riskTier;
  if (tier === 'critical' || score < 30) return 'decline';
  if (tier === 'red') return 'refer';
  if (tier === 'green' && score >= 70) return 'bid';
  return 'hold';
}

function getGrade(score) {
  if (score >= 85) return 'A';
  if (score >= 75) return 'B';
  if (score >= 60) return 'C';
  if (score >= 40) return 'D';
  return 'E';
}

function getHeadlineReason(a, d) {
  const score = a.qualityScore ?? 0;
  const dti = d?.dtiExact;
  if (a.fraudFlag) return 'Fraud signal flagged — review before bidding';
  if (a.riskTier === 'critical') return 'Critical risk — recommend decline';
  if (a.riskTier === 'red') return 'Elevated risk — refer to credit committee';
  if (dti != null && dti > 40) return `Debt-to-income ${dti}% — above 40% threshold`;
  if (a.verifiedIncome && score >= 80) return 'Strong affordability · income verified via payslip';
  if (score >= 80) return 'Strong affordability profile';
  return 'Review the detail below';
}

const REC_STYLES = {
  bid:     { bg: '#dcfce7', color: '#166534', label: 'Bid' },
  hold:    { bg: '#fef3c7', color: '#92400e', label: 'Hold' },
  refer:   { bg: '#ede9fe', color: '#5b21b6', label: 'Refer' },
  decline: { bg: '#fee2e2', color: '#991b1b', label: 'Decline' },
};

function DecisionHeader({ a, d, ins }) {
  const [whyOpen, setWhyOpen] = useState(false);
  const [decision, setDecision] = useState(a?.myDecision || null); // 'referred' | 'declined' (seeded from backend)
  const [toast, setToast] = useState(null);

  function showToast(text, kind) {
    setToast({ text, kind });
    setTimeout(() => setToast(t => (t && t.text === text ? null : t)), 5000);
  }

  async function handleRefer() {
    if (!a?.ref) return;
    const prev = decision; setDecision('referred'); // optimistic
    try { await bankApi.refer(a.ref); showToast('Referred to the credit desk — the committee will review this file.', 'refer'); }
    catch (e) { setDecision(prev); showToast('Could not refer: ' + (e.message || 'error'), 'decline'); }
  }

  async function handleDecline() {
    if (!a?.ref) return;
    if (!window.confirm('Decline this application? You can change this later.')) return;
    const prev = decision; setDecision('declined'); // optimistic
    try { await bankApi.decline(a.ref); showToast('Application declined.', 'decline'); }
    catch (e) { setDecision(prev); showToast('Could not decline: ' + (e.message || 'error'), 'decline'); }
  }

  const rec = getRecommendation(a);
  const grade = getGrade(a.qualityScore ?? 0);
  const headline = getHeadlineReason(a, d);
  const recStyle = REC_STYLES[rec];
  const dti = d?.dtiExact;
  const dtiColor = dti == null ? '#6b7280' : dti < 30 ? '#15803d' : dti <= 40 ? '#b45309' : '#dc2626';
  const verdictReasons = ins?.verdict?.slice(0, 3) || [];

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 10,
      padding: '16px 20px',
      marginBottom: 18,
      boxShadow: '0 1px 4px rgba(11,30,45,0.06)',
    }}>
      {/* Layer 1 — always visible */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
        <span style={{
          background: recStyle.bg, color: recStyle.color,
          padding: '4px 13px', borderRadius: 99, fontWeight: 800,
          fontSize: '0.8rem', letterSpacing: '0.04em', textTransform: 'uppercase',
        }}>
          {recStyle.label}
        </span>
        <span style={{
          background: '#0b1e2d', color: '#c8a84b',
          padding: '4px 11px', borderRadius: 99, fontWeight: 800,
          fontSize: '0.78rem', letterSpacing: '0.06em',
        }}>
          Grade {grade}
        </span>
        <span style={{ color: '#374151', fontSize: '0.88rem', fontWeight: 500, flex: 1, minWidth: 160 }}>
          {headline}
        </span>
      </div>

      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <button
          onClick={() => window.dispatchEvent(new CustomEvent('bank:bid', { detail: { ref: a.ref } }))}
          style={{
            background: '#c8a84b', color: '#fff', border: 'none',
            borderRadius: 7, padding: '8px 18px', fontWeight: 700,
            fontSize: '0.85rem', cursor: 'pointer', letterSpacing: '0.01em',
          }}
        >
          Set rate &amp; bid
        </button>
        <button
          onClick={handleRefer}
          disabled={decision != null}
          style={{
            background: '#0b1e2d', color: '#fff', border: 'none',
            borderRadius: 7, padding: '8px 18px', fontWeight: 700,
            fontSize: '0.85rem', cursor: decision != null ? 'default' : 'pointer',
            opacity: decision != null ? 0.5 : 1,
          }}
        >
          {decision === 'referred' ? 'Referred to credit ✓' : 'Refer to credit'}
        </button>
        <button
          onClick={handleDecline}
          disabled={decision != null}
          style={{
            background: '#dc2626', color: '#fff', border: 'none',
            borderRadius: 7, padding: '8px 18px', fontWeight: 700,
            fontSize: '0.85rem', cursor: decision != null ? 'default' : 'pointer',
            opacity: decision != null ? 0.5 : 1,
          }}
        >
          {decision === 'declined' ? 'Declined ✓' : 'Decline'}
        </button>
      </div>

      {toast && (
        <div role="status" style={{
          marginBottom: 14, padding: '9px 14px', borderRadius: 7, fontSize: '0.82rem', fontWeight: 600,
          background: toast.kind === 'decline' ? '#fee2e2' : '#ede9fe',
          color: toast.kind === 'decline' ? '#991b1b' : '#5b21b6',
          border: `1px solid ${toast.kind === 'decline' ? '#fecaca' : '#ddd6fe'}`,
        }}>
          {toast.text}
        </div>
      )}

      <div style={{ display: 'flex', gap: 20, borderTop: '1px solid #f3f4f6', paddingTop: 10 }}>
        <button
          onClick={() => setWhyOpen(v => !v)}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: '#6b7280', fontSize: '0.8rem', fontWeight: 600,
          }}
        >
          {whyOpen ? '↑ Hide recommendation' : '↓ Why this recommendation'}
        </button>
        <button
          onClick={() => {
            setWhyOpen(false);
            document.querySelector('.bank-detail-grid')?.scrollIntoView({ behavior: 'smooth' });
          }}
          style={{
            background: 'none', border: 'none', padding: 0, cursor: 'pointer',
            color: '#6b7280', fontSize: '0.8rem', fontWeight: 600,
          }}
        >
          ↓ Full data
        </button>
      </div>

      {/* Layer 2 — expanded reasoning */}
      {whyOpen && (
        <div style={{
          marginTop: 14, paddingTop: 14, borderTop: '1px solid #f3f4f6',
          display: 'flex', flexDirection: 'column', gap: 10,
        }}>
          {verdictReasons.length > 0 && (
            <div>
              <div style={{ fontSize: '0.72rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: '#9ca3af', fontWeight: 700, marginBottom: 6 }}>
                Top signals
              </div>
              {verdictReasons.map((v, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 8, marginBottom: 4 }}>
                  <span style={{ color: '#c8a84b', fontWeight: 800, flexShrink: 0 }}>{i + 1}</span>
                  <span style={{ fontSize: '0.84rem', color: '#374151' }}>{v}</span>
                </div>
              ))}
            </div>
          )}

          {a.fraudFlag && (
            <div style={{
              background: '#fee2e2', border: '1px solid #fca5a5',
              borderRadius: 7, padding: '10px 14px',
            }}>
              <div style={{ fontWeight: 800, color: '#991b1b', fontSize: '0.82rem', marginBottom: 2 }}>
                Fraud signal detected
              </div>
              {a.fraudReason && (
                <div style={{ fontSize: '0.8rem', color: '#7f1d1d' }}>{a.fraudReason}</div>
              )}
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            {dti != null && (
              <div style={{
                background: '#f9fafb', border: '1px solid #e5e7eb',
                borderRadius: 7, padding: '8px 14px', minWidth: 120,
              }}>
                <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                  DTI
                </div>
                <div style={{ fontSize: '1rem', fontWeight: 800, color: dtiColor }}>
                  {dti}%
                </div>
                <div style={{ fontSize: '0.72rem', color: '#6b7280' }}>
                  {dti < 30 ? 'Below 30% — healthy' : dti <= 40 ? '30–40% — watch' : 'Above 40% — high'}
                </div>
              </div>
            )}
            <div style={{
              background: '#f9fafb', border: '1px solid #e5e7eb',
              borderRadius: 7, padding: '8px 14px', minWidth: 120,
            }}>
              <div style={{ fontSize: '0.7rem', color: '#9ca3af', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 2 }}>
                Income
              </div>
              <div style={{ fontSize: '0.88rem', fontWeight: 700, color: a.verifiedIncome ? '#15803d' : '#6b7280' }}>
                {a.verifiedIncome ? '✓ Verified via payslip' : 'Self-declared'}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Explain({ text }) {
  const [show, setShow] = useState(false);
  return (
    <span style={{ position: 'relative', display: 'inline-block', marginLeft: 4 }}>
      <span
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        style={{ cursor: 'help', color: '#9ca3af', fontSize: '0.7rem', border: '1px solid #d1d5db', borderRadius: '50%', width: 14, height: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700 }}
      >?</span>
      {show && (
        <span style={{ position: 'absolute', left: 20, top: -4, zIndex: 100, background: '#0b1e2d', color: '#fff', padding: '6px 10px', borderRadius: 7, fontSize: '0.75rem', width: 220, lineHeight: 1.45, boxShadow: '0 4px 16px rgba(0,0,0,0.2)', whiteSpace: 'normal' }}>
          {text}
        </span>
      )}
    </span>
  );
}

export default function BankApplicationDetail() {
  const { ref } = useParams();
  const [data, setData]   = useState(null);
  const [err, setErr]     = useState(null);
  const [reload, setRel]  = useState(0);

  useEffect(() => {
    bankApi.application(ref).then(setData).catch(e => setErr(e.message));
  }, [ref, reload]);

  if (err)   return <div className="bank-section" style={{ color: '#991b1b' }}>Could not load: {err} · <Link to="/bank/applications">Back</Link></div>;
  if (!data) return <div className="bank-section">Loading…</div>;

  const a = data.application;
  const d = a.detail;
  const ins = d?.insights;
  const mine = data.competingBids.find(b => b.isMine);
  const lowestCompetingRate = data.competingBids
    .filter(b => !b.isMine && b.status === 'active')
    .reduce((min, b) => b.rate < min ? b.rate : min, Infinity);
  const externalOffers = data.externalOffers || [];
  const lowestExternalRate = externalOffers.reduce((min, o) => o.rate < min ? o.rate : min, Infinity);
  // The "true" rate to beat is the lowest of (Bondly competing) and (external declared)
  const rateToBeat = Math.min(lowestCompetingRate, lowestExternalRate);

  return (
    <DetailBody
      a={a} d={d} ins={ins} mine={mine} ref_={ref}
      data={data} externalOffers={externalOffers}
      lowestCompetingRate={rateToBeat === Infinity ? null : rateToBeat}
      onChange={() => setRel(x => x + 1)}
    />
  );
}

// Split out so the lifted bid state (shared by the inline BidBox and the sticky
// bar) lives in one place above both consumers.
function DetailBody({ a, d, ins, mine, ref_, data, externalOffers, lowestCompetingRate, onChange }) {
  const ref = ref_;
  const bid = useBidState({ application: a, insights: ins, mine, lowestCompetingRate, onChange });

  // The DecisionHeader's "Set rate & bid" button dispatches a `bank:bid` event;
  // jump to the inline form and focus the rate input.
  useEffect(() => {
    function onBidEvent() {
      const box = document.getElementById('bid-box');
      box?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (box) { // brief highlight so the action is obviously responsive (#3)
        box.style.transition = 'box-shadow .2s'; box.style.boxShadow = '0 0 0 3px #c8a84b';
        setTimeout(() => { box.style.boxShadow = ''; }, 1100);
      }
      setTimeout(() => document.getElementById('sticky-rate-input')?.focus(), 200);
    }
    window.addEventListener('bank:bid', onBidEvent);
    return () => window.removeEventListener('bank:bid', onBidEvent);
  }, []);

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
        <Link to="/bank/applications" style={{ color: '#6b7280', fontSize: '0.78rem', textDecoration: 'none' }}>← Back to open mortgages</Link>
      </div>
      <h2 style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <span style={{ fontFamily: 'monospace' }}>{a.ref}</span>
        <span className={'type-tag ' + a.type}>{a.type === 'swap' ? 'Switch' : 'New bond'}</span>
        <ScoreChip score={a.qualityScore} />
        {a.returningCustomer && (
          <span style={{ background: 'linear-gradient(90deg,#7c3aed,#5b21b6)', color: '#fff', padding: '3px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em', textTransform: 'uppercase' }}>
            ⭐ Returning customer · {a.returningCustomer.priorBondCount} prior bond{a.returningCustomer.priorBondCount === 1 ? '' : 's'}
          </span>
        )}
        {a.docStaleness && a.docStaleness.length > 0 && (
          <span style={{ background: '#fee2e2', color: '#991b1b', padding: '3px 10px', borderRadius: 99, fontSize: '0.7rem', fontWeight: 800, textTransform: 'uppercase' }} title={a.docStaleness.map(d => `${d.type} ${d.days}d old`).join(', ')}>
            ⚠ stale docs
          </span>
        )}
      </h2>
      <p className="lede">
        {bankFmtR(a.requestedAmount)} · {a.region}{a.ageBand ? ' · ' + a.ageBand : ''} · Submitted {new Date(a.submittedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}
      </p>

      {ins?.verdict?.length > 0 && (
        <div className="verdict-bar">
          {ins.verdict.map((v, i) => (
            <div key={v} className="verdict-bullet">
              <span className="num">{i + 1}</span>
              <span>{v}</span>
            </div>
          ))}
        </div>
      )}

      <div className="bank-popia-banner">
        <span className="pulse" />
        <span>
          <strong>POPIA notice:</strong> the customer can see every view, document open, and bid action.
          Personal details (name, contact, ID) only unlock when they accept your offer.
        </span>
      </div>

      <DecisionHeader a={a} d={d} ins={ins} />

      <div className="bank-detail-grid">
        <div className="col-main">

          {/* Headline numbers */}
          <div className="bank-section">
            <h3>Headline</h3>
            <div className="bank-row">
              <span className="k">Monthly income<Explain text="The applicant's average monthly take-home pay. We use 3+ months of bank statements to calculate this — it's more reliable than a payslip alone." /></span>
              <span className="v">
                {d?.incomeAvg ? bankFmtR(d.incomeAvg) : '—'}
                {a.incomeBand && <span style={{ color: '#6b7280', fontWeight: 500, marginLeft: 6 }}>({a.incomeBand})</span>}
                {' '}
                {a.verifiedIncome
                  ? <span style={{ color: '#15803d', fontSize: '0.75rem' }}>✓ verified via payslip</span>
                  : <span style={{ color: '#6b7280', fontSize: '0.75rem' }}>self-declared</span>}
              </span>
            </div>
            <div className="bank-row">
              <span className="k">Monthly fixed debt<Explain text="Total monthly debt obligations: bond, car finance, personal loans, credit cards. This is what rate shocks hit directly." /></span>
              <span className="v">{d?.fixedDebt != null ? bankFmtR(d.fixedDebt) : '—'}</span>
            </div>
            <div className="bank-row">
              <span className="k">Debt-to-income<Explain text="Percentage of monthly income already committed to debt repayments. NCA guidelines flag anything above 40% as over-indebted. Below 30% is comfortable." /></span>
              <span className="v">{d?.dtiExact != null ? d.dtiExact + ' %' : '—'} <span style={{ color: '#6b7280', fontWeight: 500 }}>({a.dtiBand})</span></span>
            </div>
            <div className="bank-row"><span className="k">Employment</span><span className="v">{a.employmentType ? a.employmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'}{a.employmentTenureYears ? ' · ' + a.employmentTenureYears + ' yrs tenure' : ''}</span></div>
            <div className="bank-row"><span className="k">Bank statement coverage<Explain text="Number of months of bank statements on file. 3 months is the minimum; 6+ months gives a much more reliable picture of income patterns and spending habits." /></span><span className="v">{a.monthsOfStatements} month{a.monthsOfStatements === 1 ? '' : 's'}</span></div>
          </div>

          {d?.roadmap && (
            <div className="bank-section" style={{ border: '1px solid #c4b5fd', background: 'linear-gradient(180deg,#faf5ff,#fff)', borderRadius: 10 }}>
              <h3 style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                Cross-bank intelligence
                <span style={{ fontSize: '0.62rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: '#6d28d9', background: '#ede9fe', border: '1px solid #ddd6fe', borderRadius: 999, padding: '2px 8px' }}>Roadmap · simulated</span>
              </h3>
              <p style={{ margin: '0 0 10px', fontSize: '0.78rem', color: '#6b7280' }}>
                Only Bondly sees this applicant's flows across <em>all</em> their banks (by consent). Preview of roadmap signals — not live.
              </p>
              <div className="bank-row">
                <span className="k">True cross-bank DTI<Explain text="Debt-to-income recomputed across every bank the applicant uses — including obligations they did not declare and that the bureau has not yet reported." /></span>
                <span className="v">
                  {d.roadmap.crossBankAffordability.trueCrossBankDTI} %
                  {d.roadmap.crossBankAffordability.trueCrossBankDTI > d.roadmap.crossBankAffordability.declaredDTI && (
                    <span style={{ color: '#b91c1c', fontWeight: 600, marginLeft: 6 }}>▲ vs {d.roadmap.crossBankAffordability.declaredDTI}% declared</span>
                  )}
                </span>
              </div>
              {d.roadmap.crossBankAffordability.undisclosedDebtMonthly > 0 && (
                <div className="bank-row">
                  <span className="k">Undisclosed debt found</span>
                  <span className="v" style={{ color: '#b91c1c' }}>
                    {bankFmtR(d.roadmap.crossBankAffordability.undisclosedDebtMonthly)}/mo · {d.roadmap.crossBankAffordability.otherBankObligations.map(o => `${o.kind} (${o.bank})`).join(', ')}
                  </span>
                </div>
              )}
              <div className="bank-row">
                <span className="k">Primary bank<Explain text="Where the applicant's salary actually lands and the bulk of their money moves. Predicts whether winning this bond also wins the banking relationship." /></span>
                <span className="v">
                  {d.roadmap.primacy.primaryBank} <span style={{ color: '#6b7280', fontWeight: 500 }}>({d.roadmap.primacy.shareOfWalletPct}% share-of-wallet)</span>
                  {d.roadmap.primacy.salaryWithUs
                    ? <span style={{ color: '#15803d', fontSize: '0.75rem', marginLeft: 6 }}>✓ salary already with you</span>
                    : <span style={{ color: '#b45309', fontSize: '0.75rem', marginLeft: 6 }}>salary at a rival</span>}
                </span>
              </div>
              {d.roadmap.primacy.relationshipUpliftLifetime > 0 && (
                <div className="bank-row">
                  <span className="k">Win-the-salary uplift</span>
                  <span className="v" style={{ color: '#15803d' }}>+{bankFmtR(d.roadmap.primacy.relationshipUpliftLifetime)} lifetime relationship value</span>
                </div>
              )}
              <div className="bank-row">
                <span className="k">Switch propensity<Explain text="Likelihood this borrower refinances/switches soon, from cross-bank rate-sensitivity and salary-movement signals — the consent-based version of a bureau trigger lead." /></span>
                <span className="v">
                  {d.roadmap.switchPropensity.score}/100
                  {d.roadmap.switchPropensity.flightSignals.length > 0 && (
                    <span style={{ color: '#6b7280', fontWeight: 500, marginLeft: 6 }}>· {d.roadmap.switchPropensity.flightSignals.join(', ')}</span>
                  )}
                </span>
              </div>
              {d.roadmap.incomeVerification && (
                <div className="bank-row">
                  <span className="k">Cross-account income<Explain text="Income verified across every bank the applicant uses, not just the one statement on file — salary often lands at a different bank." /></span>
                  <span className="v">
                    Verified across {d.roadmap.incomeVerification.accountsSeen} account{d.roadmap.incomeVerification.accountsSeen === 1 ? '' : 's'} · {d.roadmap.incomeVerification.monthsCovered} months · {d.roadmap.incomeVerification.stability}
                    {d.roadmap.incomeVerification.accountsSeen > 1 && d.monthsOfStatements === 1 && (
                      <span style={{ color: '#15803d', fontSize: '0.75rem', marginLeft: 6 }}>✓ resolves the single-month file</span>
                    )}
                  </span>
                </div>
              )}
              {d.roadmap.distressEarlyWarning.atRisk && (
                <div className="bank-row">
                  <span className="k">Distress early-warning<Explain text="Cross-bank distress fires when income stops at the salary bank and debit orders start failing at a different bank — detected before it becomes a bureau-reported arrear." /></span>
                  <span className="v" style={{ color: '#b91c1c' }}>
                    {d.roadmap.distressEarlyWarning.leadDaysVsBureau} days ahead of bureau
                    {d.roadmap.distressEarlyWarning.signals.length > 0 && (
                      <span style={{ color: '#6b7280', fontWeight: 500, marginLeft: 6 }}>· {d.roadmap.distressEarlyWarning.signals.join('; ')}</span>
                    )}
                  </span>
                </div>
              )}
            </div>
          )}

          {a.swapContext && (
            <div className="bank-section">
              <h3>Current bond (switch)</h3>
              <div className="bank-row"><span className="k">Currently with</span><span className="v">{a.swapContext.currentBank || '—'}</span></div>
              <div className="bank-row"><span className="k">Current rate</span><span className="v">{a.swapContext.currentRate != null ? bankFmtPct(a.swapContext.currentRate) : '—'}</span></div>
              <div className="bank-row"><span className="k">Current balance</span><span className="v">{bankFmtR(a.swapContext.currentBalance)}</span></div>
              <div className="bank-row"><span className="k">Current monthly</span><span className="v">{bankFmtR(a.swapContext.currentMonthly)}</span></div>
              <div className="bank-row"><span className="k">Months remaining</span><span className="v">{a.swapContext.monthsRemaining || '—'}</span></div>
            </div>
          )}

          {a.propertyContext && (
            <div className="bank-section">
              <h3>
                Property
                <span style={{
                  marginLeft: 10, padding: '2px 10px', borderRadius: 999,
                  fontSize: '0.7rem', fontWeight: 800, letterSpacing: '0.04em',
                  background: a.propertyContext.otpStatus === 'offer_signed' ? '#dcfce7' : '#fef3c7',
                  color:      a.propertyContext.otpStatus === 'offer_signed' ? '#166534' : '#92400e',
                  textTransform: 'uppercase',
                }}>
                  {a.propertyContext.otpStatus === 'offer_signed' ? '✓ OTP signed' : 'Pre-approval'}
                </span>
              </h3>
              {a.propertyContext.otpStatus !== 'offer_signed' && (
                <div style={{ fontSize: '0.78rem', color: '#92400e', background: '#fffbeb', border: '1px solid #fde68a', padding: '8px 10px', borderRadius: 6, marginBottom: 10 }}>
                  Customer is still shopping. Your offer is indicative until they sign an Offer to Purchase.
                </div>
              )}
              <div className="bank-row"><span className="k">Purchase price</span><span className="v">{bankFmtR(a.propertyContext.purchasePrice)}</span></div>
              <div className="bank-row"><span className="k">Deposit</span><span className="v">{bankFmtR(a.propertyContext.deposit)} {a.propertyContext.depositPct != null && <span style={{ color: '#6b7280', fontWeight: 500 }}>({a.propertyContext.depositPct}%)</span>}</span></div>
              <div className="bank-row">
                <span className="k">LTV (loan-to-value)<Explain text="Loan amount as a percentage of property value. Below 80% = low risk (equity buffer). Above 100% = negative equity risk." /></span>
                <span className="v" style={{
                  color: a.propertyContext.ltv == null ? '#0f1a24'
                       : a.propertyContext.ltv <= 80 ? '#15803d'
                       : a.propertyContext.ltv <= 90 ? '#b45309'
                       : a.propertyContext.ltv <= 100 ? '#92400e'
                       : '#991b1b',
                }}>
                  {a.propertyContext.ltv != null ? a.propertyContext.ltv + '%' : '—'}
                  {a.propertyContext.ltv != null && a.propertyContext.ltv > 100 && <span style={{ fontSize: '0.7rem', marginLeft: 6 }}>(over 100% — requires deposit)</span>}
                </span>
              </div>
              <div className="bank-row"><span className="k">Property type</span><span className="v">{a.propertyContext.propertyType || '—'}</span></div>
              <div className="bank-row"><span className="k">Location</span><span className="v">{[a.propertyContext.suburb, a.propertyContext.province].filter(Boolean).join(', ') || '—'}</span></div>
              {a.propertyContext.otpSignedAt && (
                <div className="bank-row"><span className="k">OTP signed</span><span className="v">{new Date(a.propertyContext.otpSignedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
              )}
            </div>
          )}

          {a.coApplicant && (
            <div className="bank-section">
              <h3>Co-applicant</h3>
              <div className="bank-row"><span className="k">Relationship</span><span className="v">{a.coApplicant.relationship || '—'}</span></div>
              <div className="bank-row"><span className="k">Employment</span><span className="v">{a.coApplicant.employmentType ? a.coApplicant.employmentType.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()) : '—'}</span></div>
              <div className="bank-row"><span className="k">Income band</span><span className="v">{a.coApplicant.incomeBand || '—'}</span></div>
              <div className="bank-row"><span className="k">DTI band</span><span className="v">{a.coApplicant.dtiBand || '—'}</span></div>
              <div style={{ marginTop: 10, padding: 10, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 6 }}>
                <div style={{ fontSize: '0.7rem', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#15803d', fontWeight: 700 }}>Combined household</div>
                <div style={{ fontSize: '0.92rem', color: '#0f1a24', marginTop: 4 }}>
                  Income {bankFmtR(a.coApplicant.combinedIncome)}/mo · Fixed debt {bankFmtR(a.coApplicant.combinedDebt)}/mo · DTI {a.coApplicant.combinedDti}%
                </div>
              </div>
            </div>
          )}

          {ins?.payback && ins.payback.paybackMonths != null && (
            <div className="bank-section payback-callout">
              <h3>Switch payback</h3>
              <div className="payback-row">
                <div>
                  <div className="payback-label">Monthly saving at our suggested rate</div>
                  <div className="payback-big" style={{ color: '#15803d' }}>{bankFmtR(ins.payback.monthlySaving)}</div>
                  <div className="payback-sub">vs current {bankFmtR(ins.payback.currentMonthly)}/mo</div>
                </div>
                <div>
                  <div className="payback-label">Switch cost estimate</div>
                  <div className="payback-big">{bankFmtR(ins.payback.switchCostEstimate)}</div>
                  <div className="payback-sub">bond reg + cancellation + admin</div>
                </div>
                <div>
                  <div className="payback-label">Payback</div>
                  <div className="payback-big">{ins.payback.paybackMonths} mo</div>
                  <div className="payback-sub" style={{ color: '#15803d' }}>{bankFmtR(ins.payback.totalSavingOver10yr)} net over 10 yrs</div>
                </div>
              </div>
            </div>
          )}

          {ins?.sensitivity && (
            <div className="bank-section">
              <h3>Rate sensitivity · what the customer pays at different rates</h3>
              <div className="sensitivity-table">
                <div className="row header">
                  <div>Rate</div>
                  <div>Monthly</div>
                  <div>DTI incl. bond</div>
                  <div>Fit</div>
                </div>
                {ins.sensitivity.map((s, i) => (
                  <div key={i} className={'row ' + (s.withinCap ? 'good' : 'over')}>
                    <div className="r-rate">{bankFmtPct(s.rate)}{i === 0 && <span className="prime-tag">prime</span>}</div>
                    <div>{bankFmtR(s.monthly)}</div>
                    <div>{s.dti}%</div>
                    <div>{s.withinCap ? <span style={{ color: '#15803d' }}>✓ within 30% cap</span> : <span style={{ color: '#b45309' }}>over cap</span>}</div>
                  </div>
                ))}
              </div>
              <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 8 }}>
                NCA stress test caps the bond instalment at 30% of monthly income net of fixed debt. Cap: <strong>{bankFmtR(ins.disposableCap)}/mo</strong>.
              </div>
            </div>
          )}

          {ins?.flags && ins.flags.length > 0 && (
            <div className="bank-section">
              <h3>Banking signals · {ins.flags.length}</h3>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {ins.flags.map((f, i) => (
                  <li key={i} className={'signal-row sev-' + f.severity}>
                    <span className="sev-dot" />
                    <div>
                      <div style={{ fontWeight: 700 }}>{f.label}</div>
                      <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>{f.detail}</div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {ins?.behaviour && (
            <div className="bank-section">
              <h3>Banking behaviour</h3>
              <div className="behaviour-grid">
                <div className="b-card">
                  <div className="b-label">Surplus after all outflows</div>
                  <div className="b-value" style={{ color: ins.behaviour.surplusAfterAll > 0 ? '#15803d' : '#b91c1c' }}>{bankFmtR(ins.behaviour.surplusAfterAll)}/mo</div>
                  <div className="b-sub">income − debt − all spending</div>
                </div>
                <div className="b-card">
                  <div className="b-label">Effective savings rate</div>
                  <div className="b-value">{ins.behaviour.savingsRate}%</div>
                  <div className="b-sub">of monthly income</div>
                </div>
                <div className="b-card">
                  <div className="b-label">Recurring subscriptions</div>
                  <div className="b-value">{bankFmtR(ins.behaviour.subscriptionsMonthly)}</div>
                  <div className="b-sub">per month</div>
                </div>
                <div className="b-card">
                  <div className="b-label">Statement coverage</div>
                  <div className="b-value">{ins.behaviour.monthsObserved} mo</div>
                  <div className="b-sub">of bank-statement history</div>
                </div>
              </div>
            </div>
          )}

          {d?.incomeSeries?.length > 0 && (
            <div className="bank-section">
              <h3>Income stability — {d.stability}</h3>
              {d.incomeSeries.length < 2 ? (
                <div style={{ fontSize: '0.82rem', color: '#b45309', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 8, padding: '10px 12px' }}>
                  Only {d.incomeSeries.length} month of bank-statement income on file — insufficient history to chart a trend.{d.incomeSeries[0] ? ` Latest verified income: ${bankFmtR(d.incomeSeries[0].amount)}.` : ''}
                </div>
              ) : (
                <>
                  <div className="income-chart">
                    {(() => {
                      const max = Math.max(...d.incomeSeries.map(p => p.amount), 1);
                      return d.incomeSeries.map((p, i) => (
                        <div key={i} className="bar" style={{ height: Math.max(4, (p.amount / max) * 60) + 'px' }} title={bankFmtR(p.amount)} />
                      ));
                    })()}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: '#6b7280' }}>
                    {d.incomeSeries.length} months of verified bank-statement income.
                  </div>
                </>
              )}
            </div>
          )}

          {d?.topCategories?.length > 0 && (
            <div className="bank-section">
              <h3>Spending breakdown (latest month)</h3>
              <div className="spending-bars">
                {(() => {
                  const max = Math.max(...d.topCategories.map(c => c.amount), 1);
                  return d.topCategories.map(c => (
                    <div key={c.category} className="row">
                      <div className="name">{c.category}</div>
                      <div className="bar" style={{ width: Math.round((c.amount / max) * 100) + '%' }} />
                      <div className="v">{bankFmtR(c.amount)}</div>
                    </div>
                  ));
                })()}
              </div>
            </div>
          )}

          {d?.documents && (
            <div className="bank-section">
              <h3>Documents on file</h3>
              <div className="doc-checklist">
                {d.documents.map(doc => {
                  const files = doc.files || [];
                  return (
                    <div key={doc.type} className={'item ' + (doc.present ? 'present' : 'missing')}>
                      <span className="tick">{doc.present ? '✓' : '—'}</span>
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div className="name">{docLabel(doc.type)}</div>
                        {files.length > 0 && (
                          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 4 }}>
                            {files.map(f => (
                              <a
                                key={f.id}
                                href="#" onClick={e => { e.preventDefault(); bankApi.download(`/api/bank/applications/${a.ref}/documents/${f.id}`, f.filename || f.originalName || 'document'); }}
                                target="_blank" rel="noopener noreferrer"
                                style={{
                                  fontSize: '0.74rem', color: '#0b1e2d', textDecoration: 'underline',
                                  textDecorationColor: 'rgba(11,30,45,0.3)',
                                  display: 'block', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                                }}
                                title={f.filename}
                              >
                                {files.length > 1 ? '· ' : ''}{f.filename}
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#6b7280', marginTop: 10 }}>
                Opening a document logs a view against your bank in the customer's POPIA feed.
              </div>
            </div>
          )}
        </div>

        <div className="col-side">
          <CoachCard appRef={ref} />
          <BidBox
            application={a}
            insights={ins}
            mine={mine}
            lowestCompetingRate={lowestCompetingRate}
            bid={bid}
          />
          <ComparablesCard appRef={ref} />

          <div className="bank-section">
            <h3>Competing bids · {data.competingBids.length}</h3>
            {data.competingBids.length === 0 ? (
              <div style={{ fontSize: '0.82rem', color: '#6b7280' }}>You'd be the first Bondly bidder. Good lead.</div>
            ) : (
              <>
                {data.competingBids.map((b, i) => (
                  <CompetingBidRow key={b.bidId || (b.bankLabel + b.submittedAt)} b={b} appRef={ref} />
                ))}
                <div style={{ fontSize: '0.72rem', color: '#6b7280', marginTop: 8 }}>
                  Other banks shown anonymously, sorted by submission time.
                </div>
              </>
            )}
          </div>

          {externalOffers.length > 0 && (
            <div className="bank-section" style={{ background: '#fffbeb', borderColor: '#fde68a' }}>
              <h3 style={{ color: '#92400e' }}>
                Other offers the customer has · {externalOffers.length}
                <span style={{ fontSize: '0.65rem', fontWeight: 700, background: '#fde68a', color: '#78350f', padding: '2px 6px', borderRadius: 99, marginLeft: 8, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
                  Self-declared
                </span>
              </h3>
              <div style={{ fontSize: '0.74rem', color: '#78350f', marginBottom: 10 }}>
                Customer says they've been quoted these rates outside Bondly. We can't verify them, but you might want to factor them into your bid.
              </div>
              {externalOffers.map(o => (
                <div key={o.id} style={{ marginBottom: 6 }}>
                  <div className="competing-bid-row" style={{ background: '#fff' }}>
                    <span className="bank-label">{o.bankName}</span>
                    <span>
                      <span className="rate">{bankFmtPct(o.rate)}</span>
                      {o.monthly ? ` · ${bankFmtR(o.monthly)}/mo` : ''}
                      {o.proofFile && (
                        <a href="#" onClick={e => { e.preventDefault(); bankApi.download(`/api/bank/applications/${a.ref}/documents/${o.proofFile.id}`, o.proofFile.filename || 'proof'); }}
                           target="_blank" rel="noopener noreferrer"
                           style={{ marginLeft: 8, fontSize: '0.7rem', color: '#0b1e2d' }}>
                          ↗ proof
                        </a>
                      )}
                    </span>
                  </div>
                  {o.conditions && (
                    <div style={{ fontSize: '0.7rem', color: '#6b7280', padding: '2px 10px 0', fontStyle: 'italic' }}>"{o.conditions}"</div>
                  )}
                </div>
              ))}
            </div>
          )}

          <CopilotPanel appRef={ref} />
          <DocDropZone appRef={ref} />

          <StructuringTipsCard appRef={ref} />
          {ins?.pillars && (
            <div className="bank-section">
              <h3>Score components</h3>
              <div style={{ fontSize: '0.74rem', color: '#6b7280', marginBottom: 10 }}>
                Where the {a.qualityScore}/100 comes from. Each pillar 0–100.
              </div>
              {[
                { id: 'income',  label: 'Income stability',       desc: 'verified + variance + coverage' },
                { id: 'debt',    label: 'Debt management',        desc: 'DTI ratio after fixed debt' },
                { id: 'banking', label: 'Banking discipline',     desc: 'surplus after all outflows' },
                { id: 'docs',    label: 'Document completeness',  desc: 'FICA pack on file' },
                { id: 'kyc',     label: 'KYC verification',       desc: 'identity + residence verified' },
              ].map(p => {
                const v = ins.pillars[p.id] ?? 0;
                const colour = v >= 80 ? '#16a34a' : v >= 60 ? '#c8a84b' : '#dc2626';
                return (
                  <div key={p.id} style={{ marginBottom: 10 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.82rem', marginBottom: 3 }}>
                      <span style={{ color: '#0f1a24', fontWeight: 600 }}>{p.label}</span>
                      <span style={{ fontWeight: 800, color: colour }}>{v}</span>
                    </div>
                    <div style={{ background: '#f3f4f6', borderRadius: 4, height: 8, overflow: 'hidden' }}>
                      <div style={{ width: v + '%', height: '100%', background: colour }} />
                    </div>
                    <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 2 }}>{p.desc}</div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
      <StickyBidBar application={a} mine={mine} bid={bid} />
    </>
  );
}

// Sticky bottom bar (#11) — keeps the core "Set rate & bid" action reachable
// without scrolling. It drives the SAME shared bid state as the inline BidBox
// (rate input, monthly preview, submit, save draft), so there is a single
// submission path and no double-submit.
function StickyBidBar({ application, mine, bid }) {
  const { rate, setRate, monthly, busy, submit, saveDraft, draft } = bid;
  return (
    <div style={{
      position: 'sticky', bottom: 0, left: 0, right: 0, zIndex: 40,
      marginTop: 20, marginLeft: -20, marginRight: -20,
      background: '#fff', borderTop: '1px solid #e5e7eb',
      boxShadow: '0 -4px 16px rgba(11,30,45,0.08)',
      padding: '12px 20px',
      display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap',
    }}>
      <span style={{ fontWeight: 800, color: '#0b1e2d', fontSize: '0.85rem' }}>
        {mine ? 'Update your bid' : 'Set rate & bid'}
      </span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <label style={{ fontSize: '0.75rem', color: '#6b7280', fontWeight: 700 }}>Rate %</label>
        <input
          id="sticky-rate-input"
          type="text" inputMode="decimal"
          value={rate} onChange={e => setRate(e.target.value.replace(',', '.'))} placeholder="11.10"
          style={{ width: 90, padding: '7px 9px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.86rem' }}
        />
      </div>
      <span style={{ fontSize: '0.8rem', color: '#374151' }}>
        Customer pays <strong>{bankFmtR(monthly)}/mo</strong>
      </span>
      {draft && (
        <span style={{ fontSize: '0.72rem', color: '#78350f', fontWeight: 700 }}>📝 Draft · {draft.rate}%</span>
      )}
      <div style={{ display: 'flex', gap: 8, marginLeft: 'auto' }}>
        <button type="button" onClick={saveDraft} disabled={busy || !rate}
          style={{ background: 'transparent', color: '#78350f', border: '1px solid #fde68a', borderRadius: 7, padding: '8px 14px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
          Save draft
        </button>
        <button type="button" onClick={() => submit()} disabled={busy || !rate}
          style={{ background: '#c8a84b', color: '#fff', border: 'none', borderRadius: 7, padding: '8px 18px', fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
          {busy ? 'Working…' : (mine ? 'Update bid' : 'Submit bid')}
        </button>
      </div>
    </div>
  );
}

// Small, safe markdown → HTML renderer for copilot replies.
// Supports: headings (#/##/###), bold (**), italic (*), inline code (`),
// unordered (-/*) and ordered (1.) lists, and line breaks. Escapes HTML first.
function renderMarkdown(src) {
  const esc = (s) => s
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  const inline = (s) => esc(s)
    .replace(/`([^`]+)`/g, '<code style="background:#ede9fe;padding:1px 4px;border-radius:4px;font-size:0.92em">$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*\n]+)\*/g, '$1<em>$2</em>');

  const lines = String(src || '').split(/\r?\n/);
  const html = [];
  let listType = null; // 'ul' | 'ol'
  const closeList = () => { if (listType) { html.push(`</${listType}>`); listType = null; } };

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) { closeList(); continue; }
    const h = line.match(/^(#{1,3})\s+(.*)$/);
    if (h) {
      closeList();
      const lvl = h[1].length;
      const size = lvl === 1 ? '1.05rem' : lvl === 2 ? '0.95rem' : '0.88rem';
      html.push(`<div style="font-weight:800;font-size:${size};margin:8px 0 4px">${inline(h[2])}</div>`);
      continue;
    }
    const ol = line.match(/^\d+\.\s+(.*)$/);
    const ul = line.match(/^[-*]\s+(.*)$/);
    if (ol) {
      if (listType !== 'ol') { closeList(); html.push('<ol style="margin:4px 0;padding-left:20px">'); listType = 'ol'; }
      html.push(`<li>${inline(ol[1])}</li>`);
      continue;
    }
    if (ul) {
      if (listType !== 'ul') { closeList(); html.push('<ul style="margin:4px 0;padding-left:20px">'); listType = 'ul'; }
      html.push(`<li>${inline(ul[1])}</li>`);
      continue;
    }
    closeList();
    html.push(`<div>${inline(line)}</div>`);
  }
  closeList();
  return html.join('');
}

function CopilotPanel({ appRef }) {
  const [msgs, setMsgs] = useState([]);
  const [q, setQ] = useState('');
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState(null);

  async function ask(e) {
    e?.preventDefault();
    if (!q.trim()) return;
    const question = q.trim();
    setMsgs(m => [...m, { role: 'user', text: question }]);
    setQ(''); setErr(null); setBusy(true);
    try {
      const r = await bankApi.copilot(appRef, question);
      setMsgs(m => [...m, { role: 'ai', text: r.answer }]);
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  const presets = ['Give me a quick risk read', 'Why is the DTI high?', 'Should I bid aggressively?', 'What\'s the biggest red flag?'];

  return (
    <div className="bank-section" style={{ background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)', borderColor: '#ddd6fe' }}>
      <h3 style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        🤖 AI Copilot
        <span style={{ fontSize: '0.65rem', background: '#7c3aed', color: '#fff', padding: '1px 6px', borderRadius: 99, letterSpacing: '0.04em' }}>BETA</span>
      </h3>
      <div style={{ fontSize: '0.74rem', color: '#6b7280', marginBottom: 10 }}>
        Ask anything about this file — DTI breakdown, risk signals, pricing strategy. Uses Claude.
      </div>

      {msgs.length === 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
          {presets.map(p => (
            <button key={p} onClick={() => { setQ(p); setTimeout(() => document.getElementById('copilot-q')?.focus(), 0); }}
              style={{ padding: '5px 12px', fontSize: '0.74rem', background: '#fff', border: '1px solid #ddd6fe', borderRadius: 99, color: '#5b21b6', cursor: 'pointer', fontWeight: 600 }}>
              {p}
            </button>
          ))}
        </div>
      )}

      {msgs.length > 0 && (
        <div style={{ maxHeight: 320, overflowY: 'auto', marginBottom: 10, padding: 10, background: '#fff', borderRadius: 7, border: '1px solid #ddd6fe' }}>
          {msgs.map((m, i) => (
            <div key={i} style={{ marginBottom: 8, display: 'flex', flexDirection: 'column', alignItems: m.role === 'user' ? 'flex-end' : 'flex-start' }}>
              {m.role === 'user' ? (
                <div style={{
                  maxWidth: '90%', padding: '8px 11px', borderRadius: 8,
                  background: '#0b1e2d', color: '#fff',
                  fontSize: '0.84rem', whiteSpace: 'pre-wrap',
                }}>{m.text}</div>
              ) : (
                <div
                  style={{
                    maxWidth: '90%', padding: '8px 11px', borderRadius: 8,
                    background: '#f5f3ff', color: '#0f1a24',
                    fontSize: '0.84rem', lineHeight: 1.5,
                  }}
                  dangerouslySetInnerHTML={{ __html: renderMarkdown(m.text) }}
                />
              )}
            </div>
          ))}
          {busy && <div style={{ fontSize: '0.78rem', color: '#7c3aed', fontStyle: 'italic' }}>Thinking…</div>}
        </div>
      )}

      <form onSubmit={ask} style={{ display: 'flex', gap: 6 }}>
        <input id="copilot-q" value={q} onChange={e => setQ(e.target.value)} placeholder="Ask the copilot…" disabled={busy}
          style={{ flex: 1, padding: '8px 10px', border: '1px solid #ddd6fe', borderRadius: 6, fontSize: '0.86rem' }} />
        <button type="submit" disabled={busy || !q.trim()}
          style={{ padding: '8px 16px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
          {busy ? '…' : 'Ask'}
        </button>
      </form>
      {err && <div style={{ color: '#991b1b', fontSize: '0.78rem', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function DocDropZone({ appRef }) {
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [err, setErr] = useState(null);

  async function handleFile(file) {
    if (!file) return;
    setBusy(true); setErr(null); setResult(null);
    try {
      const r = await bankApi.extractDoc(appRef, file, '');
      setResult(r.extracted);
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }
  function onDrop(e) {
    e.preventDefault(); setDragging(false);
    handleFile(e.dataTransfer.files?.[0]);
  }

  return (
    <div className="bank-section">
      <h3>🪄 Drop a document — AI extracts the fields</h3>
      <div style={{ fontSize: '0.74rem', color: '#6b7280', marginBottom: 10 }}>
        Drop a competing offer letter, payslip, OTP or bank statement here. The AI reads it and shows you what it found.
      </div>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        style={{
          padding: 24, textAlign: 'center',
          background: dragging ? '#fef3c7' : '#fff',
          border: '2px dashed ' + (dragging ? '#c8a84b' : '#e5e7eb'),
          borderRadius: 10, cursor: 'pointer',
          fontSize: '0.86rem', color: '#6b7280', fontWeight: 600,
          transition: 'background 0.15s, border-color 0.15s',
        }}
        onClick={() => document.getElementById('doc-drop-input')?.click()}
      >
        {busy ? '⏳ Reading…' : dragging ? 'Drop to extract' : '📄 Drag a file here or click to choose'}
      </div>
      <input id="doc-drop-input" type="file" accept=".pdf,.jpg,.jpeg,.png" style={{ display: 'none' }}
        onChange={e => handleFile(e.target.files?.[0])} />

      {err && <div style={{ color: '#991b1b', fontSize: '0.82rem', marginTop: 8 }}>{err}</div>}
      {result && (
        <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7 }}>
          <div style={{ fontWeight: 700, marginBottom: 6, color: '#166534' }}>✓ Extracted ({result.documentType || 'document'})</div>
          {result.summary && <div style={{ fontSize: '0.82rem', color: '#0f1a24', marginBottom: 8, fontStyle: 'italic' }}>"{result.summary}"</div>}
          <div style={{ fontSize: '0.78rem', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px 12px' }}>
            {Object.entries(result).filter(([k, v]) => !['documentType','summary'].includes(k) && v != null && v !== '').map(([k, v]) => (
              <div key={k}><span style={{ color: '#6b7280' }}>{k}:</span> <strong>{String(v)}</strong></div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function CoachCard({ appRef }) {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);
  useEffect(() => { bankApi.coach(appRef).then(setData).catch(e => setErr(e.message)); }, [appRef]);
  if (err || !data) return null;
  if (data.recommendedRate == null) return null;
  return (
    <div className="bank-section" style={{ background: 'linear-gradient(180deg, #fffbeb 0%, #ffffff 100%)', borderColor: '#fde68a' }}>
      <h3 style={{ color: '#78350f' }}>🎯 Pricing coach</h3>
      <div style={{ fontSize: '1.4rem', fontWeight: 800, color: '#0f1a24' }}>{bankFmtPct(data.recommendedRate)}</div>
      <div style={{ fontSize: '0.78rem', color: '#374151', marginTop: 4, lineHeight: 1.5 }}>{data.reasoning}</div>
      <div style={{ display: 'flex', gap: 10, fontSize: '0.72rem', color: '#6b7280', marginTop: 8 }}>
        {data.similarWins > 0  && <span>✓ {data.similarWins} similar win{data.similarWins === 1 ? '' : 's'}</span>}
        {data.similarLosses > 0 && <span>✗ {data.similarLosses} similar loss{data.similarLosses === 1 ? '' : 'es'}</span>}
      </div>
    </div>
  );
}

function StructuringTipsCard({ appRef }) {
  const [tips, setTips] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);
  async function fetchTips() {
    if (tips || busy) return;
    setBusy(true); setErr(null);
    try { const r = await bankApi.structuringTips(appRef); setTips(r.tips); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div className="bank-section" style={{ background: 'linear-gradient(180deg, #ecfdf5 0%, #ffffff 100%)', borderColor: '#bbf7d0' }}>
      <h3 style={{ color: '#166534' }}>💡 Deal-shaping suggestions</h3>
      {!tips && !busy && (
        <>
          <div style={{ fontSize: '0.78rem', color: '#374151', marginBottom: 10 }}>
            AI suggests 2-3 moves you could propose (deposit, term, co-applicant) that would unlock better pricing.
          </div>
          <button onClick={fetchTips}
            style={{ padding: '8px 16px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: '0.82rem', cursor: 'pointer' }}>
            Generate suggestions
          </button>
        </>
      )}
      {busy && <div style={{ fontSize: '0.82rem', color: '#16a34a', fontStyle: 'italic' }}>Thinking…</div>}
      {tips && (
        <div style={{ whiteSpace: 'pre-wrap', fontSize: '0.85rem', color: '#0f1a24', lineHeight: 1.6 }}>{tips}</div>
      )}
      {err && <div style={{ color: '#991b1b', fontSize: '0.78rem', marginTop: 6 }}>{err}</div>}
    </div>
  );
}

function CompetingBidRow({ b, appRef }) {
  const [explanation, setExplanation] = useState(null);
  const [busy, setBusy] = useState(false);
  async function explain() {
    if (explanation || busy) return;
    setBusy(true);
    try {
      const r = await bankApi.explainCompetitorBid(appRef, { competitorRate: b.rate, monthly: b.monthly, term: b.term, bankLabel: b.bankLabel });
      setExplanation(r.explanation);
    } catch (e) { setExplanation('Could not load: ' + e.message); }
    finally { setBusy(false); }
  }
  return (
    <>
      <div className={'competing-bid-row ' + (b.isMine ? 'mine' : '')}>
        <span className="bank-label">{b.bankLabel}{b.isMine && ' (you)'}</span>
        <span>
          <span className="rate">{bankFmtPct(b.rate)}</span> · {bankFmtR(b.monthly)}/mo
          {!b.isMine && (
            <button onClick={explain} disabled={busy}
              style={{ marginLeft: 8, background: 'transparent', color: '#7c3aed', border: 'none', cursor: 'pointer', fontSize: '0.7rem', fontWeight: 700, textDecoration: 'underline' }}>
              {busy ? '…' : explanation ? '' : '?'}
            </button>
          )}
        </span>
      </div>
      {explanation && (
        <div style={{ fontSize: '0.75rem', color: '#5b21b6', padding: '4px 12px 8px', fontStyle: 'italic' }}>
          🤖 {explanation}
        </div>
      )}
    </>
  );
}

function ComparablesCard({ appRef }) {
  const [data, setData] = useState(null);
  useEffect(() => { bankApi.comparables(appRef).then(d => setData(d.comparables)).catch(() => {}); }, [appRef]);
  if (!data || data.length === 0) return null;
  return (
    <div className="bank-section">
      <h3>Comparable past wins · {data.length}</h3>
      <div style={{ fontSize: '0.72rem', color: '#6b7280', marginBottom: 8 }}>Your most similar wins, sorted by closeness.</div>
      {data.map(c => (
        <div key={c.ref} className="competing-bid-row" style={{ background: '#fff' }}>
          <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{c.ref}</span>
          <span><span className="rate">{bankFmtPct(c.acceptedRate)}</span> · Q{c.qualityScore}</span>
        </div>
      ))}
    </div>
  );
}

function ScoreChip({ score }) {
  const cls = score >= 80 ? 'q-hi' : score >= 60 ? 'q-mid' : 'q-lo';
  return <span className={'score-chip ' + cls}>Q {score}</span>;
}

function docLabel(t) {
  return {
    id: 'SA ID',
    payslip: 'Payslip',
    residence: 'Proof of residence',
    bank_statement: 'Bank statements',
    tax: 'IRP5 / tax cert.',
    offer_to_purchase: 'Offer to Purchase',
  }[t] || t;
}

// localStorage helpers for provisional bid drafts (#12). Keyed by deal ref so a
// draft survives a revisit. No backend — purely local to this banker's browser.
const DRAFT_KEY = (ref) => `bondly_bank_bid_draft_${ref}`;
function readDraft(ref) {
  try { return JSON.parse(localStorage.getItem(DRAFT_KEY(ref)) || 'null'); }
  catch { return null; }
}

// Shared bid state + submission logic, lifted so the inline BidBox and the
// sticky bar drive the SAME state and the SAME submit() — only one submission
// path exists, so there is no way to double-submit or diverge.
function useBidState({ application, insights, mine, lowestCompetingRate, onChange }) {
  const ref = application.ref;
  const savedDraft = useMemo(() => readDraft(ref), [ref]);

  const defaultTerm = mine?.term
    ? String(mine.term)
    : (application?.swapContext?.monthsRemaining ? String(application.swapContext.monthsRemaining) : '240');
  // Prefill priority: existing live bid → saved draft → Bondly suggestion.
  const initialRate = mine?.rate ? String(mine.rate)
    : (savedDraft?.rate != null ? String(savedDraft.rate)
    : (insights?.suggestedBid?.rate ? String(insights.suggestedBid.rate) : ''));

  const [rate, setRate]         = useState(initialRate);
  const [term, setTerm]         = useState(defaultTerm);
  const [conditions, setCond]   = useState('');
  const [notes, setNotes]       = useState(savedDraft?.notes || '');
  const [valid, setValid]       = useState('14');
  const [addons, setAddons]     = useState([]);
  const [busy, setBusy]         = useState(false);
  const [err, setErr]           = useState(null);
  const [okMsg, setOkMsg]       = useState(null);
  const [draft, setDraft]       = useState(savedDraft);
  const submittingRef           = useRef(false); // synchronous double-submit guard (sticky bar + inline form share submit)

  const balance = application.requestedAmount;
  const rateNum = Number(rate);
  const termNum = Number(term);
  const monthly = useMemo(() => {
    if (!isFinite(rateNum) || rateNum <= 0 || !isFinite(termNum) || termNum <= 0) return 0;
    return monthlyFromRate(balance, rateNum, termNum);
  }, [rate, term, balance]);

  const dtiAtRate = useMemo(() => {
    const income   = application.detail?.incomeAvg || 0;
    const fixedDebt= application.detail?.fixedDebt || 0;
    if (!income || !monthly) return null;
    return Math.round(((fixedDebt + monthly) / income) * 100);
  }, [monthly, application]);

  const headroom = useMemo(() => {
    const cap = insights?.disposableCap || 0;
    if (!cap) return null;
    return cap - monthly;
  }, [monthly, insights]);

  function apply(template) {
    if (template === 'suggested' && insights?.suggestedBid?.rate)        setRate(String(insights.suggestedBid.rate));
    if (template === 'match'     && lowestCompetingRate != null)         setRate(String(lowestCompetingRate));
    if (template === 'beat'      && lowestCompetingRate != null)         setRate(String((lowestCompetingRate - 0.10).toFixed(2)));
    if (template === 'aggressive' && insights?.suggestedBid?.rate)       setRate(String((insights.suggestedBid.rate - 0.25).toFixed(2)));
  }

  function saveDraft() {
    if (!rate) { setErr('Enter a rate before saving a draft.'); return; }
    const d = { rate: rateNum, notes, savedAt: new Date().toISOString() };
    try { localStorage.setItem(DRAFT_KEY(ref), JSON.stringify(d)); } catch {}
    setDraft(d); setErr(null);
    setOkMsg(`Draft saved · ${rateNum}%`);
  }

  function clearDraft() {
    try { localStorage.removeItem(DRAFT_KEY(ref)); } catch {}
    setDraft(null);
  }

  async function submit(e) {
    e?.preventDefault();
    // Synchronous ref guard — React `busy` state updates async, so two triggers
    // in the same tick (Enter on the form + click on the sticky bar) could both
    // read busy=false and double-POST. The ref flips immediately.
    if (submittingRef.current || busy) return;
    // #15 — in-app validation with a realistic floor (no 0% bids; prime ≈ 10.75%).
    if (!isFinite(rateNum) || rateNum < 6) {
      setErr('Enter a realistic rate — at least 6%. Prime is ~10.75%.');
      return;
    }
    if (rateNum > 30) { setErr('Rate looks too high — must be 30% or below.'); return; }
    // #9 — warn (don't hard-block) when the bid exceeds the applicant's 30% NCA affordability cap.
    const cap = insights?.disposableCap;
    if (cap != null && cap >= 0 && monthly > cap) {
      const over = Math.round(monthly - cap);
      if (!window.confirm(`This bid's repayment (R${monthly.toLocaleString('en-ZA')}/mo) is about R${over.toLocaleString('en-ZA')} over the applicant's 30% NCA affordability cap — they may not qualify without a longer term or smaller bond. Submit anyway?`)) return;
    }
    submittingRef.current = true;
    setBusy(true); setErr(null); setOkMsg(null);
    try {
      const body = { rate: rateNum, monthly, term: termNum, conditions, notes, validityDays: Number(valid), addons: addons.filter(a => a.name) };
      if (mine?.bidId) {
        await bankApi.updateBid(mine.bidId, body);
        setOkMsg('Bid updated.');
      } else {
        await bankApi.submitBid(application.ref, body);
        setOkMsg('Bid submitted. The customer can see it on their dashboard.');
      }
      clearDraft();              // a submitted bid supersedes any provisional draft
      onChange?.();
    } catch (e2) {
      setErr(e2.message);
    } finally { setBusy(false); submittingRef.current = false; }
  }

  async function withdraw() {
    if (!mine?.bidId) return;
    if (!confirm('Withdraw your bid?')) return;
    setBusy(true);
    try {
      await bankApi.withdrawBid(mine.bidId);
      setRate(''); setOkMsg('Bid withdrawn.');
      onChange?.();
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  return {
    rate, setRate, term, setTerm, conditions, setCond, notes, setNotes,
    valid, setValid, addons, setAddons, busy, err, okMsg, draft,
    monthly, dtiAtRate, headroom, apply, submit, withdraw, saveDraft,
  };
}

function BidBox({ application, insights, mine, lowestCompetingRate, bid }) {
  const {
    rate, setRate, term, setTerm, conditions, setCond, notes, setNotes,
    valid, setValid, addons, setAddons, busy, err, okMsg, draft,
    monthly, dtiAtRate, headroom, apply, submit, withdraw, saveDraft,
  } = bid;

  return (
    <div className="bank-section bid-box" id="bid-box">
      <h3>{mine ? 'Update your bid' : 'Submit a bid'}</h3>
      {draft && (
        <div style={{ fontSize: '0.74rem', color: '#78350f', background: '#fffbeb', border: '1px solid #fde68a', borderRadius: 6, padding: '6px 10px', marginBottom: 10, fontWeight: 700 }}>
          📝 Draft saved · {draft.rate}%
        </div>
      )}

      {/* One-click templates */}
      <div className="bid-templates">
        {insights?.suggestedBid?.rate && (
          <button type="button" onClick={() => apply('suggested')}
            title={`Bondly suggests ${insights.suggestedBid.rate}% for this file's quality`}>
            Suggested<br/><span className="tpl-rate">{bankFmtPct(insights.suggestedBid.rate)}</span>
          </button>
        )}
        {lowestCompetingRate != null && (
          <button type="button" onClick={() => apply('match')}>
            Match lowest<br/><span className="tpl-rate">{bankFmtPct(lowestCompetingRate)}</span>
          </button>
        )}
        {lowestCompetingRate != null && (
          <button type="button" onClick={() => apply('beat')}>
            Beat by 10bp<br/><span className="tpl-rate">{bankFmtPct(lowestCompetingRate - 0.10)}</span>
          </button>
        )}
        {insights?.suggestedBid?.rate && (
          <button type="button" onClick={() => apply('aggressive')}>
            Aggressive<br/><span className="tpl-rate">{bankFmtPct(insights.suggestedBid.rate - 0.25)}</span>
          </button>
        )}
      </div>

      <form onSubmit={submit}>
        <div className="input-row">
          <label>Rate (%)</label>
          <input type="text" inputMode="decimal" value={rate} onChange={e => setRate(e.target.value.replace(',', '.'))} placeholder="11.10" required />
        </div>
        <div className="input-row">
          <label>Term (months)</label>
          <input type="number" min="60" max="360" value={term} onChange={e => setTerm(e.target.value)} required />
        </div>
        <div className="input-row">
          <label>Valid for (days)</label>
          <input type="number" min="1" max="60" value={valid} onChange={e => setValid(e.target.value)} />
        </div>

        <div className="calc-monthly">
          <div className="label">Customer would pay</div>
          <div className="v">{bankFmtR(monthly)} / mo</div>
          {dtiAtRate != null && (
            <div className="live-sensitivity">
              DTI with this bond {dtiAtRate}% · {headroom != null && (
                headroom >= 0
                  ? <span style={{ color: '#15803d' }}>{bankFmtR(headroom)} headroom under cap</span>
                  : <span style={{ color: '#b45309' }}>{bankFmtR(-headroom)} over 30% cap</span>
              )}
            </div>
          )}
        </div>

        <div style={{ marginBottom: 10 }}>
          <label style={{ display:'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, marginBottom: 4 }}>Add-ons (optional)</label>
          <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginBottom: 6 }}>Bundle cross-sells with a small rate sweetener. Customer sees both options.</div>
          {addons.map((a, i) => (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 90px 80px 26px', gap: 6, marginBottom: 6 }}>
              <input value={a.name} onChange={e => setAddons(addons.map((x, j) => j === i ? { ...x, name: e.target.value } : x))} placeholder="Life cover" style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: '0.78rem' }} />
              <input type="number" value={a.monthlyCost || ''} onChange={e => setAddons(addons.map((x, j) => j === i ? { ...x, monthlyCost: Number(e.target.value) } : x))} placeholder="R/mo" style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: '0.78rem' }} />
              <input type="number" step="0.05" value={a.rateDiscount || ''} onChange={e => setAddons(addons.map((x, j) => j === i ? { ...x, rateDiscount: Number(e.target.value) } : x))} placeholder="-bp" style={{ padding: '6px 8px', border: '1px solid #e5e7eb', borderRadius: 5, fontSize: '0.78rem' }} />
              <button type="button" onClick={() => setAddons(addons.filter((_, j) => j !== i))} style={{ background: 'transparent', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 5, cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem' }}>×</button>
            </div>
          ))}
          <button type="button" onClick={() => setAddons([...addons, { name: '', monthlyCost: 0, rateDiscount: 0 }])}
            style={{ padding: '5px 12px', fontSize: '0.72rem', background: 'transparent', border: '1px dashed #c8a84b', borderRadius: 6, color: '#78350f', cursor: 'pointer', fontWeight: 600 }}>
            + Add an add-on
          </button>
        </div>
        <label style={{ display:'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, marginBottom: 4 }}>Conditions (optional)</label>
        <textarea value={conditions} onChange={e => setCond(e.target.value)} placeholder="e.g. Subject to property valuation, life cover required" />
        <label style={{ display:'block', fontSize: '0.75rem', color: '#6b7280', fontWeight: 700, margin: '8px 0 4px' }}>Internal notes (optional)</label>
        <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Customer never sees this — for your team only" />

        {err && <div style={{ color:'#991b1b', fontSize: '0.8rem', marginTop: 8 }}>{err}</div>}
        {okMsg && <div style={{ color:'#15803d', fontSize: '0.8rem', marginTop: 8 }}>{okMsg}</div>}

        <button type="submit" className="submit-btn" disabled={busy || !rate}>
          {busy ? 'Working…' : (mine ? 'Update bid' : 'Submit bid')}
        </button>
        <button type="button" onClick={saveDraft} disabled={busy || !rate}
          style={{ marginTop: 6, width: '100%', background: 'transparent', color: '#78350f', border: '1px solid #fde68a', borderRadius: 8, padding: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
          Save draft
        </button>
        {mine && (
          <button type="button" onClick={withdraw} disabled={busy}
            style={{ marginTop: 6, width: '100%', background: 'transparent', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 8, padding: '8px', fontWeight: 700, fontSize: '0.8rem', cursor: 'pointer' }}>
            Withdraw bid
          </button>
        )}
      </form>
    </div>
  );
}
