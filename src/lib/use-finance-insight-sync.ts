"use client";

import { useFinanceStore } from "./finance-store";
import { useGenericSourceSync, type SourceInsightState } from "./use-generic-source-sync";
import { buildFinanceContext, computeFinanceSignature } from "./assistant-context-finance";

const FINANCE_DEBOUNCE_MS = 2 * 60 * 1000; // just enough to coalesce a burst of same-minute transactions
const FINANCE_COOLDOWN_MS = 7 * 60 * 60 * 1000; // never regenerate more than ~once every 6-8h regardless of new triggers

/** Fires on a category crossing its limit or an unusually large expense,
 *  but never more than once every ~7h even if more trigger-worthy events
 *  land in the meantime — finance data changes far too often to regenerate
 *  on every qualifying event. Reactively subscribed (not `.getState()`) —
 *  see use-calendar-insight-sync.ts. Finance has no scoped bubble of its
 *  own, so there's no "panel open" fast path here — only Home reads this,
 *  via useGlobalInsightSync's own reactive subscription. */
export function useFinanceInsightSync(): SourceInsightState {
  const transactions = useFinanceStore((s) => s.transactions);
  const budgetCategories = useFinanceStore((s) => s.budgetCategories);
  const signature = computeFinanceSignature(transactions, budgetCategories);
  return useGenericSourceSync("finance", signature, buildFinanceContext, FINANCE_DEBOUNCE_MS, FINANCE_COOLDOWN_MS);
}
