import { z } from "zod";

// Money is always an integer in the currency's smallest unit:
// won for KRW (it has no minor unit), cents for USD.
export const CURRENCIES = ["KRW", "USD"] as const;
export const Currency = z.enum(CURRENCIES);
export type Currency = z.infer<typeof Currency>;

// Korean won is the store's main currency; readers can switch to dollars.
export const DEFAULT_CURRENCY: Currency = "KRW";

export type Prices = Record<Currency, number>;

// Delivery is a store policy per currency, not a conversion.
export const DELIVERY: Record<Currency, { freeFrom: number; fee: number }> = {
  KRW: { freeFrom: 30_000, fee: 3_000 },
  USD: { freeFrom: 100_00, fee: 5_00 },
};

// Used only to suggest a won price from a dollar price (seed data and the
// admin's "fill from $" button). Won prices are set by the store, never
// converted live.
export const KRW_PER_USD = 1_400;

export function suggestKrw(usdCents: number): number {
  return Math.max(100, Math.round((usdCents * KRW_PER_USD) / 100 / 100) * 100);
}

export interface PricedLine {
  unitPrice: number;
  quantity: number;
}

export interface OrderTotals {
  currency: Currency;
  subtotal: number;
  delivery: number;
  total: number;
}

export function computeOrderTotals(lines: readonly PricedLine[], currency: Currency): OrderTotals {
  if (lines.length === 0) throw new Error("An order needs at least one line");
  const subtotal = lines.reduce((sum, line) => {
    if (!Number.isInteger(line.unitPrice) || line.unitPrice < 0) {
      throw new Error("unitPrice must be a non-negative integer");
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error("quantity must be a positive integer");
    }
    return sum + line.unitPrice * line.quantity;
  }, 0);
  const rule = DELIVERY[currency];
  const delivery = subtotal >= rule.freeFrom ? 0 : rule.fee;
  return { currency, subtotal, delivery, total: subtotal + delivery };
}

const FORMATTERS: Record<Currency, Intl.NumberFormat> = {
  KRW: new Intl.NumberFormat("ko-KR", { style: "currency", currency: "KRW" }),
  USD: new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }),
};

export function formatMoney(amount: number, currency: Currency): string {
  return FORMATTERS[currency].format(currency === "USD" ? amount / 100 : amount);
}

export const CURRENCY_LABELS: Record<Currency, { symbol: string; name: string }> = {
  KRW: { symbol: "₩", name: "Korean won" },
  USD: { symbol: "$", name: "US dollar" },
};
