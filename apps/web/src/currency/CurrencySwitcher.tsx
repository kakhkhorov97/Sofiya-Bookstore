"use client";

import { CURRENCIES, CURRENCY_LABELS, DELIVERY, formatMoney } from "@sofiya/shared";
import { useCurrency } from "./CurrencyProvider";

// Two-option toggle: ₩ KRW (the default) and $ USD.
export function CurrencySwitcher({ className = "" }: { className?: string }) {
  const { currency, setCurrency, pending } = useCurrency();
  return (
    <div
      role="radiogroup"
      aria-label="Currency"
      aria-busy={pending}
      className={`inline-flex shrink-0 rounded-full bg-surface p-1 text-[13px] font-semibold ${className}`}
    >
      {CURRENCIES.map((c) => {
        const active = c === currency;
        return (
          <button
            key={c}
            type="button"
            role="radio"
            aria-checked={active}
            title={CURRENCY_LABELS[c].name}
            onClick={() => !active && setCurrency(c)}
            className={`rounded-full px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              active ? "bg-white text-ink shadow-sm" : "text-ink-3 hover:text-ink"
            }`}
          >
            <span aria-hidden>{CURRENCY_LABELS[c].symbol}</span> {c}
          </button>
        );
      })}
    </div>
  );
}

export function FreeDeliveryNote() {
  const { currency } = useCurrency();
  return <>Free delivery on orders over {formatMoney(DELIVERY[currency].freeFrom, currency)}</>;
}
