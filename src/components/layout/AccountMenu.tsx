import { useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';
import type { User } from '../../services/auth/types';
import { Icon } from '../ui/Icon';
import styles from './AccountMenu.module.css';

interface AccountMenuProps {
  user: User;
  newRequests: number;
  onLogout: () => void;
}

/**
 * Disclosure-style account menu ("Alex ▾" in Figma 12:xx). Uses a list of
 * links rather than role="menu" so it works naturally with Tab and screen readers.
 */
export function AccountMenu({ user, newRequests, onLogout }: AccountMenuProps) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const firstName = user.fullName.split(' ')[0];
  const isAdmin = user.roles.includes('admin');

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!wrapRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className={styles.wrap} ref={wrapRef} onBlur={(e) => !wrapRef.current?.contains(e.relatedTarget) && close()}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen((o) => !o)}
      >
        <span className={styles.avatar} aria-hidden="true">
          {firstName?.[0]?.toUpperCase()}
        </span>
        <span className={styles.name}>
          <span className="visually-hidden">Account menu for </span>
          {firstName}
        </span>
        <Icon name="chevronDown" size={16} className={styles.chevron} />
      </button>
      <div id={id} className={styles.panel} hidden={!open}>
        <div className={styles.who}>
          <p className={styles.fullName}>{user.fullName}</p>
          <p className={styles.email}>{user.email}</p>
        </div>
        <ul role="list" className={styles.list}>
          <li>
            <Link to={ROUTES.account} onClick={close} className={styles.item}>
              Account &amp; privacy
            </Link>
          </li>
          <li>
            <Link to={ROUTES.requests} onClick={close} className={styles.item}>
              My adoption requests
            </Link>
          </li>
          <li>
            <Link to={ROUTES.myListings} onClick={close} className={styles.item}>
              My listings
              {newRequests > 0 && <span className={styles.count}>{newRequests} new</span>}
            </Link>
          </li>
          <li>
            <Link to={ROUTES.safety} onClick={close} className={styles.item}>
              Safety &amp; support
            </Link>
          </li>
          {isAdmin && (
            <li>
              <Link to={ROUTES.admin} onClick={close} className={styles.item}>
                Moderation workspace
              </Link>
            </li>
          )}
        </ul>
        <button
          type="button"
          className={`${styles.item} ${styles.logout}`}
          onClick={() => {
            close();
            onLogout();
          }}
        >
          <Icon name="logout" size={18} />
          Log out
        </button>
      </div>
    </div>
  );
}
