"use client";

import type { BookDetail } from "@sofiya/shared";
import { Check, Minus, Plus, Truck } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { MAX_PER_LINE } from "@/basket/basket";
import { useBasket } from "@/basket/BasketProvider";
import { Price } from "@/currency/CurrencyProvider";
import { FreeDeliveryNote } from "@/currency/CurrencySwitcher";
import { FORMAT_LABELS, isDigital } from "@/lib/labels";
import { buttonClass } from "./ui";
import { WishlistButton } from "./WishlistButton";

export function AddToBasket({ book }: { book: BookDetail }) {
  const { dispatch } = useBasket();
  const firstAvailable = book.formats.find((f) => f.inStock) ?? book.formats[0];
  const [formatId, setFormatId] = useState(firstAvailable?.id);
  const [quantity, setQuantity] = useState(1);
  const [added, setAdded] = useState(false);
  const selected = book.formats.find((f) => f.id === formatId);

  if (!selected) return null;
  const digital = isDigital(selected.format);

  function add() {
    if (!selected) return;
    dispatch({
      type: "add",
      quantity,
      line: {
        formatId: selected.id,
        slug: book.slug,
        title: book.title,
        author: book.author,
        format: selected.format,
        price: selected.price,
      },
    });
    setAdded(true);
  }

  return (
    <div className="mt-7 max-w-[540px]">
      <p className="font-display text-4xl font-extrabold tracking-[-0.02em]">
        <Price prices={selected.price} />
        <span className="ml-2 font-sans text-base font-medium text-ink-3">{FORMAT_LABELS[selected.format]}</span>
      </p>

      <fieldset className="mt-4">
        <legend className="sr-only">Choose a format</legend>
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3">
          {book.formats.map((f) => {
            const active = f.id === formatId;
            return (
              <label
                key={f.id}
                className={`cursor-pointer rounded-[10px] border bg-white px-3.5 py-3 ${
                  active ? "border-accent ring-[3px] ring-accent-soft" : "border-line hover:border-ink-3"
                } ${!f.inStock ? "opacity-60" : ""}`}
              >
                <input
                  type="radio"
                  name="format"
                  value={f.id}
                  checked={active}
                  onChange={() => {
                    setFormatId(f.id);
                    setAdded(false);
                  }}
                  className="sr-only"
                />
                <span className="block text-[15px] font-bold">{FORMAT_LABELS[f.format]}</span>
                <span className="text-sm text-ink-3">
                  {f.inStock ? <Price prices={f.price} /> : "Out of stock"}
                </span>
              </label>
            );
          })}
        </div>
      </fieldset>

      <div className="mt-4 flex gap-2.5">
        {!digital && (
          <div className="flex items-center rounded-[10px] border border-line" role="group" aria-label="Quantity">
            <button
              type="button"
              aria-label="Fewer"
              onClick={() => setQuantity((q) => Math.max(1, q - 1))}
              className="grid size-11 place-items-center disabled:opacity-40"
              disabled={quantity <= 1}
            >
              <Minus size={16} />
            </button>
            <span className="w-7 text-center font-semibold" aria-live="polite">
              {quantity}
            </span>
            <button
              type="button"
              aria-label="More"
              onClick={() => setQuantity((q) => Math.min(MAX_PER_LINE, q + 1))}
              className="grid size-11 place-items-center disabled:opacity-40"
              disabled={quantity >= MAX_PER_LINE}
            >
              <Plus size={16} />
            </button>
          </div>
        )}
        <button type="button" onClick={add} disabled={!selected.inStock} className={`${buttonClass.primary} flex-1`}>
          {selected.inStock ? "Add to basket" : "Out of stock"}
        </button>
        <WishlistButton bookId={book.id} title={book.title} variant="button" />
      </div>

      <div className="mt-3 min-h-6 text-sm" aria-live="polite">
        {added ? (
          <p className="flex items-center gap-2 font-medium text-ok">
            <Check size={17} aria-hidden /> Added to your basket.{" "}
            <Link href="/basket" className="font-semibold text-accent underline underline-offset-2">
              View basket
            </Link>
          </p>
        ) : selected.lowStock ? (
          <p className="font-semibold text-warn">Only {selected.lowStock} left</p>
        ) : (
          <p className="flex items-center gap-2 text-ink-2">
            <Truck size={17} className="text-ok" aria-hidden />
            {digital ? "Available instantly after the order is confirmed" : <FreeDeliveryNote />}
          </p>
        )}
      </div>
    </div>
  );
}
