/**
 * ⚠️ DEVELOPMENT / DEMO AUTHENTICATION — NOT PRODUCTION SECURITY ⚠️
 *
 * This adapter stores accounts in the browser so the authentication UI can be
 * exercised end-to-end before a backend exists. Anything in the browser can be
 * read and modified by the user, so:
 *   - it provides NO real security or authorization;
 *   - "emails" are written to a local demo outbox instead of being sent;
 *   - roles stored here are never trusted for access control.
 *
 * Replace with an HTTP implementation of `AuthService` (httpOnly session
 * cookies, server-side hashing with Argon2id/bcrypt, server-side RBAC).
 */
import { readJSON, removeKey, writeJSON } from '../../lib/storage';
import {
  AuthError,
  RESEND_COOLDOWN_SECONDS,
  type AuthService,
  type LoginInput,
  type RegisterInput,
  type User,
} from './types';

const KEYS = {
  users: 'pawhaven.demo.users',
  tokens: 'pawhaven.demo.tokens',
  outbox: 'pawhaven.demo.outbox',
  session: 'pawhaven.demo.session',
  resend: 'pawhaven.demo.resend',
} as const;

const VERIFY_TTL_MS = 24 * 60 * 60 * 1000;
const RESET_TTL_MS = 30 * 60 * 1000;

interface StoredUser extends User {
  passwordHash: string;
  salt: string;
}

interface StoredToken {
  token: string;
  type: 'verify' | 'reset';
  userId: string;
  expiresAt: number;
  used: boolean;
}

export interface DemoEmail {
  id: string;
  to: string;
  subject: string;
  body: string;
  link?: string;
  createdAt: number;
}

interface Session {
  userId: string;
  expiresAt: number;
}

export interface DemoAuthOptions {
  /** Simulated network latency in ms (0 in tests). */
  latency?: number;
  now?: () => number;
}

const normalizeEmail = (email: string) => email.trim().toLowerCase();

function randomToken(bytes = 24): string {
  const arr = new Uint8Array(bytes);
  crypto.getRandomValues(arr);
  return Array.from(arr, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function hashPassword(password: string, salt: string): Promise<string> {
  const subtle = globalThis.crypto?.subtle;
  if (subtle) {
    const key = await subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
    const bits = await subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 },
      key,
      256,
    );
    return Array.from(new Uint8Array(bits), (b) => b.toString(16).padStart(2, '0')).join('');
  }
  // Insecure contexts (plain http on a LAN IP) lack SubtleCrypto. Demo only.
  let h = 0x811c9dc5;
  for (const ch of salt + password) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return `fnv-${(h >>> 0).toString(16)}`;
}

function toPublicUser(u: StoredUser): User {
  const { passwordHash: _h, salt: _s, ...user } = u;
  return user;
}

export function readDemoOutbox(): DemoEmail[] {
  return readJSON<DemoEmail[]>(KEYS.outbox, []);
}

