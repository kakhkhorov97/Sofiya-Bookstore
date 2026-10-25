"use client";

import { computeOrderTotals, type FormatInfo, type OrderTotals } from "@sofiya/shared";
import { useCallback, useEffect, useMemo, useState } from "react";
import { clientApi } from "@/lib/client-api";
import type { BasketLine } from "./basket";

export type LineProblem = "unavailable" | "out_of_stock" | null;

export interface CheckedLine extends BasketLine {
  info?: FormatInfo;
  problem: LineProblem;
  priceChanged: boolean;
}

// Fetches today's price and stock for every basket line.
export function useBasketInfo(lines: BasketLine[]) {
  const ids = useMemo(() => [...new Set(lines.map((l) => l.formatId))].sort().join(","), [lines]);
  const [infos, setInfos] = useState<Map<string, FormatInfo>>(new Map());
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!ids) {
      setInfos(new Map());
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const rows = await clientApi<FormatInfo[]>(`/formats?ids=${ids}`);
      setInfos(new Map(rows.map((r) => [r.formatId, r])));
    } catch {
      setError("Could not check prices and stock. Please refresh the page.");
    } finally {
      setLoading(false);
    }
  }, [ids]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const checked: CheckedLine[] = lines.map((l) => {
    const info = infos.get(l.formatId);
    const problem: LineProblem =
      infos.size === 0 ? null : !info || !info.available ? "unavailable" : !info.inStock ? "out_of_stock" : null;
    return { ...l, info, problem, priceChanged: !!info && info.priceCents !== l.priceCents };
  });

  const payable = checked.filter((l) => !l.problem);
  const totals: OrderTotals | null =
    payable.length > 0
      ? computeOrderTotals(payable.map((l) => ({ unitPriceCents: l.info?.priceCents ?? l.priceCents, quantity: l.quantity })))
      : null;

  return {
    checked,
    totals,
    loading,
    error,
    refresh,
    hasProblems: checked.some((l) => l.problem),
  };
}
