import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import emblem from '../../assets/figma/emblem-email.svg';
import { AppPageShell } from '../../components/layout/AppPageShell';
import { Button } from '../../components/ui/Button';
import { StatusPill } from '../../components/ui/StatusPill';
import { petPath, ROUTES } from '../../lib/routes';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { myListingsService } from '../../services/listings/myListingsService';
import styles from './ListingSubmittedPage.module.css';

/** Figma 14:55 — Listing submitted. */
export function ListingSubmittedPage() {
  const { listingId = '' } = useParams();
  const [name, setName] = useState<string | null>(null);
  useDocumentTitle('Listing submitted');

  useEffect(() => {
    const controller = new AbortController();
    myListingsService
      .get(listingId, controller.signal)
      .then((l) => setName(l.name))
      .catch(() => setName(''));
    return () => controller.abort();
  }, [listingId]);

  const pet = name || 'Your pet';
  return (
    <AppPageShell>
      <div className={`container ${styles.wrap}`}>
        <section className={styles.card} aria-labelledby="submitted-title">
          <img src={emblem} alt="" width={128} height={118} className={styles.emblem} />
          <h1 id="submitted-title" className={styles.title}>
            {pet}’s next chapter starts here.
          </h1>
          <p className={styles.lead} role="status">
            Your listing has been submitted for review.
          </p>
          <StatusPill status="pending" label="Pending review" />
          <p className={styles.text}>
            It isn’t public yet. We’ll notify you when the review is complete.
            <br />
            You can edit your details or follow its status from My listings.
          </p>
          <div className={styles.actions}>
            <Button to={ROUTES.myListings} size="lg" block>
              Go to My listings
            </Button>
            <Button to={petPath(listingId)} variant="secondary" size="lg" block>
              Preview {pet === 'Your pet' ? 'your' : `${pet}’s`} listing
            </Button>
          </div>
        </section>
        <p className={styles.footnote}>A little care now makes a big difference later.</p>
      </div>
    </AppPageShell>
  );
}
