import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { createDb, type DB } from "@/db";
import * as repo from "./repo";
import * as auth from "./auth-core";
import { bakuDayRange, bakuToUtc } from "@/lib/time";

const url = process.env.TEST_DATABASE_URL ?? "postgres://berber:berber@localhost:5432/berber_test";
let db: DB;
let A: string;
let B: string;

beforeAll(() => {
  db = createDb(url);
});
afterAll(async () => {
  await (db as unknown as { $client: { end: () => Promise<void> } }).$client.end();
});
beforeEach(async () => {
  await db.execute(sql`truncate barbers cascade`);
  const a = await auth.registerBarber(db, { phone: "+994501111111", salonName: "Ramazan", pin: "1234" });
  const b = await auth.registerBarber(db, { phone: "+994502222222", salonName: "Tural", pin: "5678" });
  if (!a.ok || !b.ok) throw new Error("setup");
  A = a.barber.id;
  B = b.barber.id;
});

describe("tenant izolyasiyası", () => {
  it("B berberi A-nın randevularını, müştərilərini, maliyyəsini görmür", async () => {
    const c = await repo.resolveClient(db, A, { name: "Şafak", phone: "+994551234567" });
    await repo.createAppointment(db, A, { clientId: c.id, startsAt: bakuToUtc("2026-11-17", "08:00") });
    await repo.addTransaction(db, A, { kind: "income", amountCents: 1500, description: "Saç" });
    await repo.addDebt(db, A, { clientId: c.id, amountCents: 2000 });

    const range = { from: new Date(0), to: new Date("2100-01-01") };
    expect(await repo.listAppointments(db, A, range)).toHaveLength(1);
    expect(await repo.listAppointments(db, B, range)).toHaveLength(0);
    expect(await repo.listClients(db, B)).toHaveLength(0);
    expect(await repo.searchClients(db, B, "Şa")).toHaveLength(0);
    expect(await repo.listTransactions(db, B, range)).toHaveLength(0);
    expect(await repo.listDebts(db, B)).toHaveLength(0);
    expect((await repo.summarize(db, B, range)).income).toBe(0);
  });

  it("B berberi A-nın datasını dəyişə və silə bilmir", async () => {
    const c = await repo.resolveClient(db, A, { name: "Şafak" });
    const ap = await repo.createAppointment(db, A, { clientId: c.id, startsAt: bakuToUtc("2026-11-17", "08:00") });
    const tx = await repo.addTransaction(db, A, { kind: "income", amountCents: 1500, description: "Saç" });
    const d = await repo.addDebt(db, A, { clientId: c.id, amountCents: 2000 });

    expect(await repo.deleteAppointment(db, B, ap.id)).toBe(false);
    expect(await repo.updateAppointment(db, B, ap.id, { note: "hack" })).toBe(false);
    expect(await repo.completeAppointment(db, B, ap.id, 1000)).toBe(false);
    expect(await repo.deleteTransaction(db, B, tx.id)).toBe(false);
    expect(await repo.payDebt(db, B, d.id)).toBe(false);
    expect(await repo.deleteDebt(db, B, d.id)).toBe(false);
    expect(await repo.updateClient(db, B, c.id, { name: "X" })).toBe(false);
    expect(await repo.deleteClient(db, B, c.id)).toBe(false);
    expect(await repo.getClient(db, B, c.id)).toBeNull();
    // B A-nın müştərisinə randevu/borc bağlaya bilmir
    await expect(repo.createAppointment(db, B, { clientId: c.id, startsAt: new Date() })).rejects.toThrow();
    await expect(repo.addDebt(db, B, { clientId: c.id, amountCents: 1 })).rejects.toThrow();
    // resolveClient B üçün A-nın clientId-sini qəbul etmir, yeni müştəri yaradır
    const bc = await repo.resolveClient(db, B, { clientId: c.id, name: "Şafak" });
    expect(bc.id).not.toBe(c.id);
    expect(bc.barberId).toBe(B);

    const range = { from: new Date(0), to: new Date("2100-01-01") };
    const aps = await repo.listAppointments(db, A, range);
    expect(aps).toHaveLength(1);
    expect(aps[0].note).toBeNull();
    expect(aps[0].status).toBe("scheduled");
  });
});

describe("müştərilər", () => {
  it("təkrar ad → eyni müştəri və nömrə", async () => {
    const c1 = await repo.resolveClient(db, A, { name: "Şafak", phone: "+994551234567" });
    const c2 = await repo.resolveClient(db, A, { name: "şafak" });
    expect(c2.id).toBe(c1.id);
    expect(c2.phone).toBe("+994551234567");
    const found = await repo.searchClients(db, A, "şaf");
    expect(found[0].phone).toBe("+994551234567");
  });
  it("nömrəsiz müştəriyə sonradan nömrə yazılır", async () => {
    const c1 = await repo.resolveClient(db, A, { name: "Elvin" });
    const c2 = await repo.resolveClient(db, A, { name: "Elvin", phone: "+994551112233" });
    expect(c2.id).toBe(c1.id);
    expect((await repo.getClient(db, A, c1.id))?.phone).toBe("+994551112233");
  });
  it("eyni ad, fərqli nömrə → fərqli müştəri", async () => {
    const c1 = await repo.resolveClient(db, A, { name: "Elvin", phone: "+994551112233" });
    const c2 = await repo.resolveClient(db, A, { name: "Elvin", phone: "+994559998877" });
    expect(c2.id).not.toBe(c1.id);
  });
});

