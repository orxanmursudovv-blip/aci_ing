import Link from "next/link";
import { requireBarber } from "@/server/session";
import { Tabs } from "@/components/Tabs";
import { bakuDate, humanDate, WD_FULL, weekday } from "@/lib/time";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const b = await requireBarber();
  const today = bakuDate();
  return (
    <div className="mx-auto w-full max-w-[460px] px-4 pb-16 pt-[max(1rem,env(safe-area-inset-top))]">
      <header className="mb-4 flex items-center justify-between">
        <h1 className="text-xl font-bold">
          💈 {b.salonName}
          <small className="mt-0.5 block text-sm font-normal text-mut">
            {humanDate(today)} {today.slice(0, 4)} · {WD_FULL[weekday(today)]}
          </small>
        </h1>
        <Link href="/ayarlar" className="icon-btn" aria-label="Ayarlar">⚙️</Link>
      </header>
      <Tabs />
      {children}
    </div>
  );
}
