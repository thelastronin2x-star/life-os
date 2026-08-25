"use client";

import { getHoliday } from "@/lib/holidays";
import { MONTH_LABELS, getMonthMatrix, getWeekdayLabels, isSameDay } from "@/lib/calendar-utils";
import type { CalendarCategory } from "@/lib/calendar-store";
import type { FirstDayOfWeek } from "@/lib/store";
import { cn } from "@/lib/cn";

interface MonthGridProps {
  year: number;
  month: number;
  selectedKey: string;
  categoriesByDate: Record<string, Set<CalendarCategory>>;
  firstDayOfWeek: FirstDayOfWeek;
  onSelectDay: (key: string) => void;
  onNavigate: (direction: -1 | 1) => void;
}

const CATEGORY_COLOR: Record<CalendarCategory, string> = {
  personal: "var(--sky)",
  work: "var(--gold)",
};

export function MonthGrid({
  year,
  month,
  selectedKey,
  categoriesByDate,
  firstDayOfWeek,
  onSelectDay,
  onNavigate,
}: MonthGridProps) {
  const cells = getMonthMatrix(year, month, firstDayOfWeek);
  const weekdayLabels = getWeekdayLabels(firstDayOfWeek);
  const today = new Date();

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <div className="font-heading text-[15px] font-semibold text-text">
          {MONTH_LABELS[month]} {year}
        </div>
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

      <div className="mb-1 grid grid-cols-7">
        {weekdayLabels.map((w) => (
          <div key={w} className="text-center text-[10px] font-semibold text-text-faint">
            {w}
          </div>
        ))}
      </div>

      <div className="mb-2 grid grid-cols-7 gap-[3px]">
        {cells.map((cell) => {
          const holiday = getHoliday(cell.date);
          const cats = categoriesByDate[cell.key];
          const isToday = isSameDay(cell.date, today);
          const isSelected = cell.key === selectedKey;

          return (
            <button
              key={cell.key}
              data-date={cell.key}
              onClick={() => onSelectDay(cell.key)}
              className={cn(
                "relative flex aspect-square flex-col items-center justify-center gap-0.5 rounded-icon text-[11.5px]",
                !cell.inCurrentMonth && "opacity-40",
                isToday && "bg-sage font-bold text-bg",
                !isToday && isSelected && "border-[1.5px] border-sage bg-surface font-semibold text-text",
                !isToday && !isSelected && "bg-surface text-text-dim",
                !isToday && holiday && !isSelected && "font-semibold text-gold"
              )}
            >
              {cell.date.getDate()}
              {holiday && (
                <span className="absolute right-1 top-0.5 text-[7px]" style={{ color: isToday ? undefined : "var(--gold)" }}>
                  ★
                </span>
              )}
              {cats && cats.size > 0 && (
                <div className="flex gap-0.5">
                  {[...cats].map((c) => (
                    <span
                      key={c}
                      className="h-1 w-1 rounded-full"
                      style={{ background: isToday ? "var(--bg)" : CATEGORY_COLOR[c] }}
                    />
                  ))}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="mb-3 flex flex-wrap gap-2.5">
        <div className="flex items-center gap-1.5 text-[9.5px] text-text-faint">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--sky)" }} />
          Особисте
        </div>
        <div className="flex items-center gap-1.5 text-[9.5px] text-text-faint">
          <span className="h-1.5 w-1.5 rounded-full" style={{ background: "var(--gold)" }} />
          Робота
        </div>
        <div className="flex items-center gap-1.5 text-[9.5px] text-text-faint">
          <span style={{ color: "var(--gold)" }}>★</span>
          Свято
        </div>
      </div>
    </div>
  );
}
