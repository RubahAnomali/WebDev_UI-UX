import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import emailEmblem from '../../assets/figma/emblem-email.svg';
import { AuthLayout } from '../../components/layout/AuthLayout';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { Spinner } from '../../components/ui/Spinner';
import { ROUTES } from '../../lib/routes';
import { readJSON, writeJSON } from '../../lib/storage';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { useAuth } from '../../services/auth/AuthContext';
import { AuthError, RESEND_COOLDOWN_SECONDS } from '../../services/auth/types';
import { DevMailbox } from './DevMailbox';
import { clearPendingSignup, getPendingSignup } from './pendingSignup';
import styles from './AuthPage.module.css';

const COOLDOWN_KEY = 'pawhaven.verifyCooldown';

interface StoredCooldown {
  email: string;
  until: number;
}

/**
 * Resend countdown. Initialised synchronously so the button is never briefly
 * enabled after sign-up, and persisted per email so a refresh keeps it.
 */
function useCooldown(email: string | undefined, justSent: boolean) {
  const [until, setUntil] = useState<number>(() => {
    const stored = readJSON<StoredCooldown | null>(COOLDOWN_KEY, null, 'session');
    if (stored && stored.email === email) return stored.until;
    if (justSent && email) {
      const next = Date.now() + RESEND_COOLDOWN_SECONDS * 1000;
      writeJSON(COOLDOWN_KEY, { email, until: next }, 'session');
      return next;
    }
    return 0;
  });
  const [now, setNow] = useState(() => Date.now());
  const remaining = Math.max(0, Math.ceil((until - now) / 1000));

  useEffect(() => {
    if (remaining <= 0) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [remaining]);

  const start = useCallback(
    (seconds: number) => {
      const next = Date.now() + seconds * 1000;
      if (email) writeJSON(COOLDOWN_KEY, { email, until: next }, 'session');
      setNow(Date.now());
      setUntil(next);
    },
    [email],
  );

  return { remaining, start };
}

type TokenState =
  | { kind: 'verifying' }
  | { kind: 'verified' }
  | { kind: 'error'; code: 'TOKEN_EXPIRED' | 'TOKEN_INVALID' | 'NETWORK' };

export function VerifyEmailPage() {
  const [params] = useSearchParams();
  const token = params.get('token');
  return token ? <VerifyToken token={token} /> : <CheckInbox />;
}

/** Figma 14:31 — "Check your inbox." */
function CheckInbox() {
  useDocumentTitle('Verify your email');
  const { service } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const reason = (location.state as { reason?: 'registered' | 'login' } | null)?.reason;
  const [pending] = useState(getPendingSignup);
  const email = pending?.email;
  // A verification email was just sent during sign-up, so the cooldown starts immediately.
  const { remaining, start } = useCooldown(email, reason === 'registered');
  const [sending, setSending] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);

  if (!email) {
    return (
      <AuthLayout>
        <header className={styles.header}>
          <img src={emailEmblem} alt="" className={styles.emblem} />
          <h1 className={styles.title}>Check your inbox.</h1>
          <p className={styles.body}>
            Open the verification email we sent when you created your account. If you can’t find it, log in and we’ll
            help you get a new one.
          </p>
        </header>
        <div className={styles.stack}>
          <Button to={ROUTES.login} block size="lg">
            Log in
          </Button>
          <Button to={ROUTES.register} variant="secondary" block size="lg">
            Create an account
          </Button>
        </div>
      </AuthLayout>
    );
  }

  async function resend() {
    if (!email || remaining > 0) return;
    setSending(true);
    setFeedback(null);
    try {
      const { retryAfter } = await service.resendVerification(email);
      start(retryAfter);
      setFeedback({ tone: 'success', text: 'A new verification email is on its way.' });
    } catch (err) {
      if (err instanceof AuthError && err.code === 'RATE_LIMITED' && err.retryAfter) {
        start(err.retryAfter);
        setFeedback({ tone: 'error', text: `Please wait ${err.retryAfter} seconds before requesting another email.` });
      } else {
        setFeedback({ tone: 'error', text: 'We couldn’t send the email just now. Please try again.' });
      }
    } finally {
      setSending(false);
    }
  }

  return (
    <AuthLayout>
      {reason === 'login' && (
        <Alert tone="info" title="One more step." className={styles.alert}>
          Verify your email address to log in.
        </Alert>
      )}
      <header>
        <img src={emailEmblem} alt="" className={styles.emblem} />
        <h1 className={styles.title}>Check your inbox.</h1>
        <p className={styles.subtitle}>
          We’ve sent a verification link to
          <strong className={styles.emailStrong}>{email}</strong>
        </p>
        <p className={styles.body}>
          Open the email and verify your address to save pets, send messages, and publish listings.
        </p>
      </header>

      <div className={styles.stack}>
        {feedback && (
          <Alert tone={feedback.tone === 'success' ? 'success' : 'error'}>{feedback.text}</Alert>
        )}
        <Button
          block
          size="lg"
          onClick={resend}
          loading={sending}
          loadingText="Sending…"
          disabled={remaining > 0}
          aria-describedby="resend-hint"
        >
          {remaining > 0 ? `Resend available in ${remaining}s` : 'Resend verification email'}
        </Button>
        <Button
          variant="secondary"
          block
          size="lg"
          onClick={() => navigate(ROUTES.register, { state: { changeEmail: true } })}
        >
          Use a different email
        </Button>
      </div>

      <p id="resend-hint" className={styles.note}>
        Didn’t receive it? Check your spam folder.
        <br />
        You can request another email after {RESEND_COOLDOWN_SECONDS} seconds.
      </p>

      <DevMailbox email={email} match="verify" />
    </AuthLayout>
  );
}

