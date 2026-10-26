import { z } from "zod";
import { BookFormat, Genre } from "./domain";
import type { BookSummary } from "./catalogue";
import { Currency, DEFAULT_CURRENCY } from "./pricing";

export interface AuthorPage {
  name: string;
  slug: string;
  books: BookSummary[];
}

// ---- Reviews ---------------------------------------------------------------

export const ReviewInput = z
  .object({
    rating: z.number().int().min(1).max(5),
    title: z.string().trim().max(120).optional().transform((v) => (v ? v : undefined)),
    body: z.string().trim().min(10, "Write at least a sentence (10 characters)").max(2000),
  })
  .strict();
export type ReviewInput = z.infer<typeof ReviewInput>;

export interface ReviewView {
  id: string;
  rating: number;
  title: string | null;
  body: string;
  reviewerName: string;
  createdAt: string;
  updatedAt: string;
}

export interface ReviewSummary {
  average: number | null;
  count: number;
  // Number of reviews for each star rating, index 0 = 1 star.
  distribution: [number, number, number, number, number];
}

export type CannotReviewReason = "SIGN_IN" | "NOT_PURCHASED";

export interface ReviewsResponse {
  summary: ReviewSummary;
  items: ReviewView[];
  viewer: {
    canReview: boolean;
    reason: CannotReviewReason | null;
    myReview: ReviewView | null;
  };
}

// ---- Newsletter --------------------------------------------------------------

export const NewsletterInput = z.object({ email: z.string().trim().toLowerCase().email().max(254) }).strict();
export type NewsletterInput = z.infer<typeof NewsletterInput>;

// ---- Ask Sofiya (RAG) --------------------------------------------------------

export const AskFilters = z
  .object({
    genre: Genre.optional(),
    format: BookFormat.optional(),
    // In the request's currency (won or cents).
    maxPrice: z.number().int().positive().max(10_000_000).optional(),
    maxPages: z.number().int().positive().max(5000).optional(),
    inStock: z.boolean().optional(),
  })
  .strict();
export type AskFilters = z.infer<typeof AskFilters>;

export const AskInput = z
  .object({
    message: z.string().trim().min(2).max(500),
    history: z
      .array(z.object({ role: z.enum(["user", "assistant"]), content: z.string().max(2000) }).strict())
      .max(6)
      .default([]),
    filters: AskFilters.default({}),
    // Prices in the answer and the max-price filter use this currency.
    currency: Currency.default(DEFAULT_CURRENCY),
  })
  .strict();
export type AskInput = z.infer<typeof AskInput>;

export interface AskSource {
  n: number;
  book: BookSummary;
  // 0–100, how close the book is to the request.
  matchPercent: number;
  // The sentence from the description that best matches the request.
  passage: string;
}

// Server-sent events from POST /api/ask, in order:
//   sources (once) -> delta (many) -> done (once), or error.
export type AskEvent =
  | { type: "sources"; sources: AskSource[] }
  | { type: "delta"; text: string }
  | { type: "done"; citedBookIds: string[]; fallback: boolean }
  | { type: "error"; message: string };

export interface AiStatus {
  enabled: boolean;
  indexedBooks: number;
}
