import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../services/auth/AuthContext';
import type { DevEmail } from '../../services/auth/types';
import styles from './DevMailbox.module.css';

interface DevMailboxProps {
  email: string;
  /** Only show messages whose subject includes this text. */
  match?: string;
}

/**
 * Development only: shows the simulated email so verification and reset
 * flows can be completed without a mail server. Renders nothing when the
 * API sends real email.
 */
export function DevMailbox({ email, match }: DevMailboxProps) {
  const { service } = useAuth();
  const [messages, setMessages] = useState<DevEmail[] | null>(null);

  useEffect(() => {
    let active = true;
    const load = () =>
      service.getDevMailbox(email).then((m) => {
        if (active) setMessages(m);
      });
    void load();
    const id = window.setInterval(load, 2500);
    window.addEventListener('pawhaven:demo-email', load);
    return () => {
      active = false;
      window.clearInterval(id);
      window.removeEventListener('pawhaven:demo-email', load);
    };
  }, [service, email]);

  const latest = messages?.find(
    (m) => m.to === email.trim().toLowerCase() && (!match || m.subject.toLowerCase().includes(match.toLowerCase())),
  );
  if (!latest) return null;

  let linkPath: string | undefined;
  if (latest.link) {
    const url = new URL(latest.link, window.location.origin);
    linkPath = url.pathname + url.search;
  }

  return (
    <aside className={styles.box} aria-label="Development mailbox">
      <p className={styles.kicker}>Development mailbox · email not really sent</p>
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
