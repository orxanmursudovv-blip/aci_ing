export function Msg({ kind, children }: { kind: "ok" | "err" | "warn"; children: React.ReactNode }) {
  const cls =
    kind === "ok" ? "bg-ok/12 text-ok" : kind === "warn" ? "bg-ac/12 text-ac" : "bg-bad/12 text-bad";
  return <div role={kind === "err" ? "alert" : "status"} className={`mt-3 rounded-xl px-3.5 py-3 text-sm ${cls}`}>{children}</div>;
}
