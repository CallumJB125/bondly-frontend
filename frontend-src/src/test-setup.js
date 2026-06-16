// ── Test setup for Vitest + React Testing Library ─────────────────────────────
import { vi } from 'vitest';

// jsdom doesn't always wire localStorage — provide a simple in-memory stub
const _store = {};
const localStorageMock = {
  getItem: (k) => _store[k] ?? null,
  setItem: (k, v) => { _store[k] = String(v); },
  removeItem: (k) => { delete _store[k]; },
  clear: () => { Object.keys(_store).forEach(k => delete _store[k]); },
};
Object.defineProperty(globalThis, 'localStorage', { value: localStorageMock, writable: true });

// Auto-mock api calls so tests don't need a real backend
vi.mock('./lib/api.js', () => ({
  admin: {
    customers: vi.fn().mockResolvedValue({ data: [] }),
    leads: vi.fn().mockResolvedValue({ data: [] }),
    stats: vi.fn().mockResolvedValue({ data: {} }),
    claudeUsage: vi.fn().mockResolvedValue({ data: { usage: [], totalCost: 0 } }),
    swapApps: vi.fn().mockResolvedValue({ data: [] }),
    commissions: vi.fn().mockResolvedValue({ data: { commissions: [], totalReceived: 0, totalPending: 0 } }),
    kycQueue: vi.fn().mockResolvedValue({ data: [] }),
    bulkEmailDry: vi.fn().mockResolvedValue({ data: { recipientCount: 0 } }),
    bulkEmailSend: vi.fn().mockResolvedValue({ data: { sent: 0 } }),
    settings: vi.fn().mockResolvedValue({ data: {} }),
    updateSetting: vi.fn().mockResolvedValue({ data: {} }),
    auditLog: vi.fn().mockResolvedValue({ data: { entries: [], total: 0 } }),
  },
  adminApi: {},
  adminAnalytics: {
    overview: vi.fn().mockResolvedValue({ data: {} }),
    funnels: vi.fn().mockResolvedValue({ data: [] }),
    sessions: vi.fn().mockResolvedValue({ data: { sessions: [], total: 0 } }),
    segments: vi.fn().mockResolvedValue({ data: [] }),
    insights: vi.fn().mockResolvedValue({ data: [] }),
    retention: vi.fn().mockResolvedValue({ data: [] }),
    experiments: vi.fn().mockResolvedValue({ data: [] }),
    refreshInsights: vi.fn().mockResolvedValue({ data: { content: '' } }),
  },
  auth: {
    login: vi.fn(),
    logout: vi.fn(),
    me: vi.fn(),
  },
  apiFetch: vi.fn().mockResolvedValue({}),
  default: vi.fn().mockResolvedValue({}),
}));
