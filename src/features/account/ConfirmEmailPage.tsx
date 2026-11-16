import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { AppPage } from '../../components/layout/AppPage';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Spinner } from '../../components/ui/Spinner';
import { ROUTES } from '../../lib/routes';
import { accountService } from '../../services/account/accountService';
import { ApiRequestError } from '../../services/api/client';
import { useAuth } from '../../services/auth/AuthContext';

/** Confirms an email change from the link sent to the new address. */
export function ConfirmEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const { refresh } = useAuth();
  const [state, setState] = useState<{ kind: 'working' } | { kind: 'done'; email: string } | { kind: 'error'; message: string }>(
    token ? { kind: 'working' } : { kind: 'error', message: 'This link is missing its token.' },
  );
  const ran = useRef(false);

  useEffect(() => {
    if (!token || ran.current) return;
    ran.current = true;
    accountService
      .confirmEmail(token)
      .then((r) => {
        setState({ kind: 'done', email: r.email });
        void refresh();
      })
      .catch((err) => setState({ kind: 'error', message: err instanceof ApiRequestError ? err.message : 'We couldn’t confirm your email.' }));
  }, [token, refresh]);

  return (
    <AppPage title="Confirm your new email." width="narrow">
      {state.kind === 'working' && <Spinner size={32} label="Confirming your email" />}
      {state.kind === 'done' && (
        <EmptyState title="Your email is updated." text={`From now on, Pawhaven will use ${state.email}.`} action={<Button to={ROUTES.account}>Back to your account</Button>} />
      )}
      {state.kind === 'error' && (
        <EmptyState title="This link didn’t work." text={state.message} action={<Button to={ROUTES.account}>Back to your account</Button>} />
      )}
    </AppPage>
  );
}
