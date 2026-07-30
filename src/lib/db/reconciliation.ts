import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { bankAccountLinks, bankConnections, balanceSnapshots } from "./schema";
import { decryptSession } from "../monobank";
import { monobankBankSource } from "../monobank-bank-source";
import { BankSourceError } from "../bank-source";

export interface ReconcileSummary {
  reconciled: number;
  rateLimited: number;
  failed: number;
}

/** Server-side balance reconciliation (Stage 6) — the authoritative
 *  replacement for the client having to successfully call client-info
 *  itself. Runs under the exact same shared rate limiter as every other
 *  caller (monobank-bank-source.ts), so calling this for many linked
 *  accounts in a row naturally spaces itself out rather than bursting.
 *  A 429 for one link just means it'll be picked up on the next run (cron,
 *  or a future manual trigger) — not a failure worth logging as one. */
export async function reconcileAllAccountLinks(): Promise<ReconcileSummary> {
  const links = await db
    .select({
      id: bankAccountLinks.id,
      userId: bankAccountLinks.userId,
      providerAccountId: bankAccountLinks.providerAccountId,
      encryptedToken: bankConnections.encryptedToken,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id));

  const summary: ReconcileSummary = { reconciled: 0, rateLimited: 0, failed: 0 };

  // Deliberately sequential, not Promise.all — the whole point is that the
  // shared rate limiter (one request per token per 60s) makes concurrent
  // reconciliation of several links from the same connection pointless
  // anyway; running them one at a time just avoids piling up connections
  // that are mostly going to 429 each other.
  for (const link of links) {
    try {
      const session = await decryptSession(link.encryptedToken);
      if (!session) {
        summary.failed++;
        continue;
      }
      const accounts = await monobankBankSource.fetchAccounts(session.token);
      const match = accounts.find((a) => a.id === link.providerAccountId);
      if (!match) {
        summary.failed++;
        continue;
      }
      await db.insert(balanceSnapshots).values({
        id: crypto.randomUUID(),
        userId: link.userId,
        accountLinkId: link.id,
        balanceMinorUnits: match.balance,
        source: "client-info",
      });
      summary.reconciled++;
    } catch (e) {
      if (e instanceof BankSourceError && e.status === 429) {
        summary.rateLimited++;
      } else {
        console.error("Balance reconciliation failed for account link", link.id, e);
        summary.failed++;
      }
    }
  }

  return summary;
}
