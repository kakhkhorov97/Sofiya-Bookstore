"use client";

import { usePathname, useRouter } from "next/navigation";
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { clientApi, ClientApiError } from "@/lib/client-api";

interface WishlistContextValue {
  has: (bookId: string) => boolean;
  toggle: (bookId: string) => Promise<void>;
  count: number;
}

const WishlistContext = createContext<WishlistContextValue | null>(null);

export function WishlistProvider({ signedIn, children }: { signedIn: boolean; children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [ids, setIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!signedIn) {
      setIds(new Set());
      return;
    }
    clientApi<string[]>("/wishlist/ids")
      .then((list) => setIds(new Set(list)))
      .catch(() => setIds(new Set()));
  }, [signedIn]);

  const toggle = useCallback(
    async (bookId: string) => {
      if (!signedIn) {
        router.push(`/signin?next=${encodeURIComponent(pathname)}`);
        return;
      }
      const saved = ids.has(bookId);
      // Optimistic: flip now, undo if the server says no.
      setIds((prev) => {
        const next = new Set(prev);
        if (saved) next.delete(bookId);
        else next.add(bookId);
        return next;
      });
      try {
        await clientApi(`/wishlist/${bookId}`, { method: saved ? "DELETE" : "PUT" });
      } catch (err) {
        setIds((prev) => {
          const next = new Set(prev);
          if (saved) next.add(bookId);
          else next.delete(bookId);
          return next;
        });
        if (err instanceof ClientApiError && err.status === 401) router.push(`/signin?next=${encodeURIComponent(pathname)}`);
      }
    },
    [ids, pathname, router, signedIn],
  );

  const value = useMemo(() => ({ has: (id: string) => ids.has(id), toggle, count: ids.size }), [ids, toggle]);
  return <WishlistContext.Provider value={value}>{children}</WishlistContext.Provider>;
}

export function useWishlist(): WishlistContextValue {
  const ctx = useContext(WishlistContext);
  if (!ctx) throw new Error("useWishlist must be used inside <WishlistProvider>");
  return ctx;
}
