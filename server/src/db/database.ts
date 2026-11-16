import { Kysely, PostgresDialect } from 'kysely';
import { Migrator, type Migration, type MigrationProvider } from 'kysely/migration';
import pg from 'pg';
import { config } from '../config.ts';
import * as m001 from './migrations/001_init.ts';
import type { Database } from './schema.ts';

// Return BIGINT/NUMERIC as numbers where safe; dates stay Date objects.
pg.types.setTypeParser(20, (v) => Number(v));

export function createDb(url = config.databaseUrl) {
  return new Kysely<Database>({
    dialect: new PostgresDialect({ pool: new pg.Pool({ connectionString: url, max: 10 }) }),
  });
}

export type DB = Kysely<Database>;

class StaticProvider implements MigrationProvider {
  async getMigrations(): Promise<Record<string, Migration>> {
    return { '001_init': m001 };
  }
}

export async function migrateToLatest(db: DB) {
  const migrator = new Migrator({ db, provider: new StaticProvider() });
  const { error, results } = await migrator.migrateToLatest();
  results?.forEach((r) => {
    if (r.status === 'Error') console.error(`Migration failed: ${r.migrationName}`);
  });
  if (error) throw error;
  return results ?? [];
}
