"use client";

import { useMemo, useState } from "react";
import {
  useCalendarStore,
  type CalendarCategory,
  type CalendarItem,
  type EventRecurrence,
  type ReminderOption,
  type RecurrenceType,
} from "@/lib/calendar-store";
import { formatDateKey, parseEventText } from "@/lib/calendar-utils";
import { frequentTitles } from "@/lib/calendar-suggestions";
import { TimeWheelPicker } from "./ScrollPicker";
import { SparkleIcon } from "@/components/icons";
import { cn } from "@/lib/cn";

type Kind = "event" | "note";
type SimpleRepeat = RecurrenceType | "none";

const CATEGORY_LABEL: Record<CalendarCategory, string> = {
  personal: "Особисте",
  work: "Робота",
};

const DURATION_STEP = 15;

const REMINDER_OPTIONS: { value: ReminderOption; label: string }[] = [
  { value: "none", label: "Без нагадування" },
  { value: "10min", label: "За 10 хв" },
  { value: "1hour", label: "За 1 год" },
  { value: "day", label: "За день" },
];

// Weekdays/weekend/custom (from before the redesign) still expand correctly
// via recurrence.ts — this quick-add flow just doesn't offer them anymore.
// An item saved with one of those shows here as "Не повторюється" rather
// than a chip claiming a state it isn't in; picking any chip overwrites it.
const REPEAT_OPTIONS: { value: SimpleRepeat; label: string }[] = [
  { value: "none", label: "Не повторюється" },
  { value: "daily", label: "Щодня" },
  { value: "weekly", label: "Щотижня" },
  { value: "monthly", label: "Щомісяця" },
];

function durationLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} хв`;
  if (minutes === 60) return "1 год";
  if (minutes % 60 === 0) return `${minutes / 60} год`;
  return `${Math.floor(minutes / 60)} год ${minutes % 60} хв`;
}

function shiftDay(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T12:00:00`);
  d.setDate(d.getDate() + days);
  return formatDateKey(d);
}

function shortDay(dateKey: string): string {
  return new Date(`${dateKey}T12:00:00`).toLocaleDateString("uk-UA", { weekday: "short" });
}

/** The nearest round hour AHEAD of right now — 14:20 starts the picker at
 *  15:00, not the hour already half gone. Wraps past 23 rather than
 *  overflowing; the rare case of picking this up in the last half hour of
 *  the day just lands on 00:00 today instead of rolling the date too. */
function getDefaultHour(): number {
  const now = new Date();
  return now.getMinutes() > 0 ? (now.getHours() + 1) % 24 : now.getHours();
}

function roundToStep5(minute: number): number {
  return Math.round(minute / 5) * 5 % 60;
}

function reminderLabel(value: ReminderOption): string {
  return REMINDER_OPTIONS.find((o) => o.value === value)?.label ?? "Без нагадування";
}

function repeatLabel(value: SimpleRepeat): string {
  return REPEAT_OPTIONS.find((o) => o.value === value)?.label ?? "Не повторюється";
}

