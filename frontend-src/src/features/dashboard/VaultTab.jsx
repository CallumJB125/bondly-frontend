import { useState, useEffect, useRef } from 'react';
import { CreditCard, Briefcase, Building2, FileText, Home, BarChart2, Paperclip, File, Image, TrendingUp } from 'lucide-react';
import { documents as docsApi, financialFitness } from '../../lib/api.js';
import { useToast } from '../../components/Toast.jsx';
import { fmtDate, fmt } from '../../lib/format.js';
import Button from '../../components/Button.jsx';
import Card, { CardHeader, CardBody } from '../../components/Card.jsx';
import { ScoreHistoryChart, GRADE_COLORS_EXPORT as GRADE_COLORS, GRADE_LABELS_EXPORT as GRADE_LABELS } from './FinancesTab.jsx';

const CATEGORIES = [
  { key: 'id',             label: 'SA ID / Passport',       icon: <CreditCard size={18}/>,  accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'payslip',        label: 'Payslips',                icon: <Briefcase size={18}/>,   accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'bank_statement', label: 'Bank Statements',         hint: 'Transactional account — e.g. cheque/savings account from ABSA, FNB, Nedbank etc. (last 3 months)', icon: <Building2 size={18}/>,   accept: '.pdf,.csv,.jpg,.jpeg,.png' },
  { key: 'bond_statement', label: 'Bond Statements',         hint: 'Home loan statement from your current bond provider — shows outstanding balance and repayment history', icon: <FileText size={18}/>,    accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'residence',      label: 'Proof of Address (optional)', hint: 'Your bank statement already covers proof of address. Only upload here if a specific bank requests a separate utility bill.', icon: <Home size={18}/>, accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'tax',            label: 'Tax / SARS Documents',    icon: <BarChart2 size={18}/>,   accept: '.pdf,.jpg,.jpeg,.png' },
  { key: 'other',          label: 'Other Documents',         icon: <Paperclip size={18}/>,   accept: '.pdf,.jpg,.jpeg,.png,.doc,.docx' },
];

function formatBytes(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
}

function gradeFromScore(score) {
  if (score >= 80) return 'A';
  if (score >= 65) return 'B';
  if (score >= 50) return 'C';
  if (score >= 35) return 'D';
  return 'E';
}

