import { useEffect, useState } from 'react';
import { Link, useLocation, useParams } from 'react-router-dom';
import { AppPageShell } from '../../components/layout/AppPageShell';
import { Alert } from '../../components/ui/Alert';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { Icon } from '../../components/ui/Icon';
import { Spinner } from '../../components/ui/Spinner';
import {
  applyPath,
  editListingPath,
  messageListingPath,
  reportPath,
  requestPath,
  ROUTES,
} from '../../lib/routes';
import { useDocumentTitle } from '../../lib/useDocumentTitle';
import { ApiRequestError } from '../../services/api/client';
import { useAuth } from '../../services/auth/AuthContext';
import { artworkFor } from '../../services/pets/artwork';
import { feeLabel, petsService, SEX_LABEL } from '../../services/pets/petsService';
import { useSavedPets } from '../../services/pets/SavedPetsContext';
import type { PetDetail } from '../../services/pets/types';
import styles from './PetProfilePage.module.css';

const YES_NO: Record<string, string> = { yes: 'Yes', no: 'No', unknown: 'Unknown' };
const ENERGY: Record<string, string> = { low: 'Low', moderate: 'Moderate', high: 'High' };
const GOOD_WITH: Record<string, string> = { children: 'Children', dogs: 'Dogs', cats: 'Cats', adults: 'Adults' };
const SPECIES_PLURAL: Record<string, string> = { dog: 'Dogs', cat: 'Cats', small: 'Small pets', bird: 'Birds & more' };

const STATUS_NOTICE: Record<string, string> = {
  draft: 'This listing is a draft and isn’t visible to anyone else yet.',
  pending: 'This listing is pending review. It isn’t public yet.',
  changes_requested: 'Our moderators asked for a few changes before this listing can go live.',
  paused: 'This listing is paused and hidden from search.',
  rejected: 'This listing wasn’t approved and isn’t visible to the community.',
};

type State = { kind: 'loading' } | { kind: 'missing' } | { kind: 'error' } | { kind: 'ready'; pet: PetDetail };

