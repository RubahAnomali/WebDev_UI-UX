import { createDb, migrateToLatest } from '../db/database.ts';

const db = createDb();
const results = await migrateToLatest(db);
console.info(results.length ? results.map((r) => `${r.status}: ${r.migrationName}`).join('\n') : 'Database is up to date.');
await db.destroy();
