import type { GoalColor } from "@/lib/finance-store";
import { clampRingPercent } from "@/lib/ring-math";

export function GoalRing({ percent, color, size = 46 }: { percent: number; color: GoalColor; size?: number }) {
  // A goal with target 0 (shouldn't happen once GoalForm validates it, but
  // old/imported data could still have one) produces NaN or Infinity here —
  // clamped to a plain, readable 0% rather than a broken ring and "NaN%"/
  // "Infinity%" label.
  const safePercent = clampRingPercent(percent);
  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const offset = circumference * (1 - safePercent / 100);

  return (
    <div className="relative flex flex-shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--surface-2)"
          strokeWidth={4.5}
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={`var(--${color})`}
          strokeWidth={4.5}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute font-mono text-[9.5px] font-bold text-text">{Math.round(safePercent)}%</div>
    </div>
  );
}
