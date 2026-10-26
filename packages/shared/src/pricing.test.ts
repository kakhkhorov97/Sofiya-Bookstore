import { describe, expect, it } from "vitest";
import { computeOrderTotals, formatMoney, suggestKrw } from "./pricing";
import { CreateOrderInput } from "./domain";
import { canTransition } from "./orders";

describe("computeOrderTotals", () => {
  it("charges dollar delivery under $100 and none from $100", () => {
    expect(computeOrderTotals([{ unitPrice: 24_00, quantity: 2 }], "USD")).toEqual({
      currency: "USD",
      subtotal: 48_00,
      delivery: 5_00,
      total: 53_00,
    });
    expect(computeOrderTotals([{ unitPrice: 25_00, quantity: 4 }], "USD").delivery).toBe(0);
  });

  it("charges ₩3,000 delivery under ₩30,000 and none from ₩30,000", () => {
    expect(computeOrderTotals([{ unitPrice: 15_400, quantity: 1 }], "KRW")).toEqual({
      currency: "KRW",
      subtotal: 15_400,
      delivery: 3_000,
      total: 18_400,
    });
    expect(computeOrderTotals([{ unitPrice: 15_000, quantity: 2 }], "KRW").delivery).toBe(0);
  });

  it("rejects empty orders, fractional amounts and zero quantities", () => {
    expect(() => computeOrderTotals([], "USD")).toThrow();
    expect(() => computeOrderTotals([{ unitPrice: 1.5, quantity: 1 }], "KRW")).toThrow();
    expect(() => computeOrderTotals([{ unitPrice: 100, quantity: 0 }], "USD")).toThrow();
  });
});

describe("CreateOrderInput", () => {
  const base = {
    idempotencyKey: "6f1c1f9e-1d2b-4c3a-9e8f-0a1b2c3d4e5f",
    lines: [{ formatId: "0b6f7c2e-5a4d-4e3f-8a9b-1c2d3e4f5a6b", quantity: 1, unitPriceCents: 1 }],
  };

  it("strips any client-sent price and defaults to won", () => {
    const parsed = CreateOrderInput.parse(base);
    expect(parsed.lines[0]).not.toHaveProperty("unitPriceCents");
    expect(parsed.currency).toBe("KRW");
  });

  it("accepts dollars and rejects other currencies", () => {
    expect(CreateOrderInput.parse({ ...base, currency: "USD" }).currency).toBe("USD");
    expect(() => CreateOrderInput.parse({ ...base, currency: "EUR" })).toThrow();
  });
});

describe("money", () => {
  it("formats each currency in its own style", () => {
    expect(formatMoney(24_00, "USD")).toBe("$24.00");
    expect(formatMoney(15_400, "KRW")).toBe("₩15,400");
  });

  it("suggests round won prices from dollar prices", () => {
    expect(suggestKrw(10_99)).toBe(15_400);
    expect(suggestKrw(2_99)).toBe(4_200);
    expect(suggestKrw(0)).toBe(100);
  });
});

describe("order transitions", () => {
  it("only allows forward moves and cancellation", () => {
    expect(canTransition("PAUSED", "IN_PROCESS")).toBe(true);
    expect(canTransition("IN_PROCESS", "DELIVERED")).toBe(true);
    expect(canTransition("DELIVERED", "IN_PROCESS")).toBe(false);
    expect(canTransition("PAUSED", "DELIVERED")).toBe(false);
    expect(canTransition("CANCELLED", "PAUSED")).toBe(false);
  });
});
