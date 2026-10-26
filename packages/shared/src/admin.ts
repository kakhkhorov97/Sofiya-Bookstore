import { z } from "zod";
import { BookFormat, BookStatus, Genre, OrderStatus, UserRole } from "./domain";
import type { OrderView } from "./orders";
import type { Prices } from "./pricing";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .nullable()
    .transform((v) => (v ? v : null));

export const BookFormatInput = z
  .object({
    format: BookFormat,
    // Both prices are set by the store: cents and won.
    price: z.object({ USD: z.number().int().min(0).max(100_000), KRW: z.number().int().min(0).max(10_000_000) }).strict(),
    // null = digital, never runs out.
    stock: z.number().int().min(0).max(100_000).nullable(),
  })
  .strict();
export type BookFormatInput = z.infer<typeof BookFormatInput>;

export const BookInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    author: z.string().trim().min(1).max(200),
    genre: Genre,
    description: z.string().trim().min(20, "Write at least a sentence (20 characters)").max(4000),
    pages: z.number().int().positive().max(10_000).nullable(),
    publishedYear: z.number().int().min(-3000).max(2100).nullable(),
    language: z.string().trim().min(2).max(40).default("English"),
    status: BookStatus.exclude(["DELETED"]),
    staffPickNote: optionalText(200),
    formats: z
      .array(BookFormatInput)
      .min(1, "Add at least one format")
      .max(4)
      .refine((f) => new Set(f.map((x) => x.format)).size === f.length, "Each format can appear only once"),
  })
  .strict();
export type BookInput = z.input<typeof BookInput>;
export type BookInputParsed = z.output<typeof BookInput>;

export const INDEX_STATUSES = ["INDEXED", "STALE", "MISSING", "NOT_LIVE", "AI_OFF"] as const;
export type IndexStatus = (typeof INDEX_STATUSES)[number];

export const AdminBookListQuery = z.object({
  q: z.string().trim().max(200).optional().transform((v) => (v ? v : undefined)),
  status: BookStatus.optional(),
  genre: Genre.optional(),
  index: z.enum(["INDEXED", "STALE", "MISSING"]).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminBookListQuery = z.infer<typeof AdminBookListQuery>;

export interface AdminFormat {
  id: string;
  format: BookFormat;
  price: Prices;
  stock: number | null;
}

export interface AdminBook {
  id: string;
  slug: string;
  title: string;
  author: string;
  genre: Genre;
  description: string;
  pages: number | null;
  publishedYear: number | null;
  language: string;
  status: BookStatus;
  staffPickNote: string | null;
  coverUrl: string | null;
  formats: AdminFormat[];
  indexStatus: IndexStatus;
  views: number;
  updatedAt: string;
}

// ---- AI drafts ---------------------------------------------------------------

export const AiDraftInput = z
  .object({
    title: z.string().trim().min(1).max(200),
    author: z.string().trim().min(1).max(200),
    notes: z.string().trim().max(1000).optional().transform((v) => (v ? v : undefined)),
  })
  .strict();
export type AiDraftInput = z.infer<typeof AiDraftInput>;

export const AiDraft = z.object({
  description: z.string().min(20).max(1200),
  genre: Genre,
  pages: z.number().int().positive().max(10_000).nullable(),
  publishedYear: z.number().int().min(-3000).max(2100).nullable(),
});
export type AiDraft = z.infer<typeof AiDraft>;

// ---- Orders, members, overview ----------------------------------------------

export interface AdminOrder extends OrderView {
  customer: { name: string; email: string };
}

export const AdminOrderListQuery = z.object({
  status: OrderStatus.optional(),
  q: z.string().trim().max(200).optional().transform((v) => (v ? v : undefined)),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminOrderListQuery = z.infer<typeof AdminOrderListQuery>;

export const MEMBER_STATUSES = ["ACTIVE", "BLOCKED"] as const;

export const AdminMemberListQuery = z.object({
  q: z.string().trim().max(200).optional().transform((v) => (v ? v : undefined)),
  status: z.enum(MEMBER_STATUSES).optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type AdminMemberListQuery = z.infer<typeof AdminMemberListQuery>;

export const MemberStatusInput = z.object({ status: z.enum(MEMBER_STATUSES) }).strict();
export type MemberStatusInput = z.infer<typeof MemberStatusInput>;

export interface AdminMember {
  id: string;
  email: string;
  displayName: string;
  role: UserRole;
  status: "ACTIVE" | "BLOCKED" | "DELETED";
  points: number;
  orderCount: number;
  spent: Prices;
  createdAt: string;
}

export interface AiQuestionRow {
  question: string;
  sourceCount: number;
  fallback: boolean;
  createdAt: string;
}

export interface IndexJobState {
  running: boolean;
  startedAt: string | null;
  finishedAt: string | null;
  lastResult: { embedded: number; unchanged: number; removed: number } | null;
  lastError: string | null;
}

export interface AdminOverview {
  orders: Record<OrderStatus, number>;
  revenue: Prices;
  books: Record<BookStatus, number>;
  lowStock: { bookId: string; slug: string; title: string; format: BookFormat; stock: number }[];
  members: number;
  index: { enabled: boolean; indexed: number; stale: number; missing: number; job: IndexJobState };
  recentQuestions: AiQuestionRow[];
  unanswered: { question: string; count: number }[];
}
