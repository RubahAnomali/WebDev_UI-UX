import type { FastifyInstance } from 'fastify';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { RESET_TOKEN_TTL_MS } from '../../../shared/constants.ts';
import { emailSchema, fullNameSchema, locationSchema, newPasswordSchema, orgEvidenceSchema, tokenSchema } from '../../../shared/schemas/auth.ts';
import { destroyAllSessions, requireUser } from '../auth/session.ts';
import { consumeToken, issueToken } from '../auth/tokens.ts';
import { config } from '../config.ts';
import type { DB } from '../db/database.ts';
import { audit } from '../lib/audit.ts';
import { hashPassword, randomToken, verifyPassword } from '../lib/crypto.ts';
import { ApiError } from '../lib/errors.ts';
import type { Mailer } from '../lib/mailer.ts';
import { localStorage } from '../lib/photos.ts';
import { loadApiUser } from '../lib/serializers.ts';
import { parse } from '../lib/validate.ts';

const profileSchema = z.object({
  fullName: fullNameSchema.optional(),
  location: locationSchema.optional(),
  phone: z
    .string()
    .trim()
    .max(30)
    .regex(/^[\d\s()+.-]*$/, 'Use digits, spaces, and ( ) + - only.')
    .optional()
    .or(z.literal('')),
  prefs: z.object({ messages: z.boolean(), discovery: z.boolean() }).partial().optional(),
});

const passwordChangeSchema = z.object({
  currentPassword: z.string().min(1, 'Enter your current password.'),
  newPassword: newPasswordSchema,
});

const emailChangeSchema = z.object({
  newEmail: emailSchema,
  password: z.string().min(1, 'Enter your password.'),
});

const deleteSchema = z.object({
  password: z.string().min(1, 'Enter your password.'),
  confirm: z.literal('DELETE', { error: 'Type DELETE to confirm.' }),
});

