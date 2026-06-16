import { useState, useEffect } from 'react';
import { adminFairLending } from '../../../lib/api.js';
import './FairLendingTab.css';

function VerdictBadge({ passes, note }) {
  if (note) return <span className="fl-badge fl-badge--info">Insufficient data</span>;
  return passes
    ? <span className="fl-badge fl-badge--pass">PASS</span>
    : <span className="fl-badge fl-badge--review">REVIEW</span>;
}

function GroupTable({ result, title }) {
  if (!result) return null;
  const { groups = [], disparityRatio, passes, verdict, note } = result;
  return (
    <div className="fl-section">
      <div className="fl-section__header">
        <h3 className="fl-section__title">{title}</h3>
        <VerdictBadge passes={passes} note={note} />
      </div>
      {note ? (
        <p className="fl-empty">{note} — more data needed before this dimension can be evaluated.</p>
      ) : (
        <>
          <p className="fl-verdict">{verdict}</p>
          <p className="fl-ratio">Disparity ratio: <strong>{disparityRatio}</strong> (threshold ≥ 0.80)</p>
          <table className="fl-table">
            <thead>
              <tr>
                <th>Group</th>
                <th className="fl-table__num">Count</th>
                <th className="fl-table__num">Flag rate</th>
                <th className="fl-table__num">Bar</th>
              </tr>
            </thead>
            <tbody>
              {groups.map(g => (
                <tr key={g.group}>
                  <td>{g.group}</td>
                  <td className="fl-table__num">{g.n}</td>
                  <td className="fl-table__num">{(g.flagRate * 100).toFixed(1)}%</td>
                  <td className="fl-table__bar">
                    <div className="fl-bar">
                      <div className="fl-bar__fill" style={{ width: `${g.flagRate * 100}%` }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}

export default function FairLendingTab() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [minGroup, setMinGroup] = useState(10);

  const load = (mg) => {
    setLoading(true);
    adminFairLending.report(mg)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  };

  useEffect(() => { load(minGroup); }, []);

  const overallPasses = data && !data.byProvince?.note && !data.byIncome?.note
    ? (data.byProvince?.passes !== false && data.byIncome?.passes !== false)
    : null;

  return (
    <div className="fl-tab">
      <div className="fl-header">
        <div>
          <h2 className="fl-header__title">Fair-Lending Screen</h2>
          <p className="fl-header__sub">
            Proxy-attribute disparate-impact test (four-fifths rule). Grouping by province and income band.
            This is an early-warning screen — a full fair-lending audit requires protected attributes under bank governance.
          </p>
        </div>
        <div className="fl-header__controls">
          <label className="fl-label">Min. group size
            <select className="fl-select" value={minGroup} onChange={e => { const v = parseInt(e.target.value, 10); setMinGroup(v); load(v); }}>
              {[5, 10, 20, 50].map(n => <option key={n} value={n}>{n}</option>)}
            </select>
          </label>
        </div>
      </div>

      {loading && <p className="fl-loading">Loading…</p>}

      {!loading && !data && (
        <p className="fl-error">Could not load fair-lending report.</p>
      )}

      {!loading && data && (
        <>
          <div className="fl-summary">
            <div className="fl-summary__stat">
              <span className="fl-summary__label">Sample size</span>
              <span className="fl-summary__value">{data.sampleSize}</span>
            </div>
            <div className="fl-summary__stat">
              <span className="fl-summary__label">Overall status</span>
              <span className="fl-summary__value">
                {overallPasses === null ? '—' : overallPasses ? '✓ PASS' : '⚠ REVIEW'}
              </span>
            </div>
            <div className="fl-summary__stat">
              <span className="fl-summary__label">Standard</span>
              <span className="fl-summary__value">Four-fifths (80%) rule</span>
            </div>
            <div className="fl-summary__stat">
              <span className="fl-summary__label">Generated</span>
              <span className="fl-summary__value">{new Date(data.generatedAt).toLocaleString('en-ZA')}</span>
            </div>
          </div>

          <GroupTable result={data.byProvince} title="By Province" />
          <GroupTable result={data.byIncome}   title="By Income Band" />

          <p className="fl-footnote">
            Flag = risk score ≥ 65. Province and income band are proxy attributes only — no race data is collected or stored.
          </p>
        </>
      )}
    </div>
  );
}
