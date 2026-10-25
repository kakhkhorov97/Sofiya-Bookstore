// All money is integer cents. Rule from the legacy store:
// delivery is free from $100, otherwise $5.
export const FREE_DELIVERY_FROM_CENTS = 100_00;
export const DELIVERY_FEE_CENTS = 5_00;

export interface PricedLine {
  unitPriceCents: number;
  quantity: number;
}

export interface OrderTotals {
  subtotalCents: number;
  deliveryCents: number;
  totalCents: number;
}

export function computeOrderTotals(lines: readonly PricedLine[]): OrderTotals {
  if (lines.length === 0) throw new Error("An order needs at least one line");
  const subtotalCents = lines.reduce((sum, line) => {
    if (!Number.isInteger(line.unitPriceCents) || line.unitPriceCents < 0) {
      throw new Error("unitPriceCents must be a non-negative integer");
    }
    if (!Number.isInteger(line.quantity) || line.quantity < 1) {
      throw new Error("quantity must be a positive integer");
    }
    return sum + line.unitPriceCents * line.quantity;
  }, 0);
  const deliveryCents = subtotalCents >= FREE_DELIVERY_FROM_CENTS ? 0 : DELIVERY_FEE_CENTS;
  return { subtotalCents, deliveryCents, totalCents: subtotalCents + deliveryCents };
}

export function formatUsd(cents: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(cents / 100);
}
