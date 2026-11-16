// Bütün "gün" anlayışları Asia/Baku-ya görə hesablanır.
// DB-də vaxt UTC (timestamptz) saxlanılır.
export const TZ = "Asia/Baku";

const dtf = new Intl.DateTimeFormat("en-CA", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
  hourCycle: "h23",
});

function parts(d: Date) {
  const o: Record<string, string> = {};
  for (const p of dtf.formatToParts(d)) o[p.type] = p.value;
  return o;
}

export const pad = (n: number) => String(n).padStart(2, "0");

/** Baku vaxtı ilə tarix: "YYYY-MM-DD" */
export function bakuDate(d: Date = new Date()): string {
  const p = parts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/** Baku vaxtı ilə saat: "HH:mm" */
export function bakuTime(d: Date): string {
  const p = parts(d);
  return `${p.hour}:${p.minute}`;
}

/** Baku-nun UTC-dən fərqi (dəqiqə) verilən anda */
function offsetMinutes(d: Date): number {
  const p = parts(d);
  const asUtc = Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second);
  return Math.round((asUtc - Math.floor(d.getTime() / 1000) * 1000) / 60000);
}

/** Baku-da "YYYY-MM-DD" + "HH:mm" → UTC Date */
export function bakuToUtc(date: string, time = "00:00"): Date {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, hh, mm);
  const off = offsetMinutes(new Date(guess));
  return new Date(guess - off * 60000);
}

export function addDays(date: string, n: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const x = new Date(Date.UTC(y, m - 1, d + n));
  return `${x.getUTCFullYear()}-${pad(x.getUTCMonth() + 1)}-${pad(x.getUTCDate())}`;
}

/** 0 = bazar, 1 = bazar ertəsi, ... 6 = şənbə */
export function weekday(date: string): number {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  return addDays(s, 0) === s;
}

export function isValidTime(s: string): boolean {
  const m = /^(\d{2}):(\d{2})$/.exec(s);
  return !!m && +m[1] < 24 && +m[2] < 60;
}

/** Baku ayının sərhədləri (UTC) */
export function bakuMonthRange(date: string): { from: Date; to: Date } {
  const [y, m] = date.split("-").map(Number);
  const first = `${y}-${pad(m)}-01`;
  const nextFirst = m === 12 ? `${y + 1}-01-01` : `${y}-${pad(m + 1)}-01`;
  return { from: bakuToUtc(first), to: bakuToUtc(nextFirst) };
}

export function bakuDayRange(date: string): { from: Date; to: Date } {
  return { from: bakuToUtc(date), to: bakuToUtc(addDays(date, 1)) };
}

export const MONTHS = ["yanvar", "fevral", "mart", "aprel", "may", "iyun", "iyul", "avqust", "sentyabr", "oktyabr", "noyabr", "dekabr"];
export const MONTHS_SHORT = ["yan", "fev", "mar", "apr", "may", "iyn", "iyl", "avq", "sen", "okt", "noy", "dek"];
export const WD_SHORT = ["Baz", "B.e", "Ç.a", "Çər", "C.a", "Cüm", "Şən"];
export const WD_FULL = ["bazar", "bazar ertəsi", "çərşənbə axşamı", "çərşənbə", "cümə axşamı", "cümə", "şənbə"];

/** "17 noyabr" */
export function humanDate(date: string): string {
  const [, m, d] = date.split("-").map(Number);
  return `${d} ${MONTHS[m - 1]}`;
}

/** "bu gün" / "sabah" / "cümə, 20 noyabr" */
export function relativeDate(date: string, today: string): string {
  if (date === today) return "bu gün";
  if (date === addDays(today, 1)) return "sabah";
  if (date === addDays(today, 2)) return "birisi gün";
  return `${WD_FULL[weekday(date)]}, ${humanDate(date)}`;
}
