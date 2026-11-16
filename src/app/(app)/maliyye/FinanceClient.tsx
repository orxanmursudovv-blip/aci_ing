"use client";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addTransactionAction, deleteTransactionAction } from "@/app/actions/data";
import { Msg } from "@/components/Msg";

export function FinanceForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const add = (kind: "income" | "expense") =>
    start(async () => {
      const r = await addTransactionAction({ kind, amount, description: title });
      if (!r.ok) return setError(r.error);
      setError(null);
      setTitle("");
      setAmount("");
      router.refresh();
    });
  return (
    <div className="card">
      <div className="mb-2 flex gap-2">
        <input className="field" placeholder="Açıqlama (saç, saqqal, ülgü...)" value={title} onChange={(e) => setTitle(e.target.value)} />
        <input className="field max-w-[100px]" inputMode="decimal" placeholder="AZN" value={amount} onChange={(e) => setAmount(e.target.value)} />
      </div>
      <div className="flex gap-2">
        <button type="button" className="btn flex-1" disabled={pending} onClick={() => add("income")}>+ Gəlir</button>
        <button type="button" className="btn-ghost flex-1" disabled={pending} onClick={() => add("expense")}>− Xərc</button>
      </div>
      {error && <Msg kind="err">{error}</Msg>}
    </div>
  );
}

export function DeleteTx({ id }: { id: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  return (
    <button
      type="button"
      className="icon-btn h-9 w-9 text-sm"
      aria-label="Sil"
      disabled={pending}
      onClick={() => {
        if (!confirm("Bu əməliyyat silinsin?")) return;
        start(async () => {
          await deleteTransactionAction(id);
          router.refresh();
        });
      }}
    >
      ✕
    </button>
  );
}
