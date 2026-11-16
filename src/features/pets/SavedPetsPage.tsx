import { useEffect, useState } from 'react';
import { AppPage } from '../../components/layout/AppPage';
import { PetCard, PetCardSkeleton } from '../../components/pets/PetCard';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { ROUTES } from '../../lib/routes';
import { petsService } from '../../services/pets/petsService';
import { useSavedPets } from '../../services/pets/SavedPetsContext';
import type { PetSummary } from '../../services/pets/types';
import styles from './SavedPetsPage.module.css';

type State = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; items: PetSummary[] };

/** Figma 14:41 — Saved pets (empty state from frame 22). */
export function SavedPetsPage() {
  const { isSaved, toggle } = useSavedPets();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    petsService
      .listSaved(controller.signal)
      .then((items) => setState({ kind: 'ready', items }))
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setState({ kind: 'error' });
      });
    return () => controller.abort();
  }, [attempt]);

  // Removing a pet hides it immediately; it reappears only after a reload if re-saved elsewhere.
  const items = state.kind === 'ready' ? state.items.filter((p) => isSaved(p.id)) : [];

  return (
    <AppPage title="A little room in your heart." documentTitle="Saved pets" subtitle="Your saved companions, all in one place. Availability can change.">
      {state.kind === 'loading' && (
        <ul role="list" className={styles.grid} aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <li key={i}>
              <PetCardSkeleton variant="browse" />
            </li>
          ))}
        </ul>
      )}

      {state.kind === 'error' && (
        <EmptyState
          title="Let’s try that again."
          text="We couldn’t load your saved pets right now."
          action={
            <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
              Try again
            </Button>
          }
        />
      )}

      {state.kind === 'ready' && items.length === 0 && (
        <EmptyState
          title="Your favorites start here."
          text={
            <>
              Save a pet while you explore. You’ll find
              <br />
              all your saved companions in this space.
            </>
          }
          action={<Button to={ROUTES.findPet}>Find a pet</Button>}
        />
      )}

      {state.kind === 'ready' && items.length > 0 && (
        <>
          <p className={styles.count} aria-live="polite">
            {items.length} saved {items.length === 1 ? 'pet' : 'pets'}
          </p>
          <ul role="list" className={styles.grid}>
            {items.map((pet) => (
              <li key={pet.id}>
                <PetCard pet={pet} variant="browse" saved onToggleSave={pet.status === 'live' ? toggle : undefined} />
              </li>
            ))}
          </ul>
          <section className={styles.reminder} aria-labelledby="saved-reminder">
            <h2 id="saved-reminder" className={styles.reminderTitle}>
              Found a face you can’t forget?
            </h2>
            <p className={styles.reminderText}>
              Open their profile to ask questions or start an adoption request. Saving a pet does not reserve them.
            </p>
          </section>
          <div className={styles.more}>
            <Button to={ROUTES.findPet} variant="secondary" size="lg">
              Discover more pets
            </Button>
          </div>
        </>
      )}
    </AppPage>
  );
}
