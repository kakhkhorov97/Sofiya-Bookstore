import { DELIVERY, formatMoney, type OrderTotals } from "@sofiya/shared";

export function OrderSummary({ totals, children }: { totals: OrderTotals | null; children?: React.ReactNode }) {
  const toFree = totals ? DELIVERY[totals.currency].freeFrom - totals.subtotal : 0;
  const money = (amount: number) => (totals ? formatMoney(amount, totals.currency) : "—");
  return (
    <aside className="rounded-[16px] bg-surface p-6 lg:sticky lg:top-24">
      <h2 className="font-display text-xl font-extrabold">Order summary</h2>
      <dl className="mt-4 space-y-2 text-[15px]">
        <Row label="Subtotal" value={money(totals?.subtotal ?? 0)} />
        <Row label="Delivery" value={totals ? (totals.delivery ? money(totals.delivery) : "Free") : "—"} />
        <div className="flex justify-between border-t border-line pt-3 text-lg font-bold">
          <dt>Total</dt>
          <dd>{money(totals?.total ?? 0)}</dd>
        </div>
      </dl>
      {totals && totals.delivery > 0 && toFree > 0 && (
        <p className="mt-3 text-sm text-ink-2">Add {money(toFree)} more for free delivery.</p>
      )}
      {children}
    </aside>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between">
      <dt className="text-ink-2">{label}</dt>
      <dd className="font-semibold">{value}</dd>
    </div>
  );
}
