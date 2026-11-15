import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../services/auth/AuthContext';
import { ROUTES } from '../../lib/routes';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import styles from './SiteHeader.module.css';

const NAV = [
  { label: 'Find a pet', to: ROUTES.findPet },
  { label: 'How it works', to: ROUTES.howItWorksAnchor },
  { label: 'Our mission', to: ROUTES.about },
];

export function SiteHeader() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Close the mobile menu whenever the route changes.
  const [lastPath, setLastPath] = useState(location.pathname + location.hash);
  if (lastPath !== location.pathname + location.hash) {
    setLastPath(location.pathname + location.hash);
    setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpen(false);
        toggleRef.current?.focus();
      }
    };
    document.addEventListener('keydown', onKey);
    panelRef.current?.querySelector<HTMLElement>('a, button')?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  async function handleLogout() {
    await logout();
    navigate(ROUTES.home);
  }

  const firstName = user?.fullName.split(' ')[0];
  const loginHref = `${ROUTES.login}?next=${encodeURIComponent(location.pathname + location.search)}`;

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />

        <nav aria-label="Main" className={styles.desktopNav}>
          <ul role="list" className={styles.navList}>
            {NAV.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  className={({ isActive }) => `${styles.navLink} ${isActive && !item.to.includes('#') ? styles.active : ''}`}
                >
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          {user ? (
            <div className={styles.account}>
              <span className={styles.greeting}>Hi, {firstName}</span>
              <button type="button" className={styles.textButton} onClick={handleLogout}>
                Log out
              </button>
            </div>
          ) : (
            <Link to={loginHref} className={styles.login}>
              Log in
            </Link>
          )}
          <Button to={ROUTES.postPet} className={styles.post} iconStart={<Icon name="plus" size={18} strokeWidth={2} />}>
            Post a pet
          </Button>
        </div>

        <button
          ref={toggleRef}
          type="button"
          className={styles.menuToggle}
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Close menu' : 'Open menu'}
          onClick={() => setOpen((o) => !o)}
        >
          <Icon name={open ? 'close' : 'menu'} size={24} />
        </button>
      </div>

      <div id="mobile-menu" ref={panelRef} className={styles.mobilePanel} hidden={!open}>
        <nav aria-label="Mobile" className="container">
          <ul role="list" className={styles.mobileList}>
            {NAV.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={styles.mobileLink}>
                  {item.label}
                </Link>
              </li>
            ))}
            <li>
              {user ? (
                <button type="button" className={styles.mobileLink} onClick={handleLogout}>
                  Log out ({firstName})
                </button>
              ) : (
                <Link to={loginHref} className={styles.mobileLink}>
                  Log in
                </Link>
              )}
            </li>
          </ul>
          <Button to={ROUTES.postPet} block iconStart={<Icon name="plus" size={18} strokeWidth={2} />}>
            Post a pet
          </Button>
        </nav>
      </div>
    </header>
  );
}
