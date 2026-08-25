"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CalendarCategory = "personal" | "work";

// "monthly" added for the redesign spec's simplified recurrence chips
// (Не повторюється/Щодня/Щотижня/Щомісяця) — weekdays/weekend/custom stay
// supported by the expansion engine (recurrence.ts) so any item saved with
// one of those types before the simplified form shipped keeps working, even
// though the form no longer offers them as first-class options.
export type RecurrenceType = "daily" | "weekdays" | "weekend" | "weekly" | "monthly" | "custom";
export type RecurrenceEndType = "never" | "until" | "count";

export interface RecurrenceEndCondition {
  type: RecurrenceEndType;
  value?: string | number; // date key ("YYYY-MM-DD") for "until", occurrence count for "count"
}

export interface EventRecurrence {
  type: RecurrenceType;
  daysOfWeek: number[]; // 0=Sunday..6=Saturday — only meaningful for "custom"
  endCondition: RecurrenceEndCondition;
  /** Occurrence dates ("YYYY-MM-DD") skipped during expansion — how "just this
   *  event" edits/deletes are represented without a separate exception model. */
  excludedDates: string[];
}

/** Single-choice reminder, replacing the old reminder30/reminder5/
 *  reminderDayBefore independent booleans — the redesign spec asks for one
 *  selected chip (Без нагадування/За 10 хв/За 1 год/За день), not a
 *  multi-checkbox list. Shared by events and notes alike. */
export type ReminderOption = "none" | "10min" | "1hour" | "day";

export interface CalendarItem {
  id: string;
  date: string; // "YYYY-MM-DD" — anchor date for recurring events
  kind: "event" | "note";
  title: string;
  time?: string; // "HH:MM", events only
  durationMinutes?: number; // events only
  category: CalendarCategory;
  reminder: ReminderOption;
  recurrence: EventRecurrence | null;
  /** Set only on the recurring "Прийом: <name>" events health-store creates
   *  for a medication reminder — links back to Medication.id so the День/
   *  Тиждень views can render a compact count marker instead of a full
   *  event card, and resolve+toggle the same `taken` state the Ліки widget
   *  uses (see MedsQuickView.tsx), rather than duplicating it. */
  medicationId?: string;
  /** User-flagged "this is a workout" — simpler than a third CalendarCategory
   *  (which would touch every CATEGORY_LABEL/CATEGORY_COLOR record and the
   *  categoriesByDate Set<CalendarCategory> typing across Day/Week/Month)
   *  for what's otherwise an orthogonal, optional flag. Drives auto-sync
   *  into health-store's Активність — see use-workout-activity-sync.ts. */
  isWorkout?: boolean;
}

function seedItems(): CalendarItem[] {
  return [];
}

/** Fire-and-forget — /api/push/send-reminders is the only thing that reads
 *  this, and it's fine if a sync lands a few seconds late or even fails
 *  outright (the in-app setTimeout reminder in use-reminder-notifications.ts
 *  still works independently while the tab is open). Never blocks the
 *  actual store update on network. `reminder: "none"` and no-id both mean
 *  "delete" server-side — see /api/calendar/reminders/sync/route.ts. */
function syncReminderToServer(item: CalendarItem) {
  fetch("/api/calendar/reminders/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: item.id,
      title: item.title,
      date: item.date,
      time: item.time ?? null,
      kind: item.kind,
      reminder: item.reminder,
      recurrence: item.recurrence,
    }),
  }).catch(() => undefined);
}

function deleteReminderFromServer(id: string) {
  fetch("/api/calendar/reminders/sync", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ id, reminder: "none" }),
  }).catch(() => undefined);
}

interface CalendarState {
  items: CalendarItem[];
  addItem: (item: Omit<CalendarItem, "id">) => void;
  updateItem: (id: string, patch: Partial<Omit<CalendarItem, "id">>) => void;
  removeItem: (id: string) => void;
}

/** v0(unversioned) -> v1: the three independent reminder booleans collapse
 *  into one `reminder` choice. An event that had the finer 5-minute warning
 *  set is treated as wanting the closer of the two new options (10хв); one
 *  that only had the coarser 30-minute warning maps to the next option up
 *  (1год) rather than rounding it down to a warning it never asked for. A
 *  note's day-before flag maps straight across. Nothing set on either side
 *  becomes "none", never a guessed default. */
export function migrateReminderFields(
  items: (Omit<CalendarItem, "reminder"> & {
    reminder30?: boolean;
    reminder5?: boolean;
    reminderDayBefore?: boolean;
    reminder?: ReminderOption;
  })[]
): CalendarItem[] {
  return items.map((item) => {
    if (item.reminder) return item as CalendarItem;
    const { reminder30, reminder5, reminderDayBefore, ...rest } = item;
    let reminder: ReminderOption = "none";
    if (item.kind === "note") {
      reminder = reminderDayBefore ? "day" : "none";
    } else if (reminder5) {
      reminder = "10min";
    } else if (reminder30) {
      reminder = "1hour";
    }
    return { ...rest, reminder };
  });
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      items: seedItems(),
      addItem: (item) => {
        const created: CalendarItem = { ...item, id: crypto.randomUUID() };
        set((s) => ({ items: [...s.items, created] }));
        syncReminderToServer(created);
      },
      updateItem: (id, patch) => {
        let updated: CalendarItem | undefined;
        set((s) => ({
          items: s.items.map((i) => {
            if (i.id !== id) return i;
            updated = { ...i, ...patch };
            return updated;
          }),
        }));
        if (updated) syncReminderToServer(updated);
      },
      removeItem: (id) => {
        set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
        deleteReminderFromServer(id);
      },
    }),
    {
      name: "life-os-calendar-v2",
      version: 1,
      migrate: (persisted, version) => {
        const state = persisted as CalendarState;
        let items = state.items ?? [];
        if (version < 1) items = migrateReminderFields(items);
        return { ...state, items };
      },
    }
  )
);
