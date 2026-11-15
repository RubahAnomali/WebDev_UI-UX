import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { authService as defaultService } from './index';
import type { AuthService, LoginInput, User } from './types';

interface AuthContextValue {
  user: User | null;
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

  const refresh = useCallback(async () => {
    try {
      setUser(await service.getCurrentUser());
    } finally {
      setStatus('ready');
    }
  }, [service]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const login = useCallback(
    async (input: LoginInput) => {
      const u = await service.login(input);
      setUser(u);
      return u;
    },
    [service],
  );

  const logout = useCallback(async () => {
    await service.logout();
    setUser(null);
  }, [service]);

  const value = useMemo(() => ({ user, status, service, login, logout, refresh }), [user, status, service, login, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
