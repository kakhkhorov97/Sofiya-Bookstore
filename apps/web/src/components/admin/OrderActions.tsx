"use client";

import { ADMIN_ORDER_TRANSITIONS, type OrderStatus, type OrderView } from "@sofiya/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientApi } from "@/lib/client-api";

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  IN_PROCESS: "Confirm",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel",
};

// Only the moves the API allows from the current status are offered. Card
// orders are confirmed by their payment, so they never get "Confirm" here.
export function OrderActions({
  id,
  status,
  payment,
}: {
  id: string;
  status: OrderStatus;
  payment: OrderView["payment"];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const awaitingCard = payment.method === "CARD" && payment.status !== "PAID";
  const next = ADMIN_ORDER_TRANSITIONS[status].filter((to) => !(to === "IN_PROCESS" && awaitingCard));
  if (next.length === 0) return <span className="text-sm text-ink-3">—</span>;
  const refunds = payment.method === "CARD" && payment.status === "PAID";
  const paidByTransfer = payment.method === "BANK_TRANSFER" && payment.status === "PAID";

  async function move(to: OrderStatus) {
    const cancelNote = refunds
      ? "The card payment is refunded through Toss."
      : paidByTransfer
        ? "This order was paid by bank transfer: refund the customer yourself."
        : "";
    if (
      to === "CANCELLED" &&
      !confirm(`Cancel this order? Stock goes back and any points are taken back. ${cancelNote}`.trim())
    )
      return;
    setBusy(true);
    setError(null);
    try {
      await clientApi(`/admin/orders/${id}/status`, { method: "PATCH", body: { expectedStatus: status, status: to } });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not update the order.");
      router.refresh();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {next.map((to) => (
        <button
          key={to}
          type="button"
          disabled={busy}
          onClick={() => void move(to)}
          className={`h-8 rounded-[8px] px-3 text-[13px] font-semibold disabled:opacity-50 ${
            to === "CANCELLED"
              ? "text-bad hover:bg-[#fde8e6]"
              : "bg-ink text-white hover:bg-black"
          }`}
        >
          {to === "IN_PROCESS" && payment.method === "BANK_TRANSFER" ? "Payment received · Confirm" : ACTION_LABELS[to]}
          {to === "CANCELLED" && refunds ? " & refund" : ""}
        </button>
      ))}
      {error && <span className="basis-full text-xs font-medium text-bad">{error}</span>}
    </div>
  );
}
