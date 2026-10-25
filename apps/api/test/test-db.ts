export const TEST_DB_URL =
  process.env.DATABASE_URL_TEST ?? 'postgresql://localhost:5432/sofiya_test';

// Guard: tests write to this database, so never point them at a real one.
const dbName = new URL(TEST_DB_URL).pathname.slice(1);
if (!dbName.endsWith('_test')) {
  throw new Error(
    `Refusing to run tests against "${dbName}": the database name must end with _test`,
  );
}
