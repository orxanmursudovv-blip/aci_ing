import { relativeDate, humanDate } from "./time";

// Azərbaycan dilində yerlik hal şəkilçisi saat üçün: 08:00-da, 15:00-də, 17:30-da
const DIGIT = ["sıfır", "bir", "iki", "üç", "dörd", "beş", "altı", "yeddi", "səkkiz", "doqquz"];
const TENS = ["", "on", "iyirmi", "otuz", "qırx", "əlli"];

function lastWord(n: number): string {
  if (n === 0) return "sıfır";
  if (n % 10 !== 0) return DIGIT[n % 10];
  return TENS[Math.floor(n / 10)];
}
function locative(word: string): string {
  const v = [...word].reverse().find((ch) => "aıoueəiöü".includes(ch)) ?? "a";
  const back = "aıou".includes(v);
  return back ? "da" : "də";
}
export function timeWithLocative(hhmm: string): string {
  const [h, m] = hhmm.split(":").map(Number);
  return `${hhmm}-${locative(m === 0 ? lastWord(h) : lastWord(m))}`;
}

export function reminderText(p: { name: string; date: string; time: string; salon: string; today: string }) {
  const rel = relativeDate(p.date, p.today);
  const when = rel === "bu gün" || rel === "sabah" ? `${rel}, ${humanDate(p.date)}` : rel;
  return `Salam ${p.name}! Xatırlatma: ${when} saat ${timeWithLocative(p.time)} randevunuz var. Hörmətlə, ${p.salon} 💈`;
}

export function debtText(p: { name: string; amount: string; salon: string }) {
  return `Salam ${p.name}! ${p.amount} məbləğində veresiyəniz var. Vaxtınız olanda ödəyərsiniz. Təşəkkürlər, ${p.salon} 💈`;
}
