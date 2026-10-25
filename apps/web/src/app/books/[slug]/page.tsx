import type { BookDetail, BookSummary, Page } from "@sofiya/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AddToBasket } from "@/components/AddToBasket";
import { BookGrid } from "@/components/BookCard";
import { BookCover } from "@/components/BookCover";
import { RecordView } from "@/components/RecentlyViewed";
import { ReviewsSection } from "@/components/ReviewsSection";
import { RatingLine } from "@/components/Stars";
import { Container, Tag } from "@/components/ui";
import { Star } from "lucide-react";
import { ApiError, apiGet } from "@/lib/api";
import { GENRE_LABELS, yearLabel } from "@/lib/labels";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

async function loadBook(slug: string): Promise<BookDetail> {
  try {
    return await apiGet<BookDetail>(`/books/${encodeURIComponent(slug)}`, { revalidate: 60 });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const book = await loadBook((await params).slug);
  return { title: book.title, description: book.description };
}

export default async function BookPage({ params }: { params: Params }) {
  const book = await loadBook((await params).slug);
  const [similar, related] = await Promise.all([
    apiGet<BookSummary[]>(`/books/${book.slug}/similar`, { revalidate: 300 }).catch(() => [] as BookSummary[]),
    apiGet<Page<BookSummary>>(`/books?genre=${book.genre}&sort=popular&limit=7`, { revalidate: 60 }),
  ]);
  const similarSlugs = new Set(similar.map((b) => b.slug));
  const more = related.items.filter((b) => b.slug !== book.slug && !similarSlugs.has(b.slug)).slice(0, 6);
  const year = yearLabel(book.publishedYear);

  return (
    <Container>
      <RecordView book={{ slug: book.slug, title: book.title, author: book.author, fromPriceCents: book.fromPriceCents }} />
      <nav aria-label="Breadcrumb" className="pt-6 text-sm text-ink-3">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        {" / "}
        <Link href={`/books?genre=${book.genre}`} className="hover:text-ink">
          {GENRE_LABELS[book.genre]}
        </Link>
        {" / "}
        <span className="text-ink-2">{book.title}</span>
      </nav>

      <div className="mt-6 grid gap-10 md:grid-cols-[minmax(0,360px)_1fr] lg:gap-16">
        <div className="mx-auto w-full max-w-[220px] sm:max-w-[300px] md:max-w-none">
          <BookCover slug={book.slug} title={book.title} author={book.author} size="lg" />
        </div>

        <div>
          <Link href={`/books?genre=${book.genre}`} className="text-sm font-semibold text-accent">
            {GENRE_LABELS[book.genre]}
          </Link>
          <h1 className="mt-1.5 text-balance font-display text-4xl font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-5xl">
            {book.title}
          </h1>
          <p className="mt-2 text-lg text-ink-2">
            by{" "}
            <Link
              href={`/authors/${book.authorSlug}`}
              className="font-semibold text-ink underline underline-offset-[3px] hover:text-accent"
            >
              {book.author}
            </Link>
          </p>
          <div className="mt-2">
            <RatingLine avg={book.ratingAvg} count={book.ratingCount} />
          </div>
          <div className="mt-4 flex flex-wrap gap-2">
            {book.pages && <Tag>{book.pages} pages</Tag>}
            {year && <Tag>First published {year}</Tag>}
            <Tag>{book.language}</Tag>
          </div>

          {book.staffPickNote && (
            <p className="mt-5 flex max-w-[540px] gap-2.5 rounded-[12px] bg-[#fff6db] px-4 py-3 text-[15px] text-[#7a5600]">
              <Star size={18} className="mt-0.5 shrink-0" fill="currentColor" strokeWidth={0} aria-hidden />
              <span>
                <b>Staff pick:</b> {book.staffPickNote}
              </span>
            </p>
          )}

          <AddToBasket book={book} />

          <section className="mt-10 max-w-[68ch]">
            <h2 className="font-display text-2xl font-extrabold">About this book</h2>
            <p className="mt-2 text-[17px] leading-relaxed text-ink-2">{book.description}</p>
          </section>
        </div>
      </div>

      {similar.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em]">If you like this</h2>
          <p className="mt-1 text-ink-3">Books with a similar story, mood or subject.</p>
          <div className="mt-6">
            <BookGrid books={similar} />
          </div>
        </section>
      )}

      <ReviewsSection slug={book.slug} />

      {more.length > 0 && (
        <section className="mt-20">
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em]">
            More in {GENRE_LABELS[book.genre]}
          </h2>
          <div className="mt-6">
            <BookGrid books={more} />
          </div>
        </section>
      )}
    </Container>
  );
}
