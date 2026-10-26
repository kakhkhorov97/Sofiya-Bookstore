import type { BookFormat, BookSummary, Genre } from '@sofiya/shared';
import { sql, SQL } from 'drizzle-orm';
import type { Db } from '../db/client';
import { coverUrl } from '../storage/storage';

// One definition of "a book card" for every list in the API: browse,
// authors, staff picks, wishlist, similar books and Ask Sofiya sources.
export const SUMMARY_COLUMNS = sql`
  b.id, b.slug, b.title, b.author, b.author_slug, b.genre, b.published_year, b.pages,
  b.staff_pick_note, b.cover_key, f.from_price, f.in_stock, f.formats, r.rating_avg, r.rating_count`;

export const SUMMARY_JOINS = sql`
  JOIN LATERAL (
    SELECT min(price_cents) AS from_price,
           bool_or(stock IS NULL OR stock > 0) AS in_stock,
           array_agg(format::text ORDER BY format) AS formats
    FROM book_formats WHERE book_id = b.id
  ) f ON true
  LEFT JOIN LATERAL (
    SELECT round(avg(rating)::numeric, 1)::float AS rating_avg, count(*)::int AS rating_count
    FROM reviews WHERE book_id = b.id
  ) r ON true`;

export interface SummaryRow {
  id: string;
  slug: string;
  title: string;
  author: string;
  author_slug: string;
  genre: Genre;
  published_year: number | null;
  pages: number | null;
  staff_pick_note: string | null;
  cover_key: string | null;
  from_price: number;
  in_stock: boolean;
  formats: BookFormat[];
  rating_avg: number | null;
  rating_count: number;
  [key: string]: unknown;
}

export const toSummary = (r: SummaryRow): BookSummary => ({
  id: r.id,
  slug: r.slug,
  title: r.title,
  author: r.author,
  authorSlug: r.author_slug,
  genre: r.genre,
  publishedYear: r.published_year,
  pages: r.pages,
  fromPriceCents: Number(r.from_price),
  inStock: r.in_stock,
  formats: r.formats,
  ratingAvg: r.rating_avg === null ? null : Number(r.rating_avg),
  ratingCount: Number(r.rating_count ?? 0),
  staffPickNote: r.staff_pick_note,
  coverUrl: coverUrl(r.cover_key),
});

export const uuidList = (ids: string[]): SQL =>
  sql.join(
    ids.map((id) => sql`${id}::uuid`),
    sql`, `,
  );

// Live books by id, returned in the order of `ids`.
export async function summariesByIds(
  db: Db,
  ids: string[],
): Promise<BookSummary[]> {
  if (ids.length === 0) return [];
  const rows = await db.execute<SummaryRow>(sql`
    SELECT ${SUMMARY_COLUMNS} FROM books b ${SUMMARY_JOINS}
    WHERE b.status = 'LIVE' AND b.id IN (${uuidList(ids)})`);
  const byId = new Map(rows.map((r) => [r.id, toSummary(r)]));
  return ids.flatMap((id) => byId.get(id) ?? []);
}
