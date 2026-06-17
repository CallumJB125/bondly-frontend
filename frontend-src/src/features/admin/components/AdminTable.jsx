import { useMemo, useState } from 'react';
import EmptyState from './EmptyState.jsx';

/**
 * AdminTable — a single shared component for every list view in the admin
 * panel. Replaces a dozen bespoke flex/grid lists that drift apart over time.
 *
 * Capabilities (all opt-in via props so existing tabs can adopt incrementally):
 *
 *   - search        sticky toolbar with a debounced search box across `searchKeys`
 *   - filters       array of { key, label, options:[{value,label}] } toggle chips
 *   - sortable      per-column sortable: true, click header to cycle asc/desc
 *   - sticky        sticky header (always on; we already added the global CSS rule)
 *   - selectable    leading checkbox column + bulk-action bar appearing when N>0
 *   - bulkActions   array of { label, onClick: (rows) => any } shown when selected
 *   - emptyState    message OR ReactNode to render when no rows match
 *   - getRowKey     fn(row) → string. Defaults to row.id
 *   - onRowClick    fn(row) — entire row becomes clickable when present
 *   - csvExport     bool — adds "⬇ CSV" button to toolbar
 *   - notice        ReactNode — pinned banner above the table (uses .adm-notice)
 *   - dense         compresses row padding
 *
 * Columns shape:
 *   { key, label, render?(row)→ReactNode, sortable?, align?, width?, sortValue?(row) }
 */
