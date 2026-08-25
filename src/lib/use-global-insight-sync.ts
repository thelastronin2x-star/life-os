"use client";

import { useCalendarStore } from "./calendar-store";
import { useHealthStore } from "./health-store";
import { useJournalStore } from "./journal-store";
import { useFinanceStore } from "./finance-store";
import { useGenericSourceSync, type SourceInsightState } from "./use-generic-source-sync";
import { buildGlobalContext, computeGlobalSignature } from "./assistant-context-global";
import type { Profile } from "./store";

const GLOBAL_FAST_MS = 3000; // Home has no "closed" state — this is the only cadence it ever uses
const GLOBAL_COOLDOWN_MS = 3 * 60 * 60 * 1000; // a cross-source read is expensive to keep regenerating — once per ~3h ceiling

/** Home's cross-source insight — reactively subscribed to all four sources
 *  at once, so a single edit in any of them (Календар today, Фінанси a
 *  second later) restarts the *same* debounce window rather than firing
 *  twice — computeGlobalSignature concatenates all four into one string,
 *  so one signature change is all useDebouncedInsightTrigger ever sees.
 *  Always uses the fast cadence: Home's card is either on screen or the
 *  page isn't mounted, there's no separate "closed panel" state to be slow
 *  for. */
export function useGlobalInsightSync(profile: Profile): SourceInsightState {
  const calendarItems = useCalendarStore((s) => s.items);
  const health = useHealthStore();
  const trades = useJournalStore((s) => s.trades);
  const transactions = useFinanceStore((s) => s.transactions);
  const budgetCategories = useFinanceStore((s) => s.budgetCategories);

  const signature = computeGlobalSignature({ calendarItems, health, trades, transactions, budgetCategories, profile });

  return useGenericSourceSync(
    "global",
    signature,
    () => buildGlobalContext(profile),
    GLOBAL_FAST_MS,
    GLOBAL_COOLDOWN_MS,
    "global"
  );
}
