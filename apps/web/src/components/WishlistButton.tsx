"use client";

import { Heart } from "lucide-react";
import { useWishlist } from "@/wishlist/WishlistProvider";

export function WishlistButton({
  bookId,
  title,
  variant = "icon",
}: {
  bookId: string;
  title: string;
  variant?: "icon" | "button";
}) {
  const { has, toggle } = useWishlist();
  const saved = has(bookId);
  const label = saved ? `Remove ${title} from your wishlist` : `Save ${title} to your wishlist`;

  if (variant === "button") {
    return (
      <button
        type="button"
        aria-pressed={saved}
        aria-label={label}
        onClick={() => void toggle(bookId)}
        className={`inline-flex h-[46px] w-[46px] shrink-0 items-center justify-center rounded-[10px] bg-white shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_var(--ink-3)] ${
          saved ? "text-[#d6336c]" : "text-ink-2"
        }`}
      >
        <Heart size={20} fill={saved ? "currentColor" : "none"} />
      </button>
    );
  }

  return (
    <button
      type="button"
      aria-pressed={saved}
      aria-label={label}
      onClick={(e) => {
        e.preventDefault();
        void toggle(bookId);
      }}
      className={`grid size-9 place-items-center rounded-full bg-white/95 shadow-[0_2px_8px_rgba(21,23,28,0.18)] transition-transform hover:scale-105 ${
        saved ? "text-[#d6336c]" : "text-ink-2"
      }`}
    >
      <Heart size={17} fill={saved ? "currentColor" : "none"} />
    </button>
  );
}
