import { getDb } from "@/db";
import { listAppointments } from "@/server/repo";
import { requireBarber } from "@/server/session";
import { addDays, bakuDate, bakuTime, bakuToUtc, isValidDate } from "@/lib/time";
import { AppointmentsView, type ApItem } from "./AppointmentsView";

export default async function AppointmentsPage({ searchParams }: { searchParams: Promise<{ gun?: string }> }) {
  const b = await requireBarber();
  const today = bakuDate();
  const sp = await searchParams;
  const selected = sp.gun && isValidDate(sp.gun) ? sp.gun : today;
  // 10 günlük zolaq bu gündən başlayır; seçilən gün onun xaricindədirsə, ondan başlayır
  const start = selected >= today && selected <= addDays(today, 9) ? today : selected;
  const rows = await listAppointments(getDb(), b.id, {
    from: bakuToUtc(start),
    to: bakuToUtc(addDays(start, 10)),
  });
  const items: ApItem[] = rows.map((r) => ({
    id: r.id,
    date: bakuDate(r.startsAt),
    time: bakuTime(r.startsAt),
    status: r.status,
    clientId: r.clientId,
    name: r.clientName,
    phone: r.clientPhone,
    optOut: r.clientOptOut,
  }));
  return <AppointmentsView key={start} today={today} start={start} selected={selected} items={items} salon={b.salonName} />;
}
