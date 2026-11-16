// Mətndən randevu məlumatını Claude Haiku ilə strukturlu JSON kimi çıxarır.
import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { addDays, WD_FULL, weekday, humanDate } from "@/lib/time";
import type { Extraction } from "./postprocess";

export const EXTRACT_MODEL = process.env.ANTHROPIC_MODEL || "claude-haiku-5-5";

const Schema = z.object({
  intent: z.enum(["create_appointment", "unclear"]),
  name: z.string().nullable(),
  date: z.string().nullable(),
  time: z.string().nullable(),
  question: z.string().nullable(),
});

// Sabit hissə — keşlənə bilsin deyə tarix burada deyil, user mesajındadır.
const SYSTEM = `You extract barber appointments from short Azerbaijani voice commands (already transcribed; the transcript may contain recognition errors).

Return JSON with:
- intent: "create_appointment" if the user wants to book someone, otherwise "unclear".
- name: the client's first name exactly as spoken, in Azerbaijani spelling with a capital first letter (e.g. "Şafak", "Tofiq", "Nicat", "Əli müəllim"). Strip grammatical case suffixes that attach to the name ("Tofiqə" → "Tofiq", "Nicata" → "Nicat") only when clearly a suffix. Never invent a name. null if no name was said.
- date: YYYY-MM-DD in Asia/Baku. Use the calendar provided in the message. "bu gün" = today, "sabah" = tomorrow, "birisi gün" = day after tomorrow. A weekday name means its NEXT occurrence after today (if today is that weekday, it means next week). "gələn həftə <day>" means that day in next week (weeks start on Monday). null if no day was said.
- time: HH:MM, 24-hour. "saat 8-ə" = 08:00, "12-yə" = 12:00, "17:30" = 17:30, "4 yarımda" = 16:30. RULE: hours 1 to 7 mean afternoon/evening (3 → 15:00, 7 → 19:00) unless the speaker says "səhər". "axşam" with 8–11 adds 12. null if no time was said — never guess a time.
- question: if name or time is missing or the command is unclear, a short polite question in Azerbaijani asking for exactly what is missing; otherwise null.

Do not guess missing information.`;

function calendar(today: string): string {
  const lines: string[] = [];
  for (let i = 0; i < 14; i++) {
    const d = addDays(today, i);
    const tag = i === 0 ? " (bu gün)" : i === 1 ? " (sabah)" : i === 2 ? " (birisi gün)" : "";
    lines.push(`${d} ${WD_FULL[weekday(d)]}${tag}`);
  }
  return lines.join("\n");
}

let client: Anthropic | null = null;
function getClient() {
  if (!client) client = new Anthropic({ timeout: 20_000, maxRetries: 1 });
  return client;
}

export function llmConfigured() {
  return !!process.env.ANTHROPIC_API_KEY;
}

export async function extractWithLLM(transcript: string, today: string, c: Anthropic = getClient()): Promise<Extraction> {
  const res = await c.messages.parse({
    model: EXTRACT_MODEL,
    max_tokens: 4000,
    system: SYSTEM,
    output_config: { effort: "low", format: zodOutputFormat(Schema) },
    messages: [
      {
        role: "user",
        content: `Today is ${today} (${WD_FULL[weekday(today)]}, ${humanDate(today)}), timezone Asia/Baku.\nCalendar:\n${calendar(today)}\n\nTranscript: «${transcript}»`,
      },
    ],
  });
  if (res.stop_reason === "refusal" || !res.parsed_output) throw new Error(`llm_no_output:${res.stop_reason}`);
  return res.parsed_output;
}
