// Sadə yaddaşdaxili limit (tək PM2 prosesi üçün kifayətdir): xərcə nəzarət.
const hits = new Map<string, number[]>();
export const LIMITS = { perTenMin: 20, perDay: 200 };

export function allow(barberId: string, now = Date.now()): boolean {
  const day = 86_400_000;
  const arr = (hits.get(barberId) ?? []).filter((t) => now - t < day);
  const recent = arr.filter((t) => now - t < 600_000).length;
  if (recent >= LIMITS.perTenMin || arr.length >= LIMITS.perDay) {
    hits.set(barberId, arr);
    return false;
  }
  arr.push(now);
  hits.set(barberId, arr);
  return true;
}
