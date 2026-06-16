import { useEffect, useState } from 'react';
import { intelligence } from '../../lib/api.js';
import './Analytics.css';

const pct = v => `${(v * 100).toFixed(1)}%`;

function StatCard({ label, value, sub, color }) {
  return (
    <div className="mh-stat">
      <div className="mh-stat__val" style={{ color }}>{value}</div>
      <div className="mh-stat__label">{label}</div>
      {sub && <div className="mh-stat__sub">{sub}</div>}
    </div>
  );
}

function ModelHealth({ health }) {
  const { backtest, drift, model } = health;
  const op = backtest.operatingPoint;
  const ci = backtest.ci;
  const maxW = model?.topFeatures?.[0] ? Math.abs(model.topFeatures[0].weight) : 1;

  return (
    <section className="intel-section">
      <h2 className="intel-h2">Model health</h2>
      <p className="intel-muted">Backtest · drift monitoring · feature weights — evidence pack for bank model-risk review</p>

      <div className="mh-stats">
        <StatCard label="Recall" value={pct(op.recall)}
          sub={`95% CI [${pct(ci.recall.lo)}, ${pct(ci.recall.hi)}]`}
          color="var(--mint, #2bb673)" />
        <StatCard label="Precision" value={pct(op.precision)}
          sub={`95% CI [${pct(ci.precision.lo)}, ${pct(ci.precision.hi)}]`}
          color="var(--mint, #2bb673)" />
        <StatCard label="Lead time" value={`${backtest.leadTime.medianMonthsBeforeDefault}mo`}
          sub="median months before default" color="var(--text-primary)" />
        <StatCard label="F1" value={op.f1.toFixed(2)}
          sub={`at threshold ${op.threshold}`} color="var(--text-primary)" />
        <StatCard label="False-positive rate" value={pct(op.fpr)}
          sub="healthy accounts wrongly flagged"
          color={op.fpr > 0.15 ? '#dc2626' : 'var(--text-primary)'} />
      </div>

      <h3 className="intel-h3">Precision / recall tradeoff</h3>
      <div className="mh-sweep">
        <div className="mh-sweep__legend">
          <span className="mh-sweep__dot mh-sweep__dot--recall" />recall
          <span className="mh-sweep__dot mh-sweep__dot--prec" />precision
        </div>
        {backtest.sweep.map(c => (
          <div key={c.threshold} className={`mh-sweep__row${c.threshold === op.threshold ? ' mh-sweep__row--active' : ''}`}>
            <span className="mh-sweep__thr">{c.threshold}</span>
            <div className="mh-sweep__bars">
              <div className="mh-sweep__bar mh-sweep__bar--recall" style={{ width: `${c.recall * 100}%` }} />
              <div className="mh-sweep__bar mh-sweep__bar--prec"   style={{ width: `${c.precision * 100}%` }} />
            </div>
            <span className="mh-sweep__f1">F1 {c.f1.toFixed(2)}</span>
          </div>
        ))}
      </div>

      <h3 className="intel-h3">Drift monitoring (PSI)</h3>
      <div className="mh-psi">
        {[drift.stable, drift.shock].map(d => (
          <div key={d.label} className={`mh-psi__block mh-psi__block--${d.verdict}`}>
            <div className="mh-psi__head">
              <span className="mh-psi__label">{d.label}</span>
              <span className={`mh-psi__badge mh-psi__badge--${d.verdict}`}>{d.verdict} · PSI {d.scorePsi}</span>
            </div>
            <p className="mh-psi__action">{d.action}</p>
            {d.features.slice(0, 4).map(f => (
              <div key={f.feature} className="mh-psi__feat">
                <span>{f.feature}</span>
                <span className={`mh-psi__level mh-psi__level--${f.level}`}>{f.level} {f.psi}</span>
              </div>
            ))}
          </div>
        ))}
      </div>
      <p className="intel-muted" style={{ marginTop: 6 }}>{drift.psiNote}</p>

      {model?.topFeatures && (
        <>
          <h3 className="intel-h3">Feature weights</h3>
          <div className="intel-bars">
            {model.topFeatures.map(f => (
              <div key={f.feature} className="intel-row">
                <div className="intel-row__head">
                  <span className="intel-row__label">{f.feature.replace(/([A-Z])/g, ' $1').trim()}</span>
                  <span className="intel-row__sub">{f.weight > 0 ? '+' : ''}{f.weight}</span>
                </div>
                <div className="intel-row__track">
                  <div className="intel-row__fill"
                    style={{ width: `${Math.abs(f.weight) / maxW * 100}%`,
                      background: f.weight >= 0 ? 'var(--mint, #2bb673)' : '#6366f1' }} />
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      <p className="intel-muted mh-note">{backtest.honestNote}</p>
    </section>
  );
}

const SECTOR_LABELS = {
  agriculture: 'Agriculture', mining: 'Mining', manufacturing: 'Manufacturing',
  utilities_energy: 'Utilities & Energy', construction: 'Construction',
  retail_trade: 'Retail & Wholesale', transport_logistics: 'Transport & Logistics',
  hospitality_tourism: 'Hospitality & Tourism', ict_tech: 'ICT & Technology',
  financial_services: 'Financial Services', business_services: 'Business Services',
  government_public: 'Government & Public', healthcare: 'Healthcare', education: 'Education',
  media_entertainment: 'Media & Entertainment', gig_platform: 'Gig & Platform',
  nonprofit: 'Non-profit', other: 'Other / Unclassified',
};

// distress 0 (healthy) → 100 (critical): green → amber → red
function distressColor(score) {
  if (score == null) return 'var(--border-color)';
  const s = Math.max(0, Math.min(100, score));
  const hue = 130 - (s / 100) * 130; // 130 green → 0 red
  return `hsl(${hue}, 65%, 45%)`;
}

function Cell({ label, sub, score, count, max }) {
  const flex = Math.max(1, Math.round((count / (max || 1)) * 100));
  return (
    <div className="intel-cell" style={{ flexGrow: flex, background: distressColor(score) }}>
      <div className="intel-cell__label">{label}</div>
      <div className="intel-cell__stat">{score == null ? '—' : score}</div>
      <div className="intel-cell__sub">{sub}</div>
    </div>
  );
}

function Bar({ label, sub, score, share }) {
  return (
    <div className="intel-row">
      <div className="intel-row__head">
        <span className="intel-row__label">{label}</span>
        <span className="intel-row__sub">{sub}</span>
      </div>
      <div className="intel-row__track">
        <div className="intel-row__fill" style={{ width: `${share || 0}%`, background: distressColor(score) }} />
      </div>
    </div>
  );
}

export default function Analytics() {
  const [data, setData] = useState(null);
  const [health, setHealth] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      intelligence.heatmaps(),
      intelligence.modelHealth().catch(() => null),
    ]).then(([heatmapData, healthData]) => {
      setData(heatmapData);
      setHealth(healthData);
    }).catch(e => setError(e.message || 'Could not load analytics'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <div className="intel-wrap"><p className="intel-muted">Loading intelligence…</p></div>;
  if (error) return <div className="intel-wrap"><div className="intel-error">{error}</div></div>;
  if (!data) return null;

  const { heatmaps, inputs, calibration, generatedAt, employerRisk } = data;
  const sectors = heatmaps?.sectors || [];
  const provinces = heatmaps?.provinces || [];
  const areas = heatmaps?.areas || [];
  const fraudAreas = heatmaps?.fraudAreas || [];
  const fraudTypologies = heatmaps?.fraudTypologies || [];
  const maxSectorCount = Math.max(...sectors.map(s => s.count), 1);

  // Headline: which cohort is deteriorating fastest + total covered.
  const worstSector = sectors[0];
  const worstArea = areas[0] || provinces[0];

  return (
    <div className="intel-wrap">
      <header className="intel-head">
        <div>
          <h1 className="intel-title">Analytics — Risk Intelligence</h1>
          <p className="intel-muted">
            De-identified, k-anonymised behavioural signal across {inputs?.realProjections + inputs?.syntheticSubjects || heatmaps?.meta?.totalSubjects} subjects ·
            generated {generatedAt}
          </p>
        </div>
        <span className="intel-badge">k-anon {heatmaps?.meta?.kAnonymity} · {heatmaps?.meta?.kAnonymityNote}</span>
      </header>

      {/* Headline number */}
      <div className="intel-headline">
        {worstSector && (
          <p>
            <strong>{SECTOR_LABELS[worstSector.sector] || worstSector.sector}</strong> is the most strained sector
            (distress {worstSector.avgDistress}, {worstSector.distressShare}% strained/critical).
            {worstArea && <> Highest-risk area: <strong>{worstArea.town || worstArea.province}</strong> (distress {worstArea.avgDistress}).</>}
          </p>
        )}
      </div>

      {/* Sector heatmap (treemap-lite) */}
      <section className="intel-section">
        <h2 className="intel-h2">Sector heatmap</h2>
        <p className="intel-muted">Cell size = subjects · colour = average distress (green healthy → red critical)</p>
        <div className="intel-treemap">
          {sectors.map(s => (
            <Cell key={s.sector}
              label={SECTOR_LABELS[s.sector] || s.sector}
              sub={`n=${s.count} · ${s.distressShare ?? 0}% strained`}
              score={s.avgDistress} count={s.count} max={maxSectorCount} />
          ))}
          {!sectors.length && <p className="intel-muted">No sector cells cleared the k-anonymity threshold yet.</p>}
        </div>
      </section>

      {/* Geographic heatmap */}
      <section className="intel-section">
        <h2 className="intel-h2">Geographic heatmap</h2>
        <p className="intel-muted">By province (coarser cells clear k-anonymity on small cohorts)</p>
        <div className="intel-bars">
          {provinces.map(p => (
            <Bar key={p.province} label={p.province} sub={`n=${p.count} · distress ${p.avgDistress}`}
              score={p.avgDistress} share={p.distressShare} />
          ))}
          {!provinces.length && <p className="intel-muted">No geographic cells yet — needs the place gazetteer + more located transactions.</p>}
        </div>
        {areas.length > 0 && (
          <>
            <h3 className="intel-h3">Top towns</h3>
            <div className="intel-bars">
              {areas.slice(0, 12).map(a => (
                <Bar key={`${a.town}-${a.province}`} label={`${a.town}, ${a.province}`} sub={`n=${a.count} · distress ${a.avgDistress}`}
                  score={a.avgDistress} share={a.distressShare} />
              ))}
            </div>
          </>
        )}
      </section>

      {/* Employer risk — payroll-shock early warning */}
      {employerRisk?.employers?.length > 0 && (
        <section className="intel-section">
          <h2 className="intel-h2">Employer risk — payroll-shock early warning</h2>
          <p className="intel-muted">
            Employers whose workforce shows distress together (crosses suburb lines) — baseline {employerRisk.baselineDistressShare}% ·
            {' '}{employerRisk.flagged?.length || 0} flagged
          </p>
          <div className="intel-bars">
            {employerRisk.employers.slice(0, 10).map(e => (
              <Bar key={e.employer} label={`${e.employer}${e.flag ? ' ⚠' : ''}`}
                sub={`${e.employees} staff · z=${e.z}`} score={e.avgDistress} share={e.distressShare} />
            ))}
          </div>
        </section>
      )}

      {/* Fraud by area (AML) */}
      {fraudAreas.length > 0 && (
        <section className="intel-section">
          <h2 className="intel-h2">Fraud / AML — by area</h2>
          <p className="intel-muted">Share of accounts with elevated/high fraud signals per area</p>
          {fraudTypologies.length > 0 && (
            <p className="intel-muted">
              Typologies detected:{' '}
              {fraudTypologies.map(t => `${t.typology.replace(/_/g, ' ')} (${t.count})`).join(' · ')}
            </p>
          )}
          <div className="intel-bars">
            {fraudAreas.slice(0, 12).map(f => (
              <Bar key={`fraud-${f.town}-${f.province}`} label={`${f.town}, ${f.province}`}
                sub={`n=${f.count} · ${f.fraudRate}% flagged`} score={f.avgFraud} share={f.fraudRate} />
            ))}
          </div>
        </section>
      )}

      {/* Model health */}
      {health && <ModelHealth health={health} />}

      {/* Calibration / provenance */}
      <footer className="intel-foot">
        <div><span>Synthetic home-area accuracy</span><strong>{calibration?.syntheticHomeAreaAccuracyPct}% (n={calibration?.syntheticEvaluable})</strong></div>
        <div><span>Real-data geo coverage</span><strong>{calibration?.realGeoCoverage?.located}/{calibration?.realGeoCoverage?.total}</strong></div>
        <div><span>Gazetteer entries</span><strong>{inputs?.gazetteerEntries}</strong></div>
        <div><span>Employer-directory entries</span><strong>{inputs?.employerDirEntries}</strong></div>
        <div><span>Suppressed (k-anon)</span><strong>sector {heatmaps?.meta?.suppressed?.bySector} · prov {heatmaps?.meta?.suppressed?.byProvince}</strong></div>
      </footer>
    </div>
  );
}
