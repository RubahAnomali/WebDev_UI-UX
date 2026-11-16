import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PetCard, PetCardSkeleton } from '../../components/pets/PetCard';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ROUTES } from '../../lib/routes';
import { petsService as defaultPetsService, type PetsService } from '../../services/pets/petsService';
import { useSavedPets } from '../../services/pets/SavedPetsContext';
import type { PetSummary } from '../../services/pets/types';
import shared from './HomeSection.module.css';
import styles from './FeaturedPets.module.css';

type LoadState = { kind: 'loading' } | { kind: 'error' } | { kind: 'ready'; pets: PetSummary[] };

export function FeaturedPets({ service = defaultPetsService }: { service?: Pick<PetsService, 'getFeatured'> }) {
  const { isSaved, toggle } = useSavedPets();
  const [state, setState] = useState<LoadState>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    const controller = new AbortController();
    service
      .getFeatured(controller.signal)
      .then((pets) => setState({ kind: 'ready', pets }))
      .catch((err: unknown) => {
        if (!(err instanceof DOMException && err.name === 'AbortError')) setState({ kind: 'error' });
      });
    return () => controller.abort();
  }, [service, attempt]);

  const retry = useCallback(() => {
    setState({ kind: 'loading' });
    setAttempt((a) => a + 1);
  }, []);

  const showsSamples = state.kind === 'ready' && state.pets.some((p) => p.isSample);

  return (
    <section id="featured-pets" className={styles.section} aria-labelledby="featured-heading">
      <div className="container">
        <div className={styles.head}>
          <div>
            <h2 id="featured-heading" className={shared.title}>
              A few faces. A whole lot of love.
            </h2>
            <p className={shared.subtitle}>Meet some of the companions looking for their next chapter.</p>
          </div>
          <Link to={ROUTES.findPet} className={styles.viewAll}>
            View all pets
            <Icon name="arrowRight" size={20} />
          </Link>
        </div>

        {showsSamples && (
          <p className={styles.sampleNote}>
            <Icon name="info" size={16} />
            Sample listings for demonstration — not real pets available for adoption.
          </p>
        )}

        <div aria-live="polite" aria-busy={state.kind === 'loading'}>
          {state.kind === 'loading' && (
            <>
              <span className="visually-hidden">Loading companions…</span>
              <ul role="list" className={styles.grid}>
                {Array.from({ length: 4 }, (_, i) => (
                  <li key={i}>
                    <PetCardSkeleton />
                  </li>
                ))}
              </ul>
            </>
          )}

          {state.kind === 'error' && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>Let’s try that again.</p>
              <p className={styles.emptyText}>We couldn’t load companions right now. Check your connection and retry.</p>
              <Button variant="secondary" onClick={retry}>
                Try again
              </Button>
            </div>
          )}

          {state.kind === 'ready' && state.pets.length === 0 && (
            <div className={styles.empty}>
              <p className={styles.emptyTitle}>No companions to show just yet.</p>
              <p className={styles.emptyText}>New friends are listed every day. Browse all pets or check back soon.</p>
              <Button to={ROUTES.findPet} variant="secondary">
                Find a pet
              </Button>
            </div>
          )}

          {state.kind === 'ready' && state.pets.length > 0 && (
            <ul role="list" className={styles.grid}>
              {state.pets.map((pet) => (
                <li key={pet.id}>
                  <PetCard pet={pet} saved={isSaved(pet.id)} onToggleSave={toggle} />
                </li>
              ))}
            </ul>
          )}
        </div>

        <p className={styles.footnote}>A little patience, the right match, a lifetime of love.</p>
      </div>
    </section>
  );
}
