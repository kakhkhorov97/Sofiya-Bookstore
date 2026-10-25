import { Inject, Injectable, Logger } from '@nestjs/common';
import type { AskFilters } from '@sofiya/shared';
import { sql, SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { escapeLike } from '../common/like';
import { InjectDb } from '../db/db.module';
import { AI_PROVIDER, AiProvider } from './provider';

// Reciprocal Rank Fusion constant; 60 is the value from the original paper.
const RRF_K = 60;
const CANDIDATES = 60;
const QUERY_CACHE_SIZE = 500;
const EMBED_TIMEOUT_MS = 3500;

export interface Ranked {
  bookId: string;
  score: number;
  // 0–100: 100 means first in both the keyword and the meaning search.
  matchPercent: number;
}

@Injectable()
export class RetrievalService {
  private readonly logger = new Logger(RetrievalService.name);
  private readonly queryCache = new Map<string, number[]>();

  constructor(
    @InjectDb() private readonly db: Db,
    @Inject(AI_PROVIDER) private readonly provider: AiProvider | null,
  ) {}

  get enabled(): boolean {
    return this.provider !== null;
  }

  async indexedCount(): Promise<number> {
    const [row] = await this.db.execute<{ n: number }>(
      sql`SELECT count(*)::int AS n FROM book_embeddings`,
    );
    return row?.n ?? 0;
  }

  private filterSql(filters: AskFilters): SQL {
    const where: SQL[] = [sql`b.status = 'LIVE'`];
    if (filters.genre) where.push(sql`b.genre = ${filters.genre}`);
    if (filters.format) {
      where.push(
        sql`EXISTS (SELECT 1 FROM book_formats x WHERE x.book_id = b.id AND x.format = ${filters.format})`,
      );
    }
    if (filters.maxPriceCents) {
      where.push(
        sql`EXISTS (SELECT 1 FROM book_formats x WHERE x.book_id = b.id AND x.price_cents <= ${filters.maxPriceCents})`,
      );
    }
    if (filters.inStock) {
      where.push(
        sql`EXISTS (SELECT 1 FROM book_formats x WHERE x.book_id = b.id AND (x.stock IS NULL OR x.stock > 0))`,
      );
    }
    return sql.join(where, sql` AND `);
  }

  private async queryVector(text: string): Promise<number[] | null> {
    // No letters or digits means nothing to embed; a zero vector would make
    // cosine similarity NaN, which Postgres sorts above every number.
    if (!this.provider || !/[\p{L}\p{N}]/u.test(text)) return null;
    const key = text.trim().toLowerCase();
    const cached = this.queryCache.get(key);
    if (cached) return cached;
    try {
      const [vector] = await this.provider.embed(
        [text],
        'query',
        AbortSignal.timeout(EMBED_TIMEOUT_MS),
      );
      // Only stopwords (e.g. "the and of") embed to all zeros in the fake provider.
      if (!vector.some((x) => x !== 0)) return null;
      if (this.queryCache.size >= QUERY_CACHE_SIZE) {
        this.queryCache.delete(this.queryCache.keys().next().value as string);
      }
      this.queryCache.set(key, vector);
      return vector;
    } catch (err) {
      // Meaning search is a bonus: if Gemini is slow or down, keyword search still answers.
      this.logger.warn(
        `Query embedding failed, using keyword search only: ${(err as Error).message}`,
      );
      return null;
    }
  }

  // Hybrid search: keyword (Postgres full text, any word) and meaning
  // (pgvector cosine), fused by rank so neither score scale dominates.
  async rank(
    query: string,
    filters: AskFilters = {},
    limit = 10,
  ): Promise<Ranked[]> {
    const where = this.filterSql(filters);
    // OR of the query's stemmed words, so a sentence still finds keyword hits.
    const anyWord = sql`to_tsquery('english', coalesce(nullif(array_to_string(tsvector_to_array(to_tsvector('english', ${query})), ' | '), ''), 'zzzz'))`;

    // Partial title/author matches ("Baskerv") count as keyword hits too.
    const like = `%${escapeLike(query.trim())}%`;
    const partial = sql`(b.title ILIKE ${like} ESCAPE '\\' OR b.author ILIKE ${like} ESCAPE '\\')`;

    const [keywordRows, vector] = await Promise.all([
      this.db.execute<{ id: string }>(sql`
        SELECT b.id FROM books b
        WHERE ${where} AND (b.search @@ ${anyWord} OR ${partial})
        ORDER BY ${partial} DESC, ts_rank_cd(b.search, ${anyWord}) DESC, b.views DESC
        LIMIT ${CANDIDATES}`),
      this.queryVector(query),
    ]);

    // Nearest neighbours always exist, so only close-enough books count;
    // otherwise nonsense queries would "match" the whole catalogue.
    const literal = vector ? `[${vector.join(',')}]` : '';
    const vectorRows = vector
      ? await this.db.execute<{ id: string }>(sql`
          SELECT b.id FROM books b JOIN book_embeddings e ON e.book_id = b.id
          WHERE ${where} AND 1 - (e.embedding <=> ${literal}::vector) >= ${this.provider!.minSimilarity}
          ORDER BY e.embedding <=> ${literal}::vector
          LIMIT ${CANDIDATES}`)
      : [];

    const scores = new Map<string, number>();
    const add = (ids: { id: string }[]) =>
      ids.forEach((r, i) =>
        scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)),
      );
    add(keywordRows);
    add(vectorRows);

    const arms = vectorRows.length > 0 ? 2 : 1;
    const best = arms / (RRF_K + 1);
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([bookId, score]) => ({
        bookId,
        score,
        matchPercent: Math.round((score / best) * 100),
      }));
  }

  // Nearest neighbours by meaning; empty when the book is not indexed.
  async similar(bookId: string, limit: number): Promise<string[]> {
    const rows = await this.db.execute<{ id: string }>(sql`
      SELECT b.id FROM book_embeddings e
      JOIN books b ON b.id = e.book_id
      WHERE b.status = 'LIVE' AND b.id <> ${bookId}
        AND EXISTS (SELECT 1 FROM book_embeddings WHERE book_id = ${bookId})
      ORDER BY e.embedding <=> (SELECT embedding FROM book_embeddings WHERE book_id = ${bookId})
      LIMIT ${limit}`);
    return rows.map((r) => r.id);
  }
}
