import type { FastifyInstance } from 'fastify';
import { sql } from 'kysely';
import { config } from '../config.ts';
import type { DB } from '../db/database.ts';

export function systemRoutes(app: FastifyInstance, { db }: { db: DB }) {
  // Used by the hosting health check: also confirms the database is reachable.
  app.get('/api/health', async (_req, reply) => {
    try {
      await sql`select 1`.execute(db);
    } catch {
      return reply.code(503).send({ ok: false });
    }
    return {
      ok: true,
      // The client shows the "development mailbox" only when emails are not really sent.
      devMailbox: !config.smtpUrl && !config.isProd,
    };
  });

  if (!config.smtpUrl && !config.isProd) {
    /** Development only: the simulated inbox for one address. Never registered in production. */
    app.get<{ Querystring: { email?: string } }>('/api/dev/outbox', async (req) => {
      const email = String(req.query.email ?? '').trim().toLowerCase();
      if (!email) return { messages: [] };
      const messages = await db
        .selectFrom('dev_outbox')
        .select(['id', 'to_email as to', 'subject', 'body', 'link', 'created_at as createdAt'])
        .where('to_email', '=', email)
        .orderBy('created_at', 'desc')
        .limit(10)
        .execute();
      return { messages };
    });
  }
}
