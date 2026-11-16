// Bütün data girişi buradan keçir. HƏR funksiya barberId alır və HƏR sorğu
// onunla filtrlənir — bir berber digərinin datasını görə və dəyişə bilməz.
import { and, asc, desc, eq, gte, ilike, isNull, lt, ne, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { appointments, clients, debts, transactions } from "@/db/schema";

type Range = { from: Date; to: Date };

// ---------------- Müştərilər ----------------

export async function searchClients(db: DB, barberId: string, q: string, limit = 8) {
  const term = q.trim();
  if (!term) return [];
  return db
    .select({ id: clients.id, name: clients.name, phone: clients.phone })
    .from(clients)
    .where(and(eq(clients.barberId, barberId), ilike(clients.name, `${escapeLike(term)}%`)))
    .orderBy(asc(clients.name))
    .limit(limit);
}

function escapeLike(s: string) {
  return s.replace(/[\\%_]/g, (c) => "\\" + c);
}

export async function getClient(db: DB, barberId: string, id: string) {
  const [c] = await db
    .select()
    .from(clients)
    .where(and(eq(clients.barberId, barberId), eq(clients.id, id)));
  return c ?? null;
}

/**
 * Müştərini tapır və ya yaradır:
 *  1) clientId verilibsə — yalnız bu berberə aiddirsə istifadə olunur;
 *  2) telefon verilibsə — həmin telefonla müştəri axtarılır;
 *  3) eyni adlı (böyük/kiçik hərf fərqsiz) tək müştəri varsa — o götürülür
 *     (telefonu yoxdursa, yenisi yazılır; fərqli telefonu varsa — yeni müştəri);
 *  4) əks halda yeni müştəri.
 */
export async function resolveClient(
  db: DB,
  barberId: string,
  input: { clientId?: string | null; name: string; phone?: string | null },
) {
  const name = input.name.trim();
  const phone = input.phone ?? null;
  if (input.clientId) {
    const c = await getClient(db, barberId, input.clientId);
    if (c) {
      if (phone && c.phone !== phone) {
        await db
          .update(clients)
          .set({ phone })
          .where(and(eq(clients.barberId, barberId), eq(clients.id, c.id)));
        c.phone = phone;
      }
      return c;
    }
  }
  if (phone) {
    const [byPhone] = await db
      .select()
      .from(clients)
      .where(and(eq(clients.barberId, barberId), eq(clients.phone, phone)));
    if (byPhone) return byPhone;
  }
  const sameName = await db
    .select()
    .from(clients)
    .where(and(eq(clients.barberId, barberId), sql`lower(${clients.name}) = lower(${name})`));
  if (sameName.length === 1) {
    const c = sameName[0];
    if (!phone || c.phone === phone) return c;
    if (!c.phone) {
      await db
        .update(clients)
        .set({ phone })
        .where(and(eq(clients.barberId, barberId), eq(clients.id, c.id)));
      return { ...c, phone };
    }
  }
  const [created] = await db.insert(clients).values({ barberId, name, phone }).returning();
  return created;
}

export async function listClients(db: DB, barberId: string) {
  return db
    .select({
      id: clients.id,
      name: clients.name,
      phone: clients.phone,
      optOut: clients.optOut,
      visits: sql<number>`(select count(*)::int from ${appointments} a where a.client_id = ${clients.id} and a.barber_id = ${barberId})`,
      debtCents: sql<number>`(select coalesce(sum(d.amount_cents),0)::int from ${debts} d where d.client_id = ${clients.id} and d.barber_id = ${barberId} and d.paid_at is null)`,
    })
    .from(clients)
    .where(eq(clients.barberId, barberId))
    .orderBy(asc(clients.name));
}

export async function updateClient(
  db: DB,
  barberId: string,
  id: string,
  data: { name?: string; phone?: string | null; optOut?: boolean },
) {
  const rows = await db
    .update(clients)
    .set(data)
    .where(and(eq(clients.barberId, barberId), eq(clients.id, id)))
    .returning({ id: clients.id });
  return rows.length > 0;
}

export async function deleteClient(db: DB, barberId: string, id: string) {
  const rows = await db
    .delete(clients)
    .where(and(eq(clients.barberId, barberId), eq(clients.id, id)))
    .returning({ id: clients.id });
  return rows.length > 0;
}

// ---------------- Randevular ----------------

export async function listAppointments(db: DB, barberId: string, range: Range) {
  return db
    .select({
      id: appointments.id,
      startsAt: appointments.startsAt,
      status: appointments.status,
      note: appointments.note,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
      clientOptOut: clients.optOut,
    })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.barberId, barberId),
        gte(appointments.startsAt, range.from),
        lt(appointments.startsAt, range.to),
      ),
    )
    .orderBy(asc(appointments.startsAt));
}

