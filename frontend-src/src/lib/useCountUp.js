import { useEffect, useRef, useState } from 'react';

const prefersReduced = () =>
  typeof window !== 'undefined'
  && window.matchMedia
  && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

export function useCountUp(target, duration = 800, enabled = true) {
  const [value, setValue] = useState(0);
  const rafRef = useRef(null);

  useEffect(() => {
    if (!enabled || target == null) return;
    if (prefersReduced()) { setValue(target); return; }
    const start = performance.now();

    function tick(now) {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const eased = 1 - Math.pow(1 - progress, 3);
      setValue(Math.max(0, Math.round(eased * target)));
      if (progress < 1) rafRef.current = requestAnimationFrame(tick);
    }
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [target, duration, enabled]);

  return value;
}

/**
 * Count up to `target` exactly ONCE, the first time the returned ref's
 * element scrolls into view. After it fires it holds the final value forever
 * — never loops, never resets. Respects prefers-reduced-motion (jumps
 * straight to the final number). Returns [ref, value].
 *
 * Use for credible static figures that should feel alive on first reveal
 * but must not tick continuously like a fake live counter.
 */
export function useCountUpOnView(target, duration = 1400) {
  const [value, setValue] = useState(0);
  const ref = useRef(null);
  const rafRef = useRef(null);
  const firedRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || firedRef.current) return;

    const run = () => {
      if (firedRef.current) return;
      firedRef.current = true;
      if (prefersReduced() || !target) { setValue(target); return; }
      const start = performance.now();
      const tick = (now) => {
        const t = Math.min((now - start) / duration, 1);
        const eased = 1 - Math.pow(1 - t, 4); // easeOutQuart — calm, never bouncy
        setValue(Math.max(0, Math.round(eased * target)));
        if (t < 1) rafRef.current = requestAnimationFrame(tick);
      };
      rafRef.current = requestAnimationFrame(tick);
    };

    if (typeof IntersectionObserver === 'undefined') { run(); return; }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { run(); io.disconnect(); } });
    }, { threshold: 0.35 });
    io.observe(el);

    return () => { io.disconnect(); cancelAnimationFrame(rafRef.current); };
  }, [target, duration]);

  return [ref, value];
}
