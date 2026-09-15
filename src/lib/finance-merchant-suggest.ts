import type { Transaction } from "./finance-store";

/** The one classifier the Apple Pay quick-categorize prompt explicitly asks
 *  not to duplicate — merchant name matched against the user's own history,
 *  most-recent categorized occurrence wins. Returns null (no pre-selection)
 *  when the merchant is new or every past occurrence is itself
 *  uncategorized — never guesses from a merchant-name keyword list, only
 *  from what this specific user has actually done before. */
export function suggestCategoryForMerchant(merchant: string, transactions: Transaction[]): string | null {
  const normalized = merchant.trim().toLowerCase();
  if (!normalized) return null;

  const match = transactions
    .filter((t) => t.type === "expense" && t.categoryId && t.title.trim().toLowerCase() === normalized)
    .sort((a, b) => b.date.localeCompare(a.date))[0];

  return match?.categoryId ?? null;
}
