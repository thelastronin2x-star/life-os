import { NextRequest, NextResponse } from "next/server";
import { reconcileAllAccountLinks } from "@/lib/db/reconciliation";

/** Vercel Cron safety net (Stage 6) — real-time already comes from the
 *  webhook, so this only needs to run occasionally: catching a settled
 *  hold, a missed event, or general drift. Once/day (Vercel Hobby's cron
 *  ceiling) is genuinely enough for that role, not a compromise — see
 *  monobank-server-ledger-prompt.md's own framing of cron as a backstop. */
export async function GET(request: NextRequest) {
  const auth = request.headers.get("authorization");
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const summary = await reconcileAllAccountLinks();
  return NextResponse.json(summary);
}
