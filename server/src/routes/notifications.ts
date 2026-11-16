import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { z } from 'zod';
import { requireUser } from '../auth/session.ts';
import type { DB } from '../db/database.ts';
import { parse } from '../lib/validate.ts';

const readSchema = z.union([z.object({ all: z.literal(true) }), z.object({ ids: z.array(z.string().uuid()).min(1).max(100) })]);

export function notificationRoutes(app: FastifyInstance, { db }: { db: DB }) {
  app.get('/api/notifications', async (req) => {
    const user = requireUser(req);
    const rows = await db
      .selectFrom('notifications')
      .select(['id', 'type', 'title', 'body', 'link', 'read_at', 'created_at'])
      .where('user_id', '=', user.id)
      .orderBy('created_at', 'desc')
      .limit(30)
      .execute();
    const unread = await db
      .selectFrom('notifications')
      .select(sql<number>`count(*)::int`.as('n'))
      .where('user_id', '=', user.id)
      .where('read_at', 'is', null)
      .executeTakeFirst();
    return {
      items: rows.map((r) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        link: r.link,
        read: Boolean(r.read_at),
        createdAt: r.created_at.toISOString(),
      })),
      unread: unread?.n ?? 0,
    };
  });

  app.post('/api/notifications/read', async (req) => {
    const user = requireUser(req);
    const input = parse(readSchema, req.body);
    let q = db.updateTable('notifications').set({ read_at: new Date() }).where('user_id', '=', user.id).where('read_at', 'is', null);
    if ('ids' in input) q = q.where('id', 'in', input.ids);
    const res = await q.executeTakeFirst();
    return { updated: Number(res.numUpdatedRows) };
  });
}
