import { NextRequest, NextResponse } from "next/server";
import { verifySignatureAppRouter } from "@upstash/qstash/nextjs";
import { processBackfillStep } from "@/lib/db/backfill-worker";

// Node's crypto is used for signature verification — not available on Edge.
export const runtime = "nodejs";

/** QStash-triggered — never called directly by the client. Each invocation
 *  processes exactly one history window and, if there's more to do,
 *  schedules its own continuation (see processBackfillStep) — this route
 *  itself never loops, so it can never run into a serverless function's
 *  execution-time limit no matter how much history there is to walk. */
export const POST = verifySignatureAppRouter(async (request: NextRequest) => {
  const body = await request.json();
  const jobId = typeof body?.jobId === "string" ? body.jobId : "";
  if (!jobId) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  await processBackfillStep(jobId, request.url);

  return NextResponse.json({ ok: true });
});
