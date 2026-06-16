import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { Link2 } from 'lucide-react';
import { share } from '../../lib/api.js';
import { fmt, fmtPct } from '../../lib/format.js';
import './ShareResult.css';

export default function ShareResult() {
  const { token }  = useParams();
  const [data, setData]    = useState(null);
  const [error, setError]  = useState(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    share.get(token)
      .then(setData)
      .catch(e => setError(e.message || 'Link not found or expired'));
  }, [token]);

  function copyLink() {
    navigator.clipboard.writeText(window.location.href).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  function shareWhatsApp() {
    const text = encodeURIComponent(
      `I'm saving ${fmt(data.monthlySaving)}/month by switching my home loan with Bondly — that's ${fmt(Math.round(data.totalSaving))} over my remaining term.\n\nSee my savings: ${window.location.href}`
    );
    window.open(`https://wa.me/?text=${text}`, '_blank');
  }

  if (error) return (
    <div className="share-page">
      <div className="share-card share-card--error">
        <div className="share-card__icon"><Link2 size={24} /></div>
        <h2>Link not found</h2>
        <p>This savings link may have expired or doesn't exist. Share links are valid for 30 days.</p>
        <Link to="/" className="share-cta">Calculate your own savings →</Link>
      </div>
    </div>
  );

  if (!data) return (
    <div className="share-page">
      <div className="share-card">
        <div className="spinner" style={{ width: 32, height: 32, margin: '0 auto' }} />
      </div>
    </div>
  );

  const annualSaving = Math.round(data.monthlySaving * 12);

  return (
    <div className="share-page">
      <div className="share-card">
        <div className="share-card__header">
          <div className="share-card__brand">Bondly</div>
          <div className="share-card__tagline">Home loan savings calculator</div>
        </div>

        <div className="share-card__hero">
          <div className="share-card__label">Monthly saving</div>
          <div className="share-card__amount">{fmt(data.monthlySaving)}<span>/month</span></div>
          <div className="share-card__sub">
            By switching from {fmtPct(data.currentRate)} → {fmtPct(data.newRate)}{data.bank ? ` (${data.bank})` : ''}
          </div>
        </div>

        <div className="share-card__stats">
          <div className="share-card__stat">
            <div className="share-card__stat-label">Annual saving</div>
            <div className="share-card__stat-val">{fmt(annualSaving)}</div>
          </div>
          <div className="share-card__stat">
            <div className="share-card__stat-label">Over remaining term</div>
            <div className="share-card__stat-val">{fmt(Math.round(data.totalSaving))}</div>
          </div>
          <div className="share-card__stat">
            <div className="share-card__stat-label">Bond balance</div>
            <div className="share-card__stat-val">{fmt(data.balance)}</div>
          </div>
        </div>

        <div className="share-card__disclaimer">
          These are estimates. Actual savings depend on your credit profile and the rate banks offer at time of switching. Banks competing for your business means you may save even more.
        </div>

        <div className="share-card__actions">
          <button className="share-btn share-btn--whatsapp" onClick={shareWhatsApp}>
            <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
            Share on WhatsApp
          </button>
          <button className="share-btn share-btn--copy" onClick={copyLink}>
            {copied ? '✓ Copied!' : 'Copy link'}
          </button>
        </div>

        <div className="share-card__cta-wrap">
          <Link to="/#switch" className="share-cta">Calculate your own savings →</Link>
          <Link to="/register" className="share-cta share-cta--lime">Switch my bond — it's free</Link>
        </div>
      </div>
    </div>
  );
}
