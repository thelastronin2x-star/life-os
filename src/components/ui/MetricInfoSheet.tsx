"use client";

import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** Small circular info-badge that sits next to a section heading — tapping
 *  it opens the matching MetricInfoSheet. SVG dot+line glyph, never a text
 *  "i": a text glyph reads as a stray letter in the heading, this reads
 *  unambiguously as a button. */
export function InfoBadge({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`Пояснення: ${label}`}
      className="well-pressed flex h-[19px] w-[19px] flex-shrink-0 items-center justify-center rounded-full bg-surface-2 text-text-dim"
    >
      <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <circle cx="12" cy="7.5" r="0.5" fill="currentColor" stroke="none" />
        <path d="M12 11v6" />
      </svg>
    </button>
  );
}

export interface MetricInfoRow {
  icon: ReactNode;
  label: string;
  text: string;
}

/** Bottom sheet explaining one complex metric: "Що це" / "Як читати" / "Як
 *  рахується", each with its own small icon-well. One reusable component
 *  fed a title/icon/rows triple, not three hardcoded copies — the three
 *  metrics on the analytics screen (risk of ruin, Kelly, Monte Carlo) all
 *  render through this. Follows the same fixed-overlay bottom-sheet shape
 *  every other sheet in the app uses (see MacroEventDetailSheet), rather
 *  than a bespoke slide-in animation. */
export function MetricInfoSheet({
  icon,
  title,
  rows,
  onClose,
}: {
  icon: ReactNode;
  title: string;
  rows: MetricInfoRow[];
  onClose: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center" onClick={onClose}>
      <div
        className="w-full max-w-md rounded-t-card bg-bg p-5 shadow-card md:rounded-card"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="mb-3.5 flex items-center gap-3">
          <span className="well-pressed flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-sage">
            {icon}
          </span>
          <div className="flex-1 text-[15px] font-bold text-text">{title}</div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Закрити"
            className="well-pressed flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full bg-surface text-[13px] text-text-faint"
          >
            ✕
          </button>
        </div>
        {rows.map((row, i) => (
          <div key={row.label} className={cn("flex gap-3 py-3", i < rows.length - 1 && "border-b border-border")}>
            <span className="well-pressed flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-card-sm bg-surface text-gold">
              {row.icon}
            </span>
            <div className="min-w-0 flex-1">
              <div className="mb-1 text-[10px] font-bold uppercase tracking-wide text-text-faint">{row.label}</div>
              <div className="text-[12.5px] leading-relaxed text-text-dim">{row.text}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/** The three explanation-row icons, shared across every MetricInfoSheet:
 *  info-circle for "Що це", eye for "Як читати", bar-chart for "Як
 *  рахується" — same glyphs regardless of which metric's sheet is open. */
export const METRIC_INFO_ROW_ICONS = {
  what: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-5M12 8h.01" />
    </svg>
  ),
  read: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  ),
  calc: (
    <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2">
      <path d="M4 20V10M12 20V4M20 20v-7" />
    </svg>
  ),
};
