import { PageShell } from '../components/layout/PageShell';
import { Button } from '../components/ui/Button';
import { Icon } from '../components/ui/Icon';
import { ROUTES } from '../lib/routes';
import { useDocumentTitle } from '../lib/useDocumentTitle';
import styles from './StatusPage.module.css';

export function NotAllowed() {
  useDocumentTitle('Not available');
  return (
    <PageShell footer="compact">
      <section className={`container ${styles.wrap}`} aria-labelledby="status-title">
        <Icon name="paw" size={56} className={styles.icon} />
        <p className={styles.kicker}>Restricted</p>
        <h1 id="status-title" className={styles.title}>
          This area isn’t available to your account.
        </h1>
        <p className={styles.text}>If you think you should have access, contact the Pawhaven team.</p>
        <div className={styles.actions}>
          <Button to={ROUTES.home}>Back to Pawhaven</Button>
        </div>
      </section>
    </PageShell>
  );
}
