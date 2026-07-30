import type { CalendarItem, EventRecurrence } from "./calendar-store";
import { formatDateKey, parseDateKey } from "./calendar-utils";

const JS_WEEKDAY_LABELS = ["Нд", "Пн", "Вт", "Ср", "Чт", "Пт", "Сб"]; // index 0 = Sunday, matches Date#getDay()

export function describeRecurrence(recurrence: EventRecurrence | null): string {
  if (!recurrence) return "Не повторюється";
  switch (recurrence.type) {
    case "daily":
      return "Щодня";
    case "weekdays":
      return "Будні дні (Пн–Пт)";
    case "weekend":
      return "Вихідні (Сб, Нд)";
    case "weekly":
      return "Щотижня в цей день";
    case "custom": {
      const labels = [...recurrence.daysOfWeek].sort().map((d) => JS_WEEKDAY_LABELS[d]);
      return labels.length > 0 ? `Свої дні (${labels.join(", ")})` : "Свої дні";
    }
  }
}

/** Generates the "virtual" occurrences of a (possibly recurring) calendar item
 *  that fall within [rangeStart, rangeEnd]. Non-recurring items pass through
 *  unchanged. Each occurrence shares the original item's `id` — callers that
 *  need to distinguish "which specific occurrence" should key off `date`
 *  alongside `id`, since only one occurrence of a given event can ever land
 *  on the same day. */
export function expandRecurringEvents(item: CalendarItem, rangeStart: Date, rangeEnd: Date): CalendarItem[] {
  if (!item.recurrence) {
    const own = parseDateKey(item.date);
    return own >= rangeStart && own <= rangeEnd ? [item] : [];
  }

  const { type, daysOfWeek, endCondition, excludedDates } = item.recurrence;
  const anchor = parseDateKey(item.date);

  const activeDays =
    type === "weekdays"
      ? [1, 2, 3, 4, 5]
      : type === "weekend"
        ? [0, 6]
        : type === "weekly"
          ? [anchor.getDay()]
          : type === "custom"
            ? daysOfWeek
            : null; // "daily" — every day, no day-of-week filter

  const untilDate =
    endCondition.type === "until" && typeof endCondition.value === "string"
      ? parseDateKey(endCondition.value)
      : null;
  const maxCount =
    endCondition.type === "count" && typeof endCondition.value === "number" ? endCondition.value : Infinity;

  const excluded = new Set(excludedDates);
  const results: CalendarItem[] = [];
  let occurrenceCount = 0;
  const cursor = new Date(anchor);

  while (cursor <= rangeEnd && occurrenceCount < maxCount) {
    if (untilDate && cursor > untilDate) break;
    const matchesDay = !activeDays || activeDays.includes(cursor.getDay());
    if (matchesDay) {
      occurrenceCount += 1;
      const key = formatDateKey(cursor);
      if (cursor >= rangeStart && !excluded.has(key)) {
        results.push({ ...item, date: key });
      }
    }
    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
}

export function expandItemsForRange(items: CalendarItem[], rangeStart: Date, rangeEnd: Date): CalendarItem[] {
  return items.flatMap((item) => expandRecurringEvents(item, rangeStart, rangeEnd));
}

/** Compact label for the repeat badge on event/note cards. */
export function describeRecurrenceShort(recurrence: EventRecurrence | null): string {
  if (!recurrence) return "";
  switch (recurrence.type) {
    case "daily":
      return "Щодня";
    case "weekdays":
      return "Пн–Пт";
    case "weekend":
      return "Сб–Нд";
    case "weekly":
      return "Щотижня";
    case "custom":
      return "Свої дні";
  }
}
