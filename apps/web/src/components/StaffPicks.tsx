"use client";

import { formatUsd, type BookSummary } from "@sofiya/shared";
import { ChevronLeft, ChevronRight, Star } from "lucide-react";
import Link from "next/link";
import { useRef } from "react";
import { BookCover } from "./BookCover";

// A scroll-snap carousel: swipe on phones, arrow buttons on desktop.
export function StaffPicks({ books }: { books: BookSummary[] }) {
  const track = useRef<HTMLUListElement>(null);
  const scroll = (dir: 1 | -1) => {
    const el = track.current;
    if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
  };

  return (
    <div className="relative">
      <div className="mb-6 flex items-end justify-between gap-4">
        <div>
          <h2 className="flex items-center gap-2 font-display text-3xl font-extrabold tracking-[-0.025em]">
            <Star size={24} className="text-[#e3a008]" fill="currentColor" strokeWidth={0} aria-hidden /> Staff picks
          </h2>
          <p className="mt-1 text-ink-3">Books our team keeps pressing into people’s hands.</p>
        </div>
        <div className="hidden gap-2 sm:flex">
          <button
            type="button"
            aria-label="Previous picks"
            onClick={() => scroll(-1)}
            className="grid size-10 place-items-center rounded-full border border-line hover:border-ink-3"
          >
            <ChevronLeft size={18} />
          </button>
          <button
            type="button"
            aria-label="Next picks"
            onClick={() => scroll(1)}
            className="grid size-10 place-items-center rounded-full border border-line hover:border-ink-3"
          >
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
      <ul ref={track} className="no-scrollbar -mx-4 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pb-2">
        {books.map((b) => (
          <li key={b.id} className="w-[290px] shrink-0 snap-start sm:w-[340px]">
            <Link
              href={`/books/${b.slug}`}
              className="flex h-full gap-4 rounded-[16px] border border-line bg-white p-4 transition-colors hover:border-ink-3"
            >
              <div className="w-[96px] shrink-0">
                <BookCover slug={b.slug} title={b.title} author={b.author} coverUrl={b.coverUrl} size="sm" />
              </div>
              <div className="flex min-w-0 flex-col">
                <p className="line-clamp-2 font-bold leading-snug">{b.title}</p>
                <p className="text-sm text-ink-3">{b.author}</p>
                <p className="mt-2 line-clamp-4 text-sm italic text-ink-2">“{b.staffPickNote}”</p>
                <p className="mt-auto pt-2 text-sm font-bold">from {formatUsd(b.fromPriceCents)}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
