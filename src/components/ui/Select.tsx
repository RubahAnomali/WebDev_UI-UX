import { useId, type ReactNode, type Ref, type SelectHTMLAttributes } from 'react';
import { Icon } from './Icon';
import fieldStyles from './TextField.module.css';
import styles from './Select.module.css';

export interface SelectOption {
  value: string;
  label: string;
}

interface SelectProps extends Omit<SelectHTMLAttributes<HTMLSelectElement>, 'id'> {
  label: string;
  options: SelectOption[];
  /** Shown as the first, empty option. */
  placeholder?: string;
  error?: string;
  hint?: ReactNode;
  id?: string;
  ref?: Ref<HTMLSelectElement>;
}

/** Native select styled like TextField — keeps platform keyboard and screen-reader support. */
export function Select({ label, options, placeholder, error, hint, id, className, ref, ...rest }: SelectProps) {
  const autoId = useId();
  const selectId = id ?? `select-${autoId}`;
  const errorId = error ? `${selectId}-error` : undefined;
  const hintId = hint ? `${selectId}-hint` : undefined;
  return (
    <div className={[fieldStyles.field, className].filter(Boolean).join(' ')}>
      <label htmlFor={selectId} className={fieldStyles.label}>
        {label}
      </label>
      <div className={`${fieldStyles.control} ${error ? fieldStyles.invalid : ''}`}>
        <select
          ref={ref}
          id={selectId}
          className={`${fieldStyles.input} ${styles.select}`}
          aria-invalid={error ? true : undefined}
          aria-describedby={[errorId, hintId].filter(Boolean).join(' ') || undefined}
          {...rest}
        >
          {placeholder !== undefined && <option value="">{placeholder}</option>}
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
        <Icon name="chevronDown" size={18} className={styles.chevron} />
      </div>
      {error && (
        <p id={errorId} className={fieldStyles.error}>
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </p>
      )}
      {hint && (
        <p id={hintId} className={fieldStyles.hint}>
          {hint}
        </p>
      )}
    </div>
  );
}
