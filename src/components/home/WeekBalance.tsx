"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

/** One half of the week block: a coloured dot, a figure, a hairline track and
 *  a caption. Two of these share one card, split by a vertical hairline.
 *
 *  Separation from the assistant card comes from structure, not chrome: the
 *  assistant is one figure with a sentence under it, this is two figures in
 *  parallel with nothing to read. That difference survives both of them being
 *  white cards, which is what keeps the column of widgets aligned instead of
 *  one block hanging outside the shared margins.
 *
 *  `fill` is a fraction 0..1. It is never allowed to reach the full width: a
 *  track pinned at 100% reads as a limit hit, and neither of these figures has
 *  a limit — the bar is a comparison, not a budget. */
function WeekMetric({
  label,
  tone,
  value,
  unit,
  fill,
  caption,
  href,
}: {
  label: string;
  tone: "clay" | "sage";
  value: string;
  unit?: string;
  fill: number;
  caption: ReactNode;
  href: string;
}) {
  const color = tone === "clay" ? "var(--clay)" : "var(--sage)";
  return (
    <Link href={href} className="block min-w-0">
      <div className="flex items-center gap-1.5 text-[12px] font-bold text-text-dim">
        <span aria-hidden className="h-[5px] w-[5px] flex-shrink-0 rounded-full" style={{ background: color }} />
        <span className="truncate">{label}</span>
      </div>

      <div className="mt-2 font-display text-[26px] font-medium leading-none tracking-[-0.055em] text-text">
        {value}
        {unit && <span className="ml-1 text-[14px] font-normal tracking-normal text-text-dim">{unit}</span>}
      </div>

      <div className="mt-2.5 h-[3px] overflow-hidden rounded-full bg-surface-2">
        <div
          className="h-full rounded-full"
          style={{ width: `${Math.round(Math.min(Math.max(fill, 0), 0.96) * 100)}%`, background: color }}
        />
      </div>

      <div className="mt-1.5 text-[11px] font-semibold leading-[1.35] text-text-dim">{caption}</div>
    </Link>
  );
}

export function WeekBalance({
  expense,
  previousExpense,
  currencySymbol,
  trading,
}: {
  expense: number;
  previousExpense: number;
  currencySymbol: string;
  trading: { net: number; count: number; wins: number; winRate: number | null; symbol: string } | null;
}) {
  const deltaPct =
    previousExpense > 0 ? Math.round(((expense - previousExpense) / previousExpense) * 100) : null;

  // Both weeks share one scale, so the two tracks are comparable by eye: the
  // busier week fills its bar, the quieter one visibly falls short of it.
  const peak = Math.max(expense, previousExpense);
  const expenseFill = peak > 0 ? expense / peak : 0;

  return (
    <div
      className={cn(
        "card-raised grid items-start rounded-card bg-surface px-4 py-3",
        trading ? "grid-cols-[1fr_1px_1fr] gap-3.5" : "grid-cols-1"
      )}
    >
      <WeekMetric
        label="Витрати"
        tone="clay"
        value={formatFigure(expense)}
        unit={currencySymbol}
        fill={expenseFill}
        href="/balance"
        caption={
          previousExpense > 0 ? (
            <>
              минулого тижня {formatFigure(previousExpense)} {currencySymbol}
              {deltaPct !== null && (
                <>
                  {" · "}
                  <span style={{ color: deltaPct <= 0 ? "var(--sage)" : "var(--clay)" }}>
                    {deltaPct <= 0 ? "↓" : "↑"} {Math.abs(deltaPct)}%
                  </span>
                </>
              )}
            </>
          ) : (
            "перший тиждень з витратами"
          )
        }
      />

      {trading && <div aria-hidden className="h-full self-stretch bg-surface-2" />}

      {trading && (
        <WeekMetric
          label="Ринок"
          tone={trading.net >= 0 ? "sage" : "clay"}
          value={
            trading.count === 0
              ? "—"
              : `${trading.net >= 0 ? "+" : "−"}${formatFigure(Math.abs(trading.net))}`
          }
          unit={trading.count === 0 ? undefined : trading.symbol}
          fill={trading.winRate === null ? 0 : trading.winRate / 100}
          href="/work/journal"
          caption={
            trading.count === 0
              ? "цього тижня угод не було"
              : `${trading.wins} з ${trading.count} у плюс · ${trading.winRate}%`
          }
        />
      )}
    </div>
  );
}

/** Thousands separated by a thin space — at 27px a comma reads as a decimal
 *  point and turns 7 240 into seven-and-a-bit. */
function formatFigure(n: number): string {
  return Math.round(n)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, " ");
}
