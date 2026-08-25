/** Pure math for the water-reminder cron (see /api/push/send-reminders'
 *  sendWaterReminders) and, if a client-side preview is ever added, the
 *  settings screen too — no timezone/Date handling baked in on purpose.
 *  The cron runs on Vercel in UTC, not Europe/Kyiv, so "now" has to arrive
 *  as an already-Kyiv-resolved minutes-since-midnight number rather than a
 *  bare `Date` (a literal `new Date().getHours()` would silently read the
 *  server's UTC hour instead of the person's actual wall-clock hour — the
 *  exact class of bug kyiv-time.ts already exists to avoid elsewhere). */

function parseHHMM(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function formatHHMM(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** Evenly spaced reminder times strictly inside (activeStart, activeEnd) —
 *  never exactly on either boundary, so a reminder never fires the instant
 *  the active window opens or closes. Returns [] for 0 reminders or an
 *  inverted/empty window (end <= start). */
export function computeReminderTimes(remindersPerDay: number, activeStart: string, activeEnd: string): string[] {
  if (remindersPerDay <= 0) return [];
  const startMinutes = parseHHMM(activeStart);
  const endMinutes = parseHHMM(activeEnd);
  if (endMinutes <= startMinutes) return [];

  const interval = (endMinutes - startMinutes) / (remindersPerDay + 1);
  return Array.from({ length: remindersPerDay }, (_, i) => formatHHMM(startMinutes + interval * (i + 1)));
}

/** True once today's intake is already at or ahead of the pace a straight
 *  line from 0 to dailyGoalMl across the active window would predict for
 *  this time of day — a reminder due at this moment gets silently skipped
 *  rather than nagging someone who's already keeping up. `nowMinutes` is
 *  the reminder slot's own time-of-day (parsed from its "HH:MM"), not a
 *  live clock read — the cron only ever evaluates this at the moment a
 *  specific slot is due, so the two are the same instant in practice
 *  without a second Kyiv-now lookup. */
export function shouldSkipReminder(
  currentAmountMl: number,
  dailyGoalMl: number,
  nowMinutes: number,
  activeStart: string,
  activeEnd: string
): boolean {
  if (dailyGoalMl <= 0) return false;
  const startMinutes = parseHHMM(activeStart);
  const endMinutes = parseHHMM(activeEnd);
  if (endMinutes <= startMinutes) return false;

  const dayProgress = Math.min(1, Math.max(0, (nowMinutes - startMinutes) / (endMinutes - startMinutes)));
  const expectedByNow = dailyGoalMl * dayProgress;
  return currentAmountMl >= expectedByNow;
}

export function minutesOfHHMM(time: string): number {
  return parseHHMM(time);
}
