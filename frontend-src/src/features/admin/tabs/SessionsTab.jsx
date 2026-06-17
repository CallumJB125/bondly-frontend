// SessionsTab — conversion funnel, drop-off pages, and per-session breadcrumb list.
// Standardized (Phase C): self-fetches via React Query; not tabular, so it keeps its
// bespoke funnel/breadcrumb visuals but uses a loading skeleton + shared EmptyState.
import { useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import { useAdminSessions } from '../hooks/useAdminQueries.js';

export default function SessionsTab() {
  const { data: sessions = [], isLoading } = useAdminSessions();
  const [selected, setSelected] = useState(null);
  const [filter, setFilter] = useState('all'); // all | errors | dropped

  const ROUTE_LABELS = {
    '/':            'Landing',
    '/login':       'Login',
    '/register':    'Register',
    '/preapproval': 'Pre-approval',
    '/dashboard':   'Dashboard',
    '/optimize':    'Optimizer',
    '/profile':     'Profile',
    '/application': 'Application',
    '/onboarding':  'Onboarding',
    '/tools':       'Tools',
    '/tools/repayment-calculator': 'Repayment calc',
    '/blog':        'Blog',
    '/about':       'About',
    '/faq':         'FAQ',
    '/get-a-quote': 'Get a quote',
  };

  function labelRoute(r) { return ROUTE_LABELS[r] || r || '?'; }

  function fmtDuration(s) {
    if (!s) return '—';
    if (s < 60) return `${s}s`;
    return `${Math.floor(s/60)}m ${s%60}s`;
  }

  function fmtDwell(ms) {
    if (!ms) return null;
    const s = Math.round(ms / 1000);
    if (s < 5) return null; // noise
    if (s < 60) return `${s}s`;
    return `${Math.floor(s/60)}m ${s%60}s`;
  }

  // ── Funnel — count how many sessions hit each key route ──────────────────
  const FUNNEL_STEPS = ['/', '/preapproval', '/register', '/onboarding', '/dashboard', '/optimize', '/application'];
  const funnelCounts = {};
  FUNNEL_STEPS.forEach(r => {
    funnelCounts[r] = sessions.filter(s => (s.pages || []).some(p => p.route === r)).length;
  });
  const funnelMax = Math.max(...Object.values(funnelCounts), 1);

  // ── Drop-off: sessions that visited a page and never went further ─────────
  const dropOffCounts = {};
  sessions.forEach(s => {
    if (!s.exitPage) return;
    dropOffCounts[s.exitPage] = (dropOffCounts[s.exitPage] || 0) + 1;
  });
  const topDropOff = Object.entries(dropOffCounts).sort((a,b) => b[1]-a[1]).slice(0, 8);

  // ── Filter sessions ───────────────────────────────────────────────────────
  const filtered = sessions.filter(s => {
    if (filter === 'errors') return s.hadError;
    if (filter === 'dropped') return s.pageCount > 1 && !s.userId;
    return true;
  });

  if (isLoading) {
    return (
      <div style={{ display: 'grid', gap: 8, padding: '8px 0 48px' }}>
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="adm-skeleton" style={{ height: 72, borderRadius: 10, background: 'var(--bg-card)' }} />
        ))}
      </div>
    );
  }

  if (sessions.length === 0) {
    return (
      <div style={{ padding: '8px 0 48px' }}>
        <EmptyState title="No sessions recorded yet" sub="Sessions are recorded as users browse the site." />
      </div>
    );
  }

  return (
    <div style={{ padding: '0 0 48px' }}>
      {/* ── Funnel ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 12 }}>Conversion Funnel</div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'flex-end', flexWrap: 'wrap' }}>
          {FUNNEL_STEPS.map((route, i) => {
            const count = funnelCounts[route] || 0;
            const pct   = Math.round((count / funnelMax) * 100);
            const prev  = i > 0 ? (funnelCounts[FUNNEL_STEPS[i-1]] || 1) : count;
            const rawDrop = i > 0 && prev > 0 ? Math.round((1 - count / prev) * 100) : null;
            const drop    = rawDrop !== null ? Math.min(100, Math.max(-100, rawDrop)) : null;
            return (
              <div key={route} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: 80 }}>
                <div style={{ fontSize: '0.75rem', fontWeight: 700, marginBottom: 4 }}>{count}</div>
                <div style={{ width: 64, background: 'var(--bg-page)', borderRadius: 4, height: 80, display: 'flex', alignItems: 'flex-end', overflow: 'hidden' }}>
                  <div style={{ width: '100%', height: `${Math.max(pct, 4)}%`, background: 'var(--mint)', borderRadius: '4px 4px 0 0', transition: 'height 0.3s' }} />
                </div>
                {drop !== null && drop !== 0 && (
                  <div style={{ fontSize: '0.65rem', color: drop > 50 ? '#ef4444' : drop > 25 ? '#f59e0b' : 'var(--text-secondary)', fontWeight: drop > 25 ? 700 : 400, marginTop: 2 }}>
                    {drop > 0 ? `-${drop}%` : `+${Math.abs(drop)}%`}
                  </div>
                )}
                <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 4, textAlign: 'center', maxWidth: 72 }}>{labelRoute(route)}</div>
              </div>
            );
          })}
        </div>
      </div>

      {/* ── Drop-off pages ── */}
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontWeight: 700, fontSize: '0.875rem', textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', marginBottom: 10 }}>Where sessions end</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {topDropOff.map(([route, count]) => (
            <div key={route} style={{ padding: '6px 12px', borderRadius: 6, background: 'var(--bg-page)', border: '1px solid var(--border-color)', fontSize: '0.8125rem' }}>
              <span style={{ fontWeight: 700 }}>{count}</span>
              <span style={{ color: 'var(--text-secondary)', marginLeft: 6 }}>{labelRoute(route)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Session list ── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{filtered.length} sessions</span>
        {['all','errors','dropped'].map(f => (
          <button key={f} onClick={() => setFilter(f)}
            style={{ padding: '4px 12px', borderRadius: 6, border: '1.5px solid', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer',
              borderColor: filter === f ? 'var(--mint)' : 'var(--border-color)',
              background:  filter === f ? 'var(--mint)' : 'var(--bg-card)',
              color:       filter === f ? 'var(--forest)' : 'var(--text-primary)' }}>
            {f === 'all' ? 'All' : f === 'errors' ? '⚠ Had error' : 'Anon drop-off'}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gap: 8 }}>
        {filtered.slice(0, 80).map(s => (
          <div key={s.id} onClick={() => setSelected(selected?.id === s.id ? null : s)}
            style={{ background: 'var(--bg-card)', border: `1.5px solid ${s.hadError ? '#ef444440' : 'var(--border-color)'}`, borderRadius: 10, padding: '12px 16px', cursor: 'pointer', userSelect: 'none' }}>
            <div style={{ display: 'flex', gap: 12, alignItems: 'center', flexWrap: 'wrap' }}>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>
                  {s.userName || <span style={{ color: 'var(--text-secondary)' }}>Anonymous</span>}
                  {s.hadError    && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#ef4444', fontWeight: 700 }}>⚠ error</span>}
                  {s.hadRageClick && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#f59e0b', fontWeight: 700 }}>👊 rage click</span>}
                  {s.gotStuck    && <span style={{ marginLeft: 6, fontSize: '0.75rem', color: '#8b5cf6', fontWeight: 700 }}>⏸ stuck</span>}
                </div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {s.startedAt ? new Date(s.startedAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 16, fontSize: '0.8125rem' }}>
                <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700 }}>{s.pageCount || 0}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>pages</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700 }}>{fmtDuration(s.duration)}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>duration</div></div>
                <div style={{ textAlign: 'center' }}><div style={{ fontWeight: 700, color: 'var(--text-secondary)' }}>{labelRoute(s.exitPage)}</div><div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>exit page</div></div>
              </div>
              {/* Page path breadcrumb */}
              <div style={{ width: '100%', display: 'flex', gap: 4, alignItems: 'center', flexWrap: 'wrap', marginTop: 4 }}>
                {(s.pages || []).map((p, i) => {
                  const dwell = fmtDwell(p.dwellMs);
                  return (
                    <span key={i} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span style={{ fontSize: '0.75rem', padding: '2px 7px', background: i === (s.pages.length-1) ? (s.hadError ? '#ef444420' : 'var(--bg-page)') : 'transparent', borderRadius: 4, color: i === (s.pages.length-1) ? 'var(--text-primary)' : 'var(--text-secondary)', fontWeight: i === (s.pages.length-1) ? 600 : 400 }}>
                        {labelRoute(p.route)}{dwell ? ` · ${dwell}` : ''}
                      </span>
                      {i < (s.pages.length-1) && <span style={{ color: 'var(--text-secondary)', fontSize: '0.7rem' }}>›</span>}
                    </span>
                  );
                })}
              </div>
            </div>

            {/* Expanded detail — actions + errors */}
            {selected?.id === s.id && (
              <div style={{ marginTop: 12, borderTop: '1px solid var(--border-color)', paddingTop: 10, display: 'flex', flexDirection: 'column', gap: 12 }}>
                {s.actions?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Actions</div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {s.actions.map((a, i) => {
                        const isError = a.name?.includes('failed') || a.name?.includes('error');
                        const isSuccess = a.name?.includes('success') || a.name?.includes('submitted') || a.name?.includes('started');
                        return (
                          <span key={i} style={{ fontSize: '0.75rem', padding: '2px 8px', borderRadius: 99, fontWeight: 600,
                            background: isError ? '#ef444420' : isSuccess ? '#10b98120' : 'var(--bg-page)',
                            color: isError ? '#ef4444' : isSuccess ? '#10b981' : 'var(--text-secondary)',
                            border: '1px solid', borderColor: isError ? '#ef444440' : isSuccess ? '#10b98140' : 'var(--border-color)' }}
                            title={[a.page, a.type, a.error, a.at?.slice(0,16)?.replace('T',' ')].filter(Boolean).join(' · ')}>
                            {a.name}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                )}
                {s.signals?.some(sig => sig.type === 'rage_click' || sig.type === 'stuck') && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Friction signals</div>
                    {s.signals.filter(sig => sig.type === 'rage_click' || sig.type === 'stuck').map((sig, i) => (
                      <div key={i} style={{ fontSize: '0.8125rem', padding: '4px 10px', background: '#f59e0b10', borderRadius: 6, marginBottom: 3 }}>
                        {sig.type === 'rage_click' ? `👊 Rage click on "${sig.text || sig.element}"` : `⏸ Stuck for 90s`}
                        <span style={{ color: 'var(--text-secondary)', marginLeft: 8, fontSize: '0.75rem' }}>{sig.page}</span>
                      </div>
                    ))}
                  </div>
                )}
                {s.errors?.length > 0 && (
                  <div>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: '#ef4444', marginBottom: 6, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Errors</div>
                    {s.errors.map((e, i) => (
                      <div key={i} style={{ fontSize: '0.8125rem', padding: '6px 10px', background: '#ef444410', borderRadius: 6, marginBottom: 4 }}>
                        <div style={{ fontWeight: 600, marginBottom: 2 }}>{e.message}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{e.page} · {e.at ? e.at.slice(0,16).replace('T',' ') : '—'}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
