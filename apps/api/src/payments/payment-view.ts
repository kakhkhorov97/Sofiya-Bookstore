import type { OrderView, PaymentMethod, PaymentStatus } from '@sofiya/shared';

// The payment columns of an orders row (SELECT o.*).
export interface PaymentColumns {
  payment_method: PaymentMethod;
  payment_status: PaymentStatus;
  paid_at: Date | null;
  receipt_url: string | null;
  payment_error: string | null;
}

export const toPaymentView = (r: PaymentColumns): OrderView['payment'] => ({
  method: r.payment_method,
  status: r.payment_status,
  paidAt: r.paid_at ? new Date(r.paid_at).toISOString() : null,
  receiptUrl: r.receipt_url,
  error: r.payment_error,
});