/** Figma 14:39 — Pet profile. */
export function PetProfilePage() {
  const { petId = '' } = useParams();
  const { user } = useAuth();
  const location = useLocation();
  const { isSaved, toggle } = useSavedPets();
  const [state, setState] = useState<State>({ kind: 'loading' });
  const [attempt, setAttempt] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);

  const [lastId, setLastId] = useState(petId);
  if (lastId !== petId) {
    setLastId(petId);
    setState({ kind: 'loading' });
    setPhotoIndex(0);
  }

  useEffect(() => {
    const controller = new AbortController();
    petsService
      .get(petId, controller.signal)
      .then((pet) => setState({ kind: 'ready', pet }))
      .catch((err: unknown) => {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        setState({ kind: err instanceof ApiRequestError && err.status === 404 ? 'missing' : 'error' });
      });
    return () => controller.abort();
  }, [petId, attempt, user?.id]);

  useDocumentTitle(state.kind === 'ready' ? `Meet ${state.pet.name}` : 'Pet profile');

  if (state.kind === 'loading') {
    return (
      <AppPageShell>
        <div className={styles.center}>
          <Spinner size={32} label="Loading pet profile" />
        </div>
      </AppPageShell>
    );
  }

  if (state.kind === 'missing' || state.kind === 'error') {
    return (
      <AppPageShell>
        <div className={styles.stateWrap}>
          <EmptyState
            title={state.kind === 'missing' ? 'This chapter has moved on.' : 'Let’s try that again.'}
            text={
              state.kind === 'missing'
                ? 'This pet is no longer available. There are more companions waiting for a loving home.'
                : 'We couldn’t load this profile right now. Please try again.'
            }
            action={
              state.kind === 'missing' ? (
                <Button to={ROUTES.findPet}>Find other pets</Button>
              ) : (
                <Button variant="secondary" onClick={() => setAttempt((a) => a + 1)}>
                  Try again
                </Button>
              )
            }
          />
        </div>
      </AppPageShell>
    );
  }

  const { pet } = state;
  const fee = feeLabel(pet.fee, pet.listingType);
  const isOrg = pet.lister.type === 'organization';
  const listerNoun = isOrg ? 'shelter' : 'pet parent';
  const meta = [pet.breed, pet.ageLabel, pet.sex ? SEX_LABEL[pet.sex] : null, pet.city].filter(Boolean).join(' · ');
  const saved = isSaved(pet.id);
  const photo = pet.photos[photoIndex];
  const loginFor = (path: string) => `${ROUTES.login}?next=${encodeURIComponent(path)}`;
  const rehomed = pet.status === 'rehomed';
  const isLive = pet.status === 'live';

  const health: [string, string | null][] = [
    ['Vaccinated', pet.health.vaccinated ? YES_NO[pet.health.vaccinated] ?? null : null],
    ['Spayed / neutered', pet.health.spayedNeutered ? YES_NO[pet.health.spayedNeutered] ?? null : null],
    ['Microchipped', pet.health.microchipped ? YES_NO[pet.health.microchipped] ?? null : null],
    ['House trained', pet.health.houseTrained ? YES_NO[pet.health.houseTrained] ?? null : null],
    ['Energy level', pet.energyLevel ? ENERGY[pet.energyLevel] ?? pet.energyLevel : null],
    ['Comfortable with', pet.goodWith.length ? pet.goodWith.map((g) => GOOD_WITH[g] ?? g).join(', ') : null],
    ['Care needs', pet.careNeeds],
    ['Medical needs', pet.medicalNotes],
    ['Behavior & special care', pet.behaviorNotes],
  ];

  return (
    <AppPageShell>
      <div className={`container ${styles.page}`}>
        <nav aria-label="Breadcrumb" className={styles.breadcrumb}>
          <ol role="list">
            <li>
              <Link to={ROUTES.findPet}>Find a pet</Link>
            </li>
            {pet.species && (
              <li>
                <Link to={`${ROUTES.findPet}?type=${pet.species}`}>{SPECIES_PLURAL[pet.species]}</Link>
              </li>
            )}
            <li aria-current="page">{pet.name}</li>
          </ol>
        </nav>

        {pet.viewer.isOwner && !isLive && STATUS_NOTICE[pet.status] && (
          <Alert tone="info" title="Only you can see this preview." className={styles.notice}>
            {STATUS_NOTICE[pet.status]} <Link to={ROUTES.myListings}>Go to My listings</Link>
          </Alert>
        )}
        {rehomed && (
          <Alert tone="success" title={`${pet.name} has found a home.`} className={styles.notice}>
            This listing is closed. There are more companions waiting — <Link to={ROUTES.findPet}>find other pets</Link>.
          </Alert>
        )}
        {pet.isSample && (
          <p className={styles.sampleNote}>
            <Icon name="info" size={16} />
            Sample listing for demonstration — not a real pet available for adoption.
          </p>
        )}

        <div className={styles.layout}>
          <div className={styles.main}>
            <h1 className={styles.title}>Meet {pet.name}.</h1>
            <p className={styles.meta}>{meta}</p>

            <div className={`${styles.gallery} ${styles[`tone_${pet.artworkTone}`]}`}>
              {photo ? (
                <img
                  src={photo.url}
                  alt={`Photo ${photoIndex + 1} of ${pet.photos.length} of ${pet.name}`}
                  className={styles.photo}
                  width={photo.width}
                  height={photo.height}
                />
              ) : (
                <img src={artworkFor(pet.artworkTone)} alt="" className={styles.art} />
              )}
              {pet.listingType && (
                <span className={styles.badge}>{pet.listingType === 'adoption' ? 'Adoption' : 'Rehoming'}</span>
              )}
              {isLive && !pet.viewer.isOwner && (
                <button
                  type="button"
                  className={styles.save}
                  aria-pressed={saved}
                  aria-label={saved ? `Remove ${pet.name} from saved pets` : `Save ${pet.name}`}
                  onClick={() => toggle(pet)}
                >
                  <Icon name="heart" size={18} />
                </button>
              )}
            </div>
            {pet.photos.length > 1 && (
              <ul role="list" className={styles.thumbs} aria-label="More photos">
                {pet.photos.map((p, i) => (
                  <li key={p.id}>
                    <button
                      type="button"
                      className={styles.thumb}
                      aria-pressed={i === photoIndex}
                      aria-label={`Show photo ${i + 1}`}
                      onClick={() => setPhotoIndex(i)}
                    >
                      <img src={p.thumbUrl} alt="" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {pet.headline && <h2 className={styles.headline}>{pet.headline}</h2>}
            {pet.about && <p className={styles.about}>{pet.about}</p>}
            {pet.traits.length > 0 && (
              <ul role="list" className={styles.chips} aria-label="Personality">
                {pet.traits.map((t) => (
                  <li key={t}>{t}</li>
                ))}
              </ul>
            )}

            {pet.idealHome && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>The right home</h2>
                <p className={styles.sectionText}>{pet.idealHome}</p>
              </section>
            )}
            {pet.rehomingReason && (
              <section className={styles.section}>
                <h2 className={styles.sectionTitle}>Why {pet.name} needs a new home</h2>
                <p className={styles.sectionText}>{pet.rehomingReason}</p>
              </section>
            )}

            <section className={styles.section}>
              <h2 className={styles.sectionTitle}>Health &amp; everyday care</h2>
              <dl className={styles.table}>
                {health
                  .filter(([, v]) => v)
                  .map(([k, v]) => (
                    <div key={k} className={styles.row}>
                      <dt>{k}</dt>
                      <dd>{v}</dd>
                    </div>
                  ))}
              </dl>
            </section>
          </div>

          <aside className={styles.side} aria-label={`About adopting ${pet.name}`}>
            <div className={styles.card}>
              <h2 className={styles.cardTitle}>A home for {pet.name}</h2>
              <p className={styles.feeKind}>{fee.kind}</p>
              <p className={styles.feeAmount}>{fee.amount}</p>
              <p className={styles.small}>
                {isOrg ? 'Helps cover veterinary care and rescue costs.' : 'Helps ensure a committed new home.'}
                <br />
                No payment is collected on Pawhaven.
              </p>

              <div className={styles.actions}>
                {pet.viewer.isOwner ? (
                  <Button to={editListingPath(pet.id)} block>
                    Edit this listing
                  </Button>
                ) : !isLive ? null : pet.viewer.requestId ? (
                  <Button to={requestPath(pet.viewer.requestId)} block>
                    View your adoption request
                  </Button>
                ) : (
                  <Button to={user ? applyPath(pet.id) : loginFor(applyPath(pet.id))} block>
                    Send adoption request
                  </Button>
                )}
                {!pet.viewer.isOwner && isLive && (
                  <Button
                    to={user ? messageListingPath(pet.id) : loginFor(location.pathname)}
                    variant="secondary"
                    block
                  >
                    Message the {listerNoun}
                  </Button>
                )}
              </div>

              <div className={styles.lister}>
                <Icon name="paw" size={40} className={styles.listerIcon} />
                <div>
                  <p className={styles.listerName}>
                    {pet.lister.name}
                    {pet.lister.verified && (
                      <span className={styles.verified}>
                        <Icon name="check" size={12} strokeWidth={2.4} /> Verified
                      </span>
                    )}
                  </p>
                  <p className={styles.listerMeta}>
                    {[pet.listerCity, isOrg ? 'Shelter / rescue' : 'Pet parent'].filter(Boolean).join(' · ')}
                  </p>
                </div>
              </div>

              <p className={styles.small}>
                Meet first. Ask for health records.
                <br />
                Never send money before meeting a pet.
              </p>
              {!pet.viewer.isOwner && (
                <Link to={reportPath('listing', pet.id)} className={styles.report}>
                  Report this listing
                </Link>
              )}
            </div>

            <div className={styles.guidance}>
              <h2 className={styles.guidanceTitle}>A match, not a transaction.</h2>
              <p>
                An adoption request starts a conversation. The {listerNoun} will review your home and lifestyle before
                arranging a meeting.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </AppPageShell>
  );
}
