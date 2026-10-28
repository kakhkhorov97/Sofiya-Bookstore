import { z } from "zod";
import { BookFormat, OrderStatus, type PaymentMethod, type PaymentStatus } from "./domain";
import type { Currency } from "./pricing";

// Who may move an order where. Customers can only cancel a PAUSED order;
// every other change is an admin action (legacy defect: customers could set
// any status, including DELIVERED).
export const ADMIN_ORDER_TRANSITIONS: Record<OrderStatus, readonly OrderStatus[]> = {
  PAUSED: ["IN_PROCESS", "CANCELLED"],
  IN_PROCESS: ["DELIVERED", "CANCELLED"],
  DELIVERED: [],
  CANCELLED: [],
};

export function canTransition(from: OrderStatus, to: OrderStatus): boolean {
  return ADMIN_ORDER_TRANSITIONS[from].includes(to);
}

// Points are earned once per order, when it first moves to IN_PROCESS.
export const POINTS_PER_ORDER = 1;

export const AdminOrderStatusInput = z
  .object({
    status: OrderStatus,
    // Optimistic check: the status the admin saw. A stale screen gets a 409.
    expectedStatus: OrderStatus,
  })
  .strict();
export type AdminOrderStatusInput = z.infer<typeof AdminOrderStatusInput>;

export const OrderListQuery = z.object({
  status: OrderStatus.optional(),
  page: z.coerce.number().int().min(1).max(1000).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(20),
});
export type OrderListQuery = z.infer<typeof OrderListQuery>;

export interface OrderItemView {
  formatId: string;
  bookSlug: string;
  bookTitle: string;
  format: BookFormat;
  quantity: number;
  // In the order's currency (won or cents).
  unitPrice: number;
}

export interface OrderView {
  id: string;
  userId: string;
  status: OrderStatus;
  currency: Currency;
  subtotal: number;
  delivery: number;
  total: number;
  pointsAwarded: number;
  payment: {
    method: PaymentMethod;
    status: PaymentStatus;
    paidAt: string | null;
    // Toss's card receipt page.
    receiptUrl: string | null;
    // Why the last card payment attempt failed, if it did.
    error: string | null;
  };
  items: OrderItemView[];
  createdAt: string;
  updatedAt: string;
}

// The browser comes back from the Toss window with these; the server
// confirms the payment with Toss for the amount it stored, not this one.
export const TossConfirmInput = z
  .object({
    paymentKey: z.string().trim().min(1).max(200),
    amount: z.number().int().positive(),
  })
  .strict();
export type TossConfirmInput = z.infer<typeof TossConfirmInput>;

// Public payment settings for the checkout page.
export interface PaymentConfig {
  card: {
    enabled: boolean;
    // "fake" = offline demo: the checkout skips the Toss window.
    provider: "toss" | "fake" | null;
    // Toss test keys or the fake gateway: no real money can move.
    testMode: boolean;
    // Toss client key: public by design (it only opens the payment window).
    clientKey: string | null;
    currencies: Currency[];
  };
  bankTransfer: {
    bankName: string | null;
    accountNumber: string | null;
    accountHolder: string | null;
  };
  // Unpaid card orders are cancelled after this many minutes.
  cardTimeoutMinutes: number;
}
