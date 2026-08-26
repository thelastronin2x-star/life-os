"use client";

import { cn } from "@/lib/cn";
import { PlusIcon } from "@/components/icons";
import type { TradingAccountView } from "@/lib/trading-accounts";

const AVATAR_COLORS = ["sage", "gold", "sky", "rose", "clay"] as const;

export type SyncStatus = "fresh" | "aging" | "stale";

const SYNC_DOT_COLOR: Record<SyncStatus, string> = {
  fresh: "#4caf6e",
  aging: "#d9a867",
  stale: "#6b6459",
};

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.trim().slice(0, 2).toUpperCase();
}

export function AccountSelector({
  accounts,
  selectedId,
  onSelect,
  onAdd,
  currencySymbol,
  syncStatusByAccountId,
  variant = "default",
}: {
  accounts: TradingAccountView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  currencySymbol: string;
  /** Recency of each account's last trade activity — a real, derived signal
   *  (no live MT5 sync exists, imports are manual file uploads), reused as
   *  the mockup's "sync" dot: fresh/aging/stale rather than a fake live
   *  connection status. */
  syncStatusByAccountId?: Map<string, SyncStatus>;
  /** "inset" renders on the balance block's own dark inset rather than the
   *  surrounding surface — chips get a translucent light background instead
   *  of `bg-surface` so they still read against that fixed warm/dark strip. */
  variant?: "default" | "inset";
}) {
  const inset = variant === "inset";
  return (
    <div className="flex gap-2 overflow-x-auto pb-1">
      {accounts.map((acc, i) => {
        const active = acc.id === selectedId;
        const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
        const syncStatus = syncStatusByAccountId?.get(acc.id);
        const valueLabel =
          acc.kind === "personal"
            ? `${acc.balance.toFixed(0)} ${currencySymbol}`
            : `${acc.netPnL >= 0 ? "+" : ""}${acc.netPnL.toFixed(0)} ${currencySymbol}`;
        return (
          <button
            key={acc.id}
            onClick={() => onSelect(acc.id)}
            className={cn(
              "flex flex-shrink-0 items-center gap-2 rounded-full border-[1.5px] py-2 pl-2 pr-3.5",
              inset
                ? active
                  ? "border-transparent bg-white/20"
                  : "border-transparent bg-white/10"
                : active
                  ? "border-sage bg-surface-2"
                  : "border-transparent bg-surface"
            )}
          >
            <div className="relative flex h-6 w-6 flex-shrink-0 items-center justify-center">
              <div
                className="flex h-6 w-6 items-center justify-center rounded-full text-[11px] font-semibold"
                style={{
                  background: `var(--${color}-soft)`,
                  color: `var(--${color})`,
                }}
              >
                {initials(acc.name)}
              </div>
              {syncStatus && (
                <span
                  className="absolute -bottom-0.5 -right-0.5 h-2 w-2 rounded-full border border-bg"
                  style={{ background: SYNC_DOT_COLOR[syncStatus], borderColor: inset ? "transparent" : undefined }}
                />
              )}
            </div>
            <div className="text-left">
              <div className={cn("text-[11.5px] font-semibold", inset ? "text-white" : "text-text")}>{acc.name}</div>
              <div className={cn("font-mono text-[9.5px]", inset ? "text-white/60" : "text-text-faint")}>
                {valueLabel}
              </div>
            </div>
          </button>
        );
      })}
      <button
        onClick={onAdd}
        className={cn(
          "flex flex-shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-dashed px-3.5 py-2 text-[11px]",
          inset ? "border-white/25 text-white/60" : "border-border text-text-faint"
        )}
      >
        <PlusIcon className="h-3 w-3" /> Додати
      </button>
    </div>
  );
}
