import { useEffect, useState } from 'react';
import { Building2, CheckCircle, Clock, Loader2 } from 'lucide-react';
import { me, myApplication } from '../../lib/api.js';
import Card, { CardHeader, CardBody } from '../../components/Card.jsx';

/**
 * Conveyancing tracker — user-facing milestone view.
 *
 * Once a bond application is submitted, this card shows the user where
 * their application is in the 4–8 week conveyancing process. Users
 * historically fell off a cliff here because banks and attorneys
 * communicate over email and the user has no way to check progress.
 *
 * This card fetches /api/me/applications/:id/conveyancing for the active
 * application and renders the stage timeline + most recent admin note.
 *
 * Self-hides when there's no active application.
 */
export default function ConveyancingTracker() {
  const [appId, setAppId] = useState(null);
  const [data, setData]   = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    myApplication.get()
      .then(d => {
        const app = d?.application;
        if (!app || ['rejected', 'cancelled'].includes(app.status)) {
          setLoading(false);
          return;
        }
        setAppId(app.id);
        return me.conveyancing(app.id);
      })
      .then(c => { if (c) setData(c); })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) return null;
  if (!data) return null;

  return (
    <Card style={{ marginBottom: 'var(--space-5)' }}>
      <CardHeader>
        <span style={{ display:'flex', alignItems:'center', gap:8 }}>
          <Building2 size={16} /> Your application progress
        </span>
      </CardHeader>
      <CardBody>
        <div style={{ marginBottom: 16, padding:'10px 12px', background:'rgba(22,163,74,.06)', border:'1px solid rgba(22,163,74,.20)', borderRadius:8 }}>
          <div style={{ fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'.05em', color:'var(--text-secondary)', fontWeight:700 }}>Currently at</div>
          <div style={{ fontWeight:800, fontSize:'1.0625rem', color:'#152d4a', marginTop:2 }}>{data.currentStageLabel}</div>
          {data.typicalNextStepEta && (
            <div style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', marginTop:4 }}>
              Typical next step in ~{data.typicalNextStepEta}.
            </div>
          )}
        </div>

        {/* Stage timeline — vertical for readability on phones */}
        <ol style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column' }}>
          {(data.stages || []).map((s, i) => (
            <li key={s.key} style={{ display:'flex', alignItems:'flex-start', gap:12, padding:'10px 0', borderTop: i === 0 ? 'none' : '1px dashed var(--border-color)' }}>
              <div style={{ width:24, height:24, borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0,
                            background: s.status === 'done' ? '#16a34a' : s.status === 'current' ? 'rgba(245,158,11,.15)' : 'rgba(0,0,0,.04)',
                            color:     s.status === 'done' ? '#fff'    : s.status === 'current' ? '#b45309' : 'var(--text-secondary)' }}>
                {s.status === 'done'    ? <CheckCircle size={14} />
               : s.status === 'current' ? <Loader2     size={14} className="spin-anim" />
               :                          <Clock       size={14} />}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:'0.875rem', fontWeight: s.status === 'current' ? 700 : 500, color: s.status === 'pending' ? 'var(--text-secondary)' : 'var(--text-primary)' }}>
                  {s.label}
                </div>
              </div>
            </li>
          ))}
        </ol>

        {/* Last update note if admin set one */}
        {(data.history || []).slice(-1).map((h, i) => h.note && (
          <div key={i} style={{ marginTop: 12, padding:'10px 12px', background:'var(--bg-page)', borderRadius:8, fontSize:'0.8125rem', color:'var(--text-secondary)' }}>
            <strong>Latest note:</strong> {h.note}
          </div>
        ))}

        <p style={{ marginTop: 14, fontSize:'0.75rem', color:'var(--text-secondary)' }}>
          We update this every time your broker, the bank, or the attorneys log a milestone. You'll also get an email or in-app notification when something changes.
        </p>
      </CardBody>

      {/* Tiny spinner animation */}
      <style>{`
        .spin-anim { animation: bdl-spin 1.2s linear infinite; }
        @keyframes bdl-spin { to { transform: rotate(360deg); } }
      `}</style>
    </Card>
  );
}
