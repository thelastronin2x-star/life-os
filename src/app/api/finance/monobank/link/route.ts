import { NextRequest, NextResponse } from "next/server";
import { getStoredSession } from "@/lib/monobank";
import { upsertBankAccountLink } from "@/lib/db/bank-connections";

/** Mirrors a client-side account link (see useMonobank's `link()`) into the
 *  server ledger, so the webhook route can attribute future events to a
 *  `userId`/`localAccountId` — see monobank-server-ledger-prompt.md Stage 3.
 *  Best-effort from the client's perspective: the client-side link (still
 *  the source of truth in this stage) already succeeded by the time this is
 *  called, so a failure here is logged, not surfaced as a broken link. */
export async function POST(request: NextRequest) {
  const session = await getStoredSession();
  if (!session?.userId || !session.connectionId) {
    // No server-side connection row (DB was down at connect time, or this
    // session predates this feature) — nothing to attach the link to yet.
    return NextResponse.json({ error: "no_connection" }, { status: 409 });
  }

  const body = await request.json().catch(() => null);
  const providerAccountId = typeof body?.providerAccountId === "string" ? body.providerAccountId : "";
  const localAccountId = typeof body?.localAccountId === "string" ? body.localAccountId : "";
  const label = typeof body?.label === "string" ? body.label : "";
  if (!providerAccountId || !localAccountId || !label) {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }

  try {
    await upsertBankAccountLink({
      userId: session.userId,
      connectionId: session.connectionId,
      providerAccountId,
      localAccountId,
      label,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("Bank account link DB write failed", e);
    return NextResponse.json({ error: "link_failed" }, { status: 502 });
  }
}
