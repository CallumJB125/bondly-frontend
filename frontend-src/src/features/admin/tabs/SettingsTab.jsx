import { useEffect, useState } from 'react';
import { admin, primeRate as primeRateApi } from '../../../lib/api.js';
import Button from '@bondly/ui/components/Button.jsx';
import Input from '@bondly/ui/components/Input.jsx';
import Card, { CardHeader, CardBody } from '@bondly/ui/components/Card.jsx';

export default function SettingsTab({ primeInput, setPrimeInput, showToast }) {
  const [pending, setPending]   = useState([]);
  const [history, setHistory]   = useState([]);
  const [lastChanged, setLastChanged] = useState(null);
  const [checking, setChecking] = useState(false);

  async function refresh() {
    try {
      const [pendingRes, historyRes] = await Promise.all([
        admin.sarbPending().catch(() => ({ pending: [] })),
        primeRateApi.history().catch(() => ({ history: [] })),
      ]);
      setPending(pendingRes?.pending || []);
      const hist = historyRes?.history || [];
      setHistory(hist);
      setLastChanged(hist[hist.length - 1]?.date || null);
    } catch {/* ok */}
  }
  useEffect(() => { refresh(); }, []);

  async function updatePrimeRate() {
    const rate = parseFloat(primeInput);
    if (!rate || rate < 5 || rate > 25) { showToast('Enter a valid rate (5–25%)', 'error'); return; }
    try { await admin.primeRate(rate); showToast(`Prime rate updated to ${rate}%`, 'success'); refresh(); }
    catch (err) { showToast(err.message || 'Failed', 'error'); }
  }

  async function sendRateAlerts() {
    try { const res = await admin.sendRateAlert(); showToast(`Rate alerts sent (${res?.sent || 0} fired)`, 'success'); }
    catch (err) { showToast(err.message || 'Failed', 'error'); }
  }

  async function checkSarbNow() {
    setChecking(true);
    try {
      const res = await admin.sarbCheck();
      if (res?.created) showToast(`SARB suggests new prime: ${res.record.impliedPrime}%`, 'success');
      else if (res?.reason === 'no_change') showToast('SARB rate matches current prime — no change.', 'info');
      else showToast(`SARB check: ${res?.reason || 'no result'}`, 'info');
      refresh();
    } catch (err) {
      showToast(err.message || 'SARB check failed (URL configured?)', 'error');
    } finally { setChecking(false); }
  }

  async function acceptPending(id) {
    try {
      const res = await admin.sarbAccept(id);
      showToast(`Prime updated ${res?.oldRate}% → ${res?.newRate}%`, 'success');
      setPrimeInput(String(res?.newRate || ''));
      refresh();
    } catch (err) { showToast(err.message || 'Accept failed', 'error'); }
  }
  async function dismissPending(id) {
    try { await admin.sarbDismiss(id); showToast('Pending entry dismissed', 'info'); refresh(); }
    catch (err) { showToast(err.message || 'Dismiss failed', 'error'); }
  }

  const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-ZA', { day:'numeric', month:'short', year:'numeric' }) : '—';

  return (
    <div className="fade-in" style={{ maxWidth: 640, display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* SARB pending alerts — top so admin sees them immediately */}
      {pending.length > 0 && (
        <Card>
          <CardHeader style={{ display:'flex', justifyContent:'space-between', alignItems:'center' }}>
            <span>SARB rate move detected — confirm to apply</span>
            <span style={{ background:'#dc2626', color:'#fff', padding:'2px 10px', borderRadius:10, fontSize:'0.75rem', fontWeight:700 }}>
              {pending.length}
            </span>
          </CardHeader>
          <CardBody style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {pending.map(p => (
              <div key={p.id} style={{ border:'1px solid var(--border-color)', borderRadius:8, padding:'12px 14px', background:'rgba(245,158,11,.06)' }}>
                <div style={{ display:'flex', justifyContent:'space-between', alignItems:'baseline', flexWrap:'wrap', gap:8 }}>
                  <strong style={{ fontSize:'0.9375rem' }}>
                    {p.impliedPrime}% <span style={{ color:'var(--text-secondary)', fontWeight:400 }}>(was {p.currentPrime}%)</span>
                  </strong>
                  <span style={{ fontSize:'0.75rem', color:'var(--text-secondary)' }}>
                    Detected {fmtDate(p.fetchedAt)} · source: {p.source || 'manual'}
                  </span>
                </div>
                <p style={{ margin:'6px 0 10px', fontSize:'0.8125rem', color:'var(--text-secondary)' }}>
                  Repo {p.repoRate}% + {p.margin}% margin = {p.impliedPrime}%. Delta {p.delta > 0 ? '+' : ''}{p.delta}%.
                  Accept to update prime and trigger user notifications.
                </p>
                <div style={{ display:'flex', gap:8 }}>
                  <Button variant="forest" size="sm" onClick={() => acceptPending(p.id)}>Accept &amp; apply</Button>
                  <Button variant="ghost"  size="sm" onClick={() => dismissPending(p.id)}>Dismiss</Button>
                </div>
              </div>
            ))}
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>Prime Rate</CardHeader>
        <CardBody>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 4 }}>
            Update the SARB prime rate. Recalculates all rate alerts and bank comparisons.
          </p>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.8125rem', marginBottom: 16 }}>
            Last changed: <strong>{fmtDate(lastChanged)}</strong>
            {lastChanged ? null : <> (no admin update on record — set once below)</>}
          </p>
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', marginBottom: 12 }}>
            <Input label="New prime rate (%)" id="adm-prime" type="number" value={primeInput} onChange={e => setPrimeInput(e.target.value)} step="0.25" style={{ maxWidth: 160 }} />
            <Button variant="forest" onClick={updatePrimeRate}>Update rate</Button>
          </div>
          <div style={{ display:'flex', gap:8, marginBottom: 8 }}>
            <Button variant="ghost" size="sm" onClick={checkSarbNow} disabled={checking}>
              {checking ? 'Checking SARB…' : 'Check SARB now'}
            </Button>
            <Button variant="ghost" size="sm" onClick={sendRateAlerts}>Send rate alert emails to customers</Button>
          </div>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.75rem', marginTop: 8, marginBottom: 0 }}>
            A daily cron checks SARB at 09:30 SAST. Detected changes appear above as a "Confirm to apply" card — no auto-apply.
          </p>
        </CardBody>
      </Card>

      {history.length > 0 && (
        <Card>
          <CardHeader>Prime rate history</CardHeader>
          <CardBody>
            <div style={{ display:'flex', flexDirection:'column', gap:6, fontSize:'0.875rem' }}>
              {[...history].reverse().slice(0, 10).map((h, i) => (
                <div key={i} style={{ display:'flex', justifyContent:'space-between', borderBottom:'1px solid var(--border-color)', padding:'4px 0' }}>
                  <span style={{ color:'var(--text-secondary)' }}>{fmtDate(h.date)}</span>
                  <strong>{h.rate}%</strong>
                  <span style={{ color:'var(--text-secondary)', fontSize:'0.75rem' }}>
                    {h.source === 'sarb_auto' ? 'SARB' : (h.changedBy || 'admin')}
                  </span>
                </div>
              ))}
            </div>
          </CardBody>
        </Card>
      )}

      <Card>
        <CardHeader>Admin Access</CardHeader>
        <CardBody>
          <p style={{ color: 'var(--text-secondary)', fontSize: '0.875rem', marginBottom: 8 }}>To create additional admin accounts, use the bootstrap endpoint.</p>
          <code style={{ background: 'var(--bg-page)', padding: '8px 12px', borderRadius: 6, fontSize: '0.8125rem', display: 'block', color: 'var(--text-secondary)' }}>
            POST /api/admin/bootstrap<br/>
            {'{ "name": "...", "email": "...", "password": "...", "secret": "BOOTSTRAP_SECRET" }'}
          </code>
        </CardBody>
      </Card>
    </div>
  );
}
