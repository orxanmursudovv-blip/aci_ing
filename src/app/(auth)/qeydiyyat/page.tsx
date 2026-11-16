"use client";
import Link from "next/link";
import { useActionState } from "react";
import { registerAction } from "@/app/actions/auth";
import { PinInput } from "@/components/PinInput";
import { Msg } from "@/components/Msg";

export default function RegisterPage() {
  const [state, action, pending] = useActionState(registerAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="text-lg font-bold">Yeni hesab</h2>
      <label className="block">
        <span className="label">Salonun adı</span>
        <input className="field" name="salonName" defaultValue={state?.values?.salonName} placeholder="Məs: Berber Ramazan" required maxLength={60} />
      </label>
      <label className="block">
        <span className="label">Telefon nömrəniz</span>
        <input className="field" name="phone" defaultValue={state?.values?.phone} type="tel" inputMode="tel" placeholder="050 123 45 67" autoComplete="tel" required />
      </label>
      <PinInput name="pin" label="PIN seçin (4 rəqəm)" />
      <PinInput name="pin2" label="PIN təkrar" />
      {state?.error && <Msg kind="err">{state.error}</Msg>}
      <button className="btn w-full text-lg" disabled={pending}>{pending ? "Gözləyin..." : "Hesab yarat"}</button>
      <p className="text-center text-sm text-mut">
        Hesabınız var? <Link href="/giris" className="font-semibold text-ac">Daxil ol</Link>
      </p>
    </form>
  );
}
