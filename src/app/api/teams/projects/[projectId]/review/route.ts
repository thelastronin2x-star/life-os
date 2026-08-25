import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { reviewDeckCard } from "@/lib/teams/db";
import { REVIEW_QUALITY, type ReviewQuality } from "@/lib/sm2";

const VALID_QUALITIES = new Set<number>(Object.values(REVIEW_QUALITY));

export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<{ cardId: string; quality: number }>;
  if (!body.cardId || body.quality === undefined || !VALID_QUALITIES.has(body.quality)) {
    return NextResponse.json({ error: "invalid_input" }, { status: 400 });
  }

  const deviceId = await getOrCreateDeviceId();
  const ok = await reviewDeckCard(deviceId, body.cardId, body.quality as ReviewQuality);
  if (!ok) {
    return NextResponse.json({ error: "not_found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
