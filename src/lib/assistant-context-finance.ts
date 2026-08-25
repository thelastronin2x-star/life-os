"use client";

import { useFinanceStore, getPeriodTotals, type Transaction, type BudgetCategory } from "./finance-store";
import { formatDateKey } from "./calendar-utils";
import { periodStartKey } from "./finance-periods";
import { median } from "./stats";

/** Finance's own context builder, in its own file — see
 *  assistant-context-calendar.ts for why the split matters. Finance has no
 *  scoped bubble of its own (see MiniContext), but this still stays split
 *  out so it doesn't drag finance-store into calendar/health/work bundles
 *  via assistant-context-global.ts / assistant-context-report.ts. */

function daysAgoKey(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return formatDateKey(d);
}

/** Categories currently over their (calendar-month) limit — the "significant
 *  change" half of the finance insight trigger. Pure — takes both slices as
 *  params so computeFinanceSignature can be reactive (see below). */
function overLimitCategoryIds(transactions: Transaction[], budgetCategories: BudgetCategory[]): string[] {
  const monthStart = periodStartKey("Місяць");
  return budgetCategories
    .map((c) => ({ c, limit: Object.values(c.limitsByAccount).reduce((sum, v) => sum + v, 0) }))
    .filter(({ limit }) => limit > 0)
    .filter(({ c, limit }) => {
      const spent = transactions
        .filter((t) => t.categoryId === c.id && t.type === "expense" && t.date >= monthStart)
        .reduce((sum, t) => sum + t.amount, 0);
      return spent > limit;
    })
    .map(({ c }) => c.id)
    .sort();
}

/** Whether today contains an expense that's unusually large relative to the
 *  user's own recent spending (3x the median of the last 30 days' expense
 *  amounts) — the other half of the "significant change" trigger. A fixed
 *  currency threshold would mean nothing across very different budgets. */
function hasLargeTransactionToday(transactions: Transaction[]): boolean {
  const todayKey = formatDateKey(new Date());
  const since = daysAgoKey(30);
  const recentExpenseAmounts = transactions
    .filter((t) => t.type === "expense" && t.date >= since)
    .map((t) => t.amount);
  if (recentExpenseAmounts.length < 3) return false; // too little history to call anything "unusual"
  const typical = median(recentExpenseAmounts);
  if (typical <= 0) return false;
  return transactions.some((t) => t.type === "expense" && t.date === todayKey && t.amount > typical * 3);
}

export function buildFinanceContext(): string {
  const { transactions, budgetCategories } = useFinanceStore.getState();
  const monthStart = periodStartKey("Місяць");
  const { income, expense } = getPeriodTotals(transactions, monthStart);
  const overLimit = overLimitCategoryIds(transactions, budgetCategories);
  const overLimitNames = overLimit.map((id) => budgetCategories.find((c) => c.id === id)?.name).filter(Boolean);

  return [
    `Контекст: вкладка "Баланс". З початку місяця: дохід ${income.toFixed(0)}, витрати ${expense.toFixed(0)}.`,
    overLimitNames.length > 0
      ? `Перевищено ліміт у категоріях: ${overLimitNames.join(", ")}.`
      : "Всі категорії в межах ліміту.",
    hasLargeTransactionToday(transactions) ? "Сьогодні була помітно велика транзакція порівняно зі звичними витратами." : "",
  ]
    .filter(Boolean)
    .join(" ");
}

/** No day-key here on purpose — unlike calendar/work, finance shouldn't go
 *  stale just because a new day started. It should only change when a
 *  category newly crosses its limit or an unusually large expense lands.
 *  Pure — takes both slices as params (typically reactive selectors) instead
 *  of reading `.getState()` itself. See use-finance-insight-sync.ts. */
export function computeFinanceSignature(transactions: Transaction[], budgetCategories: BudgetCategory[]): string {
  return [overLimitCategoryIds(transactions, budgetCategories).join(","), hasLargeTransactionToday(transactions)].join(
    "|"
  );
}
