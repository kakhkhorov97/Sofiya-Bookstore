"use client";

import { formatMoney, type Currency } from "@sofiya/shared";
import { Minus, Plus, ShoppingBag, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { MAX_PER_LINE } from "@/basket/basket";
import { useBasket } from "@/basket/BasketProvider";
import { useBasketInfo, type CheckedLine } from "@/basket/useBasketInfo";
import { isDigital } from "@/lib/labels";
import { BookCover } from "./BookCover";
import { OrderSummary } from "./OrderSummary";
import { ButtonLink, Notice } from "./ui";

export function BasketView() {
  const t = useTranslations("basket");
  const { lines, ready, dispatch } = useBasket();
  const { currency, checked, totals, error, hasProblems } = useBasketInfo(lines);

  if (!ready) return <div className="mt-8 h-40 animate-pulse rounded-[16px] bg-surface" aria-busy />;

  if (lines.length === 0) {
    return (
      <div className="mt-8 rounded-[16px] bg-surface px-6 py-14 text-center">
        <ShoppingBag size={32} className="mx-auto text-ink-3" aria-hidden />
        <h2 className="mt-3 font-display text-2xl font-extrabold">{t("empty")}</h2>
        <p className="mt-2 text-ink-2">{t("emptyText")}</p>
        <ButtonLink href="/books" className="mt-6">
          {t("browse")}
        </ButtonLink>
      </div>
    );
  }

  const changed = checked.some((l) => l.priceChanged);

  return (
    <div className="mt-8 grid items-start gap-10 lg:grid-cols-[1fr_360px]">
      <div className="space-y-4">
        {error && <Notice tone="bad">{error}</Notice>}
        {changed && <Notice tone="accent">{t("pricesChanged")}</Notice>}
        {hasProblems && <Notice>{t("problems")}</Notice>}
        <ul className="divide-y divide-line border-y border-line">
          {checked.map((l) => (
            <BasketRow currency={currency} key={l.formatId} line={l} dispatch={dispatch} />
          ))}
        </ul>
        <Link href="/books" className="inline-block font-semibold text-accent hover:text-accent-ink">
          {t("continue")}
        </Link>
      </div>

      <OrderSummary totals={totals}>
        {hasProblems ? (
          <span className="mt-5 block w-full rounded-[10px] bg-line py-3 text-center font-semibold text-ink-3">
            {t("removeUnavailable")}
          </span>
        ) : (
          <ButtonLink href="/checkout" className="mt-5 w-full">
            {t("toCheckout")}
          </ButtonLink>
        )}
      </OrderSummary>
    </div>
  );
}

function BasketRow({
  line,
  currency,
  dispatch,
}: {
  line: CheckedLine;
  currency: Currency;
  dispatch: ReturnType<typeof useBasket>["dispatch"];
}) {
  const t = useTranslations();
  const price = (line.info?.price ?? line.price)[currency];
  const digital = isDigital(line.format);
  return (
    <li className="flex gap-4 py-5">
      <Link href={`/books/${line.slug}`} className="w-[72px] shrink-0 sm:w-[84px]">
        <BookCover slug={line.slug} title={line.title} author={line.author} size="sm" />
      </Link>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex justify-between gap-4">
          <div className="min-w-0">
            <Link href={`/books/${line.slug}`} className="font-bold hover:text-accent">
              {line.title}
            </Link>
            <p className="text-sm text-ink-3">
              {line.author} · {t(`labels.format.${line.format}`)}
            </p>
          </div>
          <p className="shrink-0 font-bold">{formatMoney(price * line.quantity, currency)}</p>
        </div>
        {line.problem === "unavailable" && <p className="mt-1 text-sm font-semibold text-bad">{t("basket.unavailable")}</p>}
        {line.problem === "out_of_stock" && <p className="mt-1 text-sm font-semibold text-warn">{t("book.outOfStock")}</p>}
        {!line.problem && line.info?.lowStock && line.info.lowStock < line.quantity && (
          <p className="mt-1 text-sm font-semibold text-warn">{t("basket.onlyLeft", { count: line.info.lowStock })}</p>
        )}
        <div className="mt-auto flex items-center justify-between pt-3">
          {digital ? (
            <span className="text-sm text-ink-3">{t("basket.digital", { price: formatMoney(price, currency) })}</span>
          ) : (
            <div className="flex items-center rounded-[9px] border border-line" role="group" aria-label={t("basket.quantityOf", { title: line.title })}>
              <button
                type="button"
                aria-label={t("buy.fewer")}
                onClick={() => dispatch({ type: "setQuantity", formatId: line.formatId, quantity: line.quantity - 1 })}
                className="grid size-9 place-items-center"
              >
                <Minus size={15} />
              </button>
              <span className="w-7 text-center text-sm font-semibold">{line.quantity}</span>
              <button
                type="button"
                aria-label={t("buy.more")}
                disabled={line.quantity >= MAX_PER_LINE}
                onClick={() => dispatch({ type: "setQuantity", formatId: line.formatId, quantity: line.quantity + 1 })}
                className="grid size-9 place-items-center disabled:opacity-40"
              >
                <Plus size={15} />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={() => dispatch({ type: "remove", formatId: line.formatId })}
            className="flex items-center gap-1.5 text-sm font-medium text-ink-3 hover:text-bad"
          >
            <Trash2 size={15} aria-hidden /> {t("basket.remove")}
          </button>
        </div>
      </div>
    </li>
  );
}
