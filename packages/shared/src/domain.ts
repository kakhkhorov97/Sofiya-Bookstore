import { z } from "zod";
import { Currency, DEFAULT_CURRENCY } from "./pricing";

// Carried over from the legacy Sofiya-Bookstore enums, with the
// "PROSCESS" typo fixed.
export const BOOK_FORMATS = ["HARDCOVER", "PAPERBACK", "EBOOK", "AUDIOBOOK"] as const;
export const BookFormat = z.enum(BOOK_FORMATS);
export type BookFormat = z.infer<typeof BookFormat>;

export const GENRES = [
  "FICTION",
  "ROMANCE",
  "FANTASY",
  "MYSTERY",
  "SCIENCE_FICTION",
  "HORROR",
  "HISTORY",
  "SELF_HELP",
  "PROGRAMMING",
] as const;
export const Genre = z.enum(GENRES);
export type Genre = z.infer<typeof Genre>;

export const BOOK_STATUSES = ["DRAFT", "LIVE", "PAUSED", "DELETED"] as const;
export const BookStatus = z.enum(BOOK_STATUSES);
export type BookStatus = z.infer<typeof BookStatus>;

export const ORDER_STATUSES = ["PAUSED", "IN_PROCESS", "DELIVERED", "CANCELLED"] as const;
export const OrderStatus = z.enum(ORDER_STATUSES);
export type OrderStatus = z.infer<typeof OrderStatus>;

export const USER_ROLES = ["USER", "ADMIN"] as const;
export const UserRole = z.enum(USER_ROLES);
export type UserRole = z.infer<typeof UserRole>;

// What a client may send when placing an order. Prices are deliberately
// absent: the server looks them up (legacy defect: client-sent prices).
// z.guid() accepts any 8-4-4-4-12 hex id, as zod 3's uuid() did; zod 4's
// z.uuid() also checks the RFC 9562 version and variant digits.
export const OrderLineInput = z.object({
  formatId: z.guid(),
  quantity: z.number().int().min(1).max(20),
});
// CARD = pay now in the Toss Payments window; BANK_TRANSFER = pay to the
// store's account, and the admin confirms the order once the money arrives.
export const PAYMENT_METHODS = ["CARD", "BANK_TRANSFER"] as const;
export const PaymentMethod = z.enum(PAYMENT_METHODS);
export type PaymentMethod = z.infer<typeof PaymentMethod>;

export const PAYMENT_STATUSES = ["UNPAID", "CONFIRMING", "PAID", "REFUNDED"] as const;
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number];

export const CreateOrderInput = z.object({
  idempotencyKey: z.guid(),
  lines: z.array(OrderLineInput).min(1).max(50),
  // The order is priced and charged in this currency.
  currency: Currency.default(DEFAULT_CURRENCY),
  paymentMethod: PaymentMethod.default("BANK_TRANSFER"),
});
export type CreateOrderInput = z.infer<typeof CreateOrderInput>;
