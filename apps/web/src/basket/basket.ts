import type { BookFormat } from "@sofiya/shared";

export const MAX_PER_LINE = 20;

// What the browser remembers. The price is only a snapshot for display;
// the basket page refreshes it and the server charges its own price.
export interface BasketLine {
  formatId: string;
  quantity: number;
  slug: string;
  title: string;
  author: string;
  format: BookFormat;
  priceCents: number;
}

export type BasketAction =
  | { type: "add"; line: Omit<BasketLine, "quantity">; quantity: number }
  | { type: "setQuantity"; formatId: string; quantity: number }
  | { type: "remove"; formatId: string }
  | { type: "clear" }
  | { type: "replace"; lines: BasketLine[] };

const clamp = (n: number) => Math.max(1, Math.min(MAX_PER_LINE, Math.floor(n)));

export function basketReducer(lines: BasketLine[], action: BasketAction): BasketLine[] {
  switch (action.type) {
    case "add": {
      const existing = lines.find((l) => l.formatId === action.line.formatId);
      if (existing) {
        return lines.map((l) =>
          l.formatId === action.line.formatId
            ? { ...l, ...action.line, quantity: clamp(l.quantity + action.quantity) }
            : l,
        );
      }
      return [...lines, { ...action.line, quantity: clamp(action.quantity) }];
    }
    case "setQuantity":
      if (action.quantity < 1) return lines.filter((l) => l.formatId !== action.formatId);
      return lines.map((l) =>
        l.formatId === action.formatId ? { ...l, quantity: clamp(action.quantity) } : l,
      );
    case "remove":
      return lines.filter((l) => l.formatId !== action.formatId);
    case "clear":
      return [];
    case "replace":
      return action.lines;
  }
}

export const itemCount = (lines: BasketLine[]) => lines.reduce((n, l) => n + l.quantity, 0);

// Stable fingerprint of the basket contents; a new fingerprint means a new
// checkout attempt and therefore a new idempotency key.
export function basketFingerprint(lines: BasketLine[]): string {
  return [...lines]
    .sort((a, b) => a.formatId.localeCompare(b.formatId))
    .map((l) => `${l.formatId}:${l.quantity}`)
    .join(",");
}

// Tolerates anything a user or an older version left in localStorage.
export function parseStoredBasket(raw: string | null): BasketLine[] {
  if (!raw) return [];
  try {
    const data: unknown = JSON.parse(raw);
    if (!Array.isArray(data)) return [];
    return data.filter(
      (l): l is BasketLine =>
        typeof l === "object" &&
        l !== null &&
        typeof (l as BasketLine).formatId === "string" &&
        Number.isInteger((l as BasketLine).quantity) &&
        (l as BasketLine).quantity > 0 &&
        typeof (l as BasketLine).title === "string",
    );
  } catch {
    return [];
  }
}
