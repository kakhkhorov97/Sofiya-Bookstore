"use client";

import { formatUsd, type OrderView } from "@sofiya/shared";
import { Info } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { basketFingerprint, type BasketLine } from "@/basket/basket";
import { useBasket } from "@/basket/BasketProvider";
import { useBasketInfo } from "@/basket/useBasketInfo";
import { clientApi, ClientApiError } from "@/lib/client-api";
import { FORMAT_LABELS } from "@/lib/labels";
import { OrderSummary } from "./OrderSummary";
import { buttonClass, ButtonLink, Notice } from "./ui";

const KEY_STORAGE = "sofiya.checkout.v1";

// One idempotency key per basket. Retrying (double click, flaky network)
// sends the same key, so the API returns the same order instead of a second one.
function idempotencyKeyFor(lines: BasketLine[]): string {
  const fingerprint = basketFingerprint(lines);
  try {
    const saved = JSON.parse(sessionStorage.getItem(KEY_STORAGE) ?? "null") as { fingerprint: string; key: string } | null;
    if (saved?.fingerprint === fingerprint) return saved.key;
    const key = crypto.randomUUID();
    sessionStorage.setItem(KEY_STORAGE, JSON.stringify({ fingerprint, key }));
    return key;
  } catch {
    return crypto.randomUUID();
  }
}

export function CheckoutView() {
  const router = useRouter();
  const { lines, ready, dispatch } = useBasket();
  const { checked, totals, hasProblems, refresh } = useBasketInfo(lines);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placedId, setPlacedId] = useState<string | null>(null);

  // The basket is cleared on success; show this instead of "Nothing to check out".
  if (placedId) {
    return (
      <div className="mt-8 rounded-[16px] bg-ok-soft px-6 py-12 text-center text-ok" role="status">
        <p className="font-display text-2xl font-extrabold">Order placed</p>
        <p className="mt-2">Opening your order…</p>
      </div>
    );
  }
  if (!ready) return <div className="mt-8 h-40 animate-pulse rounded-[16px] bg-surface" aria-busy />;
  if (lines.length === 0) {
    return (
      <div className="mt-8 rounded-[16px] bg-surface px-6 py-12 text-center">
        <p className="font-display text-2xl font-extrabold">Nothing to check out</p>
        <ButtonLink href="/books" className="mt-5">
          Browse books
        </ButtonLink>
      </div>
    );
  }

  async function placeOrder() {
    setBusy(true);
    setError(null);
    try {
      const order = await clientApi<OrderView>("/orders", {
        method: "POST",
        body: {
          idempotencyKey: idempotencyKeyFor(lines),
          lines: lines.map((l) => ({ formatId: l.formatId, quantity: l.quantity })),
        },
      });
      try {
        sessionStorage.removeItem(KEY_STORAGE);
      } catch {
        /* ignore */
      }
      setPlacedId(order.id);
      dispatch({ type: "clear" });
      router.push(`/orders/${order.id}?placed=1`);
    } catch (err) {
      if (err instanceof ClientApiError && (err.status === 409 || err.status === 422) && Array.isArray(err.body.formatIds)) {
        const ids = err.body.formatIds as string[];
        const titles = lines.filter((l) => ids.includes(l.formatId)).map((l) => l.title);
        setError(
          `${err.status === 409 ? "Not enough stock for" : "No longer available:"} ${titles.join(", ")}. Update your basket and try again.`,
        );
        void refresh();
      } else if (err instanceof ClientApiError && err.status === 401) {
        router.push("/signin?next=/checkout");
      } else {
        setError(err instanceof Error ? err.message : "Could not place the order. Please try again.");
      }
      setBusy(false);
    }
  }

  return (
    <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_360px]">
      <div className="space-y-5">
        {error && <Notice tone="bad">{error}</Notice>}
        {hasProblems && (
          <Notice>
            Some items can’t be ordered right now. <Link href="/basket" className="underline">Review your basket</Link>.
          </Notice>
        )}
        <section>
          <h2 className="font-display text-xl font-extrabold">Items</h2>
          <ul className="mt-3 divide-y divide-line border-y border-line">
            {checked.map((l) => (
              <li key={l.formatId} className="flex justify-between gap-4 py-3 text-[15px]">
                <span>
                  <span className="font-semibold">{l.title}</span>
                  <span className="text-ink-3">
                    {" "}
                    · {FORMAT_LABELS[l.format]} × {l.quantity}
                  </span>
                </span>
                <span className="font-semibold">{formatUsd((l.info?.priceCents ?? l.priceCents) * l.quantity)}</span>
              </li>
            ))}
          </ul>
          <Link href="/basket" className="mt-3 inline-block text-sm font-semibold text-accent">
            Edit basket
          </Link>
        </section>

        <div className="flex gap-3 rounded-[12px] border border-line p-4 text-[15px] text-ink-2">
          <Info size={20} className="mt-0.5 shrink-0 text-accent" aria-hidden />
          <p>
            Online payment isn’t connected yet. Your order is saved as <b>awaiting confirmation</b> and the store
            confirms it. You can cancel it until then.
          </p>
        </div>
      </div>

      <OrderSummary totals={totals}>
        <button
          type="button"
          onClick={placeOrder}
          disabled={busy || hasProblems || !totals}
          className={`${buttonClass.primary} mt-5 w-full`}
        >
          {busy ? "Placing order…" : totals ? `Place order · ${formatUsd(totals.totalCents)}` : "Place order"}
        </button>
        <p className="mt-3 text-xs text-ink-3">The final price is confirmed by the store when the order is placed.</p>
      </OrderSummary>
    </div>
  );
}
