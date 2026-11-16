import { sql } from 'kysely';
import { afterAll, beforeEach } from 'vitest';
import { createDb } from '../src/db/database.ts';

export const testDb = createDb();

beforeEach(async () => {
  await sql`TRUNCATE users, organizations, sessions, auth_tokens, listings, listing_photos, favorites,
    adoption_requests, request_events, conversations, conversation_participants, messages, blocks,
    reports, moderation_actions, audit_log, notification_prefs, dev_outbox, notifications RESTART IDENTITY CASCADE`.execute(testDb);
});

afterAll(async () => {
  await testDb.destroy();
});
