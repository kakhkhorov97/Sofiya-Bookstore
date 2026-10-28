"use client";

import type { OrderView } from "@sofiya/shared";
import { useTranslations } from "next-intl";
import { Tag } from "./ui";

const TONES = { UNPAID: "warn", CONFIRMING: "accent", PAID: "ok", REFUNDED: "muted" } as const;

export function PaymentStatusTag({ payment }: { payment: OrderView["payment"] }) {
  const t = useTranslations("labels");
  return (
    <Tag tone={TONES[payment.status]}>
      {t(`paymentStatus.${payment.status}`)} · {t(`paymentMethod.${payment.method}`)}
    </Tag>
  );
}
