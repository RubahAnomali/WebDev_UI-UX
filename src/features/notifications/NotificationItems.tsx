import { Link } from 'react-router-dom';
import { Icon, type IconName } from '../../components/ui/Icon';
import { relativeTime } from '../../lib/relativeTime';
import type { AppNotification } from '../../services/notifications/notificationsService';
import styles from './Notifications.module.css';

const ICONS: Record<string, IconName> = {
  message: 'message',
  request_new: 'heart',
  request_invite: 'heart',
  request_approve: 'check',
  request_decline: 'info',
  request_closed: 'info',
  listing_approve: 'check',
  listing_request_changes: 'alert',
  listing_reject: 'alert',
  organization_verify: 'check',
  organization_reject: 'alert',
};

interface Props {
  items: AppNotification[];
  onOpen: (n: AppNotification) => void;
  compact?: boolean;
}

/** Shared list used by the header bell and the full notifications page. */
export function NotificationItems({ items, onOpen, compact }: Props) {
  return (
    <ul role="list" className={`${styles.list} ${compact ? styles.compact : ''}`}>
      {items.map((n) => {
        const content = (
          <>
            <span className={styles.icon} aria-hidden="true">
              <Icon name={ICONS[n.type] ?? 'paw'} size={18} />
            </span>
            <span className={styles.text}>
              <span className={styles.title}>
                {!n.read && <span className="visually-hidden">Unread: </span>}
                {n.title}
              </span>
              {n.body && <span className={styles.body}>{n.body}</span>}
              <time className={styles.time} dateTime={n.createdAt}>
                {relativeTime(n.createdAt)}
              </time>
            </span>
            {!n.read && <span className={styles.dot} aria-hidden="true" />}
          </>
        );
        return (
          <li key={n.id}>
            {n.link ? (
              <Link to={n.link} className={`${styles.item} ${n.read ? '' : styles.unread}`} onClick={() => onOpen(n)}>
                {content}
              </Link>
            ) : (
              <div className={`${styles.item} ${n.read ? '' : styles.unread}`}>{content}</div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
