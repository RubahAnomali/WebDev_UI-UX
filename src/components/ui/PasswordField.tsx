import { useState } from 'react';
import { Icon } from './Icon';
import { TextField, type TextFieldProps } from './TextField';
import styles from './PasswordField.module.css';

type PasswordFieldProps = Omit<TextFieldProps, 'type' | 'trailing'>;

/** Password input with an accessible show/hide toggle. */
export function PasswordField(props: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return (
    <TextField
      {...props}
      type={visible ? 'text' : 'password'}
      autoCapitalize="none"
      autoCorrect="off"
      spellCheck={false}
      trailing={
        <button
          type="button"
          className={styles.toggle}
          onClick={() => setVisible((v) => !v)}
          aria-pressed={visible}
          aria-label={visible ? `Hide ${props.label.toLowerCase()}` : `Show ${props.label.toLowerCase()}`}
        >
          <Icon name={visible ? 'eyeOff' : 'eye'} size={20} strokeWidth={1.6} />
        </button>
      }
    />
  );
}
