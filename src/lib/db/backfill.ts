import "server-only";
import { eq } from "drizzle-orm";
import { db } from "./client";
import { backfillJobs, bankAccountLinks, bankConnections } from "./schema";

export interface BackfillJobRow {
  id: string;
  userId: string;
  accountLinkId: string;
  status: string;
  cursorSeconds: number;
  windowsProcessed: number;
  historyExhausted: boolean;
  lastError: string | null;
}

export async function createBackfillJob(params: {
  userId: string;
  accountLinkId: string;
  cursorSeconds: number;
}): Promise<{ id: string }> {
  const id = crypto.randomUUID();
  await db.insert(backfillJobs).values({ id, ...params });
  return { id };
}

export async function getBackfillJob(id: string): Promise<BackfillJobRow | null> {
  const rows = await db.select().from(backfillJobs).where(eq(backfillJobs.id, id)).limit(1);
  return rows[0] ?? null;
}

export async function updateBackfillJob(
  id: string,
  patch: Partial<Pick<BackfillJobRow, "status" | "cursorSeconds" | "windowsProcessed" | "historyExhausted" | "lastError">>
): Promise<void> {
  await db
    .update(backfillJobs)
    .set({ ...patch, updatedAt: new Date() })
    .where(eq(backfillJobs.id, id));
}

export interface BackfillLinkContext {
  userId: string;
  connectionId: string;
  providerAccountId: string;
  encryptedToken: string;
}

/** What a backfill step needs to actually call the bank — resolved once by
 *  the start/step routes so the job row itself only needs to store ids. */
export async function getBackfillLinkContext(accountLinkId: string): Promise<BackfillLinkContext | null> {
  const rows = await db
    .select({
      userId: bankAccountLinks.userId,
      connectionId: bankAccountLinks.connectionId,
      providerAccountId: bankAccountLinks.providerAccountId,
      encryptedToken: bankConnections.encryptedToken,
    })
    .from(bankAccountLinks)
    .innerJoin(bankConnections, eq(bankAccountLinks.connectionId, bankConnections.id))
    .where(eq(bankAccountLinks.id, accountLinkId))
    .limit(1);
  return rows[0] ?? null;
}
