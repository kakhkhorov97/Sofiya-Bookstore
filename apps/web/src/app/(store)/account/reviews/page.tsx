import type { MyReviewsResponse } from "@sofiya/shared";
import { PenLine } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { BookCover } from "@/components/BookCover";
import { Stars } from "@/components/Stars";
import { ButtonLink, Container, PageTitle } from "@/components/ui";
import { apiGet } from "@/lib/api";
import { requireUser } from "@/lib/session";

export async function generateMetadata(): Promise<Metadata> {
  return { title: (await getTranslations("myReviews"))("title") };
}
export const dynamic = "force-dynamic";

export default async function MyReviewsPage() {
  await requireUser("/account/reviews");
  const [t, format] = await Promise.all([getTranslations(), getFormatter()]);
  const date = (iso: string) => format.dateTime(new Date(iso), { dateStyle: "medium" });
  const { reviews, toReview } = await apiGet<MyReviewsResponse>("/me/reviews", { auth: true });

  return (
    <Container className="max-w-[860px] pb-16">
      <nav aria-label={t("bookPage.breadcrumb")} className="pt-6 text-sm text-ink-3">
        <Link href="/account" className="hover:text-ink">
          {t("footer.yourAccount")}
        </Link>
        {" / "}
        <span className="text-ink-2">{t("myReviews.title")}</span>
      </nav>
      <PageTitle sub={t("myReviews.written", { count: reviews.length })}>{t("myReviews.title")}</PageTitle>

      {toReview.length > 0 && (
        <section className="mt-8 rounded-[16px] bg-accent-soft p-5 sm:p-6" aria-labelledby="to-review">
          <h2 id="to-review" className="flex items-center gap-2 font-display text-xl font-extrabold text-accent-ink">
            <PenLine size={19} aria-hidden /> {t("myReviews.waiting")}
          </h2>
          <p className="mt-1 text-sm text-ink-2">{t("myReviews.waitingText")}</p>
          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {toReview.map((b) => (
              <li key={b.slug}>
                <Link href={`/books/${b.slug}#reviews-title`} className="group block rounded-[12px] bg-white p-3 hover:shadow-md">
                  <BookCover slug={b.slug} title={b.title} author={b.author} coverUrl={b.coverUrl} size="sm" />
                  <p className="mt-2 line-clamp-1 text-sm font-semibold">{b.title}</p>
                  <p className="text-xs font-semibold text-accent group-hover:text-accent-ink">{t("myReviews.write")}</p>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      {reviews.length === 0 ? (
        <div className="mt-8 rounded-[16px] bg-surface px-6 py-12 text-center">
          <p className="font-display text-2xl font-extrabold">{t("myReviews.none")}</p>
          <p className="mx-auto mt-2 max-w-[44ch] text-ink-2">
            {t("myReviews.noneText")}
          </p>
          <ButtonLink href="/orders" variant="outline" className="mt-5">
            {t("myReviews.seeOrders")}
          </ButtonLink>
        </div>
      ) : (
        <ul className="mt-8 divide-y divide-line border-y border-line">
          {reviews.map(({ book, review }) => (
            <li key={review.id} className="flex gap-4 py-5">
              <Link href={`/books/${book.slug}`} className="w-[72px] shrink-0">
                <BookCover slug={book.slug} title={book.title} author={book.author} coverUrl={book.coverUrl} size="sm" />
              </Link>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-4">
                  <Link href={`/books/${book.slug}`} className="font-bold hover:text-accent">
                    {book.title}
                  </Link>
                  <span className="text-xs text-ink-3">
                    {review.updatedAt !== review.createdAt
                      ? t("myReviews.edited", { date: date(review.updatedAt) })
                      : date(review.updatedAt)}
                  </span>
                </div>
                <p className="text-sm text-ink-3">{book.author}</p>
                <Stars value={review.rating} className="mt-2" />
                {review.title && <p className="mt-2 font-semibold">{review.title}</p>}
                <p className="mt-1 whitespace-pre-line text-[15px] text-ink-2">{review.body}</p>
                <Link
                  href={`/books/${book.slug}#reviews-title`}
                  className="mt-2 inline-block text-sm font-semibold text-accent hover:text-accent-ink"
                >
                  {t("myReviews.editOrDelete")}
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}
    </Container>
  );
}
