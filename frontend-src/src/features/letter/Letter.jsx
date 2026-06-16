import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { fmt } from '../../lib/format.js';

function fmtDate(d) {
  return new Date(d).toLocaleDateString('en-ZA', { day: 'numeric', month: 'long', year: 'numeric' });
}

export default function Letter() {
  const { token } = useParams();
  const [data, setData]     = useState(null);
  const [error, setError]   = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch(`/api/letter/${token}`)
      .then(r => r.json().then(d => ({ ok: r.ok, d })))
      .then(({ ok, d }) => {
        if (!ok) throw new Error(d.error || 'Letter not found');
        setData(d);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [token]);

  if (loading) return (
    <div style={{ minHeight: '60vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <div className="spinner" style={{ width: 32, height: 32 }} />
    </div>
  );

  if (error) return (
    <div style={{ maxWidth: 480, margin: '80px auto', padding: '0 20px', textAlign: 'center' }}>
      <div style={{ fontSize: '3rem', marginBottom: 16 }}>⚠️</div>
      <h1 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', marginBottom: 12 }}>Letter not available</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: 24 }}>{error}. Pre-approval letters expire after 90 days.</p>
      <Link to="/" style={{ color: 'var(--mint)', fontWeight: 600, textDecoration: 'none' }}>← Back to Bondly</Link>
    </div>
  );

  const isExpired = data && new Date(data.validUntil) < new Date();

  return (
    <div style={{ maxWidth: 720, margin: '32px auto 80px', padding: '0 20px' }}>
      {isExpired && (
        <div style={{ background: '#fef3c7', border: '1px solid #f59e0b', borderRadius: 8, padding: '12px 20px', marginBottom: 24, fontSize: '0.875rem', color: '#92400e', fontWeight: 600 }}>
          ⚠ This letter expired on {fmtDate(data.validUntil)} — a new one can be generated from the Bondly dashboard.
        </div>
      )}

      {/* Letter card */}
      <div style={{ background: 'var(--bg-card)', border: '1.5px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {/* Header bar */}
        <div style={{ background: 'var(--forest)', padding: '24px 36px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div style={{ color: 'var(--lime)', fontWeight: 800, fontSize: '1.375rem', letterSpacing: '-0.01em', marginBottom: 2 }}>Bondly</div>
            <div style={{ color: 'rgba(245,240,232,0.6)', fontSize: '0.8125rem' }}>South Africa's home loan platform</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ color: 'rgba(245,240,232,0.5)', fontSize: '0.75rem', marginBottom: 2 }}>Reference</div>
            <div style={{ color: 'rgba(245,240,232,0.85)', fontWeight: 700, fontFamily: 'monospace', fontSize: '0.875rem' }}>{data.refNum}</div>
          </div>
        </div>

        <div style={{ padding: '36px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12, marginBottom: 32, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
            <span>Issued: <strong style={{ color: 'var(--text-primary)' }}>{fmtDate(data.issuedAt)}</strong></span>
            <span style={{ color: isExpired ? 'var(--color-error)' : 'var(--color-success)', fontWeight: 600 }}>
              {isExpired ? `Expired ${fmtDate(data.validUntil)}` : `Valid until ${fmtDate(data.validUntil)}`}
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', textTransform: 'uppercase', letterSpacing: '0.03em', color: 'var(--text-secondary)', marginBottom: 8, fontWeight: 600 }}>
            Mortgage Pre-Approval Indication
          </h2>

          <p style={{ fontSize: '1rem', lineHeight: 1.65, marginBottom: 28, color: 'var(--text-primary)' }}>
            Dear <strong>{data.userName}</strong>,
          </p>
          <p style={{ fontSize: '0.9375rem', lineHeight: 1.65, marginBottom: 28, color: 'var(--text-secondary)', maxWidth: 560 }}>
            We are pleased to issue this pre-approval indication based on the financial information analysed by the Bondly platform.
            This letter is provided for the purpose of property negotiations.
          </p>

          {/* Key figures */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
            <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '20px 24px' }}>
              <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6 }}>Approved amount</div>
              <div style={{ fontWeight: 800, fontSize: '1.75rem', color: 'var(--mint)', fontFamily: 'var(--font-serif)' }}>{fmt(data.bondAmount)}</div>
            </div>
            {data.purchasePrice && (
              <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '20px 24px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6 }}>Purchase price</div>
                <div style={{ fontWeight: 800, fontSize: '1.75rem', color: 'var(--text-primary)', fontFamily: 'var(--font-serif)' }}>{fmt(data.purchasePrice)}</div>
              </div>
            )}
            {data.propertyAddress && data.propertyAddress !== 'Property as negotiated' && (
              <div style={{ background: 'var(--bg-base)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '20px 24px' }}>
                <div style={{ fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 6 }}>Property</div>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', color: 'var(--text-primary)', lineHeight: 1.4 }}>{data.propertyAddress}</div>
              </div>
            )}
          </div>

          <p style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: 24, padding: '14px 16px', background: 'var(--bg-base)', borderRadius: 8, borderLeft: '3px solid var(--border-color)' }}>
            This is an indicative pre-approval only and does not constitute a formal credit offer or guarantee of bond approval.
            Final approval is subject to the lending institution's credit and affordability assessment.
            Bondly is a comparison platform that helps applicants understand their affordability and compare bank offers. Bondly does not act as a bond originator or financial intermediary.
          </p>

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: 16, borderTop: '1px solid var(--border-color)', paddingTop: 24 }}>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>
              <div style={{ fontWeight: 700, color: 'var(--text-primary)', marginBottom: 2 }}>Bondly (Pty) Ltd</div>
              <div>bondly.co.za · hello@bondly.co.za</div>
            </div>
            <Link to="/preapproval" style={{ fontSize: '0.875rem', fontWeight: 600, color: 'var(--lime)', textDecoration: 'none', padding: '8px 16px', border: '1px solid var(--lime)', borderRadius: 6 }}>
              Get your own pre-approval →
            </Link>
          </div>
        </div>
      </div>

      <p style={{ textAlign: 'center', fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 20 }}>
        Verify this letter at <strong>bondly.co.za/letter/{token}</strong> · Reference {data.refNum}
      </p>
    </div>
  );
}
