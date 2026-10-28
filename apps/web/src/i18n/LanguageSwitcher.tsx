"use client";

import { useLocale, useTranslations } from "next-intl";
import { LOCALE_LABELS, LOCALES, localeCookie, type Locale } from "./locales";

// ENG / KOR / RUS. Saves the choice and reloads, so every page, the header
// and the cached views switch language together.
export function LanguageSwitcher({ className = "" }: { className?: string }) {
  const locale = useLocale() as Locale;
  const t = useTranslations("language");
  return (
    <div
      role="radiogroup"
      aria-label={t("label")}
      className={`inline-flex shrink-0 rounded-full bg-surface p-1 text-[13px] font-semibold ${className}`}
    >
      {LOCALES.map((l) => {
        const active = l === locale;
        return (
          <button
            key={l}
            type="button"
            role="radio"
            aria-checked={active}
            lang={l}
            title={LOCALE_LABELS[l].name}
            onClick={() => {
              if (active) return;
              document.cookie = localeCookie(l);
              window.location.reload();
            }}
            className={`rounded-full px-2.5 py-1 transition-colors focus-visible:outline-2 focus-visible:outline-accent ${
              active ? "bg-white text-ink shadow-sm" : "text-ink-3 hover:text-ink"
            }`}
          >
            {LOCALE_LABELS[l].short}
          </button>
        );
      })}
    </div>
  );
}
