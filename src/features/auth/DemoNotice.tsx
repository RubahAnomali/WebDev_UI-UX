import { useState } from 'react';
import { Icon } from '../../components/ui/Icon';
import { readJSON, writeJSON } from '../../lib/storage';
import styles from './DemoNotice.module.css';

const KEY = 'pawhaven.demo.noticeDismissed';

/** Makes it impossible to mistake the demo adapter for production security. */
export function DemoNotice() {
  const [dismissed, setDismissed] = useState(() => readJSON<boolean>(KEY, false, 'session'));
  if (dismissed) return null;
  return (
    <div className={styles.notice} role="note">
      <Icon name="info" size={18} className={styles.icon} />
      <p>
        <strong>Demo authentication.</strong> Accounts are stored only in this browser and emails are simulated. Don’t use
        a real password.
      </p>
      <button
        type="button"
        className={styles.close}
        aria-label="Dismiss demo notice"
        onClick={() => {
          writeJSON(KEY, true, 'session');
          setDismissed(true);
        }}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
