import { sql, type Kysely } from 'kysely';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  await sql`CREATE EXTENSION IF NOT EXISTS pgcrypto`.execute(db);

  const id = (col: any) => col.primaryKey().defaultTo(sql`gen_random_uuid()`);
  const now = (col: any) => col.notNull().defaultTo(sql`now()`);

  await db.schema
    .createTable('organizations')
    .addColumn('id', 'uuid', id)
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('legal_id', 'text')
    .addColumn('website', 'text')
    .addColumn('city', 'text', (c) => c.notNull())
    .addColumn('verification_status', 'text', (c) => c.notNull().defaultTo('pending'))
    .addColumn('verified_by', 'uuid')
    .addColumn('verified_at', 'timestamptz')
    .addColumn('verification_note', 'text')
    .addColumn('is_sample', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', now)
    .execute();

  await db.schema
    .createTable('users')
    .addColumn('id', 'uuid', id)
    .addColumn('email', 'text', (c) => c.notNull().unique())
    .addColumn('full_name', 'text', (c) => c.notNull())
    .addColumn('location', 'text', (c) => c.notNull())
    .addColumn('phone', 'text')
    .addColumn('account_type', 'text', (c) => c.notNull())
    .addColumn('password_hash', 'text', (c) => c.notNull())
    .addColumn('email_verified_at', 'timestamptz')
    .addColumn('roles', sql`text[]`, (c) => c.notNull().defaultTo(sql`ARRAY['member']::text[]`))
    .addColumn('organization_id', 'uuid', (c) => c.references('organizations.id').onDelete('set null'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('active'))
    .addColumn('listing_rules_accepted_at', 'timestamptz')
    .addColumn('terms_accepted_at', 'timestamptz', (c) => c.notNull())
    .addColumn('is_sample', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .addCheckConstraint('users_email_lower', sql`email = lower(email)`)
    .execute();

  await db.schema
    .alterTable('organizations')
    .addForeignKeyConstraint('organizations_verified_by_fk', ['verified_by'], 'users', ['id'])
    .onDelete('set null')
    .execute();

  await db.schema
    .createTable('sessions')
    .addColumn('id_hash', 'text', (c) => c.primaryKey())
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('persistent', 'boolean', (c) => c.notNull())
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('last_seen_at', 'timestamptz', now)
    .addColumn('user_agent', 'text')
    .execute();
  await db.schema.createIndex('sessions_user_idx').on('sessions').column('user_id').execute();

  await db.schema
    .createTable('auth_tokens')
    .addColumn('id', 'uuid', id)
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('type', 'text', (c) => c.notNull())
    .addColumn('token_hash', 'text', (c) => c.notNull().unique())
    .addColumn('payload', 'jsonb')
    .addColumn('expires_at', 'timestamptz', (c) => c.notNull())
    .addColumn('used_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', now)
    .execute();
  await db.schema.createIndex('auth_tokens_user_type_idx').on('auth_tokens').columns(['user_id', 'type']).execute();

  await db.schema
    .createTable('listings')
    .addColumn('id', 'uuid', id)
    .addColumn('owner_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('organization_id', 'uuid', (c) => c.references('organizations.id').onDelete('set null'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('draft'))
    .addColumn('name', 'text', (c) => c.notNull())
    .addColumn('species', 'text')
    .addColumn('breed', 'text')
    .addColumn('sex', 'text')
    .addColumn('age_value', 'integer')
    .addColumn('age_unit', 'text')
    .addColumn('size', 'text')
    .addColumn('listing_type', 'text')
    .addColumn('fee', 'integer')
    .addColumn('city', 'text')
    .addColumn('lat', 'double precision')
    .addColumn('lng', 'double precision')
    .addColumn('vaccinated', 'text')
    .addColumn('spayed_neutered', 'text')
    .addColumn('microchipped', 'text')
    .addColumn('house_trained', 'text')
    .addColumn('good_with', sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn('energy_level', 'text')
    .addColumn('medical_notes', 'text')
    .addColumn('behavior_notes', 'text')
    .addColumn('care_needs', 'text')
    .addColumn('traits', sql`text[]`, (c) => c.notNull().defaultTo(sql`'{}'::text[]`))
    .addColumn('about', 'text')
    .addColumn('ideal_home', 'text')
    .addColumn('rehoming_reason', 'text')
    .addColumn('artwork_tone', 'text', (c) => c.notNull().defaultTo('green'))
    .addColumn('attestations', 'jsonb')
    .addColumn('moderation_note', 'text')
    .addColumn('is_sample', 'boolean', (c) => c.notNull().defaultTo(false))
    .addColumn('submitted_at', 'timestamptz')
    .addColumn('published_at', 'timestamptz')
    .addColumn('rehomed_at', 'timestamptz')
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .execute();
  await db.schema.createIndex('listings_status_idx').on('listings').columns(['status', 'published_at']).execute();
  await db.schema.createIndex('listings_owner_idx').on('listings').column('owner_id').execute();

  await db.schema
    .createTable('listing_photos')
    .addColumn('id', 'uuid', id)
    .addColumn('listing_id', 'uuid', (c) => c.notNull().references('listings.id').onDelete('cascade'))
    .addColumn('position', 'integer', (c) => c.notNull())
    .addColumn('storage_key', 'text', (c) => c.notNull())
    .addColumn('width', 'integer', (c) => c.notNull())
    .addColumn('height', 'integer', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', now)
    .execute();
  await db.schema.createIndex('listing_photos_listing_idx').on('listing_photos').column('listing_id').execute();

  await db.schema
    .createTable('favorites')
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('listing_id', 'uuid', (c) => c.notNull().references('listings.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('favorites_pk', ['user_id', 'listing_id'])
    .execute();

  await db.schema
    .createTable('adoption_requests')
    .addColumn('id', 'uuid', id)
    .addColumn('listing_id', 'uuid', (c) => c.notNull().references('listings.id').onDelete('cascade'))
    .addColumn('applicant_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('sent'))
    .addColumn('full_name', 'text', (c) => c.notNull())
    .addColumn('email', 'text', (c) => c.notNull())
    .addColumn('phone', 'text')
    .addColumn('city', 'text', (c) => c.notNull())
    .addColumn('home_type', 'text', (c) => c.notNull())
    .addColumn('housing_permission', 'text', (c) => c.notNull())
    .addColumn('household', 'text', (c) => c.notNull())
    .addColumn('other_pets', 'text')
    .addColumn('experience', 'text')
    .addColumn('message', 'text', (c) => c.notNull())
    .addColumn('seller_unread', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('updated_at', 'timestamptz', now)
    .execute();
  await sql`CREATE UNIQUE INDEX adoption_requests_active_uniq ON adoption_requests (listing_id, applicant_id)
            WHERE status NOT IN ('withdrawn', 'declined')`.execute(db);

  await db.schema
    .createTable('request_events')
    .addColumn('id', 'uuid', id)
    .addColumn('request_id', 'uuid', (c) => c.notNull().references('adoption_requests.id').onDelete('cascade'))
    .addColumn('status', 'text', (c) => c.notNull())
    .addColumn('actor_id', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('note', 'text')
    .addColumn('created_at', 'timestamptz', now)
    .execute();

  await db.schema
    .createTable('conversations')
    .addColumn('id', 'uuid', id)
    .addColumn('listing_id', 'uuid', (c) => c.notNull().references('listings.id').onDelete('cascade'))
    .addColumn('request_id', 'uuid', (c) => c.references('adoption_requests.id').onDelete('set null'))
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('last_message_at', 'timestamptz', now)
    .execute();

  await db.schema
    .createTable('conversation_participants')
    .addColumn('conversation_id', 'uuid', (c) => c.notNull().references('conversations.id').onDelete('cascade'))
    .addColumn('user_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('last_read_at', 'timestamptz')
    .addPrimaryKeyConstraint('conversation_participants_pk', ['conversation_id', 'user_id'])
    .execute();

  await db.schema
    .createTable('messages')
    .addColumn('id', 'uuid', id)
    .addColumn('conversation_id', 'uuid', (c) => c.notNull().references('conversations.id').onDelete('cascade'))
    .addColumn('sender_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('body', 'text', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', now)
    .execute();
  await db.schema.createIndex('messages_conversation_idx').on('messages').columns(['conversation_id', 'created_at']).execute();

  await db.schema
    .createTable('blocks')
    .addColumn('blocker_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('blocked_id', 'uuid', (c) => c.notNull().references('users.id').onDelete('cascade'))
    .addColumn('created_at', 'timestamptz', now)
    .addPrimaryKeyConstraint('blocks_pk', ['blocker_id', 'blocked_id'])
    .execute();

  await db.schema
    .createTable('reports')
    .addColumn('id', 'uuid', id)
    .addColumn('reporter_id', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('reporter_email', 'text')
    .addColumn('target_type', 'text', (c) => c.notNull())
    .addColumn('target_id', 'uuid')
    .addColumn('target_link', 'text')
    .addColumn('reason', 'text', (c) => c.notNull())
    .addColumn('details', 'text', (c) => c.notNull())
    .addColumn('status', 'text', (c) => c.notNull().defaultTo('open'))
    .addColumn('resolved_by', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('resolution_note', 'text')
    .addColumn('created_at', 'timestamptz', now)
    .addColumn('resolved_at', 'timestamptz')
    .execute();

  await db.schema
    .createTable('moderation_actions')
    .addColumn('id', 'uuid', id)
    .addColumn('moderator_id', 'uuid', (c) => c.notNull().references('users.id'))
    .addColumn('listing_id', 'uuid', (c) => c.notNull().references('listings.id').onDelete('cascade'))
    .addColumn('decision', 'text', (c) => c.notNull())
    .addColumn('reason', 'text')
    .addColumn('checklist', 'jsonb', (c) => c.notNull())
    .addColumn('created_at', 'timestamptz', now)
    .execute();

  await db.schema
    .createTable('audit_log')
    .addColumn('id', 'uuid', id)
    .addColumn('actor_id', 'uuid', (c) => c.references('users.id').onDelete('set null'))
    .addColumn('action', 'text', (c) => c.notNull())
    .addColumn('entity_type', 'text', (c) => c.notNull())
    .addColumn('entity_id', 'uuid')
    .addColumn('data', 'jsonb')
    .addColumn('ip', 'text')
    .addColumn('created_at', 'timestamptz', now)
    .execute();

  await db.schema
    .createTable('notification_prefs')
    .addColumn('user_id', 'uuid', (c) => c.primaryKey().references('users.id').onDelete('cascade'))
    .addColumn('messages', 'boolean', (c) => c.notNull().defaultTo(true))
    .addColumn('discovery', 'boolean', (c) => c.notNull().defaultTo(false))
    .execute();

  await db.schema
    .createTable('dev_outbox')
    .addColumn('id', 'uuid', id)
    .addColumn('to_email', 'text', (c) => c.notNull())
    .addColumn('subject', 'text', (c) => c.notNull())
    .addColumn('body', 'text', (c) => c.notNull())
    .addColumn('link', 'text')
    .addColumn('created_at', 'timestamptz', now)
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  for (const t of [
    'dev_outbox',
    'notification_prefs',
    'audit_log',
    'moderation_actions',
    'reports',
    'blocks',
    'messages',
    'conversation_participants',
    'conversations',
    'request_events',
    'adoption_requests',
    'favorites',
    'listing_photos',
    'listings',
    'auth_tokens',
    'sessions',
  ]) {
    await db.schema.dropTable(t).ifExists().execute();
  }
  await db.schema.alterTable('organizations').dropConstraint('organizations_verified_by_fk').ifExists().execute();
  await db.schema.dropTable('users').ifExists().execute();
  await db.schema.dropTable('organizations').ifExists().execute();
}
