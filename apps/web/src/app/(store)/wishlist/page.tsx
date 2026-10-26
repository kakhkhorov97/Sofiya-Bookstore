import type { BookSummary } from "@sofiya/shared";
import { Heart } from "lucide-react";
import type { Metadata } from "next";
import { BookGrid } from "@/components/BookCard";
import { ButtonLink, Container, PageTitle } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";

export const metadata: Metadata = { title: "Wishlist" };
export const dynamic = "force-dynamic";

export default async function WishlistPage() {
  await requireUser("/wishlist");
  const books = await apiGet<BookSummary[]>("/wishlist", { auth: true });

  return (
    <Container>
      <PageTitle sub={books.length ? `${books.length} saved ${books.length === 1 ? "book" : "books"}` : undefined}>
        Your wishlist
      </PageTitle>
      {books.length === 0 ? (
        <div className="mt-8 rounded-[16px] bg-surface px-6 py-14 text-center">
          <Heart size={32} className="mx-auto text-ink-3" aria-hidden />
          <h2 className="mt-3 font-display text-2xl font-extrabold">Nothing saved yet</h2>
          <p className="mt-2 text-ink-2">Tap the heart on any book to keep it here for later.</p>
          <ButtonLink href="/books" className="mt-6">
            Browse books
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
