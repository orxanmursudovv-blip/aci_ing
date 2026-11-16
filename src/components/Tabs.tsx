"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/", label: "Randevular" },
  { href: "/maliyye", label: "Gəlir-gedir" },
  { href: "/veresiye", label: "Veresiyə" },
  { href: "/musteriler", label: "Müştərilər" },
];

export function Tabs() {
  const path = usePathname();
  return (
    <nav className="mb-4 flex gap-1 rounded-2xl bg-card p-1">
      {TABS.map((t) => {
        const on = t.href === "/" ? path === "/" : path.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={`flex min-h-11 flex-1 items-center justify-center rounded-xl px-1 text-[13px] font-semibold ${on ? "bg-ac text-acink" : "text-mut"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
