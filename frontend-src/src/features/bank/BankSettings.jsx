import { useEffect, useState } from 'react';
import { bankApi } from './bankApi.js';

/**
 * Bank profile + rate sheet. The rate sheet is a tiered pricing matrix
 * (LTV band × amount band → rate offset from prime). Auto-bid and the
 * suggested-bid templates honour it when present.
 */
export default function BankSettings() {
  const [sheet, setSheet] = useState(null);
  const [err, setErr]     = useState(null);
  const [matrix, setMatrix] = useState([]);
  const [basePrime, setBasePrime] = useState('');
  const [notes, setNotes]         = useState('');
  const [busy, setBusy]   = useState(false);
  const [info, setInfo]   = useState(null);

  useEffect(() => {
    bankApi.rateSheet().then(d => {
      setSheet(d.sheet);
      setMatrix(d.sheet?.matrix || []);
      setBasePrime(d.sheet?.basePrime ?? '');
      setNotes(d.sheet?.notes || '');
    }).catch(e => setErr(e.message));
  }, []);

  function addRow() {
    setMatrix([...matrix, { minLtv: 0, maxLtv: 80, minAmount: 0, maxAmount: 999999999, rateOffsetFromPrime: -0.25 }]);
  }
  function updateRow(i, k, v) {
    const next = [...matrix]; next[i] = { ...next[i], [k]: v === '' ? null : Number(v) }; setMatrix(next);
  }
  function removeRow(i) { setMatrix(matrix.filter((_, idx) => idx !== i)); }

  async function save() {
    setBusy(true); setInfo(null); setErr(null);
    try {
      await bankApi.saveRateSheet({ matrix, basePrime: basePrime ? Number(basePrime) : null, notes });
      setInfo('Rate sheet saved. Auto-bid and the Suggested-rate templates will use it.');
    } catch (e) { setErr(e.message); }
    finally { setBusy(false); }
  }

  return (
    <>
      <h2>Settings</h2>
      <p className="lede">Customise your Bond Desk presence and pricing.</p>

      <BrandingCard />


      <div className="bank-section">
        <h3>Pricing matrix</h3>
        <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 12 }}>
          Each row defines a tier: LTV range × amount range → rate offset from prime (negative means under prime).
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 50px', gap: 8, alignItems: 'center', fontSize: '0.72rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', padding: '0 0 8px' }}>
          <div>Min LTV %</div><div>Max LTV %</div><div>Min amount (R)</div><div>Max amount (R)</div><div>Rate offset (%)</div><div></div>
        </div>
        {matrix.map((r, i) => (
          <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr 1fr 1fr 50px', gap: 8, alignItems: 'center', marginBottom: 6 }}>
            <input type="number" value={r.minLtv ?? ''}    onChange={e => updateRow(i, 'minLtv',    e.target.value)} style={input} placeholder="0" />
            <input type="number" value={r.maxLtv ?? ''}    onChange={e => updateRow(i, 'maxLtv',    e.target.value)} style={input} placeholder="80" />
            <input type="number" value={r.minAmount ?? ''} onChange={e => updateRow(i, 'minAmount', e.target.value)} style={input} placeholder="0" />
            <input type="number" value={r.maxAmount ?? ''} onChange={e => updateRow(i, 'maxAmount', e.target.value)} style={input} placeholder="∞" />
            <input type="number" step="0.05" value={r.rateOffsetFromPrime ?? ''} onChange={e => updateRow(i, 'rateOffsetFromPrime', e.target.value)} style={input} placeholder="-0.25" />
            <button onClick={() => removeRow(i)} style={{ background: 'transparent', color: '#991b1b', border: '1px solid #fecaca', borderRadius: 5, cursor: 'pointer', fontWeight: 700, fontSize: '0.7rem', padding: '6px 0' }}>×</button>
          </div>
        ))}
        <button onClick={addRow} style={{ padding: '6px 14px', background: 'transparent', border: '1px dashed #c8a84b', color: '#0b1e2d', borderRadius: 6, fontSize: '0.78rem', fontWeight: 700, cursor: 'pointer', marginTop: 8 }}>
          + Add tier
        </button>

        <div style={{ marginTop: 18, display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Your base prime override (%)</span>
            <input type="number" step="0.05" value={basePrime} onChange={e => setBasePrime(e.target.value)} style={input} placeholder="leave blank to use SARB prime" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: '0.72rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase' }}>Notes (internal)</span>
            <input value={notes} onChange={e => setNotes(e.target.value)} style={input} placeholder="e.g. Updated 2026-05 by treasury" />
          </label>
        </div>

        {matrix.length > 0 && (
          <div style={{ marginTop: 18, marginBottom: 10 }}>
            <div style={{ fontSize: '0.7rem', color: '#6b7280', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: 10 }}>Rate visualisation</div>
            <div style={{ display: 'flex', gap: 4, alignItems: 'flex-end', height: 80 }}>
              {matrix.map((r, i) => {
                const offset = r.rateOffsetFromPrime ?? 0;
                const height = Math.max(10, 40 + offset * 40);
                const label = `${r.minLtv ?? 0}–${r.maxLtv ?? 100}%`;
                return (
                  <div key={i} style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3 }}>
                    <div style={{ fontSize: '0.65rem', fontWeight: 700, color: offset < 0 ? '#15803d' : '#991b1b' }}>
                      {offset > 0 ? '+' : ''}{offset}%
                    </div>
                    <div style={{ width: '100%', height: height + 'px', background: offset < -0.1 ? '#86efac' : offset < 0 ? '#c8a84b' : '#fca5a5', borderRadius: '3px 3px 0 0' }} />
                    <div style={{ fontSize: '0.6rem', color: '#6b7280', textAlign: 'center' }}>{label}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ fontSize: '0.7rem', color: '#9ca3af', marginTop: 6 }}>Green = under prime (competitive) · Red = over prime</div>
          </div>
        )}

        {err  && <div style={{ color: '#991b1b', fontSize: '0.85rem', marginTop: 10 }}>{err}</div>}
        {info && <div style={{ color: '#15803d', fontSize: '0.85rem', marginTop: 10 }}>{info}</div>}
        {sheet?.updatedAt && (
          <div style={{ fontSize: '0.72rem', color: '#9ca3af', marginTop: 6 }}>
            Last saved: {new Date(sheet.updatedAt).toLocaleString('en-ZA', { dateStyle: 'short', timeStyle: 'short' })}
            {sheet.updatedBy ? ` · by ${sheet.updatedBy}` : ''}
          </div>
        )}

        <div style={{ marginTop: 14, display: 'flex', justifyContent: 'flex-end' }}>
          <button onClick={save} disabled={busy}
            style={{ padding: '9px 22px', background: '#0b1e2d', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
            {busy ? 'Saving…' : 'Save rate sheet'}
          </button>
        </div>
      </div>
    </>
  );
}

