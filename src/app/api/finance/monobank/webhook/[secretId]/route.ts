import { NextRequest, NextResponse } from "next/server";
import { monobankBankSource } from "@/lib/monobank-bank-source";
import type { BankWebhookEvent } from "@/lib/bank-source";
import { isWebhookSecretValid, pushWebhookEvent } from "@/lib/monobank-webhook-store";
import { getBankConnectionBySecretId, getBankAccountLink } from "@/lib/db/bank-connections";
import { insertLedgerTransaction } from "@/lib/db/ledger";

// Node's crypto (ECDSA over secp256k1) isn't available on the Edge runtime.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 1_000_000;

// Monobank pings this URL with a plain GET right after registration to
// confirm it's reachable, before any signed events start flowing.
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(request: NextRequest, { params }: { params: Promise<{ secretId: string }> }) {
  const { secretId } = await params;

  if (!(await isWebhookSecretValid(secretId))) {
    return NextResponse.json({ error: "unknown_secret" }, { status: 404 });
  }

  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }

  const result = await monobankBankSource.parseWebhookEvent(Buffer.from(bodyText, "utf-8"), {
    "x-sign": request.headers.get("x-sign"),
    "x-key-id": request.headers.get("x-key-id"),
  });

  if (!result.ok) {
    const status = result.reason === "invalid_payload" ? 400 : 401;
    const error = result.reason === "invalid_payload" ? "invalid_json" : result.reason;
    return NextResponse.json({ error }, { status });
  }

  if (result.event) {
    // Old queue stays in place — the client still reads from it (Stage 5
    // switches that over). This is a deliberate dual-write during the
    // transition, not a leftover: removing it now would silently break the
    // client's live-update poll before its replacement is ready.
    await pushWebhookEvent(secretId, result.event);

    // Best-effort: the Redis push above is still what actually keeps the
    // client working in this stage, so a DB hiccup here must not turn into
    // a failed webhook delivery (Monobank retries those, and retrying a
    // signature-verified, already-queued event would just re-attempt a
    // write that may well succeed the second time anyway).
    try {
      await writeToLedger(secretId, result.event);
    } catch (e) {
      console.error("Ledger DB write failed for webhook event", e);
    }
  }

  return NextResponse.json({ ok: true });
}

async function writeToLedger(secretId: string, event: BankWebhookEvent) {
  if (event.transaction.hold) return; // pending holds never enter the ledger, same as the client-side import today

  const connection = await getBankConnectionBySecretId(secretId);
  if (!connection) return; // no server-side connection row yet (see connect route's non-fatal DB write)

  const link = await getBankAccountLink(connection.id, event.accountId);

  await insertLedgerTransaction({
    userId: connection.userId,
    accountLinkId: link?.id ?? null,
    source: "monobank",
    transaction: event.transaction,
  });
}
