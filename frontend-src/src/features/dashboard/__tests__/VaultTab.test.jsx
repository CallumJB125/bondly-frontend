// ── VaultTab regression tests ─────────────────────────────────────────────────
// Guards the "React error #31" crash: statement snapshot `optimizations` arrive
// as rich objects ({ title, action, bondLine, ... }) from the advice engine, and
// rendering them as raw React children crashes the Docs/Vault tab. These tests
// fail in CI instead of on a phone if that ever regresses.
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { ToastProvider } from '@bondly/ui/components/Toast.jsx';

let mockSnapshots = [];
let mockDocs = [];

vi.mock('../../../lib/api.js', () => ({
  documents: { list: () => Promise.resolve(mockDocs) },
  financialFitness: { getSnapshots: () => Promise.resolve({ snapshots: mockSnapshots }) },
}));

// Imported after the mock so the component picks up the mocked module.
const { default: VaultTab } = await import('../VaultTab.jsx');

const OBJECT_SNAPSHOTS = [
  {
    id: 's1', uploadedAt: '2026-05-01', statementMonths: 3,
    readiness: { score: 72 }, qualification: { maxBond: 1450000, zone: 'green' },
    optimizations: [
      { type: 'subscription', title: 'Cancel unused DSTV', action: 'Cancel DSTV Premium', bondLine: 'Frees R899/mo', description: 'You pay R899/mo', monthlySaving: 899 },
    ],
  },
  {
    id: 's2', uploadedAt: '2026-06-01', statementMonths: 3,
    readiness: { score: 78 }, qualification: { maxBond: 1600000, zone: 'amber' },
    optimizations: [
      { type: 'debt', title: 'Settle store card', action: 'Pay off Edgars', monthlySaving: 450 },
      { type: 'fee', title: 'Switch to cheaper bank account', monthlySaving: 120 },
    ],
  },
];

const wrapper = ({ children }) => <ToastProvider>{children}</ToastProvider>;

describe('VaultTab', () => {
  beforeEach(() => { mockDocs = []; mockSnapshots = []; });

  test('renders object-shaped snapshot optimizations without crashing (React #31 guard)', async () => {
    mockSnapshots = OBJECT_SNAPSHOTS;
    render(<VaultTab />, { wrapper });
    await waitFor(() => {
      // The optimisation OBJECT must be resolved to its title, not rendered raw.
      expect(document.body.textContent).toMatch(/Cancel unused DSTV/);
    });
    expect(document.body.textContent).toMatch(/Statement History/);
    // [object Object] is the tell-tale sign of a raw object slipping through.
    expect(document.body.textContent).not.toMatch(/\[object Object\]/);
  });

  test('still renders legacy string optimizations', async () => {
    mockSnapshots = [{ ...OBJECT_SNAPSHOTS[0], optimizations: ['Reduce DSTV spend'] }];
    render(<VaultTab />, { wrapper });
    await waitFor(() => {
      expect(document.body.textContent).toMatch(/Reduce DSTV spend/);
    });
  });
});
