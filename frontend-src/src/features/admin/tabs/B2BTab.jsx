import { useEffect, useState, useCallback } from 'react';
import AdminTable from '../components/AdminTable.jsx';
import EmptyState from '../components/EmptyState.jsx';
import Drawer from '../components/primitives/Drawer.jsx';
import Truncate from '../components/primitives/Truncate.jsx';
import { admin } from '../../../lib/api.js';

const STATUS_META = {
  new:       { label: 'New',       color: '#3b82f6', bg: 'rgba(59,130,246,0.12)' },
  contacted: { label: 'Contacted', color: '#8b5cf6', bg: 'rgba(139,92,246,0.12)' },
  qualified: { label: 'Qualified', color: '#d97706', bg: 'rgba(217,119,6,0.12)' },
  won:       { label: 'Won',       color: '#16a34a', bg: 'rgba(22,163,74,0.12)' },
  lost:      { label: 'Lost',      color: '#9ca3af', bg: 'rgba(156,163,175,0.12)' },
};
const STATUSES = Object.keys(STATUS_META);
const StatusPill = ({ status }) => {
  const m = STATUS_META[status || 'new'] || STATUS_META.new;
  return <span style={{ fontSize: '0.72rem', fontWeight: 700, color: m.color, background: m.bg, padding: '2px 9px', borderRadius: 12, whiteSpace: 'nowrap' }}>{m.label}</span>;
};

