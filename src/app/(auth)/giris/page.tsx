"use client";
import Link from "next/link";
import { useActionState } from "react";
import { loginAction } from "@/app/actions/auth";
import { PinInput } from "@/components/PinInput";
import { Msg } from "@/components/Msg";

export default function LoginPage() {
  const [state, action, pending] = useActionState(loginAction, undefined);
  return (
    <form action={action} className="card space-y-4 p-5">
      <h2 className="text-lg font-bold">Daxil ol</h2>
      <label className="block">
        <span className="label">Telefon nömrəniz</span>
        <input className="field" name="phone" defaultValue={state?.values?.phone} type="tel" inputMode="tel" placeholder="050 123 45 67" autoComplete="tel" required />
      </label>
      <PinInput name="pin" label="PIN (4 rəqəm)" />
      {state?.error && <Msg kind="err">{state.error}</Msg>}
      <button className="btn w-full text-lg" disabled={pending}>{pending ? "Gözləyin..." : "Daxil ol"}</button>
      <p className="text-center text-sm text-mut">
        Hesabınız yoxdur? <Link href="/qeydiyyat" className="font-semibold text-ac">Qeydiyyat</Link>
      </p>
      <p className="text-center text-xs text-mut">PIN-i unutmusunuzsa, administratorla əlaqə saxlayın.</p>
    </form>
  );
}
