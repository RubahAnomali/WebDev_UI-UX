import type { FastifyInstance } from 'fastify';
import { RESEND_COOLDOWN_SECONDS, RESET_TOKEN_TTL_MS, VERIFY_TOKEN_TTL_MS } from '../../../shared/constants.ts';
import {
  emailOnlySchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
  tokenSchema,
} from '../../../shared/schemas/auth.ts';
import { createSession, destroyAllSessions, destroySession, issueCsrf } from '../auth/session.ts';
import { consumeToken, findToken, issueToken } from '../auth/tokens.ts';
import { config } from '../config.ts';
import type { DB } from '../db/database.ts';
import { getDummyHash, hashPassword, verifyPassword } from '../lib/crypto.ts';
import { ApiError } from '../lib/errors.ts';
import type { Mailer } from '../lib/mailer.ts';
import { loadApiUser } from '../lib/serializers.ts';
import { parse } from '../lib/validate.ts';

/** Per-email resend cooldown (also applied to unknown emails so it can't be used to probe accounts). */
const lastResend = new Map<string, number>();

export function authRoutes(app: FastifyInstance, { db, mailer }: { db: DB; mailer: Mailer }) {
  // Brute-force protection on credential/email endpoints (relaxed only in the test suite).
  const strict = { config: { rateLimit: { max: config.isTest ? 1000 : config.authRateLimit, timeWindow: '15 minutes' } } };

  async function sendVerification(userId: string, email: string) {
    const token = await issueToken(db, userId, 'verify', VERIFY_TOKEN_TTL_MS);
    await mailer.send({
      to: email,
      subject: 'Verify your Pawhaven email',
      body: 'Open this link to verify your email address. It expires in 24 hours.',
      link: `${config.appOrigin}/verify-email?token=${token}`,
    });
    lastResend.set(email, Date.now());
  }

  app.get('/api/auth/csrf', async (_req, reply) => ({ token: issueCsrf(reply) }));

  app.get('/api/auth/me', async (req) => ({ user: req.user ? await loadApiUser(db, req.user.id) : null }));

  app.post('/api/auth/register', strict, async (req) => {
    const input = parse(registerSchema, req.body);
    const existing = await db.selectFrom('users').select(['id']).where('email', '=', input.email).executeTakeFirst();
    if (existing) {
      // Don't reveal that the account exists — tell the owner instead.
      await mailer.send({
        to: input.email,
        subject: 'Someone tried to create a Pawhaven account with your email',
        body: 'If this was you, log in or reset your password. If not, you can safely ignore this email.',
        link: `${config.appOrigin}/login`,
      });
      return { email: input.email };
    }

    const passwordHash = await hashPassword(input.password);
    const userId = await db.transaction().execute(async (trx) => {
      let organizationId: string | null = null;
      if (input.accountType === 'organization') {
        const org = await trx
          .insertInto('organizations')
          .values({
            name: input.organizationName!.trim(),
            city: input.location,
            registration_number: input.registrationNumber?.trim() || null,
            website: input.website?.trim() || null,
            reference: input.reference?.trim() || null,
          })
          .returning('id')
          .executeTakeFirstOrThrow();
        organizationId = org.id;
      }
      const user = await trx
        .insertInto('users')
        .values({
          email: input.email,
          full_name: input.fullName,
          location: input.location,
          account_type: input.accountType,
          password_hash: passwordHash,
          roles: ['member'], // Seller/admin are never granted at sign-up.
          organization_id: organizationId,
          terms_accepted_at: new Date(),
        })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx.insertInto('notification_prefs').values({ user_id: user.id }).execute();
      return user.id;
    });
    await sendVerification(userId, input.email);
    return { email: input.email };
  });

  app.post('/api/auth/login', strict, async (req, reply) => {
    const input = parse(loginSchema, req.body);
    const user = await db
      .selectFrom('users')
      .select(['id', 'password_hash', 'email_verified_at', 'status'])
      .where('email', '=', input.email)
      .executeTakeFirst();
    const ok = await verifyPassword(input.password, user?.password_hash ?? (await getDummyHash()));
    if (!user || !ok || user.status === 'deleted') {
      throw new ApiError('INVALID_CREDENTIALS', 'The email or password is incorrect.');
    }
    if (user.status === 'suspended') {
      throw new ApiError('ACCOUNT_SUSPENDED', 'This account has been suspended. Contact support if you think this is a mistake.');
    }
    if (!user.email_verified_at) throw new ApiError('EMAIL_NOT_VERIFIED', 'Please verify your email address to continue.');
    // Rotate: drop any session this browser already had.
    await destroySession(db, reply, req);
    await createSession(db, reply, req, user.id, input.remember);
    return { user: await loadApiUser(db, user.id) };
  });

  app.post('/api/auth/logout', async (req, reply) => {
    await destroySession(db, reply, req);
    return { ok: true };
  });

  app.post('/api/auth/resend-verification', strict, async (req) => {
    const { email } = parse(emailOnlySchema, req.body);
    const last = lastResend.get(email);
    const elapsed = last ? Math.floor((Date.now() - last) / 1000) : Infinity;
    if (elapsed < RESEND_COOLDOWN_SECONDS) {
      const retryAfter = RESEND_COOLDOWN_SECONDS - elapsed;
      throw new ApiError('RATE_LIMITED', `Please wait ${retryAfter} seconds.`, { retryAfter });
    }
    const user = await db
      .selectFrom('users')
      .select(['id', 'email_verified_at'])
      .where('email', '=', email)
      .executeTakeFirst();
    if (user && !user.email_verified_at) await sendVerification(user.id, email);
    else lastResend.set(email, Date.now());
    return { retryAfter: RESEND_COOLDOWN_SECONDS };
  });

  app.post('/api/auth/verify-email', strict, async (req) => {
    const { token } = parse(tokenSchema, req.body);
    const row = await consumeToken(db, token, 'verify');
    await db
      .updateTable('users')
      .set({ email_verified_at: new Date(), updated_at: new Date() })
      .where('id', '=', row.user_id)
      .execute();
    return { user: await loadApiUser(db, row.user_id) };
  });

  app.post('/api/auth/forgot-password', strict, async (req) => {
    const { email } = parse(emailOnlySchema, req.body);
    const user = await db
      .selectFrom('users')
      .select(['id'])
      .where('email', '=', email)
      .where('status', '!=', 'deleted')
      .executeTakeFirst();
    if (user) {
      const token = await issueToken(db, user.id, 'reset', RESET_TOKEN_TTL_MS);
      await mailer.send({
        to: email,
        subject: 'Reset your Pawhaven password',
        body: 'Use this link within 30 minutes to choose a new password. If you didn’t ask for this, ignore this email.',
        link: `${config.appOrigin}/reset-password?token=${token}`,
      });
    }
    return { ok: true }; // Neutral response either way.
  });

  app.post('/api/auth/reset-password/check', strict, async (req) => {
    const { token } = parse(tokenSchema, req.body);
    await findToken(db, token, 'reset');
    return { ok: true };
  });

  app.post('/api/auth/reset-password', strict, async (req, reply) => {
    const { token, password } = parse(resetPasswordSchema, req.body);
    const row = await consumeToken(db, token, 'reset');
    const user = await db.selectFrom('users').select(['email']).where('id', '=', row.user_id).executeTakeFirstOrThrow();
    await db
      .updateTable('users')
      .set({
        password_hash: await hashPassword(password),
        // Completing a reset proves inbox ownership.
        email_verified_at: new Date(),
        updated_at: new Date(),
      })
      .where('id', '=', row.user_id)
      .execute();
    await destroyAllSessions(db, row.user_id);
    reply.clearCookie('ph_session', { path: '/' });
    await mailer.send({
      to: user.email,
      subject: 'Your Pawhaven password was changed',
      body: 'Your password was just changed and you were signed out everywhere. If this wasn’t you, contact support right away.',
    });
    return { ok: true };
  });
}
