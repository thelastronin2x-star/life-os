import { useFinanceStore, type Transaction } from "./finance-store";

const MAX_DAYS_APART = 3;

export interface OrphanDuplicate {
  orphanId: string; // missing time/mcc — the pending "hold" ghost
  keeperId: string; // has time/mcc — the real, settled record
  title: string;
  amount: number;
}

/** Finds transactions still missing `time` that likely aren't "unsynced" at
 *  all, but leftover ghosts from before this integration filtered out
 *  pending holds: Monobank sometimes settles a hold under a completely
 *  different transaction id, so the old hold-era import (no time/mcc, and
 *  never matched by any later re-fetch since that id doesn't exist anymore)
 *  sits next to a separate, complete, correctly-synced entry for the same
 *  real-world purchase. Matched conservatively — same title, same amount,
 *  same account, same type, dates within 3 days — to avoid flagging two
 *  genuinely separate coincidental purchases. Read-only; call
 *  removeOrphanDuplicates to actually delete what this finds. */
export function findOrphanDuplicates(): OrphanDuplicate[] {
  const transactions = useFinanceStore.getState().transactions;
  const found: OrphanDuplicate[] = [];
  const claimedKeeperIds = new Set<string>();

  for (const t of transactions) {
    if (t.time !== undefined) continue; // only candidates for removal lack a synced time
    const tTime = new Date(t.date).getTime();

    const keeper = transactions.find((other): other is Transaction => {
      if (other.id === t.id || other.time === undefined || claimedKeeperIds.has(other.id)) return false;
      if (other.title !== t.title || other.amount !== t.amount) return false;
      if (other.accountId !== t.accountId || other.type !== t.type) return false;
      const diffDays = Math.abs(new Date(other.date).getTime() - tTime) / 86_400_000;
      return diffDays <= MAX_DAYS_APART;
    });

    if (keeper) {
      claimedKeeperIds.add(keeper.id);
      found.push({ orphanId: t.id, keeperId: keeper.id, title: t.title, amount: t.amount });
    }
  }

  return found;
}

export function removeOrphanDuplicates(duplicates: OrphanDuplicate[]): void {
  const { removeTransaction } = useFinanceStore.getState();
  for (const d of duplicates) {
    removeTransaction(d.orphanId);
  }
}
