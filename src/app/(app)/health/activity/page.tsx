"use client";

import { useMemo, useState } from "react";
import { HealthSubpageHeader } from "@/components/health/HealthSubpageHeader";
import { WeeklyBars } from "@/components/health/WeeklyBars";
import { AddCustomChip } from "@/components/health/AddCustomChip";
import { useHealthStore, DEFAULT_ACTIVITY_TYPES } from "@/lib/health-store";
import { formatDateKey } from "@/lib/calendar-utils";
import { lastDays, WEEKDAY_SHORT } from "@/lib/health-utils";
import { cn } from "@/lib/cn";

export default function ActivityDetailPage() {
  const store = useHealthStore();
  const today = formatDateKey(new Date());
  const [type, setType] = useState<string | null>(null);
  const [minutes, setMinutes] = useState(30);

  const types = [...DEFAULT_ACTIVITY_TYPES, ...store.customActivityTypes];
  const todayEntries = store.activityEntries.filter((e) => e.date === today);

  const chartData = useMemo(() => {
    const days = lastDays(7);
    const byDay = new Map<string, number>();
    for (const e of store.activityEntries) byDay.set(e.date, (byDay.get(e.date) ?? 0) + e.minutes);
    return days.map((d) => {
      const dow = new Date(d).getDay();
      return { label: WEEKDAY_SHORT[dow === 0 ? 6 : dow - 1], value: byDay.get(d) ?? 0 };
    });
  }, [store.activityEntries]);

  function save() {
    if (!type) return;
    store.addActivity(type, minutes);
    setType(null);
    setMinutes(30);
  }

  return (
    <div>
      <HealthSubpageHeader title="Активність" subtitle="Тип і тривалість тренування" />

      <div className="mb-3.5 rounded-card border border-border bg-surface p-4 shadow-card">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {types.map((t) => (
            <button
              key={t}
              onClick={() => setType(t)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10.5px]",
                type === t ? "border-sky bg-sky-soft text-sky" : "border-border bg-surface-2 text-text-dim"
              )}
            >
              {t}
            </button>
          ))}
          <AddCustomChip onAdd={store.addCustomActivityType} />
        </div>

        <div className="mb-3 flex items-center justify-center gap-4">
          <button
            onClick={() => setMinutes((m) => Math.max(5, m - 5))}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-[15px] text-text-dim"
          >
            −
          </button>
          <span className="font-display text-[22px] text-text">{minutes} хв</span>
          <button
            onClick={() => setMinutes((m) => m + 5)}
            className="flex h-8 w-8 items-center justify-center rounded-full border border-border bg-surface-2 text-[15px] text-text-dim"
          >
            +
          </button>
        </div>

        <button
          onClick={save}
          disabled={!type}
          className="w-full rounded-btn bg-text py-2.5 text-[13px] font-semibold text-bg disabled:opacity-40"
        >
          Зберегти
        </button>
      </div>

      {todayEntries.length > 0 && (
        <div className="mb-3.5 rounded-card-sm border border-border bg-surface p-3.5">
          <div className="mb-2 text-[11.5px] font-semibold text-text">Сьогодні</div>
          <div className="space-y-1.5">
            {todayEntries.map((e) => (
              <div key={e.id} className="flex items-center justify-between text-[11.5px]">
                <span className="text-text-dim">{e.type}</span>
                <span className="text-text-faint">{e.minutes} хв</span>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="rounded-card-sm border border-border bg-surface p-3.5">
        <div className="mb-1 text-[11.5px] font-semibold text-text">Хвилини активності за тиждень</div>
        <WeeklyBars data={chartData} color="var(--sky)" formatValue={(v) => `${v} хв`} />
      </div>
    </div>
  );
}
