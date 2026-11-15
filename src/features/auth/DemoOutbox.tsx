import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { readDemoOutbox, type DemoEmail } from '../../services/auth/demoAuthAdapter';
import styles from './DemoOutbox.module.css';

interface DemoOutboxProps {
  email: string;
  /** Only show messages whose subject includes this text. */
  match?: string;
}

/**
 * Shows the simulated email the demo adapter "sent", so the verification
 * and reset flows can be completed without a mail server. Never rendered
 * when a real AuthService is used.
 */
export function DemoOutbox({ email, match }: DemoOutboxProps) {
  const [messages, setMessages] = useState<DemoEmail[]>(() => readDemoOutbox());

  useEffect(() => {
    const refresh = () => setMessages(readDemoOutbox());
    window.addEventListener('pawhaven:demo-email', refresh);
    window.addEventListener('storage', refresh);
    return () => {
      window.removeEventListener('pawhaven:demo-email', refresh);
      window.removeEventListener('storage', refresh);
    };
  }, []);

  const latest = messages.find(
    (m) => m.to === email.trim().toLowerCase() && (!match || m.subject.toLowerCase().includes(match.toLowerCase())),
  );
  if (!latest) return null;

  const linkPath = latest.link ? new URL(latest.link).pathname + new URL(latest.link).search : undefined;

  return (
    <aside className={styles.box} aria-label="Demo inbox">
      <p className={styles.kicker}>Demo inbox · simulated email</p>
      <p className={styles.subject}>{latest.subject}</p>
      <p className={styles.body}>{latest.body}</p>
      {linkPath && (
        <Link to={linkPath} className={styles.link}>
          Open link from email
        </Link>
      )}
    </aside>
  );
}
