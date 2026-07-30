"use client";

import { useState } from "react";
import type { CalendarCategory, CalendarItem, EventRecurrence } from "@/lib/calendar-store";
import { describeRecurrence } from "@/lib/recurrence";
import { RecurrencePicker } from "./RecurrencePicker";
import { RepeatIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

type Kind = "event" | "note";

export function EventForm({
  initialDateKey,
  editingItem,
  onSave,
  onClose,
  onDelete,
}: {
  initialDateKey: string;
  editingItem: CalendarItem | null;
  onSave: (data: Omit<CalendarItem, "id">) => void;
  onClose: () => void;
  onDelete?: (id: string) => void;
}) {
  const [kind, setKind] = useState<Kind>(editingItem?.kind ?? "event");
  const [title, setTitle] = useState(editingItem?.title ?? "");
  const [date, setDate] = useState(editingItem?.date ?? initialDateKey);
  const [time, setTime] = useState(editingItem?.time ?? "09:00");
  const [duration, setDuration] = useState(editingItem?.durationMinutes ?? 60);
  const [category, setCategory] = useState<CalendarCategory>(editingItem?.category ?? "personal");
  const [reminder30, setReminder30] = useState(editingItem?.reminder30 ?? true);
  const [reminder5, setReminder5] = useState(editingItem?.reminder5 ?? false);
  const [reminderDayBefore, setReminderDayBefore] = useState(editingItem?.reminderDayBefore ?? true);
  const [recurrence, setRecurrence] = useState<EventRecurrence | null>(editingItem?.recurrence ?? null);
  const [recurrencePickerOpen, setRecurrencePickerOpen] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;

    onSave({
      kind,
      title: title.trim(),
      date,
      time: kind === "event" ? time : undefined,
      durationMinutes: kind === "event" ? duration : undefined,
      category,
      reminder30: kind === "event" ? reminder30 : false,
      reminder5: kind === "event" ? reminder5 : false,
      reminderDayBefore: kind === "note" ? reminderDayBefore : false,
      recurrence: kind === "event" ? recurrence : null,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="max-h-[85vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">
            {editingItem ? "Редагувати" : "Нове"}
          </div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        <div className="mb-3 flex rounded-xl border border-border bg-surface p-1">
          {(["event", "note"] as const).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setKind(k)}
              className={cn(
                "flex-1 rounded-lg py-2 text-center text-xs font-semibold",
                kind === k ? "bg-surface-2 text-text" : "text-text-faint"
              )}
            >
              {k === "event" ? "Подія" : "Нотатка"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-2.5">
          <input
            type="text"
            placeholder={kind === "event" ? "Назва події" : "Текст нотатки"}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            required
            className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 text-[13px] text-text outline-none"
          />

          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            className="w-full rounded-input border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] text-text outline-none"
          />

          {kind === "event" && (
            <>
              <div className="flex gap-2">
                <input
                  type="time"
                  value={time}
                  onChange={(e) => setTime(e.target.value)}
                  className="flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 font-mono text-[12px] text-text outline-none"
                />
                <select
                  value={duration}
                  onChange={(e) => setDuration(Number(e.target.value))}
                  className="flex-1 rounded-input border border-border bg-surface-2 px-3 py-2 text-[12px] text-text outline-none"
                >
                  <option value={15}>15 хв</option>
                  <option value={30}>30 хв</option>
                  <option value={60}>1 год</option>
                  <option value={90}>1 год 30 хв</option>
                  <option value={120}>2 год</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setRecurrencePickerOpen(true)}
                className="flex w-full items-center gap-3 rounded-input border border-border bg-surface-2 px-3 py-2.5 text-left"
              >
                <RepeatIcon className="h-3.5 w-3.5 flex-shrink-0 text-text-faint" />
                <span className="min-w-0 flex-1">
                  <span className="block text-[9.5px] uppercase tracking-wide text-text-faint">Повторення</span>
                  <span className={cn("block truncate text-[13px] font-medium", recurrence ? "text-sage" : "text-text")}>
                    {describeRecurrence(recurrence)}
                  </span>
                </span>
                <span className="flex-shrink-0 text-text-faint">›</span>
              </button>

              <div className="flex rounded-xl border border-border bg-surface p-1">
                {(["personal", "work"] as const).map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCategory(c)}
                    className={cn(
                      "flex-1 rounded-lg py-2 text-center text-xs font-semibold",
                      category === c ? "bg-surface-2 text-text" : "text-text-faint"
                    )}
                  >
                    {c === "personal" ? "Особисте" : "Робота"}
                  </button>
                ))}
              </div>

              <div className="rounded-input border border-border bg-surface-2 p-3">
                <div className="mb-2 text-[10.5px] font-semibold text-text-dim">Нагадування</div>
                <label className="mb-1.5 flex items-center justify-between text-[12px] text-text">
                  За 30 хвилин до початку
                  <input
                    type="checkbox"
                    checked={reminder30}
                    onChange={(e) => setReminder30(e.target.checked)}
                    className="h-4 w-4 accent-[var(--sage)]"
                  />
                </label>
                <label className="flex items-center justify-between text-[12px] text-text">
                  За 5 хвилин до початку
                  <input
                    type="checkbox"
                    checked={reminder5}
                    onChange={(e) => setReminder5(e.target.checked)}
                    className="h-4 w-4 accent-[var(--sage)]"
                  />
                </label>
              </div>
            </>
          )}

          {kind === "note" && (
            <label className="flex items-center justify-between rounded-input border border-border bg-surface-2 p-3 text-[12px] text-text">
              Нагадати за день до
              <input
                type="checkbox"
                checked={reminderDayBefore}
                onChange={(e) => setReminderDayBefore(e.target.checked)}
                className="h-4 w-4 accent-[var(--sage)]"
              />
            </label>
          )}

          <button
            type="submit"
            className="w-full rounded-btn bg-accent py-2.5 text-center text-[12.5px] font-semibold text-bg"
          >
            Зберегти
          </button>

          {editingItem && onDelete && (
            <button
              type="button"
              onClick={() => onDelete(editingItem.id)}
              className="w-full rounded-btn border border-rose/30 py-2.5 text-center text-[12.5px] font-semibold text-rose"
            >
              Видалити
            </button>
          )}
        </form>
      </div>

      {recurrencePickerOpen && (
        <RecurrencePicker
          initial={recurrence}
          anchorDate={date}
          onApply={(next) => {
            setRecurrence(next);
            setRecurrencePickerOpen(false);
          }}
          onClose={() => setRecurrencePickerOpen(false)}
        />
      )}
    </div>
  );
}
