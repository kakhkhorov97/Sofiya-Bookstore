import type { GenreCount, PublicUser } from "@sofiya/shared";
import { Heart, Search, Sparkles } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { CurrencySwitcher, FreeDeliveryNote } from "@/currency/CurrencySwitcher";
import { AccountMenu } from "./AccountMenu";
import { BasketLink } from "./BasketLink";
import { MegaMenu } from "./MegaMenu";
import { MobileMenu } from "./MobileMenu";

export async function Header({ user, genres }: { user: PublicUser | null; genres: GenreCount[] }) {
  const t = await getTranslations();
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-[min(1240px,calc(100%-32px))] items-center gap-3 sm:h-[72px] lg:gap-7">
        <MobileMenu genres={genres} user={user} />
        <Link href="/" className="font-display text-[26px] font-extrabold tracking-[-0.03em]">
          Sofiya<span className="text-accent">.</span>
        </Link>
        <nav aria-label={t("header.main")} className="hidden shrink-0 items-center gap-6 whitespace-nowrap lg:flex">
          <MegaMenu genres={genres} />
          <Link
            href="/ask"
            className="flex items-center gap-1.5 rounded-full bg-accent py-1.5 pl-3 pr-2 font-semibold text-white shadow-[0_4px_14px_rgba(59,55,201,0.3)] hover:bg-accent-ink"
          >
            <Sparkles size={16} aria-hidden /> {t("common.askSofiya")}
            <span className="rounded-full bg-white/20 px-1.5 text-[11px] font-bold tracking-wide">{t("common.ai")}</span>
          </Link>
          {/* Also in the account menu, so it gives way first on narrower screens. */}
          <Link href="/orders" className="hidden font-medium text-ink-2 hover:text-ink xl:block">
            {t("common.orders")}
          </Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-ink hover:bg-accent hover:text-white">
              {t("common.admin")}
            </Link>
          )}
        </nav>
        <form action="/books" role="search" className="ml-auto hidden min-w-[170px] max-w-[340px] flex-1 md:block">
          <label className="flex items-center gap-2.5 rounded-full bg-surface px-4 py-2.5 text-ink-3 focus-within:ring-2 focus-within:ring-accent">
            <Search size={18} aria-hidden />
            <span className="sr-only">{t("common.searchBooks")}</span>
            <input
              name="q"
              type="search"
              placeholder={t("common.searchBooks")}
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
            />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-0.5 md:ml-0">
          <div className="mr-1 hidden items-center gap-1.5 sm:flex">
            <LanguageSwitcher />
            <CurrencySwitcher />
          </div>
          <Link
            href="/ask"
            aria-label={t("header.askLabel")}
            className="grid size-10 place-items-center rounded-full bg-accent-soft text-accent hover:bg-accent hover:text-white lg:hidden"
          >
            <Sparkles size={19} />
          </Link>
          <AccountMenu user={user} />
          <Link
            href="/wishlist"
            aria-label={t("common.wishlist")}
            className="grid size-10 place-items-center rounded-[10px] text-ink-2 hover:bg-surface hover:text-ink"
          >
            <Heart size={20} />
          </Link>
          <BasketLink />
        </div>
      </div>
    </header>
  );
}

export async function PromoBar() {
  const t = await getTranslations("header");
  return (
    <div className="bg-ink text-white">
      <p className="mx-auto flex w-[min(1240px,calc(100%-32px))] items-center justify-center gap-2 py-2 text-center text-[13px] sm:text-sm">
        <span className="hidden sm:inline">
          <FreeDeliveryNote /> ·
        </span>
        <Link href="/ask" className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline">
          <Sparkles size={14} aria-hidden /> {t("promoNew")}
        </Link>
      </p>
    </div>
  );
}
