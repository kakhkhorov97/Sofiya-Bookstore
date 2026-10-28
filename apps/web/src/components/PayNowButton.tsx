"use client";

import type { OrderView, PaymentConfig } from "@sofiya/shared";
import { formatMoney } from "@sofiya/shared";
import { CreditCard } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { isUserCancel, startCardPayment } from "@/lib/card-payment";
import { buttonClass } from "./ui";

// Re-opens the Toss window for an unpaid card order (closed window,
// declined card, or paying later from the orders page).
export function PayNowButton({
  order,
  config,
  customer,
}: {
  order: Pick<OrderView, "id" | "items" | "total" | "currency">;
  config: PaymentConfig;
  customer: { id: string; email: string; name: string };
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const t = useTranslations("payNow");

  async function pay() {
    setBusy(true);
    setError(null);
    try {
      await startCardPayment(config, order, customer, (first, count) => t("orderName", { first, count }));
    } catch (err) {
      if (!isUserCancel(err)) setError(err instanceof Error ? err.message : t("failed"));
      setBusy(false);
    }
  }

  return (
    <div>
      <button type="button" onClick={pay} disabled={busy || !config.card.enabled} className={buttonClass.primary}>
        <CreditCard size={18} aria-hidden />
        {busy ? t("opening") : t("pay", { amount: formatMoney(order.total, order.currency) })}
      </button>
      {error && <p className="mt-2 text-sm font-medium text-bad">{error}</p>}
      {config.card.testMode && (
        <p className="mt-2 text-xs text-ink-3">{t("testMode")}</p>
      )}
    </div>
  );
}
