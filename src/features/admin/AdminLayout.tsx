import type { ReactNode } from 'react';
import { NavLink } from 'react-router-dom';
import { CompactFooter } from '../../components/layout/CompactFooter';
import { Button } from '../../components/ui/Button';
import { Logo } from '../../components/ui/Logo';
import { ROUTES } from '../../lib/routes';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import styles from './AdminLayout.module.css';

const NAV = [
  { label: 'Review queue', to: ROUTES.admin, end: true },
  { label: 'Reports', to: `${ROUTES.admin}/reports` },
  { label: 'Organizations', to: `${ROUTES.admin}/organizations` },
  { label: 'Members', to: `${ROUTES.admin}/members` },
  { label: 'Audit trail', to: `${ROUTES.admin}/audit` },
];

/** Staff-only shell from Figma 14:67 (own navigation, “Back to site”). */
export function AdminLayout({ title, children }: { title: string; children: ReactNode }) {
  useDocumentTitle(`${title} · Moderation`);
  return (
    <>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <header className={styles.header}>
        <div className={`container ${styles.inner}`}>
          <Logo />
          <nav aria-label="Moderation" className={styles.nav}>
            <ul role="list">
              {NAV.map((n) => (
                <li key={n.to}>
                  <NavLink to={n.to} end={n.end} className={({ isActive }) => `${styles.link} ${isActive ? styles.active : ''}`}>
                    {n.label}
                  </NavLink>
                </li>
              ))}
            </ul>
          </nav>
          <div className={styles.right}>
            <span className={styles.staff}>Staff</span>
            <Button to={ROUTES.home} className={styles.back}>
              Back to site
            </Button>
          </div>
        </div>
      </header>
      <main id="main" tabIndex={-1} className={`container ${styles.main}`}>
        <div className={styles.head}>
          <div>
            <h1 className={styles.title}>Care behind every connection.</h1>
            <p className={styles.subtitle}>Moderation workspace · Restricted to authorized staff.</p>
          </div>
          <span className={styles.badge}>Staff only</span>
        </div>
        {children}
        <p className={styles.note}>Every decision records the reviewer, timestamp, and reason in the audit trail.</p>
      </main>
      <CompactFooter />
    </>
  );
}
