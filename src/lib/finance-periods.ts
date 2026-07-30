import { formatDateKey } from "./calendar-utils";

export const FINANCE_PERIODS = ["Тиждень", "Місяць", "Рік"] as const;
export type FinancePeriod = (typeof FINANCE_PERIODS)[number];

/** Monday of the week containing `d` (local time). */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d);
  copy.setDate(copy.getDate() - ((copy.getDay() + 6) % 7));
  return copy;
}

/** Calendar-based period start — Monday of the current week, the 1st of the
 *  current month, or a year back — never a trailing window (last 7/30/365
 *  days). Shared between the Огляд category filters and the Аналітика
 *  reports page so the same period label ("Тиждень"/"Місяць"/"Рік") means
 *  the same date range everywhere, instead of two screens silently
 *  disagreeing on what "Місяць" means for the same category. */
export function periodStartKey(period: FinancePeriod): string {
  const now = new Date();
  if (period === "Тиждень") return formatDateKey(startOfWeek(now));
  if (period === "Місяць") {
    const d = new Date(now);
    d.setDate(1);
    return formatDateKey(d);
  }
  const d = new Date(now);
  d.setFullYear(d.getFullYear() - 1);
  return formatDateKey(d);
}
