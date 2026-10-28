"use client";

import type { OrderView } from "@sofiya/shared";
import { LoaderCircle } from "lucide-react";
import { useTranslations } from "next-intl";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { ButtonLink, Notice } from "./ui";

// Toss sends the browser here with paymentKey, orderId and amount. The
// payment is only final once our server has confirmed it with Toss.
export function ConfirmPayment() {
  const params = useSearchParams();
  const router = useRouter();
  const t = useTranslations("paymentResult");
  const [error, setError] = useState<string | null>(null);
  const started = useRef(false);
  const orderId = params.get("orderId");

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    const paymentKey = params.get("paymentKey");
    const amount = Number(params.get("amount"));
    if (!orderId || !paymentKey || !Number.isInteger(amount)) {
      setError(t("incomplete"));
      return;
    }
    clientApi<OrderView>(`/orders/${orderId}/payments/toss/confirm`, {
      method: "POST",
      body: { paymentKey, amount },
    })
      .then(() => router.replace(`/orders/${orderId}?paid=1`))
      .catch((err: unknown) => setError(err instanceof Error ? err.message : t("confirmFailed")));
  }, [orderId, params, router, t]);

  if (error) {
    return (
      <div className="mt-8 max-w-[560px] space-y-4">
        <Notice tone="bad">{error}</Notice>
        <p className="text-ink-2">{t("notCharged")}</p>
        {orderId && <ButtonLink href={`/orders/${orderId}`}>{t("goToOrder")}</ButtonLink>}
      </div>
    );
  }
  return (
    <div className="mt-8 flex items-center gap-3 rounded-[16px] bg-surface px-6 py-10 text-ink-2" role="status">
      <LoaderCircle size={22} className="animate-spin text-accent" aria-hidden />
      <span>{t("confirming")}</span>
    </div>
  );
}
