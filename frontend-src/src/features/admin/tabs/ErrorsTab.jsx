// ErrorsTab — statement parse failures + frontend/backend error log.
// Standardized (Phase C): self-fetches via React Query, shared AdminTable + EmptyState
// + loading skeleton. The error log is grouped into plain-language categories so a
// non-technical operator can tell at a glance what's cosmetic vs what needs a developer.
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import AdminTable from '../components/AdminTable.jsx';
import EmptyState from '../components/EmptyState.jsx';
import { useAdminErrors, useAdminStatementFailures } from '../hooks/useAdminQueries.js';
import Button from '@bondly/ui/components/Button.jsx';
import Card, { CardBody } from '@bondly/ui/components/Card.jsx';
import { fmtDate } from '@bondly/ui/lib/format.js';

// Map a raw technical error message to a plain-language category so the operator
// sees "12 page-redraw glitches (cosmetic)" instead of 12 raw React stack traces.
// severity: 'cosmetic' = self-recovers/harmless · 'attention' = a developer should look.
const ERROR_CATEGORIES = [
  { test: /removeChild|NotFoundError|insertBefore/i, key: 'redraw',  title: 'Page redraw glitch',       severity: 'cosmetic',  plain: 'A brief visual glitch while a page updated. The page recovers on its own — nothing for customers to do.' },
  { test: /Not allowed by CORS/i,                    key: 'cors',    title: 'Blocked outside request',   severity: 'cosmetic',  plain: 'A request came from an unrecognised website and was safely blocked. Usually harmless background noise.' },
  { test: /must be used within|Provider/i,           key: 'order',   title: 'Page loaded out of order',  severity: 'cosmetic',  plain: 'A page briefly loaded before everything was ready. Clears on refresh.' },
  { test: /is not defined|undefined \(reading|Cannot read prop/i, key: 'code', title: 'Site code error',  severity: 'attention', plain: 'Part of the site referenced something that was missing. A developer should take a look.' },
  { test: /API 500|does not exist|column .* does not|ECONNREFUSED|timeout/i, key: 'server', title: 'Server / database error', severity: 'attention', plain: 'The server hit a problem (often the database). A developer should investigate.' },
];
function classifyError(message = '') {
  return ERROR_CATEGORIES.find(c => c.test.test(message)) ||
    { key: 'other', title: 'Other error', severity: 'attention', plain: 'An uncategorised error — worth a developer glance.' };
}

const SEVERITY_STYLE = {
  cosmetic:  { label: 'Cosmetic',      color: '#16a34a', bg: '#16a34a18' },
  attention: { label: 'Needs a look',  color: '#ef4444', bg: '#ef444418' },
};

function ErrorGroup({ cat, items }) {
  const [open, setOpen] = useState(false);
  const sev = SEVERITY_STYLE[cat.severity];
  const latest = items.reduce((a, b) => (new Date(b.logged_at) > new Date(a.logged_at) ? b : a), items[0]);
  return (
    <Card>
      <CardBody>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ minWidth: 34, height: 34, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', borderRadius: 8, background: sev.bg, color: sev.color, fontWeight: 800, fontSize: '0.9rem' }}>{items.length}</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 600 }}>{cat.title}</div>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{cat.plain}</div>
          </div>
          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 9px', borderRadius: 99, background: sev.bg, color: sev.color, whiteSpace: 'nowrap' }}>{sev.label}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>last {fmtDate(latest.logged_at)}</span>
        </div>
        <button onClick={() => setOpen(o => !o)} style={{ marginTop: 10, fontSize: '0.75rem', color: 'var(--text-secondary)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}>
          {open ? '▾ Hide technical details' : `▸ Technical details (${items.length})`}
        </button>
        {open && (
          <div style={{ marginTop: 8, display: 'flex', flexDirection: 'column', gap: 8 }}>
            {items.map(e => (
              <div key={e.id} style={{ borderTop: '1px solid var(--border-color)', paddingTop: 8 }}>
                <div style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{e.message}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{fmtDate(e.logged_at)} · {e.url}</div>
                {e.stack && <pre style={{ marginTop: 6, fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', background: 'var(--bg-page)', padding: 8, borderRadius: 4 }}>{e.stack.slice(0, 400)}</pre>}
              </div>
            ))}
          </div>
        )}
      </CardBody>
    </Card>
  );
}

function SkeletonRows({ rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="adm-skeleton" style={{ height: 64, borderRadius: 'var(--border-radius)', background: 'var(--bg-card)' }} />
      ))}
    </div>
  );
}

export default function ErrorsTab({ showToast }) {
  const qc = useQueryClient();
  const { data: errors = [], isLoading: errLoading } = useAdminErrors();
  const { data: stmtFailures = [], isLoading: sfLoading } = useAdminStatementFailures();

  const stmtColumns = [
    { key: 'userName', label: 'Applicant', render: (f) => f.userName || 'Anonymous' },
    { key: 'bank',     label: 'Bank',      render: (f) => (f.bank ? f.bank.toUpperCase() : '—') },
    { key: 'fileName', label: 'File' },
    { key: 'error',    label: 'Error',     render: (f) => <span style={{ color: '#ef4444' }}>{f.error || 'unknown error'}</span> },
    { key: 'at',       label: 'When',      render: (f) => fmtDate(f.at) },
  ];

  async function clearErrors() {
    try {
      await fetch('/api/admin/errors', { method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('bondly_token') } });
      qc.setQueryData(['admin', 'errors'], []);
      showToast?.('Error log cleared', 'success');
    } catch {
      showToast?.('Failed to clear', 'error');
    }
  }

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>

      {/* Statement parse failures */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-serif)', marginBottom: 16 }}>
          Statement Parse Failures ({stmtFailures.length})
        </h2>
        {sfLoading ? (
          <SkeletonRows rows={3} />
        ) : stmtFailures.length === 0 ? (
          <EmptyState title="No parse failures" sub="All statements are processing cleanly." />
        ) : (
          <AdminTable
            rows={stmtFailures}
            columns={stmtColumns}
            getRowKey={(f) => f.id}
            searchKeys={['userName', 'bank', 'fileName', 'error']}
            onRowClick={(f) => f.userId && window.open(`/admin?tab=customers&user=${f.userId}`, '_self')}
            emptyState="No parse failures."
          />
        )}
      </div>

      {/* Frontend/backend error log */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)' }}>Error Log ({errors.length})</h2>
          {errors.length > 0 && (
            <Button variant="ghost" size="sm" onClick={clearErrors}>Clear all</Button>
          )}
        </div>
        {errLoading ? (
          <SkeletonRows rows={3} />
        ) : errors.length === 0 ? (
          <EmptyState title="No errors logged" sub="Nothing has thrown recently — great." />
        ) : (() => {
          // Group errors into plain-language categories, ordered by severity then count.
          const groups = new Map();
          errors.forEach(e => {
            const cat = classifyError(e.message);
            if (!groups.has(cat.key)) groups.set(cat.key, { cat, items: [] });
            groups.get(cat.key).items.push(e);
          });
          const ordered = [...groups.values()].sort((a, b) =>
            (a.cat.severity === b.cat.severity ? b.items.length - a.items.length : a.cat.severity === 'attention' ? -1 : 1)
          );
          const needsLook = ordered.filter(g => g.cat.severity === 'attention').reduce((s, g) => s + g.items.length, 0);
          return (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              <div style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
                {errors.length} events in {ordered.length} {ordered.length === 1 ? 'category' : 'categories'}.{' '}
                {needsLook === 0
                  ? 'All cosmetic — nothing needs a developer right now.'
                  : `${needsLook} ${needsLook === 1 ? 'event' : 'events'} marked “needs a look”.`}
              </div>
              {ordered.map(g => <ErrorGroup key={g.cat.key} cat={g.cat} items={g.items} />)}
            </div>
          );
        })()}
      </div>

    </div>
  );
}
