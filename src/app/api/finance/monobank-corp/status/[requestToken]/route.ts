import { NextRequest, NextResponse } from "next/server";
import { decryptSession } from "@/lib/monobank";
import { completeMonobankConnection } from "@/lib/monobank-connect";
import { getCorpAuthRequest, isCorpAuthRequestExpired, consumeCorpAuthRequest } from "@/lib/db/monobank-corp-auth";

// completeMonobankConnection sets a cookie and touches the DB — Node runtime.
export const runtime = "nodejs";

/** Polled by the client after it returns from the Monobank app. This is
 *  also the ONLY place that finishes the connection (sets the session
 *  cookie, registers the personal webhook, writes bank_connections) — the
 *  webhook route that actually receives the confirmed token runs
 *  server-to-server with no browser cookie jar, so it can only stash the
 *  token for this route to pick up. */
export async function GET(request: NextRequest, { params }: { params: Promise<{ requestToken: string }> }) {
  const { requestToken } = await params;
  const row = await getCorpAuthRequest(requestToken);

  if (!row || isCorpAuthRequestExpired(row)) {
    return NextResponse.json({ status: "expired" });
  }

  if (row.status === "pending") {
    return NextResponse.json({ status: "pending" });
  }

  if (row.status !== "confirmed" || !row.encryptedToken) {
    // Already consumed by an earlier poll, or declined — nothing left to do.
    return NextResponse.json({ status: "expired" });
  }

  const session = await decryptSession(row.encryptedToken);
  if (!session?.token) {
    return NextResponse.json({ status: "expired" });
  }

  try {
    await completeMonobankConnection(session.token, request.nextUrl.origin);
  } catch (e) {
    console.error("Failed to finish Monobank Corporate connection", e);
    return NextResponse.json({ error: "connect_failed" }, { status: 502 });
  }

  await consumeCorpAuthRequest(requestToken);
  return NextResponse.json({ status: "confirmed" });
}
