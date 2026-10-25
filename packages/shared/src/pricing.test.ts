import { describe, expect, it } from "vitest";
import { computeOrderTotals, formatUsd } from "./pricing";
import { CreateOrderInput } from "./domain";

describe("computeOrderTotals", () => {
  it("charges delivery under $100", () => {
    expect(computeOrderTotals([{ unitPriceCents: 24_00, quantity: 2 }])).toEqual({
      subtotalCents: 48_00,
      deliveryCents: 5_00,
      totalCents: 53_00,
    });
  });

  it("makes delivery free from exactly $100", () => {
    expect(computeOrderTotals([{ unitPriceCents: 25_00, quantity: 4 }]).deliveryCents).toBe(0);
  });

  it("rejects empty orders, fractional cents and zero quantities", () => {
    expect(() => computeOrderTotals([])).toThrow();
    expect(() => computeOrderTotals([{ unitPriceCents: 1.5, quantity: 1 }])).toThrow();
    expect(() => computeOrderTotals([{ unitPriceCents: 100, quantity: 0 }])).toThrow();
  });
});

describe("CreateOrderInput", () => {
  it("strips any client-sent price", () => {
    const parsed = CreateOrderInput.parse({
      idempotencyKey: "6f1c1f9e-1d2b-4c3a-9e8f-0a1b2c3d4e5f",
      lines: [{ formatId: "0b6f7c2e-5a4d-4e3f-8a9b-1c2d3e4f5a6b", quantity: 1, unitPriceCents: 1 }],
    });
    expect(parsed.lines[0]).not.toHaveProperty("unitPriceCents");
  });
});

describe("formatUsd", () => {
  it("formats cents as dollars", () => {
    expect(formatUsd(24_00)).toBe("$24.00");
  });
});

describe("order transitions", async () => {
  const { canTransition } = await import("./orders");
  it("only allows forward moves and cancellation", () => {
    expect(canTransition("PAUSED", "IN_PROCESS")).toBe(true);
    expect(canTransition("IN_PROCESS", "DELIVERED")).toBe(true);
    expect(canTransition("DELIVERED", "IN_PROCESS")).toBe(false);
    expect(canTransition("PAUSED", "DELIVERED")).toBe(false);
    expect(canTransition("CANCELLED", "PAUSED")).toBe(false);
  });
});
