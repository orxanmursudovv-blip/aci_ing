"use client";
// "Bas və danış": basıb saxla → danış → burax. Qısa toxunuş: bir dəfə bas başla, bir də bas dayandır.
// Audio /api/voice-a gedir; nəticə təsdiq ekranında göstərilir (birbaşa yazılmır).
import { useEffect, useRef, useState } from "react";

export type VoiceResult = {
  transcript: string;
  name: string | null;
  date: string | null;
  time: string | null;
  question: string | null;
  source: "llm" | "rules" | "none";
};

const MAX_MS = 15_000;
const HOLD_MS = 350;

function pickMime(): string | undefined {
  const opts = ["audio/webm;codecs=opus", "audio/webm", "audio/mp4", "audio/ogg;codecs=opus"];
  return opts.find((t) => typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported(t));
}

type State = "idle" | "rec" | "busy";

export function VoiceButton({ onResult }: { onResult: (r: VoiceResult) => void }) {
  const [state, setState] = useState<State>("idle");
  const [msg, setMsg] = useState<string | null>(null);
  const [secs, setSecs] = useState(0);
  const rec = useRef<MediaRecorder | null>(null);
  const downAt = useRef(0);
  const timers = useRef<{ max?: ReturnType<typeof setTimeout>; tick?: ReturnType<typeof setInterval> }>({});

  useEffect(() => () => stopTracks(), []);

  function stopTracks() {
    clearTimeout(timers.current.max);
    clearInterval(timers.current.tick);
    rec.current?.stream.getTracks().forEach((t) => t.stop());
  }

  async function start() {
    setMsg(null);
    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === "undefined") {
      setMsg("Bu brauzer səs yazmağı dəstəkləmir. Aşağıda yazın.");
      return;
    }
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: { echoCancellation: true, noiseSuppression: true } });
    } catch {
      setMsg("Mikrofona icazə verilmədi. Brauzer ayarlarından icazə verin və ya aşağıda yazın.");
      return;
    }
    const mime = pickMime();
    const r = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    r.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    r.onstop = () => {
      stopTracks();
      const blob = new Blob(chunks, { type: (r.mimeType || mime || "audio/webm").split(";")[0] });
      if (Date.now() - downAt.current < 600 || blob.size < 1000) {
        setState("idle");
        setMsg("Çox qısa oldu. Basıb saxlayın və danışın.");
        return;
      }
      void send(blob);
    };
    rec.current = r;
    r.start();
    downAt.current = Date.now();
    setSecs(0);
    setState("rec");
    timers.current.tick = setInterval(() => setSecs((s) => s + 1), 1000);
    timers.current.max = setTimeout(() => stop(), MAX_MS);
  }

  function stop() {
    if (rec.current?.state === "recording") rec.current.stop();
  }

  async function send(blob: Blob) {
    setState("busy");
    try {
      const fd = new FormData();
      fd.append("audio", blob, "voice");
      const res = await fetch("/api/voice", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setMsg(data.error ?? "Xəta baş verdi. Yazı ilə əlavə edin.");
        return;
      }
      onResult(data as VoiceResult);
    } catch {
      setMsg("İnternet bağlantısı yoxdur. Yazı ilə əlavə edin.");
    } finally {
      setState("idle");
    }
  }

  // Basıb-saxlama və toxunub-dəyişmə birlikdə
  const pressStart = useRef(0);
  async function onDown(e: React.PointerEvent) {
    e.preventDefault();
    if (state === "busy") return;
    if (state === "rec") return; // ikinci toxunuş onUp-da dayandırır
    pressStart.current = Date.now();
    await start();
  }
  function onUp() {
    if (state !== "rec" && rec.current?.state !== "recording") return;
    const held = Date.now() - pressStart.current;
    // Uzun basıb buraxdı → dayandır. Qısa toxundu → yazmağa davam (növbəti toxunuşa qədər).
    if (held >= HOLD_MS || pressStart.current === 0) stop();
    pressStart.current = 0;
  }

  const label =
    state === "rec" ? `Dinləyirəm... ${secs}s (buraxın və ya yenidən toxunun)` : state === "busy" ? "Anlayıram..." : "Basıb saxlayın və danışın";

  return (
    <>
      <button
        type="button"
        aria-label={state === "rec" ? "Dayandır" : "Danış"}
        disabled={state === "busy"}
        onPointerDown={onDown}
        onPointerUp={onUp}
        onPointerLeave={() => state === "rec" && pressStart.current && onUp()}
        onContextMenu={(e) => e.preventDefault()}
        className={`mx-auto flex h-24 w-24 touch-none select-none items-center justify-center rounded-full text-4xl ${
          state === "rec"
            ? "rec bg-bad text-white shadow-[0_0_0_14px_rgba(255,107,107,.2)]"
            : state === "busy"
              ? "animate-pulse bg-card2 text-ac"
              : "bg-ac text-acink shadow-[0_0_0_8px_rgba(245,185,66,.15)]"
        }`}
      >
        {state === "busy" ? "⏳" : "🎤"}
      </button>
      <p className="mb-3 mt-3 text-sm text-mut" aria-live="polite">{msg ?? label}</p>
    </>
  );
}
