import { NextResponse } from "next/server";
import { getStoredSession } from "@/lib/monobank";
import { getBackfillJob } from "@/lib/db/backfill";

/** Polled by the client to show backfill progress — the job's own state in
 *  the database IS the progress, there's nothing held in memory anywhere
 *  for this to read from. */
export async function GET(request: Request, { params }: { params: Promise<{ jobId: string }> }) {
  const session = await getStoredSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const { jobId } = await params;
  const job = await getBackfillJob(jobId);
  if (!job || job.userId !== session.userId) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }

  return NextResponse.json({
    status: job.status,
    cursorSeconds: job.cursorSeconds,
    windowsProcessed: job.windowsProcessed,
    historyExhausted: job.historyExhausted,
    lastError: job.lastError,
  });
}
