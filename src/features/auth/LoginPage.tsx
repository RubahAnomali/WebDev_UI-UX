import { useState, type FormEvent } from 'react';
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Checkbox } from '../../components/ui/Checkbox';
import { PasswordField } from '../../components/ui/PasswordField';
import { TextField } from '../../components/ui/TextField';
import { ROUTES } from '../../lib/routes';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { useAuth } from '../../services/auth/AuthContext';
import { AuthError } from '../../services/auth/types';
import { setPendingSignup } from './pendingSignup';
import { hasErrors, safeRedirectPath, validateLogin, type FieldErrors, type LoginValues } from './validation';
import styles from './AuthPage.module.css';

export type LoginNotice = 'password-reset' | 'email-verified' | 'session-expired' | 'signed-out';

const NOTICES: Record<LoginNotice, { tone: 'success' | 'info'; title: string; body: string }> = {
  'password-reset': {
    tone: 'success',
    title: 'A fresh start, secured.',
    body: 'Your password has been reset. Log in with your new password to continue.',
  },
  'email-verified': { tone: 'success', title: 'Your email is verified.', body: 'Log in to start exploring.' },
  'session-expired': {
    tone: 'info',
    title: 'Your session has expired.',
    body: 'Log in again to continue securely.',
  },
  'signed-out': { tone: 'info', title: 'You’re logged out.', body: 'See you again soon.' },
};

export function LoginPage() {
  useDocumentTitle('Log in');
  const { user, login, status } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [params] = useSearchParams();
  const next = safeRedirectPath(params.get('next'));
  const notice = (location.state as { notice?: LoginNotice } | null)?.notice;

  const [values, setValues] = useState<LoginValues>({
    email: (location.state as { email?: string } | null)?.email ?? '',
    password: '',
  });
  const [remember, setRemember] = useState(false);
  const [errors, setErrors] = useState<FieldErrors<keyof LoginValues>>({});
  const [attempted, setAttempted] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  if (status === 'ready' && user && !submitting) return <Navigate to={next} replace />;

  function update<K extends keyof LoginValues>(key: K, value: LoginValues[K]) {
    const nextValues = { ...values, [key]: value };
    setValues(nextValues);
    if (attempted) setErrors(validateLogin(nextValues));
  }

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setFormError(null);
    const found = validateLogin(values);
    setErrors(found);
    if (hasErrors(found)) {
      document.getElementById(found.email ? 'login-email' : 'login-password')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await login({ email: values.email.trim(), password: values.password, remember });
      navigate(next, { replace: true });
    } catch (err) {
      setSubmitting(false);
      if (err instanceof AuthError && err.code === 'EMAIL_NOT_VERIFIED') {
        setPendingSignup({ email: values.email.trim().toLowerCase() });
        navigate(ROUTES.verifyEmail, { state: { reason: 'login' } });
        return;
      }
      setFormError(
        err instanceof AuthError && err.code === 'INVALID_CREDENTIALS'
          ? 'The email or password is incorrect. Check your details or reset your password.'
          : 'We couldn’t reach Pawhaven just now. Check your connection and try again.',
      );
      setValues((v) => ({ ...v, password: '' }));
      document.getElementById('login-password')?.focus();
    }
  }

  const noticeContent = notice ? NOTICES[notice] : null;

  return (
    <AuthLayout>
      <header className={styles.header}>
        <h1 className={styles.title}>Welcome back.</h1>
        <p className={styles.subtitle}>Your next chapter is just a paw away.</p>
      </header>

      {noticeContent && !formError && (
        <Alert tone={noticeContent.tone} title={noticeContent.title} className={styles.alert}>
          {noticeContent.body}
        </Alert>
      )}
      {formError && (
        <Alert tone="error" title="Let’s try that again." className={styles.alert}>
          {formError} <Link to={ROUTES.forgotPassword}>Reset password</Link>
        </Alert>
      )}

      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Log in">
        <TextField
          id="login-email"
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={values.email}
          onChange={(e) => update('email', e.target.value)}
          error={errors.email}
          required
        />
        <PasswordField
          id="login-password"
          label="Password"
          name="password"
          autoComplete="current-password"
          placeholder="Enter your password"
          value={values.password}
          onChange={(e) => update('password', e.target.value)}
          error={errors.password}
          required
        />
        <div className={styles.row}>
          <Checkbox label="Remember me" checked={remember} onChange={(e) => setRemember(e.target.checked)} name="remember" />
          <Link to={ROUTES.forgotPassword} className={styles.inlineLink}>
            Forgot password?
          </Link>
        </div>
        <Button type="submit" block size="lg" loading={submitting} loadingText="Logging in…" className={styles.submit}>
          Log in
        </Button>
      </form>

      <p className={styles.switch}>
        New around here?
        <Link to={ROUTES.register} state={{ next }}>
          Create an account
        </Link>
      </p>

      <p className={styles.legal}>
        By continuing, you agree to our <Link to={ROUTES.terms}>Terms</Link> and <Link to={ROUTES.privacy}>Privacy Policy</Link>.
      </p>
    </AuthLayout>
  );
}
