import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SPA scroll behaviour: scroll to `#hash` targets (e.g. /#how-it-works or a
 * pet card after logging in), waiting briefly for content that loads
 * asynchronously; otherwise reset to the top on page changes.
 */
export function ScrollManager() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (!hash) {
      window.scrollTo(0, 0);
      return;
    }
    const id = decodeURIComponent(hash.slice(1));
    let raf = 0;
    const started = performance.now();

    const tryScroll = () => {
      const el = document.getElementById(id);
      if (el) {
        const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
        el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
        if (el.hasAttribute('tabindex')) el.focus({ preventScroll: true });
        return;
      }
      // Content such as pet cards may still be loading; keep looking for up to 3 s.
      if (performance.now() - started < 3000) raf = requestAnimationFrame(tryScroll);
    };
    raf = requestAnimationFrame(tryScroll);
    return () => cancelAnimationFrame(raf);
  }, [pathname, hash, key]);

  return null;
}
