import type { ReactNode } from 'react';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { PageShell } from './PageShell';
import styles from './AppPage.module.css';

interface AppPageProps {
  title: string;
  /** Overrides the browser tab title (defaults to `title`). */
  documentTitle?: string;
  eyebrow?: string;
  subtitle?: ReactNode;
  /** Content to the right of the heading (e.g. a primary action). */
  actions?: ReactNode;
  /** Content above the heading (e.g. breadcrumb). */
  before?: ReactNode;
  children: ReactNode;
  width?: 'default' | 'narrow';
}

/** Standard inner page: header, page heading (Lora 42 / Inter 15) and compact footer. */
export function AppPage({ title, documentTitle, eyebrow, subtitle, actions, before, children, width = 'default' }: AppPageProps) {
  useDocumentTitle(documentTitle ?? title);
  return (
    <PageShell footer="compact">
      <div className={`container ${styles.page} ${width === 'narrow' ? styles.narrow : ''}`}>
        {before}
        <header className={styles.head}>
          <div className={styles.headText}>
            {eyebrow && <p className={styles.eyebrow}>{eyebrow}</p>}
            <h1 className={styles.title}>{title}</h1>
            {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
          </div>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
        {children}
      </div>
    </PageShell>
  );
}
