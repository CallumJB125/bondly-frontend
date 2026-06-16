import { useEffect, useState } from 'react';
import { bankApi } from './bankApi.js';
import './BankMLModels.css';

function pct(v) {
  if (v == null) return '—';
  return (v * 100).toFixed(2) + '%';
}

function num(v) {
  if (v == null) return '—';
  return v.toLocaleString('en-ZA');
}

function calClass(err) {
  const e = Math.abs(err) * 100;
  if (e < 2)  return 'cal-green';
  if (e <= 5) return 'cal-amber';
  return 'cal-red';
}

export default function BankMLModels() {
  const [data, setData] = useState(null);
  const [err, setErr]   = useState(null);

  useEffect(() => {
    bankApi.mlModels().then(setData).catch(e => setErr(e.message));
  }, []);

  if (err)   return <div className="bank-section" style={{ color: '#991b1b' }}>Failed to load ML data: {err}</div>;
  if (!data) return <div className="bank-section" style={{ color: '#4a6a88' }}>Loading ML model data…</div>;

  const { freddie, synthetic, mlServerOnline } = data;
  const sectorEntries = Object.entries(synthetic.sector_calibration || {});

  // Build coverage bar data from years array + total_rows (we spread rows evenly as a proxy,
  // since per-year row counts aren't in the report — use total_rows / years.length as estimate)
  const years = freddie.years || [];
  const approxRowsPerYear = Math.round(freddie.total_rows / years.length);

  return (
    <>
      <h2>ML Models</h2>
      <p className="lede">
        Default-risk model trained on Freddie Mac historical data and calibrated to NCR sector benchmarks.
      </p>

      {/* Status pill */}
      <div className={`ml-status-pill ${mlServerOnline ? 'online' : 'offline'}`}>
        <span className="dot" />
        {mlServerOnline ? 'ML server online' : 'ML server offline'}
      </div>

      {/* Hero stat row */}
      <div className="ml-hero">
        <div className="ml-hero-card">
          <div className="hero-value">{freddie.mean_auc_roc.toFixed(3)}</div>
          <div className="hero-label">AUC-ROC</div>
          <div className="hero-sub">Mean across 3 CV folds</div>
        </div>
        <div className="ml-hero-card">
          <div className="hero-value">{num(freddie.total_loans)}</div>
          <div className="hero-label">Loans backtested</div>
          <div className="hero-sub">Freddie Mac dataset</div>
        </div>
        <div className="ml-hero-card">
          <div className="hero-value">{years.length}</div>
          <div className="hero-label">Years of data</div>
          <div className="hero-sub">{years[0]}–{years[years.length - 1]}</div>
        </div>
      </div>

      {/* Synthetic SA cohort card */}
      <div className="ml-synthetic-card">
        <h3>SA Synthetic Cohort</h3>
        <div className="ml-synthetic-stats">
          <div>
            <div className="stat-val">{pct(synthetic.cohort_summary.default_rate)}</div>
            <div className="stat-lbl">Default rate</div>
          </div>
          <div>
            <div className="stat-val">{synthetic.mean_auc_roc.toFixed(3)}</div>
            <div className="stat-lbl">AUC-ROC</div>
          </div>
          <div>
            <div className="stat-val">{num(synthetic.cohort_summary.n_loans)}</div>
            <div className="stat-lbl">Loans</div>
          </div>
        </div>
        <div className="ml-ncr-note">
          Synthetic cohort generated using NCR sector default targets. Sector default rates are calibrated to match
          real South African credit bureau benchmarks. The model is trained on Freddie Mac patterns and recalibrated
          against this SA cohort.
        </div>
      </div>

      {/* Freddie Mac CV fold table */}
      <div className="ml-section">
        <h3>Cross-validation — Freddie Mac</h3>
        <div className="section-sub">{num(freddie.total_rows)} loan-month rows · overall default rate {pct(freddie.overall_default_rate)}</div>
        <table className="ml-table">
          <thead>
            <tr>
              <th>Fold</th>
              <th>Train loans</th>
              <th>Test loans</th>
              <th>Default rate</th>
              <th>AUC-ROC</th>
              <th>AUC-PR</th>
              <th>Brier</th>
            </tr>
          </thead>
          <tbody>
            {freddie.cv_folds.map(f => (
              <tr key={f.fold}>
                <td>{f.fold}</td>
                <td className="mono">{num(f.train_loans)}</td>
                <td className="mono">{num(f.test_loans)}</td>
                <td className="mono">{pct(f.test_default_rate)}</td>
                <td className="mono" style={{ color: '#c8a84b', fontWeight: 700 }}>{f.auc_roc.toFixed(4)}</td>
                <td className="mono">{f.auc_pr.toFixed(4)}</td>
                <td className="mono">{f.brier.toFixed(4)}</td>
              </tr>
            ))}
            <tr style={{ borderTop: '1px solid #2a4560', fontWeight: 700 }}>
              <td colSpan={4} style={{ color: '#4a6a88', fontSize: '0.75rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mean</td>
              <td className="mono" style={{ color: '#c8a84b' }}>{freddie.mean_auc_roc.toFixed(4)}</td>
              <td className="mono">{freddie.mean_auc_pr.toFixed(4)}</td>
              <td className="mono">{freddie.mean_brier.toFixed(4)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Data coverage bar */}
      <div className="ml-section">
        <h3>Data coverage</h3>
        <div className="section-sub">{years[0]}–{years[years.length - 1]} · ~{num(approxRowsPerYear)} loan-month rows per year (estimated)</div>
        <div className="ml-coverage-grid">
          {years.map(y => (
            <>
              <div key={y + '-label'} className="year-label">{y}</div>
              <div key={y + '-bar'} style={{ background: '#0b1e2d', borderRadius: 3, height: 14, overflow: 'hidden' }}>
                <div style={{ width: '100%', height: '100%', background: 'linear-gradient(90deg, #1a4a6a, #c8a84b)', borderRadius: 3 }} />
              </div>
              <div key={y + '-count'} className="year-count">{(approxRowsPerYear / 1000).toFixed(0)}k</div>
            </>
          ))}
        </div>
      </div>

      {/* Sector calibration table */}
      <div className="ml-section">
        <h3>Sector calibration — SA synthetic</h3>
        <div className="section-sub">Calibration error = |model predicted − synthetic actual|. Green &lt;2%, amber 2–5%, red &gt;5%.</div>
        <table className="ml-table">
          <thead>
            <tr>
              <th>Sector</th>
              <th>NCR target</th>
              <th>Synthetic actual</th>
              <th>Model predicted</th>
              <th>Cal. error</th>
            </tr>
          </thead>
          <tbody>
            {sectorEntries.map(([sector, cal]) => (
              <tr key={sector}>
                <td>{sector}</td>
                <td className="mono">{pct(cal.ncr_target)}</td>
                <td className="mono">{pct(cal.synthetic_actual)}</td>
                <td className="mono">{pct(cal.model_predicted)}</td>
                <td className={`mono ${calClass(cal.calibration_error)}`} style={{ fontWeight: 700 }}>
                  {pct(cal.calibration_error)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}
