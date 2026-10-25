"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/", label: "Home" },
  { href: "/books", label: "Books" },
  { href: "/orders", label: "Orders" },
];

export function NavLinks() {
  const path = usePathname();
  return (
    <nav aria-label="Main" className="hidden gap-6 font-medium text-ink-2 lg:flex">
      {LINKS.map((l) => {
        const active = l.href === "/" ? path === "/" : path.startsWith(l.href);
        return (
          <Link
            key={l.href}
            href={l.href}
            aria-current={active ? "page" : undefined}
            className={active ? "text-ink shadow-[inset_0_-2px_0_var(--accent)] pb-1" : "hover:text-ink"}
          >
            {l.label}
          </Link>
        );
      })}
    </nav>
  );
}
