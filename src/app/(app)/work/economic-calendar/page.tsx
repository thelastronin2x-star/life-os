"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { WorkSubpageHeader } from "@/components/work/WorkSubpageHeader";
import { Card } from "@/components/ui/Card";
import { SectionTitle } from "@/components/ui/SectionTitle";
import { useEconomicCalendar } from "@/lib/use-economic-calendar";
import { getDemoHistory } from "@/lib/economic-calendar-data";
import type { CalendarEventDto } from "@/app/api/work/economic-calendar/route";
import { formatDateKey } from "@/lib/calendar-utils";
import { useTraderOnlyGuard } from "@/lib/use-trader-guard";
import { cn } from "@/lib/cn";
import { SatelliteOffIcon } from "@/components/icons";

function Sparkline({ points }: { points: number[] }) {
  const min = Math.min(...points);
  const max = Math.max(...points);
  const range = max - min || 1;
  const w = 52;
  const h = 22;
  const step = points.length > 1 ? w / (points.length - 1) : 0;
  const path = points
    .map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - ((v - min) / range) * h).toFixed(1)}`)
    .join(" ");
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} className="ml-auto flex-shrink-0">
      <path d={path} fill="none" stroke="var(--sky)" strokeWidth={1.8} vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

function EventRow({ event, isLast }: { event: CalendarEventDto; isLast: boolean }) {
  const history = getDemoHistory(event.name);

  return (
    <Link
      href={`/work/economic-calendar/${event.id}`}
      className={cn("block py-3.5", !isLast && "border-b border-border")}
    >
      <div className="mb-2 flex items-center gap-2">
        <span className="w-9 flex-shrink-0 font-mono text-[11.5px] text-text-faint">{event.time}</span>
        <div className="flex flex-shrink-0 gap-0.5">
          {[1, 2, 3].map((i) => (
            <span
              key={i}
              className="h-[11px] w-[3px] rounded-sm"
              style={{ background: i <= event.impact ? "var(--rose)" : "var(--surface-2)" }}
            />
          ))}
        </div>
        <span className="flex-shrink-0 text-sm">{event.flag}</span>
        <span className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text">{event.name}</span>
      </div>
      <div className="flex items-center gap-4 pl-[60px]">
        <div>
          <div className="text-[8.5px] uppercase text-text-faint">Попер.</div>
          <div className="font-mono text-[13px] font-bold text-text">{event.previous}</div>
        </div>
        <div>
          <div className="text-[8.5px] uppercase text-text-faint">Прогноз</div>
          <div className="font-mono text-[13px] font-bold text-sky">{event.forecast}</div>
        </div>
        <div>
          <div className="text-[8.5px] uppercase text-text-faint">Факт</div>
          <div className="font-mono text-[13px] font-bold text-text">{event.actual ?? "—"}</div>
        </div>
        {history && event.impact === 3 && <Sparkline points={history.map((p) => p.actual)} />}
      </div>
    </Link>
  );
}

const CURRENCY_ORDER = ["USD", "EUR", "GBP", "JPY", "AUD", "CAD", "CHF", "NZD"];

export default function EconomicCalendarPage() {
  const isTrader = useTraderOnlyGuard();
  const { events, status } = useEconomicCalendar();
  const [filter, setFilter] = useState<string>("Всі");

  const availableCurrencies = useMemo(() => {
    const set = new Set(events.map((e) => e.currency));
    return CURRENCY_ORDER.filter((c) => set.has(c));
  }, [events]);

  const groups = useMemo(() => {
    const todayKey = formatDateKey(new Date());
    const tomorrowDate = new Date();
    tomorrowDate.setDate(tomorrowDate.getDate() + 1);
    const tomorrowKey = formatDateKey(tomorrowDate);

    const filtered = filter === "Всі" ? events : events.filter((e) => e.currency === filter);

    const today: CalendarEventDto[] = [];
    const tomorrow: CalendarEventDto[] = [];
    const week: CalendarEventDto[] = [];

    for (const e of filtered) {
      if (e.date === todayKey) today.push(e);
      else if (e.date === tomorrowKey) tomorrow.push(e);
      else if (e.date > todayKey) week.push(e);
    }
    const byTime = (a: CalendarEventDto, b: CalendarEventDto) => a.time.localeCompare(b.time);
    return {
      today: today.sort(byTime),
      tomorrow: tomorrow.sort(byTime),
      week: week.sort((a, b) => a.date.localeCompare(b.date) || byTime(a, b)),
    };
  }, [events, filter]);

  const todayHighImpact = groups.today.find((e) => e.impact === 3);
  const assistantText = todayHighImpact
    ? `${todayHighImpact.name} о ${todayHighImpact.time} — очікується волатильність на всіх ${todayHighImpact.currency}-парах. Розглянь скорочення розміру позицій перед релізом.`
    : "Сьогодні без high-impact релізів — спокійний день для звичайного розміру позицій.";

  if (!isTrader) return null;

  return (
    <div>
      <WorkSubpageHeader title="Економічний календар" subtitle="Релізи цього тижня" />

      {status === "not-configured" && (
        <div className="mb-3 flex items-center justify-center gap-1.5 rounded-card-sm bg-surface shadow-card p-3 text-center text-[11.5px] text-text-faint">
          <SatelliteOffIcon className="h-4 w-4 flex-shrink-0" />
          Джерело даних ще не підключено — поки що тут порожньо
        </div>
      )}
      {status === "no-credits" && (
        <div className="mb-3 flex items-center justify-center gap-1.5 rounded-card-sm bg-surface shadow-card p-3 text-center text-[11.5px] text-text-faint">
          <SatelliteOffIcon className="h-4 w-4 flex-shrink-0" />
          На рахунку JBlanked закінчились кредити — поповни на jblanked.com/api/billing
        </div>
      )}
      {status === "error" && (
        <div className="mb-3 flex items-center justify-center gap-1.5 rounded-card-sm bg-surface shadow-card p-3 text-center text-[11.5px] text-text-faint">
          <SatelliteOffIcon className="h-4 w-4 flex-shrink-0" />
          Не вдалося завантажити календар, спробуй пізніше
        </div>
      )}

      {status === "ready" && (
        <div className="mb-3 flex gap-1.5 overflow-x-auto">
          <button
            onClick={() => setFilter("Всі")}
            className={cn(
              "flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium",
              filter === "Всі" ? "border-sage bg-sage text-bg font-semibold" : "border-border bg-surface text-text-dim"
            )}
          >
            Всі
          </button>
          {availableCurrencies.map((c) => (
            <button
              key={c}
              onClick={() => setFilter(c)}
              className={cn(
                "flex-shrink-0 rounded-full border px-3 py-1.5 text-[11px] font-medium",
                filter === c ? "border-sage bg-sage text-bg font-semibold" : "border-border bg-surface text-text-dim"
              )}
            >
              {c}
            </button>
          ))}
        </div>
      )}

      {status === "ready" && (
        <>
          <SectionTitle>Сьогодні</SectionTitle>
          {groups.today.length === 0 ? (
            <div className="mb-2 rounded-card-sm bg-surface shadow-card p-3 text-center text-[11.5px] text-text-faint">
              Немає релізів сьогодні
            </div>
          ) : (
            <div className="mb-2 rounded-card-sm bg-surface shadow-card px-3">
              {groups.today.map((e, i) => (
                <EventRow key={e.id} event={e} isLast={i === groups.today.length - 1} />
              ))}
            </div>
          )}

          <SectionTitle>Завтра</SectionTitle>
          {groups.tomorrow.length === 0 ? (
            <div className="mb-2 rounded-card-sm bg-surface shadow-card p-3 text-center text-[11.5px] text-text-faint">
              Немає релізів завтра
            </div>
          ) : (
            <div className="mb-2 rounded-card-sm bg-surface shadow-card px-3">
              {groups.tomorrow.map((e, i) => (
                <EventRow key={e.id} event={e} isLast={i === groups.tomorrow.length - 1} />
              ))}
            </div>
          )}

          {groups.week.length > 0 && (
            <>
              <SectionTitle>Цього тижня</SectionTitle>
              <div className="mb-2 rounded-card-sm bg-surface shadow-card px-3">
                {groups.week.map((e, i) => (
                  <EventRow key={e.id} event={e} isLast={i === groups.week.length - 1} />
                ))}
              </div>
            </>
          )}

          <SectionTitle>Асистент про сьогодні</SectionTitle>
          <Card className="border-sage/30">
            <div className="text-[12px] leading-relaxed text-text-dim">{assistantText}</div>
          </Card>
        </>
      )}
    </div>
  );
}
