import type { OrderStatus } from "@sofiya/shared";
import { ORDER_STATUS_LABELS } from "@/lib/labels";
import { Tag } from "./ui";

const TONES: Record<OrderStatus, "warn" | "accent" | "ok" | "muted"> = {
  PAUSED: "warn",
  IN_PROCESS: "accent",
  DELIVERED: "ok",
  CANCELLED: "muted",
};

export function OrderStatusTag({ status }: { status: OrderStatus }) {
  return <Tag tone={TONES[status]}>{ORDER_STATUS_LABELS[status]}</Tag>;
}
