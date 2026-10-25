import { z } from "zod";
import { BookFormat, Genre } from "./domain";

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
  sort: BookSort.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(60).default(24),
});
export type BookListQuery = z.infer<typeof BookListQuery>;

export interface BookFormatView {
  id: string;
  format: BookFormat;
  priceCents: number;
  inStock: boolean;
  // Only exposed when low, so the UI can say "Only 3 left".
  lowStock: number | null;
}

export interface BookSummary {
  id: string;
  slug: string;
  title: string;
  author: string;
  genre: Genre;
  publishedYear: number | null;
  pages: number | null;
  fromPriceCents: number;
  inStock: boolean;
  formats: BookFormat[];
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
