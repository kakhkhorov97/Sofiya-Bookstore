import { formatUsd, type BookSummary } from "@sofiya/shared";
import Link from "next/link";
import { BookCover } from "./BookCover";

export function BookCard({ book }: { book: BookSummary }) {
  return (
    <article className="group flex flex-col">
      <Link href={`/books/${book.slug}`} className="block rounded-[8px] focus-visible:outline-offset-4">
        <BookCover
          slug={book.slug}
          title={book.title}
          author={book.author}
          className="transition-transform duration-200 group-hover:-translate-y-1"
        />
        <h3 className="mt-3 line-clamp-2 text-[15px] font-bold leading-snug">{book.title}</h3>
      </Link>
      <p className="mt-0.5 line-clamp-1 text-sm text-ink-3">{book.author}</p>
      <p className="mt-auto pt-2 text-sm">
        <span className="text-ink-3">from </span>
        <span className="font-bold">{formatUsd(book.fromPriceCents)}</span>
        {!book.inStock && <span className="ml-2 text-xs font-semibold text-warn">Out of stock</span>}
      </p>
    </article>
  );
}

export function BookGrid({ books }: { books: BookSummary[] }) {
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-8 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
      {books.map((b) => (
        <BookCard key={b.id} book={b} />
      ))}
    </div>
  );
}
