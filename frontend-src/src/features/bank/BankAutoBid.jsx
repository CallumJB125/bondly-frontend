import { useEffect, useState } from 'react';
import { bankApi, bankFmtPct, bankFmtR } from './bankApi.js';

/**
 * Auto-bid rules — banks define criteria + pricing actions, system bids
 * automatically when a matching application arrives. The killer feature for
 * banks struggling to scale: they can compete on every deal without humans.
 */
export default function BankAutoBid() {
  const [rules, setRules]     = useState(null);
  const [history, setHistory] = useState(null);
  const [editing, setEditing] = useState(null);   // rule object or 'new'
  const [err, setErr]         = useState(null);
  const [reload, setReload]   = useState(0);

  useEffect(() => {
    bankApi.autoBidRules().then(d => setRules(d.rules)).catch(e => setErr(e.message));
    bankApi.autoBidHistory().then(d => setHistory(d.bids)).catch(() => {});
  }, [reload]);

  async function toggle(rule) {
    try {
      await bankApi.updateAutoBidRule(rule.id, { enabled: !rule.enabled });
      setReload(r => r + 1);
    } catch (e) { alert(e.message); }
  }
  async function remove(rule) {
    if (!confirm(`Delete rule "${rule.name}"?`)) return;
    try { await bankApi.deleteAutoBidRule(rule.id); setReload(r => r + 1); }
    catch (e) { alert(e.message); }
  }
  async function reorder(ruleId, direction) {
    const idx = rules.findIndex(r => r.id === ruleId);
    if (idx < 0) return;
    if (direction === 'up' && idx === 0) return;
    if (direction === 'down' && idx === rules.length - 1) return;
    const swapIdx = direction === 'up' ? idx - 1 : idx + 1;
    const newRules = [...rules];
    [newRules[idx], newRules[swapIdx]] = [newRules[swapIdx], newRules[idx]];
    setRules(newRules);
    try {
      await bankApi.updateAutoBidRule(ruleId, { priority: swapIdx + 1 });
      await bankApi.updateAutoBidRule(newRules[idx].id, { priority: idx + 1 });
    } catch {}
  }

  return (
    <>
      <h2>Auto-bid rules</h2>
      <p className="lede">Define criteria and a pricing action. We bid automatically the moment a matching application arrives — typically in under 30 seconds.</p>

      <button onClick={() => setEditing('new')}
        style={{ padding: '10px 18px', background: '#c8a84b', color: '#0b1e2d', border: 'none', borderRadius: 8, fontWeight: 800, fontSize: '0.875rem', cursor: 'pointer', marginBottom: 14 }}>
        + New rule
      </button>

      <SuggestedRules onPickRule={(suggestion) => setEditing({ ...suggestion, id: null, enabled: false })} />


      {err && <div className="bank-section" style={{ color: '#991b1b' }}>{err}</div>}
      {!rules && !err && <div className="bank-section">Loading…</div>}
      {rules && rules.length === 0 && !editing && (
        <div className="bank-section" style={{ color: '#6b7280' }}>No rules yet. Create your first rule above to start auto-bidding.</div>
      )}

      {rules && rules.map(r => (
        <div key={r.id} className="bank-section" style={{ marginBottom: 10 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: 1, minWidth: 240 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ fontSize: '0.72rem', background: '#f3f4f6', color: '#6b7280', borderRadius: 4, padding: '2px 7px', fontWeight: 800, fontFamily: 'monospace' }}>#{rules.indexOf(r) + 1}</span>
                  <h3 style={{ margin: 0 }}>{r.name}</h3>
                </div>
                <span style={{
                  padding: '2px 10px', borderRadius: 999, fontSize: '0.7rem', fontWeight: 800,
                  background: r.enabled ? '#dcfce7' : '#f3f4f6',
                  color: r.enabled ? '#166534' : '#6b7280',
                  textTransform: 'uppercase',
                }}>{r.enabled ? '● Live' : 'Paused'}</span>
              </div>
              <div style={{ fontSize: '0.82rem', color: '#6b7280', marginTop: 6 }}>
                {summariseCriteria(r.criteria)}
              </div>
              <div style={{ fontSize: '0.82rem', color: '#0f1a24', marginTop: 6, fontWeight: 600 }}>
                Bids at {summariseAction(r.action)} · {r.stats?.bidsTotal || 0} bids placed
              </div>
              {r.maxMonthlyExposure != null && (
                <BudgetProgress cap={r.maxMonthlyExposure} spent={r.stats?.thisMonthExposure ?? 0} bidsPerDay={r.stats?.bidsPerDay ?? 0} />
              )}
              <RulePreview rule={r} />
            </div>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={() => toggle(r)}
                style={{ padding: '7px 14px', background: r.enabled ? '#fff' : '#c8a84b', color: r.enabled ? '#0b1e2d' : '#0b1e2d', border: '1px solid #e5e7eb', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
                {r.enabled ? 'Pause' : 'Enable'}
              </button>
              <button onClick={() => setEditing(r)}
                style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #e5e7eb', color: '#0b1e2d', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                Edit
              </button>
              <button onClick={() => remove(r)}
                style={{ padding: '7px 14px', background: 'transparent', border: '1px solid #fecaca', color: '#991b1b', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer' }}>
                Delete
              </button>
              {rules.length > 1 && (
                <>
                  <button onClick={() => reorder(r.id, 'up')} disabled={rules.indexOf(r) === 0}
                    style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #e5e7eb', color: '#0b1e2d', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer', opacity: rules.indexOf(r) === 0 ? 0.3 : 1 }}>↑</button>
                  <button onClick={() => reorder(r.id, 'down')} disabled={rules.indexOf(r) === rules.length - 1}
                    style={{ padding: '7px 10px', background: 'transparent', border: '1px solid #e5e7eb', color: '#0b1e2d', borderRadius: 6, fontSize: '0.78rem', cursor: 'pointer', opacity: rules.indexOf(r) === rules.length - 1 ? 0.3 : 1 }}>↓</button>
                </>
              )}
            </div>
          </div>
        </div>
      ))}

      {editing && (
        <RuleEditor
          rule={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); setReload(r => r + 1); }}
        />
      )}

      {history && history.length > 0 && (
        <div className="bank-section" style={{ marginTop: 24 }}>
          <h3>Recent auto-bids · {history.length}</h3>
          <ul style={{ listStyle: 'none', padding: 0, margin: 0 }}>
            {history.slice(0, 20).map(b => (
              <li key={b.id} style={{ display: 'flex', justifyContent: 'space-between', padding: '6px 0', borderBottom: '1px dashed #f3f4f6', fontSize: '0.85rem' }}>
                <span>
                  <span style={{ fontFamily: 'monospace', fontWeight: 700 }}>{b.ref}</span>
                  {' · '}
                  <span className={'bid-status ' + b.status} style={{ fontSize: '0.7rem' }}>{b.status}</span>
                  {' · '}
                  {bankFmtPct(b.rate)} · {bankFmtR(b.monthly)}/mo
                </span>
                <span style={{ color: '#6b7280', fontSize: '0.74rem' }}>{new Date(b.submittedAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

function RulePreview({ rule }) {
  const [preview, setPreview] = useState(null);
  const [busy, setBusy] = useState(false);
  async function run() {
    setBusy(true);
    try {
      const r = await bankApi.simulateRule({ ...rule, lookbackDays: 30 });
      setPreview(r);
    } catch (e) { setPreview({ error: e.message }); }
    finally { setBusy(false); }
  }
  return (
    <div style={{ marginTop: 10 }}>
      {!preview && (
        <button onClick={run} disabled={busy}
          style={{ padding: '4px 12px', fontSize: '0.72rem', background: '#fff', border: '1px dashed #c8a84b', color: '#78350f', borderRadius: 5, cursor: 'pointer', fontWeight: 700 }}>
          {busy ? 'Simulating…' : '📊 Preview last 30 days'}
        </button>
      )}
      {preview && !preview.error && (
        <div style={{ padding: '10px 14px', background: '#fefce8', border: '1px solid #fde68a', borderRadius: 7, fontSize: '0.82rem' }}>
          <strong style={{ color: '#78350f' }}>Simulation:</strong>{' '}
          Would have bid on <strong>{preview.matchCount ?? 0}</strong> deals worth{' '}
          <strong>R{((preview.totalAmount || 0) / 1e6).toFixed(1)}m</strong>
          {preview.estimatedWins != null && <>, winning ~<strong>{preview.estimatedWins}</strong></>}.
          <button onClick={() => setPreview(null)} style={{ marginLeft: 10, background: 'transparent', border: 'none', color: '#6b7280', cursor: 'pointer', fontSize: '0.72rem' }}>clear</button>
        </div>
      )}
      {preview?.error && (
        <div style={{ padding: '8px 12px', background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 6, fontSize: '0.78rem', color: '#991b1b' }}>
          {preview.error} <button onClick={() => setPreview(null)} style={{ background: 'none', border: 'none', color: '#6b7280', cursor: 'pointer' }}>×</button>
        </div>
      )}
    </div>
  );
}

function summariseCriteria(c) {
  if (!c || Object.keys(c).length === 0) return 'Matches every open application';
  const parts = [];
  if (c.type)               parts.push(c.type === 'swap' ? 'Switches only' : 'New bonds only');
  if (c.minScore != null)   parts.push(`quality ≥ ${c.minScore}`);
  if (c.maxDti != null)     parts.push(`DTI ≤ ${c.maxDti}%`);
  if (c.maxLtv != null)     parts.push(`LTV ≤ ${c.maxLtv}%`);
  if (c.minStatementMonths != null) parts.push(`statements ≥ ${c.minStatementMonths}mo`);
  if (c.minAmount != null)  parts.push(`amount ≥ R${Number(c.minAmount).toLocaleString('en-ZA')}`);
  if (c.maxAmount != null)  parts.push(`amount ≤ R${Number(c.maxAmount).toLocaleString('en-ZA')}`);
  if (c.otpRequired)        parts.push('OTP signed');
  if (Array.isArray(c.regions) && c.regions.length) parts.push(`regions: ${c.regions.join(', ')}`);
  return parts.join(' · ') || 'Matches every open application';
}
function summariseAction(a) {
  if (!a) return '—';
  if (a.rateMode === 'fixed' && a.fixedRate != null) return `${a.fixedRate}% fixed`;
  const off = Number(a.rateOffset) || 0;
  return off === 0 ? 'prime' : (off > 0 ? `prime + ${off}%` : `prime ${off}%`);
}

function BudgetProgress({ cap, spent, bidsPerDay }) {
  const remaining = Math.max(0, cap - spent);
  const pct = Math.min(100, Math.round((spent / cap) * 100));
  const barColor = pct >= 90 ? '#dc2626' : pct >= 70 ? '#b45309' : '#15803d';
  const daysLeft = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  const dailyBurn = bidsPerDay > 0 ? (spent / Math.max(new Date().getDate(), 1)) : null;
  const exhaustDays = dailyBurn && dailyBurn > 0 ? Math.round(remaining / dailyBurn) : null;

  return (
    <div style={{ marginTop: 6 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem', marginBottom: 3 }}>
        <span style={{ color: '#78350f', fontWeight: 700 }}>Monthly budget: R{remaining.toLocaleString('en-ZA')} remaining</span>
        <span style={{ color: '#9ca3af' }}>{pct}% used</span>
      </div>
      <div style={{ height: 5, background: '#f3f4f6', borderRadius: 99, overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: barColor, borderRadius: 99, transition: 'width 0.3s' }} />
      </div>
      {exhaustDays != null && exhaustDays <= daysLeft && (
        <div style={{ fontSize: '0.68rem', color: pct >= 70 ? '#b45309' : '#6b7280', marginTop: 3 }}>
          At current pace: budget exhausted in ~{exhaustDays} day{exhaustDays === 1 ? '' : 's'}
        </div>
      )}
    </div>
  );
}

function RuleEditor({ rule, onClose, onSaved }) {
  const [v, setV] = useState(rule ? {
    name: rule.name, enabled: rule.enabled,
    criteria: { ...rule.criteria },
    action:   { ...rule.action },
  } : {
    name: '', enabled: true,
    criteria: { minScore: 80, maxDti: 25, type: '' },
    action:   { rateMode: 'prime_offset', rateOffset: -0.25, termPolicy: 'match_existing', termDefault: 240, validityDays: 14, conditions: 'Subject to property valuation', maxBidsPerDay: 100 },
    maxMonthlyExposure: '',
  });
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);

  function setC(k, val) { setV(s => ({ ...s, criteria: { ...s.criteria, [k]: val } })); }
  function setA(k, val) { setV(s => ({ ...s, action:   { ...s.action,   [k]: val } })); }

  async function save(e) {
    e.preventDefault(); setBusy(true); setErr(null);
    // strip empty criteria values
    const cleanCriteria = {};
    Object.entries(v.criteria).forEach(([k, val]) => {
      if (val === '' || val == null) return;
      if (Array.isArray(val) && val.length === 0) return;
      cleanCriteria[k] = isFinite(Number(val)) && typeof val !== 'boolean' ? Number(val) : val;
    });
    const body = { name: v.name, enabled: v.enabled, criteria: cleanCriteria, action: v.action, ...(v.maxMonthlyExposure !== '' && v.maxMonthlyExposure != null ? { maxMonthlyExposure: Number(v.maxMonthlyExposure) } : {}) };
    try {
      if (rule) await bankApi.updateAutoBidRule(rule.id, body);
      else      await bankApi.createAutoBidRule(body);
      onSaved();
    } catch (e2) { setErr(e2.message); }
    finally { setBusy(false); }
  }

  return (
    <div style={{ position: 'fixed', inset: 0, background: 'rgba(11,30,45,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100, padding: 20 }}>
      <form onSubmit={save} style={{ background: '#fff', borderRadius: 12, padding: 24, maxWidth: 720, width: '100%', maxHeight: '90vh', overflowY: 'auto' }}>
        <h3 style={{ marginTop: 0 }}>{rule ? 'Edit rule' : 'New auto-bid rule'}</h3>

        <Field label="Rule name (visible only to your team)"><input value={v.name} onChange={e => setV({ ...v, name: e.target.value })} required style={input} placeholder="Aggressive prime-bidding for top-quality" /></Field>

        <h4 style={{ marginTop: 18, marginBottom: 8, fontSize: '0.86rem', color: '#0b1e2d' }}>Criteria — only bid when ALL of these match</h4>
        <Grid>
          <Field label="Application type">
            <select value={v.criteria.type || ''} onChange={e => setC('type', e.target.value || undefined)} style={input}>
              <option value="">Either</option>
              <option value="origination">New bond only</option>
              <option value="swap">Switch only</option>
            </select>
          </Field>
          <Field label="Min Bondly quality"><input type="number" value={v.criteria.minScore ?? ''} onChange={e => setC('minScore', e.target.value)} style={input} placeholder="80" /></Field>
          <Field label="Max DTI %"><input type="number" value={v.criteria.maxDti ?? ''} onChange={e => setC('maxDti', e.target.value)} style={input} placeholder="25" /></Field>
          <Field label="Max LTV %"><input type="number" value={v.criteria.maxLtv ?? ''} onChange={e => setC('maxLtv', e.target.value)} style={input} placeholder="90" /></Field>
          <Field label="Min statement months" hint="6 months is the minimum recommended for reliable income detection. NCR guidelines suggest 3+ months for originations."><input type="number" value={v.criteria.minStatementMonths ?? ''} onChange={e => setC('minStatementMonths', e.target.value)} style={input} placeholder="6" /></Field>
          <Field label="Min amount (R)"><input type="number" value={v.criteria.minAmount ?? ''} onChange={e => setC('minAmount', e.target.value)} style={input} placeholder="500000" /></Field>
          <Field label="Max amount (R)"><input type="number" value={v.criteria.maxAmount ?? ''} onChange={e => setC('maxAmount', e.target.value)} style={input} placeholder="5000000" /></Field>
          <Field label="OTP signed (origination)" hint="OTP = Offer to Purchase — the signed sale agreement. Requiring it reduces risk but narrows your deal flow.">
            <select value={v.criteria.otpRequired ? '1' : '0'} onChange={e => setC('otpRequired', e.target.value === '1')} style={input}>
              <option value="0">Not required</option>
              <option value="1">Only auto-bid once OTP signed</option>
            </select>
          </Field>
        </Grid>

        <h4 style={{ marginTop: 18, marginBottom: 8, fontSize: '0.86rem', color: '#0b1e2d' }}>Pricing action</h4>
        <Grid>
          <Field label="Rate mode">
            <select value={v.action.rateMode || 'prime_offset'} onChange={e => setA('rateMode', e.target.value)} style={input}>
              <option value="prime_offset">Prime + offset</option>
              <option value="fixed">Fixed rate</option>
            </select>
          </Field>
          {v.action.rateMode !== 'fixed' ? (
            <Field label="Offset from prime (%)"><input type="number" step="0.05" value={v.action.rateOffset ?? ''} onChange={e => setA('rateOffset', Number(e.target.value))} style={input} placeholder="-0.25" /></Field>
          ) : (
            <Field label="Fixed rate (%)"><input type="number" step="0.05" value={v.action.fixedRate ?? ''} onChange={e => setA('fixedRate', Number(e.target.value))} style={input} placeholder="11.10" /></Field>
          )}
          <Field label="Term policy">
            <select value={v.action.termPolicy || 'match_existing'} onChange={e => setA('termPolicy', e.target.value)} style={input}>
              <option value="match_existing">Match existing (swap) or use default</option>
              <option value="default">Always use default</option>
            </select>
          </Field>
          <Field label="Default term (months)"><input type="number" value={v.action.termDefault ?? 240} onChange={e => setA('termDefault', Number(e.target.value))} style={input} /></Field>
          <Field label="Validity (days)"><input type="number" value={v.action.validityDays ?? 14} onChange={e => setA('validityDays', Number(e.target.value))} style={input} /></Field>
          <Field label="Max bids / day"><input type="number" value={v.action.maxBidsPerDay ?? 100} onChange={e => setA('maxBidsPerDay', Number(e.target.value))} style={input} /></Field>
        </Grid>
        <Field label="Default conditions"><input value={v.action.conditions || ''} onChange={e => setA('conditions', e.target.value)} style={input} placeholder="Subject to property valuation, life cover required" /></Field>
        <Field label="Monthly budget cap (R, optional)" hint="Total rand value of loan offers this rule may place in a calendar month. Prevents runaway exposure if a flood of qualifying deals arrives."><input type="number" value={v.maxMonthlyExposure ?? ''} onChange={e => setV(s => ({ ...s, maxMonthlyExposure: e.target.value }))} style={input} placeholder="e.g. 50000000" /></Field>

        <div style={{ marginTop: 14, padding: 10, background: '#f9fafb', borderRadius: 6, fontSize: '0.78rem', color: '#374151' }}>
          <strong>Preview:</strong> Auto-bid {summariseAction(v.action)} when {summariseCriteria(v.criteria).toLowerCase()}.
        </div>
        <Simulator criteria={v.criteria} action={v.action} />


        <div style={{ marginTop: 14, padding: '12px 14px', background: v.enabled ? '#fef3c7' : '#f9fafb', border: `1px solid ${v.enabled ? '#f59e0b' : '#e5e7eb'}`, borderRadius: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
            <input type="checkbox" checked={v.enabled} onChange={e => setV({ ...v, enabled: e.target.checked })} />
            <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>Enable this rule</span>
          </label>
          {v.enabled && (
            <p style={{ margin: '8px 0 0', fontSize: '0.75rem', color: '#92400e', lineHeight: 1.5 }}>
              ⚠ This rule will start bidding automatically as soon as it's saved. It will also run once against all currently open applications that match the criteria.
            </p>
          )}
        </div>

        {err && <div style={{ color: '#991b1b', fontSize: '0.85rem', marginTop: 10 }}>{err}</div>}

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={{ padding: '8px 16px', background: 'transparent', border: '1px solid #e5e7eb', borderRadius: 7, fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer' }}>Cancel</button>
          <button type="submit" disabled={busy} style={{ padding: '8px 18px', background: '#0b1e2d', color: '#fff', border: 'none', borderRadius: 7, fontSize: '0.86rem', fontWeight: 700, cursor: 'pointer' }}>{busy ? 'Saving…' : (rule ? 'Save' : 'Create rule')}</button>
        </div>
      </form>
    </div>
  );
}

function SuggestedRules({ onPickRule }) {
  const [s, setS] = useState(null);
  useEffect(() => { bankApi.suggestedRules().then(d => setS(d.suggestions)).catch(() => {}); }, []);
  if (!s || s.length === 0) return null;
  return (
    <div className="bank-section" style={{ background: 'linear-gradient(180deg, #f5f3ff 0%, #ffffff 100%)', borderColor: '#ddd6fe', marginBottom: 14 }}>
      <h3 style={{ color: '#5b21b6' }}>🤖 AI-suggested rules from your bidding pattern</h3>
      <div style={{ fontSize: '0.78rem', color: '#374151', marginBottom: 10 }}>
        Based on your last 30 days of manual bidding. Click any to pre-fill a new rule.
      </div>
      {s.map(sug => (
        <div key={sug.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: 12, background: '#fff', border: '1px solid #ddd6fe', borderRadius: 8, marginBottom: 6 }}>
          <div>
            <div style={{ fontWeight: 700, color: '#0f1a24' }}>{sug.name}</div>
            <div style={{ fontSize: '0.78rem', color: '#6b7280', marginTop: 2 }}>
              {sug.basedOn} bids · {sug.winRate}% win rate · avg rate {sug.avgRate}%
            </div>
          </div>
          <button onClick={() => onPickRule(sug)}
            style={{ padding: '7px 14px', background: '#7c3aed', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
            Create rule
          </button>
        </div>
      ))}
    </div>
  );
}

function Simulator({ criteria, action }) {
  const [sim, setSim] = useState(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr]   = useState(null);
  async function run() {
    setBusy(true); setErr(null);
    try { const r = await bankApi.simulateRule({ criteria, action, lookbackDays: 30 }); setSim(r); }
    catch (e) { setErr(e.message); } finally { setBusy(false); }
  }
  return (
    <div style={{ marginTop: 12, padding: 12, background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 7 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
        <strong style={{ color: '#166534', fontSize: '0.85rem' }}>🔬 Simulate this rule (last 30 days)</strong>
        <button type="button" onClick={run} disabled={busy}
          style={{ padding: '6px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 6, fontWeight: 700, fontSize: '0.78rem', cursor: 'pointer' }}>
          {busy ? 'Running…' : sim ? 'Re-run' : 'Run simulation'}
        </button>
      </div>
      {err && <div style={{ color: '#991b1b', fontSize: '0.78rem', marginTop: 8 }}>{err}</div>}
      {sim && (
        <div style={{ marginTop: 10, fontSize: '0.82rem', color: '#0f1a24' }}>
          <div style={{ marginBottom: 6 }}>Would have bid on <strong>{sim.matchedCount}</strong> file{sim.matchedCount === 1 ? '' : 's'} at {sim.rateUsed?.toFixed(2)}%.</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8, marginTop: 6 }}>
            <Stat label="Would have won"   v={`${sim.wouldHaveWon} (R ${(sim.wouldWinValue/1000000).toFixed(2)}M)`} good />
            <Stat label="Would have lost"  v={`${sim.wouldHaveLost}${sim.avgLossGapBp != null ? ` · avg ${sim.avgLossGapBp}bp behind` : ''}`} />
            <Stat label="Undecided still"  v={sim.undecided} />
            <Stat label="Est. 20-yr interest if all won" v={`R ${(sim.estimatedLifetimeInterest/1000000).toFixed(2)}M`} good />
          </div>
        </div>
      )}
    </div>
  );
}
function Stat({ label, v, good }) {
  return (
    <div style={{ padding: 8, background: '#fff', borderRadius: 6, border: '1px solid #d1fae5' }}>
      <div style={{ fontSize: '0.66rem', color: '#6b7280', textTransform: 'uppercase', fontWeight: 700, letterSpacing: '0.06em' }}>{label}</div>
      <div style={{ fontSize: '0.92rem', fontWeight: 800, marginTop: 2, color: good ? '#15803d' : '#0f1a24' }}>{v}</div>
    </div>
  );
}

function Field({ label, children, hint }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 10 }}>
      <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em' }}>{label}</span>
      {children}
      {hint && <span style={{ fontSize: '0.68rem', color: '#9ca3af', lineHeight: 1.4 }}>{hint}</span>}
    </label>
  );
}
function Grid({ children }) { return <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>{children}</div>; }
const input = { padding: '8px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.875rem', background: '#fff' };