export async function findConflict(db: DB, barberId: string, startsAt: Date, excludeId?: string) {
  const [row] = await db
    .select({ id: appointments.id, clientName: clients.name })
    .from(appointments)
    .innerJoin(clients, eq(clients.id, appointments.clientId))
    .where(
      and(
        eq(appointments.barberId, barberId),
        eq(appointments.startsAt, startsAt),
        excludeId ? ne(appointments.id, excludeId) : undefined,
      ),
    )
    .limit(1);
  return row ?? null;
}

export async function createAppointment(
  db: DB,
  barberId: string,
  data: { clientId: string; startsAt: Date; note?: string | null },
) {
  // clientId bu berberə aid olmalıdır
  const c = await getClient(db, barberId, data.clientId);
  if (!c) throw new Error("client_not_found");
  const [row] = await db
    .insert(appointments)
    .values({ barberId, clientId: c.id, startsAt: data.startsAt, note: data.note ?? null })
    .returning();
  return row;
}

export async function updateAppointment(
  db: DB,
  barberId: string,
  id: string,
  data: { clientId?: string; startsAt?: Date; note?: string | null },
) {
  if (data.clientId) {
    const c = await getClient(db, barberId, data.clientId);
    if (!c) throw new Error("client_not_found");
  }
  const rows = await db
    .update(appointments)
    .set(data)
    .where(and(eq(appointments.barberId, barberId), eq(appointments.id, id)))
    .returning({ id: appointments.id });
  return rows.length > 0;
}

export async function deleteAppointment(db: DB, barberId: string, id: string) {
  const rows = await db
    .delete(appointments)
    .where(and(eq(appointments.barberId, barberId), eq(appointments.id, id)))
    .returning({ id: appointments.id });
  return rows.length > 0;
}

/** "Gəldi" — randevunu tamamlayır, məbləğ verilibsə gəlirə yazır. */
export async function completeAppointment(db: DB, barberId: string, id: string, amountCents: number | null) {
  return db.transaction(async (tx) => {
    const [a] = await tx
      .select({ id: appointments.id, status: appointments.status, clientName: clients.name })
      .from(appointments)
      .innerJoin(clients, eq(clients.id, appointments.clientId))
      .where(and(eq(appointments.barberId, barberId), eq(appointments.id, id)));
    if (!a || a.status === "done") return false;
    await tx
      .update(appointments)
      .set({ status: "done" })
      .where(and(eq(appointments.barberId, barberId), eq(appointments.id, id)));
    if (amountCents && amountCents > 0) {
      await tx.insert(transactions).values({
        barberId,
        kind: "income",
        amountCents,
        description: a.clientName,
        source: "appointment",
        appointmentId: id,
      });
    }
    return true;
  });
}

export async function reopenAppointment(db: DB, barberId: string, id: string) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .update(appointments)
      .set({ status: "scheduled" })
      .where(and(eq(appointments.barberId, barberId), eq(appointments.id, id)))
      .returning({ id: appointments.id });
    if (!rows.length) return false;
    await tx
      .delete(transactions)
      .where(and(eq(transactions.barberId, barberId), eq(transactions.appointmentId, id)));
    return true;
  });
}

// ---------------- Gəlir-gedir ----------------

export async function listTransactions(db: DB, barberId: string, range: Range) {
  return db
    .select()
    .from(transactions)
    .where(
      and(
        eq(transactions.barberId, barberId),
        gte(transactions.occurredAt, range.from),
        lt(transactions.occurredAt, range.to),
      ),
    )
    .orderBy(desc(transactions.occurredAt));
}

