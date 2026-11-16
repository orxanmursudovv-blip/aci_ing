import { describe, expect, it } from "vitest";
import { reminderText, timeWithLocative } from "./messages";
import { formatAZN, parseAmount } from "./money";

describe("mesajlar", () => {
  it("saat şəkilçisi", () => {
    expect(timeWithLocative("08:00")).toBe("08:00-də");
    expect(timeWithLocative("15:00")).toBe("15:00-də");
    expect(timeWithLocative("16:00")).toBe("16:00-da");
    expect(timeWithLocative("17:30")).toBe("17:30-da");
    expect(timeWithLocative("12:00")).toBe("12:00-də");
    expect(timeWithLocative("10:00")).toBe("10:00-da");
    expect(timeWithLocative("11:15")).toBe("11:15-də");
    expect(timeWithLocative("13:00")).toBe("13:00-də");
    expect(timeWithLocative("14:40")).toBe("14:40-da");
  });
  it("xatırlatma mətni", () => {
    expect(reminderText({ name: "Şafak", date: "2026-11-17", time: "08:00", salon: "Berber Ramazan", today: "2026-11-16" }))
      .toBe("Salam Şafak! Xatırlatma: sabah, 17 noyabr saat 08:00-də randevunuz var. Hörmətlə, Berber Ramazan 💈");
  });
});

describe("pul", () => {
  it("parse", () => {
    expect(parseAmount("12,5")).toBe(1250);
    expect(parseAmount("12")).toBe(1200);
    expect(parseAmount("0")).toBeNull();
    expect(parseAmount("abc")).toBeNull();
    expect(parseAmount("1.234")).toBeNull();
  });
  it("format", () => {
    expect(formatAZN(1250)).toBe("12,50 ₼");
    expect(formatAZN(120000)).toBe("1 200 ₼");
    expect(formatAZN(-300)).toBe("−3 ₼");
  });
});
