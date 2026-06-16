import { useEffect } from 'react';
import './RatesExplained.css';

/**
 * Reusable "What do these rates mean?" modal.
 *
 * Surfaced from anywhere a rate appears (Hook, Tools, Optimize, Dashboard).
 * Plain-English explainer for SA users: SARB → repo → prime → quoted bond
 * rate → stress rate. No jargon without a definition.
 *
 * Props:
 *   open       — boolean, controls visibility
 *   onClose    — callback when user dismisses
 *   primeRate  — current prime rate (number, e.g. 11.25)
 *   stressRate — current stress rate (number, e.g. 13.25). Optional;
 *                derived as prime + 2 when missing.
 *   lastChanged— ISO date string of last prime move. Optional.
 */
export default function RatesExplained({ open, onClose, primeRate, stressRate, lastChanged }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => { if (e.key === 'Escape') onClose?.(); };
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!open) return null;

  const prime  = Number(primeRate)  || 11.25;
  const stress = Number(stressRate) || (prime + 2);
  const repo   = Math.round((prime - 3.5) * 100) / 100;
  const lastChangedHuman = lastChanged
    ? new Date(lastChanged).toLocaleDateString('en-ZA', { day: 'numeric', month: 'short', year: 'numeric' })
    : null;

  return (
    <div className="rates-modal" role="dialog" aria-modal="true" aria-labelledby="rates-modal-title" onClick={onClose}>
      <div className="rates-modal__panel" onClick={(e) => e.stopPropagation()}>
        <button className="rates-modal__close" onClick={onClose} aria-label="Close">×</button>
        <h2 id="rates-modal-title" className="rates-modal__title">How home-loan rates work in South Africa</h2>

        <ol className="rates-modal__steps">
          <li>
            <strong>SARB sets the repo rate.</strong>
            <p>
              The South African Reserve Bank's Monetary Policy Committee meets every two months and votes on the <em>repo rate</em> — the rate at which commercial banks borrow money overnight from SARB. Right now: <strong>{repo.toFixed(2)}%</strong>.
            </p>
          </li>
          <li>
            <strong>Banks set "prime" at repo + 3.5%.</strong>
            <p>
              By long-standing convention, all major SA banks quote their <em>prime lending rate</em> as repo + 3.5 percentage points. When SARB cuts or hikes the repo, prime moves the same amount, the same week. Today's prime: <strong>{prime.toFixed(2)}%</strong>{lastChangedHuman ? <> (last changed {lastChangedHuman})</> : null}.
            </p>
          </li>
          <li>
            <strong>Your bond rate is quoted as prime ± a spread.</strong>
            <p>
              Banks compete for borrowers by adjusting the spread. Strong credit + large bond + good loan-to-value can earn you a rate <em>below</em> prime (e.g. prime – 0.5% = {(prime - 0.5).toFixed(2)}%). Higher risk, smaller bond, or first-time buyers usually pay prime + something (e.g. prime + 1% = {(prime + 1).toFixed(2)}%).
            </p>
          </li>
          <li>
            <strong>The 13.25% "stress rate" is for affordability only.</strong>
            <p>
              When a bank decides whether you <em>qualify</em> for a bond, they assume rates rise by 2% above prime — a stress test against future hikes. So your monthly affordability is calculated at <strong>{stress.toFixed(2)}%</strong> even though your actual instalment uses your real (lower) quoted rate. This is why your max-qualifying bond is smaller than the bond your stated income would suggest.
            </p>
          </li>
        </ol>

        <div className="rates-modal__quickref">
          <h3>Quick reference (today)</h3>
          <dl>
            <div><dt>SARB repo rate</dt><dd>{repo.toFixed(2)}%</dd></div>
            <div><dt>Prime (banks)</dt><dd>{prime.toFixed(2)}%</dd></div>
            <div><dt>Stress rate (affordability)</dt><dd>{stress.toFixed(2)}%</dd></div>
            {lastChangedHuman && (
              <div><dt>Prime last changed</dt><dd>{lastChangedHuman}</dd></div>
            )}
          </dl>
        </div>

        <p className="rates-modal__foot">
          We update these numbers automatically when SARB moves and an admin
          confirms the change. If something looks wrong, please tell us.
        </p>
      </div>
    </div>
  );
}
