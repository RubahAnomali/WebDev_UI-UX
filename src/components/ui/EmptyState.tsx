import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './EmptyState.module.css';

interface EmptyStateProps {
  title: string;
  text?: ReactNode;
  action?: ReactNode;
  /** Visual weight: `card` (dashed border) or `plain`. */
  tone?: 'card' | 'plain';
}

/** Empty / error / confirmation states from Figma frame 22. */
export function EmptyState({ title, text, action, tone = 'card' }: EmptyStateProps) {
  return (
    <div className={`${styles.wrap} ${styles[tone]}`}>
      <span className={styles.icon} aria-hidden="true">
        <Icon name="paw" size={34} />
      </span>
      <p className={styles.title}>{title}</p>
      {text && <p className={styles.text}>{text}</p>}
      {action && <div className={styles.action}>{action}</div>}
    </div>
  );
}
