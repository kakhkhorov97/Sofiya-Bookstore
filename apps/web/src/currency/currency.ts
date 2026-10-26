import { CURRENCIES, Currency, DEFAULT_CURRENCY, formatMoney, type Prices } from "@sofiya/shared";

// The reader's chosen currency lives in a plain cookie so server pages can
// render prices in it on the first request.
export const CURRENCY_COOKIE = "sofiya_currency";
const ONE_YEAR = 60 * 60 * 24 * 365;

export function parseCurrency(value: string | undefined | null): Currency {
  const parsed = Currency.safeParse(value);
  return parsed.success ? parsed.data : DEFAULT_CURRENCY;
}

export function currencyCookie(currency: Currency): string {
  return `${CURRENCY_COOKIE}=${currency}; Path=/; Max-Age=${ONE_YEAR}; SameSite=Lax`;
}

// Both prices side by side ("₩15,400 · $10.99"), for the admin. With
// skipZero, a currency with nothing in it is left out (revenue, spend).
export function formatPrices(prices: Prices, { skipZero = false } = {}): string {
  const shown = CURRENCIES.filter((c) => !skipZero || prices[c] !== 0);
  return (shown.length ? shown : [DEFAULT_CURRENCY]).map((c) => formatMoney(prices[c], c)).join(" · ");
}
