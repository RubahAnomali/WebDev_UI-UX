import { api, http } from '../api/client';
import type { User } from '../auth/types';

export interface Prefs {
  messages: boolean;
  discovery: boolean;
}

export const accountService = {
  get: () => http.get<{ user: User; prefs: Prefs }>('/api/account'),
  update: (patch: { fullName?: string; location?: string; phone?: string; prefs?: Partial<Prefs> }) =>
    http.patch<{ user: User; prefs: Prefs }>('/api/account', patch),
  changePassword: (currentPassword: string, newPassword: string) => http.post('/api/account/password', { currentPassword, newPassword }),
  changeEmail: (newEmail: string, password: string) => http.post('/api/account/email', { newEmail, password }),
  confirmEmail: (token: string) => http.post<{ email: string }>('/api/auth/confirm-email-change', { token }),
  logoutOthers: () => http.post('/api/account/logout-others'),
  /** Permanently deletes the account (requires the password and the typed word DELETE). */
  remove: (password: string) => api('DELETE', '/api/account', { password, confirm: 'DELETE' }),
};
