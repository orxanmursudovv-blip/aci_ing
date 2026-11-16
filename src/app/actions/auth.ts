"use server";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { createSession, destroySession, isValidPin, login, registerBarber, verifyPin, hashPin } from "@/server/auth-core";
import { COOKIE, requireBarber } from "@/server/session";
import { normalizePhone } from "@/lib/phone";
import { barbers } from "@/db/schema";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";

export type FormState = { error?: string; ok?: string; values?: Record<string, string> } | undefined;

async function setSessionCookie(barberId: string) {
  const s = await createSession(getDb(), barberId);
  (await cookies()).set(COOKIE, s.token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    expires: s.expiresAt,
  });
}

export async function loginAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = { phone: String(fd.get("phone") ?? "") };
  const res = await doLogin(fd);
  return res && { ...res, values };
}

async function doLogin(fd: FormData): Promise<FormState> {
  const phone = normalizePhone(String(fd.get("phone") ?? ""));
  const pin = String(fd.get("pin") ?? "");
  if (!phone) return { error: "Telefon nömrəsi düzgün deyil" };
  if (!isValidPin(pin)) return { error: "PIN 4 rəqəm olmalıdır" };
  const r = await login(getDb(), phone, pin);
  if (!r.ok) {
    return {
      error: r.error === "locked"
        ? "Çox səhv cəhd. 15 dəqiqə sonra yenidən yoxlayın."
        : "Nömrə və ya PIN səhvdir",
    };
  }
  await setSessionCookie(r.barber.id);
  redirect("/");
}

export async function registerAction(_: FormState, fd: FormData): Promise<FormState> {
  const values = { phone: String(fd.get("phone") ?? ""), salonName: String(fd.get("salonName") ?? "") };
  const res = await doRegister(fd);
  return res && { ...res, values };
}

async function doRegister(fd: FormData): Promise<FormState> {
  const salonName = String(fd.get("salonName") ?? "").trim();
  const phone = normalizePhone(String(fd.get("phone") ?? ""));
  const pin = String(fd.get("pin") ?? "");
  const pin2 = String(fd.get("pin2") ?? "");
  if (salonName.length < 2) return { error: "Salonun adını yazın" };
  if (!phone) return { error: "Telefon nömrəsi düzgün deyil" };
  if (!isValidPin(pin)) return { error: "PIN 4 rəqəm olmalıdır" };
  if (pin !== pin2) return { error: "PIN-lər eyni deyil" };
  const r = await registerBarber(getDb(), { phone, salonName: salonName.slice(0, 60), pin });
  if (!r.ok) return { error: "Bu nömrə ilə hesab artıq var. Daxil olun." };
  await setSessionCookie(r.barber.id);
  redirect("/");
}

export async function logoutAction() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) await destroySession(getDb(), token);
  jar.delete(COOKIE);
  redirect("/giris");
}

export async function updateSalonAction(_: FormState, fd: FormData): Promise<FormState> {
  const b = await requireBarber();
  const salonName = String(fd.get("salonName") ?? "").trim();
  if (salonName.length < 2) return { error: "Salonun adını yazın" };
  await getDb().update(barbers).set({ salonName: salonName.slice(0, 60) }).where(eq(barbers.id, b.id));
  revalidatePath("/", "layout");
  return { ok: "Yadda saxlanıldı" };
}

export async function changePinAction(_: FormState, fd: FormData): Promise<FormState> {
  const b = await requireBarber();
  const cur = String(fd.get("current") ?? "");
  const pin = String(fd.get("pin") ?? "");
  const pin2 = String(fd.get("pin2") ?? "");
  const db = getDb();
  const [row] = await db.select().from(barbers).where(eq(barbers.id, b.id));
  if (!row || !(await verifyPin(cur, row.pinHash))) return { error: "Hazırkı PIN səhvdir" };
  if (!isValidPin(pin)) return { error: "Yeni PIN 4 rəqəm olmalıdır" };
  if (pin !== pin2) return { error: "PIN-lər eyni deyil" };
  await db.update(barbers).set({ pinHash: await hashPin(pin) }).where(eq(barbers.id, b.id));
  return { ok: "PIN dəyişdirildi" };
}
