import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { requireUser } from '../auth/session.ts';
import type { DB } from '../db/database.ts';

export function meRoutes(app: FastifyInstance, { db }: { db: DB }) {
  /** Badge counts for the signed-in header. */
  app.get('/api/me/counts', async (req) => {
    const user = requireUser(req);
    const unread = await db
      .selectFrom('conversation_participants as cp')
      .innerJoin('messages as m', 'm.conversation_id', 'cp.conversation_id')
      .select(sql<number>`count(distinct cp.conversation_id)::int`.as('n'))
      .where('cp.user_id', '=', user.id)
      .where('m.sender_id', '!=', user.id)
      .where((eb) => eb.or([eb('cp.last_read_at', 'is', null), eb('m.created_at', '>', eb.ref('cp.last_read_at'))]))
      .executeTakeFirst();
    const requests = await db
      .selectFrom('adoption_requests as r')
      .innerJoin('listings as l', 'l.id', 'r.listing_id')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('l.owner_id', '=', user.id)
      .where('r.seller_unread', '=', true)
      .where('r.status', 'in', ['sent', 'in_review'])
      .executeTakeFirst();
    return { unreadConversations: unread?.n ?? 0, newRequests: requests?.n ?? 0 };
  });
}
