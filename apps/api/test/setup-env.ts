import os from 'node:os';
import path from 'node:path';
import { TEST_DB_URL } from './test-db';

process.env.DATABASE_URL = TEST_DB_URL;
process.env.AUTH_SECRET ??= 'test-secret-that-is-at-least-32-characters-long';
// Fast hashing and no sign-in rate limit inside tests.
process.env.BCRYPT_ROUNDS = '4';
process.env.AUTH_RATE_LIMIT = '10000';
// Offline, deterministic AI: the RAG pipeline runs for real without Gemini.
process.env.AI_PROVIDER = 'fake';
process.env.GEMINI_API_KEY = '';
process.env.AI_RATE_LIMIT = '10000';
// Covers uploaded by tests go to a throwaway folder.
process.env.UPLOADS_DIR = path.join(os.tmpdir(), 'sofiya-test-uploads');
// Offline payments: "fake_ok…" keys are approved, "fake_fail…" are declined.
process.env.PAYMENTS_PROVIDER = 'fake';
process.env.TOSS_CLIENT_KEY = '';
process.env.TOSS_SECRET_KEY = '';
process.env.CARD_CURRENCIES = 'KRW';
// Emails are kept in memory for tests to read.
process.env.EMAIL_PROVIDER = 'memory';
process.env.WEB_ORIGINS = 'http://localhost:3000';
