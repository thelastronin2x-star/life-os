"use client";

import { useMemo, useState } from "react";
import { getMonthMatrix, getWeekdayLabels, MONTH_LABELS, formatDateKey } from "@/lib/calendar-utils";
import { cn } from "@/lib/cn";

export interface DayNet {
  net: number;
  hasClosed: boolean;
}

/** Month-grid view of the journal — every day is a cell colored by that
 *  day's realized result (green/red/neutral), tapping one hands the date
 *  back to the parent so it can switch to List filtered to that day. Pure
 *  presentation: the parent already owns which account/trades are active,
 *  this only owns which month is on screen. */
export function JournalCalendarView({
  netByDay,
  currencySymbol,
  onSelectDay,
}: {
  netByDay: Map<string, DayNet>;
  currencySymbol: string;
  onSelectDay: (dateKey: string) => void;
}) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });

  const cells = useMemo(() => getMonthMatrix(cursor.year, cursor.month, "monday"), [cursor]);
  const weekdayLabels = getWeekdayLabels("monday");
  const todayKey = formatDateKey(new Date());

  const summary = useMemo(() => {
    let net = 0;
    let profitDays = 0;
    let lossDays = 0;
    for (const cell of cells) {
      if (!cell.inCurrentMonth) continue;
      const day = netByDay.get(cell.key);
      if (!day || !day.hasClosed) continue;
      net += day.net;
      if (day.net > 0) profitDays++;
      else if (day.net < 0) lossDays++;
    }
    return { net, profitDays, lossDays };
  }, [cells, netByDay]);

  function shiftMonth(delta: number) {
    setCursor((c) => {
      const d = new Date(c.year, c.month + delta, 1);
      return { year: d.getFullYear(), month: d.getMonth() };
    });
  }

  return (
    <div>
      <div className="mb-3 flex items-center justify-between">
        <button
          onClick={() => shiftMonth(-1)}
          className="flex h-8 w-8 items-center justify-center rounded-icon border border-border bg-surface text-text-dim"
        >
          ‹
        </button>
        <span className="text-[14px] font-extrabold text-text">
          {MONTH_LABELS[cursor.month]} {cursor.year}
        </span>
        <button
          onClick={() => shiftMonth(1)}
          className="flex h-8 w-8 items-center justify-center rounded-icon border border-border bg-surface text-text-dim"
        >
          ›
        </button>
      </div>

      <div className="mb-3 flex justify-between rounded-card border border-border bg-surface p-3.5 shadow-card">
        <div className="flex-1 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wide text-text-faint">Net P&L</div>
          <div className={cn("mt-1 font-mono text-[14px] font-extrabold", summary.net >= 0 ? "text-sage" : "text-clay")}>
            {summary.net >= 0 ? "+" : ""}
            {summary.net.toFixed(0)} {currencySymbol}
          </div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wide text-text-faint">Прибуткових днів</div>
          <div className="mt-1 font-mono text-[14px] font-extrabold text-text">{summary.profitDays}</div>
        </div>
        <div className="flex-1 text-center">
          <div className="text-[9px] font-bold uppercase tracking-wide text-text-faint">Збиткових днів</div>
          <div className="mt-1 font-mono text-[14px] font-extrabold text-text">{summary.lossDays}</div>
        </div>
      </div>

      <div className="mb-1.5 grid grid-cols-7 gap-1">
        {weekdayLabels.map((l) => (
          <span key={l} className="text-center text-[9.5px] font-bold text-text-faint">
            {l}
          </span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {cells.map((cell) => {
          if (!cell.inCurrentMonth) return <div key={cell.key} />;
          const day = netByDay.get(cell.key);
          const isToday = cell.key === todayKey;
          const isProfit = !!day && day.hasClosed && day.net > 0;
          const isLoss = !!day && day.hasClosed && day.net < 0;
          return (
            <button
              key={cell.key}
              onClick={() => onSelectDay(cell.key)}
              className={cn(
                "flex aspect-square flex-col items-center justify-center rounded-card-sm border p-1",
                isProfit && "border-sage/25 bg-sage-soft",
                isLoss && "border-clay/25 bg-clay-soft",
                !isProfit && !isLoss && "border-border bg-surface",
                isToday && "outline outline-2 -outline-offset-2 outline-text"
              )}
            >
              <span
                className={cn(
                  "text-[10px] font-bold",
                  isProfit && "text-sage",
                  isLoss && "text-clay",
                  !isProfit && !isLoss && "text-text-faint"
                )}
              >
                {cell.date.getDate()}
              </span>
              {day && day.hasClosed && (
                <span
                  className={cn("mt-0.5 font-mono text-[8px] font-semibold", isProfit ? "text-sage" : "text-clay")}
                >
                  {day.net >= 0 ? "+" : ""}
                  {day.net.toFixed(0)}
                </span>
              )}
            </button>
          );
        })}
      </div>

      <div className="mt-3.5 flex justify-center gap-4">
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-sage-soft" /> Прибуток
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint">
          <span className="h-2.5 w-2.5 rounded-[3px] bg-clay-soft" /> Збиток
        </span>
        <span className="flex items-center gap-1.5 text-[10.5px] font-semibold text-text-faint">
          <span className="h-2.5 w-2.5 rounded-[3px] border border-border bg-surface" /> Без угод
        </span>
      </div>
    </div>
  );
}