export default function VaultTab() {
  const [docs, setDocs]         = useState([]);
  const [loading, setLoading]   = useState(true);
  const [uploading, setUploading] = useState({});
  const [removing, setRemoving] = useState({});
  const [pendingRemoveId, setPendingRemoveId] = useState(null);
  const [latestOnly, setLatestOnly] = useState(true);
  const [snapshots, setSnapshots]   = useState([]);
  const [expandedSnap, setExpandedSnap] = useState(null);
  const fileRefs = useRef({});
  const showToast = useToast();

  async function load() {
    try {
      const d = await docsApi.list();
      setDocs(d || []);
    } catch {
      showToast('Could not load documents', 'error');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { load(); }, []);
  useEffect(() => {
    financialFitness.getSnapshots()
      .then(d => setSnapshots(d?.snapshots || []))
      .catch(() => {});
  }, []);

  async function handleUpload(category, file) {
    setUploading(u => ({ ...u, [category]: true }));
    try {
      await docsApi.upload(file, category, file.name);
      showToast('Document uploaded', 'success');
    } catch (err) {
      showToast(err.message || 'Upload failed', 'error');
      setUploading(u => ({ ...u, [category]: false }));
      return;
    }
    // Refresh list separately so an upload success is never masked by a reload error
    try {
      const d = await docsApi.list();
      setDocs(d || []);
    } catch {
      showToast('Uploaded, but could not refresh the list — please reload', 'warning');
    } finally {
      setUploading(u => ({ ...u, [category]: false }));
    }
  }

  async function remove(id) {
    if (pendingRemoveId !== id) { setPendingRemoveId(id); return; }
    setPendingRemoveId(null);
    setRemoving(r => ({ ...r, [id]: true }));
    try {
      await docsApi.remove(id);
      showToast('Document removed', 'success');
      setDocs(d => d.filter(doc => doc.id !== id));
    } catch (err) {
      showToast(err.message || 'Could not remove', 'error');
    } finally {
      setRemoving(r => ({ ...r, [id]: false }));
    }
  }

  const docsByCategory = {};
  for (const cat of CATEGORIES) {
    const catDocs = docs
      .filter(d => d.category === cat.key)
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    docsByCategory[cat.key] = latestOnly ? catDocs.slice(0, 1) : catDocs;
  }
  const totalDocs = docs.length;
  const totalSize = docs.reduce((s, d) => s + (d.size || 0), 0);

  if (loading) {
    return <div style={{ padding: 'var(--space-8)', textAlign: 'center' }}><div className="spinner" style={{ width: 28, height: 28, margin: '0 auto' }} /></div>;
  }

  return (
    <div className="fade-in">

      {/* Statement History */}
      {snapshots.length > 0 && (
        <div style={{ marginBottom: 'var(--space-8)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 'var(--space-4)', gap: 'var(--space-3)' }}>
            <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.125rem', margin: 0 }}>Statement History</h3>
            <button
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', color: 'var(--color-primary)', fontWeight: 500, padding: 0 }}
              onClick={() => window.dispatchEvent(new CustomEvent('bondly:navigate', { detail: { tab: 'bond', bondSubTab: 'scan' } }))}
            >
              + Upload new
            </button>
          </div>

          {snapshots.length > 1 && (
            <div style={{ marginBottom: 'var(--space-5)' }}>
              <ScoreHistoryChart history={snapshots.map(s => ({ overallScore: s.readiness?.score ?? (typeof s.readiness === 'number' ? s.readiness : 0) }))} />
            </div>
          )}

          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
            {snapshots.map((s, i) => {
              const score = s.readiness?.score ?? (typeof s.readiness === 'number' ? s.readiness : 0);
              const grade = gradeFromScore(score);
              const isExp = expandedSnap === i;
              return (
                <div
                  key={i}
                  style={{
                    background: 'var(--color-surface-1)',
                    border: '1px solid var(--color-border)',
                    borderRadius: 'var(--radius-lg)',
                    padding: 'var(--space-3) var(--space-4)',
                    cursor: 'pointer',
                  }}
                  onClick={() => setExpandedSnap(isExp ? null : i)}
                >
                  <div style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto auto', alignItems: 'center', gap: 'var(--space-4)' }}>
                    <div>
                      <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{fmtDate(s.uploadedAt)}</div>
                      {s.statementMonths && <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)' }}>{s.statementMonths} months</div>}
                    </div>
                    <div style={{ overflow: 'hidden' }}>
                      {s.qualification?.maxBond > 0 && (
                        <div style={{ fontSize: '0.875rem', fontWeight: 700 }}>{fmt(s.qualification.maxBond)}</div>
                      )}
                      {s.optimizations?.[0] && (
                        <div style={{ fontSize: '0.75rem', color: 'var(--color-text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.optimizations[0]}</div>
                      )}
                    </div>
                    <div style={{
                      width: 28, height: 28, borderRadius: '50%',
                      border: `2px solid ${GRADE_COLORS[grade]}`,
                      color: GRADE_COLORS[grade],
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: '0.8125rem', fontWeight: 800, flexShrink: 0,
                    }}>{grade}</div>
                    <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"
                      style={{ transform: isExp ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s', color: 'var(--color-text-muted)' }}>
                      <polyline points="6 9 12 15 18 9"/>
                    </svg>
                  </div>
                  {isExp && s.optimizations?.length > 0 && (
                    <div style={{ marginTop: 'var(--space-3)', paddingTop: 'var(--space-3)', borderTop: '1px solid var(--color-border)' }}>
                      <div style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--color-text-muted)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.05em' }}>Optimisations</div>
                      {s.optimizations.map((opt, j) => (
                        <div key={j} style={{ fontSize: '0.8125rem', color: 'var(--color-text)', padding: '4px 0', display: 'flex', gap: 8 }}>
                          <span style={{ color: 'var(--color-primary)', flexShrink: 0 }}>→</span>
                          <span>{opt}</span>
                        </div>
                      ))}
                      {s.qualification?.zone && (
                        <span style={{
                          display: 'inline-block', marginTop: 8, padding: '2px 8px', borderRadius: 12,
                          fontSize: '0.75rem', fontWeight: 600,
                          background: s.qualification.zone === 'green' ? '#dcfce7' : s.qualification.zone === 'amber' ? '#fef9c3' : '#fee2e2',
                          color: s.qualification.zone === 'green' ? '#166534' : s.qualification.zone === 'amber' ? '#854d0e' : '#991b1b',
                        }}>
                          {s.qualification.zone.charAt(0).toUpperCase() + s.qualification.zone.slice(1)} zone
                        </span>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Documents heading */}
      <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.125rem', marginBottom: 'var(--space-5)', marginTop: 0 }}>Documents</h3>

      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-5)', gap: 'var(--space-4)', flexWrap: 'wrap' }}>
        <div>
          <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', marginBottom: 4 }}>Document Vault</h3>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0 }}>
            {totalDocs} document{totalDocs !== 1 ? 's' : ''} · {formatBytes(totalSize)} · Encrypted and only shared when you apply to a bank
          </p>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)', cursor: 'pointer', userSelect: 'none' }}>
          <input
            type="checkbox"
            checked={latestOnly}
            onChange={e => setLatestOnly(e.target.checked)}
            style={{ accentColor: 'var(--lime)', width: 16, height: 16 }}
          />
          Latest file only
        </label>
      </div>

      {/* Readiness summary */}
      <VaultReadiness docs={docs} />

      {/* Category sections */}
      <div style={{ display: 'grid', gap: 'var(--space-5)' }}>
        {CATEGORIES.map(cat => {
          const catDocs = docsByCategory[cat.key] || [];
          return (
            <Card key={cat.key}>
              <CardHeader>
                <span>{cat.icon} {cat.label}</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                  <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
                    {catDocs.length} file{catDocs.length !== 1 ? 's' : ''}
                  </span>
                  <input
                    type="file"
                    accept={cat.accept}
                    style={{ display: 'none' }}
                    ref={el => fileRefs.current[cat.key] = el}
                    onChange={e => { if (e.target.files[0]) { handleUpload(cat.key, e.target.files[0]); e.target.value = ''; } }}
                  />
                  <Button
                    variant="lime"
                    size="sm"
                    loading={uploading[cat.key]}
                    onClick={() => fileRefs.current[cat.key]?.click()}
                  >
                    + Upload
                  </Button>
                </div>
              </CardHeader>
              {catDocs.length > 0 && (
                <CardBody style={{ padding: 0 }}>
                  {catDocs.map((doc, i) => (
                    <div key={doc.id}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 'var(--space-3)',
                          padding: 'var(--space-3) var(--space-5)',
                          borderTop: i > 0 ? '1px solid var(--border-color)' : 'none',
                        }}
                      >
                        <FileIcon mimeType={doc.mimeType} />
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontWeight: 600, fontSize: '0.875rem', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {doc.label || doc.originalName}
                          </div>
                          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                            {formatBytes(doc.size)} · {fmtDate(doc.createdAt)}
                            {doc.analysis && <span style={{ color: 'var(--color-success)', marginLeft: 6 }}>· Analysed</span>}
                          </div>
                        </div>
                        <a
                          href={doc.path}
                          target="_blank"
                          rel="noreferrer"
                          style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', textDecoration: 'none', padding: '4px 8px', border: '1px solid var(--border-color)', borderRadius: 'var(--border-radius-sm)' }}
                        >
                          View
                        </a>
                        {pendingRemoveId === doc.id ? (
                          <>
                            <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Sure?</span>
                            <button onClick={() => remove(doc.id)} style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: 'pointer', fontSize: '0.8125rem', padding: '4px 6px', fontWeight: 600 }}>Yes</button>
                            <button onClick={() => setPendingRemoveId(null)} style={{ background: 'none', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '0.8125rem', padding: '4px 6px' }}>Cancel</button>
                          </>
                        ) : (
                          <button
                            onClick={() => remove(doc.id)}
                            disabled={removing[doc.id]}
                            style={{ background: 'none', border: 'none', color: 'var(--color-error)', cursor: removing[doc.id] ? 'default' : 'pointer', fontSize: '0.8125rem', padding: '4px 6px', opacity: removing[doc.id] ? 0.5 : 1 }}
                          >
                            Remove
                          </button>
                        )}
                      </div>
                      {doc.analysis && <StatementAnalysis analysis={doc.analysis} />}
                    </div>
                  ))}
                </CardBody>
              )}
              {catDocs.length === 0 && (
                <CardBody>
                  <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', margin: 0, fontStyle: 'italic' }}>
                    No {cat.label.toLowerCase()} uploaded yet
                  </p>
                  {cat.hint && (
                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', margin: '6px 0 0', lineHeight: 1.5 }}>
                      {cat.hint}
                    </p>
                  )}
                </CardBody>
              )}
            </Card>
          );
        })}
      </div>

      <p style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 'var(--space-6)', lineHeight: 1.6 }}>
        Documents are stored securely and only shared with banks you apply to. You can remove them at any time.
        Supported formats: PDF, JPG, PNG, CSV.
      </p>
    </div>
  );
}

// ── Readiness summary banner ──────────────────────────────
const REQUIRED_CATS = ['id', 'payslip', 'bank_statement'];

function VaultReadiness({ docs }) {
  const catsDone = REQUIRED_CATS.filter(k => docs.some(d => d.category === k));
  const missing  = REQUIRED_CATS.filter(k => !docs.some(d => d.category === k));
  const pct      = Math.round((catsDone.length / REQUIRED_CATS.length) * 100);
  const isReady  = missing.length === 0;

  return (
    <div
      style={{
        background: isReady ? 'rgba(108,187,167,0.1)' : 'var(--bg-card)',
        border: `1px solid ${isReady ? 'var(--mint)' : 'var(--border-color)'}`,
        borderRadius: 'var(--border-radius)',
        padding: 'var(--space-4) var(--space-5)',
        marginBottom: 'var(--space-5)',
        display: 'flex',
        alignItems: 'center',
        gap: 'var(--space-4)',
        flexWrap: 'wrap',
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div>
          <div style={{ fontWeight: 700, marginBottom: 2 }}>
            {isReady ? '✓ Bond application ready' : `${catsDone.length} of ${REQUIRED_CATS.length} key documents uploaded`}
          </div>
          {!isReady && (
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
              Banks need these when you apply for a home loan — upload them at your own pace, no rush.
            </div>
          )}
        </div>
        <div style={{ height: 6, background: 'var(--border-color)', borderRadius: 3, overflow: 'hidden' }}>
          <div style={{ height: '100%', width: `${pct}%`, background: isReady ? 'var(--mint)' : 'var(--lime)', borderRadius: 3, transition: 'width 0.4s ease' }} />
        </div>
        {!isReady && (
          <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 6 }}>
            Still needed: {missing.map(k => CATEGORIES.find(c => c.key === k)?.label).join(', ')}
          </div>
        )}
      </div>
      {isReady && (
        <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
          Banks can process your application without delays
        </div>
      )}
    </div>
  );
}

// ── Statement analysis panel ──────────────────────────────
function StatementAnalysis({ analysis }) {
  if (!analysis) return null;
  const { income, debts, qualification, affordabilityZone, statementMonths } = analysis;
  const zone = affordabilityZone?.zone;
  const zoneColor = zone === 'green' ? 'var(--color-success)' : zone === 'yellow' ? '#d97706' : 'var(--color-error)';

  return (
    <div style={{
      margin: 'var(--space-3) var(--space-5) var(--space-3)',
      padding: 'var(--space-3) var(--space-4)',
      background: 'var(--bg-base)',
      border: '1px solid var(--border-color)',
      borderRadius: 'var(--border-radius-sm)',
      fontSize: '0.8125rem',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontWeight: 700, marginBottom: 'var(--space-2)', color: 'var(--text-primary)' }}>
        <TrendingUp size={14} />
        Statement analysis · {statementMonths} month{statementMonths !== 1 ? 's' : ''} of data
        {zone && <span style={{ marginLeft: 'auto', color: zoneColor, fontWeight: 700 }}>{affordabilityZone.label}</span>}
      </div>
      <div style={{ display: 'flex', gap: 'var(--space-5)', flexWrap: 'wrap', color: 'var(--text-secondary)' }}>
        {income?.detected && (
          <span>Income: <strong style={{ color: 'var(--text-primary)' }}>{fmt(income.monthlyAmount)}/mo</strong>
            {income.confidence && <span style={{ fontSize: '0.75rem' }}> · {income.confidence} confidence</span>}
          </span>
        )}
        {debts?.totalMonthly > 0 && (
          <span>Existing debt: <strong style={{ color: 'var(--text-primary)' }}>{fmt(debts.totalMonthly)}/mo</strong></span>
        )}
        {qualification?.maxBond > 0 && qualification.maxBond <= 10_000_000 && (
          <span>Max bond: <strong style={{ color: 'var(--text-primary)' }}>{fmt(qualification.maxBond)}</strong></span>
        )}
        {qualification?.maxBond > 10_000_000 && (
          <span style={{ color: '#d97706' }}>⚠ Estimate outdated — re-upload statement for updated figures</span>
        )}
      </div>
    </div>
  );
}

// ── File type icon ────────────────────────────────────────
function FileIcon({ mimeType }) {
  const icon = mimeType?.includes('pdf')   ? <File size={20}/>
    : mimeType?.includes('image')          ? <Image size={20}/>
    : mimeType?.includes('csv')            ? <BarChart2 size={20}/>
    : <Paperclip size={20}/>;
  return <span style={{ flexShrink: 0, color: 'var(--text-secondary)' }}>{icon}</span>;
}