export default function AdminTable({
  rows,
  columns,
  searchKeys     = [],
  filters        = [],
  selectable     = false,
  bulkActions    = [],
  getRowKey      = (r) => r.id,
  onRowClick,
  csvExport      = false,
  csvFilename    = 'export.csv',
  emptyState     = 'No records yet.',
  notice,
  dense          = false,
  defaultSort,   // { key, dir: 'asc'|'desc' }
  toolbarExtra,  // ReactNode rendered to the right of search box (e.g. an "Add" button)
  savedViewKey,  // localStorage namespace — when set, saved views are enabled
}) {
  const [search, setSearch] = useState('');
  const [active, setActive] = useState({}); // { filterKey: value }
  const [sort,   setSort]   = useState(defaultSort || null);
  const [picked, setPicked] = useState(() => new Set());

  // Saved views (per-key localStorage). A view captures the current
  // search + filter chip + sort tuple under a human name. Lets the admin
  // bookmark queries like "Overdue switches I own" or "FNB customers due
  // soon" without re-typing the filters every morning.
  const VIEW_KEY = savedViewKey ? 'bdl-views:' + savedViewKey : null;
  const [views, setViews] = useState(() => {
    if (!VIEW_KEY) return [];
    try { return JSON.parse(localStorage.getItem(VIEW_KEY) || '[]'); } catch { return []; }
  });
  function persistViews(next) {
    setViews(next);
    if (VIEW_KEY) try { localStorage.setItem(VIEW_KEY, JSON.stringify(next)); } catch {/* quota */}
  }
  function saveCurrentView() {
    const name = window.prompt('Name this view (e.g. "Overdue switches"):', '');
    if (!name) return;
    persistViews([...views.filter(v => v.name !== name), { name, search, active, sort }]);
  }
  function applyView(v) {
    setSearch(v.search || '');
    setActive(v.active || {});
    setSort(v.sort || null);
  }
  function deleteView(name) {
    persistViews(views.filter(v => v.name !== name));
  }

  // Apply search → filters → sort.
  const visible = useMemo(() => {
    let out = rows || [];
    const q = search.trim().toLowerCase();
    if (q && searchKeys.length) {
      out = out.filter(r => searchKeys.some(k => {
        const v = typeof k === 'function' ? k(r) : r?.[k];
        return v != null && String(v).toLowerCase().includes(q);
      }));
    }
    for (const f of filters) {
      const val = active[f.key];
      if (val == null || val === 'all') continue;
      out = out.filter(r => {
        if (typeof f.match === 'function') return f.match(r, val);
        return r?.[f.key] === val;
      });
    }
    if (sort) {
      const col = columns.find(c => c.key === sort.key);
      if (col) {
        const get = col.sortValue || (r => r?.[col.key]);
        const dir = sort.dir === 'desc' ? -1 : 1;
        out = [...out].sort((a, b) => {
          const av = get(a), bv = get(b);
          if (av == null && bv == null) return 0;
          if (av == null) return 1;
          if (bv == null) return -1;
          if (typeof av === 'number' && typeof bv === 'number') return (av - bv) * dir;
          return String(av).localeCompare(String(bv)) * dir;
        });
      }
    }
    return out;
  }, [rows, search, active, filters, sort, columns, searchKeys]);

  const allChecked = selectable && visible.length > 0 && visible.every(r => picked.has(getRowKey(r)));
  function toggleAll() {
    if (allChecked) setPicked(new Set());
    else setPicked(new Set(visible.map(getRowKey)));
  }
  function toggleOne(r) {
    const k = getRowKey(r);
    setPicked(prev => {
      const n = new Set(prev);
      n.has(k) ? n.delete(k) : n.add(k);
      return n;
    });
  }
  const pickedRows = useMemo(
    () => (rows || []).filter(r => picked.has(getRowKey(r))),
    [rows, picked, getRowKey],
  );

  function cycleSort(col) {
    if (!col.sortable) return;
    setSort(prev => {
      if (!prev || prev.key !== col.key) return { key: col.key, dir: 'asc' };
      if (prev.dir === 'asc') return { key: col.key, dir: 'desc' };
      return null;
    });
  }

  function downloadCSV() {
    const headers = columns.map(c => c.label);
    const escape = (v) => {
      const s = v == null ? '' : String(v);
      return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
    };
    const lines = [headers.join(',')];
    for (const r of visible) {
      lines.push(columns.map(c => {
        const raw = c.csvValue ? c.csvValue(r) : (c.sortValue ? c.sortValue(r) : r?.[c.key]);
        return escape(raw);
      }).join(','));
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/csv' });
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href = url; a.download = csvFilename; a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div className="adm-table-wrap">
      {notice && <div className="adm-notice">{notice}</div>}

      {/* Toolbar */}
      <div className="adm-table-toolbar">
        {searchKeys.length > 0 && (
          <input
            type="search"
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="Search…"
            className="adm-table-toolbar__search"
          />
        )}
        {filters.map(f => (
          <select
            key={f.key}
            value={active[f.key] || 'all'}
            onChange={e => setActive(a => ({ ...a, [f.key]: e.target.value }))}
            className="adm-table-toolbar__filter"
            aria-label={f.label}
          >
            <option value="all">{f.label}: all</option>
            {f.options.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        ))}
        {csvExport && (
          <button type="button" onClick={downloadCSV} className="adm-table-toolbar__btn">
            ⬇ CSV
          </button>
        )}
        {VIEW_KEY && (
          <button type="button" onClick={saveCurrentView} className="adm-table-toolbar__btn" title="Save current filters as a named view">
            ☆ Save view
          </button>
        )}
        {toolbarExtra && <div style={{ marginLeft: 'auto' }}>{toolbarExtra}</div>}
      </div>

      {VIEW_KEY && views.length > 0 && (
        <div className="adm-view-chips">
          {views.map(v => (
            <span key={v.name} className="adm-view-chip">
              <button type="button" onClick={() => applyView(v)} className="adm-view-chip__apply">{v.name}</button>
              <button type="button" onClick={() => deleteView(v.name)} className="adm-view-chip__close" aria-label={'Delete ' + v.name}>×</button>
            </span>
          ))}
        </div>
      )}

      {/* Bulk-action bar */}
      {selectable && picked.size > 0 && bulkActions.length > 0 && (
        <div className="adm-bulk-bar">
          <strong>{picked.size}</strong> selected
          <div style={{ marginLeft: 'auto', display: 'flex', gap: 8 }}>
            {bulkActions.map((a, i) => (
              <button
                key={i}
                type="button"
                onClick={() => { a.onClick(pickedRows); setPicked(new Set()); }}
                className="adm-bulk-bar__btn"
              >
                {a.label}
              </button>
            ))}
            <button
              type="button"
              onClick={() => setPicked(new Set())}
              className="adm-bulk-bar__btn adm-bulk-bar__btn--ghost"
            >
              Clear
            </button>
          </div>
        </div>
      )}

      <div className="adm-table-scroll">
        <table className={`data-table ${dense ? 'data-table--dense' : ''}`}>
          <thead>
            <tr>
              {selectable && (
                <th style={{ width: 36 }}>
                  <input type="checkbox" checked={allChecked} onChange={toggleAll} aria-label="Select all" />
                </th>
              )}
              {columns.map(c => {
                const isSort = sort?.key === c.key;
                return (
                  <th
                    key={c.key}
                    style={{
                      width: c.width,
                      textAlign: c.align || 'left',
                      cursor: c.sortable ? 'pointer' : 'default',
                      userSelect: 'none',
                    }}
                    onClick={() => cycleSort(c)}
                  >
                    {c.label}
                    {c.sortable && (
                      <span style={{ marginLeft: 4, opacity: isSort ? 1 : 0.3, fontSize: '0.75em' }}>
                        {isSort ? (sort.dir === 'asc' ? '▲' : '▼') : '↕'}
                      </span>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {visible.length === 0 ? (
              <tr>
                <td colSpan={columns.length + (selectable ? 1 : 0)} style={{ padding: 0 }}>
                  {/* No rows at all → big empty state. Rows exist but filter
                      hid them all → terser hint so the admin knows what's up. */}
                  {(rows || []).length === 0
                    ? <EmptyState
                        small
                        title={typeof emptyState === 'string' ? emptyState : 'Nothing here yet'}
                        sub={typeof emptyState === 'string' ? null : undefined} />
                    : <EmptyState
                        small
                        title="No matches"
                        sub="Adjust the search or filter chips above to see records." />}
                </td>
              </tr>
            ) : visible.map(r => {
              const k = getRowKey(r);
              const sel = picked.has(k);
              return (
                <tr
                  key={k}
                  onClick={onRowClick ? () => onRowClick(r) : undefined}
                  style={{ cursor: onRowClick ? 'pointer' : 'default', background: sel ? 'rgba(74,158,107,0.08)' : 'transparent' }}
                >
                  {selectable && (
                    <td onClick={e => e.stopPropagation()}>
                      <input type="checkbox" checked={sel} onChange={() => toggleOne(r)} aria-label="Select row" />
                    </td>
                  )}
                  {columns.map(c => (
                    <td key={c.key} style={{ textAlign: c.align || 'left' }}>
                      {c.render ? c.render(r) : r?.[c.key]}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
