import type { Transaction } from "./finance-store";

export interface LedgerDedupKey {
  source: string;
  externalId: string;
}

/** `externalId` today is always "<provider>:<id>" (see monobank-import.ts),
 *  but a manually-entered transaction has none at all — those are the ones
 *  the local-data migration prompt calls out as most valuable, since they
 *  can't be recovered from anywhere else. Re-running that migration must
 *  not duplicate them either, so they get a synthetic, stable dedup key:
 *  this transaction's own local id, which never changes across runs.
 *
 *  A transaction that DOES already have a real provider externalId keeps
 *  using that exact key — the same one the webhook/statement-sync path
 *  already writes under (see monobank-bank-source.ts) — so history migrated
 *  later correctly recognizes and skips anything a live sync already
 *  inserted. */
export function dedupKeyFor(t: Pick<Transaction, "id" | "externalId">): LedgerDedupKey {
  if (t.externalId) {
    const sep = t.externalId.indexOf(":");
    if (sep > 0) return { source: t.externalId.slice(0, sep), externalId: t.externalId.slice(sep + 1) };
    return { source: "unknown", externalId: t.externalId };
  }
  return { source: "manual-local", externalId: t.id };
}
