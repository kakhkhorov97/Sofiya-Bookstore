import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  AuthorPage,
  BookDetail,
  BookFormat,
  BookListQuery,
  BookSummary,
  FormatInfo,
  Genre,
  GenreCount,
  Page,
} from '@sofiya/shared';
import { sql, SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';
import {
  SUMMARY_COLUMNS,
  SUMMARY_JOINS,
  SummaryRow,
  summariesByIds,
  toSummary,
  uuidList,
} from './summary';

const LOW_STOCK_THRESHOLD = 5;

export { escapeLike } from '../common/like';
import { escapeLike } from '../common/like';

interface FormatRow {
  id: string;
  format: BookFormat;
  price_cents: number;
  stock: number | null;
  [key: string]: unknown;
}

@Injectable()
export class BooksService {
  constructor(@InjectDb() private readonly db: Db) {}

  // `rankedIds` comes from the hybrid (keyword + meaning) search when AI is
  // on; without it, search falls back to Postgres full text only.
  async list(
    query: BookListQuery,
    rankedIds?: string[],
  ): Promise<Page<BookSummary>> {
    const tsq = query.q
      ? sql`websearch_to_tsquery('english', ${query.q})`
      : undefined;
    const where: SQL[] = [
      sql`b.status = 'LIVE'`,
      sql`f.from_price IS NOT NULL`,
    ];
    if (query.genre) where.push(sql`b.genre = ${query.genre}`);
    if (query.format) {
      where.push(
        sql`EXISTS (SELECT 1 FROM book_formats x WHERE x.book_id = b.id AND x.format = ${query.format})`,
      );
    }
    if (query.inStock) where.push(sql`f.in_stock`);
    if (query.staffPicks) where.push(sql`b.staff_pick_note IS NOT NULL`);

    const useRanked = !!query.q && rankedIds !== undefined;
    if (useRanked) {
      if (rankedIds.length === 0) {
        return { items: [], total: 0, page: query.page, limit: query.limit };
      }
      where.push(sql`b.id IN (${uuidList(rankedIds)})`);
    } else if (query.q && tsq) {
      const like = `%${escapeLike(query.q)}%`;
      where.push(
        sql`(b.search @@ ${tsq} OR b.title ILIKE ${like} ESCAPE '\\' OR b.author ILIKE ${like} ESCAPE '\\')`,
      );
    }

    const sort = query.sort ?? (query.q ? 'relevance' : 'popular');
    const relevance: SQL = useRanked
      ? sql`array_position(ARRAY[${uuidList(rankedIds)}], b.id)`
      : tsq
        ? sql`ts_rank(b.search, ${tsq}) DESC, b.views DESC, b.title`
        : sql`b.views DESC, b.title`;
    const orderBy: Record<typeof sort, SQL> = {
      relevance,
      newest: sql`b.created_at DESC, b.title`,
      title: sql`b.title ASC`,
      price_asc: sql`f.from_price ASC, b.title`,
      price_desc: sql`f.from_price DESC, b.title`,
      popular: sql`b.views DESC, b.title`,
    };

    const from = sql`FROM books b ${SUMMARY_JOINS} WHERE ${sql.join(where, sql` AND `)}`;
    const offset = (query.page - 1) * query.limit;
    const [rows, countRows] = await Promise.all([
      this.db.execute<SummaryRow>(sql`
        SELECT ${SUMMARY_COLUMNS} ${from}
        ORDER BY ${orderBy[sort]}
        LIMIT ${query.limit} OFFSET ${offset}`),
      this.db.execute<{ total: string }>(sql`SELECT count(*) AS total ${from}`),
    ]);

    return {
      items: rows.map(toSummary),
      total: Number(countRows[0]?.total ?? 0),
      page: query.page,
      limit: query.limit,
    };
  }

  async getBySlug(slug: string): Promise<BookDetail> {
    const rows = await this.db.execute<
      SummaryRow & { description: string; language: string }
    >(sql`
      SELECT ${SUMMARY_COLUMNS}, b.description, b.language
      FROM books b ${SUMMARY_JOINS}
      WHERE b.slug = ${slug} AND b.status = 'LIVE'`);
    const book = rows[0];
    if (!book) throw new NotFoundException('Book not found');

    const formats = await this.db.execute<FormatRow>(sql`
      SELECT id, format, price_cents, stock FROM book_formats
      WHERE book_id = ${book.id} ORDER BY format`);

    return {
      ...toSummary(book),
      description: book.description,
      language: book.language,
      formats: formats.map((f) => ({
        id: f.id,
        format: f.format,
        priceCents: f.price_cents,
        inStock: f.stock === null || f.stock > 0,
        lowStock:
          f.stock !== null && f.stock > 0 && f.stock <= LOW_STOCK_THRESHOLD
            ? f.stock
            : null,
      })),
    };
  }

  async idBySlug(slug: string): Promise<{ id: string; genre: Genre }> {
    const [row] = await this.db.execute<{ id: string; genre: Genre }>(
      sql`SELECT id, genre FROM books WHERE slug = ${slug} AND status = 'LIVE'`,
    );
    if (!row) throw new NotFoundException('Book not found');
    return row;
  }

  summaries(ids: string[]): Promise<BookSummary[]> {
    return summariesByIds(this.db, ids);
  }

  async popularInGenre(
    genre: Genre,
    excludeId: string,
    limit: number,
  ): Promise<BookSummary[]> {
    const rows = await this.db.execute<SummaryRow>(sql`
      SELECT ${SUMMARY_COLUMNS} FROM books b ${SUMMARY_JOINS}
      WHERE b.status = 'LIVE' AND b.genre = ${genre} AND b.id <> ${excludeId}
      ORDER BY b.views DESC LIMIT ${limit}`);
    return rows.map(toSummary);
  }

  async author(slug: string): Promise<AuthorPage> {
    const rows = await this.db.execute<SummaryRow>(sql`
      SELECT ${SUMMARY_COLUMNS} FROM books b ${SUMMARY_JOINS}
      WHERE b.status = 'LIVE' AND b.author_slug = ${slug}
      ORDER BY b.published_year NULLS LAST, b.title`);
    if (rows.length === 0) throw new NotFoundException('Author not found');
    return { name: rows[0].author, slug, books: rows.map(toSummary) };
  }

  async formatsByIds(ids: string[]): Promise<FormatInfo[]> {
    const rows = await this.db.execute<{
      id: string;
      format: BookFormat;
      price_cents: number;
      stock: number | null;
      status: string;
      slug: string;
      title: string;
      author: string;
      genre: Genre;
    }>(sql`
      SELECT bf.id, bf.format, bf.price_cents, bf.stock,
             b.status, b.slug, b.title, b.author, b.genre
      FROM book_formats bf JOIN books b ON b.id = bf.book_id
      WHERE bf.id IN (${uuidList(ids)}) AND b.status <> 'DELETED'`);
    return rows.map((r) => ({
      formatId: r.id,
      format: r.format,
      priceCents: r.price_cents,
      inStock: r.stock === null || r.stock > 0,
      lowStock:
        r.stock !== null && r.stock > 0 && r.stock <= LOW_STOCK_THRESHOLD
          ? r.stock
          : null,
      available: r.status === 'LIVE',
      book: { slug: r.slug, title: r.title, author: r.author, genre: r.genre },
    }));
  }

  async genres(): Promise<GenreCount[]> {
    const rows = await this.db.execute<{ genre: Genre; count: string }>(sql`
      SELECT genre, count(*) AS count FROM books
      WHERE status = 'LIVE' GROUP BY genre ORDER BY genre`);
    return rows.map((r) => ({ genre: r.genre, count: Number(r.count) }));
  }
}
