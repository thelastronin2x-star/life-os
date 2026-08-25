"use client";

import { useMemo } from "react";
import { HealthSubpageHeader } from "@/components/health/HealthSubpageHeader";
import { DraggableQualitySlider } from "@/components/health/DraggableQualitySlider";
import { BodyMap } from "@/components/health/BodyMap";
import { WellbeingWeekTrend } from "@/components/health/WellbeingWeekTrend";
import { useHealthStore, FEELING_LEVELS } from "@/lib/health-store";
import { formatDateKey } from "@/lib/calendar-utils";
import { lastDays, WEEKDAY_SHORT } from "@/lib/health-utils";

const FEELING_OPTIONS = FEELING_LEVELS.map((label) => ({ value: label, label }));

export default function WellbeingDetailPage() {
  const store = useHealthStore();
  const today = formatDateKey(new Date());
  const todayEntry = store.wellbeingEntries.find((e) => e.date === today);
  const activeZones = new Set(todayEntry?.bodyZones ?? []);

  const weekData = useMemo(() => {
    const days = lastDays(7);
    return days.map((d) => {
      const entry = store.wellbeingEntries.find((e) => e.date === d);
      const feelingPct = entry ? ((FEELING_LEVELS.indexOf(entry.overallFeeling) + 1) / FEELING_LEVELS.length) * 100 : 0;
      const dow = new Date(d).getDay();
      return { label: WEEKDAY_SHORT[dow === 0 ? 6 : dow - 1], feelingPct, hasBodyZones: (entry?.bodyZones.length ?? 0) > 0 };
    });
  }, [store.wellbeingEntries]);

  return (
    <div>
      <HealthSubpageHeader title="Самопочуття" subtitle="Загальне відчуття і зони тіла" />

      <div className="rounded-card border border-border bg-surface p-5 shadow-card">
        <div className="mb-2.5 text-[11.5px] font-bold text-text-faint">Загальне відчуття</div>
        <DraggableQualitySlider
          levels={FEELING_OPTIONS}
          value={todayEntry?.overallFeeling ?? null}
          onChange={(feeling) => store.setOverallFeeling(feeling)}
          accentColor="var(--health-well)"
          ariaLabel="Загальне відчуття"
        />

        <div className="my-4.5 h-px bg-border" />

        <div className="mb-2.5 text-[11.5px] font-bold text-text-faint">Де саме</div>
        <BodyMap activeZones={activeZones} onToggle={(zoneId) => store.toggleBodyZone(zoneId)} />

        <textarea
          value={todayEntry?.note ?? ""}
          onChange={(e) => store.setWellbeingNote(e.target.value)}
          placeholder="Що саме — деталі, якщо треба..."
          rows={2}
          className="mt-3 w-full resize-none rounded-input border border-border bg-surface-2 px-3 py-2 text-[12px] text-text outline-none"
        />

        <div className="my-4.5 h-px bg-border" />

        <div className="mb-2.5 text-[11.5px] font-bold text-text-faint">Тиждень</div>
        <WellbeingWeekTrend days={weekData} />
      </div>
    </div>
  );
}
