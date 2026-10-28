"use client";

import type { OrderView, PaymentConfig } from "@sofiya/shared";

// "Frankenstein and 2 more" (Toss shows this in the payment window, at most
// 100 characters). `more` words it in the reader's language.
export type OrderNameFormat = (first: string, count: number) => string;
const englishName: OrderNameFormat = (first, count) => `${first} and ${count} more`;

export function orderName(order: Pick<OrderView, "items">, more: OrderNameFormat = englishName): string {
  const [first, ...rest] = order.items;
  const title = first ? first.bookTitle : "Sofiya order";
  const name = rest.length ? more(title, rest.length) : title;
  return name.length > 100 ? `${name.slice(0, 99)}…` : name;
}

// Opens the Toss Payments window for an unpaid card order. Toss sends the
// browser to /checkout/success (or /checkout/fail) afterwards; the server
// confirms the payment there. In fake mode (local demo without Toss keys)
// the window is skipped and the payment is approved straight away.
export async function startCardPayment(
  config: PaymentConfig,
  order: Pick<OrderView, "id" | "items" | "total" | "currency">,
  customer: { id: string; email: string; name: string },
  more?: OrderNameFormat,
): Promise<void> {
  const origin = window.location.origin;
  if (config.card.provider === "fake") {
    const params = new URLSearchParams({
      orderId: order.id,
      paymentKey: `fake_ok_${crypto.randomUUID()}`,
      amount: String(order.total),
    });
    window.location.assign(`/checkout/success?${params}`);
    return;
  }
  if (!config.card.clientKey) throw new Error("Card payments are not available right now.");

  // Loaded only when someone pays, so other pages never download Toss's script.
  const { loadTossPayments } = await import("@tosspayments/tosspayments-sdk");
  const toss = await loadTossPayments(config.card.clientKey);
  await toss.payment({ customerKey: customer.id }).requestPayment({
    method: "CARD",
    amount: { currency: order.currency, value: order.total },
    orderId: order.id,
    orderName: orderName(order, more),
    customerEmail: customer.email,
    customerName: customer.name,
    successUrl: `${origin}/checkout/success`,
    failUrl: `${origin}/checkout/fail`,
  });
}

// Closing the Toss window rejects with this code; it is not an error to show.
export const isUserCancel = (err: unknown) =>
  typeof err === "object" && err !== null && "code" in err && (err as { code: string }).code === "USER_CANCEL";