describe("randevu", () => {
  it("eyni saatda konflikt tapılır", async () => {
    const c = await repo.resolveClient(db, A, { name: "Şafak" });
    const t = bakuToUtc("2026-11-17", "08:00");
    await repo.createAppointment(db, A, { clientId: c.id, startsAt: t });
    expect((await repo.findConflict(db, A, t))?.clientName).toBe("Şafak");
    expect(await repo.findConflict(db, B, t)).toBeNull();
    expect(await repo.findConflict(db, A, bakuToUtc("2026-11-17", "08:30"))).toBeNull();
  });
  it("Baku günü sərhədləri: 00:30 Baku həmin günə düşür", async () => {
    const c = await repo.resolveClient(db, A, { name: "Gecə" });
    await repo.createAppointment(db, A, { clientId: c.id, startsAt: bakuToUtc("2026-11-17", "00:30") });
    expect(await repo.listAppointments(db, A, bakuDayRange("2026-11-17"))).toHaveLength(1);
    expect(await repo.listAppointments(db, A, bakuDayRange("2026-11-16"))).toHaveLength(0);
  });
  it("Gəldi → gəlir, geri al → gəlir silinir", async () => {
    const c = await repo.resolveClient(db, A, { name: "Murad" });
    const ap = await repo.createAppointment(db, A, { clientId: c.id, startsAt: new Date() });
    expect(await repo.completeAppointment(db, A, ap.id, 1200)).toBe(true);
    expect(await repo.completeAppointment(db, A, ap.id, 1200)).toBe(false); // iki dəfə yazılmır
    const range = { from: new Date(0), to: new Date("2100-01-01") };
    expect((await repo.summarize(db, A, range)).income).toBe(1200);
    await repo.reopenAppointment(db, A, ap.id);
    expect((await repo.summarize(db, A, range)).income).toBe(0);
  });
});

describe("veresiyə", () => {
  it("ödənəndə avtomatik gəlirə yazılır, geri alınanda silinir", async () => {
    const c = await repo.resolveClient(db, A, { name: "Rövşən" });
    const d = await repo.addDebt(db, A, { clientId: c.id, amountCents: 2000 });
    const range = { from: new Date(0), to: new Date("2100-01-01") };
    expect(await repo.payDebt(db, A, d.id)).toBe(true);
    expect(await repo.payDebt(db, A, d.id)).toBe(false);
    let s = await repo.summarize(db, A, range);
    expect(s.income).toBe(2000);
    const txs = await repo.listTransactions(db, A, range);
    expect(txs[0].source).toBe("debt");
    // borc gəliri maliyyə ekranından silinmir
    expect(await repo.deleteTransaction(db, A, txs[0].id)).toBe(false);
    expect(await repo.unpayDebt(db, A, d.id)).toBe(true);
    s = await repo.summarize(db, A, range);
    expect(s.income).toBe(0);
  });
  it("xalis = gəlir − xərc", async () => {
    await repo.addTransaction(db, A, { kind: "income", amountCents: 1800, description: "Saç + saqqal" });
    await repo.addTransaction(db, A, { kind: "expense", amountCents: 1500, description: "Ülgü" });
    const s = await repo.summarize(db, A, { from: new Date(0), to: new Date("2100-01-01") });
    expect(s).toEqual({ income: 1800, expense: 1500, net: 300 });
  });
});

describe("giriş", () => {
  it("düzgün və səhv PIN", async () => {
    expect((await auth.login(db, "+994501111111", "1234")).ok).toBe(true);
    expect((await auth.login(db, "+994501111111", "0000")).ok).toBe(false);
    expect((await auth.login(db, "+994509999999", "1234")).ok).toBe(false);
  });
  it("eyni nömrə ilə ikinci qeydiyyat olmur", async () => {
    const r = await auth.registerBarber(db, { phone: "+994501111111", salonName: "X", pin: "1111" });
    expect(r.ok).toBe(false);
  });
  it("5 səhv cəhd → bloklanır (düzgün PIN də keçmir)", async () => {
    for (let i = 0; i < 4; i++) expect((await auth.login(db, "+994501111111", "0000")).error).toBe("invalid");
    expect((await auth.login(db, "+994501111111", "0000")).error).toBe("locked");
    expect((await auth.login(db, "+994501111111", "1234")).error).toBe("locked");
    const later = new Date(Date.now() + 16 * 60000);
    expect((await auth.login(db, "+994501111111", "1234", later)).ok).toBe(true);
  });
  it("sessiya token → yalnız öz berberi", async () => {
    const s = await auth.createSession(db, A);
    expect((await auth.barberFromToken(db, s.token))?.id).toBe(A);
    expect(await auth.barberFromToken(db, "yanlış")).toBeNull();
    await auth.destroySession(db, s.token);
    expect(await auth.barberFromToken(db, s.token)).toBeNull();
  });
});
