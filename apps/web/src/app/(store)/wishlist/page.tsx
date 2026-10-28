import type { BookSummary } from "@sofiya/shared";
import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { BookGrid } from "@/components/BookCard";
import { ButtonLink, Container, PageTitle } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("wishlistPage"))("title") };
}
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  await requireUser("/wishlist");
  const t = await getTranslations("wishlistPage");
  const books = await apiGet<BookSummary[]>("/wishlist", { auth: true });

  return (
    <Container>
      <PageTitle sub={books.length ? t("saved", { count: books.length }) : undefined}>
        {t("heading")}
      </PageTitle>
      {books.length === 0 ? (
        <div className="mt-8 rounded-[16px] bg-surface px-6 py-14 text-center">
          <Heart size={32} className="mx-auto text-ink-3" aria-hidden />
          <h2 className="mt-3 font-display text-2xl font-extrabold">{t("empty")}</h2>
          <p className="mt-2 text-ink-2">{t("emptyText")}</p>
          <ButtonLink href="/books" className="mt-6">
            {t("browse")}
          </ButtonLink>
        </div>
      ) : (
        <div className="mt-8">
          <BookGrid books={books} />
        </div>
      )}
    </Container>
  );
}
