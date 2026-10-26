import { describe, expect, it } from "vitest";
import { basketFingerprint, basketReducer, BasketLine, itemCount, parseStoredBasket } from "./basket";

const line: Omit<BasketLine, "quantity"> = {
  formatId: "f1",
  slug: "dracula-stoker",
  title: "Dracula",
  author: "Bram Stoker",
  format: "PAPERBACK",
  price: { USD: 999, KRW: 14_000 },
};

describe("basketReducer", () => {
  it("adds a new line and merges repeats", () => {
    let lines = basketReducer([], { type: "add", line, quantity: 1 });
    lines = basketReducer(lines, { type: "add", line, quantity: 2 });
    expect(lines).toHaveLength(1);
    expect(lines[0].quantity).toBe(3);
  });

  it("caps a line at 20 copies", () => {
    const lines = basketReducer([], { type: "add", line, quantity: 50 });
    expect(lines[0].quantity).toBe(20);
  });

  it("removes a line when its quantity drops to zero", () => {
    const lines = basketReducer([{ ...line, quantity: 2 }], { type: "setQuantity", formatId: "f1", quantity: 0 });
    expect(lines).toEqual([]);
  });

  it("counts items across lines", () => {
    expect(itemCount([{ ...line, quantity: 2 }, { ...line, formatId: "f2", quantity: 3 }])).toBe(5);
  });
});

describe("basketFingerprint", () => {
  it("ignores line order but not quantities or currency", () => {
    const a = { ...line, quantity: 1 };
    const b = { ...line, formatId: "f2", quantity: 2 };
    expect(basketFingerprint([a, b], "KRW")).toBe(basketFingerprint([b, a], "KRW"));
    expect(basketFingerprint([a, b], "KRW")).not.toBe(basketFingerprint([a, { ...b, quantity: 3 }], "KRW"));
    expect(basketFingerprint([a, b], "KRW")).not.toBe(basketFingerprint([a, b], "USD"));
  });
});

describe("parseStoredBasket", () => {
  it("drops junk instead of crashing", () => {
    expect(parseStoredBasket("not json")).toEqual([]);
    expect(parseStoredBasket('{"a":1}')).toEqual([]);
    expect(parseStoredBasket(JSON.stringify([{ formatId: "x", quantity: -1, title: "t" }, { ...line, quantity: 1 }]))).toHaveLength(1);
  });

  it("upgrades lines saved with only a dollar price", () => {
    const old = { ...line, price: undefined, priceCents: 1099, quantity: 1 };
    const [parsed] = parseStoredBasket(JSON.stringify([old]));
    expect(parsed.price).toEqual({ USD: 1099, KRW: 15_400 });
    expect(parsed).not.toHaveProperty("priceCents");
  });
});
