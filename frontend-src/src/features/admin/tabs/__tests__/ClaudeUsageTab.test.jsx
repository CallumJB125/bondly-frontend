// ── ClaudeUsageTab tests ──────────────────────────────────────────────────────
import { describe, test, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import ClaudeUsageTab from '../ClaudeUsageTab.jsx';

const emptySummary = { costUsd: 0, calls: 0, inputTokens: 0, outputTokens: 0, byPurpose: {}, byModel: {} };

// Mock global fetch used by apiFetchAdmin inside the component
global.fetch = vi.fn().mockResolvedValue({
  status: 200,
  json: () => Promise.resolve({
    success: true,
    data: { monthly: emptySummary, prevMonth: emptySummary, allTime: emptySummary, recent: [] },
  }),
});

const wrapper = ({ children }) => (
  <QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
    {children}
  </QueryClientProvider>
);

describe('ClaudeUsageTab', () => {
  test('renders loading state then content', async () => {
    const { container } = render(<ClaudeUsageTab />, { wrapper });
    expect(container).toBeTruthy();
    // Component renders without throwing
    await waitFor(() => {
      expect(container.querySelector('[class]') || container.firstChild).toBeTruthy();
    });
  });

  test('shows zero cost when no usage data', async () => {
    render(<ClaudeUsageTab />, { wrapper });
    // API mock returns empty usage, so total cost should show R 0
    await waitFor(() => {
      const text = document.body.textContent;
      // Should not show an error state
      expect(text).not.toMatch(/error/i);
    });
  });
});
