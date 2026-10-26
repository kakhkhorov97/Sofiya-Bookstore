import { formatUsd, type BookSummary } from "@sofiya/shared";
import Link from "next/link";
import { BookCover } from "./BookCover";
import { RatingLine } from "./Stars";
import { WishlistButton } from "./WishlistButton";

export function BookCard({ book }: { book: BookSummary }) {
  return (
    <article className="group flex flex-col">
      <div className="relative">
        <Link href={`/books/${book.slug}`} className="block rounded-[8px] focus-visible:outline-offset-4">
          <BookCover
            slug={book.slug}
            title={book.title}
            author={book.author}
            coverUrl={book.coverUrl}
            className="transition-transform duration-200 group-hover:-translate-y-1"
          />
        </Link>
        <div className="absolute right-2 top-2 opacity-100 transition-opacity sm:opacity-0 sm:group-focus-within:opacity-100 sm:group-hover:opacity-100">
          <WishlistButton bookId={book.id} title={book.title} />
        </div>
      </div>
      <Link href={`/books/${book.slug}`} className="hover:text-accent">
        <h3 className="mt-3 line-clamp-2 text-[15px] font-bold leading-snug">{book.title}</h3>
      </Link>
      <Link href={`/authors/${book.authorSlug}`} className="mt-0.5 line-clamp-1 text-sm text-ink-3 hover:text-ink">
        {book.author}
      </Link>
      <div className="mt-1 min-h-5">
        <RatingLine avg={book.ratingAvg} count={book.ratingCount} />
      </div>
      <p className="mt-auto pt-1.5 text-sm">
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
