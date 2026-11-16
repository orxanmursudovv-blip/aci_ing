// POST /api/voice — audio (multipart "audio") → mətn → ad/gün/saat.
// Nəticə birbaşa yazılmır: frontend təsdiq ekranı göstərir.
import { NextResponse } from "next/server";
import { getBarber } from "@/server/session";
import { bakuDate } from "@/lib/time";
import { parseAppointment } from "@/lib/parse";
import { transcribe, transcribeConfigured } from "@/server/voice/transcribe";
import { extractWithLLM, llmConfigured } from "@/server/voice/extract";
import { postprocess } from "@/server/voice/postprocess";
import { allow } from "@/server/voice/limit";

export const runtime = "nodejs";
const MAX_BYTES = 3 * 1024 * 1024; // ~3 MB ≈ 1–2 dəqiqə; komanda 15 saniyə ilə məhdudlaşdırılıb
const AUDIO_TYPES = /^audio\/(webm|mp4|mpeg|ogg|wav|x-m4a|m4a|aac)/;

const err = (status: number, error: string) => NextResponse.json({ error }, { status });

export async function POST(req: Request) {
  const b = await getBarber();
  if (!b) return err(401, "Giriş tələb olunur");
  if (!transcribeConfigured()) return err(503, "Səs xidməti hələ qoşulmayıb. Yazı ilə əlavə edin.");

  let form: FormData;
  try {
    form = await req.formData();
  } catch {
    return err(400, "Səs faylı göndərilmədi");
  }
  const audio = form.get("audio");
  if (!(audio instanceof Blob) || audio.size === 0) return err(400, "Səs faylı boşdur");
  if (audio.size > MAX_BYTES) return err(413, "Səs çox uzundur. Qısa danışın.");
  const type = audio.type.split(";")[0];
  if (!AUDIO_TYPES.test(type)) return err(415, "Səs formatı dəstəklənmir");
  if (!allow(b.id)) return err(429, "Çox sayda səs sorğusu. Bir az sonra yenidən yoxlayın.");

  const ext = type.includes("mp4") || type.includes("m4a") || type.includes("aac") ? "m4a" : type.split("/")[1];
  let transcript: string;
  try {
    transcript = await transcribe(audio, `voice.${ext}`);
  } catch (e) {
    console.error("voice: transcription failed", (e as Error).name); // mətn/ad log-a yazılmır
    return err(502, "Səsi tanımaq alınmadı. Yenidən cəhd edin və ya yazın.");
  }
  if (!transcript) return NextResponse.json({ transcript: "", name: null, date: null, time: null, question: "Heç nə eşitmədim. Yenidən danışın.", source: "none" });

  const today = bakuDate();
  if (llmConfigured()) {
    try {
      const x = await extractWithLLM(transcript, today);
      return NextResponse.json({ transcript, ...postprocess(x, transcript), source: "llm" });
    } catch (e) {
      console.error("voice: extraction failed, using rules", (e as Error).name);
    }
  }
  const p = parseAppointment(transcript, today);
  return NextResponse.json({ transcript, ...postprocess({ intent: "create_appointment", ...p, question: null }, transcript), source: "rules" });
}
