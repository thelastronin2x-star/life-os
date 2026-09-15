"use client";

import { CategoryIcon } from "@/lib/finance-categories";
import type { BudgetCategory } from "@/lib/finance-store";
import { cn } from "@/lib/cn";

/** The panel a tap on the "Категоризувати покупку" push opens (see
 *  /balance's ?action=applepay effect) — amount + merchant already known
 *  from the Shortcuts POST, the only decision left is which of the user's
 *  OWN categories (not the full 18-key catalog — same set TransactionForm
 *  offers) it belongs to. `suggestedCategoryId` is only ever a real past
 *  match (see finance-merchant-suggest.ts) — never a guess — and simply
 *  isn't passed when there's no history for this merchant. */
export function ApplePayCategorizeSheet({
  amount,
  merchant,
  categories,
  suggestedCategoryId,
  onPick,
  onLater,
}: {
  amount: number;
  merchant: string;
  categories: BudgetCategory[];
  suggestedCategoryId: string | null;
  onPick: (categoryId: string) => void;
  onLater: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60 md:items-center">
      <div className="w-full max-w-md rounded-t-card bg-bg shadow-card p-5 md:rounded-card">
        <div className="mb-4 flex items-center gap-2.5">
          <span className="flex h-[26px] w-[26px] flex-shrink-0 items-center justify-center rounded-full bg-sage-soft text-sage">
            ✓
          </span>
          <div className="min-w-0">
            <div className="font-display text-[18px] font-bold text-text">-{amount.toFixed(0)}₴</div>
            <div className="truncate text-[11px] text-text-faint">{merchant} · щойно</div>
          </div>
        </div>

        <div className="mb-2 text-[11px] font-bold uppercase tracking-wide text-text-faint">До якої категорії?</div>

        {categories.length === 0 ? (
          <div className="rounded-card-sm border border-dashed border-border p-4 text-center text-[11.5px] text-text-faint">
            Ще немає жодної категорії — додай першу на екрані Фінансів
          </div>
        ) : (
          <div className="grid grid-cols-4 gap-2">
            {categories.map((c) => {
              const active = c.id === suggestedCategoryId;
              return (
                <button
                  key={c.id}
                  onClick={() => onPick(c.id)}
                  className={cn("flex flex-col items-center gap-1.5 rounded-card-sm p-2.5", active && "well-pressed")}
                >
                  <CategoryIcon categoryKey={c.icon} color={c.color} className="h-9 w-9 rounded-full" />
                  <span className="w-full truncate text-center text-[9px] font-medium text-text-dim">{c.name}</span>
                </button>
              );
            })}
          </div>
        )}

        <button onClick={onLater} className="mt-4 w-full text-center text-[11.5px] font-semibold text-text-faint">
          Категоризувати пізніше
        </button>
      </div>
    </div>
  );
}
