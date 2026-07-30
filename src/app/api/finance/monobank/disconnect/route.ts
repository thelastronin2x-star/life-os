import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { SESSION_COOKIE, getStoredSession } from "@/lib/monobank";
import { monobankBankSource } from "@/lib/monobank-bank-source";
import { deleteWebhookSecret } from "@/lib/monobank-webhook-store";

export async function POST() {
  const session = await getStoredSession();

  if (session) {
    try {
      await monobankBankSource.unregisterWebhook(session.token);
    } catch (e) {
      console.error("Monobank webhook unsubscribe failed", e);
    }
    if (session.webhookSecretId) {
      await deleteWebhookSecret(session.webhookSecretId);
    }
  }

  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
  return NextResponse.json({ ok: true });
}
