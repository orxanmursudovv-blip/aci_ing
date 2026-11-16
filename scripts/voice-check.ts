// Real açarlarla qəbul yoxlaması (pullu, ~0,01 $-dan az):
//   npm run voice:check                    → 3 cümləni LLM ilə yoxlayır
//   npm run voice:check -- a.m4a b.m4a     → səs fayllarını Whisper + LLM ilə yoxlayır
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { extractWithLLM } from "../src/server/voice/extract";
import { postprocess } from "../src/server/voice/postprocess";
import { transcribe } from "../src/server/voice/transcribe";
import { addDays, bakuDate, weekday } from "../src/lib/time";

async function main() {
  const today = bakuDate();
  const thursday = addDays(today, ((4 - weekday(today) + 7) % 7) || 7);
  const cases: [string, { name: string; date: string; time: string }][] = [
    ["Sabah saat 8-ə Şafak randevu", { name: "Şafak", date: addDays(today, 1), time: "08:00" }],
    ["Cümə axşamı saat 12-yə Tofiq", { name: "Tofiq", date: thursday, time: "12:00" }],
    ["Bu gün saat 17:30 Nicat", { name: "Nicat", date: today, time: "17:30" }],
  ];
  const files = process.argv.slice(2);
  let fail = 0;
  if (files.length) {
    for (const f of files) {
      const buf = fs.readFileSync(f);
      const type = f.endsWith(".webm") ? "audio/webm" : f.endsWith(".mp3") ? "audio/mpeg" : f.endsWith(".wav") ? "audio/wav" : "audio/mp4";
      const text = await transcribe(new Blob([buf], { type }), path.basename(f));
      const r = postprocess(await extractWithLLM(text, today), text);
      console.log(`${path.basename(f)}: «${text}» →`, r);
    }
    return;
  }
  for (const [text, want] of cases) {
    const r = postprocess(await extractWithLLM(text, today), text);
    const ok = r.name === want.name && r.date === want.date && r.time === want.time;
    if (!ok) fail++;
    console.log(`${ok ? "✓" : "✗"} «${text}» →`, r, ok ? "" : `(gözlənilən: ${JSON.stringify(want)})`);
  }
  process.exit(fail ? 1 : 0);
}
main().catch((e) => {
  console.error(e);
  process.exit(1);
});
