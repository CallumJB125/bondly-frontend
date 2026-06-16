import { useEffect, useMemo, useState } from 'react';
import AdminTable from '../components/AdminTable.jsx';
import { admin } from '../../../lib/api.js';
import { fmt, fmtDate } from '../../../lib/format.js';

/**
 * Watchlist — one place to see everyone waiting on a condition to be met:
 *
 *   • Rate alerts    (waiting for prime/their rate target)
 *   • Savings alerts (waiting to hit a monthly-saving threshold)
 *   • Buyer intents  (waiting to qualify for a target bond amount)
 *
 * Replaces the legacy Buyers + Waitlist tabs which showed overlapping
 * users with different filters baked into the UI. Same person could
 * sit on multiple watch types — we surface them all with a `watchType`
 * column instead of cloning rows across tabs.
 */
export default function WatchlistTab({ showToast }) {
  const [rows,    setRows]    = useState([]);
  const [loading, setLoading] = useState(true);
  const [meta,    setMeta]    = useState({ primeRate: 11.25 });

  useEffect(() => {
    setLoading(true);
    Promise.all([
      admin.alerts().catch(() => ({ rateAlerts: [], savingsAlerts: [], primeRate: 11.25 })),
      admin.buyerIntents().catch(() => []),
    ]).then(([alerts, buyers]) => {
      setMeta({ primeRate: alerts.primeRate || 11.25 });
      const ra = (alerts.rateAlerts || []).map(a => ({
        id:        `rate:${a.userId || a.id}:${a.targetRate ?? ''}`,
        watchType: 'rate',
        userId:    a.userId,
        name:      a.name || a.userName,
        email:     a.email || a.userEmail,
        phone:     a.phone,
        target:    a.targetRate,
        current:   a.currentRate ?? alerts.primeRate,
        delta:     (a.currentRate ?? alerts.primeRate) - (a.targetRate || 0),
        status:    a.status || (a.triggeredAt ? 'triggered' : (a.met ? 'ready' : 'waiting')),
        triggeredAt: a.triggeredAt,
        createdAt: a.createdAt,
      }));
      const sa = (alerts.savingsAlerts || []).map(a => ({
        id:        `saving:${a.userId || a.id}:${a.targetMonthlySaving ?? ''}`,
        watchType: 'saving',
        userId:    a.userId,
        name:      a.name || a.userName,
        email:     a.email || a.userEmail,
        phone:     a.phone,
        target:    a.targetMonthlySaving,
        current:   a.currentMonthlySaving || 0,
        delta:     (a.currentMonthlySaving || 0) - (a.targetMonthlySaving || 0),
        status:    a.status || (a.met ? 'ready' : 'waiting'),
        triggeredAt: a.triggeredAt,
        createdAt: a.createdAt,
      }));
      const bi = (buyers || []).map(b => ({
        id:        `buyer:${b.userId || b.id}`,
        watchType: 'buyer',
        userId:    b.userId || b.id,
        name:      b.name || b.userName,
        email:     b.email || b.userEmail,
        phone:     b.phone,
        target:    b.targetBondAmount,
        current:   b.currentMaxBond || 0,
        delta:     (b.currentMaxBond || 0) - (b.targetBondAmount || 0),
        status:    b.met ? 'ready' : 'waiting',
        createdAt: b.createdAt,
      }));
      setRows([...ra, ...sa, ...bi]);
    }).finally(() => setLoading(false));
  }, []);

  const ready   = rows.filter(r => r.status === 'ready').length;
  const waiting = rows.filter(r => r.status === 'waiting').length;

  const columns = useMemo(() => [
    {
      key: 'name', label: 'Customer', sortable: true,
      render: r => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.name || 'Anonymous'}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.email || r.userId}</div>
        </div>
      ),
    },
    {
      key: 'watchType', label: 'Watching', sortable: true, width: 110,
      render: r => {
        const tag = { rate: 'Rate', saving: 'Savings', buyer: 'Buyer' }[r.watchType] || r.watchType;
        const colour = { rate: '#1e3a5f', saving: '#16502d', buyer: '#92400e' }[r.watchType] || '#374151';
        const bg     = { rate: '#dbeafe', saving: '#dcfce7', buyer: '#fef3c7' }[r.watchType] || '#f3f4f6';
        return <span style={{ padding: '2px 10px', borderRadius: 999, background: bg, color: colour, fontSize: '0.75rem', fontWeight: 700 }}>{tag}</span>;
      },
    },
    {
      key: 'target', label: 'Target', sortable: true, align: 'right', width: 120,
      render: r => r.watchType === 'rate' ? `${(r.target || 0).toFixed(2)}%` : fmt(r.target || 0),
    },
    {
      key: 'current', label: 'Current', sortable: true, align: 'right', width: 120,
      render: r => r.watchType === 'rate' ? `${(r.current || 0).toFixed(2)}%` : fmt(r.current || 0),
    },
    {
      key: 'delta', label: 'Gap', sortable: true, align: 'right', width: 110,
      render: r => {
        // For rate watches: lower current vs target = good (delta negative).
        // For savings/buyer: higher current = good (delta positive).
        const good = r.watchType === 'rate' ? r.delta <= 0 : r.delta >= 0;
        const label = r.watchType === 'rate' ? `${r.delta >= 0 ? '+' : ''}${r.delta.toFixed(2)}%` : fmt(r.delta);
        return <span style={{ color: good ? '#16a34a' : '#dc2626', fontWeight: 700 }}>{label}</span>;
      },
    },
    {
      key: 'status', label: 'Status', sortable: true, width: 130,
      render: r => {
        const map = {
          ready:     { bg: '#dcfce7', fg: '#166534', label: 'Ready to contact' },
          waiting:   { bg: '#fef3c7', fg: '#92400e', label: 'Waiting'          },
          triggered: { bg: '#e0e7ff', fg: '#3730a3', label: 'Triggered'        },
        };
        const m = map[r.status] || map.waiting;
        return <span style={{ padding: '2px 10px', borderRadius: 999, background: m.bg, color: m.fg, fontSize: '0.75rem', fontWeight: 700 }}>{m.label}</span>;
      },
    },
    {
      key: 'createdAt', label: 'Watching since', sortable: true, width: 130,
      render: r => r.createdAt ? fmtDate(r.createdAt) : '—',
      sortValue: r => r.createdAt ? new Date(r.createdAt).getTime() : 0,
    },
    {
      key: 'contact', label: '', width: 130,
      render: r => {
        if (!r.phone) return null;
        const wa = `https://wa.me/${r.phone.replace(/\D/g, '').replace(/^0/, '27')}`;
        return (
          <a href={wa} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
             style={{ padding: '4px 10px', background: '#25D36618', color: '#128C7E', borderRadius: 6, fontSize: '0.75rem', fontWeight: 700, textDecoration: 'none' }}>
            WhatsApp →
          </a>
        );
      },
    },
  ], []);

  const filters = [
    {
      key: 'watchType', label: 'Type',
      options: [
        { value: 'rate',   label: 'Rate'    },
        { value: 'saving', label: 'Savings' },
        { value: 'buyer',  label: 'Buyer'   },
      ],
    },
    {
      key: 'status', label: 'Status',
      options: [
        { value: 'ready',     label: 'Ready to contact' },
        { value: 'waiting',   label: 'Waiting'          },
        { value: 'triggered', label: 'Triggered'        },
      ],
    },
  ];

  const notice = ready > 0 ? (
    <span><strong>{ready}</strong> customer{ready === 1 ? '' : 's'} ready to contact &middot; their target has been met.</span>
  ) : null;

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading watchlist…</div>;

  return (
    <div className="fade-in">
      <div className="adm-kpi-grid" style={{ marginBottom: 16 }}>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid var(--forest)' }}>
          <div className="adm-kpi-sub">Prime rate</div>
          <div className="adm-kpi-value">{meta.primeRate.toFixed(2)}%</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid #16a34a' }}>
          <div className="adm-kpi-sub">Ready to contact</div>
          <div className="adm-kpi-value">{ready}</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="adm-kpi-sub">Still waiting</div>
          <div className="adm-kpi-value">{waiting}</div>
        </div>
      </div>

      <AdminTable
        rows={rows}
        columns={columns}
        searchKeys={['name', 'email', 'phone']}
        filters={filters}
        defaultSort={{ key: 'status', dir: 'asc' }}
        csvExport
        csvFilename={`watchlist-${new Date().toISOString().slice(0,10)}.csv`}
        notice={notice}
        emptyState="Nobody is watching anything yet. Customers add watches from their dashboard."
        savedViewKey="watchlist"
      />
    </div>
  );
}
