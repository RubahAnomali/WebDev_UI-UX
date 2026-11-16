import type { FastifyRequest } from 'fastify';
import type { DB } from '../db/database.ts';

export async function audit(
  db: DB,
  req: FastifyRequest | null,
  entry: { action: string; entityType: string; entityId?: string | null; data?: Record<string, unknown> },
) {
  await db
    .insertInto('audit_log')
    .values({
      actor_id: req?.user?.id ?? null,
      action: entry.action,
      entity_type: entry.entityType,
      entity_id: entry.entityId ?? null,
      data: entry.data ? JSON.stringify(entry.data) : null,
      ip: req?.ip ?? null,
    })
    .execute();
}
