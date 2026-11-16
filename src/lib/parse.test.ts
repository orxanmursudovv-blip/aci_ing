import { describe, expect, it } from "vitest";
import { parseAppointment } from "./parse";

// 2026-11-16 bazar ertəsidir
const TODAY = "2026-11-16";
const p = (s: string) => parseAppointment(s, TODAY);

describe("parseAppointment — qəbul meyarları", () => {
  it("Sabah saat 8-ə Şafak randevu", () => {
    expect(p("Sabah saat 8-ə Şafak randevu")).toEqual({ name: "Şafak", date: "2026-11-17", time: "08:00" });
  });
  it("Cümə axşamı saat 12-yə Tofiq", () => {
    expect(p("Cümə axşamı saat 12-yə Tofiq")).toEqual({ name: "Tofiq", date: "2026-11-19", time: "12:00" });
  });
  it("Bu gün saat 17:30 Nicat", () => {
    expect(p("Bu gün saat 17:30 Nicat")).toEqual({ name: "Nicat", date: "2026-11-16", time: "17:30" });
  });
});

describe("saat", () => {
  it("1–7 arası günorta sonrasıdır", () => {
    expect(p("sabah saat 3-də Elvin").time).toBe("15:00");
    expect(p("sabah saat 7-yə Elvin").time).toBe("19:00");
    expect(p("sabah 5-ə Elvin").time).toBe("17:00");
  });
  it("8–12 olduğu kimi qalır", () => {
    expect(p("saat 9 Elvin").time).toBe("09:00");
    expect(p("saat 11-ə Elvin").time).toBe("11:00");
  });
  it("səhər deyilərsə səhərdir", () => {
    expect(p("sabah səhər saat 7-yə Murad").time).toBe("07:00");
  });
  it("axşam 8 → 20:00", () => {
    expect(p("bu gün axşam saat 8-ə Murad").time).toBe("20:00");
  });
  it("yarım", () => {
    expect(p("sabah saat 4 yarımda Kamran").time).toBe("16:30");
  });
  it("sözlə saat", () => {
    expect(p("sabah saat beşə Rauf")).toMatchObject({ time: "17:00", name: "Rauf" });
    expect(p("sabah saat on ikidə Rauf")).toMatchObject({ time: "12:00", name: "Rauf" });
  });
  it("14.30 formatı", () => {
    expect(p("şənbə 14.30 Rauf")).toMatchObject({ time: "14:30", name: "Rauf", date: "2026-11-21" });
  });
  it("saat yoxdursa null", () => {
    expect(p("sabah Elvin").time).toBeNull();
  });
});

describe("tarix", () => {
  it("birisi gün", () => {
    expect(p("birisi gün saat 10 Orxan").date).toBe("2026-11-18");
  });
  it("həftə günləri (bu gün bazar ertəsi)", () => {
    expect(p("çərşənbə saat 10 Orxan").date).toBe("2026-11-18");
    expect(p("çərşənbə axşamı saat 10 Orxan").date).toBe("2026-11-17");
    expect(p("cümə saat 10 Orxan").date).toBe("2026-11-20");
    expect(p("bazar saat 10 Orxan").date).toBe("2026-11-22");
    expect(p("bazar ertəsi saat 10 Orxan").date).toBe("2026-11-23");
    expect(p("şənbəyə saat 10 Orxan").date).toBe("2026-11-21");
  });
  it("gələn həftə", () => {
    expect(p("gələn həftə çərşənbə saat 10 Orxan").date).toBe("2026-11-25");
  });
  it("ay adı ilə", () => {
    expect(p("25 noyabr saat 2-də Orxan")).toMatchObject({ date: "2026-11-25", time: "14:00" });
    expect(p("3 yanvar saat 10 Orxan").date).toBe("2027-01-03");
  });
  it("ayın 20-si", () => {
    expect(p("ayın 20-si saat 10 Orxan").date).toBe("2026-11-20");
  });
  it("tarix yoxdursa null", () => {
    expect(p("saat 10 Orxan").date).toBeNull();
  });
});

describe("ad", () => {
  it("Azərbaycan hərfləri ilə böyük hərf", () => {
    expect(p("sabah saat 10 ilkin").name).toBe("İlkin");
    expect(p("sabah saat 10 İLKİN").name).toBe("İlkin");
  });
  it("müraciət sözü", () => {
    expect(p("sabah saat 10 Əli müəllim randevu yaz").name).toBe("Əli müəllim");
  });
  it("ad sonda və ya əvvəldə", () => {
    expect(p("Nicat bu gün saat 6").name).toBe("Nicat");
  });
  it("ad yoxdursa null", () => {
    expect(p("sabah saat 10 randevu").name).toBeNull();
  });
});
