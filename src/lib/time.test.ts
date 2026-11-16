import { describe, expect, it } from "vitest";
import { addDays, bakuDate, bakuTime, bakuToUtc, isValidDate, relativeDate, weekday } from "./time";
import { formatPhone, normalizePhone, waLink } from "./phone";

describe("Baku vaxtı", () => {
  it("UTC 21:30 artıq Baku-da növbəti gündür", () => {
    const d = new Date("2026-11-16T21:30:00Z"); // Baku: 17 noyabr 01:30
    expect(bakuDate(d)).toBe("2026-11-17");
    expect(bakuTime(d)).toBe("01:30");
  });
  it("Baku 08:00 → UTC 04:00", () => {
    expect(bakuToUtc("2026-11-17", "08:00").toISOString()).toBe("2026-11-17T04:00:00.000Z");
  });
  it("gediş-gəliş", () => {
    const d = bakuToUtc("2026-12-31", "23:45");
    expect(bakuDate(d)).toBe("2026-12-31");
    expect(bakuTime(d)).toBe("23:45");
  });
  it("addDays ay/il keçidi", () => {
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });
  it("weekday", () => {
    expect(weekday("2026-11-16")).toBe(1);
  });
  it("isValidDate", () => {
    expect(isValidDate("2026-02-30")).toBe(false);
    expect(isValidDate("2026-02-28")).toBe(true);
  });
  it("relativeDate", () => {
    expect(relativeDate("2026-11-17", "2026-11-16")).toBe("sabah");
    expect(relativeDate("2026-11-20", "2026-11-16")).toBe("cümə, 20 noyabr");
  });
});

describe("telefon", () => {
  it("yerli formatlar", () => {
    expect(normalizePhone("050 123 45 67")).toBe("+994501234567");
    expect(normalizePhone("50-123-45-67")).toBe("+994501234567");
    expect(normalizePhone("994501234567")).toBe("+994501234567");
    expect(normalizePhone("+994 50 123 45 67")).toBe("+994501234567");
  });
  it("beynəlxalq", () => {
    expect(normalizePhone("+90 532 123 45 67")).toBe("+905321234567");
    expect(normalizePhone("0090 532 123 45 67")).toBe("+905321234567");
  });
  it("yanlış", () => {
    expect(normalizePhone("12345")).toBeNull();
    expect(normalizePhone("")).toBeNull();
  });
  it("format və wa.me", () => {
    expect(formatPhone("+994501234567")).toBe("050 123 45 67");
    expect(waLink("+994501234567", "Salam!")).toBe("https://wa.me/994501234567?text=Salam!");
  });
});
