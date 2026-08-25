import { formatDateKey } from "./calendar-utils";
import { startOfWeek, type FinancePeriod } from "./finance-periods";

export interface PeriodBucket {
  label: string;
  startKey: string;
  endKey: string;
}

const WEEKDAY_SHORT = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Нд"];
const MONTH_SHORT = ["Січ", "Лют", "Бер", "Кві", "Тра", "Чер", "Лип", "Сер", "Вер", "Жов", "Лис", "Гру"];

/** Calendar-anchored buckets walking FORWARD from the start of the current
 *  period (Monday/1st/12-months-ago) to today — never a trailing window —
 *  same reasoning as periodStartKey. Originally inline in the Аналітика
 *  page's own trend memo; extracted so Огляд's sparklines and Аналітика's
 *  bar chart can never silently disagree about what a bucket boundary is. */
export function buildPeriodBuckets(period: FinancePeriod): PeriodBucket[] {
  const buckets: PeriodBucket[] = [];
  const now = new Date();

  if (period === "Тиждень") {
    const weekStart = startOfWeek(now);
    const daysSoFar = Math.floor((now.getTime() - weekStart.getTime()) / 86_400_000) + 1;
    for (let i = 0; i < daysSoFar; i++) {
      const d = new Date(weekStart);
      d.setDate(weekStart.getDate() + i);
      const key = formatDateKey(d);
      buckets.push({ label: WEEKDAY_SHORT[(d.getDay() + 6) % 7], startKey: key, endKey: key });
    }
  } else if (period === "Місяць") {
    const monthStart = new Date(now);
    monthStart.setDate(1);
    const daysSoFar = Math.floor((now.getTime() - monthStart.getTime()) / 86_400_000) + 1;
    const numWeeks = Math.ceil(daysSoFar / 7);
    for (let w = 0; w < numWeeks; w++) {
      const start = new Date(monthStart);
      start.setDate(monthStart.getDate() + w * 7);
      const end = new Date(start);
      end.setDate(start.getDate() + 6);
      if (end > now) end.setTime(now.getTime());
      const label = `${String(start.getDate()).padStart(2, "0")}.${String(start.getMonth() + 1).padStart(2, "0")}`;
      buckets.push({ label, startKey: formatDateKey(start), endKey: formatDateKey(end) });
    }
  } else {
    for (let m = 11; m >= 0; m--) {
      const d = new Date();
      d.setDate(1); // avoid month-end overflow (e.g. Mar 31 - 1mo => wrong month)
      d.setMonth(d.getMonth() - m);
      const y = d.getFullYear();
      const mo = d.getMonth();
      const start = new Date(y, mo, 1);
      const end = new Date(y, mo + 1, 0);
      buckets.push({ label: MONTH_SHORT[mo], startKey: formatDateKey(start), endKey: formatDateKey(end) });
    }
  }
  return buckets;
}

/** The immediately preceding equivalent period — for "Місяць" this is a fair
 *  month-to-date comparison (same number of days into the previous month),
 *  not the whole previous month, or an in-progress month always looks
 *  artificially better just because fewer days have elapsed. */
export function previousPeriodRange(period: FinancePeriod): { start: string; end: string } {
  const now = new Date();
  if (period === "Тиждень") {
    const weekStart = startOfWeek(now);
    const daysSoFar = Math.floor((now.getTime() - weekStart.getTime()) / 86_400_000) + 1;
    const prevWeekStart = new Date(weekStart);
    prevWeekStart.setDate(prevWeekStart.getDate() - 7);
    const prevWeekEnd = new Date(prevWeekStart);
    prevWeekEnd.setDate(prevWeekStart.getDate() + daysSoFar - 1);
    return { start: formatDateKey(prevWeekStart), end: formatDateKey(prevWeekEnd) };
  }
  if (period === "Місяць") {
    const prevMonthStart = new Date(now);
    prevMonthStart.setDate(1);
    prevMonthStart.setMonth(prevMonthStart.getMonth() - 1);
    const prevMonthEnd = new Date(prevMonthStart);
    prevMonthEnd.setDate(prevMonthStart.getDate() + now.getDate() - 1);
    return { start: formatDateKey(prevMonthStart), end: formatDateKey(prevMonthEnd) };
  }
  const start = new Date(now);
  start.setFullYear(start.getFullYear() - 2);
  const end = new Date(now);
  end.setFullYear(end.getFullYear() - 1);
  end.setDate(end.getDate() - 1);
  return { start: formatDateKey(start), end: formatDateKey(end) };
}
