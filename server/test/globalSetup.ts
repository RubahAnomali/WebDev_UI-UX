import { createDb, migrateToLatest } from '../src/db/database.ts';

export default async function setup() {
  const url = process.env.TEST_DATABASE_URL ?? 'postgres://pawhaven:pawhaven@localhost:5432/pawhaven_test';
  const db = createDb(url);
  await migrateToLatest(db);
  await db.destroy();
}
