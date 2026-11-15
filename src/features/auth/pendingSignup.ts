import { readJSON, removeKey, writeJSON } from '../../lib/storage';
import type { AccountType } from '../../services/auth/types';

/**
 * Non-secret details kept for the current tab so the verify screen survives
 * a refresh and "Use a different email" can restore the form. Passwords are
 * never stored here.
 */
export interface PendingSignup {
  email: string;
  fullName?: string;
  location?: string;
  accountType?: AccountType;
}

const KEY = 'pawhaven.pendingSignup';

export const getPendingSignup = () => readJSON<PendingSignup | null>(KEY, null, 'session');
export const setPendingSignup = (value: PendingSignup) => writeJSON(KEY, value, 'session');
export const clearPendingSignup = () => removeKey(KEY, 'session');