export function createDemoAuthAdapter(options: DemoAuthOptions = {}): AuthService {
  const latency = options.latency ?? 450;
  const now = options.now ?? (() => Date.now());
  const wait = () => (latency > 0 ? new Promise((r) => setTimeout(r, latency)) : Promise.resolve());

  const users = () => readJSON<StoredUser[]>(KEYS.users, []);
  const saveUsers = (list: StoredUser[]) => writeJSON(KEYS.users, list);
  const tokens = () => readJSON<StoredToken[]>(KEYS.tokens, []);
  const saveTokens = (list: StoredToken[]) => writeJSON(KEYS.tokens, list);
  const findByEmail = (email: string) => users().find((u) => u.email === normalizeEmail(email));

  function sendEmail(to: string, subject: string, body: string, link?: string) {
    const email: DemoEmail = { id: randomToken(8), to, subject, body, link, createdAt: now() };
    const outbox = [email, ...readDemoOutbox()].slice(0, 20);
    writeJSON(KEYS.outbox, outbox);
    if (import.meta.env.DEV && import.meta.env.MODE !== 'test') {
      console.info(`[Pawhaven demo email] To: ${to} — ${subject}${link ? `\n${link}` : ''}`);
    }
    window.dispatchEvent(new CustomEvent('pawhaven:demo-email'));
  }

  function issueToken(type: StoredToken['type'], userId: string): string {
    const token = randomToken();
    const ttl = type === 'verify' ? VERIFY_TTL_MS : RESET_TTL_MS;
    // Invalidate previous unused tokens of the same type for this user.
    const list = tokens().map((t) => (t.userId === userId && t.type === type ? { ...t, used: true } : t));
    list.push({ token, type, userId, expiresAt: now() + ttl, used: false });
    saveTokens(list);
    return token;
  }

  function consumeToken(token: string, type: StoredToken['type'], consume: boolean): StoredToken {
    const list = tokens();
    const entry = list.find((t) => t.token === token && t.type === type);
    if (!entry || entry.used) throw new AuthError('TOKEN_INVALID', 'This link is invalid or has already been used.');
    if (entry.expiresAt < now()) throw new AuthError('TOKEN_EXPIRED', 'This link has expired.');
    if (consume) saveTokens(list.map((t) => (t === entry ? { ...t, used: true } : t)));
    return entry;
  }

  function sendVerification(user: StoredUser) {
    const token = issueToken('verify', user.id);
    const link = `${window.location.origin}/verify-email?token=${token}`;
    sendEmail(user.email, 'Verify your Pawhaven email', 'Open this link to verify your email address.', link);
    const resend = readJSON<Record<string, number>>(KEYS.resend, {});
    resend[user.email] = now();
    writeJSON(KEYS.resend, resend);
  }

  function startSession(user: StoredUser, remember: boolean) {
    const session: Session = {
      userId: user.id,
      expiresAt: now() + (remember ? 30 * 24 * 60 * 60 * 1000 : 12 * 60 * 60 * 1000),
    };
    removeKey(KEYS.session, 'local');
    removeKey(KEYS.session, 'session');
    writeJSON(KEYS.session, session, remember ? 'local' : 'session');
  }

  function currentSession(): Session | null {
    return readJSON<Session | null>(KEYS.session, null, 'session') ?? readJSON<Session | null>(KEYS.session, null, 'local');
  }

  return {
    isDemo: true,

    async getCurrentUser() {
      const session = currentSession();
      if (!session) return null;
      if (session.expiresAt < now()) {
        removeKey(KEYS.session, 'local');
        removeKey(KEYS.session, 'session');
        return null;
      }
      const user = users().find((u) => u.id === session.userId);
      return user ? toPublicUser(user) : null;
    },

    async register(input: RegisterInput) {
      await wait();
      if (!input.acceptedTerms) throw new AuthError('VALIDATION', 'Terms must be accepted.');
      const email = normalizeEmail(input.email);
      const existing = findByEmail(email);
      if (existing) {
        // Do not reveal that the account exists; notify the owner instead.
        sendEmail(
          email,
          'Someone tried to create a Pawhaven account with your email',
          'If this was you, log in or reset your password. If not, you can ignore this email.',
          `${window.location.origin}/login`,
        );
        return { email };
      }
      const salt = randomToken(16);
      const user: StoredUser = {
        id: `usr_${randomToken(8)}`,
        fullName: input.fullName.trim(),
        email,
        location: input.location.trim(),
        accountType: input.accountType,
        // Only ever "member" at sign-up. Seller/admin are server-granted.
        roles: ['member'],
        emailVerified: false,
        organizationVerification: input.accountType === 'organization' ? 'pending' : 'not_applicable',
        createdAt: new Date(now()).toISOString(),
        salt,
        passwordHash: await hashPassword(input.password, salt),
      };
      saveUsers([...users(), user]);
      sendVerification(user);
      return { email };
    },

    async login({ email, password, remember }: LoginInput) {
      await wait();
      const user = findByEmail(email);
      // Hash even when the user doesn't exist to keep timing similar.
      const hash = await hashPassword(password, user?.salt ?? 'no-user-salt');
      if (!user || hash !== user.passwordHash) {
        throw new AuthError('INVALID_CREDENTIALS', 'The email or password is incorrect.');
      }
      if (!user.emailVerified) {
        throw new AuthError('EMAIL_NOT_VERIFIED', 'Please verify your email address to continue.');
      }
      startSession(user, remember);
      return toPublicUser(user);
    },

    async logout() {
      removeKey(KEYS.session, 'local');
      removeKey(KEYS.session, 'session');
    },

    async resendVerification(email: string) {
      await wait();
      const normalized = normalizeEmail(email);
      const resend = readJSON<Record<string, number>>(KEYS.resend, {});
      const last = resend[normalized];
      const elapsed = last ? Math.floor((now() - last) / 1000) : Infinity;
      if (elapsed < RESEND_COOLDOWN_SECONDS) {
        const retryAfter = RESEND_COOLDOWN_SECONDS - elapsed;
        throw new AuthError('RATE_LIMITED', `Please wait ${retryAfter} seconds.`, retryAfter);
      }
      const user = findByEmail(normalized);
      if (user && !user.emailVerified) sendVerification(user);
      else {
        // Record the attempt anyway so the cooldown can't be used to probe accounts.
        resend[normalized] = now();
        writeJSON(KEYS.resend, resend);
      }
      return { retryAfter: RESEND_COOLDOWN_SECONDS };
    },

    async verifyEmail(token: string) {
      await wait();
      const entry = consumeToken(token, 'verify', true);
      const list = users();
      const user = list.find((u) => u.id === entry.userId);
      if (!user) throw new AuthError('TOKEN_INVALID', 'This link is invalid.');
      user.emailVerified = true;
      saveUsers(list);
      return toPublicUser(user);
    },

    async requestPasswordReset(email: string) {
      await wait();
      const user = findByEmail(email);
      if (user) {
        const token = issueToken('reset', user.id);
        sendEmail(
          user.email,
          'Reset your Pawhaven password',
          'Use this link within 30 minutes to choose a new password.',
          `${window.location.origin}/reset-password?token=${token}`,
        );
      }
      // Neutral response either way.
    },

    async checkResetToken(token: string) {
      consumeToken(token, 'reset', false);
    },

    async resetPassword(token: string, newPassword: string) {
      await wait();
      const entry = consumeToken(token, 'reset', true);
      const list = users();
      const user = list.find((u) => u.id === entry.userId);
      if (!user) throw new AuthError('TOKEN_INVALID', 'This link is invalid.');
      user.salt = randomToken(16);
      user.passwordHash = await hashPassword(newPassword, user.salt);
      // Completing a reset proves inbox ownership.
      user.emailVerified = true;
      saveUsers(list);
      // Sign out everywhere after a password change.
      removeKey(KEYS.session, 'local');
      removeKey(KEYS.session, 'session');
      sendEmail(user.email, 'Your Pawhaven password was changed', 'If this wasn’t you, contact support right away.');
    },
  };
}
