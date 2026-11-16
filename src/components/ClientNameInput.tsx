"use client";
// Ad yazılanda mövcud müştəriləri təklif edir; seçiləndə nömrə avtomatik dolur.
import { useEffect, useRef, useState } from "react";
import { searchClientsAction } from "@/app/actions/data";
import { formatPhone } from "@/lib/phone";

export type ClientPick = { clientId: string | null; name: string; phone: string };

export function ClientNameInput({
  value,
  onChange,
  autoFocus,
}: {
  value: ClientPick;
  onChange: (v: ClientPick) => void;
  autoFocus?: boolean;
}) {
  const [hits, setHits] = useState<{ id: string; name: string; phone: string | null }[]>([]);
  const [open, setOpen] = useState(false);
  const seq = useRef(0);

  useEffect(() => {
    const q = value.name.trim();
    if (!q || value.clientId) {
      setHits([]);
      return;
    }
    const my = ++seq.current;
    const t = setTimeout(async () => {
      const r = await searchClientsAction(q);
      if (my !== seq.current) return;
      setHits(r);
      // Tam uyğun tək müştəri varsa — nömrəni özü doldur
      const exact = r.filter((c) => c.name.toLocaleLowerCase("az") === q.toLocaleLowerCase("az"));
      if (exact.length === 1 && !value.phone) {
        onChange({ clientId: exact[0].id, name: exact[0].name, phone: formatPhone(exact[0].phone) });
        setOpen(false);
      }
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value.name, value.clientId]);

  return (
    <div className="relative">
      <input
        className="field"
        name="clientName"
        placeholder="Müştərinin adı"
        autoComplete="off"
        autoFocus={autoFocus}
        value={value.name}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onChange={(e) => {
          setOpen(true);
          onChange({ clientId: null, name: e.target.value, phone: value.clientId ? "" : value.phone });
        }}
      />
      {value.clientId && <span className="absolute right-3 top-3.5 text-xs text-ok">✓ tanış müştəri</span>}
      {open && hits.length > 0 && !value.clientId && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-bd bg-card2 shadow-xl">
          {hits.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="flex min-h-12 w-full items-center justify-between px-3.5 text-left active:bg-bd"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => {
                  onChange({ clientId: c.id, name: c.name, phone: formatPhone(c.phone) });
                  setOpen(false);
                }}
              >
                <b>{c.name}</b>
                <span className="text-sm text-mut">{formatPhone(c.phone) || "nömrə yoxdur"}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
