import heroArtwork from '../../assets/figma/hero-artwork.svg';
import loveBadge from '../../assets/figma/love-badge.svg';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ROUTES } from '../../lib/routes';
import { Link } from 'react-router-dom';
import styles from './Hero.module.css';

export function Hero() {
  return (
    <section className={styles.hero} aria-labelledby="hero-title">
      <div className={`container ${styles.grid}`}>
        <div className={styles.copy}>
          <p className={styles.eyebrow}>
            <Icon name="paw" size={16} />
            Little paws. Big possibilities.
          </p>
          <h1 id="hero-title" className={styles.title}>
            A best friend.
            <br />
            A fresh start.
          </h1>
          <p className={styles.lead}>
            Find a companion. Give them a loving home.
            <br className={styles.br} /> Connect with shelters and caring pet parents near you.
          </p>
          <Button to={ROUTES.findPet} size="lg" iconEnd={<Icon name="arrowRight" size={20} />} className={styles.cta}>
            Meet your new friend
          </Button>
          <p className={styles.rehome}>
            <span>Rehoming a pet?</span>
            <Link to={ROUTES.rehomingGuide} className={styles.rehomeLink}>
              We’re here to help <span aria-hidden="true">↗</span>
            </Link>
          </p>
        </div>

        <figure className={styles.visual}>
          <img src={heroArtwork} alt="" className={styles.art} width={594} height={510} />
          <div className={styles.card}>
            <img src={loveBadge} alt="" width={44} height={44} />
            <div>
              <p className={styles.cardTitle}>A little love.</p>
              <p className={styles.cardSub}>A whole new life.</p>
            </div>
          </div>
          <figcaption className={styles.caption}>A home for every kind of companion.</figcaption>
        </figure>
      </div>
    </section>
  );
}
