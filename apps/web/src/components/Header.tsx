import type { GenreCount, PublicUser } from "@sofiya/shared";
import { Heart, Search, Sparkles, UserRound } from "lucide-react";
import Link from "next/link";
import { CurrencySwitcher, FreeDeliveryNote } from "@/currency/CurrencySwitcher";
import { BasketLink } from "./BasketLink";
import { MegaMenu } from "./MegaMenu";
import { MobileMenu } from "./MobileMenu";

export function Header({ user, genres }: { user: PublicUser | null; genres: GenreCount[] }) {
  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-[min(1240px,calc(100%-32px))] items-center gap-3 sm:h-[72px] lg:gap-7">
        <MobileMenu genres={genres} user={user} />
        <Link href="/" className="font-display text-[26px] font-extrabold tracking-[-0.03em]">
          Sofiya<span className="text-accent">.</span>
        </Link>
        <nav aria-label="Main" className="hidden shrink-0 items-center gap-6 whitespace-nowrap lg:flex">
          <MegaMenu genres={genres} />
          <Link href="/ask" className="flex items-center gap-1.5 font-medium text-ink-2 hover:text-ink">
            <Sparkles size={16} className="text-accent" aria-hidden /> Ask Sofiya
          </Link>
          <Link href="/orders" className="font-medium text-ink-2 hover:text-ink">
            Orders
          </Link>
          {user?.role === "ADMIN" && (
            <Link href="/admin" className="rounded-full bg-accent-soft px-3 py-1 text-sm font-semibold text-accent-ink hover:bg-accent hover:text-white">
              Admin
            </Link>
          )}
        </nav>
        <form action="/books" role="search" className="ml-auto hidden min-w-0 max-w-[340px] flex-1 md:block">
          <label className="flex items-center gap-2.5 rounded-full bg-surface px-4 py-2.5 text-ink-3 focus-within:ring-2 focus-within:ring-accent">
            <Search size={18} aria-hidden />
            <span className="sr-only">Search books</span>
            <input
              name="q"
              type="search"
              placeholder="Search title, author or topic"
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
            />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-0.5 md:ml-0">
          <CurrencySwitcher className="mr-1 hidden sm:inline-flex" />
          <Link
            href={user ? "/account" : "/signin"}
            className="hidden items-center gap-2 rounded-[10px] px-3 py-2 font-semibold text-ink-2 hover:bg-surface hover:text-ink sm:flex"
          >
            <UserRound size={20} aria-hidden />
            <span className="hidden xl:inline">{user ? user.displayName : "Sign in"}</span>
            <span className="sr-only xl:hidden">{user ? "Your account" : "Sign in"}</span>
          </Link>
          <Link
            href="/wishlist"
            aria-label="Wishlist"
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

export function PromoBar() {
  return (
    <div className="bg-ink text-white">
      <p className="mx-auto flex w-[min(1240px,calc(100%-32px))] items-center justify-center gap-2 py-2 text-center text-[13px] sm:text-sm">
        <span className="hidden sm:inline">
          <FreeDeliveryNote /> ·
        </span>
        <Link href="/ask" className="inline-flex items-center gap-1.5 font-semibold underline-offset-2 hover:underline">
          <Sparkles size={14} aria-hidden /> New: ask our AI book concierge
        </Link>
      </p>
    </div>
  );
}
