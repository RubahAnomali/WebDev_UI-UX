import { useCallback, useEffect, useId, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { NotificationItems } from '../../features/notifications/NotificationItems';
import styles from '../../features/notifications/Notifications.module.css';
import { ROUTES } from '../../lib/routes';
import { notificationsService, type AppNotification } from '../../services/notifications/notificationsService';
import { Icon } from '../ui/Icon';

/** Header bell: a disclosure (like the account menu) listing recent updates. */
export function NotificationBell({ unread }: { unread: number }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);
  const id = useId();
  const wrapRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const load = useCallback(() => {
    notificationsService
      .list()
      .then((r) => {
        setItems(r.items);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => {
    if (!open) return;
    load();
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
  }, [open, load]);

  const close = () => setOpen(false);

  function openItem(n: AppNotification) {
    close();
    if (!n.read) notificationsService.markRead([n.id]).catch(() => undefined);
  }

  async function markAll() {
    await notificationsService.markAllRead().catch(() => undefined);
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
  }

  const hasUnread = unread > 0 || Boolean(items?.some((n) => !n.read));
  const label = unread > 0 ? `Notifications, ${unread} unread` : 'Notifications';

  return (
    <div className={styles.wrap} ref={wrapRef} onBlur={(e) => !wrapRef.current?.contains(e.relatedTarget) && close()}>
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        aria-expanded={open}
        aria-controls={id}
        aria-label={label}
        onClick={() => setOpen((o) => !o)}
      >
        <Icon name="bell" size={22} />
        {unread > 0 && (
          <span className={styles.badge} aria-hidden="true">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>
      <div id={id} className={styles.panel} hidden={!open} role="region" aria-label="Notifications">
        <div className={styles.panelHead}>
          <p className={styles.panelTitle}>Notifications</p>
          {hasUnread && (
            <button type="button" className={styles.textButton} onClick={markAll}>
              Mark all as read
            </button>
          )}
        </div>
        <div className={styles.scroll}>
          {failed ? (
            <div className={styles.empty}>
              <p className={styles.emptyText}>We couldn’t load your notifications.</p>
              <button type="button" className={styles.textButton} onClick={load}>
                Try again
              </button>
            </div>
          ) : items === null ? (
            <p className={styles.empty} aria-live="polite">
              <span className={styles.emptyText}>Loading…</span>
            </p>
          ) : items.length === 0 ? (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>All caught up.</p>
              <p className={styles.emptyText}>Updates about requests, messages and listings will appear here.</p>
            </div>
          ) : (
            <NotificationItems items={items.slice(0, 8)} onOpen={openItem} compact />
          )}
        </div>
        {items && items.length > 0 && (
          <div className={styles.panelFoot}>
            <Link to={ROUTES.notifications} className={styles.footLink} onClick={close}>
              See all notifications
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}
