import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AppPage } from '../../components/layout/AppPage';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import { StatusPill } from '../../components/ui/StatusPill';
import { requestPath, ROUTES } from '../../lib/routes';
import { artworkFor } from '../../services/pets/artwork';
import { requestsService, type MyRequest } from '../../services/requests/requestsService';
import styles from './MyRequestsPage.module.css';

/** List of the adoption requests a member has sent (not a Figma frame; built from 14:45 patterns). */
export function MyRequestsPage() {
  const [items, setItems] = useState<MyRequest[] | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    requestsService
      .mine(controller.signal)
      .then(setItems)
      .catch((err) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setFailed(true);
      });
    return () => controller.abort();
  }, []);

  const open = items?.filter((r) => ['sent', 'in_review', 'meet_invited'].includes(r.status)) ?? [];
  const past = items?.filter((r) => !['sent', 'in_review', 'meet_invited'].includes(r.status)) ?? [];

  return (
    <AppPage title="Your adoption requests." documentTitle="My adoption requests" subtitle="Every request you’ve sent, and where it stands.">
      {!items && !failed && (
        <div className={styles.center}>
          <Spinner size={32} label="Loading your requests" />
        </div>
      )}
      {failed && <EmptyState title="Let’s try that again." text="We couldn’t load your requests right now." />}
      {items && items.length === 0 && (
        <EmptyState
          title="No adoption requests yet."
          text="When a companion catches your eye, open their profile and send an adoption request."
          action={<Button to={ROUTES.findPet}>Find a pet</Button>}
        />
      )}
      {items && items.length > 0 && (
        <>
          {[
            ['Active', open],
            ['Closed', past],
          ].map(([label, list]) =>
            (list as MyRequest[]).length ? (
              <section key={label as string} className={styles.section} aria-label={`${label} requests`}>
                <h2 className={styles.heading}>{label as string}</h2>
                <ul role="list" className={styles.list}>
                  {(list as MyRequest[]).map((r) => (
                    <li key={r.id}>
                      <Link to={requestPath(r.id)} className={styles.row}>
                        <span className={`${styles.thumb} ${styles[`tone_${r.listing.artworkTone}`]}`}>
                          <img src={r.listing.thumbUrl ?? artworkFor(r.listing.artworkTone)} alt="" />
                        </span>
                        <span className={styles.text}>
                          <span className={styles.name}>{r.listing.name}</span>
                          <span className={styles.meta}>
                            {[r.listing.listerName, r.listing.city].filter(Boolean).join(' · ')} · Sent{' '}
                            {new Date(r.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
                          </span>
                        </span>
                        <StatusPill status={r.status} />
                        <Icon name="chevronRight" size={16} className={styles.chevron} />
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            ) : null,
          )}
        </>
      )}
    </AppPage>
  );
}
