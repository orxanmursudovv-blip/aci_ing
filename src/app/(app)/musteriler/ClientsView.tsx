"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { deleteClientAction, saveClientAction } from "@/app/actions/data";
import { Sheet } from "@/components/Sheet";
import { Msg } from "@/components/Msg";
import { formatAZN } from "@/lib/money";
import { formatPhone } from "@/lib/phone";

type Item = { id: string; name: string; phone: string | null; optOut: boolean; visits: number; debtCents: number };
type Edit = { id?: string; name: string; phone: string; optOut: boolean };

export function ClientsView({ items }: { items: Item[] }) {
  const router = useRouter();
  const [q, setQ] = useState("");
  const [edit, setEdit] = useState<Edit | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const ql = q.trim().toLocaleLowerCase("az");
  const shown = ql ? items.filter((c) => c.name.toLocaleLowerCase("az").includes(ql) || (c.phone ?? "").includes(ql.replace(/\D/g, "") || "~")) : items;

  return (
    <>
      <div className="mb-3 flex gap-2">
        <input className="field" placeholder="Axtar: ad və ya nömrə" value={q} onChange={(e) => setQ(e.target.value)} />
        <button type="button" className="btn" onClick={() => { setError(null); setEdit({ name: "", phone: "", optOut: false }); }}>+ Yeni</button>
      </div>
      <div className="card py-1">
        {shown.length === 0 ? (
          <div className="py-8 text-center text-mut">{items.length ? "Tapılmadı" : "Hələ müştəri yoxdur. Randevu əlavə edəndə avtomatik yaranır."}</div>
        ) : (
          shown.map((c) => (
            <button
              key={c.id}
              type="button"
              className="flex w-full items-center gap-3 border-b border-bd py-3 text-left last:border-0"
              onClick={() => { setError(null); setEdit({ id: c.id, name: c.name, phone: formatPhone(c.phone), optOut: c.optOut }); }}
            >
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-card2 font-bold text-ac">{c.name.charAt(0)}</span>
              <span className="flex-1">
                <b className="block">{c.name}</b>
                <span className="text-xs text-mut">{formatPhone(c.phone) || "nömrə yoxdur"} · {c.visits} randevu</span>
              </span>
              {c.debtCents > 0 && <b className="text-sm text-bad">{formatAZN(c.debtCents)}</b>}
            </button>
          ))
        )}
      </div>
      {edit && (
        <Sheet open onClose={() => setEdit(null)} title={edit.id ? "Müştəri" : "Yeni müştəri"}>
          <div className="space-y-3">
            <label className="block">
              <span className="label">Ad</span>
              <input className="field" value={edit.name} autoFocus={!edit.id} onChange={(e) => setEdit({ ...edit, name: e.target.value })} />
            </label>
            <label className="block">
              <span className="label">Telefon</span>
              <input className="field" type="tel" inputMode="tel" placeholder="050 123 45 67" value={edit.phone} onChange={(e) => setEdit({ ...edit, phone: e.target.value })} />
            </label>
            {edit.id && (
              <label className="flex min-h-12 items-center gap-3 rounded-xl bg-card2 px-3.5">
                <input type="checkbox" className="h-5 w-5 accent-[#f5b942]" checked={edit.optOut} onChange={(e) => setEdit({ ...edit, optOut: e.target.checked })} />
                <span className="text-sm">WhatsApp xatırlatma göndərmə (müştəri istəmir)</span>
              </label>
            )}
          </div>
          {error && <Msg kind="err">{error}</Msg>}
          <button
            type="button"
            className="btn mt-4 w-full text-lg"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const r = await saveClientAction(edit);
                if (!r.ok) return setError(r.error);
                setEdit(null);
                router.refresh();
              })
            }
          >
            Yadda saxla
          </button>
          {edit.id && (
            <button
              type="button"
              className="mt-3 w-full py-3 text-sm font-semibold text-bad"
              disabled={pending}
              onClick={() => {
                if (!confirm("Müştəri silinsin? Onun bütün randevuları və veresiyələri də silinəcək.")) return;
                start(async () => {
                  await deleteClientAction(edit.id!);
                  setEdit(null);
                  router.refresh();
                });
              }}
            >
              Müştərini sil
            </button>
          )}
        </Sheet>
      )}
    </>
  );
}
