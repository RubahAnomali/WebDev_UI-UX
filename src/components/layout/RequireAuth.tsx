import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';
import { useAuth } from '../../services/auth/AuthContext';
import type { Role } from '../../services/auth/types';
import { Spinner } from '../ui/Spinner';
import { PageShell } from './PageShell';
import styles from './RequireAuth.module.css';

/**
 * Client-side guard for signed-in pages. This only shapes the UI — every API
 * route enforces authentication and authorization on the server.
 */
export function RequireAuth({ children, role }: { children: ReactNode; role?: Role }) {
  const { user, status, sessionExpired } = useAuth();
  const location = useLocation();

  if (status === 'loading') {
    return (
      <PageShell footer="compact">
        <div className={styles.center}>
          <Spinner size={32} label="Loading your account" />
        </div>
      </PageShell>
    );
  }

  if (!user) {
    const next = encodeURIComponent(location.pathname + location.search + location.hash);
    return <Navigate to={`${ROUTES.login}?next=${next}`} replace state={sessionExpired ? { notice: 'session-expired' } : undefined} />;
  }

  if (role && !user.roles.includes(role)) {
    return <Navigate to="/not-allowed" replace />;
  }

  return <>{children}</>;
}
