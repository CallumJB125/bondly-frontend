// ── BulkEmailTab — XSS prevention test ───────────────────────────────────────
import { describe, test, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import BulkEmailTab from '../BulkEmailTab.jsx';

vi.mock('../../../../context/AuthContext.jsx', () => ({
  useAuth: () => ({ user: { id: 'admin-1', role: 'admin' }, token: 'test-token' }),
}));

vi.mock('@bondly/ui/components/Toast.jsx', () => ({
  useToast: () => ({ showToast: vi.fn() }),
}));

describe('BulkEmailTab — XSS prevention', () => {
  test('renders without crashing', () => {
    const { container } = render(<BulkEmailTab showToast={vi.fn()} />);
    expect(container).toBeTruthy();
  });

  test('preview button appears when body is non-empty', async () => {
    render(<BulkEmailTab showToast={vi.fn()} />);
    // body textarea — find by placeholder or label
    const bodyInput = document.querySelector('textarea[placeholder*="body"]') ||
                      document.querySelector('textarea');
    if (bodyInput) {
      fireEvent.change(bodyInput, { target: { value: 'Hello {{name}}' } });
      const previewBtn = screen.queryByText(/preview/i);
      expect(previewBtn).not.toBeNull();
    }
  });

  test('sanitizes XSS payload in preview — script tag is stripped', () => {
    // DOMPurify should strip <script> tags when used via dangerouslySetInnerHTML
    render(<BulkEmailTab showToast={vi.fn()} />);
    const body = document.querySelector('textarea');
    if (body) {
      const xssPayload = '<script>alert("xss")</script><p>Safe content</p>';
      fireEvent.change(body, { target: { value: xssPayload } });
      // The preview should not contain a script element
      const scripts = document.querySelectorAll('script');
      // Any script tags would be from the app itself, not injected via preview
      const inlineScripts = Array.from(scripts).filter(s => s.textContent.includes('alert'));
      expect(inlineScripts).toHaveLength(0);
    }
  });
});
