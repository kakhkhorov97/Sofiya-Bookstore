import { GENRES, type BookSummary, type GenreCount, type Page } from "@sofiya/shared";
import { ArrowRight, BookOpen, Clock3, Headphones, Search, Smartphone, Sparkles, Star, Truck } from "lucide-react";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { BookGrid } from "@/components/BookCard";
import { BookCover } from "@/components/BookCover";
import { NewsletterForm } from "@/components/NewsletterForm";
import { RecentlyViewed } from "@/components/RecentlyViewed";
import { StaffPicks } from "@/components/StaffPicks";
import { Chip, Container } from "@/components/ui";
import { FreeDeliveryNote } from "@/currency/CurrencySwitcher";
import { apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

// Keyword searches against the English catalogue, so they stay in English.
const TRY = ["Sherlock Holmes", "Jane Austen", "ghost stories", "Python"];
const ASK_EXAMPLES = ["e1", "e2", "e3", "e4"] as const;
const FORMATS = [
  { f: "HARDCOVER", Icon: BookOpen },
  { f: "PAPERBACK", Icon: BookOpen },
  { f: "EBOOK", Icon: Smartphone },
  { f: "AUDIOBOOK", Icon: Headphones },
] as const;

export default async function HomePage() {
  const t = await getTranslations();
  const [popular, mystery, programming, genres, picks] = await Promise.all([
    apiGet<Page<BookSummary>>("/books?sort=popular&limit=12", { revalidate: 60 }),
    apiGet<Page<BookSummary>>("/books?genre=MYSTERY&sort=popular&limit=6", { revalidate: 60 }),
    apiGet<Page<BookSummary>>("/books?genre=PROGRAMMING&sort=popular&limit=6", { revalidate: 60 }),
    apiGet<GenreCount[]>("/genres", { revalidate: 60 }),
    apiGet<Page<BookSummary>>("/books?staffPicks=true&limit=12", { revalidate: 300 }),
  ]);
  const total = genres.reduce((n, g) => n + g.count, 0);
  const fan = popular.items.slice(0, 5);

  return (
    <>
      <section className="py-10 sm:py-14">
        <Container className="grid items-center gap-12 lg:grid-cols-[1fr_1.05fr]">
          <div>
            <h1 className="max-w-[13ch] text-balance font-display text-[42px] font-extrabold leading-[1.02] tracking-[-0.035em] sm:text-6xl">
              {t("home.title")}
            </h1>
            <p className="mt-5 max-w-[46ch] text-lg text-ink-2">
              {t("home.intro", { total, genres: genres.length })}
            </p>
            <form action="/books" role="search" className="mt-8 flex gap-2 rounded-[14px] border-[1.5px] border-ink bg-white p-2 shadow-[0_8px_24px_rgba(21,23,28,0.06)] transition-shadow focus-within:shadow-[0_10px_30px_rgba(21,23,28,0.12)]">
              <label className="flex flex-1 items-center gap-2.5 pl-2.5 text-ink-3">
                <Search size={20} aria-hidden />
                <span className="sr-only">{t("home.searchLabel")}</span>
                <input
                  name="q"
                  type="search"
                  placeholder={t("home.searchPlaceholder")}
                  className="min-w-0 flex-1 text-[17px] text-ink outline-none placeholder:text-ink-3"
                />
              </label>
              <button type="submit" className="h-[46px] rounded-[10px] bg-ink px-5 font-semibold text-white hover:bg-black">
                {t("home.search")}
              </button>
              {/* Same box, handed to the AI concierge instead of keyword search. */}
              <button
                type="submit"
                formAction="/ask"
                className="hidden h-[46px] items-center gap-1.5 rounded-[10px] bg-accent px-4 font-semibold text-white hover:bg-accent-ink sm:inline-flex"
              >
                <Sparkles size={17} aria-hidden /> {t("home.askAi")}
              </button>
            </form>
            <Link
              href="/ask"
              className="group mt-3 flex items-center gap-3 rounded-[14px] bg-accent-soft px-4 py-3 text-accent-ink hover:bg-[#e2e0fa]"
            >
              <span className="grid size-9 shrink-0 place-items-center rounded-full bg-accent text-white">
                <Sparkles size={18} aria-hidden />
              </span>
              <span className="min-w-0 flex-1 text-[15px]">
                <strong className="font-semibold">{t("home.notSure")}</strong>{" "}
                <span className="text-ink-2">{t("home.notSureText")}</span>
              </span>
              <ArrowRight size={18} className="shrink-0 transition-transform group-hover:translate-x-0.5" aria-hidden />
            </Link>
            <p className="mt-4 flex flex-wrap items-center gap-2 text-sm text-ink-3">
              {t("home.try")}
              {TRY.map((q) => (
                <Chip key={q} href={`/books?q=${encodeURIComponent(q)}`}>
                  {q}
                </Chip>
              ))}
            </p>
          </div>

          <div className="relative hidden h-[420px] overflow-hidden rounded-[20px] bg-surface lg:block" aria-hidden>
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
                <BookCover slug={b.slug} title={b.title} author={b.author} coverUrl={b.coverUrl} />
              </div>
            ))}
            <p className="absolute bottom-5 left-6 text-sm font-medium text-ink-3">{t("home.mostViewed")}</p>
          </div>
        </Container>
      </section>

      <nav aria-label={t("home.genresNav")}>
        <Container className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          <Chip href="/books" active>
            {t("common.allBooks")}
          </Chip>
          {GENRES.map((g) => (
            <Chip key={g} href={`/books?genre=${g}`}>
              {t(`labels.genre.${g}`)}
            </Chip>
          ))}
        </Container>
      </nav>

      <RecentlyViewed />

      <Shelf title={t("home.popular")} seeAll={t("home.seeAll")} href="/books?sort=popular" books={popular.items.slice(0, 6)} />

      {picks.items.length > 0 && (
        <section className="mt-16">
          <Container>
            <StaffPicks books={picks.items} />
          </Container>
        </section>
      )}

      <section className="mt-16">
        <Container>
          <div className="grid items-center gap-8 rounded-[20px] bg-accent-soft p-7 sm:p-10 lg:grid-cols-[1.1fr_1fr]">
            <div>
              <p className="inline-flex items-center gap-2 font-semibold text-accent-ink">
                <Sparkles size={18} aria-hidden /> {t("common.askSofiya")}
              </p>
              <h2 className="mt-2 font-display text-3xl font-extrabold tracking-[-0.025em] sm:text-4xl">
                {t("home.askTitle")}
              </h2>
              <p className="mt-3 max-w-[48ch] text-ink-2">
                {t("home.askText")}
              </p>
              <Link
                href="/ask"
                className="mt-6 inline-flex h-[46px] items-center gap-2 rounded-[10px] bg-accent px-5 font-semibold text-white hover:bg-accent-ink"
              >
                {t("home.askStart")} <ArrowRight size={18} aria-hidden />
              </Link>
            </div>
            <ul className="space-y-2.5">
              {ASK_EXAMPLES.map((key) => t(`home.askExamples.${key}`)).map((q) => (
                <li key={q}>
                  <Link
                    href={`/ask?q=${encodeURIComponent(q)}`}
                    className="flex items-center justify-between gap-3 rounded-[12px] bg-white px-4 py-3 font-medium shadow-[0_1px_2px_rgba(21,23,28,0.06)] hover:text-accent"
                  >
                    “{q}” <ArrowRight size={16} className="shrink-0 text-ink-3" aria-hidden />
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </Container>
      </section>
      <Shelf title={t("home.mysteries")} seeAll={t("home.seeAll")} href="/books?genre=MYSTERY" books={mystery.items} />
      <Shelf title={t("home.programmers")} seeAll={t("home.seeAll")} href="/books?genre=PROGRAMMING" books={programming.items} />

      <section className="mt-20">
        <Container>
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em]">{t("home.byFormat")}</h2>
          <div className="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
            {FORMATS.map(({ f, Icon }) => (
              <Link
                key={f}
                href={`/books?format=${f}`}
                className="flex items-center gap-4 rounded-[12px] border border-line p-5 hover:border-ink-3"
              >
                <span className="grid size-11 place-items-center rounded-[10px] bg-surface">
                  <Icon size={20} aria-hidden />
                </span>
                <span>
                  <span className="block font-bold">{t(`labels.format.${f}`)}</span>
                  <span className="text-sm text-ink-3">{t(`home.formatSub.${f}`)}</span>
                </span>
              </Link>
            ))}
          </div>
        </Container>
      </section>

      <section className="mt-20">
        <Container>
          <NewsletterForm />
        </Container>
      </section>

      <section className="mt-16">
        <Container className="flex flex-col gap-3 border-y border-line py-5 font-medium text-ink-2 sm:flex-row sm:justify-center sm:gap-12">
          <span className="inline-flex items-center gap-2">
            <Truck size={18} aria-hidden /> <FreeDeliveryNote />
          </span>
          <span className="inline-flex items-center gap-2">
            <Clock3 size={18} aria-hidden /> {t("home.trackOrders")}
          </span>
          <span className="inline-flex items-center gap-2">
            <Star size={18} aria-hidden /> {t("home.earnPoints")}
          </span>
        </Container>
      </section>
    </>
  );
}

function Shelf({ title, seeAll, href, books }: { title: string; seeAll: string; href: string; books: BookSummary[] }) {
  return (
    <section className="mt-16">
      <Container>
        <div className="mb-6 flex items-end justify-between gap-4">
          <h2 className="font-display text-3xl font-extrabold tracking-[-0.025em]">{title}</h2>
          <Link href={href} className="inline-flex items-center gap-1 font-semibold text-accent hover:text-accent-ink">
            {seeAll} <ArrowRight size={16} aria-hidden />
          </Link>
        </div>
        <BookGrid books={books} />
      </Container>
    </section>
  );
}
