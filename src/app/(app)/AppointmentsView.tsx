"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/Sheet";
import { Msg } from "@/components/Msg";
import { ClientNameInput, type ClientPick } from "@/components/ClientNameInput";
import { parseAppointment } from "@/lib/parse";
import { addDays, relativeDate, weekday, WD_SHORT } from "@/lib/time";
import { formatPhone, waLink } from "@/lib/phone";
import { reminderText } from "@/lib/messages";
import {
  completeAppointmentAction,
  deleteAppointmentAction,
  reopenAppointmentAction,
  saveAppointmentAction,
} from "@/app/actions/data";

export type ApItem = {
  id: string;
  date: string;
  time: string;
  status: "scheduled" | "done";
  clientId: string;
  name: string;
  phone: string | null;
  optOut: boolean;
};

type Draft = ClientPick & { id?: string; date: string; time: string };

const EXAMPLES = ["Sabah saat 8-ə Şafak randevu", "Bu gün saat 17:30 Nicat", "Cümə axşamı saat 12-yə Tofiq"];

export function AppointmentsView({
  today,
  start,
  selected,
  items,
  salon,
}: {
  today: string;
  start: string;
  selected: string;
  items: ApItem[];
  salon: string;
}) {
  const router = useRouter();
  const [sel, setSel] = useState(selected);
  const [phrase, setPhrase] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const [flash, setFlash] = useState<string | null>(null);
  const [paying, setPaying] = useState<ApItem | null>(null);
  const [sheetKey, setSheetKey] = useState(0);
  const openDraft = (d: Draft, h: string | null = null) => {
    setHint(h);
    setDraft(d);
    setSheetKey((k) => k + 1); // hər açılışda form xətaları sıfırlanır
  };

  const days = useMemo(() => Array.from({ length: 10 }, (_, i) => addDays(start, i)), [start]);
  const list = items.filter((a) => a.date === sel);

  function selectDay(d: string) {
    setSel(d);
    window.history.replaceState(null, "", d === today ? "/" : `/?gun=${d}`);
  }

  function openFromPhrase(text: string) {
    const t = text.trim();
    if (!t) return;
    const p = parseAppointment(t, today);
    const missing: string[] = [];
    if (!p.name) missing.push("adı");
    if (!p.time) missing.push("saatı");
    openDraft(
      { clientId: null, name: p.name ?? "", phone: "", date: p.date ?? sel, time: p.time ?? "" },
      missing.length ? `Müştərinin ${missing.join(" və ")} başa düşmədim — zəhmət olmasa yazın.` : null,
    );
  }

  function onSaved(d: Draft) {
    setDraft(null);
    setPhrase("");
    setFlash(`✅ ${d.name} — ${relativeDate(d.date, today)}, ${d.time}`);
    setTimeout(() => setFlash(null), 4000);
    if (days.includes(d.date)) selectDay(d.date);
    else router.push(`/?gun=${d.date}`);
    router.refresh();
  }

  return (
    <>
      <div className="card text-center">
        <MicButton
          onText={(t) => {
            setPhrase(t);
            openFromPhrase(t);
          }}
        />
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            openFromPhrase(phrase);
          }}
        >
          <input
            className="field"
            name="phrase"
            placeholder="Məs: Sabah saat 8-ə Şafak"
            value={phrase}
            onChange={(e) => setPhrase(e.target.value)}
          />
          <button className="btn">Əlavə et</button>
        </form>
        <div className="mt-3 flex flex-wrap justify-center gap-1.5">
          {EXAMPLES.map((t) => (
            <button
              key={t}
              type="button"
              className="rounded-full border border-bd bg-card2 px-3 py-1.5 text-xs text-mut"
              onClick={() => {
                setPhrase(t);
                openFromPhrase(t);
              }}
            >
              {t}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="mt-3 text-sm font-semibold text-ac"
          onClick={() => openDraft({ clientId: null, name: "", phone: "", date: sel, time: "" })}
        >
          + Formla əlavə et
        </button>
        {flash && <Msg kind="ok">{flash}</Msg>}
      </div>

      <div className="relative mb-3 flex gap-1.5 overflow-x-auto pb-1" role="tablist" aria-label="Günlər">
        {days.map((d) => {
          const on = d === sel;
          const has = items.some((a) => a.date === d);
          return (
            <button
              key={d}
              role="tab"
              aria-selected={on}
              onClick={() => selectDay(d)}
              className={`min-w-[56px] shrink-0 rounded-2xl border px-1.5 py-2 text-center ${on ? "border-ac bg-ac text-acink" : "border-bd bg-card"}`}
            >
              <span className={`block text-[11px] ${on ? "text-acink" : "text-mut"}`}>{d === today ? "Bu gün" : WD_SHORT[weekday(d)]}</span>
              <b className="block text-lg">{+d.slice(8)}</b>
              <i className={`mx-auto mt-0.5 block h-1.5 w-1.5 rounded-full ${has ? (on ? "bg-acink" : "bg-ok") : "bg-transparent"}`} />
            </button>
          );
        })}
        <label className="relative flex min-w-[56px] shrink-0 cursor-pointer items-center justify-center rounded-2xl border border-bd bg-card text-xl" aria-label="Başqa gün seç">
          📅
          <input
            type="date"
            className="sr-only"
            onChange={(e) => e.target.value && router.push(`/?gun=${e.target.value}`)}
          />
        </label>
      </div>

      <div className="card py-1">
        <div className="flex items-center justify-between border-b border-bd py-2.5 text-sm text-mut">
          <span className="first-letter:uppercase">{relativeDate(sel, today)}</span>
          <span>{list.length} randevu</span>
        </div>
        {list.length === 0 ? (
          <div className="py-8 text-center text-mut">
            Bu gün randevu yoxdur.
            <br />
            Mikrofona bas və ya yaz 👆
          </div>
        ) : (
          list.map((a) => (
            <div key={a.id} className={`flex items-center gap-3 border-b border-bd py-3 last:border-0 ${a.status === "done" ? "opacity-55" : ""}`}>
              <button
                type="button"
                className="flex flex-1 items-center gap-3 text-left"
                onClick={() =>
                  openDraft({ id: a.id, clientId: a.clientId, name: a.name, phone: formatPhone(a.phone), date: a.date, time: a.time })
                }
              >
                <span className="min-w-[56px] text-lg font-extrabold text-ac">{a.time}</span>
                <span className="flex-1">
                  <b className="block text-base">{a.name}</b>
                  <span className="text-xs text-mut">
                    {a.status === "done" ? "✓ Gəldi" : formatPhone(a.phone) || "nömrə yoxdur"}
                  </span>
                </span>
              </button>
              {a.status === "scheduled" && !a.optOut && (
                <a
                  className="icon-btn border-wabd bg-wa"
                  href={waLink(a.phone, reminderText({ name: a.name, date: a.date, time: a.time, salon, today }))}
                  target="_blank"
                  rel="noopener"
                  aria-label={`${a.name} — WhatsApp xatırlatma`}
                >
                  💬
                </a>
              )}
              <DoneButton item={a} onPay={() => setPaying(a)} />
            </div>
          ))
        )}
      </div>

      <AppointmentSheet
        key={sheetKey}
        draft={draft}
        hint={hint}
        today={today}
        onChange={setDraft}
        onClose={() => setDraft(null)}
        onSaved={onSaved}
        onDeleted={() => {
          setDraft(null);
          router.refresh();
        }}
      />
      <PaySheet key={paying?.id ?? "none"} item={paying} onClose={() => setPaying(null)} onDone={() => { setPaying(null); router.refresh(); }} />
    </>
  );
}

function DoneButton({ item, onPay }: { item: ApItem; onPay: () => void }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  if (item.status === "scheduled")
    return (
      <button type="button" className="icon-btn" onClick={onPay} aria-label={`${item.name} gəldi`}>
        ✓
      </button>
    );
  return (
    <button
      type="button"
      className="icon-btn text-ok"
      disabled={pending}
      aria-label="Geri al"
      onClick={() => {
        if (!confirm(`${item.name} — "gəldi" qeydini geri alım? Gəlir qeydi də silinəcək.`)) return;
        start(async () => {
          await reopenAppointmentAction(item.id);
          router.refresh();
        });
      }}
    >
      ↩
    </button>
  );
}

function AppointmentSheet({
  draft,
  hint,
  today,
  onChange,
  onClose,
  onSaved,
  onDeleted,
}: {
  draft: Draft | null;
  hint: string | null;
  today: string;
  onChange: (d: Draft) => void;
  onClose: () => void;
  onSaved: (d: Draft) => void;
  onDeleted: () => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!draft) return null;
  const complete = draft.name.trim() && draft.time && draft.date;

  function save(force = false) {
    if (!draft) return;
    start(async () => {
      const r = await saveAppointmentAction({
        id: draft.id,
        clientId: draft.clientId,
        name: draft.name,
        phone: draft.phone,
        date: draft.date,
        time: draft.time,
        force,
      });
      if (r.ok) {
        setError(null);
        setConflict(null);
        onSaved(draft);
      } else if (r.conflict) {
        setConflict(r.error);
      } else setError(r.error);
    });
  }

  const set = (p: Partial<Draft>) => {
    setConflict(null);
    onChange({ ...draft, ...p });
  };

  return (
    <Sheet open onClose={onClose} title={draft.id ? "Randevunu dəyiş" : "Yeni randevu"}>
      {complete && !draft.id && (
        <p className="mb-4 rounded-xl bg-card2 p-3.5 text-center text-lg">
          <b>{draft.name}</b> — {relativeDate(draft.date, today)} <b className="text-ac">{draft.time}</b>.
          <br />
          <span className="text-base text-mut">Təsdiq edirsən?</span>
        </p>
      )}
      {hint && <Msg kind="warn">{hint}</Msg>}
      <div className="mt-3 space-y-3">
        <div>
          <span className="label">Müştəri</span>
          <ClientNameInput
            value={draft}
            autoFocus={!draft.name}
            onChange={(v) => set(v)}
          />
        </div>
        <label className="block">
          <span className="label">Telefon (WhatsApp üçün)</span>
          <input
            className="field"
            type="tel"
            inputMode="tel"
            name="phone"
            placeholder="050 123 45 67"
            value={draft.phone}
            onChange={(e) => set({ phone: e.target.value })}
          />
        </label>
        <div>
          <span className="label">Gün</span>
          <div className="mb-2 flex gap-2">
            {[0, 1, 2].map((n) => {
              const d = addDays(today, n);
              return (
                <button
                  key={n}
                  type="button"
                  className={`flex-1 rounded-xl border py-2.5 text-sm font-semibold ${draft.date === d ? "border-ac bg-ac text-acink" : "border-bd bg-card2"}`}
                  onClick={() => set({ date: d })}
                >
                  {["Bu gün", "Sabah", "Birisi gün"][n]}
                </button>
              );
            })}
          </div>
          <input className="field" type="date" name="date" value={draft.date} onChange={(e) => set({ date: e.target.value })} />
        </div>
        <label className="block">
          <span className="label">Saat</span>
          <input className="field text-lg" type="time" name="time" step={300} value={draft.time} onChange={(e) => set({ time: e.target.value })} />
        </label>
      </div>
      {error && <Msg kind="err">{error}</Msg>}
      {conflict ? (
        <>
          <Msg kind="warn">⚠️ {conflict} Başqa saat seçin və ya yenə də əlavə edin.</Msg>
          <button type="button" className="btn-ghost mt-3 w-full" disabled={pending} onClick={() => save(true)}>
            Yenə də əlavə et
          </button>
        </>
      ) : (
        <button type="button" className="btn mt-4 w-full text-lg" disabled={pending || !complete} onClick={() => save()}>
          {pending ? "Gözləyin..." : draft.id ? "Yadda saxla" : "✓ Təsdiq et"}
        </button>
      )}
      {draft.id && (
        <button
          type="button"
          className="mt-3 w-full py-3 text-sm font-semibold text-bad"
          disabled={pending}
          onClick={() => {
            if (!confirm("Randevu silinsin?")) return;
            start(async () => {
              await deleteAppointmentAction(draft.id!);
              onDeleted();
            });
          }}
        >
          Randevunu sil
        </button>
      )}
    </Sheet>
  );
}

function PaySheet({ item, onClose, onDone }: { item: ApItem | null; onClose: () => void; onDone: () => void }) {
  const [amount, setAmount] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();
  if (!item) return null;
  const submit = (value: string) =>
    start(async () => {
      const r = await completeAppointmentAction(item.id, value);
      if (r.ok) {
        setAmount("");
        setError(null);
        onDone();
      } else setError(r.error);
    });
  return (
    <Sheet open onClose={onClose} title={`${item.name} gəldi`}>
      <span className="label">Nə qədər ödədi? (gəlirə yazılacaq)</span>
      <div className="mb-3 grid grid-cols-4 gap-2">
        {["10", "12", "15", "20"].map((v) => (
          <button key={v} type="button" className="btn-ghost" onClick={() => setAmount(v)}>
            {v} ₼
          </button>
        ))}
      </div>
      <input
        className="field text-lg"
        inputMode="decimal"
        placeholder="Məbləğ, AZN"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
      />
      {error && <Msg kind="err">{error}</Msg>}
      <button type="button" className="btn mt-4 w-full text-lg" disabled={pending || !amount} onClick={() => submit(amount)}>
        Yadda saxla
      </button>
      <button type="button" className="btn-ghost mt-2 w-full" disabled={pending} onClick={() => submit("")}>
        Məbləğsiz qeyd et
      </button>
    </Sheet>
  );
}

// Mərhələ 1: brauzerin öz nitq tanıması (varsa). Mərhələ 2-də Whisper ilə əvəz olunacaq.
type SR = {
  lang: string;
  interimResults: boolean;
  onresult: (e: { results: { 0: { transcript: string } }[] }) => void;
  onerror: () => void;
  onend: () => void;
  start: () => void;
  stop: () => void;
};

function MicButton({ onText }: { onText: (t: string) => void }) {
  const [rec, setRec] = useState<SR | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  function toggle() {
    if (rec) {
      rec.stop();
      return;
    }
    const W = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = W.SpeechRecognition ?? W.webkitSpeechRecognition;
    if (!Ctor) {
      setMsg("Bu brauzerdə səs tanıma yoxdur. Aşağıda yazın.");
      return;
    }
    const r = new Ctor();
    r.lang = "az-AZ";
    r.interimResults = false;
    r.onresult = (e) => onText(e.results[0][0].transcript);
    r.onerror = () => setMsg("Mikrofona icazə verilmədi. Aşağıda yazın.");
    r.onend = () => setRec(null);
    setMsg(null);
    setRec(r);
    try {
      r.start();
    } catch {
      setRec(null);
      setMsg("Mikrofon işə düşmədi. Aşağıda yazın.");
    }
  }
  return (
    <>
      <button
        type="button"
        onClick={toggle}
        aria-label={rec ? "Dayandır" : "Danış"}
        className={`mx-auto flex h-20 w-20 items-center justify-center rounded-full text-3xl ${rec ? "rec bg-bad text-white shadow-[0_0_0_12px_rgba(255,107,107,.2)]" : "bg-ac text-acink shadow-[0_0_0_8px_rgba(245,185,66,.15)]"}`}
      >
        🎤
      </button>
      <p className="mb-3 mt-3 text-sm text-mut">{msg ?? (rec ? "Dinləyirəm... danış" : "Mikrofona bas və de, ya da aşağıda yaz")}</p>
    </>
  );
}
