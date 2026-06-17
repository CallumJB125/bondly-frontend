// KYCTab — identity-verification queue with approve/decline + document viewer.
// Standardized (Phase C cont.): self-fetches via useAdminKycQueue (shared cache with the
// nav badge + dashboard priority card); approve/decline mutate the cache directly.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { admin } from '../../../lib/api.js';
import { useAdminKycQueue } from '../hooks/useAdminQueries.js';
import { fmtDate } from '@bondly/ui/lib/format.js';
import Button from '@bondly/ui/components/Button.jsx';
import Card, { CardBody } from '@bondly/ui/components/Card.jsx';

const KYC_KEY = ['admin', 'kyc'];

function KycDocViewer({ userId, type, hasDoc, label }) {
  const [state, setState] = useState('idle'); // idle | loading | loaded | error
  const [blobUrl, setBlobUrl] = useState(null);
  const [isPdf, setIsPdf] = useState(false);

  async function load() {
    setState('loading');
    try {
      const token = localStorage.getItem('bondly_token');
      const r = await fetch(`/api/admin/kyc/${userId}/document/${type}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!r.ok) throw new Error('Not found');
      const blob = await r.blob();
      setIsPdf(blob.type === 'application/pdf');
      setBlobUrl(URL.createObjectURL(blob));
      setState('loaded');
    } catch {
      setState('error');
    }
  }

  if (!hasDoc) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#ef444410', borderRadius: 8, border: '1px solid #ef444430' }}>
        <span style={{ color: '#ef4444', fontSize: '1rem' }}>✗</span>
        <span style={{ color: '#ef4444', fontSize: '0.8125rem', fontWeight: 600 }}>{label} not submitted</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#16a34a' }}>✓ {label} uploaded</div>
      {state === 'idle' && (
        <button onClick={load} style={{ alignSelf: 'flex-start', fontSize: '0.75rem', padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-primary)' }}>
          View document
        </button>
      )}
      {state === 'loading' && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Loading…</span>}
      {state === 'error' && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Could not load file — it may have been deleted from disk</span>}
      {state === 'loaded' && blobUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isPdf ? (
            <a href={blobUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--lime)' }}>
              Open PDF ↗
            </a>
          ) : (
            <img
              src={blobUrl}
              alt={label}
              onClick={() => window.open(blobUrl)}
              style={{ maxWidth: 260, maxHeight: 180, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1.5px solid var(--border-color)' }}
              title="Click to open full size"
            />
          )}
          <a href={blobUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Open full size ↗
          </a>
        </div>
      )}
    </div>
  );
}

export default function KYCTab({ showToast, onJumpCustomer }) {
  const qc = useQueryClient();
  const { data: kycQueue = [] } = useAdminKycQueue();
  const [kycReason, setKycReason] = useState({});

  const sorted = [...kycQueue].sort((a, b) => new Date(a.kycSubmittedAt || 0) - new Date(b.kycSubmittedAt || 0));
  const removeFromQueue = (id) => qc.setQueryData(KYC_KEY, q => (q || []).filter(x => x.id !== id));

  return (
    <div className="fade-in">
      <h2 style={{ fontFamily: 'var(--font-serif)', marginBottom: 'var(--space-5)' }}>Identity Verification Queue ({kycQueue.length}) — oldest first</h2>
      {sorted.length === 0 ? (
        <Card><CardBody><p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-8)' }}>No pending KYC submissions</p></CardBody></Card>
      ) : sorted.map(u => {
        const waitDays = u.kycSubmittedAt ? Math.floor((Date.now() - new Date(u.kycSubmittedAt)) / 86400000) : null;
        const badgeBg    = waitDays == null ? '#6b728020' : waitDays >= 2 ? '#ef444420' : '#16a34a20';
        const badgeColor = waitDays == null ? 'var(--text-secondary)' : waitDays >= 2 ? '#ef4444' : '#16a34a';
        const badgeLabel = waitDays == null ? '—' : waitDays === 0 ? 'Today' : waitDays === 1 ? '1 day' : `${waitDays} days`;
        return (
        <Card key={u.id} style={{ marginBottom: 'var(--space-4)' }}>
          <CardBody>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
              <button
                onClick={() => onJumpCustomer?.(u.id)}
                style={{ fontWeight: 700, fontSize: '1rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lime)', textDecoration: 'underline' }}
              >
                {u.name}
              </button>
              <span style={{ background: badgeBg, color: badgeColor, borderRadius: 6, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                {badgeLabel} waiting
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-3)' }}>{u.email}</div>

            {/* ID info */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
              <span>Submitted: <strong>{u.kycSubmittedAt ? fmtDate(u.kycSubmittedAt) : '—'}</strong></span>
              <span>ID: <strong>{u.idNumber ? u.idNumber.slice(0,6) + '••••••' + u.idNumber.slice(12) : '—'}</strong></span>
              {u.kycIdInfo?.dob && <span>DOB: <strong>{u.kycIdInfo.dob}</strong></span>}
              {u.kycIdInfo?.age && <span>Age: <strong>{u.kycIdInfo.age}</strong></span>}
            </div>

            {/* Documents + actions side by side */}
            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Documents */}
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', flex: 1 }}>
                <KycDocViewer userId={u.id} type="id_document" hasDoc={!!u.kycDocuments?.idDocument} label="SA ID document" />
                <KycDocViewer userId={u.id} type="selfie" hasDoc={!!u.kycDocuments?.selfie} label="Selfie" />
              </div>

              {/* Approve / decline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 220 }}>
                <input type="text" placeholder="Rejection reason (if declining)" value={kycReason[u.id] || ''}
                  onChange={e => setKycReason(r => ({ ...r, [u.id]: e.target.value }))}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.875rem', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button variant="lime" size="sm" full onClick={async () => {
                    try { await admin.kycReview(u.id, 'approve'); removeFromQueue(u.id); showToast(`${u.name} verified ✓`, 'success'); }
                    catch (err) { showToast(err.message || 'Failed', 'error'); }
                  }}>Approve</Button>
                  <Button variant="danger" size="sm" full onClick={async () => {
                    try { await admin.kycReview(u.id, 'reject', kycReason[u.id]); removeFromQueue(u.id); showToast(`${u.name} declined`, 'info'); }
                    catch (err) { showToast(err.message || 'Failed', 'error'); }
                  }}>Decline</Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
        );
      })}
    </div>
  );
}
