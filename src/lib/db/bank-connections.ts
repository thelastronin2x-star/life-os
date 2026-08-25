import "server-only";
import { eq, and } from "drizzle-orm";
import { db } from "./client";
import { bankConnections, bankAccountLinks, users } from "./schema";

export interface BankConnectionRow {
  id: string;
  userId: string;
}

export async function createBankConnection(params: {
  userId: string;
  provider: string;
  encryptedToken: string;
  webhookSecretId: string;
}): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  // bank_connections.user_id has a real FK to users.id, but nothing ever
  // creates a users row in this no-real-auth model — params.userId is a
  // fresh id minted right here at connect time. Without this insert first,
  // the row below violates the FK and throws (silently swallowed by both
  // callers' try/catch as "non-fatal"), so bank_connections has stayed
  // empty and every downstream ledger/webhook DB write has been a no-op.
  await db.insert(users).values({ id: params.userId }).onConflictDoNothing();
  await db.insert(bankConnections).values({ id, ...params });
  return { id };
}

/** The webhook route has no session cookie (Monobank calls it directly) —
 *  this is how it resolves which user/connection a delivery belongs to,
 *  from the `secretId` in the URL alone. */
export async function getBankConnectionBySecretId(secretId: string): Promise<BankConnectionRow | null> {
  const rows = await db
    .select({ id: bankConnections.id, userId: bankConnections.userId })
    .from(bankConnections)
    .where(eq(bankConnections.webhookSecretId, secretId))
    .limit(1);
  return rows[0] ?? null;
}

export interface BankAccountLinkRow {
  id: string;
  userId: string;
  localAccountId: string;
}

/** Upsert so re-linking the same bank account (a new local account chosen,
 *  or just a refreshed label) updates the existing row instead of leaving a
 *  stale duplicate behind — see the unique index on (connectionId,
 *  providerAccountId) in schema.ts. */
export async function upsertBankAccountLink(params: {
  userId: string;
  connectionId: string;
  providerAccountId: string;
  localAccountId: string;
  label: string;
}): Promise<{ id: string }> {
  const existing = await db
    .select({ id: bankAccountLinks.id })
    .from(bankAccountLinks)
    .where(and(eq(bankAccountLinks.connectionId, params.connectionId), eq(bankAccountLinks.providerAccountId, params.providerAccountId)))
    .limit(1);

  if (existing[0]) {
    await db
      .update(bankAccountLinks)
      .set({ localAccountId: params.localAccountId, label: params.label })
      .where(eq(bankAccountLinks.id, existing[0].id));
    return { id: existing[0].id };
  }

  const id = crypto.randomUUID();
  await db.insert(bankAccountLinks).values({ id, ...params });
  return { id };
}

export async function getBankAccountLink(connectionId: string, providerAccountId: string): Promise<BankAccountLinkRow | null> {
  const rows = await db
    .select({ id: bankAccountLinks.id, userId: bankAccountLinks.userId, localAccountId: bankAccountLinks.localAccountId })
    .from(bankAccountLinks)
    .where(and(eq(bankAccountLinks.connectionId, connectionId), eq(bankAccountLinks.providerAccountId, providerAccountId)))
    .limit(1);
  return rows[0] ?? null;
}

/** All of this user's account links, keyed by their own `localAccountId` —
 *  the local-data migration uses this once to resolve every transaction's
 *  `accountLinkId` without a query per transaction. */
export async function getAccountLinkIdsByLocalAccountId(userId: string): Promise<Map<string, string>> {
  const rows = await db
    .select({ id: bankAccountLinks.id, localAccountId: bankAccountLinks.localAccountId })
    .from(bankAccountLinks)
    .where(eq(bankAccountLinks.userId, userId));
  return new Map(rows.map((r) => [r.localAccountId, r.id]));
}
