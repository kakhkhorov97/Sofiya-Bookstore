import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { isDigital, type BookFormat } from '@sofiya/shared';
import { randomUUID } from 'node:crypto';
import { eq, sql } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { loadEnv } from '../src/config/env';
import { createDb } from '../src/db/client';
import { bookFormats, books, users } from '../src/db/schema';
import { configureApp } from '../src/main';
import { TEST_DB_URL } from './test-db';

export const WEB_ORIGIN = 'http://localhost:3000';

export async function createTestApp(): Promise<INestApplication<App>> {
  const moduleRef = await Test.createTestingModule({
    imports: [AppModule],
  }).compile();
  const app = moduleRef.createNestApplication<INestApplication<App>>();
  configureApp(app, loadEnv());
  await app.init();
  return app;
}

export const testDb = () => createDb(TEST_DB_URL, { max: 2 });

export const uniqueEmail = () => `reader-${randomUUID()}@example.test`;

// A throwaway book with one format (a paperback unless told otherwise), so
// tests never fight over stock in the shared seeded catalogue. Digital
// formats default to untracked stock.
export async function createBook(
  db: ReturnType<typeof testDb>['db'],
  opts: {
    format?: BookFormat;
    priceCents?: number;
    priceKrw?: number;
    stock?: number | null;
    live?: boolean;
  } = {},
) {
  const kind = opts.format ?? 'PAPERBACK';
  const slug = `test-book-${randomUUID()}`;
  const [book] = await db
    .insert(books)
    .values({
      slug,
      title: `Test Book ${slug.slice(-6)}`,
      author: 'Test Author',
      genre: 'FICTION',
      description: 'A book that only exists in tests.',
      status: opts.live === false ? 'PAUSED' : 'LIVE',
    })
    .returning({ id: books.id });
  const [format] = await db
    .insert(bookFormats)
    .values({
      bookId: book.id,
      format: kind,
      priceCents: opts.priceCents ?? 1234,
      priceKrw: opts.priceKrw ?? 17_300,
      stock:
        opts.stock !== undefined ? opts.stock : isDigital(kind) ? null : 10,
    })
    .returning({ id: bookFormats.id });
  return { bookId: book.id, formatId: format.id, slug };
}

export async function stockOf(
  db: ReturnType<typeof testDb>['db'],
  formatId: string,
) {
  const [row] = await db
    .select({ stock: bookFormats.stock })
    .from(bookFormats)
    .where(eq(bookFormats.id, formatId));
  return row.stock;
}

// Shared by the fixtures that need to touch the database directly.
let fixtureDb: ReturnType<typeof testDb> | null = null;
const fixtureHandle = () => (fixtureDb ??= testDb());
afterAll(async () => {
  await fixtureDb?.close();
  fixtureDb = null;
});

// A signed-in browser: supertest's agent keeps the session cookie. The
// address counts as confirmed unless a test asks otherwise (the confirmation
// link itself is tested in emails.e2e-spec.ts).
export async function signedInAgent(
  app: INestApplication<App>,
  email = uniqueEmail(),
  password = 'correct horse battery',
  { verified = true }: { verified?: boolean } = {},
) {
  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/api/auth/signup')
    .set('Origin', WEB_ORIGIN)
    .send({ email, password, displayName: 'Test Reader' })
    .expect(201);
  if (verified) {
    await fixtureHandle()
      .db.update(users)
      .set({ emailVerifiedAt: sql`now()` })
      .where(eq(users.email, email));
  }
  return { agent, email, password };
}

export async function makeAdmin(
  db: ReturnType<typeof testDb>['db'],
  email: string,
) {
  await db.update(users).set({ role: 'ADMIN' }).where(eq(users.email, email));
}
