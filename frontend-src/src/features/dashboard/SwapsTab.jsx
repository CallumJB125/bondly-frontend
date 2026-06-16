import { useState, useEffect, useMemo } from 'react';
import { Target, CheckCircle, AlertTriangle, Eye, Paperclip } from 'lucide-react';
import { swaps, bankOffers, documents as docsApi, alerts as alertsApi, risk as riskApi, share as shareApi, decisions as decisionsApi, myApplication } from '../../lib/api.js';
import { useToast } from '@bondly/ui/components/Toast.jsx';
import { fmt, fmtPct, fmtDate } from '@bondly/ui/lib/format.js';
import { calcSwapSavings, calcRefinanceDecision } from '@bondly/ui/lib/finance.js';
import { PRIME_RATE, BANKS, BANK_SPREADS } from '@bondly/ui/lib/constants.js';
import Button from '@bondly/ui/components/Button.jsx';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';
import Input, { Select } from '@bondly/ui/components/Input.jsx';

function calcSwitchingCosts(balance) {
  const cancellation = Math.round(balance * 0.005 + 3000);
  const registration = Math.round(balance * 0.012 + 5000);
  return { cancellation, registration, total: cancellation + registration };
}

// Bank status colour mapping
const BANK_STATUS_COLORS = {
  submitted:    'blue',
  under_review: 'blue',
  approved:     'green',
  offer_sent:   'green',
  declined:     'orange',
  withdrawn:    'orange',
};

// Full conveyancing stage pipeline
const CONVEYANCING_STAGES = [
  { key: 'offer_accepted',          label: 'Offer Accepted' },
  { key: 'cancellation_notice_sent',label: 'Cancellation Notice' },
  { key: 'attorney_instructed',     label: 'Attorney Instructed' },
  { key: 'valuation_ordered',       label: 'Valuation Ordered' },
  { key: 'valuation_done',          label: 'Valuation Done' },
  { key: 'registration_in_progress',label: 'Registration' },
  { key: 'registered',              label: 'Registered' },
  { key: 'complete',                label: 'Complete' },
];

