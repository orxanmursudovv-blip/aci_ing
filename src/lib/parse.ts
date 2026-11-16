// Azərbaycanca randevu cümləsinin qayda əsaslı analizi.
// Mərhələ 2-də LLM ilə əvəz/tamamlanacaq; təsdiq ekranı hər iki halda eynidir.
//
// Qaydalar:
//  - 1–7 arası saat günorta sonrası sayılır (3 → 15:00), "səhər" deyilməyibsə.
//  - Ad və ya saat tapılmasa təxmin etmirik: null qaytarırıq, UI soruşur.

import { addDays, pad, weekday, WD_FULL, MONTHS } from "./time";

export type ParsedAppointment = {
  name: string | null;
  date: string | null; // YYYY-MM-DD (Baku)
  time: string | null; // HH:mm
};

// Rəqəm sözləri (saat üçün)
const NUM_WORDS: [string, number][] = [
  ["on bir", 11], ["on iki", 12], ["birinci", 1],
  ["bir", 1], ["iki", 2], ["üç", 3], ["dörd", 4], ["beş", 5], ["altı", 6],
  ["yeddi", 7], ["səkkiz", 8], ["doqquz", 9], ["on", 10],
];

// Saat/gün sözlərinə qoşulan şəkilçilər
const SUFFIX = "(?:-?\\s*(?:ə|a|yə|ya|e|də|da|də|dək|dən|dan|nə|na|na qədər|ə qədər|a qədər|yə qədər|ya qədər|u|ü|ı|i|yu|yü|nu|nü|nı|ni))?";
const WORD_END = "(?=$|[\\s,.!?])";

const FILLER = new Set([
  "randevu", "randevunu", "randevuya", "randevular", "randevusu", "randevum",
  "yaz", "yazın", "yazaq", "yazsın", "qeyd", "əlavə", "et", "elə", "edin", "olsun", "var",
  "gəlir", "gələcək", "gəlsin", "gələn", "üçün", "saat", "saatında", "gün", "günü", "günə",
  "müştəri", "ilə", "salam", "həftə", "həftəyə", "sonra", "səhər", "axşam", "axşamı",
  "günorta", "günortadan", "zəhmət", "olmasa", "bir", "də", "da", "ki", "və", "ayın",
  "yarım", "yarımda", "yarıma", "qədər", "tez", "edək", "eləyin", "qoy", "qoyun",
  "bu", "o", "biri", "üçünə", "ona",
]);
const HONORIFICS = new Set(["müəllim", "bəy", "xanım", "dayı", "qardaş", "əmi", "bacı"]);

const lower = (s: string) => s.toLocaleLowerCase("az");
const capitalize = (w: string) => (w ? w.charAt(0).toLocaleUpperCase("az") + w.slice(1) : w);

