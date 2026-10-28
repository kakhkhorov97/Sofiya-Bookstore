"use client";

import type { OrderStatus } from "@sofiya/shared";
import { useTranslations } from "next-intl";
import { Tag } from "./ui";

const TONES: Record<OrderStatus, "warn" | "accent" | "ok" | "muted"> = {
  PAUSED: "warn",
  IN_PROCESS: "accent",
  DELIVERED: "ok",
  CANCELLED: "muted",
};

export function OrderStatusTag({ status }: { status: OrderStatus }) {
  const t = useTranslations("labels.orderStatus");
  return <Tag tone={TONES[status]}>{t(status)}</Tag>;
}
