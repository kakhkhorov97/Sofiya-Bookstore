"use client";

import { formatMoney, type Currency, type Prices } from "@sofiya/shared";
import { useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useMemo, useState, useTransition } from "react";
import { currencyCookie } from "./currency";

interface CurrencyContextValue {
  currency: Currency;
  setCurrency: (currency: Currency) => void;
  pending: boolean;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);

export function CurrencyProvider({ initial, children }: { initial: Currency; children: React.ReactNode }) {
  const router = useRouter();
  const [currency, setState] = useState(initial);
  const [pending, startTransition] = useTransition();

  const setCurrency = useCallback(
    (next: Currency) => {
      document.cookie = currencyCookie(next);
      setState(next);
      // Server pages (sorting by price, order totals) read the cookie.
      startTransition(() => router.refresh());
    },
    [router],
  );

  const value = useMemo(() => ({ currency, setCurrency, pending }), [currency, setCurrency, pending]);
  return <CurrencyContext.Provider value={value}>{children}</CurrencyContext.Provider>;
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) throw new Error("useCurrency must be used inside CurrencyProvider");
  return ctx;
}

// A price in the reader's currency, for server and client components alike.
export function Price({ prices, prefix }: { prices: Prices; prefix?: string }) {
  const { currency } = useCurrency();
  return (
    <>
      {prefix}
      {formatMoney(prices[currency], currency)}
    </>
  );
}
