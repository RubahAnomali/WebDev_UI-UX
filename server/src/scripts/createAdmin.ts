/**
 * The ONLY way to create an admin: run on the server by an operator.
 *   npm run admin:create -- --email staff@example.com --name "Sam Staff"
 * A one-time password-reset link is printed so the admin sets their own password.
 */
import { parseArgs } from 'node:util';
import { RESET_TOKEN_TTL_MS } from '../../../shared/constants.ts';
import { issueToken } from '../auth/tokens.ts';
import { config } from '../config.ts';
import { createDb, migrateToLatest } from '../db/database.ts';
import { hashPassword, randomToken } from '../lib/crypto.ts';

const { values } = parseArgs({ options: { email: { type: 'string' }, name: { type: 'string' } } });
if (!values.email || !values.name) {
  console.error('Usage: npm run admin:create -- --email <email> --name "<full name>"');
  process.exit(1);
}
const email = values.email.trim().toLowerCase();
const db = createDb();
await migrateToLatest(db);

const existing = await db.selectFrom('users').select(['id', 'roles']).where('email', '=', email).executeTakeFirst();
let userId: string;
if (existing) {
  const roles = Array.from(new Set([...existing.roles, 'admin']));
  await db.updateTable('users').set({ roles, email_verified_at: new Date() }).where('id', '=', existing.id).execute();
  userId = existing.id;
} else {
  const row = await db
    .insertInto('users')
    .values({
      email,
      full_name: values.name,
      location: 'Pawhaven HQ',
      account_type: 'individual',
      password_hash: await hashPassword(randomToken(32)),
      roles: ['member', 'admin'],
      email_verified_at: new Date(),
      terms_accepted_at: new Date(),
    })
    .returning('id')
    .executeTakeFirstOrThrow();
  await db.insertInto('notification_prefs').values({ user_id: row.id }).execute();
  userId = row.id;
}
await db
  .insertInto('audit_log')
  .values({ actor_id: null, action: 'admin.granted_via_cli', entity_type: 'user', entity_id: userId, data: JSON.stringify({ email }) })
  .execute();
const token = await issueToken(db, userId, 'reset', RESET_TOKEN_TTL_MS);
console.info(`Admin ready: ${email}\nSet a password within 30 minutes: ${config.appOrigin}/reset-password?token=${token}`);
await db.destroy();
