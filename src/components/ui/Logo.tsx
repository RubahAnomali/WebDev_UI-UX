import { Link } from 'react-router-dom';
import { Icon } from './Icon';
import styles from './Logo.module.css';

interface LogoProps {
  size?: 'md' | 'lg';
  /** Render as plain text (no link) — e.g. inside an existing link. */
  asText?: boolean;
}

export function Logo({ size = 'lg', asText = false }: LogoProps) {
  const content = (
    <>
      <Icon name="paw" size={size === 'lg' ? 40 : 34} className={styles.mark} />
      <span className={styles.word}>pawhaven</span>
    </>
  );
  const className = `${styles.logo} ${styles[size]}`;
  if (asText) return <span className={className}>{content}</span>;
  return (
    <Link to="/" className={className} aria-label="Pawhaven home">
      {content}
    </Link>
  );
}
