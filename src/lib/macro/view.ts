import type { MacroCurrency, MacroEvent } from "./types";

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
