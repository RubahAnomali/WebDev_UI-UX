import { useCallback, useEffect, useState } from 'react';
import { AppPage } from '../../components/layout/AppPage';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { notificationsService, type AppNotification } from '../../services/notifications/notificationsService';
import { NotificationItems } from './NotificationItems';
import styles from './Notifications.module.css';

/** Full list of recent notifications (the mobile entry point for the bell). */
export function NotificationsPage() {
  const [items, setItems] = useState<AppNotification[] | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    notificationsService
      .list()
      .then((r) => {
        setItems(r.items);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, []);

  useEffect(() => load(), [load]);

  async function markAll() {
    await notificationsService.markAllRead().catch(() => undefined);
    setItems((list) => list?.map((n) => ({ ...n, read: true })) ?? null);
  }

  function openItem(n: AppNotification) {
    if (!n.read) notificationsService.markRead([n.id]).catch(() => undefined);
  }

  const hasUnread = Boolean(items?.some((n) => !n.read));

  return (
    <AppPage
      title="Notifications"
      subtitle="Updates about your adoption requests, messages and listings."
      width="narrow"
      actions={
        hasUnread ? (
          <Button variant="secondary" onClick={markAll}>
            Mark all as read
          </Button>
        ) : undefined
      }
    >
      {failed ? (
        <EmptyState title="We couldn’t load your notifications." action={<Button onClick={load}>Try again</Button>} />
      ) : items === null ? (
        <p aria-live="polite">Loading…</p>
      ) : items.length === 0 ? (
        <EmptyState title="All caught up." text="Updates about requests, messages and listings will appear here." />
      ) : (
        <div className={styles.pageCard}>
          <NotificationItems items={items} onOpen={openItem} />
        </div>
      )}
    </AppPage>
  );
}
