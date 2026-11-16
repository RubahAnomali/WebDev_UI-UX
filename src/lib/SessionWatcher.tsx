import { useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../services/auth/AuthContext';
import { ROUTES } from './routes';

const AUTH_PAGES = [ROUTES.login, ROUTES.register, ROUTES.verifyEmail, ROUTES.forgotPassword, ROUTES.resetPassword];

/** When the API ends a session mid-visit, send the person to log in (Figma 22 "session expired"). */
export function SessionWatcher() {
  const { sessionExpired, clearSessionExpired } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    if (!sessionExpired) return;
    clearSessionExpired();
    if ((AUTH_PAGES as string[]).includes(location.pathname)) return;
    const next = encodeURIComponent(location.pathname + location.search);
    navigate(`${ROUTES.login}?next=${next}`, { state: { notice: 'session-expired' } });
  }, [sessionExpired, clearSessionExpired, navigate, location]);

  return null;
}
