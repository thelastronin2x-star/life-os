"use client";

import { useState } from "react";
import { getHoliday } from "@/lib/holidays";
import { getWeekDays, isSameDay, formatAgendaDate, pluralizeUk } from "@/lib/calendar-utils";
import { MONTH_LABELS } from "@/lib/calendar-utils";
import type { CalendarCategory, CalendarItem } from "@/lib/calendar-store";
import type { FirstDayOfWeek } from "@/lib/store";
import { MedsQuickView } from "./MedsQuickView";
import { isMedicationReminderItem } from "@/lib/meds-calendar-link";

const CATEGORY_COLOR: Record<CalendarCategory, string> = {
  personal: "var(--sky)",
  work: "var(--gold)",
};

interface WeekStripProps {
  anchorDate: Date;
  items: CalendarItem[]; // already expanded to cover (at least) this week
  onSelectDay: (key: string) => void;
  onEditItem: (item: CalendarItem) => void;
  onNavigate: (direction: -1 | 1) => void;
  firstDayOfWeek: FirstDayOfWeek;
}

/** Vertical list of day cards, not a 7-narrow-column grid — a week's worth
 *  of events is genuinely unreadable squeezed into seven ~50px columns; a
 *  card per day gives each event room for a time and a title. */
export function WeekStrip({ anchorDate, items, onSelectDay, onEditItem, onNavigate, firstDayOfWeek }: WeekStripProps) {
  const [medsPopover, setMedsPopover] = useState<{ date: string; items: CalendarItem[] } | null>(null);
  const days = getWeekDays(anchorDate, firstDayOfWeek);
  const today = new Date();
  const first = days[0].date;
  const last = days[6].date;
  const rangeLabel =
    first.getMonth() === last.getMonth()
      ? `${first.getDate()}–${last.getDate()} ${MONTH_LABELS[first.getMonth()]}`
      : `${first.getDate()} ${MONTH_LABELS[first.getMonth()]} – ${last.getDate()} ${MONTH_LABELS[last.getMonth()]}`;

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-heading text-[15px] font-semibold text-text">{rangeLabel}</div>
        <div className="flex gap-1.5">
          <button
            onClick={() => onNavigate(-1)}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-icon border border-border bg-surface text-text-dim"
          >
            ‹
          </button>
          <button
            onClick={() => onNavigate(1)}
            className="flex h-[26px] w-[26px] items-center justify-center rounded-icon border border-border bg-surface text-text-dim"
          >
            ›
          </button>
        </div>
      </div>

      <div className="space-y-2.5">
        {days.map((cell) => {
          const holiday = getHoliday(cell.date);
          const isToday = isSameDay(cell.date, today);
          const cellItems = items
            .filter((i) => i.date === cell.key)
            .sort((a, b) => (a.time ?? "").localeCompare(b.time ?? ""));
          // Medication-reminder items collapse into a single count marker
          // next to the day header instead of a row per reminder — same
          // treatment as DayAgenda's period headers.
          const dayItems = cellItems.filter((i) => !isMedicationReminderItem(i));
          const medItems = cellItems.filter((i) => isMedicationReminderItem(i));

          return (
            <div
              key={cell.key}
              className="rounded-card-sm p-3"
              style={
                isToday
                  ? { background: "var(--sage-soft)", border: "1.5px solid var(--sage)" }
                  : { background: "var(--surface)" }
              }
            >
              <div className="mb-1.5 flex w-full items-center justify-between">
                <button onClick={() => onSelectDay(cell.key)} className="flex min-w-0 flex-1 items-center gap-2 text-left">
                  <span className="text-[12.5px] font-bold text-text">{formatAgendaDate(cell.date)}</span>
                  {holiday && <span className="flex-shrink-0 text-[10px] font-semibold text-text-faint">{holiday.name}</span>}
                </button>
                {medItems.length > 0 && (
                  <span
                    onClick={() => setMedsPopover({ date: cell.key, items: medItems })}
                    className="meds-marker flex-shrink-0"
                  >
                    {medItems.length} {pluralizeUk(medItems.length, ["прийом", "прийоми", "прийомів"])}
                  </span>
                )}
              </div>

              {dayItems.length === 0 ? (
                medItems.length === 0 && <div className="text-[11px] text-text-faint">Вільний день</div>
              ) : (
                <div className="space-y-1.5">
                  {dayItems.map((item) => (
                    <button
                      key={item.id}
                      onClick={() => onEditItem(item)}
                      className="flex w-full items-center gap-2 text-left"
                    >
                      {item.time && <span className="flex-shrink-0 font-mono text-[10.5px] text-text-faint">{item.time}</span>}
                      <span
                        className="h-1.5 w-1.5 flex-shrink-0 rounded-full"
                        style={{ background: CATEGORY_COLOR[item.category] }}
                      />
                      <span className="truncate text-[11.5px] text-text">{item.title}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {medsPopover && (
        <MedsQuickView date={medsPopover.date} items={medsPopover.items} onClose={() => setMedsPopover(null)} />
      )}
    </div>
  );
}
