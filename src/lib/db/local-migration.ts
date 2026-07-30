import "server-only";
import { db } from "./client";
import { ledgerTransactions } from "./schema";
import { getAccountLinkIdsByLocalAccountId } from "./bank-connections";
import { dedupKeyFor } from "../ledger-dedup";
import type { Transaction } from "../finance-store";

const BATCH_SIZE = 500; // stays well under Postgres's per-statement parameter limit

export interface MigrationResult {
  migrated: number;
  alreadyExisted: number;
  skippedTransfers: number;
}

/** One-time upload of the client's local transaction history into the
 *  server ledger. Idempotent: every row's dedup key is stable across runs
 *  (see dedupKeyFor), and the insert itself is ON CONFLICT DO NOTHING —
 *  running this again with the same (or a superset of) local data changes
 *  nothing already migrated.
 *
 *  Transfers aren't migrated — the ledger's `amountMinorUnits` models a
 *  single account's own money in/out, and a transfer is fundamentally a
 *  two-account movement under one local record (see finance-store.ts's
 *  getAccountBalance). Forcing it into a one-sided ledger row would
 *  misrepresent it rather than just not support it yet. */
export async function migrateLocalTransactions(userId: string, transactions: Transaction[]): Promise<MigrationResult> {
  const accountLinkIdByLocalAccountId = await getAccountLinkIdsByLocalAccountId(userId);

  const skippedTransfers = transactions.filter((t) => t.type === "transfer").length;
  const rows = transactions
    .filter((t) => t.type !== "transfer")
    .map((t) => {
      const { source, externalId } = dedupKeyFor(t);
      return {
        id: crypto.randomUUID(),
        userId,
        accountLinkId: accountLinkIdByLocalAccountId.get(t.accountId) ?? null,
        source,
        externalId,
        timeSeconds: t.time ?? null,
        description: t.title,
        mcc: t.mcc ?? null,
        amountMinorUnits: Math.round(t.amount * 100) * (t.type === "expense" ? -1 : 1),
        isPending: false,
      };
    });

  let migrated = 0;
  for (let i = 0; i < rows.length; i += BATCH_SIZE) {
    const batch = rows.slice(i, i + BATCH_SIZE);
    const inserted = await db
      .insert(ledgerTransactions)
      .values(batch)
      .onConflictDoNothing({ target: [ledgerTransactions.source, ledgerTransactions.externalId] })
      .returning({ id: ledgerTransactions.id });
    migrated += inserted.length;
  }

  return { migrated, alreadyExisted: rows.length - migrated, skippedTransfers };
}
