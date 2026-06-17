import { useEffect, useState } from 'react';
import EmptyState from '../components/EmptyState.jsx';
import { admin } from '../../../lib/api.js';
import { fmt } from '@bondly/ui/lib/format.js';

// Read-only investor overview — curated topline KPIs only, no customer records.
export default function InvestorTab() {
  const [m, setM]         = useState(null);
  const [loading, setL]   = useState(true);
  const [err, setErr]     = useState(false);

  useEffect(() => {
    admin.investorMetrics().then(setM).catch(() => setErr(true)).finally(() => setL(false));
  }, []);

  if (loading) return <div style={{ padding: 48, textAlign: 'center' }}><div className="spinner" style={{ width: 28, height: 28, borderWidth: 3, margin: '0 auto' }} /></div>;
  if (err || !m) return <EmptyState title="Metrics unavailable" sub="Could not load investor metrics right now." />;

  const Card = ({ label, value, sub, accent }) => (
    <div className="adm-kpi-card" style={{ borderLeft: `4px solid ${accent || 'var(--forest)'}` }}>
      <div className="adm-kpi-sub">{label}</div>
      <div className="adm-kpi-value">{value}</div>
      {sub && <div className="adm-kpi-sub" style={{ marginTop: 4 }}>{sub}</div>}
    </div>
  );
  const Section = ({ title, children }) => (
    <div style={{ marginBottom: 28 }}>
      <h3 style={{ fontSize: '0.8rem', fontWeight: 800, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-secondary)', margin: '0 0 12px' }}>{title}</h3>
      <div className="adm-kpi-grid">{children}</div>
    </div>
  );
  const f = m.funnel || {}, g = m.growth || {}, r = m.revenue || {}, o = m.ops || {};
  const pct = (n) => f.registered ? Math.round((n / f.registered) * 100) + '%' : '—';

  return (
    <div className="fade-in" style={{ maxWidth: 1100 }}>
      <Section title="Growth">
        <Card label="Customers" value={(g.customers || 0).toLocaleString()} sub="Registered (excl. test)" accent="var(--forest)" />
        <Card label="Consumer leads" value={(g.leads || 0).toLocaleString()} sub={`${g.newLeads || 0} new`} accent="#4a7fa5" />
        <Card label="B2B leads" value={(g.b2bLeads || 0).toLocaleString()} sub={`${o.b2bWithContact || 0} with contact`} accent="#6366f1" />
        <Card label="B2B qualified" value={(o.b2bQualified || 0).toLocaleString()} sub="Partnership pipeline" accent="#d97706" />
      </Section>
      <Section title="Conversion funnel">
        <Card label="Registered" value={(f.registered || 0).toLocaleString()} sub="100%" />
        <Card label="Have bonds" value={(f.withBonds || 0).toLocaleString()} sub={pct(f.withBonds)} accent="#4a7fa5" />
        <Card label="Alert set" value={(f.alertSet || 0).toLocaleString()} sub={pct(f.alertSet)} accent="#6366f1" />
        <Card label="Applied" value={(f.applied || 0).toLocaleString()} sub={pct(f.applied)} accent="#d97706" />
        <Card label="Completed" value={(f.completed || 0).toLocaleString()} sub={pct(f.completed)} accent="var(--lime)" />
      </Section>
      <Section title="Revenue & deals">
        <Card label="Commission received" value={fmt(r.received || 0)} accent="var(--lime)" />
        <Card label="Commission pending" value={fmt(r.pending || 0)} accent="#d97706" />
        <Card label="Active deals" value={(r.activeDeals || 0).toLocaleString()} sub="In flight" accent="var(--forest)" />
        <Card label="Bank submissions" value={(r.submissions || 0).toLocaleString()} accent="#4a7fa5" />
      </Section>
      <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)' }}>
        Read-only investor view{m.ops?.primeRate ? ` · prime ${m.ops.primeRate}%` : ''} · generated {new Date(m.generatedAt).toLocaleString('en-ZA')}
      </div>
    </div>
  );
}
