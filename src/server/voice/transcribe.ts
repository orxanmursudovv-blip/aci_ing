// Səs → mətn (OpenAI Whisper, Azərbaycan dili).
import OpenAI, { toFile } from "openai";

export const TRANSCRIBE_MODEL = process.env.OPENAI_TRANSCRIBE_MODEL || "whisper-1";

// Tanımanı yönləndirən nümunə — Azərbaycan hərflərini və tipik cümləni göstərir.
const HINT = "Sabah saat 8-ə Şafak randevu. Bu gün saat 17:30 Nicat. Cümə axşamı saat 12-yə Tofiq. Birisi gün saat 3-də Əli müəllim.";

let client: OpenAI | null = null;
function getClient() {
  if (!client) client = new OpenAI({ timeout: 30_000, maxRetries: 1 });
  return client;
}

export function transcribeConfigured() {
  return !!process.env.OPENAI_API_KEY;
}

export async function transcribe(audio: Blob, filename: string): Promise<string> {
  const file = await toFile(audio, filename, { type: audio.type });
  const r = await getClient().audio.transcriptions.create({
    file,
    model: TRANSCRIBE_MODEL,
    language: "az",
    prompt: HINT,
  });
  return r.text.trim();
}
