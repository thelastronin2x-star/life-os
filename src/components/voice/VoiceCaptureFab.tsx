"use client";

import { useState } from "react";
import { useVoiceCapture } from "@/lib/use-voice-capture";
import type { VoiceClassifyResponse } from "@/lib/voice-classify-types";
import { VoiceResultSheet } from "./VoiceResultSheet";
import { MicIcon } from "@/components/icons";

type Phase = "idle" | "listening" | "classifying" | "denied" | "error";

/** Global voice-capture entry point — mounted once in the app shell layout,
 *  so it's the one FAB visible from every screen rather than a per-page
 *  affordance. Deliberately NOT in the bottom-right `bottom-[84px] right-4`
 *  slot several screens already use for their own primary action (Фінанси's
 *  "+", Calendar's assistant bubble) — that corner is already claimed
 *  per-screen, so this sits on the opposite side to never collide with it. */
export function VoiceCaptureFab() {
  const { status, transcript, start, stop } = useVoiceCapture();
  const [phase, setPhase] = useState<Phase>("idle");
  const [result, setResult] = useState<VoiceClassifyResponse | null>(null);

  if (status === "unsupported") return null;

  async function handleStop() {
    stop();
    const heardText = transcript.trim();
    if (!heardText) {
      setPhase("idle");
      return;
    }
    setPhase("classifying");
    try {
      const res = await fetch("/api/assistant/voice-classify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ transcript: heardText, nowIso: new Date().toISOString() }),
      });
      if (!res.ok) throw new Error("classify_failed");
      const data = (await res.json()) as VoiceClassifyResponse;
      setResult(data);
      setPhase("idle");
    } catch {
      setPhase("error");
    }
  }

  function handleTap() {
    if (phase === "listening") {
      handleStop();
      return;
    }
    setResult(null);
    setPhase("listening");
    start();
  }

  return (
    <>
      <button
        onClick={handleTap}
        aria-label="Голосовий запис"
        className="fixed bottom-[84px] left-4 z-[44] flex h-[52px] w-[52px] items-center justify-center rounded-full bg-text text-bg shadow-lg"
      >
        <MicIcon className="h-5 w-5" />
      </button>

      {(phase === "listening" || phase === "classifying" || phase === "denied" || phase === "error" || status === "denied") && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center gap-5 bg-black/75 backdrop-blur-sm">
          {status === "denied" || phase === "denied" ? (
            <>
              <div className="px-10 text-center text-[13.5px] font-semibold text-text">
                Немає доступу до мікрофона — дозволь його в налаштуваннях браузера
              </div>
              <button onClick={() => setPhase("idle")} className="rounded-btn bg-surface px-5 py-2.5 text-[12.5px] font-bold text-text">
                Закрити
              </button>
            </>
          ) : phase === "error" ? (
            <>
              <div className="px-10 text-center text-[13.5px] font-semibold text-text">Не вдалося розпізнати — спробуй ще раз</div>
              <button onClick={() => setPhase("idle")} className="rounded-btn bg-surface px-5 py-2.5 text-[12.5px] font-bold text-text">
                Закрити
              </button>
            </>
          ) : phase === "classifying" ? (
            <div className="text-[13.5px] font-semibold text-text-dim">Розпізнаю…</div>
          ) : (
            <>
              <div className="relative flex h-[110px] w-[110px] items-center justify-center rounded-full" style={{ background: "radial-gradient(circle, var(--sage-deep), var(--bg))" }}>
                <span className="pulse-ring absolute inset-0 rounded-full border-2 border-sage/35" />
                <span className="pulse-ring pulse-ring-delay absolute inset-0 rounded-full border-2 border-sage/35" />
                <MicIcon className="relative z-10 h-8 w-8 text-sage" />
              </div>
              <div className="flex h-6 items-center gap-[3px]">
                {[10, 18, 8, 20, 12].map((h, i) => (
                  <span
                    key={i}
                    className="voice-wave w-[3px] rounded-sm bg-sage"
                    style={{ height: h, animationDelay: `${i * 0.1}s` }}
                  />
                ))}
              </div>
              <div className="px-10 text-center text-[14px] font-semibold text-text-dim">
                {transcript || "Слухаю... скажи що завгодно"}
              </div>
              <button onClick={handleStop} className="rounded-btn bg-surface px-6 py-3 text-[12.5px] font-bold text-text">
                Готово
              </button>
            </>
          )}
        </div>
      )}

      {result?.result && <VoiceResultSheet heard={result.heard} result={result.result} onClose={() => setResult(null)} />}
    </>
  );
}
