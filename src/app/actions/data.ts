"use server";
// Bütün mutasiyalar buradan keçir. barberId HƏMİŞƏ sessiyadan götürülür,
// heç vaxt client-dən gəlmir.
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import * as repo from "@/server/repo";
import { requireBarber } from "@/server/session";
import { normalizePhone } from "@/lib/phone";
import { parseAmount } from "@/lib/money";
import { bakuToUtc, isValidDate, isValidTime } from "@/lib/time";

export type ActionResult = { ok: true } | { ok: false; error: string; conflict?: string };

const fail = (error: string, conflict?: string): ActionResult => ({ ok: false, error, conflict });
const done = (...paths: string[]): ActionResult => {
  for (const p of paths) revalidatePath(p);
  return { ok: true };
};

function cleanName(s: unknown) {
  return String(s ?? "").trim().replace(/\s+/g, " ").slice(0, 60);
}

function readPhone(raw: unknown): { phone: string | null; bad: boolean } {
  const s = String(raw ?? "").trim();
  if (!s) return { phone: null, bad: false };
  const phone = normalizePhone(s);
  return { phone, bad: !phone };
}

// ---------- Müştərilər ----------

export async function searchClientsAction(q: string) {
  const b = await requireBarber();
  return repo.searchClients(getDb(), b.id, String(q).slice(0, 40));
}

export async function saveClientAction(input: {
  id?: string;
  name: string;
  phone: string;
  optOut?: boolean;
}): Promise<ActionResult> {
  const b = await requireBarber();
  const name = cleanName(input.name);
  if (!name) return fail("Adı yazın");
  const { phone, bad } = readPhone(input.phone);
  if (bad) return fail("Telefon nömrəsi düzgün deyil");
  const db = getDb();
  if (input.id) {
    const ok = await repo.updateClient(db, b.id, input.id, { name, phone, optOut: !!input.optOut });
    if (!ok) return fail("Müştəri tapılmadı");
  } else {
    await repo.resolveClient(db, b.id, { name, phone });
  }
  return done("/musteriler", "/");
}

export async function deleteClientAction(id: string): Promise<ActionResult> {
  const b = await requireBarber();
  if (!(await repo.deleteClient(getDb(), b.id, id))) return fail("Müştəri tapılmadı");
  return done("/musteriler", "/", "/veresiye");
}

// ---------- Randevular ----------

export async function saveAppointmentAction(input: {
  id?: string;
  clientId?: string | null;
  name: string;
  phone: string;
  date: string;
  time: string;
  force?: boolean;
}): Promise<ActionResult> {
  const b = await requireBarber();
  const name = cleanName(input.name);
  if (!name) return fail("Müştərinin adını yazın");
  if (!isValidDate(input.date)) return fail("Günü seçin");
  if (!isValidTime(input.time)) return fail("Saatı seçin");
  const { phone, bad } = readPhone(input.phone);
  if (bad) return fail("Telefon nömrəsi düzgün deyil");

  const db = getDb();
  const startsAt = bakuToUtc(input.date, input.time);
  if (!input.force) {
    const c = await repo.findConflict(db, b.id, startsAt, input.id);
    if (c) return fail(`${input.time} saatında artıq ${c.clientName} var.`, c.clientName);
  }
  const client = await repo.resolveClient(db, b.id, { clientId: input.clientId, name, phone });
  if (input.id) {
    const ok = await repo.updateAppointment(db, b.id, input.id, { clientId: client.id, startsAt });
    if (!ok) return fail("Randevu tapılmadı");
  } else {
    await repo.createAppointment(db, b.id, { clientId: client.id, startsAt });
  }
  return done("/", "/musteriler");
}

export async function deleteAppointmentAction(id: string): Promise<ActionResult> {
  const b = await requireBarber();
  if (!(await repo.deleteAppointment(getDb(), b.id, id))) return fail("Randevu tapılmadı");
  return done("/", "/maliyye");
}

export async function completeAppointmentAction(id: string, amount: string): Promise<ActionResult> {
  const b = await requireBarber();
  let cents: number | null = null;
  if (String(amount).trim()) {
    cents = parseAmount(amount);
    if (!cents) return fail("Məbləğ düzgün deyil");
  }
  if (!(await repo.completeAppointment(getDb(), b.id, id, cents))) return fail("Randevu tapılmadı");
  return done("/", "/maliyye");
}

export async function reopenAppointmentAction(id: string): Promise<ActionResult> {
  const b = await requireBarber();
  if (!(await repo.reopenAppointment(getDb(), b.id, id))) return fail("Randevu tapılmadı");
  return done("/", "/maliyye");
}

// ---------- Gəlir-gedir ----------

export async function addTransactionAction(input: {
  kind: "income" | "expense";
  amount: string;
  description: string;
}): Promise<ActionResult> {
  const b = await requireBarber();
  if (input.kind !== "income" && input.kind !== "expense") return fail("Yanlış növ");
  const cents = parseAmount(input.amount);
  if (!cents) return fail("Məbləği yazın");
  const description = String(input.description ?? "").trim().slice(0, 80) || (input.kind === "income" ? "Gəlir" : "Xərc");
  await repo.addTransaction(getDb(), b.id, { kind: input.kind, amountCents: cents, description });
  return done("/maliyye");
}

export async function deleteTransactionAction(id: string): Promise<ActionResult> {
  const b = await requireBarber();
  if (!(await repo.deleteTransaction(getDb(), b.id, id))) return fail("Silinmədi");
  return done("/maliyye");
}

// ---------- Veresiyə ----------

export async function addDebtAction(input: {
  clientId?: string | null;
  name: string;
  phone: string;
  amount: string;
  note: string;
}): Promise<ActionResult> {
  const b = await requireBarber();
  const name = cleanName(input.name);
  if (!name) return fail("Müştərinin adını yazın");
  const cents = parseAmount(input.amount);
  if (!cents) return fail("Məbləği yazın");
  const { phone, bad } = readPhone(input.phone);
  if (bad) return fail("Telefon nömrəsi düzgün deyil");
  const db = getDb();
  const client = await repo.resolveClient(db, b.id, { clientId: input.clientId, name, phone });
  await repo.addDebt(db, b.id, { clientId: client.id, amountCents: cents, note: String(input.note ?? "").trim().slice(0, 80) || null });
  return done("/veresiye", "/musteriler");
}

export async function payDebtAction(id: string): Promise<ActionResult> {
  const b = await requireBarber();
  if (!(await repo.payDebt(getDb(), b.id, id))) return fail("Tapılmadı");
  return done("/veresiye", "/maliyye", "/musteriler");
}

export async function unpayDebtAction(id: string): Promise<ActionResult> {
  const b = await requireBarber();
  if (!(await repo.unpayDebt(getDb(), b.id, id))) return fail("Tapılmadı");
  return done("/veresiye", "/maliyye", "/musteriler");
}

export async function deleteDebtAction(id: string): Promise<ActionResult> {
  const b = await requireBarber();
  if (!(await repo.deleteDebt(getDb(), b.id, id))) return fail("Tapılmadı");
  return done("/veresiye", "/musteriler");
}
