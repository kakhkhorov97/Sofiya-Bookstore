"use client";

import { ReviewInput, type ReviewsResponse } from "@sofiya/shared";
import { Star } from "lucide-react";
import Link from "next/link";
import { useFormatter, useTranslations } from "next-intl";
import { usePathname } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { clientApi } from "@/lib/client-api";
import { Stars } from "./Stars";
import { buttonClass, Notice } from "./ui";

export function ReviewsSection({ slug }: { slug: string }) {
  const t = useTranslations("reviews");
  const format = useFormatter();
  const [data, setData] = useState<ReviewsResponse | null>(null);
  const [failed, setFailed] = useState(false);

  const load = useCallback(() => {
    clientApi<ReviewsResponse>(`/books/${slug}/reviews`)
      .then((d) => {
        setData(d);
        setFailed(false);
      })
      .catch(() => setFailed(true));
  }, [slug]);

  useEffect(load, [load]);

  return (
    <section className="mt-20" aria-labelledby="reviews-title">
      <h2 id="reviews-title" className="font-display text-3xl font-extrabold tracking-[-0.025em]">
        {t("title")}
      </h2>
      {failed && (
        <div className="mt-4">
          <Notice tone="bad">{t("loadFailed")}</Notice>
        </div>
      )}
      {!data && !failed && <div className="mt-6 h-32 animate-pulse rounded-[16px] bg-surface" aria-busy />}
      {data && (
        <div className="mt-6 grid gap-10 lg:grid-cols-[300px_1fr]">
          <Summary data={data} />
          <div className="space-y-8">
            <Composer slug={slug} data={data} onSaved={load} />
            {data.items.length === 0 ? (
              <p className="text-ink-2">{t("none")}</p>
            ) : (
              <ul className="divide-y divide-line border-y border-line">
                {data.items.map((r) => (
                  <li key={r.id} className="py-5">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <Stars value={r.rating} />
                      {r.title && <p className="font-bold">{r.title}</p>}
                    </div>
                    <p className="mt-2 max-w-[70ch] leading-relaxed text-ink-2">{r.body}</p>
                    <p className="mt-2 text-sm text-ink-3">
                      {r.reviewerName} · {format.dateTime(new Date(r.createdAt), { dateStyle: "medium" })} · {t("verified")}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}
    </section>
  );
}

function Summary({ data }: { data: ReviewsResponse }) {
  const t = useTranslations("reviews");
  const { average, count, distribution } = data.summary;
  return (
    <div className="h-fit rounded-[16px] bg-surface p-6">
      {average ? (
        <>
          <p className="font-display text-5xl font-extrabold">{average.toFixed(1)}</p>
          <Stars value={average} size={18} className="mt-2" />
          <p className="mt-1 text-sm text-ink-3">{t("count", { count })}</p>
        </>
      ) : (
        <p className="font-semibold">{t("noRatings")}</p>
      )}
      <ul className="mt-5 space-y-1.5">
        {[5, 4, 3, 2, 1].map((stars) => {
          const n = distribution[stars - 1];
          return (
            <li key={stars} className="flex items-center gap-2 text-sm">
              <span className="w-3 text-ink-3">{stars}</span>
              <Star size={12} className="text-[#e3a008]" fill="currentColor" strokeWidth={0} aria-hidden />
              <span className="h-2 flex-1 overflow-hidden rounded-full bg-line">
                <span className="block h-full rounded-full bg-[#e3a008]" style={{ width: count ? `${(n / count) * 100}%` : 0 }} />
              </span>
              <span className="w-6 text-right text-ink-3">{n}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function Composer({ slug, data, onSaved }: { slug: string; data: ReviewsResponse; onSaved: () => void }) {
  const t = useTranslations("reviews");
  const pathname = usePathname();
  const mine = data.viewer.myReview;
  const [editing, setEditing] = useState(false);
  const [rating, setRating] = useState(mine?.rating ?? 0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (data.viewer.reason === "SIGN_IN") {
    return (
      <p className="text-[15px] text-ink-2">
        {t.rich("signInToReview", {
          link: (c) => (
            <Link href={`/signin?next=${encodeURIComponent(pathname)}`} className="font-semibold text-accent underline underline-offset-2">
              {c}
            </Link>
          ),
        })}
      </p>
    );
  }
  if (!data.viewer.canReview) {
    return <p className="text-[15px] text-ink-2">{t("afterConfirmed")}</p>;
  }
  if (mine && !editing) {
    return (
      <div className="flex flex-wrap items-center gap-3 rounded-[12px] bg-accent-soft px-4 py-3 text-[15px] text-accent-ink">
        {t("thanks")}
        <button type="button" onClick={() => setEditing(true)} className="font-semibold underline underline-offset-2">
          {t("editIt")}
        </button>
        <button
          type="button"
          onClick={async () => {
            await clientApi(`/books/${slug}/reviews`, { method: "DELETE" }).catch(() => undefined);
            onSaved();
          }}
          className="font-semibold underline underline-offset-2"
        >
          {t("deleteIt")}
        </button>
      </div>
    );
  }

  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = new FormData(e.currentTarget);
    const parsed = ReviewInput.safeParse({ rating, title: form.get("title"), body: form.get("body") });
    if (!parsed.success) {
      setError(rating === 0 ? t("chooseRating") : t("tooShort"));
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await clientApi(`/books/${slug}/reviews`, { method: "PUT", body: parsed.data });
      setEditing(false);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4 rounded-[16px] border border-line p-5">
      <p className="font-semibold">{mine ? t("edit") : t("write")}</p>
      <fieldset>
        <legend className="mb-1 text-sm text-ink-3">{t("yourRating")}</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              aria-label={t("stars", { n })}
              aria-pressed={rating === n}
              onClick={() => setRating(n)}
              className="rounded p-0.5"
            >
              <Star size={26} className={n <= rating ? "text-[#e3a008]" : "text-line"} fill="currentColor" strokeWidth={0} />
            </button>
          ))}
        </div>
      </fieldset>
      <label className="block text-sm font-semibold">
        {t("reviewTitle")} <span className="font-normal text-ink-3">{t("optional")}</span>
        <input
          name="title"
          maxLength={120}
          defaultValue={mine?.title ?? ""}
          className="mt-1.5 block h-11 w-full rounded-[10px] border border-line px-3 text-base outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
        />
      </label>
      <label className="block text-sm font-semibold">
        {t("yourReview")}
        <textarea
          name="body"
          required
          minLength={10}
          maxLength={2000}
          rows={4}
          defaultValue={mine?.body ?? ""}
          className="mt-1.5 block w-full rounded-[10px] border border-line px-3 py-2.5 text-base outline-none focus:border-accent focus:ring-[3px] focus:ring-accent-soft"
        />
      </label>
      {error && <Notice tone="bad">{error}</Notice>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className={buttonClass.primary}>
          {busy ? t("saving") : t("post")}
        </button>
        {mine && (
          <button type="button" onClick={() => setEditing(false)} className={buttonClass.outline}>
            {t("cancel")}
          </button>
        )}
      </div>
    </form>
  );
}
