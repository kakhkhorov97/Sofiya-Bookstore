// "Recently viewed" lives only in this browser.
const KEY = "sofiya.recent.v1";
const MAX = 12;

export interface RecentBook {
  slug: string;
  title: string;
  author: string;
  fromPriceCents: number;
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
