"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface AddBuildHabitSheetProps {
  onClose: () => void;
  onSubmit: (data: { name: string; targetFrequency: "daily" | number }) => void;
}

const FREQUENCY_OPTIONS: { value: "daily" | number; label: string }[] = [
  { value: "daily", label: "Щодня" },
  { value: 2, label: "2x/тиж" },
  { value: 3, label: "3x/тиж" },
  { value: 4, label: "4x/тиж" },
  { value: 5, label: "5x/тиж" },
  { value: 6, label: "6x/тиж" },
];

/** Add-flow for a "розвиваю" (streak) habit — only the fields that mechanic
 *  actually needs (name + how often), not a universal form shared with the
 *  limit flow's cap fields. */
export function AddBuildHabitSheet({ onClose, onSubmit }: AddBuildHabitSheetProps) {
  const [name, setName] = useState("");
  const [targetFrequency, setTargetFrequency] = useState<"daily" | number>("daily");

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, targetFrequency });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">Нова звичка «розвиваю»</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
          placeholder="Назва (напр. Читання 20 хв)"
          autoFocus
          className="w-full rounded-input border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-text outline-none"
        />

        <div className="mb-1.5 mt-3.5 text-[11px] font-bold text-text-faint">Частота</div>
        <div className="flex flex-wrap gap-2">
          {FREQUENCY_OPTIONS.map((o) => (
            <button
              key={o.label}
              onClick={() => setTargetFrequency(o.value)}
              className={cn(
                "rounded-btn px-3 py-1.5 text-[12px] font-bold",
                targetFrequency === o.value ? "bg-text text-bg" : "bg-surface-2 text-text-dim"
              )}
            >
              {o.label}
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