/** Quick-add bottom sheet — one text field that doubles as the title and a
 *  free-text date/time source (parseEventText picks up "завтра", "у
 *  п'ятницю", "о 15:00" etc. as you type; the chips below are the reliable
 *  fallback when it doesn't recognize something, not a replacement for it),
 *  a category tap, and a single collapsed "Нагадування та повторення" row so
 *  the two rarely-changed settings don't sit in the way of the 1-2-tap common
 *  case. Sensible defaults (За 10 хв, не повторюється) apply even if that
 *  row is never opened. */
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
  const items = useCalendarStore((s) => s.items);

  const [kind, setKind] = useState<Kind>(editingItem?.kind ?? "event");
  const [title, setTitle] = useState(editingItem?.title ?? "");
  const [date, setDate] = useState(editingItem?.date ?? initialDateKey);
  // The wheel picker and the quick-time chips share this one value, not two
  // — a chip tap moves the wheel, and scrolling the wheel by hand drops
  // whichever chip used to match (see the `time === t` comparison below,
  // which just stops being true once the wheel no longer agrees).
  const [selectedHour, setSelectedHour] = useState<number>(() =>
    editingItem?.time ? parseInt(editingItem.time.split(":")[0], 10) : getDefaultHour()
  );
  const [selectedMinute, setSelectedMinute] = useState<number>(() =>
    editingItem?.time ? roundToStep5(parseInt(editingItem.time.split(":")[1], 10)) : 0
  );
  const time = `${String(selectedHour).padStart(2, "0")}:${String(selectedMinute).padStart(2, "0")}`;
  const [duration, setDuration] = useState(editingItem?.durationMinutes ?? 60);
  const [category, setCategory] = useState<CalendarCategory>(editingItem?.category ?? "personal");
  const [isWorkout, setIsWorkout] = useState(editingItem?.isWorkout ?? false);
  const [reminder, setReminder] = useState<ReminderOption>(
    editingItem?.reminder ?? (kind === "note" ? "day" : "10min")
  );
  const initialRepeat = editingItem?.recurrence?.type;
  const [repeatType, setRepeatType] = useState<SimpleRepeat>(
    initialRepeat === "daily" || initialRepeat === "weekly" || initialRepeat === "monthly" ? initialRepeat : "none"
  );
  const [remindersOpen, setRemindersOpen] = useState(false);

  const suggestions = useMemo(() => (editingItem ? [] : frequentTitles(items)), [items, editingItem]);

  const today = formatDateKey(new Date());
  const dayChips = [
    { key: today, label: "Сьогодні" },
    { key: shiftDay(today, 1), label: "Завтра" },
    { key: shiftDay(today, 2), label: shortDay(shiftDay(today, 2)) },
  ];

  function handleTitleChange(value: string) {
    setTitle(value);
    // Live recognition as you type — chips stay the reliable override, this
    // is just a head start so typing "завтра о 15:00" alone is enough.
    const parsed = parseEventText(value);
    if (parsed.date) setDate(parsed.date);
    if (parsed.time && kind === "event") {
      const [h, m] = parsed.time.split(":").map(Number);
      setSelectedHour(h);
      setSelectedMinute(roundToStep5(m));
    }
  }

  function handleTitleBlur() {
    // Cleans the recognized phrase out of the title only once focus leaves
    // the field — stripping it on every keystroke would delete text out from
    // under someone still typing.
    const parsed = parseEventText(title);
    if (parsed.date || parsed.time) setTitle(parsed.title);
  }

  function submit() {
    const cleanedTitle = parseEventText(title).title.trim() || title.trim();
    if (!cleanedTitle) return;

    const recurrence: EventRecurrence | null =
      repeatType === "none"
        ? null
        : {
            type: repeatType,
            daysOfWeek: [],
            endCondition: { type: "never" },
            excludedDates: editingItem?.recurrence?.excludedDates ?? [],
          };

    onSave({
      kind,
      title: cleanedTitle,
      date,
      time: kind === "event" ? time : undefined,
      durationMinutes: kind === "event" ? duration : undefined,
      category,
      reminder,
      recurrence: kind === "event" ? recurrence : null,
      isWorkout: kind === "event" ? isWorkout : undefined,
    });
  }

  const fieldClass = "w-full rounded-input bg-surface px-3.5 py-2.5 text-[14px] font-bold text-text outline-none";
  const rowClass = "flex w-full items-center gap-3 rounded-input bg-surface px-3.5 py-3 text-left";

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/45 md:items-center">
      <div className="max-h-[92vh] w-full max-w-md overflow-y-auto rounded-t-card bg-bg p-3.5 pb-6 md:rounded-card">
        <div className="mx-auto mb-3 h-1 w-9 rounded-full bg-border md:hidden" />

        <div className="mb-3 flex items-center justify-between">
          <div className="text-[17px] font-extrabold tracking-tight text-text">
            {editingItem ? "Редагувати" : kind === "event" ? "Нова подія" : "Нове нагадування"}
          </div>
          <button onClick={onClose} className="text-[13px] font-bold text-text-dim">
            Закрити
          </button>
        </div>

        {!editingItem && (
          <div className="mb-2.5 flex rounded-btn bg-surface-2 p-1">
            {(["event", "note"] as const).map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => setKind(k)}
                className={cn(
                  "flex-1 rounded-btn py-2 text-center text-[12.5px] font-extrabold",
                  kind === k ? "bg-surface text-text shadow-card" : "text-text-dim"
                )}
              >
                {k === "event" ? "Подія" : "Нагадування"}
              </button>
            ))}
          </div>
        )}

        <input
          type="text"
          placeholder="Напр. Дзвінок з клієнтом завтра о 15:00"
          value={title}
          onChange={(e) => handleTitleChange(e.target.value)}
          onBlur={handleTitleBlur}
          className={fieldClass}
        />
        <div className="mt-1.5 px-0.5 text-[10.5px] text-text-faint">
          Пиши вільно — дату й час розпізнаємо з тексту
        </div>

        {suggestions.length > 0 && (
          <>
            <div className="mb-1.5 mt-3 px-0.5 text-[12px] font-extrabold text-text-faint">Часте</div>
            <div className="flex gap-2">
              {suggestions.map((s) => (
                <button
                  key={s.title}
                  type="button"
                  onClick={() => {
                    setTitle(s.title);
                    setCategory(s.category);
                    if (s.time) {
                      const [h, m] = s.time.split(":").map(Number);
                      setSelectedHour(h);
                      setSelectedMinute(roundToStep5(m));
                    }
                  }}
                  className="min-w-0 flex-1 rounded-card-sm bg-surface-2 p-2.5 text-center text-text"
                >
                  <div className="truncate text-[12px] font-extrabold">{s.title}</div>
                  {s.time && <div className="mt-0.5 font-mono text-[11px] font-bold opacity-75">{s.time}</div>}
                </button>
              ))}
            </div>
          </>
        )}

        <div className="mb-1.5 mt-3.5 px-0.5 text-[12px] font-extrabold text-text-faint">Коли</div>
        <div className="flex flex-wrap gap-2">
          {dayChips.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setDate(c.key)}
              className={cn(
                "rounded-btn px-3.5 py-2 text-[12.5px] font-extrabold capitalize",
                date === c.key ? "bg-text text-bg" : "bg-surface text-text-dim"
              )}
            >
              {c.label}
            </button>
          ))}
          <label
            className={cn(
              "relative rounded-btn px-3.5 py-2 text-[12.5px] font-extrabold",
              dayChips.every((c) => c.key !== date) ? "bg-text text-bg" : "bg-surface text-text-dim"
            )}
          >
            {dayChips.every((c) => c.key !== date)
              ? new Date(`${date}T12:00:00`).toLocaleDateString("uk-UA", { day: "2-digit", month: "2-digit" })
              : "Обрати"}
            <input
              type="date"
              value={date}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 opacity-0"
            />
          </label>
        </div>

        {kind === "event" && (
          <>
            <div className="mb-1.5 mt-3.5 px-0.5 text-[12px] font-extrabold text-text-faint">Час</div>
            <div className="flex justify-center">
              <TimeWheelPicker
                hour={selectedHour}
                minute={selectedMinute}
                onChangeHour={setSelectedHour}
                onChangeMinute={setSelectedMinute}
              />
            </div>

            <div className="mb-1.5 mt-3 px-0.5 text-[12px] font-extrabold text-text-faint">Тривалість</div>
            <div className="flex items-center justify-center gap-4 rounded-input bg-surface py-3">
              <button
                type="button"
                onClick={() => setDuration((d) => Math.max(DURATION_STEP, d - DURATION_STEP))}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-[18px] font-bold text-text"
              >
                −
              </button>
              <span className="min-w-[92px] text-center font-mono text-[15px] font-extrabold text-text">
                {durationLabel(duration)}
              </span>
              <button
                type="button"
                onClick={() => setDuration((d) => d + DURATION_STEP)}
                className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-[18px] font-bold text-text"
              >
                +
              </button>
            </div>
          </>
        )}

        <div className="mb-1.5 mt-3.5 px-0.5 text-[12px] font-extrabold text-text-faint">Категорія</div>
        <div className="flex gap-2">
          {(["personal", "work"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setCategory(c)}
              className={cn(
                "flex-1 rounded-btn py-2 text-center text-[12.5px] font-extrabold",
                category === c ? "bg-text text-bg" : "bg-surface text-text-dim"
              )}
            >
              {CATEGORY_LABEL[c]}
            </button>
          ))}
        </div>

        {kind === "event" && (
          <label className={cn(rowClass, "mt-2.5 cursor-pointer")}>
            <input
              type="checkbox"
              checked={isWorkout}
              onChange={(e) => setIsWorkout(e.target.checked)}
              className="h-[18px] w-[18px] flex-shrink-0 accent-[var(--health-activity)]"
            />
            <span className="min-w-0 flex-1">
              <span className="block text-[13.5px] font-bold text-text">Це тренування</span>
              <span className="mt-0.5 block text-[10.5px] text-text-faint">
                Після завершення зʼявиться в Активності на Здоровʼї
              </span>
            </span>
          </label>
        )}

        <button
          type="button"
          onClick={() => setRemindersOpen((v) => !v)}
          className={cn(rowClass, "mt-3.5")}
        >
          <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface-2 text-text-dim">
            <SparkleIcon className="h-4 w-4" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10.5px] font-extrabold text-text-faint">Нагадування та повторення</span>
            <span className="mt-0.5 block truncate text-[13.5px] font-bold text-text">
              {reminderLabel(reminder)}
              {kind === "event" ? ` · ${repeatLabel(repeatType)}` : ""}
            </span>
          </span>
          <span className={cn("flex-shrink-0 text-[16px] text-text-faint transition-transform", remindersOpen && "rotate-90")}>
            ›
          </span>
        </button>

        {remindersOpen && (
          <div className="mt-2 space-y-3 rounded-input bg-surface p-3.5">
            <div>
              <div className="mb-1.5 text-[10.5px] font-extrabold text-text-faint">Нагадати</div>
              <div className="flex flex-wrap gap-2">
                {REMINDER_OPTIONS.map((o) => (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setReminder(o.value)}
                    className={cn(
                      "rounded-btn px-3 py-1.5 text-[12px] font-bold",
                      reminder === o.value ? "bg-text text-bg" : "bg-surface-2 text-text-dim"
                    )}
                  >
                    {o.label}
                  </button>
                ))}
              </div>
            </div>

            {kind === "event" && (
              <div>
                <div className="mb-1.5 text-[10.5px] font-extrabold text-text-faint">Повторювати</div>
                <div className="flex flex-wrap gap-2">
                  {REPEAT_OPTIONS.map((o) => (
                    <button
                      key={o.value}
                      type="button"
                      onClick={() => setRepeatType(o.value)}
                      className={cn(
                        "rounded-btn px-3 py-1.5 text-[12px] font-bold",
                        repeatType === o.value ? "bg-text text-bg" : "bg-surface-2 text-text-dim"
                      )}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <button
          type="button"
          onClick={submit}
          disabled={!title.trim()}
          className="mt-3.5 w-full rounded-btn bg-text py-3.5 text-center text-[14px] font-extrabold text-bg disabled:opacity-40"
        >
          {editingItem ? "Зберегти" : "Додати подію"}
        </button>

        {editingItem && onDelete && (
          <button
            type="button"
            onClick={() => onDelete(editingItem.id)}
            className="mt-2 w-full rounded-btn bg-clay-soft py-3 text-center text-[13px] font-extrabold text-clay"
          >
            Видалити
          </button>
        )}
      </div>
    </div>
  );
}
