// Telefon nömrələri: E.164 formatında saxlanılır (+994501234567).
// QEYD: nömrələr həssas datadır — heç vaxt log-a yazma.

/** İstifadəçi girişini normallaşdırır. Yanlışdırsa null. */
export function normalizePhone(input: string | null | undefined): string | null {
  if (!input) return null;
  const raw = input.trim();
  if (!raw) return null;
  let digits = raw.replace(/\D/g, "");
  const international = raw.startsWith("+") || digits.startsWith("00");
  if (digits.startsWith("00")) digits = digits.slice(2);

  if (!international) {
    // Yerli Azərbaycan formatları: 050 123 45 67, 50 123 45 67, 994501234567
    if (digits.length === 10 && digits.startsWith("0")) digits = "994" + digits.slice(1);
    else if (digits.length === 9) digits = "994" + digits;
  }
  if (digits.startsWith("994")) {
    return digits.length === 12 ? "+" + digits : null;
  }
  if (international && digits.length >= 8 && digits.length <= 15) return "+" + digits;
  return null;
}

/** +994501234567 → "050 123 45 67" */
export function formatPhone(e164: string | null | undefined): string {
  if (!e164) return "";
  const m = /^\+994(\d{2})(\d{3})(\d{2})(\d{2})$/.exec(e164);
  if (m) return `0${m[1]} ${m[2]} ${m[3]} ${m[4]}`;
  return e164;
}

/** wa.me linki üçün yalnız rəqəmlər */
export function waDigits(e164: string | null | undefined): string {
  return e164 ? e164.replace(/\D/g, "") : "";
}

export function waLink(e164: string | null | undefined, text: string): string {
  return `https://wa.me/${waDigits(e164)}?text=${encodeURIComponent(text)}`;
}
