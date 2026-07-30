import type { ReactNode } from "react";
import type { GoalColor } from "@/lib/finance-store";
import { clampRingPercent } from "@/lib/ring-math";

export function CategoryRing({
  percent,
  color,
  size = 56,
  children,
}: {
  /** Null means "no limit configured for this scope" — draws a plain
   *  neutral track with no progress arc at all, so it can never be confused
   *  with "a limit exists and 0% of it is used" (which is a real, different
   *  state and still shows an empty-but-present colored track). */
  percent: number | null;
  color: GoalColor;
  size?: number;
  children: ReactNode;
}) {
  const r = size / 2 - 4;
  const circumference = 2 * Math.PI * r;
  const hasLimit = percent !== null;
  const safePercent = hasLimit ? clampRingPercent(percent) : 0;
  const offset = circumference * (1 - safePercent / 100);

  return (
    <div className="relative flex flex-shrink-0 items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="absolute inset-0" style={{ transform: "rotate(-90deg)" }}>
        <circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke="var(--surface-2)"
          strokeWidth={4}
          fill="none"
          strokeDasharray={hasLimit ? undefined : "2 4"}
        />
        {hasLimit && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            stroke={`var(--${color})`}
            strokeWidth={4}
            fill="none"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
          />
        )}
      </svg>
      <div
        className="flex items-center justify-center rounded-full"
        style={{ width: size - 16, height: size - 16, background: `color-mix(in srgb, var(--${color}) 15%, transparent)` }}
      >
        {children}
      </div>
    </div>
  );
}
