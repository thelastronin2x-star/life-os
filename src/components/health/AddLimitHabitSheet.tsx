"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface AddLimitHabitSheetProps {
  onClose: () => void;
  onSubmit: (data: { name: string; cap: number; capPeriod: "daily" | "weekly" }) => void;
}

/** Add-flow for an "обмежую" (capped counter) habit — cap value + whether
 *  it resets daily or weekly, not the build flow's frequency field. */
export function AddLimitHabitSheet({ onClose, onSubmit }: AddLimitHabitSheetProps) {
  const [name, setName] = useState("");
  const [cap, setCap] = useState(3);
  const [capPeriod, setCapPeriod] = useState<"daily" | "weekly">("daily");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, cap, capPeriod });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">Нова звичка «обмежую»</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Назва (напр. Кава)"
          autoFocus
          className="w-full rounded-input border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-text outline-none"
        />

        <div className="mb-1.5 mt-3.5 text-[11px] font-bold text-text-faint">Ліміт</div>
        <div className="flex items-center justify-center gap-4 rounded-input bg-surface-2 py-3">
          <button
            onClick={() => setCap((c) => Math.max(1, c - 1))}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface text-[18px] font-bold text-text"
          >
            −
          </button>
          <span className="min-w-[40px] text-center font-mono text-[16px] font-extrabold text-text">{cap}</span>
          <button
            onClick={() => setCap((c) => c + 1)}
            className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface text-[18px] font-bold text-text"
          >
            +
          </button>
        </div>

        <div className="mb-1.5 mt-3 text-[11px] font-bold text-text-faint">Період</div>
        <div className="flex gap-2">
          {(["daily", "weekly"] as const).map((p) => (
            <button
              key={p}
              onClick={() => setCapPeriod(p)}
              className={cn(
                "flex-1 rounded-btn py-2 text-center text-[12.5px] font-bold",
                capPeriod === p ? "bg-text text-bg" : "bg-surface-2 text-text-dim"
              )}
            >
              {p === "daily" ? "На день" : "На тиждень"}
            </button>
          ))}
        </div>

        <button
          onClick={handleSubmit}
          disabled={!name.trim()}
          className="mt-3.5 w-full rounded-btn bg-text py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
        >
          Додати
        </button>
      </div>
    </div>
  );
}
