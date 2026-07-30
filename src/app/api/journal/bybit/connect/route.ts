import { cookies } from "next/headers";
import { NextRequest, NextResponse } from "next/server";
import { COOKIE_OPTIONS, SESSION_COOKIE, encryptSession, verifyCredentials, BybitApiError } from "@/lib/bybit";

// Bybit's CloudFront distribution blocks API access from the US. `preferredRegion`
// has no effect here — it only applies to the Edge runtime, and this route runs
// on Node (crypto.createHmac, cookies()). The actual region is set in the Vercel
// project's Settings → Functions, not in code — it must be Europe.
export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null);
  const apiKey = typeof body?.apiKey === "string" ? body.apiKey.trim() : "";
  const apiSecret = typeof body?.apiSecret === "string" ? body.apiSecret.trim() : "";
  if (!apiKey || !apiSecret) {
    return NextResponse.json({ error: "missing_credentials" }, { status: 400 });
  }

  try {
    await verifyCredentials({ apiKey, apiSecret });
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, await encryptSession({ apiKey, apiSecret }), {
      ...COOKIE_OPTIONS,
      maxAge: 60 * 60 * 24 * 180,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof BybitApiError) {
      return NextResponse.json({ error: "invalid_credentials", details: e.message }, { status: 401 });
    }
    console.error("Bybit connect failed", e);
    return NextResponse.json(
      { error: "connect_failed", details: e instanceof Error ? e.message : String(e) },
      { status: 502 }
    );
  }
}
