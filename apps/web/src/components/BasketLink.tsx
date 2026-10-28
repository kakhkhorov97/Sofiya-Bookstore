"use client";

import { ShoppingBag } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useBasket } from "@/basket/BasketProvider";

export function BasketLink() {
  const { count, ready } = useBasket();
  const t = useTranslations();
  return (
    <Link
      href="/basket"
      aria-label={t("basketLink.label", { count: ready ? count : 0 })}
      className="relative flex items-center gap-2 rounded-[10px] px-3 py-2 font-semibold text-ink-2 hover:bg-surface hover:text-ink"
    >
      <ShoppingBag size={20} aria-hidden />
      {ready && count > 0 && (
        <span className="absolute left-[22px] top-0.5 min-w-[18px] rounded-full bg-accent px-1.5 text-center text-[11px] font-bold leading-[18px] text-white">
          {count}
        </span>
      )}
      <span className="hidden sm:inline">{t("common.basket")}</span>
    </Link>
  );
}
