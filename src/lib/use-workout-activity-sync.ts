"use client";

import { useCallback, useEffect } from "react";
import { useCalendarStore } from "./calendar-store";
import { useHealthStore } from "./health-store";
import { expandItemsForRange } from "./recurrence";
import { waitForHydration } from "./store-hydration";

const SYNC_POLL_MS = 60_000;
// How far back an ended workout can still be picked up — wide enough to
// cover the app being closed for a while, narrow enough that isWorkout
// being set on an old one-off event years ago never surfaces as "just
// ended" the next time someone opens the app.
const LOOKBACK_HOURS = 24;

function eventEndInstant(item: { date: string; time?: string; durationMinutes?: number }): Date | null {
  if (!item.time) return null;
  const [h, m] = item.time.split(":").map(Number);
  const start = new Date(`${item.date}T00:00:00`);
  start.setHours(h, m, 0, 0);
  return new Date(start.getTime() + (item.durationMinutes ?? 0) * 60_000);
}

/** Best-effort client-side substitute for a server cron, same rationale as
 *  checkAndGenerateAutoReports in AppLayout — there's no server-side store
 *  this app can wake a job against, so instead this polls while the app is
 *  open and catches up on anything that ended since the last check. Mounted
 *  once in AppLayout (not just the Calendar page) so a workout logged
 *  earlier still syncs into Активність even if the user goes straight to
 *  Здоровʼя afterward without revisiting Calendar. */
export function useWorkoutActivitySync() {
  const runSync = useCallback(() => {
    const now = new Date();
    const rangeStart = new Date(now.getTime() - LOOKBACK_HOURS * 3600_000);
    const items = useCalendarStore.getState().items;
    const occurrences = expandItemsForRange(items, rangeStart, now).filter(
      (i) => i.isWorkout && i.kind === "event"
    );
    if (occurrences.length === 0) return;

    const health = useHealthStore.getState();
    for (const occ of occurrences) {
      const endsAt = eventEndInstant(occ);
      if (!endsAt || endsAt > now) continue; // hasn't ended yet
      const alreadySynced = health.activityEntries.some(
        (a) => a.calendarEventId === occ.id && a.date === occ.date
      );
      if (alreadySynced) continue;
      health.upsertCalendarActivity({
        calendarEventId: occ.id,
        date: occ.date,
        type: occ.title,
        minutes: occ.durationMinutes ?? 0,
      });
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    let interval: ReturnType<typeof setInterval> | undefined;

    waitForHydration([useCalendarStore, useHealthStore]).then(() => {
      if (cancelled) return;
      runSync();
      interval = setInterval(runSync, SYNC_POLL_MS);
    });

    function onVisible() {
      if (document.visibilityState === "visible") runSync();
    }
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      cancelled = true;
      if (interval) clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [runSync]);
}
