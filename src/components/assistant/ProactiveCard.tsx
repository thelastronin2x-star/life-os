"use client";

import { SparkleIcon } from "@/components/icons";

/** A proactive insight referencing a REAL past AdviceRecord match — never
 *  rendered unless the caller already found a genuine precedent (see
 *  buildProactiveInsights in /assistant/page.tsx). Colors are the spec's own
 *  fixed gold-on-dark tag, not app design tokens — this tag is meant to
 *  read as distinct from every other card on the screen. */
export function ProactiveCard({
  summary,
  pastReference,
  actionLabel,
  onAction,
  onDismiss,
}: {
  summary: string;
  pastReference: string;
  actionLabel: string;
  onAction: () => void;
  onDismiss: () => void;
}) {
  return (
    <div className="card-raised mb-3 rounded-card bg-surface p-3.5">
      <span
        className="mb-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
        style={{ backgroundColor: "#241f17", color: "#c9a45f" }}
      >
        <SparkleIcon className="h-3 w-3" /> Проактивно
      </span>
      <div className="text-[12.5px] leading-relaxed text-text">{summary}</div>
      <div className="mt-1 text-[11px] text-text-faint">{pastReference}</div>
      <div className="mt-2.5 flex gap-2">
        <button onClick={onAction} className="flex-1 rounded-btn bg-sage py-2 text-[12px] font-semibold text-bg">
          {actionLabel}
        </button>
        <button onClick={onDismiss} className="rounded-btn px-3 py-2 text-[12px] text-text-faint">
          Пропустити
        </button>
      </div>
    </div>
  );
}
