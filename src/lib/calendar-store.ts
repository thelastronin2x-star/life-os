"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";

export type CalendarCategory = "personal" | "work";

export type RecurrenceType = "daily" | "weekdays" | "weekend" | "weekly" | "custom";
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

export interface CalendarItem {
  id: string;
  date: string; // "YYYY-MM-DD" — anchor date for recurring events
  kind: "event" | "note";
  title: string;
  time?: string; // "HH:MM", events only
  durationMinutes?: number; // events only
  category: CalendarCategory;
  reminder30: boolean;
  reminder5: boolean;
  reminderDayBefore: boolean;
  recurrence: EventRecurrence | null;
}

function seedItems(): CalendarItem[] {
  return [];
}

interface CalendarState {
  items: CalendarItem[];
  addItem: (item: Omit<CalendarItem, "id">) => void;
  updateItem: (id: string, patch: Partial<Omit<CalendarItem, "id">>) => void;
  removeItem: (id: string) => void;
}

export const useCalendarStore = create<CalendarState>()(
  persist(
    (set) => ({
      items: seedItems(),
      addItem: (item) =>
        set((s) => ({
          items: [...s.items, { ...item, id: crypto.randomUUID() }],
        })),
      updateItem: (id, patch) =>
        set((s) => ({
          items: s.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
        })),
      removeItem: (id) =>
        set((s) => ({ items: s.items.filter((i) => i.id !== id) })),
    }),
    { name: "life-os-calendar-v2" }
  )
);
