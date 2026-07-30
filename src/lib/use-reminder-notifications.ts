"use client";

import { useEffect } from "react";
import { useCalendarStore } from "./calendar-store";
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

    for (const item of items) {
      if (item.kind === "event" && item.date === todayKey && item.time) {
        const [h, m] = item.time.split(":").map(Number);
        const start = new Date();
        start.setHours(h, m, 0, 0);

        const schedule = (minutesBefore: number, enabled: boolean) => {
          if (!enabled) return;
          const fireAt = start.getTime() - minutesBefore * 60_000;
          const delay = fireAt - Date.now();
          if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
            const timer = window.setTimeout(() => {
              new Notification(item.title, {
                body: minutesBefore === 0 ? "Починається зараз" : `Починається через ${minutesBefore} хв`,
                tag: `${item.id}-${minutesBefore}`,
              });
            }, delay);
            timers.push(timer);
          }
        };

        schedule(30, item.reminder30);
        schedule(5, item.reminder5);
      }

      if (item.kind === "note" && item.reminderDayBefore && item.date === tomorrowKey) {
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
