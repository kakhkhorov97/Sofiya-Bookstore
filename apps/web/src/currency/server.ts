import "server-only";
import type { Currency } from "@sofiya/shared";
import { cookies } from "next/headers";
import { cache } from "react";
import { CURRENCY_COOKIE, parseCurrency } from "./currency";

export const getCurrency = cache(async (): Promise<Currency> => {
  return parseCurrency((await cookies()).get(CURRENCY_COOKIE)?.value);
});
