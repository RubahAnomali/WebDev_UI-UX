import { Icon } from './Icon';
import styles from './Stepper.module.css';

interface StepperProps {
  steps: string[];
  /** 1-based current step. */
  current: number;
  /** Highest step the person may jump to. */
  reachable: number;
  onSelect?: (step: number) => void;
}

/** The four-tile progress indicator from the Post a pet frames (14:47–14:53). */
export function Stepper({ steps, current, reachable, onSelect }: StepperProps) {
  return (
    <nav aria-label="Listing steps">
      <ol role="list" className={styles.steps}>
        {steps.map((label, i) => {
          const n = i + 1;
          const done = n < current;
          const isCurrent = n === current;
          const content = (
            <>
              <span className={styles.marker} aria-hidden="true">
                {done ? <Icon name="check" size={18} strokeWidth={2.2} /> : n}
              </span>
              <span className={styles.label}>
                {label}
                <span className="visually-hidden">{done ? ' (completed)' : isCurrent ? ' (current step)' : ''}</span>
              </span>
            </>
          );
          return (
            <li key={label}>
              {onSelect && n <= reachable && !isCurrent ? (
                <button type="button" className={`${styles.step} ${done ? styles.done : ''}`} onClick={() => onSelect(n)}>
                  {content}
                </button>
              ) : (
                <div className={`${styles.step} ${isCurrent ? styles.current : ''} ${done ? styles.done : ''}`} aria-current={isCurrent ? 'step' : undefined}>
                  {content}
                </div>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
