"use client";

import { useCalendarStore } from "./calendar-store";
import { useFinanceStore, getPeriodTotals } from "./finance-store";
import { buildWorkSummary } from "./assistant-context-work";
import { formatDateKey } from "./calendar-utils";
import type { Profile } from "./store";

function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDateKey(d);
}

/** Weekly/monthly auto-reports (reports.ts) predate Здоров'я's assistant
 *  integration and never covered it — kept that way here rather than folded
 *  into assistant-context-global.ts, so reports.ts (loaded from every route
 *  via AppLayout's checkAndGenerateAutoReports) doesn't newly start pulling
 *  in health-store just because Home's global context now exists. */
export function buildReportContext(profile: Profile, periodDays: number): string {
  const since = daysAgoKey(periodDays);
  const { items } = useCalendarStore.getState();
  const periodEvents = items.filter((i) => i.date >= since && i.kind === "event");

  const { transactions } = useFinanceStore.getState();
  const { income, expense } = getPeriodTotals(transactions, since);

  return [
    `Контекст: звіт за період з ${since} по сьогодні.`,
    `Календар: ${periodEvents.length} подій за період.`,
    `Фінанси: дохід ${income.toFixed(0)}, витрати ${expense.toFixed(0)}.`,
    buildWorkSummary(profile),
  ].join(" ");
}
