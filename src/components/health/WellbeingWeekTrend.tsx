import { cn } from "@/lib/cn";

interface WellbeingDayTrend {
  label: string;
  feelingPct: number; // 0-100, this day's overall feeling as % of the 5 levels
  hasBodyZones: boolean;
}

interface WellbeingWeekTrendProps {
  days: WellbeingDayTrend[];
}

/** Bar height = that day's overall feeling; the dot under a day with any
 *  body zone marked is a visual nudge toward "feeling dips on symptom
 *  days" straight from the dashboard, ahead of whatever the AI insight
 *  card says about it explicitly. */
export function WellbeingWeekTrend({ days }: WellbeingWeekTrendProps) {
  return (
    <div className="trend-bars">
      {days.map((d) => (
        <div key={d.label} className="tbar-wrap">
          <div className={cn("tbar", d.feelingPct === 0 && "low")} style={{ height: `${d.feelingPct || 8}%` }} />
          <div className="tbar-lbl">{d.label}</div>
          {d.hasBodyZones && <div className="tbar-dot" />}
        </div>
      ))}
    </div>
  );
}
