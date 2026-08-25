interface MedsAdherenceDay {
  label: string;
  pct: number; // 0-100 — share of today's medications marked done that day
}

interface MedsAdherenceWeekProps {
  days: MedsAdherenceDay[];
}

/** Same proportional-bar shape as WeeklyBars/WellbeingWeekTrend elsewhere in
 *  Здоров'я, colored by bucket instead of a single color: full adherence
 *  (100%) in the meds accent, a missed day (0%) in a muted border tone,
 *  anything between in gold — a quick visual read of "which days slipped"
 *  without a separate legend. */
export function MedsAdherenceWeek({ days }: MedsAdherenceWeekProps) {
  return (
    <div className="flex items-end justify-between gap-1.5 px-0.5 pt-1">
      {days.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex h-10 w-full items-end overflow-hidden rounded-[6px] bg-surface-2">
            <div
              className="w-full rounded-[6px]"
              style={{
                height: `${Math.max(10, d.pct)}%`,
                background: d.pct === 100 ? "var(--health-meds)" : d.pct === 0 ? "var(--border)" : "var(--gold)",
              }}
            />
          </div>
          <span className="text-[9px] text-text-faint">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
