import { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FileText } from 'lucide-react';
import { applications as appApi, swaps } from '../../lib/api.js';
import { fmt, fmtDate } from '../../lib/format.js';
import Button from '../../components/Button.jsx';
import Card, { CardHeader, CardBody } from '../../components/Card.jsx';
import './Application.css';

const STATUS_COLORS = {
  pending:      'blue',
  submitted:    'blue',
  under_review: 'yellow',
  reviewing:    'yellow',
  approved:     'green',
  in_progress:  'green',
  completed:    'green',
  rejected:     'red',
  cancelled:    'orange',
};

export default function Application() {
  const [apps, setApps]     = useState([]);
  const [swapApps, setSwap] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([appApi.list(), swaps.list()])
      .then(([a, s]) => { setApps(a || []); setSwap(s || []); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="page" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}><div className="spinner" /></div>;

  const allApps = [
    ...apps.map(a => ({ ...a, category: 'Pre-approval' })),
    ...swapApps.map(a => ({ ...a, category: 'Swap', title: `${a.currentBank} → ${a.targetBank}` })),
  ].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  return (
    <div className="page app-status-page">
      <div className="app-status-header">
        <div className="container">
          <button onClick={() => navigate('/')} className="btn btn--ghost-dark btn--sm">← Back</button>
          <h1 className="app-status-title">My Applications</h1>
          <p className="app-status-sub">Track the status of your pre-approval and bond swap applications.</p>
        </div>
      </div>

      <div className="container" style={{ paddingTop: 'var(--space-8)', paddingBottom: 'var(--space-12)' }}>
        {allApps.length === 0 ? (
          <div className="empty-state">
            <div style={{ marginBottom: 'var(--space-4)' }}><FileText size={48} strokeWidth={1} style={{ color: 'var(--lime)' }} /></div>
            <h3 style={{ marginBottom: 'var(--space-3)' }}>No applications yet</h3>
            <p>Ready to find a better rate? Start your pre-approval application — it takes under 2 minutes.</p>
            <div style={{ marginTop: 'var(--space-5)', display: 'flex', gap: 'var(--space-3)', flexWrap: 'wrap', justifyContent: 'center' }}>
              <Link to="/preapproval"><Button variant="lime">Start pre-approval →</Button></Link>
              <Link to="/dashboard"><Button variant="ghost">Go to dashboard</Button></Link>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            {allApps.map(app => (
              <Card key={app.id}>
                <CardBody>
                  <div style={{ display: 'flex', justifyContent: 'space-between', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
                        <span className={`pill pill--${STATUS_COLORS[app.status?.toLowerCase()] || 'green'}`}>
                          {app.status || 'Pending'}
                        </span>
                        <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{app.category}</span>
                      </div>
                      <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                        {app.title || app.purpose || 'Pre-approval Application'}
                      </div>
                      {app.maxBond > 0 && (
                        <div style={{ marginTop: 4, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                          Estimated max bond: <strong>{fmt(app.maxBond)}</strong>
                        </div>
                      )}
                    </div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', textAlign: 'right' }}>
                      <div>Submitted</div>
                      <div style={{ fontWeight: 600, color: 'var(--text-primary)' }}>{fmtDate(app.createdAt)}</div>
                    </div>
                  </div>
                  {app.note && (
                    <div style={{ marginTop: 'var(--space-3)', padding: 'var(--space-3) var(--space-4)', background: 'var(--bg-page)', borderRadius: 'var(--border-radius-sm)', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                      {app.note}
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}

        <div style={{ marginTop: 'var(--space-8)', background: 'var(--forest)', borderRadius: 'var(--border-radius)', padding: 'var(--space-6)' }}>
          <h3 style={{ color: 'var(--cream)', fontFamily: 'var(--font-serif)', marginBottom: 'var(--space-3)' }}>Need help with your application?</h3>
          <p style={{ color: 'rgba(245,240,232,0.70)', fontSize: '0.9375rem', marginBottom: 'var(--space-4)' }}>
            Our advisors are available Mon–Fri 8am–6pm. We'll guide you through every step.
          </p>
          <a href="mailto:hello@bondly.co.za">
            <Button variant="lime" size="sm">Email our team</Button>
          </a>
        </div>
      </div>
    </div>
  );
}
