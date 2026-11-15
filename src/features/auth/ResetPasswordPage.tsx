import { useEffect, useState, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { PasswordField } from '../../components/ui/PasswordField';
import { PasswordStrength } from '../../components/ui/PasswordStrength';
import { Spinner } from '../../components/ui/Spinner';
import { ROUTES } from '../../lib/routes';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { useAuth } from '../../services/auth/AuthContext';
import { AuthError } from '../../services/auth/types';
import { hasErrors, validateReset, type FieldErrors, type ResetValues } from './validation';
import styles from './AuthPage.module.css';

type TokenStatus = 'checking' | 'valid' | 'expired' | 'invalid';

/** Figma 14:35 — Reset password. */
export function ResetPasswordPage() {
  useDocumentTitle('Reset password');
  const { service, logout } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const [tokenStatus, setTokenStatus] = useState<TokenStatus>(token ? 'checking' : 'invalid');
  const [values, setValues] = useState<ResetValues>({ password: '', confirm: '' });
  const [errors, setErrors] = useState<FieldErrors<keyof ResetValues>>({});
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let active = true;
    service
      .checkResetToken(token)
      .then(() => active && setTokenStatus('valid'))
      .catch((err) => active && setTokenStatus(err instanceof AuthError && err.code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid'));
    return () => {
      active = false;
    };
  }, [service, token]);

  function update<K extends keyof ResetValues>(key: K, value: string) {
    const next = { ...values, [key]: value };
    setValues(next);
    if (attempted) setErrors(validateReset(next));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setFormError(null);
    const found = validateReset(values);
    setErrors(found);
    if (hasErrors(found)) {
      document.getElementById(found.password ? 'reset-password' : 'reset-confirm')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await service.resetPassword(token, values.password);
      await logout();
      navigate(ROUTES.login, { replace: true, state: { notice: 'password-reset' } });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof AuthError && (err.code === 'TOKEN_EXPIRED' || err.code === 'TOKEN_INVALID')) {
        setTokenStatus(err.code === 'TOKEN_EXPIRED' ? 'expired' : 'invalid');
        return;
      }
      setFormError('We couldn’t reset your password just now. Please try again.');
    }
  }

  if (tokenStatus === 'checking') {
    return (
      <AuthLayout>
        <h1 className={styles.title}>Checking your link…</h1>
        <div className={styles.center}>
          <Spinner size={32} label="Checking your reset link" />
        </div>
      </AuthLayout>
    );
  }

  if (tokenStatus === 'expired' || tokenStatus === 'invalid') {
    return (
      <AuthLayout>
        <header>
          <h1 className={styles.title}>{tokenStatus === 'expired' ? 'This link has expired.' : 'This link isn’t valid.'}</h1>
          <p className={styles.body}>
            {tokenStatus === 'expired'
              ? 'For your security, reset links last 30 minutes. Request a new one to continue.'
              : 'Reset links can only be used once, and a newer link replaces older ones. Request a new link to continue.'}
          </p>
        </header>
        <div className={styles.stack}>
          <Button to={ROUTES.forgotPassword} block size="lg">
            Request a new link
          </Button>
        </div>
        <Link to={ROUTES.login} className={styles.backLink}>
          <Icon name="arrowLeft" size={16} />
          Back to log in
        </Link>
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <header className={styles.header}>
        <h1 className={styles.title}>Let’s make it secure.</h1>
        <p className={styles.subtitle}>Choose a new password for your account.</p>
      </header>

      {formError && (
        <Alert tone="error" className={styles.alert}>
          {formError}
        </Alert>
      )}

      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Choose a new password">
        <PasswordField
          id="reset-password"
          label="New password"
          name="new-password"
          autoComplete="new-password"
          value={values.password}
          onChange={(e) => update('password', e.target.value)}
          error={errors.password}
          after={<PasswordStrength password={values.password} showMeter={false} />}
          required
        />
        <PasswordField
          id="reset-confirm"
          label="Confirm new password"
          name="confirm-password"
          autoComplete="new-password"
          value={values.confirm}
          onChange={(e) => update('confirm', e.target.value)}
          error={errors.confirm}
          after={<PasswordStrength password={values.password} showRules={false} />}
          required
        />
        <Button type="submit" block size="lg" loading={submitting} loadingText="Saving…" className={styles.submit}>
          Reset password
        </Button>
      </form>

      <Link to={ROUTES.login} className={styles.backLink}>
        <Icon name="arrowLeft" size={16} />
        Back to log in
      </Link>
    </AuthLayout>
  );
}
