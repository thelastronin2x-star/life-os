import { NextRequest, NextResponse } from "next/server";
import { getStoredSession } from "@/lib/monobank";
import { ackWebhookEvents } from "@/lib/monobank-webhook-store";

/** Called only after the client has successfully persisted the events it
 *  peeked — this is what actually removes them from the queue. Never ack
 *  before persisting, or an interrupted client can lose a transaction. */
export async function POST(request: NextRequest) {
  const session = await getStoredSession();
  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }
  if (!session.webhookSecretId) {
    return NextResponse.json({ ok: true });
  }

  const body = await request.json().catch(() => null);
  const ids = body?.ids;
  if (!Array.isArray(ids) || !ids.every((id) => typeof id === "string")) {
    return NextResponse.json({ error: "invalid_ids" }, { status: 400 });
  }
  if (ids.length === 0) {
    return NextResponse.json({ ok: true });
  }

  await ackWebhookEvents(session.webhookSecretId, ids);
  return NextResponse.json({ ok: true });
}
