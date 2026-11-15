import { Link } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';
import { Logo } from '../ui/Logo';
import styles from './SiteFooter.module.css';

const COLUMNS = [
  {
    heading: 'Explore',
    links: [
      { label: 'Find a pet', to: ROUTES.findPet },
      { label: 'Adoption & rehoming', to: ROUTES.howItWorksAnchor },
      { label: 'Pet care resources', to: ROUTES.resources },
    ],
  },
  {
    heading: 'For pet parents',
    links: [
      { label: 'Post a pet', to: ROUTES.postPet },
      { label: 'Manage your listings', to: ROUTES.myListings },
      { label: 'Rehoming guide', to: ROUTES.rehomingGuide },
    ],
  },
  {
    heading: 'We’re here to help',
    links: [
      { label: 'About Pawhaven', to: ROUTES.about },
      { label: 'Safety & community', to: ROUTES.safety },
      { label: 'Contact us', to: ROUTES.contact },
    ],
  },
];

const LEGAL = [
  { label: 'Privacy policy', to: ROUTES.privacy },
  { label: 'Terms of use', to: ROUTES.terms },
  { label: 'Accessibility', to: ROUTES.accessibility },
];

export function SiteFooter() {
  return (
    <footer className={styles.footer}>
      <div className="container">
        <div className={styles.top}>
          <div className={styles.brand}>
            <Logo size="md" />
            <p className={styles.tagline}>More than a match. A new beginning.</p>
          </div>
          <nav aria-label="Footer" className={styles.columns}>
            {COLUMNS.map((col) => (
              <div key={col.heading}>
                <h2 className={styles.heading}>{col.heading}</h2>
                <ul role="list" className={styles.list}>
                  {col.links.map((l) => (
                    <li key={l.label}>
                      <Link to={l.to} className={styles.link}>
                        {l.label}
                      </Link>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>
        </div>
        <div className={styles.bottom}>
          <p>© {new Date().getFullYear()} Pawhaven. Made for the love of pets.</p>
          <ul role="list" className={styles.legal}>
            {LEGAL.map((l) => (
              <li key={l.label}>
                <Link to={l.to} className={styles.link}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </footer>
  );
}
