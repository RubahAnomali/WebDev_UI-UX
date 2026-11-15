import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

/**
 * SPA scroll behaviour: scroll to `#hash` targets (e.g. /#how-it-works),
 * otherwise reset to the top on page changes.
 */
export function ScrollManager() {
  const { pathname, hash, key } = useLocation();

  useEffect(() => {
    if (hash) {
      const id = decodeURIComponent(hash.slice(1));
      // Wait a frame so the target has rendered.
      const raf = requestAnimationFrame(() => {
        const el = document.getElementById(id);
        if (el) {
          const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
          el.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' });
          if (el.tabIndex >= -1 && el.hasAttribute('tabindex')) el.focus({ preventScroll: true });
        }
      });
      return () => cancelAnimationFrame(raf);
    }
    window.scrollTo(0, 0);
  }, [pathname, hash, key]);

  return null;
}
