import { createDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { seedCatalogue } from '../src/db/seed/seed';
import { TEST_DB_URL } from './test-db';

export default async function globalSetup(): Promise<void> {
  await runMigrations(TEST_DB_URL);
  const { db, close } = createDb(TEST_DB_URL, { max: 1 });
  try {
    await seedCatalogue(db);
  } finally {
    await close();
  }
}
