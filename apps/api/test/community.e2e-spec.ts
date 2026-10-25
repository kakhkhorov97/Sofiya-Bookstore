import { INestApplication } from '@nestjs/common';
import type {
  AuthorPage,
  BookDetail,
  BookSummary,
  OrderView,
  Page,
  ReviewsResponse,
} from '@sofiya/shared';
import { randomUUID } from 'node:crypto';
import { eq } from 'drizzle-orm';
import request from 'supertest';
import { App } from 'supertest/types';
import { orders } from '../src/db/schema';
import { CATALOGUE, STAFF_PICKS } from '../src/db/seed/catalogue';
import {
  createTestApp,
  signedInAgent,
  testDb,
  uniqueEmail,
  WEB_ORIGIN,
} from './fixtures';

type Agent = Awaited<ReturnType<typeof signedInAgent>>['agent'];

describe('Wishlist, reviews, authors and newsletter (e2e)', () => {
  let app: INestApplication<App>;
  const handle = testDb();
  const get = (path: string) => request(app.getHttpServer()).get(path);

  async function book(slug: string): Promise<BookDetail> {
    return (await get(`/api/books/${slug}`).expect(200)).body as BookDetail;
  }

  // Buys one copy and has the order confirmed, which unlocks reviewing.
  async function buyAndConfirm(agent: Agent, slug: string) {
    const detail = await book(slug);
    const format = detail.formats.find((f) => f.inStock)!;
    const res = await agent
      .post('/api/orders')
      .set('Origin', WEB_ORIGIN)
      .send({
        idempotencyKey: randomUUID(),
        lines: [{ formatId: format.id, quantity: 1 }],
      })
      .expect(201);
    await handle.db
      .update(orders)
      .set({ status: 'IN_PROCESS' })
      .where(eq(orders.id, (res.body as OrderView).id));
  }

  const putReview = (agent: Agent, slug: string, body: object) =>
    agent
      .put(`/api/books/${slug}/reviews`)
      .set('Origin', WEB_ORIGIN)
      .send(body);

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
    await handle.close();
  });

  describe('wishlist', () => {
    it('saves, lists and removes books for the signed-in reader', async () => {
      const { agent } = await signedInAgent(app);
      const dracula = await book('dracula-stoker');
      const emma = await book('emma-austen');

      for (const b of [dracula, emma]) {
        await agent
          .put(`/api/wishlist/${b.id}`)
          .set('Origin', WEB_ORIGIN)
          .expect(204);
      }
      // Saving twice is harmless.
      await agent
        .put(`/api/wishlist/${emma.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);

      const list = await agent.get('/api/wishlist').expect(200);
      expect((list.body as BookSummary[]).map((b) => b.slug)).toEqual([
        'emma-austen',
        'dracula-stoker',
      ]);
      const ids = await agent.get('/api/wishlist/ids').expect(200);
      expect((ids.body as string[]).sort()).toEqual(
        [dracula.id, emma.id].sort(),
      );

      await agent
        .delete(`/api/wishlist/${dracula.id}`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);
      const after = await agent.get('/api/wishlist').expect(200);
      expect((after.body as BookSummary[]).map((b) => b.slug)).toEqual([
        'emma-austen',
      ]);
    });

    it('requires sign-in and a real book', async () => {
      await get('/api/wishlist').expect(401);
      const { agent } = await signedInAgent(app);
      await agent
        .put(`/api/wishlist/${randomUUID()}`)
        .set('Origin', WEB_ORIGIN)
        .expect(404);
    });
  });

  describe('reviews', () => {
    it('shows reviews to everyone and asks visitors to sign in', async () => {
      const res = await get('/api/books/walden-thoreau/reviews').expect(200);
      const body = res.body as ReviewsResponse;
      expect(body.viewer).toEqual({
        canReview: false,
        reason: 'SIGN_IN',
        myReview: null,
      });
      expect(body.summary.distribution).toHaveLength(5);
    });

    it('only lets readers review books they bought', async () => {
      const { agent } = await signedInAgent(app);
      const res = await agent.get('/api/books/walden-thoreau/reviews');
      expect((res.body as ReviewsResponse).viewer.reason).toBe('NOT_PURCHASED');
      await putReview(agent, 'walden-thoreau', {
        rating: 5,
        body: 'I have not read this but I love it.',
      }).expect(403);
    });

    it('lets a buyer write, edit and delete one review, and updates ratings', async () => {
      const slug = 'the-time-machine-wells';
      const a = await signedInAgent(app);
      const b = await signedInAgent(app);
      await buyAndConfirm(a.agent, slug);
      await buyAndConfirm(b.agent, slug);

      await putReview(a.agent, slug, {
        rating: 4,
        title: 'Strange and short',
        body: 'The Morlocks stayed with me for weeks.',
      }).expect(200);
      await putReview(b.agent, slug, {
        rating: 2,
        body: 'Interesting ideas, thin characters.',
      }).expect(200);
      // Editing replaces the first review instead of adding another.
      await putReview(a.agent, slug, {
        rating: 5,
        body: 'Re-read it: even better the second time.',
      }).expect(200);

      const res = await a.agent.get(`/api/books/${slug}/reviews`).expect(200);
      const body = res.body as ReviewsResponse;
      expect(body.summary.count).toBe(2);
      expect(body.summary.average).toBe(3.5);
      expect(body.summary.distribution).toEqual([0, 1, 0, 0, 1]);
      expect(body.viewer.canReview).toBe(true);
      expect(body.viewer.myReview?.rating).toBe(5);

      // Ratings show up on book cards and pages.
      expect((await book(slug)).ratingAvg).toBe(3.5);
      expect((await book(slug)).ratingCount).toBe(2);

      await a.agent
        .delete(`/api/books/${slug}/reviews`)
        .set('Origin', WEB_ORIGIN)
        .expect(204);
      expect((await book(slug)).ratingCount).toBe(1);
    });

    it('validates the rating and the text', async () => {
      const { agent } = await signedInAgent(app);
      await buyAndConfirm(agent, 'flatland-abbott');
      await putReview(agent, 'flatland-abbott', {
        rating: 6,
        body: 'Off the scale!',
      }).expect(400);
      await putReview(agent, 'flatland-abbott', {
        rating: 3,
        body: 'Short',
      }).expect(400);
      await putReview(agent, 'flatland-abbott', {
        rating: 3,
        body: 'A clever little book about dimensions.',
        userId: randomUUID(),
      }).expect(400);
    });
  });

  describe('authors and staff picks', () => {
    it('lists every live book by an author, oldest first', async () => {
      const res = await get('/api/authors/jane-austen').expect(200);
      const page = res.body as AuthorPage;
      expect(page.name).toBe('Jane Austen');
      expect(page.books).toHaveLength(
        CATALOGUE.filter((b) => b.author === 'Jane Austen').length,
      );
      const years = page.books.map((b) => b.publishedYear!);
      expect(years).toEqual([...years].sort((x, y) => x - y));
      await get('/api/authors/nobody-at-all').expect(404);
    });

    it('filters the catalogue to staff picks, each with a note', async () => {
      const res = await get('/api/books?staffPicks=true&limit=60').expect(200);
      const items = (res.body as Page<BookSummary>).items;
      expect(items.length).toBeGreaterThan(0);
      expect(items.length).toBeLessThanOrEqual(Object.keys(STAFF_PICKS).length);
      for (const b of items) {
        expect(b.staffPickNote).toBe(STAFF_PICKS[b.title]);
      }
    });
  });

  describe('newsletter', () => {
    it('subscribes once per address, ignoring case', async () => {
      const email = uniqueEmail();
      await request(app.getHttpServer())
        .post('/api/newsletter')
        .set('Origin', WEB_ORIGIN)
        .send({ email })
        .expect(201);
      await request(app.getHttpServer())
        .post('/api/newsletter')
        .set('Origin', WEB_ORIGIN)
        .send({ email: email.toUpperCase() })
        .expect(200);
      await request(app.getHttpServer())
        .post('/api/newsletter')
        .set('Origin', WEB_ORIGIN)
        .send({ email: 'not-an-email' })
        .expect(400);
    });
  });
});
