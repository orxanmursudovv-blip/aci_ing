import { requireBarber } from "@/server/session";
import { formatPhone } from "@/lib/phone";
import { SettingsForms } from "./SettingsForms";
import { logoutAction } from "@/app/actions/auth";

export default async function SettingsPage() {
  const b = await requireBarber();
  return (
    <>
      <h2 className="mb-3 text-lg font-bold">Ayarlar</h2>
      <p className="mb-3 text-sm text-mut">Hesab: {formatPhone(b.phone)}</p>
      <SettingsForms salonName={b.salonName} />
      <div className="card">
        <h3 className="mb-2 font-semibold">Ana ekrana əlavə et</h3>
        <p className="text-sm leading-relaxed text-mut">
          <b className="text-tx">Android (Chrome):</b> sağ yuxarıda ⋮ → “Ana ekrana əlavə et”.
          <br />
          <b className="text-tx">iPhone (Safari):</b> aşağıda paylaş düyməsi ⬆️ → “Ana ekrana əlavə et”.
        </p>
      </div>
      <form action={logoutAction}>
        <button className="btn-ghost w-full text-bad">Çıxış</button>
      </form>
    </>
  );
}
