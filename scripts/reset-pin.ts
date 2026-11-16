// İstifadə: npm run reset-pin -- 0501234567 1234
import "dotenv/config";
import { createDb } from "../src/db";
import { resetPin, isValidPin } from "../src/server/auth-core";
import { normalizePhone } from "../src/lib/phone";

async function main() {
  const [rawPhone, pin] = process.argv.slice(2);
  const phone = normalizePhone(rawPhone);
  if (!phone || !pin || !isValidPin(pin)) {
    console.error("İstifadə: npm run reset-pin -- <telefon> <4 rəqəmli PIN>");
    process.exit(1);
  }
  const db = createDb(process.env.DATABASE_URL!);
  const ok = await resetPin(db, phone, pin);
  console.log(ok ? "PIN yeniləndi, köhnə sessiyalar silindi." : "Bu nömrə ilə hesab tapılmadı.");
  process.exit(ok ? 0 : 1);
}
main();
