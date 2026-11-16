import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import fp from 'fastify-plugin';
import { allowedOrigins, config } from '../config.ts';
import type { DB } from '../db/database.ts';
import { randomToken, safeEqual, sha256 } from '../lib/crypto.ts';
import { ApiError } from '../lib/errors.ts';
import type { SessionUser } from './policies.ts';

export const SESSION_COOKIE = 'ph_session';
export const CSRF_COOKIE = 'ph_csrf';
export const CSRF_HEADER = 'x-csrf-token';

const PERSISTENT_TTL_MS = 30 * 24 * 60 * 60 * 1000;
const BROWSER_TTL_MS = 12 * 60 * 60 * 1000;

declare module 'fastify' {
  interface FastifyRequest {
    user: SessionUser | null;
    sessionHash: string | null;
  }
}

const cookieBase = () => ({ path: '/', sameSite: 'lax' as const, secure: config.cookieSecure });

export async function createSession(db: DB, reply: FastifyReply, req: FastifyRequest, userId: string, persistent: boolean) {
  const raw = randomToken(32);
  const ttl = persistent ? PERSISTENT_TTL_MS : BROWSER_TTL_MS;
  await db
    .insertInto('sessions')
    .values({
      id_hash: sha256(raw),
      user_id: userId,
      persistent,
      expires_at: new Date(Date.now() + ttl),
      user_agent: req.headers['user-agent']?.slice(0, 300) ?? null,
    })
    .execute();
  reply.setCookie(SESSION_COOKIE, raw, {
    ...cookieBase(),
    httpOnly: true,
    ...(persistent ? { maxAge: ttl / 1000 } : {}),
  });
}

export async function destroySession(db: DB, reply: FastifyReply, req: FastifyRequest) {
  if (req.sessionHash) await db.deleteFrom('sessions').where('id_hash', '=', req.sessionHash).execute();
  reply.clearCookie(SESSION_COOKIE, { path: '/' });
}

export async function destroyAllSessions(db: DB, userId: string, exceptHash?: string | null) {
  let q = db.deleteFrom('sessions').where('user_id', '=', userId);
  if (exceptHash) q = q.where('id_hash', '!=', exceptHash);
  await q.execute();
}

export function issueCsrf(reply: FastifyReply) {
  const token = randomToken(24);
  reply.setCookie(CSRF_COOKIE, token, { ...cookieBase(), httpOnly: false });
  return token;
}

const UNSAFE = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);

/** Loads the session user and enforces CSRF + Origin checks on mutations. */
export const sessionPlugin = fp(async (app: FastifyInstance, opts: { db: DB }) => {
  const { db } = opts;
  app.decorateRequest('user', null);
  app.decorateRequest('sessionHash', null);

  app.addHook('onRequest', async (req) => {
    if (!req.url.startsWith('/api/')) return;

    if (UNSAFE.has(req.method)) {
      const origin = req.headers.origin;
      if (origin && !allowedOrigins.has(origin)) throw new ApiError('CSRF', 'Request origin not allowed.');
      const cookie = req.cookies[CSRF_COOKIE];
      const header = req.headers[CSRF_HEADER];
      if (!cookie || typeof header !== 'string' || !safeEqual(cookie, header)) {
        throw new ApiError('CSRF', 'Your session token is missing or out of date. Refresh and try again.');
      }
    }

    const raw = req.cookies[SESSION_COOKIE];
    if (!raw) return;
    const hash = sha256(raw);
    const row = await db
      .selectFrom('sessions')
      .innerJoin('users', 'users.id', 'sessions.user_id')
      .select([
        'sessions.expires_at',
        'sessions.persistent',
        'sessions.last_seen_at',
        'users.id',
        'users.email',
        'users.full_name',
        'users.roles',
        'users.status',
        'users.email_verified_at',
        'users.account_type',
        'users.organization_id',
      ])
      .where('sessions.id_hash', '=', hash)
      .executeTakeFirst();

    if (!row || row.expires_at.getTime() < Date.now() || row.status !== 'active') {
      if (row) await db.deleteFrom('sessions').where('id_hash', '=', hash).execute();
      return;
    }

    req.sessionHash = hash;
    req.user = {
      id: row.id,
      email: row.email,
      full_name: row.full_name,
      roles: row.roles,
      status: row.status,
      email_verified_at: row.email_verified_at,
      account_type: row.account_type,
      organization_id: row.organization_id,
    };

    // Rolling expiry, written at most every 5 minutes.
    if (Date.now() - row.last_seen_at.getTime() > 5 * 60 * 1000) {
      const ttl = row.persistent ? PERSISTENT_TTL_MS : BROWSER_TTL_MS;
      await db
        .updateTable('sessions')
        .set({ last_seen_at: new Date(), expires_at: new Date(Date.now() + ttl) })
        .where('id_hash', '=', hash)
        .execute();
    }
  });
});

export function requireUser(req: FastifyRequest): SessionUser {
  if (!req.user) throw new ApiError('UNAUTHENTICATED', 'Please log in to continue.');
  return req.user;
}
