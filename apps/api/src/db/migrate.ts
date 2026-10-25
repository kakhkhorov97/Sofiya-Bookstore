import path from 'node:path';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import { createDb } from './client';

export async function runMigrations(url: string): Promise<void> {
  const { db, close } = createDb(url, { max: 1 });
  try {
    await migrate(db, {
      migrationsFolder: path.join(__dirname, '../../drizzle'),
    });
  } finally {
    await close();
  }
}

if (require.main === module) {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error('DATABASE_URL is required to run migrations');
  runMigrations(url)
    .then(() => console.log('Migrations applied'))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