// ── "Move When Ready" alert card ──────────────────────────
function MoveWhenReadyCard({ loan, bankRows }) {
  const [alert, setAlert]     = useState(null);
  const [editing, setEditing] = useState(false);
  const [threshold, setThreshold] = useState('');
  const [phone, setPhone]     = useState('');
  const [note, setNote]       = useState('');
  const [saving, setSaving]   = useState(false);
  const showToast = useToast();

  useEffect(() => {
    alertsApi.getSavingsThreshold().then(d => {
      setAlert(d);
      if (d) { setThreshold(String(d.monthlyThreshold)); setPhone(d.phone || ''); setNote(d.note || ''); }
    }).catch(() => {});
  }, []);

  const bestSaving = bankRows && loan
    ? bankRows.filter(r => r.bank !== loan.bank && r.savings?.monthlySaving > 0)
               .sort((a, b) => b.savings.monthlySaving - a.savings.monthlySaving)[0]
    : null;
  const currentBestSaving = bestSaving?.savings?.monthlySaving || 0;

  async function save() {
    const val = parseFloat(threshold);
    if (!val || val <= 0) { showToast('Enter a saving amount', 'error'); return; }
    if (!phone.trim()) { showToast('Add your phone number so we can contact you', 'error'); return; }
    const digits = phone.replace(/\s+/g, '');
    const saPhone = /^(\+27|0)[6-8]\d{8}$/.test(digits);
    if (!saPhone) { showToast('Enter a valid SA mobile number, e.g. +27 82 123 4567', 'error'); return; }
    setSaving(true);
    try {
      const data = await alertsApi.setSavingsThreshold(val, phone.trim(), note.trim() || null);
      setAlert(data);
      setEditing(false);
      showToast('Alert set! We\'ll contact you when we can hit your target.', 'success');
    } catch { showToast('Could not save alert', 'error'); }
    finally { setSaving(false); }
  }

  async function remove() {
    try { await alertsApi.deleteSavingsThreshold(); setAlert(null); showToast('Alert removed', 'success'); }
    catch { showToast('Could not remove', 'error'); }
  }

  const isReady = alert && currentBestSaving >= alert.monthlyThreshold;

  if (!loan) return null;

  return (
    <Card style={{ marginBottom: 'var(--space-5)', border: isReady ? '1.5px solid var(--mint)' : undefined }}>
      <CardHeader>Not ready to switch yet? Set a savings trigger.</CardHeader>
      <CardBody>
        {isReady && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', background: 'rgba(108,187,167,0.12)', borderRadius: 'var(--border-radius-sm)', marginBottom: 'var(--space-4)', border: '1px solid var(--mint)' }}>
            <Target size={22} color="var(--mint)"/>
            <div>
              <div style={{ fontWeight: 700, color: 'var(--mint)', fontSize: '1rem' }}>
                Your target has been reached!
              </div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                {bestSaving.bank} can save you {fmt(currentBestSaving)}/month — above your {fmt(alert.monthlyThreshold)}/mo target.
                We'll be in touch. Or apply now!
              </div>
            </div>
          </div>
        )}

        {!alert || editing ? (
          <div>
            <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)' }}>
              Current best deal saves you <strong style={{ color: currentBestSaving > 0 ? 'var(--mint)' : undefined }}>
                {currentBestSaving > 0 ? `${fmt(Math.round(currentBestSaving))}/month` : 'nothing yet'}
              </strong>
              {currentBestSaving > 0 && ` with ${bestSaving.bank}.`}
              {' '}Tell us your threshold and leave your number — we'll reach out when it's worth your time.
            </p>
            <div style={{ display: 'grid', gap: 'var(--space-3)' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Alert me when I can save at least:
                </label>
                <div style={{ display: 'flex', gap: 'var(--space-2)', alignItems: 'center' }}>
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>R</span>
                  <input
                    type="number"
                    min="100"
                    step="100"
                    placeholder={currentBestSaving > 0 ? String(Math.round(currentBestSaving * 0.7)) : '500'}
                    value={threshold}
                    onChange={e => setThreshold(e.target.value)}
                    style={{ flex: 1, padding: '9px 14px', borderRadius: 'var(--border-radius-sm)', border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}
                  />
                  <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>/month</span>
                </div>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Your phone number (WhatsApp):
                </label>
                <input
                  type="tel"
                  placeholder="+27 82 123 4567"
                  value={phone}
                  onChange={e => setPhone(e.target.value)}
                  style={{ width: '100%', padding: '9px 14px', borderRadius: 'var(--border-radius-sm)', border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}
                />
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>
                  Anything we should know? (optional)
                </label>
                <textarea
                  placeholder="e.g. 'Happy to move in 6 months if price is right' or 'Call after 5pm'"
                  value={note}
                  onChange={e => setNote(e.target.value)}
                  rows={2}
                  style={{ width: '100%', padding: '9px 14px', borderRadius: 'var(--border-radius-sm)', border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)', resize: 'vertical' }}
                />
              </div>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant="lime" size="sm" loading={saving} onClick={save}>Set alert</Button>
                {editing && <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>}
              </div>
            </div>
          </div>
        ) : (
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-page)', borderRadius: 'var(--border-radius-sm)', border: '1px solid var(--border-color)' }}>
              <Eye size={20} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>
                  Watching for {fmt(alert.monthlyThreshold)}/month saving
                </div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                  Current best: {currentBestSaving > 0 ? `${fmt(Math.round(currentBestSaving))}/mo with ${bestSaving.bank}` : 'no saving available yet'} ·{' '}
                  {currentBestSaving >= alert.monthlyThreshold
                    ? <span style={{ color: 'var(--mint)', fontWeight: 600 }}>Target reached!</span>
                    : `${fmt(Math.round(alert.monthlyThreshold - currentBestSaving))} away`}
                  {alert.phone && ` · We have your number`}
                </div>
                {alert.note && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4, fontStyle: 'italic' }}>"{alert.note}"</div>}
              </div>
              <button onClick={() => setEditing(true)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem' }}>Edit</button>
              <button onClick={remove} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '0.8125rem' }}>Remove</button>
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

// ── Credit pre-check ─────────────────────────────────────────────────────────
const GRADE_CONFIG = {
  A: { color: 'var(--color-grade-a)', bg: 'rgba(34,197,94,0.12)',  label: 'Excellent', likelihood: 'Very High', pct: 90 },
  B: { color: 'var(--color-grade-b)', bg: 'rgba(132,204,22,0.12)', label: 'Good',      likelihood: 'High',      pct: 75 },
  C: { color: 'var(--color-grade-c)', bg: 'rgba(234,179,8,0.12)',  label: 'Fair',      likelihood: 'Moderate',  pct: 55 },
  D: { color: 'var(--color-grade-d)', bg: 'rgba(249,115,22,0.12)', label: 'Poor',      likelihood: 'Low',       pct: 35 },
  E: { color: 'var(--color-grade-e)', bg: 'rgba(239,68,68,0.12)',  label: 'Very Poor', likelihood: 'Very Low',  pct: 15 },
};

const FACTOR_TIPS = {
  payment_history: { label: 'Payment History', weight: 40, tip: 'Make all upcoming payments on time to improve this score.' },
  income:          { label: 'Income Stability', weight: 25, tip: 'Ensure your income is documented — upload recent payslips.' },
  dti:             { label: 'Debt-to-Income',   weight: 25, tip: 'Pay down existing debts to reduce your DTI ratio.' },
  age:             { label: 'Account Age',      weight: 10, tip: 'This improves automatically over time.' },
};

function CreditPreCheck() {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    riskApi.get().then(setData).catch(() => setData(null)).finally(() => setLoading(false));
  }, []);

  if (loading) return (
    <Card style={{ marginBottom: 'var(--space-5)', opacity: 0.7 }}>
      <CardBody><div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Checking your credit profile…</div></CardBody>
    </Card>
  );

  if (!data) return null;

  const grade = data.grade || 'C';
  const cfg   = GRADE_CONFIG[grade] || GRADE_CONFIG.C;
  const score = data.score ?? 0;

  // Don't show the widget if there's no real data — all factors at 0.5 means the
  // backend returned defaults for a user with no statement/credit history yet.
  const hasRealData = score > 0 || Object.values(data.factors || {}).some(v => v !== 0.5);
  if (!hasRealData) {
    return (
      <Card style={{ marginBottom: 'var(--space-5)' }}>
        <CardHeader>Your Credit Pre-Check</CardHeader>
        <CardBody>
          <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            Upload a bank statement or payslip in your <strong>Vault</strong> to get a personalised credit estimate.
          </div>
        </CardBody>
      </Card>
    );
  }

  const factors = data.factors || {};
  const tips = Object.entries(FACTOR_TIPS)
    .filter(([key]) => {
      const val = factors[key] ?? 1;
      return val < 0.7;
    })
    .slice(0, 2)
    .map(([, f]) => f.tip);

  return (
    <Card style={{ marginBottom: 'var(--space-5)', borderLeft: `4px solid ${cfg.color}` }}>
      <CardHeader>Your Credit Pre-Check</CardHeader>
      <CardBody>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>

          {/* Grade + likelihood */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-4)' }}>
            <div style={{
              width: 72, height: 72, borderRadius: '50%',
              background: cfg.bg, border: `3px solid ${cfg.color}`,
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
              flexShrink: 0,
            }}>
              <span style={{ fontSize: '1.75rem', fontWeight: 800, color: cfg.color, lineHeight: 1 }}>{grade}</span>
              <span style={{ fontSize: '0.625rem', color: cfg.color, fontWeight: 600 }}>GRADE</span>
            </div>
            <div>
              <div style={{ fontWeight: 700, fontSize: '1rem' }}>{cfg.label} Credit</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: 4 }}>
                Approval likelihood: <strong style={{ color: cfg.color }}>{cfg.likelihood}</strong>
              </div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginTop: 2 }}>
                Risk score: <strong>{score}/100</strong>
              </div>
            </div>
          </div>

          {/* Factor bars */}
          <div style={{ display: 'grid', gap: 8 }}>
            {Object.entries(FACTOR_TIPS).map(([key, f]) => {
              const raw = factors[key] ?? 0.5;
              const pct = Math.round(raw * 100);
              const barColor = pct >= 70 ? '#22c55e' : pct >= 45 ? '#eab308' : '#ef4444';
              return (
                <div key={key}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', marginBottom: 3 }}>
                    <span style={{ color: 'var(--text-secondary)' }}>{f.label}</span>
                    <span style={{ fontWeight: 600, color: barColor }}>{pct}%</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: 'var(--border-color)', overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, background: barColor, borderRadius: 3, transition: 'width 0.6s ease' }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Tips */}
        {tips.length > 0 && (
          <div style={{ marginTop: 'var(--space-4)', padding: 'var(--space-3)', background: 'var(--bg-surface)', borderRadius: 8 }}>
            <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 6 }}>Tips to improve your chances:</div>
            <ul style={{ margin: 0, paddingLeft: 18, fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'grid', gap: 4 }}>
              {tips.map((tip, i) => <li key={i}>{tip}</li>)}
            </ul>
          </div>
        )}
      </CardBody>
    </Card>
  );
}

