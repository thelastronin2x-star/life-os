import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { db } from "@/lib/db/client";
import { newsTrackedTickers } from "@/lib/db/schema";

const MAX_TICKERS = 10;

interface SyncBody {
  tickers: string[];
}

/** Always a full-snapshot upsert, same convention as
 *  water-schedule/sync — the cron in /api/news/refresh has no access to
 *  any device's localStorage, so custom tickers have to be synced here for
 *  refresh to know which extra symbols to fetch from Alpha Vantage. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as SyncBody;
  const deviceId = await getOrCreateDeviceId();

  const tickers = Array.isArray(body.tickers)
    ? Array.from(new Set(body.tickers.map((t) => t.trim().toUpperCase()).filter(Boolean))).slice(0, MAX_TICKERS)
    : [];

  await db
    .insert(newsTrackedTickers)
    .values({ deviceId, tickers, updatedAt: new Date() })
    .onConflictDoUpdate({ target: newsTrackedTickers.deviceId, set: { tickers, updatedAt: new Date() } });

  return NextResponse.json({ ok: true });
}
