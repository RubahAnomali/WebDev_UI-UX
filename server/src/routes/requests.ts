import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { ageLabel } from '../../../shared/listings.ts';
import { adoptionRequestSchema, decisionSchema, type IncomingRequest, type MyRequest } from '../../../shared/schemas/requests.ts';
import { requireVerified } from '../auth/policies.ts';
import { requireUser } from '../auth/session.ts';
import { config } from '../config.ts';
import type { DB } from '../db/database.ts';
import type { RequestRow } from '../db/schema.ts';
import { audit } from '../lib/audit.ts';
import { ApiError, notFound } from '../lib/errors.ts';
import type { Mailer } from '../lib/mailer.ts';
import { parse } from '../lib/validate.ts';
import { loadOwnListing } from '../listings/owner.ts';

const UUID = /^[0-9a-f-]{36}$/i;
const OPEN = ['sent', 'in_review', 'meet_invited'] as const;

/** Allowed lister transitions. */
const TRANSITIONS: Record<string, string[]> = {
  invite: ['sent', 'in_review'],
  approve: ['in_review', 'meet_invited'],
  decline: ['sent', 'in_review', 'meet_invited'],
};
const RESULT: Record<string, RequestRow['status']> = { invite: 'meet_invited', approve: 'approved', decline: 'declined' };

async function wantsEmail(db: DB, userId: string) {
  const prefs = await db.selectFrom('notification_prefs').select('messages').where('user_id', '=', userId).executeTakeFirst();
  return prefs?.messages ?? true;
}

