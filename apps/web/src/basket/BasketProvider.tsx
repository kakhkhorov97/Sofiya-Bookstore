"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useReducer, useState } from "react";
import { BasketAction, BasketLine, basketReducer, itemCount, parseStoredBasket } from "./basket";

const STORAGE_KEY = "sofiya.basket.v1";

interface BasketContextValue {
  lines: BasketLine[];
  count: number;
  // False until localStorage has been read, so the UI does not flash "empty".
  ready: boolean;
  dispatch: (action: BasketAction) => void;
}

const BasketContext = createContext<BasketContextValue | null>(null);

export function BasketProvider({ children }: { children: React.ReactNode }) {
  const [lines, rawDispatch] = useReducer(basketReducer, []);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    try {
      rawDispatch({ type: "replace", lines: parseStoredBasket(localStorage.getItem(STORAGE_KEY)) });
    } catch {
      // Storage blocked (private mode): the basket simply lives in memory.
    }
    setReady(true);

    // Keep tabs in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) rawDispatch({ type: "replace", lines: parseStoredBasket(e.newValue) });
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, []);

  useEffect(() => {
    if (!ready) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Ignore: see above.
    }
  }, [lines, ready]);

  const dispatch = useCallback((action: BasketAction) => rawDispatch(action), []);
  const value = useMemo(() => ({ lines, count: itemCount(lines), ready, dispatch }), [lines, ready, dispatch]);

  return <BasketContext.Provider value={value}>{children}</BasketContext.Provider>;
}

export function useBasket(): BasketContextValue {
  const ctx = useContext(BasketContext);
  if (!ctx) throw new Error("useBasket must be used inside <BasketProvider>");
  return ctx;
}
