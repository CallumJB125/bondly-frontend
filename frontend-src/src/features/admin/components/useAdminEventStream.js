import { useEffect, useRef } from 'react';
import { adminApi } from '../../../lib/api.js';

/**
 * useAdminEventStream — opens an authenticated SSE connection to
 * /api/admin/events and dispatches each typed message to onEvent(type, data).
 *
 * Auto-reconnects on disconnect with exponential backoff (capped at 30s).
 * Cleans up on unmount. Token is read from localStorage at connect time;
 * if the admin signs out and back in, the page reloads so this picks up
 * the new token without us needing to re-watch it.
 */
export default function useAdminEventStream(onEvent, enabled = true) {
  const cbRef     = useRef(onEvent);
  const esRef     = useRef(null);
  const retryRef  = useRef(0);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;        // e.g. read-only investors — no admin SSE
    let cancelled = false;
    async function open() {
      if (cancelled) return;
      // EventSource can't set Authorization headers, so we mint a short-lived,
      // single-use ticket via an authenticated POST and pass THAT in the URL —
      // the admin JWT itself never lands in a URL / access log / Referer.
      let ticket;
      try { ticket = (await adminApi.sseTicket())?.ticket; } catch { /* fall through to retry */ }
      if (cancelled) return;
      if (!ticket) {
        retryRef.current = Math.min(30_000, (retryRef.current || 1000) * 2);
        setTimeout(open, retryRef.current);
        return;
      }
      const url = '/api/admin/events?ticket=' + encodeURIComponent(ticket);
      let es;
      try { es = new EventSource(url); } catch { return; }
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
  }, [enabled]);
}
