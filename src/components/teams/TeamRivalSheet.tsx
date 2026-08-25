"use client";

import { useState } from "react";

export function TeamRivalSheet({ onSetRival, onClose }: { onSetRival: (code: string) => Promise<{ ok: boolean; error?: string }>; onClose: () => void }) {
  const [code, setCode] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    if (!code.trim() || pending) return;
    setPending(true);
    const result = await onSetRival(code);
    setPending(false);
    if (result.ok) onClose();
    else setError(result.error === "not_found" ? "Команду з таким кодом не знайдено" : "Це твоя ж команда");
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div className="w-full max-w-md rounded-t-card bg-bg p-5 shadow-card md:rounded-card" onClick={(e) => e.stopPropagation()}>
        <div className="mb-4 flex items-center justify-between">
          <div className="text-[14px] font-bold text-text">Товариський виклик</div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>
        <p className="mb-3 text-[11.5px] leading-relaxed text-text-faint">
          Введи код команди-суперника — порівняємо XP за тиждень. Просто для драйву, без ставок.
        </p>
        <input
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="напр. K7QX9M"
          className="mb-3 w-full rounded-input border border-border bg-surface px-3 py-2.5 text-[13px] uppercase tracking-widest text-text outline-none"
        />
        {error && <div className="mb-3 text-[11.5px] font-semibold text-clay">{error}</div>}
        <button onClick={submit} disabled={!code.trim() || pending} className="w-full rounded-btn bg-text py-3 text-[12.5px] font-extrabold text-bg disabled:opacity-50">
          {pending ? "Зачекай…" : "Розпочати виклик"}
        </button>
      </div>
    </div>
  );
}