export default function SwapsTab({ loans }) {
  const [applications, setApplications] = useState([]);
  const [offers, setOffers]             = useState([]);
  const [showApply, setShowApply]       = useState(false);
  const [swapSubmitted, setSwapSubmitted] = useState(false);
  const [form, setForm]                 = useState({ currentBank: '', notes: '', currentRate: '', currentBalance: '', currentMonthly: '', monthsRemaining: '' });
  const [loading, setLoading]           = useState(false);
  const [vaultDocs, setVaultDocs]       = useState([]);
  const [attachingId, setAttachingId]   = useState(null);
  const showToast = useToast();
  const loan = loans[0];

  useEffect(() => {
    swaps.list().then(d => setApplications(d || [])).catch(() => {});
    bankOffers.list().then(d => setOffers(d || [])).catch(() => {});
    docsApi.list().then(d => setVaultDocs(d || [])).catch(() => {});
  }, []);

  function set(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  async function apply() {
    if (!form.currentBank) { showToast('Select your current bank', 'error'); return; }
    const currentRate    = parseFloat(form.currentRate)    || loan?.rate          || null;
    const currentBalance = parseFloat(form.currentBalance) || loan?.calculatedBalance || loan?.amount || null;
    const currentMonthly = parseFloat(form.currentMonthly) || null;
    const monthsRemaining = parseInt(form.monthsRemaining) || loan?.monthsRemaining || (loan?.term ? loan.term * 12 : null);
    setLoading(true);
    try {
      await myApplication.start({
        type: 'swap',
        currentBank:     form.currentBank,
        loanId:          loan?.id,
        requestedAmount: currentBalance || loan?.amount,
        currentRate,
        currentBalance,
        currentMonthly,
        monthsRemaining,
        property: loan ? {
          bondAmount:   currentBalance || loan.amount,
          currentBank:  form.currentBank,
          currentRate,
          loanId:       loan.id,
          address:      loan.address || '',
          term:         loan.term    || 20,
        } : undefined,
        notes: form.notes,
      });
      setShowApply(false);
      setSwapSubmitted(true);
      setForm({ currentBank: '', notes: '', currentRate: '', currentBalance: '', currentMonthly: '', monthsRemaining: '' });
    } catch (err) {
      showToast(err.message || 'Could not submit', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function acceptOffer(swapId, offerId) {
    try {
      await swaps.acceptOffer(swapId, offerId);
      showToast('Offer accepted! Our team will be in touch shortly.', 'success');
      const d = await swaps.list();
      setApplications(d || []);
    } catch (err) {
      showToast(err.message || 'Could not accept offer', 'error');
    }
  }

  async function declineOffer(swapId, offerId) {
    try {
      await swaps.declineOffer(swapId, offerId);
      showToast('Offer declined.', 'success');
      const d = await swaps.list();
      setApplications(d || []);
    } catch (err) {
      showToast(err.message || 'Could not decline offer', 'error');
    }
  }

  async function attachVaultDoc(swapId, docId) {
    try {
      await swaps.attachVault(swapId, docId);
      showToast('Document attached from vault', 'success');
      const d = await swaps.list();
      setApplications(d || []);
    } catch (err) {
      showToast(err.message || 'Could not attach', 'error');
    }
  }

  async function submitForReview(swapId) {
    try {
      await swaps.submitForReview(swapId);
      showToast('Application submitted for review!', 'success');
      const d = await swaps.list();
      setApplications(d || []);
    } catch (err) {
      showToast(err.message || 'Could not submit — make sure you have uploaded a bank statement', 'error');
    }
  }

  async function uploadSwapDoc(swapId, file, category) {
    try {
      const fd = new FormData();
      fd.append('documents', file);
      if (category) fd.append('category', category);
      await swaps.uploadDoc(swapId, fd);
      showToast('Document uploaded', 'success');
      const d = await swaps.list();
      setApplications(d || []);
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
    }
  }

  async function deleteSwapDoc(swapId, docIdx) {
    try {
      await swaps.deleteDoc(swapId, docIdx);
      const d = await swaps.list();
      setApplications(d || []);
    } catch (err) {
      showToast(err.message || 'Could not remove document', 'error');
    }
  }

  // Build bank comparison grid — memoised so it only recalculates when the loan or offers change
  const termMonths = loan ? (loan.monthsRemaining || loan.term * 12) : 0;
  const bankRows = useMemo(() => BANKS.map(bank => {
    const spread   = BANK_SPREADS[bank] || 0;
    const rate     = PRIME_RATE + spread;
    const offer    = offers.find(o => o.bank === bank);
    const effRate  = offer?.rate ?? rate;
    const savings  = loan ? calcSwapSavings(loan.amount, loan.rate, effRate, termMonths) : null;
    let breakEven  = null;
    if (loan && savings?.monthlySaving > 0) {
      const costs = calcSwitchingCosts(loan.amount);
      const months = Math.ceil(costs.total / savings.monthlySaving);
      const worthIt = months < termMonths * 0.5;
      breakEven = { months, costs: costs.total, worthIt, netSaving: savings.totalSaving - costs.total };
    }
    return { bank, rate: effRate, savings, breakEven };
  }).sort((a, b) => a.rate - b.rate), [loan, offers, termMonths]);

  const bestOption = loan
    ? bankRows.filter(r => r.bank !== loan.bank && r.savings?.monthlySaving > 0).sort((a, b) => b.savings.monthlySaving - a.savings.monthlySaving)[0]
    : null;

  // Refinance decision engine
  const decision = loan
    ? calcRefinanceDecision(loan.calculatedBalance || loan.amount, loan.rate, loan.monthsRemaining || loan.term * 12, BANK_SPREADS, PRIME_RATE)
    : null;

  const dot = c => <span style={{ display: 'inline-block', width: 10, height: 10, borderRadius: '50%', background: c, flexShrink: 0 }} />;
  const DECISION_STYLES = {
    SWITCH_NOW:  { bg: 'rgba(34,167,90,0.1)',  border: 'var(--mint)',         icon: dot('#16a34a'), label: 'Switch now' },
    SWITCH_SOON: { bg: 'rgba(230,126,34,0.1)', border: '#e67e22',             icon: dot('#e67e22'), label: 'Switch soon' },
    WAIT:        { bg: 'rgba(74,127,165,0.1)', border: '#4a7fa5',             icon: dot('#4a7fa5'), label: 'Wait & monitor' },
    NO_BENEFIT:  { bg: 'rgba(108,117,125,0.1)',border: 'var(--border-color)', icon: dot('#9ca3af'), label: 'No action needed' },
  };

  async function createShareLink() {
    if (!bestOption || !loan) return;
    try {
      const result = await shareApi.create({
        balance:      loan.calculatedBalance || loan.amount,
        currentRate:  loan.rate,
        newRate:      bestOption.rate,
        monthlySaving: Math.round(bestOption.savings.monthlySaving),
        totalSaving:  Math.round(bestOption.savings.totalSaving),
        term:         Math.round((loan.monthsRemaining || loan.term * 12) / 12),
        bank:         bestOption.bank,
      });
      const url = window.location.origin + result.url;
      navigator.clipboard.writeText(url).then(() => showToast('Share link copied!', 'success')).catch(() => showToast(`Share link: ${url}`, 'success'));
    } catch (e) {
      showToast('Could not create share link', 'error');
    }
  }

  return (
    <div className="fade-in">
      {/* Refinance Decision Card */}
      {decision && decision.recommendation !== 'NO_BENEFIT' && (() => {
        const s = DECISION_STYLES[decision.recommendation];
        return (
          <div style={{ background: s.bg, border: `1.5px solid ${s.border}`, borderRadius: 'var(--border-radius)', padding: 'var(--space-4) var(--space-5)', marginBottom: 'var(--space-5)', display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)' }}>
            <span style={{ fontSize: '1.25rem' }}>{s.icon}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 700, marginBottom: 4 }}>Bondly recommendation: {s.label}</div>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{decision.reason}</div>
              {decision.annualSaving > 0 && (
                <div style={{ marginTop: 6, fontSize: '0.875rem' }}>
                  Switch to <strong>{decision.bestBank}</strong> at <strong>{fmtPct(decision.bestRate)}</strong> — save <strong style={{ color: 'var(--mint)' }}>{fmt(decision.monthlySaving)}/mo</strong> · <strong>{fmt(decision.annualSaving)}/yr</strong>
                </div>
              )}
            </div>
          </div>
        );
      })()}

      {/* Recommendation banner */}
      {bestOption && bestOption.breakEven && (
        <div className={`swap-recommend ${bestOption.breakEven.worthIt ? 'swap-recommend--good' : 'swap-recommend--neutral'}`}>
          <div className="swap-recommend__icon">{bestOption.breakEven.worthIt ? <CheckCircle size={20} color="var(--color-success)"/> : <AlertTriangle size={20} color="var(--color-warning)"/>}</div>
          <div className="swap-recommend__content">
            <strong>
              {bestOption.breakEven.worthIt
                ? `Now is a good time to switch to ${bestOption.bank}`
                : `Switching to ${bestOption.bank} takes ${bestOption.breakEven.months} months to break even`}
            </strong>
            <span>
              Est. save {fmt(bestOption.savings.monthlySaving)}/month · switching costs {fmt(bestOption.breakEven.costs)} ·{' '}
              {bestOption.breakEven.worthIt
                ? `break-even in ${bestOption.breakEven.months} months, est. net saving ${fmt(bestOption.breakEven.netSaving)} over your remaining term`
                : `est. net saving ${fmt(bestOption.breakEven.netSaving)} — consider if you plan to stay ${bestOption.breakEven.months}+ months`}
            </span>
          </div>
          <Button variant={bestOption.breakEven.worthIt ? 'lime' : 'ghost'} size="sm" onClick={() => {
            setForm(f => ({ ...f, currentBank: loan.bank, currentRate: loan.rate ? String(loan.rate) : '', currentBalance: loan.calculatedBalance || loan.amount ? String(Math.round(loan.calculatedBalance || loan.amount)) : '', monthsRemaining: loan.monthsRemaining ? String(loan.monthsRemaining) : '' }));
            setShowApply(true);
          }}>Apply now</Button>
        </div>
      )}

      {/* Move when ready alert */}
      <MoveWhenReadyCard loan={loan} bankRows={bankRows} />

      {/* Bank comparison grid */}
      {loan && (
        <Card style={{ marginBottom: 'var(--space-5)' }}>
          <CardHeader>
            <span>
              {bankRows.filter(r => r.bank !== loan.bank && r.savings?.monthlySaving > 0).length > 0
                ? `${bankRows.filter(r => r.bank !== loan.bank && r.savings?.monthlySaving > 0).length} banks competing for your bond`
                : 'Bank Rate Comparison'}
            </span>
            {bestOption && (
              <button onClick={createShareLink} style={{ background: 'none', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', padding: '4px 12px', fontSize: '0.8rem', cursor: 'pointer', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: 6 }}>
                Share savings
              </button>
            )}
          </CardHeader>
          <div style={{ overflowX: 'auto' }}>
            <table className="data-table">
              <thead>
                <tr>
                  <th>Bank</th>
                  <th style={{ textAlign: 'right' }}>Est. Rate</th>
                  <th style={{ textAlign: 'right' }}>Est. Monthly saving</th>
                  <th style={{ textAlign: 'right' }}>Est. Total saving</th>
                  <th style={{ textAlign: 'right' }}>Break-even</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {bankRows.map(({ bank, rate, savings, breakEven }) => {
                  const isCurrent  = bank === loan.bank;
                  const isBest     = bestOption && bank === bestOption.bank;

                  return (
                    <tr key={bank} style={{ background: isBest ? 'rgba(184,224,74,0.06)' : isCurrent ? 'rgba(74,127,165,0.06)' : undefined }}>
                      <td>
                        <strong>{bank}</strong>
                        {isCurrent && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: 'var(--mint)', fontWeight: 600 }}>Current</span>}
                        {isBest && !isCurrent && <span style={{ marginLeft: 6, fontSize: '0.7rem', background: 'var(--lime, #b8e04a)', color: 'var(--forest, #1e3a5f)', fontWeight: 700, padding: '1px 7px', borderRadius: 999 }}>Best deal</span>}
                      </td>
                      <td style={{ textAlign: 'right' }}>{fmtPct(rate)}</td>
                      <td style={{ textAlign: 'right', color: savings?.monthlySaving > 0 ? 'var(--mint)' : undefined }}>
                        {savings?.monthlySaving > 0 ? `~${fmt(savings.monthlySaving)}/mo` : isCurrent ? '—' : 'No saving'}
                      </td>
                      <td style={{ textAlign: 'right', color: breakEven?.netSaving > 0 ? 'var(--mint)' : undefined }}>
                        {breakEven?.netSaving > 0 ? fmt(breakEven.netSaving) : '—'}
                      </td>
                      <td style={{ textAlign: 'right', fontSize: '0.8125rem' }}>
                        {breakEven
                          ? <span style={{ color: breakEven.worthIt ? 'var(--mint)' : 'var(--text-secondary)' }}>
                              {breakEven.months} mo{breakEven.worthIt ? ' ✓' : ''}
                            </span>
                          : '—'}
                      </td>
                      <td>
                        {!isCurrent && savings?.monthlySaving > 0 && (
                          <button
                            className="swap-bank-select"
                            onClick={() => {
                              if (!showApply) setShowApply(true);
                              if (!form.currentBank && loan) setForm(f => ({ ...f, currentBank: loan.bank, currentRate: loan.rate ? String(loan.rate) : f.currentRate, currentBalance: (loan.calculatedBalance || loan.amount) ? String(Math.round(loan.calculatedBalance || loan.amount)) : f.currentBalance, monthsRemaining: loan.monthsRemaining ? String(loan.monthsRemaining) : f.monthsRemaining }));
                            }}
                          >
                            Apply
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {loan && (
            <div style={{ padding: 'var(--space-3) var(--space-5)', borderTop: '1px solid var(--border-color)', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
              Rates shown are estimates based on current prime ({PRIME_RATE}%) plus published bank spreads — banks compete for your business so your actual rate is often lower.
              Investec rates apply to qualifying clients only (typically excellent credit + bond over R1.5M).
              Bondly compares all banks simultaneously — banks compete for your business and you receive the best competing offer.
              Break-even based on estimated switching costs ≈ {fmt(calcSwitchingCosts(loan.amount).total)} (bond cancellation + new registration, excl. legal admin — all figures are estimates).
            </div>
          )}
        </Card>
      )}

      {/* Apply form */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)' }}>
        <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem' }}>My Applications</h3>
        <Button variant="lime" size="sm" onClick={() => setShowApply(s => !s)}>
          {showApply ? 'Cancel' : '+ New application'}
        </Button>
      </div>

      {showApply && <CreditPreCheck />}

      {showApply && (
        <Card style={{ marginBottom: 'var(--space-5)' }}>
          <CardHeader>Multi-Bank Switch Application</CardHeader>
          <CardBody>
            <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
              <Select label="Current bank" id="swapFrom" value={form.currentBank} onChange={set('currentBank')}>
                <option value="">Select current bank</option>
                {BANKS.map(b => <option key={b} value={b}>{b}</option>)}
              </Select>

              <div style={{ padding: 'var(--space-3) var(--space-4)', background: 'rgba(108,187,167,0.08)', border: '1px solid rgba(108,187,167,0.25)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>
                Bondly compares <strong style={{ color: 'var(--text-primary)' }}>all 7 major banks</strong> simultaneously — ABSA, FNB, Nedbank, Standard Bank, Capitec, SA Home Loans & Investec. Banks compete for your business and you receive the best competing offer. You don't choose the bank; you choose the best rate.
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <Input label="Current interest rate (%)" id="swapRate" type="number" step="0.01" inputMode="decimal" lang="en" value={form.currentRate} onChange={set('currentRate')} placeholder={loan?.rate ? String(loan.rate) : 'e.g. 11.75'} />
                <Input label="Outstanding balance (R)" id="swapBal" type="number" value={form.currentBalance} onChange={set('currentBalance')} placeholder={loan?.calculatedBalance || loan?.amount ? String(Math.round(loan?.calculatedBalance || loan?.amount)) : 'e.g. 1 250 000'} />
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
                <Input label="Monthly payment (R)" id="swapMonthly" type="number" value={form.currentMonthly} onChange={set('currentMonthly')} placeholder="e.g. 13 500" />
                <Input label="Months remaining" id="swapTerm" type="number" value={form.monthsRemaining} onChange={set('monthsRemaining')} placeholder={loan?.monthsRemaining ? String(loan.monthsRemaining) : 'e.g. 216'} />
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: -8 }}>
                Find these on your latest bond statement — approximate is fine, your broker verifies before submission.
              </div>

              <Input label="Notes for our team (optional)" id="swapNotes" type="text" value={form.notes} onChange={set('notes')} placeholder="e.g. preferred timeline, any constraints" />

              {loan != null && <SwapReadinessGate loan={loan} />}

              <Button
                variant="lime"
                onClick={apply}
                loading={loading}
              >
                Send to all banks — get the best rate
              </Button>
              {loan != null && (loan.dataConfidence ?? 0) < 40 && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--color-warning)', background: 'rgba(217,119,6,0.08)', border: '1px solid rgba(217,119,6,0.25)', borderRadius: 'var(--border-radius-sm)', padding: '10px 14px', marginTop: 4 }}>
                  <strong>Tip:</strong> Uploading a bank statement or ID document will speed up bank processing. You can still apply — banks may request more documents during review.
                </div>
              )}
            </div>
          </CardBody>
        </Card>
      )}

      {/* Applications list */}
      {applications.length === 0 && !showApply ? (
        swapSubmitted ? (
          <Card style={{ borderLeft: '4px solid var(--color-success)' }}>
            <CardBody>
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
                <CheckCircle size={28} color="var(--color-success)" />
                <div style={{ fontWeight: 700, fontSize: '1rem' }}>Application submitted to all 7 banks</div>
              </div>
              <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
                A Bondly advisor will contact you within 1 business day to confirm your details. Banks typically respond within 3–5 business days. Upload your bank statement in the Vault to speed things up.
              </p>
            </CardBody>
          </Card>
        ) : (
        <div className="empty-state">
          <div style={{ marginBottom: 'var(--space-3)', color: 'var(--text-secondary)' }}><svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg></div>
          <p style={{ fontWeight: 600, marginBottom: 'var(--space-2)' }}>No switch applications yet</p>
          <p style={{ color: 'var(--text-secondary)', marginBottom: 0, fontSize: '0.9375rem' }}>
            {loan
              ? 'Compare the rates above — select multiple banks to get competing offers simultaneously.'
              : "Switch & Save is for moving an existing home loan to a bank with a lower rate. If you're looking for your first bond, head to the Apply tab."}
          </p>
        </div>
        )
      ) : (
        applications.map(app => (
          <Card key={app.id} style={{ marginBottom: 'var(--space-4)' }}>
            <CardBody>
              {/* Header */}
              <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-4)' }}>
                <div>
                  <div style={{ fontWeight: 700, fontSize: '1rem' }}>{app.currentBank} → {app.targetBank}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2, display: 'flex', flexWrap: 'wrap', gap: 8, alignItems: 'center' }}>
                    <span>Submitted {fmtDate(app.submittedAt || app.createdAt)}</span>
                    {app.monthlySaving > 0 && <span style={{ color: 'var(--mint)' }}>· Save {fmt(app.monthlySaving)}/mo</span>}
                    {app._multinetRef && (
                      <span style={{ color: '#16a34a', fontWeight: 600, background: '#16a34a12', padding: '1px 7px', borderRadius: 4 }}>
                        ✓ Multinet ref: {app._multinetRef}
                      </span>
                    )}
                  </div>
                </div>
                <span className={`pill pill--${statusColor(app.status)}`}>{app.status?.replace(/_/g, ' ')}</span>
              </div>

              {/* Per-bank status tracker */}
              {(app.bankStatuses || []).length > 0 && (
                <BankStatusTracker bankStatuses={app.bankStatuses} />
              )}

              {/* Progress stepper */}
              <SwapProgressStepper status={app.status} conveyancingStage={app.conveyancingStage} />

              {/* Bank offers comparison — shown when offers exist */}
              {(app.offers || []).length > 0 && (
                <OfferComparison
                  offers={app.offers}
                  loan={loan}
                  onAccept={(offerId) => acceptOffer(app.id, offerId)}
                  onDecline={(offerId) => declineOffer(app.id, offerId)}
                />
              )}

              {/* Next steps guidance */}
              <SwapNextSteps status={app.status} conveyancingStage={app.conveyancingStage} />

              {/* ── Admin doc request note ── */}
              {(() => {
                const req = (app.notes || []).filter(n => n.type === 'doc_request').slice(-1)[0];
                return req ? (
                  <div style={{ margin: 'var(--space-3) 0', padding: 'var(--space-3) var(--space-4)', background: 'rgba(217,119,6,0.08)', borderRadius: 'var(--border-radius-sm)', borderLeft: '3px solid var(--color-warning)', fontSize: '0.875rem' }}>
                    <strong style={{ color: 'var(--color-warning)' }}>Documents requested by our team: </strong>
                    <span style={{ color: 'var(--text-secondary)' }}>{req.text}</span>
                  </div>
                ) : null;
              })()}

              {/* ── Document section ── */}
              <DocUploadSection
                app={app}
                canEdit={['awaiting_documents', 'submitted'].includes(app.status)}
                vaultDocs={vaultDocs}
                onUpload={(file, category) => uploadSwapDoc(app.id, file, category)}
                onDelete={(docIdx) => deleteSwapDoc(app.id, docIdx)}
                onAttachVault={(docId) => attachVaultDoc(app.id, docId)}
              />

              {/* ── Submit for review ── */}
              {app.status === 'awaiting_documents' && (
                <div style={{ marginTop: 'var(--space-4)', display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
                  <Button
                    variant="primary"
                    size="sm"
                    disabled={!(app.documents || []).length}
                    onClick={() => submitForReview(app.id)}
                  >
                    Submit for review
                  </Button>
                  {!(app.documents || []).length
                    ? <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Upload your bank statement first</span>
                    : <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Our team will review within 1–2 business days</span>
                  }
                </div>
              )}
            </CardBody>
          </Card>
        ))
      )}
    </div>
  );
}

// ── Per-category document upload section ─────────────────────────────────────
const SWAP_DOC_CATEGORIES = [
  { key: 'bank_statement', label: 'Bank statements',     hint: '3 months — PDF preferred',  required: true },
  { key: 'income',         label: 'Payslips',            hint: '3 months',                   required: true },
  { key: 'identity',       label: 'SA ID / Passport',    hint: 'Clear photo or scan',         required: true },
  { key: 'bond_statement', label: 'Bond statement',      hint: 'Most recent from your bank', required: false },
  { key: 'residence',      label: 'Proof of address',    hint: 'Already covered by your bank statement — only upload if a specific bank asks for a separate utility bill', required: false },
];

function DocUploadSection({ app, canEdit, vaultDocs, onUpload, onDelete, onAttachVault }) {
  const [showVault, setShowVault] = useState(false);
  const docs = app.documents || [];

  function docsForCategory(catKey) {
    return docs.map((d, i) => ({ ...d, _idx: i })).filter(d =>
      (d.category || '').toLowerCase() === catKey ||
      (!d.category && catKey === 'bank_statement' && (d.originalName||'').toLowerCase().includes('statement'))
    );
  }

  return (
    <div className="swap-docs" style={{ marginTop: 'var(--space-4)' }}>
      <div style={{ fontWeight: 600, fontSize: '0.875rem', marginBottom: 'var(--space-3)' }}>
        Supporting documents
        {docs.length > 0 && <span style={{ marginLeft: 8, fontWeight: 400, color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>{docs.length} file{docs.length !== 1 ? 's' : ''} uploaded</span>}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
        {SWAP_DOC_CATEGORIES.map(cat => {
          const catDocs = docsForCategory(cat.key);
          const have = catDocs.length > 0;
          return (
            <div key={cat.key} style={{ display: 'flex', alignItems: 'flex-start', gap: 'var(--space-3)', padding: 'var(--space-3)', background: 'var(--bg-page)', borderRadius: 'var(--border-radius-sm)', border: `1px solid ${have ? 'rgba(22,163,74,0.2)' : cat.required ? 'rgba(220,38,38,0.1)' : 'var(--border-color)'}` }}>
              <span style={{ marginTop: 2, fontWeight: 700, color: have ? 'var(--color-success)' : cat.required ? 'var(--color-error)' : 'var(--text-secondary)', fontSize: '0.875rem', width: 14, flexShrink: 0 }}>{have ? '✓' : cat.required ? '○' : '○'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: catDocs.length ? 'var(--space-2)' : 0 }}>
                  <span style={{ fontWeight: 600, fontSize: '0.875rem' }}>{cat.label}</span>
                  {cat.required && !have && <span style={{ fontSize: '0.7rem', color: 'var(--color-error)', background: 'rgba(239,68,68,0.08)', padding: '1px 5px', borderRadius: 3 }}>required</span>}
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{cat.hint}</span>
                </div>

                {/* Uploaded docs for this category */}
                {catDocs.map(d => (
                  <div key={d._idx} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4, fontSize: '0.8125rem' }}>
                    <Paperclip size={14} />
                    <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.originalName}>{d.originalName || d.name}</span>
                    {d.vaultId && <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', background: 'rgba(0,0,0,0.07)', padding: '1px 5px', borderRadius: 3 }}>vault</span>}
                    {canEdit && (
                      <button onClick={() => onDelete(d._idx)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', padding: '0 4px', fontSize: '0.75rem' }} title="Remove">✕</button>
                    )}
                  </div>
                ))}
              </div>

              {/* Upload button */}
              {canEdit && (
                <label style={{ cursor: 'pointer', flexShrink: 0 }}>
                  <input
                    type="file"
                    accept=".pdf,.jpg,.jpeg,.png"
                    style={{ display: 'none' }}
                    onChange={e => { if (e.target.files[0]) { onUpload(e.target.files[0], cat.key); e.target.value = ''; } }}
                  />
                  <span className="btn btn--ghost btn--sm" style={{ fontSize: '0.75rem', padding: '3px 10px' }}>
                    {have ? '+ Add' : '+ Upload'}
                  </span>
                </label>
              )}
            </div>
          );
        })}
      </div>

      {/* Vault attach */}
      {canEdit && vaultDocs.length > 0 && (
        <div style={{ marginTop: 'var(--space-3)' }}>
          <button className="swap-docs__toggle" onClick={() => setShowVault(v => !v)}>
            {showVault ? 'Hide vault' : '+ Attach from vault'}
          </button>
          {showVault && (
            <div className="swap-vault-picker fade-in" style={{ marginTop: 'var(--space-2)' }}>
              {vaultDocs.map(doc => {
                const alreadyAttached = docs.some(d => d.vaultId === doc.id);
                return (
                  <div key={doc.id} className="vault-doc-row">
                    <div className="vault-doc-row__info">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
                      <span>{doc.label || doc.originalName}</span>
                      <span className="vault-doc-row__cat">{doc.category}</span>
                    </div>
                    <Button variant="ghost" size="sm" disabled={alreadyAttached} onClick={() => onAttachVault(doc.id)}>
                      {alreadyAttached ? 'Attached' : 'Attach'}
                    </Button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function statusColor(s) {
  if (!s) return 'green';
  s = s.toLowerCase();
  if (s === 'approved' || s === 'completed') return 'green';
  if (s === 'rejected' || s === 'cancelled') return 'orange';
  if (s === 'awaiting_documents') return 'orange';
  return 'blue';
}

// ── Per-bank status tracker ───────────────────────────────────────────────────
function BankStatusTracker({ bankStatuses }) {
  return (
    <div className="bank-status-tracker">
      <div className="bank-status-tracker__label">Banks contacted</div>
      <div className="bank-status-tracker__banks">
        {bankStatuses.map(bs => (
          <div key={bs.bank} className={`bank-status-item bank-status-item--${BANK_STATUS_COLORS[bs.status] || 'blue'}`}>
            <span className="bank-status-item__name">{bs.bank}</span>
            <span className="bank-status-item__status">{(bs.status || '').replace(/_/g, ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Offer comparison cards ────────────────────────────────────────────────────
function OfferComparison({ offers, loan, onAccept, onDecline }) {
  const pendingOffers  = offers.filter(o => o.status === 'pending');
  const acceptedOffer  = offers.find(o => o.status === 'accepted');
  const hasDecision    = !!acceptedOffer || pendingOffers.length === 0;

  return (
    <div className="offer-comparison">
      <div className="offer-comparison__title">
        {acceptedOffer
          ? `Accepted: ${acceptedOffer.bank} at ${acceptedOffer.rate}%`
          : `${offers.length} bank offer${offers.length > 1 ? 's' : ''} received — review and accept`}
      </div>
      <div className="offer-comparison__cards">
        {offers.map(offer => {
          const expiry = new Date(offer.expiresAt);
          const expired = expiry < new Date();
          const daysLeft = Math.max(0, Math.ceil((expiry - new Date()) / 86400000));
          const monthly = offer.monthlyPayment || (loan
            ? (() => {
                const r = offer.rate / 100 / 12;
                const n = (offer.term || loan.term || 20) * 12;
                return Math.round(loan.amount * r * Math.pow(1+r,n) / (Math.pow(1+r,n)-1));
              })()
            : null);
          const isAccepted = offer.status === 'accepted';
          const isDeclined = offer.status === 'declined';

          return (
            <div
              key={offer.id}
              className={`offer-card ${isAccepted ? 'offer-card--accepted' : ''} ${isDeclined ? 'offer-card--declined' : ''}`}
            >
              <div className="offer-card__bank">{offer.bank}</div>
              <div className="offer-card__rate">{offer.rate}% <span>per annum</span></div>
              {monthly && (
                <div className="offer-card__monthly">{fmt(monthly)}<span>/month</span></div>
              )}
              {offer.term && (
                <div className="offer-card__detail">{offer.term} year term</div>
              )}
              {offer.initiationFee && (
                <div className="offer-card__detail">Initiation fee: {fmt(offer.initiationFee)}</div>
              )}
              {offer.conditions && (
                <div className="offer-card__conditions">{offer.conditions}</div>
              )}
              <div className={`offer-card__expiry ${expired ? 'expired' : daysLeft <= 5 ? 'urgent' : ''}`}>
                {isAccepted ? '✓ Accepted' : isDeclined ? '✕ Declined' : expired ? 'Expired' : `Expires in ${daysLeft} day${daysLeft !== 1 ? 's' : ''}`}
              </div>
              {offer.status === 'pending' && !expired && (
                <div className="offer-card__actions">
                  <Button variant="lime" size="sm" onClick={() => onAccept(offer.id)}>Accept</Button>
                  <Button variant="ghost" size="sm" onClick={() => onDecline(offer.id)}>Decline</Button>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Progress stepper (pre + post acceptance) ──────────────────────────────────
const SWAP_STEPS = [
  { key: 'awaiting_documents', label: 'Upload Docs' },
  { key: 'submitted',          label: 'Submitted' },
  { key: 'under_review',       label: 'Under Review' },
  { key: 'approved',           label: 'Offers In' },
  { key: 'in_progress',        label: 'In Progress' },
  { key: 'completed',          label: 'Completed' },
];

function SwapProgressStepper({ status, conveyancingStage }) {
  const s = (status || '').toLowerCase();
  if (s === 'rejected' || s === 'cancelled') {
    return (
      <div className="swap-stepper swap-stepper--rejected">
        <span>{s === 'rejected' ? '✕ Application rejected' : '✕ Application cancelled'}</span>
      </div>
    );
  }
  const activeIdx = SWAP_STEPS.findIndex(step => step.key === s);
  const inConveyancing = conveyancingStage && ['in_progress', 'completed'].includes(s);

  return (
    <div>
      <div className="swap-stepper">
        {SWAP_STEPS.map((step, i) => {
          const done    = i < activeIdx;
          const current = i === activeIdx;
          return (
            <div key={step.key} className={`swap-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
              <div className="swap-step__dot">{done ? '✓' : i + 1}</div>
              <div className="swap-step__label">{step.label}</div>
              {i < SWAP_STEPS.length - 1 && <div className="swap-step__line" />}
            </div>
          );
        })}
      </div>
      {inConveyancing && <ConveyancingStepper stage={conveyancingStage} />}
    </div>
  );
}

function ConveyancingStepper({ stage }) {
  const activeIdx = CONVEYANCING_STAGES.findIndex(s => s.key === stage);
  return (
    <div className="conveyancing-stepper">
      <div className="conveyancing-stepper__label">Conveyancing Pipeline</div>
      <div className="conveyancing-stepper__steps">
        {CONVEYANCING_STAGES.map((step, i) => {
          const done    = i < activeIdx;
          const current = i === activeIdx;
          return (
            <div key={step.key} className={`conv-step ${done ? 'done' : ''} ${current ? 'current' : ''}`}>
              <div className="conv-step__dot">{done ? '✓' : ''}</div>
              <div className="conv-step__label">{step.label}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Next steps ────────────────────────────────────────────────────────────────
const NEXT_STEPS_MAP = {
  awaiting_documents: 'Upload your latest 3 months bank statements below, then click "Submit for review" — our team can only assess your application once we have your bank statements.',
  submitted:    'Documents received. Our team will verify your information and submit to the selected banks via Multinet — usually within 1–2 business days.',
  under_review: 'Your application has been submitted to the selected banks via Multinet. We typically receive responses within 5–10 business days. You\'ll be notified as soon as offers come in.',
  approved:     'You have bank offers! Review the offers above and accept the best one to proceed.',
  in_progress:  'Offer accepted — conveyancing is underway. Your attorney will be in touch to sign documents.',
  completed:    'Your bond switch is complete! Ensure your first repayment to the new bank deducts correctly.',
};

const CONVEYANCING_MESSAGES = {
  offer_accepted:           'Great! Our team has received your acceptance and is notifying your current bank.',
  cancellation_notice_sent: 'Cancellation notice sent to your current bank. This starts the 90-day notice period.',
  attorney_instructed:      'A conveyancing attorney has been instructed and will contact you to sign transfer documents.',
  valuation_ordered:        'A property valuation has been ordered by the new bank. The valuator will contact you to arrange access.',
  valuation_done:           'Valuation complete. The bank is processing final bond approval.',
  registration_in_progress: 'Bond registration is in progress at the Deeds Office. This typically takes 4–6 weeks.',
  registered:               'Your bond has been registered! The new bank will take over your account within a few days.',
  complete:                 'Your bond switch is complete! Welcome to your new bank. Ensure your debit order details are updated.',
};

function SwapNextSteps({ status, conveyancingStage }) {
  const msg = conveyancingStage ? CONVEYANCING_MESSAGES[conveyancingStage] : NEXT_STEPS_MAP[(status || '').toLowerCase()];
  if (!msg) return null;
  return (
    <div className="swap-next-steps">
      <span className="swap-next-steps__icon">ℹ</span>
      <span>{msg}</span>
    </div>
  );
}

// ── Document checklist ────────────────────────────────────────────────────────
// Bank statement covers Proof of Address — no separate residence doc required.
const REQUIRED_DOCS = [
  { label: 'South African ID document / passport', category: 'identity' },
  { label: 'Last 3 months payslips', category: 'income' },
  { label: 'Last 3 months bank statements', category: 'bank_statement', note: 'also serves as proof of address' },
  { label: 'Current bond statement', category: 'bond_statement' },
];

function DocChecklist({ attached }) {
  const attachedCategories = attached.map(d => (d.category || '').toLowerCase());
  const allDone = REQUIRED_DOCS.every(d => attachedCategories.includes(d.category));
  return (
    <div className="doc-checklist">
      <div className="doc-checklist__title">
        Required documents
        {allDone && <span className="doc-checklist__done">✓ All attached</span>}
      </div>
      {REQUIRED_DOCS.map(doc => {
        const have = attachedCategories.includes(doc.category);
        return (
          <div key={doc.category} className={`doc-checklist__item ${have ? 'done' : ''}`}>
            <span className="doc-checklist__tick">{have ? '✓' : '○'}</span>
            <span>{doc.label}{doc.note && <em style={{ marginLeft: 6, opacity: 0.7, fontStyle: 'normal', fontSize: '0.85em' }}>· {doc.note}</em>}</span>
          </div>
        );
      })}
    </div>
  );
}

// ── Data readiness gate ───────────────────────────────────────────────────────
function SwapReadinessGate({ loan }) {
  const score = loan.dataConfidence ?? null;
  if (score == null) return null;
  const color  = score >= 80 ? 'var(--color-success)' : score >= 60 ? 'var(--color-warning)' : 'var(--color-error)';
  const bg     = score >= 80 ? 'rgba(22,163,74,0.08)' : score >= 60 ? 'rgba(217,119,6,0.08)' : 'rgba(239,68,68,0.08)';
  const border = score >= 80 ? 'rgba(22,163,74,0.25)' : score >= 60 ? 'rgba(217,119,6,0.25)' : 'rgba(239,68,68,0.25)';
  const message = score >= 80
    ? 'Your bond data is well-verified. Banks will be able to process your application quickly.'
    : score >= 60
    ? 'Your data is partially verified. Consider uploading more documents to speed up approval.'
    : 'Your data is missing key documents. Banks may reject or delay this application.';
  return (
    <div style={{ padding: 'var(--space-3) var(--space-4)', background: bg, border: `1px solid ${border}`, borderRadius: 'var(--border-radius-sm)', fontSize: '0.8125rem' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <div style={{ height: 6, flex: 1, background: 'rgba(0,0,0,0.12)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${score}%`, background: color, borderRadius: 3 }} />
        </div>
        <span style={{ color, fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>{score}%</span>
      </div>
      <div style={{ color: 'var(--text-secondary)', lineHeight: 1.4 }}>
        <strong style={{ color: 'var(--text-primary)' }}>Data confidence: </strong>{message}
      </div>
    </div>
  );
}
