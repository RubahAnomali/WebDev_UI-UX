import { createDb, migrateToLatest } from '../db/database.ts';
import { seedSampleData } from '../db/seed.ts';

const db = createDb();
await migrateToLatest(db);
const n = await seedSampleData(db);
console.info(`Seeded ${n} sample listings (flagged is_sample).`);
await db.destroy();
