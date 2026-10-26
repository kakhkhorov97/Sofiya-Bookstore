"use client";

import { Price } from "@/currency/CurrencyProvider";
import Link from "next/link";
import { useEffect, useState } from "react";
import { RECENT_CLEARED, RECENT_KEY, pushRecent, readRecent, type RecentBook } from "@/lib/recent";
import { BookCover } from "./BookCover";
import { Container } from "./ui";

// Rendered on a book page: remembers the visit.
export function RecordView({ book }: { book: RecentBook }) {
  useEffect(() => pushRecent(book), [book]);
  return null;
}

// Homepage row; hidden until the visitor has looked at a book.
export function RecentlyViewed() {
  const [books, setBooks] = useState<RecentBook[]>([]);
  useEffect(() => {
    const load = () => setBooks(readRecent().slice(0, 6));
    load();
    // Signing out clears the list, here or in another tab.
    const onStorage = (e: StorageEvent) => {
      if (e.key === RECENT_KEY || e.key === null) load();
    };
    window.addEventListener(RECENT_CLEARED, load);
    window.addEventListener("storage", onStorage);
    return () => {
      window.removeEventListener(RECENT_CLEARED, load);
      window.removeEventListener("storage", onStorage);
    };
  }, []);
  if (books.length === 0) return null;

  return (
    <section className="mt-16" aria-labelledby="recent-title">
      <Container>
        <h2 id="recent-title" className="mb-6 font-display text-3xl font-extrabold tracking-[-0.025em]">
          Recently viewed
        </h2>
        <ul className="grid grid-cols-3 gap-4 sm:grid-cols-4 lg:grid-cols-6">
          {books.map((b) => (
            <li key={b.slug}>
              <Link href={`/books/${b.slug}`} className="group block">
                <BookCover slug={b.slug} title={b.title} author={b.author} coverUrl={b.coverUrl} size="sm" className="transition-transform group-hover:-translate-y-1" />
                <p className="mt-2 line-clamp-1 text-sm font-semibold">{b.title}</p>
                {b.fromPrice && (
                  <p className="text-xs text-ink-3">
                    <Price prices={b.fromPrice} prefix="from " />
                  </p>
                )}
              </Link>
            </li>
          ))}
        </ul>
      </Container>
    </section>
  );
}
