import { NextRequest, NextResponse } from "next/server";
import { encryptSession } from "@/lib/monobank";
import { verifyMonobankWebhook } from "@/lib/monobank-webhook-verify";
import { getCorpAuthRequest, markCorpAuthRequestConfirmed } from "@/lib/db/monobank-corp-auth";

// Node's crypto (ECDSA verify) isn't available on the Edge runtime.
export const runtime = "nodejs";

const MAX_BODY_BYTES = 1_000_000;

// Monobank pings X-Callback with a plain GET to confirm it's reachable
// before the real confirmation event, same as the personal statement webhook.
export async function GET() {
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ requestToken: string; proof: string }> }
) {
  const { requestToken, proof } = await params;

  const row = await getCorpAuthRequest(requestToken);
  if (!row || row.proof !== proof) {
    return new NextResponse(null, { status: 403 });
  }
  if (row.status !== "pending") {
    // Monobank retries webhook deliveries — a repeat for an already
    // confirmed/expired request is a no-op, not an error worth a retry.
    return NextResponse.json({ ok: true });
  }

  const bodyText = await request.text();
  if (bodyText.length > MAX_BODY_BYTES) {
    return NextResponse.json({ error: "payload_too_large" }, { status: 413 });
  }
  const bodyBuffer = Buffer.from(bodyText, "utf-8");

  const xSign = request.headers.get("x-sign");
  const xKeyId = request.headers.get("x-key-id");
  if (!xSign || !xKeyId || !(await verifyMonobankWebhook(bodyBuffer, xSign, xKeyId))) {
    return NextResponse.json({ error: "invalid_signature" }, { status: 401 });
  }

  let body: { tokenRequestId?: string; token?: string };
  try {
    body = JSON.parse(bodyText);
  } catch {
    return NextResponse.json({ error: "invalid_json" }, { status: 400 });
  }

  // `token` is this implementation's best guess at the field Monobank's
  // Corporate auth-confirmation callback uses to deliver the newly-issued
  // personal token — there's no way to confirm the exact field name without
  // live Corporate API access (not available yet, per the connect route's
  // own precondition). Verify this against Monobank's docs the first time
  // a real callback arrives, and adjust here if it differs.
  if (typeof body.token !== "string" || !body.token) {
    console.error("Monobank Corporate webhook confirmed but no token field found", Object.keys(body));
    return NextResponse.json({ error: "missing_token" }, { status: 400 });
  }

  await markCorpAuthRequestConfirmed(requestToken, await encryptSession({ token: body.token }));

  return new NextResponse(null, { status: 200 }); // Monobank expects a bare 200
}
