"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { clientApi } from "@/lib/client-api";
import { buttonClass, Notice } from "./ui";

export function CancelOrderButton({ orderId }: { orderId: string }) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function cancel() {
    setBusy(true);
    setError(null);
    try {
      await clientApi(`/orders/${orderId}/cancel`, { method: "POST" });
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not cancel the order.");
    } finally {
      setBusy(false);
      setConfirming(false);
    }
  }

  return (
    <div className="space-y-3">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-[15px] font-medium">Cancel this order?</span>
          <button type="button" onClick={cancel} disabled={busy} className={`${buttonClass.dark} h-10`}>
            {busy ? "Cancelling…" : "Yes, cancel order"}
          </button>
          <button type="button" onClick={() => setConfirming(false)} className={`${buttonClass.outline} h-10`}>
            Keep order
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className={buttonClass.outline}>
          Cancel order
        </button>
      )}
      {error && <Notice tone="bad">{error}</Notice>}
    </div>
  );
}
