import { TEST_DB_URL } from './test-db';

process.env.DATABASE_URL = TEST_DB_URL;
process.env.AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';
// Fast hashing and no sign-in rate limit inside tests.
process.env.BCRYPT_ROUNDS = '4';
process.env.AUTH_RATE_LIMIT = '10000';
