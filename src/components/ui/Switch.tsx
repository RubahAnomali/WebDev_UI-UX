import { useId } from 'react';
import styles from './Switch.module.css';

interface SwitchProps {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  disabled?: boolean;
}

/** On/off switch (Figma 14:63 notification toggles) with role="switch". */
export function Switch({ label, description, checked, onChange, disabled }: SwitchProps) {
  const id = useId();
  return (
    <div className={styles.row}>
      <div className={styles.text}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {description && (
          <p id={`${id}-d`} className={styles.description}>
            {description}
          </p>
        )}
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        aria-describedby={description ? `${id}-d` : undefined}
        className={styles.switch}
        onClick={() => onChange(!checked)}
        disabled={disabled}
      >
        <span className={styles.thumb} aria-hidden="true" />
      </button>
    </div>
  );
}
