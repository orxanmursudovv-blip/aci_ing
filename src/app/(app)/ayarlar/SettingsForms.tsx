"use client";
import { useActionState } from "react";
import { changePinAction, updateSalonAction } from "@/app/actions/auth";
import { PinInput } from "@/components/PinInput";
import { Msg } from "@/components/Msg";

export function SettingsForms({ salonName }: { salonName: string }) {
  const [s1, a1, p1] = useActionState(updateSalonAction, undefined);
  const [s2, a2, p2] = useActionState(changePinAction, undefined);
  return (
    <>
      <form action={a1} className="card space-y-3">
        <label className="block">
          <span className="label">Salonun adı (WhatsApp mesajında görünür)</span>
          <input className="field" name="salonName" defaultValue={salonName} maxLength={60} required />
        </label>
        {s1?.error && <Msg kind="err">{s1.error}</Msg>}
        {s1?.ok && <Msg kind="ok">{s1.ok}</Msg>}
        <button className="btn w-full" disabled={p1}>Yadda saxla</button>
      </form>
      <form action={a2} className="card space-y-3">
        <h3 className="font-semibold">PIN-i dəyiş</h3>
        <PinInput name="current" label="Hazırkı PIN" />
        <PinInput name="pin" label="Yeni PIN" />
        <PinInput name="pin2" label="Yeni PIN təkrar" />
        {s2?.error && <Msg kind="err">{s2.error}</Msg>}
        {s2?.ok && <Msg kind="ok">{s2.ok}</Msg>}
        <button className="btn-ghost w-full" disabled={p2}>PIN-i dəyiş</button>
      </form>
    </>
  );
}
