import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import type {
  BookDetail,
  BookSummary,
  FormatInfo,
  GenreCount,
  Page,
} from '@sofiya/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { loadEnv } from '../src/config/env';
import { configureApp } from '../src/main';
import { CATALOGUE } from '../src/db/seed/catalogue';
import { slugify, statusFor } from '../src/db/seed/seed';

describe('Books API (e2e)', () => {
  let app: INestApplication<App>;
  const get = (path: string) => request(app.getHttpServer()).get(path);

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = moduleRef.createNestApplication();
    configureApp(app, loadEnv());
    await app.init();
  });

  afterAll(async () => {
    await app.close();
  });

  it('sends security headers and no framework banner', async () => {
    const res = await get('/api/books?limit=1').expect(200);
    expect(res.headers['x-content-type-options']).toBe('nosniff');
    expect(res.headers['x-frame-options']).toBe('DENY');
    expect(res.headers['content-security-policy']).toContain(
      "default-src 'none'",
    );
    expect(res.headers['x-powered-by']).toBeUndefined();
  });

  it('lists live books with default pagination', async () => {
    const res = await get('/api/books').expect(200);
    const body = res.body as Page<BookSummary>;
    expect(body.page).toBe(1);
    expect(body.limit).toBe(24);
    expect(body.items).toHaveLength(24);
    expect(body.total).toBeGreaterThan(150);
    expect(body.items[0]).toMatchObject({
      slug: expect.any(String),
      fromPrice: { USD: expect.any(Number), KRW: expect.any(Number) },
      formats: expect.arrayContaining(['PAPERBACK']),
    });
  });

  it('filters by genre and format', async () => {
    const res = await get(
      '/api/books?genre=PROGRAMMING&format=EBOOK&limit=60',
    ).expect(200);
    const body = res.body as Page<BookSummary>;
    expect(body.items.length).toBeGreaterThan(10);
    for (const b of body.items) {
      expect(b.genre).toBe('PROGRAMMING');
      expect(b.formats).toContain('EBOOK');
    }
  });

  it('finds books by words in the description, ranked by relevance', async () => {
    const res = await get('/api/books?q=sherlock%20holmes').expect(200);
    const titles = (res.body as Page<BookSummary>).items.map((b) => b.title);
    expect(titles).toContain('The Hound of the Baskervilles');
    expect(titles.length).toBeGreaterThanOrEqual(5);
  });

  it('matches partial titles and authors', async () => {
    const res = await get('/api/books?q=Baskerv').expect(200);
    expect((res.body as Page<BookSummary>).items[0].title).toBe(
      'The Hound of the Baskervilles',
    );
  });

  it('treats regex and LIKE characters literally (legacy regex injection)', async () => {
    await get('/api/books?q=(.*').expect(200);
    const res = await get('/api/books?q=%25').expect(200);
    // "%" must not act as a wildcard that matches every book.
    expect((res.body as Page<BookSummary>).total).toBe(0);
  });

  it('sorts by price in the chosen currency', async () => {
    for (const currency of ['KRW', 'USD'] as const) {
      const res = await get(
        `/api/books?sort=price_desc&limit=20&currency=${currency}`,
      ).expect(200);
      const prices = (res.body as Page<BookSummary>).items.map(
        (b) => b.fromPrice[currency],
      );
      expect(prices).toEqual([...prices].sort((a, b) => b - a));
    }
    await get('/api/books?currency=EUR').expect(400);
  });

  it('rejects invalid query values', async () => {
    await get('/api/books?limit=1000').expect(400);
    await get('/api/books?genre=COOKING').expect(400);
    await get('/api/books?sort=random').expect(400);
  });

  it('returns book details with formats and stock flags', async () => {
    const res = await get('/api/books/pride-and-prejudice-austen').expect(200);
    const book = res.body as BookDetail;
    expect(book.title).toBe('Pride and Prejudice');
    expect(book.description.length).toBeGreaterThan(40);
    expect(book.formats.length).toBeGreaterThanOrEqual(2);
    for (const f of book.formats) {
      expect(f.price.USD).toBeGreaterThan(0);
      expect(f.price.KRW).toBeGreaterThan(0);
      expect(typeof f.inStock).toBe('boolean');
      // Exact stock counts are never exposed unless low.
      expect(f).not.toHaveProperty('stock');
    }
  });

  it('hides paused books from the list and the detail page', async () => {
    const paused = CATALOGUE.map((b) => slugify(b.title, b.author)).filter(
      (slug) => statusFor(slug) === 'PAUSED',
    );
    expect(paused.length).toBeGreaterThan(0);
    for (const slug of paused) {
      await get(`/api/books/${slug}`).expect(404);
    }
    const all = await get('/api/books?limit=60&page=1&sort=title').expect(200);
    const slugs = (all.body as Page<BookSummary>).items.map((b) => b.slug);
    for (const slug of paused) expect(slugs).not.toContain(slug);
  });

  it('404s for unknown books and 400s for malformed slugs', async () => {
    await get('/api/books/no-such-book').expect(404);
    await get('/api/books/NOT_A_SLUG').expect(400);
  });

  it('looks up fresh prices for basket lines', async () => {
    const detail = await get('/api/books/dracula-stoker').expect(200);
    const ids = (detail.body as BookDetail).formats.map((f) => f.id);
    const res = await get(`/api/formats?ids=${ids.join(',')},${ids[0]}`).expect(
      200,
    );
    const infos = res.body as FormatInfo[];
    expect(infos).toHaveLength(ids.length);
    expect(infos[0]).toMatchObject({
      available: true,
      book: { slug: 'dracula-stoker', title: 'Dracula' },
    });
    await get('/api/formats?ids=not-a-uuid').expect(400);
    await get('/api/formats').expect(400);
  });

  it('counts live books per genre', async () => {
    const res = await get('/api/genres').expect(200);
    const genres = res.body as GenreCount[];
    expect(genres).toHaveLength(9);
    for (const g of genres) expect(g.count).toBeGreaterThan(0);
  });
});
