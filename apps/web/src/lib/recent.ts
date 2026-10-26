import type { Prices } from "@sofiya/shared";

// "Recently viewed" lives only in this browser.
const KEY = "sofiya.recent.v1";
const MAX = 12;
// Fired in this tab when the list is cleared; other tabs get a "storage" event.
export const RECENT_CLEARED = "sofiya:recent-cleared";
export const RECENT_KEY = KEY;

export interface RecentBook {
  slug: string;
  title: string;
  author: string;
  // Missing on entries saved before prices came in two currencies.
  fromPrice?: Prices;
  coverUrl?: string | null;
}

export function readRecent(): RecentBook[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(KEY) ?? "[]");
    return Array.isArray(data)
      ? data.filter((b): b is RecentBook => typeof b?.slug === "string" && typeof b?.title === "string")
      : [];
  } catch {
    return [];
  }
}

export function pushRecent(book: RecentBook): void {
  try {
    const next = [book, ...readRecent().filter((b) => b.slug !== book.slug)].slice(0, MAX);
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    // Storage unavailable: nothing to remember.
  }
}

export function clearRecent(): void {
  try {
    localStorage.removeItem(KEY);
  } catch {
    // Storage unavailable: nothing was remembered.
  }
  window.dispatchEvent(new Event(RECENT_CLEARED));
}
