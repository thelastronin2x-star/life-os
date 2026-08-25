import type { Trade } from "@/lib/journal-store";
import type { JournalInstrument, JournalSession, JournalTag } from "@/lib/journal-config-store";
import type { TradePnL } from "@/lib/trade-calculations";
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
 * One trade, one line. Reads left to right as: did I follow my plan → what did
 * I trade → how well did it go (R) → how much money.
 *
 * The direction arrow that used to lead the row is gone. LONG/SHORT is already
 * in the metadata line and it was competing for the leftmost, most-scanned
 * position with the thing that actually matters when reviewing a month of
 * trades: whether the trade should have been taken at all.
 */
export function TradeItem({ trade: t, instrument, pnl, currencySymbol, session, tags, onClick }: TradeItemProps) {
  const r = pnl.rMultiple;

  return (
    <div onClick={onClick} className="flex items-center gap-2.5 border-b border-border py-2.5 last:border-b-0 active:opacity-70">
      {/* Undefined (not answered) renders as a muted dash rather than a
          verdict — see Trade.followedPlan. */}
      <div
        className={cn(
          "w-5 flex-shrink-0 text-center text-[14px] font-extrabold",
          t.followedPlan === true && "text-sage",
          t.followedPlan === false && "text-clay",
          t.followedPlan === undefined && "text-text-faint opacity-40"
        )}
      >
        {t.followedPlan === true ? "✓" : t.followedPlan === false ? "✕" : "·"}
      </div>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-[13px] font-extrabold text-text">{instrument?.symbol ?? "—"}</span>
          {r !== null && (
            <span
              className={cn(
                "flex-shrink-0 rounded-full px-1.5 py-0.5 font-mono text-[10px] font-extrabold",
                r >= 0 ? "bg-sage-soft text-sage" : "bg-clay-soft text-clay"
              )}
            >
              {r >= 0 ? "+" : "−"}
              {Math.abs(r).toFixed(1)}R
            </span>
          )}
        </div>
        <div className="mt-0.5 truncate text-[11px] font-semibold text-text-faint">
          {t.time} · {t.direction === "LONG" ? "long" : "short"}
          {session && ` · ${session.name}`}
          {tags.length > 0 && <span className="text-sky"> · {tags.map((tag) => tag.name).join(", ")}</span>}
        </div>
      </div>

      {t.status === "open" ? (
        <span className="flex-shrink-0 text-[11.5px] font-extrabold text-sky">відкрита</span>
      ) : (
        <span
          className={cn(
            "flex-shrink-0 font-mono text-[13.5px] font-extrabold tracking-tight",
            (pnl.net ?? 0) >= 0 ? "text-sage" : "text-clay"
          )}
        >
          {(pnl.net ?? 0) >= 0 ? "+" : ""}
          {(pnl.net ?? 0).toFixed(0)} {currencySymbol}
        </span>
      )}
    </div>
  );
}
