import { Link } from 'react-router-dom';
import emblem from '../../assets/figma/emblem-responsible.svg';
import { Icon } from '../../components/ui/Icon';
import { ROUTES } from '../../lib/routes';
import styles from './SafetyPanel.module.css';

export function SafetyPanel() {
  return (
    <section className={styles.section} aria-labelledby="safety-heading">
      <div className="container">
        <div className={styles.panel}>
          <img src={emblem} alt="" width={66} height={66} className={styles.emblem} />
          <div className={styles.copy}>
            <h2 id="safety-heading" className={styles.title}>
              Good homes. Thoughtful connections.
            </h2>
            <p className={styles.text}>
              Meet in person. Ask for health records. Never send a deposit before meeting your pet.
              <br className={styles.br} /> We encourage adoption and responsible rehoming, always with animal welfare
              first.
            </p>
          </div>
          <Link to={ROUTES.safety} className={styles.link}>
            Read our safety guide
            <Icon name="arrowRight" size={19} strokeWidth={1.5} />
          </Link>
        </div>
      </div>
    </section>
  );
}
