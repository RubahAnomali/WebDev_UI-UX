import type { Kysely } from 'kysely';

/* eslint-disable @typescript-eslint/no-explicit-any */
export async function up(db: Kysely<any>): Promise<void> {
  await db.schema
    .alterTable('organizations')
    .addColumn('registration_number', 'text')
    .addColumn('reference', 'text')
    .execute();
}

export async function down(db: Kysely<any>): Promise<void> {
  await db.schema.alterTable('organizations').dropColumn('registration_number').dropColumn('reference').execute();
}
