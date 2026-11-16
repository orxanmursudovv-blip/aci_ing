import { redirect } from "next/navigation";
import { getBarber } from "@/server/session";

export const dynamic = "force-dynamic";

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  if (await getBarber()) redirect("/");
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[420px] flex-col justify-center px-5 py-10">
      <div className="mb-8 text-center">
        <div className="mx-auto mb-3 flex h-20 w-20 items-center justify-center rounded-3xl bg-ac text-4xl">💈</div>
        <h1 className="text-2xl font-bold">Berber Randevu</h1>
        <p className="mt-1 text-mut">Randevu, gəlir-gedir, veresiyə — bir yerdə</p>
      </div>
      {children}
    </div>
  );
}