export function accountRoutes(app: FastifyInstance, { db, mailer }: { db: DB; mailer: Mailer }) {
  const sensitive = { config: { rateLimit: { max: config.isTest ? 1000 : 10, timeWindow: '15 minutes' } } };

  async function checkPassword(userId: string, password: string) {
    const row = await db.selectFrom('users').select('password_hash').where('id', '=', userId).executeTakeFirstOrThrow();
    if (!(await verifyPassword(password, row.password_hash))) {
      throw new ApiError('VALIDATION', 'That password isn’t right.', { fields: { password: 'That password isn’t right.', currentPassword: 'That password isn’t right.' } });
    }
  }

  async function prefsFor(userId: string) {
    const p = await db.selectFrom('notification_prefs').select(['messages', 'discovery']).where('user_id', '=', userId).executeTakeFirst();
    return { messages: p?.messages ?? true, discovery: p?.discovery ?? false };
  }

  app.get('/api/account', async (req) => {
    const user = requireUser(req);
    return { user: await loadApiUser(db, user.id), prefs: await prefsFor(user.id) };
  });

  app.patch('/api/account', async (req) => {
    const user = requireUser(req);
    const input = parse(profileSchema, req.body);
    const set: Record<string, unknown> = {};
    if (input.fullName !== undefined) set.full_name = input.fullName;
    if (input.location !== undefined) set.location = input.location;
    if (input.phone !== undefined) set.phone = input.phone || null;
    if (Object.keys(set).length) {
      await db.updateTable('users').set({ ...set, updated_at: new Date() }).where('id', '=', user.id).execute();
    }
    if (input.prefs) {
      await db
        .insertInto('notification_prefs')
        .values({ user_id: user.id, ...input.prefs })
        .onConflict((oc) => oc.column('user_id').doUpdateSet(input.prefs!))
        .execute();
    }
    return { user: await loadApiUser(db, user.id), prefs: await prefsFor(user.id) };
  });

  /** Pending shelters can add or correct their verification evidence. */
  app.patch('/api/account/organization', async (req) => {
    const user = requireUser(req);
    if (!user.organization_id) throw new ApiError('FORBIDDEN', 'Only shelter / rescue accounts have organization details.');
    const org = await db.selectFrom('organizations').select('verification_status').where('id', '=', user.organization_id).executeTakeFirstOrThrow();
    if (org.verification_status === 'verified') {
      throw new ApiError('CONFLICT', 'Your organization is already verified. Contact support to change its details.');
    }
    const input = parse(orgEvidenceSchema, req.body);
    await db
      .updateTable('organizations')
      .set({
        name: input.organizationName!.trim(),
        registration_number: input.registrationNumber?.trim() || null,
        website: input.website?.trim() || null,
        reference: input.reference?.trim() || null,
        // A declined organization that updates its evidence goes back into the queue.
        verification_status: 'pending',
      })
      .where('id', '=', user.organization_id)
      .execute();
    return { user: await loadApiUser(db, user.id) };
  });

  app.post('/api/account/password', sensitive, async (req) => {
    const user = requireUser(req);
    const input = parse(passwordChangeSchema, req.body);
    await checkPassword(user.id, input.currentPassword);
    await db
      .updateTable('users')
      .set({ password_hash: await hashPassword(input.newPassword), updated_at: new Date() })
      .where('id', '=', user.id)
      .execute();
    await destroyAllSessions(db, user.id, req.sessionHash); // keep this device signed in
    await mailer.send({
      to: user.email,
      subject: 'Your Pawhaven password was changed',
      body: 'Your password was changed and other devices were signed out. If this wasn’t you, reset your password right away.',
      link: `${config.appOrigin}/forgot-password`,
    });
    await audit(db, req, { action: 'account.password_changed', entityType: 'user', entityId: user.id });
    return { ok: true };
  });

  app.post('/api/account/email', sensitive, async (req) => {
    const user = requireUser(req);
    const input = parse(emailChangeSchema, req.body);
    await checkPassword(user.id, input.password);
    if (input.newEmail === user.email) throw new ApiError('VALIDATION', 'That’s already your email.', { fields: { newEmail: 'That’s already your email.' } });
    const taken = await db.selectFrom('users').select('id').where('email', '=', input.newEmail).executeTakeFirst();
    // Neutral response when taken, so this can't be used to discover accounts.
    if (!taken) {
      const token = await issueToken(db, user.id, 'email_change', RESET_TOKEN_TTL_MS * 2 * 24, { newEmail: input.newEmail });
      await mailer.send({
        to: input.newEmail,
        subject: 'Confirm your new Pawhaven email',
        body: 'Open this link to confirm this is your new email address for Pawhaven.',
        link: `${config.appOrigin}/confirm-email?token=${token}`,
      });
    }
    await mailer.send({
      to: user.email,
      subject: 'A change to your Pawhaven email was requested',
      body: `Someone asked to change your account email to ${input.newEmail.replace(/(.).*(@.*)/, '$1•••$2')}. If this wasn’t you, change your password.`,
    });
    return { ok: true };
  });

  app.post('/api/auth/confirm-email-change', sensitive, async (req) => {
    const { token } = parse(tokenSchema, req.body);
    const row = await consumeToken(db, token, 'email_change');
    const newEmail = String((row.payload as { newEmail?: string } | null)?.newEmail ?? '');
    if (!newEmail) throw new ApiError('TOKEN_INVALID', 'This link is invalid.');
    const taken = await db.selectFrom('users').select('id').where('email', '=', newEmail).executeTakeFirst();
    if (taken) throw new ApiError('CONFLICT', 'That email is already in use on another account.');
    await db
      .updateTable('users')
      .set({ email: newEmail, email_verified_at: new Date(), updated_at: new Date() })
      .where('id', '=', row.user_id)
      .execute();
    await audit(db, req, { action: 'account.email_changed', entityType: 'user', entityId: row.user_id });
    return { ok: true, email: newEmail };
  });

  app.post('/api/account/logout-others', async (req) => {
    const user = requireUser(req);
    await destroyAllSessions(db, user.id, req.sessionHash);
    return { ok: true };
  });

  /** Data export (GDPR / CCPA style). Messages include only what this person wrote. */
  app.get('/api/account/export', async (req, reply) => {
    const user = requireUser(req);
    const profile = await loadApiUser(db, user.id);
    const [listings, requests, favorites, messages] = await Promise.all([
      db
        .selectFrom('listings')
        .select(['id', 'name', 'status', 'species', 'breed', 'city', 'about', 'created_at'])
        .where('owner_id', '=', user.id)
        .execute(),
      db
        .selectFrom('adoption_requests')
        .select(['id', 'listing_id', 'status', 'household', 'message', 'created_at'])
        .where('applicant_id', '=', user.id)
        .execute(),
      db.selectFrom('favorites').select(['listing_id', 'created_at']).where('user_id', '=', user.id).execute(),
      db.selectFrom('messages').select(['conversation_id', 'body', 'created_at']).where('sender_id', '=', user.id).execute(),
    ]);
    reply.header('Content-Disposition', `attachment; filename="pawhaven-data-${new Date().toISOString().slice(0, 10)}.json"`);
    return { exportedAt: new Date().toISOString(), profile, prefs: await prefsFor(user.id), listings, adoptionRequests: requests, savedPets: favorites, messagesSent: messages };
  });

  app.delete('/api/account', sensitive, async (req, reply) => {
    const user = requireUser(req);
    const input = parse(deleteSchema, req.body);
    await checkPassword(user.id, input.password);
    if (user.roles.includes('admin')) {
      throw new ApiError('FORBIDDEN', 'Staff accounts must be removed by another administrator.');
    }
    const photos = await db
      .selectFrom('listing_photos as p')
      .innerJoin('listings as l', 'l.id', 'p.listing_id')
      .select('p.storage_key')
      .where('l.owner_id', '=', user.id)
      .execute();

    await db.transaction().execute(async (trx) => {
      await trx
        .updateTable('adoption_requests')
        .set({ status: 'withdrawn', updated_at: new Date() })
        .where('applicant_id', '=', user.id)
        .where('status', 'in', ['sent', 'in_review', 'meet_invited'])
        .execute();
      await trx.deleteFrom('listings').where('owner_id', '=', user.id).execute();
      await trx.deleteFrom('favorites').where('user_id', '=', user.id).execute();
      await trx.deleteFrom('sessions').where('user_id', '=', user.id).execute();
      await trx.deleteFrom('auth_tokens').where('user_id', '=', user.id).execute();
      // Anonymize rather than hard-delete so conversation partners see "Former member".
      await trx
        .updateTable('users')
        .set({
          email: `deleted+${randomUUID()}@pawhaven.invalid`,
          full_name: 'Former member',
          location: '',
          phone: null,
          password_hash: await hashPassword(randomToken(32)),
          status: 'deleted',
          roles: ['member'],
          updated_at: new Date(),
        })
        .where('id', '=', user.id)
        .execute();
    });
    await Promise.all(photos.map((p) => localStorage.removePrefix(p.storage_key)));
    await audit(db, req, { action: 'account.deleted', entityType: 'user', entityId: user.id });
    await mailer.send({ to: user.email, subject: 'Your Pawhaven account was deleted', body: 'Your profile and listings were removed. Thank you for caring for pets with us.' });
    reply.clearCookie('ph_session', { path: '/' });
    return { ok: true };
  });
}
