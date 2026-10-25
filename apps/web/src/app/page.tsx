import { GENRES, type BookSummary, type GenreCount, type Page } from "@sofiya/shared";
import { ArrowRight, BookOpen, Clock3, Headphones, Search, Smartphone, Star, Truck } from "lucide-react";
import Link from "next/link";
import { BookGrid } from "@/components/BookCard";
import { BookCover } from "@/components/BookCover";
import { Chip, Container } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { GENRE_LABELS } from "@/lib/labels";

export const dynamic = "force-dynamic";

const TRY = ["Sherlock Holmes", "Jane Austen", "ghost stories", "Python"];

export default async function HomePage() {
  const [popular, mystery, programming, genres] = await Promise.all([
    apiGet<Page<BookSummary>>("/books?sort=popular&limit=12", { revalidate: 60 }),
    apiGet<Page<BookSummary>>("/books?genre=MYSTERY&sort=popular&limit=6", { revalidate: 60 }),
    apiGet<Page<BookSummary>>("/books?genre=PROGRAMMING&sort=popular&limit=6", { revalidate: 60 }),
    apiGet<GenreCount[]>("/genres", { revalidate: 60 }),
  ]);
  const total = genres.reduce((n, g) => n + g.count, 0);
  const fan = popular.items.slice(0, 5);

  return (
    <>
      <section className="py-10 sm:py-14">
        <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h1 className="max-w-[13ch] text-balance font-display text-[42px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl">
              Your next favourite book is already here.
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg text-ink-2">
              {total} books across {genres.length} genres, from Austen and Dostoevsky to the classics of programming.
              In hardcover, paperback, ebook and audio.
            </p>
            <form action="/books" role="search" className="mt-8 flex gap-2 rounded-[14px] border-[1.5px] border-ink bg-white p-2 shadow-[0_8px_24px_rgba(21,23,28,0.06)]">
              <label className="flex flex-1 items-center gap-2.5 pl-2.5 text-ink-3">
                <Search size={20} aria-hidden />
                <span className="sr-only">Search by title, author or topic</span>
                <input
                  name="q"
                  type="search"
                  placeholder="Title, author or topic"
                  className="min-w-0 flex-1 text-[17px] text-ink outline-none placeholder:text-ink-3"
                />
              </label>
              <button type="submit" className="h-[46px] rounded-[10px] bg-accent px-5 font-semibold text-white hover:bg-accent-ink">
                Search
              </button>
            </form>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-3">
              Try:
              {TRY.map((q) => (
                <Chip key={q} href={`/books?q=${encodeURIComponent(q)}`}>
                  {q}
                </Chip>
              ))}
            </p>
          </div>

          <div className="relative hidden h-[420px] rounded-[20px] bg-surface lg:block" aria-hidden>
            {fan.map((b, i) => (
              <div
                key={b.id}
                className="absolute top-1/2 w-[150px] transition-transform"
                style={{
                  left: `${8 + i * 17}%`,
                  transform: `translateY(-50%) rotate(${(i - 2) * 5}deg) translateY(${Math.abs(i - 2) * 14}px)`,
                  zIndex: 5 - Math.abs(i - 2),
                }}
              >
                <BookCover slug={b.slug} title={b.title} author={b.author} />
              </div>
            ))}
            <p className="absolute bottom-5 left-6 text-sm font-medium text-ink-3">Most viewed this week</p>
          </div>
        </Container>
      </section>

      <nav aria-label="Genres">
        <Container className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <Chip href="/books" active>
            All books
          </Chip>
          {GENRES.map((g) => (
            <Chip key={g} href={`/books?genre=${g}`}>
              {GENRE_LABELS[g]}
            </Chip>
          ))}
        </Container>
      </nav>

      <Shelf title="Popular right now" href="/books?sort=popular" books={popular.items.slice(0, 6)} />
      <Shelf title="Mysteries" href="/books?genre=MYSTERY" books={mystery.items} />
      <Shelf title="For programmers" href="/books?genre=PROGRAMMING" books={programming.items} />

      <section className="mt-20">
        <Container>
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em]">Shop by format</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {[
              { f: "HARDCOVER", label: "Hardcover", sub: "Built to keep", Icon: BookOpen },
              { f: "PAPERBACK", label: "Paperback", sub: "Light and easy", Icon: BookOpen },
              { f: "EBOOK", label: "Ebook", sub: "Read instantly", Icon: Smartphone },
              { f: "AUDIOBOOK", label: "Audiobook", sub: "Listen anywhere", Icon: Headphones },
            ].map(({ f, label, sub, Icon }) => (
              <Link
                key={f}
                href={`/books?format=${f}`}
                className="flex items-center gap-4 rounded-[12px] border border-line p-5 hover:border-ink-3"
              >
                <span className="grid size-11 place-items-center rounded-[10px] bg-surface">
                  <Icon size={20} aria-hidden />
                </span>
                <span>
                  <span className="block font-bold">{label}</span>
                  <span className="text-sm text-ink-3">{sub}</span>
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="mt-20">
        <Container className="flex flex-col gap-3 border-y border-line py-5 font-medium text-ink-2 sm:flex-row sm:justify-center sm:gap-12">
          <span className="inline-flex items-center gap-2">
            <Truck size={18} aria-hidden /> Free delivery on orders over $100
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 size={18} aria-hidden /> Track every order from your account
          </span>
          <span className="inline-flex items-center gap-2">
            <Star size={18} aria-hidden /> Earn a point with every order
          </span>
        </Container>
      </section>
    </>
  );
}

function Shelf({ title, href, books }: { title: string; href: string; books: BookSummary[] }) {
  return (
    <section className="mt-16">
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em]">{title}</h2>
          <Link href={href} className="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent-ink">
            See all <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <BookGrid books={books} />
      </Container>
    </section>
  );
}
