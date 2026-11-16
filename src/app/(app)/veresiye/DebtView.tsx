"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addDebtAction, deleteDebtAction, payDebtAction, unpayDebtAction } from "@/app/actions/data";
import { ClientNameInput, type ClientPick } from "@/components/ClientNameInput";
import { Msg } from "@/components/Msg";
import { formatAZN } from "@/lib/money";
import { waLink } from "@/lib/phone";
import { debtText } from "@/lib/messages";

type Item = { id: string; name: string; phone: string | null; amountCents: number; note: string | null; paid: boolean };

export function DebtView({ items, salon }: { items: Item[]; salon: string }) {
  const router = useRouter();
  const [client, setClient] = useState<ClientPick>({ clientId: null, name: "", phone: "" });
  const [amount, setAmount] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const run = (fn: () => Promise<unknown>) =>
    start(async () => {
      await fn();
      router.refresh();
    });

  return (
    <>
      <div className="card space-y-2">
        <ClientNameInput value={client} onChange={setClient} />
        <div className="flex gap-2">
          <input className="field" type="tel" inputMode="tel" placeholder="Telefon (istəyə bağlı)" value={client.phone} onChange={(e) => setClient({ ...client, phone: e.target.value })} />
          <input className="field max-w-[100px]" inputMode="decimal" placeholder="AZN" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </div>
        <input className="field" placeholder="Qeyd (istəyə bağlı)" value={note} onChange={(e) => setNote(e.target.value)} />
        <button
          type="button"
          className="btn w-full"
          disabled={pending}
          onClick={() =>
            start(async () => {
              const r = await addDebtAction({ ...client, amount, note });
              if (!r.ok) return setError(r.error);
              setError(null);
              setClient({ clientId: null, name: "", phone: "" });
              setAmount("");
              setNote("");
              router.refresh();
            })
          }
        >
          + Veresiyə yaz
        </button>
        {error && <Msg kind="err">{error}</Msg>}
      </div>

      <div className="card py-1">
        {items.length === 0 ? (
          <div className="py-8 text-center text-mut">Veresiyə yoxdur</div>
        ) : (
          items.map((d) => (
            <div key={d.id} className={`flex items-center gap-2.5 border-b border-bd py-3 last:border-0 ${d.paid ? "opacity-45" : ""}`}>
              <div className="flex-1">
                <b className="block">{d.name}</b>
                <span className="text-xs text-mut">
                  {d.paid ? "Ödənib" : "Ödənməyib"}
                  {d.note ? ` · ${d.note}` : ""}
                </span>
              </div>
              <b className={d.paid ? "text-mut" : "text-bad"}>{formatAZN(d.amountCents)}</b>
              {!d.paid && (
                <a
                  className="icon-btn border-wabd bg-wa"
                  href={waLink(d.phone, debtText({ name: d.name, amount: formatAZN(d.amountCents), salon }))}
                  target="_blank"
                  rel="noopener"
                  aria-label={`${d.name} — WhatsApp`}
                >
                  💬
                </a>
              )}
              {d.paid ? (
                <button type="button" className="icon-btn" disabled={pending} aria-label="Ödənişi geri al"
                  onClick={() => confirm("Ödəniş geri alınsın? Gəlir qeydi də silinəcək.") && run(() => unpayDebtAction(d.id))}>↩</button>
              ) : (
                <button type="button" className="icon-btn text-ok" disabled={pending} aria-label={`${d.name} ödədi`}
                  onClick={() => confirm(`${d.name} ${formatAZN(d.amountCents)} ödədi? Gəlirə yazılacaq.`) && run(() => payDebtAction(d.id))}>✓</button>
              )}
              <button type="button" className="icon-btn h-9 w-9 text-sm" disabled={pending} aria-label="Sil"
                onClick={() => confirm("Veresiyə qeydi silinsin?") && run(() => deleteDebtAction(d.id))}>✕</button>
            </div>
          ))
        )}
      </div>
    </>
  );
}
