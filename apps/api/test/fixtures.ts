import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
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

// A throwaway book with one paperback format, so tests never fight over
// stock in the shared seeded catalogue.
export async function createBook(
  db: ReturnType<typeof testDb>['db'],
  opts: { priceCents?: number; stock?: number | null; live?: boolean } = {},
) {
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
      format: 'PAPERBACK',
      priceCents: opts.priceCents ?? 1234,
      stock: opts.stock === undefined ? 10 : opts.stock,
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

// A signed-in browser: supertest's agent keeps the session cookie.
export async function signedInAgent(
  app: INestApplication<App>,
  email = uniqueEmail(),
  password = 'correct horse battery',
) {
  const agent = request.agent(app.getHttpServer());
  await agent
    .post('/api/auth/signup')
    .set('Origin', WEB_ORIGIN)
    .send({ email, password, displayName: 'Test Reader' })
    .expect(201);
  return { agent, email, password };
}

export async function makeAdmin(
  db: ReturnType<typeof testDb>['db'],
  email: string,
) {
  await db.update(users).set({ role: 'ADMIN' }).where(eq(users.email, email));
}
