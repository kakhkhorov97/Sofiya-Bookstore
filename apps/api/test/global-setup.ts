import { sql } from 'drizzle-orm';
import { indexBooks } from '../src/ai/indexer';
import { FakeProvider } from '../src/ai/provider';
import { createDb } from '../src/db/client';
import { runMigrations } from '../src/db/migrate';
import { seedCatalogue } from '../src/db/seed/seed';
import { TEST_DB_URL } from './test-db';

export default async function globalSetup(): Promise<void> {
  await runMigrations(TEST_DB_URL);
  const { db, close } = createDb(TEST_DB_URL, { max: 1 });
  try {
    // Start every run clean: drop what earlier test runs created.
    await db.execute(
      sql`TRUNCATE order_items, orders, reviews, wishlist, newsletter_subscribers, ai_questions, users RESTART IDENTITY CASCADE`,
    );
    await db.execute(
      sql`DELETE FROM books WHERE slug LIKE 'test-book-%' OR slug LIKE 'admin-test-%'`,
    );
    await seedCatalogue(db);
    await indexBooks(db, new FakeProvider());
  } finally {
    await close();
  }
}
