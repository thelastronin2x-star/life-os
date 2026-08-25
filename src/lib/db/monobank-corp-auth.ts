import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { monobankCorpAuthRequests } from "./schema";

const REQUEST_TTL_MS = 15 * 60 * 1000; // matches typical acceptUrl/app-approval windows

export async function createCorpAuthRequest(params: {
  requestToken: string;
  proof: string;
  monobankTokenRequestId: string;
}): Promise<void> {
  await db.insert(monobankCorpAuthRequests).values({
    id: params.requestToken,
    proof: params.proof,
    monobankTokenRequestId: params.monobankTokenRequestId,
  });
}

export interface CorpAuthRequestRow {
  proof: string;
  status: "pending" | "confirmed" | "expired";
  encryptedToken: string | null;
  createdAt: Date;
}

export async function getCorpAuthRequest(requestToken: string): Promise<CorpAuthRequestRow | null> {
  const rows = await db
    .select({
      proof: monobankCorpAuthRequests.proof,
      status: monobankCorpAuthRequests.status,
      encryptedToken: monobankCorpAuthRequests.encryptedToken,
      createdAt: monobankCorpAuthRequests.createdAt,
    })
    .from(monobankCorpAuthRequests)
    .where(eq(monobankCorpAuthRequests.id, requestToken))
    .limit(1);
  const row = rows[0];
  if (!row) return null;
  return { ...row, status: row.status as CorpAuthRequestRow["status"] };
}

/** Lazy expiry — no sweep job, just refuses to treat an old row as valid
 *  the next time anything reads it (mirrors the webhook secret's Redis TTL
 *  elsewhere in this codebase, just without a background reaper). */
export function isCorpAuthRequestExpired(row: Pick<CorpAuthRequestRow, "createdAt" | "status">): boolean {
  if (row.status !== "pending") return false;
  return Date.now() - row.createdAt.getTime() > REQUEST_TTL_MS;
}

/** Called by the webhook route (no cookies, can't finish the connection
 *  itself) — just stores the confirmed token for the status route (which
 *  the browser polls, and which does have a cookie jar) to pick up. */
export async function markCorpAuthRequestConfirmed(requestToken: string, encryptedToken: string): Promise<void> {
  await db
    .update(monobankCorpAuthRequests)
    .set({ status: "confirmed", encryptedToken })
    .where(eq(monobankCorpAuthRequests.id, requestToken));
}

/** Called once the status route has consumed the confirmed token and
 *  finished the connection — clears the plaintext-adjacent encrypted token
 *  out of this table so it doesn't linger twice (it's already persisted,
 *  re-encrypted under the session cookie flow, in bank_connections). */
export async function consumeCorpAuthRequest(requestToken: string): Promise<void> {
  await db
    .update(monobankCorpAuthRequests)
    .set({ status: "expired", encryptedToken: null })
    .where(eq(monobankCorpAuthRequests.id, requestToken));
}