const input = { padding: '7px 10px', border: '1px solid #e5e7eb', borderRadius: 6, fontSize: '0.875rem', background: '#fff' };

function BrandingCard() {
  const [color, setColor] = useState('#0b1e2d');
  const [logo, setLogo]   = useState('');
  const [busy, setBusy]   = useState(false);
  const [info, setInfo]   = useState(null);

  async function save() {
    setBusy(true); setInfo(null);
    try {
      const r = await bankApi.updateProfile({ brandColor: color, logoUrl: logo || undefined });
      setInfo('Branding saved. Refresh to see the new colour in the sidebar.');
    } catch (e) { setInfo(e.message); }
    finally { setBusy(false); }
  }
  return (
    <div className="bank-section">
      <h3>Branding</h3>
      <div style={{ fontSize: '0.78rem', color: '#6b7280', marginBottom: 12 }}>
        Tints the sidebar accent. Affects every user at your bank.
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, alignItems: 'center' }}>
        <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Accent colour</label>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <input type="color" value={color} onChange={e => setColor(e.target.value)} style={{ width: 60, height: 36, border: '1px solid #e5e7eb', borderRadius: 6 }} />
          <code style={{ fontSize: '0.82rem' }}>{color}</code>
        </div>
        <label style={{ fontSize: '0.78rem', fontWeight: 700 }}>Logo URL (optional)</label>
        <input value={logo} onChange={e => setLogo(e.target.value)} placeholder="https://yourbank.co.za/logo.svg" style={input} />
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: 14 }}>
        <button onClick={save} disabled={busy} style={{ padding: '9px 22px', background: '#0b1e2d', color: '#fff', border: 'none', borderRadius: 7, fontWeight: 700, fontSize: '0.875rem', cursor: 'pointer' }}>
          {busy ? 'Saving…' : 'Save branding'}
        </button>
      </div>
      {info && <div style={{ color: info.startsWith('Branding') ? '#15803d' : '#991b1b', fontSize: '0.82rem', marginTop: 10 }}>{info}</div>}
    </div>
  );
}
