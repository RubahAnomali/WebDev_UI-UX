import type { ReactNode } from 'react';
import { AppPage } from '../../components/layout/AppPage';
import { Alert } from '../../components/ui/Alert';
import styles from './ContentPage.module.css';

export interface ContentSection {
  heading: string;
  body: ReactNode;
}

interface ContentPageProps {
  title: string;
  documentTitle: string;
  subtitle?: ReactNode;
  sections: ContentSection[];
  /** Shows a notice that legal copy must be reviewed before launch. */
  draft?: boolean;
  updated?: string;
  aside?: ReactNode;
}

/** Long-form info / policy pages in the inner-page style. */
export function ContentPage({ title, documentTitle, subtitle, sections, draft, updated, aside }: ContentPageProps) {
  return (
    <AppPage title={title} documentTitle={documentTitle} subtitle={subtitle}>
      {draft && (
        <Alert tone="warning" className={styles.draft} title="Draft — requires legal review.">
          This text is a working draft prepared for development. It must be reviewed by qualified counsel before Pawhaven launches.
        </Alert>
      )}
      <div className={`${styles.layout} ${aside ? styles.withAside : ''}`}>
        <article className={styles.article}>
          {sections.map((s) => (
            <section key={s.heading} className={styles.section}>
              <h2>{s.heading}</h2>
              <div className={styles.body}>{s.body}</div>
            </section>
          ))}
          {updated && <p className={styles.updated}>Last updated {updated}</p>}
        </article>
        {aside && <aside className={styles.aside}>{aside}</aside>}
      </div>
    </AppPage>
  );
}
