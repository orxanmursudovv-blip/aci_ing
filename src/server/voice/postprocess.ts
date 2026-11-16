// LLM nəticəsini yoxlayır və qaydalarımızı deterministik tətbiq edir.
// LLM səhv etsə belə: yanlış tarix/saat atılır, 1–7 qaydası təmin olunur.
import { isValidDate, isValidTime, pad } from "@/lib/time";
import type { ParsedAppointment } from "@/lib/parse";

export type Extraction = {
  intent: "create_appointment" | "unclear";
  name: string | null;
  date: string | null;
  time: string | null;
  question: string | null;
};

const lower = (s: string) => s.toLocaleLowerCase("az");

export function postprocess(x: Extraction, transcript: string): ParsedAppointment & { question: string | null } {
  let name = x.name?.trim().replace(/\s+/g, " ").slice(0, 60) || null;
  if (name) name = name.charAt(0).toLocaleUpperCase("az") + name.slice(1);
  const date = x.date && isValidDate(x.date) ? x.date : null;
  let time = x.time && isValidTime(x.time) ? x.time : null;

  // Berber qaydası: 1–7 → günorta sonrası, "səhər"/"gecə" deyilməyibsə və
  // saat açıq 24 saat formatında (07:30 kimi sıfırla) yazılmayıbsa.
  if (time) {
    const h = +time.slice(0, 2);
    const t = lower(transcript);
    const morning = /səhər|gecə/.test(t);
    const explicitZero = new RegExp(`\\b0${h}[:.]\\d{2}`).test(t);
    if (h >= 1 && h <= 7 && !morning && !explicitZero) time = `${pad(h + 12)}${time.slice(2)}`;
  }

  let question = x.question?.trim() || null;
  if (!question && (!name || !time)) {
    const miss = [!name && "müştərinin adını", !time && "saatı"].filter(Boolean).join(" və ");
    question = `Bağışlayın, ${miss} başa düşmədim. Zəhmət olmasa yazın.`;
  }
  if (name && time) question = null;
  return { name, date, time, question };
}
