"use client";

import { useCallback } from "react";
import { STORAGE_KEY as BASKET_KEY } from "@/basket/BasketProvider";
import { clientApi } from "./client-api";
import { clearRecent } from "./recent";

// Signs out and forgets what this browser remembered for the reader, so the
// next person at the same computer starts with an empty basket and no history.
// A full page load (not a client-side navigation) drops Next.js's in-memory
// copies of private pages, so Back cannot show the previous reader's account.
export function useSignOut() {
  return useCallback(async () => {
    await clientApi("/auth/signout", { method: "POST" }).catch(() => undefined);
    try {
      localStorage.removeItem(BASKET_KEY);
    } catch {
      // Storage unavailable: nothing was remembered.
    }
    clearRecent();
    window.location.replace("/");
  }, []);
}
