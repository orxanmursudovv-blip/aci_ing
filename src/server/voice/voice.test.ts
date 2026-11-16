import { describe, expect, it } from "vitest";
import type Anthropic from "@anthropic-ai/sdk";
import { postprocess, type Extraction } from "./postprocess";
import { extractWithLLM } from "./extract";
import { allow, LIMITS } from "./limit";

const X = (p: Partial<Extraction>): Extraction => ({ intent: "create_appointment", name: null, date: null, time: null, question: null, ...p });

describe("postprocess", () => {
  it("düzgün nəticə olduğu kimi keçir", () => {
    expect(postprocess(X({ name: "Şafak", date: "2026-11-17", time: "08:00" }), "Sabah saat 8-ə Şafak randevu"))
      .toEqual({ name: "Şafak", date: "2026-11-17", time: "08:00", question: null });
  });
  it("LLM 1–7 qaydasını unutsa — düzəldilir", () => {
    expect(postprocess(X({ name: "Elvin", time: "03:00" }), "sabah saat 3-də Elvin").time).toBe("15:00");
  });
  it("səhər deyilibsə toxunulmur", () => {
    expect(postprocess(X({ name: "Elvin", time: "07:00" }), "sabah səhər saat 7-də Elvin").time).toBe("07:00");
  });
  it("07:30 açıq yazılıbsa toxunulmur", () => {
    expect(postprocess(X({ name: "Elvin", time: "07:30" }), "sabah 07:30 Elvin").time).toBe("07:30");
  });
  it("yanlış tarix/saat atılır və sual verilir", () => {
    const r = postprocess(X({ name: "Elvin", date: "2026-02-30", time: "25:00" }), "x");
    expect(r.date).toBeNull();
    expect(r.time).toBeNull();
    expect(r.question).toMatch(/saatı/);
  });
  it("ad yoxdursa sual", () => {
    expect(postprocess(X({ time: "10:00" }), "sabah saat 10").question).toMatch(/adını/);
  });
  it("ad kiçik hərflə gəlsə — böyüdülür (az locale)", () => {
    expect(postprocess(X({ name: "ilkin", time: "10:00" }), "x").name).toBe("İlkin");
  });
});

describe("extractWithLLM", () => {
  it("modelə bu günün tarixi və təqvim gedir, parsed_output qaytarılır", async () => {
    let sent: { model: string; messages: { content: string }[]; output_config: { effort: string } } | null = null;
    const fake = {
      messages: {
        parse: async (req: never) => {
          sent = req;
          return { stop_reason: "end_turn", parsed_output: X({ name: "Tofiq", date: "2026-11-19", time: "12:00" }) };
        },
      },
    } as unknown as Anthropic;
    const r = await extractWithLLM("Cümə axşamı saat 12-yə Tofiq", "2026-11-16", fake);
    expect(r.name).toBe("Tofiq");
    expect(sent!.model).toBe("claude-haiku-5-5");
    expect(sent!.output_config.effort).toBe("low");
    const content = sent!.messages[0].content;
    expect(content).toContain("Today is 2026-11-16 (bazar ertəsi");
    expect(content).toContain("2026-11-19 cümə axşamı");
    expect(content).toContain("2026-11-17 çərşənbə axşamı (sabah)");
    expect(content).toContain("«Cümə axşamı saat 12-yə Tofiq»");
  });
  it("imtina olarsa xəta atır (route qaydalara keçir)", async () => {
    const fake = { messages: { parse: async () => ({ stop_reason: "refusal", parsed_output: null }) } } as unknown as Anthropic;
    await expect(extractWithLLM("x", "2026-11-16", fake)).rejects.toThrow();
  });
});

describe("limit", () => {
  it("10 dəqiqədə limitdən çox olmur", () => {
    const now = 1_000_000_000;
    for (let i = 0; i < LIMITS.perTenMin; i++) expect(allow("b1", now + i)).toBe(true);
    expect(allow("b1", now + 100)).toBe(false);
    expect(allow("b2", now + 100)).toBe(true); // digər berberə təsir etmir
    expect(allow("b1", now + 601_000)).toBe(true);
  });
});
