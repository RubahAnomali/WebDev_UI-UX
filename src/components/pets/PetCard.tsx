import { Link } from 'react-router-dom';
import { Icon } from '../ui/Icon';
import type { PetSummary } from '../../services/pets/types';
import styles from './PetCard.module.css';

interface PetCardProps {
  pet: PetSummary;
  saved?: boolean;
  onToggleSave?: (pet: PetSummary) => void;
  /** Where the card links to (pet profile). */
  href: string;
  headingLevel?: 'h3' | 'h4';
}

const LISTING_LABEL = { adoption: 'Adoption', rehoming: 'Rehoming' } as const;

export function PetCard({ pet, saved = false, onToggleSave, href, headingLevel: Heading = 'h3' }: PetCardProps) {
  const feeLabel = pet.fee > 0 ? `$${pet.fee}` : 'No fee';
  const feeKind = pet.listingType === 'adoption' ? 'Adoption fee' : 'Rehoming fee';

  return (
    <article className={styles.card} aria-labelledby={`${pet.id}-name`}>
      <div className={styles.media}>
        <img src={pet.artwork} alt="" className={styles.art} width={306} height={231} loading="lazy" />
        <span className={`${styles.badge} ${styles[pet.listingType]}`}>{LISTING_LABEL[pet.listingType]}</span>
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
          <Heading id={`${pet.id}-name`} className={styles.name}>
            {/* The stretched link makes the whole card clickable while keeping one tab stop. */}
            <Link to={href} className={styles.link}>
              {pet.name}
            </Link>
          </Heading>
          <p className={styles.fee}>
            <span className="visually-hidden">{feeKind}: </span>
            {feeLabel}
          </p>
        </div>
        <p className={styles.meta}>
          {pet.breed} · {pet.age}
        </p>
        <p className={styles.sex}>{pet.sex}</p>
        <p className={styles.location}>
          <Icon name="pin" size={15} />
          <span>
            {pet.city}
            {pet.distanceMiles !== undefined && ` · ${pet.distanceMiles} miles away`}
          </span>
        </p>
        <div className={styles.footer}>
          <span className={styles.lister}>
            <span className="visually-hidden">Listed by </span>
            {pet.lister.name}
          </span>
          <Icon name="chevronRight" size={14} className={styles.chevron} />
        </div>
      </div>
    </article>
  );
}

export function PetCardSkeleton() {
  return (
    <div className={`${styles.card} ${styles.skeleton}`} aria-hidden="true">
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
