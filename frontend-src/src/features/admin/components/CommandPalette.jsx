import { useEffect, useMemo, useRef, useState } from 'react';

/**
 * Command palette — Cmd+K (or Ctrl+K). Fuzzy search across every record
 * type the admin cares about (customers, leads, applications, brokers) plus
 * every tab the sidebar exposes plus a handful of actions ("toggle test
 * users", "go to overdue applications", etc.).
 *
 * Designed to feel like Linear / Raycast / GitHub: instant, keyboard-first,
 * dismiss with Escape. Always available regardless of which tab is active.
 *
 * Props:
 *   users          — array of registered users (already loaded by Admin.jsx)
 *   leads          — array of leads
 *   slaApps        — flat array of customerApplications (overdue + dueSoon + etc.)
 *   navItems       — array of { id, label, group } produced from buildNav()
 *   onNavigate(id) — switch tabs
 *   onPickCustomer(userId) — open a customer profile
 *   onPickLead(leadId)     — open a lead drawer
 *   actions        — array of { id, label, run } extra commands (e.g. toggle test mode)
 */
export default function CommandPalette({
  users     = [],
  leads     = [],
  slaApps   = [],
  navItems  = [],
  onNavigate,
  onPickCustomer,
  onPickLead,
  actions   = [],
}) {
  const [open,    setOpen]    = useState(false);
  const [query,   setQuery]   = useState('');
  const [cursor,  setCursor]  = useState(0);
  const inputRef              = useRef(null);

  // Global hotkey
  useEffect(() => {
    function onKey(e) {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen(o => !o);
        setQuery('');
        setCursor(0);
        return;
      }
      if (e.key === '?' && !open && !/(INPUT|TEXTAREA|SELECT)/.test(e.target.tagName || '')) {
        e.preventDefault();
        setOpen(true);
        setQuery('?');
        setCursor(0);
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus(), 30);
  }, [open]);

  // Build the master command list each render — cheap, < 1ms for the scales
  // we operate at (tens of leads, hundreds of users).
  const allCommands = useMemo(() => {
    const list = [];
    for (const n of navItems) {
      list.push({ id: 'nav:' + n.id, kind: 'tab', label: 'Go to ' + n.label, sub: n.group, run: () => onNavigate?.(n.id) });
    }
    for (const a of actions) {
      list.push({ id: 'action:' + a.id, kind: 'action', label: a.label, sub: 'Action', run: a.run });
    }
    for (const u of users.slice(0, 500)) {
      list.push({
        id: 'user:' + u.id, kind: 'customer',
        label: u.name || u.email || u.id,
        sub: u.email || u.phone || 'Customer',
        run: () => onPickCustomer?.(u.id),
      });
    }
    for (const l of leads.slice(0, 500)) {
      list.push({
        id: 'lead:' + l.id, kind: 'lead',
        label: l.name || l.email || 'Lead',
        sub: (l.email || l.phone || '') + ' · Lead',
        run: () => onPickLead?.(l.id),
      });
    }
    for (const a of slaApps.slice(0, 200)) {
      list.push({
        id: 'app:' + a.id, kind: 'application',
        label: (a.applicantName || a.userId) + ' · ' + (a.type === 'swap' ? 'Switch' : 'Origination'),
        sub: 'Application · ' + (a.status || 'submitted'),
        run: () => onNavigate?.('pipeline'),
      });
    }
    return list;
  }, [navItems, actions, users, leads, slaApps, onNavigate, onPickCustomer, onPickLead]);

  // Cheap fuzzy ranker. Lowercase substring with bonus for word-start hits.
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || q === '?') {
      // No query: surface a curated "what can I do?" intro
      const tabs = allCommands.filter(c => c.kind === 'tab').slice(0, 12);
      const acts = allCommands.filter(c => c.kind === 'action').slice(0, 6);
      return [...acts, ...tabs];
    }
    const scored = [];
    for (const c of allCommands) {
      const hay = (c.label + ' ' + (c.sub || '')).toLowerCase();
      const ix  = hay.indexOf(q);
      if (ix < 0) continue;
      // word-start bonus
      const wordBonus = ix === 0 || hay[ix - 1] === ' ' ? 5 : 0;
      // kind tie-breaker: tabs > customers > leads > apps > actions
      const kindWeight = { tab: 4, action: 3, customer: 2, lead: 1, application: 0 }[c.kind] || 0;
      scored.push({ c, score: 100 - ix + wordBonus + kindWeight });
    }
    scored.sort((a, b) => b.score - a.score);
    return scored.slice(0, 30).map(s => s.c);
  }, [query, allCommands]);

  function step(delta) {
    setCursor(i => Math.max(0, Math.min(matches.length - 1, i + delta)));
  }
  function pick(idx) {
    const c = matches[idx];
    if (!c) return;
    c.run?.();
    setOpen(false);
  }

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => { setOpen(true); setQuery(''); setCursor(0); }}
        className="adm-cmd-launcher"
        aria-label="Open command palette (Cmd+K)"
        title="Press Cmd+K"
      >
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>
          Search or jump to…
        </span>
        <kbd className="adm-cmd-launcher__kbd">⌘K</kbd>
      </button>
    );
  }

  return (
    <div
      className="adm-cmd-overlay"
      onClick={e => { if (e.target === e.currentTarget) setOpen(false); }}
    >
      <div className="adm-cmd-panel" role="dialog" aria-modal="true">
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setCursor(0); }}
          onKeyDown={e => {
            if (e.key === 'Escape')      { setOpen(false); }
            if (e.key === 'ArrowDown')   { e.preventDefault(); step( 1); }
            if (e.key === 'ArrowUp')     { e.preventDefault(); step(-1); }
            if (e.key === 'Enter')       { e.preventDefault(); pick(cursor); }
          }}
          className="adm-cmd-input"
          placeholder="Search customers, leads, applications, tabs…"
          aria-label="Command palette search"
        />
        <ul className="adm-cmd-list">
          {matches.length === 0 ? (
            <li className="adm-cmd-empty">No matches. Try a customer name, email, or tab name.</li>
          ) : matches.map((c, i) => (
            <li
              key={c.id}
              className={'adm-cmd-item ' + (i === cursor ? 'is-active' : '')}
              onMouseEnter={() => setCursor(i)}
              onClick={() => pick(i)}
            >
              <span className={'adm-cmd-kind adm-cmd-kind--' + c.kind}>{c.kind}</span>
              <span className="adm-cmd-label">
                <span>{c.label}</span>
                {c.sub && <span className="adm-cmd-sub">{c.sub}</span>}
              </span>
            </li>
          ))}
        </ul>
        <div className="adm-cmd-foot">
          <span>↑↓ navigate</span>
          <span>↵ open</span>
          <span>Esc close</span>
          <span style={{ marginLeft: 'auto' }}>⌘K toggle</span>
        </div>
      </div>
    </div>
  );
}
