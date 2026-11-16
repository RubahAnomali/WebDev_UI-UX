import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { onUnauthorized } from '../api/client';
import { authService as defaultService } from './index';
import type { AuthService, LoginInput, User } from './types';

interface AuthContextValue {
  user: User | null;
  /** True after the API reported that an existing session ended. */
  sessionExpired: boolean;
  clearSessionExpired: () => void;
  setUser: (user: User | null) => void;
  status: 'loading' | 'ready';
  service: AuthService;
  login: (input: LoginInput) => Promise<User>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children, service = defaultService }: { children: ReactNode; service?: AuthService }) {
  const [user, setUser] = useState<User | null>(null);
  const [status, setStatus] = useState<'loading' | 'ready'>('loading');
  const [sessionExpired, setSessionExpired] = useState(false);

  // If an API call finds the session gone while we think we're signed in, end it in the UI.
  useEffect(
    () =>
      onUnauthorized(() => {
        setUser((current) => {
          if (current) setSessionExpired(true);
          return null;
        });
      }),
    [],
  );

  const refresh = useCallback(async () => {
    try {
      setUser(await service.getCurrentUser());
    } catch {
      setUser(null);
    } finally {
      setStatus('ready');
    }
  }, [service]);

  // Initial session check.
  useEffect(() => {
    let active = true;
    service
      .getCurrentUser()
      .then((u) => active && setUser(u))
      .catch(() => active && setUser(null))
      .finally(() => active && setStatus('ready'));
    return () => {
      active = false;
    };
  }, [service]);

  const login = useCallback(
    async (input: LoginInput) => {
      const u = await service.login(input);
      setSessionExpired(false);
      setUser(u);
      return u;
    },
    [service],
  );

  const logout = useCallback(async () => {
    await service.logout();
    setUser(null);
  }, [service]);

  const clearSessionExpired = useCallback(() => setSessionExpired(false), []);
  const value = useMemo(
    () => ({ user, status, service, login, logout, refresh, sessionExpired, clearSessionExpired, setUser }),
    [user, status, service, login, logout, refresh, sessionExpired, clearSessionExpired],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
