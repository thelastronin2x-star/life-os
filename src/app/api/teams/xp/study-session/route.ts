import { NextRequest, NextResponse } from "next/server";
import { getOrCreateDeviceId } from "@/lib/device-session";
import { awardStudySessionXp } from "@/lib/teams/db";

/** Fire-and-forget from the client whenever a study session is logged (see
 *  student-store.ts's logStudySession). No-ops if the device isn't in a
 *  team. */
export async function POST(request: NextRequest) {
  const body = (await request.json()) as Partial<{ cardsReviewed: number; minutes: number }>;
  const deviceId = await getOrCreateDeviceId();
  await awardStudySessionXp(deviceId, Math.max(0, body.cardsReviewed ?? 0), Math.max(0, body.minutes ?? 0));
  return NextResponse.json({ ok: true });
}
