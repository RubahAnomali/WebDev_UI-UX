import type { ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Alert.module.css';

interface AlertProps {
  tone?: 'info' | 'success' | 'error' | 'warning';
  title?: string;
  children?: ReactNode;
  /** Error alerts interrupt assistive tech; others are announced politely. */
  live?: boolean;
  className?: string;
}

export function Alert({ tone = 'info', title, children, live = true, className }: AlertProps) {
  const role = live ? (tone === 'error' ? 'alert' : 'status') : undefined;
  return (
    <div className={[styles.alert, styles[tone], className].filter(Boolean).join(' ')} role={role}>
      <Icon name={tone === 'success' ? 'check' : tone === 'info' ? 'info' : 'alert'} size={20} className={styles.icon} />
      <div className={styles.body}>
        {title && <p className={styles.title}>{title}</p>}
        {children && <div className={styles.text}>{children}</div>}
      </div>
    </div>
  );
}
