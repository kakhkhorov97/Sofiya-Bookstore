import { INestApplication } from '@nestjs/common';
import type {
  AdminBook,
  AdminMember,
  AdminOrder,
  AdminOverview,
  AiDraft,
  BookDetail,
  BookInput,
  Page,
} from '@sofiya/shared';
import { randomUUID } from 'node:crypto';
import { sql } from 'drizzle-orm';
import sharp from 'sharp';
import request from 'supertest';
import { App } from 'supertest/types';
import { IndexJobService } from '../src/ai/index-job.service';
import {
  createTestApp,
  makeAdmin,
  signedInAgent,
  testDb,
  WEB_ORIGIN,
} from './fixtures';

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];

const png = (w = 300, h = 450) =>
  sharp({
    create: { width: w, height: h, channels: 3, background: '#24466b' },
  })
    .png()
    .toBuffer();

// Titles start with "Admin Test" so the slug begins "admin-test-" and the
// global setup can clean them up.
const bookInput = (overrides: Partial<BookInput> = {}): BookInput => ({
  title: `Admin Test ${randomUUID().slice(0, 8)}`,
  author: 'Ada Example',
  genre: 'FICTION',
  description: 'A book created by the admin tests, with enough words.',
  pages: 200,
  publishedYear: 1901,
  language: 'English',
  status: 'LIVE',
  staffPickNote: null,
  formats: [
    { format: 'PAPERBACK', price: { USD: 1299, KRW: 18_000 }, stock: 10 },
    { format: 'EBOOK', price: { USD: 499, KRW: 7_000 }, stock: null },
  ],
  ...overrides,
});

