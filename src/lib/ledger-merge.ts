import { formatDateKey } from "./calendar-utils";
import { categoryIdForTransaction } from "./recategorize";
import type { Transaction } from "./finance-store";

export interface LedgerEntryDto {
  externalId: string;
  localAccountId: string | null;
  timeSeconds: number | null;
  description: string;
  mcc: number | null;
  amountMinorUnits: number;
  isPending: boolean;
}

/** Turns one server ledger entry into a local Transaction, or null if it
 *  can't be placed yet — same reasoning as importMonobankTransactions:
 *  holds are never stored locally (though by construction nothing currently
 *  inserted into the ledger has isPending:true — this is belt-and-suspenders
 *  against a future insert path forgetting to filter them), and an entry
 *  whose bank account isn't linked to a local one yet has nowhere to go. */
export function toLocalTransaction(entry: LedgerEntryDto): Omit<Transaction, "id"> | null {
  if (!entry.localAccountId || entry.isPending) return null;

  const isExpense = entry.amountMinorUnits < 0;
  const timeSeconds = entry.timeSeconds ?? Math.floor(Date.now() / 1000);

  return {
    type: isExpense ? "expense" : "income",
    amount: Math.abs(entry.amountMinorUnits) / 100,
    categoryId: isExpense ? categoryIdForTransaction(entry.mcc ?? -1, entry.description) : null,
    accountId: entry.localAccountId,
    date: formatDateKey(new Date(timeSeconds * 1000)),
    time: entry.timeSeconds ?? undefined,
    title: entry.description,
    externalId: entry.externalId,
    mcc: entry.mcc ?? undefined,
  };
}
