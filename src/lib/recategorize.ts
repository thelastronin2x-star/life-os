import { useFinanceStore } from "./finance-store";
import { getCategoryBucketForMcc, getCategoryBucketForDescription } from "./mcc-categories";
import { categoryMeta } from "./finance-categories";
import { useMerchantRulesStore, normalizeMerchantKey } from "./merchant-rules-store";

/** Resolves a transaction to a local budget category:
 *  1. A rule the user already taught the app for this exact merchant name
 *     (learned from their own manual categorization — see learnMerchantRule)
 *  2. MCC (reliable, structured)
 *  3. A small set of unambiguous brand/format keywords, for when the MCC is
 *     missing/unmapped
 *  Auto-creates the bucket category (once) if the user hasn't already made
 *  one with that name. */
export function categoryIdForTransaction(mcc: number, description: string): string | null {
  const learned = useMerchantRulesStore.getState().getCategoryForMerchant(normalizeMerchantKey(description));
  if (learned) return learned;

  const key = getCategoryBucketForMcc(mcc) ?? getCategoryBucketForDescription(description);
  if (!key) return null;
  const state = useFinanceStore.getState();
  const existing = state.budgetCategories.find((c) => c.icon === key);
  if (existing) return existing.id;
  const meta = categoryMeta(key);
  return state.addBudgetCategory({ name: meta.name, icon: key, color: meta.color, limitsByAccount: {} });
}

/** One-time pass over already-imported "Некатегоризовано" expenses: MCC
 *  coverage, merchant keywords, and learned rules all improve over time, but
 *  a normal sync never revisits old transactions (dedup skips anything
 *  already imported) — this is what lets a coverage fix apply retroactively.
 *  Idempotent, so safe to call on every Finance screen mount.
 *
 *  Resolves categories for the whole backlog first, then commits them in a
 *  SINGLE store update — calling updateTransaction() once per transaction
 *  here used to mean one full-array re-map plus one synchronous localStorage
 *  write (via the persist middleware) per uncategorized transaction, which
 *  made saving a single new transaction visibly freeze the UI whenever there
 *  was a backlog of old uncategorized ones to re-check. */
export function recategorizeUncategorizedTransactions(): void {
  const state = useFinanceStore.getState();
  const patches = new Map<string, string>();
  for (const t of state.transactions) {
    if (t.type !== "expense" || t.categoryId !== null) continue;
    const categoryId = categoryIdForTransaction(t.mcc ?? -1, t.title);
    if (categoryId) patches.set(t.id, categoryId);
  }
  if (patches.size === 0) return;
  useFinanceStore.setState((s) => ({
    transactions: s.transactions.map((t) => (patches.has(t.id) ? { ...t, categoryId: patches.get(t.id)! } : t)),
  }));
}

/** Call whenever the user assigns a category to an expense transaction
 *  (manual add/edit) — remembers "this exact merchant name -> this
 *  category" so it applies automatically to every future transaction from
 *  the same merchant, and immediately re-applies to any other currently
 *  uncategorized transactions with the same name. This is what makes
 *  categorization scale across different users with completely different
 *  merchants, instead of relying on a hardcoded brand list. */
export function learnMerchantRule(title: string, categoryId: string): void {
  useMerchantRulesStore.getState().setRule(normalizeMerchantKey(title), categoryId);
  recategorizeUncategorizedTransactions();
}
