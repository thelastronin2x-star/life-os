"use client";

import { useMemo, useState } from "react";
import { HealthSubpageHeader } from "@/components/health/HealthSubpageHeader";
import { AddMedicationSheet } from "@/components/health/AddMedicationSheet";
import { MedsAdherenceWeek } from "@/components/health/MedsAdherenceWeek";
import { useHealthStore } from "@/lib/health-store";
import { formatDateKey, DAY_PERIODS, periodForHour } from "@/lib/calendar-utils";
import { lastDays, WEEKDAY_SHORT } from "@/lib/health-utils";
import { cn } from "@/lib/cn";

export default function MedicationsDetailPage() {
  const store = useHealthStore();
  const today = formatDateKey(new Date());
  const [addOpen, setAddOpen] = useState(false);
  const doneToday = store.medIntakes[today] ?? [];
  const doneCount = store.medications.filter((m) => doneToday.includes(m.id)).length;

  // Grouped by day-period the same way Calendar's День view groups events —
  // a medication's `time` maps to Ранок/День/Вечір via the same periodForHour
  // helper, so the two screens read consistently.
  const groups = DAY_PERIODS.map((period) => ({
    period,
    meds: store.medications.filter((m) => periodForHour(parseInt(m.time.split(":")[0], 10)) === period),
  })).filter((g) => g.meds.length > 0);

  const weekData = useMemo(() => {
    const days = lastDays(7);
    return days.map((d) => {
      const doneIds = store.medIntakes[d] ?? [];
      const pct =
        store.medications.length === 0
          ? 0
          : Math.round((store.medications.filter((m) => doneIds.includes(m.id)).length / store.medications.length) * 100);
      const dow = new Date(d).getDay();
      return { label: WEEKDAY_SHORT[dow === 0 ? 6 : dow - 1], pct };
    });
  }, [store.medications, store.medIntakes]);

  return (
    <div>
      <HealthSubpageHeader title="Ліки та добавки" subtitle="Чеклист прийому й нагадування" />

      <div className="card-raised rounded-card bg-surface p-5">
        <div className="mb-4.5 text-center">
          <div className="font-display text-[30px] font-extrabold text-text">
            {doneCount} з {store.medications.length}
          </div>
          <div className="mt-1 text-[12px] text-text-faint">прийнято сьогодні</div>
        </div>

        {store.medications.length === 0 ? (
          <div className="py-2 text-center text-[12px] text-text-faint">Ще немає доданих ліків</div>
        ) : (
          <>
            <div className="my-4.5 h-px bg-border" />
            {groups.map(({ period, meds }) => (
              <div key={period.key} className="mb-3.5">
                <div className="mb-1.5 flex items-center gap-2.5">
                  <span className="text-[11px] font-bold text-text-dim">{period.label}</span>
                  <span className="h-px flex-1 bg-border" />
                </div>
                <div className="space-y-1.5">
                  {meds.map((med) => {
                    const done = doneToday.includes(med.id);
                    return (
                      <button
                        key={med.id}
                        onClick={() => store.toggleMedDone(today, med.id)}
                        className="flex w-full items-center gap-2.5 rounded-card-sm bg-surface-2 px-3.5 py-2.5 text-left"
                      >
                        <span
                          className={cn(
                            "flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full border text-[11px]",
                            done ? "border-transparent text-bg" : "border-border bg-surface"
                          )}
                          style={done ? { background: "var(--health-meds)" } : undefined}
                        >
                          {done ? "✓" : ""}
                        </span>
                        <span className="min-w-0 flex-1">
                          <span
                            className={cn(
                              "block truncate text-[13px] font-semibold",
                              done ? "text-text-faint line-through" : "text-text"
                            )}
                          >
                            {med.name}
                          </span>
                          {med.dose && <span className="mt-0.5 block text-[10.5px] text-text-faint">{med.dose}</span>}
                        </span>
                        <span className="flex-shrink-0 text-[11.5px] font-bold text-text-faint">{med.time}</span>
                        <span
                          onClick={(e) => {
                            e.stopPropagation();
                            store.removeMedication(med.id);
                          }}
                          className="flex-shrink-0 px-1 text-[13px] text-text-faint"
                        >
                          ✕
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </>
        )}

        <button
          onClick={() => setAddOpen(true)}
          className="mt-1 w-full rounded-card-sm border border-dashed border-border py-3 text-center text-[13px] font-semibold text-text-faint"
        >
          + Додати ліки чи добавку
        </button>

        {store.medications.length > 0 && (
          <>
            <div className="my-4.5 h-px bg-border" />
            <div className="mb-2.5 text-[11.5px] font-bold text-text-faint">Дотримання за тиждень</div>
            <MedsAdherenceWeek days={weekData} />
          </>
        )}
      </div>

      {addOpen && (
        <AddMedicationSheet
          onClose={() => setAddOpen(false)}
          onSubmit={({ name, time, dose, addReminder }) => store.addMedication(name, time, addReminder, dose)}
        />
      )}
    </div>
  );
}
