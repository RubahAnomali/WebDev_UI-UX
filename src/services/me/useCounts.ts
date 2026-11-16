import { useEffect, useState } from 'react';
import { http } from '../api/client';
import { useAuth } from '../auth/AuthContext';

export interface Counts {
  unreadConversations: number;
  newRequests: number;
  unreadNotifications: number;
}

const EMPTY: Counts = { unreadConversations: 0, newRequests: 0, unreadNotifications: 0 };
const listeners = new Set<() => void>();

/** Ask every mounted header badge to refresh (e.g. after reading a conversation). */
export function refreshCounts() {
  listeners.forEach((fn) => fn());
}

/** Header badge counts, polled every 30 s while signed in and the tab is visible. */
export function useCounts(): Counts {
  const { user, service } = useAuth();
  const [counts, setCounts] = useState<Counts>(EMPTY);
  const enabled = Boolean(user) && !service.isDemo;

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    const load = () => {
      if (document.visibilityState === 'hidden') return;
      http
        .get<Counts>('/api/me/counts')
        .then((c) => active && setCounts(c))
        .catch(() => undefined);
    };
    load();
    const id = window.setInterval(load, 30_000);
    listeners.add(load);
    document.addEventListener('visibilitychange', load);
    return () => {
      active = false;
      window.clearInterval(id);
      listeners.delete(load);
      document.removeEventListener('visibilitychange', load);
    };
  }, [enabled]);

  return enabled ? counts : EMPTY;
}