export function requestRoutes(app: FastifyInstance, { db, mailer }: { db: DB; mailer: Mailer }) {
  async function listingInfo(listingId: string) {
    const row = await db
      .selectFrom('listings as l')
      .leftJoin('organizations as o', 'o.id', 'l.organization_id')
      .select((eb) => [
        'l.id',
        'l.name',
        'l.breed',
        'l.age_value',
        'l.age_unit',
        'l.sex',
        'l.city',
        'l.status',
        'l.owner_id',
        'l.artwork_tone',
        'l.organization_id',
        'o.name as org_name',
        eb
          .selectFrom('listing_photos as p')
          .select('p.storage_key')
          .whereRef('p.listing_id', '=', 'l.id')
          .orderBy('p.position')
          .limit(1)
          .as('cover_key'),
      ])
      .where('l.id', '=', listingId)
      .executeTakeFirstOrThrow();
    return {
      ownerId: row.owner_id,
      info: {
        id: row.id,
        name: row.name,
        breed: row.breed,
        ageLabel: ageLabel(row.age_value, row.age_unit),
        sex: row.sex,
        city: row.city,
        status: row.status,
        listerName: row.organization_id ? (row.org_name ?? 'Shelter / rescue') : 'Private pet parent',
        listerType: row.organization_id ? ('organization' as const) : ('individual' as const),
        thumbUrl: row.cover_key ? `/uploads/${row.cover_key}-md.webp` : null,
        artworkTone: (row.artwork_tone as MyRequest['listing']['artworkTone']) ?? 'green',
      },
    };
  }

  async function conversationFor(requestId: string) {
    const c = await db.selectFrom('conversations').select('id').where('request_id', '=', requestId).executeTakeFirst();
    return c?.id ?? null;
  }

  async function toMyRequest(r: RequestRow): Promise<MyRequest> {
    const events = await db
      .selectFrom('request_events')
      .select(['status', 'note', 'created_at'])
      .where('request_id', '=', r.id)
      .orderBy('created_at')
      .execute();
    return {
      id: r.id,
      status: r.status,
      createdAt: r.created_at.toISOString(),
      updatedAt: r.updated_at.toISOString(),
      listing: (await listingInfo(r.listing_id)).info,
      events: events.map((e) => ({ status: e.status, note: e.note, at: e.created_at.toISOString() })),
      conversationId: await conversationFor(r.id),
    };
  }

  async function toIncoming(r: RequestRow): Promise<IncomingRequest> {
    return {
      id: r.id,
      status: r.status,
      unread: r.seller_unread,
      createdAt: r.created_at.toISOString(),
      applicant: { name: r.full_name, city: r.city, email: r.email, phone: r.phone },
      homeType: r.home_type,
      housingPermission: r.housing_permission,
      household: r.household,
      otherPets: r.other_pets,
      experience: r.experience,
      message: r.message,
      conversationId: await conversationFor(r.id),
    };
  }

  /* ---------- Applicant ---------- */

  app.post<{ Params: { id: string } }>('/api/listings/:id/requests', { config: { rateLimit: { max: config.isTest ? 1000 : 20, timeWindow: '1 hour' } } }, async (req) => {
    const user = requireUser(req);
    requireVerified(user);
    if (!UUID.test(req.params.id)) throw notFound('That pet');
    const input = parse(adoptionRequestSchema, req.body);
    const listing = await db
      .selectFrom('listings')
      .select(['id', 'owner_id', 'status', 'name'])
      .where('id', '=', req.params.id)
      .executeTakeFirst();
    if (!listing || listing.status !== 'live') throw notFound('That pet');
    if (listing.owner_id === user.id) throw new ApiError('FORBIDDEN', 'You can’t send an adoption request for your own listing.');
    const blocked = await db
      .selectFrom('blocks')
      .select('blocker_id')
      .where('blocker_id', '=', listing.owner_id)
      .where('blocked_id', '=', user.id)
      .executeTakeFirst();
    if (blocked) throw new ApiError('FORBIDDEN', 'You can’t send a request for this listing.');

    const existing = await db
      .selectFrom('adoption_requests')
      .select('id')
      .where('listing_id', '=', listing.id)
      .where('applicant_id', '=', user.id)
      .where('status', 'not in', ['withdrawn', 'declined'])
      .executeTakeFirst();
    if (existing) throw new ApiError('CONFLICT', 'You already have an active adoption request for this pet.');

    const request = await db.transaction().execute(async (trx) => {
      const r = await trx
        .insertInto('adoption_requests')
        .values({
          listing_id: listing.id,
          applicant_id: user.id,
          full_name: input.fullName,
          email: user.email, // always the verified account email
          phone: input.phone || null,
          city: input.city,
          home_type: input.homeType,
          housing_permission: input.housingPermission,
          household: input.household,
          other_pets: input.otherPets || null,
          experience: input.experience || null,
          message: input.message,
        })
        .returningAll()
        .executeTakeFirstOrThrow();
      await trx.insertInto('request_events').values({ request_id: r.id, status: 'sent', actor_id: user.id }).execute();
      // Every request opens a private conversation between applicant and lister.
      const convo = await trx
        .insertInto('conversations')
        .values({ listing_id: listing.id, request_id: r.id })
        .returning('id')
        .executeTakeFirstOrThrow();
      await trx
        .insertInto('conversation_participants')
        .values([
          { conversation_id: convo.id, user_id: user.id, last_read_at: new Date() },
          { conversation_id: convo.id, user_id: listing.owner_id, last_read_at: null },
        ])
        .execute();
      await trx.insertInto('messages').values({ conversation_id: convo.id, sender_id: user.id, body: input.message }).execute();
      return r;
    });

    const owner = await db.selectFrom('users').select(['email', 'id']).where('id', '=', listing.owner_id).executeTakeFirstOrThrow();
    if (await wantsEmail(db, owner.id)) {
      await mailer.send({
        to: owner.email,
        subject: `New adoption request for ${listing.name}`,
        body: `${input.fullName.split(' ')[0]} sent an adoption request for ${listing.name}. Review it on Pawhaven — contact details stay private until you choose to share them.`,
        link: `${config.appOrigin}/my-listings/${listing.id}/requests`,
      });
    }
    return { request: await toMyRequest(request) };
  });

  app.get('/api/requests', async (req) => {
    const user = requireUser(req);
    const rows = await db
      .selectFrom('adoption_requests')
      .selectAll()
      .where('applicant_id', '=', user.id)
      .orderBy('updated_at', 'desc')
      .execute();
    return { items: await Promise.all(rows.map(toMyRequest)) };
  });

  async function ownRequest(userId: string, id: string) {
    if (!UUID.test(id)) throw notFound('That request');
    const r = await db.selectFrom('adoption_requests').selectAll().where('id', '=', id).executeTakeFirst();
    if (!r || r.applicant_id !== userId) throw notFound('That request');
    return r;
  }

  app.get<{ Params: { id: string } }>('/api/requests/:id', async (req) => {
    const user = requireUser(req);
    return { request: await toMyRequest(await ownRequest(user.id, req.params.id)) };
  });

  app.post<{ Params: { id: string } }>('/api/requests/:id/withdraw', async (req) => {
    const user = requireUser(req);
    const r = await ownRequest(user.id, req.params.id);
    if (!(OPEN as readonly string[]).includes(r.status)) throw new ApiError('CONFLICT', 'This request is already closed.');
    const updated = await db
      .updateTable('adoption_requests')
      .set({ status: 'withdrawn', updated_at: new Date(), seller_unread: false })
      .where('id', '=', r.id)
      .returningAll()
      .executeTakeFirstOrThrow();
    await db.insertInto('request_events').values({ request_id: r.id, status: 'withdrawn', actor_id: user.id }).execute();
    return { request: await toMyRequest(updated) };
  });

  /* ---------- Lister ---------- */

  app.get<{ Params: { id: string } }>('/api/my/listings/:id/requests', async (req) => {
    const user = requireUser(req);
    const listing = await loadOwnListing(db, user, req.params.id);
    const rows = await db
      .selectFrom('adoption_requests')
      .selectAll()
      .where('listing_id', '=', listing.id)
      .where('status', '!=', 'withdrawn')
      .orderBy(sql`case when status in ('sent','in_review','meet_invited') then 0 else 1 end`)
      .orderBy('created_at', 'desc')
      .execute();
    return {
      listing: { id: listing.id, name: listing.name, status: listing.status },
      items: await Promise.all(rows.map(toIncoming)),
    };
  });

  async function incoming(userId: string, id: string) {
    if (!UUID.test(id)) throw notFound('That request');
    const r = await db
      .selectFrom('adoption_requests as r')
      .innerJoin('listings as l', 'l.id', 'r.listing_id')
      .selectAll('r')
      .select(['l.owner_id', 'l.name as listing_name'])
      .where('r.id', '=', id)
      .executeTakeFirst();
    if (!r || r.owner_id !== userId || r.status === 'withdrawn') throw notFound('That request');
    return r;
  }

  /** Opening a request marks it read and moves it into review. */
  app.get<{ Params: { id: string } }>('/api/my/requests/:id', async (req) => {
    const user = requireUser(req);
    let r: RequestRow = await incoming(user.id, req.params.id);
    if (r.seller_unread || r.status === 'sent') {
      const nextStatus = r.status === 'sent' ? 'in_review' : r.status;
      r = await db
        .updateTable('adoption_requests')
        .set({ seller_unread: false, status: nextStatus, updated_at: nextStatus !== r.status ? new Date() : r.updated_at })
        .where('id', '=', r.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      if (nextStatus === 'in_review') {
        await db.insertInto('request_events').values({ request_id: r.id, status: 'in_review', actor_id: user.id }).execute();
      }
    }
    return { request: await toIncoming(r) };
  });

  for (const action of ['invite', 'approve', 'decline'] as const) {
    app.post<{ Params: { id: string } }>(`/api/my/requests/:id/${action}`, async (req) => {
      const user = requireUser(req);
      const r = await incoming(user.id, req.params.id);
      if (!TRANSITIONS[action]!.includes(r.status)) {
        throw new ApiError('CONFLICT', 'That step isn’t available for this request right now.');
      }
      const { note } = parse(decisionSchema, req.body ?? {});
      const status = RESULT[action]!;
      const updated = await db
        .updateTable('adoption_requests')
        .set({ status, updated_at: new Date(), seller_unread: false })
        .where('id', '=', r.id)
        .returningAll()
        .executeTakeFirstOrThrow();
      await db.insertInto('request_events').values({ request_id: r.id, status, actor_id: user.id, note: note || null }).execute();
      await audit(db, req, { action: `request.${action}`, entityType: 'adoption_request', entityId: r.id });

      if (await wantsEmail(db, r.applicant_id)) {
        const subject = {
          invite: `You’re invited to meet ${r.listing_name}`,
          approve: `Good news about ${r.listing_name}`,
          decline: `An update on your request for ${r.listing_name}`,
        }[action];
        const body = {
          invite: `The lister would like to arrange a safe, in-person meet-and-greet with ${r.listing_name}. Reply in your Pawhaven messages to plan it.`,
          approve: `Your adoption request for ${r.listing_name} was approved. Complete the next steps together — never send money before meeting in person.`,
          decline: `Your request for ${r.listing_name} wasn’t a match this time. There are more companions waiting for a loving home.`,
        }[action];
        await mailer.send({ to: r.email, subject, body, link: `${config.appOrigin}/requests/${r.id}` });
      }
      return { request: await toIncoming(updated) };
    });
  }
}
