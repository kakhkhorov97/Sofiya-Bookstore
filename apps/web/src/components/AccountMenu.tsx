"use client";

import type { PublicUser } from "@sofiya/shared";
import {
  ChevronDown,
  Heart,
  LayoutDashboard,
  LogIn,
  LogOut,
  MessageSquareText,
  Package,
  Settings,
  Sparkles,
  UserPlus,
  UserRound,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { useWishlist } from "@/wishlist/WishlistProvider";

interface Item {
  href: string;
  label: string;
  icon: React.ReactNode;
  badge?: string | number;
}

// The account button in the header: a menu with the reader's pages, or
// sign in / create account for visitors.
export function AccountMenu({ user }: { user: PublicUser | null }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const button = useRef<HTMLButtonElement>(null);
  const menuId = useId();
  const pathname = usePathname();
  const router = useRouter();
  const { count: wishlistCount } = useWishlist();

  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onPointer = (e: PointerEvent) => {
      if (!wrap.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        button.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  // Arrow keys move between items, like a native menu.
  function onMenuKey(e: React.KeyboardEvent<HTMLDivElement>) {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key)) return;
    e.preventDefault();
    const items = [...e.currentTarget.querySelectorAll<HTMLElement>('[role="menuitem"]')];
    const i = items.indexOf(document.activeElement as HTMLElement);
    const next =
      e.key === "Home" ? 0 : e.key === "End" ? items.length - 1 : e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
    items[next]?.focus();
  }

  async function signOut() {
    setSigningOut(true);
    await clientApi("/auth/signout", { method: "POST" }).catch(() => undefined);
    setOpen(false);
    setSigningOut(false);
    router.replace("/");
    router.refresh();
  }

  const items: Item[] = user
    ? [
        { href: "/account", label: "Account settings", icon: <Settings size={18} /> },
        { href: "/orders", label: "Orders", icon: <Package size={18} /> },
        { href: "/wishlist", label: "Wishlist", icon: <Heart size={18} />, badge: wishlistCount || undefined },
        { href: "/account/reviews", label: "My reviews", icon: <MessageSquareText size={18} /> },
        { href: "/ask", label: "Ask Sofiya", icon: <Sparkles size={18} className="text-accent" /> },
        ...(user.role === "ADMIN"
          ? [{ href: "/admin", label: "Admin panel", icon: <LayoutDashboard size={18} /> }]
          : []),
      ]
    : [
        { href: `/signin?next=${encodeURIComponent(pathname)}`, label: "Sign in", icon: <LogIn size={18} /> },
        { href: "/signup", label: "Create an account", icon: <UserPlus size={18} /> },
        { href: "/orders", label: "Track an order", icon: <Package size={18} /> },
        { href: "/wishlist", label: "Wishlist", icon: <Heart size={18} /> },
      ];

  return (
    <div ref={wrap} className="relative hidden sm:block">
      <button
        ref={button}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-[10px] px-3 py-2 font-semibold text-ink-2 hover:bg-surface hover:text-ink ${open ? "bg-surface text-ink" : ""}`}
      >
        {user ? (
          <span className="grid size-7 place-items-center rounded-full bg-accent-soft text-sm font-bold text-accent-ink" aria-hidden>
            {user.displayName.trim().charAt(0).toUpperCase() || "?"}
          </span>
        ) : (
          <UserRound size={20} aria-hidden />
        )}
        <span className="hidden max-w-[12ch] truncate xl:inline">{user ? user.displayName : "Sign in"}</span>
        <span className="sr-only xl:hidden">{user ? "Your account" : "Account"}</span>
        <ChevronDown size={16} aria-hidden className={`transition-transform ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div
          id={menuId}
          role="menu"
          aria-label="Account"
          onKeyDown={onMenuKey}
          className="absolute right-0 top-[calc(100%+8px)] z-30 w-[280px] overflow-hidden rounded-[16px] border border-line bg-white shadow-[0_18px_48px_rgba(21,23,28,0.14)]"
        >
          {user ? (
            <div className="border-b border-line px-4 py-3.5">
              <p className="truncate font-bold">{user.displayName}</p>
              <p className="truncate text-sm text-ink-3">{user.email}</p>
              <Link
                href="/account"
                role="menuitem"
                className="mt-2.5 flex items-center justify-between rounded-[10px] bg-accent-soft px-3 py-2 text-sm text-accent-ink"
              >
                <span className="font-semibold">Reading points</span>
                <span className="font-display text-lg font-extrabold">{user.points}</span>
              </Link>
            </div>
          ) : (
            <p className="border-b border-line px-4 py-3.5 text-sm text-ink-2">
              Sign in to keep your wishlist, track orders and review books you bought.
            </p>
          )}

          <ul className="p-1.5">
            {items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  role="menuitem"
                  className={`flex items-center gap-3 rounded-[10px] px-3 py-2.5 text-[15px] hover:bg-surface focus-visible:bg-surface ${
                    pathname === item.href ? "font-semibold text-ink" : "text-ink-2"
                  }`}
                >
                  <span className="text-ink-3" aria-hidden>
                    {item.icon}
                  </span>
                  <span className="flex-1">{item.label}</span>
                  {item.badge !== undefined && (
                    <span className="rounded-full bg-surface px-2 text-xs font-bold text-ink-2">{item.badge}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>

          {user && (
            <div className="border-t border-line p-1.5">
              <button
                type="button"
                role="menuitem"
                disabled={signingOut}
                onClick={signOut}
                className="flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[15px] text-ink-2 hover:bg-surface hover:text-bad disabled:opacity-60"
              >
                <LogOut size={18} aria-hidden className="text-ink-3" />
                {signingOut ? "Signing out…" : "Sign out"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
