import type { OrderView } from "@sofiya/shared";
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from "@/lib/labels";
import { Tag } from "./ui";

const TONES = { UNPAID: "warn", CONFIRMING: "accent", PAID: "ok", REFUNDED: "muted" } as const;

export function PaymentStatusTag({ payment }: { payment: OrderView["payment"] }) {
  return (
    <Tag tone={TONES[payment.status]}>
      {PAYMENT_STATUS_LABELS[payment.status]} · {PAYMENT_METHOD_LABELS[payment.method]}
    </Tag>
  );
}
