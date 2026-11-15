import { useEffect, useRef } from 'react';

/**
 * Moves focus to the page heading when a view or step changes so screen
 * reader and keyboard users land at the start of the new content.
 */
export function useFocusHeading<T extends HTMLElement = HTMLHeadingElement>(key: unknown) {
  const ref = useRef<T>(null);
  const first = useRef(true);
  useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    ref.current?.focus();
  }, [key]);
  return ref;
}
