import { useEffect, useRef } from 'react';

/**
 * useAdminEventStream — opens an authenticated SSE connection to
 * /api/admin/events and dispatches each typed message to onEvent(type, data).
 *
 * Auto-reconnects on disconnect with exponential backoff (capped at 30s).
 * Cleans up on unmount. Token is read from localStorage at connect time;
 * if the admin signs out and back in, the page reloads so this picks up
 * the new token without us needing to re-watch it.
 */
export default function useAdminEventStream(onEvent) {
  const cbRef     = useRef(onEvent);
  const esRef     = useRef(null);
  const retryRef  = useRef(0);
  cbRef.current = onEvent;

  useEffect(() => {
    let cancelled = false;
    function open() {
      if (cancelled) return;
      const token = localStorage.getItem('bondly_token') || '';
      // EventSource doesn't let us set headers, so pass token as a query arg —
      // the server accepts both. (When auth is fully cookie-based this is moot.)
      const url = '/api/admin/events?token=' + encodeURIComponent(token);
      let es;
      try { es = new EventSource(url, { withCredentials: true }); } catch { return; }
      esRef.current = es;
      es.onopen = () => { retryRef.current = 0; };
      es.onmessage = (ev) => {
        try {
          const payload = JSON.parse(ev.data || '{}');
          cbRef.current?.(payload.type || 'event', payload);
        } catch {/* ignore malformed */}
      };
      es.addEventListener('hello', () => {});
      es.onerror = () => {
        try { es.close(); } catch {}
        if (cancelled) return;
        retryRef.current = Math.min(30_000, 1000 * Math.pow(2, retryRef.current ? Math.log2(retryRef.current / 1000) + 1 : 0));
        const delay = retryRef.current || 1000;
        setTimeout(open, delay);
      };
    }
    open();
    return () => {
      cancelled = true;
      try { esRef.current?.close(); } catch {}
    };
  }, []);
}
