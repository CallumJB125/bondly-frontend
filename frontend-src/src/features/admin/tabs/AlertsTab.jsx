import { useState } from 'react';
import { admin } from '../../../lib/api.js';
import { fmt, fmtDate } from '@bondly/ui/lib/format.js';
import Button from '@bondly/ui/components/Button.jsx';
import Card from '@bondly/ui/components/Card.jsx';

export default function AlertsTab({ data, showToast }) {
  const { rateAlerts = [], savingsAlerts = [], primeRate = 11.25 } = data;
  const [view, setView] = useState('rate'); // 'rate' | 'savings'

  const STATUS_COLOR = { triggered: '#9ca3af', ready: '#16a34a', waiting: '#d97706' };
  const STATUS_LABEL = { triggered: 'Triggered', ready: 'Ready to contact', waiting: 'Waiting' };

  function waLabel(phone) {
    if (!phone) return null;
    const clean = phone.replace(/\D/g, '').replace(/^0/, '27');
    return `https://wa.me/${clean}`;
  }

  return (
    <div>
      {/* Summary cards */}
      <div className="adm-kpi-grid" style={{ marginBottom: 24 }}>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid var(--forest)' }}>
          <div className="adm-kpi-sub">Prime Rate</div>
          <div className="adm-kpi-value">{primeRate}%</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>Current SARB rate</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="adm-kpi-sub">Rate Targets</div>
          <div className="adm-kpi-value">{rateAlerts.filter(a => !a.triggeredAt).length}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>{rateAlerts.filter(a => a.triggeredAt).length} already triggered</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid #2563eb' }}>
          <div className="adm-kpi-sub">Savings Targets</div>
          <div className="adm-kpi-value">{savingsAlerts.length}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>Monthly savings watchers</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid var(--lime)' }}>
          <div className="adm-kpi-sub">Ready to Contact</div>
          <div className="adm-kpi-value">{rateAlerts.filter(a => a.status === 'ready').length}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>Target already met</div>
        </div>
      </div>

      {/* Toggle */}
      <div className="cust-toolbar" style={{ marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={`cust-filter-chip ${view === 'rate' ? 'active' : ''}`} onClick={() => setView('rate')}>
            Rate targets ({rateAlerts.length})
          </button>
          <button className={`cust-filter-chip ${view === 'savings' ? 'active' : ''}`} onClick={() => setView('savings')}>
            Savings targets ({savingsAlerts.length})
          </button>
        </div>
      </div>

      {view === 'rate' && (
        rateAlerts.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No rate targets set yet</div>
        ) : (
          <div className="cust-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Customer', 'Target Rate', 'Direction', 'Gap to Target', 'Bond Balance', 'Est. Commission', 'Status', 'Contact'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rateAlerts.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{a.userName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.userEmail}</div>
                    </td>
                    <td style={{ padding: '12px 12px', fontWeight: 700 }}>{a.targetRate}%</td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
                      {a.direction === 'at_or_below' ? '≤ target' : '≥ target'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ fontWeight: 600, color: a.gap <= 0 ? '#16a34a' : a.gap <= 0.5 ? '#d97706' : 'var(--text)' }}>
                        {a.gap <= 0 ? '✓ Met' : `${Number(a.gap).toFixed(2)}% away`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>{a.totalBalance > 0 ? fmt(a.totalBalance) : '—'}</td>
                    <td style={{ padding: '12px 12px', color: '#16a34a', fontWeight: 600 }}>
                      {a.totalBalance > 0 ? fmt(a.totalBalance * 0.005) : '—'}
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <span style={{ fontSize: '0.78rem', padding: '2px 8px', borderRadius: 10, background: STATUS_COLOR[a.status] + '22', color: STATUS_COLOR[a.status], fontWeight: 600 }}>
                        {STATUS_LABEL[a.status]}
                      </span>
                    </td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {a.userPhone && waLabel(a.userPhone) && (
                          <a href={waLabel(a.userPhone)} target="_blank" rel="noreferrer"
                             style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 6, background: '#25d36622', color: '#25d366', textDecoration: 'none', fontWeight: 600 }}>
                            WA
                          </a>
                        )}
                        {a.userEmail && (
                          <a href={`mailto:${a.userEmail}?subject=Your rate target has been reached&body=Hi ${a.userName},%0A%0AThe prime rate is now ${primeRate}%, which meets your target of ${a.targetRate}%.%0A%0AWould you like to explore switching your bond?`}
                             style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 6, background: 'var(--surface-raised)', color: 'var(--text)', textDecoration: 'none' }}>
                            Email
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {view === 'savings' && (
        savingsAlerts.length === 0 ? (
          <div style={{ padding: '48px 0', textAlign: 'center', color: 'var(--text-muted)' }}>No savings targets set yet</div>
        ) : (
          <div className="cust-table-wrap">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)' }}>
                  {['Customer', 'Monthly Target', 'Phone', 'Bond Balance', 'Est. Commission', 'Note', 'Contact'].map(h => (
                    <th key={h} style={{ padding: '10px 12px', textAlign: 'left', color: 'var(--text-muted)', fontWeight: 500 }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {savingsAlerts.map(a => (
                  <tr key={a.id} style={{ borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ fontWeight: 600 }}>{a.userName}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{a.userEmail}</div>
                    </td>
                    <td style={{ padding: '12px 12px', fontWeight: 700 }}>{fmt(a.monthlyThreshold)}/mo</td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-muted)', fontSize: '0.85rem' }}>{a.userPhone || '—'}</td>
                    <td style={{ padding: '12px 12px' }}>{a.totalBalance > 0 ? fmt(a.totalBalance) : '—'}</td>
                    <td style={{ padding: '12px 12px', color: '#16a34a', fontWeight: 600 }}>
                      {a.totalBalance > 0 ? fmt(a.totalBalance * 0.005) : '—'}
                    </td>
                    <td style={{ padding: '12px 12px', color: 'var(--text-muted)', fontSize: '0.82rem', maxWidth: 200 }}>{a.note || '—'}</td>
                    <td style={{ padding: '12px 12px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        {a.userPhone && waLabel(a.userPhone) && (
                          <a href={waLabel(a.userPhone)} target="_blank" rel="noreferrer"
                             style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 6, background: '#25d36622', color: '#25d366', textDecoration: 'none', fontWeight: 600 }}>
                            WA
                          </a>
                        )}
                        {a.userEmail && (
                          <a href={`mailto:${a.userEmail}`}
                             style={{ fontSize: '0.78rem', padding: '4px 8px', borderRadius: 6, background: 'var(--surface-raised)', color: 'var(--text)', textDecoration: 'none' }}>
                            Email
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}
    </div>
  );
}
