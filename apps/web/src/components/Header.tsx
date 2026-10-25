import { Search, UserRound } from "lucide-react";
import Link from "next/link";
import { getCurrentUser } from "@/lib/session";
import { BasketLink } from "./BasketLink";
import { NavLinks } from "./NavLinks";

export async function Header() {
  const user = await getCurrentUser().catch(() => null);

  return (
    <header className="sticky top-0 z-20 border-b border-line bg-white/95 backdrop-blur-sm">
      <div className="mx-auto flex h-16 w-[min(1240px,calc(100%-32px))] items-center gap-6 sm:h-[72px]">
        <Link href="/" className="font-display text-[26px] font-extrabold tracking-[-0.03em]">
          Sofiya<span className="text-accent">.</span>
        </Link>
        <NavLinks />
        <form action="/books" role="search" className="ml-auto hidden max-w-[380px] flex-1 md:block">
          <label className="flex items-center gap-2.5 rounded-full bg-surface px-4 py-2.5 text-ink-3 focus-within:ring-2 focus-within:ring-accent">
            <Search size={18} aria-hidden />
            <span className="sr-only">Search books</span>
            <input
              name="q"
              type="search"
              placeholder="Search title or author"
              className="min-w-0 flex-1 bg-transparent text-ink outline-none placeholder:text-ink-3"
            />
          </label>
        </form>
        <div className="ml-auto flex items-center gap-1 md:ml-0">
          <Link
            href={user ? "/account" : "/signin"}
            className="flex items-center gap-2 rounded-[10px] px-3 py-2 font-semibold text-ink-2 hover:bg-surface hover:text-ink"
          >
            <UserRound size={20} aria-hidden />
            <span className="hidden sm:inline">{user ? user.displayName : "Sign in"}</span>
          </Link>
          <BasketLink />
        </div>
      </div>
    </header>
  );
}
