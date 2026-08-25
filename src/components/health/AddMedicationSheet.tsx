"use client";

import { useState } from "react";
import { cn } from "@/lib/cn";

interface AddMedicationSheetProps {
  onClose: () => void;
  onSubmit: (data: { name: string; time: string; dose: string; addReminder: boolean }) => void;
}

/** Bottom sheet for adding a medication/supplement — same shared chrome as
 *  CustomWaterAmountSheet.tsx elsewhere in Здоров'я, replacing the old
 *  always-visible inline form at the bottom of the detail screen. */
export function AddMedicationSheet({ onClose, onSubmit }: AddMedicationSheetProps) {
  const [name, setName] = useState("");
  const [dose, setDose] = useState("");
  const [time, setTime] = useState("09:00");
  const [addReminder, setAddReminder] = useState(true);

  function handleSubmit() {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit({ name: trimmed, time, dose: dose.trim(), addReminder });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-3 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">Ліки чи добавка</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <div className="space-y-2">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Назва (напр. Вітамін D)"
            autoFocus
            className="w-full rounded-input border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-text outline-none"
          />
          <input
            value={dose}
            onChange={(e) => setDose(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSubmit()}
            placeholder="Дозування (напр. 2000 МО) — необовʼязково"
            className="w-full rounded-input border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-text outline-none"
          />
          <div className="flex items-center gap-2">
            <input
              type="time"
              value={time}
              onChange={(e) => setTime(e.target.value)}
              className="rounded-input border border-border bg-surface-2 px-3.5 py-2.5 text-[13px] text-text outline-none"
            />
            <button
              onClick={() => setAddReminder((v) => !v)}
              className={cn(
                "flex flex-1 items-center gap-2 rounded-input border px-3 py-2.5 text-[11px]",
                addReminder ? "border-sage bg-sage-soft text-sage" : "border-border bg-surface-2 text-text-faint"
              )}
            >
              <span
                className={cn(
                  "flex h-3.5 w-3.5 flex-shrink-0 items-center justify-center rounded-[4px] border text-[8px]",
                  addReminder ? "border-sage bg-sage text-bg" : "border-border"
                )}
              >
                {addReminder ? "✓" : ""}
              </span>
              Нагадування в Календарі
            </button>
          </div>
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
