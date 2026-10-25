import type { BookFormat, BookSort, Genre, OrderStatus } from "@sofiya/shared";

export const GENRE_LABELS: Record<Genre, string> = {
  FICTION: "Fiction",
  ROMANCE: "Romance",
  FANTASY: "Fantasy",
  MYSTERY: "Mystery",
  SCIENCE_FICTION: "Science fiction",
  HORROR: "Horror",
  HISTORY: "History",
  SELF_HELP: "Self-help",
  PROGRAMMING: "Programming",
};

export const FORMAT_LABELS: Record<BookFormat, string> = {
  HARDCOVER: "Hardcover",
  PAPERBACK: "Paperback",
  EBOOK: "Ebook",
  AUDIOBOOK: "Audiobook",
};

export const SORT_LABELS: Record<BookSort, string> = {
  relevance: "Best match",
  popular: "Most popular",
  newest: "Newest",
  title: "Title A–Z",
  price_asc: "Price: low to high",
  price_desc: "Price: high to low",
};

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  PAUSED: "Awaiting confirmation",
  IN_PROCESS: "In process",
  DELIVERED: "Delivered",
  CANCELLED: "Cancelled",
};

export const isDigital = (f: BookFormat) => f === "EBOOK" || f === "AUDIOBOOK";

export function yearLabel(year: number | null): string | null {
  if (year === null) return null;
  return year < 0 ? `c. ${-year} BC` : String(year);
}

export function dateLabel(iso: string): string {
  return new Intl.DateTimeFormat("en-US", { dateStyle: "medium" }).format(new Date(iso));
}
