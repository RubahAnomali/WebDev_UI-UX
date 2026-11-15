import { useState, type FormEvent } from 'react';
import { Link } from 'react-router-dom';
import emailEmblem from '../../assets/figma/emblem-email.svg';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { TextField } from '../../components/ui/TextField';
import { ROUTES } from '../../lib/routes';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { useAuth } from '../../services/auth/AuthContext';
import { DemoOutbox } from './DemoOutbox';
import { useFocusHeading } from './useFocusHeading';
import { validateEmail } from './validation';
import styles from './AuthPage.module.css';

/** Figma 14:33 — Forgot password, plus the neutral "Check your email." state from frame 22. */
export function ForgotPasswordPage() {
  useDocumentTitle('Forgot password');
  const { service } = useAuth();
  const [email, setEmail] = useState('');
  const [error, setError] = useState<string | undefined>();
  const [attempted, setAttempted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const headingRef = useFocusHeading(sentTo);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setAttempted(true);
    setFormError(null);
    const found = validateEmail(email);
    setError(found);
    if (found) {
      document.getElementById('forgot-email')?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await service.requestPasswordReset(email.trim());
      setSentTo(email.trim().toLowerCase());
    } catch {
      setFormError('We couldn’t send the reset link just now. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (sentTo) {
    return (
      <AuthLayout>
        <header>
          <img src={emailEmblem} alt="" className={styles.emblem} />
          <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
            Check your email.
          </h1>
          <p className={styles.body} role="status">
            If an account exists for <strong>{sentTo}</strong>, you’ll receive a password reset link shortly. The link
            expires in 30 minutes. Check your spam folder too.
          </p>
        </header>
        <div className={styles.stack}>
          <Button to={ROUTES.login} block size="lg">
            Back to log in
          </Button>
          <Button variant="secondary" block size="lg" onClick={() => setSentTo(null)}>
            Use a different email
          </Button>
        </div>
        <DemoOutbox email={sentTo} match="reset" />
      </AuthLayout>
    );
  }

  return (
    <AuthLayout>
      <header className={styles.header}>
        <h1 ref={headingRef} tabIndex={-1} className={styles.title}>
          Forgot your password?
        </h1>
        <p className={styles.subtitle}>It happens. Enter your email and we’ll help you get back to your companions.</p>
      </header>

      {formError && (
        <Alert tone="error" className={styles.alert}>
          {formError}
        </Alert>
      )}

      <form className={styles.form} onSubmit={onSubmit} noValidate aria-label="Request a password reset link">
        <TextField
          id="forgot-email"
          label="Email address"
          type="email"
          name="email"
          autoComplete="email"
          inputMode="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            if (attempted) setError(validateEmail(e.target.value));
          }}
          error={error}
          required
        />
        <Button type="submit" block size="lg" loading={submitting} loadingText="Sending…" className={styles.submit}>
          Send reset link
        </Button>
      </form>

      <Link to={ROUTES.login} className={styles.backLink}>
        <Icon name="arrowLeft" size={16} />
        Back to log in
      </Link>

      <p className={styles.note}>
        For your security, we won’t disclose whether an email address is associated with an account.
      </p>
    </AuthLayout>
  );
}
