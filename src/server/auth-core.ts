// Telefon + 4 rəqəmli PIN ilə giriş. PIN scrypt ilə hash-lənir.
// 5 səhv cəhddən sonra hesab 15 dəqiqəlik bloklanır.
import { createHash, randomBytes, scrypt as _scrypt, timingSafeEqual } from "node:crypto";
import { promisify } from "node:util";
import { and, eq, gt } from "drizzle-orm";
import type { DB } from "@/db";
import { barbers, sessions } from "@/db/schema";

const scrypt = promisify(_scrypt) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

export const MAX_ATTEMPTS = 5;
export const LOCK_MINUTES = 15;
export const SESSION_DAYS = 90;

export function isValidPin(pin: string) {
  return /^\d{4}$/.test(pin);
}

export async function hashPin(pin: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(pin, salt, 32);
  return `${salt.toString("hex")}:${hash.toString("hex")}`;
}

export async function verifyPin(pin: string, stored: string): Promise<boolean> {
  const [saltHex, hashHex] = stored.split(":");
  const hash = await scrypt(pin, Buffer.from(saltHex, "hex"), 32);
  return timingSafeEqual(hash, Buffer.from(hashHex, "hex"));
}

const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function registerBarber(db: DB, data: { phone: string; salonName: string; pin: string }) {
  const [exists] = await db.select({ id: barbers.id }).from(barbers).where(eq(barbers.phone, data.phone));
  if (exists) return { ok: false as const, error: "exists" as const };
  const [b] = await db
    .insert(barbers)
    .values({ phone: data.phone, salonName: data.salonName.trim(), pinHash: await hashPin(data.pin) })
    .returning();
  return { ok: true as const, barber: b };
}

export async function login(db: DB, phone: string, pin: string, now = new Date()) {
  const [b] = await db.select().from(barbers).where(eq(barbers.phone, phone));
  if (!b) return { ok: false as const, error: "invalid" as const };
  if (b.lockedUntil && b.lockedUntil > now) return { ok: false as const, error: "locked" as const };
  if (!(await verifyPin(pin, b.pinHash))) {
    const attempts = b.failedAttempts + 1;
    const locked = attempts >= MAX_ATTEMPTS;
    await db
      .update(barbers)
      .set({
        failedAttempts: locked ? 0 : attempts,
        lockedUntil: locked ? new Date(now.getTime() + LOCK_MINUTES * 60000) : null,
      })
      .where(eq(barbers.id, b.id));
    return { ok: false as const, error: locked ? ("locked" as const) : ("invalid" as const) };
  }
  await db.update(barbers).set({ failedAttempts: 0, lockedUntil: null }).where(eq(barbers.id, b.id));
  return { ok: true as const, barber: b };
}

export async function createSession(db: DB, barberId: string) {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400000);
  await db.insert(sessions).values({ id: sha256(token), barberId, expiresAt });
  return { token, expiresAt };
}

export async function barberFromToken(db: DB, token: string) {
  const [row] = await db
    .select({ id: barbers.id, phone: barbers.phone, salonName: barbers.salonName })
    .from(sessions)
    .innerJoin(barbers, eq(barbers.id, sessions.barberId))
    .where(and(eq(sessions.id, sha256(token)), gt(sessions.expiresAt, new Date())));
  return row ?? null;
}

export async function destroySession(db: DB, token: string) {
  await db.delete(sessions).where(eq(sessions.id, sha256(token)));
}

export async function resetPin(db: DB, phone: string, pin: string) {
  const rows = await db
    .update(barbers)
    .set({ pinHash: await hashPin(pin), failedAttempts: 0, lockedUntil: null })
    .where(eq(barbers.phone, phone))
    .returning({ id: barbers.id });
  if (rows.length) await db.delete(sessions).where(eq(sessions.barberId, rows[0].id));
  return rows.length > 0;
}
