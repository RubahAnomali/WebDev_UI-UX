import { useId } from 'react';
import styles from './SegmentedChoice.module.css';

export interface ChoiceOption<T extends string> {
  value: T;
  label: string;
  description?: string;
}

interface SegmentedChoiceProps<T extends string> {
  legend: string;
  name: string;
  value: T;
  options: ChoiceOption<T>[];
  onChange: (value: T) => void;
  /** Optional helper describing the current choice. */
  help?: string;
}

/**
 * A native radio group styled as Figma's pill toggle. Native radios give us
 * arrow-key navigation and correct screen-reader semantics for free.
 */
export function SegmentedChoice<T extends string>({
  legend,
  name,
  value,
  options,
  onChange,
  help,
}: SegmentedChoiceProps<T>) {
  const helpId = useId();
  return (
    <fieldset className={styles.fieldset} aria-describedby={help ? helpId : undefined}>
      <legend className={styles.legend}>{legend}</legend>
      <div className={styles.options}>
        {options.map((opt) => (
          <label key={opt.value} className={styles.option}>
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={value === opt.value}
              onChange={() => onChange(opt.value)}
              className={styles.input}
            />
            <span className={styles.pill}>{opt.label}</span>
          </label>
        ))}
      </div>
      {help && (
        <p id={helpId} className={styles.help} aria-live="polite">
          {help}
        </p>
      )}
    </fieldset>
  );
}
