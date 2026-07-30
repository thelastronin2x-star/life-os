"use client";

import { useEffect } from "react";
import { useEconomicCalendar } from "./use-economic-calendar";
import { formatDateKey } from "./calendar-utils";

const EVENING_HOUR = 21; // fixed local time for the "tomorrow's news" summary
const EVENING_NOTIFIED_KEY = "life-os-evening-news-notified";

/** Best-effort in-tab notifications for economic news: 30 min before each of
 *  today's releases, plus a fixed-time evening summary of tomorrow's
 *  high-impact releases. Only fires while a tab of the app stays open. */
export function useNewsReminders(enabled: boolean) {
  const { events } = useEconomicCalendar();

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined" || !("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    const todayKey = formatDateKey(new Date());
    const tomorrowKey = formatDateKey(new Date(Date.now() + 24 * 60 * 60 * 1000));
    const timers: number[] = [];

    for (const event of events) {
      if (event.date !== todayKey) continue;
      const [h, m] = event.time.split(":").map(Number);
      const eventAt = new Date();
      eventAt.setHours(h, m, 0, 0);
      const fireAt = eventAt.getTime() - 30 * 60_000;
      const delay = fireAt - Date.now();
      if (delay > 0 && delay < 24 * 60 * 60 * 1000) {
        const timer = window.setTimeout(() => {
          new Notification(`${event.name} через 30 хв`, {
            body: `${event.time} · ${event.currency} · прогноз ${event.forecast}`,
            tag: `news-30-${event.id}`,
          });
        }, delay);
        timers.push(timer);
      }
    }

    const tomorrowHighImpact = events.filter((e) => e.date === tomorrowKey && e.impact === 3);

    if (tomorrowHighImpact.length > 0) {
      const notifiedKey = `${EVENING_NOTIFIED_KEY}-${todayKey}`;
      const alreadyNotified = localStorage.getItem(notifiedKey) === "1";

      if (!alreadyNotified) {
        const fire = () => {
          const names = tomorrowHighImpact.map((e) => `${e.name} (${e.time})`).join(", ");
          new Notification("Важливі новини завтра", { body: names, tag: `evening-news-${todayKey}` });
          localStorage.setItem(notifiedKey, "1");
        };

        const eveningAt = new Date();
        eveningAt.setHours(EVENING_HOUR, 0, 0, 0);
        const delay = eveningAt.getTime() - Date.now();

        if (delay <= 0) {
          fire();
        } else {
          const timer = window.setTimeout(fire, delay);
          timers.push(timer);
        }
      }
    }

    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [enabled, events]);
}
