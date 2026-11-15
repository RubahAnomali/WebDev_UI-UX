import { evaluatePassword } from '../../features/auth/passwordStrength';
import { Icon } from './Icon';
import styles from './PasswordStrength.module.css';

interface PasswordStrengthProps {
  password: string;
  id?: string;
  showMeter?: boolean;
  showRules?: boolean;
}

/**
 * Live strength meter + rule checklist. Rules are communicated in text and
 * icons, never by colour alone.
 */
export function PasswordStrength({ password, id, showMeter = true, showRules = true }: PasswordStrengthProps) {
  const result = evaluatePassword(password);
  const empty = password.length === 0;
  return (
    <div className={styles.wrap} id={id}>
      {showMeter && (
      <div
        className={styles.track}
        role="meter"
        aria-label="Password strength"
        aria-valuemin={0}
        aria-valuemax={4}
        aria-valuenow={result.score}
        aria-valuetext={empty ? 'No password entered' : result.label}
      >
        <div className={`${styles.bar} ${styles[`s${result.score}`]}`} style={{ width: `${(result.score / 4) * 100}%` }} />
      </div>
      )}
      {showMeter && !empty && (
        <p className={`${styles.label} ${styles[`t${result.score}`]}`} aria-live="polite">
          {result.label}
        </p>
      )}
      {showRules && (
      <ul className={styles.rules} role="list" aria-label="Password requirements">
        {result.rules.map((rule) => (
          <li key={rule.id} className={rule.met ? styles.met : styles.unmet}>
            <Icon name={rule.met ? 'check' : 'info'} size={14} strokeWidth={2} />
            <span>
              {rule.label}
              <span className="visually-hidden">{rule.met ? ' — met' : ' — not yet met'}</span>
            </span>
          </li>
        ))}
      </ul>
      )}
    </div>
  );
}
