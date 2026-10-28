"use client";

import type { GenreCount, PublicUser } from "@sofiya/shared";
import {
  Heart,
  Menu,
  Package,
  Search,
  Sparkles,
  Star,
  UserRound,
  X,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useTranslations } from "next-intl";
import { CurrencySwitcher } from "@/currency/CurrencySwitcher";
import { LanguageSwitcher } from "@/i18n/LanguageSwitcher";
import { FEATURED_AUTHORS } from "@/lib/nav";

export function MobileMenu({
  genres,
  user,
}: {
  genres: GenreCount[];
  user: PublicUser | null;
}) {
  const t = useTranslations();
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    document.body.style.overflow = "hidden";
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="lg:hidden">
      <button
        type="button"
        aria-label={t("mobileMenu.open")}
        aria-expanded={open}
        onClick={() => setOpen(true)}
        className="grid size-10 place-items-center rounded-[10px] text-ink-2 hover:bg-surface"
      >
        <Menu size={22} />
      </button>

      {/* Portalled to <body>: the header's backdrop-filter would otherwise
          trap this fixed overlay inside the 64px header. */}
      {open &&
        createPortal(
          <div
            className="fixed inset-0 z-50"
            role="dialog"
            aria-modal="true"
            aria-label={t("mobileMenu.title")}
          >
            <button
              type="button"
              aria-label={t("mobileMenu.close")}
              className="absolute inset-0 bg-ink/40"
              onClick={() => setOpen(false)}
            />
            <div className="absolute inset-y-0 left-0 flex w-[min(340px,88vw)] flex-col overflow-y-auto bg-white shadow-2xl">
              <div className="flex h-16 items-center justify-between border-b border-line px-4">
                <span className="font-display text-2xl font-extrabold tracking-[-0.03em]">
                  Sofiya<span className="text-accent">.</span>
                </span>
                <button
                  ref={closeRef}
                  type="button"
                  aria-label={t("mobileMenu.close")}
                  onClick={() => setOpen(false)}
                  className="grid size-10 place-items-center rounded-[10px] hover:bg-surface"
                >
                  <X size={22} />
                </button>
              </div>

              <form action="/books" role="search" className="p-4">
                <label className="flex items-center gap-2.5 rounded-full bg-surface px-4 py-2.5 text-ink-3 focus-within:ring-2 focus-within:ring-accent">
                  <Search size={18} aria-hidden />
                  <span className="sr-only">Search books</span>
                  <input
                    name="q"
                    type="search"
                    placeholder={t("mobileMenu.search")}
                    className="min-w-0 flex-1 bg-transparent text-ink outline-none"
                  />
                </label>
              </form>

              <div className="flex items-center justify-between px-5 pb-3 text-[15px]">
                <span className="text-ink-2">{t("mobileMenu.language")}</span>
                <LanguageSwitcher />
              </div>
              <div className="flex items-center justify-between px-5 pb-3 text-[15px]">
                <span className="text-ink-2">{t("mobileMenu.currency")}</span>
                <CurrencySwitcher />
              </div>

              <nav aria-label={t("mobileMenu.nav")} className="px-2 pb-6 text-[15px]">
                <MobileLink
                  href="/ask"
                  icon={<Sparkles size={18} className="text-accent" />}
                >
                  {t("common.askSofiya")}
                </MobileLink>
                <MobileLink
                  href="/books?staffPicks=true"
                  icon={<Star size={18} className="text-[#e3a008]" />}
                >
                  {t("common.staffPicks")}
                </MobileLink>
                <MobileLink href="/wishlist" icon={<Heart size={18} />}>
                  {t("common.wishlist")}
                </MobileLink>
                <MobileLink href="/orders" icon={<Package size={18} />}>
                  {t("common.orders")}
                </MobileLink>
                {user?.role === "ADMIN" && (
                  <MobileLink href="/admin" icon={<Sparkles size={18} className="text-accent" />}>
                    {t("common.admin")}
                  </MobileLink>
                )}
                <MobileLink
                  href={user ? "/account" : "/signin"}
                  icon={<UserRound size={18} />}
                >
                  {user ? user.displayName : t("mobileMenu.signIn")}
                </MobileLink>

                <p className="mb-1 mt-6 px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
                  {t("mobileMenu.genres")}
                </p>
                {genres.map((g) => (
                  <Link
                    key={g.genre}
                    href={`/books?genre=${g.genre}`}
                    className="flex justify-between rounded-[8px] px-3 py-2 hover:bg-surface"
                  >
                    {t(`labels.genre.${g.genre}`)}
                    <span className="text-ink-3">{g.count}</span>
                  </Link>
                ))}

                <p className="mb-1 mt-6 px-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">
                  {t("mobileMenu.authors")}
                </p>
                {FEATURED_AUTHORS.map((a) => (
                  <Link
                    key={a.slug}
                    href={`/authors/${a.slug}`}
                    className="block rounded-[8px] px-3 py-2 hover:bg-surface"
                  >
                    {a.name}
                  </Link>
                ))}
              </nav>
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}

function MobileLink({
  href,
  icon,
  children,
}: {
  href: string;
  icon: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="flex items-center gap-3 rounded-[8px] px-3 py-2.5 font-medium hover:bg-surface"
    >
      <span aria-hidden>{icon}</span>
      {children}
    </Link>
  );
}