export default function B2BTab({ showToast }) {
  const [data, setData]       = useState({ leads: [], counts: {}, types: [], provinces: [], total: 0 });
  const [loading, setLoading] = useState(true);
  const [filter, setFilter]   = useState('all');
  const [typeF, setTypeF]     = useState('all');
  const [provF, setProvF]     = useState('all');
  const [search, setSearch]   = useState('');
  const [selected, setSelected] = useState(null);
  const [syncing, setSyncing] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    admin.b2b({ status: filter, type: typeF, province: provF, search })
      .then(d => setData(d || { leads: [], counts: {} }))
      .catch(() => showToast?.('Could not load B2B leads', 'error'))
      .finally(() => setLoading(false));
  }, [filter, typeF, provF, search]);

  useEffect(() => { const t = setTimeout(load, 250); return () => clearTimeout(t); }, [load]);

  async function syncNow() {
    setSyncing(true);
    try {
      const r = await admin.b2bSync();
      showToast?.(`Synced — ${r.added} new, ${r.total} total`, 'success');
      load();
    } catch (e) { showToast?.(e.message || 'Sync failed', 'error'); }
    finally { setSyncing(false); }
  }

  async function update(id, body) {
    try {
      const updated = await admin.b2bUpdate(id, body);
      setData(d => ({ ...d, leads: d.leads.map(l => l.id === id ? updated : l) }));
      setSelected(s => s && s.id === id ? updated : s);
    } catch (e) { showToast?.(e.message || 'Update failed', 'error'); }
  }

  const c = data.counts || {};
  const chips = [['all', `All (${c.all || 0})`], ...STATUSES.map(s => [s, `${STATUS_META[s].label} (${c[s] || 0})`])];

  return (
    <div className="fade-in">
      {/* KPI cards */}
      <div className="adm-kpi-grid" style={{ marginBottom: 20 }}>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid var(--forest)' }}>
          <div className="adm-kpi-sub">Total B2B leads</div>
          <div className="adm-kpi-value">{(c.all || 0).toLocaleString()}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>Estate agents & brokers (scraped)</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid #4a7fa5' }}>
          <div className="adm-kpi-sub">With contact details</div>
          <div className="adm-kpi-value">{(c.withContact || 0).toLocaleString()}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>Have an email or phone</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="adm-kpi-sub">Qualified</div>
          <div className="adm-kpi-value">{(c.qualified || 0).toLocaleString()}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>Worth pursuing</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid var(--lime)' }}>
          <div className="adm-kpi-sub">Won</div>
          <div className="adm-kpi-value">{(c.won || 0).toLocaleString()}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>Converted partners</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cust-toolbar" style={{ flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        <input type="search" placeholder="Search company, email, city…" value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.875rem', width: 240 }} />
        {chips.map(([v, l]) => (
          <button key={v} className={`cust-filter-chip ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
        <select value={typeF} onChange={e => setTypeF(e.target.value)} className="cust-filter-chip" style={{ cursor: 'pointer' }}>
          <option value="all">All types</option>
          {(data.types || []).map(t => <option key={t} value={t}>{t.replace(/_/g, ' ')}</option>)}
        </select>
        <select value={provF} onChange={e => setProvF(e.target.value)} className="cust-filter-chip" style={{ cursor: 'pointer' }}>
          <option value="all">All provinces</option>
          {(data.provinces || []).map(p => <option key={p} value={p}>{p}</option>)}
        </select>
        <button className="adm-quick-action" style={{ marginLeft: 'auto' }} onClick={syncNow} disabled={syncing}>
          {syncing ? 'Syncing…' : '↻ Sync from scraper'}
        </button>
      </div>

      {loading ? (
        <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, margin: '0 auto' }} /></div>
      ) : (data.leads || []).length === 0 && (c.all || 0) === 0 ? (
        <EmptyState title="No B2B leads yet" sub="Click “Sync from scraper” to import scraped estate-agent & broker leads." />
      ) : (
        <AdminTable
          rows={data.leads}
          getRowKey={l => l.id}
          onRowClick={l => setSelected(l)}
          dense
          defaultSort={{ key: 'companyName', dir: 'asc' }}
          emptyState="No B2B leads match this filter."
          columns={[
            { key: 'companyName', label: 'Company', sortable: true, sortValue: l => (l.companyName || '').toLowerCase(),
              render: l => <Truncate style={{ fontWeight: 600, maxWidth: 240 }}>{l.companyName}</Truncate> },
            { key: 'type', label: 'Type', sortable: true, render: l => l.type ? <span style={{ textTransform: 'capitalize' }}>{l.type.replace(/_/g, ' ')}</span> : <span className="adm-dash">—</span> },
            { key: 'location', label: 'Location', sortable: true, sortValue: l => `${l.province || ''} ${l.city || ''}`,
              render: l => (l.city || l.province) ? <Truncate style={{ maxWidth: 180, color: 'var(--text-secondary)' }}>{[l.city, l.province].filter(Boolean).join(', ')}</Truncate> : <span className="adm-dash">—</span> },
            { key: 'contact', label: 'Contact', sortable: true, sortValue: l => (l.email || l.phone || ''),
              render: l => l.email ? <Truncate style={{ maxWidth: 200, color: 'var(--text-secondary)' }}>{l.email}</Truncate> : l.phone ? <span style={{ color: 'var(--text-secondary)' }}>{l.phone}</span> : <span className="adm-dash" title="No contact details">—</span> },
            { key: 'status', label: 'Status', sortable: true, sortValue: l => l.status || 'new', render: l => <StatusPill status={l.status} /> },
          ]}
        />
      )}

      <Drawer open={!!selected} onClose={() => setSelected(null)} title="B2B lead" width={560}>
        {selected && (
          <div style={{ padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div>
              <div style={{ fontSize: '1.15rem', fontWeight: 700 }}>{selected.companyName}</div>
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.85rem', marginTop: 2, textTransform: 'capitalize' }}>{(selected.type || 'unknown').replace(/_/g, ' ')} · {[selected.city, selected.province].filter(Boolean).join(', ') || 'location unknown'}</div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Field label="Email" value={selected.email} link={selected.email && `mailto:${selected.email}`} />
              <Field label="Phone" value={selected.phone} link={selected.phone && `tel:${selected.phone}`} />
              <Field label="Website" value={selected.website} link={selected.website} />
              <Field label="Source" value={selected.sourceUrl ? 'scraped page' : null} link={selected.sourceUrl} />
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Status</label>
              <select value={selected.status || 'new'} onChange={e => update(selected.id, { status: e.target.value })}
                style={{ display: 'block', marginTop: 6, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.875rem', minWidth: 180 }}>
                {STATUSES.map(s => <option key={s} value={s}>{STATUS_META[s].label}</option>)}
              </select>
            </div>

            <div>
              <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Owner</label>
              <input defaultValue={selected.owner || ''} placeholder="Assign to…" onBlur={e => e.target.value !== (selected.owner || '') && update(selected.id, { owner: e.target.value })}
                style={{ display: 'block', marginTop: 6, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.875rem', width: '100%', maxWidth: 260 }} />
            </div>

            <NotesBlock lead={selected} onAdd={text => update(selected.id, { note: text })} />
          </div>
        )}
      </Drawer>
    </div>
  );
}

function Field({ label, value, link }) {
  return (
    <div>
      <div style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</div>
      {value ? (link
        ? <a href={link} target="_blank" rel="noreferrer" style={{ fontSize: '0.875rem', color: 'var(--mint)', wordBreak: 'break-word' }}>{value}</a>
        : <div style={{ fontSize: '0.875rem' }}>{value}</div>
      ) : <div className="adm-dash" style={{ fontSize: '0.875rem' }}>—</div>}
    </div>
  );
}

function NotesBlock({ lead, onAdd }) {
  const [text, setText] = useState('');
  return (
    <div>
      <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Notes</label>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, margin: '8px 0' }}>
        {(lead.notes || []).length === 0 && <div className="adm-dash" style={{ fontSize: '0.85rem' }}>No notes yet</div>}
        {(lead.notes || []).map((n, i) => (
          <div key={i} style={{ background: 'var(--bg-page)', borderRadius: 8, padding: '8px 12px', fontSize: '0.85rem' }}>
            <div>{n.text}</div>
            <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: 3 }}>{n.by} · {new Date(n.at).toLocaleDateString('en-ZA')}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input value={text} onChange={e => setText(e.target.value)} onKeyDown={e => { if (e.key === 'Enter' && text.trim()) { onAdd(text.trim()); setText(''); } }}
          placeholder="Add a note…" style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.85rem' }} />
        <button className="adm-quick-action" disabled={!text.trim()} onClick={() => { onAdd(text.trim()); setText(''); }}>Add</button>
      </div>
    </div>
  );
}
