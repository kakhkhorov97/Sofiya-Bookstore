import { z } from "zod";
import { BookFormat, Genre } from "./domain";
import { Currency, DEFAULT_CURRENCY, type Prices } from "./pricing";

export const BOOK_SORTS = ["relevance", "newest", "title", "price_asc", "price_desc", "popular"] as const;
export const BookSort = z.enum(BOOK_SORTS);
export type BookSort = z.infer<typeof BookSort>;

// Query string for GET /api/books. Everything arrives as strings.
export const BookListQuery = z.object({
  q: z.string().trim().max(200).optional().transform((v) => (v ? v : undefined)),
  genre: Genre.optional(),
  format: BookFormat.optional(),
  inStock: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  staffPicks: z
    .enum(["true", "false"])
    .optional()
    .transform((v) => v === "true"),
  sort: BookSort.optional(),
  // Which price "price_asc" / "price_desc" sort by.
  currency: Currency.default(DEFAULT_CURRENCY),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});
export type BookListQuery = z.infer<typeof BookListQuery>;

export interface BookFormatView {
  id: string;
  format: BookFormat;
  price: Prices;
  inStock: boolean;
  // Only exposed when low, so the UI can say "Only 3 left".
  lowStock: number | null;
}

export interface BookSummary {
  id: string;
  slug: string;
  title: string;
  author: string;
  authorSlug: string;
  genre: Genre;
  publishedYear: number | null;
  pages: number | null;
  // Cheapest format, in each currency.
  fromPrice: Prices;
  inStock: boolean;
  formats: BookFormat[];
  // Average of reader reviews (1–5), null when there are none yet.
  ratingAvg: number | null;
  ratingCount: number;
  staffPickNote: string | null;
  // Uploaded cover image, or null for the typographic cover.
  coverUrl: string | null;
}

export interface BookDetail extends Omit<BookSummary, "formats"> {
  description: string;
  language: string;
  formats: BookFormatView[];
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

export interface GenreCount {
  genre: Genre;
  count: number;
}

// GET /api/formats?ids=a,b,c — fresh price and stock for basket lines.
export const FormatLookupQuery = z.object({
  ids: z
    .string()
    .transform((s) => [...new Set(s.split(",").map((x) => x.trim()).filter(Boolean))])
    .pipe(z.array(z.string().uuid()).min(1).max(50)),
});
export type FormatLookupQuery = z.infer<typeof FormatLookupQuery>;

export interface FormatInfo {
  formatId: string;
  format: BookFormat;
  price: Prices;
  inStock: boolean;
  lowStock: number | null;
  // False when the book is paused or removed; the basket should say so.
  available: boolean;
  book: { slug: string; title: string; author: string; genre: Genre };
}
