import Link from "next/link";
import { getDb } from "@/db";
import { listTransactions, summarize } from "@/server/repo";
import { requireBarber } from "@/server/session";
import { addDays, bakuDate, bakuDayRange, bakuMonthRange, bakuTime, humanDate, isValidDate, MONTHS, pad, relativeDate } from "@/lib/time";
import { formatAZN } from "@/lib/money";
import { FinanceForm, DeleteTx } from "./FinanceClient";

export default async function FinancePage({ searchParams }: { searchParams: Promise<{ dovr?: string; tarix?: string }> }) {
  const b = await requireBarber();
  const sp = await searchParams;
  const today = bakuDate();
  const period = sp.dovr === "ay" ? "ay" : "gun";
  const date = sp.tarix && isValidDate(sp.tarix) ? sp.tarix : today;
  const range = period === "ay" ? bakuMonthRange(date) : bakuDayRange(date);
  const db = getDb();
  const [sum, txs] = await Promise.all([summarize(db, b.id, range), listTransactions(db, b.id, range)]);

  const [y, m] = date.split("-").map(Number);
  const prev = period === "ay" ? (m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`) : addDays(date, -1);
  const next = period === "ay" ? (m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`) : addDays(date, 1);
  const label = period === "ay" ? `${MONTHS[m - 1]} ${y}` : relativeDate(date, today);
  const href = (p: string, d: string) => `/maliyye?dovr=${p}&tarix=${d}`;

  return (
    <>
      <div className="mb-3 flex gap-1 rounded-2xl bg-card p-1">
        {(["gun", "ay"] as const).map((p) => (
          <Link key={p} href={href(p, today)} className={`flex min-h-11 flex-1 items-center justify-center rounded-xl text-sm font-semibold ${period === p ? "bg-card2 text-tx" : "text-mut"}`}>
            {p === "gun" ? "Gün" : "Ay"}
          </Link>
        ))}
      </div>
      <div className="mb-3 flex items-center justify-between">
        <Link href={href(period, prev)} className="icon-btn" aria-label="Əvvəlki">‹</Link>
        <b className="first-letter:uppercase">{label}</b>
        <Link href={href(period, next)} className="icon-btn" aria-label="Növbəti">›</Link>
      </div>
      <div className="mb-3 grid grid-cols-3 gap-2">
        <Stat label="Gəlir" value={formatAZN(sum.income)} cls="text-ok" />
        <Stat label="Xərc" value={formatAZN(sum.expense)} cls="text-bad" />
        <Stat label="Xalis" value={formatAZN(sum.net)} cls={sum.net >= 0 ? "text-ok" : "text-bad"} />
      </div>
      <FinanceForm />
      <div className="card py-1">
        {txs.length === 0 ? (
          <div className="py-8 text-center text-mut">Əməliyyat yoxdur</div>
        ) : (
          txs.map((t) => (
            <div key={t.id} className="flex items-center gap-3 border-b border-bd py-3 last:border-0">
              <div className="flex-1">
                {t.description}
                <small className="block text-xs text-mut">
                  {t.kind === "income" ? "Gəlir" : "Xərc"}
                  {t.source === "debt" ? " · veresiyə" : t.source === "appointment" ? " · randevu" : ""} ·{" "}
                  {period === "ay" ? humanDate(bakuDate(t.occurredAt)) + ", " : ""}
                  {bakuTime(t.occurredAt)}
                </small>
              </div>
              <b className={t.kind === "income" ? "text-ok" : "text-bad"}>
                {t.kind === "income" ? "+" : "−"}
                {formatAZN(t.amountCents)}
              </b>
              {t.source === "manual" && <DeleteTx id={t.id} />}
            </div>
          ))
        )}
      </div>
    </>
  );
}

function Stat({ label, value, cls }: { label: string; value: string; cls: string }) {
  return (
    <div className="rounded-2xl border border-bd bg-card p-3 text-center">
      <span className="text-xs text-mut">{label}</span>
      <b className={`mt-1 block text-[17px] ${cls}`}>{value}</b>
    </div>
  );
}
