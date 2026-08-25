"use client";

import { useCalendarStore, type CalendarItem } from "./calendar-store";
import { formatDateKey } from "./calendar-utils";
import { getHoliday } from "./holidays";

/** Calendar's own context builder, in its own file so importing it (from
 *  CalendarBubble or use-calendar-insight-sync) never pulls in health/work/
 *  finance stores — see assistant-tool-executors-calendar.ts for why that
 *  split matters. */
export function buildCalendarContext(): string {
  const { items } = useCalendarStore.getState();
  const now = new Date();
  const ym = formatDateKey(now).slice(0, 7);

  const monthItems = items.filter((i) => i.date.startsWith(ym));
  const upcoming = monthItems
    .filter((i) => i.date >= formatDateKey(now))
    .sort((a, b) => `${a.date}${a.time ?? ""}`.localeCompare(`${b.date}${b.time ?? ""}`))
    .slice(0, 10);

  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const holidaysThisMonth: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const h = getHoliday(new Date(year, month, day));
    if (h) holidaysThisMonth.push(`${day}.${month + 1} — ${h.name}`);
  }

  return [
    `Контекст: вкладка "Календар". Сьогодні ${formatDateKey(now)}.`,
    upcoming.length > 0
      ? `Найближчі події/нотатки цього місяця: ${upcoming
          .map((i) => `${i.date}${i.time ? " " + i.time : ""} — ${i.title}`)
          .join("; ")}.`
      : "На цей місяць немає запланованих подій.",
    holidaysThisMonth.length > 0
      ? `Свята цього місяця: ${holidaysThisMonth.join(", ")}.`
      : "Свят цього місяця немає.",
  ].join(" ");
}

/** Pure — takes `items` as a param instead of reading `.getState()` itself,
 *  so the caller can pass a *reactively subscribed* value (`useCalendarStore(s
 *  => s.items)`) and this recomputes on every render that value actually
 *  changes, not just whenever some ancestor happens to re-render for an
 *  unrelated reason. See use-calendar-insight-sync.ts. */
export function computeCalendarSignature(items: CalendarItem[]): string {
  const ym = formatDateKey(new Date()).slice(0, 7);
  const count = items.filter((i) => i.date.startsWith(ym)).length;
  return [ym, count].join("|");
}
