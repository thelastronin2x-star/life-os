import type { MacroCurrency, MacroEvent } from "./types";

const KYIV_TZ = "Europe/Kyiv";
const WEEKDAY_LABELS_UK = ["Неділя", "Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота"];
const WEEKDAY_INDEX_BY_SHORT_NAME: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

function kyivDateKeyFor(date: Date): string {
  const dtf = new Intl.DateTimeFormat("en-CA", { timeZone: KYIV_TZ, year: "numeric", month: "2-digit", day: "2-digit" });
  return dtf.format(date);
}

function kyivWeekdayIndex(date: Date): number {
  const dtf = new Intl.DateTimeFormat("en-US", { timeZone: KYIV_TZ, weekday: "short" });
  return WEEKDAY_INDEX_BY_SHORT_NAME[dtf.format(date)];
}

export const CURRENCY_FILTER_LABELS: Record<"all" | MacroCurrency, string> = {
  all: "Усі",
  USD: "USD",
  EUR: "EUR",
  JPY: "JPY",
};

export const REGION_FLAGS: Record<MacroEvent["region"], string> = {
  US: "🇺🇸",
  EU: "🇪🇺",
  JP: "🇯🇵",
};

export function filterByCurrency(events: MacroEvent[], filter: "all" | MacroCurrency): MacroEvent[] {
  if (filter === "all") return events;
  return events.filter((e) => e.currency === filter);
}

/** "Сьогодні"/"Завтра"/"За N дн." for near-term upcoming events, falling
 *  back to a plain date for anything more than a week out — mirrors
 *  news-view.ts's formatRelativeTime in spirit, but for FUTURE
 *  scheduling rather than past publish times. */
export function formatUpcomingTime(scheduledAt: string, now: number = Date.now()): string {
  const target = new Date(scheduledAt);
  const startOfToday = new Date(now);
  startOfToday.setHours(0, 0, 0, 0);
  const startOfTarget = new Date(target);
  startOfTarget.setHours(0, 0, 0, 0);

  const dayDiff = Math.round((startOfTarget.getTime() - startOfToday.getTime()) / 86_400_000);

  if (dayDiff < 0) return "минуло";
  if (dayDiff === 0) return "сьогодні";
  if (dayDiff === 1) return "завтра";
  if (dayDiff <= 7) return `за ${dayDiff} дн.`;

  return target.toLocaleDateString("uk-UA", { day: "numeric", month: "short" });
}

export interface MacroDayGroup {
  dateKey: string;
  label: string;
  events: MacroEvent[];
}

/** Buckets events into Kyiv-local calendar days for the "whole week" view
 *  — same Kyiv-wall-clock assumption as kyiv-time.ts and teams/week.ts
 *  (single-timezone user base). Days with nothing scheduled are omitted
 *  rather than shown as empty placeholders: most days on a real macro
 *  calendar are quiet, and the point of "show me the whole week" is
 *  "show me everything happening", not seven mostly-empty day headers. */
export function groupByWeek(events: MacroEvent[], now: Date = new Date(), days = 7): MacroDayGroup[] {
  const todayKey = kyivDateKeyFor(now);
  const [y, m, d] = todayKey.split("-").map(Number);

  const dayList: MacroDayGroup[] = [];
  for (let i = 0; i < days; i++) {
    const dayDate = new Date(Date.UTC(y, m - 1, d + i));
    const dateKey = kyivDateKeyFor(dayDate);
    const label = i === 0 ? "Сьогодні" : i === 1 ? "Завтра" : WEEKDAY_LABELS_UK[kyivWeekdayIndex(dayDate)];
    dayList.push({ dateKey, label, events: [] });
  }

  const byDateKey = new Map(dayList.map((group) => [group.dateKey, group]));
  for (const event of events) {
    byDateKey.get(kyivDateKeyFor(new Date(event.scheduledAt)))?.events.push(event);
  }

  return dayList.filter((group) => group.events.length > 0);
}
