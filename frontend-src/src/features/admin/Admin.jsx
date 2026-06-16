import { useState, useEffect, useRef, useCallback } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { Zap, Phone, CheckCircle, Handshake, DollarSign, AlertTriangle, Building2, ChevronRight, X, Plus, TrendingDown, TrendingUp, Clock, RefreshCw } from "lucide-react";
import DOMPurify from 'dompurify';
import { useAuth } from '../../context/AuthContext.jsx';
import { admin, bankSubmissions as bsApi } from '../../lib/api.js';
import { adminApi } from '../../lib/api.js';
import BehaviouralAnalyticsTab from './AnalyticsTab.jsx';
import AlertsTab from './tabs/AlertsTab.jsx';
import ClaudeUsageTab from './tabs/ClaudeUsageTab.jsx';
import SettingsTab from './tabs/SettingsTab.jsx';
import BulkEmailTab from './tabs/BulkEmailTab.jsx';
import AuditTab from './tabs/AuditTab.jsx';
import ParserHealthTab from './tabs/ParserHealthTab.jsx';
import FairLendingTab from './tabs/FairLendingTab.jsx';
import ApplicationsTab from './tabs/ApplicationsTab.jsx';
import BondDeskTab from './tabs/BondDeskTab.jsx';
import WatchlistTab from './tabs/WatchlistTab.jsx';
import CommandPalette from './components/CommandPalette.jsx';
import CustomerHealthRing from './components/CustomerHealthRing.jsx';
import MergeCustomerButton from './components/MergeCustomerButton.jsx';
import EditableField from './components/EditableField.jsx';
import ActivityTimeline from './components/ActivityTimeline.jsx';
import useAdminEventStream from './components/useAdminEventStream.js';
import MentionInput, { renderWithMentions } from './components/MentionInput.jsx';
import { useTheme } from '../../context/ThemeContext.jsx';
import { fmt, fmtPct, fmtDate } from '../../lib/format.js';
import { useToast } from '../../components/Toast.jsx';
import Button from '../../components/Button.jsx';
import Card, { CardHeader, CardBody, StatCard } from '../../components/Card.jsx';
import Input, { Select } from '../../components/Input.jsx';
import './Admin.css';

// ─── SVG Icons ────────────────────────────────────────────
const IC = {
  home:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>,
  leads:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  users:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  apps:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  money:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="12" y1="1" x2="12" y2="23"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>,
  kyc:     <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>,
  chat:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
  buyer:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/></svg>,
  pipe:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>,
  chart:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><line x1="18" y1="20" x2="18" y2="10"/><line x1="12" y1="20" x2="12" y2="4"/><line x1="6" y1="20" x2="6" y2="14"/></svg>,
  settings:<svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
  error:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>,
  swap:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><polyline points="17 1 21 5 17 9"/><path d="M3 11V9a4 4 0 0 1 4-4h14"/><polyline points="7 23 3 19 7 15"/><path d="M21 13v2a4 4 0 0 1-4 4H3"/></svg>,
  bell:    <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>,
  audit:   <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8" viewBox="0 0 24 24"><path d="M9 11l3 3L22 4"/><path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11"/></svg>,
};

// ─── Helpers ──────────────────────────────────────────────
function apiFetchAdmin(path) {
  const token = localStorage.getItem('bondly_token');
  return fetch(path, { headers: token ? { Authorization: 'Bearer ' + token } : {} })
    .then(r => {
      if (r.status === 401) { localStorage.removeItem('bondly_token'); window.location.href = '/login?expired=1'; return null; }
      return r.json();
    })
    .then(j => { if (!j) return null; if (!j.success) throw new Error(j.error); return j.data; });
}

