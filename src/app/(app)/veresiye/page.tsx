import { getDb } from "@/db";
import { listDebts } from "@/server/repo";
import { requireBarber } from "@/server/session";
import { formatAZN } from "@/lib/money";
import { DebtView } from "./DebtView";

export default async function DebtPage() {
  const b = await requireBarber();
  const rows = await listDebts(getDb(), b.id);
  const total = rows.filter((d) => !d.paidAt).reduce((s, d) => s + d.amountCents, 0);
  return (
    <>
      <div className="mb-3 rounded-2xl border border-bd bg-card p-3 text-center">
        <span className="text-xs text-mut">Ümumi veresiyə</span>
        <b className="mt-1 block text-2xl text-bad">{formatAZN(total)}</b>
      </div>
      <DebtView
        salon={b.salonName}
        items={rows.map((d) => ({
          id: d.id,
          name: d.clientName,
          phone: d.clientPhone,
          amountCents: d.amountCents,
          note: d.note,
          paid: !!d.paidAt,
        }))}
      />
    </>
  );
}
