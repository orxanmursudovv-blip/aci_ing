import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getDb } from "@/db";
import { barberFromToken } from "./auth-core";

export const COOKIE = "berber_session";

export const getBarber = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  return barberFromToken(getDb(), token);
});

/** Server action / səhifə üçün: giriş yoxdursa /giris-ə yönləndirir. */
export async function requireBarber() {
  const b = await getBarber();
  if (!b) redirect("/giris");
  return b;
}
