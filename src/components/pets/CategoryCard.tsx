import { Link } from 'react-router-dom';
import styles from './CategoryCard.module.css';

interface CategoryCardProps {
  title: string;
  tagline: string;
  emblem: string;
  href: string;
  tone?: 'green' | 'sand';
}

export function CategoryCard({ title, tagline, emblem, href, tone = 'sand' }: CategoryCardProps) {
  return (
    <Link to={href} className={`${styles.card} ${styles[tone]}`}>
      <img src={emblem} alt="" width={56} height={56} className={styles.emblem} />
      <span className={styles.text}>
        <span className={styles.title}>{title}</span>
        <span className={styles.tagline}>{tagline}</span>
      </span>
    </Link>
  );
}
