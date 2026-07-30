import { NextRequest, NextResponse } from "next/server";
import { getStoredSession } from "@/lib/monobank";
import { createBackfillJob } from "@/lib/db/backfill";
import { getBankAccountLink } from "@/lib/db/bank-connections";
import { qstashClient } from "@/lib/qstash-client";

/** Starts a durable, chained history-backfill run for one linked account
 *  (Stage 6) — replaces the client-side sleep-loop in the old
 *  refreshHistory. Creates the job row, then kicks off the first step
 *  immediately (delay 0); every step after that schedules the next one
 *  itself (see backfill-worker.ts).
 *
 *  Takes `providerAccountId`, not a server-side account-link id — the
 *  client never learned that id (Stage 3's /link route didn't return it),
 *  and resolving it here via the session's own connectionId is simpler
 *  than teaching the client a new id to remember. */
export async function POST(request: NextRequest) {
  const session = await getStoredSession();
  if (!session?.userId || !session.connectionId) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const providerAccountId = typeof body?.providerAccountId === "string" ? body.providerAccountId : "";
  const earliestSyncedAtSeconds = Number(body?.earliestSyncedAtSeconds);
  if (!providerAccountId || !Number.isFinite(earliestSyncedAtSeconds)) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  const link = await getBankAccountLink(session.connectionId, providerAccountId);
  if (!link) {
    return NextResponse.json({ error: "not_linked" }, { status: 404 });
  }

  const { id: jobId } = await createBackfillJob({
    userId: session.userId,
    accountLinkId: link.id,
    cursorSeconds: earliestSyncedAtSeconds - 1,
  });

  const stepUrl = `${request.nextUrl.origin}/api/finance/monobank/backfill-history/step`;
  await qstashClient.publishJSON({ url: stepUrl, body: { jobId } });

  return NextResponse.json({ jobId });
}
