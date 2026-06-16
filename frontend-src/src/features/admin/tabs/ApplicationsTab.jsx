import { useEffect, useMemo, useState } from 'react';
import AdminTable from '../components/AdminTable.jsx';
import { admin } from '../../../lib/api.js';
import { fmt } from '../../../lib/format.js';

/**
 * Unified Applications view — replaces having to flip between Pipeline,
 * Switch Apps, Submissions, and Bond Applications to see the same records
 * from different angles.
 *
 * One row per application. Filterable by:
 *   - type     (swap, origination, all)
 *   - status   (submitted, reviewing, offer_available, accepted, rejected)
 *   - sla      (overdue, due-soon, on-track, contacted)
 *   - broker   (all assigned brokers in the roster)
 *
 * Bulk actions on selected rows:
 *   - Assign to broker     (round-robin or pick)
 *   - Mark first contact   (stamps firstContactAt, stops SLA clock)
 *   - Send to broker email (multinet handoff)
 */
// Decode the current admin's identity from the JWT so the "Assign me"
// quick action can fire without a separate /me roundtrip. This is the same
// shape adminAuth issues server-side.
function _readAdminFromToken() {
  try {
    const t = localStorage.getItem('bondly_token') || '';
    const p = JSON.parse(atob(t.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return { email: p.adminEmail || p.email || null, name: p.name || p.adminName || null, id: p.userId || p.id || null };
  } catch { return { email: null, name: null, id: null }; }
}

export default function ApplicationsTab({ showToast, onJump }) {
  const [apps,       setApps]       = useState([]);
  const [roster,     setRoster]     = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [refreshKey, setRefreshKey] = useState(0);
  const me = _readAdminFromToken();

  useEffect(() => {
    setLoading(true);
    const tok = () => 'Bearer ' + (localStorage.getItem('bondly_token') || '');
    Promise.all([
      fetch('/api/admin/applications/sla-status', { headers: { Authorization: tok() } }).then(r => r.json()).catch(() => null),
      fetch('/api/admin/broker-roster',           { headers: { Authorization: tok() } }).then(r => r.json()).catch(() => null),
    ]).then(([sla, rost]) => {
      const buckets = sla?.data || { overdue: [], dueSoon: [], onTrack: [], contacted: [] };
      // Flatten + tag each entry with its bucket so we can filter cheaply.
      const merged = [
        ...buckets.overdue  .map(a => ({ ...a, _bucket: 'overdue'  })),
        ...buckets.dueSoon  .map(a => ({ ...a, _bucket: 'due_soon' })),
        ...buckets.onTrack  .map(a => ({ ...a, _bucket: 'on_track' })),
        ...buckets.contacted.map(a => ({ ...a, _bucket: 'contacted' })),
      ];
      setApps(merged);
      setRoster(rost?.data?.roster || []);
    }).finally(() => setLoading(false));
  }, [refreshKey]);

  async function markFirstContact(rows) {
    try {
      const tok = 'Bearer ' + (localStorage.getItem('bondly_token') || '');
      for (const r of rows) {
        await fetch(`/api/admin/applications/${r.id}/first-contact`, {
          method: 'POST', headers: { Authorization: tok, 'Content-Type': 'application/json' },
        });
      }
      showToast?.(`Marked first contact on ${rows.length} application${rows.length === 1 ? '' : 's'}`, 'success');
      setRefreshKey(k => k + 1);
    } catch (e) { showToast?.('Could not stamp first contact', 'error'); }
  }

  async function bulkAssign(rows, brokerId) {
    const broker = roster.find(b => b.id === brokerId);
    if (!broker) return;
    try {
      const tok = 'Bearer ' + (localStorage.getItem('bondly_token') || '');
      for (const r of rows) {
        await fetch(`/api/admin/applications/${r.id}/assign`, {
          method: 'POST',
          headers: { Authorization: tok, 'Content-Type': 'application/json' },
          body: JSON.stringify({ brokerId: broker.id, brokerName: broker.name, brokerEmail: broker.email }),
        });
      }
      showToast?.(`Assigned ${rows.length} application${rows.length === 1 ? '' : 's'} to ${broker.name}`, 'success');
      setRefreshKey(k => k + 1);
    } catch (e) { showToast?.('Could not assign', 'error'); }
  }

  const overdue = apps.filter(a => a._bucket === 'overdue').length;
  const dueSoon = apps.filter(a => a._bucket === 'due_soon').length;

  const columns = useMemo(() => [
    {
      key: 'applicant',
      label: 'Applicant',
      sortable: true,
      sortValue: r => (r.applicantName || r.userId || '').toString(),
      render: r => (
        <div>
          <div style={{ fontWeight: 700 }}>{r.applicantName || r.userId}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{r.applicantEmail || '—'}</div>
        </div>
      ),
      csvValue: r => r.applicantName || r.userId,
    },
    {
      key: 'type',
      label: 'Type',
      sortable: true,
      width: 110,
      render: r => (
        <span style={{
          padding: '2px 10px', borderRadius: 999,
          background: r.type === 'swap' ? 'rgba(74,127,165,0.15)' : 'rgba(30,58,95,0.15)',
          color:      r.type === 'swap' ? '#1e3a5f' : '#152d4a',
          fontSize: '0.75rem', fontWeight: 700,
        }}>{r.type === 'swap' ? 'Switch' : 'Origination'}</span>
      ),
    },
    {
      key: 'requestedAmount',
      label: 'Amount',
      sortable: true,
      align: 'right',
      width: 130,
      render: r => fmt(r.requestedAmount || 0),
      sortValue: r => r.requestedAmount || 0,
    },
    {
      key: 'status',
      label: 'Status',
      sortable: true,
      width: 130,
      render: r => <span className="pill">{(r.status || 'submitted').replace(/_/g, ' ')}</span>,
    },
    {
      key: '_bucket',
      label: 'SLA',
      sortable: true,
      width: 110,
      render: r => {
        const map = {
          overdue:   { bg: '#fee2e2', fg: '#991b1b', label: 'Overdue'  },
          due_soon:  { bg: '#fef3c7', fg: '#92400e', label: 'Due soon' },
          on_track:  { bg: '#dcfce7', fg: '#166534', label: 'On track' },
          contacted: { bg: '#e0e7ff', fg: '#3730a3', label: 'Contacted'},
        };
        const m = map[r._bucket] || map.on_track;
        return <span style={{ padding: '2px 10px', borderRadius: 999, background: m.bg, color: m.fg, fontSize: '0.75rem', fontWeight: 700 }}>{m.label}</span>;
      },
    },
    {
      key: 'assignedBroker',
      label: 'Broker',
      width: 150,
      render: r => r.assignedBroker?.brokerName || <em style={{ color: 'var(--text-secondary)' }}>Unassigned</em>,
      sortValue: r => r.assignedBroker?.brokerName || '',
      sortable: true,
    },
    {
      key: 'slaDeadline',
      label: 'Deadline',
      sortable: true,
      width: 150,
      render: r => r.slaDeadline ? new Date(r.slaDeadline).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }) : '—',
      sortValue: r => r.slaDeadline ? new Date(r.slaDeadline).getTime() : 0,
    },
    {
      key: 'pdf',
      label: 'Pack',
      width: 140,
      render: r => {
        const tok = encodeURIComponent(localStorage.getItem('bondly_token') || '');
        return (
          <span style={{ display: 'inline-flex', gap: 6 }} onClick={e => e.stopPropagation()}>
            <a href={`/api/admin/applications/${r.id}/broker-pdf?token=${tok}`}
               target="_blank" rel="noopener noreferrer"
               style={{ padding: '4px 8px', background: 'rgba(30,58,95,0.12)', color: 'var(--forest)', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              PDF
            </a>
            <a href={`/api/admin/applications/${r.id}/broker-pack.zip?token=${tok}`}
               style={{ padding: '4px 8px', background: 'rgba(74,127,165,0.12)', color: '#1e3a5f', borderRadius: 6, fontSize: '0.6875rem', fontWeight: 700, textDecoration: 'none', whiteSpace: 'nowrap' }}>
              ZIP
            </a>
          </span>
        );
      },
    },
  ], []);

  const filters = [
    {
      key: 'type', label: 'Type',
      options: [{ value: 'swap', label: 'Switch' }, { value: 'origination', label: 'Origination' }],
    },
    {
      key: 'status', label: 'Status',
      options: ['submitted', 'reviewing', 'offer_available', 'accepted', 'rejected'].map(s => ({ value: s, label: s.replace(/_/g, ' ') })),
    },
    {
      key: '_bucket', label: 'SLA',
      options: [
        { value: 'overdue',   label: 'Overdue'   },
        { value: 'due_soon',  label: 'Due soon'  },
        { value: 'on_track',  label: 'On track'  },
        { value: 'contacted', label: 'Contacted' },
      ],
    },
    ...(roster.length ? [{
      key: 'brokerId', label: 'Broker',
      match: (r, val) => r.assignedBroker?.brokerId === val,
      options: roster.map(b => ({ value: b.id, label: b.name })),
    }] : []),
  ];

  // Bulk actions — "Assign me" lands first since it's the most common click
  // on the overdue list. We pass the admin's own identity so the assignment
  // is owned by a real person rather than a roster proxy.
  async function bulkAssignMe(rows) {
    if (!me.email) { showToast?.('Could not identify your admin account', 'error'); return; }
    try {
      const tok = 'Bearer ' + (localStorage.getItem('bondly_token') || '');
      for (const r of rows) {
        await fetch(`/api/admin/applications/${r.id}/assign`, {
          method: 'POST',
          headers: { Authorization: tok, 'Content-Type': 'application/json' },
          body: JSON.stringify({ brokerId: me.email, brokerName: me.name || me.email, brokerEmail: me.email }),
        });
      }
      showToast?.(`Assigned ${rows.length} application${rows.length === 1 ? '' : 's'} to you`, 'success');
      setRefreshKey(k => k + 1);
    } catch { showToast?.('Could not assign', 'error'); }
  }
  const bulkActions = [
    { label: 'Assign to me',       onClick: bulkAssignMe },
    { label: 'Mark first contact', onClick: markFirstContact },
    ...roster.slice(0, 3).map(b => ({
      label: `Assign to ${b.name.split('—').slice(-1)[0].trim()}`,
      onClick: rows => bulkAssign(rows, b.id),
    })),
  ];

  const notice = (overdue + dueSoon) > 0 ? (
    <span>
      {overdue > 0 && <><strong>{overdue}</strong> overdue · </>}
      {dueSoon > 0 && <><strong>{dueSoon}</strong> due in &lt;4h · </>}
      stamp first contact or reassign to clear the SLA clock.
    </span>
  ) : null;

  if (loading) return <div style={{ padding: 40, textAlign: 'center', color: 'var(--text-secondary)' }}>Loading applications…</div>;

  return (
    <div className="fade-in">
      <AdminTable
        rows={apps}
        columns={columns}
        searchKeys={['applicantName', 'applicantEmail', 'userId', 'id', r => r.assignedBroker?.brokerName]}
        filters={filters}
        defaultSort={{ key: '_bucket', dir: 'asc' }}
        selectable
        bulkActions={bulkActions}
        csvExport
        csvFilename={`applications-${new Date().toISOString().slice(0,10)}.csv`}
        notice={notice}
        onRowClick={r => onJump?.(r)}
        emptyState="No applications match the current filters."
        savedViewKey="applications"
      />
    </div>
  );
}
