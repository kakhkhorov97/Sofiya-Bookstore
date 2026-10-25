import { z } from "zod";
import { BookFormat, OrderStatus } from "./domain";

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
  unitPriceCents: number;
}

export interface OrderView {
  id: string;
  userId: string;
  status: OrderStatus;
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
  pointsAwarded: number;
  items: OrderItemView[];
  createdAt: string;
  updatedAt: string;
}
