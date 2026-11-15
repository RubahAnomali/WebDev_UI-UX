import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import pawArtwork from '../../assets/figma/auth-paw-artwork.svg';
import { ROUTES } from '../../lib/routes';
import { useAuth } from '../../services/auth/AuthContext';
import { DemoNotice } from '../../features/auth/DemoNotice';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import styles from './AuthLayout.module.css';

interface AuthLayoutProps {
  children: ReactNode;
}

/** Split layout shared by every authentication screen (Figma 14:27–14:35). */
export function AuthLayout({ children }: AuthLayoutProps) {
  const { service } = useAuth();
  return (
    <div className={styles.layout}>
      <a href="#main" className="skip-link">
        Skip to main content
      </a>
      <aside className={styles.brand} aria-label="About Pawhaven">
        <Logo size="md" />
        <p className={styles.headline}>
          A little paw.
          <br />
          A big beginning.
        </p>
        <img src={pawArtwork} alt="" className={styles.art} width={248} height={220} />
        <div className={styles.copy}>
          <p className={styles.lead}>Find your person. Find your purpose.</p>
          <p className={styles.sub}>
            Thoughtful adoption and responsible rehoming.
            <br />
            Because every companion deserves a loving home.
          </p>
        </div>
        <p className={styles.motto}>Pet welfare first. Always.</p>
      </aside>

      <main id="main" tabIndex={-1} className={styles.main}>
        <div className={styles.panel}>
          <div className={styles.topRow}>
            <div className={styles.mobileLogo}>
              <Logo size="md" />
            </div>
            <Link to={ROUTES.home} className={styles.back}>
              <Icon name="arrowLeft" size={16} />
              Back to Pawhaven
            </Link>
          </div>
          {service.isDemo && <DemoNotice />}
          {children}
        </div>
      </main>
    </div>
  );
}
