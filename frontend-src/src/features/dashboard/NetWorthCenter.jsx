import { useState, useEffect } from 'react';
import { finances } from '../../lib/api.js';
import { useNetWorth, useHealthHistory } from './hooks/useFinanceQueries.js';
import { fmt } from '@bondly/ui/lib/format.js';
import Sparkline from '../../components/Sparkline.jsx';
import './NetWorthCenter.css';

const ASSET_FIELDS = [
  { key: 'propertyValue',   label: 'Property value',        placeholder: 'R 2,500,000' },
  { key: 'savings',         label: 'Savings / cash',        placeholder: 'R 50,000' },
  { key: 'investments',     label: 'Investments / shares',  placeholder: 'R 0' },
  { key: 'retirementFund',  label: 'Retirement annuity',    placeholder: 'R 0' },
  { key: 'vehicle',         label: 'Vehicle(s)',            placeholder: 'R 0' },
  { key: 'otherAssets',     label: 'Other assets',          placeholder: 'R 0' },
];

const LIAB_FIELDS = [
  { key: 'bondBalance',     label: 'Bond / home loan',      locked: true },
  { key: 'carLoan',         label: 'Car loan',              placeholder: 'R 0' },
  { key: 'creditCards',     label: 'Credit cards',          placeholder: 'R 0' },
  { key: 'storeCards',      label: 'Store accounts',        placeholder: 'R 0' },
  { key: 'personalLoan',    label: 'Personal loan',         placeholder: 'R 0' },
  { key: 'otherDebt',       label: 'Other debt',            placeholder: 'R 0' },
];

function parseInput(v) {
  return parseFloat(String(v).replace(/[^0-9.]/g, '')) || 0;
}

function DonutChart({ assets, liabilities }) {
  const total = assets + liabilities || 1;
  const assetPct = assets / total;
  const r = 56, cx = 72, cy = 72, circ = 2 * Math.PI * r;
  const assetArc = circ * assetPct;
  return (
    <svg width="144" height="144" viewBox="0 0 144 144">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#ef444422" strokeWidth="20" />
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#22c55e" strokeWidth="20"
        strokeDasharray={`${assetArc} ${circ}`}
        strokeDashoffset={circ * 0.25}
        strokeLinecap="butt"
        style={{ transition: 'stroke-dasharray 0.8s ease' }}
      />
      <text x={cx} y={cy - 12} textAnchor="middle" fill="var(--color-text-muted)" fontSize="11">Net worth</text>
      <text x={cx} y={cy + 8} textAnchor="middle" fill="var(--color-text)" fontSize="15" fontWeight="800">
        {assets - liabilities >= 0 ? '' : '-'}{fmt(Math.abs(assets - liabilities))}
      </text>
      <text x={cx} y={cy + 24} textAnchor="middle" fill="var(--color-text-muted)" fontSize="10">
        {Math.round(assetPct * 100)}% assets
      </text>
    </svg>
  );
}

