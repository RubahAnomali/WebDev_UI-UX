import { useLocation } from 'react-router-dom';
import { PageShell } from '../components/layout/PageShell';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { ROUTES, UPCOMING_PAGES } from '../lib/routes';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './StatusPage.module.css';

/**
 * Honest placeholder for destinations planned in later phases. It never
 * pretends a feature works.
 */
export function ComingSoon({ title: titleOverride, summary: summaryOverride }: { title?: string; summary?: string }) {
  const { pathname } = useLocation();
  const page = UPCOMING_PAGES[pathname];
  const title = titleOverride ?? page?.title ?? 'Coming soon';
  const summary = summaryOverride ?? page?.summary;
  useDocumentTitle(title);

  return (
    <PageShell>
      <section className={`container ${styles.wrap}`} aria-labelledby="status-title">
        <Icon name="paw" size={56} className={styles.icon} />
        <p className={styles.kicker}>Coming soon</p>
        <h1 id="status-title" className={styles.title}>
          {title}
        </h1>
        {summary && <p className={styles.text}>{summary}</p>}
        <p className={styles.text}>This page is part of the next phase of Pawhaven and isn’t available yet.</p>
        <div className={styles.actions}>
          <Button to={ROUTES.home}>Back to Pawhaven</Button>
          <Button to={ROUTES.howItWorksAnchor} variant="secondary">
            How it works
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
