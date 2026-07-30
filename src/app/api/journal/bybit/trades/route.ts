import { NextRequest, NextResponse } from "next/server";
import { fetchClosedPnl, getStoredSession, BybitApiError } from "@/lib/bybit";

// Bybit's CloudFront distribution blocks API access from the US. `preferredRegion`
// has no effect here — it only applies to the Edge runtime, and this route runs
// on Node (crypto.createHmac). The actual region is set in the Vercel project's
// Settings → Functions, not in code — it must be Europe.
export const runtime = "nodejs";

const MAX_RANGE_MS = 7 * 24 * 60 * 60 * 1000; // Bybit's own closed-pnl window limit per request

export async function POST(request: NextRequest) {
  const session = await getStoredSession();
  if (!session) {
    return NextResponse.json({ error: "not_connected" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const category = body?.category === "inverse" ? "inverse" : "linear";
  const startTime = Number(body?.startTime);
  const endTime = Number(body?.endTime);

  if (!Number.isFinite(startTime) || !Number.isFinite(endTime) || endTime <= startTime) {
    return NextResponse.json({ error: "invalid_range" }, { status: 400 });
  }
  if (endTime - startTime > MAX_RANGE_MS) {
    return NextResponse.json({ error: "range_too_large" }, { status: 400 });
  }

  try {
    const trades = await fetchClosedPnl(session, category, startTime, endTime);
    return NextResponse.json({ trades });
  } catch (e) {
    if (e instanceof BybitApiError) {
      return NextResponse.json({ error: "bybit_error", details: e.message }, { status: 502 });
    }
    console.error("Bybit trades fetch failed", e);
    return NextResponse.json({ error: "fetch_failed" }, { status: 502 });
  }
}
