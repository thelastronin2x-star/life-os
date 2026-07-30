import { NextResponse } from "next/server";
import { getStoredSession } from "@/lib/monobank";
import { peekWebhookEvents } from "@/lib/monobank-webhook-store";

export async function GET() {
  const session = await getStoredSession();
  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }
  if (!session.webhookSecretId) {
    return NextResponse.json({ events: [] });
  }

  const events = await peekWebhookEvents(session.webhookSecretId);
  return NextResponse.json({ events });
}
