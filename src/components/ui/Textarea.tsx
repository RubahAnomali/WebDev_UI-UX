import { useId, type ReactNode, type Ref, type TextareaHTMLAttributes } from 'react';
import { Icon } from './Icon';
import fieldStyles from './TextField.module.css';
import styles from './Textarea.module.css';

interface TextareaProps extends Omit<TextareaHTMLAttributes<HTMLTextAreaElement>, 'id'> {
  label: string;
  error?: string;
  hint?: ReactNode;
  id?: string;
  ref?: Ref<HTMLTextAreaElement>;
  /** Shows a live character count when maxLength is set. */
  showCount?: boolean;
}

export function Textarea({ label, error, hint, id, className, ref, showCount, maxLength, value, ...rest }: TextareaProps) {
  const autoId = useId();
  const areaId = id ?? `textarea-${autoId}`;
  const errorId = error ? `${areaId}-error` : undefined;
  const hintId = hint || (showCount && maxLength) ? `${areaId}-hint` : undefined;
  const length = typeof value === 'string' ? value.length : 0;
  return (
    <div className={[fieldStyles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={areaId} className={fieldStyles.label}>
        {label}
      </label>
      <div className={`${fieldStyles.control} ${styles.control} ${error ? fieldStyles.invalid : ''}`}>
        <textarea
          ref={ref}
          id={areaId}
          className={`${fieldStyles.input} ${styles.textarea}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          maxLength={maxLength}
          value={value}
          {...rest}
        />
      </div>
      {error && (
        <p id={errorId} className={fieldStyles.error}>
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      )}
      {(hint || (showCount && maxLength)) && (
        <p id={hintId} className={`${fieldStyles.hint} ${styles.hintRow}`}>
          <span>{hint}</span>
          {showCount && maxLength && (
            <span className={styles.count} aria-live="off">
              {length}/{maxLength}
            </span>
          )}
        </p>
      )}
    </div>
  );
}
