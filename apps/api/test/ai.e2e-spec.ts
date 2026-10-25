import { INestApplication } from '@nestjs/common';
import type { AiStatus, AskEvent, BookSummary, Page } from '@sofiya/shared';
import request from 'supertest';
import { App } from 'supertest/types';
import { createTestApp, WEB_ORIGIN } from './fixtures';

// Collects a text/event-stream response into its events.
function parseEvents(text: string): AskEvent[] {
  return text
    .split('\n\n')
    .filter((chunk) => chunk.startsWith('data: '))
    .map((chunk) => JSON.parse(chunk.slice(6)) as AskEvent);
}

describe('AI: Ask Sofiya, hybrid search, similar books (e2e, fake provider)', () => {
  let app: INestApplication<App>;

  const ask = (body: object) =>
    request(app.getHttpServer())
      .post('/api/ask')
      .set('Origin', WEB_ORIGIN)
      .send(body)
      .buffer(true)
      .parse((res, done) => {
        let data = '';
        res.setEncoding('utf8');
        res.on('data', (chunk: string) => (data += chunk));
        res.on('end', () => done(null, data));
      });

  beforeAll(async () => {
    app = await createTestApp();
  });
  afterAll(async () => {
    await app.close();
  });

  it('reports that AI is on and the catalogue is indexed', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/ai/status')
      .expect(200);
    const status = res.body as AiStatus;
    expect(status.enabled).toBe(true);
    expect(status.indexedBooks).toBeGreaterThan(150);
  });

  it('streams sources, then an answer that cites only those sources', async () => {
    const res = await ask({
      message: 'Sherlock Holmes and a spectral hound on Dartmoor',
    }).expect(200);
    expect(res.headers['content-type']).toMatch(/text\/event-stream/);

    const events = parseEvents(res.body as string);
    expect(events[0].type).toBe('sources');
    expect(events.at(-1)?.type).toBe('done');

    const sources = events[0].type === 'sources' ? events[0].sources : [];
    expect(sources.length).toBeGreaterThan(0);
    expect(sources.length).toBeLessThanOrEqual(5);
    expect(sources.map((s) => s.book.title)).toContain(
      'The Hound of the Baskervilles',
    );
    for (const s of sources) {
      expect(s.matchPercent).toBeGreaterThan(0);
      expect(s.matchPercent).toBeLessThanOrEqual(100);
      expect(s.passage.length).toBeGreaterThan(10);
    }

    const answer = events
      .filter((e) => e.type === 'delta')
      .map((e) => (e.type === 'delta' ? e.text : ''))
      .join('');
    expect(answer).toMatch(/\[\d\]/);

    const done = events.at(-1);
    const ids = new Set(sources.map((s) => s.book.id));
    if (done?.type === 'done') {
      expect(done.citedBookIds.length).toBeGreaterThan(0);
      for (const id of done.citedBookIds) expect(ids.has(id)).toBe(true);
    }
  });

  it('applies filters before ranking', async () => {
    const res = await ask({
      message: 'stories about the sea and ships',
      filters: { genre: 'SCIENCE_FICTION' },
    }).expect(200);
    const [first] = parseEvents(res.body as string);
    const sources = first.type === 'sources' ? first.sources : [];
    for (const s of sources) expect(s.book.genre).toBe('SCIENCE_FICTION');
  });

  it('says so, without calling the model, when nothing matches', async () => {
    // No book costs 1 cent, so retrieval has nothing to offer.
    const res = await ask({
      message: 'any good mystery',
      filters: { maxPriceCents: 1 },
    }).expect(200);
    const events = parseEvents(res.body as string);
    expect(events[0]).toEqual({ type: 'sources', sources: [] });
    const done = events.at(-1);
    expect(done).toEqual({ type: 'done', citedBookIds: [], fallback: true });
  });

  it('validates the request before streaming', async () => {
    await ask({ message: '' }).expect(400);
    await ask({ message: 'x'.repeat(501) }).expect(400);
    await ask({
      message: 'hello',
      history: Array(7).fill({ role: 'user', content: 'hi' }),
    }).expect(400);
    await ask({ message: 'hello', filters: { genre: 'COOKING' } }).expect(400);
  });

  it('search finds books by any word of a natural question', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/books?q=a%20haunted%20house%20with%20ghosts')
      .expect(200);
    const titles = (res.body as Page<BookSummary>).items.map((b) => b.title);
    expect(titles).toContain('The Turn of the Screw');
  });

  it('suggests similar books and never the book itself', async () => {
    const res = await request(app.getHttpServer())
      .get('/api/books/frankenstein-shelley/similar')
      .expect(200);
    const books = res.body as BookSummary[];
    expect(books).toHaveLength(6);
    expect(books.map((b) => b.slug)).not.toContain('frankenstein-shelley');
  });
});
