/** Same Kyiv-wall-clock assumption as kyiv-time.ts (single-timezone user
 *  base, see that file's header) — used here to bucket team XP into
 *  "this week" for the rating and rival-challenge views. Monday-start,
 *  matching FIRST_DAY_OPTIONS' trading/study-week convention elsewhere. */
import { kyivDateTimeToUtc } from "@/lib/kyiv-time";

const KYIV_TZ = "Europe/Kyiv";
const WEEKDAY_INDEX: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 };

function kyivDateKeyFor(date: Date): string {
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: KYIV_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return dtf.format(date);
}

function kyivIsoWeekdayFor(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: KYIV_TZ, weekday: "short" });
  return WEEKDAY_INDEX[dtf.format(date)];
}

/** Start (Monday 00:00 Kyiv time) of the week containing `now`, as a UTC
 *  instant — suitable for a SQL `created_at >= $1` filter. */
export function startOfWeekUtc(now: Date = new Date()): Date {
  const weekday = kyivIsoWeekdayFor(now);
  const todayKey = kyivDateKeyFor(now);
  const [y, m, d] = todayKey.split("-").map(Number);
  const mondayUtcMidnight = new Date(Date.UTC(y, m - 1, d - (weekday - 1)));
  const mondayKey = kyivDateKeyFor(mondayUtcMidnight);
  return kyivDateTimeToUtc(mondayKey, "00:00");
}
