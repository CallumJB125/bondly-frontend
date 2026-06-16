import { useState, useEffect, useRef } from 'react';
import './StatementLoader.css';

// Humour lives in the cycling caption below, not in the visual chrome.
// Keep these short, dry, and slightly self-deprecating — the brief is
// "professional with a wink", not "anthropomorphised AI".
const MESSAGES = [
  'Reading your transactions…',
  'Spotting your salary…',
  'Quietly judging your coffee spend…',
  'Counting the subscriptions you forgot about…',
  'Checking the numbers twice…',
  'Cross-referencing recurring debits…',
  'Tallying the takeaways…',
  "Don't worry, we've seen worse…",
  'Almost done. One last pass…',
];

const STAGES = [
  { id: 1, label: 'Uploading'    },
  { id: 2, label: 'Reading'      },
  { id: 3, label: 'Categorising' },
];

// "Detections" appear one-by-one on the right of the document like real-time
// findings rather than confetti emoji. Plain monospaced text.
const FINDINGS = [
  { label: 'Salary',         value: 'detected',              delay: 4  },
  { label: 'Recurring debits', value: 'matched',             delay: 9  },
  { label: 'Groceries',      value: 'categorised',           delay: 14 },
  { label: 'Subscriptions',  value: 'flagged',               delay: 20 },
  { label: 'Bond / rent',    value: 'logged',                delay: 26 },
  { label: 'Discretionary',  value: 'profiled',              delay: 33 },
];

function fakeProgress(secs) {
  if (secs < 6)  return Math.round((secs / 6) * 28);
  if (secs < 65) return Math.round(28 + ((secs - 6) / 59) * 58);
  return Math.min(93, 86 + (secs - 65) * 0.1);
}

export default function StatementLoader({ slow = false, progressMessage = null }) {
  const [msgIdx, setMsgIdx]     = useState(0);
  const [fade, setFade]         = useState(true);
  const [elapsed, setElapsed]   = useState(0);
  const [revealed, setRevealed] = useState([]);
  const startRef = useRef(Date.now());

  useEffect(() => {
    const iv = setInterval(() => {
      setFade(false);
      setTimeout(() => { setMsgIdx(i => (i + 1) % MESSAGES.length); setFade(true); }, 280);
    }, 3400);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const iv = setInterval(() => {
      setElapsed(Math.floor((Date.now() - startRef.current) / 1000));
    }, 500);
    return () => clearInterval(iv);
  }, []);

  useEffect(() => {
    const timers = FINDINGS.map(f =>
      setTimeout(() => setRevealed(prev => prev.includes(f.label) ? prev : [...prev, f.label]), f.delay * 1000)
    );
    return () => timers.forEach(clearTimeout);
  }, []);

  const stage    = elapsed < 8 ? 1 : elapsed < 65 ? 2 : 3;
  const progress = fakeProgress(elapsed);
  const caption  = progressMessage || MESSAGES[msgIdx];

  return (
    <div className="stmt-loader" role="status" aria-live="polite">

      {/* Stage rail */}
      <div className="stmt-loader__stages">
        {STAGES.map((s, i) => (
          <div key={s.id} className="stmt-loader__stage-wrap">
            <div className={`stmt-loader__stage-dot ${stage > s.id ? 'done' : stage === s.id ? 'active' : ''}`}>
              {stage > s.id ? (
                <svg width="10" height="10" viewBox="0 0 16 16" aria-hidden="true"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              ) : (
                <span>{s.id}</span>
              )}
            </div>
            <span className={`stmt-loader__stage-label ${stage >= s.id ? 'stmt-loader__stage-label--active' : ''}`}>
              {s.label}
            </span>
            {i < STAGES.length - 1 && (
              <div className={`stmt-loader__stage-line ${stage > s.id ? 'done' : ''}`} />
            )}
          </div>
        ))}
      </div>

      {/* Centerpiece: a clean SVG bank statement with a horizontal scan line
          travelling over it. Says "real document processing" rather than
          "bouncing AI mascot". */}
      <div className="stmt-loader__doc">
        <svg viewBox="0 0 220 280" className="stmt-loader__doc-svg" aria-hidden="true">
          <defs>
            <linearGradient id="stmtScan" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%"   stopColor="rgba(30,58,95,0)" />
              <stop offset="50%"  stopColor="rgba(30,58,95,0.55)" />
              <stop offset="100%" stopColor="rgba(30,58,95,0)" />
            </linearGradient>
          </defs>
          {/* Paper */}
          <rect x="14" y="10" width="192" height="260" rx="6" fill="#fff" stroke="rgba(15,26,36,0.10)" strokeWidth="1.5" />
          {/* Folded corner */}
          <path d="M196 10 L206 20 L196 20 Z" fill="rgba(15,26,36,0.07)" />
          {/* Header band */}
          <rect x="14" y="10" width="192" height="34" fill="rgba(30,58,95,0.10)" />
          <rect x="26" y="22" width="68" height="6"  rx="3" fill="rgba(15,26,36,0.45)" />
          <rect x="26" y="32" width="40" height="4"  rx="2" fill="rgba(15,26,36,0.22)" />
          {/* Statement rows */}
          {Array.from({ length: 10 }).map((_, i) => (
            <g key={i}>
              <rect x="26" y={58 + i * 18} width={88 - (i % 3) * 12} height="4" rx="2" fill="rgba(15,26,36,0.18)" />
              <rect x="158" y={58 + i * 18} width="36" height="4" rx="2" fill="rgba(15,26,36,0.28)" />
            </g>
          ))}
          {/* Scan line — animated via CSS keyframes on the parent class */}
          <rect x="14" y="0" width="192" height="38" fill="url(#stmtScan)" className="stmt-loader__doc-scan" />
        </svg>
      </div>

      {/* Findings strip — calm monospaced "audit log" feel */}
      {revealed.length > 0 && (
        <ul className="stmt-loader__findings">
          {FINDINGS.filter(f => revealed.includes(f.label)).map(f => (
            <li key={f.label} className="stmt-loader__finding">
              <span className="stmt-loader__finding-tick" aria-hidden="true">
                <svg width="10" height="10" viewBox="0 0 16 16"><path d="M3 8.5l3 3 7-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg>
              </span>
              <span className="stmt-loader__finding-label">{f.label}</span>
              <span className="stmt-loader__finding-dots" aria-hidden="true" />
              <span className="stmt-loader__finding-value">{f.value}</span>
            </li>
          ))}
        </ul>
      )}

      {/* Progress bar */}
      <div className="stmt-loader__bar" aria-hidden="true">
        <div className="stmt-loader__bar-fill" style={{ width: `${progress}%` }} />
      </div>
      <div className="stmt-loader__pct">
        <span>{progress}%</span>
        <span className="stmt-loader__elapsed">· {Math.floor(elapsed / 60).toString().padStart(2, '0')}:{(elapsed % 60).toString().padStart(2, '0')}</span>
      </div>

      {/* Cycling caption — the only place the humour lives */}
      <div className={`stmt-loader__msg ${fade ? 'stmt-loader__msg--in' : 'stmt-loader__msg--out'}`}>
        {caption}
      </div>

      {slow && (
        <p className="stmt-loader__slow">Scanned PDFs take 2–3 min to process — keep this page open</p>
      )}
    </div>
  );
}
