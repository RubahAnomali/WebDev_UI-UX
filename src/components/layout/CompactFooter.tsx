import { Link } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';
import styles from './CompactFooter.module.css';

/** The slim footer used on inner pages in the 14:xx frames. */
export function CompactFooter() {
  return (
    <footer className={styles.footer}>
      <div className={`container ${styles.inner}`}>
        <p>© {new Date().getFullYear()} Pawhaven · Pet welfare first.</p>
        <ul role="list" className={styles.links}>
          <li>
            <Link to={ROUTES.safety}>Safety &amp; support</Link>
          </li>
          <li>
            <Link to={ROUTES.privacy}>Privacy</Link>
          </li>
          <li>
            <Link to={ROUTES.terms}>Terms</Link>
          </li>
        </ul>
      </div>
    </footer>
  );
}