export async function summarize(db: DB, barberId: string, range: Range) {
  const [r] = await db
    .select({
      income: sql<number>`coalesce(sum(case when ${transactions.kind} = 'income' then ${transactions.amountCents} end),0)::int`,
      expense: sql<number>`coalesce(sum(case when ${transactions.kind} = 'expense' then ${transactions.amountCents} end),0)::int`,
    })
    .from(transactions)
    .where(
      and(
        eq(transactions.barberId, barberId),
        gte(transactions.occurredAt, range.from),
        lt(transactions.occurredAt, range.to),
      ),
    );
  return { income: r.income, expense: r.expense, net: r.income - r.expense };
}

export async function addTransaction(
  db: DB,
  barberId: string,
  data: { kind: "income" | "expense"; amountCents: number; description: string; occurredAt?: Date },
) {
  const [row] = await db
    .insert(transactions)
    .values({ barberId, ...data, source: "manual" })
    .returning();
  return row;
}

/** Yalnız əl ilə yazılmış əməliyyat silinir; digərləri öz mənbəyindən geri alınır. */
export async function deleteTransaction(db: DB, barberId: string, id: string) {
  const rows = await db
    .delete(transactions)
    .where(and(eq(transactions.barberId, barberId), eq(transactions.id, id), eq(transactions.source, "manual")))
    .returning({ id: transactions.id });
  return rows.length > 0;
}

// ---------------- Veresiyə ----------------

export async function listDebts(db: DB, barberId: string) {
  return db
    .select({
      id: debts.id,
      amountCents: debts.amountCents,
      note: debts.note,
      createdAt: debts.createdAt,
      paidAt: debts.paidAt,
      clientId: clients.id,
      clientName: clients.name,
      clientPhone: clients.phone,
    })
    .from(debts)
    .innerJoin(clients, eq(clients.id, debts.clientId))
    .where(eq(debts.barberId, barberId))
    .orderBy(sql`${debts.paidAt} is not null`, desc(debts.createdAt));
}

export async function addDebt(
  db: DB,
  barberId: string,
  data: { clientId: string; amountCents: number; note?: string | null },
) {
  const c = await getClient(db, barberId, data.clientId);
  if (!c) throw new Error("client_not_found");
  const [row] = await db
    .insert(debts)
    .values({ barberId, clientId: c.id, amountCents: data.amountCents, note: data.note ?? null })
    .returning();
  return row;
}

/** Ödəniş: veresiyə bağlanır və avtomatik gəlirə yazılır. */
export async function payDebt(db: DB, barberId: string, id: string) {
  return db.transaction(async (tx) => {
    const [d] = await tx
      .select({ id: debts.id, amountCents: debts.amountCents, clientName: clients.name })
      .from(debts)
      .innerJoin(clients, eq(clients.id, debts.clientId))
      .where(and(eq(debts.barberId, barberId), eq(debts.id, id), isNull(debts.paidAt)));
    if (!d) return false;
    const [t] = await tx
      .insert(transactions)
      .values({
        barberId,
        kind: "income",
        amountCents: d.amountCents,
        description: `Veresiyə ödənişi: ${d.clientName}`,
        source: "debt",
      })
      .returning({ id: transactions.id });
    await tx
      .update(debts)
      .set({ paidAt: new Date(), transactionId: t.id })
      .where(and(eq(debts.barberId, barberId), eq(debts.id, id)));
    return true;
  });
}

/** Ödənişi geri al: gəlir qeydi də silinir. */
export async function unpayDebt(db: DB, barberId: string, id: string) {
  return db.transaction(async (tx) => {
    const [d] = await tx
      .select()
      .from(debts)
      .where(and(eq(debts.barberId, barberId), eq(debts.id, id)));
    if (!d || !d.paidAt) return false;
    await tx
      .update(debts)
      .set({ paidAt: null, transactionId: null })
      .where(and(eq(debts.barberId, barberId), eq(debts.id, id)));
    if (d.transactionId) {
      await tx
        .delete(transactions)
        .where(and(eq(transactions.barberId, barberId), eq(transactions.id, d.transactionId)));
    }
    return true;
  });
}

export async function deleteDebt(db: DB, barberId: string, id: string) {
  const rows = await db
    .delete(debts)
    .where(and(eq(debts.barberId, barberId), eq(debts.id, id)))
    .returning({ id: debts.id });
  return rows.length > 0;
}
