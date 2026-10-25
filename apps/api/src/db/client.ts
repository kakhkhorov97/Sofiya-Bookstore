import { drizzle, PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import * as schema from './schema';

export type Db = PostgresJsDatabase<typeof schema>;

export interface DbHandle {
  db: Db;
  close: () => Promise<void>;
}

export function createDb(
  url: string,
  options: { max?: number } = {},
): DbHandle {
  const client = postgres(url, {
    max: options.max ?? 10,
    // Neon's pooled endpoint (PgBouncer) does not support prepared statements.
    prepare: false,
    onnotice: () => undefined,
  });
  return {
    db: drizzle(client, { schema }),
    close: () => client.end({ timeout: 5 }),
  };
}
