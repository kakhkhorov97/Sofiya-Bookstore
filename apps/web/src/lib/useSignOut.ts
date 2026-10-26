"use client";

import { useRouter } from "next/navigation";
import { useCallback } from "react";
import { useBasket } from "@/basket/BasketProvider";
import { clientApi } from "./client-api";
import { clearRecent } from "./recent";

// Signs out and forgets what this browser remembered for the reader, so the
// next person at the same computer starts with an empty basket and no history.
export function useSignOut() {
  const router = useRouter();
  const { dispatch } = useBasket();
  return useCallback(async () => {
    await clientApi("/auth/signout", { method: "POST" }).catch(() => undefined);
    dispatch({ type: "clear" });
    clearRecent();
    router.replace("/");
    router.refresh();
  }, [dispatch, router]);
}
