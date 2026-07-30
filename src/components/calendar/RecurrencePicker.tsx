"use client";

import { useState } from "react";
import type { EventRecurrence, RecurrenceEndType, RecurrenceType } from "@/lib/calendar-store";
import { cn } from "@/lib/cn";

const PRESETS: { type: RecurrenceType | "none"; label: string; sub?: string }[] = [
  { type: "none", label: "Не повторюється" },
  { type: "daily", label: "Щодня" },
  { type: "weekdays", label: "Будні дні", sub: "Пн, Вт, Ср, Чт, Пт" },
  { type: "weekend", label: "Вихідні", sub: "Сб, Нд" },
  { type: "weekly", label: "Щотижня в цей день" },
  { type: "custom", label: "Свої дні" },
];

const DAY_CHIPS = [
  { day: 1, label: "Пн" },
  { day: 2, label: "Вт" },
  { day: 3, label: "Ср" },
  { day: 4, label: "Чт" },
  { day: 5, label: "Пт" },
  { day: 6, label: "Сб" },
  { day: 0, label: "Нд" },
];

export function RecurrencePicker({
  initial,
  anchorDate,
  onApply,
  onClose,
}: {
  initial: EventRecurrence | null;
  anchorDate: string;
  onApply: (recurrence: EventRecurrence | null) => void;
  onClose: () => void;
}) {
  const [type, setType] = useState<RecurrenceType | "none">(initial?.type ?? "none");
  const [daysOfWeek, setDaysOfWeek] = useState<number[]>(initial?.daysOfWeek ?? []);
  const [endType, setEndType] = useState<RecurrenceEndType>(initial?.endCondition.type ?? "never");
  const [untilDate, setUntilDate] = useState(
    initial?.endCondition.type === "until" ? String(initial.endCondition.value) : anchorDate
  );
  const [count, setCount] = useState(initial?.endCondition.type === "count" ? Number(initial.endCondition.value) : 10);

  function toggleDay(day: number) {
    setDaysOfWeek((prev) => (prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day]));
  }

  function handleApply() {
    if (type === "none") {
      onApply(null);
      return;
    }
    onApply({
      type,
      daysOfWeek: type === "custom" ? daysOfWeek : [],
      endCondition:
        endType === "never"
          ? { type: "never" }
          : endType === "until"
            ? { type: "until", value: untilDate }
            : { type: "count", value: count },
      excludedDates: initial?.excludedDates ?? [],
    });
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-[9px] border border-border bg-surface text-text-dim"
          >
            ‹
          </button>
          <div className="font-heading text-[15px] font-semibold text-text">Повторення</div>
          <span className="w-7" />
        </div>

        <div className="mb-2">
          {PRESETS.map((p) => {
            const active = type === p.type;
            return (
              <button
                key={p.type}
                type="button"
                onClick={() => setType(p.type)}
                className="flex w-full items-center justify-between border-b border-border py-3.5 text-left last:border-b-0"
              >
                <div>
                  <div className="text-[13.5px] font-medium text-text">{p.label}</div>
                  {p.sub && <div className="mt-0.5 text-[10px] text-text-faint">{p.sub}</div>}
                </div>
                <span
                  className={cn(
                    "flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full border-[1.5px] text-[10px]",
                    active ? "border-sage bg-sage text-bg" : "border-border text-transparent"
                  )}
                >
                  ✓
                </span>
              </button>
            );
          })}
        </div>

        {type === "custom" && (
          <>
            <div className="mb-3 mt-4 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
              Дні тижня
            </div>
            <div className="mb-5 flex gap-1.5">
              {DAY_CHIPS.map((d) => (
                <button
                  key={d.day}
                  type="button"
                  onClick={() => toggleDay(d.day)}
                  className={cn(
                    "flex flex-1 aspect-square items-center justify-center rounded-full text-[12px] font-semibold",
                    daysOfWeek.includes(d.day) ? "bg-sage text-bg" : "bg-surface text-text-dim"
                  )}
                >
                  {d.label}
                </button>
              ))}
            </div>
          </>
        )}

        {type !== "none" && (
          <>
            <div className="mb-2 mt-2 text-[10.5px] font-semibold uppercase tracking-wide text-text-dim">
              Закінчити повторення
            </div>
            <div className="mb-4">
              <label className="flex items-center justify-between py-3">
                <span className="text-[13px] text-text">Ніколи</span>
                <input
                  type="radio"
                  name="end"
                  checked={endType === "never"}
                  onChange={() => setEndType("never")}
                  className="h-[18px] w-[18px] accent-[var(--sage)]"
                />
              </label>
              <label className="flex items-center justify-between py-3">
                <span className="text-[13px] text-text">До дати</span>
                <input
                  type="radio"
                  name="end"
                  checked={endType === "until"}
                  onChange={() => setEndType("until")}
                  className="h-[18px] w-[18px] accent-[var(--sage)]"
                />
              </label>
              {endType === "until" && (
                <input
                  type="date"
                  value={untilDate}
                  onChange={(e) => setUntilDate(e.target.value)}
                  className="mb-1 w-full rounded-input border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] text-text outline-none"
                />
              )}
              <label className="flex items-center justify-between py-3">
                <span className="text-[13px] text-text">Після кількості разів</span>
                <input
                  type="radio"
                  name="end"
                  checked={endType === "count"}
                  onChange={() => setEndType("count")}
                  className="h-[18px] w-[18px] accent-[var(--sage)]"
                />
              </label>
              {endType === "count" && (
                <input
                  type="number"
                  min={1}
                  value={count}
                  onChange={(e) => setCount(Math.max(1, Number(e.target.value)))}
                  className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] text-text outline-none"
                />
              )}
            </div>
          </>
        )}

        <button
          type="button"
          onClick={handleApply}
          className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
        >
          Застосувати
        </button>
      </div>
    </div>
  );
}
