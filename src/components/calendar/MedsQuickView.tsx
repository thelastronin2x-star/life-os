"use client";

import { useHealthStore } from "@/lib/health-store";
import type { CalendarItem } from "@/lib/calendar-store";
import { resolveMedicationForItem } from "@/lib/meds-calendar-link";
import { cn } from "@/lib/cn";

interface MedsQuickViewProps {
  /** Occurrence date ("YYYY-MM-DD") these items belong to — scopes both the
   *  `taken` lookup and the toggle to the right day for a recurring
   *  medication reminder. */
  date: string;
  items: CalendarItem[];
  onClose: () => void;
}

/** Popover for the meds-count marker in DayAgenda/WeekStrip — reads and
 *  toggles the exact same `medIntakes`/`toggleMedDone` state the Ліки
 *  widget on Здоров'я uses, not a parallel Calendar-side record.
 *  resolveMedicationForItem covers both modern (medicationId) and legacy
 *  (title-matched) reminders — see meds-calendar-link.ts. Items that still
 *  don't resolve (the medication was removed independently of its calendar
 *  reminder) are silently skipped rather than shown as a broken row. */
export function MedsQuickView({ date, items, onClose }: MedsQuickViewProps) {
  // Whole-store subscription, not a `useHealthStore((s) => s.medIntakes[date]
  // ?? [])`-style selector — that `?? []` fallback allocates a new array on
  // every call, so useSyncExternalStore never sees a referentially-stable
  // snapshot and re-renders in an infinite loop. Same pattern the rest of
  // the Здоров'я widgets already use for this exact lookup (see
  // health/page.tsx's `store.medIntakes[today] ?? []`).
  const store = useHealthStore();
  const doneIds = store.medIntakes[date] ?? [];

  const rows = items
    .map((item) => ({ item, med: resolveMedicationForItem(item, store.medications) }))
    .filter((r): r is { item: CalendarItem; med: (typeof store.medications)[number] } => !!r.med);

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-2 flex items-center justify-between">
          <div className="font-heading text-[16px] font-semibold text-text">Прийоми ліків</div>
          <button onClick={onClose} className="text-[13px] text-text-faint">
            Закрити
          </button>
        </div>

        {rows.length === 0 ? (
          <div className="py-2 text-[12px] text-text-faint">Немає ліків у цей період</div>
        ) : (
          <div className="space-y-1">
            {rows.map(({ item, med }) => {
              const taken = doneIds.includes(med.id);
              return (
                <button
                  key={item.id}
                  onClick={() => store.toggleMedDone(date, med.id)}
                  className="flex w-full items-center gap-2.5 rounded-input px-2 py-2.5 text-left"
                >
                  <span
                    className={cn(
                      "flex h-[18px] w-[18px] flex-shrink-0 items-center justify-center rounded-[6px] border text-[10px]",
                      taken ? "border-sage bg-sage text-bg" : "border-border bg-surface-2"
                    )}
                  >
                    {taken ? "✓" : ""}
                  </span>
                  <span className={cn("text-[13px]", taken ? "text-text-faint line-through" : "text-text")}>
                    {med.name} · {med.time}
                  </span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
