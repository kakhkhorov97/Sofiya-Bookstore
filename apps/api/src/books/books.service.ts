import { Injectable, NotFoundException } from '@nestjs/common';
import type {
  BookDetail,
  BookFormat,
  BookListQuery,
  BookSummary,
  Genre,
  GenreCount,
  Page,
} from '@sofiya/shared';
import { sql, SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { InjectDb } from '../db/db.module';

const LOW_STOCK_THRESHOLD = 5;

// Escape LIKE wildcards so user input is matched literally
// (the legacy API passed raw input into new RegExp()).
export function escapeLike(input: string): string {
  return input.replace(/[\\%_]/g, (c) => `\\${c}`);
}

interface SummaryRow {
  id: string;
  slug: string;
  title: string;
  author: string;
  genre: Genre;
  published_year: number | null;
  pages: number | null;
  from_price: number;
  in_stock: boolean;
  formats: BookFormat[];
  [key: string]: unknown;
}

interface FormatRow {
  id: string;
  format: BookFormat;
  price_cents: number;
  stock: number | null;
  [key: string]: unknown;
}

const toSummary = (r: SummaryRow): BookSummary => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  author: r.author,
  genre: r.genre,
  publishedYear: r.published_year,
  pages: r.pages,
  fromPriceCents: Number(r.from_price),
  inStock: r.in_stock,
  formats: r.formats,
});

@Injectable()
export class BooksService {
  constructor(@InjectDb() private readonly db: Db) {}

  async list(query: BookListQuery): Promise<Page<BookSummary>> {
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
    if (query.q && tsq) {
      const like = `%${escapeLike(query.q)}%`;
      where.push(
        sql`(b.search @@ ${tsq} OR b.title ILIKE ${like} ESCAPE '\\' OR b.author ILIKE ${like} ESCAPE '\\')`,
      );
    }

    const sort = query.sort ?? (query.q ? 'relevance' : 'popular');
    const orderBy: Record<typeof sort, SQL> = {
      relevance: tsq
        ? sql`ts_rank(b.search, ${tsq}) DESC, b.views DESC, b.title`
        : sql`b.views DESC, b.title`,
      newest: sql`b.created_at DESC, b.title`,
      title: sql`b.title ASC`,
      price_asc: sql`f.from_price ASC, b.title`,
      price_desc: sql`f.from_price DESC, b.title`,
      popular: sql`b.views DESC, b.title`,
    };

    const from = sql`
      FROM books b
      JOIN LATERAL (
        SELECT min(price_cents) AS from_price,
               bool_or(stock IS NULL OR stock > 0) AS in_stock,
               array_agg(format::text ORDER BY format) AS formats
        FROM book_formats WHERE book_id = b.id
      ) f ON true
      WHERE ${sql.join(where, sql` AND `)}`;

    const offset = (query.page - 1) * query.limit;
    const [rows, countRows] = await Promise.all([
      this.db.execute<SummaryRow>(sql`
        SELECT b.id, b.slug, b.title, b.author, b.genre, b.published_year, b.pages,
               f.from_price, f.in_stock, f.formats
        ${from}
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
      SELECT b.id, b.slug, b.title, b.author, b.genre, b.published_year, b.pages,
             b.description, b.language,
             f.from_price, f.in_stock, f.formats
      FROM books b
      JOIN LATERAL (
        SELECT min(price_cents) AS from_price,
               bool_or(stock IS NULL OR stock > 0) AS in_stock,
               array_agg(format::text ORDER BY format) AS formats
        FROM book_formats WHERE book_id = b.id
      ) f ON true
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

  async genres(): Promise<GenreCount[]> {
    const rows = await this.db.execute<{ genre: Genre; count: string }>(sql`
      SELECT genre, count(*) AS count FROM books
      WHERE status = 'LIVE' GROUP BY genre ORDER BY genre`);
    return rows.map((r) => ({ genre: r.genre, count: Number(r.count) }));
  }
}
