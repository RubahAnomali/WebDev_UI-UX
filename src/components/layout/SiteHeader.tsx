import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { ROUTES } from '../../lib/routes';
import { useAuth } from '../../services/auth/AuthContext';
import { useCounts } from '../../services/me/useCounts';
import { Button } from '../ui/Button';
import { Icon } from '../ui/Icon';
import { Logo } from '../ui/Logo';
import { AccountMenu } from './AccountMenu';
import styles from './SiteHeader.module.css';

interface NavItem {
  label: string;
  to: string;
  badge?: number;
  badgeLabel?: string;
}

const PUBLIC_NAV: NavItem[] = [
  { label: 'Find a pet', to: ROUTES.findPet },
  { label: 'How it works', to: ROUTES.howItWorksAnchor },
  { label: 'Our mission', to: ROUTES.about },
];

function NavBadge({ count, label }: { count?: number; label?: string }) {
  if (!count) return null;
  return (
    <span className={styles.badge}>
      {count > 9 ? '9+' : count}
      <span className="visually-hidden"> {label}</span>
    </span>
  );
}

export function SiteHeader() {
  const { user, logout } = useAuth();
  const counts = useCounts();
  const navigate = useNavigate();
  const location = useLocation();
  const [open, setOpen] = useState(false);
  const toggleRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  // Signed-in navigation adapted from Figma 12:xx, styled like the 14:xx frames.
  const nav: NavItem[] = user
    ? [
        { label: 'Find a pet', to: ROUTES.findPet },
        { label: 'Saved pets', to: ROUTES.saved },
        { label: 'Messages', to: ROUTES.messages, badge: counts.unreadConversations, badgeLabel: 'unread conversations' },
        { label: 'My listings', to: ROUTES.myListings, badge: counts.newRequests, badgeLabel: 'new adoption requests' },
      ]
    : PUBLIC_NAV;

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
  const totalBadge = counts.unreadConversations + counts.newRequests;

  return (
    <header className={styles.header}>
      <div className={`container ${styles.inner}`}>
        <Logo />

        <nav aria-label="Main" className={`${styles.desktopNav} ${user ? styles.signedIn : ''}`}>
          <ul role="list" className={styles.navList}>
            {nav.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  end={item.to === ROUTES.findPet ? false : undefined}
                  className={({ isActive }) =>
                    [styles.navLink, isActive && !item.to.includes('#') ? styles.active : ''].join(' ')
                  }
                >
                  {item.label}
                  <NavBadge count={item.badge} label={item.badgeLabel} />
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        <div className={styles.actions}>
          {user ? (
            <>
              <Button to={ROUTES.postPet} className={styles.post} iconStart={<Icon name="plus" size={18} strokeWidth={2} />}>
                Post a pet
              </Button>
              <AccountMenu user={user} newRequests={counts.newRequests} onLogout={handleLogout} />
            </>
          ) : (
            <>
              <Link to={loginHref} className={styles.login}>
                Log in
              </Link>
              <Button to={ROUTES.postPet} className={styles.post} iconStart={<Icon name="plus" size={18} strokeWidth={2} />}>
                Post a pet
              </Button>
            </>
          )}
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
          {!open && totalBadge > 0 && <span className={styles.dot} aria-hidden="true" />}
        </button>
      </div>

      <div id="mobile-menu" ref={panelRef} className={styles.mobilePanel} hidden={!open}>
        <nav aria-label="Mobile" className="container">
          {user && (
            <p className={styles.mobileWho}>
              Signed in as <strong>{user.fullName}</strong>
            </p>
          )}
          <ul role="list" className={styles.mobileList}>
            {nav.map((item) => (
              <li key={item.to}>
                <Link to={item.to} className={styles.mobileLink}>
                  {item.label}
                  <NavBadge count={item.badge} label={item.badgeLabel} />
                </Link>
              </li>
            ))}
            {user ? (
              <>
                <li>
                  <Link to={ROUTES.requests} className={styles.mobileLink}>
                    My adoption requests
                  </Link>
                </li>
                <li>
                  <Link to={ROUTES.account} className={styles.mobileLink}>
                    Account &amp; privacy
                  </Link>
                </li>
                {user.roles.includes('admin') && (
                  <li>
                    <Link to={ROUTES.admin} className={styles.mobileLink}>
                      Moderation workspace
                    </Link>
                  </li>
                )}
                <li>
                  <button type="button" className={styles.mobileLink} onClick={handleLogout}>
                    Log out ({firstName})
                  </button>
                </li>
              </>
            ) : (
              <li>
                <Link to={loginHref} className={styles.mobileLink}>
                  Log in
                </Link>
              </li>
            )}
          </ul>
          <Button to={ROUTES.postPet} block iconStart={<Icon name="plus" size={18} strokeWidth={2} />}>
            Post a pet
          </Button>
        </nav>
      </div>
    </header>
  );
}
