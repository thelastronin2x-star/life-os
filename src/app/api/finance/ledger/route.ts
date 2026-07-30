import { NextRequest, NextResponse } from "next/server";
import { getStoredSession } from "@/lib/monobank";
import { getLedgerEntriesSince, getLatestBalanceSnapshots } from "@/lib/db/ledger";

/** Cursor-based read replacing the old webhook peek-then-ack queue (Stage
 *  5). Non-destructive and idempotent: the same `since` always returns the
 *  same rows, and asking again changes nothing server-side — unlike the
 *  Redis queue, there's no "ack" step at all. */
export async function GET(request: NextRequest) {
  const session = await getStoredSession();
  if (!session?.userId) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const sinceParam = request.nextUrl.searchParams.get("since");
  const since = sinceParam ? Number(sinceParam) : 0;
  if (!Number.isFinite(since) || since < 0) {
    return NextResponse.json({ error: "invalid_since" }, { status: 400 });
  }

  try {
    const [{ entries, cursor }, balances] = await Promise.all([
      getLedgerEntriesSince(session.userId, since),
      getLatestBalanceSnapshots(session.userId),
    ]);
    return NextResponse.json({ transactions: entries, balances, cursor });
  } catch (e) {
    console.error("Ledger read failed", e);
    return NextResponse.json({ error: "read_failed" }, { status: 502 });
  }
}
