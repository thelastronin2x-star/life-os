"use client";

import { useFinanceStore, getAccountBalance } from "./finance-store";
import { formatDateKey } from "./calendar-utils";
import { categoryIdForTransaction } from "./recategorize";
import type { BankTransaction } from "./bank-source";

/** Imports fetched Monobank transactions (deduped by externalId), assigning
 *  a budget category from MCC where possible. Returns how many were new.
 *  Pending holds (card pre-authorizations) are skipped entirely — Mono
 *  re-sends the same purchase as a separate settled entry once it clears,
 *  often under a different id, so importing both would double-count it.
 *
 *  For transactions that already exist locally (dedup hit), backfills
 *  `time`/`mcc` if they're missing — those fields were added after this
 *  integration first shipped, so any history synced before that has
 *  neither, which breaks same-day ordering and MCC-based categorization
 *  for good unless the same date range is fetched again.
 *
 *  Shared between the manual/history-sync flow (use-monobank.ts) and the
 *  app-wide background webhook poller (use-monobank-webhook-sync.ts) so both
 *  apply identical dedup/backfill/categorization rules. */
export function importMonobankTransactions(raw: BankTransaction[], localAccountId: string): number {
  const store = useFinanceStore.getState();
  const byExternalId = new Map(store.transactions.filter((t) => t.externalId).map((t) => [t.externalId!, t]));
  let added = 0;
  for (const mt of raw) {
    if (mt.hold) continue;
    const externalId = `monobank:${mt.id}`;
    const existing = byExternalId.get(externalId);
    if (existing) {
      if (existing.time === undefined || existing.mcc === undefined) {
        const patch: Partial<typeof existing> = { time: mt.time, mcc: mt.mcc };
        if (existing.categoryId === null && existing.type === "expense") {
          patch.categoryId = categoryIdForTransaction(mt.mcc, mt.description);
        }
        store.updateTransaction(existing.id, patch);
      }
      continue;
    }
    const isExpense = mt.amount < 0;
    store.addTransaction({
      type: isExpense ? "expense" : "income",
      amount: Math.abs(mt.amount) / 100,
      categoryId: isExpense ? categoryIdForTransaction(mt.mcc, mt.description) : null,
      accountId: localAccountId,
      date: formatDateKey(new Date(mt.time * 1000)),
      time: mt.time,
      title: mt.description,
      externalId,
      mcc: mt.mcc,
    });
    added++;
  }
  return added;
}

/** Forces the local account's running balance to match a known-live
 *  Monobank balance (minor units) — the source of truth, so any gaps in
 *  imported history (older transactions never pulled, holds, fees, etc.)
 *  don't cause the displayed balance to drift from reality. */
export function reconcileBalanceFromLiveBalance(localAccountId: string, liveBalanceMinor: number): void {
  const state = useFinanceStore.getState();
  const account = state.accounts.find((a) => a.id === localAccountId);
  if (!account) return;
  // Reuses getAccountBalance (transfer-aware) rather than re-summing
  // transactions here — a duplicate sum that only checked `accountId` would
  // silently miss money that arrived via a transfer FROM another account
  // (only `transferAccountId` matches on that side), understating the
  // reconciled balance every time this ran on the receiving account.
  const localSum = getAccountBalance(account, state.transactions) - account.startingBalance;
  state.updateAccount(localAccountId, { startingBalance: liveBalanceMinor / 100 - localSum });
}
