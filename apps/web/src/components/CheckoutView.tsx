"use client";

import { CURRENCY_LABELS, formatMoney, type Currency, type OrderView, type PaymentConfig, type PaymentMethod } from "@sofiya/shared";
import { CreditCard, Landmark } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { basketFingerprint, type BasketLine } from "@/basket/basket";
import { useBasket } from "@/basket/BasketProvider";
import { useBasketInfo } from "@/basket/useBasketInfo";
import { isUserCancel, startCardPayment } from "@/lib/card-payment";
import { clientApi, ClientApiError } from "@/lib/client-api";
import { FORMAT_LABELS } from "@/lib/labels";
import { OrderSummary } from "./OrderSummary";
import { buttonClass, ButtonLink, Notice } from "./ui";

const KEY_STORAGE = "sofiya.checkout.v1";

// One idempotency key per basket. Retrying (double click, flaky network)
// sends the same key, so the API returns the same order instead of a second one.
// Switching currency or payment method is a different order, so it gets a new key.
function idempotencyKeyFor(lines: BasketLine[], currency: Currency, method: PaymentMethod): string {
  const fingerprint = basketFingerprint(lines, `${currency}|${method}`);
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

export function CheckoutView({
  config,
  customer,
}: {
  config: PaymentConfig;
  customer: { id: string; email: string; name: string };
}) {
  const router = useRouter();
  const { lines, ready, dispatch } = useBasket();
  const { currency, checked, totals, hasProblems, refresh } = useBasketInfo(lines);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [placed, setPlaced] = useState<{ id: string; paying: boolean } | null>(null);

  const cardAvailable = config.card.enabled && config.card.currencies.includes(currency);
  const [chosen, setChosen] = useState<PaymentMethod>(cardAvailable ? "CARD" : "BANK_TRANSFER");
  // Switching to a currency cards don't support falls back to bank transfer.
  const method: PaymentMethod = chosen === "CARD" && !cardAvailable ? "BANK_TRANSFER" : chosen;

  // The basket is cleared on success; show this instead of "Nothing to check out".
  if (placed) {
    return (
      <div className="mt-8 rounded-[16px] bg-ok-soft px-6 py-12 text-center text-ok" role="status">
        <p className="font-display text-2xl font-extrabold">Order placed</p>
        <p className="mt-2">{placed.paying ? "Opening the secure payment window…" : "Opening your order…"}</p>
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
          idempotencyKey: idempotencyKeyFor(lines, currency, method),
          currency,
          paymentMethod: method,
          lines: lines.map((l) => ({ formatId: l.formatId, quantity: l.quantity })),
        },
      });
      try {
        sessionStorage.removeItem(KEY_STORAGE);
      } catch {
        /* ignore */
      }
      // The order holds the stock now, so the basket is done either way.
      dispatch({ type: "clear" });
      if (method === "CARD") {
        setPlaced({ id: order.id, paying: true });
        try {
          await startCardPayment(config, order, customer);
        } catch (err) {
          // Closed the window, or Toss refused to open it: the order stays
          // unpaid, and its page has a "Pay now" button.
          const reason = isUserCancel(err) ? "cancelled" : "error";
          router.push(`/orders/${order.id}?payment=${reason}`);
        }
        return;
      }
      setPlaced({ id: order.id, paying: false });
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
                <span className="font-semibold">{formatMoney((l.info?.price ?? l.price)[currency] * l.quantity, currency)}</span>
              </li>
            ))}
          </ul>
          <Link href="/basket" className="mt-3 inline-block text-sm font-semibold text-accent">
            Edit basket
          </Link>
        </section>

        <fieldset>
          <legend className="font-display text-xl font-extrabold">Payment</legend>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <PaymentOption
              value="CARD"
              checked={method === "CARD"}
              disabled={!cardAvailable}
              onChange={setChosen}
              icon={<CreditCard size={20} aria-hidden />}
              title="Card or easy pay"
              text={
                !config.card.enabled
                  ? "Not available right now."
                  : cardAvailable
                    ? "Cards, Toss Pay, KakaoPay, NaverPay. Paid now, confirmed at once."
                    : `Not available in ${CURRENCY_LABELS[currency].name}s yet. Switch to ${config.card.currencies.map((c) => CURRENCY_LABELS[c].symbol).join(" / ")} to pay by card.`
              }
            />
            <PaymentOption
              value="BANK_TRANSFER"
              checked={method === "BANK_TRANSFER"}
              onChange={setChosen}
              icon={<Landmark size={20} aria-hidden />}
              title="Bank transfer"
              text="Pay to our account after ordering. We confirm the order when the money arrives."
            />
          </div>
          {method === "CARD" && config.card.provider === "fake" && (
            <p className="mt-2 text-xs text-ink-3">Demo mode: card payments are simulated, no money moves.</p>
          )}
        </fieldset>
      </div>

      <OrderSummary totals={totals}>
        <button
          type="button"
          onClick={placeOrder}
          disabled={busy || hasProblems || !totals}
          className={`${buttonClass.primary} mt-5 w-full`}
        >
          {busy
            ? "Placing order…"
            : totals
              ? `${method === "CARD" ? "Pay" : "Place order"} · ${formatMoney(totals.total, currency)}`
              : "Place order"}
        </button>
        <p className="mt-3 text-xs text-ink-3">
          {method === "CARD"
            ? "You pay in Toss Payments' secure window. Sofiya never sees your card details."
            : "Prices are checked by the store when the order is placed."}
        </p>
      </OrderSummary>
    </div>
  );
}

function PaymentOption({
  value,
  checked,
  disabled = false,
  onChange,
  icon,
  title,
  text,
}: {
  value: PaymentMethod;
  checked: boolean;
  disabled?: boolean;
  onChange: (m: PaymentMethod) => void;
  icon: React.ReactNode;
  title: string;
  text: string;
}) {
  return (
    <label
      className={`flex gap-3 rounded-[12px] border bg-white p-4 ${
        disabled ? "cursor-not-allowed opacity-60" : "cursor-pointer"
      } ${checked ? "border-accent ring-[3px] ring-accent-soft" : "border-line hover:border-ink-3"}`}
    >
      <input
        type="radio"
        name="payment"
        value={value}
        checked={checked}
        disabled={disabled}
        onChange={() => onChange(value)}
        className="sr-only"
      />
      <span className={`mt-0.5 ${checked ? "text-accent" : "text-ink-3"}`}>{icon}</span>
      <span>
        <span className="block font-semibold">{title}</span>
        <span className="block text-sm text-ink-2">{text}</span>
      </span>
    </label>
  );
}
