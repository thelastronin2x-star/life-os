"use client";

import { cn } from "@/lib/cn";
import { PlusIcon } from "@/components/icons";
import type { TradingAccountView } from "@/lib/trading-accounts";

const AVATAR_COLORS = ["sage", "gold", "sky", "rose", "clay"] as const;

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
}: {
  accounts: TradingAccountView[];
  selectedId: string | null;
  onSelect: (id: string) => void;
  onAdd: () => void;
  currencySymbol: string;
}) {
  return (
    <div className="mb-3 flex gap-2 overflow-x-auto pb-1">
      {accounts.map((acc, i) => {
        const active = acc.id === selectedId;
        const color = AVATAR_COLORS[i % AVATAR_COLORS.length];
        const valueLabel =
          acc.kind === "personal"
            ? `${acc.balance.toFixed(0)} ${currencySymbol}`
            : `${acc.netPnL >= 0 ? "+" : ""}${acc.netPnL.toFixed(0)} ${currencySymbol}`;
        return (
          <button
            key={acc.id}
            onClick={() => onSelect(acc.id)}
            className={cn(
              "flex flex-shrink-0 items-center gap-2 rounded-full border-[1.5px] bg-surface py-2 pl-2 pr-3.5",
              active ? "border-sage bg-surface-2" : "border-transparent"
            )}
          >
            <div
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[11px] font-semibold"
              style={{
                background: `var(--${color}-soft)`,
                color: `var(--${color})`,
              }}
            >
              {initials(acc.name)}
            </div>
            <div className="text-left">
              <div className="text-[11.5px] font-semibold text-text">{acc.name}</div>
              <div className="font-mono text-[9.5px] text-text-faint">{valueLabel}</div>
            </div>
          </button>
        );
      })}
      <button
        onClick={onAdd}
        className="flex flex-shrink-0 items-center gap-1.5 rounded-full border-[1.5px] border-dashed border-border px-3.5 py-2 text-[11px] text-text-faint"
      >
        <PlusIcon className="h-3 w-3" /> Додати
      </button>
    </div>
  );
}
