import { formatDateKey, getWeekDays } from "./calendar-utils";
import type { FirstDayOfWeek } from "./store";

type HabitLogs = Record<string, Record<string, number>>;

function isDoneOn(habitLogs: HabitLogs, date: string, habitId: string): boolean {
  return (habitLogs[date]?.[habitId] ?? 0) >= 1;
}

/** Days поспіль counting back from today, or from yesterday if today isn't
 *  marked done yet — an unmarked "today" doesn't break an otherwise-intact
 *  streak, since the day isn't over yet. */
export function computeCurrentStreak(habitId: string, habitLogs: HabitLogs, today: Date = new Date()): number {
  const cursor = new Date(today);
  if (!isDoneOn(habitLogs, formatDateKey(cursor), habitId)) {
    cursor.setDate(cursor.getDate() - 1);
  }
  let streak = 0;
  while (isDoneOn(habitLogs, formatDateKey(cursor), habitId)) {
    streak++;
    cursor.setDate(cursor.getDate() - 1);
  }
  return streak;
}

/** Longest run of consecutive done days anywhere in the habit's full
 *  history — derived on the fly from habitLogs (which already keeps every
 *  date ever logged) rather than tracked as separate stored state. */
export function computeLongestStreak(habitId: string, habitLogs: HabitLogs): number {
  const doneDates = Object.keys(habitLogs)
    .filter((date) => isDoneOn(habitLogs, date, habitId))
    .sort();
  if (doneDates.length === 0) return 0;

  let longest = 1;
  let current = 1;
  for (let i = 1; i < doneDates.length; i++) {
    const prev = new Date(`${doneDates[i - 1]}T12:00:00`);
    const next = new Date(`${doneDates[i]}T12:00:00`);
    const dayDiff = Math.round((next.getTime() - prev.getTime()) / 86_400_000);
    current = dayDiff === 1 ? current + 1 : 1;
    longest = Math.max(longest, current);
  }
  return longest;
}

/** This calendar week's done/not-done per day (respecting firstDayOfWeek),
 *  not a rolling 7-day window — a "3x на тиждень" target is meant to reset
 *  each calendar week, same as Calendar's own week view. */
export function computeWeekDone(
  habitId: string,
  habitLogs: HabitLogs,
  firstDayOfWeek: FirstDayOfWeek,
  anchor: Date = new Date()
): boolean[] {
  return getWeekDays(anchor, firstDayOfWeek).map((cell) => isDoneOn(habitLogs, cell.key, habitId));
}

export function computeWeekCounts(
  habitId: string,
  habitLogs: HabitLogs,
  firstDayOfWeek: FirstDayOfWeek,
  anchor: Date = new Date()
): number[] {
  return getWeekDays(anchor, firstDayOfWeek).map((cell) => habitLogs[cell.key]?.[habitId] ?? 0);
}
