"use client";

import { useTranslations } from "next-intl";
import { Star } from "lucide-react";

// Read-only stars, rounded to the nearest half.
export function Stars({ value, size = 14, className = "" }: { value: number; size?: number; className?: string }) {
  const t = useTranslations("book");
  const rounded = Math.round(value * 2) / 2;
  return (
    <span className={`inline-flex items-center gap-[1px] ${className}`} role="img" aria-label={t("stars", { value })}>
      {[1, 2, 3, 4, 5].map((i) => {
        const fill = rounded >= i ? 1 : rounded >= i - 0.5 ? 0.5 : 0;
        return (
          <span key={i} className="relative inline-block" style={{ width: size, height: size }} aria-hidden>
            <Star size={size} className="absolute inset-0 text-line" fill="currentColor" strokeWidth={0} />
            {fill > 0 && (
              <span className="absolute inset-0 overflow-hidden" style={{ width: `${fill * 100}%` }}>
                <Star size={size} className="text-[#e3a008]" fill="currentColor" strokeWidth={0} />
              </span>
            )}
          </span>
        );
      })}
    </span>
  );
}

export function RatingLine({ avg, count }: { avg: number | null; count: number }) {
  if (!avg || count === 0) return null;
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-ink-3">
      <Stars value={avg} />
      <span>
        {avg.toFixed(1)} ({count})
      </span>
    </span>
  );
}
