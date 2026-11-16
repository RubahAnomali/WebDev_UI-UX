import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { requireVerified } from '../auth/policies.ts';
import { requireUser } from '../auth/session.ts';
import { config } from '../config.ts';
import type { DB } from '../db/database.ts';
import { ApiError, notFound } from '../lib/errors.ts';
import type { Mailer } from '../lib/mailer.ts';
import { parse } from '../lib/validate.ts';

const UUID = /^[0-9a-f-]{36}$/i;
const bodySchema = z.object({
  body: z.string({ error: 'Write a message.' }).trim().min(1, 'Write a message.').max(2000, 'Please keep messages under 2000 characters.'),
});
const startSchema = bodySchema.extend({ listingId: z.string().uuid() });

export interface ConversationSummary {
  id: string;
  listing: { id: string; name: string; status: string };
  otherName: string;
  otherIsOrganization: boolean;
  requestStatus: string | null;
  lastMessage: { body: string; at: string; fromMe: boolean } | null;
  unread: boolean;
}

export function messageRoutes(app: FastifyInstance, { db, mailer }: { db: DB; mailer: Mailer }) {
  /** Display name for the other participant, honoring privacy (first names for individuals). */
  async function describe(conversationId: string, viewerId: string) {
    const convo = await db
      .selectFrom('conversations as c')
      .innerJoin('listings as l', 'l.id', 'c.listing_id')
      .leftJoin('adoption_requests as r', 'r.id', 'c.request_id')
      .select([
        'c.id',
        'c.request_id',
        'l.id as listing_id',
        'l.name as listing_name',
        'l.status as listing_status',
        'l.owner_id',
        'l.organization_id',
        'r.status as request_status',
        'r.full_name as applicant_name',
      ])
      .where('c.id', '=', conversationId)
      .executeTakeFirstOrThrow();
    const other = await db
      .selectFrom('conversation_participants as p')
      .innerJoin('users as u', 'u.id', 'p.user_id')
      .leftJoin('organizations as o', 'o.id', 'u.organization_id')
      .select(['u.id', 'u.full_name', 'u.status', 'o.name as org_name', 'p.last_read_at'])
      .where('p.conversation_id', '=', conversationId)
      .where('p.user_id', '!=', viewerId)
      .executeTakeFirst();

    const otherIsLister = other?.id === convo.owner_id;
    const otherIsOrganization = Boolean(otherIsLister && convo.organization_id && other?.org_name);
    let otherName = 'Pawhaven member';
    if (other?.status === 'deleted') otherName = 'Former member';
    else if (otherIsOrganization) otherName = other!.org_name!;
    else if (!otherIsLister && convo.applicant_name) otherName = convo.applicant_name; // shared via the request
    else if (other) otherName = other.full_name.split(' ')[0]!;

    return { convo, other, otherName, otherIsOrganization };
  }

  async function assertParticipant(conversationId: string, userId: string) {
    if (!UUID.test(conversationId)) throw notFound('That conversation');
    const p = await db
      .selectFrom('conversation_participants')
      .select(['last_read_at'])
      .where('conversation_id', '=', conversationId)
      .where('user_id', '=', userId)
      .executeTakeFirst();
    if (!p) throw notFound('That conversation');
    return p;
  }

  async function isBlocked(a: string, b: string) {
    const row = await db
      .selectFrom('blocks')
      .select('blocker_id')
      .where((eb) =>
        eb.or([
          eb.and([eb('blocker_id', '=', a), eb('blocked_id', '=', b)]),
          eb.and([eb('blocker_id', '=', b), eb('blocked_id', '=', a)]),
        ]),
      )
      .executeTakeFirst();
    return Boolean(row);
  }

  async function postMessage(conversationId: string, senderId: string, body: string) {
    const { convo, other } = await describe(conversationId, senderId);
    if (!other || other.status !== 'active') throw new ApiError('CONFLICT', 'This member is no longer available.');
    if (await isBlocked(senderId, other.id)) throw new ApiError('FORBIDDEN', 'Messages can’t be sent in this conversation.');

    // Email only when the recipient has no other unread messages here (avoids a flood).
    const unread = await db
      .selectFrom('messages')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('conversation_id', '=', conversationId)
      .where('sender_id', '=', senderId)
      .where((eb) => (other.last_read_at ? eb('created_at', '>', other.last_read_at) : eb.lit(true)))
      .executeTakeFirst();

    const msg = await db
      .insertInto('messages')
      .values({ conversation_id: conversationId, sender_id: senderId, body })
      .returning(['id', 'body', 'created_at', 'sender_id'])
      .executeTakeFirstOrThrow();
    await db.updateTable('conversations').set({ last_message_at: msg.created_at }).where('id', '=', conversationId).execute();
    await db
      .updateTable('conversation_participants')
      .set({ last_read_at: msg.created_at })
      .where('conversation_id', '=', conversationId)
      .where('user_id', '=', senderId)
      .execute();

    if ((unread?.n ?? 0) === 0) {
      const prefs = await db.selectFrom('notification_prefs').select('messages').where('user_id', '=', other.id).executeTakeFirst();
      if (prefs?.messages ?? true) {
        const to = await db.selectFrom('users').select('email').where('id', '=', other.id).executeTakeFirstOrThrow();
        await mailer.send({
          to: to.email,
          subject: `New message about ${convo.listing_name}`,
          body: 'You have a new message on Pawhaven. For your safety, message content isn’t included in emails.',
          link: `${config.appOrigin}/messages/${conversationId}`,
        });
      }
    }
    return { id: msg.id, body: msg.body, at: msg.created_at.toISOString(), fromMe: true };
  }

  app.get<{ Querystring: { q?: string } }>('/api/conversations', async (req) => {
    const user = requireUser(req);
    const rows = await db
      .selectFrom('conversation_participants as p')
      .innerJoin('conversations as c', 'c.id', 'p.conversation_id')
      .select(['c.id', 'p.last_read_at', 'c.last_message_at'])
      .where('p.user_id', '=', user.id)
      .orderBy('c.last_message_at', 'desc')
      .limit(100)
      .execute();

    const q = String(req.query.q ?? '').trim().toLowerCase();
    const items: ConversationSummary[] = [];
    for (const row of rows) {
      const { convo, otherName, otherIsOrganization } = await describe(row.id, user.id);
      const last = await db
        .selectFrom('messages')
        .select(['body', 'created_at', 'sender_id'])
        .where('conversation_id', '=', row.id)
        .orderBy('created_at', 'desc')
        .limit(1)
        .executeTakeFirst();
      const unread = Boolean(last && last.sender_id !== user.id && (!row.last_read_at || last.created_at > row.last_read_at));
      const summary: ConversationSummary = {
        id: row.id,
        listing: { id: convo.listing_id, name: convo.listing_name, status: convo.listing_status },
        otherName,
        otherIsOrganization,
        requestStatus: convo.request_status,
        lastMessage: last ? { body: last.body.slice(0, 140), at: last.created_at.toISOString(), fromMe: last.sender_id === user.id } : null,
        unread,
      };
      if (!q || otherName.toLowerCase().includes(q) || convo.listing_name.toLowerCase().includes(q)) items.push(summary);
    }
    return { items };
  });

  /** "Message the shelter / pet parent" from a pet profile. Reuses an existing conversation. */
  app.post('/api/conversations', { config: { rateLimit: { max: config.isTest ? 1000 : 30, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req);
    requireVerified(user);
    const { listingId, body } = parse(startSchema, req.body);
    const listing = await db.selectFrom('listings').select(['id', 'owner_id', 'status']).where('id', '=', listingId).executeTakeFirst();
    if (!listing || listing.status !== 'live') throw notFound('That pet');
    if (listing.owner_id === user.id) throw new ApiError('FORBIDDEN', 'You can’t message yourself about your own listing.');

    const existing = await db
      .selectFrom('conversations as c')
      .innerJoin('conversation_participants as me', (j) => j.onRef('me.conversation_id', '=', 'c.id').on('me.user_id', '=', user.id))
      .innerJoin('conversation_participants as them', (j) =>
        j.onRef('them.conversation_id', '=', 'c.id').on('them.user_id', '=', listing.owner_id),
      )
      .select('c.id')
      .where('c.listing_id', '=', listing.id)
      .orderBy('c.created_at')
      .executeTakeFirst();

    let conversationId = existing?.id;
    if (!conversationId) {
      if (await isBlocked(user.id, listing.owner_id)) throw new ApiError('FORBIDDEN', 'Messages can’t be sent to this lister.');
      conversationId = await db.transaction().execute(async (trx) => {
        const c = await trx.insertInto('conversations').values({ listing_id: listing.id }).returning('id').executeTakeFirstOrThrow();
        await trx
          .insertInto('conversation_participants')
          .values([
            { conversation_id: c.id, user_id: user.id, last_read_at: new Date() },
            { conversation_id: c.id, user_id: listing.owner_id, last_read_at: null },
          ])
          .execute();
        return c.id;
      });
    }
    const message = await postMessage(conversationId, user.id, body);
    return { conversationId, message };
  });

  /** Existing conversation (if any) between the viewer and a listing's owner. */
  app.get<{ Querystring: { listing?: string } }>('/api/conversations/lookup', async (req) => {
    const user = requireUser(req);
    const listingId = String(req.query.listing ?? '');
    if (!UUID.test(listingId)) throw notFound('That pet');
    const row = await db
      .selectFrom('conversations as c')
      .innerJoin('conversation_participants as me', (j) => j.onRef('me.conversation_id', '=', 'c.id').on('me.user_id', '=', user.id))
      .select('c.id')
      .where('c.listing_id', '=', listingId)
      .orderBy('c.last_message_at', 'desc')
      .executeTakeFirst();
    return { conversationId: row?.id ?? null };
  });

  app.get<{ Params: { id: string }; Querystring: { after?: string } }>('/api/conversations/:id', async (req) => {
    const user = requireUser(req);
    await assertParticipant(req.params.id, user.id);
    const { convo, other, otherName, otherIsOrganization } = await describe(req.params.id, user.id);
    const messages = await db
      .selectFrom('messages')
      .select(['id', 'body', 'created_at', 'sender_id'])
      .where('conversation_id', '=', req.params.id)
      .orderBy('created_at', 'desc')
      .limit(200)
      .execute();
    messages.reverse();
    // Opening a conversation marks it read.
    await db
      .updateTable('conversation_participants')
      .set({ last_read_at: new Date() })
      .where('conversation_id', '=', req.params.id)
      .where('user_id', '=', user.id)
      .execute();
    const blockedByMe = other
      ? Boolean(await db.selectFrom('blocks').select('blocker_id').where('blocker_id', '=', user.id).where('blocked_id', '=', other.id).executeTakeFirst())
      : false;
    const blockedMe = other ? !blockedByMe && (await isBlocked(user.id, other.id)) : false;

    return {
      conversation: {
        id: convo.id,
        listing: { id: convo.listing_id, name: convo.listing_name, status: convo.listing_status },
        requestId: convo.request_id,
        requestStatus: convo.request_status,
        otherName,
        otherIsOrganization,
        viewerIsLister: convo.owner_id === user.id,
        blockedByMe,
        canSend: Boolean(other && other.status === 'active' && !blockedByMe && !blockedMe),
        otherLastReadAt: other?.last_read_at?.toISOString() ?? null,
        messages: messages.map((m) => ({ id: m.id, body: m.body, at: m.created_at.toISOString(), fromMe: m.sender_id === user.id })),
      },
    };
  });

  app.post<{ Params: { id: string } }>(
    '/api/conversations/:id/messages',
    { config: { rateLimit: { max: config.isTest ? 1000 : 60, timeWindow: '10 minutes' } } },
    async (req) => {
      const user = requireUser(req);
      await assertParticipant(req.params.id, user.id);
      const { body } = parse(bodySchema, req.body);
      return { message: await postMessage(req.params.id, user.id, body) };
    },
  );

  app.post<{ Params: { id: string } }>('/api/conversations/:id/block', async (req) => {
    const user = requireUser(req);
    await assertParticipant(req.params.id, user.id);
    const { other } = await describe(req.params.id, user.id);
    if (!other) throw notFound('That member');
    await db
      .insertInto('blocks')
      .values({ blocker_id: user.id, blocked_id: other.id })
      .onConflict((oc) => oc.doNothing())
      .execute();
    return { blocked: true };
  });

  app.delete<{ Params: { id: string } }>('/api/conversations/:id/block', async (req) => {
    const user = requireUser(req);
    await assertParticipant(req.params.id, user.id);
    const { other } = await describe(req.params.id, user.id);
    if (other) await db.deleteFrom('blocks').where('blocker_id', '=', user.id).where('blocked_id', '=', other.id).execute();
    return { blocked: false };
  });
}
