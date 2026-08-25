import { randomBytes } from "crypto";
import { NextRequest, NextResponse } from "next/server";
import { isMonobankCorpEnabled, signMonobankCorpRequest } from "@/lib/monobank-corp-sign";
import { createCorpAuthRequest } from "@/lib/db/monobank-corp-auth";

// crypto.sign with a PEM EC private key isn't available on the Edge runtime.
export const runtime = "nodejs";

const PERMISSIONS = "sp"; // statement + personal info — same scope the manual token flow already relies on

export async function POST(request: NextRequest) {
  if (!isMonobankCorpEnabled()) {
    return NextResponse.json({ error: "corp_api_disabled" }, { status: 404 });
  }

  const requestToken = crypto.randomUUID();
  const proof = randomBytes(32).toString("hex");
  const webhookUrl = `${request.nextUrl.origin}/api/finance/monobank-corp/webhook/${requestToken}/${proof}`;

  let signHeaders: Record<string, string>;
  try {
    signHeaders = signMonobankCorpRequest("/personal/auth/request", PERMISSIONS);
  } catch (e) {
    console.error("Monobank Corporate API isn't configured", e);
    return NextResponse.json({ error: "corp_api_not_configured" }, { status: 500 });
  }

  let res: Response;
  try {
    res = await fetch("https://api.monobank.ua/personal/auth/request", {
      method: "POST",
      headers: { ...signHeaders, "X-Callback": webhookUrl, "X-Permissions": PERMISSIONS },
    });
  } catch (e) {
    console.error("Monobank auth/request network error", e);
    return NextResponse.json({ error: "monobank_request_failed" }, { status: 502 });
  }

  if (!res.ok) {
    console.error("Monobank auth/request failed", res.status, await res.text().catch(() => ""));
    return NextResponse.json({ error: "monobank_request_failed" }, { status: 502 });
  }

  const data = await res.json().catch(() => null);
  const acceptUrl = typeof data?.acceptUrl === "string" ? data.acceptUrl : null;
  const tokenRequestId = typeof data?.tokenRequestId === "string" ? data.tokenRequestId : null;
  if (!acceptUrl || !tokenRequestId) {
    console.error("Unexpected Monobank auth/request response shape", data);
    return NextResponse.json({ error: "unexpected_response" }, { status: 502 });
  }

  await createCorpAuthRequest({ requestToken, proof, monobankTokenRequestId: tokenRequestId });

  return NextResponse.json({ acceptUrl, requestToken });
}