export default function NetWorthCenter({ showToast }) {
  const { data: serverNWRaw, isLoading: nwLoading, isError: nwError, refetch: refetchNW } = useNetWorth();
  const { data: histRaw, isLoading: histLoading } = useHealthHistory();

  const serverNW = serverNWRaw?.available !== false ? serverNWRaw : null;
  const history  = histRaw?.history || [];
  const loading  = nwLoading || histLoading;

  const [assets, setAssets] = useState(() => {
    const s = JSON.parse(localStorage.getItem('bondly_nw_inputs') || '{}');
    return s.assets || {};
  });
  const [liabs,  setLiabs]  = useState(() => {
    const s = JSON.parse(localStorage.getItem('bondly_nw_inputs') || '{}');
    return s.liabs || {};
  });
  const [saving, setSaving] = useState(false);

  // Pre-fill bond balance from server when not already set locally
  useEffect(() => {
    if (serverNW?.bondBalance) {
      const stored = JSON.parse(localStorage.getItem('bondly_nw_inputs') || '{}');
      if (!stored.liabs?.bondBalance) {
        setLiabs(prev => ({ ...prev, bondBalance: serverNW.bondBalance }));
      }
    }
  }, [serverNW?.bondBalance]); // eslint-disable-line react-hooks/exhaustive-deps

  const totalAssets = ASSET_FIELDS.reduce((s, f) => s + parseInput(assets[f.key] ?? 0), 0);
  const totalLiabs  = LIAB_FIELDS.reduce((s, f)  => s + parseInput(liabs[f.key]  ?? 0), 0);
  const netWorth    = totalAssets - totalLiabs;

  function setAsset(key, val) { setAssets(a => ({ ...a, [key]: val })); }
  function setLiab(key, val)  { setLiabs(l => ({ ...l, [key]: val })); }

  async function save() {
    localStorage.setItem('bondly_nw_inputs', JSON.stringify({ assets, liabs }));
    setSaving(true);
    try {
      await finances.netWorth({ assets, liabilities: liabs });
      showToast?.('Net worth saved', 'success');
    } catch { showToast?.('Saved locally', 'info'); }
    finally { setSaving(false); }
  }

  const nwHistory = history.map(h => Math.max(0, (h.income ?? 0) - (h.totalExpenses ?? h.expenses ?? 0))).filter(Boolean);

  if (loading) return <div style={{ height: 200, background: 'var(--color-surface-2)', borderRadius: 12, animation: 'skeleton-pulse 1.4s ease-in-out infinite' }} />;
  if (nwError) return (
    <div style={{ padding: '1rem', color: 'var(--color-text-muted)', fontSize: '0.875rem' }}>
      Failed to load net worth data. <button onClick={() => refetchNW()} style={{ background: 'none', border: 'none', color: 'var(--color-primary)', cursor: 'pointer', textDecoration: 'underline' }}>Retry</button>
    </div>
  );

  return (
    <div className="nwc">
      {/* Hero */}
      <div className="nwc-hero">
        <DonutChart assets={totalAssets} liabilities={totalLiabs} />
        <div className="nwc-hero__stats">
          <div className="nwc-hero__row">
            <span className="nwc-hero__dot nwc-hero__dot--green" />
            <div>
              <div className="nwc-hero__label">Total assets</div>
              <div className="nwc-hero__val">{fmt(totalAssets)}</div>
            </div>
          </div>
          <div className="nwc-hero__row">
            <span className="nwc-hero__dot nwc-hero__dot--red" />
            <div>
              <div className="nwc-hero__label">Total liabilities</div>
              <div className="nwc-hero__val">{fmt(totalLiabs)}</div>
            </div>
          </div>
          {netWorth !== 0 && (
            <div className="nwc-hero__net" style={{ color: netWorth >= 0 ? '#22c55e' : '#ef4444' }}>
              {netWorth >= 0 ? '↑' : '↓'} {fmt(Math.abs(netWorth))} net worth
            </div>
          )}
          {nwHistory.length >= 2 && (
            <Sparkline values={nwHistory} width={100} height={32} color="#22c55e" fill />
          )}
        </div>
      </div>

      {/* Inputs */}
      <div className="nwc-cols">
        <section className="nwc-section">
          <h4 className="nwc-section__title">
            <span className="nwc-dot nwc-dot--green" /> Assets
          </h4>
          {ASSET_FIELDS.map(f => (
            <div key={f.key} className="nwc-row">
              <label className="nwc-row__label">{f.label}</label>
              <input
                className="nwc-row__input"
                type="text"
                inputMode="numeric"
                placeholder={f.placeholder}
                value={assets[f.key] ?? ''}
                onChange={e => setAsset(f.key, e.target.value)}
              />
            </div>
          ))}
          <div className="nwc-total">Total: <strong>{fmt(totalAssets)}</strong></div>
        </section>

        <section className="nwc-section">
          <h4 className="nwc-section__title">
            <span className="nwc-dot nwc-dot--red" /> Liabilities
          </h4>
          {LIAB_FIELDS.map(f => (
            <div key={f.key} className="nwc-row">
              <label className="nwc-row__label">
                {f.label}
                {f.locked && <span className="nwc-row__locked">auto</span>}
              </label>
              <input
                className="nwc-row__input"
                type="text"
                inputMode="numeric"
                placeholder={f.placeholder || 'R 0'}
                value={liabs[f.key] ?? ''}
                readOnly={f.locked}
                style={f.locked ? { opacity: 0.6 } : {}}
                onChange={e => !f.locked && setLiab(f.key, e.target.value)}
              />
            </div>
          ))}
          <div className="nwc-total">Total: <strong>{fmt(totalLiabs)}</strong></div>
        </section>
      </div>

      <button className="nwc-save" onClick={save} disabled={saving}>
        {saving ? 'Saving…' : 'Save net worth'}
      </button>
    </div>
  );
}