describe('Admin (e2e)', () => {
  let app: INestApplication<App>;
  let admin: Agent;
  let adminEmail: string;
  const handle = testDb();

  const send = (
    agent: Agent,
    method: 'post' | 'put' | 'patch' | 'delete',
    path: string,
  ) => agent[method](path).set('Origin', WEB_ORIGIN);

  async function createBook(overrides: Partial<BookInput> = {}) {
    const res = await send(admin, 'post', '/api/admin/books')
      .send(bookInput(overrides))
      .expect(201);
    return res.body as AdminBook;
  }

  beforeAll(async () => {
    app = await createTestApp();
    const a = await signedInAgent(app);
    await makeAdmin(handle.db, a.email);
    admin = a.agent;
    adminEmail = a.email;
  });
  afterAll(async () => {
    await app.get(IndexJobService).idle();
    await app.close();
    await handle.close();
  });

  describe('access', () => {
    it('is admins only', async () => {
      await request(app.getHttpServer()).get('/api/admin/overview').expect(401);
      const { agent } = await signedInAgent(app);
      for (const path of [
        '/api/admin/overview',
        '/api/admin/books',
        '/api/admin/members',
        '/api/admin/orders/detailed',
      ]) {
        await agent.get(path).expect(403);
      }
      await send(agent, 'post', '/api/admin/books')
        .send(bookInput())
        .expect(403);
    });
  });

  describe('books', () => {
    it('creates a live book that the shop shows at once', async () => {
      const book = await createBook();
      expect(book.slug).toMatch(/^admin-test-/);
      expect(book.formats.map((f) => f.format)).toEqual(['PAPERBACK', 'EBOOK']);
      const pub = await request(app.getHttpServer())
        .get(`/api/books/${book.slug}`)
        .expect(200);
      expect((pub.body as BookDetail).title).toBe(book.title);
    });

    it('keeps drafts out of the shop', async () => {
      const book = await createBook({ status: 'DRAFT' });
      await request(app.getHttpServer())
        .get(`/api/books/${book.slug}`)
        .expect(404);
    });

    it('gives a second book with the same title its own address', async () => {
      const title = `Admin Test Twin ${randomUUID().slice(0, 6)}`;
      const first = await createBook({ title });
      const second = await createBook({ title });
      expect(second.slug).toBe(`${first.slug}-2`);
    });

    it('validates the book', async () => {
      const post = (body: object) =>
        send(admin, 'post', '/api/admin/books').send(body).expect(400);
      await post(
        bookInput({
          formats: [
            { format: 'EBOOK', price: { USD: 1, KRW: 100 }, stock: null },
            { format: 'EBOOK', price: { USD: 2, KRW: 100 }, stock: null },
          ],
        }),
      );
      // Both prices are required.
      await post({
        ...bookInput(),
        formats: [{ format: 'EBOOK', price: { USD: 499 }, stock: null }],
      });
      await post(bookInput({ description: 'Too short' }));
      await post(bookInput({ formats: [] }));
      await post({ ...bookInput(), views: 999999 });
      await post(bookInput({ status: 'DELETED' as never }));
    });

    it('edits prices and formats, but keeps formats that were ordered', async () => {
      const book = await createBook();
      const updated = await send(admin, 'put', `/api/admin/books/${book.id}`)
        .send(
          bookInput({
            title: book.title,
            formats: [
              {
                format: 'PAPERBACK',
                price: { USD: 1599, KRW: 22_000 },
                stock: 3,
              },
            ],
          }),
        )
        .expect(200);
      expect((updated.body as AdminBook).formats).toEqual([
        expect.objectContaining({
          format: 'PAPERBACK',
          price: { USD: 1599, KRW: 22_000 },
          stock: 3,
        }),
      ]);

      // A customer orders the paperback; it can no longer be removed.
      const { agent } = await signedInAgent(app);
      await send(agent, 'post', '/api/orders')
        .send({
          idempotencyKey: randomUUID(),
          lines: [
            {
              formatId: (updated.body as AdminBook).formats[0].id,
              quantity: 1,
            },
          ],
        })
        .expect(201);
      const res = await send(admin, 'put', `/api/admin/books/${book.id}`)
        .send(
          bookInput({
            title: book.title,
            formats: [
              { format: 'EBOOK', price: { USD: 499, KRW: 7_000 }, stock: null },
            ],
          }),
        )
        .expect(409);
      expect(res.body.message).toMatch(/stock to 0/);
    });

    it('soft-deletes: gone from the shop and the admin list, orders kept', async () => {
      const book = await createBook();
      await send(admin, 'delete', `/api/admin/books/${book.id}`).expect(204);
      await request(app.getHttpServer())
        .get(`/api/books/${book.slug}`)
        .expect(404);
      const list = await admin
        .get(`/api/admin/books?q=${encodeURIComponent(book.title)}`)
        .expect(200);
      expect((list.body as Page<AdminBook>).total).toBe(0);
    });

    it('searches and filters the admin list', async () => {
      const book = await createBook({ status: 'PAUSED' });
      const res = await admin
        .get(
          `/api/admin/books?q=${encodeURIComponent(book.title)}&status=PAUSED`,
        )
        .expect(200);
      expect((res.body as Page<AdminBook>).items.map((b) => b.id)).toEqual([
        book.id,
      ]);
    });
  });

  describe('covers', () => {
    it('re-encodes an uploaded image and serves it', async () => {
      const book = await createBook();
      const res = await admin
        .put(`/api/admin/books/${book.id}/cover`)
        .set('Origin', WEB_ORIGIN)
        .attach('cover', await png(), {
          filename: 'cover.png',
          contentType: 'image/png',
        })
        .expect(200);
      const url = (res.body as AdminBook).coverUrl!;
      expect(url).toMatch(/^\/api\/covers\/[0-9a-f-]{36}\.webp$/);

      const img = await request(app.getHttpServer()).get(url).expect(200);
      expect(img.headers['content-type']).toBe('image/webp');
      expect(img.headers['x-content-type-options']).toBe('nosniff');
      const meta = await sharp(img.body as Buffer).metadata();
      expect(meta.format).toBe('webp');

      // The shop's book card uses it too.
      const pub = await request(app.getHttpServer())
        .get(`/api/books/${book.slug}`)
        .expect(200);
      expect((pub.body as BookDetail).coverUrl).toBe(url);

      // Replacing the cover deletes the old file.
      const replaced = await admin
        .put(`/api/admin/books/${book.id}/cover`)
        .set('Origin', WEB_ORIGIN)
        .attach('cover', await png(400, 600), {
          filename: 'b.png',
          contentType: 'image/png',
        })
        .expect(200);
      expect((replaced.body as AdminBook).coverUrl).not.toBe(url);
      await request(app.getHttpServer()).get(url).expect(404);

      const removed = await send(
        admin,
        'delete',
        `/api/admin/books/${book.id}/cover`,
      ).expect(200);
      expect((removed.body as AdminBook).coverUrl).toBeNull();
    });

    it('rejects files that are not images, whatever they claim to be', async () => {
      const book = await createBook();
      await admin
        .put(`/api/admin/books/${book.id}/cover`)
        .set('Origin', WEB_ORIGIN)
        .attach('cover', Buffer.from('<script>alert(1)</script>'), {
          filename: 'cover.png',
          contentType: 'image/png',
        })
        .expect(400);
      await admin
        .put(`/api/admin/books/${book.id}/cover`)
        .set('Origin', WEB_ORIGIN)
        .expect(400);
    });

    it('rejects files over 5 MB', async () => {
      const book = await createBook();
      await admin
        .put(`/api/admin/books/${book.id}/cover`)
        .set('Origin', WEB_ORIGIN)
        .attach('cover', Buffer.alloc(6 * 1024 * 1024, 1), {
          filename: 'big.png',
          contentType: 'image/png',
        })
        .expect(413);
    });

    it('refuses odd cover paths', async () => {
      await request(app.getHttpServer())
        .get('/api/covers/..%2F..%2Fetc%2Fpasswd')
        .expect(404);
      await request(app.getHttpServer())
        .get('/api/covers/not-a-key.webp')
        .expect(404);
    });
  });

  describe('AI', () => {
    it('indexes new books and flags edited ones as out of date', async () => {
      const jobs = app.get(IndexJobService);
      const book = await createBook();
      await jobs.idle();
      expect(
        (await admin.get(`/api/admin/books/${book.id}`)).body,
      ).toMatchObject({
        indexStatus: 'INDEXED',
      });

      // Mark it stale by editing the text directly, without triggering a run.
      await handle.db.execute(
        sql`UPDATE books SET description = 'Completely different words about a lighthouse.' WHERE id = ${book.id}`,
      );
      expect(
        (await admin.get(`/api/admin/books/${book.id}`)).body,
      ).toMatchObject({
        indexStatus: 'STALE',
      });

      await send(admin, 'post', '/api/admin/ai/index').expect(202);
      await jobs.idle();
      expect(
        (await admin.get(`/api/admin/books/${book.id}`)).body,
      ).toMatchObject({
        indexStatus: 'INDEXED',
      });
    });

    it('drafts a description from the title, author and cover', async () => {
      const res = await admin
        .post('/api/admin/books/ai-draft')
        .set('Origin', WEB_ORIGIN)
        .field('title', 'Learning Python Scripts')
        .field('author', 'Test Author')
        .attach('cover', await png(), {
          filename: 'c.png',
          contentType: 'image/png',
        })
        .expect(201);
      const draft = res.body as AiDraft;
      expect(draft.description).toContain('Learning Python Scripts');
      expect(draft.description).toContain('A cover was supplied.');
      expect(draft.genre).toBe('PROGRAMMING');

      await admin
        .post('/api/admin/books/ai-draft')
        .set('Origin', WEB_ORIGIN)
        .field('author', 'No Title')
        .expect(400);
    });
  });

  describe('orders and members', () => {
    it('lists orders with the customer, searchable by email', async () => {
      const book = await createBook();
      const customer = await signedInAgent(app);
      await send(customer.agent, 'post', '/api/orders')
        .send({
          idempotencyKey: randomUUID(),
          lines: [{ formatId: book.formats[0].id, quantity: 2 }],
        })
        .expect(201);
      const res = await admin
        .get(
          `/api/admin/orders/detailed?q=${encodeURIComponent(customer.email)}`,
        )
        .expect(200);
      const orders = (res.body as Page<AdminOrder>).items;
      expect(orders).toHaveLength(1);
      expect(orders[0].customer.email).toBe(customer.email);
      expect(orders[0].items[0]).toMatchObject({
        bookTitle: book.title,
        quantity: 2,
      });
    });

    it('blocks and unblocks members, effective immediately', async () => {
      const member = await signedInAgent(app);
      const list = await admin
        .get(`/api/admin/members?q=${encodeURIComponent(member.email)}`)
        .expect(200);
      const row = (list.body as Page<AdminMember>).items[0];
      expect(row).toMatchObject({
        email: member.email,
        status: 'ACTIVE',
        orderCount: 0,
      });

      await send(admin, 'patch', `/api/admin/members/${row.id}/status`)
        .send({ status: 'BLOCKED' })
        .expect(204);
      await member.agent.get('/api/me').expect(401);

      await send(admin, 'patch', `/api/admin/members/${row.id}/status`)
        .send({ status: 'ACTIVE' })
        .expect(204);
      await member.agent.get('/api/me').expect(200);
    });

    it('cannot block itself or another admin', async () => {
      const self = await admin.get(
        `/api/admin/members?q=${encodeURIComponent(adminEmail)}`,
      );
      const selfId = (self.body as Page<AdminMember>).items[0].id;
      await send(admin, 'patch', `/api/admin/members/${selfId}/status`)
        .send({ status: 'BLOCKED' })
        .expect(400);

      const other = await signedInAgent(app);
      await makeAdmin(handle.db, other.email);
      const res = await admin.get(
        `/api/admin/members?q=${encodeURIComponent(other.email)}`,
      );
      await send(
        admin,
        'patch',
        `/api/admin/members/${(res.body as Page<AdminMember>).items[0].id}/status`,
      )
        .send({ status: 'BLOCKED' })
        .expect(403);
      await send(admin, 'patch', `/api/admin/members/${selfId}/status`)
        .send({ status: 'DELETED' })
        .expect(400);
    });
  });

  describe('overview', () => {
    it('summarises the store, including what readers asked', async () => {
      const question = `Books about ${randomUUID().slice(0, 6)} lighthouses`;
      await request(app.getHttpServer())
        .post('/api/ask')
        .set('Origin', WEB_ORIGIN)
        .send({ message: question })
        .expect(200);
      // The question is logged just after the stream ends.
      await new Promise((r) => setTimeout(r, 200));

      const res = await admin.get('/api/admin/overview').expect(200);
      const o = res.body as AdminOverview;
      expect(o.books.LIVE).toBeGreaterThan(150);
      expect(Object.keys(o.orders).sort()).toEqual([
        'CANCELLED',
        'DELIVERED',
        'IN_PROCESS',
        'PAUSED',
      ]);
      expect(o.index.enabled).toBe(true);
      expect(o.recentQuestions.map((q) => q.question)).toContain(question);
      expect(o.members).toBeGreaterThan(0);
    });
  });
});
