import type { AuthorPage } from "@sofiya/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { notFound } from "next/navigation";
import { BookGrid } from "@/components/BookCard";
import { Container } from "@/components/ui";
import { ApiError, apiGet } from "@/lib/api";

export const dynamic = "force-dynamic";

type Params = Promise<{ slug: string }>;

async function loadAuthor(slug: string): Promise<AuthorPage> {
  try {
    return await apiGet<AuthorPage>(`/authors/${encodeURIComponent(slug)}`, { revalidate: 60 });
  } catch (err) {
    if (err instanceof ApiError && (err.status === 404 || err.status === 400)) notFound();
    throw err;
  }
}

export async function generateMetadata({ params }: { params: Params }): Promise<Metadata> {
  const author = await loadAuthor((await params).slug);
  const t = await getTranslations("author");
  return { title: author.name, description: t("metaDescription", { name: author.name }) };
}

export default async function AuthorPageView({ params }: { params: Params }) {
  const author = await loadAuthor((await params).slug);
  const t = await getTranslations();
  const yearLabel = (y: number) => (y < 0 ? t("labels.yearBC", { year: -y }) : String(y));
  const genres = [...new Set(author.books.map((b) => b.genre))];
  const years = author.books.map((b) => b.publishedYear).filter((y): y is number => y !== null);
  const span =
    years.length > 1
      ? `${yearLabel(Math.min(...years))} – ${yearLabel(Math.max(...years))}`
      : years.length === 1
        ? yearLabel(years[0])
        : null;
  const initials = author.name
    .replace(/\(.*?\)/g, "")
    .split(/\s+/)
    .filter((w) => /^[A-Z]/.test(w) && w !== "and")
    .slice(0, 2)
    .map((w) => w[0])
    .join("");

  return (
    <Container>
      <nav aria-label={t("bookPage.breadcrumb")} className="pt-6 text-sm text-ink-3">
        <Link href="/" className="hover:text-ink">
          {t("bookPage.home")}
        </Link>
        {" / "}
        <Link href="/books" className="hover:text-ink">
          {t("author.books")}
        </Link>
        {" / "}
        <span className="text-ink-2">{author.name}</span>
      </nav>

      <header className="mt-6 flex flex-wrap items-center gap-6 rounded-[20px] bg-surface p-6 sm:p-8">
        <span
          aria-hidden
          className="grid size-20 place-items-center rounded-full bg-accent font-display text-3xl font-extrabold text-white"
        >
          {initials}
        </span>
        <div>
          <h1 className="font-display text-4xl font-extrabold tracking-[-0.03em] sm:text-5xl">{author.name}</h1>
          <p className="mt-2 text-ink-2">
            {t("author.count", { count: author.books.length })}
            {span ? ` · ${t("author.published", { span })}` : ""}
            {" · "}
            {genres.map((g) => t(`labels.genre.${g}`)).join(", ")}
          </p>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="sr-only">{t("author.books")}</h2>
        <BookGrid books={author.books} />
      </section>
    </Container>
  );
}