/** Handles the link from the verification email. */
function VerifyToken({ token }: { token: string }) {
  useDocumentTitle('Verifying your email');
  const { service } = useAuth();
  const [state, setState] = useState<TokenState>({ kind: 'verifying' });
  const ran = useRef<string | null>(null);

  useEffect(() => {
    if (ran.current === token) return; // guard against StrictMode double-invoke consuming the token twice
    ran.current = token;
    service
      .verifyEmail(token)
      .then(() => {
        clearPendingSignup();
        setState({ kind: 'verified' });
      })
      .catch((err) => {
        const code = err instanceof AuthError && (err.code === 'TOKEN_EXPIRED' || err.code === 'TOKEN_INVALID') ? err.code : 'NETWORK';
        setState({ kind: 'error', code });
      });
  }, [service, token]);

  if (state.kind === 'verifying') {
    return (
      <AuthLayout>
        <h1 className={styles.title}>Verifying your email…</h1>
        <div className={styles.center}>
          <Spinner size={32} label="Verifying your email" />
        </div>
      </AuthLayout>
    );
  }

  if (state.kind === 'verified') {
    return (
      <AuthLayout>
        <header>
          <img src={emailEmblem} alt="" className={styles.emblem} />
          <h1 className={styles.title}>You’re verified.</h1>
          <p className={styles.body} role="status">
            Your email address is confirmed. Log in to save pets, send messages, and publish listings.
          </p>
        </header>
        <div className={styles.stack}>
          <Button to={ROUTES.login} block size="lg">
            Log in to Pawhaven
          </Button>
        </div>
      </AuthLayout>
    );
  }

  const copy = {
    TOKEN_EXPIRED: {
      title: 'This link has expired.',
      body: 'Verification links last 24 hours. Request a fresh one and we’ll send it right over.',
    },
    TOKEN_INVALID: {
      title: 'This link isn’t valid.',
      body: 'It may have already been used, or a newer link was sent. If you’ve already verified, you can log in.',
    },
    NETWORK: { title: 'Let’s try that again.', body: 'We couldn’t verify your email just now. Please try again.' },
  }[state.code];

  return (
    <AuthLayout>
      <header>
        <h1 className={styles.title}>{copy.title}</h1>
        <p className={styles.body}>{copy.body}</p>
      </header>
      <div className={styles.stack}>
        {getPendingSignup()?.email ? (
          <Button to={ROUTES.verifyEmail} block size="lg">
            Get a new verification link
          </Button>
        ) : (
          <Button to={ROUTES.login} block size="lg">
            Log in to request a new link
          </Button>
        )}
      </div>
      <Link to={ROUTES.login} className={styles.backLink}>
        Back to log in
      </Link>
    </AuthLayout>
  );
}
