import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext.jsx';
import './OriginationDashboard.css';

const STAGES = [
  { key: 'submitted',   label: 'Application submitted' },
  { key: 'review',      label: 'Under review' },
  { key: 'docs',        label: 'Documents requested' },
  { key: 'approved',    label: 'Pre-approved' },
  { key: 'registered',  label: 'Bond registered' },
];

export default function OriginationDashboard() {
  const { user, logout } = useAuth();
  const [applications, setApplications] = useState([]);

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;
    fetch('/api/applications', { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => { if (data?.applications) setApplications(data.applications); })
      .catch(() => {});
  }, []);

  const latestApp = applications[0];
  const currentStage = latestApp?.stage || 'submitted';
  const stageIdx = STAGES.findIndex(s => s.key === currentStage);

  return (
    <div className="orig-dash">
      <header className="orig-dash__nav">
        <Link to="/" className="orig-dash__logo">Bondly <span>Home</span></Link>
        <div className="orig-dash__nav-right">
          <span className="orig-dash__greeting">Hi, {user?.name?.split(' ')[0] || 'there'}</span>
          <button className="orig-dash__logout" onClick={logout}>Sign out</button>
        </div>
      </header>

      <main className="orig-dash__body">
        <h1 className="orig-dash__h1">Your home loan journey</h1>

        {latestApp ? (
          <div className="orig-dash__card">
            <p className="orig-dash__card-title">Application status</p>
            <div className="orig-dash__stages">
              {STAGES.map((s, i) => (
                <div key={s.key} className={`orig-dash__stage${i <= stageIdx ? ' done' : ''}${i === stageIdx ? ' active' : ''}`}>
                  <div className="orig-dash__stage-dot">{i < stageIdx ? '✓' : i + 1}</div>
                  <span>{s.label}</span>
                </div>
              ))}
            </div>
            {latestApp.notes && (
              <p className="orig-dash__notes">💬 {latestApp.notes}</p>
            )}
          </div>
        ) : (
          <div className="orig-dash__card orig-dash__card--empty">
            <p>No application yet.</p>
            <Link to="/preapproval" className="orig-dash__cta">Start pre-approval →</Link>
          </div>
        )}

        <div className="orig-dash__card orig-dash__cross-sell">
          <p className="orig-dash__cross-sell-title">Already own a home?</p>
          <p>Once your bond is registered, Bondly can help you switch to a lower rate — saving you thousands every year.</p>
          <a href="https://bondly.co.za" target="_blank" rel="noreferrer" className="orig-dash__cta">
            Check switching savings →
          </a>
        </div>
      </main>
    </div>
  );
}
