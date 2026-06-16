// TEMP design-preview mount for StatementVerdict. Safe to delete.
// Pulls in the real token + base stylesheets so the component renders in context.
import React from 'react';
import { createRoot } from 'react-dom/client';
import '@bondly/ui/styles/tokens.css';
import '@bondly/ui/styles/base.css';
import StatementVerdict, { DEMO_RESULT } from './features/dashboard/StatementVerdict.jsx';

// Second scenario: no existing bond → max-bond fallback hero.
const NO_BOND = {
  ...DEMO_RESULT,
  existingMortgage: { detected: false },
  savings: null,
  readiness: { ...DEMO_RESULT.readiness, score: 48 },
};

function Preview() {
  return (
    <div style={{ display: 'flex', gap: 32, flexWrap: 'wrap', justifyContent: 'center' }}>
      <div>
        <h3 style={{ textAlign: 'center', fontFamily: 'Inter', color: 'var(--text-secondary)' }}>
          Existing bond → savings hero
        </h3>
        <StatementVerdict result={DEMO_RESULT} onPrimaryCta={() => alert('switch plan')} />
      </div>
      <div>
        <h3 style={{ textAlign: 'center', fontFamily: 'Inter', color: 'var(--text-secondary)' }}>
          No bond → qualify hero
        </h3>
        <StatementVerdict result={NO_BOND} onPrimaryCta={() => alert('qualify plan')} />
      </div>
    </div>
  );
}

createRoot(document.getElementById('root')).render(<Preview />);
