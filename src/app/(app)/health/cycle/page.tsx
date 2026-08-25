"use client";

import { useState } from "react";
import { HealthSubpageHeader } from "@/components/health/HealthSubpageHeader";
import { AddCustomChip } from "@/components/health/AddCustomChip";
import { useHealthStore, DEFAULT_SYMPTOM_TAGS } from "@/lib/health-store";
import { formatDateKey } from "@/lib/calendar-utils";
import { computeCycleStatus, CYCLE_PHASE_LABEL } from "@/lib/health-utils";
import { cn } from "@/lib/cn";

export default function CycleDetailPage() {
  const store = useHealthStore();
  const today = formatDateKey(new Date());
  const cycle = computeCycleStatus(store.periodStarts, store.cycleSettings);
  const todaySymptoms = store.symptomEntries.find((e) => e.date === today);
  const tags = [...DEFAULT_SYMPTOM_TAGS, ...store.customSymptomTags];

  const [cycleLen, setCycleLen] = useState(String(store.cycleSettings.avgCycleLength));
  const [periodLen, setPeriodLen] = useState(String(store.cycleSettings.avgPeriodLength));

  function saveSettings() {
    const cl = Number(cycleLen);
    const pl = Number(periodLen);
    if (cl > 0 && pl > 0) store.setCycleSettings({ avgCycleLength: cl, avgPeriodLength: pl });
  }

  return (
    <div>
      <HealthSubpageHeader title="Цикл" subtitle="Фаза, прогноз, симптоми" />

      <div className="mb-3.5 rounded-card border border-border bg-surface p-4 shadow-card">
        {cycle ? (
          <>
            <div className="mb-1 text-center font-display text-[28px] text-text">День {cycle.day}</div>
            <div className="mb-3 text-center text-[12px] text-text-dim">{CYCLE_PHASE_LABEL[cycle.phase]}</div>
            <div className="mb-1.5 h-1.5 w-full overflow-hidden rounded-full bg-surface-2">
              <div className="h-full rounded-full bg-rose" style={{ width: `${Math.round(cycle.progress * 100)}%` }} />
            </div>
            <div className="mb-3.5 text-center text-[10.5px] text-text-faint">
              Наступні місячні орієнтовно через {cycle.nextPeriodInDays} дн.
            </div>
          </>
        ) : (
          <div className="mb-3.5 text-center text-[12px] text-text-faint">Ще немає позначених місячних</div>
        )}

        <button
          onClick={() => store.markPeriodStart()}
          className="w-full rounded-btn bg-rose py-2.5 text-[13px] font-semibold text-bg"
        >
          Позначити початок місячних
        </button>
      </div>

      <div className="mb-3.5 rounded-card-sm border border-border bg-surface p-3.5">
        <div className="mb-2 text-[11.5px] font-semibold text-text">Симптоми сьогодні</div>
        <div className="flex flex-wrap gap-1.5">
          {tags.map((tag) => (
            <button
              key={tag}
              onClick={() => store.toggleTodaySymptom(tag)}
              className={cn(
                "rounded-full border px-2.5 py-1 text-[10.5px]",
                todaySymptoms?.tags.includes(tag)
                  ? "border-rose bg-rose-soft text-rose"
                  : "border-border bg-surface-2 text-text-dim"
              )}
            >
              {tag}
            </button>
          ))}
          <AddCustomChip onAdd={store.addCustomSymptomTag} />
        </div>
      </div>

      <div className="rounded-card-sm border border-border bg-surface p-3.5">
        <div className="mb-2 text-[11.5px] font-semibold text-text">Середні показники</div>
        <div className="flex items-center gap-2">
          <div className="flex-1">
            <div className="mb-1 text-[10px] text-text-faint">Довжина циклу, дн.</div>
            <input
              type="number"
              value={cycleLen}
              onChange={(e) => setCycleLen(e.target.value)}
              onBlur={saveSettings}
              className="w-full rounded-input border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none"
            />
          </div>
          <div className="flex-1">
            <div className="mb-1 text-[10px] text-text-faint">Довжина місячних, дн.</div>
            <input
              type="number"
              value={periodLen}
              onChange={(e) => setPeriodLen(e.target.value)}
              onBlur={saveSettings}
              className="w-full rounded-input border border-border bg-surface-2 px-2.5 py-1.5 text-[12px] text-text outline-none"
            />
          </div>
        </div>
      </div>
    </div>
  );
}
