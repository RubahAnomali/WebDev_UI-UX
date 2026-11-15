import { PageShell } from '../components/layout/PageShell';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { ROUTES } from '../lib/routes';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './StatusPage.module.css';

export function NotFound() {
  useDocumentTitle('Page not found');
  return (
    <PageShell>
      <section className={`container ${styles.wrap}`} aria-labelledby="status-title">
        <Icon name="paw" size={56} className={styles.icon} />
        <p className={styles.kicker}>404</p>
        <h1 id="status-title" className={styles.title}>
          This trail went cold.
        </h1>
        <p className={styles.text}>We couldn’t find that page. It may have moved, or the link may be mistyped.</p>
        <div className={styles.actions}>
          <Button to={ROUTES.home}>Back to Pawhaven</Button>
          <Button to={ROUTES.findPet} variant="secondary">
            Find a pet
          </Button>
        </div>
      </section>
    </PageShell>
  );
}
