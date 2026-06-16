import { useEffect, useState } from 'react';

/**
 * ApplicationDocumentsUpload — collects the FICA pack inline on the apply
 * success screen, instead of punting users off to the Documents tab.
 *
 * Banks need: SA ID, latest payslip, proof of residence, bank statements,
 * IRP5 (speeds up offer), and the signed Offer to Purchase once the customer
 * has a property in mind. Each row gives a one-tap file picker and shows
 * ✓ once we have it on file. Status persists across reloads via the
 * existing /api/me/documents endpoint.
 *
 * The component is intentionally light — no styling library, inline styles
 * only — so it can sit on the apply success card without dragging in extra
 * CSS modules.
 */
const REQUIRED_DOCS = [
  { key: 'id',                category: 'id',             label: 'SA ID (both sides)',          why: 'Required by FICA — uploaded once and re-used for future applications', required: true },
  { key: 'payslip',           category: 'payslip',        label: 'Latest payslip',              why: 'Verifies salary net of deductions',                                    required: true },
  { key: 'residence',         category: 'residence',      label: 'Proof of residence',          why: 'Municipal bill / lease / bank letter dated within the last 3 months', required: true },
  { key: 'bank_statement',    category: 'bank_statement', label: 'Last 3 months\' bank statements', why: 'We can also pull these straight from your bank statement upload.', required: true, multi: true },
  { key: 'tax',               category: 'tax',            label: 'IRP5 / latest tax certificate', why: 'Optional, but offers come faster when included',                     required: false },
  { key: 'offer_to_purchase', category: 'other',          label: 'Signed Offer to Purchase',    why: 'Only when you\'ve found a property to buy',                            required: false, labelHint: 'Offer to Purchase' },
];

export default function ApplicationDocumentsUpload({ token, showToast, onProgress }) {
  const [docs,       setDocs]       = useState([]);
  const [uploading,  setUploading]  = useState({});

  function refresh() {
    fetch('/api/documents', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => r.json())
      .then(d => setDocs(Array.isArray(d?.data?.documents) ? d.data.documents : Array.isArray(d?.data) ? d.data : []))
      .catch(() => {});
  }
  useEffect(refresh, [token]);

  function statusFor(spec) {
    if (spec.multi) {
      const hits = docs.filter(d => d.category === spec.category);
      return { present: hits.length > 0, count: hits.length, latest: hits[0] };
    }
    // For Offer to Purchase we match by category 'other' + label hint, since
    // the upload endpoint doesn't have a dedicated category for it yet.
    if (spec.labelHint) {
      const hit = docs.find(d => d.category === spec.category && (d.label || '').toLowerCase().includes(spec.labelHint.toLowerCase()));
      return { present: !!hit, latest: hit };
    }
    const hit = docs.find(d => d.category === spec.category);
    return { present: !!hit, latest: hit };
  }

  async function upload(spec, file) {
    if (!file) return;
    setUploading(prev => ({ ...prev, [spec.key]: true }));
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('category', spec.category);
      if (spec.labelHint) fd.append('label', spec.labelHint);
      const r = await fetch('/api/documents', {
        method: 'POST',
        headers: { Authorization: 'Bearer ' + token }, // don't set Content-Type — FormData does it
        body: fd,
      }).then(r => r.json());
      if (!r?.success) throw new Error(r?.error || 'Upload failed');
      showToast?.(`${spec.label} uploaded`, 'success');
      refresh();
      onProgress?.();
    } catch (e) {
      showToast?.(e.message || 'Could not upload', 'error');
    } finally {
      setUploading(prev => ({ ...prev, [spec.key]: false }));
    }
  }

  const done    = REQUIRED_DOCS.filter(d =>  d.required && statusFor(d).present).length;
  const total   = REQUIRED_DOCS.filter(d =>  d.required).length;
  const percent = total ? Math.round((done / total) * 100) : 0;

  return (
    <div style={{
      padding: 'var(--space-4)',
      background: 'var(--bg-page)',
      borderRadius: 8,
      border: '1px solid var(--border-color)',
    }}>
      <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', marginBottom: 14, gap: 8, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 2 }}>
            Documents for the bank
          </div>
          <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            Your broker can't submit until the required items are on file.
          </div>
        </div>
        <div style={{ fontSize: '0.8125rem', fontWeight: 700, color: percent === 100 ? '#16a34a' : 'var(--text-primary)' }}>
          {done} / {total} required {percent === 100 ? '· ready to submit ✓' : ''}
        </div>
      </div>

      {/* Progress bar */}
      <div style={{ height: 6, background: 'rgba(0,0,0,0.06)', borderRadius: 999, overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ width: percent + '%', height: '100%', background: percent === 100 ? '#16a34a' : 'var(--forest)', transition: 'width 0.4s ease' }} />
      </div>

      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {REQUIRED_DOCS.map(spec => {
          const { present, count, latest } = statusFor(spec);
          const busy = !!uploading[spec.key];
          return (
            <li key={spec.key} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: 12,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-color)',
              borderRadius: 8,
              flexWrap: 'wrap',
            }}>
              <div style={{
                width: 30, height: 30, borderRadius: '50%',
                background: present ? '#16a34a' : (spec.required ? 'rgba(220,38,38,0.10)' : 'rgba(0,0,0,0.05)'),
                color: present ? '#fff' : (spec.required ? '#991b1b' : 'var(--text-secondary)'),
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.875rem', fontWeight: 700, flexShrink: 0,
              }}>
                {present ? '✓' : (spec.required ? '!' : '○')}
              </div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>{spec.label}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 1 }}>
                  {present
                    ? (spec.multi ? `${count} file${count === 1 ? '' : 's'} on file` : (latest?.originalName || latest?.label || 'On file'))
                    : spec.why}
                </div>
              </div>
              <label style={{
                padding: '7px 14px',
                background: present ? 'transparent' : (spec.required ? 'var(--forest)' : 'var(--bg-page)'),
                color: present ? 'var(--text-secondary)' : (spec.required ? '#fff' : 'var(--text-primary)'),
                border: present ? '1px solid var(--border-color)' : 'none',
                borderRadius: 6, fontSize: '0.8125rem', fontWeight: 700,
                cursor: busy ? 'wait' : 'pointer', whiteSpace: 'nowrap',
                opacity: busy ? 0.65 : 1,
              }}>
                {busy ? 'Uploading…' : (present ? (spec.multi ? 'Add another' : 'Replace') : 'Upload')}
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  disabled={busy}
                  onChange={e => upload(spec, e.target.files?.[0])}
                  style={{ display: 'none' }}
                />
              </label>
            </li>
          );
        })}
      </ul>

      <p style={{ margin: '14px 0 0', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        Files are encrypted at rest and only shared with the bank you eventually choose. Re-uploads replace the previous version.
      </p>
    </div>
  );
}
