"use client";

import { BOOK_FORMATS, type GenreCount } from "@sofiya/shared";
import { ChevronDown, Sparkles, Star } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { FORMAT_LABELS, GENRE_LABELS } from "@/lib/labels";
import { FEATURED_AUTHORS } from "@/lib/nav";

export function MegaMenu({ genres }: { genres: GenreCount[] }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const hoveredAt = useRef(0);
  const pathname = usePathname();

  // Close on navigation, outside click and Escape.
  useEffect(() => setOpen(false), [pathname]);
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const active = pathname.startsWith("/books") || pathname.startsWith("/authors");

  return (
    <div ref={ref} className="relative" onMouseLeave={() => setOpen(false)}>
      <button
        type="button"
        aria-expanded={open}
        aria-controls="browse-menu"
        // A click right after hovering open should not close the menu again.
        onClick={() => setOpen((o) => (o && Date.now() - hoveredAt.current < 500 ? true : !o))}
        onMouseEnter={() => {
          hoveredAt.current = Date.now();
          setOpen(true);
        }}
        className={`flex items-center gap-1 font-medium ${active ? "text-ink" : "text-ink-2 hover:text-ink"}`}
      >
        Browse <ChevronDown size={16} className={`transition-transform ${open ? "rotate-180" : ""}`} aria-hidden />
      </button>

      {open && (
        <div id="browse-menu" className="absolute left-[-24px] top-full z-30 pt-4">
          <div className="grid w-[720px] grid-cols-[1.3fr_1fr_1fr] gap-8 rounded-[16px] border border-line bg-white p-7 shadow-[0_24px_60px_rgba(21,23,28,0.14)]">
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Genres</p>
              <ul className="grid gap-1">
                {genres.map((g) => (
                  <li key={g.genre}>
                    <Link
                      href={`/books?genre=${g.genre}`}
                      className="flex justify-between rounded-[8px] px-2 py-1.5 text-[15px] hover:bg-surface"
                    >
                      {GENRE_LABELS[g.genre]}
                      <span className="text-ink-3">{g.count}</span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Formats</p>
              <ul className="grid gap-1">
                {BOOK_FORMATS.map((f) => (
                  <li key={f}>
                    <Link href={`/books?format=${f}`} className="block rounded-[8px] px-2 py-1.5 text-[15px] hover:bg-surface">
                      {FORMAT_LABELS[f]}
                    </Link>
                  </li>
                ))}
              </ul>
              <p className="mb-3 mt-6 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Discover</p>
              <ul className="grid gap-1">
                <li>
                  <Link href="/books?staffPicks=true" className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[15px] hover:bg-surface">
                    <Star size={16} className="text-[#e3a008]" aria-hidden /> Staff picks
                  </Link>
                </li>
                <li>
                  <Link href="/ask" className="flex items-center gap-2 rounded-[8px] px-2 py-1.5 text-[15px] hover:bg-surface">
                    <Sparkles size={16} className="text-accent" aria-hidden /> Ask Sofiya
                  </Link>
                </li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-semibold uppercase tracking-[0.06em] text-ink-3">Popular authors</p>
              <ul className="grid gap-1">
                {FEATURED_AUTHORS.map((a) => (
                  <li key={a.slug}>
                    <Link href={`/authors/${a.slug}`} className="block rounded-[8px] px-2 py-1.5 text-[15px] hover:bg-surface">
                      {a.name}
                    </Link>
                  </li>
                ))}
              </ul>
              <Link href="/books" className="mt-4 inline-block px-2 text-sm font-semibold text-accent">
                All books →
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
