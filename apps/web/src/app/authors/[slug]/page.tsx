import type { AuthorPage } from "@sofiya/shared";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BookGrid } from "@/components/BookCard";
import { Container } from "@/components/ui";
import { ApiError, apiGet } from "@/lib/api";
import { GENRE_LABELS, yearLabel } from "@/lib/labels";

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
  return { title: author.name, description: `Books by ${author.name} at Sofiya.` };
}

export default async function AuthorPageView({ params }: { params: Params }) {
  const author = await loadAuthor((await params).slug);
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
      <nav aria-label="Breadcrumb" className="pt-6 text-sm text-ink-3">
        <Link href="/" className="hover:text-ink">
          Home
        </Link>
        {" / "}
        <Link href="/books" className="hover:text-ink">
          Books
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
            {author.books.length} {author.books.length === 1 ? "book" : "books"} at Sofiya
            {span ? ` · published ${span}` : ""}
            {" · "}
            {genres.map((g) => GENRE_LABELS[g]).join(", ")}
          </p>
        </div>
      </header>

      <section className="mt-10">
        <h2 className="sr-only">Books</h2>
        <BookGrid books={author.books} />
      </section>
    </Container>
  );
}
