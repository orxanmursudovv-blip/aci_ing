/** "12,5" / "12.50" → 1250 qəpik. Yanlışdırsa null. */
export function parseAmount(input: string | number | null | undefined): number | null {
  if (input === null || input === undefined) return null;
  const s = String(input).trim().replace(/\s/g, "").replace(",", ".");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(parseFloat(s) * 100);
  return cents > 0 && cents < 100_000_000 ? cents : null;
}

/** 1250 → "12,50 ₼", 1200 → "12 ₼" */
export function formatAZN(cents: number): string {
  const neg = cents < 0;
  const abs = Math.abs(cents);
  const whole = Math.floor(abs / 100);
  const frac = abs % 100;
  const w = whole.toLocaleString("en-US").replace(/,/g, " ");
  return `${neg ? "−" : ""}${w}${frac ? "," + String(frac).padStart(2, "0") : ""} ₼`;
}
