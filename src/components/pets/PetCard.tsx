import { Link } from 'react-router-dom';
import { petPath } from '../../lib/routes';
import { artworkFor } from '../../services/pets/artwork';
import { feeLabel, SEX_LABEL } from '../../services/pets/petsService';
import type { PetSummary } from '../../services/pets/types';
import { Icon } from '../ui/Icon';
import styles from './PetCard.module.css';

interface PetCardProps {
  pet: PetSummary;
  /** `featured` = homepage card (6:2); `browse` = Find a pet / Saved pets card (14:37, 14:41). */
  variant?: 'featured' | 'browse';
  saved?: boolean;
  onToggleSave?: (pet: PetSummary) => void;
  headingLevel?: 'h2' | 'h3';
}

const LISTING_LABEL = { adoption: 'Adoption', rehoming: 'Rehoming' } as const;

export function PetCard({ pet, variant = 'featured', saved = false, onToggleSave, headingLevel: Heading = 'h3' }: PetCardProps) {
  const fee = feeLabel(pet.fee, pet.listingType);
  const sex = pet.sex ? SEX_LABEL[pet.sex] : null;
  const meta = [pet.breed, pet.ageLabel].filter(Boolean).join(' · ');
  const unavailable = pet.status !== 'live';
  const href = petPath(pet.id);

  return (
    <article className={`${styles.card} ${styles[variant]}`} aria-labelledby={`pet-${pet.id}-name`}>
      <div className={`${styles.media} ${styles[`tone_${pet.artworkTone}`]}`}>
        {pet.cover ? (
          <img
            src={pet.cover.url}
            alt={`Photo of ${pet.name}`}
            className={styles.photo}
            width={pet.cover.width}
            height={pet.cover.height}
            loading="lazy"
          />
        ) : (
          <img src={artworkFor(pet.artworkTone)} alt="" className={styles.art} width={306} height={231} loading="lazy" />
        )}
        {pet.listingType && (
          <span className={`${styles.badge} ${styles[pet.listingType]}`}>{LISTING_LABEL[pet.listingType]}</span>
        )}
        {unavailable && <span className={styles.unavailable}>{pet.status === 'rehomed' ? 'Found a home' : 'Not available'}</span>}
        {onToggleSave && (
          <button
            type="button"
            className={styles.save}
            aria-pressed={saved}
            aria-label={saved ? `Remove ${pet.name} from saved pets` : `Save ${pet.name}`}
            onClick={() => onToggleSave(pet)}
          >
            <Icon name="heart" size={17} />
          </button>
        )}
      </div>

      <div className={styles.body}>
        <div className={styles.titleRow}>
          <Heading id={`pet-${pet.id}-name`} className={styles.name}>
            {/* Stretched link: the whole card is clickable with a single tab stop. */}
            <Link to={href} className={styles.link}>
              {pet.name}
            </Link>
          </Heading>
          <p className={styles.fee}>
            <span className={styles.feeKind}>{fee.kind}</span>
            <span className={styles.feeAmount}>{fee.amount}</span>
          </p>
        </div>
        {meta && <p className={styles.meta}>{meta}</p>}

        {variant === 'featured' ? (
          <>
            {sex && <p className={styles.sex}>{sex}</p>}
            {pet.city && (
              <p className={styles.location}>
                <Icon name="pin" size={15} />
                <span>
                  {pet.city}
                  {pet.distanceMiles != null && ` · ${pet.distanceMiles} miles away`}
                </span>
              </p>
            )}
            <div className={styles.footer}>
              <span className={styles.lister}>
                <span className="visually-hidden">Listed by </span>
                {pet.lister.name}
                {pet.lister.verified && (
                  <span className={styles.verified} title="Verified shelter">
                    <Icon name="check" size={12} strokeWidth={2.4} />
                    <span className="visually-hidden"> (verified)</span>
                  </span>
                )}
              </span>
              <Icon name="chevronRight" size={14} className={styles.chevron} />
            </div>
          </>
        ) : (
          <>
            <p className={styles.sex}>
              {[sex, pet.city].filter(Boolean).join(' · ')}
              {pet.distanceMiles != null && ` · ${pet.distanceMiles} mi`}
            </p>
            <div className={styles.footer}>
              <span className={styles.meet} aria-hidden="true">
                Meet {pet.name} <Icon name="arrowRight" size={14} />
              </span>
            </div>
          </>
        )}
      </div>
    </article>
  );
}

export function PetCardSkeleton({ variant = 'featured' }: { variant?: 'featured' | 'browse' }) {
  return (
    <div className={`${styles.card} ${styles[variant]} ${styles.skeleton}`} aria-hidden="true">
      <div className={`${styles.media} ${styles.shimmer}`} />
      <div className={styles.body}>
        <div className={`${styles.line} ${styles.shimmer}`} style={{ width: '45%', height: 24 }} />
        <div className={`${styles.line} ${styles.shimmer}`} style={{ width: '75%' }} />
        <div className={`${styles.line} ${styles.shimmer}`} style={{ width: '30%' }} />
        <div className={`${styles.line} ${styles.shimmer}`} style={{ width: '60%' }} />
      </div>
    </div>
  );
}
