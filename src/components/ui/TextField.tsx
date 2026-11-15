import { useId, type InputHTMLAttributes, type ReactNode, type Ref } from 'react';
import { Icon } from './Icon';
import styles from './TextField.module.css';

export interface TextFieldProps extends Omit<InputHTMLAttributes<HTMLInputElement>, 'id'> {
  label: string;
  /** Persistent helper text shown under the field. */
  hint?: ReactNode;
  /** Validation message. When set the field is marked invalid. */
  error?: string;
  /** Element rendered inside the input on the right (e.g. visibility toggle). */
  trailing?: ReactNode;
  id?: string;
  ref?: Ref<HTMLInputElement>;
  /** Extra content between the input and the hint (e.g. strength meter). */
  after?: ReactNode;
}

export function TextField({
  label,
  hint,
  error,
  trailing,
  after,
  id,
  className,
  ref,
  ...inputProps
}: TextFieldProps) {
  const autoId = useId();
  const inputId = id ?? `field-${autoId}`;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const errorId = error ? `${inputId}-error` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  return (
    <div className={[styles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={inputId} className={styles.label}>
        {label}
      </label>
      <div className={`${styles.control} ${error ? styles.invalid : ''} ${trailing ? styles.hasTrailing : ''}`}>
        <input
          ref={ref}
          id={inputId}
          className={styles.input}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          {...inputProps}
        />
        {trailing && <div className={styles.trailing}>{trailing}</div>}
      </div>
      {after}
      {error && (
        <p id={errorId} className={styles.error}>
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={hintId} className={styles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
