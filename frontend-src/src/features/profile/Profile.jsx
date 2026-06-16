import { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { User, CreditCard, DollarSign, Lock, Bell, MessageCircle, Gift, Clock, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../context/AuthContext.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useToast } from '@bondly/ui/components/Toast.jsx';
import { profile as profileApi, auth as authApi, alerts as alertsApi, kyc as kycApi, referrals as referralsApi, whatsapp as whatsappApi, documents as docsApi } from '../../lib/api.js';
import { validateSAID } from '../../lib/saId.js';
import Button from '@bondly/ui/components/Button.jsx';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';
import Input, { Select } from '@bondly/ui/components/Input.jsx';
import './Profile.css';

const MENU_ITEMS = [
  { id: 'account',       label: 'Account settings', icon: <User size={18}/> },
  { id: 'identity',      label: 'Verify identity',  icon: <CreditCard size={18}/> },
  { id: 'financial',     label: 'Financial profile', icon: <DollarSign size={18}/> },
  { id: 'security',      label: 'Security',          icon: <Lock size={18}/> },
  { id: 'notifications', label: 'Notifications',     icon: <Bell size={18}/> },
  { id: 'whatsapp',      label: 'WhatsApp',          icon: <MessageCircle size={18}/> },
  { id: 'referrals',     label: 'Refer a friend',    icon: <Gift size={18}/> },
];

// ── Identity verification section ─────────────────────────────────────────────
function IdentitySection({ kycStatus, kycIdNumber, kycIdInfo, kycIdError, kycSubmitting, kycResubmit, onIdInput, onSubmit, onResubmit, idDocRef, selfieRef, vaultCategories }) {
  const status   = kycStatus?.kycStatus || 'not_submitted';
  const showForm = status === 'not_submitted' || status === 'rejected' || kycResubmit;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Status card */}
      <Card>
        <CardHeader>Identity Verification</CardHeader>
        <CardBody>
          <p style={{ fontSize: '0.875rem', color: 'var(--text-secondary)', marginBottom: 'var(--space-4)', lineHeight: 1.6 }}>
            Banks require verified identity (FICA) before processing a bond application.
            This is a one-time step — we'll review your documents within 1 business day.
          </p>

          {status === 'approved' && (
            <div className="kyc-status kyc-status--approved">
              <span className="kyc-status__icon">✓</span>
              <div>
                <div className="kyc-status__title">Identity Verified</div>
                <div className="kyc-status__sub">
                  {kycStatus.idNumberMasked && <>ID: {kycStatus.idNumberMasked} · </>}
                  Verified {kycStatus.kycReviewedAt ? new Date(kycStatus.kycReviewedAt).toLocaleDateString('en-ZA') : ''}
                </div>
              </div>
            </div>
          )}

          {status === 'pending_review' && (
            <div className="kyc-status kyc-status--pending">
              <span className="kyc-status__icon"><Clock size={20}/></span>
              <div>
                <div className="kyc-status__title">Under Review</div>
                <div className="kyc-status__sub">
                  Submitted {kycStatus.kycSubmittedAt ? new Date(kycStatus.kycSubmittedAt).toLocaleDateString('en-ZA') : '—'} ·
                  ID doc {kycStatus.hasIdDocument ? '✓' : '✗'} ·
                  Selfie {kycStatus.hasSelfie ? '✓' : 'optional'}
                </div>
              </div>
            </div>
          )}

          {status === 'rejected' && !kycResubmit && (
            <div className="kyc-status kyc-status--rejected">
              <span className="kyc-status__icon">✗</span>
              <div>
                <div className="kyc-status__title">Verification Unsuccessful</div>
                {kycStatus.kycRejectionReason && (
                  <div className="kyc-status__sub">{kycStatus.kycRejectionReason}</div>
                )}
                <Button variant="lime" size="sm" style={{ marginTop: 'var(--space-3)' }} onClick={onResubmit}>
                  Resubmit documents →
                </Button>
              </div>
            </div>
          )}

          {status === 'not_submitted' && (
            <div className="kyc-status kyc-status--none">
              <span className="kyc-status__icon"><ShieldCheck size={20}/></span>
              <div>
                <div className="kyc-status__title">Not yet submitted</div>
                <div className="kyc-status__sub">Complete the form below to get verified</div>
              </div>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Submission form */}
      {showForm && (
        <Card>
          <CardHeader>{status === 'rejected' ? 'Resubmit Identity Documents' : 'Verify Your Identity'}</CardHeader>
          <CardBody>
            <form onSubmit={onSubmit} style={{ display: 'grid', gap: 'var(--space-5)' }}>

              {/* Step 1 */}
              <div className="kyc-step">
                <div className="kyc-step__num">1</div>
                <div className="kyc-step__body">
                  <div className="kyc-step__label">SA ID number</div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)', marginTop: 'var(--space-2)' }}>
                    <input
                      type="text"
                      inputMode="numeric"
                      maxLength={13}
                      value={kycIdNumber}
                      onChange={onIdInput}
                      placeholder="8001015009087"
                      className={`kyc-id-input${kycIdInfo ? ' kyc-id-input--valid' : kycIdError ? ' kyc-id-input--error' : ''}`}
                    />
                    {kycIdError && <div className="kyc-field-error">{kycIdError}</div>}
                    {kycIdInfo && (
                      <div className="kyc-id-info">
                        <span>DOB: <strong>{kycIdInfo.dob}</strong></span>
                        <span>Age: <strong>{kycIdInfo.age}</strong></span>
                        <span>Gender: <strong>{kycIdInfo.gender}</strong></span>
                        <span>Status: <strong>{kycIdInfo.citizenship}</strong></span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Step 2 */}
              <div className="kyc-step">
                <div className="kyc-step__num">2</div>
                <div className="kyc-step__body">
                  <div className="kyc-step__label">Photo of your SA ID card or passport</div>
                  <p className="kyc-step__hint">Clear, in-focus photo — all four corners visible. Smart ID card, green barcoded ID book, or passport.</p>
                  <label className="kyc-upload-btn">
                    <input ref={idDocRef} type="file" accept="image/*,.pdf" style={{ display: 'none' }} />
                    <span>Choose file</span>
                  </label>
                </div>
              </div>

              {/* Step 3 */}
              <div className="kyc-step">
                <div className="kyc-step__num">3</div>
                <div className="kyc-step__body">
                  <div className="kyc-step__label">Selfie <span style={{ fontWeight: 400, color: 'var(--text-secondary)' }}>(recommended)</span></div>
                  <p className="kyc-step__hint">A clear photo of your face. Banks use this to confirm you match your ID document.</p>
                  <label className="kyc-upload-btn">
                    <input ref={selfieRef} type="file" accept="image/*" style={{ display: 'none' }} />
                    <span>Choose selfie</span>
                  </label>
                </div>
              </div>

              <Button type="submit" variant="lime" full loading={kycSubmitting} disabled={!kycIdInfo}>
                Submit for verification →
              </Button>
              <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                Documents are encrypted and stored securely. Only verified status — not the documents themselves — is shared with banks. Processed under <strong>POPIA</strong>.
              </p>
            </form>
          </CardBody>
        </Card>
      )}

      {/* FICA checklist */}
      <Card>
        <CardHeader>What banks need for FICA</CardHeader>
        <CardBody>
          {[
            { icon: <CreditCard size={18}/>, label: 'Valid SA ID / passport',           done: kycStatus?.hasIdDocument, note: 'Step 2 above' },
            { icon: <User size={18}/>,       label: 'Selfie / liveness check',          done: kycStatus?.hasSelfie,    note: 'Step 3 above' },
            { icon: <ShieldCheck size={18}/>,label: 'Proof of residence (< 3 months)',  done: vaultCategories.includes('residence'),      note: 'Upload in My Bonds → vault' },
            { icon: <DollarSign size={18}/>, label: 'Last 3 payslips',                  done: vaultCategories.includes('income'),          note: 'Upload in My Bonds → vault' },
            { icon: <Bell size={18}/>,       label: 'Last 3 months bank statements',    done: vaultCategories.includes('bank_statement'),  note: 'Upload in My Bonds → vault' },
          ].map(item => (
            <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-color)' }}>
              <span style={{ width: 28, color: 'var(--text-secondary)', display:'flex', alignItems:'center' }}>{item.icon}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{item.label}</div>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{item.note}</div>
              </div>
              <span style={{ fontSize: '0.8125rem', fontWeight: 600, color: item.done ? 'var(--mint)' : 'var(--text-secondary)' }}>
                {item.done ? '✓ Done' : 'Needed'}
              </span>
            </div>
          ))}
        </CardBody>
      </Card>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function Profile() {
  const [section, setSection]         = useState('account');
  const [profileData, setProfileData] = useState(null);
  const [form, setForm]               = useState({});
  const [loading, setLoading]         = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState('');
  const [savingsThreshold, setSavingsThreshold] = useState('');
  const [thresholdSet, setThresholdSet]         = useState(false);
  const [notifPrefs, setNotifPrefs]             = useState({ notifyRateChanges: true, notifyApplicationUpdates: true, notifySwapOpportunities: true, notifyMonthlyReport: true });
  const [notifSaving, setNotifSaving]           = useState(false);
  const [kycStatus, setKycStatus]         = useState(null);
  const [vaultCategories, setVaultCategories] = useState([]);
  const [kycIdNumber, setKycIdNumber]     = useState('');
  const [kycIdInfo, setKycIdInfo]         = useState(null);
  const [kycIdError, setKycIdError]       = useState('');
  const [kycSubmitting, setKycSubmitting] = useState(false);
  const [kycResubmit, setKycResubmit]     = useState(false);
  const idDocRef  = useRef(null);
  const selfieRef = useRef(null);

  const { user, logout, isAdmin } = useAuth();
  const { theme, toggleTheme }    = useTheme();
  const showToast = useToast();
  const navigate  = useNavigate();

  useEffect(() => {
    profileApi.get()
      .then(d => {
        setProfileData(d);
        setForm({
          name:           d.name           || user?.name  || '',
          email:          d.email          || user?.email || '',
          monthlyIncome:  d.monthlyIncome  || '',
          employmentType: d.employmentType || 'permanent',
          totalMonthlyDebt: d.totalMonthlyDebt || '',
        });
        setNotifPrefs({
          notifyRateChanges:        d.notifyRateChanges        ?? true,
          notifyApplicationUpdates: d.notifyApplicationUpdates ?? true,
          notifySwapOpportunities:  d.notifySwapOpportunities  ?? true,
          notifyMonthlyReport:      d.notifyMonthlyReport      ?? true,
        });
      })
      .catch(() => setForm({ name: user?.name || '', email: user?.email || '' }));
    kycApi.status().then(d => setKycStatus(d)).catch(() => {});
    docsApi.list().then(docs => setVaultCategories((docs || []).map(d => (d.category || '').toLowerCase()))).catch(() => {});
    alertsApi.getSavingsThreshold()
      .then(d => { if (d?.monthlyThreshold) { setSavingsThreshold(String(d.monthlyThreshold)); setThresholdSet(true); } })
      .catch(() => {});
  }, []);

  function setF(k) { return e => setForm(f => ({ ...f, [k]: e.target.value })); }

  function handleIdInput(e) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 13);
    setKycIdNumber(val);
    if (val.length === 13) {
      const result = validateSAID(val);
      if (result.valid) { setKycIdInfo(result); setKycIdError(''); }
      else              { setKycIdInfo(null);   setKycIdError(result.error); }
    } else {
      setKycIdInfo(null);
      setKycIdError('');
    }
  }

  async function submitKyc(e) {
    e.preventDefault();
    const validation = validateSAID(kycIdNumber);
    if (!validation.valid) { showToast(validation.error, 'error'); return; }
    const idFile = idDocRef.current?.files?.[0];
    if (!idFile) { showToast('Please upload a photo of your ID document', 'error'); return; }
    setKycSubmitting(true);
    try {
      const fd = new FormData();
      fd.append('idNumber', kycIdNumber);
      fd.append('id_document', idFile);
      const selfieFile = selfieRef.current?.files?.[0];
      if (selfieFile) fd.append('selfie', selfieFile);
      await kycApi.submit(fd);
      setKycStatus(s => ({ ...s, kycStatus: 'pending_review', hasIdDocument: true, hasSelfie: !!selfieFile }));
      setKycResubmit(false);
      showToast("Identity documents submitted — we'll review within 1 business day", 'success');
    } catch (err) {
      showToast(err.message || 'Could not submit — please try again', 'error');
    } finally {
      setKycSubmitting(false);
    }
  }

  async function saveProfile() {
    setLoading(true);
    try {
      await profileApi.update(form);
      showToast('Profile updated', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function saveFinancial() {
    setLoading(true);
    try {
      await profileApi.updateFinancial({
        monthlyIncome:    parseFloat(form.monthlyIncome)    || 0,
        employmentType:   form.employmentType               || 'permanent',
        totalMonthlyDebt: parseFloat(form.totalMonthlyDebt) || 0,
      });
      showToast('Financial profile updated', 'success');
    } catch (err) {
      showToast(err.message || 'Could not save', 'error');
    } finally {
      setLoading(false);
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== 'DELETE') { showToast('Type DELETE to confirm', 'error'); return; }
    try {
      await authApi.deleteAccount();
      logout();
      showToast('Account deleted.', 'info');
      navigate('/');
    } catch (err) {
      showToast(err.message || 'Could not delete account', 'error');
      setDeleteConfirm('');
    }
  }

  const displayName = profileData?.name || user?.name || '';
  const initial = (displayName || 'G')[0].toUpperCase();

  const kycBadge = !kycStatus || kycStatus.kycStatus === 'not_submitted'
    ? { label: 'Required',      color: '#f59e0b' }
    : kycStatus.kycStatus === 'pending_review'
    ? { label: 'Pending',       color: '#3b82f6' }
    : kycStatus.kycStatus === 'approved'
    ? { label: 'Verified',      color: '#22c55e' }
    : kycStatus.kycStatus === 'rejected'
    ? { label: 'Action needed', color: '#ef4444' }
    : null;

  return (
    <div className="page profile-page">
      <div className="container">
        <div className="profile-header">
          <div className="profile-avatar-lg">{initial}</div>
          <div>
            <h2 className="profile-name">{displayName || user?.email?.split('@')[0] || 'My Profile'}</h2>
            <div className="profile-email">{user?.email}</div>
          </div>
        </div>

        <div className="profile-layout">
          <nav className="profile-nav">
            {MENU_ITEMS.map(m => (
              <button
                key={m.id}
                className={`profile-nav__item ${section === m.id ? 'active' : ''}`}
                onClick={() => setSection(m.id)}
              >
                <span>{m.icon}</span>
                <span>{m.label}</span>
                {m.id === 'identity' && kycBadge ? (
                  <span style={{ marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: kycBadge.color + '22', color: kycBadge.color, border: `1px solid ${kycBadge.color}44` }}>
                    {kycBadge.label}
                  </span>
                ) : (
                  <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginLeft: 'auto', opacity: 0.4 }}><polyline points="9 18 15 12 9 6"/></svg>
                )}
              </button>
            ))}

            {isAdmin && (
              <Link to="/admin" className="profile-nav__item profile-nav__admin">
                <span>⚙️</span>
                <span>Admin Dashboard</span>
                <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ marginLeft: 'auto', opacity: 0.4 }}><polyline points="9 18 15 12 9 6"/></svg>
              </Link>
            )}

            <button className="profile-nav__item profile-nav__logout" onClick={() => { logout(); navigate('/'); }}>
              <span>🚪</span>
              <span>Sign out</span>
            </button>
          </nav>

          <div className="profile-content">
            {section === 'account' && (
              <Card>
                <CardHeader>Account Settings</CardHeader>
                <CardBody>
                  <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <Input label="Full name" id="pf-name" type="text" value={form.name || ''} onChange={setF('name')} />
                    <Input label="Email address" id="pf-email" type="email" value={form.email || ''} onChange={setF('email')} />
                    <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', justifyContent: 'space-between', padding: 'var(--space-3) 0', borderTop: '1px solid var(--border-color)' }}>
                      <span style={{ fontSize: '0.9375rem' }}>Dark mode</span>
                      <button className={`toggle ${theme === 'dark' ? 'active' : ''}`} onClick={toggleTheme}>
                        <span className="toggle__thumb" />
                      </button>
                    </div>
                    <Button variant="lime" onClick={saveProfile} loading={loading}>Save changes</Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {section === 'identity' && (
              <IdentitySection
                kycStatus={kycStatus}
                kycIdNumber={kycIdNumber}
                kycIdInfo={kycIdInfo}
                kycIdError={kycIdError}
                kycSubmitting={kycSubmitting}
                kycResubmit={kycResubmit}
                onIdInput={handleIdInput}
                onSubmit={submitKyc}
                onResubmit={() => setKycResubmit(true)}
                idDocRef={idDocRef}
                selfieRef={selfieRef}
                vaultCategories={vaultCategories}
              />
            )}

            {section === 'financial' && (
              <Card>
                <CardHeader>Financial Profile</CardHeader>
                <CardBody>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-5)' }}>
                    Your financial profile helps us calculate your risk score and find the best rate for you.
                  </p>
                  <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                    <Input label="Gross monthly income (R)" id="pf-inc" type="number" value={form.monthlyIncome || ''} onChange={setF('monthlyIncome')} placeholder="45 000" />
                    <Select label="Employment type" id="pf-emp" value={form.employmentType || 'permanent'} onChange={setF('employmentType')}>
                      <option value="permanent">Permanent</option>
                      <option value="contract">Contract</option>
                      <option value="self_employed">Self-employed</option>
                      <option value="part_time">Part-time</option>
                      <option value="unemployed">Unemployed</option>
                      <option value="retired">Retired</option>
                    </Select>
                    <Input label="Monthly debt obligations (R)" id="pf-dbt" type="number" value={form.totalMonthlyDebt || ''} onChange={setF('totalMonthlyDebt')} placeholder="0" />
                    <Button variant="lime" onClick={saveFinancial} loading={loading}>Save profile</Button>
                  </div>
                </CardBody>
              </Card>
            )}

            {section === 'security' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <Card>
                  <CardHeader>Change Password</CardHeader>
                  <CardBody>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
                      We'll send a password reset link to your email address.
                    </p>
                    <Button variant="ghost" onClick={async () => {
                      if (!user?.email) return;
                      try {
                        await authApi.forgotPw(user.email);
                        showToast('Password reset link sent to your email', 'success');
                      } catch {
                        showToast('Could not send reset link — please try again', 'error');
                      }
                    }}>Send password reset link</Button>
                  </CardBody>
                </Card>

                <Card style={{ borderColor: 'rgba(239,68,68,0.4)' }}>
                  <CardHeader style={{ color: 'var(--color-error)' }}>Danger Zone</CardHeader>
                  <CardBody>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
                      Deleting your account will permanently remove all your data in accordance with POPIA. This cannot be undone.
                    </p>
                    <Input label="Type DELETE to confirm" id="del-confirm" type="text" value={deleteConfirm} onChange={e => setDeleteConfirm(e.target.value)} placeholder="DELETE" />
                    <div style={{ marginTop: 'var(--space-3)' }}>
                      <Button variant="danger" onClick={deleteAccount} disabled={deleteConfirm !== 'DELETE'}>
                        Delete my account permanently
                      </Button>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {section === 'notifications' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
                <Card>
                  <CardHeader>Notification Preferences</CardHeader>
                  <CardBody>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-5)' }}>
                      Choose what updates you receive from Bondly.
                    </p>
                    {[
                      { key: 'notifyMonthlyReport',      label: 'Monthly bond report email',  desc: 'A monthly summary of your bond health and equity' },
                      { key: 'notifyRateChanges',        label: 'Rate change alerts',         desc: 'When the SARB moves the prime rate' },
                      { key: 'notifyApplicationUpdates', label: 'Application status updates', desc: 'When your bond application moves to a new stage' },
                      { key: 'notifySwapOpportunities',  label: 'Switch & Save opportunities',desc: 'When a better rate becomes available for your bond' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-4) 0', borderBottom: '1px solid var(--border-color)', gap: 'var(--space-4)' }}>
                        <div>
                          <div style={{ fontSize: '0.9375rem', fontWeight: 500 }}>{label}</div>
                          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>{desc}</div>
                        </div>
                        <button
                          role="switch"
                          aria-checked={notifPrefs[key]}
                          className={`toggle ${notifPrefs[key] ? 'active' : ''}`}
                          onClick={() => setNotifPrefs(p => ({ ...p, [key]: !p[key] }))}
                          aria-label={label}
                          style={{ flexShrink: 0 }}
                        >
                          <span className="toggle__thumb" aria-hidden="true" />
                        </button>
                      </div>
                    ))}
                    <div style={{ marginTop: 'var(--space-5)' }}>
                      <Button
                        variant="lime"
                        loading={notifSaving}
                        onClick={async () => {
                          setNotifSaving(true);
                          try {
                            await profileApi.updateNotifications(notifPrefs);
                            showToast('Preferences saved', 'success');
                          } catch (e) {
                            showToast(e.message || 'Could not save', 'error');
                          } finally {
                            setNotifSaving(false);
                          }
                        }}
                      >Save preferences</Button>
                    </div>
                  </CardBody>
                </Card>

                <Card>
                  <CardHeader>Savings Alert</CardHeader>
                  <CardBody>
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-5)' }}>
                      Get notified when a bank offers you a monthly saving above your chosen threshold.
                    </p>
                    <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
                      <Input
                        label="Alert me when I can save more than (R/month)"
                        id="pf-threshold"
                        type="number"
                        value={savingsThreshold}
                        onChange={e => setSavingsThreshold(e.target.value)}
                        placeholder="e.g. 500"
                      />
                      {thresholdSet && (
                        <div style={{ fontSize: '0.875rem', color: 'var(--mint)', fontWeight: 500 }}>
                          ✓ Alert active — notify when saving &gt; R{savingsThreshold}/month
                        </div>
                      )}
                      <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                        <Button variant="lime" onClick={async () => {
                          const amt = parseFloat(savingsThreshold);
                          if (!amt || amt <= 0) { showToast('Enter a valid amount', 'error'); return; }
                          try {
                            await alertsApi.setSavingsThreshold(amt);
                            setThresholdSet(true);
                            showToast('Savings alert set', 'success');
                          } catch (err) {
                            showToast(err.message || 'Could not save alert', 'error');
                          }
                        }}>Set alert</Button>
                        {thresholdSet && (
                          <Button variant="ghost" onClick={async () => {
                            try {
                              await alertsApi.deleteSavingsThreshold();
                              setSavingsThreshold('');
                              setThresholdSet(false);
                              showToast('Alert removed', 'info');
                            } catch (err) {
                              showToast(err.message || 'Could not remove', 'error');
                            }
                          }}>Remove alert</Button>
                        )}
                      </div>
                    </div>
                  </CardBody>
                </Card>
              </div>
            )}

            {section === 'whatsapp' && <WhatsAppSection showToast={showToast} />}
            {section === 'referrals' && <ReferralSection />}
          </div>
        </div>
      </div>
    </div>
  );
}

