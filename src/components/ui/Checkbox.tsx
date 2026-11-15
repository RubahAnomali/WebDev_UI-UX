import { useId, type InputHTMLAttributes, type ReactNode } from 'react';
import { Icon } from './Icon';
import styles from './Checkbox.module.css';

interface CheckboxProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'type' | 'id'> {
  label: ReactNode;
  error?: string;
  id?: string;
}

export function Checkbox({ label, error, id, className, ...rest }: CheckboxProps) {
  const autoId = useId();
  const inputId = id ?? `check-${autoId}`;
  const errorId = error ? `${inputId}-error` : undefined;
  return (
    <div className={[styles.wrapper, className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className={styles.row}>
        <span className={styles.boxWrap}>
          <input
            id={inputId}
            type="checkbox"
            className={styles.input}
            aria-invalid={error ? true : undefined}
            aria-describedby={errorId}
            {...rest}
          />
          <span className={`${styles.box} ${error ? styles.invalid : ''}`} aria-hidden="true">
            <Icon name="check" size={14} strokeWidth={2.4} />
          </span>
        </span>
        <span className={styles.label}>{label}</span>
      </label>
      {error && (
        <p id={errorId} className={styles.error}>
          {error}
        </p>
      )}
    </div>
  );
}