export function parseAppointment(input: string, today: string): ParsedAppointment {
  let s = " " + lower(input).replace(/[!?,;"«»]/g, " ").replace(/\s+/g, " ").trim() + " ";
  const cut = (m: RegExpMatchArray | string) => {
    s = s.replace(typeof m === "string" ? m : m[0], " ");
  };

  const morning = /\ssəhər\s/.test(s);
  const evening = /\s(axşam|günortadan sonra)\s/.test(s);

  // ---------- SAAT ----------
  let h: number | null = null;
  let mi = 0;
  let explicit24 = false;

  const hm = s.match(/(?:saat\s*)?\b(\d{1,2})[:.](\d{2})\b(?:-?\s*(?:də|da|ə|a|yə|ya|dək))?/);
  const saatNum = s.match(new RegExp(`saat\\s*(\\d{1,2})${SUFFIX}${WORD_END}(\\s+yarım\\S*)?`));
  if (hm) {
    h = +hm[1];
    mi = +hm[2];
    explicit24 = h >= 13 || hm[1].startsWith("0");
    cut(hm);
  } else if (saatNum) {
    h = +saatNum[1];
    if (saatNum[2]) mi = 30;
    cut(saatNum);
  } else {
    // "saat beşə", "saat on ikidə"
    for (const [w, n] of NUM_WORDS) {
      const m = s.match(new RegExp(`saat\\s+${w}\\S*(\\s+yarım\\S*)?`));
      if (m) {
        h = n;
        if (m[1]) mi = 30;
        cut(m);
        break;
      }
    }
  }

  // ---------- TARİX ----------
  let date: string | null = null;
  const nextWeek = /\sgələn həftə\S*\s/.test(s);
  if (nextWeek) s = s.replace(/\sgələn həftə\S*\s/, " ");

  const rel: [RegExp, number][] = [
    [/\s(?:bu\s?gün|bugün)\S*\s/, 0],
    [/\s(?:birisi\s?gün|biri\s?gün|o\s?biri\s?gün)\S*\s/, 2],
    [/\ssabah\S*\s/, 1],
  ];
  for (const [re, n] of rel) {
    const m = s.match(re);
    if (m) {
      date = addDays(today, n);
      s = s.replace(re, " ");
      break;
    }
  }

  if (!date) {
    // "20 noyabr", "20 noyabrda"
    const monthRe = new RegExp(`\\b(\\d{1,2})\\s*-?\\s*(${MONTHS.join("|")})\\S*`);
    const m = s.match(monthRe);
    if (m) {
      const day = +m[1];
      const month = MONTHS.indexOf(m[2]) + 1;
      let year = +today.slice(0, 4);
      let cand = `${year}-${pad(month)}-${pad(day)}`;
      if (cand < today) cand = `${++year}-${pad(month)}-${pad(day)}`;
      if (addDays(cand, 0) === cand) {
        date = cand;
        cut(m);
      }
    }
  }

  if (!date) {
    // "ayın 20-si", "ayın 20-də"
    const m = s.match(/ayın\s+(\d{1,2})\S*/);
    if (m) {
      const day = +m[1];
      const [y, mo] = today.split("-").map(Number);
      let cand = `${y}-${pad(mo)}-${pad(day)}`;
      if (cand < today) cand = mo === 12 ? `${y + 1}-01-${pad(day)}` : `${y}-${pad(mo + 1)}-${pad(day)}`;
      if (addDays(cand, 0) === cand) {
        date = cand;
        cut(m);
      }
    }
  }

  if (!date) {
    const order = WD_FULL.map((n, i) => [n, i] as const).sort((a, b) => b[0].length - a[0].length);
    for (const [n, i] of order) {
      const re = new RegExp(`\\s${n}\\S*(\\s+gün\\S*)?\\s`);
      if (re.test(s)) {
        const todayWd = weekday(today);
        let diff = (i - todayWd + 7) % 7;
        if (diff === 0) diff = 7;
        if (nextWeek) {
          // Həftə bazar ertəsindən başlayır
          const mondayIdx = (todayWd + 6) % 7; // bu gün həftənin neçənci günüdür (0=B.e)
          if (diff + mondayIdx < 7) diff += 7;
        }
        date = addDays(today, diff);
        s = s.replace(re, " ");
        break;
      }
    }
  }

  // Tarix kimi istifadə olunmayan "8-ə" tipli çılpaq saat
  if (h === null) {
    const m = s.match(new RegExp(`\\s(\\d{1,2})\\s*-\\s*(?:ə|a|yə|ya|e|də|da|dək)${WORD_END}`));
    if (m) {
      h = +m[1];
      cut(m);
    }
  }

  let time: string | null = null;
  if (h !== null && h >= 0 && h <= 23 && mi < 60) {
    if (!explicit24) {
      if (morning) {
        if (h === 12) h = 0;
      } else if (h >= 1 && h <= 7) {
        h += 12; // berber saatları: 3 → 15:00
      } else if (evening && h >= 8 && h <= 11) {
        h += 12;
      }
    }
    time = `${pad(h)}:${pad(mi)}`;
  }

  // ---------- AD ----------
  const words = s
    .replace(/-\s*\S*/g, " ")
    .split(/\s+/)
    .map((w) => w.replace(/[.:]+$/g, ""))
    .filter((w) => w.length > 1 && !/\d/.test(w) && !FILLER.has(w));
  let name: string | null = null;
  if (words.length) {
    name = capitalize(words[0]);
    if (words[1] && HONORIFICS.has(words[1])) name += " " + words[1];
  }

  return { name, date, time };
}
