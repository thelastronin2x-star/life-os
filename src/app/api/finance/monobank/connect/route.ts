import { randomBytes } from "crypto";
import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_OPTIONS, SESSION_COOKIE, encryptSession } from "@/lib/monobank";
import { monobankBankSource } from "@/lib/monobank-bank-source";
import { BankSourceError } from "@/lib/bank-source";
import { registerWebhookSecret } from "@/lib/monobank-webhook-store";
import { createBankConnection } from "@/lib/db/bank-connections";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const token = typeof body?.token === "string" ? body.token.trim() : "";
  if (!token) {
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  try {
    const accounts = await monobankBankSource.fetchAccounts(token);

    const secretId = randomBytes(32).toString("hex");
    await registerWebhookSecret(secretId);
    try {
      const webhookUrl = `${request.nextUrl.origin}/api/finance/monobank/webhook/${secretId}`;
      await monobankBankSource.registerWebhook(token, webhookUrl);
    } catch (e) {
      // Non-fatal: manual sync still works without live push updates.
      console.error("Monobank webhook registration failed", e);
    }

    // Non-fatal, same reasoning as webhook registration above: the client
    // is still the source of truth in this stage, so a DB hiccup here
    // shouldn't block connecting. Without a row, the webhook route just
    // can't attribute future events to a user yet (see its own fallback).
    let userId: string | undefined;
    let connectionId: string | undefined;
    try {
      userId = crypto.randomUUID();
      const created = await createBankConnection({
        userId,
        provider: "monobank",
        encryptedToken: await encryptSession({ token }),
        webhookSecretId: secretId,
      });
      connectionId = created.id;
    } catch (e) {
      userId = undefined;
      connectionId = undefined;
      console.error("Bank connection DB write failed", e);
    }

    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, await encryptSession({ token, webhookSecretId: secretId, userId, connectionId }), {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 180,
    });
    return NextResponse.json({ accounts });
  } catch (e) {
    if (e instanceof BankSourceError && e.status === 403) {
      return NextResponse.json({ error: "invalid_token" }, { status: 401 });
    }
    console.error("Monobank connect failed", e);
    return NextResponse.json({ error: "connect_failed" }, { status: 502 });
  }
}
