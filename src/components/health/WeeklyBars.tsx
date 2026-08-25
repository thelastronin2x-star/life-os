interface WeeklyBarsProps {
  data: { label: string; value: number }[];
  color: string;
  formatValue?: (value: number) => string;
}

/** Shared weekly trend chart for the Здоров'я widgets — plain bars, no
 *  decorative gradients or SVG curves, matching the rest of the app's
 *  "columns and lines" chart language. */
export function WeeklyBars({ data, color, formatValue }: WeeklyBarsProps) {
  const max = Math.max(1, ...data.map((d) => d.value));

  return (
    <div className="flex items-end justify-between gap-1.5 px-0.5 pt-2">
      {data.map((d, i) => (
        <div key={i} className="flex flex-1 flex-col items-center gap-1.5">
          <div className="flex h-[64px] w-full items-end">
            <div
              className="w-full rounded-[4px]"
              style={{
                height: d.value > 0 ? `${Math.max(6, (d.value / max) * 64)}px` : "2px",
                background: d.value > 0 ? color : "var(--border)",
              }}
              title={formatValue ? formatValue(d.value) : String(d.value)}
            />
          </div>
          <span className="text-[9px] text-text-faint">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
