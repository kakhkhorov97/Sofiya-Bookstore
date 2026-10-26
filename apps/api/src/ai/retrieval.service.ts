import { Inject, Injectable, Logger } from '@nestjs/common';
import {
  DEFAULT_CURRENCY,
  type AskFilters,
  type Currency,
} from '@sofiya/shared';
import { sql, SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { escapeLike } from '../common/like';
import { InjectDb } from '../db/db.module';
import { AI_PROVIDER, AiProvider } from './provider';
import { terms } from './text';

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

export function keepCloseMatches<T extends { id: string; sim: number }>(
  rows: T[],
  floor: number,
  window: number,
): T[] {
  const best = rows[0]?.sim;
  if (best === undefined || best < floor) return [];
  return rows.filter((r) => r.sim >= best - window);
}

// What the "Match" bar shows. Ordering still comes from rank fusion; this
// only makes the number readable: meaning matches score 70–100 by how close
// they are to the best one, keyword-only matches 40–65 by keyword rank, and
// with no meaning matches at all keyword ranks span 50–100.
export function matchPercents(
  keywordIds: string[],
  vectorRows: { id: string; sim: number }[],
  window: number,
): (id: string) => number {
  const sims = new Map(vectorRows.map((r) => [r.id, r.sim]));
  const best = vectorRows[0]?.sim;
  return (id) => {
    const sim = sims.get(id);
    if (sim !== undefined && best !== undefined) {
      const closeness = window > 0 ? 1 - (best - sim) / window : 1;
      return Math.round(70 + 30 * Math.max(0, Math.min(1, closeness)));
    }
    const rank = keywordIds.indexOf(id);
    if (rank === -1) return 0;
    return vectorRows.length > 0
      ? Math.max(40, 65 - rank)
      : Math.max(50, 100 - 2 * rank);
  };
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

  private filterSql(filters: AskFilters, currency: Currency): SQL {
    const where: SQL[] = [sql`b.status = 'LIVE'`];
    if (filters.genre) where.push(sql`b.genre = ${filters.genre}`);
    if (filters.format) {
      where.push(
        sql`EXISTS (SELECT 1 FROM book_formats x WHERE x.book_id = b.id AND x.format = ${filters.format})`,
      );
    }
    if (filters.maxPrice) {
      // The limit is in the reader's currency, so compare that currency's price.
      const price = currency === 'KRW' ? sql`x.price_krw` : sql`x.price_cents`;
      where.push(
        sql`EXISTS (SELECT 1 FROM book_formats x WHERE x.book_id = b.id AND ${price} <= ${filters.maxPrice})`,
      );
    }
    if (filters.maxPages) where.push(sql`b.pages <= ${filters.maxPages}`);
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
    currency: Currency = DEFAULT_CURRENCY,
  ): Promise<Ranked[]> {
    const where = this.filterSql(filters, currency);
    // OR of the question's meaningful words, so a sentence still finds
    // keyword hits; generic words ("book", "read", "something") are dropped
    // so they cannot match titles like "The Book of Wonder".
    const words = [...new Set(terms(query))];
    const anyWord = words.length
      ? sql`to_tsquery('english', ${words.join(' | ')})`
      : sql`to_tsquery('english', 'zzzz')`;

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

    // Nearest neighbours always exist, so meaning matches need two tests:
    // the best book must clear an absolute floor (nonsense and off-topic
    // questions do not), and the rest must be close to that best score.
    const literal = vector ? `[${vector.join(',')}]` : '';
    const nearest = vector
      ? await this.db.execute<{ id: string; sim: number }>(sql`
          SELECT b.id, 1 - (e.embedding <=> ${literal}::vector) AS sim
          FROM books b JOIN book_embeddings e ON e.book_id = b.id
          WHERE ${where}
          ORDER BY e.embedding <=> ${literal}::vector
          LIMIT ${CANDIDATES}`)
      : [];
    const vectorRows = keepCloseMatches(
      nearest.map((r) => ({ id: r.id, sim: Number(r.sim) })),
      this.provider?.minSimilarity ?? 1,
      this.provider?.similarityWindow ?? 0,
    );

    const scores = new Map<string, number>();
    const add = (ids: { id: string }[]) =>
      ids.forEach((r, i) =>
        scores.set(r.id, (scores.get(r.id) ?? 0) + 1 / (RRF_K + i + 1)),
      );
    add(keywordRows);
    add(vectorRows);

    const percent = matchPercents(
      keywordRows.map((r) => r.id),
      vectorRows,
      this.provider?.similarityWindow ?? 0,
    );
    return [...scores.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([bookId, score]) => ({
        bookId,
        score,
        matchPercent: percent(bookId),
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
