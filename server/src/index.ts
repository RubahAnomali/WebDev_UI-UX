import { buildApp } from './app.ts';
import { config, productionConfigProblems } from './config.ts';
import { createDb, migrateToLatest } from './db/database.ts';

const problems = productionConfigProblems();
if (problems.length) {
  console.error(`Pawhaven can't start in production:\n${problems.map((p) => `  • ${p}`).join('\n')}`);
  process.exit(1);
}

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