// ── WhatsApp Settings ─────────────────────────────────────
function WhatsAppSection({ showToast }) {
  const [phone, setPhone]         = useState('');
  const [reminders, setReminders] = useState(true);
  const [rateAlerts, setRateAl]   = useState(true);
  const [saving, setSaving]       = useState(false);
  const [inviteLink, setInvite]   = useState(null);

  async function save() {
    if (!phone.trim()) { showToast('Enter your WhatsApp number', 'error'); return; }
    setSaving(true);
    try {
      await whatsappApi.updateSettings({ whatsappNumber: phone.trim(), whatsappReminders: reminders, whatsappRateAlerts: rateAlerts });
      showToast('WhatsApp settings saved', 'success');
    } catch (e) {
      showToast(e.message || 'Could not save', 'error');
    } finally {
      setSaving(false);
    }
  }

  async function getInviteLink() {
    try {
      const data = await whatsappApi.invite();
      setInvite(data.url || data.inviteUrl || data.link);
    } catch(e) {
      showToast('Could not get WhatsApp link', 'error');
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      <Card>
        <CardHeader>WhatsApp Notifications</CardHeader>
        <CardBody>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-5)' }}>
            Receive bond updates, rate alerts, and payment reminders directly on WhatsApp — no app needed.
          </p>
          <div style={{ display: 'grid', gap: 'var(--space-4)' }}>
            <Input label="Your WhatsApp number" id="wa-phone" type="tel" value={phone} onChange={e => setPhone(e.target.value)} placeholder="+27 82 000 0000" />
            {[
              { id: 'reminders', label: 'Payment reminders', desc: '3 days before your bond debit runs', val: reminders, set: setReminders },
              { id: 'rate-alerts', label: 'Rate change alerts', desc: 'When the SARB moves the prime rate', val: rateAlerts, set: setRateAl },
            ].map(item => (
              <div key={item.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 'var(--space-3) 0', borderBottom: '1px solid var(--border-color)' }}>
                <div>
                  <div style={{ fontWeight: 500, fontSize: '0.9375rem' }}>{item.label}</div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: 2 }}>{item.desc}</div>
                </div>
                <button
                  role="switch"
                  aria-checked={item.val}
                  aria-label={item.label}
                  onClick={() => item.set(v => !v)}
                  style={{ background: item.val ? 'var(--mint)' : 'var(--border-color)', border: 'none', borderRadius: 999, width: 44, height: 24, cursor: 'pointer', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}
                >
                  <span aria-hidden="true" style={{ position: 'absolute', top: 3, left: item.val ? 23 : 3, width: 18, height: 18, background: '#fff', borderRadius: '50%', transition: 'left 0.2s' }} />
                </button>
              </div>
            ))}
            <Button variant="lime" onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save WhatsApp settings'}</Button>
          </div>
        </CardBody>
      </Card>

      <Card>
        <CardHeader>Start via WhatsApp</CardHeader>
        <CardBody>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
            Prefer to start your bond application on WhatsApp? Chat with our Bondly bot — it'll guide you through the pre-approval process in under 3 minutes.
          </p>
          {inviteLink ? (
            <a href={inviteLink} target="_blank" rel="noopener noreferrer">
              <Button variant="lime">Open WhatsApp chat →</Button>
            </a>
          ) : (
            <Button variant="ghost" onClick={getInviteLink}>Get WhatsApp chat link</Button>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ── Referral section ──────────────────────────────────────
function ReferralSection() {
  const [data, setData]         = useState(null);
  const [loadErr, setLoadErr]   = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [sending, setSending]   = useState(false);
  const [copied, setCopied]     = useState(false);
  const showToast = useToast();

  useEffect(() => {
    referralsApi.get().then(setData).catch(() => setLoadErr(true));
  }, []);

  async function copyLink() {
    if (!data?.referralLink) return;
    try {
      await navigator.clipboard.writeText(data.referralLink);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      showToast('Copy failed — try selecting the link manually', 'error');
    }
  }

  async function sendInvite() {
    const email = inviteEmail.trim();
    if (!email) return;
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      showToast('Please enter a valid email address', 'error');
      return;
    }
    setSending(true);
    try {
      await referralsApi.invite(email);
      showToast(`Invite sent to ${email}`, 'success');
      setInviteEmail('');
    } catch (err) {
      showToast(err.message || 'Could not send invite', 'error');
    } finally {
      setSending(false);
    }
  }

  const STATUS_LABEL = { signed_up: 'Signed up', completed: 'Switched banks' };
  const STATUS_COLOR = { signed_up: 'var(--lime)', completed: 'var(--mint)' };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
      {/* Stats */}
      {data && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 'var(--space-4)' }}>
          {[
            { label: 'Referred', value: data.stats.total },
            { label: 'Signed up', value: data.stats.signedUp },
            { label: 'Switched banks', value: data.stats.completed },
          ].map(s => (
            <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius)', padding: 'var(--space-4)', textAlign: 'center' }}>
              <div style={{ fontSize: '1.75rem', fontWeight: 800 }}>{s.value}</div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      {/* Referral link */}
      <Card>
        <CardHeader>Your referral link</CardHeader>
        <CardBody>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
            Share this link with friends. When they sign up and switch banks, Bondly rewards you both.
          </p>
          {data?.referralLink ? (
            <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 200, padding: '10px 14px', background: 'var(--bg-page)', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem', fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {data.referralLink}
              </div>
              <Button variant={copied ? 'forest' : 'lime'} size="sm" onClick={copyLink}>
                {copied ? '✓ Copied!' : 'Copy link'}
              </Button>
            </div>
          ) : loadErr ? (
            <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>Could not load your referral link — please refresh to try again.</p>
          ) : (
            <div className="spinner" style={{ width: 20, height: 20 }} />
          )}
          {data?.referralCode && (
            <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 'var(--space-3)', marginBottom: 0 }}>
              Your code: <strong style={{ letterSpacing: '0.1em' }}>{data.referralCode}</strong>
            </p>
          )}
        </CardBody>
      </Card>

      {/* Email invite */}
      <Card>
        <CardHeader>Invite by email</CardHeader>
        <CardBody>
          <div style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-end' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Friend's email address</label>
              <input
                type="email"
                placeholder="friend@example.com"
                value={inviteEmail}
                onChange={e => setInviteEmail(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && sendInvite()}
                style={{ width: '100%', padding: '9px 14px', borderRadius: 'var(--border-radius-sm)', border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', fontFamily: 'var(--font-sans)' }}
              />
            </div>
            <Button variant="lime" loading={sending} onClick={sendInvite} disabled={!inviteEmail.trim()}>
              Send invite
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Referral history */}
      {data?.referrals?.length > 0 && (
        <Card>
          <CardHeader>People you've referred</CardHeader>
          <CardBody style={{ padding: 0 }}>
            {data.referrals.map((r, i) => (
              <div key={r.id} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', padding: 'var(--space-3) var(--space-5)', borderTop: i > 0 ? '1px solid var(--border-color)' : 'none' }}>
                <div style={{ width: 32, height: 32, borderRadius: '50%', background: 'var(--bg-page)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 700, fontSize: '0.875rem', border: '1px solid var(--border-color)', flexShrink: 0 }}>
                  {(r.name || '?')[0].toUpperCase()}
                </div>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{r.name}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Joined {new Date(r.joinedAt).toLocaleDateString('en-ZA', { month: 'short', year: 'numeric' })}</div>
                </div>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: STATUS_COLOR[r.status], background: `${STATUS_COLOR[r.status]}18`, padding: '3px 10px', borderRadius: 20 }}>
                  {STATUS_LABEL[r.status] || r.status}
                </span>
              </div>
            ))}
          </CardBody>
        </Card>
      )}
    </div>
  );
}
