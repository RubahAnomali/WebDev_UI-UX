import { ApiRequestError, http } from '../api/client';
import { AuthError, type AuthErrorCode, type AuthService, type DevEmail, type User } from './types';

const KNOWN: AuthErrorCode[] = [
  'INVALID_CREDENTIALS',
  'EMAIL_NOT_VERIFIED',
  'TOKEN_INVALID',
  'TOKEN_EXPIRED',
  'RATE_LIMITED',
  'VALIDATION',
  'ACCOUNT_SUSPENDED',
];

/** Converts API errors into the AuthError shape the auth pages understand. */
async function call<T>(fn: () => Promise<T>): Promise<T> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof ApiRequestError) {
      const code = (KNOWN as string[]).includes(err.code) ? (err.code as AuthErrorCode) : 'NETWORK';
      throw new AuthError(code, err.message, err.retryAfter, err.fields);
    }
    throw err;
  }
}

let mailboxEnabled: Promise<boolean> | null = null;

/** Production AuthService backed by the Pawhaven API (httpOnly session cookie). */
export function createHttpAuthAdapter(): AuthService {
  return {
    isDemo: false,

    async getDevMailbox(email) {
      mailboxEnabled ??= http
        .get<{ devMailbox: boolean }>('/api/health')
        .then((h) => h.devMailbox)
        .catch(() => false);
      if (!(await mailboxEnabled)) return null;
      const res = await http
        .get<{ messages: DevEmail[] }>(`/api/dev/outbox?email=${encodeURIComponent(email)}`)
        .catch(() => ({ messages: [] }));
      return res.messages;
    },

    getCurrentUser: () => call(() => http.get<{ user: User | null }>('/api/auth/me').then((r) => r.user)),
    refreshUser: () => call(() => http.get<{ user: User | null }>('/api/auth/me').then((r) => r.user)),
    register: (input) => call(() => http.post<{ email: string }>('/api/auth/register', input)),
    login: (input) => call(() => http.post<{ user: User }>('/api/auth/login', input).then((r) => r.user)),
    logout: () => call(() => http.post('/api/auth/logout').then(() => undefined)),
    resendVerification: (email) => call(() => http.post<{ retryAfter: number }>('/api/auth/resend-verification', { email })),
    verifyEmail: (token) => call(() => http.post<{ user: User }>('/api/auth/verify-email', { token }).then((r) => r.user)),
    requestPasswordReset: (email) => call(() => http.post('/api/auth/forgot-password', { email }).then(() => undefined)),
    checkResetToken: (token) => call(() => http.post('/api/auth/reset-password/check', { token }).then(() => undefined)),
    resetPassword: (token, password) =>
      call(() => http.post('/api/auth/reset-password', { token, password }).then(() => undefined)),
  };
}
