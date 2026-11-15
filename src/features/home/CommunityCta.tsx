import ctaPaw from '../../assets/figma/cta-paw.svg';
import { Button } from '../../components/ui/Button';
import { Icon } from '../../components/ui/Icon';
import { ROUTES } from '../../lib/routes';
import styles from './CommunityCta.module.css';

export function CommunityCta() {
  return (
    <section className={styles.section} aria-labelledby="community-heading">
      <div className="container">
        <div className={styles.panel}>
          <div className={styles.copy}>
            <p className={styles.eyebrow}>For every new beginning</p>
            <h2 id="community-heading" className={styles.title}>
              Their person is out there.
              <br />
              Help them find each other.
            </h2>
            <p className={styles.text}>Create a thoughtful listing and connect with people ready to care.</p>
          </div>
          <div className={styles.aside}>
            <img src={ctaPaw} alt="" width={160} height={159} className={styles.paw} />
            <Button to={ROUTES.postPet} variant="accent" size="lg" className={styles.button} iconStart={<Icon name="plus" size={18} strokeWidth={2} />}>
              Post a pet
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