function daysAgo(iso) {
  if (!iso) return '—';
  const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
  return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`;
}

const RISK_COLOR = { A: 'var(--color-grade-a)', B: 'var(--color-info)', C: 'var(--color-warning)', D: 'var(--color-error)', E: 'var(--text-secondary)' };
const AVATAR_COLORS = ['#4a7fa5', '#e06c3e', '#7c5cbf', '#2da44e', '#d36a3f', '#c75b9b'];
function avatarColor(name) { return AVATAR_COLORS[(name?.charCodeAt(0) || 0) % AVATAR_COLORS.length]; }

function Lbl({ children, style }) {
  return <div style={{ fontSize: '0.6875rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--text-secondary)', marginBottom: 4, ...style }}>{children}</div>;
}

// ─── Lead CRM constants ────────────────────────────────────
const LEAD_STAGES = [
  { value: 'new',            label: 'New',           color: '#3b82f6', icon: <Zap size={14}/> },
  { value: 'contacted',      label: 'Contacted',     color: '#8b5cf6', icon: <Phone size={14}/> },
  { value: 'qualified',      label: 'Qualified',     color: '#f59e0b', icon: <CheckCircle size={14}/> },
  { value: 'sent_to_broker', label: 'With Broker',   color: '#6366f1', icon: <Handshake size={14}/> },
  { value: 'converted',      label: 'Converted',     color: '#16a34a', icon: <DollarSign size={14}/> },
  { value: 'not_qualified',  label: 'Not Qualified', color: '#9ca3af', icon: '✕' },
];

const SOURCE_LABELS = {
  get_a_quote:      'Get a Quote',
  preapproval_form: 'Pre-Approval',
  manual:           'Manual entry',
  website:          'Website',
  email_inbound:    'Email reply',
  b2b_outreach:     'B2B outreach',
  unknown:          'Unknown',
};

const ASSIGNEES = ["Callum", "Oliver", "Unassigned"];

const EMPTY_LEAD = { name: '', phone: '', email: '', currentBank: '', currentBalance: '', currentRate: '', currentTerm: '20', monthlyIncome: '', employment: 'Permanent employee', contactMethod: 'Phone call', source: 'manual', referredBy: '' };

const B2B_STAGES = [
  { value: 'new',            label: 'New',           color: '#3b82f6', icon: <Zap size={14}/> },
  { value: 'contacted',      label: 'Contacted',     color: '#8b5cf6', icon: <Phone size={14}/> },
  { value: 'meeting_booked', label: 'Meeting',       color: '#f59e0b', icon: '📅' },
  { value: 'proposal_sent',  label: 'Proposal',      color: '#6366f1', icon: '📄' },
  { value: 'won',            label: 'Won',           color: '#16a34a', icon: <DollarSign size={14}/> },
  { value: 'lost',           label: 'Lost',          color: '#9ca3af', icon: '✕' },
];

const B2B_EMPTY_LEAD = { name: '', company: '', email: '', phone: '', dealValue: '', notes: '', source: 'b2b_outreach', leadType: 'b2b' };

function isB2bLead(l) { return l.leadType === 'b2b' || l.source === 'email_inbound' || l.source === 'b2b_outreach'; }

function exportCSV(leads) {
  const cols = ['name','phone','email','source','status','currentBank','currentBalance','currentRate','currentTerm','monthlyIncome','employment','contactMethod','assignedTo','brokerNotes','createdAt'];
  const rows = [cols.join(','), ...leads.map(l => cols.map(c => JSON.stringify(l[c] ?? '')).join(','))];
  const blob = new Blob([rows.join('\n')], { type: 'text/csv' });
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = `bondly-leads-${new Date().toISOString().slice(0,10)}.csv`; a.click();
}

// ─── Sidebar ──────────────────────────────────────────────
// Five groups, most-used at the top. Daily is what you live in every morning;
// Pipeline is the entire "submitted → bank → registered" path; Revenue is
// what you check before invoicing; Intelligence answers "is the platform
// healthy"; System is super-admin power tools.
function buildNav(isSuperAdmin) {
  return [
    {
      label: 'Daily',
      items: [
        { id: 'home',         label: 'Dashboard',  icon: IC.home  },
        { id: 'leads',        label: 'Leads',      icon: IC.leads },
        { id: 'customers',    label: 'Customers',  icon: IC.users },
        { id: 'chat',         label: 'Inbox',      icon: IC.chat  },
      ],
    },
    {
      label: 'Pipeline',
      items: [
        { id: 'pipeline',    label: 'Broker Queue', icon: IC.pipe },
        { id: 'submissions', label: 'Submissions',  icon: IC.swap },
        { id: 'applications', label: 'Switch Apps', icon: IC.swap },
        { id: 'bond-desk',   label: 'Bond Desk',    icon: IC.users },
        { id: 'kyc',         label: 'KYC',          icon: IC.kyc  },
      ],
    },
    {
      label: 'Revenue',
      items: [
        { id: 'commissions', label: 'Commissions', icon: IC.money },
        { id: 'watchlist',   label: 'Watchlist',   icon: IC.bell  },
      ],
    },
    {
      label: 'Intelligence',
      items: [
        { id: 'analytics',     label: 'Analytics',     icon: IC.chart },
        { id: 'statements',    label: 'Statements',    icon: IC.apps  },
        { id: 'parser-health', label: 'Parser Health', icon: IC.chart },
        { id: 'ai-audit',      label: 'AI Audit',      icon: IC.chart },
        { id: 'sessions',      label: 'Sessions',      icon: IC.chart },
        { id: 'feedback',      label: 'Feedback',      icon: IC.bell  },
        { id: 'fair-lending',  label: 'Fair Lending',  icon: IC.audit },
      ],
    },
    {
      label: 'System',
      items: [
        ...(isSuperAdmin ? [
          { id: 'bulk-email', label: 'Bulk Email', icon: IC.bell  },
          { id: 'staff',      label: 'Staff',      icon: IC.users },
        ] : []),
        { id: 'audit-log',    label: 'Audit Log',  icon: IC.audit },
        { id: 'errors',       label: 'Errors',     icon: IC.error },
        { id: 'claude-usage', label: 'AI Usage',   icon: IC.chart },
        { id: 'diary',        label: 'Diary',      icon: IC.audit },
        { id: 'settings',     label: 'Settings',   icon: IC.settings },
      ],
    },
  ];
}

const TAB_TITLES = {
  home:         ['Dashboard', 'Today\'s overview'],
  leads:        ['Leads', 'CRM — manage your pipeline'],
  'bond-desk':  ['Bond Desk', 'Customer file management'],
  customers:    ['Customers', 'All registered users'],
  applications: ['Switch Apps', 'Bond switch application tracker'],
  commissions:  ['Commissions', 'Revenue tracking'],
  alerts:       ['Watchlist', 'Users watching for their rate or savings target'],
  watchlist:    ['Watchlist', 'Everyone waiting on a rate, savings, or buying target'],
  kyc:          ['KYC', 'Identity verification review'],
  chat:         ['Inbox', 'Customer support messages'],
  buyers:       ['Buyers', 'Savings-target watchers'],
  pipeline:     ['Pipeline', 'Applicant profiles for broker submission'],
  submissions:  ['Bank Submissions', 'Multi-bank negotiation engine'],
  analytics:    ['Analytics', 'Conversion, growth, revenue'],
  'bulk-email': ['Bulk Email', 'Send campaigns to customer segments'],
  staff:        ['Staff', 'Manage admin team access'],
  errors:       ['Errors', 'Server-side error tracking'],
  settings:     ['Settings', 'Platform configuration'],
  'claude-usage': ['AI Usage', 'Claude API token spend and breakdown'],
  statements:     ['Statements', 'Uploaded bank statements — view and download'],
  sessions:       ['Sessions', 'User sessions — drop-off, errors, time spent per page'],
  feedback:       ['Feedback', 'Thumbs ratings and problem reports from users'],
  'audit-log':    ['Audit Log', 'Immutable record of admin actions'],
  diary:          ['Daily Diary', 'End-of-day log — errors, improvements, git commits'],
  'ai-audit':     ['AI Audit', 'Parser accuracy, hallucination detection, regression'],
  'parser-health': ['Parser Health', 'Live parse outcomes — extraction method, AI usage, errors, latency'],
  'fair-lending':  ['Fair Lending', 'Disparate-impact screen across province and income band (four-fifths rule)'],
};

function AdminSidebar({ tab, setTab, badges, dangerBadges, user, deployInfo }) {
  const nav = buildNav(user?.superAdmin);
  return (
    <aside className="admin-sidebar">
      <div className="admin-sidebar__brand">
        <span className="admin-sidebar__logo">Bondly</span>
        <span className="admin-sidebar__pill">Admin</span>
      </div>

      <nav className="admin-sidebar__nav">
        {nav.map((group, gi) => (
          <div key={gi}>
            {group.label && <div className="admin-sidebar__section">{group.label}</div>}
            {group.items.map(item => (
              <button
                key={item.id}
                className={`admin-nav-item ${tab === item.id ? 'active' : ''}`}
                onClick={() => setTab(item.id)}
              >
                {item.icon}
                {item.label}
                {badges[item.id] > 0 && (() => {
                  // Danger badge takes precedence — SLA breach, escalated
                  // chat, or live server error means this tab needs attention
                  // RIGHT NOW. Otherwise fall back to the existing per-tab
                  // colour conventions.
                  const isDanger = dangerBadges?.has?.(item.id);
                  const cls = isDanger
                    ? 'admin-nav-badge admin-nav-badge--danger'
                    : item.id === 'buyers'
                      ? 'admin-nav-badge admin-nav-badge--lime'
                      : (item.id === 'kyc' || item.id === 'pipeline')
                        ? 'admin-nav-badge admin-nav-badge--orange'
                        : 'admin-nav-badge';
                  return <span className={cls}>{badges[item.id]}</span>;
                })()}
              </button>
            ))}
          </div>
        ))}
      </nav>

      <div className="admin-sidebar__footer">
        <div className="admin-sidebar__user">
          <div className="admin-sidebar__avatar">{user?.name?.[0]?.toUpperCase() || 'A'}</div>
          <div>
            <div className="admin-sidebar__user-name">{user?.name || 'Admin'}</div>
            <div className="admin-sidebar__user-role">{user?.superAdmin ? 'Super Admin' : 'Administrator'}</div>
          </div>
        </div>
        <Link to="/dashboard" className="admin-sidebar__back">
          <svg width="14" height="14" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
          Back to app
        </Link>
        {deployInfo && (
          <div className="admin-sidebar__version" title={deployInfo.message}>
            <span className="admin-sidebar__version-dot" />
            <span>{deployInfo.short} · {deployInfo.deployedAt ? new Date(deployInfo.deployedAt).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short' }) : 'live'}</span>
          </div>
        )}
      </div>
    </aside>
  );
}

// ─── Skeleton loader ──────────────────────────────────────
function SkeletonList({ rows = 6 }) {
  return (
    <div style={{ padding: '16px 0' }}>
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid var(--border-color)', opacity: 1 - i * 0.12 }}>
          <div className="skeleton" style={{ width: 36, height: 36, borderRadius: 8, flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <div className="skeleton" style={{ height: 13, width: `${55 + (i % 3) * 15}%`, borderRadius: 4, marginBottom: 6 }} />
            <div className="skeleton" style={{ height: 11, width: `${35 + (i % 4) * 10}%`, borderRadius: 4 }} />
          </div>
          <div className="skeleton" style={{ width: 52, height: 22, borderRadius: 10 }} />
        </div>
      ))}
    </div>
  );
}

// ─── Global search ────────────────────────────────────────
function GlobalSearch({ leads, onJumpCustomer, onJumpLead, onClose }) {
  const [query, setQuery]     = useState('');
  const [custResults, setCust] = useState([]);
  const [searching, setSearching] = useState(false);
  const inputRef = useRef(null);

  useEffect(() => { inputRef.current?.focus(); }, []);

  // Filter leads client-side
  const leadResults = query.length >= 2
    ? leads.filter(l => {
        const q = query.toLowerCase();
        return (l.name||'').toLowerCase().includes(q) || (l.email||'').toLowerCase().includes(q) || (l.phone||'').toLowerCase().includes(q);
      }).slice(0, 5)
    : [];

  // Debounced customer search
  useEffect(() => {
    if (query.length < 2) { setCust([]); return; }
    setSearching(true);
    const t = setTimeout(() => {
      admin.users({ search: query, limit: 5, hideTest: false })
        .then(d => setCust(d?.customers?.slice(0, 5) || []))
        .catch(() => setCust([]))
        .finally(() => setSearching(false));
    }, 280);
    return () => clearTimeout(t);
  }, [query]);

  const hasResults = leadResults.length > 0 || custResults.length > 0;

  return (
    <div className="gs-backdrop" onClick={onClose}>
      <div className="gs-modal" onClick={e => e.stopPropagation()}>
        <div className="gs-input-wrap">
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" style={{ color: 'var(--text-secondary)', flexShrink: 0 }}><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input
            ref={inputRef}
            className="gs-input"
            placeholder="Search customers, leads, email, phone…"
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === 'Escape' && onClose()}
            autoComplete="off"
          />
          {searching && <div className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} />}
        </div>

        {query.length >= 2 && (
          <div className="gs-results">
            {leadResults.length > 0 && (
              <>
                <div className="gs-results__section">Leads</div>
                {leadResults.map(l => (
                  <button key={l.id} className="gs-result-row" onClick={() => { onJumpLead?.(l.id); onClose(); }}>
                    <div className="gs-result-avatar" style={{ background: '#3b82f620', color: '#3b82f6' }}>L</div>
                    <div className="gs-result-info">
                      <div className="gs-result-name">{l.name || 'Unnamed'}</div>
                      <div className="gs-result-meta">{l.phone || l.email || '—'} · {l.status?.replace(/_/g,' ')}</div>
                    </div>
                    <span className="gs-result-type gs-result-type--lead">Lead</span>
                  </button>
                ))}
              </>
            )}
            {custResults.length > 0 && (
              <>
                <div className="gs-results__section">Customers</div>
                {custResults.map(u => (
                  <button key={u.id} className="gs-result-row" onClick={() => { onJumpCustomer(u.id); onClose(); }}>
                    <div className="gs-result-avatar" style={{ background: avatarColor(u.name) + '30', color: avatarColor(u.name) }}>{u.name?.[0]?.toUpperCase()||'?'}</div>
                    <div className="gs-result-info">
                      <div className="gs-result-name">{u.name}</div>
                      <div className="gs-result-meta">{u.email}</div>
                    </div>
                    <span className="gs-result-type">Customer</span>
                  </button>
                ))}
              </>
            )}
            {!hasResults && !searching && (
              <div className="gs-no-results">No results for "{query}"</div>
            )}
          </div>
        )}
        {query.length < 2 && (
          <div className="gs-hint">Type at least 2 characters to search</div>
        )}
      </div>
    </div>
  );
}

// ─── Main Admin component ──────────────────────────────────
// ─── Statements Tab ───────────────────────────────────────
function SessionsTab({ sessions }) {
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

      {filtered.length === 0 && (
        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '2rem', marginBottom: 12 }}>📈</div>
          <div style={{ fontWeight: 600 }}>No sessions recorded yet</div>
          <div style={{ fontSize: '0.875rem', marginTop: 4 }}>Sessions are recorded as users browse the site.</div>
        </div>
      )}
    </div>
  );
}

function StatementsTab({ statements, showToast }) {
  const token = localStorage.getItem('bondly_token');
  const [inspecting, setInspecting] = useState(null); // statement record being inspected

  function download(stmt) {
    fetch('/api/admin/statements/' + stmt.id + '/download', { headers: { Authorization: 'Bearer ' + token } })
      .then(r => { if (!r.ok) throw new Error(); return r.blob(); })
      .then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = stmt.filename; a.click(); })
      .catch(() => showToast('Download failed', 'error'));
  }

  function fmtSize(bytes) {
    if (!bytes) return '—';
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(0) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  }

  const SOURCE_COLORS = { qualify: ['#3b82f620','#3b82f6'], onboarding: ['#10b98120','#10b981'], preapproval: ['#f59e0b20','#f59e0b'] };

  if (!statements.length) return (
    <div style={{ padding: '48px 24px', textAlign: 'center', color: 'var(--text-secondary)' }}>
      <div style={{ fontSize: '2rem', marginBottom: 12 }}>📂</div>
      <div style={{ fontWeight: 600, marginBottom: 6 }}>No statements yet</div>
      <div style={{ fontSize: '0.875rem' }}>Uploaded bank statements will appear here once users submit them.</div>
    </div>
  );

  return (
    <div style={{ padding: '0 0 40px' }}>
      {inspecting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.55)', zIndex: 9500, display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '24px 16px', overflowY: 'auto' }}
          onClick={e => { if (e.target === e.currentTarget) setInspecting(null); }}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, width: '100%', maxWidth: 900, padding: 24, position: 'relative' }}>
            <button onClick={() => setInspecting(null)} style={{ position: 'absolute', top: 16, right: 16, background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>✕</button>
            <h3 style={{ margin: '0 0 4px', fontWeight: 700 }}>{inspecting.filename}</h3>
            <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 16 }}>
              {inspecting.userName || 'Anonymous'} · {inspecting.source} · {inspecting.bankFormat || 'unknown format'} · {inspecting.transactionCount || 0} transactions
            </div>
            <div style={{ display: 'flex', gap: 16, marginBottom: 16, flexWrap: 'wrap' }}>
              {[
                ['Income detected', inspecting.incomeDetected ? `R ${(inspecting.incomeMonthly||0).toLocaleString('en-ZA')} / mo` : 'Not detected', inspecting.incomeDetected ? '#10b981' : '#ef4444'],
                ['Confidence', inspecting.incomeConfidence || '—', '#6366f1'],
                ['Transactions', `${inspecting.creditCount||0} credits · ${inspecting.debitCount||0} debits`, 'var(--text-secondary)'],
                ['Max bond', inspecting.maxBond ? `R ${Math.round(inspecting.maxBond).toLocaleString('en-ZA')}` : '—', 'var(--text-primary)'],
              ].map(([label, val, color]) => (
                <div key={label} style={{ background: 'var(--bg-page)', borderRadius: 8, padding: '10px 14px', minWidth: 160 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontWeight: 700, color }}>{val}</div>
                </div>
              ))}
            </div>
            {inspecting.rawTransactions?.length ? (
              <div style={{ overflowX: 'auto', maxHeight: 480, overflowY: 'auto', borderRadius: 8, border: '1px solid var(--border-color)' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
                  <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-card)', zIndex: 1 }}>
                    <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
                      {['Date','Description','Amount','Type','Category'].map(h => (
                        <th key={h} style={{ padding: '8px 12px', textAlign: 'left', fontWeight: 700, fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {inspecting.rawTransactions.map((t, i) => (
                      <tr key={i} style={{ borderBottom: '1px solid var(--border-color)', background: t.isCredit ? '#10b98108' : 'transparent' }}>
                        <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>{t.date || '—'}</td>
                        <td style={{ padding: '7px 12px', maxWidth: 300 }}><div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={t.description}>{t.description}</div></td>
                        <td style={{ padding: '7px 12px', whiteSpace: 'nowrap', fontWeight: 600, color: t.isCredit ? '#10b981' : 'var(--text-primary)', textAlign: 'right' }}>R {(t.amount||0).toLocaleString('en-ZA',{minimumFractionDigits:2,maximumFractionDigits:2})}</td>
                        <td style={{ padding: '7px 12px', whiteSpace: 'nowrap' }}>
                          <span style={{ fontSize: '0.7rem', fontWeight: 700, padding: '2px 6px', borderRadius: 3, background: t.isCredit ? '#10b98120' : '#ef444420', color: t.isCredit ? '#10b981' : '#ef4444' }}>{t.isCredit ? 'CR' : 'DR'}</span>
                        </td>
                        <td style={{ padding: '7px 12px', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{t.category || '—'}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>No raw transactions stored for this statement.</div>
            )}
          </div>
        </div>
      )}
      <div style={{ marginBottom: 16, fontSize: '0.875rem', color: 'var(--text-secondary)' }}>
        {statements.length} statement{statements.length !== 1 ? 's' : ''} stored
      </div>
      <div style={{ overflowX: 'auto' }}>
        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.875rem' }}>
          <thead>
            <tr style={{ borderBottom: '2px solid var(--border-color)' }}>
              {['Date', 'User', 'File', 'Source', 'Format', 'Txns', 'Income', ''].map((h, i) => (
                <th key={i} style={{ textAlign: 'left', padding: '8px 12px', fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statements.map(s => {
              const [bg, fg] = SOURCE_COLORS[s.source] || ['#6366f120', '#6366f1'];
              return (
                <tr key={s.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>
                    {s.uploadedAt ? new Date(s.uploadedAt).toLocaleString('en-ZA', { dateStyle: 'medium', timeStyle: 'short' }) : '—'}
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    {s.userName
                      ? <div><div style={{ fontWeight: 600 }}>{s.userName}</div><div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.userEmail}</div></div>
                      : <span style={{ color: 'var(--text-secondary)' }}>Anonymous</span>}
                  </td>
                  <td style={{ padding: '10px 12px', maxWidth: 200 }}>
                    <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={s.filename}>{s.filename}</div>
                  </td>
                  <td style={{ padding: '10px 12px' }}>
                    <span style={{ fontSize: '0.75rem', fontWeight: 600, padding: '2px 8px', borderRadius: 4, background: bg, color: fg }}>{s.source || '—'}</span>
                  </td>
                  <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: 'var(--text-secondary)', textTransform: 'uppercase' }}>{s.bankFormat || '—'}</td>
                  <td style={{ padding: '10px 12px', fontSize: '0.8125rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {s.transactionCount != null ? `${s.transactionCount} (${s.creditCount||0}↑ ${s.debitCount||0}↓)` : '—'}
                  </td>
                  <td style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>
                    {s.incomeDetected
                      ? <span style={{ fontWeight: 700, color: '#10b981' }}>R {(s.incomeMonthly||0).toLocaleString('en-ZA')} <span style={{ fontWeight: 400, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{s.incomeConfidence}</span></span>
                      : <span style={{ color: '#ef4444', fontSize: '0.8125rem' }}>Not detected</span>
                    }
                  </td>
                  <td style={{ padding: '10px 12px', textAlign: 'right', whiteSpace: 'nowrap', display: 'flex', gap: 6 }}>
                    <button onClick={() => setInspecting(s)}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                      Inspect
                    </button>
                    <button onClick={() => download(s)}
                      style={{ padding: '5px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.8125rem', fontWeight: 600, cursor: 'pointer' }}>
                      ↓
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}


export default function Admin() {
  const { user } = useAuth();
  const { tab: paramTab } = useParams();
  const navigate = useNavigate();
  const tab = paramTab || localStorage.getItem('bondly_admin_tab') || 'home';

  function setTab(t) {
    localStorage.setItem('bondly_admin_tab', t);
    navigate('/admin/' + t);
  }

  const [stats, setStats]         = useState(null);
  const [submissions, setSubmissions] = useState([]);
  const [c360Id, setC360Id]           = useState(null);
  const [users, setUsers]         = useState([]);
  const [leads, setLeads]         = useState([]);
  const [swapApps, setSwapApps]   = useState([]);
  const [errors, setErrors]       = useState([]);
  const [stmtFailures, setStmtFailures] = useState([]);
  const [pipeline, setPipeline]   = useState([]);
  const [slaStatus, setSlaStatus] = useState({ overdue: [], dueSoon: [], onTrack: [], contacted: [] });
  const [kycQueue, setKycQueue]   = useState([]);
  const [chats, setChats]         = useState([]);
  const [buyerIntents, setBuyers] = useState([]);
  const [commissionData, setComms] = useState({ commissions: [], totals: {} });
  const [alertsData, setAlertsData] = useState({ rateAlerts: [], savingsAlerts: [], primeRate: 11.25 });
  const [loading, setLoading]     = useState(true);
  const [primeInput, setPrimeInput] = useState('');
  const [kycReason, setKycReason] = useState({});
  const [chatReply, setChatReply] = useState({});
  const [hideTest, setHideTest]   = useState(() => localStorage.getItem('bondly_hide_test') !== 'false');
  const [jumpCustomerId, setJumpCustomerId] = useState(null);
  const [jumpLeadId, setJumpLeadId] = useState(null);
  const [searchOpen, setSearchOpen] = useState(false);
  const [statements, setStatements] = useState([]);
  const [sessions,   setSessions]   = useState([]);
  const [feedbackData, setFeedbackData] = useState({ feedback: [], reports: [] });
  const [auditLog, setAuditLog] = useState({ entries: [], total: 0, page: 1, pages: 1 });
  const [deployInfo, setDeployInfo] = useState(null);
  const showToast = useToast();
  const { theme, toggleTheme } = useTheme();

  // Live event stream — SLA breaches, broker rotations, etc. show as toasts
  // and trigger a fresh SLA fetch so the home priority queue updates without
  // waiting for the next page refresh.
  useAdminEventStream((type, data) => {
    if (type === 'sla_breach') {
      showToast?.(`⏰ SLA breached — ${data.applicantName} (${data.type})`, 'error');
    } else if (type === 'sla_due_soon') {
      showToast?.(`⌛ SLA due soon — ${data.applicantName}`, 'warning');
    } else if (type === 'broker_rotate') {
      showToast?.(`🔄 Broker rotated → ${data.toName}`, 'info');
    }
    if (type === 'sla_breach' || type === 'sla_due_soon' || type === 'broker_rotate') {
      // Refresh SLA buckets so badges/home update live.
      fetch('/api/admin/applications/sla-status', {
        headers: { Authorization: 'Bearer ' + (localStorage.getItem('bondly_token') || '') },
      }).then(r => r.json()).then(d => d?.data && setSlaStatus(d.data)).catch(() => {});
    }
  });

  // ⌘K / Ctrl+K hotkey is owned by CommandPalette now — keeping just an
  // Escape fallback for the legacy GlobalSearch overlay if it's open.
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') setSearchOpen(false); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  function toggleHideTest() {
    const next = !hideTest;
    setHideTest(next);
    localStorage.setItem('bondly_hide_test', String(next));
  }

  // Track which tabs have been loaded (lazy loading)
  const [loadedTabs, setLoadedTabs] = useState(new Set(['home']));

  // Fetch deploy version info once on mount
  useEffect(() => {
    admin.version().then(d => { if (d?.current) setDeployInfo(d.current); }).catch(() => {});
  }, []);

  // Load critical data upfront (dashboard needs stats + leads + alerts)
  // Re-fetches stats + clears hideTest-sensitive tabs when toggle changes
  useEffect(() => {
    setLoading(true);
    // Clear tabs that filter by hideTest so they reload fresh on next visit
    setLoadedTabs(prev => { const s = new Set(prev); s.delete('pipeline'); s.delete('applications'); return s; });
    setSwapApps([]);
    setPipeline([]);
    Promise.all([
      admin.stats({ hideTest }).catch(() => null),
      admin.leads().catch(() => ({ leads: [] })),
      admin.alerts().catch(() => ({ rateAlerts: [], savingsAlerts: [], primeRate: 11.25 })),
      // SLA status feeds the home-tab priority queue so overdue applications
      // surface ABOVE leads and KYC. Critical for the broker-team workflow.
      fetch('/api/admin/applications/sla-status', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('bondly_token') || '') } })
        .then(r => r.json()).then(d => d?.data || { overdue: [], dueSoon: [], onTrack: [], contacted: [] })
        .catch(() => ({ overdue: [], dueSoon: [], onTrack: [], contacted: [] })),
    ]).then(([s, lds, al, sla]) => {
      setStats(s);
      // Endpoint now returns { leads, convertedCount, totalAll } so we can
      // filter out leads that already became users — that was the dupe
      // source. Stays compatible with the old array shape.
      setLeads(Array.isArray(lds) ? lds : (lds?.leads || []));
      setAlertsData(al || { rateAlerts: [], savingsAlerts: [], primeRate: 11.25 });
      setSlaStatus(sla);
      setPrimeInput(String(s?.primeRate || 11.25));
    }).finally(() => setLoading(false));
  }, [hideTest]);

  // Lazy-load per tab on first visit
  useEffect(() => {
    if (loadedTabs.has(tab)) return;
    setLoadedTabs(prev => new Set([...prev, tab]));
    if (tab === 'applications')  admin.swaps().catch(() => []).then(d => setSwapApps(d || []));
    if (tab === 'errors')        { admin.errors().catch(() => []).then(d => setErrors(d || [])); admin.statementFailures().catch(() => []).then(d => setStmtFailures(d || [])); }
    if (tab === 'pipeline')      admin.pipeline({ hideTest }).catch(() => []).then(d => setPipeline(d || []));
    if (tab === 'kyc')           admin.kycList().catch(() => []).then(d => setKycQueue(Array.isArray(d) ? d : []));
    if (tab === 'chat')          admin.chats().catch(() => []).then(d => setChats(d || []));
    if (tab === 'buyers')        admin.buyerIntents().catch(() => []).then(d => setBuyers(d || []));
    if (tab === 'commissions')   admin.commissions().catch(() => ({ commissions: [], totals: {} })).then(d => setComms(d || { commissions: [], totals: {} }));
    if (tab === 'submissions')   bsApi.list().catch(() => ({ submissions: [] })).then(d => setSubmissions(d.submissions || []));
    if (tab === 'statements')    admin.statements().catch(() => []).then(d => setStatements(d || []));
    if (tab === 'sessions')      admin.sessions().catch(() => []).then(d => setSessions(d || []));
    if (tab === 'feedback')      admin.feedback().catch(() => ({ feedback: [], reports: [] })).then(d => setFeedbackData(d || { feedback: [], reports: [] }));
    if (tab === 'audit-log')     admin.auditLog({ page: 1, limit: 50 }).catch(() => null).then(d => d && setAuditLog(d));
    // customers tab has its own internal fetching
  }, [tab]);

  // Compute visible users — only relevant for dashboard summary cards
  // (the customers tab manages its own paginated state)
  const visibleUsers = hideTest ? users.filter(u => !u.isTest) : users;

  // SLA breach overrides the regular "unsent" pipeline count when present —
  // overdue applications are the single most urgent admin signal.
  const overdueCount = (slaStatus?.overdue || []).length;
  const dueSoonCount = (slaStatus?.dueSoon || []).length;
  const readyToContact =
        alertsData.rateAlerts.filter(a => a.status === 'ready' || a.met).length
      + alertsData.savingsAlerts.filter(a => a.status === 'ready' || a.met).length
      + buyerIntents.filter(b => b.met).length;
  const badges = {
    leads:    leads.filter(l => l.status === 'new').length,
    kyc:      kycQueue.length,
    chat:     chats.filter(c => c.escalated).length,
    pipeline: overdueCount + dueSoonCount + pipeline.filter(e => e.priority === 'active' && !e.brokerSentAt).length,
    errors:   errors.length,
    applications: swapApps.filter(a => ['awaiting_documents','submitted','pending'].includes(a.status)).length,
    watchlist: readyToContact,
  };
  // Track WHICH badges should render danger-red (overdue SLA, escalated chats)
  // vs the normal subdued style. Passed through to AdminSidebar.
  const dangerBadges = new Set([
    overdueCount > 0 && 'pipeline',
    chats.filter(c => c.escalated).length > 0 && 'chat',
    errors.length > 0 && 'errors',
  ].filter(Boolean));

  const [title, subtitle] = TAB_TITLES[tab] || ['Admin', ''];

  if (loading) return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '100vh', background: 'var(--bg-page)' }}>
      <div className="spinner" style={{ width: 36, height: 36, borderWidth: 3 }} />
    </div>
  );

  return (
    <div className="admin-layout">
      <AdminSidebar tab={tab} setTab={setTab} badges={badges} dangerBadges={dangerBadges} user={user} deployInfo={deployInfo} />

      <div className="admin-content">
        {/* Top bar */}
        <div className="admin-topbar">
          <div className="admin-topbar__left">
            <div className="admin-topbar__title">{title}</div>
            <div className="admin-topbar__sub">{subtitle}</div>
          </div>
          <div className="admin-topbar__actions">
            {/* Command palette — replaces the old GlobalSearch with fuzzy
                jump-to across customers, leads, applications, tabs, and
                actions. ⌘K toggles globally. */}
            <CommandPalette
              users={users}
              leads={leads}
              slaApps={[...(slaStatus.overdue || []), ...(slaStatus.dueSoon || []), ...(slaStatus.onTrack || []), ...(slaStatus.contacted || [])]}
              navItems={buildNav(user?.superAdmin).flatMap(g => g.items.map(i => ({ id: i.id, label: i.label, group: g.label })))}
              onNavigate={(id) => setTab(id)}
              onPickCustomer={(uid) => { setTab('customers'); setJumpCustomerId(uid); }}
              onPickLead={(lid) => { setTab('leads'); setJumpLeadId(lid); }}
              actions={[
                { id: 'toggle-hide-test', label: hideTest ? 'Show test users' : 'Hide test users', run: toggleHideTest },
                { id: 'jump-overdue',     label: 'Jump to overdue applications', run: () => setTab('pipeline') },
                { id: 'jump-watchlist',   label: 'Open Watchlist',               run: () => setTab('watchlist') },
                { id: 'jump-errors',      label: 'Open server errors',           run: () => setTab('errors') },
              ]}
            />
            {/* Theme toggle — uses the same data-theme attribute the
                customer dashboard already drives, so the existing dark-mode
                CSS variables in tokens.css work without duplication. */}
            <button
              className="adm-quick-action"
              onClick={toggleTheme}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-label="Toggle theme"
              style={{ fontSize: '0.95rem', padding: '6px 10px' }}
            >
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
            {/* Hide test users toggle */}
            <button
              className={`adm-quick-action ${hideTest ? 'adm-quick-action--primary' : ''}`}
              onClick={toggleHideTest}
              title={hideTest ? 'Showing real users only — click to show test users' : 'Test users are visible — click to hide them'}
              style={{ fontSize: '0.8rem' }}
            >
              {hideTest
                ? `Live · ${stats?.realUserCount ?? 0} users`
                : `⚠ ${stats?.testUserCount ?? 0} test`}
            </button>
            {tab === 'leads'      && null /* Add lead button is inside the Leads tab header */}
            {tab === 'customers'  && <button className="adm-quick-action" onClick={() => admin.users({ hideTest, limit: 10000 }).then(d => exportCSV(d?.customers || [])).catch(() => {})}>Export CSV</button>}
            {tab === 'commissions'&& <button className="adm-quick-action" onClick={() => exportCSV(commissionData.commissions)}>Export CSV</button>}
          </div>
        </div>

        {/* Global search modal */}
        {searchOpen && (
          <GlobalSearch
            leads={leads}
            onJumpCustomer={id => { setJumpCustomerId(id); setTab('customers'); }}
            onJumpLead={id => { setJumpLeadId(id); setTab('leads'); }}
            onClose={() => setSearchOpen(false)}
          />
        )}

        {/* Content */}
        <div className="admin-body">
          {tab === 'home'         && <DashboardHomeTab stats={stats} leads={leads} kycQueue={kycQueue} chats={chats} swapApps={swapApps} pipeline={pipeline} buyerIntents={buyerIntents} commissionData={commissionData} alertsData={alertsData} submissions={submissions} slaStatus={slaStatus} setTab={setTab} hideTest={hideTest} onHideTest={toggleHideTest} />}
          {tab === 'leads'        && <LeadsTab leads={leads} setLeads={setLeads} showToast={showToast} initialSelectedId={jumpLeadId} onClearJump={() => setJumpLeadId(null)} />}
          {tab === 'customers'    && <CustomersTab showToast={showToast} hideTest={hideTest} initialSelectedId={jumpCustomerId} onClearJump={() => setJumpCustomerId(null)} />}
          {tab === 'applications' && (swapApps.length === 0 && !loadedTabs.has('applications') ? <SkeletonList /> : <SwapsKanban swapApps={swapApps} setSwapApps={setSwapApps} showToast={showToast} />)}
          {tab === 'commissions'  && (commissionData.commissions.length === 0 && !loadedTabs.has('commissions') ? <SkeletonList /> : <CommissionsTab data={commissionData} setData={setComms} showToast={showToast} />)}
          {(tab === 'watchlist' || tab === 'alerts' || tab === 'buyers') && <WatchlistTab showToast={showToast} />}
          {tab === 'kyc'          && (kycQueue.length === 0 && !loadedTabs.has('kyc') ? <SkeletonList rows={4} /> : <KYCTab kycQueue={kycQueue} setKycQueue={setKycQueue} kycReason={kycReason} setKycReason={setKycReason} showToast={showToast} onJumpCustomer={id => { setJumpCustomerId(id); setTab('customers'); }} />)}
          {tab === 'chat'         && (chats.length === 0 && !loadedTabs.has('chat') ? <SkeletonList rows={4} /> : <ChatTab chats={chats} setChats={setChats} chatReply={chatReply} setChatReply={setChatReply} showToast={showToast} />)}
          {/* legacy 'buyers' id is handled by the WatchlistTab line above */}
          {tab === 'submissions'  && <BankSubmissionsTab submissions={submissions} setSubmissions={setSubmissions} showToast={showToast} />}
          {tab === 'pipeline'         && <ApplicationsTab showToast={showToast} onJump={(r) => setTab(r.type === 'swap' ? 'applications' : 'submissions')} />}
          {tab === 'bond-desk'        && <BondDeskTab showToast={showToast} />}
          {tab === 'pipeline-legacy'  && (pipeline.length === 0 && !loadedTabs.has('pipeline') ? <SkeletonList /> : <PipelineTab pipeline={pipeline} setPipeline={setPipeline} showToast={showToast} />)}
          {tab === 'analytics'    && <BehaviouralAnalyticsTab />}
          {tab === 'errors'       && (errors.length === 0 && !loadedTabs.has('errors') ? <SkeletonList rows={3} /> : <ErrorsTab errors={errors} setErrors={setErrors} stmtFailures={stmtFailures} showToast={showToast} />)}
          {tab === 'settings'     && <SettingsTab primeInput={primeInput} setPrimeInput={setPrimeInput} showToast={showToast} />}
          {tab === 'claude-usage'  && <ClaudeUsageTab />}
          {tab === 'bulk-email'   && <BulkEmailTab showToast={showToast} />}
          {tab === 'staff'        && <StaffTab showToast={showToast} />}
          {tab === 'statements'   && <StatementsTab statements={statements} showToast={showToast} />}
          {tab === 'sessions'     && <SessionsTab sessions={sessions} />}
          {tab === 'feedback'     && <FeedbackAdminTab data={feedbackData} />}
          {tab === 'audit-log'   && <AuditLogTab data={auditLog} onPageChange={p => admin.auditLog({ page: p, limit: 50 }).catch(() => null).then(d => d && setAuditLog(d))} />}
          {tab === 'diary'       && <DiaryTab showToast={showToast} />}
          {tab === 'ai-audit'    && <AuditTab showToast={showToast} />}
          {tab === 'parser-health' && <ParserHealthTab showToast={showToast} />}
          {tab === 'fair-lending'  && <FairLendingTab />}
        </div>
      </div>
      {c360Id && <Customer360Drawer customerId={c360Id} onClose={() => setC360Id(null)} />}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  AUDIT LOG TAB
// ═══════════════════════════════════════════════════════════
function AuditLogTab({ data, onPageChange }) {
  const { entries = [], total = 0, page = 1, pages = 1 } = data;

  function formatDetail(detail) {
    if (!detail || typeof detail !== 'object') return '—';
    const parts = Object.entries(detail)
      .filter(([, v]) => v !== null && v !== undefined && v !== '')
      .map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    return parts.join(' | ') || '—';
  }

  return (
    <div>
      <Card>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Audit Log</span>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', fontWeight: 400 }}>{total} entries</span>
          </div>
        </CardHeader>
        <CardBody style={{ padding: 0 }}>
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.8125rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-color)', background: 'var(--bg-card)' }}>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>Time</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Admin</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Action</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Resource</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>Detail</th>
                  <th style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, color: 'var(--text-secondary)' }}>IP</th>
                </tr>
              </thead>
              <tbody>
                {entries.length === 0 ? (
                  <tr><td colSpan={6} style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-secondary)' }}>No audit entries yet</td></tr>
                ) : entries.map(e => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--border-color)' }}>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {e.at ? new Date(e.at).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' }) : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap' }}>
                      <div style={{ fontWeight: 500 }}>{e.admin_email || e.admin_id}</div>
                    </td>
                    <td style={{ padding: '10px 16px' }}>
                      <span style={{
                        display: 'inline-block', padding: '2px 8px', borderRadius: 4,
                        fontSize: '0.75rem', fontWeight: 600, fontFamily: 'monospace',
                        background: 'var(--bg-page)', border: '1px solid var(--border-color)',
                      }}>{e.action}</span>
                    </td>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {e.resource ? `${e.resource}${e.resource_id ? ' #' + e.resource_id : ''}` : '—'}
                    </td>
                    <td style={{ padding: '10px 16px', maxWidth: 280, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: 'var(--text-secondary)' }}>
                      {formatDetail(e.detail)}
                    </td>
                    <td style={{ padding: '10px 16px', whiteSpace: 'nowrap', color: 'var(--text-secondary)', fontFamily: 'monospace', fontSize: '0.75rem' }}>
                      {e.ip || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {pages > 1 && (
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '12px 16px', borderTop: '1px solid var(--border-color)' }}>
              <button className="adm-btn adm-btn--ghost" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>Prev</button>
              <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Page {page} of {pages}</span>
              <button className="adm-btn adm-btn--ghost" disabled={page >= pages} onClick={() => onPageChange(page + 1)}>Next</button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  FEEDBACK TAB
// ═══════════════════════════════════════════════════════════
function FeedbackAdminTab({ data }) {
  const { feedback = [], reports = [] } = data;
  const [view, setView] = useState('reports');

  const upCount   = feedback.filter(f => f.verdict === 'up').length;
  const downCount = feedback.filter(f => f.verdict === 'down').length;
  const total     = upCount + downCount;
  const score     = total ? Math.round((upCount / total) * 100) : null;

  const CONTEXT_LABELS = {
    qualify_statement:  'Qualify from statement',
    preapproval_step3:  'Pre-approval affordability',
  };

  function daysAgo(iso) {
    const d = Math.floor((Date.now() - new Date(iso)) / 86400000);
    return d === 0 ? 'Today' : d === 1 ? 'Yesterday' : `${d}d ago`;
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* Summary bar */}
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ flex: '1 1 160px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Satisfaction score</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: score >= 70 ? '#22c55e' : score >= 50 ? '#f59e0b' : '#ef4444' }}>
            {score !== null ? `${score}%` : '—'}
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>👍 {upCount} · 👎 {downCount} ({total} votes)</div>
        </div>
        <div style={{ flex: '1 1 160px', background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '14px 18px' }}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 4 }}>Problem reports</div>
          <div style={{ fontSize: '1.75rem', fontWeight: 800, color: 'var(--text-primary)' }}>{reports.length}</div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Total submitted</div>
        </div>
      </div>

      {/* Tab switcher */}
      <div style={{ display: 'flex', gap: 6 }}>
        {[['reports', 'Problem Reports'], ['thumbs', 'Thumbs Votes']].map(([id, label]) => (
          <button key={id} onClick={() => setView(id)}
            style={{ padding: '6px 14px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: view === id ? 'var(--forest)' : 'var(--bg-card)', color: view === id ? '#fff' : 'var(--text-primary)', fontWeight: 600, fontSize: '0.875rem', cursor: 'pointer' }}>
            {label}
          </button>
        ))}
      </div>

      {view === 'reports' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {reports.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>No problem reports yet</div>}
          {reports.map(r => (
            <div key={r.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8 }}>
                <div style={{ fontWeight: 600, fontSize: '0.9375rem', flex: 1 }}>{r.message}</div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{daysAgo(r.at)}</span>
              </div>
              <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                {r.page && <span>📍 {r.page}</span>}
                {r.userName && <span>👤 {r.userName}</span>}
                {r.userEmail && <span>✉ {r.userEmail}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      {view === 'thumbs' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {feedback.length === 0 && <div style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 32 }}>No thumbs votes yet</div>}
          {feedback.map(f => (
            <div key={f.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <span style={{ fontSize: '1.2rem' }}>{f.verdict === 'up' ? '👍' : '👎'}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{CONTEXT_LABELS[f.context] || f.context}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
                  {f.page && <span>📍 {f.page} · </span>}
                  {f.userName ? <span>👤 {f.userName} · </span> : <span>anonymous · </span>}
                  {daysAgo(f.at)}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  DASHBOARD HOME
// ═══════════════════════════════════════════════════════════
function DashboardHomeTab({ stats, leads, kycQueue, chats, swapApps, pipeline, buyerIntents, commissionData, alertsData, submissions, slaStatus = { overdue: [], dueSoon: [] }, setTab, hideTest, onHideTest }) {
  const hour = new Date().getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const prime    = stats?.primeRate || 11.25;
  const today    = new Date().toDateString();
  const testCount = stats?.testUserCount || 0;

  // Revenue numbers — all come from commissions or stats
  const earned    = (commissionData.totals?.received || 0) + (commissionData.totals?.reconciled || 0);
  const pending   = commissionData.totals?.pending || 0;
  const potential = (stats?.switchableBal || 0) * 0.005;
  const maxRev    = Math.max(earned, pending, potential, 1);

  // Lead stats
  const newLeads    = leads.filter(l => l.status === 'new').length;
  const newToday    = leads.filter(l => new Date(l.createdAt).toDateString() === today).length;
  const hotLeads    = leads.filter(l => ['qualified','sent_to_broker'].includes(l.status)).length;
  const convertRate = leads.length > 0 ? Math.round(leads.filter(l=>l.status==='converted').length/leads.length*100) : 0;

  // Customer funnel — from stats (pre-computed on server, respects hideTest flag)
  const totalCustomers = hideTest ? (stats?.realUserCount || 0) : (stats?.totalUsers || 0);
  const withBonds      = stats?.withBonds || 0;
  const withAlerts     = (alertsData?.rateAlerts?.length || 0) + (alertsData?.savingsAlerts?.length || 0);
  const applied        = stats?.applied || 0;
  const completed      = stats?.completed || 0;
  // funnelMax must be at least as large as any funnel value to prevent overflow bars
  const funnelMax      = Math.max(totalCustomers, withBonds, withAlerts, applied, completed, 1);

  // Alert waitlist stats
  const activeAlerts = (alertsData?.rateAlerts || []).filter(a => !a.triggeredAt).length;
  const readyAlerts  = (alertsData?.rateAlerts || []).filter(a => a.status === 'ready').length;

  // Top candidates and activity come from stats (pre-computed, test-aware)
  const topCandidates  = stats?.topCandidates || [];
  const activityItems  = [
    ...leads.map(l => ({ date: l.createdAt, title: l.name || 'New lead', detail: `Lead · ${l.currentBank || '?'} · ${l.currentBalance ? fmt(l.currentBalance) : '?'}`, color: '#3b82f6' })),
    ...(stats?.recentActivity || []),
  ].sort((a, b) => new Date(b.date) - new Date(a.date)).slice(0, 10);

  // Priority queue — ordered most-urgent first. SLA breaches pinned to the
  // very top because a missed broker-contact deadline is a written promise
  // to the customer and reputational damage compounds fast.
  const overdueCount = (slaStatus.overdue || []).length;
  const dueSoonCount = (slaStatus.dueSoon || []).length;
  const priorities = [
    overdueCount > 0 && {
      level: 'critical', color: '#dc2626', bg: '#dc262612',
      icon: '⏰', text: `SLA breached — broker hasn't made contact`,
      count: overdueCount, tab: 'pipeline', label: 'Assign now'
    },
    dueSoonCount > 0 && {
      level: 'high', color: '#d97706', bg: '#d9770612',
      icon: '⌛', text: 'Applications nearing SLA deadline (< 4h)',
      count: dueSoonCount, tab: 'pipeline', label: 'Contact next'
    },
    chats.filter(c=>c.escalated).length > 0 && {
      level: 'critical', color: '#ef4444', bg: '#ef444412',
      icon: '🔴', text: 'Customers requesting urgent support',
      count: chats.filter(c=>c.escalated).length, tab: 'chat', label: 'Resolve now'
    },
    readyAlerts > 0 && {
      level: 'high', color: '#16a34a', bg: '#16a34a12',
      icon: '🟢', text: 'Rate targets met — ready to contact',
      count: readyAlerts, tab: 'watchlist', label: 'Contact them'
    },
    kycQueue.length > 0 && {
      level: 'high', color: '#f59e0b', bg: '#f59e0b12',
      icon: '🟡', text: 'KYC submissions awaiting review',
      count: kycQueue.length, tab: 'kyc', label: 'Review'
    },
    pipeline.filter(e=>e.priority==='active'&&!e.brokerSentAt).length > 0 && {
      level: 'medium', color: '#6366f1', bg: '#6366f112',
      icon: '🟣', text: 'Applications ready to send to broker',
      count: pipeline.filter(e=>e.priority==='active'&&!e.brokerSentAt).length, tab: 'pipeline', label: 'Send now'
    },
    newLeads > 0 && {
      level: 'medium', color: '#3b82f6', bg: '#3b82f612',
      icon: '🔵', text: 'New leads without follow-up',
      count: newLeads, tab: 'leads', label: 'Follow up'
    },
    buyerIntents.filter(b=>b.met).length > 0 && {
      level: 'low', color: '#d97706', bg: '#d9770612',
      icon: '🟠', text: 'Buyers whose savings target is met',
      count: buyerIntents.filter(b=>b.met).length, tab: 'watchlist', label: 'Reach out'
    },
  ].filter(Boolean);

  function relTime(iso) {
    const diff = Date.now() - new Date(iso);
    const m = Math.floor(diff / 60000);
    const h = Math.floor(diff / 3600000);
    const d = Math.floor(diff / 86400000);
    if (m < 60) return `${m}m ago`;
    if (h < 24) return `${h}h ago`;
    if (d < 7)  return `${d}d ago`;
    return fmtDate(iso);
  }

  return (
    <div className="fade-in">

      {/* ── Compact header bar ── */}
      <div className="dash-header-bar">
        <div>
          <span className="dash-header-bar__greeting">{greeting}, {new Date().toLocaleDateString('en-ZA', { weekday:'long', day:'numeric', month:'long' })}</span>
        </div>
        <div className="dash-header-bar__pills">
          <span className="dash-hero__pill dash-hero__pill--green" onClick={() => setTab('settings')} style={{ cursor:'pointer' }}>
            <svg width="8" height="8" viewBox="0 0 10 10" fill="currentColor"><circle cx="5" cy="5" r="5"/></svg>
            Prime {prime}%
          </span>
          {earned > 0  && <span className="dash-hero__pill dash-hero__pill--green">{fmt(earned)} earned</span>}
          {pending > 0 && <span className="dash-hero__pill dash-hero__pill--yellow">{fmt(pending)} pending</span>}
          {newToday > 0 && <span className="dash-hero__pill">{newToday} lead{newToday>1?'s':''} today</span>}
          {!hideTest && testCount > 0 && (
            <span className="dash-hero__pill" style={{ background:'#d9770618',color:'#d97706',cursor:'pointer' }} onClick={onHideTest}>
              ⚠ {testCount} test accounts
            </span>
          )}
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button className="dash-hero__btn dash-hero__btn--ghost" onClick={() => setTab('customers')}>Customers</button>
          <button className="dash-hero__btn dash-hero__btn--primary" onClick={() => setTab('leads')}>+ Lead</button>
        </div>
      </div>

      {/* ── Priority queue — first thing you see ── */}
      <div className="dash-focus-panel">
        <div className="dash-panel__head">
          <span className="dash-panel__title">Today's focus</span>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-secondary)' }}>
            {priorities.length === 0 ? 'Nothing urgent' : `${priorities.length} item${priorities.length !== 1 ? 's' : ''} need${priorities.length !== 1 ? '' : 's'} attention`}
          </span>
        </div>
        <div style={{ padding: '8px 12px' }}>
          {priorities.length === 0 ? (
            <div className="dash-all-clear">
              <div className="dash-all-clear__icon"><CheckCircle size={28} color="var(--color-success)"/></div>
              <div className="dash-all-clear__title">All clear!</div>
              <div className="dash-all-clear__sub">Nothing urgent right now.</div>
            </div>
          ) : priorities.map((p, i) => (
            <div key={i} className="dash-priority-item" onClick={() => setTab(p.tab)}>
              <div className="dash-priority-dot" style={{ background: p.color }} />
              <div className="dash-priority-text">{p.text}</div>
              <span className="dash-priority-count" style={{ background: p.bg, color: p.color }}>{p.count}</span>
              <span className="dash-priority-arrow">→ {p.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Vital signs ── */}
      <div className="dash-metrics">
        {[
          {
            label: 'Revenue Earned', value: fmt(earned),
            sub: pending > 0 ? `+${fmt(pending)} pending` : `${fmt(potential)} potential`,
            subClass: pending > 0 ? 'dash-metric__sub--up' : '',
            badge: earned > 0 ? '↑' : null, badgeColor: '#16a34a', badgeBg: '#16a34a18',
            accent: '#16a34a', tab: 'commissions',
          },
          {
            label: 'Leads', value: leads.length,
            sub: newLeads > 0 ? `${leads.length} total · ${newLeads} new` : hotLeads > 0 ? `${hotLeads} hot` : `${convertRate}% conversion`,
            subClass: newLeads > 0 ? 'dash-metric__sub--warn' : '',
            badge: newLeads > 0 ? newLeads : null, badgeColor: '#d97706', badgeBg: '#d9770618',
            accent: '#3b82f6', tab: 'leads',
          },
          {
            label: 'Customers', value: totalCustomers,
            sub: `${withBonds} bonds · ${applied} applied`,
            subClass: '',
            badge: null,
            accent: 'var(--forest)', tab: 'customers',
          },
          {
            label: 'Waitlist', value: activeAlerts,
            sub: readyAlerts > 0 ? `${readyAlerts} ready to contact` : `${withAlerts} watching`,
            subClass: readyAlerts > 0 ? 'dash-metric__sub--up' : '',
            badge: readyAlerts > 0 ? readyAlerts : null, badgeColor: '#16a34a', badgeBg: '#16a34a18',
            accent: '#d97706', tab: 'alerts',
          },
        ].map(m => (
          <div key={m.label} className="dash-metric" onClick={() => setTab(m.tab)}>
            <div className="dash-metric__accent" style={{ background: m.accent }} />
            <div className="dash-metric__top">
              <div className="dash-metric__label">{m.label}</div>
              {m.badge != null && <span className="dash-metric__badge" style={{ background: m.badgeBg, color: m.badgeColor }}>{m.badge}</span>}
            </div>
            <div className="dash-metric__value">{m.value}</div>
            <div className={`dash-metric__sub ${m.subClass}`}>{m.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Main 2-col: revenue + top candidates ── */}
      <div className="dash-main">

        {/* Submissions funnel + revenue */}
        <div className="dash-panel">
          <div className="dash-panel__head">
            <span className="dash-panel__title">Submissions pipeline</span>
            <button className="dash-panel__link" onClick={() => setTab('submissions')}>Manage →</button>
          </div>
          <div className="dash-panel__body">
            {/* Submissions in flight */}
            {stats?.submissions && (
              <div style={{ marginBottom: 16 }}>
                {[
                  { label: 'Active deals',       value: stats.submissions.active,       color: '#3b82f6' },
                  { label: 'Banks responding',   value: stats.submissions.banksSubmitted, color: '#d97706' },
                  { label: 'Quotes received',    value: stats.submissions.banksQuoted,  color: '#16a34a' },
                  { label: 'Won today',          value: stats.submissions.wonToday,     color: '#16a34a' },
                ].map(r => (
                  <div key={r.label} className="dash-rev-item" onClick={() => setTab('submissions')} style={{ cursor:'pointer' }}>
                    <div className="dash-rev-item__top">
                      <span className="dash-rev-item__label">{r.label}</span>
                      <span className="dash-rev-item__value" style={{ color: r.color }}>{r.value}</span>
                    </div>
                  </div>
                ))}
                {stats.submissions.stale?.length > 0 && (
                  <div style={{ padding: '8px 12px', background: 'rgba(239,68,68,0.06)', borderRadius: 6, fontSize: '0.8125rem', color: '#ef4444', marginTop: 8, cursor: 'pointer' }} onClick={() => setTab('submissions')}>
                    ⚠ {stats.submissions.stale.length} deal{stats.submissions.stale.length > 1 ? 's' : ''} stale for 3+ days
                  </div>
                )}
              </div>
            )}
            {/* Revenue */}
            {[
              { label: 'Received',  value: earned,    color: '#16a34a' },
              { label: 'Pending',   value: pending,   color: '#d97706' },
              { label: 'Potential', value: potential, color: '#4a7fa5' },
            ].map(r => (
              <div key={r.label} className="dash-rev-item">
                <div className="dash-rev-item__top">
                  <span className="dash-rev-item__label">{r.label}</span>
                  <span className="dash-rev-item__value" style={{ color: r.color }}>{fmt(r.value)}</span>
                </div>
                <div className="dash-rev-bar">
                  <div className="dash-rev-bar__fill" style={{ width: `${Math.round((r.value/maxRev)*100)}%`, background: r.color }} />
                </div>
              </div>
            ))}
            <div className="dash-rev-total">
              <span className="dash-rev-total__label">Est. total commission</span>
              <span className="dash-rev-total__value">{fmt(earned + pending + potential)}</span>
            </div>

            {/* Swap app status breakdown */}
            <div style={{ marginTop: 20, paddingTop: 16, borderTop: '1px solid var(--border-color)' }}>
              <div className="dash-panel__title" style={{ marginBottom: 12 }}>Switch applications</div>
              {[
                ['Awaiting docs', swapApps.filter(a=>a.status==='awaiting_documents').length, '#d97706'],
                ['Submitted',    swapApps.filter(a=>a.status==='submitted').length,    '#6366f1'],
                ['Under review', swapApps.filter(a=>a.status==='under_review').length, '#2563eb'],
                ['Approved',     swapApps.filter(a=>a.status==='approved').length,     '#16a34a'],
                ['In progress',  swapApps.filter(a=>a.status==='in_progress').length,  '#3b82f6'],
                ['Completed',    swapApps.filter(a=>a.status==='completed').length,    '#16a34a'],
              ].filter(([,n]) => n > 0).map(([l, n, c]) => (
                <div key={l} style={{ display:'flex', justifyContent:'space-between', alignItems:'center', fontSize:'0.8125rem', marginBottom:7 }}>
                  <span style={{ color:'var(--text-secondary)' }}>{l}</span>
                  <span style={{ fontWeight:700, color:c }}>{n}</span>
                </div>
              ))}
              {swapApps.length === 0 && <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)' }}>No applications yet</div>}
            </div>
          </div>
        </div>
      </div>

      {/* ── Lower 2-col: top candidates + funnel/activity ── */}
      <div className="dash-lower">

        {/* Top switch candidates */}
        <div className="dash-panel">
          <div className="dash-panel__head">
            <span className="dash-panel__title">Top switch candidates</span>
            <button className="dash-panel__link" onClick={() => setTab('customers')}>All customers →</button>
          </div>
          <div className="dash-panel__body">
            {topCandidates.length === 0 ? (
              <div style={{ textAlign:'center', padding:'24px 0', color:'var(--text-secondary)', fontSize:'0.875rem' }}>
                No customers with switch potential yet
              </div>
            ) : topCandidates.map(u => {
              const waNum = u.phone?.replace(/\D/g,'').replace(/^0/,'27');
              const waLink = waNum ? `https://wa.me/${waNum}?text=Hi ${encodeURIComponent(u.name?.split(' ')[0]||'')}%2C+this+is+Bondly.+We+have+a+great+opportunity+to+save+you+money+on+your+bond.` : null;
              return (
                <div key={u.id} className="dash-opp-row">
                  <div className="dash-opp-avatar" style={{ background: avatarColor(u.name) }}>{u.name?.[0]?.toUpperCase()||'?'}</div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div className="dash-opp-name">{u.name}</div>
                    <div className="dash-opp-bank">{u.totalBalance ? fmt(u.totalBalance) : '—'} · {u.loanCount} bond{u.loanCount!==1?'s':''}</div>
                  </div>
                  <div className="dash-opp-saving">+{fmt(u.mthSaving)}/mo</div>
                  <div className="dash-opp-actions">
                    {waLink && <a href={waLink} target="_blank" rel="noreferrer" className="dash-opp-btn dash-opp-btn--wa">WA</a>}
                    {u.email && <a href={`mailto:${u.email}`} className="dash-opp-btn">Email</a>}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: funnel + activity stacked */}
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

          {/* Customer funnel */}
          <div className="dash-panel">
            <div className="dash-panel__head">
              <span className="dash-panel__title">Customer funnel</span>
            </div>
            <div className="dash-panel__body dash-funnel">
              {[
                { label: 'Registered',   n: totalCustomers, color: '#4a7fa5' },
                { label: 'Have bonds',   n: withBonds,      color: '#6366f1' },
                { label: 'Alert set',    n: withAlerts,     color: '#d97706' },
                { label: 'Applied',      n: applied,        color: '#f59e0b' },
                { label: 'Completed',    n: completed,      color: '#16a34a' },
              ].map(s => (
                <div key={s.label} className="dash-funnel-stage">
                  <div className="dash-funnel-stage__label">{s.label}</div>
                  <div className="dash-funnel-stage__bar-wrap">
                    <div className="dash-funnel-stage__bar" style={{ width:`${Math.round((s.n/funnelMax)*100)}%`, background:s.color, minWidth: s.n>0?'auto':0 }}>
                      {s.n > 0 ? s.n : ''}
                    </div>
                  </div>
                  <div className="dash-funnel-stage__pct">{funnelMax>0?Math.round((s.n/funnelMax)*100):0}%</div>
                </div>
              ))}
            </div>
          </div>

          {/* Activity feed */}
          <div className="dash-panel">
            <div className="dash-panel__head">
              <span className="dash-panel__title">Recent activity</span>
            </div>
            <div className="dash-panel__body">
              {activityItems.length === 0
                ? <div style={{ textAlign:'center', color:'var(--text-secondary)', fontSize:'0.875rem', padding:'16px 0' }}>No activity yet</div>
                : activityItems.map((a, i) => (
                  <div key={i} className="dash-activity-item">
                    <div className="dash-activity-dot" style={{ background: a.color }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div className="dash-activity-title">{a.title}</div>
                      <div className="dash-activity-sub">{a.detail}</div>
                    </div>
                    <div className="dash-activity-time">{relTime(a.date)}</div>
                  </div>
                ))
              }
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CUSTOMERS TAB
// ═══════════════════════════════════════════════════════════
const SWAP_STATUS_COLORS = {
  awaiting_documents: 'var(--color-warning)', submitted: 'var(--color-info)', under_review: 'var(--color-info)', approved: 'var(--color-success)',
  in_progress: 'var(--color-info)', completed: 'var(--color-success)', rejected: 'var(--color-error)',
};

function CustomersTab({ showToast, hideTest, initialSelectedId, onClearJump }) {
  const PAGE_SIZE = 50;
  // Server-side state
  const [rows, setRows]           = useState([]);
  const [total, setTotal]         = useState(0);
  const [pages, setPages]         = useState(1);
  const [page, setPage]           = useState(1);
  const [loading, setLoading]     = useState(true);
  // Filter state (client-side from loaded page, + server-side search)
  const [search, setSearch]       = useState('');
  const [searchInput, setSearchInput] = useState('');  // debounced
  const [filter, setFilter]       = useState('all');
  const [selectedId, setSelectedId] = useState(initialSelectedId || null);
  const [profileUserId, setProfile] = useState(null); // kept for overlay (unused in split view)

  // Jump to a customer opened from global search
  useEffect(() => {
    if (initialSelectedId) { setSelectedId(initialSelectedId); onClearJump?.(); }
  }, [initialSelectedId]);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => { setSearch(searchInput); setPage(1); }, 350);
    return () => clearTimeout(t);
  }, [searchInput]);

  // Fetch from server whenever page / search / hideTest changes
  const [refreshKey, setRefreshKey] = useState(0);
  const refreshList = () => setRefreshKey(k => k + 1);
  useEffect(() => {
    setLoading(true);
    admin.users({ hideTest, search, page, limit: PAGE_SIZE })
      .then(d => {
        // Response is { customers, total, page, limit, pages }
        const data = d?.customers ?? (Array.isArray(d) ? d : []);
        setRows(data);
        setTotal(d?.total ?? data.length);
        setPages(d?.pages ?? 1);
      })
      .catch(() => setRows([]))
      .finally(() => setLoading(false));
  }, [hideTest, search, page, refreshKey]);

  // Client-side filter within the loaded page (fast, no network)
  const filtered = rows.filter(u => {
    if (filter === 'kyc_approved')   return u.kycStatus === 'approved';
    if (filter === 'kyc_pending')    return u.kycStatus === 'pending_review';
    if (filter === 'has_bonds')      return u.loanCount > 0;
    if (filter === 'no_kyc')         return !u.kycStatus || u.kycStatus === 'none';
    if (filter === 'has_saving')     return (u.mthSaving || 0) > 0;
    if (filter === 'has_app')        return !!u.latestSwapStatus;
    return true;
  });

  // KPI summaries from the loaded page
  const testCount          = rows.filter(u => u.isTest).length;
  const totalPortfolio     = rows.reduce((s, u) => s + (u.totalBalance || 0), 0);
  const totalSavingPotential = rows.reduce((s, u) => s + (u.mthSaving || 0), 0);
  const counts = {
    all:          rows.length,
    has_bonds:    rows.filter(u => u.loanCount > 0).length,
    kyc_approved: rows.filter(u => u.kycStatus === 'approved').length,
    kyc_pending:  rows.filter(u => u.kycStatus === 'pending_review').length,
    no_kyc:       rows.filter(u => !u.kycStatus || u.kycStatus === 'none').length,
    has_saving:   rows.filter(u => (u.mthSaving || 0) > 0).length,
    has_app:      rows.filter(u => !!u.latestSwapStatus).length,
  };

  return (
    <div className="fade-in">
      {/* Test data warning */}
      {!hideTest && testCount > 0 && (
        <div style={{ background: '#78350f12', border: '1px solid #d9770630', borderRadius: 8, padding: '8px 14px', marginBottom: 12, fontSize: '0.8125rem', color: '#d97706', display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={15}/>
          <span><strong>{testCount} test account{testCount !== 1 ? 's' : ''}</strong> visible on this page. Toggle "Live view" in the top bar to hide them.</span>
        </div>
      )}

      {/* KPI cards — reflect current page */}
      <div className="adm-kpi-grid" style={{ marginBottom: 20 }}>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid var(--forest)' }}>
          <div className="adm-kpi-sub">Total Customers</div>
          <div className="adm-kpi-value">{total.toLocaleString()}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>{counts.has_bonds} with active bonds (this page)</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid #4a7fa5' }}>
          <div className="adm-kpi-sub">Portfolio (this page)</div>
          <div className="adm-kpi-value">{fmt(totalPortfolio)}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>Bonds under management</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid var(--lime)' }}>
          <div className="adm-kpi-sub">Monthly Savings Potential</div>
          <div className="adm-kpi-value">{fmt(totalSavingPotential)}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>If all on this page switched today</div>
        </div>
        <div className="adm-kpi-card" style={{ borderLeft: '4px solid #d97706' }}>
          <div className="adm-kpi-sub">Est. Commission (this page)</div>
          <div className="adm-kpi-value">{fmt(totalPortfolio * 0.005)}</div>
          <div className="adm-kpi-sub" style={{ marginTop: 4 }}>{fmt(totalPortfolio * 0.004)}–{fmt(totalPortfolio * 0.008)} range</div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="cust-toolbar" style={{ flexWrap: 'wrap', gap: 8 }}>
        <input
          type="search" placeholder="Search name, email, phone…"
          value={searchInput} onChange={e => setSearchInput(e.target.value)}
          autoComplete="off"
          style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.875rem', width: 220, flexShrink: 0 }}
        />
        {[
          ['all',          `All (${counts.all})`],
          ['has_bonds',    `Bonds (${counts.has_bonds})`],
          ['has_saving',   `Can Save (${counts.has_saving})`],
          ['has_app',      `Applied (${counts.has_app})`],
          ['kyc_approved', `KYC ✓ (${counts.kyc_approved})`],
          ['kyc_pending',  `KYC Pending (${counts.kyc_pending})`],
          ['no_kyc',       `No KYC (${counts.no_kyc})`],
        ].map(([v, l]) => (
          <button key={v} className={`cust-filter-chip ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
        <div style={{ marginLeft: 'auto', fontSize: '0.8125rem', color: 'var(--text-secondary)', flexShrink: 0 }}>
          Page {page} of {pages} · {total.toLocaleString()} total
        </div>
      </div>

      {/* ── Two-panel layout ── */}
      <div style={{ display: 'flex', gap: 0, border: '1px solid var(--border-color)', borderRadius: 12, overflow: 'hidden', height: 'calc(100vh - 320px)', minHeight: 500 }}>

        {/* ── Left: name list ── */}
        <div style={{ width: 280, flexShrink: 0, borderRight: '1px solid var(--border-color)', display: 'flex', flexDirection: 'column', background: 'var(--bg-card)' }}>
          {/* List header */}
          <div style={{ padding: '10px 12px', borderBottom: '1px solid var(--border-color)', fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'flex', justifyContent: 'space-between', flexShrink: 0 }}>
            <span>{filtered.length} shown</span>
            {pages > 1 && (
              <div style={{ display: 'flex', gap: 4 }}>
                <button onClick={() => setPage(p => Math.max(1, p-1))} disabled={page<=1}
                  style={{ background:'none', border:'none', cursor:page>1?'pointer':'default', color:page>1?'var(--text-primary)':'var(--text-secondary)', fontSize:'0.8rem' }}>← </button>
                <span>{page}/{pages}</span>
                <button onClick={() => setPage(p => Math.min(pages, p+1))} disabled={page>=pages}
                  style={{ background:'none', border:'none', cursor:page<pages?'pointer':'default', color:page<pages?'var(--text-primary)':'var(--text-secondary)', fontSize:'0.8rem' }}> →</button>
              </div>
            )}
          </div>

          {/* List body */}
          <div style={{ flex: 1, overflowY: 'auto' }}>
            {loading ? (
              <div style={{ padding: 32, textAlign: 'center' }}>
                <div className="spinner" style={{ width: 24, height: 24, borderWidth: 2, margin: '0 auto' }} />
              </div>
            ) : filtered.length === 0 ? (
              <div style={{ padding: 24, textAlign: 'center', fontSize: '0.875rem', color: 'var(--text-secondary)' }}>No customers match</div>
            ) : filtered.map(u => {
              const isSelected = selectedId === u.id;
              const grade = u.riskScore?.grade;
              const gradeColor = RISK_COLOR[grade] || '#9ca3af';
              return (
                <div key={u.id} onClick={() => setSelectedId(u.id)}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', cursor: 'pointer', background: isSelected ? 'var(--bg-page)' : 'transparent', borderLeft: isSelected ? '3px solid var(--mint)' : '3px solid transparent', transition: 'background 0.12s', borderBottom: '1px solid var(--border-color)' }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-page)'; }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent'; }}
                >
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: u.isAnonymous ? '#64748b' : u.isTest ? '#d97706' : avatarColor(u.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.9375rem', flexShrink: 0 }}>
                    {u.isAnonymous ? '?' : u.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: 5, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.name}
                      {u.isTest && <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#d9770620', color: '#d97706', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>TEST</span>}
                      {u.isAnonymous && <span style={{ fontSize: '0.6rem', fontWeight: 700, background: '#64748b20', color: '#64748b', padding: '1px 4px', borderRadius: 3, flexShrink: 0 }}>NOT SIGNED IN</span>}
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {u.isAnonymous ? `${u.statementCount || 0} statement${u.statementCount !== 1 ? 's' : ''} — no account created` : u.email}
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    {!u.isAnonymous && <CustomerHealthRing customer={u} size={34} />}
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 3 }}>
                      {grade && <span style={{ fontSize: '0.7rem', fontWeight: 800, color: gradeColor }}>{grade}</span>}
                      {(u.mthSaving||0) > 0 && <span style={{ fontSize: '0.65rem', color: 'var(--mint)', fontWeight: 600 }}>+{fmt(u.mthSaving)}</span>}
                      {u.latestSwapStatus && <span style={{ fontSize: '0.6rem', color: SWAP_STATUS_COLORS[u.latestSwapStatus]||'#6366f1', fontWeight: 600 }}>{u.latestSwapStatus.replace(/_/g,' ').slice(0,10)}</span>}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Right: account detail ── */}
        <div style={{ flex: 1, overflowY: 'auto', background: 'var(--bg-page)' }}>
          {selectedId ? (
            <CustomerProfile userId={selectedId} mode="inline" onClose={() => setSelectedId(null)} showToast={showToast} users={rows} onMerged={() => { refreshList(); setSelectedId(null); }} />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-secondary)', gap: 12 }}>
              <div style={{ fontSize: '2.5rem', opacity: 0.25 }}>👤</div>
              <div style={{ fontWeight: 600, fontSize: '0.9375rem' }}>Select a customer</div>
              <div style={{ fontSize: '0.875rem' }}>Click a name on the left to view their account</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  FULL-SCREEN CUSTOMER PROFILE
// ═══════════════════════════════════════════════════════════
const NOTE_TYPES = [
  { id: 'note',     label: 'Note',     color: '#6366f1', bg: '#6366f118' },
  { id: 'call',     label: 'Call',     color: '#16a34a', bg: '#16a34a18' },
  { id: 'email',    label: 'Email',    color: '#4a7fa5', bg: '#4a7fa518' },
  { id: 'whatsapp', label: 'WhatsApp', color: '#25d366', bg: '#25d36618' },
  { id: 'meeting',  label: 'Meeting',  color: '#d97706', bg: '#d9770618' },
];


function AuditPanel({ snapshot }) {
  const [auditing, setAuditing] = useState(false);
  const [notes, setNotes] = useState(snapshot.auditNotes || null);
  const [auditedAt, setAuditedAt] = useState(snapshot.auditedAt || null);
  const [err, setErr] = useState('');

  async function runAudit() {
    setAuditing(true); setErr('');
    try {
      const r = await adminApi.auditSnapshot(snapshot.id);
      if (r?.data?.auditNotes) {
        setNotes(r.data.auditNotes);
        setAuditedAt(r.data.auditedAt);
      } else {
        setErr('Audit returned no findings');
      }
    } catch(e) {
      setErr('Audit failed: ' + (e.message || 'unknown'));
    } finally {
      setAuditing(false);
    }
  }

  return (
    <div style={{ borderTop: '1px solid var(--border)', padding: '12px 16px', background: '#fefce8' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: notes ? 10 : 0 }}>
        <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: '#78350f' }}>🔍 AI Audit</span>
        {!notes && (
          <button
            onClick={runAudit}
            disabled={auditing}
            style={{ padding: '4px 12px', borderRadius: 6, background: auditing ? '#d1d5db' : '#92400e', color: 'white', border: 'none', fontSize: '0.8125rem', cursor: auditing ? 'default' : 'pointer', fontWeight: 600 }}
          >
            {auditing ? 'Analysing…' : 'Run AI Audit'}
          </button>
        )}
        {auditedAt && <span style={{ fontSize: '0.75rem', color: '#92400e' }}>Audited {new Date(auditedAt).toLocaleDateString('en-ZA')}</span>}
        {err && <span style={{ fontSize: '0.75rem', color: '#dc2626' }}>{err}</span>}
      </div>
      {notes && (
        <div style={{ margin: 0, fontSize: '0.8125rem', color: '#451a03', lineHeight: 1.6 }}>
          {notes.split('\n').map((line, i) => {
            const isH1 = /^# /.test(line);
            const isH2 = /^## /.test(line);
            const rawText = line.replace(/^#{1,3} /, '');
            if (!rawText.trim()) return <br key={i} />;
            const parts = rawText.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/g).map((part, j) => {
              if (/^\*\*[^*]+\*\*$/.test(part)) return <strong key={j}>{part.slice(2,-2)}</strong>;
              if (/^\*[^*]+\*$/.test(part))   return <em key={j}>{part.slice(1,-1)}</em>;
              return part;
            });
            if (isH1) return <div key={i} style={{ fontWeight: 700, marginTop: i > 0 ? 10 : 0, textTransform: 'uppercase', letterSpacing: '0.05em' }}>{parts}</div>;
            if (isH2) return <div key={i} style={{ fontWeight: 700, marginTop: i > 0 ? 8 : 0 }}>{parts}</div>;
            return <div key={i}>{parts}</div>;
          })}
        </div>
      )}
    </div>
  );
}

function CustomerProfile({ userId, onClose, showToast, mode = 'overlay', users = [], onMerged }) {
  const [data, setData]       = useState(null);
  // Staff list for @mention autocomplete in notes. Cached at the module
  // level would be nicer, but this fetch is cheap (admin only) and we get
  // fresh data each profile open which avoids stale-after-staff-invite.
  const [staff, setStaff]     = useState([]);
  useEffect(() => {
    fetch('/api/admin/staff', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('bondly_token') || '') } })
      .then(r => r.json()).then(d => setStaff(d?.data?.staff || d?.data || [])).catch(() => {});
  }, []);
  const [loading, setLoading] = useState(true);
  const [tab, setTab]         = useState('profile');
  const [noteText, setNoteText] = useState('');
  const [noteType, setNoteType] = useState('note');
  const [addingNote, setAddingNote] = useState(false);
  const [notes, setNotes]     = useState([]);
  const [activityLog, setActivityLog] = useState(null);
  const [activityLoading, setActivityLoading] = useState(false);
  const [resetPw, setResetPw]   = useState('');
  const [resetting, setResetting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    setLoading(true);
    admin.customer(userId)
      .then(d => { setData(d); setNotes(d.notes || []); })
      .catch(() => showToast('Failed to load customer', 'error'))
      .finally(() => setLoading(false));
  }, [userId]);

  useEffect(() => {
    if (tab !== 'timeline' || activityLog !== null) return;
    setActivityLoading(true);
    admin.userActivity(userId)
      .then(d => setActivityLog(d || []))
      .catch(() => setActivityLog([]))
      .finally(() => setActivityLoading(false));
  }, [tab, userId]);

  async function submitNote() {
    if (!noteText.trim()) return;
    setAddingNote(true);
    try {
      const n = await admin.addNote(userId, noteText, noteType);
      setNotes(prev => [n, ...prev]);
      setNoteText('');
      showToast('Note saved');
    } catch { showToast('Failed to save note', 'error'); }
    finally { setAddingNote(false); }
  }

  function copyMemo() {
    if (!memo) return;
    navigator.clipboard.writeText(memo).then(() => showToast('Memo copied to clipboard'));
  }

  async function handleResetPassword() {
    if (!resetPw || resetPw.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
    if (!window.confirm(`Reset password for ${data?.customer?.email}? This action cannot be undone.`)) return;
    setResetting(true);
    try {
      await admin.resetPassword(userId, resetPw);
      showToast(`Password reset for ${data?.customer?.email}`, 'success');
      setResetPw('');
    } catch (e) { showToast(e.message || 'Failed to reset password', 'error'); }
    finally { setResetting(false); }
  }

  const c = data?.customer;
  const rs = data?.riskScore;
  const fin = data?.financial || {};
  const grade = rs?.grade;
  const gradeColor = RISK_COLOR[grade] || '#9ca3af';

  // Build broker memo
  const memo = c ? [
    `BOND SWITCH APPLICATION — ${new Date().toLocaleDateString('en-ZA')}`,
    `${'━'.repeat(52)}`,
    `Applicant:        ${c.name}`,
    `Email:            ${c.email}`,
    `Phone:            ${c.phone || '—'}`,
    `ID Number:        ${c.idNumber ? c.idNumber.slice(0,6)+'••••••' : '—'}`,
    `Risk Grade:       ${grade || '—'} (${rs?.score || '—'}/100 — ${rs?.gradeLabel || ''})`,
    `KYC Status:       ${c.kycStatus === 'approved' ? 'Verified ✓' : c.kycStatus === 'pending_review' ? 'Pending' : 'Not submitted'}`,
    ``,
    `EMPLOYMENT & INCOME`,
    `${'─'.repeat(52)}`,
    `Monthly Income:   ${fin.income ? fmt(fin.income) : '—'}`,
    `Employment Type:  ${(c.employmentType || '').replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase()) || '—'}`,
    `Employer:         ${c.employer || '—'}`,
    `Years Employed:   ${c.employmentYears ? `${c.employmentYears} years` : '—'}`,
    `Monthly Debt:     ${fin.debt ? fmt(fin.debt) : '—'}`,
    `DTI Ratio:        ${fin.dtiRatio != null ? `${fin.dtiRatio}%` : '—'}`,
    ``,
    `AFFORDABILITY (Stress-tested @ 13.25%)`,
    `${'─'.repeat(52)}`,
    `Max Monthly Bond: ${fin.maxMonthly ? fmt(fin.maxMonthly) : '—'}`,
    `Max Bond Amount:  ${fin.maxBond ? fmt(fin.maxBond) : '—'}`,
    ``,
    `CURRENT BONDS`,
    `${'─'.repeat(52)}`,
    ...(data?.loans || []).map((l, i) => [
      `Bond ${i+1}: ${l.bank}`,
      `  Balance:  ${fmt(l.balance||l.amount||0)}`,
      `  Rate:     ${l.rate ? `${l.rate}% p.a.` : '—'}`,
      `  Term:     ${l.termYears || l.term || '—'} years remaining`,
      `  Monthly:  ${l.monthlyPayment ? fmt(l.monthlyPayment) : '—'}`,
    ].join('\n')),
    ``,
    ...(fin.mthSaving > 0 ? [
      `SWITCH POTENTIAL`,
      `${'─'.repeat(52)}`,
      `Potential monthly saving vs current: ${fmt(fin.mthSaving)}/month`,
      `(switching to prime flat ${fin.prime}%)`,
      ``,
    ] : []),
    `PAYMENT HISTORY`,
    `${'─'.repeat(52)}`,
    `Total payments:   ${data?.paymentHistory?.total || 0}`,
    `On time:          ${data?.paymentHistory?.onTime || 0}`,
    `Late:             ${data?.paymentHistory?.late || 0}`,
    `Missed:           ${data?.paymentHistory?.missed || 0}`,
    ``,
    `Generated by Bondly Admin — ${new Date().toLocaleString('en-ZA')}`,
  ].join('\n') : '';

  // Build timeline events — static lifecycle milestones
  const timelineEvents = [];
  if (c?.createdAt) timelineEvents.push({ date: c.createdAt, title: 'Joined Bondly', color: '#4a7fa5', icon: '🏠' });
  (data?.loans || []).forEach(l => { if (l.createdAt) timelineEvents.push({ date: l.createdAt, title: `Added bond — ${l.bank}`, detail: fmt(l.balance||l.amount||0), color: '#16a34a', icon: '🏦' }); });
  (data?.swapApplications || []).forEach(a => { if (a.createdAt) timelineEvents.push({ date: a.createdAt, title: `Applied to switch — ${a.currentBank} → ${a.targetBank}`, detail: a.status?.replace(/_/g,' '), color: '#6366f1', icon: '🔄' }); });
  (data?.payments || []).filter(p=>p.status==='missed'||p.status==='late').forEach(p => { if (p.createdAt||p.date) timelineEvents.push({ date: p.createdAt||p.date, title: `Payment ${p.status}`, detail: p.amount ? fmt(p.amount) : '', color: '#ef4444', icon: '⚠' }); });
  notes.forEach(n => timelineEvents.push({ date: n.createdAt, title: `${n.type.charAt(0).toUpperCase()+n.type.slice(1)} logged`, detail: n.text.slice(0,60)+(n.text.length>60?'…':''), color: '#d97706', icon: '📝' }));

  // Merge activity log events (logins, uploads, errors, snapshots)
  const allTimelineEvents = [...timelineEvents];
  if (activityLog) {
    activityLog.forEach(e => {
      if (e.type === 'login') {
        allTimelineEvents.push({ date: e.at, title: 'Logged in', detail: e.method === 'magic_link' ? 'via magic link' : 'via password', color: '#64748b', icon: '🔑' });
      } else if (e.type === 'statement_upload') {
        const inc = e.incomeDetected;
        allTimelineEvents.push({
          date: e.at,
          title: 'Uploaded statement',
          detail: inc
            ? `Income R ${(e.incomeMonthly||0).toLocaleString('en-ZA')} / mo (${e.incomeConfidence||'?'}) · ${e.bankFormat || '—'} · ${e.txnCount||0} txns`
            : `Income not detected · ${e.bankFormat || '—'} · ${e.txnCount||0} txns`,
          color: inc ? '#10b981' : '#f59e0b',
          icon: inc ? '📊' : '⚠',
        });
      } else if (e.type === 'snapshot_saved') {
        allTimelineEvents.push({
          date: e.at,
          title: 'Analysis snapshot saved',
          detail: [
            e.maxBond ? `Max bond R ${Math.round(e.maxBond).toLocaleString('en-ZA')}` : null,
            e.affordabilityZone ? `zone: ${e.affordabilityZone}` : null,
            e.incomeMonthly ? `income R ${(e.incomeMonthly||0).toLocaleString('en-ZA')}` : null,
          ].filter(Boolean).join(' · ') || '—',
          color: '#8b5cf6',
          icon: '💾',
        });
      } else if (e.type === 'error') {
        allTimelineEvents.push({ date: e.at, title: 'Error', detail: String(e.message||'').slice(0, 100), color: '#ef4444', icon: '🔴' });
      }
    });
  }
  allTimelineEvents.sort((a,b) => new Date(b.date)-new Date(a.date));

  const waLink = c?.phone ? `https://wa.me/${c.phone.replace(/\D/g,'').replace(/^0/,'27')}?text=Hi ${encodeURIComponent(c?.name?.split(' ')[0]||'')}%2C+this+is+Bondly+calling+about+your+bond.` : null;

  const profileContent = (
    <div className={mode === 'inline' ? 'cust-profile cust-profile--inline' : 'cust-profile'}>
      {/* ── Header ── */}
      <div className="cust-profile__header">
        <div className="cust-profile__hero">
          {grade
            ? <div className="cust-profile__grade" style={{ background: gradeColor }}>{grade}</div>
            : <div className="cust-avatar" style={{ background: avatarColor(c?.name), width: mode==='inline'?44:60, height: mode==='inline'?44:60, borderRadius: 10, fontSize: mode==='inline'?'1.1rem':'1.5rem', flexShrink: 0 }}>{c?.name?.[0]?.toUpperCase()||'?'}</div>}
          <div className="cust-profile__info">
            <div className="cust-profile__name" style={{ fontSize: mode==='inline'?'1.1rem':'1.375rem' }}>{loading ? 'Loading…' : (c?.name || 'Unknown')}</div>
            <div className="cust-profile__meta">
              {c?.email && <span>{c.email}</span>}
              {c?.phone && <span style={{ color: 'var(--mint)' }}>{c.phone}</span>}
              {c?.employer && <span>{c.employer}</span>}
              {c?.createdAt && <span>Joined {fmtDate(c.createdAt)}</span>}
            </div>
            <div className="cust-profile__badges">
              {grade && <span className="pill" style={{ background: `${gradeColor}18`, color: gradeColor }}>Grade {grade}{typeof rs?.score === 'number' ? ` — ${rs.score}/100` : ''}</span>}
              <span className={`pill pill--${c?.kycStatus==='approved'?'green':c?.kycStatus==='pending_review'?'blue':'grey'}`}>
                {c?.kycStatus==='approved'?'✓ KYC Verified':c?.kycStatus==='pending_review'?'KYC Pending':'No KYC'}
              </span>
              {fin.dtiRatio != null && (
                <span className="pill" style={{ background: fin.dtiRatio>45?'#ef444418':fin.dtiRatio>35?'#d9770618':'#16a34a18', color: fin.dtiRatio>45?'#ef4444':fin.dtiRatio>35?'#d97706':'#16a34a' }}>
                  DTI {fin.dtiRatio}%
                </span>
              )}
              {(fin.mthSaving||0)>0 && <span className="pill" style={{ background:'rgba(108,187,167,0.12)',color:'var(--mint)' }}>Saves {fmt(fin.mthSaving)}/mo if switched</span>}
            </div>
          </div>
          <div className="cust-profile__actions">
            {waLink && <a href={waLink} target="_blank" rel="noreferrer" className="cust-profile__action-btn cust-profile__action-btn--wa">WhatsApp</a>}
            {c?.email && <a href={`mailto:${c.email}`} className="cust-profile__action-btn">Email</a>}
            {c && <MergeCustomerButton winner={c} users={users} onMerged={onMerged} showToast={showToast} />}
            <button className="cust-profile__action-btn cust-profile__action-btn--primary" onClick={() => setTab('memo')}>Broker Memo</button>
            <button className="cust-profile__action-btn" style={{ color:'#ef4444', borderColor:'#ef444440' }} onClick={() => setConfirmDelete(true)}>Delete</button>
          </div>
          {mode === 'overlay' && <button className="cust-profile__close" onClick={onClose}>×</button>}

          {/* Delete confirmation modal */}
          {confirmDelete && (
            <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', zIndex:9999, display:'flex', alignItems:'center', justifyContent:'center', padding:24 }}
              onClick={e => { if (e.target === e.currentTarget) setConfirmDelete(false); }}>
              <div style={{ background:'var(--bg-card)', borderRadius:14, padding:28, maxWidth:420, width:'100%', boxShadow:'0 20px 60px rgba(0,0,0,0.3)' }}>
                <div style={{ fontSize:'1.5rem', marginBottom:8 }}>⚠️</div>
                <div style={{ fontWeight:700, fontSize:'1.125rem', marginBottom:8 }}>Delete {c?.name || 'this customer'}?</div>
                <div style={{ fontSize:'0.875rem', color:'var(--text-secondary)', marginBottom:20, lineHeight:1.5 }}>
                  This will permanently delete the customer account, all their statements, documents, applications, and session history. <strong>This cannot be undone.</strong>
                </div>
                <div style={{ display:'flex', gap:10 }}>
                  <button disabled={deleting} onClick={() => setConfirmDelete(false)}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'1.5px solid var(--border-color)', background:'var(--bg-page)', color:'var(--text-primary)', fontWeight:600, cursor:'pointer', fontSize:'0.9375rem' }}>
                    Cancel
                  </button>
                  <button disabled={deleting} onClick={async () => {
                    setDeleting(true);
                    try {
                      await admin.deleteCustomer(userId);
                      showToast('Customer deleted', 'success');
                      onClose?.();
                    } catch {
                      showToast('Delete failed — try again', 'error');
                      setDeleting(false);
                      setConfirmDelete(false);
                    }
                  }}
                    style={{ flex:1, padding:'10px 0', borderRadius:8, border:'none', background:'#ef4444', color:'white', fontWeight:700, cursor:deleting?'not-allowed':'pointer', fontSize:'0.9375rem', opacity:deleting?0.7:1 }}>
                    {deleting ? 'Deleting…' : 'Delete permanently'}
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="cust-profile__tabs-row">
          {(() => {
            const stmtDocs = (data?.documents || []).filter(d => d.category === 'bank_statement');
            const stmtCount = stmtDocs.length + (data?.snapshots || []).length + (data?.pdfStatements || []).length;
            return [['profile','Profile'],['financial','Financial'],[`statements`,`Statements${stmtCount > 0 ? ` (${stmtCount})` : ''}`],['bonds','Bonds'],['applications','Applications'],['timeline','Timeline'],['notes',`Notes (${notes.length})`],['memo','Broker Memo']].map(([v,l]) => (
            <button key={v} className={`cust-profile__tab ${tab===v?'active':''}`} onClick={() => setTab(v)}>{l}</button>
          ))}
          )()}
        </div>
      </div>

        {/* ── Body ── */}
        <div className="cust-profile__body">
          {loading && <div style={{ textAlign:'center', padding:60 }}><div className="spinner" style={{ width:40,height:40,borderWidth:3 }}/></div>}

          {/* ─ Profile tab ─ */}
          {!loading && tab==='profile' && c && (
            <div>
              <div className="cp-section">Personal Details</div>
              <div className="cp-grid cp-grid--3">
                {[
                  ['Full Name',        <EditableField userId={c.id} field="name"     value={c.name}  showToast={showToast} onChange={v => setData(d => ({ ...d, customer: { ...d.customer, name: v } }))} />],
                  ['Email Address',    <EditableField userId={c.id} field="email"    value={c.email} type="email" showToast={showToast} onChange={v => setData(d => ({ ...d, customer: { ...d.customer, email: v } }))} />],
                  ['Phone Number',     <EditableField userId={c.id} field="phone"    value={c.phone} placeholder="—" showToast={showToast} onChange={v => setData(d => ({ ...d, customer: { ...d.customer, phone: v } }))} />],
                  ['ID Number',        c.idNumber ? c.idNumber.slice(0,6)+'••••••' : '—'],
                  ['Date Joined',      fmtDate(c.createdAt)],
                  ['Email Verified',   c.emailVerified ? 'Yes ✓' : 'No'],
                ].map(([l,v]) => <div key={l} className="cp-field"><div className="cp-field__label">{l}</div><div className="cp-field__value">{v}</div></div>)}
              </div>

              <div className="cp-section">Risk Score Breakdown</div>
              {rs?.factors?.length > 0 ? rs.factors.map(f => (
                <div key={f.name} className="cp-risk-row">
                  <div className="cp-risk-row__label">{f.name}</div>
                  <div className="cp-risk-row__bar-wrap"><div className="cp-risk-row__bar" style={{ width:`${f.score}%`, background: gradeColor }}/></div>
                  <div className="cp-risk-row__score" style={{ color: gradeColor }}>{f.score}</div>
                </div>
              )) : <p style={{ color:'var(--text-secondary)', fontSize:'0.875rem' }}>Risk data unavailable — add bond & payment history first</p>}

              {data?.rateAlert && (
                <>
                  <div className="cp-section">Active Alerts</div>
                  <div className="cp-field" style={{ marginBottom:10 }}>
                    <div className="cp-field__label">Rate Target Alert</div>
                    <div className="cp-field__value">
                      Notify when prime {data.rateAlert.direction==='at_or_below'?'drops to':'rises to'} {data.rateAlert.targetRate}%
                      {data.rateAlert.triggeredAt && <span style={{ color:'#9ca3af', marginLeft:8 }}>(triggered {fmtDate(data.rateAlert.triggeredAt)})</span>}
                    </div>
                  </div>
                </>
              )}

              {(data?.referrals||[]).length > 0 && (
                <>
                  <div className="cp-section">Referrals Made ({data.referrals.length})</div>
                  <div className="cp-grid cp-grid--3">
                    {data.referrals.map(r => (
                      <div key={r.id} className="cp-field">
                        <div className="cp-field__label">Referred</div>
                        <div className="cp-field__value">{r.refereeName}</div>
                        <div className="cp-field__value cp-field__value--muted" style={{ fontSize:'0.8rem', marginTop:2 }}>{r.refereeEmail}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              <div className="cp-section">Account Actions</div>
              <div style={{ display:'flex', gap: 10, alignItems:'center', flexWrap:'wrap' }}>
                <input
                  type="password"
                  placeholder="New password (min 8 chars)"
                  value={resetPw}
                  onChange={e => setResetPw(e.target.value)}
                  style={{ flex:1, minWidth:200, padding:'8px 12px', border:'1px solid var(--border-color)', borderRadius:6, background:'var(--bg-page)', color:'var(--text-primary)', fontSize:'0.875rem' }}
                />
                <button
                  onClick={handleResetPassword}
                  disabled={resetting || resetPw.length < 8}
                  style={{ padding:'8px 16px', background:'#ef4444', color:'#fff', border:'none', borderRadius:6, fontSize:'0.875rem', fontWeight:600, cursor:'pointer', opacity: resetPw.length < 8 ? 0.5 : 1 }}
                >
                  {resetting ? 'Resetting…' : 'Reset password'}
                </button>
              </div>
            </div>
          )}

          {/* ─ Financial tab ─ */}
          {!loading && tab==='financial' && c && (
            <div>
              <div className="cp-section">Income & Employment</div>
              <div className="cp-grid cp-grid--3">
                {[
                  ['Monthly Income',    fin.income ? fmt(fin.income) : '—'],
                  ['Employment Type',   c.employmentType?.replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase())||'—'],
                  ['Years Employed',    c.employmentYears ? `${c.employmentYears} yrs` : '—'],
                  ['Employer',         c.employer||'—'],
                  ['Monthly Debt',     fin.debt ? fmt(fin.debt) : '—'],
                  ['Net Available',    fin.income&&fin.debt ? fmt(fin.income-fin.debt) : '—'],
                ].map(([l,v]) => <div key={l} className="cp-field"><div className="cp-field__label">{l}</div><div className="cp-field__value">{v}</div></div>)}
              </div>

              {fin.income > 0 && (
                <>
                  <div className="cp-section">Debt-to-Income Ratio</div>
                  <div style={{ background:'var(--bg-page)', border:'1px solid var(--border-color)', borderRadius:12, padding:'16px 20px', marginBottom:16 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', marginBottom:8 }}>
                      <span style={{ fontWeight:700, fontSize:'1.5rem' }}>{fin.dtiRatio}%</span>
                      <span style={{ padding:'4px 12px', borderRadius:20, fontSize:'0.8125rem', fontWeight:700, background: fin.dtiRatio>45?'#ef444418':fin.dtiRatio>35?'#d9770618':'#16a34a18', color: fin.dtiRatio>45?'#ef4444':fin.dtiRatio>35?'#d97706':'#16a34a' }}>
                        {fin.dtiRatio>45?'High Risk':fin.dtiRatio>35?'Moderate':'Healthy'}
                      </span>
                    </div>
                    <div className="cp-bar-wrap">
                      <div className="cp-bar" style={{ width:`${Math.min(fin.dtiRatio,100)}%`, background: fin.dtiRatio>45?'#ef4444':fin.dtiRatio>35?'#d97706':'#16a34a' }}/>
                    </div>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.75rem', color:'var(--text-secondary)', marginTop:6 }}>
                      <span>0%</span><span style={{ color:'#16a34a' }}>Good ≤35%</span><span style={{ color:'#d97706' }}>35–45%</span><span style={{ color:'#ef4444' }}>High risk 45%+</span><span>100%</span>
                    </div>
                    <div style={{ marginTop:12, fontSize:'0.8375rem', color:'var(--text-secondary)' }}>
                      Monthly income {fmt(fin.income)} · Monthly debt {fmt(fin.debt)} · Available for bond payments {fmt(Math.max(0,fin.income-fin.debt))}
                    </div>
                  </div>
                </>
              )}

              {fin.maxBond > 0 && (
                <>
                  <div className="cp-section">Affordability (Stress Test @ 13.25%)</div>
                  <div className="cp-grid cp-grid--3">
                    {[
                      ['Max Monthly Payment',  fmt(fin.maxMonthly)],
                      ['Max Bond Amount',       fmt(fin.maxBond)],
                      ['Qualifying At',         `${fin.prime}% prime flat`],
                    ].map(([l,v]) => (
                      <div key={l} className="cp-field" style={{ borderLeft:`4px solid #16a34a` }}>
                        <div className="cp-field__label">{l}</div>
                        <div className="cp-field__value" style={{ color:'#16a34a' }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {fin.totalBalance > 0 && fin.mthSaving > 0 && (
                <>
                  <div className="cp-section">Switch Potential</div>
                  <div style={{ background:'rgba(108,187,167,0.08)', border:'1px solid rgba(108,187,167,0.25)', borderRadius:12, padding:'16px 20px' }}>
                    <div style={{ fontSize:'0.875rem', color:'var(--text-secondary)', marginBottom:8 }}>
                      If this customer switched to prime flat today ({fin.prime}%), they would save:
                    </div>
                    <div style={{ fontSize:'1.5rem', fontWeight:800, color:'var(--mint)' }}>{fmt(fin.mthSaving)}/month</div>
                    <div style={{ fontSize:'0.875rem', color:'var(--text-secondary)', marginTop:4 }}>Est. Bondly commission: <strong style={{ color:'var(--text-primary)' }}>{fmt(fin.totalBalance*0.005)}</strong></div>
                  </div>
                </>
              )}

              {/* Payment health */}
              {data?.paymentHistory?.total > 0 && (
                <>
                  <div className="cp-section">Payment Health</div>
                  <div className="cp-grid cp-grid--4">
                    {[
                      ['Total',   data.paymentHistory.total,   '#4a7fa5'],
                      ['On Time', data.paymentHistory.onTime,  '#16a34a'],
                      ['Late',    data.paymentHistory.late,    '#d97706'],
                      ['Missed',  data.paymentHistory.missed,  '#ef4444'],
                    ].map(([l,v,c]) => (
                      <div key={l} className="cp-field" style={{ borderLeft:`4px solid ${c}` }}>
                        <div className="cp-field__label">{l}</div>
                        <div className="cp-field__value" style={{ color:c }}>{v}</div>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {/* Financial fitness snapshots (from statement analysis) */}
              {(() => {
                // Prefer vault docs with analysis; fall back to spendingSnapshots
                const analysedDocs = (data?.documents || []).filter(d => d.category === 'bank_statement' && d.analysis);
                const snapshots    = (data?.snapshots || []);
                if (!analysedDocs.length && !snapshots.length) return null;

                // Use latest vault doc analysis if available, else latest snapshot
                let az, sourceLabel, uploadCount;
                if (analysedDocs.length) {
                  const latest = [...analysedDocs].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))[0];
                  az = latest.analysis;
                  sourceLabel = latest.originalName;
                  uploadCount = analysedDocs.length;
                } else {
                  const latest = snapshots[0];
                  az = latest;
                  sourceLabel = `Statement analysis`;
                  uploadCount = snapshots.length;
                }

                const zone = az.affordabilityZone?.zone;
                const zoneColor = zone === 'green' ? '#16a34a' : zone === 'yellow' ? '#d97706' : '#ef4444';
                const inc = az.income?.monthlyAmount || 0;
                const maxBondVal = az.qualification?.maxBond || 0;
                const readinessScore = az.readiness?.score ?? (typeof az.readiness === 'number' ? az.readiness : null);
                const expBreakdown = az.expenses?.breakdown || {};

                return (
                  <>
                    <div className="cp-section" style={{ display:'flex', alignItems:'center', gap:8, flexWrap:'wrap' }}>
                      Financial Fitness
                      {zone && <span style={{ padding:'2px 8px', borderRadius:10, fontSize:'0.75rem', fontWeight:700, background:`${zoneColor}18`, color:zoneColor }}>{az.affordabilityZone?.label || zone}</span>}
                      {readinessScore !== null && <span style={{ padding:'2px 8px', borderRadius:10, fontSize:'0.75rem', fontWeight:700, background:'var(--bg-page)', color:'var(--text-secondary)' }}>Readiness {readinessScore}/100</span>}
                      <span style={{ marginLeft:'auto', fontWeight:400, fontSize:'0.8125rem', color:'var(--text-secondary)' }}>{uploadCount} upload{uploadCount!==1?'s':''} · {sourceLabel}</span>
                    </div>

                    {/* Income + bond grid */}
                    <div className="cp-grid cp-grid--3" style={{ marginBottom:12 }}>
                      {[
                        ['Detected Income',    az.income?.detected ? fmt(inc) : '—'],
                        ['Income Confidence',  az.income?.confidence || '—'],
                        ['Employment',        az.income?.employmentType?.replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase()) || '—'],
                        ['Monthly Debt',      az.debts?.totalMonthly > 0 ? fmt(az.debts.totalMonthly) : 'None'],
                        ['Max Bond',          maxBondVal > 0 ? fmt(maxBondVal) : '—'],
                        ['Uploads',           `${uploadCount} statement${uploadCount!==1?'s':''}`],
                      ].map(([l,v]) => <div key={l} className="cp-field"><div className="cp-field__label">{l}</div><div className="cp-field__value">{v}</div></div>)}
                    </div>

                    {/* Spending breakdown */}
                    {inc > 0 && Object.keys(expBreakdown).length > 0 && (
                      <div style={{ background:'var(--bg-page)', border:'1px solid var(--border-color)', borderRadius:10, padding:'12px 16px', marginBottom:12 }}>
                        <div style={{ fontSize:'0.75rem', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-secondary)', marginBottom:8 }}>Spending Breakdown</div>
                        <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                          {Object.entries(expBreakdown).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([cat, amt]) => {
                            const pct = Math.round((amt/inc)*100);
                            const isHigh = cat === 'fuel' && pct > 20;
                            return (
                              <div key={cat} style={{ display:'flex', alignItems:'center', gap:8 }}>
                                <div style={{ width:80, fontSize:'0.75rem', color:'var(--text-secondary)', textTransform:'capitalize', flexShrink:0 }}>{cat}</div>
                                <div style={{ flex:1, height:6, background:'var(--border-color)', borderRadius:3, overflow:'hidden' }}>
                                  <div style={{ height:'100%', width:`${Math.min(pct,100)}%`, background: isHigh ? '#d97706' : 'var(--mint)', borderRadius:3 }} />
                                </div>
                                <div style={{ width:80, fontSize:'0.75rem', textAlign:'right', color: isHigh ? '#d97706' : 'var(--text-primary)', fontWeight:600 }}>{fmt(amt)} <span style={{ color:'var(--text-secondary)', fontWeight:400 }}>({pct}%)</span></div>
                              </div>
                            );
                          })}
                          <div style={{ display:'flex', justifyContent:'space-between', marginTop:4, paddingTop:6, borderTop:'1px solid var(--border-color)', fontSize:'0.8125rem', fontWeight:600 }}>
                            <span>Total spend</span>
                            <span>{fmt(az.expenses?.total || 0)}</span>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* All snapshots timeline */}
                    {snapshots.length > 1 && (
                      <div style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', marginBottom:4 }}>
                        {snapshots.length} snapshots on file · latest {fmtDate(snapshots[0]?.uploadedAt)}
                      </div>
                    )}
                  </>
                );
              })()}
            </div>
          )}

          {/* ─ Bonds tab ─ */}
          {!loading && tab==='bonds' && (
            (data?.loans||[]).length===0
              ? <div style={{ textAlign:'center', padding:60, color:'var(--text-secondary)' }}>No bonds registered yet</div>
              : (data.loans).map(loan => {
                  const r = parseFloat(loan.rate)||0;
                  const prime = fin.prime||11.25;
                  const saving = r > prime ? Math.round((r-prime)/100/12 * (parseFloat(loan.balance||loan.amount)||0)) : 0;
                  return (
                    <div key={loan.id} className="cp-bond">
                      <div className="cp-bond__header">
                        <div className="cp-bond__bank">{loan.bank}</div>
                        <span className="pill pill--blue" style={{ fontSize:'0.9rem', fontWeight:800 }}>{loan.rate}% p.a.</span>
                      </div>
                      <div className="cp-bond__stats">
                        {[
                          ['Outstanding Balance', fmt(loan.balance||loan.amount||0)],
                          ['Monthly Payment',     loan.monthlyPayment ? fmt(loan.monthlyPayment) : '—'],
                          ['Term Remaining',      `${loan.termYears||loan.term||'—'} years`],
                          ['Account No.',         loan.accountNumber||'—'],
                        ].map(([l,v]) => <div key={l} className="cp-bond__stat"><label>{l}</label><strong>{v}</strong></div>)}
                      </div>
                      {saving > 0 && (
                        <div className="cp-bond__saving">
                          Potential saving at prime flat ({prime}%): <strong>{fmt(saving)}/month</strong> · Est. commission: <strong>{fmt((parseFloat(loan.balance||loan.amount)||0)*0.005)}</strong>
                        </div>
                      )}
                    </div>
                  );
                })
          )}

          {/* ─ Applications tab ─ */}
          {!loading && tab==='applications' && (
            (data?.swapApplications||[]).length===0
              ? <div style={{ textAlign:'center', padding:60, color:'var(--text-secondary)' }}>No applications submitted yet</div>
              : (data.swapApplications).map(app => (
                  <div key={app.id} style={{ background:'var(--bg-page)', border:'1px solid var(--border-color)', borderRadius:12, padding:18, marginBottom:14 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:12 }}>
                      <div>
                        <div style={{ fontWeight:700, fontSize:'1rem' }}>{app.currentBank} → {app.targetBank}</div>
                        <div style={{ fontSize:'0.8rem', color:'var(--text-secondary)', marginTop:2 }}>Applied {fmtDate(app.createdAt)}</div>
                      </div>
                      <span style={{ padding:'4px 12px', borderRadius:20, fontSize:'0.8125rem', fontWeight:700, background:`${SWAP_STATUS_COLORS[app.status]||'#6366f1'}18`, color:SWAP_STATUS_COLORS[app.status]||'#6366f1' }}>
                        {app.status?.replace(/_/g,' ')}
                      </span>
                    </div>
                    <div className="cp-grid cp-grid--4" style={{ marginBottom:0 }}>
                      {[
                        ['Balance',     app.currentBalance ? fmt(app.currentBalance) : '—'],
                        ['Current Rate',app.currentRate    ? `${app.currentRate}%` : '—'],
                        ['Monthly Save',app.monthlySaving  ? fmt(app.monthlySaving)+'/mo' : '—'],
                        ['Offered Rate',app.offeredRate    ? `${app.offeredRate}%` : 'Pending'],
                      ].map(([l,v]) => <div key={l} className="cp-field" style={{ padding:'10px 12px' }}><div className="cp-field__label">{l}</div><div className="cp-field__value" style={{ fontSize:'0.875rem' }}>{v}</div></div>)}
                    </div>
                    {(app.notes||[]).length>0 && (
                      <div style={{ marginTop:12, borderTop:'1px solid var(--border-color)', paddingTop:12 }}>
                        {app.notes.map((n,i) => (
                          <div key={i} style={{ fontSize:'0.8125rem', marginBottom:6 }}>
                            <span style={{ color:'var(--text-secondary)' }}>{fmtDate(n.at)} · </span>
                            <span>{n.text}</span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))
          )}

          {/* ─ Timeline tab — new server-aggregated activity feed ─ */}
          {!loading && tab==='timeline' && (
            <ActivityTimeline userId={userId} />
          )}

          {/* ─ Legacy timeline (kept for fallback comparison while we
              validate the new feed against real production data) ─ */}
          {false && !loading && tab==='timeline' && (
            activityLoading
              ? <div style={{ textAlign:'center', padding:40 }}><div className="spinner" style={{ width:32,height:32,borderWidth:3 }}/></div>
              : allTimelineEvents.length===0
                ? <div style={{ textAlign:'center', padding:60, color:'var(--text-secondary)' }}>No activity yet</div>
                : <ul className="cp-timeline">
                    {allTimelineEvents.map((e,i) => (
                      <li key={i} className="cp-timeline__item">
                        <div className="cp-timeline__dot" style={{ background: e.color }}>
                          {e.icon && <span style={{ fontSize:'0.65rem', lineHeight:1 }}>{e.icon}</span>}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div className="cp-timeline__title" style={{ color: e.color === '#ef4444' ? '#ef4444' : undefined }}>{e.title}</div>
                          {e.detail && <div className="cp-timeline__detail" style={{ whiteSpace:'normal' }}>{e.detail}</div>}
                          <div className="cp-timeline__detail">{fmtDate(e.date)}</div>
                        </div>
                      </li>
                    ))}
                  </ul>
          )}

          {/* ─ Notes tab ─ */}
          {!loading && tab==='notes' && (
            <div>
              <div className="cp-add-note">
                <div style={{ fontWeight:700, fontSize:'0.875rem', marginBottom:10 }}>Log interaction</div>
                <div style={{ display:'flex', gap:6, marginBottom:10, flexWrap:'wrap' }}>
                  {NOTE_TYPES.map(t => (
                    <button key={t.id} className={`cp-note-type-btn ${noteType===t.id?'active':''}`}
                      style={noteType===t.id?{borderColor:t.color,color:t.color,background:t.bg}:{}}
                      onClick={() => setNoteType(t.id)}>{t.label}</button>
                  ))}
                </div>
                <MentionInput value={noteText} onChange={setNoteText} staff={staff} placeholder={`Add a ${noteType} note… (type @ to mention staff)`} rows={3} />
                <div className="cp-add-note__actions">
                  <button onClick={submitNote} disabled={addingNote||!noteText.trim()}
                    style={{ padding:'7px 18px', borderRadius:8, background:'var(--forest)', color:'white', border:'none', fontWeight:700, fontSize:'0.875rem', cursor:'pointer', opacity:noteText.trim()?1:0.5 }}>
                    {addingNote ? 'Saving…' : 'Save note'}
                  </button>
                </div>
              </div>

              {notes.length===0
                ? <div style={{ textAlign:'center', padding:40, color:'var(--text-secondary)' }}>No notes yet — log your first interaction above</div>
                : notes.map(n => {
                    const nt = NOTE_TYPES.find(t=>t.id===n.type)||NOTE_TYPES[0];
                    return (
                      <div key={n.id} className="cp-note">
                        <div className="cp-note__header">
                          <span className="cp-note__type-pill" style={{ background:nt.bg, color:nt.color }}>{nt.label}</span>
                          <span className="cp-note__author">{n.adminName}</span>
                          <span className="cp-note__date">{new Date(n.createdAt).toLocaleString('en-ZA')}</span>
                        </div>
                        <div className="cp-note__text">{renderWithMentions(n.text)}</div>
                      </div>
                    );
                  })}
            </div>
          )}

          {/* ─ Statements tab ─ */}
          {!loading && tab==='statements' && (() => {
            const stmtDocs = (data?.documents || []).filter(d => d.category === 'bank_statement')
              .map(d => ({ ...d, _type: 'doc', _date: d.createdAt }));
            const snaps = (data?.snapshots || [])
              .map(s => ({ ...s, _type: 'snap', _date: s.uploadedAt }));
            const pdfs = (data?.pdfStatements || [])
              .map(s => ({ ...s, _type: 'pdf', _date: s.uploadedAt }));
            // Merge all three — PDFs and docs are real files; snapshots fill in when no file retained
            const all = [...pdfs, ...stmtDocs, ...snaps].sort((a, b) => new Date(b._date) - new Date(a._date));
            const fmt = n => `R ${Math.round(n).toLocaleString('en-ZA')}`;
            const fmtBytes = b => b > 1024*1024 ? `${(b/1024/1024).toFixed(1)} MB` : `${Math.round(b/1024)} KB`;
            const ZONE_COLOR = { green:'#16a34a', yellow:'#d97706', red:'#ef4444', orange:'#f97316' };
            return (
              <div>
                {all.length === 0 ? (
                  <div style={{ textAlign:'center', padding:60, color:'var(--text-secondary)' }}>
                    No statements on file yet — they'll appear here after the customer uploads one.
                  </div>
                ) : (
                  <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
                    {all.map((item, i) => {
                      const az = item._type === 'doc' ? item.analysis?.affordabilityZone : item.affordabilityZone;
                      const income = item._type === 'pdf' ? item.incomeMonthly : item._type === 'doc' ? item.analysis?.income?.monthlyAmount : item.income?.monthlyAmount;
                      const maxBond = item._type === 'doc' ? item.analysis?.qualification?.maxBond : item.qualification?.maxBond;
                      const readiness = item._type === 'doc' ? item.analysis?.readiness?.score : item.readiness?.score;
                      const zone = az?.zone;
                      const zoneColor = ZONE_COLOR[zone] || '#9ca3af';
                      return (
                        <div key={item.id || i} style={{ border:'1px solid var(--border)', borderRadius:10, overflow:'hidden' }}>
                          {/* Header */}
                          <div
                            onClick={() => {
                              if (item._type === 'doc' && item.filename)
                                window.open(`/api/admin/vault/${item.userId}/${item.filename}?token=${localStorage.getItem('bondly_token')||''}`, '_blank');
                              else if (item._type === 'pdf')
                                fetch(`/api/admin/statements/${item.id}/download`, { headers: { Authorization: 'Bearer ' + localStorage.getItem('bondly_token') } })
                                  .then(r => r.blob()).then(blob => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = item.filename; a.click(); });
                            }}
                            style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'var(--bg-card)', borderBottom:'1px solid var(--border)', cursor: (item._type === 'doc' && item.filename) || item._type === 'pdf' ? 'pointer' : 'default' }}
                          >
                            <div style={{ fontSize:'1.25rem' }}>📄</div>
                            <div style={{ flex:1, minWidth:0 }}>
                              <div style={{ fontWeight:600, fontSize:'0.9375rem', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                                {item._type === 'doc' ? (item.originalName || item.label || 'Bank Statement') : item._type === 'pdf' ? (item.filename || 'Bank Statement PDF') : 'Statement Analysis'}
                              </div>
                              <div style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', marginTop:2 }}>
                                {item._date ? new Date(item._date).toLocaleString('en-ZA', { dateStyle:'medium', timeStyle:'short' }) : 'Unknown date'}
                                {item._type === 'doc' && item.size ? ` · ${fmtBytes(item.size)}` : ''}
                                {item._type === 'pdf' && item.sizeBytes ? ` · ${fmtBytes(item.sizeBytes)}` : ''}
                                {item._type === 'pdf' && item.bankFormat ? ` · ${item.bankFormat}` : ''}
                                {item._type === 'snap' && <span style={{ marginLeft:6, fontSize:'0.75rem', color:'#9ca3af', fontStyle:'italic' }}>{' · '}Analysis only — statement file not stored</span>}
                                {item._type === 'pdf' && <span style={{ marginLeft:6, fontSize:'0.75rem', color:'var(--forest)', fontStyle:'italic' }}>{' · '}click to download</span>}
                              </div>
                            </div>
                            <div style={{ display:'flex', gap:8, alignItems:'center', flexShrink:0 }}>
                              {/* Accuracy flag */}
              {item.accuracyRating === 'not_accurate' && (
                <span title='User flagged as inaccurate' style={{ padding:'2px 8px', borderRadius:10, fontSize:'0.75rem', fontWeight:700, background:'#fee2e2', color:'#dc2626', flexShrink:0 }}>🚩 Flagged</span>
              )}
              {item.accuracyRating === 'some_issues' && (
                <span title='User flagged some issues' style={{ padding:'2px 8px', borderRadius:10, fontSize:'0.75rem', fontWeight:700, background:'#fef3c7', color:'#d97706', flexShrink:0 }}>⚠ Issues</span>
              )}
              {zone && <span style={{ padding:'2px 9px', borderRadius:10, fontSize:'0.75rem', fontWeight:700, background:zoneColor+'18', color:zoneColor }}>{az?.label || zone}</span>}
                              {item._type === 'doc' && item.filename && (
                                <a
                                  href={`/api/admin/vault/${item.userId}/${item.filename}?token=${localStorage.getItem('bondly_token')||''}`}
                                  target="_blank"
                                  rel="noreferrer"
                                  style={{ padding:'5px 12px', borderRadius:6, background:'var(--forest)', color:'white', fontSize:'0.8125rem', fontWeight:600, textDecoration:'none', whiteSpace:'nowrap' }}
                                >
                                  Download
                                </a>
                              )}
                            </div>
                          </div>
                          {/* Analysis summary */}
                          {(income || maxBond || readiness != null) && (
                            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fit, minmax(120px,1fr))', gap:1, background:'var(--border)' }}>
                              {[
                                ['Income', income ? fmt(income) : null],
                                ['Max Bond', maxBond ? fmt(maxBond) : null],
                                ['Readiness', readiness != null ? `${readiness}/100` : null],
                                ['Employment', ((item._type==='doc' ? item.analysis?.income?.employmentType : item.income?.employmentType) || '').replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase()) || null],
                              ].filter(([,v]) => v).map(([label, val]) => (
                                <div key={label} style={{ background:'var(--bg-page)', padding:'10px 14px' }}>
                                  <div style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-secondary)', marginBottom:3 }}>{label}</div>
                                  <div style={{ fontWeight:700, fontSize:'0.9375rem' }}>{val}</div>
                                </div>
                              ))}
                            </div>
                          )}
                          {/* Spending breakdown */}
                          {(() => {
                            const expenses = item._type === 'doc' ? item.analysis?.expenses?.breakdown : item.expenses?.breakdown;
                            if (!expenses) return null;
                            const total = Object.values(expenses).reduce((s,v)=>s+(v||0),0);
                            if (!total) return null;
                            const CAT_LABELS = { fuel:'Transport', groceries:'Groceries', utilities:'Utilities', subscriptions:'Subscriptions', other:'Other' };
                            const entries = Object.entries(expenses).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]);
                            return (
                              <div style={{ padding:'12px 16px', background:'var(--bg-page)' }}>
                                <div style={{ fontSize:'0.75rem', textTransform:'uppercase', letterSpacing:'0.05em', color:'var(--text-secondary)', marginBottom:8 }}>Spending Breakdown</div>
                                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                                  {entries.map(([cat, amt]) => {
                                    const pct = Math.round(amt/total*100);
                                    return (
                                      <div key={cat} style={{ display:'flex', alignItems:'center', gap:8 }}>
                                        <div style={{ width:90, fontSize:'0.8125rem', color:'var(--text-secondary)', flexShrink:0 }}>{CAT_LABELS[cat]||cat}</div>
                                        <div style={{ flex:1, height:6, background:'var(--border)', borderRadius:3, overflow:'hidden' }}>
                                          <div style={{ width:`${pct}%`, height:'100%', background: cat==='fuel'?'#f97316':'var(--forest)', borderRadius:3 }}/>
                                        </div>
                                        <div style={{ width:100, fontSize:'0.8125rem', textAlign:'right', flexShrink:0 }}>{fmt(amt)} <span style={{color:'var(--text-secondary)'}}>({pct}%)</span></div>
                                      </div>
                                    );
                                  })}
                                </div>
                              </div>
                            );
                          })()}
                          {/* Transaction detail — collapsible per category */}
                          {(() => {
                            const topTxns = item._type === 'doc'
                              ? item.analysis?.topTransactions
                              : item.topTransactions;
                            if (!topTxns || !Object.keys(topTxns).length) return null;
                            const TXN_LABELS = { fuel:'Transport', groceries:'Groceries', utilities:'Utilities', subscriptions:'Subscriptions', insurance:'Insurance', entertainment:'Entertainment', dining_out:'Dining out', gambling:'Gambling', other:'Other' };
                            return (
                              <details style={{ borderTop:'1px solid var(--border)' }}>
                                <summary style={{ padding:'9px 16px', fontSize:'0.8125rem', fontWeight:600, color:'var(--text-secondary)', cursor:'pointer', userSelect:'none', listStyle:'none', display:'flex', alignItems:'center', gap:6, background:'var(--bg-page)' }}>
                                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polyline points="6 9 12 15 18 9"/></svg>
                                  Show individual transactions
                                </summary>
                                <div style={{ padding:'10px 16px 14px', background:'var(--bg-page)', display:'flex', flexDirection:'column', gap:12 }}>
                                  {Object.entries(topTxns).filter(([,txns])=>txns.length).map(([cat, txns]) => (
                                    <div key={cat}>
                                      <div style={{ fontSize:'0.7rem', textTransform:'uppercase', letterSpacing:'0.06em', color:'var(--text-secondary)', marginBottom:5, fontWeight:700 }}>{TXN_LABELS[cat]||cat}</div>
                                      {txns.map((t,i) => (
                                        <div key={i} style={{ display:'flex', justifyContent:'space-between', padding:'4px 0', borderBottom:'1px solid var(--border)', fontSize:'0.8125rem', gap:8 }}>
                                          <span style={{ color:'var(--text-primary)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }} title={t.description}>{t.description}</span>
                                          <span style={{ fontWeight:600, flexShrink:0 }}>{fmt(t.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  ))}
                                </div>
                              </details>
                            );
                          })()}
                          {/* AI Audit section for flagged snapshots */}
                          {item._type === 'snap' && (item.accuracyRating === 'not_accurate' || item.accuracyRating === 'some_issues' || item.auditNotes) && (
                            <AuditPanel snapshot={item} />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })()}

                    {/* ─ Broker Memo tab ─ */}
          {!loading && tab==='memo' && (
            <div>
              <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:16, gap: 8, flexWrap: 'wrap' }}>
                <div>
                  <div style={{ fontWeight:700 }}>Broker Submission Memo</div>
                  <div style={{ fontSize:'0.8125rem', color:'var(--text-secondary)', marginTop:2 }}>Auto-generated from customer profile — copy + send, or open the PDF below for the bank pack</div>
                </div>
                <div style={{ display: 'flex', gap: 8 }}>
                  {/* PDF view of the most recent submitted application — the same
                      pack we'd actually send to a bank. Only renders when the
                      customer has at least one application in flight. */}
                  {(data?.applications || []).slice(0, 1).map(a => {
                    const tok = encodeURIComponent(localStorage.getItem('bondly_token') || '');
                    return (
                      <span key={a.id} style={{ display:'inline-flex', gap:6 }}>
                        <a href={`/api/admin/applications/${a.id}/broker-pdf?token=${tok}`}
                           target="_blank" rel="noopener noreferrer"
                           className="cust-profile__action-btn">
                          Preview bank PDF →
                        </a>
                        <a href={`/api/admin/applications/${a.id}/broker-pack.zip?token=${tok}`}
                           className="cust-profile__action-btn">
                          Download full pack (ZIP) →
                        </a>
                      </span>
                    );
                  })}
                  <button onClick={copyMemo} className="cust-profile__action-btn cust-profile__action-btn--primary">Copy memo</button>
                </div>
              </div>
              <pre className="cp-broker-memo">{memo}</pre>
            </div>
          )}
        </div>
      </div>
  );

  if (mode === 'inline') return profileContent;
  return (
    <div className="cust-profile-overlay" onClick={e => e.target === e.currentTarget && onClose()}>
      {profileContent}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ALERTS WAITLIST TAB
// ═══════════════════════════════════════════════════════════

// ═══════════════════════════════════════════════════════════
//  COMMISSIONS TAB
// ═══════════════════════════════════════════════════════════
function CommissionsTab({ data, setData, showToast }) {
  const { commissions = [], totals = {} } = data;
  const [filter, setFilter] = useState('all');
  const [addOpen, setAddOpen] = useState(false);
  const [addForm, setAddForm] = useState({ bank: '', loanAmount: '', actualAmount: '', invoiceRef: '', notes: '' });

  const filtered = filter === 'all' ? commissions : commissions.filter(c => c.status === filter);
  const totalAll = (totals.pending || 0) + (totals.received || 0) + (totals.reconciled || 0);

  async function updateStatus(id, status) {
    try {
      const updated = await admin.updateCommission(id, { status });
      setData(d => ({ ...d, commissions: d.commissions.map(c => c.id === id ? updated : c) }));
      showToast('Status updated', 'success');
    } catch { showToast('Failed to update', 'error'); }
  }

  return (
    <div className="fade-in">
      {/* Summary cards */}
      <div className="comm-summary">
        {[
          { label: 'Pending',    value: fmt(totals.pending    || 0), sub: `${commissions.filter(c=>c.status==='pending').length} records`,    color: '#f59e0b' },
          { label: 'Received',   value: fmt(totals.received   || 0), sub: `${commissions.filter(c=>c.status==='received').length} records`,   color: '#3b82f6' },
          { label: 'Reconciled', value: fmt(totals.reconciled || 0), sub: `${commissions.filter(c=>c.status==='reconciled').length} records`, color: '#16a34a' },
          { label: 'Total Pipeline', value: fmt(totalAll), sub: 'All statuses combined', color: '#6366f1' },
        ].map(k => (
          <div key={k.label} className="comm-card">
            <div className="adm-kpi-accent" style={{ background: k.color }} />
            <div className="comm-card__label">{k.label}</div>
            <div className="comm-card__value" style={{ color: k.color }}>{k.value}</div>
            <div className="comm-card__sub">{k.sub}</div>
          </div>
        ))}
      </div>

      {/* Actions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {[['all','All'],['pending','Pending'],['received','Received'],['reconciled','Reconciled']].map(([v,l]) => (
          <button key={v} className={`cust-filter-chip ${filter === v ? 'active' : ''}`} onClick={() => setFilter(v)}>{l}</button>
        ))}
        <button className="adm-quick-action adm-quick-action--primary" style={{ marginLeft: 'auto' }} onClick={() => setAddOpen(true)}>+ Log commission</button>
      </div>

      <div className="cust-table-wrap">
        <table className="data-table">
          <thead><tr><th>Bank</th><th>Loan Amount</th><th>Commission</th><th>Status</th><th>Invoice Ref</th><th>Date</th><th>Actions</th></tr></thead>
          <tbody>
            {filtered.length === 0 ? (
              <tr><td colSpan={7} style={{ textAlign: 'center', padding: 'var(--space-8)', color: 'var(--text-secondary)' }}>No commissions recorded yet</td></tr>
            ) : filtered.map(c => (
              <tr key={c.id}>
                <td style={{ fontWeight: 600 }}>{c.bank || '—'}</td>
                <td>{c.loanAmount ? fmt(c.loanAmount) : '—'}</td>
                <td style={{ fontWeight: 700 }}>{fmt(c.actualAmount || c.estimatedAmount || 0)}{!c.actualAmount && c.estimatedAmount ? <span style={{ color: 'var(--text-secondary)', fontWeight: 400 }}> est.</span> : ''}</td>
                <td>
                  <span className={`pill pill--${c.status === 'reconciled' ? 'green' : c.status === 'received' ? 'blue' : 'orange'}`}>
                    {c.status}
                  </span>
                </td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{c.invoiceRef || '—'}</td>
                <td style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{fmtDate(c.receivedAt || c.createdAt)}</td>
                <td>
                  {c.status === 'pending' && (
                    <button onClick={() => updateStatus(c.id, 'received')}
                      style={{ fontSize: '0.75rem', color: '#2563eb', background: 'none', border: '1px solid #2563eb', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
                      Mark received
                    </button>
                  )}
                  {c.status === 'received' && (
                    <button onClick={() => updateStatus(c.id, 'reconciled')}
                      style={{ fontSize: '0.75rem', color: '#16a34a', background: 'none', border: '1px solid #16a34a', borderRadius: 4, padding: '3px 8px', cursor: 'pointer' }}>
                      Reconcile
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setAddOpen(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 28, width: '100%', maxWidth: 420 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', margin: 0 }}>Log Commission</h3>
              <button onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
            </div>
            <div style={{ display: 'grid', gap: 14 }}>
              {[['Bank', 'bank', 'text', 'ABSA'], ['Loan Amount (R)', 'loanAmount', 'number', '1200000'], ['Commission Received (R)', 'actualAmount', 'number', '6000'], ['Invoice Ref', 'invoiceRef', 'text', 'INV-2026-001']].map(([lbl, key, type, ph]) => (
                <div key={key}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{lbl}</label>
                  <input type={type} placeholder={ph} value={addForm[key]} onChange={e => setAddForm(f => ({ ...f, [key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button onClick={() => setAddOpen(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button onClick={async () => {
                  if (!addForm.bank || !addForm.actualAmount) { showToast('Bank and amount required', 'error'); return; }
                  try {
                    await fetch('/api/admin/commissions', { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: 'Bearer ' + localStorage.getItem('bondly_token') }, body: JSON.stringify({ bank: addForm.bank, loanAmount: parseFloat(addForm.loanAmount) || 0, actualAmount: parseFloat(addForm.actualAmount), invoiceRef: addForm.invoiceRef, notes: addForm.notes }) });
                    const fresh = await admin.commissions();
                    setData(fresh);
                    setAddOpen(false);
                    setAddForm({ bank: '', loanAmount: '', actualAmount: '', invoiceRef: '', notes: '' });
                    showToast('Commission logged', 'success');
                  } catch { showToast('Failed to save', 'error'); }
                }} style={{ flex: 2, padding: 10, borderRadius: 8, background: 'var(--forest)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>Save</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
// ═══════════════════════════════════════════════════════════
//  KYC TAB
// ═══════════════════════════════════════════════════════════

function KycDocViewer({ userId, type, hasDoc, label }) {
  const [state, setState] = useState('idle'); // idle | loading | loaded | error
  const [blobUrl, setBlobUrl] = useState(null);
  const [isPdf, setIsPdf] = useState(false);

  async function load() {
    setState('loading');
    try {
      const token = localStorage.getItem('bondly_token');
      const r = await fetch(`/api/admin/kyc/${userId}/document/${type}`, {
        headers: { Authorization: 'Bearer ' + token },
      });
      if (!r.ok) throw new Error('Not found');
      const blob = await r.blob();
      setIsPdf(blob.type === 'application/pdf');
      setBlobUrl(URL.createObjectURL(blob));
      setState('loaded');
    } catch {
      setState('error');
    }
  }

  if (!hasDoc) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 12px', background: '#ef444410', borderRadius: 8, border: '1px solid #ef444430' }}>
        <span style={{ color: '#ef4444', fontSize: '1rem' }}>✗</span>
        <span style={{ color: '#ef4444', fontSize: '0.8125rem', fontWeight: 600 }}>{label} not submitted</span>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ fontSize: '0.8125rem', fontWeight: 600, color: '#16a34a' }}>✓ {label} uploaded</div>
      {state === 'idle' && (
        <button onClick={load} style={{ alignSelf: 'flex-start', fontSize: '0.75rem', padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border-color)', background: 'var(--bg-secondary)', cursor: 'pointer', color: 'var(--text-primary)' }}>
          View document
        </button>
      )}
      {state === 'loading' && <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Loading…</span>}
      {state === 'error' && <span style={{ fontSize: '0.75rem', color: '#ef4444' }}>Could not load file — it may have been deleted from disk</span>}
      {state === 'loaded' && blobUrl && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {isPdf ? (
            <a href={blobUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.8125rem', color: 'var(--lime)' }}>
              Open PDF ↗
            </a>
          ) : (
            <img
              src={blobUrl}
              alt={label}
              onClick={() => window.open(blobUrl)}
              style={{ maxWidth: 260, maxHeight: 180, objectFit: 'cover', borderRadius: 8, cursor: 'pointer', border: '1.5px solid var(--border-color)' }}
              title="Click to open full size"
            />
          )}
          <a href={blobUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
            Open full size ↗
          </a>
        </div>
      )}
    </div>
  );
}

function KYCTab({ kycQueue, setKycQueue, kycReason, setKycReason, showToast, onJumpCustomer }) {
  const sorted = [...kycQueue].sort((a, b) => new Date(a.kycSubmittedAt || 0) - new Date(b.kycSubmittedAt || 0));
  return (
    <div className="fade-in">
      <h2 style={{ fontFamily: 'var(--font-serif)', marginBottom: 'var(--space-5)' }}>Identity Verification Queue ({kycQueue.length}) — oldest first</h2>
      {sorted.length === 0 ? (
        <Card><CardBody><p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-8)' }}>No pending KYC submissions</p></CardBody></Card>
      ) : sorted.map(u => {
        const waitDays = u.kycSubmittedAt ? Math.floor((Date.now() - new Date(u.kycSubmittedAt)) / 86400000) : null;
        const badgeBg    = waitDays == null ? '#6b728020' : waitDays >= 2 ? '#ef444420' : '#16a34a20';
        const badgeColor = waitDays == null ? 'var(--text-secondary)' : waitDays >= 2 ? '#ef4444' : '#16a34a';
        const badgeLabel = waitDays == null ? '—' : waitDays === 0 ? 'Today' : waitDays === 1 ? '1 day' : `${waitDays} days`;
        return (
        <Card key={u.id} style={{ marginBottom: 'var(--space-4)' }}>
          <CardBody>
            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', flexWrap: 'wrap', marginBottom: 'var(--space-2)' }}>
              <button
                onClick={() => onJumpCustomer?.(u.id)}
                style={{ fontWeight: 700, fontSize: '1rem', background: 'none', border: 'none', padding: 0, cursor: 'pointer', color: 'var(--lime)', textDecoration: 'underline' }}
              >
                {u.name}
              </button>
              <span style={{ background: badgeBg, color: badgeColor, borderRadius: 6, padding: '2px 10px', fontSize: '0.75rem', fontWeight: 700 }}>
                {badgeLabel} waiting
              </span>
            </div>
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 'var(--space-3)' }}>{u.email}</div>

            {/* ID info */}
            <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', fontSize: '0.875rem', marginBottom: 'var(--space-4)' }}>
              <span>Submitted: <strong>{u.kycSubmittedAt ? fmtDate(u.kycSubmittedAt) : '—'}</strong></span>
              <span>ID: <strong>{u.idNumber ? u.idNumber.slice(0,6) + '••••••' + u.idNumber.slice(12) : '—'}</strong></span>
              {u.kycIdInfo?.dob && <span>DOB: <strong>{u.kycIdInfo.dob}</strong></span>}
              {u.kycIdInfo?.age && <span>Age: <strong>{u.kycIdInfo.age}</strong></span>}
            </div>

            {/* Documents + actions side by side */}
            <div style={{ display: 'flex', gap: 'var(--space-6)', flexWrap: 'wrap', alignItems: 'flex-start' }}>
              {/* Documents */}
              <div style={{ display: 'flex', gap: 'var(--space-4)', flexWrap: 'wrap', flex: 1 }}>
                <KycDocViewer userId={u.id} type="id_document" hasDoc={!!u.kycDocuments?.idDocument} label="SA ID document" />
                <KycDocViewer userId={u.id} type="selfie" hasDoc={!!u.kycDocuments?.selfie} label="Selfie" />
              </div>

              {/* Approve / decline */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)', minWidth: 220 }}>
                <input type="text" placeholder="Rejection reason (if declining)" value={kycReason[u.id] || ''}
                  onChange={e => setKycReason(r => ({ ...r, [u.id]: e.target.value }))}
                  style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.875rem', background: 'var(--bg-card)', color: 'var(--text-primary)' }}
                />
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <Button variant="lime" size="sm" full onClick={async () => {
                    try { await admin.kycReview(u.id, 'approve'); setKycQueue(q => q.filter(x => x.id !== u.id)); showToast(`${u.name} verified ✓`, 'success'); }
                    catch (err) { showToast(err.message || 'Failed', 'error'); }
                  }}>Approve</Button>
                  <Button variant="danger" size="sm" full onClick={async () => {
                    try { await admin.kycReview(u.id, 'reject', kycReason[u.id]); setKycQueue(q => q.filter(x => x.id !== u.id)); showToast(`${u.name} declined`, 'info'); }
                    catch (err) { showToast(err.message || 'Failed', 'error'); }
                  }}>Decline</Button>
                </div>
              </div>
            </div>
          </CardBody>
        </Card>
        );
      })}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  CHAT TAB
// ═══════════════════════════════════════════════════════════
function ChatTab({ chats, setChats, chatReply, setChatReply, showToast }) {
  return (
    <div className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 'var(--space-5)', flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <h2 style={{ fontFamily: 'var(--font-serif)' }}>Chat Inbox ({chats.length})</h2>
        {chats.filter(c => c.escalated).length > 0 && (
          <span style={{ color: '#ef4444', fontWeight: 700 }}>⚠ {chats.filter(c => c.escalated).length} escalated</span>
        )}
      </div>
      {chats.length === 0 ? (
        <Card><CardBody><p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-8)' }}>No chat conversations yet</p></CardBody></Card>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {chats.map(convo => (
            <Card key={convo.userId}>
              <CardBody>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 'var(--space-3)' }}>
                  <div>
                    <div style={{ fontWeight: 700 }}>{convo.userName}</div>
                    <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{convo.userEmail} · {convo.messages.length} messages · Last: {fmtDate(convo.updatedAt)}</div>
                  </div>
                  {convo.escalated && <span style={{ background: '#fef2f2', color: '#dc2626', border: '1px solid #fca5a5', borderRadius: 6, padding: '3px 10px', fontSize: '0.75rem', fontWeight: 700 }}>Needs human</span>}
                </div>
                <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: 'var(--space-3)', marginBottom: 'var(--space-3)', maxHeight: 160, overflowY: 'auto', fontSize: '0.8125rem' }}>
                  {convo.messages.slice(-6).map(m => (
                    <div key={m.id} style={{ marginBottom: 6 }}>
                      <span style={{ fontWeight: 700, color: m.role === 'user' ? 'var(--forest)' : m.role === 'advisor' ? '#6366f1' : 'var(--text-secondary)', marginRight: 6 }}>
                        {m.role === 'user' ? convo.userName?.split(' ')[0] : m.role === 'advisor' ? 'Advisor' : 'Bot'}:
                      </span>
                      <span>{m.text.slice(0, 120)}{m.text.length > 120 ? '…' : ''}</span>
                    </div>
                  ))}
                </div>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <input type="text" placeholder="Reply as advisor…" value={chatReply[convo.userId] || ''}
                    onChange={e => setChatReply(r => ({ ...r, [convo.userId]: e.target.value }))}
                    onKeyDown={async e => {
                      if (e.key === 'Enter' && chatReply[convo.userId]?.trim()) {
                        try { await admin.replyChat(convo.userId, chatReply[convo.userId]); setChatReply(r => ({ ...r, [convo.userId]: '' })); setChats(cs => cs.map(c => c.userId === convo.userId ? { ...c, escalated: false } : c)); showToast('Reply sent', 'success'); }
                        catch { showToast('Failed to send', 'error'); }
                      }
                    }}
                    style={{ flex: 1, padding: '8px 12px', borderRadius: 8, border: '1px solid var(--border-color)', fontSize: '0.875rem', background: 'var(--bg-card)' }}
                  />
                  <Button variant="forest" size="sm" onClick={async () => {
                    if (!chatReply[convo.userId]?.trim()) return;
                    try { await admin.replyChat(convo.userId, chatReply[convo.userId]); setChatReply(r => ({ ...r, [convo.userId]: '' })); setChats(cs => cs.map(c => c.userId === convo.userId ? { ...c, escalated: false } : c)); showToast('Reply sent', 'success'); }
                    catch { showToast('Failed to send', 'error'); }
                  }}>Send</Button>
                </div>
              </CardBody>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  ERRORS TAB
// ═══════════════════════════════════════════════════════════
function ErrorsTab({ errors, setErrors, stmtFailures, showToast }) {
  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-8)' }}>

      {/* Statement parse failures */}
      <div>
        <h2 style={{ fontFamily: 'var(--font-serif)', marginBottom: 16 }}>
          Statement Parse Failures ({stmtFailures.length})
        </h2>
        {stmtFailures.length === 0 ? (
          <Card><CardBody><p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-6)' }}>No parse failures — all statements processing cleanly.</p></CardBody></Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {stmtFailures.map(f => (
              <Card key={f.id}>
                <CardBody>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 8, flexWrap: 'wrap' }}>
                    <div>
                      <div style={{ fontWeight: 600, marginBottom: 2 }}>
                        {f.userName || 'Anonymous'}{f.bank ? ` · ${f.bank.toUpperCase()}` : ''}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 4 }}>
                        {f.fileName}
                      </div>
                      <div style={{ fontSize: '0.8125rem', color: '#ef4444' }}>
                        {f.error || 'unknown error'}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                      {fmtDate(f.at)}
                    </div>
                  </div>
                  {f.userId && (
                    <div style={{ marginTop: 8 }}>
                      <button
                        style={{ fontSize: '0.75rem', color: 'var(--lime)', background: 'none', border: 'none', cursor: 'pointer', padding: 0 }}
                        onClick={() => window.open(`/admin?tab=customers&user=${f.userId}`, '_self')}
                      >View user →</button>
                    </div>
                  )}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Frontend/backend error log */}
      <div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)' }}>Error Log ({errors.length})</h2>
          {errors.length > 0 && (
            <Button variant="ghost" size="sm" onClick={async () => {
              try {
                await fetch('/api/admin/errors', { method: 'DELETE', headers: { Authorization: 'Bearer ' + localStorage.getItem('bondly_token') } });
                setErrors([]);
                showToast('Error log cleared', 'success');
              } catch { showToast('Failed to clear', 'error'); }
            }}>Clear all</Button>
          )}
        </div>
        {errors.length === 0 ? (
          <Card><CardBody><p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-8)' }}>No errors logged — great!</p></CardBody></Card>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
            {errors.map(e => (
              <Card key={e.id}>
                <CardBody>
                  <div style={{ fontWeight: 600, marginBottom: 4 }}>{e.message}</div>
                  <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{fmtDate(e.createdAt)} · {e.url}</div>
                  {e.stack && <pre style={{ marginTop: 8, fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'pre-wrap', background: 'var(--bg-page)', padding: 8, borderRadius: 4 }}>{e.stack.slice(0, 400)}</pre>}
                </CardBody>
              </Card>
            ))}
          </div>
        )}
      </div>

    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SETTINGS TAB
// ═══════════════════════════════════════════════════════════



// ═══════════════════════════════════════════════════════════
//  LEADS CRM
// ═══════════════════════════════════════════════════════════
function LeadsTab({ leads, setLeads, showToast, initialSelectedId, onClearJump }) {
  const [selected, setSelected]   = useState(initialSelectedId || null);
  const [search, setSearch]       = useState('');
  const [noteInput, setNoteInput] = useState('');
  const [addOpen, setAddOpen]     = useState(false);
  const [addForm, setAddForm]     = useState(EMPTY_LEAD);
  const [addLoading, setAddLoading] = useState(false);
  const [viewMode, setViewMode]   = useState('b2c'); // 'b2c' | 'b2b'
  // Converted-lead state — populated on first load + when toggling. Lets
  // us tell the admin "you're not seeing N leads that already registered"
  // and offer a one-click toggle into the full list for audit purposes.
  const [convertedMeta,  setConvertedMeta]  = useState({ convertedCount: 0, totalAll: leads.length });
  const [showConverted,  setShowConverted]  = useState(false);
  useEffect(() => {
    fetch('/api/admin/leads', { headers: { Authorization: 'Bearer ' + (localStorage.getItem('bondly_token') || '') } })
      .then(r => r.json()).then(d => {
        if (d?.data) setConvertedMeta({ convertedCount: d.data.convertedCount || 0, totalAll: d.data.totalAll || 0 });
      }).catch(() => {});
  }, []);
  async function toggleConverted() {
    try {
      const r = await fetch('/api/admin/leads?includeConverted=' + (showConverted ? '0' : '1'),
        { headers: { Authorization: 'Bearer ' + (localStorage.getItem('bondly_token') || '') } }).then(r => r.json());
      const ls = Array.isArray(r?.data) ? r.data : (r?.data?.leads || []);
      setLeads(ls);
      setShowConverted(v => !v);
    } catch { showToast('Could not switch view', 'error'); }
  }

  const selectedLead = leads.find(l => l.id === selected) || null;

  useEffect(() => {
    if (initialSelectedId) { setSelected(initialSelectedId); onClearJump?.(); }
  }, [initialSelectedId]);

  // Close drawer on Escape key
  useEffect(() => {
    if (!selected) return;
    function onKey(e) { if (e.key === 'Escape') setSelected(null); }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected]);

  const isB2b = viewMode === 'b2b';
  const activeStages = isB2b ? B2B_STAGES : LEAD_STAGES;
  const visibleLeads = leads.filter(l => isB2b ? isB2bLead(l) : !isB2bLead(l));

  const totalCommission    = visibleLeads.filter(l => l.status === 'converted' && l.currentBalance).reduce((s, l) => s + Math.round(l.currentBalance * 0.005), 0);
  const pipelineCommission = visibleLeads.filter(l => ['qualified','sent_to_broker'].includes(l.status) && l.currentBalance).reduce((s, l) => s + Math.round(l.currentBalance * 0.005), 0);
  const newToday = visibleLeads.filter(l => new Date(l.createdAt).toDateString() === new Date().toDateString()).length;
  const repliedCount = visibleLeads.filter(l => l.repliedAt).length;
  const q = search.toLowerCase();
  const matchesSearch = l => !q || [l.name, l.phone, l.email, l.currentBank, l.company].some(v => v?.toLowerCase().includes(q));

  async function updateLead(id, patch) {
    try {
      const updated = await admin.updateLead(id, patch);
      setLeads(ls => ls.map(l => l.id === id ? updated : l));
      return updated;
    } catch (err) { showToast(err.message || 'Could not update', 'error'); throw err; }
  }

  async function deleteLead(id) {
    if (!window.confirm('Delete this lead permanently?')) return;
    try {
      await admin.deleteLead(id);
      setLeads(ls => ls.filter(l => l.id !== id));
      setSelected(null);
      showToast('Lead deleted', 'info');
    } catch (err) { showToast(err.message || 'Failed to delete', 'error'); }
  }

  async function saveNote() {
    const note = noteInput.trim();
    if (!note || !selectedLead) return;
    const existing = selectedLead.brokerNotes ? selectedLead.brokerNotes + '\n' : '';
    const ts = new Date().toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' });
    await updateLead(selectedLead.id, { brokerNotes: `${existing}[${ts}] ${note}` });
    setNoteInput('');
    showToast('Note saved', 'success');
  }

  async function handleAddLead(e) {
    e.preventDefault();
    if (!addForm.name.trim() || (!addForm.phone.trim() && !addForm.email.trim())) { showToast('Name and phone or email required', 'error'); return; }
    if (addForm.phone.trim() && !/^(\+27|0)[6-8]\d{8}$/.test(addForm.phone.trim().replace(/\s/g, ''))) { showToast('Enter a valid SA mobile number (e.g. 0821234567)', 'error'); return; }
    if (addForm.email.trim() && !addForm.email.includes('@')) { showToast('Enter a valid email address', 'error'); return; }
    setAddLoading(true);
    try {
      const res = await fetch('/api/leads', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...addForm, currentBalance: parseFloat(addForm.currentBalance) || undefined, currentRate: parseFloat(addForm.currentRate) || undefined, currentTerm: parseInt(addForm.currentTerm) || undefined, monthlyIncome: parseFloat(addForm.monthlyIncome) || undefined }),
      }).then(r => r.json());
      if (!res.success) throw new Error(res.error || 'Failed');
      const r2 = await admin.leads();
      setLeads(Array.isArray(r2) ? r2 : (r2?.leads || []));
      setAddOpen(false);
      setAddForm(EMPTY_LEAD);
      showToast('Lead added', 'success');
    } catch (err) { showToast(err.message || 'Could not add', 'error'); }
    finally { setAddLoading(false); }
  }

  return (
    <div className="fade-in" style={{ position: 'relative' }}>
      {/* Top bar */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        {/* View toggle */}
        <div style={{ display: 'flex', borderRadius: 8, border: '1.5px solid var(--border-color)', overflow: 'hidden', flexShrink: 0 }}>
          {[['b2c', '🏠 Homeowners'], ['b2b', '🏢 B2B']].map(([mode, label]) => (
            <button key={mode} onClick={() => { setViewMode(mode); setSelected(null); }}
              style={{ padding: '7px 14px', border: 'none', cursor: 'pointer', fontSize: '0.8125rem', fontWeight: 700,
                background: viewMode === mode ? 'var(--forest)' : 'var(--bg-card)',
                color: viewMode === mode ? '#fff' : 'var(--text-secondary)' }}>
              {label}
            </button>
          ))}
        </div>
        <input type="search" placeholder={isB2b ? 'Search company, name, email…' : 'Search name, phone, email, bank…'} value={search} onChange={e => setSearch(e.target.value)}
          style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-primary)', fontSize: '0.875rem', width: 240 }} />
        <button onClick={() => exportCSV(visibleLeads)} style={{ padding: '8px 14px', borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-card)', color: 'var(--text-secondary)', fontSize: '0.8125rem', cursor: 'pointer', fontWeight: 600 }}>⬇ CSV</button>
        <button onClick={() => { setAddForm(isB2b ? B2B_EMPTY_LEAD : EMPTY_LEAD); setAddOpen(true); }}
          style={{ padding: '8px 18px', borderRadius: 8, background: 'var(--forest)', color: '#fff', border: 'none', fontSize: '0.875rem', cursor: 'pointer', fontWeight: 700 }}>
          + {isB2b ? 'Add B2B lead' : 'Add lead'}
        </button>
      </div>

      {/* Converted-lead banner — surfaces what was hidden by the dedupe so
          the admin trusts the count instead of suspecting missing records. */}
      {convertedMeta.convertedCount > 0 && (
        <div className="adm-notice">
          <span>
            Hiding <strong>{convertedMeta.convertedCount}</strong> lead{convertedMeta.convertedCount === 1 ? '' : 's'} that already became registered customers
            {!showConverted && convertedMeta.totalAll > 0 && (
              <> &middot; {convertedMeta.totalAll - convertedMeta.convertedCount} unconverted of {convertedMeta.totalAll} total</>
            )}.
          </span>
          <button className="adm-notice__action" onClick={toggleConverted}>
            {showConverted ? 'Hide converted' : 'Show all'} →
          </button>
        </div>
      )}

      {/* Stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 10, marginBottom: 24 }}>
        {(isB2b ? [
          { label: 'Total B2B',       value: visibleLeads.length },
          { label: 'New today',       value: newToday },
          { label: 'Replied',         value: repliedCount },
          { label: 'Active pipeline', value: visibleLeads.filter(l => ['contacted','meeting_booked','proposal_sent'].includes(l.status)).length },
          { label: 'Won',             value: visibleLeads.filter(l => l.status === 'won').length },
        ] : [
          { label: 'Total',            value: visibleLeads.length },
          { label: 'New today',        value: newToday },
          { label: 'Active pipeline',  value: visibleLeads.filter(l => ['contacted','qualified','sent_to_broker'].includes(l.status)).length },
          { label: 'Pipeline commission', value: fmt(pipelineCommission) },
          { label: 'Earned commission',   value: fmt(totalCommission) },
        ]).map(s => (
          <div key={s.label} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-secondary)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>{s.label}</div>
            <div style={{ fontSize: '1.375rem', fontWeight: 800 }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Kanban */}
      <div style={{ display: 'flex', gap: 12, overflowX: 'auto', paddingBottom: 16, alignItems: 'flex-start' }}>
        {activeStages.map(stage => {
          const col = visibleLeads.filter(l => l.status === stage.value && matchesSearch(l));
          return (
            <div key={stage.value} style={{ minWidth: 240, maxWidth: 260, flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', borderRadius: 8, background: `${stage.color}18`, border: `1.5px solid ${stage.color}30` }}>
                <span>{stage.icon}</span>
                <span style={{ fontWeight: 700, fontSize: '0.875rem', color: stage.color }}>{stage.label}</span>
                <span style={{ marginLeft: 'auto', background: stage.color, color: '#fff', borderRadius: 999, padding: '1px 8px', fontSize: '0.75rem', fontWeight: 700 }}>{col.length}</span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {col.length === 0 && (
                  <div style={{ textAlign: 'center', padding: '20px 8px', color: 'var(--text-secondary)', fontSize: '0.8125rem', border: '1.5px dashed var(--border-color)', borderRadius: 8 }}>Empty</div>
                )}
                {col.map(lead => {
                  const commission = lead.currentBalance ? Math.round(lead.currentBalance * 0.005) : null;
                  const isSel = selected === lead.id;
                  return (
                    <div key={lead.id} onClick={() => { setSelected(lead.id); setNoteInput(''); }}
                      style={{ background: 'var(--bg-card)', border: `1.5px solid ${isSel ? stage.color : 'var(--border-color)'}`, borderLeft: `4px solid ${stage.color}`, borderRadius: 8, padding: 12, cursor: 'pointer', boxShadow: isSel ? `0 0 0 2px ${stage.color}40` : 'var(--shadow-sm)', transition: 'all 0.15s' }}>
                      {isB2b ? (
                        <>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 2 }}>{lead.company || lead.name || '—'}</div>
                          {lead.company && lead.name && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginBottom: 2 }}>👤 {lead.name}</div>}
                          {lead.email && <div style={{ fontSize: '0.8125rem', color: 'var(--mint)', marginBottom: 2 }}>✉ {lead.email}</div>}
                          {lead.repliedAt && (
                            <div style={{ marginTop: 4, padding: '4px 7px', background: '#16a34a10', border: '1px solid #16a34a30', borderRadius: 4 }}>
                              <div style={{ fontSize: '0.7rem', fontWeight: 700, color: '#16a34a', marginBottom: 1 }}>📬 Replied {daysAgo(lead.repliedAt)}</div>
                              {lead.lastEmailSubject && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lead.lastEmailSubject}</div>}
                            </div>
                          )}
                          {lead.dealValue > 0 && <div style={{ marginTop: 4, fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>{fmt(lead.dealValue)}</div>}
                          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                            {lead.assignedTo && lead.assignedTo !== 'Unassigned' ? <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>👤 {lead.assignedTo}</span> : <span />}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{daysAgo(lead.createdAt)}</span>
                          </div>
                          {lead.followUpAt && new Date(lead.followUpAt) < new Date() && (
                            <div style={{ marginTop: 3, fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠ Follow-up overdue</div>
                          )}
                        </>
                      ) : (
                        <>
                          <div style={{ fontWeight: 700, fontSize: '0.9375rem', marginBottom: 4 }}>{lead.name || '—'}</div>
                          {lead.phone && <div style={{ fontSize: '0.8125rem', color: 'var(--mint)', marginBottom: 2 }}>💬 {lead.phone}</div>}
                          {lead.currentBank && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>{lead.currentBank}{lead.currentBalance ? ` · ${fmt(lead.currentBalance)}` : ''}</div>}
                          {lead.monthlyIncome > 0 && (
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 2 }}>
                              Income: <strong style={{ color: 'var(--text-primary)' }}>{fmt(lead.monthlyIncome)}</strong>
                              {lead.maxBond > 0 && <> · Max bond: <strong style={{ color: 'var(--text-primary)' }}>{fmt(lead.maxBond)}</strong></>}
                              {lead.affordabilityZone?.zone && (() => {
                                const z = lead.affordabilityZone.zone;
                                const zc = z==='green'?'#16a34a':z==='yellow'?'#d97706':'#ef4444';
                                return <span style={{ marginLeft:4, padding:'1px 5px', borderRadius:4, fontSize:'0.7rem', fontWeight:700, background:`${zc}18`, color:zc }}>{lead.affordabilityZone.label}</span>;
                              })()}
                            </div>
                          )}
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 6 }}>
                            {commission ? <span style={{ fontSize: '0.75rem', fontWeight: 700, color: '#16a34a' }}>~{fmt(commission)}</span> : <span />}
                            <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{daysAgo(lead.createdAt)}</span>
                          </div>
                          {lead.phone && (
                            <a href={`https://wa.me/${lead.phone.replace(/\D/g,'')}?text=Hi+${encodeURIComponent(lead.name?.split(' ')[0]||'')}%2C+this+is+Bondly+following+up+on+your+bond+enquiry.`}
                              target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()}
                              style={{ display: 'inline-flex', alignItems: 'center', gap: 3, marginTop: 4, fontSize: '0.7125rem', color: '#128C7E', textDecoration: 'none', padding: '2px 7px', background: '#25D36618', border: '1px solid #25D36630', borderRadius: 4, fontWeight: 600 }}>
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                              WA
                            </a>
                          )}
                          {lead.followUpAt && new Date(lead.followUpAt) < new Date() && (
                            <div style={{ marginTop: 3, fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>⚠ Follow-up overdue</div>
                          )}
                          {lead.assignedTo && lead.assignedTo !== 'Unassigned' && <div style={{ marginTop: 3, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>👤 {lead.assignedTo}</div>}
                          {lead.referredBy && <div style={{ marginTop: 3, fontSize: '0.7rem', color: 'var(--text-secondary)' }}>🏘 {lead.referredBy}</div>}
                          {lead.brokerNotes && <div style={{ marginTop: 3, fontSize: '0.7rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📝 {lead.brokerNotes.split('\n').pop()}</div>}
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail drawer */}
      {selectedLead && (
        <>
          <div className="lead-drawer-overlay" onClick={() => setSelected(null)} />
          <div className="lead-drawer">
            {/* Sticky header */}
            <div className="lead-drawer__header">
              <div style={{ flex: 1, minWidth: 0 }}>
                <h3 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.25rem', margin: 0, lineHeight: 1.2 }}>{selectedLead.name || 'Unknown'}</h3>
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 4 }}>
                  {SOURCE_LABELS[selectedLead.source] || selectedLead.source} · {daysAgo(selectedLead.createdAt)}
                  {selectedLead.status && (
                    <span style={{ marginLeft: 8, padding: '2px 7px', borderRadius: 4, fontSize: '0.75rem', fontWeight: 700,
                      background: (LEAD_STAGES.find(s => s.value === selectedLead.status)?.color || '#9ca3af') + '20',
                      color: LEAD_STAGES.find(s => s.value === selectedLead.status)?.color || '#9ca3af' }}>
                      {LEAD_STAGES.find(s => s.value === selectedLead.status)?.icon} {LEAD_STAGES.find(s => s.value === selectedLead.status)?.label || selectedLead.status}
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0, marginLeft: 12 }}>
                <button className="lead-drawer__delete" onClick={() => deleteLead(selectedLead.id)}>Delete</button>
                <button className="lead-drawer__close" onClick={() => setSelected(null)} title="Close (Esc)">×</button>
              </div>
            </div>

            {/* Scrollable body */}
            <div className="lead-drawer__body">
              {/* Contact actions */}
              <div style={{ display: 'grid', gap: 8 }}>
                {selectedLead.phone && (
                  <a href={`https://wa.me/${selectedLead.phone.replace(/\D/g,'')}?text=Hi ${encodeURIComponent(selectedLead.name?.split(' ')[0]||'')}%2C+this+is+Bondly+following+up+on+your+bond+switch+enquiry.`}
                    target="_blank" rel="noopener noreferrer"
                    className="lead-contact-btn"
                    style={{ background: '#25D36618', border: '1.5px solid #25D36640', color: '#128C7E' }}>
                    💬 {selectedLead.phone} <span style={{ marginLeft: 'auto', fontSize: '0.75rem', opacity: 0.8 }}>WhatsApp →</span>
                  </a>
                )}
                {selectedLead.email && (
                  <a href={`mailto:${selectedLead.email}`}
                    className="lead-contact-btn"
                    style={{ border: '1.5px solid var(--border-color)', color: 'var(--text-secondary)', fontWeight: 400 }}>
                    ✉️ {selectedLead.email}
                  </a>
                )}
              </div>

              {/* Bond details */}
              {selectedLead.currentBank && (
                <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: 16 }}>
                  <Lbl>Bond Details</Lbl>
                  <div className="lead-bond-grid">
                    {[['Bank', selectedLead.currentBank], ['Balance', selectedLead.currentBalance ? fmt(selectedLead.currentBalance) : null], ['Rate', selectedLead.currentRate ? `${selectedLead.currentRate}%` : null], ['Remaining', selectedLead.currentTerm ? `${selectedLead.currentTerm} yrs` : null], ['Income', selectedLead.monthlyIncome ? fmt(selectedLead.monthlyIncome) : null], ['Employment', selectedLead.employment ? selectedLead.employment.replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase()) : null]].filter(([,v])=>v).map(([label, value]) => (
                      <div key={label}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontWeight: 600 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                  {selectedLead.currentBalance && (
                    <div style={{ marginTop: 12, padding: 10, background: '#f0fdf4', borderRadius: 6, display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ fontSize: '0.8125rem', color: '#15803d' }}>Est. commission</span>
                      <span style={{ fontWeight: 800, color: '#16a34a', fontSize: '1.125rem' }}>~{fmt(Math.round(selectedLead.currentBalance * 0.005))}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Pre-approval financial data */}
              {(selectedLead.maxBond > 0 || selectedLead.affordabilityZone?.zone || selectedLead.statementVerified) && (
                <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: 16 }}>
                  <Lbl style={{ display:'flex', alignItems:'center', gap:8 }}>
                    Pre-Approval Data
                    {selectedLead.statementVerified && <span style={{ padding:'1px 7px', borderRadius:10, fontSize:'0.7rem', fontWeight:700, background:'#16a34a18', color:'#16a34a' }}>Statement verified</span>}
                    {selectedLead.affordabilityZone?.zone && (() => {
                      const z = selectedLead.affordabilityZone.zone;
                      const zc = z==='green'?'#16a34a':z==='yellow'?'#d97706':'#ef4444';
                      return <span style={{ padding:'1px 7px', borderRadius:10, fontSize:'0.7rem', fontWeight:700, background:`${zc}18`, color:zc }}>{selectedLead.affordabilityZone.label}</span>;
                    })()}
                  </Lbl>
                  <div className="lead-bond-grid">
                    {[
                      ['Monthly Income', selectedLead.monthlyIncome > 0 ? fmt(selectedLead.monthlyIncome) : null],
                      ['Max Bond',       selectedLead.maxBond > 0 ? fmt(selectedLead.maxBond) : null],
                      ['Home Readiness', selectedLead.homeReadinessScore ? `${selectedLead.homeReadinessScore}/100` : null],
                    ].filter(([,v])=>v).map(([label, value]) => (
                      <div key={label}>
                        <div style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontWeight: 600 }}>{value}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* B2B-specific: last email reply */}
              {isB2b && selectedLead.repliedAt && (
                <div style={{ background: '#16a34a0d', border: '1px solid #16a34a30', borderRadius: 8, padding: 12 }}>
                  <Lbl>Last email reply</Lbl>
                  <div style={{ fontSize: '0.8125rem', fontWeight: 600, marginBottom: 4 }}>{selectedLead.lastEmailSubject || '(no subject)'}</div>
                  {selectedLead.lastEmailSnippet && <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', lineHeight: 1.5 }}>{selectedLead.lastEmailSnippet}</div>}
                  <div style={{ marginTop: 6, fontSize: '0.75rem', color: 'var(--text-secondary)' }}>Received {new Date(selectedLead.repliedAt).toLocaleString('en-ZA')}</div>
                </div>
              )}

              {/* Stage */}
              <div>
                <Lbl>Stage</Lbl>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {activeStages.map(s => (
                    <button key={s.value} className="lead-stage-btn"
                      onClick={() => updateLead(selectedLead.id, { status: s.value }).catch(()=>{})}
                      style={{ background: selectedLead.status === s.value ? s.color : 'var(--bg-page)', color: selectedLead.status === s.value ? '#fff' : s.color, borderColor: s.color }}>
                      {s.icon} {s.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Assigned to */}
              <div>
                <Lbl>Assigned to</Lbl>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {ASSIGNEES.map(a => (
                    <button key={a} className="lead-assign-btn"
                      onClick={() => updateLead(selectedLead.id, { assignedTo: a }).catch(()=>{})}
                      style={{ background: selectedLead.assignedTo === a ? 'var(--forest)' : 'var(--bg-page)', color: selectedLead.assignedTo === a ? '#fff' : 'var(--text-secondary)' }}>
                      {a}
                    </button>
                  ))}
                </div>
              </div>

              {/* Follow-up date */}
              <div>
                <Lbl>Follow-up date</Lbl>
                <input type="date" value={selectedLead.followUpAt || ''} onChange={e => updateLead(selectedLead.id, { followUpAt: e.target.value }).catch(()=>{})}
                  style={{ padding: '8px 12px', borderRadius: 6, border: `1.5px solid ${selectedLead.followUpAt && new Date(selectedLead.followUpAt) < new Date() ? '#ef4444' : 'var(--border-color)'}`, background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }} />
                {selectedLead.followUpAt && new Date(selectedLead.followUpAt) < new Date() && (
                  <div style={{ marginTop: 4, fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>⚠ Overdue — update or clear this date</div>
                )}
              </div>

              {/* Referred by (estate agent / source) */}
              <div>
                <Lbl>Referred by</Lbl>
                <input type="text" value={selectedLead.referredBy || ''} placeholder="e.g. Jane (Pam Golding CT)"
                  onChange={e => updateLead(selectedLead.id, { referredBy: e.target.value }).catch(()=>{})}
                  style={{ padding: '8px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', width: '100%', boxSizing: 'border-box' }} />
              </div>

              {/* Notes */}
              <div>
                <Lbl>Notes</Lbl>
                {selectedLead.brokerNotes && (
                  <div style={{ background: 'var(--bg-page)', borderRadius: 8, padding: '8px 10px', marginBottom: 8, maxHeight: 200, overflowY: 'auto' }}>
                    {selectedLead.brokerNotes.trim().split('\n').filter(Boolean).map((line, i) => {
                      const m = line.match(/^\[([^\]]+)\]\s*(.*)/);
                      return m ? (
                        <div key={i} style={{ display: 'flex', gap: 8, padding: '5px 0', borderBottom: '1px solid var(--border-color)', fontSize: '0.8125rem' }}>
                          <span style={{ color: 'var(--text-secondary)', flexShrink: 0, fontSize: '0.75rem', marginTop: 1 }}>{m[1]}</span>
                          <span style={{ color: 'var(--text-primary)' }}>{m[2]}</span>
                        </div>
                      ) : (
                        <div key={i} style={{ padding: '5px 0', fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{line}</div>
                      );
                    })}
                  </div>
                )}
                <div style={{ display: 'flex', gap: 6 }}>
                  <textarea rows={2} value={noteInput} onChange={e => setNoteInput(e.target.value)} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && (e.preventDefault(), saveNote())} placeholder="Add a note… (Enter to save)"
                    style={{ flex: 1, padding: '8px 10px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.8125rem', resize: 'none', fontFamily: 'inherit' }} />
                  <button onClick={saveNote} style={{ alignSelf: 'flex-end', padding: '8px 14px', borderRadius: 6, background: 'var(--forest)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700, fontSize: '0.8125rem' }}>Save</button>
                </div>
              </div>

              {selectedLead.contactMethod && (
                <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', borderTop: '1px solid var(--border-color)', paddingTop: 12 }}>
                  Prefers: <strong>{selectedLead.contactMethod}</strong>
                </div>
              )}
            </div>
          </div>
        </>
      )}

      {/* Add lead modal */}
      {addOpen && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', zIndex: 300, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
          onClick={e => e.target === e.currentTarget && setAddOpen(false)}>
          <div style={{ background: 'var(--bg-card)', borderRadius: 12, padding: 24, width: '100%', maxWidth: 480, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontFamily: 'var(--font-serif)', margin: 0 }}>{isB2b ? 'Add B2B lead' : 'Add lead manually'}</h3>
              <button onClick={() => setAddOpen(false)} style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-secondary)' }}>×</button>
            </div>
            <form onSubmit={handleAddLead} style={{ display: 'grid', gap: 14 }}>
              {(isB2b ? [
                { label: 'Company / Organisation *', key: 'company',    type: 'text',   placeholder: 'Capitec Bank' },
                { label: 'Contact name *',           key: 'name',       type: 'text',   placeholder: 'Jane Smith' },
                { label: 'Email *',                  key: 'email',      type: 'email',  placeholder: 'jane@capitec.co.za' },
                { label: 'Phone',                    key: 'phone',      type: 'tel',    placeholder: '+27 82 123 4567' },
                { label: 'Deal value (R, optional)', key: 'dealValue',  type: 'number', placeholder: '500 000' },
                { label: 'Notes',                    key: 'notes',      type: 'text',   placeholder: 'Intro via LinkedIn, interested in fraud intelligence' },
              ] : [
                { label: 'Full name *',             key: 'name',           type: 'text',   placeholder: 'Jane Smith' },
                { label: 'Phone (WhatsApp) *',      key: 'phone',          type: 'tel',    placeholder: '+27 82 123 4567' },
                { label: 'Email',                   key: 'email',          type: 'email',  placeholder: 'jane@example.com' },
                { label: 'Referred by (estate agent / source)', key: 'referredBy', type: 'text', placeholder: 'Jane Smith — Pam Golding' },
                { label: 'Current bank',            key: 'currentBank',    type: 'text',   placeholder: 'ABSA' },
                { label: 'Outstanding balance (R)', key: 'currentBalance', type: 'number', placeholder: '1 200 000' },
                { label: 'Current rate (%)',        key: 'currentRate',    type: 'number', placeholder: '11.75' },
                { label: 'Monthly income (R)',      key: 'monthlyIncome',  type: 'number', placeholder: '45 000' },
              ]).map(f => (
                <div key={f.key}>
                  <label style={{ display: 'block', fontSize: '0.8125rem', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: 4 }}>{f.label}</label>
                  <input type={f.type} value={addForm[f.key]} placeholder={f.placeholder} onChange={e => setAddForm(fm => ({ ...fm, [f.key]: e.target.value }))}
                    style={{ width: '100%', padding: '9px 12px', borderRadius: 6, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', boxSizing: 'border-box' }} />
                </div>
              ))}
              <div style={{ display: 'flex', gap: 10, marginTop: 4 }}>
                <button type="button" onClick={() => setAddOpen(false)} style={{ flex: 1, padding: 10, borderRadius: 8, border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', cursor: 'pointer', fontWeight: 600 }}>Cancel</button>
                <button type="submit" disabled={addLoading} style={{ flex: 2, padding: 10, borderRadius: 8, background: 'var(--forest)', color: '#fff', border: 'none', cursor: 'pointer', fontWeight: 700 }}>{addLoading ? 'Adding…' : 'Add lead'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  PIPELINE TAB (unchanged)
// ═══════════════════════════════════════════════════════════
const RISK_GRADE_COLOR = { A: '#16a34a', B: '#4a7fa5', C: '#d97706', D: '#dc2626', E: '#9ca3af' };
const PIPELINE_STAGES = { swap: ['awaiting_documents','submitted','under_review','approved','in_progress','completed'], bond: ['submitted','under_review','approved','completed'] };
function pipelineProgress(type, status) { const stages = PIPELINE_STAGES[type] || PIPELINE_STAGES.swap; const idx = stages.indexOf(status); if (idx < 0) return 0; return Math.round(((idx + 1) / stages.length) * 100); }
const CONVEYANCING_STAGES = ['offer_accepted','cancellation_notice_sent','attorney_instructed','valuation_ordered','valuation_done','registration_in_progress','registered','complete'];

function PipelineTab({ pipeline, setPipeline, showToast }) {
  const [filter, setFilter]         = useState('active');
  const [expanded, setExpanded]     = useState(null);
  const [brokerForm, setBrokerForm] = useState({});
  const [sending, setSending]       = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(null);
  const [offerForms, setOfferForms] = useState({});
  const [stageForms, setStageForms] = useState({});
  const [bankStatusForms, setBankStatusForms] = useState({});

  const filtered = pipeline.filter(e => {
    if (filter === 'active')  return e.priority === 'active';
    if (filter === 'unsent')  return e.priority === 'active' && !e.brokerSentAt;
    if (filter === 'sent')    return !!e.brokerSentAt;
    return true;
  });
  const unsent = pipeline.filter(e => e.priority === 'active' && !e.brokerSentAt).length;

  async function sendToBroker(entry) {
    const bf = brokerForm[entry.pipelineId] || {};
    setSending(entry.pipelineId);
    try {
      const [type, id] = [entry.type, entry.application.id];
      const result = await admin.brokerAction(type, id, { brokerName: bf.brokerName || '', brokerEmail: bf.brokerEmail || '', notes: bf.notes || '', action: 'send' });
      setPipeline(p => p.map(e2 => e2.pipelineId === entry.pipelineId ? { ...e2, brokerSentAt: result.brokerSentAt, brokerSentTo: bf.brokerName || 'Broker' } : e2));
      showToast('Sent to broker and client notified', 'success');
    } catch(err) { showToast(err.message || 'Failed', 'error'); }
    finally { setSending(null); }
  }

  async function updateStatus(entry, status) {
    setStatusUpdating(entry.pipelineId);
    try {
      await admin.updateSwap(entry.application.id, { status });
      setPipeline(p => p.map(e2 => e2.pipelineId === entry.pipelineId ? { ...e2, application: { ...e2.application, status } } : e2));
      showToast('Status updated', 'success');
    } catch(err) { showToast(err.message || 'Failed', 'error'); }
    finally { setStatusUpdating(null); }
  }

  async function recordOffer(entry) {
    const of = offerForms[entry.pipelineId] || {};
    if (!of.bank || !of.rate) { showToast('Bank and rate required', 'error'); return; }
    try {
      const offer = await admin.recordOffer(entry.application.id, { bank: of.bank, rate: parseFloat(of.rate), monthlyPayment: of.monthlyPayment ? parseFloat(of.monthlyPayment) : null, term: of.term ? parseInt(of.term) : null, conditions: of.conditions || null, initiationFee: of.initiationFee ? parseFloat(of.initiationFee) : null, expiryDays: parseInt(of.expiryDays) || 30 });
      setPipeline(p => p.map(e2 => e2.pipelineId === entry.pipelineId ? { ...e2, application: { ...e2.application, offers: [...(e2.application.offers||[]), offer] } } : e2));
      setOfferForms(f => ({ ...f, [entry.pipelineId]: {} }));
      showToast(`Offer from ${of.bank} recorded — customer notified`, 'success');
    } catch(err) { showToast(err.message || 'Failed', 'error'); }
  }

  async function updateStage(entry, stage, note) {
    try {
      const updated = await admin.updateStage(entry.application.id, stage, note);
      setPipeline(p => p.map(e2 => e2.pipelineId === entry.pipelineId ? { ...e2, application: updated } : e2));
      showToast('Stage updated — customer notified', 'success');
    } catch(err) { showToast(err.message || 'Failed', 'error'); }
  }

  async function updateBankStatus(entry, bank, status) {
    try {
      const updated = await admin.updateBankStatus(entry.application.id, bank, status);
      setPipeline(p => p.map(e2 => e2.pipelineId === entry.pipelineId ? { ...e2, application: { ...e2.application, bankStatuses: updated } } : e2));
      showToast(`${bank} status updated`, 'success');
    } catch(err) { showToast(err.message || 'Failed', 'error'); }
  }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem', marginBottom: 4 }}>Broker Pipeline</h2>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            {unsent > 0 && <strong style={{ color: 'var(--lime)' }}>{unsent} ready to send · </strong>}
            {pipeline.length} total
          </p>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {[['active','Active'],['unsent','Needs Action'],['sent','Sent'],['all','All']].map(([v, l]) => (
            <button key={v} onClick={() => setFilter(v)} className={`pipeline-filter-btn ${filter === v ? 'active' : ''}`}>{l}</button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? <div className="empty-state"><p>No applications in this view.</p></div> : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {filtered.map(entry => {
            const { pipelineId, type, application: app, profile } = entry;
            const rs = profile?.riskScore;
            const isOpen = expanded === pipelineId;
            const progress = pipelineProgress(type, app.status);
            const bf = brokerForm[pipelineId] || {};
            const gradeColor = RISK_GRADE_COLOR[rs?.grade] || '#9ca3af';
            return (
              <Card key={pipelineId} className={`pipeline-card ${!entry.brokerSentAt && entry.priority === 'active' ? 'pipeline-card--needs-action' : ''}`}>
                <CardBody>
                  <div className="pipeline-card__header" onClick={() => setExpanded(isOpen ? null : pipelineId)} style={{ cursor: 'pointer' }}>
                    <div className="pipeline-card__left">
                      <div className="pipeline-risk-badge" style={{ background: gradeColor }}>{rs?.grade || '?'}</div>
                      <div>
                        <div style={{ fontWeight: 700, fontSize: '1rem' }}>
                          {profile?.name || 'Unknown'}
                          {type === 'swap' && <span style={{ color: 'var(--text-secondary)', fontWeight: 400, fontSize: '0.875rem', marginLeft: 8 }}>{app.currentBank} → {app.targetBank}</span>}
                        </div>
                        <div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                          {profile?.email}{profile?.phone && <span style={{ marginLeft: 8 }}>· {profile.phone}</span>}
                          <span style={{ marginLeft: 8 }}>· Applied {fmtDate(app.createdAt || app.submittedAt)}</span>
                        </div>
                      </div>
                    </div>
                    <div className="pipeline-card__right">
                      {app.monthlySaving > 0 && <div className="pipeline-saving"><span style={{ color: 'var(--mint)', fontWeight: 700 }}>{fmt(app.monthlySaving)}/mo</span><span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>savings</span></div>}
                      <span className={`pill pill--${app.status === 'approved' || app.status === 'completed' ? 'green' : app.status === 'rejected' ? 'orange' : 'blue'}`}>{(app.status || 'pending').replace(/_/g,' ')}</span>
                      <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{isOpen ? '▲' : '▼'}</span>
                    </div>
                  </div>

                  <div className="pipeline-progress">
                    <div className="pipeline-progress__bar"><div className="pipeline-progress__fill" style={{ width: `${progress}%` }} /></div>
                    <span className="pipeline-progress__label">{progress}% complete</span>
                  </div>

                  {entry.brokerSentAt && <div className="pipeline-sent-banner">✓ Sent to {entry.brokerSentTo} on {fmtDate(entry.brokerSentAt)}</div>}

                  {isOpen && (
                    <div className="pipeline-detail fade-in">
                      <div className="pipeline-detail__grid">
                        <div className="pipeline-section">
                          <div className="pipeline-section__title">Financial Profile</div>
                          {[['Monthly income', fmt(profile?.income||0)], ['Monthly debt', fmt(profile?.debt||0)], ['DTI ratio', profile?.dtiRatio != null ? `${profile.dtiRatio}%` : '—'], ['Max qualifying bond', fmt(profile?.maxBond||0)], ['Employment', (profile?.employmentType||'').replace(/_/g,' ').replace(/\b\w/g,ch=>ch.toUpperCase())||'—']].map(([l,v]) => (
                            <div key={l} className="pipeline-row"><span>{l}</span><strong>{v}</strong></div>
                          ))}
                        </div>
                        <div className="pipeline-section">
                          <div className="pipeline-section__title">Risk Score</div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 12 }}>
                            <div className="pipeline-score-circle" style={{ background: gradeColor }}>{rs?.score||'—'}</div>
                            <div><div style={{ fontWeight: 700, fontSize: '1.125rem' }}>Grade {rs?.grade||'—'}</div><div style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>out of 100</div></div>
                          </div>
                          {rs?.factors?.map(f => (
                            <div key={f.name} style={{ marginBottom: 8 }}>
                              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: 3 }}><span style={{ color: 'var(--text-secondary)' }}>{f.name}</span><span style={{ fontWeight: 600 }}>{f.score}/100</span></div>
                              <div style={{ background: 'var(--border-color)', borderRadius: 4, height: 5 }}><div style={{ background: gradeColor, width: `${f.score}%`, height: '100%', borderRadius: 4, transition: 'width 0.5s' }} /></div>
                            </div>
                          ))}
                        </div>
                        <div className="pipeline-section">
                          <div className="pipeline-section__title">Documents</div>
                          {['identity','income','bank_statement','bond_statement','residence'].map(cat => {
                            const doc = (app.documents||[]).find(d=>(d.category||'').toLowerCase()===cat)||(profile?.documents||[]).find(d=>(d.category||'').toLowerCase()===cat);
                            const labels = { identity:'SA ID / Passport', income:'Payslips (3 months)', bank_statement:'Bank statements', bond_statement:'Bond statement', residence:'Proof of residence' };
                            return <div key={cat} className={`pipeline-doc-item ${doc?'pipeline-doc-item--done':''}`}><span>{doc?'✓':'○'}</span><span>{labels[cat]}</span></div>;
                          })}
                        </div>
                        {profile?.loans?.length > 0 && (
                          <div className="pipeline-section">
                            <div className="pipeline-section__title">Current Bond</div>
                            {[['Bank',profile.loans[0].bank],['Balance',fmt(profile.loans[0].amount)],['Rate',fmtPct(profile.loans[0].rate)],['Term',`${profile.loans[0].term} years`],['Monthly saving',app.monthlySaving?fmt(app.monthlySaving):'—']].map(([l,v]) => (
                              <div key={l} className="pipeline-row"><span>{l}</span><strong>{v||'—'}</strong></div>
                            ))}
                          </div>
                        )}
                      </div>
                      <div className="pipeline-actions">
                        <div className="pipeline-actions__status">
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Status:</span>
                          {['submitted','under_review','approved','in_progress','completed','rejected'].map(s => (
                            <button key={s} className={`pipeline-status-btn ${app.status===s?'active':''}`} onClick={() => updateStatus(entry, s)} disabled={statusUpdating===pipelineId}>{s.replace(/_/g,' ')}</button>
                          ))}
                        </div>
                        {type === 'swap' && (() => {
                          const of = offerForms[pipelineId] || {};
                          return (
                            <div className="pipeline-actions__section">
                              <div className="pipeline-section__title">Record Bank Offer</div>
                              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8, marginBottom: 8 }}>
                                <div><label className="pipeline-label">Bank</label><select value={of.bank||''} onChange={e=>setOfferForms(f=>({...f,[pipelineId]:{...f[pipelineId],bank:e.target.value}}))} className="pipeline-input"><option value="">Select</option>{['ABSA','FNB','Nedbank','Standard Bank','Capitec','Investec','SA Home Loans'].map(b=><option key={b} value={b}>{b}</option>)}</select></div>
                                <div><label className="pipeline-label">Rate (%)</label><input type="number" step="0.05" value={of.rate||''} onChange={e=>setOfferForms(f=>({...f,[pipelineId]:{...f[pipelineId],rate:e.target.value}}))} className="pipeline-input" placeholder="10.5" /></div>
                                <div><label className="pipeline-label">Monthly (R)</label><input type="number" value={of.monthlyPayment||''} onChange={e=>setOfferForms(f=>({...f,[pipelineId]:{...f[pipelineId],monthlyPayment:e.target.value}}))} className="pipeline-input" placeholder="12500" /></div>
                              </div>
                              <Button variant="lime" size="sm" onClick={() => recordOffer(entry)}>Record offer + notify</Button>
                              {(app.offers||[]).length > 0 && <div style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{(app.offers||[]).map(o=>`${o.bank} ${o.rate}%`).join(', ')}</div>}
                            </div>
                          );
                        })()}
                        {type === 'swap' && ['in_progress','completed','approved'].includes(app.status) && (() => {
                          const sf = stageForms[pipelineId] || {};
                          return (
                            <div className="pipeline-actions__section">
                              <div className="pipeline-section__title">Conveyancing Stage</div>
                              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                <div><label className="pipeline-label">Stage</label><select value={sf.stage||app.conveyancingStage||''} onChange={e=>setStageForms(f=>({...f,[pipelineId]:{...f[pipelineId],stage:e.target.value}}))} className="pipeline-input" style={{ minWidth: 200 }}><option value="">Select stage</option>{CONVEYANCING_STAGES.map(s=><option key={s} value={s}>{s.replace(/_/g,' ')}</option>)}</select></div>
                                <div style={{ flex: 1, minWidth: 180 }}><label className="pipeline-label">Note</label><input type="text" value={sf.note||''} onChange={e=>setStageForms(f=>({...f,[pipelineId]:{...f[pipelineId],note:e.target.value}}))} className="pipeline-input" style={{ width: '100%' }} placeholder="Optional note" /></div>
                                <Button variant="forest" size="sm" onClick={() => { if (sf.stage) updateStage(entry, sf.stage, sf.note); }}>Update + notify</Button>
                              </div>
                              {app.conveyancingStage && <div style={{ marginTop: 8, fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Current: <strong>{app.conveyancingStage.replace(/_/g,' ')}</strong></div>}
                            </div>
                          );
                        })()}
                        {!entry.brokerSentAt ? (
                          <div className="pipeline-actions__broker">
                            <div className="pipeline-section__title">Send to Mortgage Broker</div>
                            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
                              <div><label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Broker name</label><input type="text" placeholder="John Smith" value={bf.brokerName||''} onChange={e=>setBrokerForm(f=>({...f,[pipelineId]:{...f[pipelineId],brokerName:e.target.value}}))} className="pipeline-input" /></div>
                              <div><label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Broker email</label><input type="email" placeholder="broker@example.com" value={bf.brokerEmail||''} onChange={e=>setBrokerForm(f=>({...f,[pipelineId]:{...f[pipelineId],brokerEmail:e.target.value}}))} className="pipeline-input" /></div>
                            </div>
                            <div style={{ marginBottom: 12 }}><label style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)', display: 'block', marginBottom: 4 }}>Notes</label><textarea placeholder="Context for broker…" value={bf.notes||''} onChange={e=>setBrokerForm(f=>({...f,[pipelineId]:{...f[pipelineId],notes:e.target.value}}))} className="pipeline-input pipeline-textarea" rows={2} /></div>
                            <div style={{ display: 'flex', gap: 12 }}>
                              <Button variant="lime" size="sm" loading={sending===pipelineId} onClick={() => sendToBroker(entry)}>Send to broker + notify client</Button>
                              <a href={admin.profilePdfUrl(type, app.id)} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">Download PDF</a>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: 'flex', gap: 12 }}>
                            <a href={admin.profilePdfUrl(type, app.id)} target="_blank" rel="noreferrer" className="btn btn--ghost btn--sm">Download PDF</a>
                            <Button variant="outline" size="sm" onClick={() => setPipeline(p => p.map(e2 => e2.pipelineId === pipelineId ? { ...e2, brokerSentAt: null, brokerSentTo: null } : e2))}>Resend</Button>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </CardBody>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  BUYER PIPELINE TAB (unchanged)
// ═══════════════════════════════════════════════════════════
function BuyerPipelineTab({ intents, showToast }) {
  const ready   = intents.filter(b => b.met);
  const watching = intents.filter(b => !b.met);
  function waLink(phone) { const clean = phone.replace(/\D/g,'').replace(/^0/,'27'); return `https://wa.me/${clean}`; }
  function statusBadge(b) {
    if (b.met) return <span className="buyer-badge buyer-badge--ready">Ready to move</span>;
    if (b.gap !== null && b.gap < 200) return <span className="buyer-badge buyer-badge--close">Almost there</span>;
    return <span className="buyer-badge buyer-badge--watching">Watching</span>;
  }
  function IntentRow({ b }) {
    return (
      <div className="buyer-row">
        <div className="buyer-row__meta"><div className="buyer-row__name">{b.name}</div><div className="buyer-row__email">{b.email}</div>{b.note && <div className="buyer-row__note">"{b.note}"</div>}</div>
        <div className="buyer-row__stats">
          <div className="buyer-stat"><div className="buyer-stat__label">Balance</div><div className="buyer-stat__val">{b.balance ? fmt(b.balance) : '—'}</div></div>
          <div className="buyer-stat"><div className="buyer-stat__label">Current saving</div><div className={`buyer-stat__val ${b.currentSaving > 0 ? 'buyer-stat__val--green' : ''}`}>{b.currentSaving !== null ? `${fmt(b.currentSaving)}/mo` : '—'}{b.bestBank && <span className="buyer-stat__sub"> via {b.bestBank}</span>}</div></div>
          <div className="buyer-stat"><div className="buyer-stat__label">Target</div><div className="buyer-stat__val">{fmt(b.monthlyThreshold)}/mo</div></div>
          <div className="buyer-stat"><div className="buyer-stat__label">Gap</div><div className={`buyer-stat__val ${b.met ? 'buyer-stat__val--green' : b.gap < 200 ? 'buyer-stat__val--amber' : ''}`}>{b.met ? '✓ Met' : b.gap !== null ? `${fmt(b.gap)} away` : '—'}</div></div>
        </div>
        <div className="buyer-row__actions">
          {statusBadge(b)}
          {b.phone ? <a href={waLink(b.phone)} target="_blank" rel="noreferrer" className="buyer-wa-btn"><svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>WhatsApp</a> : <span className="buyer-no-phone">No phone</span>}
          <div className="buyer-row__since">Set {fmtDate(b.createdAt)}</div>
        </div>
      </div>
    );
  }
  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 20 }}>
        <h2 style={{ fontFamily: 'var(--font-serif)', fontSize: '1.5rem' }}>Buyer Pipeline</h2>
        <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>{intents.length} watching · {ready.length} ready</span>
      </div>
      {intents.length === 0 ? <Card><CardBody><p style={{ color: 'var(--text-secondary)', textAlign: 'center', padding: 'var(--space-8)' }}>No customers have set savings alerts yet.</p></CardBody></Card> : (
        <>
          {ready.length > 0 && <div style={{ marginBottom: 24 }}><div className="buyer-section-label buyer-section-label--ready">🟢 Ready to move — call now ({ready.length})</div><div className="buyer-list">{ready.map(b => <IntentRow key={b.alertId} b={b} />)}</div></div>}
          {watching.length > 0 && <div><div className="buyer-section-label">👁️ Watching ({watching.length})</div><div className="buyer-list">{watching.map(b => <IntentRow key={b.alertId} b={b} />)}</div></div>}
        </>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  SWAPS KANBAN (unchanged)
// ═══════════════════════════════════════════════════════════
const KANBAN_COLS = [
  { key: 'pending',                  label: 'New',                 color: '#6b7280' },
  { key: 'offer_accepted',           label: 'Offer Accepted',      color: '#2563eb' },
  { key: 'cancellation_notice_sent', label: 'Cancellation Notice', color: '#7c3aed' },
  { key: 'attorney_instructed',      label: 'Attorney',            color: '#d97706' },
  { key: 'valuation_ordered',        label: 'Valuation Ordered',   color: '#ea580c' },
  { key: 'valuation_done',           label: 'Valuation Done',      color: '#16a34a' },
  { key: 'registration_in_progress', label: 'Registration',        color: '#0891b2' },
  { key: 'registered',               label: 'Registered',          color: '#059669' },
  { key: 'complete',                 label: 'Complete',            color: '#15803d' },
];
const STAGE_ORDER = KANBAN_COLS.map(c => c.key);

// ── Required doc categories ───────────────────────────────────────────────────
const REQUIRED_DOC_CATEGORIES = [
  { key: 'bank_statement', label: 'Bank statements (3 months)', required: true },
  { key: 'income',         label: 'Payslips (3 months)',        required: true },
  { key: 'identity',       label: 'SA ID / Passport',           required: true },
  { key: 'bond_statement', label: 'Current bond statement',     required: false },
  { key: 'residence',      label: 'Proof of residence',         required: false },
];

function docUrl(doc, userId, swapId) {
  if (doc.path) return doc.path;
  if (doc.vaultId) return doc.path || null;
  if (doc.name) return `/uploads/${userId}/${swapId}/${doc.name}`;
  return null;
}

function fmtBytes(b) {
  if (!b) return '';
  if (b < 1024) return `${b} B`;
  if (b < 1024 * 1024) return `${(b/1024).toFixed(0)} KB`;
  return `${(b/1024/1024).toFixed(1)} MB`;
}

// ── Intake card: one submitted/awaiting application ──────────────────────────
function IntakeCard({ app, onChange, showToast }) {
  const [open, setOpen]           = useState(false);
  const [saving, setSaving]       = useState(false);
  const [reqMsg, setReqMsg]       = useState('');
  const [showReq, setShowReq]     = useState(false);
  const [rejectNote, setRejectNote] = useState('');
  const [showReject, setShowReject] = useState(false);
  const [readiness, setReadiness]  = useState(null);
  const [form, setForm] = useState({
    grossIncome:      app.incomeVerification?.grossIncome      ? String(app.incomeVerification.grossIncome)      : '',
    employer:         app.incomeVerification?.employer          || '',
    employmentType:   app.incomeVerification?.employmentType    || 'salaried',
    confirmedBalance: app.incomeVerification?.confirmedBalance  ? String(app.incomeVerification.confirmedBalance) : '',
    employedYears:    app.incomeVerification?.employedYears     ? String(app.incomeVerification.employedYears)    : '',
    debtTotal:        app.incomeVerification?.debtTotal         ? String(app.incomeVerification.debtTotal)        : '',
    notes:            app.incomeVerification?.notes             || '',
  });

  const iv = app.incomeVerification;
  const docs = app.documents || [];
  const attachedCats = docs.map(d => (d.category || '').toLowerCase());
  const hasBankStatement = attachedCats.includes('bank_statement') || docs.some(d => (d.originalName||'').toLowerCase().includes('statement'));
  const requiredMissing = REQUIRED_DOC_CATEGORIES.filter(c => c.required && !attachedCats.includes(c.key));
  const daysOld = Math.floor((Date.now() - new Date(app.submittedAt || app.createdAt).getTime()) / 86400000);
  const isStale = daysOld > 7 && app.status === 'submitted';
  const riskColor = { A:'#16a34a', B:'#4a7fa5', C:'#d97706', D:'#dc2626', E:'#9ca3af' }[app.riskGrade] || '#9ca3af';

  async function saveVerification() {
    setSaving(true);
    try {
      const updated = await admin.verifyIncome(app.id, {
        grossIncome:      parseFloat(form.grossIncome) || null,
        employer:         form.employer || null,
        employmentType:   form.employmentType || null,
        confirmedBalance: parseFloat(form.confirmedBalance) || null,
        employedYears:    parseFloat(form.employedYears) || null,
        debtTotal:        parseFloat(form.debtTotal) || null,
        notes:            form.notes || null,
      });
      onChange(updated);
      showToast('Income verification saved', 'success');
    } catch (err) { showToast(err.message || 'Could not save', 'error'); }
    finally { setSaving(false); }
  }

  async function loadReadiness() {
    try {
      const r = await admin.swapReadiness(app.id);
      setReadiness(r);
    } catch { /* silent */ }
  }

  async function sendToBank() {
    setSaving(true);
    try {
      const updated = await admin.updateSwap(app.id, { status: 'under_review', note: 'Application submitted to banks for review.' });
      onChange(updated);
      showToast('Application sent to banks', 'success');
    } catch (err) { showToast(err.message || 'Could not update', 'error'); }
    finally { setSaving(false); }
  }

  async function requestMoreDocs() {
    if (!reqMsg.trim()) return;
    setSaving(true);
    try {
      const updated = await admin.requestDocs(app.id, reqMsg.trim());
      onChange(updated);
      setReqMsg(''); setShowReq(false);
      showToast('Document request sent to customer', 'success');
    } catch (err) { showToast(err.message || 'Could not send', 'error'); }
    finally { setSaving(false); }
  }

  async function rejectApp() {
    if (!rejectNote.trim()) { showToast('Please enter a reason', 'error'); return; }
    setSaving(true);
    try {
      const updated = await admin.updateSwap(app.id, { status: 'rejected', note: rejectNote.trim() });
      onChange(updated);
      setShowReject(false);
      showToast('Application rejected', 'success');
    } catch (err) { showToast(err.message || 'Could not reject', 'error'); }
    finally { setSaving(false); }
  }

  const statusColor = app.status === 'awaiting_documents' ? '#d97706' : '#6366f1';
  const dti = iv?.grossIncome && iv?.debtTotal ? Math.round((iv.debtTotal / iv.grossIncome) * 100) : null;
  const readinessColor = !readiness ? '#9ca3af' : readiness.score >= 80 ? '#16a34a' : readiness.score >= 50 ? '#d97706' : '#ef4444';

  return (
    <>
    <div style={{ background: 'var(--bg-card)', border: `1px solid ${isStale ? '#f59e0b44' : 'var(--border-color)'}`, borderRadius: 10, marginBottom: 14, overflow: 'hidden' }}>
      {/* Header row */}
      <div onClick={() => { setOpen(o => !o); if (!open && !readiness) loadReadiness(); }} style={{ padding: '14px 18px', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div style={{ fontWeight: 700, fontSize: '0.9375rem' }}>{app.customerName}</div>
          <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: riskColor, background: riskColor+'18', padding: '2px 8px', borderRadius: 4 }}>{app.riskGrade || '?'}</span>
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>{app.currentBank} → {app.targetBank}</span>
          {app.currentBalance > 0 && <span style={{ fontSize: '0.8125rem', fontWeight: 600 }}>{fmt(app.currentBalance)}</span>}
          {app.monthlySaving > 0 && <span style={{ fontSize: '0.8125rem', color: '#16a34a', fontWeight: 600 }}>Save {fmt(app.monthlySaving)}/mo</span>}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {readiness && <span style={{ fontSize: '0.75rem', fontWeight: 700, color: readinessColor, background: readinessColor+'18', padding: '2px 9px', borderRadius: 10 }} title={readiness.ready ? 'All docs present' : readiness.missingCritical.map(c=>c.label).join(', ')}>{readiness.score}% ready</span>}
          {isStale && <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600 }}>⚠ {daysOld}d old</span>}
          <span style={{ fontSize: '0.75rem', padding: '3px 9px', borderRadius: 10, background: statusColor+'18', color: statusColor, fontWeight: 600 }}>{app.status.replace(/_/g,' ')}</span>
          <span style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{docs.length} doc{docs.length !== 1 ? 's' : ''}</span>
          {!hasBankStatement && <span style={{ fontSize: '0.75rem', color: '#ef4444', fontWeight: 600 }}>No statement</span>}
          <span style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>{open ? '▲' : '▼'}</span>
        </div>
      </div>

      {open && (
        <div style={{ borderTop: '1px solid var(--border-color)', padding: '18px 18px 14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>

            {/* ── Left: Documents ── */}
            <div>
              <div style={{ fontWeight: 700, fontSize: '0.875rem', marginBottom: 10 }}>Documents</div>

              {/* Required doc checklist */}
              <div style={{ marginBottom: 12 }}>
                {REQUIRED_DOC_CATEGORIES.map(cat => {
                  const catDocs = docs.filter(d => (d.category||'').toLowerCase() === cat.key || (!d.category && cat.key === 'bank_statement' && (d.originalName||'').toLowerCase().includes('statement')));
                  const have = catDocs.length > 0;
                  return (
                    <div key={cat.key} style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 5, fontSize: '0.8125rem' }}>
                      <span style={{ color: have ? '#16a34a' : cat.required ? '#ef4444' : '#9ca3af', fontWeight: 700, width: 14 }}>{have ? '✓' : cat.required ? '✗' : '○'}</span>
                      <span style={{ color: have ? 'var(--text-primary)' : 'var(--text-secondary)', flex: 1 }}>{cat.label}</span>
                      {catDocs.map((d, i) => {
                        const url = docUrl(d, app.userId, app.id);
                        return url ? (
                          <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', color: 'var(--mint)', textDecoration: 'none', background: 'rgba(0,0,0,0.05)', padding: '1px 6px', borderRadius: 3 }}
                            title={d.originalName}>
                            {d.vaultId ? 'vault' : `↓ ${fmtBytes(d.size)}`}
                          </a>
                        ) : <span key={i} style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>{d.originalName?.slice(0,18)}</span>;
                      })}
                    </div>
                  );
                })}
              </div>

              {/* All uploaded docs */}
              {docs.length > 0 && (
                <div style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 6 }}>All uploaded files</div>
                  {docs.map((d, i) => {
                    const url = docUrl(d, app.userId, app.id);
                    return (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8125rem', marginBottom: 4 }}>
                        <span>📎</span>
                        <span style={{ flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={d.originalName}>{d.originalName || d.name}</span>
                        <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', flexShrink: 0 }}>{fmtBytes(d.size)}</span>
                        {url && (
                          <a href={url} target="_blank" rel="noopener noreferrer"
                            style={{ fontSize: '0.75rem', color: 'var(--mint)', textDecoration: 'none', flexShrink: 0 }}>
                            View
                          </a>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {docs.length === 0 && (
                <div style={{ fontSize: '0.8125rem', color: '#ef4444', padding: '8px 0' }}>No documents uploaded yet.</div>
              )}

              {/* Admin notes from customer */}
              {(app.notes||[]).filter(n => n.type === 'doc_request').slice(-1).map((n, i) => (
                <div key={i} style={{ marginTop: 10, fontSize: '0.8125rem', padding: '8px 10px', background: '#d9770614', borderRadius: 5, borderLeft: '3px solid #d97706', color: 'var(--text-secondary)' }}>
                  <strong style={{ color: '#d97706' }}>Docs requested:</strong> {n.text}
                </div>
              ))}

              {/* Contact */}
              <div style={{ marginTop: 12 }}>
                <a href={`mailto:${app.customerEmail}`} style={{ fontSize: '0.8125rem', color: 'var(--mint)', textDecoration: 'none' }}>{app.customerEmail}</a>
              </div>
            </div>

            {/* ── Right: Income verification ── */}
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                <span style={{ fontWeight: 700, fontSize: '0.875rem' }}>Income Verification</span>
                {iv?.verifiedAt && <span style={{ fontSize: '0.75rem', color: '#16a34a', fontWeight: 600 }}>✓ Verified {fmtDate(iv.verifiedAt)}</span>}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                {[
                  { label: 'Gross monthly income (R)', key: 'grossIncome', type: 'number', placeholder: 'e.g. 45000' },
                  { label: 'Confirmed bond balance (R)', key: 'confirmedBalance', type: 'number', placeholder: 'e.g. 1800000' },
                  { label: 'Employer', key: 'employer', placeholder: 'Company name' },
                  { label: 'Years employed', key: 'employedYears', type: 'number', placeholder: 'e.g. 5' },
                  { label: 'Monthly debt obligations (R)', key: 'debtTotal', type: 'number', placeholder: 'Car, store cards, etc.' },
                ].map(field => (
                  <div key={field.key} style={field.key === 'employer' ? { gridColumn: '1/-1' } : {}}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>{field.label}</div>
                    <input
                      type={field.type || 'text'}
                      value={form[field.key]}
                      placeholder={field.placeholder}
                      onChange={e => setForm(f => ({ ...f, [field.key]: e.target.value }))}
                      style={{ width: '100%', padding: '5px 8px', fontSize: '0.8125rem', border: '1px solid var(--border-color)', borderRadius: 5, background: 'var(--bg-page)', color: 'var(--text-primary)', boxSizing: 'border-box' }}
                    />
                  </div>
                ))}
                <div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Employment type</div>
                  <select value={form.employmentType} onChange={e => setForm(f => ({ ...f, employmentType: e.target.value }))}
                    style={{ width: '100%', padding: '5px 8px', fontSize: '0.8125rem', border: '1px solid var(--border-color)', borderRadius: 5, background: 'var(--bg-page)', color: 'var(--text-primary)' }}>
                    <option value="salaried">Salaried</option>
                    <option value="self_employed">Self-employed</option>
                    <option value="contract">Contract</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                {/* DTI display */}
                {dti !== null && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>DTI ratio</div>
                    <span style={{ fontSize: '0.875rem', fontWeight: 700, color: dti > 50 ? '#ef4444' : dti > 35 ? '#d97706' : '#16a34a' }}>{dti}%</span>
                    <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{dti > 50 ? '(high)' : dti > 35 ? '(moderate)' : '(good)'}</span>
                  </div>
                )}
              </div>

              <div style={{ marginTop: 8 }}>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: 3 }}>Notes</div>
                <textarea value={form.notes} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
                  placeholder="Income notes, red flags, conditions..."
                  style={{ width: '100%', padding: '6px 8px', fontSize: '0.8125rem', border: '1px solid var(--border-color)', borderRadius: 5, background: 'var(--bg-page)', color: 'var(--text-primary)', minHeight: 60, resize: 'vertical', boxSizing: 'border-box' }} />
              </div>
              <Button variant="ghost" size="sm" loading={saving} onClick={saveVerification} style={{ marginTop: 8 }}>Save verification</Button>
            </div>
          </div>

          {/* ── Action bar ── */}
          <div style={{ marginTop: 18, paddingTop: 14, borderTop: '1px solid var(--border-color)', display: 'flex', gap: 10, flexWrap: 'wrap', alignItems: 'flex-start' }}>

            {/* Send to banks */}
            <Button variant="lime" size="sm" loading={saving} disabled={app.status !== 'submitted'}
              title={app.status !== 'submitted' ? `Status is "${app.status}" — must be submitted` : 'Mark as sent to banks for negotiation'}
              onClick={sendToBank}>
              ✉ Send to banks
            </Button>

            <div>
              {!showReq ? (
                <Button variant="ghost" size="sm" onClick={() => setShowReq(true)}>Request docs</Button>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <textarea value={reqMsg} onChange={e => setReqMsg(e.target.value)}
                    placeholder="What do you need?"
                    style={{ padding: '5px 8px', fontSize: '0.8125rem', border: '1px solid var(--border-color)', borderRadius: 5, background: 'var(--bg-page)', color: 'var(--text-primary)', width: 240, minHeight: 56, resize: 'vertical' }} />
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                    <Button variant="lime" size="sm" loading={saving} onClick={requestMoreDocs}>Send</Button>
                    <Button variant="ghost" size="sm" onClick={() => { setShowReq(false); setReqMsg(''); }}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>

            <div style={{ marginLeft: 'auto' }}>
              {!showReject ? (
                <Button variant="ghost" size="sm" style={{ color: '#ef4444', borderColor: '#ef444440' }} onClick={() => setShowReject(true)}>Reject</Button>
              ) : (
                <div style={{ display: 'flex', gap: 6, alignItems: 'flex-start' }}>
                  <input value={rejectNote} onChange={e => setRejectNote(e.target.value)} placeholder="Rejection reason"
                    style={{ padding: '5px 8px', fontSize: '0.8125rem', border: '1px solid #ef444460', borderRadius: 5, background: 'var(--bg-page)', color: 'var(--text-primary)', width: 200 }} />
                  <Button variant="ghost" size="sm" loading={saving} style={{ color: '#ef4444', borderColor: '#ef444440' }} onClick={rejectApp}>Confirm</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowReject(false)}>Cancel</Button>
                </div>
              )}
            </div>
          </div>

          {/* Readiness checklist */}
          {readiness && (
            <div style={{ marginTop: 12, padding: '10px 14px', background: 'var(--bg-page)', borderRadius: 6, border: '1px solid var(--border-color)' }}>
              <div style={{ fontWeight: 600, fontSize: '0.8125rem', marginBottom: 8 }}>Application readiness: <span style={{ color: readinessColor }}>{readiness.score}/100</span></div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '4px 16px' }}>
                {readiness.checks.map(c => (
                  <span key={c.key} style={{ fontSize: '0.75rem', color: c.passed ? '#16a34a' : c.critical ? '#ef4444' : '#9ca3af' }}>
                    {c.passed ? '✓' : c.critical ? '✗' : '○'} {c.label}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
    </>
  );
}

function SwapsKanban({ swapApps, setSwapApps, showToast }) {
  const [moving, setMoving]     = useState(null);
  const [expanded, setExpanded] = useState(null);

  // Intake queue: awaiting_documents + submitted
  const intakeApps = swapApps.filter(a => ['awaiting_documents', 'submitted'].includes(a.status));
  // Active pipeline: under_review and beyond (in_progress, completed, etc.)
  const pipelineApps = swapApps.filter(a => !['awaiting_documents', 'submitted', 'rejected', 'cancelled'].includes(a.status));
  const closedApps   = swapApps.filter(a => ['rejected', 'cancelled'].includes(a.status));

  function colKey(app) { return app.conveyancingStage || (app.status === 'rejected' ? 'rejected' : app.status === 'under_review' ? 'pending' : 'pending'); }

  function updateApp(updated) {
    setSwapApps(apps => apps.map(a => a.id === updated.id ? updated : a));
  }

  async function moveStage(app, newStage) {
    if (newStage === 'pending') return;
    setMoving(app.id);
    try {
      await admin.updateStage(app.id, newStage, '');
      setSwapApps(apps => apps.map(a => a.id === app.id ? { ...a, conveyancingStage: newStage, status: newStage === 'complete' ? 'completed' : 'in_progress' } : a));
      showToast(`Moved to ${newStage.replace(/_/g,' ')}`, 'success');
    } catch (err) { showToast(err.message || 'Could not update', 'error'); }
    finally { setMoving(null); }
  }

  return (
    <div className="fade-in">
      {/* ── Intake queue ── */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <h2 style={{ fontFamily: 'var(--font-serif)', margin: 0 }}>Intake Queue</h2>
          {intakeApps.length > 0 && <span style={{ background: '#d97706', color: '#fff', borderRadius: 10, padding: '2px 9px', fontSize: '0.8125rem', fontWeight: 700 }}>{intakeApps.length}</span>}
          <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Applications awaiting review before sending to banks</span>
        </div>
        {intakeApps.length === 0 ? (
          <div style={{ border: '1.5px dashed var(--border-color)', borderRadius: 8, padding: 24, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.875rem' }}>
            No applications in intake — all clear
          </div>
        ) : (
          intakeApps
            .sort((a, b) => {
              // submitted first, then awaiting_documents; within each, newest first
              if (a.status === 'submitted' && b.status !== 'submitted') return -1;
              if (b.status === 'submitted' && a.status !== 'submitted') return 1;
              return new Date(b.submittedAt || b.createdAt) - new Date(a.submittedAt || a.createdAt);
            })
            .map(app => <IntakeCard key={app.id} app={app} onChange={updateApp} showToast={showToast} />)
        )}
      </div>

      {/* ── Active pipeline kanban ── */}
      {(pipelineApps.length > 0 || swapApps.some(a => a.status === 'under_review')) && (
        <div style={{ marginBottom: 32 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <h2 style={{ fontFamily: 'var(--font-serif)', margin: 0 }}>Active Pipeline</h2>
            <span style={{ fontSize: '0.8125rem', color: 'var(--text-secondary)' }}>Applications with banks / in conveyancing</span>
          </div>
          <div style={{ overflowX: 'auto', paddingBottom: 16 }}>
            <div style={{ display: 'flex', gap: 16, minWidth: 'max-content' }}>
              {KANBAN_COLS.map(col => {
                const cards = swapApps.filter(a => {
                  if (col.key === 'pending') return a.status === 'under_review' && !a.conveyancingStage;
                  return a.conveyancingStage === col.key;
                });
                return (
                  <div key={col.key} style={{ width: 220, flexShrink: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, padding: '6px 10px', background: col.color+'18', borderRadius: 6, borderLeft: `3px solid ${col.color}` }}>
                      <span style={{ fontWeight: 700, fontSize: '0.8125rem', color: col.color }}>{col.label}</span>
                      {cards.length > 0 && <span style={{ marginLeft: 'auto', background: col.color, color: '#fff', borderRadius: 10, padding: '1px 7px', fontSize: '0.75rem', fontWeight: 700 }}>{cards.length}</span>}
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {cards.map(app => (
                        <KanbanCard key={app.id} app={app} colColor={col.color} expanded={expanded === app.id} onToggle={() => setExpanded(e => e === app.id ? null : app.id)} onMove={moveStage} moving={moving === app.id} stageOrder={STAGE_ORDER} colKey={col.key} showToast={showToast} setSwapApps={setSwapApps} />
                      ))}
                      {cards.length === 0 && <div style={{ border: '1.5px dashed var(--border-color)', borderRadius: 6, padding: 14, textAlign: 'center', color: 'var(--text-secondary)', fontSize: '0.8125rem' }}>Empty</div>}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* ── Closed ── */}
      {closedApps.length > 0 && (
        <div>
          <div style={{ fontWeight: 600, marginBottom: 12, color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Closed ({closedApps.length})</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
            {closedApps.map(app => (
              <div key={app.id} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-color)', borderRadius: 8, padding: 12, minWidth: 180, opacity: 0.65 }}>
                <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{app.customerName}</div>
                <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>{app.currentBank} → {app.targetBank}</div>
                <div style={{ fontSize: '0.75rem', marginTop: 4, color: app.status === 'rejected' ? '#ef4444' : 'var(--text-secondary)' }}>{app.status}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function KanbanCard({ app, colColor, expanded, onToggle, onMove, moving, stageOrder, colKey, showToast, setSwapApps }) {
  const [noteInput, setNoteInput] = useState('');
  const currentIdx = stageOrder.indexOf(colKey);
  const nextStage  = stageOrder[currentIdx + 1];
  const canAdvance = !!nextStage && colKey !== 'complete';
  const daysOld    = Math.floor((Date.now() - new Date(app.createdAt).getTime()) / 86400000);
  const isStale    = daysOld > 14 && colKey !== 'complete';

  return (
    <div style={{ background: 'var(--bg-card)', border: `1px solid ${isStale ? '#f59e0b' : 'var(--border-color)'}`, borderRadius: 6, overflow: 'hidden', cursor: 'pointer' }}>
      <div onClick={onToggle} style={{ padding: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 6 }}>
          <div style={{ fontWeight: 700, fontSize: '0.875rem', lineHeight: 1.3 }}>{app.customerName}</div>
          {isStale && <span title="Stale" style={{ fontSize: '0.75rem', color: '#f59e0b' }}>⚠</span>}
        </div>
        <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 3 }}>{app.currentBank} → {app.targetBank}</div>
        {app.currentBalance > 0 && <div style={{ fontSize: '0.75rem', fontWeight: 600, color: colColor, marginTop: 3 }}>{fmt(app.currentBalance)}</div>}
        <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
          <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>{daysOld}d ago</span>
          {app._brokerSentAt && <span style={{ fontSize: '0.65rem', color: '#16a34a', fontWeight: 700 }}>✉ sent</span>}
        </div>
      </div>
      {expanded && (
        <div style={{ borderTop: '1px solid var(--border-color)', padding: 10, background: 'var(--bg-page)' }} onClick={e => e.stopPropagation()}>
          {(app.offers||[]).length > 0 && <div style={{ marginBottom: 10 }}>{app.offers.map(o => <div key={o.id} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.75rem', padding: '2px 0' }}><span>{o.bank}</span><span style={{ fontWeight: 700, color: o.status==='accepted'?'var(--mint)':'var(--text-primary)' }}>{fmtPct(o.rate)}{o.status==='accepted'?' ✓':''}</span></div>)}</div>}
          {canAdvance && (
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginBottom: 8 }}>
              <input type="text" placeholder="Note (optional)" value={noteInput} onChange={e => setNoteInput(e.target.value)}
                style={{ flex: 1, padding: '4px 7px', fontSize: '0.75rem', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-card)', color: 'var(--text-primary)' }} />
              <Button variant="lime" size="sm" loading={moving} onClick={async () => {
                await admin.updateStage(app.id, nextStage, noteInput);
                setSwapApps(apps => apps.map(a => a.id === app.id ? { ...a, conveyancingStage: nextStage, status: nextStage === 'complete' ? 'completed' : 'in_progress' } : a));
                setNoteInput('');
                showToast(`→ ${nextStage.replace(/_/g,' ')}`, 'success');
              }}>→ {nextStage.replace(/_/g,' ').replace(/\b\w/g,c=>c.toUpperCase()).slice(0,14)}</Button>
            </div>
          )}
          <a href={`mailto:${app.customerEmail}`} style={{ fontSize: '0.75rem', color: 'var(--mint)', textDecoration: 'none' }}>Email</a>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  BULK EMAIL
// ═══════════════════════════════════════════════════════════
const SEGMENT_OPTIONS = [
  { value: 'all',           label: 'All verified users' },
  { value: 'no_loan',       label: 'No bond on file' },
  { value: 'has_loan',      label: 'Has active bond' },
  { value: 'yellow_zone',   label: 'Affordability: Yellow zone' },
  { value: 'red_zone',      label: 'Affordability: Red zone' },
  { value: 'green_zone',    label: 'Affordability: Green zone' },
  { value: 'no_swap',       label: 'No swap application yet' },
  { value: 'has_swap',      label: 'Has swap application' },
  { value: 'stale_fitness', label: 'No Financial Fitness upload (30+ days)' },
];


// ═══════════════════════════════════════════════════════════
//  STAFF MANAGEMENT (super-admin only)
// ═══════════════════════════════════════════════════════════


// ══════════════════════════════════════════════════════════════════════════════
//  BANK SUBMISSIONS TAB
// ══════════════════════════════════════════════════════════════════════════════

const BANKS = ['ABSA', 'FNB', 'Nedbank', 'Standard Bank', 'Capitec', 'SA Home Loans', 'Investec'];
const BANK_STATUS_COLORS = {
  pending:      '#9ca3af',
  submitted:    '#3b82f6',
  under_review: '#d97706',
  quoted:       '#16a34a',
  accepted:     '#16a34a',
  declined:     '#ef4444',
  expired:      '#6b7280',
};
const BANK_STATUS_LABELS = {
  pending:      'Pending',
  submitted:    'Submitted',
  under_review: 'Under review',
  quoted:       'Quote received',
  accepted:     'Accepted',
  declined:     'Declined',
  expired:      'Expired',
};

function BankStatusBadge({ status }) {
  const color = BANK_STATUS_COLORS[status] || '#9ca3af';
  const label = BANK_STATUS_LABELS[status] || status;
  return (
    <span style={{ display:'inline-flex', alignItems:'center', gap:4, padding:'2px 8px', borderRadius:4, fontSize:'0.75rem', fontWeight:700,
      background: color + '18', color, border: `1px solid ${color}40` }}>
      {label}
    </span>
  );
}

function NewSubmissionForm({ onCreated, showToast }) {
  const [customers, setCustomers] = useState([]);
  const [form, setForm] = useState({ customerId:'', requestedAmount:'', adminNotes:'', selectedBanks: [...BANKS] });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    admin.users({ limit: 500 }).then(d => setCustomers(d?.customers || [])).catch(() => {});
  }, []);

  function toggleBank(b) {
    setForm(f => ({
      ...f,
      selectedBanks: f.selectedBanks.includes(b)
        ? f.selectedBanks.filter(x => x !== b)
        : [...f.selectedBanks, b]
    }));
  }

  async function save() {
    if (!form.customerId) { showToast('Select a customer', 'error'); return; }
    if (!form.requestedAmount) { showToast('Enter the bond amount', 'error'); return; }
    setSaving(true);
    try {
      const res = await bsApi.create({
        customerId:     form.customerId,
        requestedAmount: parseFloat(form.requestedAmount),
        selectedBanks:  form.selectedBanks,
        adminNotes:     form.adminNotes,
      });
      onCreated(res.submission);
      showToast('Submission created', 'success');
    } catch(e) {
      showToast(e.message || 'Could not create submission', 'error');
    } finally {
      setSaving(false);
    }
  }

  const cust = customers.find(c => c.id === form.customerId);

  return (
    <div className="bs-new-form">
      <div className="bs-new-form__title">New submission</div>
      <div className="bs-new-form__fields">
        <div>
          <Lbl>Customer</Lbl>
          <select
            className="adm-select"
            value={form.customerId}
            onChange={e => setForm(f => ({ ...f, customerId: e.target.value }))}
          >
            <option value="">Select customer…</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name} ({c.email})</option>)}
          </select>
        </div>
        <div>
          <Lbl>Bond amount (R)</Lbl>
          <input
            type="number"
            className="adm-input"
            placeholder="1 800 000"
            value={form.requestedAmount}
            onChange={e => setForm(f => ({ ...f, requestedAmount: e.target.value }))}
          />
        </div>
        <div>
          <Lbl>Notes</Lbl>
          <input
            type="text"
            className="adm-input"
            placeholder="Any notes for the banks…"
            value={form.adminNotes}
            onChange={e => setForm(f => ({ ...f, adminNotes: e.target.value }))}
          />
        </div>
        <div>
          <Lbl>Submit to banks</Lbl>
          <div className="bs-bank-toggles">
            {BANKS.map(b => (
              <button
                key={b}
                className={`bs-bank-toggle ${form.selectedBanks.includes(b) ? 'bs-bank-toggle--on' : ''}`}
                onClick={() => toggleBank(b)}
                type="button"
              >
                {b}
              </button>
            ))}
          </div>
        </div>
      </div>
      <button className="bs-new-form__btn" onClick={save} disabled={saving || !form.customerId || !form.requestedAmount}>
        {saving ? 'Creating…' : 'Create submission'}
      </button>
    </div>
  );
}

function QuoteForm({ bank, entry, onSave, onClose }) {
  const [status, setStatus] = useState(entry?.status || 'submitted');
  const [rate,    setRate]  = useState(entry?.quote?.interestRate   || '');
  const [amount,  setAmt]   = useState(entry?.quote?.approvedAmount || '');
  const [monthly, setMthly] = useState(entry?.quote?.monthlyPayment || '');
  const [fees,    setFees]  = useState(entry?.quote?.fees           || '');
  const [validUntil, setVU] = useState(entry?.quote?.validUntil     || '');
  const [conditions, setCond] = useState(entry?.quote?.conditions   || '');
  const [notes, setNotes]   = useState(entry?.notes                 || '');
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    try {
      await onSave(bank, {
        status,
        quote: status === 'quoted' || status === 'accepted' ? {
          interestRate:    parseFloat(rate)   || null,
          approvedAmount:  parseFloat(amount) || null,
          monthlyPayment:  parseFloat(monthly)|| null,
          fees:            parseFloat(fees)   || null,
          validUntil:      validUntil || null,
          conditions:      conditions || null,
        } : undefined,
        notes,
      });
      onClose();
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="bs-quote-form">
      <div className="bs-quote-form__header">
        <span className="bs-quote-form__bank">{bank}</span>
        <button className="bs-quote-form__close" onClick={onClose}><X size={16}/></button>
      </div>
      <div className="bs-quote-form__body">
        <div>
          <Lbl>Status</Lbl>
          <select className="adm-select" value={status} onChange={e => setStatus(e.target.value)}>
            {Object.entries(BANK_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        {(status === 'quoted') && (
          <>
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:10 }}>
              <div>
                <Lbl>Rate (%)</Lbl>
                <input type="number" className="adm-input" placeholder="11.25" value={rate} onChange={e => setRate(e.target.value)} step="0.25" />
              </div>
              <div>
                <Lbl>Approved amount (R)</Lbl>
                <input type="number" className="adm-input" placeholder="1750000" value={amount} onChange={e => setAmt(e.target.value)} />
              </div>
              <div>
                <Lbl>Monthly payment (R)</Lbl>
                <input type="number" className="adm-input" placeholder="18500" value={monthly} onChange={e => setMthly(e.target.value)} />
              </div>
              <div>
                <Lbl>Fees (R)</Lbl>
                <input type="number" className="adm-input" placeholder="12000" value={fees} onChange={e => setFees(e.target.value)} />
              </div>
            </div>
            <div>
              <Lbl>Valid until</Lbl>
              <input type="date" className="adm-input" value={validUntil} onChange={e => setVU(e.target.value)} />
            </div>
            <div>
              <Lbl>Conditions</Lbl>
              <input type="text" className="adm-input" placeholder="Subject to clear credit…" value={conditions} onChange={e => setCond(e.target.value)} />
            </div>
          </>
        )}
        <div>
          <Lbl>Notes</Lbl>
          <input type="text" className="adm-input" placeholder="Internal notes…" value={notes} onChange={e => setNotes(e.target.value)} />
        </div>
      </div>
      <div className="bs-quote-form__footer">
        <button className="bs-quote-form__save" onClick={save} disabled={saving}>
          {saving ? 'Saving…' : 'Save'}
        </button>
      </div>
    </div>
  );
}

function SubmissionDetail({ sub, onUpdate, onAccept, showToast }) {
  const [editBank, setEditBank] = useState(null);
  const [accepting, setAccepting] = useState(null);

  const entries = Object.entries(sub.banks || {});
  const quotes  = entries.filter(([, e]) => e.status === 'quoted' && e.quote);
  const best    = quotes.length ? quotes.reduce(([ba, be], [a, e]) =>
    (e.quote.interestRate || 99) < (be.quote.interestRate || 99) ? [a, e] : [ba, be]
  ) : null;

  async function handleBankSave(bank, data) {
    try {
      const res = await bsApi.updateBank(sub.id, { bank, ...data });
      onUpdate(res.submission);
      showToast('Updated', 'success');
    } catch(e) {
      showToast(e.message || 'Could not update', 'error');
    }
  }

  async function handleAccept(bank) {
    setAccepting(bank);
    try {
      const res = await bsApi.accept(sub.id, bank);
      onUpdate(res.submission);
      showToast('Offer accepted — customer notified', 'success');
    } catch(e) {
      showToast(e.message || 'Could not accept', 'error');
    } finally {
      setAccepting(null);
    }
  }

  return (
    <div className="bs-detail">
      <div className="bs-detail__meta">
        <span className="bs-detail__customer">{sub.customerName}</span>
        <span className="bs-detail__amount">Bond: {fmt(sub.requestedAmount)}</span>
        <span className="bs-detail__date">Created {daysAgo(sub.createdAt).toLowerCase()}</span>
      </div>

      {/* Comparison table for quotes */}
      {quotes.length > 1 && (
        <div className="bs-compare">
          <div className="bs-compare__title">Side-by-side comparison</div>
          <div className="bs-compare__table">
            <div className="bs-compare__head">
              {['Bank', 'Rate', 'Amount', 'Monthly', 'Fees'].map(h => (
                <div key={h} className="bs-compare__hcell">{h}</div>
              ))}
            </div>
            {quotes.sort(([, a], [, b]) => (a.quote.interestRate||99) - (b.quote.interestRate||99)).map(([bank, e]) => {
              const isBest = best && bank === best[0];
              return (
                <div key={bank} className={`bs-compare__row ${isBest ? 'bs-compare__row--best' : ''}`}>
                  <div className="bs-compare__cell bs-compare__cell--bank">
                    {isBest && <span className="bs-compare__best-badge">Best</span>}
                    {bank}
                  </div>
                  <div className="bs-compare__cell" style={{ fontWeight:700, color: isBest ? '#16a34a' : 'inherit' }}>
                    {e.quote.interestRate ? `${e.quote.interestRate}%` : '—'}
                  </div>
                  <div className="bs-compare__cell">{e.quote.approvedAmount ? fmt(e.quote.approvedAmount) : '—'}</div>
                  <div className="bs-compare__cell">{e.quote.monthlyPayment  ? fmt(e.quote.monthlyPayment) + '/mo' : '—'}</div>
                  <div className="bs-compare__cell">{e.quote.fees            ? fmt(e.quote.fees)           : '—'}</div>
                </div>
              );
            })}
          </div>
          {best && !sub.winningBank && (
            <button
              className="bs-compare__accept-btn"
              onClick={() => handleAccept(best[0])}
              disabled={!!accepting}
            >
              <CheckCircle size={14}/> Accept best offer ({best[0]} at {best[1].quote.interestRate}%)
            </button>
          )}
        </div>
      )}

      {sub.winningBank && (
        <div className="bs-won-banner">
          <CheckCircle size={15}/> Won — {sub.winningBank} at {sub.banks[sub.winningBank]?.quote?.interestRate}%
          · Customer notified
        </div>
      )}

      {/* Per-bank rows */}
      <div className="bs-banks">
        {entries.map(([bank, entry]) => (
          <div key={bank} className={`bs-bank-row ${sub.winningBank === bank ? 'bs-bank-row--winner' : ''}`}>
            <div className="bs-bank-row__left">
              <span className="bs-bank-row__name">{bank}</span>
              <BankStatusBadge status={entry.status} />
              {entry.quote?.interestRate && (
                <span className="bs-bank-row__rate">{entry.quote.interestRate}%</span>
              )}
            </div>
            <div className="bs-bank-row__right">
              {entry.quote?.monthlyPayment && (
                <span className="bs-bank-row__monthly">{fmt(entry.quote.monthlyPayment)}/mo</span>
              )}
              {!sub.winningBank && entry.status === 'quoted' && (
                <button className="bs-bank-row__accept" onClick={() => handleAccept(bank)} disabled={!!accepting}>
                  {accepting === bank ? '…' : 'Accept'}
                </button>
              )}
              <button className="bs-bank-row__edit" onClick={() => setEditBank(editBank === bank ? null : bank)}>
                {editBank === bank ? 'Cancel' : 'Update'}
              </button>
            </div>
            {editBank === bank && (
              <div className="bs-bank-row__form">
                <QuoteForm
                  bank={bank}
                  entry={entry}
                  onSave={handleBankSave}
                  onClose={() => setEditBank(null)}
                />
              </div>
            )}
          </div>
        ))}
      </div>

      {sub.adminNotes && (
        <div className="bs-detail__notes">{sub.adminNotes}</div>
      )}
    </div>
  );
}

function BankSubmissionsTab({ submissions, setSubmissions, showToast }) {
  const [selected, setSelected] = useState(null);
  const [showNew,  setShowNew]  = useState(false);
  const [filter,   setFilter]   = useState('all');

  const filtered = submissions.filter(s => {
    if (filter === 'active')    return s.status === 'active';
    if (filter === 'won')       return s.status === 'won';
    if (filter === 'cancelled') return s.status === 'cancelled';
    return true;
  });

  function onUpdate(updated) {
    setSubmissions(prev => prev.map(s => s.id === updated.id ? updated : s));
    setSelected(updated);
  }

  return (
    <div className="bs-layout fade-in">
      <div className="bs-sidebar">
        <div className="bs-sidebar__head">
          <div className="bs-filter-tabs">
            {[['all','All'],['active','Active'],['won','Won']].map(([v,l]) => (
              <button key={v} className={`bs-filter-tab ${filter===v?'bs-filter-tab--on':''}`} onClick={() => setFilter(v)}>{l}</button>
            ))}
          </div>
          <button className="bs-new-btn" onClick={() => setShowNew(s => !s)}>
            <Plus size={14}/> New
          </button>
        </div>

        {showNew && (
          <NewSubmissionForm
            showToast={showToast}
            onCreated={sub => {
              setSubmissions(prev => [sub, ...prev]);
              setSelected(sub);
              setShowNew(false);
            }}
          />
        )}

        <div className="bs-list">
          {filtered.length === 0 && (
            <div className="bs-list__empty">No submissions yet.</div>
          )}
          {filtered.map(sub => {
            const quotes  = Object.values(sub.banks || {}).filter(b => b.status === 'quoted').length;
            const pending = Object.values(sub.banks || {}).filter(b => b.status === 'pending').length;
            const bankCount = Object.keys(sub.banks || {}).length;
            return (
              <div
                key={sub.id}
                className={`bs-list-item ${selected?.id === sub.id ? 'bs-list-item--on' : ''} ${sub.status === 'won' ? 'bs-list-item--won' : ''}`}
                onClick={() => { setSelected(sub); setShowNew(false); }}
              >
                <div className="bs-list-item__name">{sub.customerName}</div>
                <div className="bs-list-item__meta">
                  {fmt(sub.requestedAmount)} · {bankCount} banks
                  {quotes > 0 && <span className="bs-list-item__quotes">{quotes} quoted</span>}
                </div>
                <div className="bs-list-item__age">{daysAgo(sub.createdAt).toLowerCase()}</div>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bs-main">
        {selected ? (
          <SubmissionDetail
            key={selected.id}
            sub={selected}
            onUpdate={onUpdate}
            showToast={showToast}
          />
        ) : (
          <div className="bs-main__empty">
            <Building2 size={32} color="var(--text-secondary)" />
            <div>Select a submission or create a new one</div>
          </div>
        )}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════════════════
//  CUSTOMER 360 DRAWER
// ══════════════════════════════════════════════════════════════════════════════

function Customer360Drawer({ customerId, onClose }) {
  const [data, setData]     = useState(null);
  const [loading, setLoading] = useState(true);
  const [section, setSection] = useState('overview');

  useEffect(() => {
    if (!customerId) return;
    setLoading(true);
    Promise.all([
      admin.users({ limit: 1 }).then(d => (d?.customers || []).find(c => c.id === customerId)),
      bsApi.list().then(d => (d.submissions || []).filter(s => s.customerId === customerId)),
    ]).then(([user, subs]) => {
      setData({ user, submissions: subs });
    }).catch(() => {}).finally(() => setLoading(false));
  }, [customerId]);

  if (!customerId) return null;

  return (
    <div className="c360-backdrop" onClick={e => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="c360-drawer">
        <div className="c360-drawer__header">
          {loading ? (
            <div className="c360-drawer__name">Loading…</div>
          ) : (
            <div>
              <div className="c360-drawer__name">{data?.user?.name || 'Unknown'}</div>
              <div className="c360-drawer__email">{data?.user?.email || ''}</div>
            </div>
          )}
          <button className="c360-drawer__close" onClick={onClose}><X size={18}/></button>
        </div>

        <div className="c360-drawer__nav">
          {[['overview','Overview'],['submissions','Submissions'],['fitness','Fitness']].map(([v,l]) => (
            <button key={v} className={`c360-nav-btn ${section===v?'c360-nav-btn--on':''}`} onClick={() => setSection(v)}>{l}</button>
          ))}
        </div>

        {loading ? (
          <div style={{ padding:24, textAlign:'center' }}><div className="spinner"/></div>
        ) : (
          <div className="c360-drawer__body">
            {section === 'overview' && data?.user && (
              <div className="c360-section">
                {[
                  ['Phone', data.user.phone || '—'],
                  ['Joined', fmtDate(data.user.createdAt)],
                  ['Employer', data.user.employer || '—'],
                  ['Journey stage', data.user.journeyStage || '—'],
                  ['Max bond', data.user.latestMaxBond ? fmt(data.user.latestMaxBond) : '—'],
                  ['Snapshots uploaded', data.user.totalSnapshotsUploaded || 0],
                  ['Active commitments', data.user.activeCommitments || 0],
                  ['Coach note', data.user.latestCoachNote ? 'Yes' : 'None'],
                ].map(([l, v]) => (
                  <div key={l} className="c360-row">
                    <span className="c360-row__label">{l}</span>
                    <span className="c360-row__value">{v}</span>
                  </div>
                ))}
              </div>
            )}
            {section === 'submissions' && (
              <div className="c360-section">
                {(data?.submissions || []).length === 0 ? (
                  <div className="c360-empty">No bank submissions yet</div>
                ) : (
                  (data.submissions || []).map(sub => {
                    const quotes = Object.values(sub.banks || {}).filter(b => b.status === 'quoted').length;
                    return (
                      <div key={sub.id} className="c360-sub-item">
                        <div className="c360-sub-item__top">
                          <span className="c360-sub-item__amount">{fmt(sub.requestedAmount)}</span>
                          <span className={`c360-sub-item__status c360-sub-item__status--${sub.status}`}>{sub.status}</span>
                        </div>
                        <div className="c360-sub-item__banks">
                          {Object.entries(sub.banks || {}).map(([bank, e]) => (
                            <span key={bank} className="c360-sub-item__bank" title={bank}>
                              <span style={{ width:6, height:6, borderRadius:'50%', display:'inline-block', background: BANK_STATUS_COLORS[e.status] || '#9ca3af' }} />
                              {bank.split(' ')[0]}
                            </span>
                          ))}
                        </div>
                        {sub.winningBank && (
                          <div className="c360-sub-item__winner">Won: {sub.winningBank} at {sub.banks[sub.winningBank]?.quote?.interestRate}%</div>
                        )}
                      </div>
                    );
                  })
                )}
              </div>
            )}
            {section === 'fitness' && data?.user && (
              <div className="c360-section">
                {[
                  ['Latest snapshot', data.user.latestSnapshotAt ? fmtDate(data.user.latestSnapshotAt) : '—'],
                  ['Financial journey', data.user.journeyStage || '—'],
                  ['Monthly commit target', data.user.monthlyCommitTarget ? fmt(data.user.monthlyCommitTarget) : '—'],
                  ['Last commitment', data.user.lastCommitmentAt ? fmtDate(data.user.lastCommitmentAt) : 'Never'],
                  ['Current bank', data.user.currentMortgageBank || '—'],
                  ['Inferred rate', data.user.inferredMortgageRate ? `${data.user.inferredMortgageRate}%` : '—'],
                  ['Inferred principal', data.user.inferredMortgagePrincipal ? fmt(data.user.inferredMortgagePrincipal) : '—'],
                ].map(([l, v]) => (
                  <div key={l} className="c360-row">
                    <span className="c360-row__label">{l}</span>
                    <span className="c360-row__value">{v}</span>
                  </div>
                ))}
                {data.user.latestCoachNote && (
                  <div className="c360-coach-note">
                    <div className="c360-coach-note__label">Latest coach note</div>
                    <div className="c360-coach-note__text">{data.user.latestCoachNote}</div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function StaffTab({ showToast }) {
  const [staff, setStaff]             = useState([]);
  const [pendingInvites, setPending]  = useState([]);
  const [loading, setLoading]         = useState(true);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviting, setInviting]       = useState(false);
  const [resetId, setResetId]         = useState(null);
  const [newPassword, setNewPassword] = useState('');

  useEffect(() => {
    admin.staff()
      .then(d => { setStaff(d.staff || []); setPending(d.pendingInvites || []); })
      .catch(() => showToast('Could not load staff', 'error'))
      .finally(() => setLoading(false));
  }, []);

  async function sendInvite() {
    if (!inviteEmail.trim()) { showToast('Enter an email address', 'error'); return; }
    setInviting(true);
    try {
      const res = await admin.inviteStaff(inviteEmail.trim());
      setPending(p => [...p, { id: Date.now(), email: inviteEmail.trim(), expiresAt: res.expiresAt, createdAt: new Date().toISOString() }]);
      setInviteEmail('');
      showToast(`Invite sent to ${inviteEmail.trim()}`, 'success');
    } catch (err) { showToast(err.message || 'Could not send invite', 'error'); }
    finally { setInviting(false); }
  }

  async function cancelInvite(token, email) {
    try {
      await admin.cancelInvite(token);
      setPending(p => p.filter(i => i.token !== token));
      showToast(`Invite to ${email} cancelled`, 'success');
    } catch (err) { showToast(err.message || 'Could not cancel', 'error'); }
  }

  async function removeMember(id, memberName) {
    if (!window.confirm(`Remove ${memberName}'s admin access? They will no longer be able to log in.`)) return;
    try {
      await admin.deleteStaff(id);
      setStaff(s => s.filter(m => m.id !== id));
      showToast(`${memberName} removed`, 'success');
    } catch (err) { showToast(err.message || 'Could not remove', 'error'); }
  }

  async function resetPassword(id) {
    if (!newPassword || newPassword.length < 8) { showToast('Password must be at least 8 characters', 'error'); return; }
    try {
      await admin.resetStaffPassword(id, newPassword);
      setResetId(null); setNewPassword('');
      showToast('Password updated', 'success');
    } catch (err) { showToast(err.message || 'Could not update password', 'error'); }
  }

  return (
    <div className="fade-in" style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>

      {/* Invite form */}
      <Card>
        <CardHeader>Add Employee</CardHeader>
        <CardBody>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 16 }}>
            Enter their work email. They'll receive a link to create their own account and password.
            The link expires after 72 hours.
          </p>
          <div style={{ display: 'flex', gap: 10, alignItems: 'flex-end' }}>
            <Input
              label="Work email address"
              id="sf-invite-email"
              type="email"
              value={inviteEmail}
              onChange={e => setInviteEmail(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && sendInvite()}
              placeholder="e.g. oliver@bondly.co.za"
              style={{ flex: 1 }}
            />
            <Button variant="forest" onClick={sendInvite} loading={inviting} disabled={!inviteEmail.trim()}>
              Send invite
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Pending invites */}
      {(loading || pendingInvites.length > 0) && (
        <Card>
          <CardHeader>Pending Invites</CardHeader>
          <CardBody>
            {loading ? (
              <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading…</div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {pendingInvites.map(i => (
                  <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 14px', border: '1px dashed var(--border-color)', borderRadius: 8, background: 'var(--bg-page)' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ fontWeight: 600, fontSize: '0.875rem' }}>{i.email}</div>
                      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>
                        Invited {fmtDate(i.createdAt)} · expires {fmtDate(i.expiresAt)}
                      </div>
                    </div>
                    <span style={{ fontSize: '0.75rem', color: '#f59e0b', fontWeight: 600, background: 'rgba(245,158,11,0.1)', padding: '2px 8px', borderRadius: 12 }}>Pending</span>
                    {i.token && (
                      <Button variant="ghost" size="sm" style={{ color: 'var(--color-error)' }} onClick={() => cancelInvite(i.token, i.email)}>Cancel</Button>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardBody>
        </Card>
      )}

      {/* Active staff */}
      <Card>
        <CardHeader>Active Team Members</CardHeader>
        <CardBody>
          {loading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading…</div>
          ) : staff.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: '20px 0' }}>
              No team members yet — send an invite above.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {staff.map(m => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 14px', border: '1px solid var(--border-color)', borderRadius: 8, background: 'var(--bg-card)' }}>
                  <div style={{ width: 36, height: 36, borderRadius: 8, background: avatarColor(m.name), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontWeight: 700, fontSize: '0.875rem', flexShrink: 0 }}>
                    {m.name?.[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{m.name}</div>
                    <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{m.email}</div>
                    {m.createdAt && <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginTop: 2 }}>Joined {fmtDate(m.createdAt)}</div>}
                  </div>
                  <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                    {resetId === m.id ? (
                      <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                        <input
                          type="password" placeholder="New password" value={newPassword}
                          onChange={e => setNewPassword(e.target.value)}
                          style={{ padding: '4px 8px', fontSize: '0.8rem', border: '1px solid var(--border-color)', borderRadius: 4, background: 'var(--bg-page)', color: 'var(--text-primary)', width: 140 }}
                        />
                        <Button variant="lime" size="sm" onClick={() => resetPassword(m.id)}>Save</Button>
                        <Button variant="ghost" size="sm" onClick={() => { setResetId(null); setNewPassword(''); }}>✕</Button>
                      </div>
                    ) : (
                      <>
                        <Button variant="ghost" size="sm" onClick={() => { setResetId(m.id); setNewPassword(''); }}>Reset password</Button>
                        <Button variant="ghost" size="sm" style={{ color: 'var(--color-error)' }} onClick={() => removeMember(m.id, m.name)}>Remove</Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════
//  DIARY TAB
// ═══════════════════════════════════════════════════════════
function DiaryTab({ showToast }) {
  const [entries, setEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [adding, setAdding]   = useState(false);
  const [text, setText]       = useState('');
  const [type, setType]       = useState('note');

  useEffect(() => {
    admin.diary().then(d => { setEntries(d.entries || []); setLoading(false); }).catch(() => setLoading(false));
  }, []);

  async function handleAdd(e) {
    e.preventDefault();
    if (!text.trim()) return;
    setAdding(true);
    try {
      const d = await admin.diaryAdd(text.trim(), type, 'callum');
      setEntries(d.entries || []);
      setText('');
    } catch (err) {
      showToast(err.message || 'Could not add entry', 'error');
    } finally {
      setAdding(false);
    }
  }

  async function handleSend() {
    setSending(true);
    try {
      await admin.diarySend();
      showToast('Digest sent to Telegram', 'success');
    } catch (err) {
      showToast(err.message || 'Send failed', 'error');
    } finally {
      setSending(false);
    }
  }

  const TYPE_COLORS = { error: '#ef4444', improvement: 'var(--mint)', note: 'var(--text-secondary)' };
  const TYPE_LABELS = { error: 'Error', improvement: 'Improvement', note: 'Note' };

  return (
    <div>
      <Card style={{ marginBottom: 'var(--space-4)' }}>
        <CardHeader>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <span>Daily Diary</span>
            <Button variant="forest" size="sm" onClick={handleSend} loading={sending}>
              Send digest now
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          <form onSubmit={handleAdd} style={{ display: 'flex', gap: 'var(--space-3)', marginBottom: 'var(--space-4)', flexWrap: 'wrap' }}>
            <select
              value={type}
              onChange={e => setType(e.target.value)}
              style={{ padding: '8px 12px', borderRadius: 'var(--border-radius)', border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem', flexShrink: 0 }}
            >
              <option value="note">Note</option>
              <option value="improvement">Improvement</option>
              <option value="error">Error</option>
            </select>
            <input
              value={text}
              onChange={e => setText(e.target.value)}
              placeholder="Log an error, improvement, or note…"
              style={{ flex: 1, minWidth: 200, padding: '8px 12px', borderRadius: 'var(--border-radius)', border: '1.5px solid var(--border-color)', background: 'var(--bg-page)', color: 'var(--text-primary)', fontSize: '0.875rem' }}
            />
            <Button variant="lime" size="sm" type="submit" loading={adding} disabled={!text.trim()}>Add</Button>
          </form>

          {loading ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem' }}>Loading…</div>
          ) : entries.length === 0 ? (
            <div style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', textAlign: 'center', padding: 'var(--space-6) 0' }}>No diary entries yet. Add one above or wait for the 9 PM auto-digest.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-2)' }}>
              {entries.map(e => (
                <div key={e.id} style={{ display: 'flex', gap: 'var(--space-3)', alignItems: 'flex-start', padding: 'var(--space-3)', borderRadius: 'var(--border-radius)', background: 'var(--bg-page)', border: '1px solid var(--border-color)' }}>
                  <span style={{ flexShrink: 0, fontSize: '0.75rem', fontWeight: 700, padding: '2px 8px', borderRadius: 20, border: `1.5px solid ${TYPE_COLORS[e.type] || 'var(--border-color)'}`, color: TYPE_COLORS[e.type] || 'var(--text-secondary)', marginTop: 1 }}>
                    {TYPE_LABELS[e.type] || e.type}
                  </span>
                  <div style={{ flex: 1, fontSize: '0.875rem', lineHeight: 1.5 }}>{e.text}</div>
                  <div style={{ flexShrink: 0, fontSize: '0.75rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {e.addedBy} · {new Date(e.addedAt).toLocaleTimeString('en-ZA', { hour: '2-digit', minute: '2-digit' })}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
