// The shop's languages. The choice lives in a cookie (like the currency), so
// URLs stay the same in every language.
export const LOCALES = ["en", "ko", "ru"] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = "en";
export const LOCALE_COOKIE = "sofiya_locale";

// Short labels for the switcher, and each language's own name.
export const LOCALE_LABELS: Record<Locale, { short: string; name: string }> = {
  en: { short: "ENG", name: "English" },
  ko: { short: "KOR", name: "한국어" },
  ru: { short: "RUS", name: "Русский" },
};

// Intl formatting (dates, numbers) for each language.
export const INTL_LOCALE: Record<Locale, string> = { en: "en-US", ko: "ko-KR", ru: "ru-RU" };

const isLocale = (v: unknown): v is Locale => typeof v === "string" && (LOCALES as readonly string[]).includes(v);

// The saved choice wins; otherwise the browser's preferred languages
// ("ko-KR,ko;q=0.9,en;q=0.8"), in order; otherwise English.
export function pickLocale(cookie: string | undefined, acceptLanguage: string | null): Locale {
  if (isLocale(cookie)) return cookie;
  for (const part of (acceptLanguage ?? "").split(",")) {
    const base = part.split(";")[0].trim().toLowerCase().split("-")[0];
    if (isLocale(base)) return base;
  }
  return DEFAULT_LOCALE;
}

export function localeCookie(locale: Locale): string {
  return `${LOCALE_COOKIE}=${locale}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax`;
}
