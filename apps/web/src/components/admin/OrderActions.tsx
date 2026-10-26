"use client";

import { ADMIN_ORDER_TRANSITIONS, type OrderStatus } from "@sofiya/shared";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientApi } from "@/lib/client-api";

const ACTION_LABELS: Partial<Record<OrderStatus, string>> = {
  IN_PROCESS: "Confirm",
  DELIVERED: "Mark delivered",
  CANCELLED: "Cancel",
};

// Only the moves the API allows from the current status are offered.
export function OrderActions({ id, status }: { id: string; status: OrderStatus }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const next = ADMIN_ORDER_TRANSITIONS[status];
  if (next.length === 0) return <span className="text-sm text-ink-3">—</span>;

  async function move(to: OrderStatus) {
    if (to === "CANCELLED" && !confirm("Cancel this order? Stock goes back and any points are taken back.")) return;
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
          {ACTION_LABELS[to]}
        </button>
      ))}
      {error && <span className="basis-full text-xs font-medium text-bad">{error}</span>}
    </div>
  );
}
