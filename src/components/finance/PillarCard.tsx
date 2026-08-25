import type { ReactNode } from "react";
import type { FinancialStatus } from "@/lib/financial-health";
import { cn } from "@/lib/cn";

export function StatusPill({ status, label }: { status: FinancialStatus; label: string }) {
  return (
    <span
      className={cn(
        "flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold",
        status === "good" && "bg-sage-soft text-sage",
        status === "warn" && "bg-gold-soft text-gold",
        status === "bad" && "bg-clay-soft text-clay"
      )}
    >
      {label}
    </span>
  );
}

/** Collapsed by default: title, key number, status pill, mini-trend — the
 *  whole dashboard fits without scrolling. Tap expands `children` (advice,
 *  a progress bar, whatever detail that pillar has) below a divider; at
 *  most one card expanded at a time is enforced by the caller (FinanceOverview
 *  passes the same `expanded`/`onToggle` pattern to every card, closing
 *  whichever was open when a different one is tapped). Not a `<button>`
 *  wrapping everything — some pillars' expanded detail has its own
 *  interactive rows (goal cards, debt list), and a button can't nest one. */
export function PillarCard({
  title,
  keyMetric,
  status,
  statusLabel,
  trendPoints,
  trendColor,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  keyMetric: string;
  status: FinancialStatus;
  statusLabel: string;
  trendPoints?: string;
  trendColor?: string;
  expanded: boolean;
  onToggle: () => void;
  children?: ReactNode;
}) {
  return (
    <div className="mb-2.5 rounded-card border border-border bg-surface p-4">
      <div
        role="button"
        tabIndex={0}
        onClick={onToggle}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        className="flex cursor-pointer items-start justify-between gap-2"
      >
        <div className="min-w-0">
          <div className="text-[12.5px] font-semibold text-text-faint">{title}</div>
          <div className="font-display mt-0.5 truncate text-[17px] font-bold text-text">{keyMetric}</div>
        </div>
        <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
          <StatusPill status={status} label={statusLabel} />
          {trendPoints && (
            <svg className="h-[18px] w-[52px]" viewBox="0 0 52 18">
              <polyline
                points={trendPoints}
                fill="none"
                stroke={trendColor ?? "var(--accent)"}
                strokeWidth={1.8}
                strokeLinecap="round"
                vectorEffect="non-scaling-stroke"
              />
            </svg>
          )}
        </div>
      </div>
      {expanded && children && <div className="mt-3.5 border-t border-border pt-3.5">{children}</div>}
    </div>
  );
}
