import type { FastifyInstance } from 'fastify';
import { extractId, reportSchema } from '../../../shared/schemas/reports.ts';
import { config } from '../config.ts';
import type { DB } from '../db/database.ts';
import { ApiError } from '../lib/errors.ts';
import type { Mailer } from '../lib/mailer.ts';
import { parse } from '../lib/validate.ts';

export function reportRoutes(app: FastifyInstance, { db, mailer }: { db: DB; mailer: Mailer }) {
  app.post('/api/reports', { config: { rateLimit: { max: config.isTest ? 1000 : 10, timeWindow: '1 hour' } } }, async (req) => {
    const input = parse(reportSchema, req.body);
    const user = req.user;
    if (!user && !input.email) {
      throw new ApiError('VALIDATION', 'Add an email so we can follow up.', { fields: { email: 'Add an email so we can follow up.' } });
    }

    const id = extractId(input.link);
    let targetId: string | null = null;
    if (input.targetType === 'listing') {
      if (!id) throw new ApiError('VALIDATION', 'Paste the link to the listing.', { fields: { link: 'Paste the link to the listing.' } });
      const listing = await db.selectFrom('listings').select('id').where('id', '=', id).executeTakeFirst();
      if (!listing) throw new ApiError('VALIDATION', 'We couldn’t find that listing.', { fields: { link: 'We couldn’t find that listing.' } });
      targetId = listing.id;
    } else if (input.targetType === 'conversation') {
      if (!user) throw new ApiError('UNAUTHENTICATED', 'Please log in to report a conversation.');
      const p = id
        ? await db
            .selectFrom('conversation_participants')
            .select('conversation_id')
            .where('conversation_id', '=', id)
            .where('user_id', '=', user.id)
            .executeTakeFirst()
        : null;
      if (!p) throw new ApiError('VALIDATION', 'Paste the link to one of your conversations.', { fields: { link: 'Paste the link to one of your conversations.' } });
      targetId = p.conversation_id;
    } else if (input.targetType === 'user' && id) {
      // Accept a listing link as a way to identify its lister.
      const listing = await db.selectFrom('listings').select('owner_id').where('id', '=', id).executeTakeFirst();
      targetId = listing?.owner_id ?? null;
    }

    const report = await db
      .insertInto('reports')
      .values({
        reporter_id: user?.id ?? null,
        reporter_email: user ? null : input.email!,
        target_type: input.targetType,
        target_id: targetId,
        target_link: input.link || null,
        reason: input.reason,
        details: input.details,
      })
      .returning('id')
      .executeTakeFirstOrThrow();

    await mailer.send({
      to: user?.email ?? input.email!,
      subject: 'We received your report',
      body: 'Thank you for speaking up. Our moderation team will review it. For immediate danger to an animal, contact local animal welfare authorities or emergency services.',
    });
    return { id: report.id };
  });
}
