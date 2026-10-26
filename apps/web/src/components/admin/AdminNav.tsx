"use client";

import { BookOpen, LayoutDashboard, Package, Sparkles, Users } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin", label: "Overview", Icon: LayoutDashboard },
  { href: "/admin/books", label: "Books", Icon: BookOpen },
  { href: "/admin/orders", label: "Orders", Icon: Package },
  { href: "/admin/members", label: "Members", Icon: Users },
  { href: "/admin/ai", label: "AI & search", Icon: Sparkles },
];

export function AdminNav({ pendingOrders }: { pendingOrders: number }) {
  const path = usePathname();
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map(({ href, label, Icon }) => {
        const active = href === "/admin" ? path === "/admin" : path.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            aria-current={active ? "page" : undefined}
            className={`flex shrink-0 items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[15px] font-medium ${
              active ? "bg-accent-soft font-semibold text-accent-ink" : "text-ink-2 hover:bg-surface hover:text-ink"
            }`}
          >
            <Icon size={18} aria-hidden />
            {label}
            {href === "/admin/orders" && pendingOrders > 0 && (
              <span className="ml-auto rounded-full bg-warn-soft px-2 text-xs font-bold text-warn">{pendingOrders}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
