"use client";

import { useEffect } from "react";
import { useCalendarStore, type ReminderOption } from "./calendar-store";
import { formatDateKey } from "./calendar-utils";

// Module-scope so a note's "day before" reminder doesn't refire on every
// re-render within the same page session.
const notifiedNoteIds = new Set<string>();

export function useReminderNotifications() {
  const items = useCalendarStore((s) => s.items);

  useEffect(() => {
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const todayKey = formatDateKey(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowKey = formatDateKey(tomorrowDate);

    const timers: number[] = [];

    // "day" for an event means "the day before its date" — that can be up to
    // ~24h ahead, comfortably inside the 26h window below; "10min"/"1hour"
    // are always well inside it too.
    const MINUTES_BEFORE: Record<Exclude<ReminderOption, "none">, number> = {
      "10min": 10,
      "1hour": 60,
      day: 24 * 60,
    };

    for (const item of items) {
      if (item.kind === "event" && item.date === todayKey && item.time && item.reminder !== "none") {
        const [h, m] = item.time.split(":").map(Number);
        const start = new Date();
        start.setHours(h, m, 0, 0);

        const minutesBefore = MINUTES_BEFORE[item.reminder];
        const fireAt = start.getTime() - minutesBefore * 60_000;
        const delay = fireAt - Date.now();
        if (delay > 0 && delay < 26 * 60 * 60 * 1000) {
          // Same wording as the server's push body (send-reminders/route.ts)
          // — says the actual time, not just "today", so the two channels
          // never read as two different reminders about the same event.
          const body =
            minutesBefore >= 60 ? `Сьогодні о ${item.time}` : `Починається через ${minutesBefore} хв`;
          const timer = window.setTimeout(() => {
            new Notification(item.title, { body, tag: `${item.id}-${minutesBefore}` });
          }, delay);
          timers.push(timer);
        }
      }

      if (item.kind === "note" && item.reminder === "day" && item.date === tomorrowKey) {
        if (!notifiedNoteIds.has(item.id)) {
          notifiedNoteIds.add(item.id);
          new Notification("Нагадування на завтра", { body: item.title, tag: item.id });
        }
      }
    }

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [items]);
}

export function getNotificationPermission(): NotificationPermission | "unsupported" {
  if (typeof window === "undefined" || !("Notification" in window)) return "unsupported";
  return Notification.permission;
}

export function requestNotificationPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return Promise.resolve("unsupported" as const);
  return Notification.requestPermission();
}
