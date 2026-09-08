"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// Web Speech API has no shared TS lib typing — declared narrowly to the
// handful of members this hook actually touches, on `window` where Safari,
// Chrome, and every other implementation attach it (prefixed on Safari).
interface SpeechRecognitionResultLike {
  0: { transcript: string };
  isFinal: boolean;
}
interface SpeechRecognitionEventLike extends Event {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionLike extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start(): void;
  stop(): void;
  abort(): void;
  onresult: ((e: SpeechRecognitionEventLike) => void) | null;
  onerror: ((e: Event & { error?: string }) => void) | null;
  onend: (() => void) | null;
}
type SpeechRecognitionCtor = new () => SpeechRecognitionLike;

function getRecognitionCtor(): SpeechRecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: SpeechRecognitionCtor; webkitSpeechRecognition?: SpeechRecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export type VoiceCaptureStatus = "idle" | "listening" | "unsupported" | "denied" | "error";

/** Thin wrapper over the browser's native Web Speech API — no server round
 *  trip for the audio itself, so there's nothing to upload or pay for per
 *  request. Support varies by browser (notably inconsistent on iOS Safari
 *  PWA installs); `status === "unsupported"` is the caller's cue to hide the
 *  entry point rather than show a mic that silently does nothing. */
export function useVoiceCapture() {
  // Lazy initializer, not an effect: browser support for the API doesn't
  // change at runtime, so there's nothing to synchronize after mount — an
  // effect here would just be an extra render for the same answer.
  const [status, setStatus] = useState<VoiceCaptureStatus>(() => (getRecognitionCtor() ? "idle" : "unsupported"));
  const [transcript, setTranscript] = useState("");
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor) {
      setStatus("unsupported");
      return;
    }
    setTranscript("");
    const recognition = new Ctor();
    recognition.lang = "uk-UA";
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (e) => {
      let combined = "";
      for (let i = 0; i < e.results.length; i++) combined += e.results[i][0].transcript;
      setTranscript(combined.trim());
    };
    recognition.onerror = (e) => {
      setStatus(e.error === "not-allowed" || e.error === "permission-denied" ? "denied" : "error");
    };
    recognition.onend = () => {
      setStatus((s) => (s === "listening" ? "idle" : s));
    };

    recognitionRef.current = recognition;
    setStatus("listening");
    try {
      recognition.start();
    } catch {
      setStatus("error");
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    recognitionRef.current = null;
  }, []);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  return { status, transcript, start, stop };
}
