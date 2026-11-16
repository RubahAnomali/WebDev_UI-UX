import { buildApp } from './app.ts';
import { config } from './config.ts';
import { createDb, migrateToLatest } from './db/database.ts';

const db = createDb();
await migrateToLatest(db);
const app = await buildApp({ db });
await app.listen({ port: config.port, host: config.host });
console.info(`Pawhaven API listening on http://${config.host}:${config.port} (${config.env})`);

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.on(signal, async () => {
    await app.close();
    await db.destroy();
    process.exit(0);
  });
}
