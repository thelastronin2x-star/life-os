import "server-only";
import { eq, and, gt, desc } from "drizzle-orm";
import { db } from "./client";
import { ledgerTransactions, balanceSnapshots, bankAccountLinks } from "./schema";
import type { BankTransaction } from "../bank-source";

/** Writes one bank transaction into the ledger. Idempotent via the database
 *  itself — `ON CONFLICT (source, external_id) DO NOTHING` — not a
 *  pre-check, so a race between two deliveries of the same event (or this
 *  running twice) can never insert the same transaction twice. Holds are
 *  the caller's responsibility to filter out before calling this; this
 *  function has no opinion about `hold` beyond storing it.
 *
 *  Also records a balance snapshot from the same event when `accountLinkId`
 *  is resolved — kept for history, but per monobank-sync.ts's own
 *  reconciliation comment, never treated as authoritative on its own (a
 *  concurrent hold can skew it). Only a live client-info-style fetch is. */
export async function insertLedgerTransaction(params: {
  userId: string;
  accountLinkId: string | null;
  source: string;
  transaction: BankTransaction;
}): Promise<void> {
  const { userId, accountLinkId, source, transaction } = params;

  await db
    .insert(ledgerTransactions)
    .values({
      id: crypto.randomUUID(),
      userId,
      accountLinkId,
      source,
      externalId: transaction.id,
      timeSeconds: transaction.time,
      description: transaction.description,
      mcc: transaction.mcc,
      amountMinorUnits: transaction.amount,
      isPending: transaction.hold,
    })
    .onConflictDoNothing({ target: [ledgerTransactions.source, ledgerTransactions.externalId] });

  if (accountLinkId) {
    await db.insert(balanceSnapshots).values({
      id: crypto.randomUUID(),
      userId,
      accountLinkId,
      balanceMinorUnits: transaction.balance,
    });
  }
}

const LEDGER_PAGE_SIZE = 1000;

export interface LedgerEntryDto {
  /** Always "<source>:<externalId>" — the exact same string shape the
   *  client already stores as Transaction.externalId (see
   *  monobank-import.ts), so merging these in reuses the client's existing
   *  dedup-by-externalId logic unchanged. */
  externalId: string;
  localAccountId: string | null;
  timeSeconds: number | null;
  description: string;
  mcc: number | null;
  amountMinorUnits: number;
  isPending: boolean;
}

export interface LedgerReadResult {
  entries: LedgerEntryDto[];
  /** The highest `sequence` seen in this batch, or `since` unchanged if
   *  nothing new was found — the client always advances its cursor to
   *  exactly this value, so re-requesting with it is a safe no-op (a
   *  cursor can only ever move forward to a value that was actually
   *  returned, never past unseen rows). */
  cursor: number;
}

/** Plain, non-destructive read — unlike the old peek-then-ack webhook
 *  queue, there's nothing to acknowledge: the same `since` always returns
 *  the same rows (or a superset, if new ones landed meanwhile), and asking
 *  again changes nothing server-side. */
export async function getLedgerEntriesSince(userId: string, since: number): Promise<LedgerReadResult> {
  const rows = await db
    .select({
      source: ledgerTransactions.source,
      externalId: ledgerTransactions.externalId,
      localAccountId: bankAccountLinks.localAccountId,
      timeSeconds: ledgerTransactions.timeSeconds,
      description: ledgerTransactions.description,
      mcc: ledgerTransactions.mcc,
      amountMinorUnits: ledgerTransactions.amountMinorUnits,
      isPending: ledgerTransactions.isPending,
      sequence: ledgerTransactions.sequence,
    })
    .from(ledgerTransactions)
    .leftJoin(bankAccountLinks, eq(ledgerTransactions.accountLinkId, bankAccountLinks.id))
    .where(and(eq(ledgerTransactions.userId, userId), gt(ledgerTransactions.sequence, since)))
    .orderBy(ledgerTransactions.sequence)
    .limit(LEDGER_PAGE_SIZE);

  const entries = rows.map((r) => ({
    externalId: `${r.source}:${r.externalId}`,
    localAccountId: r.localAccountId,
    timeSeconds: r.timeSeconds,
    description: r.description,
    mcc: r.mcc,
    amountMinorUnits: r.amountMinorUnits,
    isPending: r.isPending,
  }));

  const cursor = rows.length > 0 ? rows[rows.length - 1].sequence : since;
  return { entries, cursor };
}

export interface BalanceSnapshotDto {
  localAccountId: string;
  balanceMinorUnits: number;
  recordedAt: string;
}

/** The latest snapshot per linked account — informational only. Per
 *  insertLedgerTransaction's own comment, a snapshot is never authoritative
 *  on its own (a concurrent hold can skew it); the client's existing
 *  client-info-based reconciliation stays the real source of truth for
 *  balance. Returned here for forward-compatibility, not currently
 *  consumed by the client's balance display. */
export async function getLatestBalanceSnapshots(userId: string): Promise<BalanceSnapshotDto[]> {
  const rows = await db
    .selectDistinctOn([balanceSnapshots.accountLinkId], {
      localAccountId: bankAccountLinks.localAccountId,
      balanceMinorUnits: balanceSnapshots.balanceMinorUnits,
      recordedAt: balanceSnapshots.recordedAt,
    })
    .from(balanceSnapshots)
    .innerJoin(bankAccountLinks, eq(balanceSnapshots.accountLinkId, bankAccountLinks.id))
    .where(eq(balanceSnapshots.userId, userId))
    .orderBy(balanceSnapshots.accountLinkId, desc(balanceSnapshots.recordedAt));

  return rows.map((r) => ({ ...r, recordedAt: r.recordedAt.toISOString() }));
}
