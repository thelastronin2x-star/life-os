import type { Trade } from "@/lib/journal-store";
import type { JournalInstrument, JournalSession, JournalTag } from "@/lib/journal-config-store";
import type { TradePnL } from "@/lib/trade-calculations";
import { formatDateKey } from "@/lib/calendar-utils";
import { cn } from "@/lib/cn";

interface TradeItemProps {
  trade: Trade;
  instrument: JournalInstrument | undefined;
  pnl: TradePnL;
  currencySymbol: string;
  session?: JournalSession;
  tags: JournalTag[];
  onClick?: () => void;
}

/**
 * Compact row for a single trade — one line of identity + P&L, one line of
 * metadata underneath. Deliberately drops the old per-row entry/stop/take
 * boxes and per-tag pill backgrounds (that detail lives in the edit form);
 * a list of these is meant to be scanned at a glance, not re-read.
 */
export function TradeItem({ trade: t, instrument, pnl, currencySymbol, session, tags, onClick }: TradeItemProps) {
  const dateLabel = t.date === formatDateKey(new Date()) ? "Сьогодні" : t.date;

  return (
    <div onClick={onClick} className="mb-2 rounded-card-sm bg-surface p-3 active:opacity-70">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "flex-shrink-0 rounded-full px-1.5 py-0.5 text-[8.5px] font-semibold",
            t.direction === "LONG" ? "bg-sage/15 text-sage" : "bg-rose/15 text-rose"
          )}
        >
          {t.direction === "LONG" ? "Long" : "Short"}
        </span>
        <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-text">
          {instrument?.symbol ?? "—"}
        </span>
        {t.status === "open" ? (
          <span className="flex-shrink-0 text-[11px] font-semibold text-sky">відкрита</span>
        ) : (
          <span
            className={cn(
              "flex-shrink-0 font-mono text-[13px] font-semibold",
              (pnl.net ?? 0) > 0 ? "text-sage" : "text-clay"
            )}
          >
            {(pnl.net ?? 0) > 0 ? "+" : ""}
            {(pnl.net ?? 0).toFixed(2)} {currencySymbol}
          </span>
        )}
      </div>
      <div className="mt-1.5 truncate text-[10.5px] text-text-faint">
        {dateLabel} · {t.time} · R:R {pnl.rrActual ?? pnl.rrPlanned}
        {session && ` · ${session.name}`}
        {tags.length > 0 && (
          <span className="text-sky"> · {tags.map((tag) => `#${tag.name}`).join(" ")}</span>
        )}
      </div>
    </div>
  );
}
